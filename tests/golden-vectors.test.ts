/**
 * Golden vector suite (Phase 1.2): the committed, hand-pinned freeze of every
 * seeded output. Changes only through `bun run vectors:generate`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as src from "../src";
import { materialize, redesignedAdapterFor, type Recipe, type Outcome } from "./vectors/recipes";

const here = dirname(fileURLToPath(import.meta.url));
const { count, vectors } = JSON.parse(readFileSync(join(here, "vectors/vectors.json"), "utf8")) as {
  count: number;
  vectors: (Recipe & { expect: Outcome })[];
};

// The samplers subpath appears in Phase 3; a computed specifier keeps this
// typechecking before it exists.
const samplersPath = ["..", "src", "samplers"].join("/");
let samplers: unknown = src;
try {
  samplers = (await import(samplersPath)) as unknown;
} catch {
  /* pre-redesign */
}
const api = redesignedAdapterFor(src, samplers);

describe("golden vectors (frozen)", () => {
  it("fixture is self-consistent and non-trivial", () => {
    expect(vectors.length).toBe(count);
    expect(vectors.length).toBeGreaterThanOrEqual(150);
  });
  for (const v of vectors) {
    it(v.name, () => {
      expect(materialize(api, v)).toEqual(v.expect);
    });
  }
});
