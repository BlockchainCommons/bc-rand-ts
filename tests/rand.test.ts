import { Xoshiro256StarStar } from "../src/xoshiro";
import {
  SeededRng,
  SecureRng,
  secureRng,
  secureRandomBytes,
  randomBytes,
  randomBool,
  testRandomBytes,
} from "../src/index";
import {
  nextWithUpperBoundU8,
  nextWithUpperBoundU16,
  nextWithUpperBoundU32,
  nextWithUpperBoundU64,
  nextInRangeU64,
  nextInRangeI32,
  nextInClosedRangeU64,
  nextInClosedRangeI32,
  wideMulU8,
  wideMulU16,
  wideMulU32,
  wideMulU64,
  toMagnitude,
  toMagnitude64,
  fromMagnitude,
  fromMagnitude64,
} from "../src/samplers";

// Standard test seed used across Blockchain Commons implementations.
// Mirrors the private TEST_SEED in `bc-rand-rust/src/seeded_random.rs`.
const TEST_SEED: [bigint, bigint, bigint, bigint] = [
  17295166580085024720n,
  422929670265678780n,
  5577237070365765850n,
  7953171132032326923n,
];

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

  test("test_fake_random_data", () => {
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

  test("test_fake_numbers (from random_number_generator.rs)", () => {
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
  test("test_random_data", () => {
    const data1 = secureRandomBytes(32);
    const data2 = secureRandomBytes(32);
    const data3 = secureRandomBytes(32);

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

  test("threadRng returns a working SecureRng", () => {
    const rng = secureRng();
    expect(rng).toBeInstanceOf(SecureRng);
    expect(randomBytes(16, { rng: rng }).length).toBe(16);
  });
});

describe("rng utility functions", () => {
  test("nextInClosedRange", () => {
    const rng = SeededRng.forTesting();
    const value = nextInClosedRangeU64(rng, 0n, 100n);
    expect(value).toBeGreaterThanOrEqual(0n);
    expect(value).toBeLessThanOrEqual(100n);
  });

  test("nextInRange", () => {
    const rng = SeededRng.forTesting();
    const value = nextInRangeU64(rng, 0n, 100n);
    expect(value).toBeGreaterThanOrEqual(0n);
    expect(value).toBeLessThan(100n);
  });

  test("nextWithUpperBound throws on zero", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextWithUpperBoundU64(rng, 0n)).toThrow("upperBound must be non-zero");
  });

  test("nextWithUpperBoundU8/U16/U32/U64 throw on zero", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextWithUpperBoundU8(rng, 0)).toThrow("upperBound must be non-zero");
    expect(() => nextWithUpperBoundU16(rng, 0)).toThrow("upperBound must be non-zero");
    expect(() => nextWithUpperBoundU32(rng, 0)).toThrow("upperBound must be non-zero");
    expect(() => nextWithUpperBoundU64(rng, 0n)).toThrow("upperBound must be non-zero");
  });

  test("nextInRange throws on invalid range", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextInRangeU64(rng, 100n, 0n)).toThrow("start must be less than end");
  });

  test("nextInClosedRange throws on invalid range", () => {
    const rng = SeededRng.forTesting();
    expect(() => nextInClosedRangeU64(rng, 100n, 0n)).toThrow(
      "start must be less than or equal to end",
    );
  });

  test("rngRandomBool produces both values across a deterministic seed", () => {
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

  test("rngRandomU32 returns a valid u32", () => {
    const rng = SeededRng.forTesting();
    for (let i = 0; i < 50; i++) {
      const v = rng.nextU32();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  test("rngRandomArray reproduces fakeRandomData for the same seed", () => {
    const rng1 = SeededRng.forTesting();
    const rng2 = SeededRng.forTesting();
    expect(randomBytes(50, { rng: rng1 })).toEqual(randomBytes(50, { rng: rng2 }));
  });

  test("rngFillRandomData fills exactly the buffer", () => {
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

describe("magnitude conversion (MIN-value edges)", () => {
  test("toMagnitude for i8::MIN, i16::MIN, i32::MIN", () => {
    // i8::MIN = -128 → wrapping_abs as u8 = 128
    expect(toMagnitude(-128, 8)).toBe(128);
    // i16::MIN = -32768 → wrapping_abs as u16 = 32768
    expect(toMagnitude(-32768, 16)).toBe(32768);
    // i32::MIN = -2147483648 → wrapping_abs as u32 = 2147483648
    expect(toMagnitude(-2147483648, 32)).toBe(2147483648);
  });

  test("toMagnitude64 for i64::MIN", () => {
    const i64Min = -(1n << 63n);
    // wrapping_abs(i64::MIN) as u64 = 0x8000000000000000
    expect(toMagnitude64(i64Min)).toBe(0x8000000000000000n);
  });

  test("fromMagnitude reinterprets as signed", () => {
    expect(fromMagnitude(128, 8)).toBe(-128);
    expect(fromMagnitude(32768, 16)).toBe(-32768);
    expect(fromMagnitude(2147483648, 32)).toBe(-2147483648);
  });

  test("fromMagnitude64 reinterprets sign bit", () => {
    expect(fromMagnitude64(0x8000000000000000n)).toBe(-(1n << 63n));
    expect(fromMagnitude64(0xffffffffffffffffn)).toBe(-1n);
    expect(fromMagnitude64(0n)).toBe(0n);
    expect(fromMagnitude64(0x7fffffffffffffffn)).toBe(0x7fffffffffffffffn);
  });

  test("toMagnitude / fromMagnitude round-trip on MIN edges", () => {
    expect(fromMagnitude(toMagnitude(-128, 8), 8)).toBe(-128);
    expect(fromMagnitude(toMagnitude(-32768, 16), 16)).toBe(-32768);
    expect(fromMagnitude(toMagnitude(-2147483648, 32), 32)).toBe(-2147483648);
    const i64Min = -(1n << 63n);
    expect(fromMagnitude64(toMagnitude64(i64Min))).toBe(i64Min);
  });
});

describe("Xoshiro256StarStar state bytes", () => {
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

  it("nextBytes takes one low byte per step; fillBytes eight little-endian bytes per step", () => {
    const a = new Xoshiro256StarStar([1n, 2n, 3n, 4n]);
    const b = new Xoshiro256StarStar([1n, 2n, 3n, 4n]);
    const expected = Uint8Array.from({ length: 5 }, () => Number(b.nextU64() & 0xffn));
    expect(a.nextBytes(5)).toEqual(expected);
    const c = new Xoshiro256StarStar([1n, 2n, 3n, 4n]);
    const d = new Xoshiro256StarStar([1n, 2n, 3n, 4n]);
    const dest = new Uint8Array(11);
    c.fillBytes(dest);
    const v0 = d.nextU64();
    const v1 = d.nextU64();
    const manual = new Uint8Array(11);
    for (let j = 0; j < 8; j++) manual[j] = Number((v0 >> BigInt(j * 8)) & 0xffn);
    for (let j = 0; j < 3; j++) manual[8 + j] = Number((v1 >> BigInt(j * 8)) & 0xffn);
    expect(dest).toEqual(manual);
  });
});
