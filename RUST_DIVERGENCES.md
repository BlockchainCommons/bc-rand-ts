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

Validation result (2026-09-09, post-redesign):

```
303 vectors - 299 match, 4 expected-divergence, 0 MISMATCH
```

At the pre-redesign freeze the same vectors reported 282 match / 21
expected-divergence; the 21 were tombstone T1 below, fixed in the redesign.

Every seeded `nextU64`/`nextU32` sequence, every byte fill, every unsigned
sampler at every head-width cliff, every signed sampler with a non-negative
start, and every full-range early return (including the overflow throw)
matches the Rust reference exactly.

## 1. True behavioral divergences

### 1.1 Signed 64-bit ranges longer than `i64::MAX` (D1)

| input | @blockchaincommons/rand | bc-rand (Rust) |
|---|---|---|
| `nextInRangeI64(rng, -7n, 9223372036854775807n)` and any `i64` range with `end - start > i64::MAX` | samples the range uniformly (exact arithmetic) | `upper_bound - lower_bound` overflows `i64`: **wraps** in release builds (returning a value from a much smaller, wrong range), **panics** in debug builds |

**Why:** the reference computes the range length in the signed type before
taking its magnitude. A length above `i64::MAX` is unrepresentable there.
TypeScript's `bigint` subtraction is exact, so the sampler sees the true
length and the true full-range branch. The Rust behaviour is not a
specification; it is arithmetic overflow, and the same inputs abort a debug
build. The TypeScript result is the contract.

**Affected vectors:** 4 of 303 (`range/i64/-…` recipes whose end minus start
exceeds `i64::MAX`), allowlisted as `D1` in the harness.

### 1.2 (resolved) `i64` range samplers with a negative start (tombstone T1)

| input | @blockchaincommons/rand (frozen) | bc-rand (Rust) |
|---|---|---|
| `rngNextInRangeI64(rng, -1n, 0n)` / `rngNextInClosedRangeI64(rng, -1n, 0n)` | out-of-range values (e.g. `1`, `2`) | in range |

**Why:** the port computes `fromMagnitude64((toMagnitude64(start) + random) & mask)`,
applying wrapping-abs to the *start*. Rust computes
`lower_bound + T::from_magnitude(random)`: a plain signed addition with the
random magnitude bit-reinterpreted as `i64`. The `i8`/`i16`/`i32` variants in
the port do the signed addition correctly; only the two `i64` functions are
wrong.

**Status:** fixed. `nextInRangeI64` / `nextInClosedRangeI64` now perform
`BigInt.asIntN(64, start + fromMagnitude64(random))`. The differential harness
carries T1 as its one landed tombstone; the 21 vectors were regenerated.

**Affected vectors:** every `range/i64/-…` recipe (21 of 303).

## 2. JS-only input domain

None. Every input the package accepts has a Rust equivalent.

## 3. Mapping equivalences

| JS-specific input | maps to |
|---|---|
| seed as `[bigint, bigint, bigint, bigint]` | `[u64; 4]`, same word order |
| `number` arguments for the 8/16/32-bit samplers | the corresponding Rust integer width; the port masks to width exactly as Rust's `as` casts do |

## Maintenance

- A new vector that diverges is either a bug (fix it) or belongs in a class
  above: document it here and add it to `expected_divergence()` in
  `tests/rust-validation/src/main.rs` in the same change.
- Re-run the harness after every `bun run vectors:generate`.
