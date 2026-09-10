/**
 * Bounded and ranged integer samplers over any {@link RandomNumberGenerator}.
 *
 * One function per integer width, because the draw pattern (how many 64-bit
 * draws a sample consumes, and the full-range early return) is per width and
 * is part of the wire contract with the reference implementations.
 *
 * - `nextWithUpperBoundU32(rng, bound)` samples `[0, bound)` with Lemire's
 *   nearly-divisionless method.
 * - `nextInRangeI16(rng, start, end)` samples `[start, end)`.
 * - `nextInClosedRangeU64(rng, start, end)` samples `[start, end]`.
 *
 * Every sampler draws `nextU64()` (masked to its width), as the reference
 * does for every width; generators that implement `nextU64Low32` serve the
 * 8/16/32-bit samplers without a `bigint`. Arguments must be integers inside
 * the width, and ranges must be ordered; anything else is a `RangeError`.
 *
 * @module samplers
 */
import { I64_MAX, I64_MIN, U64_MAX, WIDTH, expectBigInt, expectInt } from "./domain.js";
import { fromMagnitude64, toMagnitude, toMagnitude64 } from "./magnitude.js";
import { type RandomNumberGenerator, drawLow32 } from "./rng.js";
import { wideMulU8, wideMulU16, wideMulU32Parts, wideMulU64 } from "./widening.js";

/**
 * The full-range early return draws a raw 64-bit value and, for widths
 * narrower than 64 bits, rejects it when it does not fit; the reference does
 * the same (`from_u64(...).unwrap()`).
 */
function fitOrThrow(value: bigint, max: bigint): bigint {
  if (value > max) {
    throw new RangeError("random value does not fit the target width");
  }
  return value;
}

function expectOpen(start: number | bigint, end: number | bigint): void {
  if (start >= end) throw new RangeError(`start must be less than end, got ${start} and ${end}`);
}

function expectClosed(start: number | bigint, end: number | bigint): void {
  if (start > end) {
    throw new RangeError(`start must be less than or equal to end, got ${start} and ${end}`);
  }
}

// ---------------------------------------------------------------------------
// Upper-bound samplers: uniform in [0, upperBound)
// ---------------------------------------------------------------------------

/**
 * Random `u8` in `[0, upperBound)`.
 * @throws {RangeError} unless `upperBound` is an integer in `[1, 255]`.
 */
export function nextWithUpperBoundU8(rng: RandomNumberGenerator, upperBound: number): number {
  const ub = expectInt(upperBound, 1, WIDTH.u8.max, "upperBound");
  let random = drawLow32(rng) & 0xff;
  let m = wideMulU8(random, ub);
  if (m[0] < ub) {
    const t = ((0x100 - ub) & 0xff) % ub;
    while (m[0] < t) {
      random = drawLow32(rng) & 0xff;
      m = wideMulU8(random, ub);
    }
  }
  return m[1];
}

/**
 * Random `u16` in `[0, upperBound)`.
 * @throws {RangeError} unless `upperBound` is an integer in `[1, 65535]`.
 */
export function nextWithUpperBoundU16(rng: RandomNumberGenerator, upperBound: number): number {
  const ub = expectInt(upperBound, 1, WIDTH.u16.max, "upperBound");
  let random = drawLow32(rng) & 0xffff;
  let m = wideMulU16(random, ub);
  if (m[0] < ub) {
    const t = ((0x10000 - ub) & 0xffff) % ub;
    while (m[0] < t) {
      random = drawLow32(rng) & 0xffff;
      m = wideMulU16(random, ub);
    }
  }
  return m[1];
}

/**
 * Random `u32` in `[0, upperBound)`.
 * @throws {RangeError} unless `upperBound` is an integer in `[1, 4294967295]`.
 */
export function nextWithUpperBoundU32(rng: RandomNumberGenerator, upperBound: number): number {
  const ub = expectInt(upperBound, 1, WIDTH.u32.max, "upperBound");
  let random = drawLow32(rng);
  let m = wideMulU32Parts(random, ub);
  if (m.lo < ub) {
    const t = ((0x100000000 - ub) >>> 0) % ub;
    while (m.lo < t) {
      random = drawLow32(rng);
      m = wideMulU32Parts(random, ub);
    }
  }
  return m.hi;
}

/**
 * Random `u64` in `[0, upperBound)`.
 * @throws {RangeError} unless `upperBound` is a `bigint` in `[1, 2^64 - 1]`.
 */
export function nextWithUpperBoundU64(rng: RandomNumberGenerator, upperBound: bigint): bigint {
  const ub = expectBigInt(upperBound, 1n, U64_MAX, "upperBound");
  let random = rng.nextU64() & U64_MAX;
  let m = wideMulU64(random, ub);
  if (m[0] < ub) {
    const t = ((U64_MAX + 1n - ub) & U64_MAX) % ub;
    while (m[0] < t) {
      random = rng.nextU64() & U64_MAX;
      m = wideMulU64(random, ub);
    }
  }
  return m[1];
}

// ---------------------------------------------------------------------------
// Half-open ranges: uniform in [start, end)
// ---------------------------------------------------------------------------

/**
 * Random `u8` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[0, 255]` and `start < end`.
 */
export function nextInRangeU8(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.u8.min, WIDTH.u8.max, "start");
  const hi = expectInt(end, WIDTH.u8.min, WIDTH.u8.max, "end");
  expectOpen(lo, hi);
  const delta = hi - lo;
  if (delta === 0xff) return Number(fitOrThrow(rng.nextU64(), 0xffn));
  return lo + nextWithUpperBoundU8(rng, delta);
}

/**
 * Random `u16` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[0, 65535]` and `start < end`.
 */
export function nextInRangeU16(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.u16.min, WIDTH.u16.max, "start");
  const hi = expectInt(end, WIDTH.u16.min, WIDTH.u16.max, "end");
  expectOpen(lo, hi);
  const delta = hi - lo;
  if (delta === 0xffff) return Number(fitOrThrow(rng.nextU64(), 0xffffn));
  return lo + nextWithUpperBoundU16(rng, delta);
}

/**
 * Random `u32` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[0, 4294967295]` and `start < end`.
 */
export function nextInRangeU32(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.u32.min, WIDTH.u32.max, "start");
  const hi = expectInt(end, WIDTH.u32.min, WIDTH.u32.max, "end");
  expectOpen(lo, hi);
  const delta = hi - lo;
  if (delta === 0xffffffff) return Number(fitOrThrow(rng.nextU64(), 0xffffffffn));
  return lo + nextWithUpperBoundU32(rng, delta);
}

/**
 * Random `u64` in `[start, end)`.
 * @throws {RangeError} unless both are `bigint`s in `[0, 2^64 - 1]` and `start < end`.
 */
export function nextInRangeU64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint {
  const lo = expectBigInt(start, 0n, U64_MAX, "start");
  const hi = expectBigInt(end, 0n, U64_MAX, "end");
  expectOpen(lo, hi);
  const delta = hi - lo;
  if (delta === U64_MAX) return rng.nextU64();
  return lo + nextWithUpperBoundU64(rng, delta);
}

/**
 * Random `i8` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[-128, 127]` and `start < end`.
 */
export function nextInRangeI8(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.i8.min, WIDTH.i8.max, "start");
  const hi = expectInt(end, WIDTH.i8.min, WIDTH.i8.max, "end");
  expectOpen(lo, hi);
  const delta = toMagnitude(hi - lo, 8);
  if (delta === 0xff) return Number(fitOrThrow(rng.nextU64(), 0x7fn));
  return ((lo + nextWithUpperBoundU8(rng, delta)) << 24) >> 24;
}

/**
 * Random `i16` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[-32768, 32767]` and `start < end`.
 */
export function nextInRangeI16(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.i16.min, WIDTH.i16.max, "start");
  const hi = expectInt(end, WIDTH.i16.min, WIDTH.i16.max, "end");
  expectOpen(lo, hi);
  const delta = toMagnitude(hi - lo, 16);
  if (delta === 0xffff) return Number(fitOrThrow(rng.nextU64(), 0x7fffn));
  return ((lo + nextWithUpperBoundU16(rng, delta)) << 16) >> 16;
}

/**
 * Random `i32` in `[start, end)`.
 * @throws {RangeError} unless both are integers in `[-2147483648, 2147483647]` and `start < end`.
 */
export function nextInRangeI32(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.i32.min, WIDTH.i32.max, "start");
  const hi = expectInt(end, WIDTH.i32.min, WIDTH.i32.max, "end");
  expectOpen(lo, hi);
  const delta = toMagnitude(hi - lo, 32);
  if (delta === 0xffffffff) return Number(fitOrThrow(rng.nextU64(), 0x7fffffffn));
  return (lo + nextWithUpperBoundU32(rng, delta)) | 0;
}

/**
 * Random `i64` in `[start, end)`. The result is `start + random` as wrapping
 * signed 64-bit addition, with the random magnitude reinterpreted as a signed
 * word (the reference's arithmetic).
 * @throws {RangeError} unless both are `bigint`s in `[-2^63, 2^63 - 1]` and `start < end`.
 */
export function nextInRangeI64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint {
  const lo = expectBigInt(start, I64_MIN, I64_MAX, "start");
  const hi = expectBigInt(end, I64_MIN, I64_MAX, "end");
  expectOpen(lo, hi);
  const delta = toMagnitude64(hi - lo);
  if (delta === U64_MAX) return fitOrThrow(rng.nextU64(), I64_MAX);
  return BigInt.asIntN(64, lo + fromMagnitude64(nextWithUpperBoundU64(rng, delta)));
}

// ---------------------------------------------------------------------------
// Closed ranges: uniform in [start, end]
// ---------------------------------------------------------------------------

/**
 * Random `u8` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[0, 255]` and `start <= end`.
 */
export function nextInClosedRangeU8(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.u8.min, WIDTH.u8.max, "start");
  const hi = expectInt(end, WIDTH.u8.min, WIDTH.u8.max, "end");
  expectClosed(lo, hi);
  const delta = hi - lo;
  if (delta === 0xff) return Number(fitOrThrow(rng.nextU64(), 0xffn));
  return lo + nextWithUpperBoundU8(rng, delta + 1);
}

/**
 * Random `u16` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[0, 65535]` and `start <= end`.
 */
export function nextInClosedRangeU16(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.u16.min, WIDTH.u16.max, "start");
  const hi = expectInt(end, WIDTH.u16.min, WIDTH.u16.max, "end");
  expectClosed(lo, hi);
  const delta = hi - lo;
  if (delta === 0xffff) return Number(fitOrThrow(rng.nextU64(), 0xffffn));
  return lo + nextWithUpperBoundU16(rng, delta + 1);
}

/**
 * Random `u32` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[0, 4294967295]` and `start <= end`.
 */
export function nextInClosedRangeU32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.u32.min, WIDTH.u32.max, "start");
  const hi = expectInt(end, WIDTH.u32.min, WIDTH.u32.max, "end");
  expectClosed(lo, hi);
  const delta = hi - lo;
  if (delta === 0xffffffff) return Number(fitOrThrow(rng.nextU64(), 0xffffffffn));
  return lo + nextWithUpperBoundU32(rng, delta + 1);
}

/**
 * Random `u64` in `[start, end]`.
 * @throws {RangeError} unless both are `bigint`s in `[0, 2^64 - 1]` and `start <= end`.
 */
export function nextInClosedRangeU64(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  const lo = expectBigInt(start, 0n, U64_MAX, "start");
  const hi = expectBigInt(end, 0n, U64_MAX, "end");
  expectClosed(lo, hi);
  const delta = hi - lo;
  if (delta === U64_MAX) return rng.nextU64();
  return lo + nextWithUpperBoundU64(rng, delta + 1n);
}

/**
 * Random `i8` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[-128, 127]` and `start <= end`.
 */
export function nextInClosedRangeI8(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.i8.min, WIDTH.i8.max, "start");
  const hi = expectInt(end, WIDTH.i8.min, WIDTH.i8.max, "end");
  expectClosed(lo, hi);
  const delta = toMagnitude(hi - lo, 8);
  if (delta === 0xff) return Number(fitOrThrow(rng.nextU64(), 0x7fn));
  return ((lo + nextWithUpperBoundU8(rng, delta + 1)) << 24) >> 24;
}

/**
 * Random `i16` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[-32768, 32767]` and `start <= end`.
 */
export function nextInClosedRangeI16(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.i16.min, WIDTH.i16.max, "start");
  const hi = expectInt(end, WIDTH.i16.min, WIDTH.i16.max, "end");
  expectClosed(lo, hi);
  const delta = toMagnitude(hi - lo, 16);
  if (delta === 0xffff) return Number(fitOrThrow(rng.nextU64(), 0x7fffn));
  return ((lo + nextWithUpperBoundU16(rng, delta + 1)) << 16) >> 16;
}

/**
 * Random `i32` in `[start, end]`.
 * @throws {RangeError} unless both are integers in `[-2147483648, 2147483647]` and `start <= end`.
 */
export function nextInClosedRangeI32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.i32.min, WIDTH.i32.max, "start");
  const hi = expectInt(end, WIDTH.i32.min, WIDTH.i32.max, "end");
  expectClosed(lo, hi);
  const delta = toMagnitude(hi - lo, 32);
  if (delta === 0xffffffff) return Number(fitOrThrow(rng.nextU64(), 0x7fffffffn));
  return (lo + nextWithUpperBoundU32(rng, delta + 1)) | 0;
}

/**
 * Random `i64` in `[start, end]`; see {@link nextInRangeI64} for the arithmetic.
 * @throws {RangeError} unless both are `bigint`s in `[-2^63, 2^63 - 1]` and `start <= end`.
 */
export function nextInClosedRangeI64(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  const lo = expectBigInt(start, I64_MIN, I64_MAX, "start");
  const hi = expectBigInt(end, I64_MIN, I64_MAX, "end");
  expectClosed(lo, hi);
  const delta = toMagnitude64(hi - lo);
  if (delta === U64_MAX) return fitOrThrow(rng.nextU64(), I64_MAX);
  return BigInt.asIntN(64, lo + fromMagnitude64(nextWithUpperBoundU64(rng, delta + 1n)));
}
