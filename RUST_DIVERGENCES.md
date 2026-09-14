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

This document records every place the TypeScript behaviour differs from the
Rust reference: an input both implementations accept, for which they produce a
different outcome. Inputs the reference's types cannot express (integers
outside a sampler's width, seeds that are not four `u64` words or 32 bytes,
generators that break the contract) are not divergences and are not listed;
the harness counts their vectors as `js-only`. JS spellings of reference
operations are proven equal by the vectors and are documented in the source.

## Divergences

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
in-stack caller uses such ranges. If a `bc-rand` release changes these ranges,
this package follows that release.

### D2. A `usize` above `2^53 - 1`

The `…Usize` samplers take `number`s and accept only safe integers; the
reference's 64-bit `usize` reaches `2^64 - 1`. A `number` cannot hold those
values exactly. Nothing is lost: the `…U64` samplers take `bigint`s and draw
exactly as the reference's 64-bit `usize` does. The harness counts these inputs
as `js-only` (4 vectors).

## Maintenance

When the upstream reference moves:

1. Review the diff via the link in the `upstream.yml` tracking issue.
2. Port the relevant changes.
3. Update `.github/versions.yml` with the new version and commit.
4. Update the tracked version and the harness results at the top of this file.
5. Add, amend, or remove divergence entries as the port requires.

A MISMATCH in `tests/rust-validation` is a bug on one side. A genuinely
language-mandated difference is recorded above in the same change; an input
the reference cannot express becomes a `js-only` rule in
`tests/rust-validation/src/main.rs`, not an entry here. Regenerate vectors with
`bun run vectors:generate`; CI replays the golden file and the full corpus
against the reference.
