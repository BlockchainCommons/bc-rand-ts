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
  /** Debug label: `Object.prototype.toString` reports the class name. */
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
  /** Debug label: `Object.prototype.toString` reports the class name. */
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
//#region src/xoshiro.d.ts
/**
 * xoshiro256** on 32-bit halves.
 *
 * The state is four 64-bit words held as eight `Uint32` lanes
 * (`[s0lo, s0hi, s1lo, s1hi, s2lo, s2hi, s3lo, s3hi]`). Every step is done
 * with 32-bit integer arithmetic; no `bigint` is created unless the caller
 * asks for the 64-bit result. This is the same algorithm as `rand_xoshiro`'s
 * `Xoshiro256StarStar` and produces identical output for identical seeds.
 *
 * @internal
 */
declare class Xoshiro256StarStar {
  private readonly s;
  /** Low 32 bits of the most recent output. */
  outLo: number;
  /** High 32 bits of the most recent output. */
  outHi: number;
  constructor(seed: readonly [bigint, bigint, bigint, bigint]);
  /** Advance the generator once; the output lands in `outLo`/`outHi`. */
  step(): void;
  nextU64(): bigint;
  /** Low 32 bits of the next 64-bit output (one step, no bigint). */
  nextU32(): number;
  /** Low byte of the next 64-bit output (one step per byte, as the reference). */
  nextByte(): number;
  /** The 256-bit state as 32 little-endian bytes (four `u64` words). */
  toBytes(): Uint8Array;
  /** The generator whose state is `bytes` (32 little-endian bytes, as `toBytes` gives). */
  static fromBytes(bytes: Uint8Array): Xoshiro256StarStar;
  /** `length` bytes, one generator step per byte (the low byte of each output). */
  nextBytes(length: number): Uint8Array;
  /** Fills `dest` eight bytes per step (little-endian), as rand_core's `fill_bytes_via_next`. */
  fillBytes(dest: Uint8Array): void;
}
//#endregion
export { type RandomNumberGenerator, type RngOptions, SecureRng, type Seed, SeededRng, TEST_SEED, Xoshiro256StarStar, fillRandomBytes, fillSecureRandomBytes, randomBool, randomBytes, secureRandomBytes, secureRng, testRandomBytes };
//# sourceMappingURL=index.d.mts.map