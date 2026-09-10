/**
 * The random number generator contract and the byte/bool helpers built on it.
 *
 * @module rng
 */

/**
 * A source of random 32- and 64-bit words and bytes.
 *
 * Both integer widths are part of the contract: which one a caller draws
 * determines the bytes it produces, so implementations must not derive one
 * from the other differently than the reference implementations do
 * (`nextU32()` is the low 32 bits of a 64-bit draw).
 */
export interface RandomNumberGenerator {
  /** The next random 32-bit unsigned integer. */
  nextU32(): number;
  /** The next random 64-bit unsigned integer. */
  nextU64(): bigint;
  /** Fill `dest` with random bytes. */
  fillBytes(dest: Uint8Array): void;
}

/** Options for the helpers that draw from a generator. */
export interface RngOptions {
  /** The generator to draw from. Defaults to a cryptographically secure one. */
  readonly rng?: RandomNumberGenerator | undefined;
}
