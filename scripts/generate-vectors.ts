/**
 * Golden vector generator, and the full-corpus materialiser for CI.
 *
 *   bun scripts/generate-vectors.ts               # golden subset -> tests/vectors/vectors.json
 *   bun scripts/generate-vectors.ts --full [PATH]  # the whole corpus -> PATH (default: a temp file)
 *
 * The golden subset is materialised with the WORKING TREE and committed;
 * regenerating is a deliberate act, and the diff is the reviewable record of
 * any wire change. The full corpus (`allRecipes()`, of which the golden file
 * is a stride) is never committed: CI materialises it and replays both files
 * against the Rust reference (tests/rust-validation), so a sampler shape the
 * golden stride skips still cannot regress unnoticed.
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as src from "../src/index.ts";
import * as samplers from "../src/samplers.ts";
import { materialize, currentAdapter, type Recipe } from "../tests/vectors/recipes.ts";
import { allRecipes, goldenRecipes } from "../tests/corpus/corpus.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = currentAdapter(src, samplers);

const args = process.argv.slice(2);
const fullIndex = args.indexOf("--full");
const full = fullIndex >= 0;
const out = full
  ? (args[fullIndex + 1] ?? join(tmpdir(), "rand-full-corpus.json"))
  : join(root, "tests/vectors/vectors.json");
const recipes: Iterable<Recipe> = full ? allRecipes() : goldenRecipes();

const vectors = [];
for (const recipe of recipes) {
  vectors.push({ ...recipe, expect: materialize(api, recipe) });
}
writeFileSync(out, JSON.stringify({ count: vectors.length, vectors }, null, 1) + "\n");
console.log(`wrote ${vectors.length} ${full ? "full-corpus" : "golden"} vectors to ${out}`);
