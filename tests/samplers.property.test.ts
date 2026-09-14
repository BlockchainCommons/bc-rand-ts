/**
 * Property tests: every sampler stays inside its bound/range; wide
 * multiplication round-trips.
 */
import fc from "fast-check";
import * as rand from "../src";
import * as samplers from "../src/samplers";
import * as widening from "../src/widening";

const u64 = fc.bigInt({ min: 0n, max: (1n << 64n) - 1n });
// The all-zero seed is a fixed point of xoshiro256** (every output is 0), so a
// rejection sampler never terminates on it; it is documented as invalid.
const seedArb = fc.tuple(u64, u64, u64, u64).filter((s) => s.some((x) => x !== 0n));
const rngFor = (s: [bigint, bigint, bigint, bigint]) => new rand.SeededRng(s);

describe("samplers stay in bounds", () => {
  it("upper bound u8/u16/u32/u64", () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 255 }), (s, b) => {
        const v = samplers.nextWithUpperBoundU8(rngFor(s), b);
        return v >= 0 && v < b;
      }),
      { numRuns: 300 },
    );
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 65535 }), (s, b) => {
        const v = samplers.nextWithUpperBoundU16(rngFor(s), b);
        return v >= 0 && v < b;
      }),
      { numRuns: 300 },
    );
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 4294967295 }), (s, b) => {
        const v = samplers.nextWithUpperBoundU32(rngFor(s), b);
        return v >= 0 && v < b;
      }),
      { numRuns: 300 },
    );
    fc.assert(
      fc.property(
        seedArb,
        fc.bigInt({ min: 0n, max: (1n << 64n) - 1n }).filter((b) => b > 0n),
        (s, b) => {
          const v = samplers.nextWithUpperBoundU64(rngFor(s), b);
          return v >= 0n && v < b;
        },
      ),
      { numRuns: 300 },
    );
  });
  it("half-open and closed ranges", () => {
    fc.assert(
      fc.property(
        seedArb,
        fc.integer({ min: -128, max: 126 }),
        // The length must fit i8 (the reference's arithmetic); longer ones throw, below.
        fc.integer({ min: 1, max: 127 }),
        (s, lo, d) => {
          const hi = Math.min(127, lo + d);
          if (hi <= lo) return true;
          const v = samplers.nextInRangeI8(rngFor(s), lo, hi);
          return v >= lo && v < hi;
        },
      ),
      { numRuns: 300 },
    );
    fc.assert(
      fc.property(
        seedArb,
        fc.integer({ min: 0, max: 65535 }),
        fc.integer({ min: 0, max: 65535 }),
        (s, a, b) => {
          const lo = Math.min(a, b),
            hi = Math.max(a, b);
          const rng = rngFor(s);
          if (lo === 0 && hi === 65535) {
            // Rust's full-range path converts one raw u64 with from_u64(...).unwrap().
            const reference = rngFor(s);
            const draw = reference.nextU64();
            if (draw > 65535n) {
              expect(() => samplers.nextInClosedRangeU16(rng, lo, hi)).toThrow(
                "random value does not fit the target width",
              );
            } else {
              expect(samplers.nextInClosedRangeU16(rng, lo, hi)).toBe(Number(draw));
            }
            expect(rng.state).toEqual(reference.state);
            return true;
          }
          const v = samplers.nextInClosedRangeU16(rng, lo, hi);
          return v >= lo && v <= hi;
        },
      ),
      {
        numRuns: 300,
        examples: [
          [[0n, 12n, 0n, 0n], 65535, 0], // CI regression: raw draw 69120 overflows u16.
          [[0n, 1n, 0n, 0n], 0, 65535], // Raw draw 5760 fits u16.
        ],
      },
    );
    // i64 with a NON-NEGATIVE start is in range today.
    fc.assert(
      fc.property(
        seedArb,
        fc.bigInt({ min: 0n, max: (1n << 63n) - 1n }),
        fc.bigInt({ min: 0n, max: (1n << 63n) - 1n }),
        (s, a, b) => {
          const lo = a < b ? a : b,
            hi = a < b ? b : a;
          const v = samplers.nextInClosedRangeI64(rngFor(s), lo, hi);
          return v >= lo && v <= hi;
        },
      ),
      { numRuns: 300 },
    );
  });

  // Fixed: i64 ranges with a negative start are in range.
  it("i64 ranges with a negative start", () => {
    const v = samplers.nextInClosedRangeI64(rngFor([0n, 0n, 0n, 1n]), -1n, 0n);
    expect(v >= -1n && v <= 0n).toBe(true);
  });
  it("signed ranges longer than the width's MAX throw; shorter ones sample in range", () => {
    fc.assert(
      fc.property(
        seedArb,
        fc.integer({ min: -128, max: 127 }),
        fc.integer({ min: -128, max: 127 }),
        (s, a, b) => {
          const lo = Math.min(a, b),
            hi = Math.max(a, b);
          if (hi - lo > 127) {
            expect(() => samplers.nextInClosedRangeI8(rngFor(s), lo, hi)).toThrow(rand.RandError);
            return true;
          }
          const v = samplers.nextInClosedRangeI8(rngFor(s), lo, hi);
          return v >= lo && v <= hi;
        },
      ),
      { numRuns: 400 },
    );
    fc.assert(
      fc.property(
        seedArb,
        fc.bigInt({ min: -(1n << 63n), max: (1n << 63n) - 1n }),
        fc.bigInt({ min: -(1n << 63n), max: (1n << 63n) - 1n }),
        (s, a, b) => {
          const lo = a < b ? a : b,
            hi = a < b ? b : a;
          if (hi - lo > (1n << 63n) - 1n) {
            expect(() => samplers.nextInClosedRangeI64(rngFor(s), lo, hi)).toThrow(rand.RandError);
            return true;
          }
          const v = samplers.nextInClosedRangeI64(rngFor(s), lo, hi);
          return v >= lo && v <= hi;
        },
      ),
      { numRuns: 400 },
    );
  });
  it("usize samplers stay in range and equal the u64 samplers", () => {
    const safe = fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER });
    fc.assert(
      fc.property(seedArb, safe, safe, (s, a, b) => {
        const lo = Math.min(a, b),
          hi = Math.max(a, b);
        const v = samplers.nextInClosedRangeUsize(rngFor(s), lo, hi);
        const w = Number(samplers.nextInClosedRangeU64(rngFor(s), BigInt(lo), BigInt(hi)));
        return v >= lo && v <= hi && v === w;
      }),
      { numRuns: 300 },
    );
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }), (s, b) => {
        const v = samplers.nextWithUpperBoundUsize(rngFor(s), b);
        return (
          v >= 0 && v < b && v === Number(samplers.nextWithUpperBoundU64(rngFor(s), BigInt(b)))
        );
      }),
      { numRuns: 300 },
    );
  });
});

describe("helpers round-trip", () => {
  it("wideMulU64 reassembles", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: (1n << 64n) - 1n }),
        fc.bigInt({ min: 0n, max: (1n << 64n) - 1n }),
        (a, b) => {
          const [lo, hi] = widening.wideMulU64(a, b);
          return (hi << 64n) + lo === a * b;
        },
      ),
    );
  });
  it("wideMulU32 reassembles", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4294967295 }),
        fc.integer({ min: 0, max: 4294967295 }),
        (a, b) => {
          const [lo, hi] = widening.wideMulU32(a, b);
          return (hi << 32n) + lo === BigInt(a) * BigInt(b);
        },
      ),
    );
  });
});

/**
 * Every sampler, with arguments that draw (no full-width early return), and
 * whether it draws through `nextU64Low32` (the 8/16/32-bit widths) or through
 * `nextU64` (the 64-bit and usize widths).
 */
const EVERY_SAMPLER: [keyof typeof samplers, unknown[], "low32" | "u64"][] = [
  ["nextWithUpperBoundU8", [10], "low32"],
  ["nextWithUpperBoundU16", [1000], "low32"],
  ["nextWithUpperBoundU32", [100000], "low32"],
  ["nextWithUpperBoundU64", [10n], "u64"],
  ["nextWithUpperBoundUsize", [10], "u64"],
  ["nextInRangeU8", [0, 10], "low32"],
  ["nextInRangeU16", [0, 1000], "low32"],
  ["nextInRangeU32", [0, 100000], "low32"],
  ["nextInRangeU64", [0n, 10n], "u64"],
  ["nextInRangeUsize", [0, 10], "u64"],
  ["nextInRangeI8", [-5, 5], "low32"],
  ["nextInRangeI16", [-100, 100], "low32"],
  ["nextInRangeI32", [-1000, 1000], "low32"],
  ["nextInRangeI64", [-5n, 5n], "u64"],
  ["nextInClosedRangeU8", [0, 10], "low32"],
  ["nextInClosedRangeU16", [0, 1000], "low32"],
  ["nextInClosedRangeU32", [0, 100000], "low32"],
  ["nextInClosedRangeU64", [0n, 10n], "u64"],
  ["nextInClosedRangeUsize", [0, 10], "u64"],
  ["nextInClosedRangeI8", [-5, 5], "low32"],
  ["nextInClosedRangeI16", [-100, 100], "low32"],
  ["nextInClosedRangeI32", [-1000, 1000], "low32"],
  ["nextInClosedRangeI64", [-5n, 5n], "u64"],
];
/** The full-width early returns draw one raw `nextU64()` on every width. */
const FULL_WIDTH: [keyof typeof samplers, unknown[]][] = [
  ["nextInRangeU8", [0, 255]],
  ["nextInRangeU16", [0, 65535]],
  ["nextInRangeU32", [0, 4294967295]],
  ["nextInRangeU64", [0n, 18446744073709551615n]],
  ["nextInClosedRangeU8", [0, 255]],
  ["nextInClosedRangeU16", [0, 65535]],
  ["nextInClosedRangeU32", [0, 4294967295]],
  ["nextInClosedRangeU64", [0n, 18446744073709551615n]],
];
const call = (name: keyof typeof samplers, rng: unknown, args: unknown[]): unknown =>
  (samplers[name] as (...a: unknown[]) => unknown)(rng, ...args);
const invalidGenerator = (f: () => unknown, method: string, value: unknown): void => {
  let error: unknown;
  try {
    f();
  } catch (e) {
    error = e;
  }
  expect(rand.RandError.isRandError(error), `expected RandError, got ${String(error)}`).toBe(true);
  const e = error as rand.RandError;
  expect(e.code).toBe("InvalidGenerator");
  expect(e.details).toEqual({ code: "InvalidGenerator", method, value });
};

describe("samplers enforce the generator contract (RandError InvalidGenerator, nothing masked)", () => {
  it("every sampler covers the whole /samplers surface", () => {
    const exported = Object.keys(samplers).sort();
    expect(EVERY_SAMPLER.map(([n]) => n).sort()).toEqual(exported);
  });

  it.each([5, 1.5, -1n, (1n << 64n) + 5n, "3", undefined])(
    "a nextU64 returning %s throws at the draw from every sampler",
    (bad) => {
      const g = { nextU32: () => 1, nextU64: () => bad, fillBytes: () => undefined };
      for (const [name, args] of EVERY_SAMPLER) {
        invalidGenerator(() => call(name, g, args), "nextU64", bad);
      }
      for (const [name, args] of FULL_WIDTH) {
        invalidGenerator(() => call(name, g, args), "nextU64", bad);
      }
    },
  );

  it.each([-1, 1.5, 2 ** 40 + 7, 7n, Number.NaN, 4294967296])(
    "a nextU64Low32 returning %s throws from the 8/16/32-bit samplers; the 64-bit ones do not use it",
    (bad) => {
      const g = {
        nextU32: () => 1,
        nextU64: () => 3n,
        nextU64Low32: () => bad,
        fillBytes: () => undefined,
      };
      for (const [name, args, path] of EVERY_SAMPLER) {
        if (path === "low32") invalidGenerator(() => call(name, g, args), "nextU64Low32", bad);
        else expect(() => call(name, g, args)).not.toThrow();
      }
    },
  );

  it("a missing or non-callable member names the member; undefined/null generators name nextU64", () => {
    for (const [name, args] of [...EVERY_SAMPLER, ...FULL_WIDTH]) {
      invalidGenerator(() => call(name, {}, args), "nextU64", undefined);
      invalidGenerator(() => call(name, { nextU64: 5 }, args), "nextU64", 5);
      invalidGenerator(() => call(name, undefined, args), "nextU64", undefined);
      invalidGenerator(() => call(name, null, args), "nextU64", null);
    }
    const nonCallableLow32 = { nextU64: () => 3n, nextU64Low32: 5 };
    for (const [name, args, path] of EVERY_SAMPLER) {
      if (path === "low32") {
        invalidGenerator(() => call(name, nonCallableLow32, args), "nextU64Low32", 5);
      } else {
        expect(() => call(name, nonCallableLow32, args)).not.toThrow();
      }
    }
  });

  it("the argument checks still come first: a bad argument wins over a bad generator", () => {
    expect(() => samplers.nextWithUpperBoundU8({} as never, 256)).toThrow(
      "upperBound must be an integer in [1, 255], got 256",
    );
    expect(() => samplers.nextInRangeI8(undefined as never, 5, 5)).toThrow(
      "start must be less than end, got 5 and 5",
    );
  });

  it("a conforming third-party generator without the fast path samples through nextU64", () => {
    // Constant 3n: Lemire's product never lands in the rejection zone for these bounds.
    const g = { nextU32: () => 1, nextU64: () => 3n, fillBytes: () => undefined };
    expect(samplers.nextWithUpperBoundU8(g, 10)).toBe(0);
    expect(samplers.nextWithUpperBoundU64(g, 10n)).toBe(0n);
    expect(samplers.nextInClosedRangeI8(g, -5, 5)).toBe(-5);
  });
});

describe("samplers reject the JS-only input domain", () => {
  const rng = (): rand.SeededRng => rand.SeededRng.forTesting();
  it("non-integer bounds throw RandError", () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 254, noInteger: true, noNaN: true }), (b) => {
        expect(() => samplers.nextWithUpperBoundU8(rng(), b)).toThrow(rand.RandError);
        expect(() => samplers.nextInRangeI16(rng(), 0, b)).toThrow(rand.RandError);
        return true;
      }),
    );
    expect(() => samplers.nextWithUpperBoundU32(rng(), Number.NaN)).toThrow(rand.RandError);
  });
  it("out-of-width bounds and range ends throw RandError naming the argument", () => {
    expect(() => samplers.nextWithUpperBoundU8(rng(), 256)).toThrow(
      "upperBound must be an integer in [1, 255], got 256",
    );
    expect(() => samplers.nextWithUpperBoundU32(rng(), 4294967296)).toThrow(rand.RandError);
    expect(() => samplers.nextWithUpperBoundU64(rng(), -1n)).toThrow("upperBound must be");
    expect(() => samplers.nextInRangeU8(rng(), 0, 256)).toThrow(
      "end must be an integer in [0, 255], got 256",
    );
    expect(() => samplers.nextInRangeI8(rng(), -200, 5)).toThrow(
      "start must be an integer in [-128, 127], got -200",
    );
    expect(() => samplers.nextInClosedRangeU64(rng(), 0n, 1n << 64n)).toThrow(rand.RandError);
    expect(() => samplers.nextInClosedRangeI64(rng(), -(1n << 64n), 0n)).toThrow(rand.RandError);
    fc.assert(
      fc.property(fc.integer({ min: 65536, max: 1 << 30 }), (e) => {
        expect(() => samplers.nextInRangeU16(rng(), 0, e)).toThrow(rand.RandError);
        expect(() => samplers.nextInClosedRangeI16(rng(), 0, e)).toThrow(rand.RandError);
        return true;
      }),
    );
  });
  it("SeededRng rejects seed words outside u64 and byte seeds that are not 32 bytes", () => {
    expect(() => new rand.SeededRng([1n << 64n, 1n, 1n, 1n])).toThrow(
      "seed[0] must be an integer in [0, 18446744073709551615]",
    );
    expect(() => new rand.SeededRng([1n, -1n, 1n, 1n])).toThrow(rand.RandError);
    expect(() => new rand.SeededRng(new Uint8Array(16))).toThrow(
      "seed byte length must be an integer in [32, 32], got 16",
    );
    expect(() => rand.randomBytes(1.5)).toThrow(
      "size must be an integer in [0, 9007199254740991], got 1.5",
    );
  });
});
