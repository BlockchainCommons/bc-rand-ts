/**
 * Deterministic differential corpus: seeds × widths × bounds at every
 * head-width cliff ±1 × ranges of length 1, 2, cliff, full. Pure and
 * deterministic; generators so nothing large lives in memory at once.
 */
import {
  type Recipe,
  type Op,
  type Width,
  type BoundWidth,
  bytesToHex,
  wordsToSeedHex,
} from "../vectors/recipes";

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

const seeded = (si: number): Recipe["gen"] => ({ kind: "seeded", words: SEEDS[si] });

const U_MAX: Record<BoundWidth, bigint> = {
  u8: 255n,
  u16: 65535n,
  u32: 4294967295n,
  u64: 18446744073709551615n,
  // The reference's usize over the integers a `number` holds exactly.
  usize: 9007199254740991n,
};
const I_MIN: Record<"i8" | "i16" | "i32" | "i64", bigint> = {
  i8: -128n,
  i16: -32768n,
  i32: -2147483648n,
  i64: -(1n << 63n),
};
const I_MAX: Record<"i8" | "i16" | "i32" | "i64", bigint> = {
  i8: 127n,
  i16: 32767n,
  i32: 2147483647n,
  i64: (1n << 63n) - 1n,
};
const CLIFFS = [
  1n,
  2n,
  7n,
  23n,
  24n,
  127n,
  128n,
  255n,
  256n,
  257n,
  65535n,
  65536n,
  65537n,
  4294967295n,
  4294967296n,
  4294967297n,
  9007199254740991n,
  9007199254740992n,
  9223372036854775807n,
  9223372036854775808n,
  18446744073709551615n,
];

function* boundRecipes(): Generator<Recipe> {
  // `usize` last, so the golden stride over the earlier widths is unchanged.
  for (const w of ["u8", "u16", "u32", "u64", "usize"] as const) {
    for (const b of CLIFFS.filter((c) => c <= U_MAX[w])) {
      for (let si = 0; si < SEEDS.length; si++) {
        const ops: Op[] = Array.from({ length: 12 }, () => ({ op: "bound", w, b: b.toString() }));
        yield { name: `bound/${w}/${b}/seed${si}`, gen: seeded(si), ops };
      }
    }
  }
}

function* rangeRecipes(): Generator<Recipe> {
  // `usize` last, so the golden stride over the earlier widths is unchanged.
  const widths: Width[] = ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64", "usize"];
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
            const ops: Op[] = Array.from({ length: 10 }, () => ({
              op: "range",
              w,
              s: s.toString(),
              e: e.toString(),
              closed,
            }));
            yield {
              name: `range/${w}/${s}..${closed ? "=" : ""}${e}/seed${si}`,
              gen: seeded(si),
              ops,
            };
          }
        }
      }
    }
  }
}

function* rawRecipes(): Generator<Recipe> {
  for (let si = 0; si < SEEDS.length; si++) {
    yield {
      name: `raw/u64x32/seed${si}`,
      gen: seeded(si),
      ops: Array.from({ length: 32 }, () => ({ op: "u64" })),
    };
    yield {
      name: `raw/u32x32/seed${si}`,
      gen: seeded(si),
      ops: Array.from({ length: 32 }, () => ({ op: "u32" })),
    };
    yield {
      name: `raw/bytes/seed${si}`,
      gen: seeded(si),
      ops: [
        { op: "bytes", n: 0 },
        { op: "bytes", n: 1 },
        { op: "bytes", n: 31 },
        { op: "bytes", n: 32 },
        { op: "bytes", n: 33 },
        { op: "bytes", n: 200 },
      ],
    };
    yield {
      // The packed stream: whole words, a 5–7 byte tail (one more word), a
      // 1–4 byte tail (xoshiro's high-half `next_u32`), and empty.
      name: `raw/packed/seed${si}`,
      gen: seeded(si),
      ops: [
        { op: "bytesPacked", n: 32 },
        { op: "bytesPacked", n: 11 },
        { op: "bytesPacked", n: 3 },
        { op: "bytesPacked", n: 0 },
        { op: "bytesPacked", n: 1 },
        { op: "bytesPacked", n: 4 },
        { op: "bytesPacked", n: 5 },
        { op: "bytesPacked", n: 7 },
        { op: "bytesPacked", n: 8 },
        { op: "u64" },
      ],
    };
    yield {
      name: `raw/bool/seed${si}`,
      gen: seeded(si),
      ops: Array.from({ length: 32 }, () => ({ op: "bool" })),
    };
    yield {
      name: `raw/mixed/seed${si}`,
      gen: seeded(si),
      ops: [
        { op: "u32" },
        { op: "bytes", n: 3 },
        { op: "bool" },
        { op: "bound", w: "u16", b: "1000" },
        { op: "u64" },
        { op: "range", w: "i32", s: "-10", e: "10", closed: true },
        { op: "bytes", n: 5 },
      ],
    };
  }
}

/**
 * Seed forms: the 32-byte form of every corpus seed, and the all-zero seed in
 * both forms. Zero-seed recipes draw only raw operations: on the
 * pre-redesign xoshiro the all-zero state is a fixed point, and a rejection
 * sampler over a constant stream never terminates.
 */
function* seedFormRecipes(): Generator<Recipe> {
  const mixed: Op[] = [
    { op: "u64" },
    { op: "u32" },
    { op: "bytes", n: 9 },
    { op: "bool" },
    { op: "bound", w: "u32", b: "1000" },
    { op: "range", w: "i16", s: "-100", e: "100", closed: false },
    { op: "u64" },
  ];
  for (let si = 0; si < SEEDS.length; si++) {
    yield {
      name: `seedbytes/seed${si}`,
      gen: { kind: "seeded-bytes", bytes: wordsToSeedHex(SEEDS[si]) },
      ops: mixed,
    };
  }
  const zero: [string, string, string, string] = ["0", "0", "0", "0"];
  const raw: Op[] = [
    { op: "u64" },
    { op: "u64" },
    { op: "u32" },
    { op: "bytes", n: 8 },
    { op: "bool" },
  ];
  yield { name: "seed/zero/words", gen: { kind: "seeded", words: zero }, ops: raw };
  yield {
    name: "seed/zero/bytes",
    gen: { kind: "seeded-bytes", bytes: wordsToSeedHex(zero) },
    ops: raw,
  };
}

/**
 * Counter generator: every sampler over a generator whose `nextU32` and
 * `nextU64` consume different amounts, so the draw width the sampler uses is
 * part of the outcome.
 */
function* counterRecipes(): Generator<Recipe> {
  for (const start of [0, 100]) {
    const counter = { kind: "counter", start } as const;
    yield {
      name: `counter/raw/start${start}`,
      gen: counter,
      ops: [
        { op: "u32" },
        { op: "u64" },
        { op: "bytes", n: 5 },
        { op: "bool" },
        { op: "u32" },
        { op: "bytesPacked", n: 5 },
      ],
    };
    for (const w of ["u8", "u16", "u32", "u64", "usize"] as const) {
      for (const b of [7n, U_MAX[w] >> 1n, U_MAX[w]]) {
        yield {
          name: `counter/bound/${w}/${b}/start${start}`,
          gen: counter,
          ops: Array.from({ length: 6 }, () => ({ op: "bound", w, b: b.toString() })),
        };
      }
    }
    const widths: Width[] = ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64", "usize"];
    for (const w of widths) {
      const signed = w.startsWith("i");
      const ranges: [bigint, bigint][] = signed
        ? [
            [-7n, 7n],
            // The full signed range has a length above i64::MAX: out of the
            // reference's domain (overflow), a RangeError here.
            [I_MIN[w as keyof typeof I_MIN], I_MAX[w as keyof typeof I_MAX]],
          ]
        : [
            [3n, 200n],
            [0n, U_MAX[w as keyof typeof U_MAX]],
          ];
      for (const [s, e] of ranges) {
        for (const closed of [false, true]) {
          yield {
            name: `counter/range/${w}/${s}..${closed ? "=" : ""}${e}/start${start}`,
            gen: counter,
            ops: Array.from({ length: 6 }, () => ({
              op: "range",
              w,
              s: s.toString(),
              e: e.toString(),
              closed,
            })),
          };
        }
      }
    }
  }
}

/**
 * JS-only input domain: integers outside the sampler's width, and seeds that
 * are not four `u64` words or 32 bytes. The reference cannot express them
 * (its widths and its `[u64; 4]` seed are types), so the Rust harness counts
 * these as `js-only`; the vectors record the `RandError` each one raises.
 */
function* domainRecipes(): Generator<Recipe> {
  const bounds: [BoundWidth, string][] = [
    ["u8", "256"],
    ["u8", "300"],
    ["u16", "65536"],
    ["u32", "4294967296"],
    ["u32", "-1"],
    ["u64", "18446744073709551616"],
    ["u64", "-1"],
    // usize above 2^53 - 1 is representable in the reference but not exactly
    // in a `number`; the bigint samplers take it.
    ["usize", "9007199254740992"],
    ["usize", "-1"],
  ];
  for (const [w, b] of bounds) {
    yield {
      name: `domain/bound/${w}/${b}`,
      gen: seeded(0),
      ops: Array.from({ length: 4 }, () => ({ op: "bound", w, b })),
    };
  }
  const ranges: [Width, string, string, boolean][] = [
    ["u8", "0", "256", false],
    ["u8", "0", "1000000000", false],
    ["i8", "-200", "5", false],
    ["i16", "-40000", "5", false],
    ["i32", "0", "4294967296", false],
    ["u64", "-1", "5", false],
    ["i64", "-18446744073709551616", "0", false],
    ["u8", "0", "256", true],
    ["i8", "-129", "0", true],
    ["u64", "0", "18446744073709551616", true],
    ["usize", "0", "9007199254740992", false],
    ["usize", "1", "9007199254740992", true],
  ];
  for (const [w, s, e, closed] of ranges) {
    yield {
      name: `domain/range/${w}/${s}..${closed ? "=" : ""}${e}`,
      gen: seeded(0),
      ops: Array.from({ length: 4 }, () => ({ op: "range", w, s, e, closed })),
    };
  }
  // Seed shapes the reference's `[u64; 4]` cannot take. The port rejects
  // them at construction (the whole outcome is the throw: no draws, no
  // state); the ops are never reached.
  const raw: Op[] = Array.from({ length: 4 }, () => ({ op: "u64" }));
  const seeds: [string, string[]][] = [
    ["empty", []],
    ["words3", ["1", "2", "3"]],
    ["words5", [...SEEDS[0], "99"]],
    ["word-2^64", ["18446744073709551616", "1", "1", "1"]],
    ["word-negative", ["1", "-1", "1", "1"]],
  ];
  for (const [label, words] of seeds) {
    yield { name: `domain/seed/${label}`, gen: { kind: "seeded", words }, ops: raw };
  }
  for (const n of [31, 33]) {
    yield {
      name: `domain/seed/bytes${n}`,
      gen: {
        kind: "seeded-bytes",
        bytes: bytesToHex(Uint8Array.from({ length: n }, (_, i) => i + 1)),
      },
      ops: raw,
    };
  }
}

export const categories: Record<string, () => Generator<Recipe>> = {
  raw: rawRecipes,
  bound: boundRecipes,
  range: rangeRecipes,
  seedForms: seedFormRecipes,
  counter: counterRecipes,
  domain: domainRecipes,
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
  yield* seedFormRecipes();
  yield* counterRecipes();
  yield* domainRecipes();
}
