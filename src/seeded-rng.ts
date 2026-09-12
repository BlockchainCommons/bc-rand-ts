/**
 * Deterministic randomness for tests and cross-platform fixtures.
 *
 * @module seeded-rng
 */
import { U64_MAX, expectBigInt, expectInt } from "./domain.js";
import type { RandomNumberGenerator } from "./rng.js";
import { Xoshiro256StarStar } from "./xoshiro.js";

/** A 256-bit seed as four 64-bit words. */
export type Seed = readonly [bigint, bigint, bigint, bigint];

/**
 * The fixed seed behind {@link SeededRng.forTesting}. Shared with the Rust
 * and Swift reference implementations so cross-platform fixtures agree.
 */
export const TEST_SEED: Seed = [
  17295166580085024720n,
  422929670265678780n,
  5577237070365765850n,
  7953171132032326923n,
];

function wordsFromBytes(bytes: Uint8Array): Seed {
  expectInt(bytes.length, 32, 32, "seed byte length");
  const view = new DataView(bytes.buffer, bytes.byteOffset, 32);
  return [
    view.getBigUint64(0, true),
    view.getBigUint64(8, true),
    view.getBigUint64(16, true),
    view.getBigUint64(24, true),
  ];
}

/**
 * The words the reference substitutes for an all-zero seed: `rand_xoshiro`'s
 * `from_seed` replaces it with `seed_from_u64(0)`, the SplitMix64 expansion
 * of zero (an all-zero xoshiro state is a fixed point that would output zero
 * forever).
 */
function splitMix64Of(seed: bigint): Seed {
  let state = seed;
  const words: bigint[] = [];
  for (let i = 0; i < 4; i++) {
    state = (state + 0x9e3779b97f4a7c15n) & U64_MAX;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & U64_MAX;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & U64_MAX;
    words.push((z ^ (z >> 31n)) & U64_MAX);
  }
  return words as unknown as Seed;
}

/** Four little-endian bytes of `value` at `offset`. */
function writeU32(dest: Uint8Array, offset: number, value: number): void {
  dest[offset] = value & 0xff;
  dest[offset + 1] = (value >>> 8) & 0xff;
  dest[offset + 2] = (value >>> 16) & 0xff;
  dest[offset + 3] = value >>> 24;
}

/** The first `count` (1–4) little-endian bytes of `value` at `offset`. */
function writeTail(dest: Uint8Array, offset: number, value: number, count: number): void {
  for (let k = 0; k < count; k++) dest[offset + k] = (value >>> (8 * k)) & 0xff;
}

/**
 * A deterministic generator (xoshiro256**), identical to `rand_xoshiro`'s
 * `Xoshiro256StarStar` for the same seed.
 *
 * NOT cryptographically secure. For tests and reproducible fixtures only.
 *
 * `fillBytes` draws one 64-bit word per byte and keeps its low byte — the
 * reference's `fill_random_data`, which every seeded fixture downstream
 * depends on. (`rand_core`'s packed eight-bytes-per-draw `fill_bytes` is not
 * exposed.)
 */
export class SeededRng implements RandomNumberGenerator {
  private readonly core: Xoshiro256StarStar;

  /** Debug label: `Object.prototype.toString` reports the class name. */
  // A prototype getter has zero per-instance cost; the readonly field the
  // stylistic rule prefers would allocate one own property per instance.
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get [Symbol.toStringTag](): string {
    return "SeededRng";
  }

  /**
   * @param seed - four 64-bit words, or 32 little-endian bytes (the byte
   *   layout `rand_xoshiro`'s `from_seed` reads, and the one {@link SeededRng.state}
   *   returns). An all-zero seed is replaced by the SplitMix64 expansion of
   *   zero, as the reference does.
   * @throws {RangeError} when a word is outside `u64` or the bytes are not 32.
   */
  constructor(seed: Seed | Uint8Array) {
    let words = seed instanceof Uint8Array ? wordsFromBytes(seed) : seed;
    words.forEach((w, i) => expectBigInt(w, 0n, U64_MAX, `seed[${i}]`));
    if (words.every((w) => w === 0n)) words = splitMix64Of(0n);
    this.core = new Xoshiro256StarStar(words);
  }

  /** A generator seeded with {@link TEST_SEED}. */
  static forTesting(): SeededRng {
    return new SeededRng(TEST_SEED);
  }

  /** The 256-bit state as 32 little-endian bytes (a copy); `new SeededRng(state)` resumes it. */
  get state(): Uint8Array<ArrayBuffer> {
    return this.core.toBytes();
  }

  /** An independent generator at the same state. */
  clone(): SeededRng {
    return new SeededRng(this.state);
  }

  /** The next 64-bit output of xoshiro256**. */
  nextU64(): bigint {
    return this.core.nextU64();
  }

  /** The low 32 bits of a 64-bit draw (the reference wrapper's `next_u32`). */
  nextU32(): number {
    return this.core.nextU32();
  }

  /** The samplers' fast path: one step, low 32 bits, no `bigint`. */
  nextU64Low32(): number {
    return this.core.nextU32();
  }

  /** One 64-bit draw per byte, keeping the low byte (the reference's `fill_random_data`). */
  fillBytes(dest: Uint8Array): void {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = this.core.nextByte();
    }
  }

  /**
   * The reference's `RngCore::fill_bytes` stream (`rand_core`'s
   * `fill_bytes_via_next` over xoshiro256**): eight little-endian bytes per
   * 64-bit step; a tail of five to seven bytes from one more step; a tail of
   * one to four bytes from xoshiro's own `next_u32`, the *high* half of a
   * step. This is what reference code reaching the generator through
   * `rand_core` generics draws (e.g. `bc-crypto`'s Ed25519 key generation);
   * {@link SeededRng.fillBytes} is the other stream, `fill_random_data`.
   */
  fillBytesPacked(dest: Uint8Array): void {
    const core = this.core;
    const n = dest.length;
    let i = 0;
    for (; i + 8 <= n; i += 8) {
      core.step();
      writeU32(dest, i, core.outLo);
      writeU32(dest, i + 4, core.outHi);
    }
    const left = n - i;
    if (left > 4) {
      core.step();
      writeU32(dest, i, core.outLo);
      writeTail(dest, i + 4, core.outHi, left - 4);
    } else if (left > 0) {
      core.step();
      writeTail(dest, i, core.outHi, left);
    }
  }
}
