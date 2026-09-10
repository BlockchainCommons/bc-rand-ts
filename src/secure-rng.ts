/**
 * Cryptographically secure randomness from the platform's Web Crypto API.
 *
 * @module secure-rng
 */
import type { RandomNumberGenerator } from "./rng.js";

function getCrypto(): Crypto {
  const c = globalThis.crypto as Crypto | undefined;
  if (c === undefined) {
    throw new TypeError("no Web Crypto API available in this environment");
  }
  return c;
}

// One reused 8-byte scratch for the 64-bit draw; every method is synchronous,
// so nothing observes it mid-fill.
const scratch = new Uint8Array(8);
const scratchView = new DataView(scratch.buffer);

/**
 * A generator backed by Web Crypto (`crypto.getRandomValues`), available in
 * every modern browser and in Node >= 15. It holds no state: every instance
 * draws from the same platform source.
 *
 * @throws {TypeError} from any draw when the environment has no Web Crypto API.
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

  /** Fill `dest` with secure random bytes. */
  fillBytes(dest: Uint8Array): void {
    getCrypto().getRandomValues(dest as Uint8Array<ArrayBuffer>);
  }
}

/** A fresh secure generator (the reference's `thread_rng()`). */
export function secureRng(): SecureRng {
  return new SecureRng();
}
