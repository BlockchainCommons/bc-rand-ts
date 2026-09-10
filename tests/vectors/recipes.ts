/**
 * Build-agnostic recipes for the rand vector suites (Phase 1.1).
 *
 * A vector is a seed plus an ordered list of operations. The expected output
 * is every operation's result as a string, followed by a four-draw state probe
 * so a consumption-pattern change is caught even when the values happen to
 * agree. Recipes are materialised against a `VectorApi` adapter so the same
 * recipe runs on the frozen baseline bundle and on the working tree.
 *
 * Recipe semantics are FROZEN: never change how a kind materialises.
 */

export type Width = "u8" | "u16" | "u32" | "u64" | "i8" | "i16" | "i32" | "i64";

export type Op =
  | { op: "u64" }
  | { op: "u32" }
  | { op: "bytes"; n: number }
  | { op: "bound"; w: "u8" | "u16" | "u32" | "u64"; b: string }
  | { op: "range"; w: Width; s: string; e: string; closed: boolean }
  | { op: "bool" };

export interface Recipe {
  name: string;
  seed: [string, string, string, string];
  ops: Op[];
}

export interface Rng {
  nextU64(): bigint;
  nextU32(): number;
  fillBytes(dest: Uint8Array): void;
}

/** The operations a build must provide, independent of its public names. */
export interface VectorApi {
  makeRng(seed: [bigint, bigint, bigint, bigint]): Rng;
  bound(rng: Rng, w: "u8" | "u16" | "u32" | "u64", b: bigint): bigint;
  range(rng: Rng, w: Width, s: bigint, e: bigint, closed: boolean): bigint;
  bool(rng: Rng): boolean;
}

export const bytesToHex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export interface Outcome {
  out: string[];
  state: string[];
}

/** Run a recipe against an adapter; throws are recorded, never propagated. */
export function materialize(api: VectorApi, r: Recipe): Outcome {
  const rng = api.makeRng(r.seed.map(BigInt) as [bigint, bigint, bigint, bigint]);
  const out: string[] = [];
  for (const op of r.ops) {
    try {
      switch (op.op) {
        case "u64": out.push(rng.nextU64().toString()); break;
        case "u32": out.push(String(rng.nextU32())); break;
        case "bytes": { const b = new Uint8Array(op.n); rng.fillBytes(b); out.push(bytesToHex(b)); break; }
        case "bound": out.push(api.bound(rng, op.w, BigInt(op.b)).toString()); break;
        case "range": out.push(api.range(rng, op.w, BigInt(op.s), BigInt(op.e), op.closed).toString()); break;
        case "bool": out.push(api.bool(rng) ? "1" : "0"); break;
      }
    } catch (e) {
      out.push(`throw:${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const state = Array.from({ length: 4 }, () => rng.nextU64().toString());
  return { out, state };
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */

/** The pre-redesign surface (the frozen baseline bundle). */
export function baselineAdapterFor(m: any): VectorApi {
  const cap = (w: string): string => w.toUpperCase();
  return {
    makeRng: (seed) => {
      const g = new m.SeededRandomNumberGenerator(seed);
      return { nextU64: () => g.nextU64(), nextU32: () => g.nextU32(), fillBytes: (d) => g.fillBytes(d) };
    },
    bound: (rng, w, b) => {
      const f = m[`rngNextWithUpperBound${cap(w)}`];
      return BigInt(f(rng, w === "u64" ? b : Number(b)));
    },
    range: (rng, w, s, e, closed) => {
      const f = m[`rngNextIn${closed ? "Closed" : ""}Range${cap(w)}`];
      const wide = w === "u64" || w === "i64";
      return BigInt(f(rng, wide ? s : Number(s), wide ? e : Number(e)));
    },
    bool: (rng) => m.rngRandomBool(rng),
  };
}

/** The redesigned surface (the working tree). Updated in Phase 3. */
export function redesignedAdapterFor(m: any, samplers: any = m): VectorApi {
  // Until Phase 3 lands, the working tree has the baseline names.
  if (typeof m.SeededRandomNumberGenerator === "function") return baselineAdapterFor(m);
  const cap = (w: string): string => w.toUpperCase();
  return {
    makeRng: (seed) => new m.SeededRng(seed),
    bound: (rng, w, b) => BigInt(samplers[`nextWithUpperBound${cap(w)}`](rng, w === "u64" ? b : Number(b))),
    range: (rng, w, s, e, closed) => {
      const f = samplers[`nextIn${closed ? "Closed" : ""}Range${cap(w)}`];
      const wide = w === "u64" || w === "i64";
      return BigInt(f(rng, wide ? s : Number(s), wide ? e : Number(e)));
    },
    bool: (rng) => m.randomBool(rng),
  };
}
