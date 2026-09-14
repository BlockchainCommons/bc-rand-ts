/**
 * Byte and boolean helpers over any generator.
 *
 * @module bytes
 */
import { expectInt, isBytes, memberOf } from "./domain.js";
import { RandError } from "./error.js";
import type { RandomNumberGenerator, RngOptions } from "./rng.js";
import { secureRng } from "./secure-rng.js";
import { SeededRng } from "./seeded-rng.js";

/**
 * `options.rng`, or the secure generator when it is `undefined` or `null`,
 * checked to have the callable member the helper is about to use (the
 * generator contract; a primitive or an object without it is a broken
 * generator).
 */
function rngFor(
  options: RngOptions | undefined,
  method: "fillBytes" | "nextU32",
): RandomNumberGenerator {
  const rng = options?.rng ?? secureRng();
  const member = memberOf(rng, method);
  if (typeof member !== "function") throw RandError.invalidGenerator(method, member);
  return rng;
}

/**
 * `size` random bytes from `options.rng` (default: the secure generator).
 *
 * @throws {RandError} `InvalidArgument` when `size` is not a non-negative safe
 *   integer; `InvalidGenerator` when the generator has no callable `fillBytes`.
 */
export function randomBytes(size: number, options?: RngOptions): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(expectInt(size, 0, Number.MAX_SAFE_INTEGER, "size"));
  rngFor(options, "fillBytes").fillBytes(data);
  return data;
}

/**
 * Fill `dest` from `options.rng` (default: the secure generator).
 *
 * @throws {RandError} `InvalidArgument` unless `dest` is a `Uint8Array`;
 *   `InvalidGenerator` when the generator has no callable `fillBytes`.
 */
export function fillRandomBytes(dest: Uint8Array, options?: RngOptions): void {
  if (!isBytes(dest)) throw RandError.invalidDest("dest", dest);
  rngFor(options, "fillBytes").fillBytes(dest);
}

/**
 * A random boolean: whether the next 32-bit draw is even (the reference's
 * `rng_random_bool`).
 *
 * @throws {RandError} `InvalidGenerator` when the generator has no callable
 *   `nextU32`, or it returns something other than an integer in `[0, 2^32 - 1]`.
 */
export function randomBool(options?: RngOptions): boolean {
  const v: unknown = rngFor(options, "nextU32").nextU32();
  if (typeof v !== "number" || v >>> 0 !== v) throw RandError.invalidDraw("nextU32", v);
  return (v & 1) === 0;
}

/** `size` bytes from a fresh {@link SeededRng.forTesting} generator (the reference's `fake_random_data`). */
export function testRandomBytes(size: number): Uint8Array<ArrayBuffer> {
  return randomBytes(size, { rng: SeededRng.forTesting() });
}
