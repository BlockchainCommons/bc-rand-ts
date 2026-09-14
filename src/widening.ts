/**
 * Wide (double-width) unsigned multiplication: the samplers' arithmetic.
 * Not part of the public API; the unit tests also exercise it directly.
 *
 * @internal
 * @module widening
 */
/** The low and high halves of an N-bit × N-bit product, each N bits wide. @internal */
export type WideMulResult = [bigint, bigint];

/** `a * b` as `bigint`, split into `bits`-wide low/high halves. @internal */
export function wideMul(a: bigint, b: bigint, bits: number): WideMulResult {
  const mask = (1n << BigInt(bits)) - 1n;
  const wide = (a & mask) * (b & mask);
  const low = wide & mask;
  const high = wide >> BigInt(bits);
  return [low, high];
}

/** `a * b` for `u8` operands, as `[low 8 bits, high 8 bits]`. @internal */
export function wideMulU8(a: number, b: number): [number, number] {
  const wide = (a & 0xff) * (b & 0xff);
  return [wide & 0xff, (wide >> 8) & 0xff];
}

/** `a * b` for `u16` operands, as `[low 16 bits, high 16 bits]`. @internal */
export function wideMulU16(a: number, b: number): [number, number] {
  const wide = (a & 0xffff) * (b & 0xffff);
  return [wide & 0xffff, (wide >>> 16) & 0xffff];
}

/**
 * `a * b` for `u32` operands, as `[low 32 bits, high 32 bits]` (`bigint`; see
 * {@link wideMulU32Parts} for the `number`-only form).
 *
 * @internal
 */
export function wideMulU32(a: number, b: number): [bigint, bigint] {
  const { lo, hi } = wideMulU32Parts(a, b);
  return [BigInt(lo), BigInt(hi)];
}

/**
 * 32×32→64 multiply without `bigint`: 16-bit limbs, all partial products
 * exact in double precision. Returns unsigned 32-bit halves.
 *
 * @internal
 */
export function wideMulU32Parts(a: number, b: number): { lo: number; hi: number } {
  a >>>= 0;
  b >>>= 0;
  const al = a & 0xffff,
    ah = a >>> 16;
  const bl = b & 0xffff,
    bh = b >>> 16;
  const ll = al * bl;
  const mid = al * bh + ah * bl; // < 2^33, exact
  const midLo = (mid % 65536) * 65536;
  const midHi = Math.floor(mid / 65536);
  let lo = ll + midLo; // < 2^33, exact
  const carry = Math.floor(lo / 4294967296);
  lo = lo % 4294967296;
  const hi = ah * bh + midHi + carry;
  return { lo, hi };
}

/** `a * b` for `u64` operands, as `[low 64 bits, high 64 bits]`. @internal */
export function wideMulU64(a: bigint, b: bigint): [bigint, bigint] {
  const mask64 = 0xffffffffffffffffn;
  const wide = (a & mask64) * (b & mask64);
  return [wide & mask64, wide >> 64n];
}
