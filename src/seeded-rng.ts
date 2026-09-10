/**
 * Deterministic randomness for tests and cross-platform fixtures.
 *
 * @module seeded-rng
 */
import type { RandomNumberGenerator } from "./rng.js";
import { Xoshiro256StarStar } from "./xoshiro.js";

/** A 256-bit seed as four 64-bit words. */
export type Seed = readonly [bigint, bigint, bigint, bigint];

/**
 * The fixed seed behind {@link SeededRng.forTesting}. Shared with the Rust
 * and Swift reference implementations so cross-platform fixtures agree.
 */
export const TEST_SEED: Seed = [
  17295166580085024720n,
  422929670265678780n,
  5577237070365765850n,
  7953171132032326923n,
];

function seedFromBytes(bytes: Uint8Array): Seed {
  if (bytes.length !== 32) {
    throw new RangeError(`seed must be 32 bytes, got ${bytes.length}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, 32);
  return [
    view.getBigUint64(0, true),
    view.getBigUint64(8, true),
    view.getBigUint64(16, true),
    view.getBigUint64(24, true),
  ];
}

/**
 * A deterministic generator (xoshiro256**), identical to `rand_xoshiro`'s
 * `Xoshiro256StarStar` for the same seed.
 *
 * NOT cryptographically secure. For tests and reproducible fixtures only.
 * The all-zero seed is a fixed point (every output is zero) and is rejected.
 */
export class SeededRng implements RandomNumberGenerator {
  private readonly core: Xoshiro256StarStar;

  /** Debug label: `Object.prototype.toString` reports the class name. */
  // A prototype getter has zero per-instance cost; the readonly field the
  // stylistic rule prefers would allocate one own property per instance.
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get [Symbol.toStringTag](): string {
    return "SeededRng";
  }

  /**
   * @param seed - four 64-bit words, or 32 little-endian bytes (the byte
   *   layout `rand_xoshiro`'s `from_seed` reads).
   */
  constructor(seed: Seed | Uint8Array) {
    const words = seed instanceof Uint8Array ? seedFromBytes(seed) : seed;
    if (words.every((w) => (w & 0xffffffffffffffffn) === 0n)) {
      throw new RangeError("seed must not be all zero");
    }
    this.core = new Xoshiro256StarStar(words);
  }

  /** A generator seeded with {@link TEST_SEED}. */
  static forTesting(): SeededRng {
    return new SeededRng(TEST_SEED);
  }

  nextU64(): bigint {
    return this.core.nextU64();
  }

  /** The low 32 bits of a 64-bit draw. */
  nextU32(): number {
    return this.core.nextU32();
  }

  /**
   * One 64-bit draw per byte, keeping the low byte. Deliberately wasteful:
   * it is what the reference implementations do, and every seeded fixture
   * downstream depends on it.
   */
  fillBytes(dest: Uint8Array): void {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = this.core.nextByte();
    }
  }
}
