import { t as RandomNumberGenerator } from "./rng-DFfjhm2A.mjs";
//#region src/samplers.d.ts
/**
 * Random `u8` in `[0, upperBound)`.
 * @throws {RandError} unless `upperBound` is an integer in `[1, 255]`.
 */
export declare function nextWithUpperBoundU8(rng: RandomNumberGenerator, upperBound: number): number;
/**
 * Random `u16` in `[0, upperBound)`.
 * @throws {RandError} unless `upperBound` is an integer in `[1, 65535]`.
 */
export declare function nextWithUpperBoundU16(rng: RandomNumberGenerator, upperBound: number): number;
/**
 * Random `u32` in `[0, upperBound)`.
 * @throws {RandError} unless `upperBound` is an integer in `[1, 4294967295]`.
 */
export declare function nextWithUpperBoundU32(rng: RandomNumberGenerator, upperBound: number): number;
/**
 * Random `u64` in `[0, upperBound)`.
 * @throws {RandError} unless `upperBound` is a `bigint` in `[1, 2^64 - 1]`.
 */
export declare function nextWithUpperBoundU64(rng: RandomNumberGenerator, upperBound: bigint): bigint;
/**
 * Uniform in `[0, upperBound)` for the reference's `usize` instantiation:
 * a `number` in `[1, 2^53 - 1]`, drawn as the 64-bit sampler draws (one
 * full `nextU64()` per attempt, 64×64 rejection arithmetic) — *not* as the
 * 32-bit samplers do, which consume the generator differently. For sizes
 * above `2^53 - 1` use {@link nextWithUpperBoundU64}.
 * @throws {RandError} unless `upperBound` is an integer in `[1, 2^53 - 1]`.
 */
export declare function nextWithUpperBoundUsize(rng: RandomNumberGenerator, upperBound: number): number;
/**
 * Random `u8` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[0, 255]` and `start < end`.
 */
export declare function nextInRangeU8(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u16` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[0, 65535]` and `start < end`.
 */
export declare function nextInRangeU16(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u32` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[0, 4294967295]` and `start < end`.
 */
export declare function nextInRangeU32(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u64` in `[start, end)`.
 * @throws {RandError} unless both are `bigint`s in `[0, 2^64 - 1]` and `start < end`.
 */
export declare function nextInRangeU64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
/**
 * Uniform in `[start, end)` for the reference's `usize` instantiation
 * (`number`s in `[0, 2^53 - 1]`, 64-bit draw); see {@link nextWithUpperBoundUsize}.
 * @throws {RandError} unless `start < end` are integers in `[0, 2^53 - 1]`.
 */
export declare function nextInRangeUsize(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i8` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[-128, 127]` and `start < end`.
 */
export declare function nextInRangeI8(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i16` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[-32768, 32767]` and `start < end`.
 */
export declare function nextInRangeI16(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i32` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[-2147483648, 2147483647]` and `start < end`.
 */
export declare function nextInRangeI32(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i64` in `[start, end)`: `start + random` for a random below the
 * range length, drawn as the u64 sampler draws.
 * @throws {RandError} unless both are `bigint`s in `[-2^63, 2^63 - 1]`,
 * `start < end`, and `end - start` fits `i64` (the reference's arithmetic).
 */
export declare function nextInRangeI64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
/**
 * Random `u8` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[0, 255]` and `start <= end`.
 */
export declare function nextInClosedRangeU8(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u16` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[0, 65535]` and `start <= end`.
 */
export declare function nextInClosedRangeU16(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u32` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[0, 4294967295]` and `start <= end`.
 */
export declare function nextInClosedRangeU32(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u64` in `[start, end]`.
 * @throws {RandError} unless both are `bigint`s in `[0, 2^64 - 1]` and `start <= end`.
 */
export declare function nextInClosedRangeU64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
/**
 * Uniform in `[start, end]` for the reference's `usize` instantiation
 * (`number`s in `[0, 2^53 - 1]`, 64-bit draw); see {@link nextWithUpperBoundUsize}.
 * This is the sampler a `RangeInclusive<usize>` in the reference maps to
 * (salt lengths, share counts).
 * @throws {RandError} unless `start <= end` are integers in `[0, 2^53 - 1]`.
 */
export declare function nextInClosedRangeUsize(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i8` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[-128, 127]` and `start <= end`.
 */
export declare function nextInClosedRangeI8(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i16` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[-32768, 32767]` and `start <= end`.
 */
export declare function nextInClosedRangeI16(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i32` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[-2147483648, 2147483647]` and `start <= end`.
 */
export declare function nextInClosedRangeI32(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i64` in `[start, end]`; see {@link nextInRangeI64} for the arithmetic.
 * @throws {RandError} unless both are `bigint`s in `[-2^63, 2^63 - 1]` and `start <= end`.
 */
export declare function nextInClosedRangeI64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
//#endregion
//# sourceMappingURL=samplers.d.mts.map