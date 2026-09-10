/**
 * Deterministic differential corpus (Phase 1.3): seeds × widths × bounds at
 * every head-width cliff ±1 × ranges of length 1, 2, cliff, full. Pure and
 * deterministic; generators so nothing large lives in memory at once.
 */
import type { Recipe, Op, Width } from "../vectors/recipes";

export const SEEDS: [string, string, string, string][] = [
  ["17295166580085024720", "422929670265678780", "5577237070365765850", "7953171132032326923"],
  ["1", "1", "1", "1"],
  ["18446744073709551615", "18446744073709551615", "18446744073709551615", "18446744073709551615"],
  ["81985529216486895", "18364758544493064720", "3735928559", "14627333968358932480"],
  ["0", "0", "0", "1"],
  ["12345", "67890", "13579", "24680"],
  ["9223372036854775808", "9223372036854775807", "4294967296", "4294967295"],
  ["1", "0", "0", "0"],
];

const U_MAX: Record<"u8" | "u16" | "u32" | "u64", bigint> = {
  u8: 255n, u16: 65535n, u32: 4294967295n, u64: 18446744073709551615n,
};
const I_MIN: Record<"i8" | "i16" | "i32" | "i64", bigint> = {
  i8: -128n, i16: -32768n, i32: -2147483648n, i64: -(1n << 63n),
};
const I_MAX: Record<"i8" | "i16" | "i32" | "i64", bigint> = {
  i8: 127n, i16: 32767n, i32: 2147483647n, i64: (1n << 63n) - 1n,
};
const CLIFFS = [1n, 2n, 7n, 23n, 24n, 127n, 128n, 255n, 256n, 257n, 65535n, 65536n, 65537n,
  4294967295n, 4294967296n, 4294967297n, 9007199254740991n, 9007199254740992n,
  9223372036854775807n, 9223372036854775808n, 18446744073709551615n];

function* boundRecipes(): Generator<Recipe> {
  for (const w of ["u8", "u16", "u32", "u64"] as const) {
    for (const b of CLIFFS.filter((c) => c <= U_MAX[w])) {
      for (let si = 0; si < SEEDS.length; si++) {
        const ops: Op[] = Array.from({ length: 12 }, () => ({ op: "bound", w, b: b.toString() }));
        yield { name: `bound/${w}/${b}/seed${si}`, seed: SEEDS[si], ops };
      }
    }
  }
}

function* rangeRecipes(): Generator<Recipe> {
  const widths: Width[] = ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"];
  for (const w of widths) {
    const signed = w.startsWith("i");
    const min = signed ? I_MIN[w as keyof typeof I_MIN] : 0n;
    const max = signed ? I_MAX[w as keyof typeof I_MAX] : U_MAX[w as keyof typeof U_MAX];
    const starts = [min, 0n, 1n, 7n, max - 2n, min + 1n].filter((s) => s >= min && s <= max);
    if (signed) starts.push(-1n, -7n, -128n);
    for (const s of [...new Set(starts)]) {
      const lengths = [1n, 2n, 3n, 255n, 256n, 65536n, max - s];
      for (const len of [...new Set(lengths)]) {
        const e = s + len;
        if (e > max || len < 1n) continue;
        for (const closed of [false, true]) {
          for (let si = 0; si < 4; si++) {
            const ops: Op[] = Array.from({ length: 10 }, () => ({ op: "range", w, s: s.toString(), e: e.toString(), closed }));
            yield { name: `range/${w}/${s}..${closed ? "=" : ""}${e}/seed${si}`, seed: SEEDS[si], ops };
          }
        }
      }
    }
  }
}

function* rawRecipes(): Generator<Recipe> {
  for (let si = 0; si < SEEDS.length; si++) {
    yield { name: `raw/u64x32/seed${si}`, seed: SEEDS[si], ops: Array.from({ length: 32 }, () => ({ op: "u64" })) };
    yield { name: `raw/u32x32/seed${si}`, seed: SEEDS[si], ops: Array.from({ length: 32 }, () => ({ op: "u32" })) };
    yield { name: `raw/bytes/seed${si}`, seed: SEEDS[si], ops: [{ op: "bytes", n: 0 }, { op: "bytes", n: 1 }, { op: "bytes", n: 31 }, { op: "bytes", n: 32 }, { op: "bytes", n: 33 }, { op: "bytes", n: 200 }] };
    yield { name: `raw/bool/seed${si}`, seed: SEEDS[si], ops: Array.from({ length: 32 }, () => ({ op: "bool" })) };
    yield { name: `raw/mixed/seed${si}`, seed: SEEDS[si], ops: [{ op: "u32" }, { op: "bytes", n: 3 }, { op: "bool" }, { op: "bound", w: "u16", b: "1000" }, { op: "u64" }, { op: "range", w: "i32", s: "-10", e: "10", closed: true }, { op: "bytes", n: 5 }] };
  }
}

export const categories: Record<string, () => Generator<Recipe>> = {
  raw: rawRecipes,
  bound: boundRecipes,
  range: rangeRecipes,
};

export function* allRecipes(): Generator<Recipe> {
  for (const gen of Object.values(categories)) yield* gen();
}

/** The hand-pinned golden subset: a stride over the corpus plus the raw set. */
export function* goldenRecipes(): Generator<Recipe> {
  yield* rawRecipes();
  let i = 0;
  for (const r of boundRecipes()) if (i++ % 7 === 0) yield r;
  i = 0;
  for (const r of rangeRecipes()) if (i++ % 11 === 0) yield r;
}
