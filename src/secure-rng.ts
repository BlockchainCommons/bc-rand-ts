/**
 * Cryptographically secure randomness from the platform's Web Crypto API.
 *
 * @module secure-rng
 */
import type { RandomNumberGenerator } from "./rng.js";

function getCrypto(): Crypto {
  const c = globalThis.crypto as Crypto | undefined;
  if (c === undefined) {
    throw new Error("no Web Crypto API available in this environment");
  }
  return c;
}

/** Fill `dest` with cryptographically secure random bytes. */
export function fillSecureRandomBytes(dest: Uint8Array): void {
  getCrypto().getRandomValues(dest as Uint8Array<ArrayBuffer>);
}

/** `size` cryptographically secure random bytes. */
export function secureRandomBytes(size: number): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(size);
  fillSecureRandomBytes(data);
  return data;
}

// One reused 8-byte scratch for the 64-bit draw; single-threaded, never held
// across an await.
const scratch = new Uint8Array(8);
const scratchView = new DataView(scratch.buffer);

/**
 * A generator backed by Web Crypto (`crypto.getRandomValues`), available in
 * every modern browser and in Node >= 15.
 */
export class SecureRng implements RandomNumberGenerator {
  /** Debug label: `Object.prototype.toString` reports the class name. */
  // A prototype getter has zero per-instance cost; the readonly field the
  // stylistic rule prefers would allocate one own property per instance.
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get [Symbol.toStringTag](): string {
    return "SecureRng";
  }

  /** The low 32 bits of a 64-bit draw. */
  nextU32(): number {
    fillSecureRandomBytes(scratch);
    return scratchView.getUint32(0, true);
  }

  nextU64(): bigint {
    fillSecureRandomBytes(scratch);
    return scratchView.getBigUint64(0, true);
  }

  fillBytes(dest: Uint8Array): void {
    fillSecureRandomBytes(dest);
  }
}

/** A fresh secure generator. Every instance draws from the same platform source. */
export function secureRng(): SecureRng {
  return new SecureRng();
}
