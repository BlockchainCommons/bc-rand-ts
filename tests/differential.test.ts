/**
 * Differential harness (Phase 1.3): every corpus recipe is materialised with
 * the frozen baseline bundle AND the working tree; outcomes must be identical
 * except for the enumerated tombstones.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as baselineMod from "./baseline/rand-baseline.mjs";
import * as src from "../src";
import {
  materialize,
  baselineAdapterFor,
  redesignedAdapterFor,
  type Recipe,
} from "./vectors/recipes";
import { categories } from "./corpus/corpus";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = "c8014967d0f81bd362438a6ac3715fb00b9f835fde86ca504acdb7aba51d5971";

/**
 * Tombstones: the only allowed differences, keyed by a predicate over the
 * recipe. T1 (01_rand.md): i64 range samplers with a negative start return
 * out-of-range values in the baseline (wrapping-abs applied to the start);
 * the redesign performs signed addition as the Rust reference does.
 */
const TOMBSTONES: { id: string; landed: boolean; matches: (r: Recipe) => boolean }[] = [
  {
    id: "T1",
    landed: true,
    matches: (r) => r.ops.some((op) => op.op === "range" && op.w === "i64" && BigInt(op.s) < 0n),
  },
];

// The samplers subpath appears in Phase 3; a computed specifier keeps this
// typechecking before it exists.
const samplersPath = ["..", "src", "samplers"].join("/");
let samplers: unknown = src;
try {
  samplers = (await import(samplersPath)) as unknown;
} catch {
  /* pre-redesign */
}
const baseline = baselineAdapterFor(baselineMod);
const current = redesignedAdapterFor(src, samplers);

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
