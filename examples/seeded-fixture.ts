/**
 * Deterministic fixtures that agree across the TypeScript, Rust and Swift
 * implementations, and how to persist and fork a generator.
 *
 *   bun examples/seeded-fixture.ts
 */
import { SeededRng, TEST_SEED, randomBytes, randomBool } from "../src/index";
import { nextInClosedRangeI32, nextWithUpperBoundU32 } from "../src/samplers";

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

// The shared cross-platform seed: bc-rand's `make_fake_random_number_generator()`.
const rng = SeededRng.forTesting();
console.log("seed words     ", TEST_SEED.map(String).join(", "));
console.log("first u64      ", rng.nextU64().toString()); // 1104683000648959614
console.log("16 bytes       ", hex(randomBytes(16, { rng })));
console.log("bounded u32    ", nextWithUpperBoundU32(rng, 10_000));
console.log("closed i32     ", nextInClosedRangeI32(rng, -50, 50));
console.log("coin           ", randomBool({ rng }));

// Persist the state as 32 little-endian bytes and resume it later.
const state = rng.state;
const resumed = new SeededRng(state);
console.log("same next draw ", resumed.nextU64() === rng.nextU64());

// Fork: a clone draws the same sequence without advancing the original.
const fork = rng.clone();
const a = fork.nextU64();
const b = rng.nextU64();
console.log("fork agrees    ", a === b);
