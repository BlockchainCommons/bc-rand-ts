/**
 * Differential harness: every corpus recipe is materialised with
 * the frozen baseline bundle AND the working tree; outcomes must be identical
 * except for the enumerated tombstones.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as baselineMod from "./baseline/rand-baseline.mjs";
import * as src from "../src";
import * as samplers from "../src/samplers";
import {
  materialize,
  baselineAdapterFor,
  currentAdapter,
  noBaseline,
  type Recipe,
} from "./vectors/recipes";
import { categories } from "./corpus/corpus";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = "6548f8a20aab023597c495cebbfbc0f83204d63160523425973293ee11829163";

/**
 * Tombstones: the only allowed differences, keyed by a predicate over the
 * recipe.
 */
const TOMBSTONES: { id: string; landed: boolean; matches: (r: Recipe) => boolean }[] = [
  // Order matters: the first matching entry decides, so the narrow ones come first.
  {
    // Out-of-width integers throw RangeError; the baseline masked them to
    // the width and returned values outside the requested range.
    id: "domain-errors",
    landed: true,
    matches: (r) => r.name.startsWith("domain/"),
  },
  {
    // The all-zero seed. The pre-redesign tree accepted it and produced
    // xoshiro's fixed point (every output zero); the tree now substitutes
    // the reference's `seed_from_u64(0)` stream. Baseline and tree differ.
    id: "zero-seed",
    landed: true,
    matches: (r) => r.name.startsWith("seed/zero/"),
  },
  {
    // A signed range whose length exceeds the width's MAX overflows
    // `end - start` in the reference (a panic when checked); the tree rejects
    // it with RangeError where the baseline reproduced the unchecked wrap and
    // sampled a wrong range (`-128..=127` for i8 gave only -128 and -127).
    id: "signed-range-length",
    landed: true,
    matches: (r) =>
      r.ops.some((op) => {
        if (op.op !== "range" || !op.w.startsWith("i")) return false;
        const max = { i8: 127n, i16: 32767n, i32: 2147483647n, i64: (1n << 63n) - 1n }[
          op.w as "i8" | "i16" | "i32" | "i64"
        ];
        return BigInt(op.e) - BigInt(op.s) > max;
      }),
  },
  {
    // i64 range samplers with a negative start return out-of-range values in
    // the baseline (wrapping-abs applied to the start); the redesign
    // performs signed addition as the Rust reference does.
    id: "i64-negative-start",
    landed: true,
    matches: (r) => r.ops.some((op) => op.op === "range" && op.w === "i64" && BigInt(op.s) < 0n),
  },
];

const baseline = baselineAdapterFor(baselineMod);
const current = currentAdapter(src, samplers);

describe("differential: baseline vs working tree", () => {
  it("baseline bundle integrity", () => {
    const sha = createHash("sha256")
      .update(readFileSync(join(here, "baseline/rand-baseline.mjs")))
      .digest("hex");
    expect(sha).toBe(BASELINE_SHA256);
  });

  for (const [name, gen] of Object.entries(categories)) {
    it(`category ${name}`, () => {
      let n = 0;
      const diffs: string[] = [];
      const landedHits = new Map<string, number>();
      const landedMatches = new Map<string, number>();
      for (const recipe of gen()) {
        if (noBaseline(recipe)) continue;
        n++;
        // Error MESSAGES may change across the redesign; error CLASS may not.
        const norm = (o: { out: string[]; state: string[] }) => ({
          out: o.out.map((x) => (x.startsWith("throw:") ? "throw" : x)),
          state: o.state,
        });
        const a = norm(materialize(baseline, recipe));
        const b = norm(materialize(current, recipe));
        const equal = JSON.stringify(a) === JSON.stringify(b);
        const tomb = TOMBSTONES.find((t) => t.matches(recipe));
        if (tomb?.landed === true) {
          // A landed tombstone may differ (not every matching recipe reaches
          // the changed branch); it must differ at least once, or the fix
          // did not land.
          landedMatches.set(tomb.id, (landedMatches.get(tomb.id) ?? 0) + 1);
          if (!equal) landedHits.set(tomb.id, (landedHits.get(tomb.id) ?? 0) + 1);
        } else if (!equal) {
          diffs.push(`${recipe.name}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
        }
      }
      expect(n).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
      for (const [id, matches] of landedMatches) {
        if (matches > 0) expect(landedHits.get(id) ?? 0).toBeGreaterThan(0);
      }
    });
  }
});
