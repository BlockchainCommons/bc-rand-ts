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

Validation result (2026-09-09, pre-redesign freeze):

```
303 vectors - 282 match, 21 expected-divergence, 0 MISMATCH
```

Every seeded `nextU64`/`nextU32` sequence, every byte fill, every unsigned
sampler at every head-width cliff, every signed sampler with a non-negative
start, and every full-range early return (including the overflow throw)
matches the Rust reference exactly.

## 1. True behavioral divergences

### 1.1 `i64` range samplers with a negative start (tombstone T1)

| input | @blockchaincommons/rand (frozen) | bc-rand (Rust) |
|---|---|---|
| `rngNextInRangeI64(rng, -1n, 0n)` / `rngNextInClosedRangeI64(rng, -1n, 0n)` | out-of-range values (e.g. `1`, `2`) | in range |

**Why:** the port computes `fromMagnitude64((toMagnitude64(start) + random) & mask)`,
applying wrapping-abs to the *start*. Rust computes
`lower_bound + T::from_magnitude(random)`: a plain signed addition with the
random magnitude bit-reinterpreted as `i64`. The `i8`/`i16`/`i32` variants in
the port do the signed addition correctly; only the two `i64` functions are
wrong.

**Status:** frozen bug. Fixed in Phase 3 of the redesign as the single
enumerated tombstone `T1` in `tests/differential.test.ts`; the 21 affected
vectors are regenerated at that point and this section moves to the changelog.

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
