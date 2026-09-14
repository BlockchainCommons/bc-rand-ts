import { n as RngOptions, t as RandomNumberGenerator } from "./rng-DFfjhm2A.mjs";
//#region src/error.d.ts
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
type RandErrorCode = "InvalidArgument" | "EmptyRange" | "RangeTooLong" | "ValueDoesNotFit" | "InvalidSeed" | "InvalidGenerator" | "CryptoUnavailable";
/** The argument an `InvalidArgument` error names. */
type RandParameter = "upperBound" | "start" | "end" | "size" | "dest";
/** The seed or state an `InvalidSeed` error names. */
type RandSeedParameter = "seed" | "seed byte length" | "state byte length" | `seed[${number}]`;
/** The {@link RandomNumberGenerator} member an `InvalidGenerator` error names. */
type RandGeneratorMethod = "fillBytes" | "fillBytesPacked" | "nextU32" | "nextU64" | "nextU64Low32";
/** An integer domain, inclusive at both ends. */
interface RandBounds {
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
type RandErrorDetails = {
  /** The discriminant. */
  readonly code: "InvalidArgument";
  /** The argument. */
  readonly parameter: RandParameter;
  /** The value received. */
  readonly value: unknown;
  /** The accepted integer domain; absent when the argument must be a `Uint8Array`. */
  readonly bounds?: RandBounds;
} | {
  /** The discriminant. */
  readonly code: "EmptyRange";
  /** The range start. */
  readonly start: number | bigint;
  /** The range end. */
  readonly end: number | bigint;
  /** `true` for `[start, end]`, `false` for `[start, end)`. */
  readonly closed: boolean;
} | {
  /** The discriminant. */
  readonly code: "RangeTooLong";
  /** `end - start`. */
  readonly length: number | bigint;
  /** The width's `MAX`. */
  readonly max: number | bigint;
  /** `true` for `[start, end]`, `false` for `[start, end)`. */
  readonly closed: boolean;
} | {
  /** The discriminant. */
  readonly code: "ValueDoesNotFit";
} | {
  /** The discriminant. */
  readonly code: "InvalidSeed";
  /** The seed, a word of it, or a byte length. */
  readonly parameter: RandSeedParameter;
  /** The value received. */
  readonly value: unknown;
} | {
  /** The discriminant. */
  readonly code: "InvalidGenerator";
  /** The generator member that was called. */
  readonly method: RandGeneratorMethod;
  /** The bad draw, the non-callable member, or the `undefined`/`null` generator. */
  readonly value: unknown;
} | {
  /** The discriminant. */
  readonly code: "CryptoUnavailable";
};
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
export declare class RandError extends Error {
  /** Always `"RandError"`; the cross-copy identity {@link RandError.isRandError} checks. */
  override readonly name = "RandError";
  /** The discriminant; equals `details.code`. */
  readonly code: RandErrorCode;
  /** The structured payload, discriminated by `code`. */
  readonly details: RandErrorDetails;
  private constructor();
  /** Type guard for a `RandError`, including one from another copy of this package. */
  static isRandError(value: unknown): value is RandError;
  /** `true` when `code` is this error's code. */
  is(code: RandErrorCode): boolean;
  /** `parameter` is not an integer in `[bounds.min, bounds.max]`; `value` is what was received. */
  static invalidArgument(parameter: RandParameter, value: unknown, bounds: RandBounds): RandError;
  /** `parameter` is not a `Uint8Array`; `value` is what was received. */
  static invalidDest(parameter: RandParameter, value: unknown): RandError;
  /** `start >= end` for a half-open range, or `start > end` for a closed one. */
  static emptyRange(start: number | bigint, end: number | bigint, closed: boolean): RandError;
  /**
   * A signed range's `end - start` exceeds the width's `MAX` (`[0, MAX]` for a
   * closed range, `[1, MAX]` for a half-open one), where the reference's
   * arithmetic overflows.
   */
  static rangeTooLong(length: number | bigint, max: number | bigint, closed: boolean): RandError;
  /** The full-width early return's raw 64-bit draw does not fit the target width. */
  static valueDoesNotFit(): RandError;
  /** `parameter` is not `expected` (a seed shape, a seed word, or a byte length). */
  static invalidSeed(parameter: RandSeedParameter, expected: string, value: unknown): RandError;
  /**
   * The generator has no callable `method`; `value` is the member found, or
   * the `undefined`/`null` generator itself. Public so that a consumer calling
   * a member this package does not (`fillBytesPacked`) reports the same error.
   */
  static invalidGenerator(method: RandGeneratorMethod, value: unknown): RandError;
  /**
   * `method` returned `value`, which is outside its contract: `nextU64` must
   * return a `bigint` in `[0, 2^64 - 1]`; `nextU32` and `nextU64Low32` an
   * integer in `[0, 2^32 - 1]`.
   */
  static invalidDraw(method: "nextU32" | "nextU64" | "nextU64Low32", value: unknown): RandError;
  /** No Web Crypto API (`globalThis.crypto`) in this environment. */
  static cryptoUnavailable(): RandError;
}
//#endregion
//#region src/secure-rng.d.ts
/**
 * A generator backed by Web Crypto (`crypto.getRandomValues`), available in
 * every modern browser and in Node >= 15. It holds no state: every instance
 * draws from the same platform source. `fillBytes` accepts any length; the
 * platform's 65,536-byte per-call quota is handled by filling in chunks.
 *
 * @throws {RandError} `CryptoUnavailable` from any draw when the environment has no Web Crypto API.
 */
export declare class SecureRng implements RandomNumberGenerator {
  /** Debug label: `Object.prototype.toString` reports the class name. */
  get [Symbol.toStringTag](): string;
  /** The low 32 bits of an 8-byte draw. */
  nextU32(): number;
  /** An 8-byte draw as a little-endian `u64`. */
  nextU64(): bigint;
  /** The samplers' fast path: one 8-byte draw, low 32 bits, no `bigint`. */
  nextU64Low32(): number;
  /**
   * Fill `dest` with secure random bytes. Any length: buffers above 65,536
   * bytes are filled in chunks of at most that size (`subarray` views, no
   * copies); shorter ones take one `getRandomValues` call.
   * @throws {RandError} `InvalidArgument` unless `dest` is a `Uint8Array`.
   */
  fillBytes(dest: Uint8Array): void;
}
/** A fresh secure generator (the reference's `thread_rng()`). */
export declare function secureRng(): SecureRng;
//#endregion
//#region src/seeded-rng.d.ts
/** A 256-bit seed as four 64-bit words. */
type Seed = readonly [bigint, bigint, bigint, bigint];
/**
 * The fixed seed behind {@link SeededRng.forTesting}. Shared with the Rust
 * and Swift reference implementations so cross-platform fixtures agree.
 */
export declare const TEST_SEED: Seed;
/**
 * A deterministic generator (xoshiro256**), identical to `rand_xoshiro`'s
 * `Xoshiro256StarStar` for the same seed.
 *
 * NOT cryptographically secure. For tests and reproducible fixtures only.
 *
 * `fillBytes` draws one 64-bit word per byte and keeps its low byte — the
 * reference's `fill_random_data`, which every seeded fixture downstream
 * depends on. {@link SeededRng.fillBytesPacked} is the other stream,
 * `rand_core`'s packed `fill_bytes`.
 */
export declare class SeededRng implements RandomNumberGenerator {
  private readonly core;
  /** Debug label: `Object.prototype.toString` reports the class name. */
  get [Symbol.toStringTag](): string;
  /**
   * @param seed - four 64-bit words, or 32 little-endian bytes (the byte
   *   layout `rand_xoshiro`'s `from_seed` reads, and the one {@link SeededRng.state}
   *   returns). An all-zero seed is replaced by the SplitMix64 expansion of
   *   zero, as the reference does.
   * @throws {RandError} `InvalidSeed` unless `seed` is an array of exactly
   *   four `bigint`s in `[0, 2^64 - 1]` (holes and other element types are
   *   rejected) or a `Uint8Array` of exactly 32 bytes. Other typed arrays,
   *   `ArrayBuffer`s and `DataView`s are rejected.
   */
  constructor(seed: Seed | Uint8Array);
  /** A generator seeded with {@link TEST_SEED}. */
  static forTesting(): SeededRng;
  /**
   * The generator whose state is exactly `state`: the 32 little-endian bytes
   * {@link SeededRng.state} returns, restored with **no** all-zero
   * substitution. This is provenance-mark's `Xoshiro256StarStar::from_data`;
   * `bc-rand` itself has no raw-state constructor. An all-zero state is
   * xoshiro's fixed point and draws zeros forever, as it does there; the
   * constructor, which is `from_seed`, substitutes it instead.
   *
   * @throws {RandError} `InvalidSeed` unless `state` is a `Uint8Array` of exactly 32 bytes.
   */
  static fromState(state: Uint8Array): SeededRng;
  /**
   * The 256-bit state as 32 little-endian bytes (a copy);
   * {@link SeededRng.fromState} resumes it exactly. (`new SeededRng(state)`
   * also resumes every state a generator can reach, but substitutes an
   * all-zero one.)
   */
  get state(): Uint8Array<ArrayBuffer>;
  /** An independent generator at the same state. */
  clone(): SeededRng;
  /** The next 64-bit output of xoshiro256**. */
  nextU64(): bigint;
  /** The low 32 bits of a 64-bit draw (the reference wrapper's `next_u32`). */
  nextU32(): number;
  /** The samplers' fast path: one step, low 32 bits, no `bigint`. */
  nextU64Low32(): number;
  /**
   * One 64-bit draw per byte, keeping the low byte (the reference's `fill_random_data`).
   * @throws {RandError} `InvalidArgument` unless `dest` is a `Uint8Array`.
   */
  fillBytes(dest: Uint8Array): void;
  /**
   * The reference's `RngCore::fill_bytes` stream (`rand_core`'s
   * `fill_bytes_via_next` over xoshiro256**): eight little-endian bytes per
   * 64-bit step; a tail of five to seven bytes from one more step; a tail of
   * one to four bytes from xoshiro's own `next_u32`, the *high* half of a
   * step. This is what reference code reaching the generator through
   * `rand_core` generics draws (e.g. `bc-crypto`'s Ed25519 key generation);
   * {@link SeededRng.fillBytes} is the other stream, `fill_random_data`.
   * @throws {RandError} `InvalidArgument` unless `dest` is a `Uint8Array`.
   */
  fillBytesPacked(dest: Uint8Array): void;
}
//#endregion
//#region src/bytes.d.ts
/**
 * `size` random bytes from `options.rng` (default: the secure generator).
 *
 * @throws {RandError} `InvalidArgument` when `size` is not a non-negative safe
 *   integer; `InvalidGenerator` when the generator has no callable `fillBytes`.
 */
export declare function randomBytes(size: number, options?: RngOptions): Uint8Array<ArrayBuffer>;
/**
 * Fill `dest` from `options.rng` (default: the secure generator).
 *
 * @throws {RandError} `InvalidArgument` unless `dest` is a `Uint8Array`;
 *   `InvalidGenerator` when the generator has no callable `fillBytes`.
 */
export declare function fillRandomBytes(dest: Uint8Array, options?: RngOptions): void;
/**
 * A random boolean: whether the next 32-bit draw is even (the reference's
 * `rng_random_bool`).
 *
 * @throws {RandError} `InvalidGenerator` when the generator has no callable
 *   `nextU32`, or it returns something other than an integer in `[0, 2^32 - 1]`.
 */
export declare function randomBool(options?: RngOptions): boolean;
/** `size` bytes from a fresh {@link SeededRng.forTesting} generator (the reference's `fake_random_data`). */
export declare function testRandomBytes(size: number): Uint8Array<ArrayBuffer>;
//#endregion
export type { RandBounds, RandErrorCode, RandErrorDetails, RandGeneratorMethod, RandParameter, RandSeedParameter, RandomNumberGenerator, RngOptions, Seed };
//# sourceMappingURL=index.d.mts.map