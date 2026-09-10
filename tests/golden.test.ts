/**
 * Golden snapshots (Phase 0.2).
 *
 * Every seeded output and every sampler's consumption pattern, snapshotted so
 * a wire change shows up as a diff. The authority is tests/vectors (Phase 1);
 * this suite is the cheap, broad net.
 */
import * as rand from "../src";

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
      const rng = new rand.SeededRandomNumberGenerator(seed);
      expect(Array.from({ length: 64 }, () => rng.nextU64().toString())).toMatchSnapshot();
    });
    it(`nextU32 ×64 (${name})`, () => {
      const rng = new rand.SeededRandomNumberGenerator(seed);
      expect(Array.from({ length: 64 }, () => rng.nextU32())).toMatchSnapshot();
    });
    it(`randomData(256) (${name})`, () => {
      const rng = new rand.SeededRandomNumberGenerator(seed);
      expect(hex(rng.randomData(256))).toMatchSnapshot();
    });
    it(`fillBytes then nextU64 (${name})`, () => {
      const rng = new rand.SeededRandomNumberGenerator(seed);
      const buf = new Uint8Array(7);
      rng.fillBytes(buf);
      expect([hex(buf), rng.nextU64().toString()]).toMatchSnapshot();
    });
  }
  it("makeFakeRandomNumberGenerator / fakeRandomData", () => {
    expect(hex(rand.fakeRandomData(32))).toMatchSnapshot();
    expect(rand.makeFakeRandomNumberGenerator().nextU64().toString()).toMatchSnapshot();
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
      const rng = new rand.SeededRandomNumberGenerator(seed);
      out["u8"] = U_BOUNDS.filter((b) => b <= 255).map((b) =>
        Array.from({ length: 8 }, () => rand.rngNextWithUpperBoundU8(rng, b)),
      );
      out["u16"] = U_BOUNDS.filter((b) => b <= 65535).map((b) =>
        Array.from({ length: 8 }, () => rand.rngNextWithUpperBoundU16(rng, b)),
      );
      out["u32"] = U_BOUNDS.map((b) =>
        Array.from({ length: 8 }, () => rand.rngNextWithUpperBoundU32(rng, b)),
      );
      out["u64"] = U64_BOUNDS.map((b) =>
        Array.from({ length: 8 }, () => rand.rngNextWithUpperBoundU64(rng, b).toString()),
      );
      out["state"] = rng.nextU64().toString();
      expect(out).toMatchSnapshot();
    });
    it(`range samplers (${name})`, () => {
      const rng = new rand.SeededRandomNumberGenerator(seed);
      const out: Record<string, unknown> = {};
      // Full-range branches draw a raw u64 and throw on overflow by design; record either outcome.
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
      ].map(([s, e]) => n(() => rand.rngNextInRangeU8(rng, s, e)));
      out["u16"] = [
        [0, 65535],
        [1000, 2000],
      ].map(([s, e]) => n(() => rand.rngNextInRangeU16(rng, s, e)));
      out["u32"] = [
        [0, 4294967295],
        [5, 4294967295],
      ].map(([s, e]) => n(() => rand.rngNextInRangeU32(rng, s, e)));
      out["u64"] = [
        [0n, 18446744073709551615n],
        [1n, 18446744073709551615n],
        [100n, 200n],
      ].map(([s, e]) => n(() => rand.rngNextInRangeU64(rng, s, e)));
      out["i8"] = [
        [-128, 127],
        [-5, 5],
      ].map(([s, e]) => n(() => rand.rngNextInRangeI8(rng, s, e)));
      out["i16"] = [
        [-32768, 32767],
        [-100, 100],
      ].map(([s, e]) => n(() => rand.rngNextInRangeI16(rng, s, e)));
      out["i32"] = [
        [-2147483648, 2147483647],
        [-7, 7],
      ].map(([s, e]) => n(() => rand.rngNextInRangeI32(rng, s, e)));
      out["i64"] = [
        [-9223372036854775808n, 9223372036854775807n],
        [-3n, 3n],
      ].map(([s, e]) => n(() => rand.rngNextInRangeI64(rng, s, e)));
      out["cu8"] = [
        [0, 255],
        [10, 20],
        [3, 3],
      ].map(([s, e]) => n(() => rand.rngNextInClosedRangeU8(rng, s, e)));
      out["cu16"] = [
        [0, 65535],
        [1, 2],
      ].map(([s, e]) => n(() => rand.rngNextInClosedRangeU16(rng, s, e)));
      out["cu32"] = [
        [0, 4294967295],
        [0, 0],
      ].map(([s, e]) => n(() => rand.rngNextInClosedRangeU32(rng, s, e)));
      out["cu64"] = [
        [0n, 18446744073709551615n],
        [7n, 9n],
      ].map(([s, e]) => n(() => rand.rngNextInClosedRangeU64(rng, s, e)));
      out["ci8"] = [
        [-128, 127],
        [-1, 1],
      ].map(([s, e]) => n(() => rand.rngNextInClosedRangeI8(rng, s, e)));
      out["ci16"] = [
        [-32768, 32767],
        [0, 0],
      ].map(([s, e]) => n(() => rand.rngNextInClosedRangeI16(rng, s, e)));
      out["ci32"] = [
        [-2147483648, 2147483647],
        [-2, 2],
      ].map(([s, e]) => n(() => rand.rngNextInClosedRangeI32(rng, s, e)));
      out["ci64"] = [
        [-9223372036854775808n, 9223372036854775807n],
        [5n, 6n],
      ].map(([s, e]) => n(() => rand.rngNextInClosedRangeI64(rng, s, e)));
      out["bool"] = Array.from({ length: 16 }, () => rand.rngRandomBool(rng));
      out["state"] = rng.nextU64().toString();
      expect(out).toMatchSnapshot();
    });
  }
  it("full-range signed early return throws on overflow (consumption pinned)", () => {
    // i8 full range: draws raw nextU64; throws when > 127. Record outcome sequence.
    const rng = new rand.SeededRandomNumberGenerator(SEEDS[0][1]);
    const outcomes: string[] = [];
    for (let i = 0; i < 8; i++) {
      try {
        outcomes.push(String(rand.rngNextInRangeI8(rng, -128, 127)));
      } catch (e) {
        outcomes.push(`throw:${(e as Error).message}`);
      }
    }
    expect(outcomes).toMatchSnapshot();
  });
});

describe("golden: pure helpers", () => {
  it("wideMul", () => {
    expect([
      rand.wideMulU8(255, 255),
      rand.wideMulU16(65535, 65535),
      rand.wideMulU32(4294967295, 4294967295).map(String),
      rand.wideMulU64(0xffffffffffffffffn, 0xffffffffffffffffn).map(String),
      rand.wideMul(123456789n, 987654321n, 40).map(String),
    ]).toMatchSnapshot();
  });
  it("magnitude", () => {
    expect([
      rand.toMagnitude(-128, 8),
      rand.toMagnitude(-1, 16),
      rand.toMagnitude(-2147483648, 32),
      rand.toMagnitude64(-9223372036854775808n).toString(),
      rand.fromMagnitude(128, 8),
      rand.fromMagnitude(65535, 16),
      rand.fromMagnitude(2147483648, 32),
      rand.fromMagnitude64(0x8000000000000000n).toString(),
    ]).toMatchSnapshot();
  });
  it("secure rng shape", () => {
    const rng = new rand.SecureRandomNumberGenerator();
    expect(rng.randomData(16).length).toBe(16);
    expect(typeof rng.nextU64()).toBe("bigint");
    expect(rand.threadRng()).toBeInstanceOf(rand.SecureRandomNumberGenerator);
  });
});
