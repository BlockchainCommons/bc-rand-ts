import { n as RngOptions, t as RandomNumberGenerator } from "./rng-CTLyw_Hv.mjs";
//#region src/secure-rng.d.ts
/**
 * A generator backed by Web Crypto (`crypto.getRandomValues`), available in
 * every modern browser and in Node >= 15. It holds no state: every instance
 * draws from the same platform source.
 *
 * @throws {TypeError} from any draw when the environment has no Web Crypto API.
 */
declare class SecureRng implements RandomNumberGenerator {
  /** Debug label: `Object.prototype.toString` reports the class name. */
  get [Symbol.toStringTag](): string;
  /** The low 32 bits of an 8-byte draw. */
  nextU32(): number;
  /** An 8-byte draw as a little-endian `u64`. */
  nextU64(): bigint;
  /** The samplers' fast path: one 8-byte draw, low 32 bits, no `bigint`. */
  nextU64Low32(): number;
  /** Fill `dest` with secure random bytes. */
  fillBytes(dest: Uint8Array): void;
}
/** A fresh secure generator (the reference's `thread_rng()`). */
declare function secureRng(): SecureRng;
//#endregion
//#region src/seeded-rng.d.ts
/** A 256-bit seed as four 64-bit words. */
type Seed = readonly [bigint, bigint, bigint, bigint];
/**
 * The fixed seed behind {@link SeededRng.forTesting}. Shared with the Rust
 * and Swift reference implementations so cross-platform fixtures agree.
 */
declare const TEST_SEED: Seed;
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
declare class SeededRng implements RandomNumberGenerator {
  private readonly core;
  /** Debug label: `Object.prototype.toString` reports the class name. */
  get [Symbol.toStringTag](): string;
  /**
   * @param seed - four 64-bit words, or 32 little-endian bytes (the byte
   *   layout `rand_xoshiro`'s `from_seed` reads, and the one {@link SeededRng.state}
   *   returns). An all-zero seed is replaced by the SplitMix64 expansion of
   *   zero, as the reference does.
   * @throws {RangeError} when a word is outside `u64` or the bytes are not 32.
   */
  constructor(seed: Seed | Uint8Array);
  /** A generator seeded with {@link TEST_SEED}. */
  static forTesting(): SeededRng;
  /** The 256-bit state as 32 little-endian bytes (a copy); `new SeededRng(state)` resumes it. */
  get state(): Uint8Array<ArrayBuffer>;
  /** An independent generator at the same state. */
  clone(): SeededRng;
  /** The next 64-bit output of xoshiro256**. */
  nextU64(): bigint;
  /** The low 32 bits of a 64-bit draw (the reference wrapper's `next_u32`). */
  nextU32(): number;
  /** The samplers' fast path: one step, low 32 bits, no `bigint`. */
  nextU64Low32(): number;
  /** One 64-bit draw per byte, keeping the low byte (the reference's `fill_random_data`). */
  fillBytes(dest: Uint8Array): void;
}
//#endregion
//#region src/bytes.d.ts
/**
 * `size` random bytes from `options.rng` (default: the secure generator).
 *
 * @throws {RangeError} when `size` is not a non-negative integer.
 */
declare function randomBytes(size: number, options?: RngOptions): Uint8Array<ArrayBuffer>;
/** Fill `dest` from `options.rng` (default: the secure generator). */
declare function fillRandomBytes(dest: Uint8Array, options?: RngOptions): void;
/** A random boolean: whether the next 32-bit draw is even. */
declare function randomBool(options?: RngOptions): boolean;
/** `size` bytes from a fresh {@link SeededRng.forTesting} generator (the reference's `fake_random_data`). */
declare function testRandomBytes(size: number): Uint8Array<ArrayBuffer>;
//#endregion
export { type RandomNumberGenerator, type RngOptions, SecureRng, type Seed, SeededRng, TEST_SEED, fillRandomBytes, randomBool, randomBytes, secureRng, testRandomBytes };
//# sourceMappingURL=index.d.mts.map