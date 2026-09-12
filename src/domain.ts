/**
 * Argument-domain checks for the samplers and the seeded generator.
 *
 * TypeScript has no integer widths: a `u8` bound is a `number` that must be an
 * integer in `[1, 255]`. Every check throws `RangeError` with one message shape,
 * `"<name> must be an integer in [<min>, <max>], got <value>"`.
 *
 * @module domain
 */

/** Throws unless `value` is an integer `number` in `[min, max]`. Returns it. */
export function expectInt(value: number, min: number, max: number, name: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in [${min}, ${max}], got ${String(value)}`);
  }
  return value;
}

/** Throws unless `value` is a `bigint` in `[min, max]`. Returns it. */
export function expectBigInt(value: bigint, min: bigint, max: bigint, name: string): bigint {
  if (typeof value !== "bigint" || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in [${min}, ${max}], got ${String(value)}`);
  }
  return value;
}

/** An integer width's inclusive bounds. */
export interface Bounds {
  readonly min: number;
  readonly max: number;
}

/**
 * The inclusive bounds of each `number`-typed integer width. `usize` is the
 * reference's 64-bit size type over the integers a `number` holds exactly,
 * `[0, 2^53 - 1]`; larger sizes take the `bigint` (`U64`) samplers.
 */
export const WIDTH: Readonly<
  Record<"u8" | "u16" | "u32" | "i8" | "i16" | "i32" | "usize", Bounds>
> = {
  u8: { min: 0, max: 0xff },
  u16: { min: 0, max: 0xffff },
  u32: { min: 0, max: 0xffffffff },
  i8: { min: -0x80, max: 0x7f },
  i16: { min: -0x8000, max: 0x7fff },
  i32: { min: -0x80000000, max: 0x7fffffff },
  usize: { min: 0, max: Number.MAX_SAFE_INTEGER },
};

export const U64_MAX: bigint = 0xffffffffffffffffn;
export const I64_MIN: bigint = -(1n << 63n);
export const I64_MAX: bigint = (1n << 63n) - 1n;
