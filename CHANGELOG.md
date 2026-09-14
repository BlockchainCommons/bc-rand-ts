# Changelog

## Unreleased

Closes the divergences the 2026-09-14 audit found unrecorded, adds the
package's error type and the raw-state restore, and restores
`RUST_DIVERGENCES.md`. Seeded streams and every vector that existed before are
byte-identical; the harness stays at `0 MISMATCH`.

### Fixed

- **Secure fills above 65,536 bytes.** `SecureRng.fillBytes`, and so
  `randomBytes(n)` / `fillRandomBytes(dest)` without `rng`, made one
  `crypto.getRandomValues` call, which throws `QuotaExceededError` above
  65,536 bytes under Node and in browsers (Bun does not enforce the quota);
  the reference's `random_data` has no limit. Fills are now chunked at 65,536
  bytes (`subarray` views, no copies); a request of at most 65,536 bytes still
  makes one call. Downstream, `Salt`/`Seed` lengths and `addSalt` above 65,536
  bytes succeed like their Rust counterparts.
- **Seed shapes.** `new SeededRng(seed)` accepted `[]`, `new Array(4)` and
  sparse arrays (all silently became the zero-seed stream), dropped a fifth
  word, and leaked engine `TypeError`s for three words, strings,
  `ArrayBuffer`s and `DataView`s; a `Uint8ClampedArray` was treated as words.
  The seed must now be an array of exactly four `bigint`s in `[0, 2^64 - 1]`,
  validated by index (a hole reports `got undefined`), or a `Uint8Array` of
  exactly 32 bytes (`Buffer` and cross-realm `Uint8Array`s included);
  everything else is `RandError` `InvalidSeed`. Only four `0n` words or 32
  zero bytes reach the all-zero substitution.
- **The generator contract is enforced.** A third-party generator whose
  `nextU64()` returned a `number`, a negative `bigint` or one above
  `2^64 - 1` leaked those values through the full-width early returns (a
  `number` out of a `bigint` sampler, `-1n` out of `nextInClosedRangeU8`) or
  crashed with an engine `TypeError`; a `nextU64Low32()` returning `-1`,
  `1.5` or `2^40 + 7` was masked. Every draw is now checked: `nextU64()` must
  return a `bigint` in `[0, 2^64 - 1]`, `nextU32()` and `nextU64Low32()` an
  integer in `[0, 2^32 - 1]`, or the sampler or helper throws `RandError`
  `InvalidGenerator` naming the method, with the generator left where the bad
  draw put it. The same error covers a missing or non-callable `fillBytes`,
  `nextU32`, `nextU64` or `nextU64Low32` (`{}`, `{ fillBytes: 1 }`,
  `{ nextU64: 5 }`, `{ nextU64Low32: 5 }`, a primitive), and `undefined` or
  `null` passed straight to a sampler; only `randomBytes`, `fillRandomBytes`
  and `randomBool` treat an `undefined`/`null` `rng` as the secure generator.
  Nothing is masked. A conforming generator is unaffected (no measurable
  slowdown: 3M draws of the U64 and U8 samplers over `SeededRng` within noise).
- **`dest` must be a `Uint8Array`.** `fillRandomBytes`, `SeededRng.fillBytes`,
  `SeededRng.fillBytesPacked` and `SecureRng.fillBytes` filled a `Uint16Array`
  or a plain array differently on each generator; they now throw `RandError`
  `InvalidArgument` (`"dest must be a Uint8Array, got …"`). `Buffer` and
  cross-realm `Uint8Array`s are accepted.
- **`TEST_SEED` is frozen.** It was a mutable array, so any module could
  change `SeededRng.forTesting()` for every other.

### Added

- `RandError`: the package's one error type, in the sibling shape (`name`,
  `code`, `details`, `is(code)`, `RandError.isRandError`, static factories,
  no public constructor). Codes: `InvalidArgument`, `EmptyRange`,
  `RangeTooLong`, `ValueDoesNotFit`, `InvalidSeed`, `InvalidGenerator`,
  `CryptoUnavailable`. Where an error already existed its message is unchanged
  byte for byte. The factories are public so that a consumer calling a member
  this package does not (bc-crypto's `fillBytesPacked`) reports the same error.
- `SeededRng.fromState(state)`: the generator whose state is exactly the 32
  bytes `state` returns, with **no** all-zero substitution. It is
  provenance-mark's `Xoshiro256StarStar::from_data` (bc-rand has no raw-state
  constructor); an all-zero state draws zeros forever, as there. `clone()` uses
  it. The constructor stays `from_seed` and substitutes an all-zero seed.
- `bun run vectors:full`: materialises the whole recipe corpus (3,150 vectors)
  to a temp file for the Rust harness; CI replays it together with the golden
  file.

### Changed (breaking)

- Every error is a `RandError`, not a `RangeError` or `TypeError`.
  `instanceof RangeError` checks must become `RandError.isRandError(e)` (or
  `e instanceof RandError`) and, where a branch is needed, `e.is(code)`.
- `BigUint64Array` seeds are rejected (`InvalidSeed`); pass `Array.from(words)`
  or the 32 bytes.

### Corrections to the 1.0.0-beta.2 entry

- The range-length message is `"range length must be an integer in [0, MAX],
  got …"` for closed ranges and `[1, MAX]` for half-open ones.
- The packed stream (`fillBytesPacked`) has three parts: eight little-endian
  bytes per 64-bit step, a tail of five to seven bytes from one more step, and
  a tail of one to four bytes from the *high* half of one more step
  (`rand_xoshiro`'s own `next_u32`), not `nextU32()`.
- `WIDTH.usize` is internal (`src/domain.ts`), not a public addition.

### Internal

- Rust harness: seed-domain inputs (another word count, a word outside `u64`,
  a byte seed that is not 32 bytes or not hex) are classified `js-only`
  instead of aborting the run; seven `domain/seed/*` golden vectors added
  (`490 vectors - 462 match, 28 js-only, 0 MISMATCH`; every earlier vector is
  byte-identical); the full corpus replays at `3150 vectors - 3122 match, 28
  js-only, 0 MISMATCH`. Both runs, plus an informational run on Cargo's
  unchecked release profile that documents D1 (`33 MISMATCH`, the signed
  range-length vectors), are the `rust-validation` CI job.
- Size budget: the root entry's limit is 3 kB (2.29 kB measured, brotlied: the
  error class and the contract checks); the samplers' stays 2 kB (1.66 kB).
- `RUST_DIVERGENCES.md` restored: D1 (signed range length, release-profile
  wrap), D2 (`usize` above `2^53 - 1`), the JS-only domain and the full stream
  and width mapping.

## 1.0.0-beta.2

Closes every recorded behavioral divergence from `bc-rand` 0.5.0.

### Fixed

- **Signed ranges longer than the width's `MAX` no longer sample a wrong
  range.** `nextInClosedRangeI8(rng, -128, 127)` returned only `-128` and
  `-127`; the `i16` and `i32` samplers behaved the same way for such
  lengths. The port had reproduced the reference's *unchecked* overflow of
  `end - start`. Every signed sampler now throws `RangeError("range length
  must be an integer in [0, MAX], got ...")` before drawing, which is the
  reference's checked-arithmetic outcome (a panic). Ranges whose length fits
  the width are unchanged.

### Changed

- `nextInRangeI64` / `nextInClosedRangeI64` throw the same `RangeError` for a
  length above `i64::MAX` instead of sampling the range exactly (the one
  divergence 1.0.0-beta.1 recorded). No consumer used these lengths.

### Added

- `nextWithUpperBoundUsize`, `nextInRangeUsize`, `nextInClosedRangeUsize`
  (`/samplers`): the reference's `usize` instantiation over `number`s in
  `[0, 2^53 - 1]`, drawing as the 64-bit samplers do. A `RangeInclusive<usize>`
  in reference code maps to these, not to the 32-bit samplers, which consume
  the generator differently and give different results from the same seed.
- `SeededRng.fillBytesPacked(dest)`, and the optional interface member
  `fillBytesPacked?`: the reference's `RngCore::fill_bytes` stream
  (`rand_core`'s `fill_bytes_via_next`: eight little-endian bytes per 64-bit
  step, a 1–4 byte tail from xoshiro's high-half `next_u32`). `fillBytes`
  keeps its meaning (`fill_random_data`, one step per byte). Reference code
  that draws through `rand_core` generics - `bc-crypto`'s Ed25519 key
  generation - maps to the packed stream.
- `WIDTH.usize` in the domain table.

### Removed

- The internal `magnitude` helpers (`toMagnitude`, `fromMagnitude`, …): with
  the length check in place, every signed length is its own magnitude.

### Internal

- Rust harness: built with `overflow-checks = true` so the reference's
  overflow is a panic, compared as a throw; throws are compared by class, not
  message; the `expected_divergence()` allowlist is gone (its two "guard"
  entries would have reported a regression as an expected divergence); new
  `usize` and `bytesPacked` operations, 483 vectors (420 before; of the 420,
  the 33 signed-overflow recipes now record the throw and the two counter/raw
  recipes gained the packed operation; the other 385 are byte-identical).

## 1.0.0-beta.1

Initial beta implementation.
