# Rust reference cross-validation

Replays `tests/vectors/vectors.json` against `bc-rand = 0.5.0`.

```sh
cd tests/rust-validation
cargo run --release -- ../vectors/vectors.json
```

Exit 0 iff every vector matches the Rust reference or is an allowlisted
expected divergence. The allowlist (`expected_divergence()`) is the
machine-readable twin of `RUST_DIVERGENCES.md`; keep them in sync.
Not wired into CI (needs a Rust toolchain); run it manually before a release.
