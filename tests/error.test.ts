/**
 * RandError: every code reachable from the public surface, the identity
 * guard, `is()`, and the `details` payloads.
 */
import { RandError, SeededRng, randomBytes, type RandErrorCode } from "../src/index";
import * as samplers from "../src/samplers";

const caught = (f: () => unknown): RandError => {
  try {
    f();
  } catch (e) {
    if (RandError.isRandError(e)) return e;
    throw new Error(`expected a RandError, got ${String(e)}`, { cause: e });
  }
  throw new Error("expected a throw");
};

describe("RandError", () => {
  it("has name, code, details and is(), and comes from the static factories", () => {
    const e = RandError.valueDoesNotFit();
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(RandError);
    expect(e.name).toBe("RandError");
    expect(e.code).toBe("ValueDoesNotFit");
    expect(e.details).toEqual({ code: "ValueDoesNotFit" });
    expect(e.is("ValueDoesNotFit")).toBe(true);
    expect(e.is("EmptyRange")).toBe(false);
    expect(e.message).toBe("random value does not fit the target width");
  });

  it("isRandError accepts a structural copy from another package instance and rejects the rest", () => {
    const copy = Object.assign(new Error("x"), { name: "RandError", code: "EmptyRange" });
    expect(RandError.isRandError(copy)).toBe(true);
    expect(RandError.isRandError(new RangeError("x"))).toBe(false);
    expect(RandError.isRandError({ name: "RandError", code: "EmptyRange" })).toBe(false);
    expect(RandError.isRandError(undefined)).toBe(false);
    expect(RandError.isRandError(null)).toBe(false);
  });

  it("every code is reachable from the public surface, with its message", () => {
    const rng = (): SeededRng => SeededRng.forTesting();
    const reached: Record<RandErrorCode, RandError> = {
      InvalidArgument: caught(() => samplers.nextWithUpperBoundU8(rng(), 256)),
      EmptyRange: caught(() => samplers.nextInRangeU8(rng(), 5, 5)),
      RangeTooLong: caught(() => samplers.nextInClosedRangeI8(rng(), -128, 127)),
      ValueDoesNotFit: caught(() => {
        // From the fixture seed the first raw draw is 1104683000648959614 > 255.
        samplers.nextInClosedRangeU8(rng(), 0, 255);
      }),
      InvalidSeed: caught(() => new SeededRng(new Uint8Array(31))),
      InvalidGenerator: RandError.invalidGenerator("fillBytes", 1),
      CryptoUnavailable: RandError.cryptoUnavailable(),
    };
    for (const [code, e] of Object.entries(reached)) {
      expect(e.code).toBe(code);
      expect(e.details.code).toBe(code);
    }
    expect(reached.InvalidArgument.message).toBe(
      "upperBound must be an integer in [1, 255], got 256",
    );
    expect(reached.EmptyRange.message).toBe("start must be less than end, got 5 and 5");
    expect(reached.RangeTooLong.message).toBe(
      "range length must be an integer in [0, 127], got 255",
    );
    expect(reached.ValueDoesNotFit.message).toBe("random value does not fit the target width");
    expect(reached.InvalidSeed.message).toBe(
      "seed byte length must be an integer in [32, 32], got 31",
    );
    expect(reached.InvalidGenerator.message).toBe("rng.fillBytes must be a function, got 1");
    expect(reached.CryptoUnavailable.message).toBe(
      "no Web Crypto API available in this environment",
    );
  });

  it("InvalidArgument carries the parameter, the value and the bounds", () => {
    const e = caught(() => samplers.nextInRangeU64(SeededRng.forTesting(), -1n, 5n));
    expect(e.details).toEqual({
      code: "InvalidArgument",
      parameter: "start",
      value: -1n,
      bounds: { min: 0n, max: 18446744073709551615n },
    });
    const size = caught(() => randomBytes(1.5));
    expect(size.details).toEqual({
      code: "InvalidArgument",
      parameter: "size",
      value: 1.5,
      bounds: { min: 0, max: Number.MAX_SAFE_INTEGER },
    });
  });

  it("EmptyRange and RangeTooLong carry the range and its form", () => {
    const rng = SeededRng.forTesting();
    expect(caught(() => samplers.nextInRangeI64(rng, 3n, 3n)).details).toEqual({
      code: "EmptyRange",
      start: 3n,
      end: 3n,
      closed: false,
    });
    const closed = caught(() => samplers.nextInClosedRangeU16(rng, 6, 5));
    expect(closed.details).toEqual({ code: "EmptyRange", start: 6, end: 5, closed: true });
    expect(closed.message).toBe("start must be less than or equal to end, got 6 and 5");
    expect(caught(() => samplers.nextInRangeI8(rng, -128, 127)).details).toEqual({
      code: "RangeTooLong",
      length: 255,
      max: 127,
      closed: false,
    });
    expect(caught(() => samplers.nextInRangeI8(rng, -128, 127)).message).toBe(
      "range length must be an integer in [1, 127], got 255",
    );
    expect(
      caught(() => samplers.nextInClosedRangeI64(rng, -7n, 9223372036854775807n)).details,
    ).toEqual({
      code: "RangeTooLong",
      length: 9223372036854775814n,
      max: 9223372036854775807n,
      closed: true,
    });
    // Nothing was drawn.
    expect(rng.nextU64()).toBe(SeededRng.forTesting().nextU64());
  });

  it("InvalidSeed names the word or the length", () => {
    const word = caught(() => new SeededRng([1n, 1n << 64n, 1n, 1n]));
    expect(word.details).toEqual({ code: "InvalidSeed", parameter: "seed[1]", value: 1n << 64n });
    expect(word.message).toBe(
      "seed[1] must be an integer in [0, 18446744073709551615], got 18446744073709551616",
    );
    expect(caught(() => new SeededRng(new Uint8Array(33))).details).toEqual({
      code: "InvalidSeed",
      parameter: "seed byte length",
      value: 33,
    });
  });

  it("the generator factories name the member and carry the value", () => {
    expect(RandError.invalidGenerator("nextU64", undefined).message).toBe(
      "rng.nextU64 must be a function, got undefined",
    );
    expect(RandError.invalidGenerator("nextU64Low32", 5).details).toEqual({
      code: "InvalidGenerator",
      method: "nextU64Low32",
      value: 5,
    });
    expect(RandError.invalidDraw("nextU64", 5).message).toBe(
      "nextU64() must return a bigint in [0, 18446744073709551615], got 5",
    );
    expect(RandError.invalidDraw("nextU64Low32", -1).message).toBe(
      "nextU64Low32() must return an integer in [0, 4294967295], got -1",
    );
    expect(RandError.invalidDraw("nextU32", 7n).details).toEqual({
      code: "InvalidGenerator",
      method: "nextU32",
      value: 7n,
    });
  });

  it("invalidDest describes the value by kind", () => {
    expect(RandError.invalidDest("dest", [0, 0]).message).toBe(
      "dest must be a Uint8Array, got Array(2)",
    );
    expect(RandError.invalidDest("dest", new Uint16Array(2)).message).toBe(
      "dest must be a Uint8Array, got Uint16Array",
    );
    expect(RandError.invalidDest("dest", new DataView(new ArrayBuffer(2))).message).toBe(
      "dest must be a Uint8Array, got DataView",
    );
    expect(RandError.invalidDest("dest", null).message).toBe("dest must be a Uint8Array, got null");
    expect(RandError.invalidDest("dest", "abc").message).toBe("dest must be a Uint8Array, got abc");
    expect(RandError.invalidDest("dest", () => 1).message).toBe(
      "dest must be a Uint8Array, got function",
    );
    expect(RandError.invalidDest("dest", Object.create(null)).message).toBe(
      "dest must be a Uint8Array, got object",
    );
    expect(RandError.invalidDest("dest", new Uint16Array(2)).details).toEqual({
      code: "InvalidArgument",
      parameter: "dest",
      value: new Uint16Array(2),
    });
  });
});
