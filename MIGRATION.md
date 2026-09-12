# Migrating from `@bcts/rand` to `@blockchaincommons/rand`

`@blockchaincommons/rand` is the redesigned successor to `@bcts/rand`.

## TL;DR checklist

- [ ] Replace the dependency and imports; samplers now come from
      `@blockchaincommons/rand/samplers`.
- [ ] `SeededRandomNumberGenerator` → `SeededRng`; `SecureRandomNumberGenerator` → `SecureRng`.
- [ ] `makeFakeRandomNumberGenerator()` → `SeededRng.forTesting()`; `fakeRandomData(n)` → `testRandomBytes(n)`.
- [ ] `rng.randomData(n)` / `rng.fillRandomData(b)` → `randomBytes(n, { rng })` / `rng.fillBytes(b)`.
- [ ] `rngNextXxx(rng, …)` → `nextXxx(rng, …)` from `/samplers`; the three
      un-suffixed deprecated aliases are gone.
- [ ] Arguments outside the sampler's width now throw `RangeError` instead of
      being masked; check any caller that relied on wrapping.
- [ ] If you implement `RandomNumberGenerator`: it is three members plus one
      optional fast path.

## 1. The generator interface

```diff
  interface RandomNumberGenerator {
    nextU32(): number;
    nextU64(): bigint;
    fillBytes(dest: Uint8Array): void;
-   randomData(size: number): Uint8Array;
-   fillRandomData(data: Uint8Array): void;
+   nextU64Low32?(): number; // optional: low 32 bits of a nextU64() draw, no bigint
  }
```

`randomData` and `fillRandomData` were aliases of `fillBytes`. Use the free
helpers, which take `{ rng }` and default to the secure generator:

| before | after |
|---|---|
| `rng.randomData(n)`, `rngRandomData(rng, n)`, `rngRandomArray(rng, n)` | `randomBytes(n, { rng })` |
| `rng.fillRandomData(b)`, `rngFillRandomData(rng, b)` | `rng.fillBytes(b)` or `fillRandomBytes(b, { rng })` |
| `randomData(n)` (secure, free function) | `randomBytes(n)` |
| `fillRandomData(b)` (secure, free function) | `fillRandomBytes(b)` |
| `rngRandomBool(rng)` | `randomBool({ rng })` |
| `rngRandomU32(rng)` | `rng.nextU32()` |
| `threadRng()` | `secureRng()` |

The samplers draw `nextU64()` from every generator, as the reference does.
`nextU64Low32` is an optimisation a generator may offer when it can return the
low half of that same draw without a `bigint`; `SeededRng` and `SecureRng` do.
A third-party generator need not implement it, and must not implement it
unless the equality holds.

## 2. Two behavioural fixes

**`i64` ranges with a negative start.** `rngNextInRangeI64` and
`rngNextInClosedRangeI64` returned out-of-range values when `start` was
negative: they applied a wrapping absolute value to the start where the
reference performs signed addition. The 8/16/32-bit variants were correct.
`nextInRangeI64` / `nextInClosedRangeI64` now match `bc-rand` exactly.

**The all-zero seed.** `@bcts/rand` accepted it and produced xoshiro's fixed
point — zero forever. The reference substitutes `seed_from_u64(0)` (the
SplitMix64 expansion of zero) and produces a normal stream; `SeededRng` now
does the same.

If you relied on the old values for either input, that data was never
reproducible against the Rust or Swift implementations.

## 3. Samplers

All samplers moved to `@blockchaincommons/rand/samplers` and lost the `rng`
prefix. Widths are unchanged because the draw pattern is per width.

| before (root) | after (`/samplers`) |
|---|---|
| `rngNextWithUpperBoundU8/U16/U32/U64` | `nextWithUpperBoundU8/U16/U32/U64` |
| `rngNextInRangeU8…U64`, `I8…I64` | `nextInRangeU8…U64`, `I8…I64` |
| `rngNextInClosedRangeU8…U64`, `I8…I64` | `nextInClosedRangeU8…U64`, `I8…I64` |
| — (`usize` was sampled through the `u32` names) | `nextWithUpperBoundUsize`, `nextInRangeUsize`, `nextInClosedRangeUsize`: the reference's 64-bit draw over `number` |
| `rngNextWithUpperBound` / `rngNextInRange` / `rngNextInClosedRange` (deprecated u64 aliases) | removed; use the `U64` names |
| `wideMul*`, `toMagnitude*`, `fromMagnitude*` | internal; not exported |

**Arguments are validated.** `@bcts/rand` masked a `number` to the width
(`rngNextInRangeI8(rng, -200, 5)` returned `81`; `rngNextWithUpperBoundU32(rng,
2 ** 32)` returned `0`). Every sampler now throws `RangeError` for a non-integer
or out-of-width argument, with one message shape:

```
upperBound must be an integer in [1, 255], got 256
start must be an integer in [-128, 127], got -200
start must be less than end, got 5 and 5
```

The zero-bound and inverted-range errors are `RangeError` too (they were bare
`Error`). The full-range early return's `Error("from_u64 conversion overflow")`
is `RangeError("random value does not fit the target width")`.

**Signed range lengths.** `@bcts/rand` reproduced the reference's *unchecked*
integer overflow: `rngNextInClosedRangeI8(rng, -128, 127)` returned only `-128`
or `-127`, because `127 - (-128)` wrapped to `-1` before the range length was
taken. A signed range longer than its width's `MAX` is now a `RangeError`
(`"range length must be an integer in [0, 127], got 255"`), the outcome of the
reference when its arithmetic is checked. Ranges whose length fits are
unchanged.

## 4. Generators

| before | after |
|---|---|
| `new SeededRandomNumberGenerator([a, b, c, d])` | `new SeededRng([a, b, c, d])`, or `new SeededRng(bytes32)` (little-endian, the layout `rand_xoshiro::from_seed` reads) |
| `makeFakeRandomNumberGenerator()` | `SeededRng.forTesting()`; the seed is exported as `TEST_SEED` |
| `fakeRandomData(n)` | `testRandomBytes(n)` |
| new | `rng.state` (the 32 bytes; `new SeededRng(state)` resumes it) and `rng.clone()` |
| new | seed words outside `u64`, or a byte seed that is not 32 bytes, throw `RangeError` |
| `new SecureRandomNumberGenerator()` | `new SecureRng()` or `secureRng()` |

## 5. What did not change

Every seeded `nextU64`/`nextU32`/`fillBytes` sequence; the one-draw-per-byte
fill rule; every sampler over the package's own generators; the full-range
early-return branches; `TEST_SEED`. Parity with the Rust reference is recorded
by the [Rust cross-validation harness](./tests/rust-validation/README.md).
