/**
 * Byte and boolean helpers over any generator.
 *
 * @module bytes
 */
import { expectInt } from "./domain.js";
import type { RandomNumberGenerator, RngOptions } from "./rng.js";
import { secureRng } from "./secure-rng.js";
import { SeededRng } from "./seeded-rng.js";

const rngOf = (options?: RngOptions): RandomNumberGenerator => options?.rng ?? secureRng();

/**
 * `size` random bytes from `options.rng` (default: the secure generator).
 *
 * @throws {RangeError} when `size` is not a non-negative integer.
 */
export function randomBytes(size: number, options?: RngOptions): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(expectInt(size, 0, Number.MAX_SAFE_INTEGER, "size"));
  rngOf(options).fillBytes(data);
  return data;
}

/** Fill `dest` from `options.rng` (default: the secure generator). */
export function fillRandomBytes(dest: Uint8Array, options?: RngOptions): void {
  rngOf(options).fillBytes(dest);
}

/** A random boolean: whether the next 32-bit draw is even. */
export function randomBool(options?: RngOptions): boolean {
  return (rngOf(options).nextU32() & 1) === 0;
}

/** `size` bytes from a fresh {@link SeededRng.forTesting} generator (the reference's `fake_random_data`). */
export function testRandomBytes(size: number): Uint8Array<ArrayBuffer> {
  return randomBytes(size, { rng: SeededRng.forTesting() });
}
