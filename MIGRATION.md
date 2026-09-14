# Migrating from `@bcts/rand` to `@blockchaincommons/rand`

`@blockchaincommons/rand` is the redesigned successor to `@bcts/rand`.

## Summary

- Replace the dependency and imports; samplers now come from
  `@blockchaincommons/rand/samplers`.
- `SeededRandomNumberGenerator` → `SeededRng`; `SecureRandomNumberGenerator` → `SecureRng`.
- `makeFakeRandomNumberGenerator()` → `SeededRng.forTesting()`; `fakeRandomData(n)` → `testRandomBytes(n)`.
- `rng.randomData(n)` / `rng.fillRandomData(b)` → `randomBytes(n, { rng })` / `rng.fillBytes(b)`.
- `rngNextXxx(rng, …)` → `nextXxx(rng, …)` from `/samplers`; the three
  un-suffixed deprecated aliases are gone.
- Arguments outside the sampler's width now throw `RandError`
  (`InvalidArgument`) instead of being masked; check any caller that relied
  on wrapping.
- Every error is a `RandError` with a `code` (§3); `instanceof RangeError`
  no longer matches anything this package throws.
- If you implement `RandomNumberGenerator`: it is three members plus two
  optional ones (`nextU64Low32`, `fillBytesPacked`), and the contract is
  checked at every draw.

## 1. The generator interface

```diff
  interface RandomNumberGenerator {
    nextU32(): number;
    nextU64(): bigint;
    fillBytes(dest: Uint8Array): void;
-   randomData(size: number): Uint8Array;
-   fillRandomData(data: Uint8Array): void;
+   nextU64Low32?(): number;               // optional: low 32 bits of a nextU64() draw, no bigint
+   fillBytesPacked?(dest: Uint8Array): void; // optional: rand_core's fill_bytes layout, when it differs from fillBytes
  }
```

`fillBytesPacked` is for a generator whose `fillBytes` is not `rand_core`'s
`fill_bytes` layout (eight little-endian bytes per 64-bit draw, a 5–7-byte tail
from one more draw, a 1–4-byte tail from the underlying `next_u32`).
`SeededRng` implements it because its `fillBytes` is the reference's
`fill_random_data` (one draw per byte); reference code that reaches a generator
through `rand_core` generics (bc-crypto's Ed25519 key generation) draws the
packed stream. If your `fillBytes` already is that layout, leave it out.

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

**The contract is checked at every draw.** `nextU64()` must return a `bigint`
in `[0, 2^64 - 1]`, and `nextU32()` / `nextU64Low32()` an integer in
`[0, 2^32 - 1]`. `@bcts/rand` and 1.0.0-beta.2 let a `number` or an
out-of-range `bigint` leak out of the full-width early returns, masked a bad
`nextU64Low32`, and crashed with an engine `TypeError` on a generator without
the member being called. All of that is now `RandError` `InvalidGenerator`
naming the method (`details: { method, value }`): a bad draw; a missing or
non-callable `fillBytes`, `nextU32`, `nextU64` or `nextU64Low32`; a primitive
in place of a generator; and `undefined`/`null` passed straight to a sampler.
Only `randomBytes`, `fillRandomBytes` and `randomBool` treat an
`undefined`/`null` `rng` as the secure generator.

`dest` must be a `Uint8Array` (`Buffer` and cross-realm `Uint8Array`s count) in
`fillRandomBytes`, `fillBytes` and `fillBytesPacked`; anything else is
`RandError` `InvalidArgument`.

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
2 ** 32)` returned `0`). Every sampler now throws `RandError` `InvalidArgument`
for a non-integer or out-of-width argument, with one message shape:

```
upperBound must be an integer in [1, 255], got 256
start must be an integer in [-128, 127], got -200
start must be less than end, got 5 and 5
```

The zero-bound error is `InvalidArgument` too, and the inverted-range one is
`EmptyRange` (they were bare `Error`). The full-range early return's
`Error("from_u64 conversion overflow")` is `ValueDoesNotFit`
(`"random value does not fit the target width"`).

**Signed range lengths.** `@bcts/rand` reproduced the reference's *unchecked*
integer overflow: `rngNextInClosedRangeI8(rng, -128, 127)` returned only `-128`
or `-127`, because `127 - (-128)` wrapped to `-1` before the range length was
taken. A signed range longer than its width's `MAX` is now `RandError`
`RangeTooLong` (`"range length must be an integer in [0, 127], got 255"`;
`[1, MAX]` for half-open ranges), the outcome of the reference when its
arithmetic is checked (debug builds, and this package's harness). Note that
Cargo's default release profile does *not* check: release-built Rust wraps and
samples a wrong range for these inputs, which is why the port does not
reproduce it (recorded as D1 in `RUST_DIVERGENCES.md`). Ranges whose length
fits are unchanged.

**Errors are `RandError`.** Every failure in the package is one class,
`RandError`, with a `code` and a `details` payload discriminated by it:

| code | when |
|---|---|
| `InvalidArgument` | an argument outside its width or not an integer (`details: { parameter, value, bounds }`); a `dest` that is not a `Uint8Array` (`{ parameter: "dest", value }`) |
| `EmptyRange` | `start >= end` (half-open) or `start > end` (closed) |
| `RangeTooLong` | a signed range longer than the width's `MAX` |
| `ValueDoesNotFit` | the full-width raw draw does not fit the target width |
| `InvalidSeed` | a seed or state that is not four `u64` words or 32 bytes (§4) |
| `InvalidGenerator` | a generator that breaks the contract (§1) |
| `CryptoUnavailable` | no Web Crypto API (was `TypeError`) |

Test with `RandError.isRandError(e)` (works across package copies) and
`e.is("RangeTooLong")`; `e instanceof RangeError` is now always `false`.

## 4. Generators

| before | after |
|---|---|
| `new SeededRandomNumberGenerator([a, b, c, d])` | `new SeededRng([a, b, c, d])`, or `new SeededRng(bytes32)` (little-endian, the layout `rand_xoshiro::from_seed` reads) |
| `makeFakeRandomNumberGenerator()` | `SeededRng.forTesting()`; the seed is exported as `TEST_SEED` |
| `fakeRandomData(n)` | `testRandomBytes(n)` |
| new | `rng.state` (the 32 bytes) and `SeededRng.fromState(state)`, which resumes it exactly (no all-zero substitution: provenance-mark's `from_data`); `new SeededRng(state)` also resumes every state a generator can reach, but substitutes an all-zero one; `rng.clone()` |
| new | every seed that is not an array of exactly four `bigint`s in `[0, 2^64 - 1]` or a `Uint8Array` of exactly 32 bytes throws `RandError` `InvalidSeed`: another length, a hole, a `number` word, a word outside `u64`, a string, an `ArrayBuffer`, a `DataView`, a typed array other than `Uint8Array` (including `BigUint64Array`, which 1.0.0-beta.2 accepted); a state that is not 32 bytes likewise |
| new | `TEST_SEED` is frozen |
| `new SecureRandomNumberGenerator()` | `new SecureRng()` or `secureRng()` |

## 5. What did not change

Every seeded `nextU64`/`nextU32`/`fillBytes` sequence; the one-draw-per-byte
fill rule; every sampler over the package's own generators for arguments
inside the width, ordered, and (for signed ranges) no longer than the width's
`MAX` — the three exceptions are §2 (`i64` ranges with a negative start) and
§3 (validated arguments; signed range lengths); the full-range early-return
branches; the value of `TEST_SEED`. Parity with the Rust reference is recorded
in [`RUST_DIVERGENCES.md`](./RUST_DIVERGENCES.md) and by the
[Rust cross-validation harness](./tests/rust-validation/README.md).
