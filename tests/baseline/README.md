# Frozen baseline build

`rand-baseline.mjs` is the dependency-free ESM bundle of `@blockchaincommons/rand`
built from commit `e59bf7d1d244c08a6686d20f60a26d5a8ba3f26b`, the pre-redesign wire-format reference. Its
`sourceMappingURL` comment was removed. `rand-baseline.d.mts` is the public
surface at that commit (the Phase 0.5 API snapshot).

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree and asserts identical output. The sha256 is pinned in the
test so an accidental rebuild cannot turn the differential into a
self-comparison.

Baseline commit: e59bf7d1d244c08a6686d20f60a26d5a8ba3f26b
Baseline sha256: c8014967d0f81bd362438a6ac3715fb00b9f835fde86ca504acdb7aba51d5971
