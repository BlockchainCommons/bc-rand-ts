/**
 * Deterministic randomness for tests and cross-platform fixtures.
 *
 * @module seeded-rng
 */
import { U64_MAX, isBytes } from "./domain.js";
import { RandError } from "./error.js";
import type { RandomNumberGenerator } from "./rng.js";
import { Xoshiro256StarStar } from "./xoshiro.js";

/** A 256-bit seed as four 64-bit words. */
export type Seed = readonly [bigint, bigint, bigint, bigint];

/**
 * The fixed seed behind {@link SeededRng.forTesting}. Shared with the Rust
 * and Swift reference implementations so cross-platform fixtures agree.
 */
export const TEST_SEED: Seed = Object.freeze([
  17295166580085024720n,
  422929670265678780n,
  5577237070365765850n,
  7953171132032326923n,
] as const);

function wordsFromBytes(bytes: Uint8Array): Seed {
  if (bytes.length !== 32) {
    throw RandError.invalidSeed("seed byte length", "an integer in [32, 32]", bytes.length);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, 32);
  return [
    view.getBigUint64(0, true),
    view.getBigUint64(8, true),
    view.getBigUint64(16, true),
    view.getBigUint64(24, true),
  ];
}

/** `value` as the `u64` word `seed[index]`; the reference's `[u64; 4]` element type. */
function expectWord(value: unknown, index: number): bigint {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw RandError.invalidSeed(`seed[${index}]`, "an integer in [0, 18446744073709551615]", value);
  }
  return value;
}

/**
 * The four words of an array seed, validated by index (so a hole reports
 * `got undefined`). Anything that is not an array of length 4 — a shorter or
 * longer array, a typed array other than `Uint8Array`, an `ArrayBuffer`, a
 * `DataView`, a string — is rejected: the reference's seed is `[u64; 4]`.
 */
function wordsFromArray(seed: unknown): Seed {
  if (!Array.isArray(seed) || seed.length !== 4) {
    throw RandError.invalidSeed("seed", "four u64 words or 32 bytes", seed);
  }
  const w = seed as readonly unknown[];
  return [expectWord(w[0], 0), expectWord(w[1], 1), expectWord(w[2], 2), expectWord(w[3], 3)];
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
 * depends on. {@link SeededRng.fillBytesPacked} is the other stream,
 * `rand_core`'s packed `fill_bytes`.
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
   * @throws {RandError} `InvalidSeed` unless `seed` is an array of exactly
   *   four `bigint`s in `[0, 2^64 - 1]` (holes and other element types are
   *   rejected) or a `Uint8Array` of exactly 32 bytes. Other typed arrays,
   *   `ArrayBuffer`s and `DataView`s are rejected.
   */
  constructor(seed: Seed | Uint8Array) {
    const words = isBytes(seed) ? wordsFromBytes(seed) : wordsFromArray(seed);
    const zero = words[0] === 0n && words[1] === 0n && words[2] === 0n && words[3] === 0n;
    this.core = new Xoshiro256StarStar(zero ? splitMix64Of(0n) : words);
  }

  /** A generator seeded with {@link TEST_SEED}. */
  static forTesting(): SeededRng {
    return new SeededRng(TEST_SEED);
  }

  /**
   * The generator whose state is exactly `state`: the 32 little-endian bytes
   * {@link SeededRng.state} returns, restored with **no** all-zero
   * substitution. This is provenance-mark's `Xoshiro256StarStar::from_data`;
   * `bc-rand` itself has no raw-state constructor. An all-zero state is
   * xoshiro's fixed point and draws zeros forever, as it does there; the
   * constructor, which is `from_seed`, substitutes it instead.
   *
   * @throws {RandError} `InvalidSeed` unless `state` is a `Uint8Array` of exactly 32 bytes.
   */
  static fromState(state: Uint8Array): SeededRng {
    if (!isBytes(state)) throw RandError.invalidSeed("state byte length", "32 bytes", state);
    if (state.length !== 32) {
      throw RandError.invalidSeed("state byte length", "an integer in [32, 32]", state.length);
    }
    const rng = new SeededRng(TEST_SEED);
    rng.core.loadBytes(state);
    return rng;
  }

  /**
   * The 256-bit state as 32 little-endian bytes (a copy);
   * {@link SeededRng.fromState} resumes it exactly. (`new SeededRng(state)`
   * also resumes every state a generator can reach, but substitutes an
   * all-zero one.)
   */
  get state(): Uint8Array<ArrayBuffer> {
    return this.core.toBytes();
  }

  /** An independent generator at the same state. */
  clone(): SeededRng {
    return SeededRng.fromState(this.state);
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

  /**
   * One 64-bit draw per byte, keeping the low byte (the reference's `fill_random_data`).
   * @throws {RandError} `InvalidArgument` unless `dest` is a `Uint8Array`.
   */
  fillBytes(dest: Uint8Array): void {
    if (!isBytes(dest)) throw RandError.invalidDest("dest", dest);
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
   * @throws {RandError} `InvalidArgument` unless `dest` is a `Uint8Array`.
   */
  fillBytesPacked(dest: Uint8Array): void {
    if (!isBytes(dest)) throw RandError.invalidDest("dest", dest);
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
