# Frozen baseline build

`rand-baseline.mjs` is the dependency-free ESM bundle of `@blockchaincommons/rand`
built from commit `e59bf7d1d244c08a6686d20f60a26d5a8ba3f26b`, the pre-redesign wire-format reference. Its
`sourceMappingURL` comment was removed. `rand-baseline.d.mts` is the public
API surface at that commit. Parity Technologies copyright lines were removed
from both files; executable code and declarations are unchanged.

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree and asserts identical output. The sha256 is pinned in the
test so an accidental rebuild cannot turn the differential into a
self-comparison.

Baseline commit: e59bf7d1d244c08a6686d20f60a26d5a8ba3f26b
Baseline sha256: 6548f8a20aab023597c495cebbfbc0f83204d63160523425973293ee11829163
