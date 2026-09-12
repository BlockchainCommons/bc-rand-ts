import { Xoshiro256StarStar } from "../src/xoshiro";
import {
  SeededRng,
  SecureRng,
  secureRng,
  randomBytes,
  randomBool,
  fillRandomBytes,
  testRandomBytes,
  TEST_SEED,
} from "../src/index";
import {
  nextWithUpperBoundU8,
  nextWithUpperBoundU16,
  nextWithUpperBoundU32,
  nextWithUpperBoundU64,
  nextWithUpperBoundUsize,
  nextInRangeU64,
  nextInRangeUsize,
  nextInRangeI8,
  nextInRangeI32,
  nextInRangeI64,
  nextInClosedRangeU64,
  nextInClosedRangeUsize,
  nextInClosedRangeI8,
  nextInClosedRangeI16,
  nextInClosedRangeI32,
  nextInClosedRangeI64,
} from "../src/samplers";
import { wideMulU8, wideMulU16, wideMulU32, wideMulU64 } from "../src/widening";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("SeededRng", () => {
  test("test_next_u64", () => {
    const rng = new SeededRng(TEST_SEED);
    expect(rng.nextU64()).toBe(1104683000648959614n);
  });

  test("test_next_50", () => {
    const rng = new SeededRng(TEST_SEED);
    const expectedValues: bigint[] = [
      1104683000648959614n,
      9817345228149227957n,
      546276821344993881n,
      15870950426333349563n,
      830653509032165567n,
      14772257893953840492n,
      3512633850838187726n,
      6358411077290857510n,
      7897285047238174514n,
      18314839336815726031n,
      4978716052961022367n,
      17373022694051233817n,
      663115362299242570n,
      9811238046242345451n,
      8113787839071393872n,
      16155047452816275860n,
      673245095821315645n,
      1610087492396736743n,
      1749670338128618977n,
      3927771759340679115n,
      9610589375631783853n,
      5311608497352460372n,
      11014490817524419548n,
      6320099928172676090n,
      12513554919020212402n,
      6823504187935853178n,
      1215405011954300226n,
      8109228150255944821n,
      4122548551796094879n,
      16544885818373129566n,
      5597102191057004591n,
      11690994260783567085n,
      9374498734039011409n,
      18246806104446739078n,
      2337407889179712900n,
      12608919248151905477n,
      7641631838640172886n,
      8421574250687361351n,
      8697189342072434208n,
      8766286633078002696n,
      14800090277885439654n,
      17865860059234099833n,
      4673315107448681522n,
      14288183874156623863n,
      7587575203648284614n,
      9109213819045273474n,
      11817665411945280786n,
      1745089530919138651n,
      5730370365819793488n,
      5496865518262805451n,
    ];

    for (const expected of expectedValues) {
      expect(rng.nextU64()).toBe(expected);
    }
  });

  test("testRandomBytes (reference test_fake_random_data)", () => {
    const data = testRandomBytes(100);
    const expected =
      "7eb559bbbf6cce2632cf9f194aeb50943de7e1cbad54dcfab27a42759f5e2fed518684c556472008a67932f7c682125b50cb72e8216f6906358fdaf28d3545532daee0c5bb5023f50cd8e71ec14901ac746c576c481b893be6656b80622b3a564e59b4e2";
    expect(bytesToHex(data)).toBe(expected);
  });

  test("test_next_with_upper_bound", () => {
    const rng = new SeededRng(TEST_SEED);
    expect(nextWithUpperBoundU32(rng, 10000)).toBe(745);
  });

  test("test_in_range", () => {
    const rng = new SeededRng(TEST_SEED);
    const v: number[] = [];
    for (let i = 0; i < 100; i++) {
      v.push(nextInRangeI32(rng, 0, 100));
    }
    const expected: number[] = [
      7, 44, 92, 16, 16, 67, 41, 74, 66, 20, 18, 6, 62, 34, 4, 69, 99, 19, 0, 85, 22, 27, 56, 23,
      19, 5, 23, 76, 80, 27, 74, 69, 17, 92, 31, 32, 55, 36, 49, 23, 53, 2, 46, 6, 43, 66, 34, 71,
      64, 69, 25, 14, 17, 23, 32, 6, 23, 65, 35, 11, 21, 37, 58, 92, 98, 8, 38, 49, 7, 24, 24, 71,
      37, 63, 91, 21, 11, 66, 52, 54, 55, 19, 76, 46, 89, 38, 91, 95, 33, 25, 4, 30, 66, 51, 5, 91,
      62, 27, 92, 39,
    ];
    expect(v).toEqual(expected);
  });

  test("test_fill_random_data", () => {
    let rng = new SeededRng(TEST_SEED);
    const v1 = randomBytes(100, { rng: rng });

    rng = new SeededRng(TEST_SEED);
    const v2 = new Uint8Array(100);
    rng.fillBytes(v2);

    expect(v1).toEqual(v2);
  });

  test("closed-range i32 fixture (reference test_fake_numbers)", () => {
    const rng = SeededRng.forTesting();
    const array: number[] = [];
    for (let i = 0; i < 100; i++) {
      array.push(nextInClosedRangeI32(rng, -50, 50));
    }
    const expected = [
      -43, -6, 43, -34, -34, 17, -9, 24, 17, -29, -32, -44, 12, -15, -46, 20, 50, -31, -50, 36, -28,
      -23, 6, -27, -31, -45, -27, 26, 31, -23, 24, 19, -32, 43, -18, -17, 6, -13, -1, -27, 4, -48,
      -4, -44, -6, 17, -15, 22, 15, 20, -25, -35, -33, -27, -17, -44, -27, 15, -14, -38, -29, -12,
      8, 43, 49, -42, -11, -1, -42, -26, -25, 22, -13, 14, 42, -29, -38, 17, 2, 5, 5, -31, 27, -3,
      39, -12, 42, 46, -17, -25, -46, -19, 16, 2, -45, 41, 12, -22, 43, -11,
    ];
    expect(array).toEqual(expected);
  });
});

describe("SecureRng", () => {
  test("randomBytes defaults to the secure generator (reference test_random_data)", () => {
    const data1 = randomBytes(32);
    const data2 = randomBytes(32);
    const data3 = randomBytes(32);

    expect(data1.length).toBe(32);
    expect(data1).not.toEqual(data2);
    expect(data1).not.toEqual(data3);
  });

  test("test_secure_rng_instance", () => {
    const rng = new SecureRng();

    const data1 = randomBytes(32, { rng: rng });
    const data2 = randomBytes(32, { rng: rng });

    expect(data1.length).toBe(32);
    expect(data2.length).toBe(32);
    expect(data1).not.toEqual(data2);
  });

  test("test_next_u32", () => {
    const rng = new SecureRng();
    const v1 = rng.nextU32();
    const v2 = rng.nextU32();

    // Values should be in valid u32 range
    expect(v1).toBeGreaterThanOrEqual(0);
    expect(v1).toBeLessThanOrEqual(0xffffffff);
    expect(v2).toBeGreaterThanOrEqual(0);
    expect(v2).toBeLessThanOrEqual(0xffffffff);
  });

  test("test_next_u64", () => {
    const rng = new SecureRng();
    const v1 = rng.nextU64();
    const v2 = rng.nextU64();

    // Values should be in valid u64 range
    expect(v1).toBeGreaterThanOrEqual(0n);
    expect(v1).toBeLessThanOrEqual(0xffffffffffffffffn);
    expect(v2).toBeGreaterThanOrEqual(0n);
    expect(v2).toBeLessThanOrEqual(0xffffffffffffffffn);
  });

  test("secureRng() returns a working SecureRng", () => {
    const rng = secureRng();
    expect(rng).toBeInstanceOf(SecureRng);
    expect(randomBytes(16, { rng: rng }).length).toBe(16);
  });
});

describe("rng utility functions", () => {
  test("nextInClosedRangeU64 stays in range", () => {
    const rng = SeededRng.forTesting();
    const value = nextInClosedRangeU64(rng, 0n, 100n);
    expect(value).toBeGreaterThanOrEqual(0n);
    expect(value).toBeLessThanOrEqual(100n);
  });

  test("nextInRangeU64 stays in range", () => {
    const rng = SeededRng.forTesting();
    const value = nextInRangeU64(rng, 0n, 100n);
    expect(value).toBeGreaterThanOrEqual(0n);
    expect(value).toBeLessThan(100n);
  });

  test("nextWithUpperBoundU64 throws on zero", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextWithUpperBoundU64(rng, 0n)).toThrow(
      "upperBound must be an integer in [1, 18446744073709551615], got 0",
    );
  });

  test("nextWithUpperBoundU8/U16/U32/U64 throw on zero", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextWithUpperBoundU8(rng, 0)).toThrow("upperBound must be an integer in [1, ");
    expect(() => nextWithUpperBoundU16(rng, 0)).toThrow("upperBound must be an integer in [1, ");
    expect(() => nextWithUpperBoundU32(rng, 0)).toThrow("upperBound must be an integer in [1, ");
    expect(() => nextWithUpperBoundU64(rng, 0n)).toThrow(
      "upperBound must be an integer in [1, 18446744073709551615], got 0",
    );
  });

  test("nextInRangeU64 throws on an inverted range", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextInRangeU64(rng, 100n, 0n)).toThrow("start must be less than end");
  });

  test("nextInClosedRangeU64 throws on an inverted range", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextInClosedRangeU64(rng, 100n, 0n)).toThrow(
      "start must be less than or equal to end",
    );
  });

  test("randomBool produces both values across a deterministic seed", () => {
    const rng = SeededRng.forTesting();
    let trues = 0;
    let falses = 0;
    for (let i = 0; i < 200; i++) {
      if (randomBool({ rng: rng })) trues++;
      else falses++;
    }
    expect(trues).toBeGreaterThan(0);
    expect(falses).toBeGreaterThan(0);
    expect(trues + falses).toBe(200);
  });

  test("nextU32 returns a valid u32", () => {
    const rng = SeededRng.forTesting();
    for (let i = 0; i < 50; i++) {
      const v = rng.nextU32();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  test("randomBytes is reproducible for the same seed", () => {
    const rng1 = SeededRng.forTesting();
    const rng2 = SeededRng.forTesting();
    expect(randomBytes(50, { rng: rng1 })).toEqual(randomBytes(50, { rng: rng2 }));
  });

  test("fillBytes fills exactly the buffer", () => {
    const rng = SeededRng.forTesting();
    const buf = new Uint8Array(8);
    rng.fillBytes(buf);
    // Same as the first 8 bytes of testRandomBytes(8): 7eb559bbbf6cce26
    expect(bytesToHex(buf)).toBe("7eb559bbbf6cce26");
  });
});

describe("widening multiplication", () => {
  test("wideMulU8 boundary 0xff * 0xff", () => {
    // 0xff * 0xff = 0xfe01 → low=0x01, high=0xfe
    expect(wideMulU8(0xff, 0xff)).toEqual([0x01, 0xfe]);
    expect(wideMulU8(0, 0)).toEqual([0, 0]);
    expect(wideMulU8(0x10, 0x10)).toEqual([0x00, 0x01]);
  });

  test("wideMulU16 boundary 0xffff * 0xffff", () => {
    // 0xffff * 0xffff = 0xfffe0001 → low=0x0001, high=0xfffe
    expect(wideMulU16(0xffff, 0xffff)).toEqual([0x0001, 0xfffe]);
    expect(wideMulU16(0, 0)).toEqual([0, 0]);
    expect(wideMulU16(0x100, 0x100)).toEqual([0x0000, 0x0001]);
  });

  test("wideMulU32 boundary 0xffffffff * 0xffffffff", () => {
    // 0xffffffff * 0xffffffff = 0xfffffffe00000001
    expect(wideMulU32(0xffffffff, 0xffffffff)).toEqual([0x00000001n, 0xfffffffen]);
    expect(wideMulU32(0, 0)).toEqual([0n, 0n]);
    expect(wideMulU32(0x10000, 0x10000)).toEqual([0n, 1n]);
  });

  test("wideMulU64 boundary u64::MAX * u64::MAX", () => {
    // u64::MAX * u64::MAX = 2^128 - 2^65 + 1
    //                    = 0xfffffffffffffffe_0000000000000001
    const max = 0xffffffffffffffffn;
    expect(wideMulU64(max, max)).toEqual([1n, 0xfffffffffffffffen]);
    expect(wideMulU64(0n, 0n)).toEqual([0n, 0n]);
    expect(wideMulU64(1n << 32n, 1n << 32n)).toEqual([0n, 1n]);
  });
});

describe("Xoshiro256StarStar state bytes (internal core)", () => {
  it("toBytes/fromBytes round-trip the state and continue the same stream", () => {
    const a = new Xoshiro256StarStar([1n, 2n, 3n, 4n]);
    a.nextU64();
    const bytes = a.toBytes();
    expect(bytes.length).toBe(32);
    const b = Xoshiro256StarStar.fromBytes(bytes);
    expect(b.toBytes()).toEqual(bytes);
    expect(b.nextU64()).toBe(a.nextU64());
    expect(() => Xoshiro256StarStar.fromBytes(new Uint8Array(31))).toThrow(RangeError);
  });

  it("nextBytes takes one low byte per step", () => {
    const a = new Xoshiro256StarStar([1n, 2n, 3n, 4n]);
    const b = new Xoshiro256StarStar([1n, 2n, 3n, 4n]);
    const expected = Uint8Array.from({ length: 5 }, () => Number(b.nextU64() & 0xffn));
    expect(a.nextBytes(5)).toEqual(expected);
  });
});

describe("coverage of the remaining branches", () => {
  test("fillRandomBytes fills from the given generator and from the secure default", () => {
    const seeded = new Uint8Array(8);
    fillRandomBytes(seeded, { rng: SeededRng.forTesting() });
    expect(bytesToHex(seeded)).toBe("7eb559bbbf6cce26");
    const secure = new Uint8Array(8);
    fillRandomBytes(secure);
    expect(secure.some((b) => b !== 0)).toBe(true);
  });

  test("Symbol.toStringTag names the generators", () => {
    expect(Object.prototype.toString.call(new SecureRng())).toBe("[object SecureRng]");
    expect(Object.prototype.toString.call(SeededRng.forTesting())).toBe("[object SeededRng]");
  });

  test("a byte seed must be 32 bytes", () => {
    expect(() => new SeededRng(new Uint8Array(16))).toThrow(RangeError);
    expect(() => new SeededRng(new Uint8Array(33))).toThrow(
      "seed byte length must be an integer in [32, 32], got 33",
    );
  });

  test("the samplers' rejection loop consumes extra draws at a hostile bound", () => {
    // 2^32 - 1 has the largest rejection zone for u32; enough draws hit it.
    const rng = SeededRng.forTesting();
    const values = Array.from({ length: 64 }, () => nextWithUpperBoundU32(rng, 4294967295));
    expect(values.every((v) => v >= 0 && v < 4294967295)).toBe(true);
    const wide = Array.from({ length: 64 }, () =>
      nextWithUpperBoundU64(rng, 18446744073709551615n),
    );
    expect(wide.every((v) => v >= 0n && v < 18446744073709551615n)).toBe(true);
    const small = Array.from({ length: 64 }, () => nextWithUpperBoundU8(rng, 255));
    expect(small.every((v) => v >= 0 && v < 255)).toBe(true);
    const mid = Array.from({ length: 64 }, () => nextWithUpperBoundU16(rng, 65535));
    expect(mid.every((v) => v >= 0 && v < 65535)).toBe(true);
  });
});

describe("SeededRng.fillBytesPacked (the reference's RngCore::fill_bytes stream)", () => {
  // bc-rand 0.5.0, TEST_SEED: `RngCore::fill_bytes` on the seeded generator,
  // which is also what `bc_crypto::ed25519_new_private_key_using` draws.
  const PACKED_32 = "7e061813569f540fb501367178373e8859424ceddfc39407bb066f2953f140dc";
  const PACKED_11 = "7e061813569f540f78373e"; // tail of 3 from xoshiro's HIGH half

  test("32 bytes: eight little-endian bytes per 64-bit step", () => {
    const rng = SeededRng.forTesting();
    const out = new Uint8Array(32);
    rng.fillBytesPacked(out);
    expect(bytesToHex(out)).toBe(PACKED_32);
    // The same bytes as four nextU64() draws laid out little-endian.
    const words = SeededRng.forTesting();
    const view = new DataView(new ArrayBuffer(32));
    for (let i = 0; i < 4; i++) view.setBigUint64(i * 8, words.nextU64(), true);
    expect(bytesToHex(new Uint8Array(view.buffer))).toBe(PACKED_32);
  });

  test("a 1-4 byte tail comes from the high half of one more step", () => {
    const rng = SeededRng.forTesting();
    const out = new Uint8Array(11);
    rng.fillBytesPacked(out);
    expect(bytesToHex(out)).toBe(PACKED_11);
    const two = SeededRng.forTesting();
    two.nextU64();
    const second = two.nextU64();
    expect(bytesToHex(out.subarray(8))).toBe(
      bytesToHex(Uint8Array.from([0, 1, 2], (k) => Number((second >> BigInt(32 + 8 * k)) & 0xffn))),
    );
  });

  test("a 5-7 byte tail comes from a whole extra step, truncated", () => {
    const rng = SeededRng.forTesting();
    const out = new Uint8Array(13);
    rng.fillBytesPacked(out);
    expect(bytesToHex(out)).toBe(PACKED_32.slice(0, 26));
  });

  test("is a different stream from fillBytes (one draw per byte), and consumes state", () => {
    const a = SeededRng.forTesting();
    const b = SeededRng.forTesting();
    const pa = new Uint8Array(16);
    const pb = new Uint8Array(16);
    a.fillBytesPacked(pa);
    b.fillBytes(pb);
    expect(bytesToHex(pa)).not.toBe(bytesToHex(pb));
    expect(bytesToHex(pb)).toBe("7eb559bbbf6cce2632cf9f194aeb5094");
    // Two steps consumed by 16 packed bytes.
    const c = SeededRng.forTesting();
    c.nextU64();
    c.nextU64();
    expect(a.nextU64()).toBe(c.nextU64());
  });

  test("an empty buffer draws nothing", () => {
    const rng = SeededRng.forTesting();
    rng.fillBytesPacked(new Uint8Array(0));
    expect(rng.nextU64()).toBe(SeededRng.forTesting().nextU64());
  });
});

describe("usize samplers (the reference's usize instantiation)", () => {
  test("closed range 8..=32 draws as bc-rand's rng_next_in_closed_range::<usize>", () => {
    // bc-rand 0.5.0, TEST_SEED: [9, 21, 8, 29, 9, 28]; the u32 sampler gives
    // [9, 19, 31, 12, 12, 24] for the same seed — a different draw.
    const rng = SeededRng.forTesting();
    expect(Array.from({ length: 6 }, () => nextInClosedRangeUsize(rng, 8, 32))).toEqual([
      9, 21, 8, 29, 9, 28,
    ]);
    const u32 = SeededRng.forTesting();
    expect(Array.from({ length: 6 }, () => nextInClosedRangeI32(u32, 8, 32))).toEqual([
      9, 19, 31, 12, 12, 24,
    ]);
  });
  test("equals the u64 samplers for the same arguments", () => {
    for (const [s, e] of [
      [0, 1],
      [8, 32],
      [100, 4000],
      [0, 9007199254740991],
    ] as [number, number][]) {
      const a = SeededRng.forTesting();
      const b = SeededRng.forTesting();
      expect(nextInRangeUsize(a, s, e)).toBe(Number(nextInRangeU64(b, BigInt(s), BigInt(e))));
      expect(nextInClosedRangeUsize(a, s, e)).toBe(
        Number(nextInClosedRangeU64(b, BigInt(s), BigInt(e))),
      );
      expect(nextWithUpperBoundUsize(a, e)).toBe(Number(nextWithUpperBoundU64(b, BigInt(e))));
    }
  });
  test("arguments outside [0, 2^53 - 1] or non-integers are RangeErrors", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextWithUpperBoundUsize(rng, 0)).toThrow(RangeError);
    expect(() => nextWithUpperBoundUsize(rng, 9007199254740992)).toThrow(
      "upperBound must be an integer in [1, 9007199254740991], got 9007199254740992",
    );
    expect(() => nextInRangeUsize(rng, -1, 5)).toThrow(RangeError);
    expect(() => nextInRangeUsize(rng, 5, 5)).toThrow("start must be less than end");
    expect(() => nextInClosedRangeUsize(rng, 1.5, 5)).toThrow("got 1.5");
    expect(() => nextInClosedRangeUsize(rng, 6, 5)).toThrow(RangeError);
  });
});

describe("signed range lengths (the reference's checked arithmetic)", () => {
  test("a length above the width's MAX is a RangeError for every signed width", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextInClosedRangeI8(rng, -128, 127)).toThrow(
      "range length must be an integer in [0, 127], got 255",
    );
    expect(() => nextInRangeI8(rng, -1, 127)).toThrow("got 128");
    expect(() => nextInClosedRangeI16(rng, -32768, 32767)).toThrow(RangeError);
    expect(() => nextInRangeI32(rng, -128, 2147483647)).toThrow(RangeError);
    expect(() => nextInClosedRangeI64(rng, -7n, 9223372036854775807n)).toThrow(
      "range length must be an integer in [0, 9223372036854775807], got 9223372036854775814",
    );
    expect(() => nextInRangeI64(rng, -9223372036854775808n, 0n)).toThrow(RangeError);
    // Nothing was drawn.
    expect(rng.nextU64()).toBe(SeededRng.forTesting().nextU64());
  });
  test("a length of exactly the width's MAX samples the whole range", () => {
    const rng = SeededRng.forTesting();
    const v = nextInClosedRangeI8(rng, -1, 126);
    expect(v >= -1 && v <= 126).toBe(true);
    const w = nextInRangeI8(rng, -127, 0);
    expect(w >= -127 && w < 0).toBe(true);
  });
});
