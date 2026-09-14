# Rust reference cross-validation

Replays the golden vectors (`tests/vectors/vectors.json`) and, in CI, the
whole recipe corpus against `bc-rand = "=0.5.0"` (`rand_core` 0.9.5,
`rand_xoshiro` 0.7.0).

```sh
cd tests/rust-validation
cargo run --release --offline -- ../vectors/vectors.json
# the full corpus (3,150 vectors; the golden file is a stride of it):
bun run vectors:full                       # writes $TMPDIR/rand-full-corpus.json
cargo run --release --offline -- "$TMPDIR/rand-full-corpus.json"
```

Result (2026-09-14): golden `490 vectors - 462 match, 28 js-only, 0 MISMATCH`;
full corpus `3150 vectors - 3122 match, 28 js-only, 0 MISMATCH`.

Exit 0 iff every vector matches the Rust reference or is JS-only. There is no
expected-divergence allowlist: a difference is a MISMATCH and a bug on one side
or the other. Every recipe ends with a four-draw state probe, so a draw at a
different point, or a throw that consumed a draw it should not have, is caught
even when the values agree.

## JS-only vectors

A vector is `js-only` when the reference cannot receive its input, and is
classified rather than `unwrap`ped (the harness never panics or aborts on a
recipe):

- an integer outside a sampler's width, or not an integer (`domain/bound/*`,
  `domain/range/*`: the reference's widths are types);
- a seed that is not four `u64` words or exactly 32 bytes: another word count,
  a word outside `u64`, a byte seed of another length or with non-hex
  characters (`domain/seed/*`: the reference's seed is `[u64; 4]`);
- a `usize` above `2^53 − 1` (`domain/bound/usize/*`, `domain/range/usize/*`).
  The reference can express it; a `number` cannot hold it exactly, which is
  D2 in `RUST_DIVERGENCES.md` (the `…U64` samplers cover those values).

`randomBytes(1.5)` and the other non-JSON inputs (holes, `DataView`s,
malformed generators) are unit tests only (`tests/rand.test.ts`,
`tests/samplers.property.test.ts`).

## Throws

Throws are one outcome class on both sides: the reference has no error type
(its failures are `assert!`, `unwrap()` and overflow panics, caught here with
`catch_unwind`), so any `throw:…` on the port's side and any panic on the
reference's side compare as `throw`. What the harness proves about a throw is
its *point* and the generator state after it. The port's error class, code and
message are pinned by `tests/golden-vectors.test.ts` (exact messages from
`vectors.json`) and the golden snapshot (`RandError` and the message).

## Checked arithmetic (D1)

The release profile has `overflow-checks = true` (`Cargo.toml`): a signed
range whose length exceeds its width's `MAX` overflows `upper_bound -
lower_bound` in the reference (i8, i16, i32 and i64 alike), and the panic is
the outcome the port mirrors (`RandError` `RangeTooLong`). Cargo's default
release profile wraps instead and samples a wrong range; CI runs the golden
file on that profile too (`CARGO_PROFILE_RELEASE_OVERFLOW_CHECKS=false`,
informational, never blocking), where exactly the 33 signed range-length
vectors MISMATCH. That run is the executed record of D1.

## CI

The `rust-validation` job in `.github/workflows/ci.yml` materialises the full
corpus with `bun scripts/generate-vectors.ts --full`, then runs the harness on
`vectors.json` and on the corpus with `--locked`; a MISMATCH fails the job.
