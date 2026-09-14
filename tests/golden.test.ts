/**
 * Golden snapshots.
 *
 * Every seeded output and every sampler's consumption pattern, snapshotted so
 * a wire change shows up as a diff. The authority is tests/vectors; this
 * suite is the cheap, broad net.
 */
import * as rand from "../src";
import * as samplers from "../src/samplers";
import * as widening from "../src/widening";

const SEEDS: [string, [bigint, bigint, bigint, bigint]][] = [
  [
    "test-seed",
    [17295166580085024720n, 422929670265678780n, 5577237070365765850n, 7953171132032326923n],
  ],
  ["ones", [1n, 1n, 1n, 1n]],
  ["max", [0xffffffffffffffffn, 0xffffffffffffffffn, 0xffffffffffffffffn, 0xffffffffffffffffn]],
  ["mixed", [0x0123456789abcdefn, 0xfedcba9876543210n, 0x00000000deadbeefn, 0xcafebabe00000000n]],
];

const hex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

describe("golden: seeded generator", () => {
  for (const [name, seed] of SEEDS) {
    it(`nextU64 ×64 (${name})`, () => {
      const rng = new rand.SeededRng(seed);
      expect(Array.from({ length: 64 }, () => rng.nextU64().toString())).toMatchSnapshot();
    });
    it(`nextU32 ×64 (${name})`, () => {
      const rng = new rand.SeededRng(seed);
      expect(Array.from({ length: 64 }, () => rng.nextU32())).toMatchSnapshot();
    });
    it(`randomBytes(256) (${name})`, () => {
      const rng = new rand.SeededRng(seed);
      expect(hex(rand.randomBytes(256, { rng }))).toMatchSnapshot();
    });
    it(`fillBytes then nextU64 (${name})`, () => {
      const rng = new rand.SeededRng(seed);
      const buf = new Uint8Array(7);
      rng.fillBytes(buf);
      expect([hex(buf), rng.nextU64().toString()]).toMatchSnapshot();
    });
  }
  it("forTesting / testRandomBytes", () => {
    expect(hex(rand.testRandomBytes(32))).toMatchSnapshot();
    expect(rand.SeededRng.forTesting().nextU64().toString()).toMatchSnapshot();
  });
});

const U_BOUNDS = [1, 2, 7, 255, 256, 65535, 65536, 4294967295];
const U64_BOUNDS = [
  1n,
  2n,
  7n,
  255n,
  256n,
  65536n,
  4294967296n,
  9007199254740991n,
  18446744073709551615n,
];

describe("golden: samplers (consumption pattern)", () => {
  for (const [name, seed] of SEEDS.slice(0, 2)) {
    it(`upper-bound samplers (${name})`, () => {
      const out: Record<string, unknown> = {};
      const rng = new rand.SeededRng(seed);
      out["u8"] = U_BOUNDS.filter((b) => b <= 255).map((b) =>
        Array.from({ length: 8 }, () => samplers.nextWithUpperBoundU8(rng, b)),
      );
      out["u16"] = U_BOUNDS.filter((b) => b <= 65535).map((b) =>
        Array.from({ length: 8 }, () => samplers.nextWithUpperBoundU16(rng, b)),
      );
      out["u32"] = U_BOUNDS.map((b) =>
        Array.from({ length: 8 }, () => samplers.nextWithUpperBoundU32(rng, b)),
      );
      out["u64"] = U64_BOUNDS.map((b) =>
        Array.from({ length: 8 }, () => samplers.nextWithUpperBoundU64(rng, b).toString()),
      );
      out["state"] = rng.nextU64().toString();
      expect(out).toMatchSnapshot();
    });
    it(`range samplers (${name})`, () => {
      const rng = new rand.SeededRng(seed);
      const out: Record<string, unknown> = {};
      // Full-range branches draw a raw u64 and throw when it does not fit; record either outcome.
      const n = (f: () => number | bigint) =>
        Array.from({ length: 6 }, () => {
          try {
            return String(f());
          } catch (e) {
            return `throw:${(e as Error).message}`;
          }
        });
      out["u8"] = [
        [0, 255],
        [10, 20],
        [0, 1],
      ].map(([s, e]) => n(() => samplers.nextInRangeU8(rng, s, e)));
      out["u16"] = [
        [0, 65535],
        [1000, 2000],
      ].map(([s, e]) => n(() => samplers.nextInRangeU16(rng, s, e)));
      out["u32"] = [
        [0, 4294967295],
        [5, 4294967295],
      ].map(([s, e]) => n(() => samplers.nextInRangeU32(rng, s, e)));
      out["u64"] = [
        [0n, 18446744073709551615n],
        [1n, 18446744073709551615n],
        [100n, 200n],
      ].map(([s, e]) => n(() => samplers.nextInRangeU64(rng, s, e)));
      out["i8"] = [
        [-128, 127],
        [-5, 5],
      ].map(([s, e]) => n(() => samplers.nextInRangeI8(rng, s, e)));
      out["i16"] = [
        [-32768, 32767],
        [-100, 100],
      ].map(([s, e]) => n(() => samplers.nextInRangeI16(rng, s, e)));
      out["i32"] = [
        [-2147483648, 2147483647],
        [-7, 7],
      ].map(([s, e]) => n(() => samplers.nextInRangeI32(rng, s, e)));
      out["i64"] = [
        [-9223372036854775808n, 9223372036854775807n],
        [-3n, 3n],
      ].map(([s, e]) => n(() => samplers.nextInRangeI64(rng, s, e)));
      out["cu8"] = [
        [0, 255],
        [10, 20],
        [3, 3],
      ].map(([s, e]) => n(() => samplers.nextInClosedRangeU8(rng, s, e)));
      out["cu16"] = [
        [0, 65535],
        [1, 2],
      ].map(([s, e]) => n(() => samplers.nextInClosedRangeU16(rng, s, e)));
      out["cu32"] = [
        [0, 4294967295],
        [0, 0],
      ].map(([s, e]) => n(() => samplers.nextInClosedRangeU32(rng, s, e)));
      out["cu64"] = [
        [0n, 18446744073709551615n],
        [7n, 9n],
      ].map(([s, e]) => n(() => samplers.nextInClosedRangeU64(rng, s, e)));
      out["ci8"] = [
        [-128, 127],
        [-1, 1],
      ].map(([s, e]) => n(() => samplers.nextInClosedRangeI8(rng, s, e)));
      out["ci16"] = [
        [-32768, 32767],
        [0, 0],
      ].map(([s, e]) => n(() => samplers.nextInClosedRangeI16(rng, s, e)));
      out["ci32"] = [
        [-2147483648, 2147483647],
        [-2, 2],
      ].map(([s, e]) => n(() => samplers.nextInClosedRangeI32(rng, s, e)));
      out["ci64"] = [
        [-9223372036854775808n, 9223372036854775807n],
        [5n, 6n],
      ].map(([s, e]) => n(() => samplers.nextInClosedRangeI64(rng, s, e)));
      out["bool"] = Array.from({ length: 16 }, () => rand.randomBool({ rng }));
      out["state"] = rng.nextU64().toString();
      expect(out).toMatchSnapshot();
    });
  }
  it("signed ranges longer than the width's MAX are rejected before any draw", () => {
    // The reference's `end - start` overflows for these (a panic when
    // checked); the port throws RandError and leaves the generator untouched.
    const rng = new rand.SeededRng(SEEDS[0][1]);
    const first = new rand.SeededRng(SEEDS[0][1]).nextU64();
    const outcome = (f: () => unknown): string => {
      try {
        return String(f());
      } catch (e) {
        return `throw:${(e as Error).message}`;
      }
    };
    expect({
      "nextInRangeI8(-128, 127)": outcome(() => samplers.nextInRangeI8(rng, -128, 127)),
      "nextInClosedRangeI8(-128, 127)": outcome(() => samplers.nextInClosedRangeI8(rng, -128, 127)),
      "nextInClosedRangeI8(-1, 127)": outcome(() => samplers.nextInClosedRangeI8(rng, -1, 127)),
      "nextInClosedRangeI16(-32768, 32767)": outcome(() =>
        samplers.nextInClosedRangeI16(rng, -32768, 32767),
      ),
      "nextInRangeI32(-128, 2147483647)": outcome(() =>
        samplers.nextInRangeI32(rng, -128, 2147483647),
      ),
      "nextInClosedRangeI64(-7n, i64::MAX)": outcome(() =>
        samplers.nextInClosedRangeI64(rng, -7n, 9223372036854775807n),
      ),
      "nextInRangeI64(i64::MIN, 0n)": outcome(() =>
        samplers.nextInRangeI64(rng, -9223372036854775808n, 0n),
      ),
    }).toMatchSnapshot();
    expect(rng.nextU64()).toBe(first);
  });
});

describe("golden: pure helpers", () => {
  it("wideMul", () => {
    expect([
      widening.wideMulU8(255, 255),
      widening.wideMulU16(65535, 65535),
      widening.wideMulU32(4294967295, 4294967295).map(String),
      widening.wideMulU64(0xffffffffffffffffn, 0xffffffffffffffffn).map(String),
      widening.wideMul(123456789n, 987654321n, 40).map(String),
    ]).toMatchSnapshot();
  });
  it("secure rng shape", () => {
    const rng = new rand.SecureRng();
    expect(rand.randomBytes(16, { rng }).length).toBe(16);
    expect(typeof rng.nextU64()).toBe("bigint");
    expect(rand.secureRng()).toBeInstanceOf(rand.SecureRng);
  });
});

/**
 * The zero-seed substitution, byte seeds, the input-domain rejections and the
 * fast-path precondition.
 */
const outcome = (f: () => unknown): string => {
  try {
    return String(f());
  } catch (e) {
    return `throw:${(e as Error).constructor.name}:${(e as Error).message}`;
  }
};

describe("golden: seed forms, argument domain and the fast path", () => {
  it("all-zero seed: the reference's seed_from_u64(0) substitution", () => {
    expect(outcome(() => new rand.SeededRng([0n, 0n, 0n, 0n]).nextU64())).toMatchSnapshot();
    expect(outcome(() => new rand.SeededRng(new Uint8Array(32)).nextU64())).toMatchSnapshot();
  });

  it("byte seed equals word seed: 32 little-endian bytes, four u64 words", () => {
    for (const [, seed] of SEEDS) {
      const bytes = new Uint8Array(32);
      const view = new DataView(bytes.buffer);
      seed.forEach((w, i) => view.setBigUint64(i * 8, w, true));
      const a = new rand.SeededRng(seed);
      const b = new rand.SeededRng(bytes);
      for (let i = 0; i < 64; i++) expect(b.nextU64()).toBe(a.nextU64());
    }
    expect(outcome(() => new rand.SeededRng(new Uint8Array(31)))).toMatchSnapshot();
  });

  it("out-of-width and non-integer arguments: every one a RandError", () => {
    const r = (): rand.SeededRng => rand.SeededRng.forTesting();
    expect({
      "nextWithUpperBoundU32(2^32)": outcome(() => samplers.nextWithUpperBoundU32(r(), 4294967296)),
      "nextWithUpperBoundU32(-1)": outcome(() => samplers.nextWithUpperBoundU32(r(), -1)),
      "nextWithUpperBoundU32(1.5)": outcome(() => samplers.nextWithUpperBoundU32(r(), 1.5)),
      "nextWithUpperBoundU8(256)": outcome(() => samplers.nextWithUpperBoundU8(r(), 256)),
      "nextWithUpperBoundU16(65536)": outcome(() => samplers.nextWithUpperBoundU16(r(), 65536)),
      "nextWithUpperBoundU64(2^64)": outcome(() => samplers.nextWithUpperBoundU64(r(), 1n << 64n)),
      "nextWithUpperBoundU64(-1n)": outcome(() => samplers.nextWithUpperBoundU64(r(), -1n)),
      "nextInRangeU8(0, 256)": outcome(() => samplers.nextInRangeU8(r(), 0, 256)),
      "nextInRangeU8(0, 1e9)": outcome(() => samplers.nextInRangeU8(r(), 0, 1e9)),
      "nextInRangeI8(-200, 5)": outcome(() => samplers.nextInRangeI8(r(), -200, 5)),
      "nextInRangeI16(-40000, 5)": outcome(() => samplers.nextInRangeI16(r(), -40000, 5)),
      "nextInRangeI32(0, 2^32)": outcome(() => samplers.nextInRangeI32(r(), 0, 4294967296)),
      "nextInRangeU64(-1n, 5n)": outcome(() => samplers.nextInRangeU64(r(), -1n, 5n)),
      "nextInRangeI64(-2^64, 0n)": outcome(() => samplers.nextInRangeI64(r(), -(1n << 64n), 0n)),
      "nextInClosedRangeU8(0, 256)": outcome(() => samplers.nextInClosedRangeU8(r(), 0, 256)),
      "nextInClosedRangeI8(-129, 0)": outcome(() => samplers.nextInClosedRangeI8(r(), -129, 0)),
      "nextInClosedRangeU32(0.5, 2)": outcome(() => samplers.nextInClosedRangeU32(r(), 0.5, 2)),
      "nextInClosedRangeU64(0n, 2^64)": outcome(() =>
        samplers.nextInClosedRangeU64(r(), 0n, 1n << 64n),
      ),
      "randomBytes(1.5)": outcome(() => rand.randomBytes(1.5, { rng: r() }).length),
      "SeededRng([2^64, 1, 1, 1])": outcome(() =>
        new rand.SeededRng([1n << 64n, 1n, 1n, 1n]).nextU64(),
      ),
    }).toMatchSnapshot();
  });

  it("nextU32 is the low half of a 64-bit step for the package's generators (the fast path)", () => {
    for (const [, seed] of SEEDS) {
      const a = new rand.SeededRng(seed);
      const b = new rand.SeededRng(seed);
      for (let i = 0; i < 16; i++) expect(BigInt(a.nextU32())).toBe(b.nextU64() & 0xffffffffn);
    }
  });
});

describe("golden: usize samplers and the packed byte stream", () => {
  for (const [name, seed] of SEEDS.slice(0, 2)) {
    it(`usize samplers (${name})`, () => {
      const rng = new rand.SeededRng(seed);
      expect({
        bound: [1, 2, 7, 4294967296, 9007199254740991].map((b) =>
          Array.from({ length: 4 }, () => samplers.nextWithUpperBoundUsize(rng, b)),
        ),
        range: (
          [
            [0, 1],
            [8, 32],
            [4294967295, 4294967297],
            [0, 9007199254740991],
          ] as [number, number][]
        ).map(([s, e]) => Array.from({ length: 4 }, () => samplers.nextInRangeUsize(rng, s, e))),
        closed: (
          [
            [8, 32],
            [3, 3],
            [0, 9007199254740991],
          ] as [number, number][]
        ).map(([s, e]) =>
          Array.from({ length: 4 }, () => samplers.nextInClosedRangeUsize(rng, s, e)),
        ),
        state: rng.nextU64().toString(),
      }).toMatchSnapshot();
    });
    it(`fillBytesPacked (${name})`, () => {
      const rng = new rand.SeededRng(seed);
      const take = (n: number): string => {
        const b = new Uint8Array(n);
        rng.fillBytesPacked(b);
        return hex(b);
      };
      expect(
        [32, 11, 3, 0, 1, 4, 5, 7, 8].map(take).concat(rng.nextU64().toString()),
      ).toMatchSnapshot();
    });
  }
});
