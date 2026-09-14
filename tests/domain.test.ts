/**
 * The argument-domain helpers: one message shape, integers only, inclusive
 * bounds, wired into every sampler.
 */
import { expectInt, expectBigInt, WIDTH, U64_MAX, I64_MIN, I64_MAX } from "../src/domain";
import { RandError } from "../src/error";

describe("expectInt", () => {
  it("returns an in-range integer unchanged", () => {
    expect(expectInt(0, 0, 255, "upperBound")).toBe(0);
    expect(expectInt(255, 0, 255, "upperBound")).toBe(255);
    expect(expectInt(-128, WIDTH.i8.min, WIDTH.i8.max, "start")).toBe(-128);
  });
  it("throws RandError InvalidArgument naming the argument for out-of-range values", () => {
    expect(() => expectInt(256, 0, 255, "upperBound")).toThrow(RandError);
    expect(() => expectInt(256, 0, 255, "upperBound")).toThrow(
      "upperBound must be an integer in [0, 255], got 256",
    );
    expect(() => expectInt(-1, 0, 255, "upperBound")).toThrow("got -1");
  });
  it("throws for non-integers, NaN and infinities", () => {
    expect(() => expectInt(1.5, 0, 255, "upperBound")).toThrow("got 1.5");
    expect(() => expectInt(Number.NaN, 0, 255, "upperBound")).toThrow("got NaN");
    expect(() => expectInt(Number.POSITIVE_INFINITY, 0, 255, "upperBound")).toThrow("got Infinity");
  });
});

describe("expectBigInt", () => {
  it("returns an in-range bigint unchanged", () => {
    expect(expectBigInt(0n, 0n, U64_MAX, "upperBound")).toBe(0n);
    expect(expectBigInt(U64_MAX, 0n, U64_MAX, "upperBound")).toBe(U64_MAX);
    expect(expectBigInt(I64_MIN, I64_MIN, I64_MAX, "start")).toBe(I64_MIN);
  });
  it("throws RandError InvalidArgument naming the argument for out-of-range values", () => {
    expect(() => expectBigInt(U64_MAX + 1n, 0n, U64_MAX, "upperBound")).toThrow(RandError);
    expect(() => expectBigInt(-1n, 0n, U64_MAX, "upperBound")).toThrow(
      `upperBound must be an integer in [0, ${U64_MAX}], got -1`,
    );
  });
  it("throws for a number where a bigint is required", () => {
    expect(() => expectBigInt(5 as unknown as bigint, 0n, U64_MAX, "upperBound")).toThrow(
      RandError,
    );
  });
});

describe("WIDTH", () => {
  it("lists the inclusive bounds of every number-typed width", () => {
    expect(WIDTH.u8).toEqual({ min: 0, max: 255 });
    expect(WIDTH.u16).toEqual({ min: 0, max: 65535 });
    expect(WIDTH.u32).toEqual({ min: 0, max: 4294967295 });
    expect(WIDTH.i8).toEqual({ min: -128, max: 127 });
    expect(WIDTH.i16).toEqual({ min: -32768, max: 32767 });
    expect(WIDTH.i32).toEqual({ min: -2147483648, max: 2147483647 });
    expect(WIDTH.usize).toEqual({ min: 0, max: 9007199254740991 });
    expect(I64_MAX - I64_MIN).toBe(U64_MAX);
  });
});
