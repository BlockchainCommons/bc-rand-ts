/**
 * Cryptographically secure randomness from the platform's Web Crypto API.
 *
 * @module secure-rng
 */
import { isBytes } from "./domain.js";
import { RandError } from "./error.js";
import type { RandomNumberGenerator } from "./rng.js";

function getCrypto(): Crypto {
  const c = globalThis.crypto as Crypto | undefined;
  if (c === undefined) throw RandError.cryptoUnavailable();
  return c;
}

// One reused 8-byte scratch for the 64-bit draw; every method is synchronous,
// so nothing observes it mid-fill.
const scratch = new Uint8Array(8);
const scratchView = new DataView(scratch.buffer);

/**
 * Web Crypto's per-call limit: `getRandomValues` throws `QuotaExceededError`
 * for a view longer than this (the spec, browsers and Node; Bun does not
 * enforce it). Fills are chunked so that, like the reference's `random_data`,
 * any length is accepted.
 */
const GET_RANDOM_VALUES_MAX = 65536;

/**
 * A generator backed by Web Crypto (`crypto.getRandomValues`), available in
 * every modern browser and in Node >= 15. It holds no state: every instance
 * draws from the same platform source. `fillBytes` accepts any length; the
 * platform's 65,536-byte per-call quota is handled by filling in chunks.
 *
 * @throws {RandError} `CryptoUnavailable` from any draw when the environment has no Web Crypto API.
 */
export class SecureRng implements RandomNumberGenerator {
  /** Debug label: `Object.prototype.toString` reports the class name. */
  // A prototype getter has zero per-instance cost; the readonly field the
  // stylistic rule prefers would allocate one own property per instance.
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get [Symbol.toStringTag](): string {
    return "SecureRng";
  }

  /** The low 32 bits of an 8-byte draw. */
  nextU32(): number {
    getCrypto().getRandomValues(scratch);
    return scratchView.getUint32(0, true);
  }

  /** An 8-byte draw as a little-endian `u64`. */
  nextU64(): bigint {
    getCrypto().getRandomValues(scratch);
    return scratchView.getBigUint64(0, true);
  }

  /** The samplers' fast path: one 8-byte draw, low 32 bits, no `bigint`. */
  nextU64Low32(): number {
    return this.nextU32();
  }

  /**
   * Fill `dest` with secure random bytes. Any length: buffers above 65,536
   * bytes are filled in chunks of at most that size (`subarray` views, no
   * copies); shorter ones take one `getRandomValues` call.
   * @throws {RandError} `InvalidArgument` unless `dest` is a `Uint8Array`.
   */
  fillBytes(dest: Uint8Array): void {
    if (!isBytes(dest)) throw RandError.invalidDest("dest", dest);
    const c = getCrypto();
    const n = dest.length;
    if (n <= GET_RANDOM_VALUES_MAX) {
      c.getRandomValues(dest as Uint8Array<ArrayBuffer>);
      return;
    }
    for (let offset = 0; offset < n; offset += GET_RANDOM_VALUES_MAX) {
      c.getRandomValues(
        dest.subarray(
          offset,
          Math.min(offset + GET_RANDOM_VALUES_MAX, n),
        ) as Uint8Array<ArrayBuffer>,
      );
    }
  }
}

/** A fresh secure generator (the reference's `thread_rng()`). */
export function secureRng(): SecureRng {
  return new SecureRng();
}
