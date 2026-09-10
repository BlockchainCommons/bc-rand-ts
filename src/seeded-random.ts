/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-rand-rust/src/seeded_random.rs

import type { RandomNumberGenerator } from "./random-number-generator.js";
import { Xoshiro256StarStar } from "./xoshiro.js";

/**
 * A random number generator that can be used as a source of deterministic
 * pseudo-randomness for testing purposes.
 *
 * Uses the Xoshiro256** algorithm, which is the same algorithm used by
 * rand_xoshiro in Rust. This ensures cross-platform compatibility with
 * the Rust implementation.
 *
 * WARNING: This is NOT cryptographically secure and should only be used
 * for testing purposes.
 */
export class SeededRandomNumberGenerator implements RandomNumberGenerator {
  private readonly core: Xoshiro256StarStar;

  /**
   * Creates a new seeded random number generator.
   *
   * The seed should be a 256-bit value, represented as an array of 4 64-bit
   * integers (as bigints). For the output distribution to look random, the seed
   * should not have any obvious patterns, like all zeroes or all ones.
   *
   * This is not cryptographically secure, and should only be used for
   * testing purposes.
   *
   * @param seed - Array of 4 64-bit unsigned integers as bigints
   */
  constructor(seed: [bigint, bigint, bigint, bigint]) {
    this.core = new Xoshiro256StarStar(seed);
  }

  /**
   * Returns the next random 64-bit unsigned integer as a bigint.
   */
  nextU64(): bigint {
    return this.core.nextU64();
  }

  /**
   * Returns the next random 32-bit unsigned integer.
   */
  nextU32(): number {
    return this.core.nextU32();
  }

  /**
   * Fills the given Uint8Array with random bytes.
   *
   * Note: This implementation matches the Rust behavior exactly -
   * it uses one nextU64() call per byte (taking only the low byte),
   * which matches the Swift version's behavior.
   */
  fillBytes(dest: Uint8Array): void {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = this.core.nextByte();
    }
  }

  /**
   * Returns a Uint8Array of random bytes of the given size.
   *
   * This might not be the most efficient implementation,
   * but it works the same as the Swift version.
   */
  randomData(size: number): Uint8Array {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = this.core.nextByte();
    }
    return data;
  }

  /**
   * Fills the given Uint8Array with random bytes.
   */
  fillRandomData(data: Uint8Array): void {
    this.fillBytes(data);
  }
}

/**
 * Standard test seed for `makeFakeRandomNumberGenerator`. Module-private to
 * mirror Rust where the equivalent constant lives inside `mod tests`.
 */
const TEST_SEED: [bigint, bigint, bigint, bigint] = [
  17295166580085024720n,
  422929670265678780n,
  5577237070365765850n,
  7953171132032326923n,
];

/**
 * Creates a seeded random number generator with a fixed seed.
 * This is useful for reproducible testing across different platforms.
 */
export function makeFakeRandomNumberGenerator(): SeededRandomNumberGenerator {
  return new SeededRandomNumberGenerator(TEST_SEED);
}

/**
 * Creates a Uint8Array of random data with a fixed seed.
 * This is useful for reproducible testing.
 *
 * @param size - The number of bytes to generate
 * @returns A Uint8Array of pseudo-random bytes
 */
export function fakeRandomData(size: number): Uint8Array {
  return makeFakeRandomNumberGenerator().randomData(size);
}
