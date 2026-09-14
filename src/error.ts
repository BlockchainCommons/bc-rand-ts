/**
 * The single error type thrown by this package.
 *
 * The reference has no error type: its failures are `assert!`, `unwrap()` and
 * overflow panics. The port throws {@link RandError} at the same points with
 * the same generator state, and a machine-readable `code`.
 *
 * @module error
 */

/** Machine-readable discriminant for a {@link RandError}. */
export type RandErrorCode =
  /** An argument is not an integer inside its width, or `dest` is not a `Uint8Array`. */
  | "InvalidArgument"
  /** `start >= end` (half-open) or `start > end` (closed): the reference's `assert!`. */
  | "EmptyRange"
  /** A signed range longer than its width's `MAX`: the reference's overflow of `end - start`. */
  | "RangeTooLong"
  /** The full-width early return drew a value the narrower width cannot hold: the reference's `unwrap()`. */
  | "ValueDoesNotFit"
  /** A seed or state that is not four `u64` words or exactly 32 bytes. */
  | "InvalidSeed"
  /** A generator that breaks the {@link RandomNumberGenerator} contract. */
  | "InvalidGenerator"
  /** No Web Crypto API in this environment: the reference's `"Failed to seed RNG"`. */
  | "CryptoUnavailable";

/** The argument an `InvalidArgument` error names. */
export type RandParameter = "upperBound" | "start" | "end" | "size" | "dest";

/** The seed or state an `InvalidSeed` error names. */
export type RandSeedParameter =
  "seed" | "seed byte length" | "state byte length" | `seed[${number}]`;

/** The {@link RandomNumberGenerator} member an `InvalidGenerator` error names. */
export type RandGeneratorMethod =
  "fillBytes" | "fillBytesPacked" | "nextU32" | "nextU64" | "nextU64Low32";

/** An integer domain, inclusive at both ends. */
export interface RandBounds {
  /** The smallest accepted value. */
  readonly min: number | bigint;
  /** The largest accepted value. */
  readonly max: number | bigint;
}

/**
 * The structured payload of a {@link RandError}, discriminated by `code`.
 * `e.details.code === "InvalidGenerator"` narrows to `{ method, value }`, and
 * so on.
 */
export type RandErrorDetails =
  | {
      /** The discriminant. */
      readonly code: "InvalidArgument";
      /** The argument. */
      readonly parameter: RandParameter;
      /** The value received. */
      readonly value: unknown;
      /** The accepted integer domain; absent when the argument must be a `Uint8Array`. */
      readonly bounds?: RandBounds;
    }
  | {
      /** The discriminant. */
      readonly code: "EmptyRange";
      /** The range start. */
      readonly start: number | bigint;
      /** The range end. */
      readonly end: number | bigint;
      /** `true` for `[start, end]`, `false` for `[start, end)`. */
      readonly closed: boolean;
    }
  | {
      /** The discriminant. */
      readonly code: "RangeTooLong";
      /** `end - start`. */
      readonly length: number | bigint;
      /** The width's `MAX`. */
      readonly max: number | bigint;
      /** `true` for `[start, end]`, `false` for `[start, end)`. */
      readonly closed: boolean;
    }
  | {
      /** The discriminant. */
      readonly code: "ValueDoesNotFit";
    }
  | {
      /** The discriminant. */
      readonly code: "InvalidSeed";
      /** The seed, a word of it, or a byte length. */
      readonly parameter: RandSeedParameter;
      /** The value received. */
      readonly value: unknown;
    }
  | {
      /** The discriminant. */
      readonly code: "InvalidGenerator";
      /** The generator member that was called. */
      readonly method: RandGeneratorMethod;
      /** The bad draw, the non-callable member, or the `undefined`/`null` generator. */
      readonly value: unknown;
    }
  | {
      /** The discriminant. */
      readonly code: "CryptoUnavailable";
    };

/**
 * A value for a `got …` clause: primitives as `String(value)`, arrays as
 * `Array(n)`, other objects by constructor name.
 */
function show(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "function") return "function";
  if (typeof value === "object" && value !== null) {
    const ctor = (value as { constructor?: { name?: unknown } }).constructor;
    return typeof ctor?.name === "string" && ctor.name !== "" ? ctor.name : "object";
  }
  return String(value);
}

/**
 * Thrown for an argument outside its width, an empty or over-long range, a
 * full-width draw that does not fit, a malformed seed or state, a generator
 * that breaks the contract, and a missing Web Crypto API. Branch on `code`;
 * the messages are the port's own (the reference panics with compiler and
 * `core` strings).
 *
 * Instances come from the static factories only.
 *
 * @example
 * ```ts
 * try {
 *   nextInClosedRangeI8(rng, -128, 127);
 * } catch (e) {
 *   if (RandError.isRandError(e) && e.is("RangeTooLong")) {
 *     // the length must fit i8, as in the reference
 *   }
 * }
 * ```
 */
export class RandError extends Error {
  /** Always `"RandError"`; the cross-copy identity {@link RandError.isRandError} checks. */
  override readonly name = "RandError";
  /** The discriminant; equals `details.code`. */
  readonly code: RandErrorCode;
  /** The structured payload, discriminated by `code`. */
  readonly details: RandErrorDetails;

  private constructor(message: string, details: RandErrorDetails) {
    super(message);
    this.code = details.code;
    this.details = details;
  }

  /** Type guard for a `RandError`, including one from another copy of this package. */
  static isRandError(value: unknown): value is RandError {
    return value instanceof Error && value.name === "RandError" && "code" in value;
  }

  /** `true` when `code` is this error's code. */
  is(code: RandErrorCode): boolean {
    return this.code === code;
  }

  /** `parameter` is not an integer in `[bounds.min, bounds.max]`; `value` is what was received. */
  static invalidArgument(parameter: RandParameter, value: unknown, bounds: RandBounds): RandError {
    return new RandError(
      `${parameter} must be an integer in [${bounds.min}, ${bounds.max}], got ${String(value)}`,
      { code: "InvalidArgument", parameter, value, bounds },
    );
  }

  /** `parameter` is not a `Uint8Array`; `value` is what was received. */
  static invalidDest(parameter: RandParameter, value: unknown): RandError {
    return new RandError(`${parameter} must be a Uint8Array, got ${show(value)}`, {
      code: "InvalidArgument",
      parameter,
      value,
    });
  }

  /** `start >= end` for a half-open range, or `start > end` for a closed one. */
  static emptyRange(start: number | bigint, end: number | bigint, closed: boolean): RandError {
    return new RandError(
      closed
        ? `start must be less than or equal to end, got ${start} and ${end}`
        : `start must be less than end, got ${start} and ${end}`,
      { code: "EmptyRange", start, end, closed },
    );
  }

  /**
   * A signed range's `end - start` exceeds the width's `MAX` (`[0, MAX]` for a
   * closed range, `[1, MAX]` for a half-open one), where the reference's
   * arithmetic overflows.
   */
  static rangeTooLong(length: number | bigint, max: number | bigint, closed: boolean): RandError {
    return new RandError(
      `range length must be an integer in [${closed ? 0 : 1}, ${max}], got ${length}`,
      { code: "RangeTooLong", length, max, closed },
    );
  }

  /** The full-width early return's raw 64-bit draw does not fit the target width. */
  static valueDoesNotFit(): RandError {
    return new RandError("random value does not fit the target width", {
      code: "ValueDoesNotFit",
    });
  }

  /** `parameter` is not `expected` (a seed shape, a seed word, or a byte length). */
  static invalidSeed(parameter: RandSeedParameter, expected: string, value: unknown): RandError {
    return new RandError(`${parameter} must be ${expected}, got ${show(value)}`, {
      code: "InvalidSeed",
      parameter,
      value,
    });
  }

  /**
   * The generator has no callable `method`; `value` is the member found, or
   * the `undefined`/`null` generator itself. Public so that a consumer calling
   * a member this package does not (`fillBytesPacked`) reports the same error.
   */
  static invalidGenerator(method: RandGeneratorMethod, value: unknown): RandError {
    return new RandError(`rng.${method} must be a function, got ${show(value)}`, {
      code: "InvalidGenerator",
      method,
      value,
    });
  }

  /**
   * `method` returned `value`, which is outside its contract: `nextU64` must
   * return a `bigint` in `[0, 2^64 - 1]`; `nextU32` and `nextU64Low32` an
   * integer in `[0, 2^32 - 1]`.
   */
  static invalidDraw(method: "nextU32" | "nextU64" | "nextU64Low32", value: unknown): RandError {
    const expected =
      method === "nextU64"
        ? "a bigint in [0, 18446744073709551615]"
        : "an integer in [0, 4294967295]";
    return new RandError(`${method}() must return ${expected}, got ${String(value)}`, {
      code: "InvalidGenerator",
      method,
      value,
    });
  }

  /** No Web Crypto API (`globalThis.crypto`) in this environment. */
  static cryptoUnavailable(): RandError {
    return new RandError("no Web Crypto API available in this environment", {
      code: "CryptoUnavailable",
    });
  }
}
