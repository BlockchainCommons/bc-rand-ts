import { n as RngOptions, t as RandomNumberGenerator } from "./rng-g0VEAyUb.mjs";
//#region src/secure-rng.d.ts
/** Fill `dest` with cryptographically secure random bytes. */
declare function fillSecureRandomBytes(dest: Uint8Array): void;
/** `size` cryptographically secure random bytes. */
declare function secureRandomBytes(size: number): Uint8Array<ArrayBuffer>;
/**
 * A generator backed by Web Crypto (`crypto.getRandomValues`), available in
 * every modern browser and in Node >= 15.
 */
declare class SecureRng implements RandomNumberGenerator {
  get [Symbol.toStringTag](): string;
  /** The low 32 bits of a 64-bit draw. */
  nextU32(): number;
  nextU64(): bigint;
  fillBytes(dest: Uint8Array): void;
}
/** A fresh secure generator. Every instance draws from the same platform source. */
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
 * The all-zero seed is a fixed point (every output is zero) and is rejected.
 */
declare class SeededRng implements RandomNumberGenerator {
  private readonly core;
  get [Symbol.toStringTag](): string;
  /**
   * @param seed - four 64-bit words, or 32 little-endian bytes (the byte
   *   layout `rand_xoshiro`'s `from_seed` reads).
   */
  constructor(seed: Seed | Uint8Array);
  /** A generator seeded with {@link TEST_SEED}. */
  static forTesting(): SeededRng;
  nextU64(): bigint;
  /** The low 32 bits of a 64-bit draw. */
  nextU32(): number;
  /**
   * One 64-bit draw per byte, keeping the low byte. Deliberately wasteful:
   * it is what the reference implementations do, and every seeded fixture
   * downstream depends on it.
   */
  fillBytes(dest: Uint8Array): void;
}
//#endregion
//#region src/helpers.d.ts
/** `size` random bytes from `options.rng` (default: secure). */
declare function randomBytes(size: number, options?: RngOptions): Uint8Array<ArrayBuffer>;
/** Fill `dest` from `options.rng` (default: secure). */
declare function fillRandomBytes(dest: Uint8Array, options?: RngOptions): void;
/** A random boolean: whether the next 32-bit draw is even. */
declare function randomBool(options?: RngOptions): boolean;
/** `size` bytes from a fresh {@link SeededRng.forTesting} generator. */
declare function testRandomBytes(size: number): Uint8Array<ArrayBuffer>;
//#endregion
export { type RandomNumberGenerator, type RngOptions, SecureRng, type Seed, SeededRng, TEST_SEED, fillRandomBytes, fillSecureRandomBytes, randomBool, randomBytes, secureRandomBytes, secureRng, testRandomBytes };
//# sourceMappingURL=index.d.mts.map