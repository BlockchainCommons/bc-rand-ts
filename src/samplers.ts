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
 * - `…Usize` is the reference's `usize` instantiation over `number`
 *   (`[0, 2^53 - 1]`) with the 64-bit draw; the 32-bit samplers are not a
 *   substitute for it (they consume the generator differently).
 *
 * A signed range's length (`end - start`) must fit the signed width, as it
 * must in the reference, whose arithmetic is checked: `nextInRangeI8(rng,
 * -128, 127)` is a `RandError` `RangeTooLong`, not a sample. The unsigned
 * full range (`0..=255` for u8) reaches the reference's raw-draw path and
 * throws `ValueDoesNotFit` unless the draw fits, exactly as the reference
 * panics.
 *
 * Every sampler draws `nextU64()` (masked to its width), as the reference
 * does for every width; generators that implement `nextU64Low32` serve the
 * 8/16/32-bit samplers without a `bigint`. Arguments must be integers inside
 * the width (`InvalidArgument`), and ranges must be ordered (`EmptyRange`);
 * every failure is a {@link RandError} thrown before any draw.
 *
 * @module samplers
 */
import { I64_MAX, I64_MIN, U64_MAX, WIDTH, expectBigInt, expectInt } from "./domain.js";
import { RandError } from "./error.js";
import { type RandomNumberGenerator, drawLow32, drawU64 } from "./rng.js";
import { wideMulU8, wideMulU16, wideMulU32Parts, wideMulU64 } from "./widening.js";

/**
 * The full-range early return draws a raw 64-bit value and, for widths
 * narrower than 64 bits, rejects it when it does not fit; the reference does
 * the same (`from_u64(...).unwrap()`).
 */
function fitOrThrow(value: bigint, max: bigint): bigint {
  if (value > max) throw RandError.valueDoesNotFit();
  return value;
}

function expectOpen(start: number | bigint, end: number | bigint): void {
  if (start >= end) throw RandError.emptyRange(start, end, false);
}

function expectClosed(start: number | bigint, end: number | bigint): void {
  if (start > end) throw RandError.emptyRange(start, end, true);
}

/**
 * A signed range's `end - start` is computed in the signed type by the
 * reference; a length above the width's `MAX` overflows there (a panic when
 * checked): outside the domain. Ordering has been checked, so the length is
 * already at least 1 (half-open) or 0 (closed).
 */
function expectLength<T extends number | bigint>(length: T, max: T, closed: boolean): T {
  if (length > max) throw RandError.rangeTooLong(length, max, closed);
  return length;
}

// ---------------------------------------------------------------------------
// Upper-bound samplers: uniform in [0, upperBound)
// ---------------------------------------------------------------------------

/**
 * Random `u8` in `[0, upperBound)`.
 * @throws {RandError} unless `upperBound` is an integer in `[1, 255]`.
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
 * @throws {RandError} unless `upperBound` is an integer in `[1, 65535]`.
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
 * @throws {RandError} unless `upperBound` is an integer in `[1, 4294967295]`.
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
 * @throws {RandError} unless `upperBound` is a `bigint` in `[1, 2^64 - 1]`.
 */
export function nextWithUpperBoundU64(rng: RandomNumberGenerator, upperBound: bigint): bigint {
  const ub = expectBigInt(upperBound, 1n, U64_MAX, "upperBound");
  let random = drawU64(rng);
  let m = wideMulU64(random, ub);
  if (m[0] < ub) {
    const t = ((U64_MAX + 1n - ub) & U64_MAX) % ub;
    while (m[0] < t) {
      random = drawU64(rng);
      m = wideMulU64(random, ub);
    }
  }
  return m[1];
}

/**
 * Uniform in `[0, upperBound)` for the reference's `usize` instantiation:
 * a `number` in `[1, 2^53 - 1]`, drawn as the 64-bit sampler draws (one
 * full `nextU64()` per attempt, 64×64 rejection arithmetic) — *not* as the
 * 32-bit samplers do, which consume the generator differently. For sizes
 * above `2^53 - 1` use {@link nextWithUpperBoundU64}.
 * @throws {RandError} unless `upperBound` is an integer in `[1, 2^53 - 1]`.
 */
export function nextWithUpperBoundUsize(rng: RandomNumberGenerator, upperBound: number): number {
  const ub = expectInt(upperBound, 1, WIDTH.usize.max, "upperBound");
  return Number(nextWithUpperBoundU64(rng, BigInt(ub)));
}

// ---------------------------------------------------------------------------
// Half-open ranges: uniform in [start, end)
// ---------------------------------------------------------------------------

/**
 * Random `u8` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[0, 255]` and `start < end`.
 */
export function nextInRangeU8(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.u8.min, WIDTH.u8.max, "start");
  const hi = expectInt(end, WIDTH.u8.min, WIDTH.u8.max, "end");
  expectOpen(lo, hi);
  const delta = hi - lo;
  if (delta === 0xff) return Number(fitOrThrow(drawU64(rng), 0xffn));
  return lo + nextWithUpperBoundU8(rng, delta);
}

/**
 * Random `u16` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[0, 65535]` and `start < end`.
 */
export function nextInRangeU16(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.u16.min, WIDTH.u16.max, "start");
  const hi = expectInt(end, WIDTH.u16.min, WIDTH.u16.max, "end");
  expectOpen(lo, hi);
  const delta = hi - lo;
  if (delta === 0xffff) return Number(fitOrThrow(drawU64(rng), 0xffffn));
  return lo + nextWithUpperBoundU16(rng, delta);
}

/**
 * Random `u32` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[0, 4294967295]` and `start < end`.
 */
export function nextInRangeU32(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.u32.min, WIDTH.u32.max, "start");
  const hi = expectInt(end, WIDTH.u32.min, WIDTH.u32.max, "end");
  expectOpen(lo, hi);
  const delta = hi - lo;
  if (delta === 0xffffffff) return Number(fitOrThrow(drawU64(rng), 0xffffffffn));
  return lo + nextWithUpperBoundU32(rng, delta);
}

/**
 * Random `u64` in `[start, end)`.
 * @throws {RandError} unless both are `bigint`s in `[0, 2^64 - 1]` and `start < end`.
 */
export function nextInRangeU64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint {
  const lo = expectBigInt(start, 0n, U64_MAX, "start");
  const hi = expectBigInt(end, 0n, U64_MAX, "end");
  expectOpen(lo, hi);
  const delta = hi - lo;
  if (delta === U64_MAX) return drawU64(rng);
  return lo + nextWithUpperBoundU64(rng, delta);
}

/**
 * Uniform in `[start, end)` for the reference's `usize` instantiation
 * (`number`s in `[0, 2^53 - 1]`, 64-bit draw); see {@link nextWithUpperBoundUsize}.
 * @throws {RandError} unless `start < end` are integers in `[0, 2^53 - 1]`.
 */
export function nextInRangeUsize(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.usize.min, WIDTH.usize.max, "start");
  const hi = expectInt(end, WIDTH.usize.min, WIDTH.usize.max, "end");
  expectOpen(lo, hi);
  return Number(nextInRangeU64(rng, BigInt(lo), BigInt(hi)));
}

/**
 * Random `i8` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[-128, 127]` and `start < end`.
 */
export function nextInRangeI8(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.i8.min, WIDTH.i8.max, "start");
  const hi = expectInt(end, WIDTH.i8.min, WIDTH.i8.max, "end");
  expectOpen(lo, hi);
  const delta = expectLength(hi - lo, WIDTH.i8.max, false);
  return lo + nextWithUpperBoundU8(rng, delta);
}

/**
 * Random `i16` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[-32768, 32767]` and `start < end`.
 */
export function nextInRangeI16(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.i16.min, WIDTH.i16.max, "start");
  const hi = expectInt(end, WIDTH.i16.min, WIDTH.i16.max, "end");
  expectOpen(lo, hi);
  const delta = expectLength(hi - lo, WIDTH.i16.max, false);
  return lo + nextWithUpperBoundU16(rng, delta);
}

/**
 * Random `i32` in `[start, end)`.
 * @throws {RandError} unless both are integers in `[-2147483648, 2147483647]` and `start < end`.
 */
export function nextInRangeI32(rng: RandomNumberGenerator, start: number, end: number): number {
  const lo = expectInt(start, WIDTH.i32.min, WIDTH.i32.max, "start");
  const hi = expectInt(end, WIDTH.i32.min, WIDTH.i32.max, "end");
  expectOpen(lo, hi);
  const delta = expectLength(hi - lo, WIDTH.i32.max, false);
  return lo + nextWithUpperBoundU32(rng, delta);
}

/**
 * Random `i64` in `[start, end)`: `start + random` for a random below the
 * range length, drawn as the u64 sampler draws.
 * @throws {RandError} unless both are `bigint`s in `[-2^63, 2^63 - 1]`,
 * `start < end`, and `end - start` fits `i64` (the reference's arithmetic).
 */
export function nextInRangeI64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint {
  const lo = expectBigInt(start, I64_MIN, I64_MAX, "start");
  const hi = expectBigInt(end, I64_MIN, I64_MAX, "end");
  expectOpen(lo, hi);
  const delta = expectLength(hi - lo, I64_MAX, false);
  return lo + nextWithUpperBoundU64(rng, delta);
}

// ---------------------------------------------------------------------------
// Closed ranges: uniform in [start, end]
// ---------------------------------------------------------------------------

/**
 * Random `u8` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[0, 255]` and `start <= end`.
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
  if (delta === 0xff) return Number(fitOrThrow(drawU64(rng), 0xffn));
  return lo + nextWithUpperBoundU8(rng, delta + 1);
}

/**
 * Random `u16` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[0, 65535]` and `start <= end`.
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
  if (delta === 0xffff) return Number(fitOrThrow(drawU64(rng), 0xffffn));
  return lo + nextWithUpperBoundU16(rng, delta + 1);
}

/**
 * Random `u32` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[0, 4294967295]` and `start <= end`.
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
  if (delta === 0xffffffff) return Number(fitOrThrow(drawU64(rng), 0xffffffffn));
  return lo + nextWithUpperBoundU32(rng, delta + 1);
}

/**
 * Random `u64` in `[start, end]`.
 * @throws {RandError} unless both are `bigint`s in `[0, 2^64 - 1]` and `start <= end`.
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
  if (delta === U64_MAX) return drawU64(rng);
  return lo + nextWithUpperBoundU64(rng, delta + 1n);
}

/**
 * Uniform in `[start, end]` for the reference's `usize` instantiation
 * (`number`s in `[0, 2^53 - 1]`, 64-bit draw); see {@link nextWithUpperBoundUsize}.
 * This is the sampler a `RangeInclusive<usize>` in the reference maps to
 * (salt lengths, share counts).
 * @throws {RandError} unless `start <= end` are integers in `[0, 2^53 - 1]`.
 */
export function nextInClosedRangeUsize(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.usize.min, WIDTH.usize.max, "start");
  const hi = expectInt(end, WIDTH.usize.min, WIDTH.usize.max, "end");
  expectClosed(lo, hi);
  return Number(nextInClosedRangeU64(rng, BigInt(lo), BigInt(hi)));
}

/**
 * Random `i8` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[-128, 127]` and `start <= end`.
 */
export function nextInClosedRangeI8(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.i8.min, WIDTH.i8.max, "start");
  const hi = expectInt(end, WIDTH.i8.min, WIDTH.i8.max, "end");
  expectClosed(lo, hi);
  const delta = expectLength(hi - lo, WIDTH.i8.max, true);
  return lo + nextWithUpperBoundU8(rng, delta + 1);
}

/**
 * Random `i16` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[-32768, 32767]` and `start <= end`.
 */
export function nextInClosedRangeI16(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.i16.min, WIDTH.i16.max, "start");
  const hi = expectInt(end, WIDTH.i16.min, WIDTH.i16.max, "end");
  expectClosed(lo, hi);
  const delta = expectLength(hi - lo, WIDTH.i16.max, true);
  return lo + nextWithUpperBoundU16(rng, delta + 1);
}

/**
 * Random `i32` in `[start, end]`.
 * @throws {RandError} unless both are integers in `[-2147483648, 2147483647]` and `start <= end`.
 */
export function nextInClosedRangeI32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  const lo = expectInt(start, WIDTH.i32.min, WIDTH.i32.max, "start");
  const hi = expectInt(end, WIDTH.i32.min, WIDTH.i32.max, "end");
  expectClosed(lo, hi);
  const delta = expectLength(hi - lo, WIDTH.i32.max, true);
  return lo + nextWithUpperBoundU32(rng, delta + 1);
}

/**
 * Random `i64` in `[start, end]`; see {@link nextInRangeI64} for the arithmetic.
 * @throws {RandError} unless both are `bigint`s in `[-2^63, 2^63 - 1]` and `start <= end`.
 */
export function nextInClosedRangeI64(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  const lo = expectBigInt(start, I64_MIN, I64_MAX, "start");
  const hi = expectBigInt(end, I64_MIN, I64_MAX, "end");
  expectClosed(lo, hi);
  const delta = expectLength(hi - lo, I64_MAX, true);
  return lo + nextWithUpperBoundU64(rng, delta + 1n);
}
