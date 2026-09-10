# Migrating from `@bcts/rand` to `@blockchaincommons/rand`

`@blockchaincommons/rand` is the redesigned successor to `@bcts/rand`: the same
generators and samplers, rebuilt as an idiomatic TypeScript library. **Every
seeded output is byte-identical** except for one bug fix (section 2), proven
by 303 committed vectors, a differential corpus against the frozen
pre-redesign bundle, and cross-validation against `bc-rand` 0.5.0. It is
also substantially faster: the seeded generator runs on 32-bit integer
arithmetic, so `nextU32`, `fillBytes` and `randomBytes` never allocate a
`bigint` (4.6× to 10.8× on the benchmarks in `bench/`).

## TL;DR checklist

- [ ] Replace the dependency and imports; samplers now come from
      `@blockchaincommons/rand/samplers`.
- [ ] `SeededRandomNumberGenerator` → `SeededRng`; `SecureRandomNumberGenerator` → `SecureRng`.
- [ ] `makeFakeRandomNumberGenerator()` → `SeededRng.forTesting()`; `fakeRandomData(n)` → `testRandomBytes(n)`.
- [ ] `rng.randomData(n)` / `rng.fillRandomData(b)` → `randomBytes(n, { rng })` / `rng.fillBytes(b)`.
- [ ] `rngNextXxx(rng, …)` → `nextXxx(rng, …)` from `/samplers`; the three
      un-suffixed deprecated aliases are gone.
- [ ] Invalid bounds now throw `RangeError` (was `Error`); messages unchanged
      except the full-range overflow (below).
- [ ] If you implement `RandomNumberGenerator`: it is now three members.

## 1. The generator interface

```diff
  interface RandomNumberGenerator {
    nextU32(): number;
    nextU64(): bigint;
    fillBytes(dest: Uint8Array): void;
-   randomData(size: number): Uint8Array;
-   fillRandomData(data: Uint8Array): void;
  }
```

`randomData` and `fillRandomData` were aliases of `fillBytes`. Use the free
helpers, which take `{ rng }` and default to the secure generator:

| before | after |
|---|---|
| `rng.randomData(n)`, `rngRandomData(rng, n)`, `rngRandomArray(rng, n)` | `randomBytes(n, { rng })` |
| `rng.fillRandomData(b)`, `rngFillRandomData(rng, b)` | `rng.fillBytes(b)` or `fillRandomBytes(b, { rng })` |
| `randomData(n)` (secure, free function) | `secureRandomBytes(n)` or `randomBytes(n)` |
| `fillRandomData(b)` (secure, free function) | `fillSecureRandomBytes(b)` or `fillRandomBytes(b)` |
| `rngRandomBool(rng)` | `randomBool({ rng })` |
| `rngRandomU32(rng)` | `rng.nextU32()` |
| `threadRng()` | `secureRng()` |

## 2. One behavioural fix: `i64` ranges with a negative start

`rngNextInRangeI64` and `rngNextInClosedRangeI64` returned out-of-range
values when `start` was negative: they applied a wrapping absolute value to
the start where the reference implementation performs signed addition. The
8/16/32-bit variants were correct. `nextInRangeI64` / `nextInClosedRangeI64`
now match `bc-rand` exactly; 21 of the 303 golden vectors changed, and the
Rust harness reports zero divergences.

If you relied on the old (wrong) values for a negative start, that data was
never reproducible against the Rust or Swift implementations.

## 3. Samplers

All samplers moved to `@blockchaincommons/rand/samplers` and lost the `rng`
prefix. Widths are unchanged because the draw pattern is per width.

| before (root) | after (`/samplers`) |
|---|---|
| `rngNextWithUpperBoundU8/U16/U32/U64` | `nextWithUpperBoundU8/U16/U32/U64` |
| `rngNextInRangeU8…U64`, `I8…I64` | `nextInRangeU8…U64`, `I8…I64` |
| `rngNextInClosedRangeU8…U64`, `I8…I64` | `nextInClosedRangeU8…U64`, `I8…I64` |
| `rngNextWithUpperBound` / `rngNextInRange` / `rngNextInClosedRange` (deprecated u64 aliases) | removed; use the `U64` names |
| `wideMul*`, `toMagnitude*`, `fromMagnitude*` | same names, from `/samplers` |

Errors: `Error("upperBound must be non-zero")`, `Error("start must be less
than end")`, `Error("start must be less than or equal to end")` are now
`RangeError` with the same messages. The full-range early return's
`Error("from_u64 conversion overflow")` is now
`RangeError("random value does not fit the target width")`.

## 4. Generators

| before | after |
|---|---|
| `new SeededRandomNumberGenerator([a, b, c, d])` | `new SeededRng([a, b, c, d])`, or `new SeededRng(bytes32)` (little-endian, the layout `rand_xoshiro::from_seed` reads) |
| `makeFakeRandomNumberGenerator()` | `SeededRng.forTesting()`; the seed is exported as `TEST_SEED` |
| `fakeRandomData(n)` | `testRandomBytes(n)` |
| `new SecureRandomNumberGenerator()` | `new SecureRng()` |
| new | the all-zero seed throws `RangeError` (it is a fixed point of xoshiro256**) |

## 5. What did not change

Every seeded `nextU64`/`nextU32`/`fillBytes` sequence; the one-draw-per-byte
fill rule; every unsigned sampler; every signed sampler with a non-negative
start; the full-range early-return branches; `wideMul*` and the magnitude
helpers; `TEST_SEED`.
