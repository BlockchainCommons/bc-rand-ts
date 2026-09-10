import { t as RandomNumberGenerator } from "./rng-CTLyw_Hv.mjs";
//#region src/samplers.d.ts
/**
 * Random `u8` in `[0, upperBound)`.
 * @throws {RangeError} unless `upperBound` is an integer in `[1, 255]`.
 */
declare function nextWithUpperBoundU8(rng: RandomNumberGenerator, upperBound: number): number;
/**
 * Random `u16` in `[0, upperBound)`.
 * @throws {RangeError} unless `upperBound` is an integer in `[1, 65535]`.
 */
declare function nextWithUpperBoundU16(rng: RandomNumberGenerator, upperBound: number): number;
/**
 * Random `u32` in `[0, upperBound)`.
 * @throws {RangeError} unless `upperBound` is an integer in `[1, 4294967295]`.
 */
declare function nextWithUpperBoundU32(rng: RandomNumberGenerator, upperBound: number): number;
/**
 * Random `u64` in `[0, upperBound)`.
 * @throws {RangeError} unless `upperBound` is a `bigint` in `[1, 2^64 - 1]`.
 */
declare function nextWithUpperBoundU64(rng: RandomNumberGenerator, upperBound: bigint): bigint;
/**
 * Random `u8` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[0, 255]` and `start < end`.
 */
declare function nextInRangeU8(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u16` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[0, 65535]` and `start < end`.
 */
declare function nextInRangeU16(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u32` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[0, 4294967295]` and `start < end`.
 */
declare function nextInRangeU32(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u64` in `[start, end)`.
 * @throws {RangeError} unless both are `bigint`s in `[0, 2^64 - 1]` and `start < end`.
 */
declare function nextInRangeU64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
/**
 * Random `i8` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[-128, 127]` and `start < end`.
 */
declare function nextInRangeI8(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i16` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[-32768, 32767]` and `start < end`.
 */
declare function nextInRangeI16(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i32` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[-2147483648, 2147483647]` and `start < end`.
 */
declare function nextInRangeI32(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i64` in `[start, end)`. The result is `start + random` as wrapping
 * signed 64-bit addition, with the random magnitude reinterpreted as a signed
 * word (the reference's arithmetic).
 * @throws {RangeError} unless both are `bigint`s in `[-2^63, 2^63 - 1]` and `start < end`.
 */
declare function nextInRangeI64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
/**
 * Random `u8` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[0, 255]` and `start <= end`.
 */
declare function nextInClosedRangeU8(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u16` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[0, 65535]` and `start <= end`.
 */
declare function nextInClosedRangeU16(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u32` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[0, 4294967295]` and `start <= end`.
 */
declare function nextInClosedRangeU32(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `u64` in `[start, end]`.
 * @throws {RangeError} unless both are `bigint`s in `[0, 2^64 - 1]` and `start <= end`.
 */
declare function nextInClosedRangeU64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
/**
 * Random `i8` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[-128, 127]` and `start <= end`.
 */
declare function nextInClosedRangeI8(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i16` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[-32768, 32767]` and `start <= end`.
 */
declare function nextInClosedRangeI16(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i32` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[-2147483648, 2147483647]` and `start <= end`.
 */
declare function nextInClosedRangeI32(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i64` in `[start, end]`; see {@link nextInRangeI64} for the arithmetic.
 * @throws {RangeError} unless both are `bigint`s in `[-2^63, 2^63 - 1]` and `start <= end`.
 */
declare function nextInClosedRangeI64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
//#endregion
export { nextInClosedRangeI16, nextInClosedRangeI32, nextInClosedRangeI64, nextInClosedRangeI8, nextInClosedRangeU16, nextInClosedRangeU32, nextInClosedRangeU64, nextInClosedRangeU8, nextInRangeI16, nextInRangeI32, nextInRangeI64, nextInRangeI8, nextInRangeU16, nextInRangeU32, nextInRangeU64, nextInRangeU8, nextWithUpperBoundU16, nextWithUpperBoundU32, nextWithUpperBoundU64, nextWithUpperBoundU8 };
//# sourceMappingURL=samplers.d.mts.map