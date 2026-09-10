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
import { materialize, baselineAdapterFor, redesignedAdapterFor, type Recipe } from "./vectors/recipes";
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
    landed: false,
    matches: (r) => r.ops.some((op) => op.op === "range" && op.w === "i64" && BigInt(op.s) < 0n),
  },
];

let samplers: unknown = src;
try { samplers = await import("../src/samplers"); } catch { /* pre-redesign */ }
const baseline = baselineAdapterFor(baselineMod);
const current = redesignedAdapterFor(src, samplers);

describe("differential: baseline vs working tree", () => {
  it("baseline bundle integrity", () => {
    const sha = createHash("sha256").update(readFileSync(join(here, "baseline/rand-baseline.mjs"))).digest("hex");
    expect(sha).toBe(BASELINE_SHA256);
  });

  for (const [name, gen] of Object.entries(categories)) {
    it(`category ${name}`, () => {
      let n = 0;
      const diffs: string[] = [];
      for (const recipe of gen()) {
        n++;
        const a = materialize(baseline, recipe);
        const b = materialize(current, recipe);
        const equal = JSON.stringify(a) === JSON.stringify(b);
        const tomb = TOMBSTONES.find((t) => t.matches(recipe));
        if (tomb?.landed === true) {
          // A landed tombstone MUST differ for its recipes (otherwise the fix did not land).
          if (equal) diffs.push(`${recipe.name}: expected tombstone ${tomb.id} difference, got equality`);
        } else if (!equal) {
          diffs.push(`${recipe.name}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
        }
      }
      expect(n).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
    });
  }
});
