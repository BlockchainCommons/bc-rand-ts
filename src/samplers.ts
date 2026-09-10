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
 * Invalid bounds throw `RangeError`.
 *
 * @module samplers
 */
import type { RandomNumberGenerator } from "./rng.js";
import { wideMulU8, wideMulU16, wideMulU32Parts, wideMulU64 } from "./widening.js";
import { toMagnitude, toMagnitude64, fromMagnitude64 } from "./magnitude.js";

export {
  wideMul,
  wideMulU8,
  wideMulU16,
  wideMulU32,
  wideMulU64,
  type WideMulResult,
} from "./widening.js";
export { toMagnitude, toMagnitude64, fromMagnitude, fromMagnitude64 } from "./magnitude.js";

const MASK64 = 0xffffffffffffffffn;

/**
 * The full-range early return draws a raw 64-bit value and, for signed
 * widths, rejects it when it does not fit; the reference implementations do
 * the same.
 */
function fitOrThrow(value: bigint, max: bigint): bigint {
  if (value > max) {
    throw new RangeError("random value does not fit the target width");
  }
  return value;
}

// ---------------------------------------------------------------------------
// Upper-bound samplers: uniform in [0, upperBound)
// ---------------------------------------------------------------------------

/** Random `u8` in `[0, upperBound)`. */
export function nextWithUpperBoundU8(rng: RandomNumberGenerator, upperBound: number): number {
  if (upperBound === 0) throw new RangeError("upperBound must be non-zero");
  const ub = upperBound & 0xff;
  let random = Number(rng.nextU64() & 0xffn);
  let m = wideMulU8(random, ub);
  if (m[0] < ub) {
    const t = ((0x100 - ub) & 0xff) % ub;
    while (m[0] < t) {
      random = Number(rng.nextU64() & 0xffn);
      m = wideMulU8(random, ub);
    }
  }
  return m[1];
}

/** Random `u16` in `[0, upperBound)`. */
export function nextWithUpperBoundU16(rng: RandomNumberGenerator, upperBound: number): number {
  if (upperBound === 0) throw new RangeError("upperBound must be non-zero");
  const ub = upperBound & 0xffff;
  let random = Number(rng.nextU64() & 0xffffn);
  let m = wideMulU16(random, ub);
  if (m[0] < ub) {
    const t = ((0x10000 - ub) & 0xffff) % ub;
    while (m[0] < t) {
      random = Number(rng.nextU64() & 0xffffn);
      m = wideMulU16(random, ub);
    }
  }
  return m[1];
}

/** Random `u32` in `[0, upperBound)`. */
export function nextWithUpperBoundU32(rng: RandomNumberGenerator, upperBound: number): number {
  if (upperBound === 0) throw new RangeError("upperBound must be non-zero");
  const ub = upperBound >>> 0;
  let random = rng.nextU32();
  let m = wideMulU32Parts(random, ub);
  if (m.lo < ub) {
    const t = ((0x100000000 - ub) >>> 0) % ub;
    while (m.lo < t) {
      random = rng.nextU32();
      m = wideMulU32Parts(random, ub);
    }
  }
  return m.hi;
}

/** Random `u64` in `[0, upperBound)`. */
export function nextWithUpperBoundU64(rng: RandomNumberGenerator, upperBound: bigint): bigint {
  if (upperBound === 0n) throw new RangeError("upperBound must be non-zero");
  const ub = upperBound & MASK64;
  let random = rng.nextU64() & MASK64;
  let m = wideMulU64(random, ub);
  if (m[0] < ub) {
    const t = ((MASK64 + 1n - ub) & MASK64) % ub;
    while (m[0] < t) {
      random = rng.nextU64() & MASK64;
      m = wideMulU64(random, ub);
    }
  }
  return m[1];
}

// ---------------------------------------------------------------------------
// Half-open ranges: uniform in [start, end)
// ---------------------------------------------------------------------------

/** Random `u8` in `[start, end)`. */
export function nextInRangeU8(rng: RandomNumberGenerator, start: number, end: number): number {
  if (start >= end) throw new RangeError("start must be less than end");
  const lo = start & 0xff;
  const delta = ((end & 0xff) - lo) & 0xff;
  if (delta === 0xff) return Number(fitOrThrow(rng.nextU64(), 0xffn));
  return (lo + nextWithUpperBoundU8(rng, delta)) & 0xff;
}

/** Random `u16` in `[start, end)`. */
export function nextInRangeU16(rng: RandomNumberGenerator, start: number, end: number): number {
  if (start >= end) throw new RangeError("start must be less than end");
  const lo = start & 0xffff;
  const delta = ((end & 0xffff) - lo) & 0xffff;
  if (delta === 0xffff) return Number(fitOrThrow(rng.nextU64(), 0xffffn));
  return (lo + nextWithUpperBoundU16(rng, delta)) & 0xffff;
}

/** Random `u32` in `[start, end)`. */
export function nextInRangeU32(rng: RandomNumberGenerator, start: number, end: number): number {
  if (start >= end) throw new RangeError("start must be less than end");
  const lo = start >>> 0;
  const delta = ((end >>> 0) - lo) >>> 0;
  if (delta === 0xffffffff) return Number(fitOrThrow(rng.nextU64(), 0xffffffffn));
  return (lo + nextWithUpperBoundU32(rng, delta)) >>> 0;
}

/** Random `u64` in `[start, end)`. */
export function nextInRangeU64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint {
  if (start >= end) throw new RangeError("start must be less than end");
  const delta = (end - start) & MASK64;
  if (delta === MASK64) return rng.nextU64();
  return (start + nextWithUpperBoundU64(rng, delta)) & MASK64;
}

/** Random `i8` in `[start, end)`. */
export function nextInRangeI8(rng: RandomNumberGenerator, start: number, end: number): number {
  if (start >= end) throw new RangeError("start must be less than end");
  const lo = (start << 24) >> 24;
  const hi = (end << 24) >> 24;
  const delta = toMagnitude(hi - lo, 8);
  if (delta === 0xff) return Number(fitOrThrow(rng.nextU64(), 0x7fn));
  return ((lo + nextWithUpperBoundU8(rng, delta)) << 24) >> 24;
}

/** Random `i16` in `[start, end)`. */
export function nextInRangeI16(rng: RandomNumberGenerator, start: number, end: number): number {
  if (start >= end) throw new RangeError("start must be less than end");
  const lo = (start << 16) >> 16;
  const hi = (end << 16) >> 16;
  const delta = toMagnitude(hi - lo, 16);
  if (delta === 0xffff) return Number(fitOrThrow(rng.nextU64(), 0x7fffn));
  return ((lo + nextWithUpperBoundU16(rng, delta)) << 16) >> 16;
}

/** Random `i32` in `[start, end)`. */
export function nextInRangeI32(rng: RandomNumberGenerator, start: number, end: number): number {
  if (start >= end) throw new RangeError("start must be less than end");
  const lo = start | 0;
  const hi = end | 0;
  const delta = toMagnitude(hi - lo, 32);
  if (delta === 0xffffffff) return Number(fitOrThrow(rng.nextU64(), 0x7fffffffn));
  return (lo + nextWithUpperBoundU32(rng, delta)) | 0;
}

/**
 * Random `i64` in `[start, end)`.
 *
 * The result is `start + random` as wrapping signed 64-bit addition, with the
 * random magnitude reinterpreted as a signed word.
 */
export function nextInRangeI64(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint {
  if (start >= end) throw new RangeError("start must be less than end");
  const delta = toMagnitude64(end - start);
  if (delta === MASK64) return fitOrThrow(rng.nextU64(), 0x7fffffffffffffffn);
  return BigInt.asIntN(64, start + fromMagnitude64(nextWithUpperBoundU64(rng, delta)));
}

// ---------------------------------------------------------------------------
// Closed ranges: uniform in [start, end]
// ---------------------------------------------------------------------------

/** Random `u8` in `[start, end]`. */
export function nextInClosedRangeU8(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new RangeError("start must be less than or equal to end");
  const lo = start & 0xff;
  const delta = ((end & 0xff) - lo) & 0xff;
  if (delta === 0xff) return Number(fitOrThrow(rng.nextU64(), 0xffn));
  return (lo + nextWithUpperBoundU8(rng, delta + 1)) & 0xff;
}

/** Random `u16` in `[start, end]`. */
export function nextInClosedRangeU16(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new RangeError("start must be less than or equal to end");
  const lo = start & 0xffff;
  const delta = ((end & 0xffff) - lo) & 0xffff;
  if (delta === 0xffff) return Number(fitOrThrow(rng.nextU64(), 0xffffn));
  return (lo + nextWithUpperBoundU16(rng, delta + 1)) & 0xffff;
}

/** Random `u32` in `[start, end]`. */
export function nextInClosedRangeU32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new RangeError("start must be less than or equal to end");
  const lo = start >>> 0;
  const delta = ((end >>> 0) - lo) >>> 0;
  if (delta === 0xffffffff) return Number(fitOrThrow(rng.nextU64(), 0xffffffffn));
  return (lo + nextWithUpperBoundU32(rng, delta + 1)) >>> 0;
}

/** Random `u64` in `[start, end]`. */
export function nextInClosedRangeU64(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  if (start > end) throw new RangeError("start must be less than or equal to end");
  const delta = (end - start) & MASK64;
  if (delta === MASK64) return rng.nextU64();
  return (start + nextWithUpperBoundU64(rng, delta + 1n)) & MASK64;
}

/** Random `i8` in `[start, end]`. */
export function nextInClosedRangeI8(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new RangeError("start must be less than or equal to end");
  const lo = (start << 24) >> 24;
  const hi = (end << 24) >> 24;
  const delta = toMagnitude(hi - lo, 8);
  if (delta === 0xff) return Number(fitOrThrow(rng.nextU64(), 0x7fn));
  return ((lo + nextWithUpperBoundU8(rng, delta + 1)) << 24) >> 24;
}

/** Random `i16` in `[start, end]`. */
export function nextInClosedRangeI16(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new RangeError("start must be less than or equal to end");
  const lo = (start << 16) >> 16;
  const hi = (end << 16) >> 16;
  const delta = toMagnitude(hi - lo, 16);
  if (delta === 0xffff) return Number(fitOrThrow(rng.nextU64(), 0x7fffn));
  return ((lo + nextWithUpperBoundU16(rng, delta + 1)) << 16) >> 16;
}

/** Random `i32` in `[start, end]`. */
export function nextInClosedRangeI32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new RangeError("start must be less than or equal to end");
  const lo = start | 0;
  const hi = end | 0;
  const delta = toMagnitude(hi - lo, 32);
  if (delta === 0xffffffff) return Number(fitOrThrow(rng.nextU64(), 0x7fffffffn));
  return (lo + nextWithUpperBoundU32(rng, delta + 1)) | 0;
}

/** Random `i64` in `[start, end]`; see {@link nextInRangeI64} for the arithmetic. */
export function nextInClosedRangeI64(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  if (start > end) throw new RangeError("start must be less than or equal to end");
  const delta = toMagnitude64(end - start);
  if (delta === MASK64) return fitOrThrow(rng.nextU64(), 0x7fffffffffffffffn);
  return BigInt.asIntN(64, start + fromMagnitude64(nextWithUpperBoundU64(rng, delta + 1n)));
}
