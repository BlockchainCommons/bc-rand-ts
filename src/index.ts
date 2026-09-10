/**
 * @blockchaincommons/rand - random number primitives for the Blockchain
 * Commons stack.
 *
 * - {@link RandomNumberGenerator}: the contract (`nextU32`, `nextU64`, `fillBytes`).
 * - {@link SecureRng} / {@link secureRng}: Web Crypto backed.
 * - {@link SeededRng}: deterministic xoshiro256**, identical to the Rust and
 *   Swift implementations for the same seed; `SeededRng.forTesting()` is the
 *   shared cross-platform fixture seed.
 * - {@link randomBytes}, {@link fillRandomBytes}, {@link randomBool}: helpers
 *   taking `{ rng }` and defaulting to the secure generator.
 * - Bounded and ranged integer samplers live in `@blockchaincommons/rand/samplers`.
 *
 * @module @blockchaincommons/rand
 */
export { type RandomNumberGenerator, type RngOptions } from "./rng.js";
export { SecureRng, secureRng, secureRandomBytes, fillSecureRandomBytes } from "./secure-rng.js";
export { SeededRng, TEST_SEED, type Seed } from "./seeded-rng.js";
export { randomBytes, fillRandomBytes, randomBool, testRandomBytes } from "./helpers.js";
