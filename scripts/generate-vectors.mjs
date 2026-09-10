/**
 * Golden vector generator (Phase 1.2).
 *
 *   bun scripts/generate-vectors.mjs
 *
 * Materialises the golden recipe subset with the WORKING TREE and writes
 * tests/vectors/vectors.json. Regenerating is a deliberate act; the diff is
 * the reviewable record of any wire change.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as src from "../src/index.ts";
import { materialize, redesignedAdapterFor } from "../tests/vectors/recipes.ts";
import { goldenRecipes } from "../tests/corpus/corpus.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let samplers = src;
try { samplers = await import("../src/samplers.ts"); } catch { /* pre-redesign */ }
const api = redesignedAdapterFor(src, samplers);

const vectors = [];
for (const recipe of goldenRecipes()) {
  vectors.push({ ...recipe, expect: materialize(api, recipe) });
}
writeFileSync(join(root, "tests/vectors/vectors.json"), JSON.stringify({ count: vectors.length, vectors }, null, 1) + "\n");
console.log(`wrote ${vectors.length} vectors`);
