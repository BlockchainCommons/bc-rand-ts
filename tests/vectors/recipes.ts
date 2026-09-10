/**
 * Build-agnostic recipes for the rand vector suites.
 *
 * A vector is a generator plus an ordered list of operations. The expected output
 * is every operation's result as a string, followed by a four-draw state probe
 * so a consumption-pattern change is caught even when the values happen to
 * agree. Recipes are materialised against a `VectorApi` adapter so the same
 * recipe runs on the frozen baseline bundle and on the working tree.
 *
 * Recipe semantics are FROZEN: never change how a kind materialises.
 */

import type * as RootEntry from "../../src";
import type * as SamplersEntry from "../../src/samplers";

export type Width = "u8" | "u16" | "u32" | "u64" | "i8" | "i16" | "i32" | "i64";

export type Op =
  | { op: "u64" }
  | { op: "u32" }
  | { op: "bytes"; n: number }
  | { op: "bound"; w: "u8" | "u16" | "u32" | "u64"; b: string }
  | { op: "range"; w: Width; s: string; e: string; closed: boolean }
  | { op: "bool" };

/** The generator a recipe draws from. Every form is explicit; nothing is defaulted. */
export type Generator =
  /** The package's seeded generator from four u64 words (decimal strings). */
  | { kind: "seeded"; words: [string, string, string, string] }
  /** The package's seeded generator from 32 bytes (hex, little-endian u64 words). */
  | { kind: "seeded-bytes"; bytes: string }
  /** The recipes' own {@link CounterRng}, from its starting byte. */
  | { kind: "counter"; start: number };

export interface Recipe {
  name: string;
  gen: Generator;
  ops: Op[];
}

export interface Rng {
  nextU64(): bigint;
  nextU32(): number;
  fillBytes(dest: Uint8Array): void;
}

/**
 * A deterministic generator whose two integer draws consume different
 * amounts of state — `nextU32` four bytes, `nextU64` eight, `fillBytes` one
 * per byte — so a sampler's draw width is observable. Each byte is the
 * running counter, stepped by 17 (the shape of `bc-shamir-rust`'s test
 * generator). It is the recipe's own generator, identical on every side
 * (the Rust harness implements the same `RngCore`), and never a product of
 * the package under test.
 */
export class CounterRng implements Rng {
  private counter: number;

  constructor(start: number) {
    this.counter = start & 0xff;
  }

  private nextByte(): number {
    const b = this.counter;
    this.counter = (this.counter + 17) & 0xff;
    return b;
  }

  nextU32(): number {
    let v = 0;
    for (let i = 0; i < 4; i++) v |= this.nextByte() << (8 * i);
    return v >>> 0;
  }

  nextU64(): bigint {
    let v = 0n;
    for (let i = 0; i < 8; i++) v |= BigInt(this.nextByte()) << BigInt(8 * i);
    return v;
  }

  fillBytes(dest: Uint8Array): void {
    for (let i = 0; i < dest.length; i++) dest[i] = this.nextByte();
  }
}

/** The 32 little-endian bytes (hex) of four u64 words, the `seeded-bytes` form. */
export function wordsToSeedHex(words: readonly [string, string, string, string]): string {
  const bytes = new Uint8Array(32);
  const view = new DataView(bytes.buffer);
  words.forEach((w, i) => view.setBigUint64(i * 8, BigInt(w), true));
  return bytesToHex(bytes);
}

export const hexToBytes = (hex: string): Uint8Array =>
  Uint8Array.from({ length: hex.length / 2 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));

/** The operations a build must provide, independent of its public names. */
export interface VectorApi {
  seeded(words: [bigint, bigint, bigint, bigint]): Rng;
  seededFromBytes(bytes: Uint8Array): Rng;
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
  const out: string[] = [];
  let rng: Rng;
  try {
    switch (r.gen.kind) {
      case "seeded":
        rng = api.seeded(r.gen.words.map(BigInt) as [bigint, bigint, bigint, bigint]);
        break;
      case "seeded-bytes":
        rng = api.seededFromBytes(hexToBytes(r.gen.bytes));
        break;
      case "counter":
        rng = new CounterRng(r.gen.start);
        break;
    }
  } catch (e) {
    // A rejected seed is the whole outcome: no draws, no state.
    return { out: [`throw:${e instanceof Error ? e.message : String(e)}`], state: [] };
  }
  for (const op of r.ops) {
    try {
      switch (op.op) {
        case "u64":
          out.push(rng.nextU64().toString());
          break;
        case "u32":
          out.push(String(rng.nextU32()));
          break;
        case "bytes": {
          const b = new Uint8Array(op.n);
          rng.fillBytes(b);
          out.push(bytesToHex(b));
          break;
        }
        case "bound":
          out.push(api.bound(rng, op.w, BigInt(op.b)).toString());
          break;
        case "range":
          out.push(api.range(rng, op.w, BigInt(op.s), BigInt(op.e), op.closed).toString());
          break;
        case "bool":
          out.push(api.bool(rng) ? "1" : "0");
          break;
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

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The four little-endian u64 words of a 32-byte seed (the baseline class takes words only). */
const wordsOf = (bytes: Uint8Array): [bigint, bigint, bigint, bigint] => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [0, 8, 16, 24].map((o) => view.getBigUint64(o, true)) as [bigint, bigint, bigint, bigint];
};

/** The pre-redesign surface (the frozen baseline bundle). */
export function baselineAdapterFor(m: any): VectorApi {
  const cap = (w: string): string => w.toUpperCase();
  const wrap = (g: any): Rng => ({
    nextU64: () => g.nextU64(),
    nextU32: () => g.nextU32(),
    fillBytes: (d) => g.fillBytes(d),
  });
  return {
    seeded: (words) => wrap(new m.SeededRandomNumberGenerator(words)),
    seededFromBytes: (bytes) => wrap(new m.SeededRandomNumberGenerator(wordsOf(bytes))),
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

/* eslint-enable @typescript-eslint/no-explicit-any */

/** The working tree's surface: the root entry and the `/samplers` entry. */
export function currentAdapter(m: typeof RootEntry, samplers: typeof SamplersEntry): VectorApi {
  const bound: Record<"u8" | "u16" | "u32" | "u64", (rng: Rng, b: bigint) => bigint> = {
    u8: (rng, b) => BigInt(samplers.nextWithUpperBoundU8(rng, Number(b))),
    u16: (rng, b) => BigInt(samplers.nextWithUpperBoundU16(rng, Number(b))),
    u32: (rng, b) => BigInt(samplers.nextWithUpperBoundU32(rng, Number(b))),
    u64: (rng, b) => samplers.nextWithUpperBoundU64(rng, b),
  };
  const narrow =
    (
      open: (rng: Rng, s: number, e: number) => number,
      closed: (rng: Rng, s: number, e: number) => number,
    ) =>
    (rng: Rng, s: bigint, e: bigint, c: boolean): bigint =>
      BigInt((c ? closed : open)(rng, Number(s), Number(e)));
  const wide =
    (
      open: (rng: Rng, s: bigint, e: bigint) => bigint,
      closed: (rng: Rng, s: bigint, e: bigint) => bigint,
    ) =>
    (rng: Rng, s: bigint, e: bigint, c: boolean): bigint =>
      (c ? closed : open)(rng, s, e);
  const range: Record<Width, (rng: Rng, s: bigint, e: bigint, closed: boolean) => bigint> = {
    u8: narrow(samplers.nextInRangeU8, samplers.nextInClosedRangeU8),
    u16: narrow(samplers.nextInRangeU16, samplers.nextInClosedRangeU16),
    u32: narrow(samplers.nextInRangeU32, samplers.nextInClosedRangeU32),
    u64: wide(samplers.nextInRangeU64, samplers.nextInClosedRangeU64),
    i8: narrow(samplers.nextInRangeI8, samplers.nextInClosedRangeI8),
    i16: narrow(samplers.nextInRangeI16, samplers.nextInClosedRangeI16),
    i32: narrow(samplers.nextInRangeI32, samplers.nextInClosedRangeI32),
    i64: wide(samplers.nextInRangeI64, samplers.nextInClosedRangeI64),
  };
  return {
    seeded: (words) => new m.SeededRng(words),
    seededFromBytes: (bytes) => new m.SeededRng(bytes),
    bound: (rng, w, b) => bound[w](rng, b),
    range: (rng, w, s, e, closed) => range[w](rng, s, e, closed),
    bool: (rng) => m.randomBool({ rng }),
  };
}
