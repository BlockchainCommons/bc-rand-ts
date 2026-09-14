/**
 * Differential harness: every corpus recipe is materialised with
 * the frozen baseline bundle and the working tree; outcomes must be identical
 * except for the allowed differences listed below.
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

/** The only allowed differences, each keyed by a predicate over the recipe. */
const ALLOWED_DIFFERENCES: { id: string; matches: (r: Recipe) => boolean }[] = [
  // Order matters: the first matching entry decides, so the narrow ones come first.
  {
    // Out-of-width integers and malformed seeds throw RandError; the baseline
    // masked the integers to the width and returned values outside the
    // requested range, and accepted or crashed on the seeds.
    id: "domain-errors",
    matches: (r) => r.name.startsWith("domain/"),
  },
  {
    // The all-zero seed. The pre-redesign tree accepted it and produced
    // xoshiro's fixed point (every output zero); the tree now substitutes
    // the reference's `seed_from_u64(0)` stream. Baseline and tree differ.
    id: "zero-seed",
    matches: (r) => r.name.startsWith("seed/zero/"),
  },
  {
    // A signed range whose length exceeds the width's MAX overflows
    // `end - start` in the reference (a panic when checked); the tree rejects
    // it with RandError RangeTooLong where the baseline reproduced the
    // unchecked wrap and sampled a wrong range (`-128..=127` for i8 gave only
    // -128 and -127).
    id: "signed-range-length",
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
      const matched = new Set<string>();
      const differed = new Set<string>();
      for (const recipe of gen()) {
        if (noBaseline(recipe)) continue;
        n++;
        // Error classes and messages may change across the redesign (recipes
        // record the message only); whether an operation throws may not.
        const norm = (o: { out: string[]; state: string[] }) => ({
          out: o.out.map((x) => (x.startsWith("throw:") ? "throw" : x)),
          state: o.state,
        });
        const a = norm(materialize(baseline, recipe));
        const b = norm(materialize(current, recipe));
        const equal = JSON.stringify(a) === JSON.stringify(b);
        const allowed = ALLOWED_DIFFERENCES.find((d) => d.matches(recipe));
        if (allowed !== undefined) {
          // Not every matching recipe reaches the changed branch, but each
          // entry must differ at least once, or it no longer describes a
          // real difference.
          matched.add(allowed.id);
          if (!equal) differed.add(allowed.id);
        } else if (!equal) {
          diffs.push(`${recipe.name}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
        }
      }
      expect(n).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
      for (const id of matched) expect(differed.has(id), id).toBe(true);
    });
  }
});
