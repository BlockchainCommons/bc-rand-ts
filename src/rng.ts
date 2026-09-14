/**
 * The random number generator contract.
 *
 * @module rng
 */
import { U64_MAX, memberOf } from "./domain.js";
import { RandError } from "./error.js";

/**
 * A source of random 32-bit words, 64-bit words and bytes.
 *
 * `nextU32` and `nextU64` are two draws; which one a caller uses, and in what
 * order, determines the bytes it produces. The samplers in `/samplers` draw
 * `nextU64()` (masked to their width), as the reference implementation does
 * for every width. The package's own generators return the low half of one
 * 64-bit step from `nextU32`, as the reference's wrappers do; a third-party
 * generator may relate the two draws however it likes.
 *
 * The contract is checked at every draw: `nextU64()` must return a `bigint`
 * in `[0, 2^64 - 1]`, `nextU32()` and `nextU64Low32()` an integer in
 * `[0, 2^32 - 1]`, and the member a helper or sampler calls must exist. A
 * violation, or an `undefined`/`null` generator passed straight to a sampler,
 * throws {@link RandError} `InvalidGenerator` naming the member; nothing is
 * masked. A generator that meets the contract but never leaves Lemire's
 * rejection zone (for example a constant draw of 0) makes a sampler loop
 * forever, as it does in the reference.
 */
export interface RandomNumberGenerator {
  /** The next random 32-bit unsigned integer. */
  nextU32(): number;
  /** The next random 64-bit unsigned integer, a `bigint` in `[0, 2^64 - 1]`. */
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
   * `fill_bytes` layout (`fill_bytes_via_next`): eight little-endian bytes
   * per 64-bit draw, a tail of five to seven bytes from one more 64-bit draw,
   * a tail of one to four bytes from the `next_u32` of the underlying
   * `rand_core` generator. For {@link SeededRng} that generator is
   * xoshiro256** behind the reference's wrapper, whose `next_u32` is the
   * *high* half of one more step — not `nextU32()`, which is the wrapper's
   * low half. Only a generator whose `fillBytes` is a different stream needs
   * to implement it ({@link SeededRng} does: its `fillBytes` is the
   * reference's `fill_random_data`, one draw per byte); absent, the two
   * streams are the same and callers use `fillBytes`.
   */
  fillBytesPacked?(dest: Uint8Array): void;
}

/** Options for the helpers that draw from a generator. */
export interface RngOptions {
  /** The generator to draw from. Defaults to a cryptographically secure one. */
  readonly rng?: RandomNumberGenerator | undefined;
}

/**
 * One 64-bit draw from `rng` — the samplers' draw — checked against the
 * contract: a `bigint` in `[0, 2^64 - 1]`. The samplers take `rng` directly,
 * so here an `undefined`/`null` generator is a broken one, not "use the
 * secure generator".
 *
 * @internal
 */
export function drawU64(rng: RandomNumberGenerator): bigint {
  if (rng == null || typeof rng.nextU64 !== "function") {
    throw RandError.invalidGenerator("nextU64", rng == null ? rng : memberOf(rng, "nextU64"));
  }
  const v: unknown = rng.nextU64();
  if (typeof v !== "bigint" || v < 0n || v > U64_MAX) throw RandError.invalidDraw("nextU64", v);
  return v;
}

/**
 * The low 32 bits of one 64-bit draw from `rng` — the samplers' draw — using
 * the fast path when the generator offers it, checked against the contract:
 * an integer in `[0, 2^32 - 1]`. An absent `nextU64Low32` (`undefined`) takes
 * the fallback through {@link drawU64}; a present but non-callable one is a
 * broken generator.
 *
 * @internal
 */
export function drawLow32(rng: RandomNumberGenerator): number {
  if (rng == null) throw RandError.invalidGenerator("nextU64", rng);
  const low32 = memberOf(rng, "nextU64Low32");
  if (low32 === undefined) return Number(drawU64(rng) & 0xffffffffn);
  if (typeof low32 !== "function") throw RandError.invalidGenerator("nextU64Low32", low32);
  const v: unknown = (low32 as () => unknown).call(rng);
  if (typeof v !== "number" || v >>> 0 !== v) throw RandError.invalidDraw("nextU64Low32", v);
  return v;
}
