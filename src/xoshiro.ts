/**
 * xoshiro256** on 32-bit halves — the seeded generator's core.
 *
 * The state is four 64-bit words held as eight `Uint32` lanes
 * (`[s0lo, s0hi, s1lo, s1hi, s2lo, s2hi, s3lo, s3hi]`). Every step is done
 * with 32-bit integer arithmetic; no `bigint` is created unless the caller
 * asks for the 64-bit result. This is the same algorithm as `rand_xoshiro`'s
 * `Xoshiro256StarStar` and produces identical output for identical seeds.
 *
 * @internal
 */
export class Xoshiro256StarStar {
  private readonly s: Uint32Array;
  /** Low 32 bits of the most recent output. */
  outLo = 0;
  /** High 32 bits of the most recent output. */
  outHi = 0;

  /**
   * @param seed - four 64-bit words, or the eight `Uint32` lanes themselves
   *   (adopted, not copied).
   */
  constructor(seed: readonly [bigint, bigint, bigint, bigint] | Uint32Array) {
    if (seed instanceof Uint32Array) {
      this.s = seed;
      return;
    }
    const s = new Uint32Array(8);
    for (let i = 0; i < 4; i++) {
      const w = seed[i] & 0xffffffffffffffffn;
      s[i * 2] = Number(w & 0xffffffffn);
      s[i * 2 + 1] = Number(w >> 32n);
    }
    this.s = s;
  }

  /**
   * The generator whose state is exactly `bytes` (see `loadBytes`), built
   * without going through a `bigint` seed. The caller has checked the length.
   */
  static fromBytes(bytes: Uint8Array): Xoshiro256StarStar {
    const view = new DataView(bytes.buffer, bytes.byteOffset, 32);
    const s = new Uint32Array(8);
    for (let i = 0; i < 8; i++) s[i] = view.getUint32(i * 4, true);
    return new Xoshiro256StarStar(s);
  }

  /** Advance the generator once; the output lands in `outLo`/`outHi`. */
  step(): void {
    const s = this.s;
    const s0lo = s[0],
      s0hi = s[1],
      s1lo = s[2],
      s1hi = s[3];
    const s2lo = s[4],
      s2hi = s[5],
      s3lo = s[6],
      s3hi = s[7];

    // result = rotl(s1 * 5, 7) * 9
    let p = s1lo * 5;
    const mlo = p >>> 0;
    const mhi = (Math.imul(s1hi, 5) + Math.floor(p / 4294967296)) >>> 0;
    // rotl 7
    const rlo = ((mlo << 7) | (mhi >>> 25)) >>> 0;
    const rhi = ((mhi << 7) | (mlo >>> 25)) >>> 0;
    p = rlo * 9;
    this.outLo = p >>> 0;
    this.outHi = (Math.imul(rhi, 9) + Math.floor(p / 4294967296)) >>> 0;

    // t = s1 << 17
    const tlo = (s1lo << 17) >>> 0;
    const thi = ((s1hi << 17) | (s1lo >>> 15)) >>> 0;

    let n2lo = (s2lo ^ s0lo) >>> 0,
      n2hi = (s2hi ^ s0hi) >>> 0; // s2 ^= s0
    let n3lo = (s3lo ^ s1lo) >>> 0,
      n3hi = (s3hi ^ s1hi) >>> 0; // s3 ^= s1
    const n1lo = (s1lo ^ n2lo) >>> 0,
      n1hi = (s1hi ^ n2hi) >>> 0; // s1 ^= s2
    const n0lo = (s0lo ^ n3lo) >>> 0,
      n0hi = (s0hi ^ n3hi) >>> 0; // s0 ^= s3
    n2lo = (n2lo ^ tlo) >>> 0;
    n2hi = (n2hi ^ thi) >>> 0; // s2 ^= t
    // s3 = rotl(s3, 45) = swap halves, then rotl 13
    const swlo = n3hi,
      swhi = n3lo;
    n3lo = ((swlo << 13) | (swhi >>> 19)) >>> 0;
    n3hi = ((swhi << 13) | (swlo >>> 19)) >>> 0;

    s[0] = n0lo;
    s[1] = n0hi;
    s[2] = n1lo;
    s[3] = n1hi;
    s[4] = n2lo;
    s[5] = n2hi;
    s[6] = n3lo;
    s[7] = n3hi;
  }

  nextU64(): bigint {
    this.step();
    return (BigInt(this.outHi) << 32n) | BigInt(this.outLo);
  }

  /**
   * Low 32 bits of the next 64-bit output (one step, no bigint).
   *
   * This is the reference *wrapper*'s `next_u32` (`next_u64() as u32`), which
   * every seeded fixture depends on. `rand_xoshiro`'s own `next_u32` takes the
   * high half instead (`outHi` after a step); it feeds only the 1–4-byte tail
   * of `SeededRng.fillBytesPacked`.
   */
  nextU32(): number {
    this.step();
    return this.outLo;
  }

  /** Low byte of the next 64-bit output (one step per byte, as the reference). */
  nextByte(): number {
    this.step();
    return this.outLo & 0xff;
  }

  /** The 256-bit state as 32 little-endian bytes (four `u64` words). */
  toBytes(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(32);
    const view = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) view.setUint32(i * 4, this.s[i], true);
    return out;
  }

  /**
   * Overwrite the state with `bytes` (32 little-endian bytes, as `toBytes`
   * gives), exactly: no all-zero substitution, so an all-zero state stays
   * the fixed point, as provenance-mark's `Xoshiro256StarStar::from_data`
   * leaves it. The caller has checked the length.
   */
  loadBytes(bytes: Uint8Array): void {
    const view = new DataView(bytes.buffer, bytes.byteOffset, 32);
    for (let i = 0; i < 8; i++) this.s[i] = view.getUint32(i * 4, true);
  }

  /** `length` bytes, one generator step per byte (the low byte of each output). */
  nextBytes(length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = this.nextByte();
    return out;
  }
}
