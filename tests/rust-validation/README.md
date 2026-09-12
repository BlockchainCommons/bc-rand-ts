# Rust reference cross-validation

Replays `tests/vectors/vectors.json` against `bc-rand = 0.5.0`.

```sh
cd tests/rust-validation
cargo run --release -- ../vectors/vectors.json
```

Exit 0 iff every vector matches the Rust reference or is JS-only (an input the
reference's integer types cannot express, or a `usize` above 2^53 − 1 that a
`number` cannot hold exactly). There is no expected-divergence allowlist: a
difference is a MISMATCH and a bug on one side or the other. The release profile has `overflow-checks = true`
so the reference's integer overflow (a signed range longer than its width) is
a panic, compared with the port's `RangeError` as one outcome class, `throw`.
Not wired into CI (needs a Rust toolchain); run it manually before a release.
