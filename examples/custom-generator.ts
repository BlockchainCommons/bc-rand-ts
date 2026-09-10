/**
 * Any object with `nextU32`, `nextU64` and `fillBytes` is a
 * `RandomNumberGenerator`. The samplers draw `nextU64()` from it, as the Rust
 * reference does for every width; `nextU64Low32` is an optional fast path a
 * generator may add when it can return the low half of that same draw
 * without a bigint.
 *
 *   bun examples/custom-generator.ts
 */
import type { RandomNumberGenerator } from "../src/index";
import { randomBytes } from "../src/index";
import { nextInRangeI16, nextWithUpperBoundU8 } from "../src/samplers";

/** A byte counter: not random, but it makes every draw visible. */
class CounterGenerator implements RandomNumberGenerator {
  private counter = 0;

  private nextByte(): number {
    const b = this.counter;
    this.counter = (this.counter + 17) & 0xff;
    return b;
  }

  nextU32(): number {
    let v = 0;
    for (let i = 0; i < 4; i++) v |= this.nextByte() << (8 * i);
    return v >>> 0;
  }

  nextU64(): bigint {
    let v = 0n;
    for (let i = 0; i < 8; i++) v |= BigInt(this.nextByte()) << BigInt(8 * i);
    return v;
  }

  fillBytes(dest: Uint8Array): void {
    for (let i = 0; i < dest.length; i++) dest[i] = this.nextByte();
  }

  /** Optional: the same as the low 32 bits of `nextU64()`, with the same consumption. */
  nextU64Low32(): number {
    const lo = this.nextU32();
    this.nextU32(); // discard the high half, so the state advances as nextU64() would
    return lo;
  }
}

const rng = new CounterGenerator();
console.log("bytes      ", Array.from(randomBytes(4, { rng }))); // [0, 17, 34, 51]
console.log("u8 < 100   ", nextWithUpperBoundU8(rng, 100)); // one 64-bit draw, low 8 bits
console.log("i16 range  ", nextInRangeI16(rng, -1000, 1000));

try {
  nextWithUpperBoundU8(rng, 256);
} catch (e) {
  console.log("invalid    ", (e as RangeError).message); // upperBound must be an integer in [1, 255], got 256
}
