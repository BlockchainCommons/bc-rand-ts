import { t as RandomNumberGenerator } from "./rng-g0VEAyUb.mjs";
//#region src/widening.d.ts
/**
 * Wide (double-width) unsigned multiplication helpers.
 *
 * @module widening
 */
/**
 * Wide multiplication result type - returns (low, high) parts.
 * For a multiplication of two N-bit values, the result is 2N bits
 * split into two N-bit parts.
 */
type WideMulResult = [bigint, bigint];
/**
 * Performs wide multiplication for unsigned integers.
 * Returns (low, high) parts of the full-width result.
 *
 */
declare function wideMul(a: bigint, b: bigint, bits: number): WideMulResult;
/**
 * Wide multiplication for 8-bit unsigned integers.
 * @param a - First 8-bit value
 * @param b - Second 8-bit value
 * @returns Tuple of (low 8 bits, high 8 bits)
 */
declare function wideMulU8(a: number, b: number): [number, number];
/**
 * Wide multiplication for 16-bit unsigned integers.
 * @param a - First 16-bit value
 * @param b - Second 16-bit value
 * @returns Tuple of (low 16 bits, high 16 bits)
 */
declare function wideMulU16(a: number, b: number): [number, number];
/**
 * Wide multiplication for 32-bit unsigned integers.
 * @param a - First 32-bit value
 * @param b - Second 32-bit value
 * @returns Tuple of (low 32 bits, high 32 bits) as bigints
 */
declare function wideMulU32(a: number, b: number): [bigint, bigint];
/**
 * Wide multiplication for 64-bit unsigned integers.
 * @param a - First 64-bit value as bigint
 * @param b - Second 64-bit value as bigint
 * @returns Tuple of (low 64 bits, high 64 bits) as bigints
 */
declare function wideMulU64(a: bigint, b: bigint): [bigint, bigint];
//#endregion
//#region src/magnitude.d.ts
/**
 * Signed/unsigned magnitude reinterpretation helpers.
 *
 * @module magnitude
 */
/**
 * Converts a signed integer to its unsigned magnitude.
 * For positive numbers, returns the number unchanged.
 * For negative numbers, returns the absolute value (wrapping for MIN values).
 *
 */
declare function toMagnitude(value: number, bits: 8 | 16 | 32): number;
/**
 * Converts a signed bigint to its unsigned magnitude for 64-bit values.
 */
declare function toMagnitude64(value: bigint): bigint;
/**
 * Converts an unsigned magnitude back to a signed value.
 * Simply reinterprets the bits.
 */
declare function fromMagnitude(magnitude: number, bits: 8 | 16 | 32): number;
/**
 * Converts an unsigned 64-bit magnitude back to a signed bigint.
 */
declare function fromMagnitude64(magnitude: bigint): bigint;
//#endregion
//#region src/samplers.d.ts
/** Random `u8` in `[0, upperBound)`. */
declare function nextWithUpperBoundU8(rng: RandomNumberGenerator, upperBound: number): number;
/** Random `u16` in `[0, upperBound)`. */
declare function nextWithUpperBoundU16(rng: RandomNumberGenerator, upperBound: number): number;
/** Random `u32` in `[0, upperBound)`. */
declare function nextWithUpperBoundU32(rng: RandomNumberGenerator, upperBound: number): number;
/** Random `u64` in `[0, upperBound)`. */
declare function nextWithUpperBoundU64(rng: RandomNumberGenerator, upperBound: bigint): bigint;
/** Random `u8` in `[start, end)`. */
declare function nextInRangeU8(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `u16` in `[start, end)`. */
declare function nextInRangeU16(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `u32` in `[start, end)`. */
declare function nextInRangeU32(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `u64` in `[start, end)`. */
declare function nextInRangeU64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
/** Random `i8` in `[start, end)`. */
declare function nextInRangeI8(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `i16` in `[start, end)`. */
declare function nextInRangeI16(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `i32` in `[start, end)`. */
declare function nextInRangeI32(rng: RandomNumberGenerator, start: number, end: number): number;
/**
 * Random `i64` in `[start, end)`.
 *
 * The result is `start + random` as wrapping signed 64-bit addition, with the
 * random magnitude reinterpreted as a signed word.
 */
declare function nextInRangeI64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
/** Random `u8` in `[start, end]`. */
declare function nextInClosedRangeU8(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `u16` in `[start, end]`. */
declare function nextInClosedRangeU16(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `u32` in `[start, end]`. */
declare function nextInClosedRangeU32(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `u64` in `[start, end]`. */
declare function nextInClosedRangeU64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
/** Random `i8` in `[start, end]`. */
declare function nextInClosedRangeI8(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `i16` in `[start, end]`. */
declare function nextInClosedRangeI16(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `i32` in `[start, end]`. */
declare function nextInClosedRangeI32(rng: RandomNumberGenerator, start: number, end: number): number;
/** Random `i64` in `[start, end]`; see {@link nextInRangeI64} for the arithmetic. */
declare function nextInClosedRangeI64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint;
//#endregion
export { type WideMulResult, fromMagnitude, fromMagnitude64, nextInClosedRangeI16, nextInClosedRangeI32, nextInClosedRangeI64, nextInClosedRangeI8, nextInClosedRangeU16, nextInClosedRangeU32, nextInClosedRangeU64, nextInClosedRangeU8, nextInRangeI16, nextInRangeI32, nextInRangeI64, nextInRangeI8, nextInRangeU16, nextInRangeU32, nextInRangeU64, nextInRangeU8, nextWithUpperBoundU16, nextWithUpperBoundU32, nextWithUpperBoundU64, nextWithUpperBoundU8, toMagnitude, toMagnitude64, wideMul, wideMulU16, wideMulU32, wideMulU64, wideMulU8 };
//# sourceMappingURL=samplers.d.mts.map