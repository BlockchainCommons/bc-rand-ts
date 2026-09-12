# Changelog

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
  the length check in place every signed length is its own magnitude.

### Internal

- Rust harness: built with `overflow-checks = true` so the reference's
  overflow is a panic, compared as a throw; throws are compared by class, not
  message; the `expected_divergence()` allowlist is gone (its two "guard"
  entries would have reported a regression as an expected divergence); new
  `usize` and `bytesPacked` operations, 483 vectors (420 before; of the 420,
  the 33 signed-overflow recipes now record the throw and the two counter/raw
  recipes gained the packed operation; the other 385 are byte-identical).
- ADRs 0001–0006 are tracked in `docs/adr`; typedoc writes to `docs/api`.

## 1.0.0-beta.1

Initial beta implementation.