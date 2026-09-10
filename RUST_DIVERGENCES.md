# Divergences from the Rust reference implementation

`@blockchaincommons/rand` is a port of
[bc-rand-rust](https://github.com/BlockchainCommons/bc-rand-rust) (crate
`bc-rand`), tracked at **0.5.0** (`8f53717e`). The committed golden vectors
(`tests/vectors/vectors.json`) are cross-validated against that crate by the
harness in `tests/rust-validation/`:

```sh
cd tests/rust-validation
cargo run --release -- ../vectors/vectors.json
```

Validation result (2026-09-10):

```
420 vectors - 395 match, 8 expected-divergence, 17 js-only, 0 MISMATCH
```

The vectors cover every seeded `nextU64`/`nextU32` sequence and byte fill for
eight seeds in both seed forms, the all-zero seed, every sampler at every
head-width cliff and range shape, the full-range early returns and their
overflow throws, and — through a deterministic *counter* generator whose
`next_u32` and `next_u64` consume different amounts of state — the exact
draw each sampler makes. The harness implements that generator itself, so a
sampler's consumption pattern over a third-party generator is proven against
the reference, not assumed. The 8 expected divergences are described below
(§1); the 17 JS-only vectors are inputs the reference's integer types cannot
express (§2).

This document records everything that does not match 1:1, in three classes.
The machine-readable twin of class 1 is `expected_divergence()` in
`tests/rust-validation/src/main.rs`; keep the two in sync.

## 1. True behavioral divergences

### 1.1 Signed 64-bit ranges longer than `i64::MAX`

| input | @blockchaincommons/rand | bc-rand (Rust) |
|---|---|---|
| `nextInRangeI64(rng, -7n, 9223372036854775807n)` and any `i64` range with `end - start > i64::MAX` | samples the range uniformly (exact arithmetic) | `upper_bound - lower_bound` overflows `i64`: **wraps** in release builds (returning a value from a much smaller, wrong range), **panics** in debug builds |

**Why:** the reference computes the range length in the signed type before
taking its magnitude. A length above `i64::MAX` is unrepresentable there.
TypeScript's `bigint` subtraction is exact, so the sampler sees the true
length and the true full-range branch. The Rust behaviour is not a
specification; it is arithmetic overflow, and the same inputs abort a debug
build. The TypeScript result is the contract.

**Affected vectors:** 8 of 420 (`range/i64/…` and `counter/range/i64/…`
recipes whose end minus start exceeds `i64::MAX`), allowlisted as
`i64-range-length-overflow` in `expected_divergence()`.

## 2. JS-only input domain

- **Integers outside a sampler's width** (`domain/…`, 17 vectors, reported
  as `js-only` by the harness). The reference's widths are types, so
  `rng_next_with_upper_bound::<u8>(rng, 256)` cannot be written. In
  TypeScript the width is in the function name and the argument is a
  `number` (or `bigint` for 64 bits), so `nextWithUpperBoundU8(rng, 256)`,
  `nextInRangeI8(rng, -200, 5)`, `nextInRangeU64(rng, -1n, 5n)` and a
  non-integer `1.5` are all expressible. Every one throws `RangeError`
  (`"end must be an integer in [0, 255], got 256"`); nothing is masked. The
  same applies to seed words outside `u64` and to `randomBytes(size)` with a
  non-integer size.
- **The 32-byte seed form.** `new SeededRng(bytes)` is a spelling the
  reference does not offer (`SeededRandomNumberGenerator::new` takes
  `[u64; 4]`), but not a behaviour: the harness proves it equals the word
  form for the same little-endian words (`seedbytes/…`, 8 vectors). It is
  the layout `rand_xoshiro::from_seed` reads and provenance-mark persists.
- **`SeededRng.state` and `clone()`.** The reference derives `Clone` and
  provenance-mark's Rust generator serialises the state through its own
  xoshiro copy; here both live on `SeededRng`. `state` is the same 32
  little-endian bytes provenance-mark writes on both sides.
- **`nextU64Low32`.** An optional member of the generator interface used by
  the 8/16/32-bit samplers as a no-`bigint` fast path. It has no Rust analog
  because Rust has no allocation to avoid; its contract is that it returns
  exactly the low 32 bits of the `next_u64()` the reference would draw.

## 3. Mapping equivalences

| JS-specific input | maps to |
|---|---|
| `SeededRng` seed as `[bigint, bigint, bigint, bigint]` | `SeededRandomNumberGenerator::new([u64; 4])`, same word order |
| an all-zero seed (either form) | `rand_xoshiro`'s `from_seed` substitutes `seed_from_u64(0)` (the SplitMix64 expansion of zero); `SeededRng` does the same, so the stream is the reference's (first draw `11091344671253066420`; vectors `seed/zero/*`) |
| `SeededRng.nextU32()` | the reference *wrapper*'s `next_u32` = `next_u64() as u32` (the low half). `rand_xoshiro`'s own `next_u32` takes the high half and is not exposed |
| `SeededRng.fillBytes(dest)`, `randomBytes(n, { rng })` | `RandomNumberGenerator::fill_random_data` / `random_data`: one 64-bit draw per byte, low byte kept. `RngCore::fill_bytes` (eight bytes per draw via `fill_bytes_via_next`) is a different stream and is not exposed; a port of Rust code that reaches `fill_bytes` through `rand` generics must use the trait methods instead |
| the 8/16/32-bit samplers' draw | `rng.next_u64() & mask` for every width, as the reference; `nextU64Low32` when the generator offers it (the package's generators do; the counter vectors prove both paths) |
| `number` arguments for the 8/16/32-bit samplers | the corresponding Rust integer width, validated instead of cast |
| `SecureRng` | `SecureRandomNumberGenerator`. Provider differs: the reference seeds a process-wide `StdRng` (ChaCha12) once from `getrandom`; the port calls Web Crypto's `getRandomValues` per draw. Both are cryptographically secure; neither is deterministic, so neither is vectored |
| `secureRng()` | `thread_rng()` |
| `randomBool({ rng })` | `rng_random_bool`: `next_u32().is_multiple_of(2)` — a 32-bit draw, on every generator |
| `SeededRng.forTesting()`, `testRandomBytes(n)`, `TEST_SEED` | `make_fake_random_number_generator()`, `fake_random_data(n)`, the crate's private `TEST_SEED` |
| `RangeError` | the reference's `assert!`/`unwrap()` panics (`upper_bound != 0`, `lower_bound < upper_bound`, `from_u64(...).unwrap()`); the full-range overflow message is `"random value does not fit the target width"` |
| `usize` instantiations of the samplers | none; `u32`/`u64` cover the same values |

## Maintenance

- A new vector that diverges is either a bug (fix it) or belongs in a class
  above: document it here and add it to `expected_divergence()` in
  `tests/rust-validation/src/main.rs` in the same change.
- Re-run the harness after every `bun run vectors:generate`.
