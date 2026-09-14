# Divergences from the Rust reference implementation

This library is a TypeScript port of
[`BlockchainCommons/bc-rand-rust`](https://github.com/BlockchainCommons/bc-rand-rust)
(crate `bc-rand`), tracked at version **0.5.0**
([`8f53717`](https://github.com/BlockchainCommons/bc-rand-rust/commit/8f53717e35300933e9ca1bc6c51bddc0854cfb9e)),
over `rand_core` 0.9.5 and `rand_xoshiro` 0.7.0.

The tracked version and commit are recorded in
[`.github/versions.yml`](./.github/versions.yml), and the `upstream.yml`
workflow opens a tracking issue whenever the reference implementation moves
ahead of it.

`tests/rust-validation` replays the golden vectors and the full corpus against
`bc-rand = "=0.5.0"` on every CI run (`rust-validation` job):

```sh
cd tests/rust-validation
cargo run --release --offline -- ../vectors/vectors.json
bun run vectors:full   # materialises the whole corpus to a temp file; replay it the same way
```

Result (2026-09-14): golden `490 vectors - 462 match, 28 js-only, 0 MISMATCH`;
full corpus `3150 vectors - 3122 match, 28 js-only, 0 MISMATCH`. There is no
divergence allowlist: a difference is a MISMATCH. Every recipe ends with a
four-draw state probe, so a throw or a draw at a different point is caught.
Throws are one outcome class on both sides, because the reference has no error
type; the port's error code and message are pinned by
`tests/golden-vectors.test.ts` and the golden snapshot.

This document is the deliberate record of every place the TypeScript behaviour
differs from the Rust reference. It has three kinds of entry:

1. **True behavioral divergences** - the same input produces a different outcome.
2. **JS-only input domain** - inputs that have no Rust analog, so there is nothing to diverge from.
3. **Mapping equivalences** - JS-specific spellings, proven through the values they produce.

## 1. True behavioral divergences

### D1. A signed range longer than its width's `MAX`

`rng_next_in_range` and `rng_next_in_closed_range` compute
`upper_bound - lower_bound` in the signed type. With overflow checks (debug
builds, and this package's harness) that panics before any draw. With Cargo's
default release profile it wraps and samples a shorter, wrong range: from the
fixture seed, `i8` `-128..=127` yields only `-128` and `-127`, and `i64`
`-7..=i64::MAX` yields `552341500324479799`.

Every signed sampler here (`…I8` to `…I64`, half-open and closed) throws
`RandError` `RangeTooLong` (`"range length must be an integer in [0, MAX], got
<length>"`, `[1, MAX]` for half-open ranges) before drawing, and leaves the
generator untouched: the checked outcome. Rust treats integer overflow as a
program error, so the wrap is not reproduced. 33 golden vectors pin the throw
against the checked reference; CI also replays the golden file on the unchecked
release profile (informational, never blocking), where exactly those 33 vectors
MISMATCH: `490 vectors - 429 match, 28 js-only, 33 MISMATCH` (2026-09-14). No
in-stack caller uses such ranges. Upstream report: pending (drafted, not yet
filed). If a `bc-rand` release changes these ranges, this package follows that
release.

### D2. A `usize` above `2^53 - 1`

The `…Usize` samplers take `number`s and accept only safe integers; the
reference's 64-bit `usize` reaches `2^64 - 1`. A `number` cannot hold those
values exactly. Nothing is lost: the `…U64` samplers take `bigint`s and draw
exactly as the reference's 64-bit `usize` does. The harness counts these inputs
as `js-only` (4 vectors).

## 2. JS-only input domain

Each entry throws `RandError` before touching the generator, unless it says
otherwise.

- **Integers outside a sampler's width, non-integers, `NaN`, or the wrong
  numeric type** (`nextWithUpperBoundU8(rng, 256)`, `nextInRangeI8(rng, -200, 5)`,
  `nextInRangeU64(rng, -1n, 5n)`, `1.5`, a `number` passed to a `bigint`
  sampler): `InvalidArgument`,
  `"<name> must be an integer in [<min>, <max>], got <value>"`. The reference's
  widths are types. Nothing is masked. 17 `domain/bound/*` and `domain/range/*`
  vectors.
- **Seeds and states that are not four `u64` words or exactly 32 bytes**:
  arrays of another length or with holes, words outside `u64` or not `bigint`,
  typed arrays other than `Uint8Array`, `ArrayBuffer`, `DataView`, strings:
  `InvalidSeed` (`"seed must be four u64 words or 32 bytes, got Array(3)"`,
  `"seed[1] must be an integer in [0, 18446744073709551615], got undefined"`,
  `"seed byte length must be an integer in [32, 32], got 31"`,
  `"state byte length must be …"`). Only four `0n` words or 32 zero bytes reach
  the all-zero substitution. `Buffer` and a `Uint8Array` from another realm are
  bytes. 7 `domain/seed/*` vectors; holes and non-array inputs are not
  JSON-expressible and stay in `tests/rand.test.ts`.
- **A `dest` that is not a `Uint8Array`** (`fillRandomBytes`, `fillBytes`,
  `fillBytesPacked`): `InvalidArgument`, `"dest must be a Uint8Array, got …"`.
- **`randomBytes(size)`** with a size that is not a non-negative safe integer:
  `InvalidArgument`. A size the host cannot allocate fails with the host's own
  error; the reference aborts on allocation failure.
- **A generator that breaks the contract**: `nextU64()` not a `bigint` in
  `[0, 2^64 - 1]`; `nextU32()` or `nextU64Low32()` not an integer in
  `[0, 2^32 - 1]`; a missing or non-callable `fillBytes`, `nextU32` or
  `nextU64`, or a present but non-callable `nextU64Low32`; or `undefined`/`null`
  passed straight to a sampler: `InvalidGenerator` naming the method, at the
  draw (the generator is left where the bad draw put it). `randomBytes`,
  `fillRandomBytes` and `randomBool` treat an `undefined` or `null` `rng` as the
  secure generator. A generator that meets the contract but never leaves
  Lemire's rejection zone (for example a constant draw of 0) loops forever, as
  in the reference.
- **Any object implementing `RandomNumberGenerator`** is accepted by
  `randomBytes`, `fillRandomBytes`, `randomBool` and the samplers. Their Rust
  counterparts require `bc_rand::RandomNumberGenerator`, so types implementing
  only `RngCore + CryptoRng` (such as `bc-components`' `HKDFRng`) cannot be
  passed there.
- **The 32-byte seed form** `new SeededRng(bytes)`: four little-endian `u64`
  words, the layout `rand_xoshiro::from_seed` reads, including the all-zero
  substitution. Proven equal to the word form (`seedbytes/*`, `seed/zero/*`).
- **`SeededRng.state` and `SeededRng.fromState(state)`**: the 32 little-endian
  state bytes (a copy), and a restore that applies no substitution. `bc-rand`
  exposes neither; they map to `provenance-mark`'s
  `Xoshiro256StarStar::to_data` / `from_data` (§3). An all-zero state draws
  zeros and stays all zero (`tests/rand.test.ts`, executed against
  provenance-mark 0.24.0: `next_u64 = 0`, `next_bytes(4) = [0, 0, 0, 0]`).
- **`nextU64Low32?()`**: an optional fast path for the 8/16/32-bit samplers. It
  returns exactly the low 32 bits of the `nextU64()` the reference would draw,
  advancing the generator the same way, without a `bigint`. The counter vectors
  prove the fallback; the seeded vectors prove the fast path.

## 3. Mapping equivalences

| TypeScript | Rust | Notes |
|---|---|---|
| `new SeededRng([a, b, c, d])`, `new SeededRng(bytes32)` | `SeededRandomNumberGenerator::new([u64; 4])` (`Xoshiro256StarStar::from_seed`) | same word order; an all-zero seed becomes `seed_from_u64(0)` (first draw `11091344671253066420`) |
| `SeededRng.fromState(state)`, `rng.state` | `provenance-mark` `Xoshiro256StarStar::from_data` / `to_data` | no zero substitution: an all-zero state draws zeros, as there |
| `rng.clone()` | `#[derive(Clone)]` | |
| `SeededRng.forTesting()`, `TEST_SEED` (frozen), `testRandomBytes(n)` | `make_fake_random_number_generator()`, the test seed, `fake_random_data(n)` | |
| `rng.nextU64()` | `next_u64()` (trait and inherent) | |
| `rng.nextU32()` | `RngCore::next_u32`, `rng_random_u32`; for the seeded wrapper `next_u64() as u32` (the low half) | `rand_xoshiro`'s own high-half `next_u32` is used only for `fillBytesPacked`'s 1–4-byte tail |
| `rng.fillBytes(dest)`, `randomBytes(n, { rng })`, `fillRandomBytes(dest, { rng })` | `fill_random_data`, `random_data`, `rng_random_data`, `rng_fill_random_data`, `rng_random_array::<N>` | seeded: one 64-bit step per byte, low byte kept |
| `SeededRng.fillBytesPacked(dest)`; `rng.fillBytesPacked ?? rng.fillBytes` | `RngCore::fill_bytes` (`rand_core::impls::fill_bytes_via_next` for the seeded generator) | 8 little-endian bytes per step; a 5–7-byte tail from one more step; a 1–4-byte tail from the high half of one more step. Differs from `fillBytes` only for the seeded generator. Reference code that reaches the generator through `rand_core` generics (e.g. `bc-crypto`'s Ed25519 key generation) maps here |
| `nextWithUpperBound{U8,U16,U32,U64}`, `nextInRange{U8…U64,I8…I64}`, `nextInClosedRange{…}` | `rng_next_with_upper_bound::<T>`, `rng_next_in_range::<T>`, `rng_next_in_closed_range::<T>` | every width draws `next_u64() & mask` (Lemire). The unsigned full-width early return draws one raw value and throws `ValueDoesNotFit` unless it fits, where the reference panics; a half-open full-width range can return `end`, as in the reference |
| `nextWithUpperBoundUsize`, `nextInRangeUsize`, `nextInClosedRangeUsize` | `::<usize>` on 64-bit targets | 64-bit draw over `number`s. Not the `…U32` samplers, which draw differently. The reference on 32-bit targets differs from itself on 64-bit (upstream report, pending) |
| `randomBool({ rng })` | `rng_random_bool` = `next_u32().is_multiple_of(2)` | |
| `SecureRng`, `secureRng()`; `randomBytes(n)`, `fillRandomBytes(dest)` without `rng` | `SecureRandomNumberGenerator`, `thread_rng()`; free `random_data`, `fill_random_data` | provider differs (Web Crypto, filled in chunks of at most 65,536 bytes, vs `StdRng` seeded once from `getrandom`); non-deterministic on both sides and not vectored; any length is accepted |
| `RandError`: `InvalidArgument` (including a zero bound), `EmptyRange`, `RangeTooLong`, `ValueDoesNotFit`, `CryptoUnavailable` | panics: `assert!(upper_bound != T::zero())`, `assert!(lower_bound < upper_bound)` and `<=`, `attempt to subtract with overflow` (checked builds), `Option::unwrap()` after `from_u64`, `"Failed to seed RNG"` | thrown at the same point with the same generator state; the messages are the port's own |
| `RandomNumberGenerator` (interface) | `RandomNumberGenerator: RngCore + CryptoRng` | no marker type; the seeded generator is accepted wherever a generator is, as in the reference (`impl CryptoRng for SeededRandomNumberGenerator`) |

`Debug` output and host inspection (`util.inspect`) differ; both are developer
aids with no stability contract.

## Maintenance

When the upstream reference moves:

1. Review the diff via the link in the `upstream.yml` tracking issue.
2. Port the relevant changes.
3. Update `.github/versions.yml` with the new version and commit.
4. Update the tracked version and the harness results at the top of this file.
5. Add, amend, or remove divergence entries as the port requires.

A MISMATCH in `tests/rust-validation` is a bug on one side. A genuinely
language-mandated difference goes into §1 or §2 in the same change and, only
when the reference cannot express the input, becomes a `js-only` rule in
`tests/rust-validation/src/main.rs`. Regenerate vectors with
`bun run vectors:generate`; CI replays the golden file and the full corpus
against the reference.
