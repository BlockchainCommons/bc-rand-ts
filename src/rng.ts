/**
 * The random number generator contract.
 *
 * @module rng
 */

/**
 * A source of random 32-bit words, 64-bit words and bytes.
 *
 * `nextU32` and `nextU64` are two draws; which one a caller uses, and in what
 * order, determines the bytes it produces. The samplers in `/samplers` draw
 * `nextU64()` (masked to their width), as the reference implementation does
 * for every width. The package's own generators return the low half of one
 * 64-bit step from `nextU32`, as the reference's wrappers do; a third-party
 * generator may relate the two draws however it likes.
 */
export interface RandomNumberGenerator {
  /** The next random 32-bit unsigned integer. */
  nextU32(): number;
  /** The next random 64-bit unsigned integer. */
  nextU64(): bigint;
  /** Fill `dest` with random bytes. */
  fillBytes(dest: Uint8Array): void;
  /**
   * Optional fast path for the samplers: the low 32 bits of the value
   * `nextU64()` would have returned, advancing the generator exactly as
   * `nextU64()` does, without allocating a `bigint`. Implement it only when
   * that equality holds; the package's generators do.
   */
  nextU64Low32?(): number;
  /**
   * Fills `dest` from the generator's *packed* byte stream — `rand_core`'s
   * `fill_bytes` layout: eight little-endian bytes per 64-bit draw, a tail of
   * five to seven bytes from one more draw, a tail of one to four bytes from
   * the generator's own 32-bit draw. Only a generator whose `fillBytes` is a
   * different stream needs to implement it ({@link SeededRng} does: its
   * `fillBytes` is the reference's `fill_random_data`, one draw per byte);
   * absent, the two streams are the same and callers use `fillBytes`.
   */
  fillBytesPacked?(dest: Uint8Array): void;
}

/** Options for the helpers that draw from a generator. */
export interface RngOptions {
  /** The generator to draw from. Defaults to a cryptographically secure one. */
  readonly rng?: RandomNumberGenerator | undefined;
}

/**
 * The low 32 bits of one 64-bit draw from `rng` — the samplers' draw — using
 * the fast path when the generator offers it.
 *
 * @internal
 */
export function drawLow32(rng: RandomNumberGenerator): number {
  return rng.nextU64Low32?.() ?? Number(rng.nextU64() & 0xffffffffn);
}
