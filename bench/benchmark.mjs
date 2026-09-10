/**
 * Baseline vs working tree micro-benchmarks (Phase 2.3).
 *
 *   bun run build && bun bench/benchmark.mjs
 */
import * as baseline from "../tests/baseline/rand-baseline.mjs";
import * as current from "../dist/index.mjs";

const SEED = [17295166580085024720n, 422929670265678780n, 5577237070365765850n, 7953171132032326923n];

function time(label, fn, iters = 5) {
  fn(); // warm
  let best = Infinity;
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    fn();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

const cases = {
  "randomData(1 MiB) seeded": (m) => () => new m.SeededRandomNumberGenerator(SEED).randomData(1 << 20),
  "nextU64 ×1M": (m) => () => { const r = new m.SeededRandomNumberGenerator(SEED); for (let i = 0; i < 1e6; i++) r.nextU64(); },
  "nextU32 ×1M": (m) => () => { const r = new m.SeededRandomNumberGenerator(SEED); for (let i = 0; i < 1e6; i++) r.nextU32(); },
  "upperBoundU32(1000) ×1M": (m) => () => { const r = new m.SeededRandomNumberGenerator(SEED); for (let i = 0; i < 1e6; i++) m.rngNextWithUpperBoundU32(r, 1000); },
  "upperBoundU64(1000) ×200k": (m) => () => { const r = new m.SeededRandomNumberGenerator(SEED); for (let i = 0; i < 2e5; i++) m.rngNextWithUpperBoundU64(r, 1000n); },
};

console.log(`${"case".padEnd(30)} ${"baseline".padStart(10)} ${"current".padStart(10)} ${"speedup".padStart(8)}`);
for (const [name, mk] of Object.entries(cases)) {
  const b = time(name, mk(baseline));
  const c = time(name, mk(current));
  console.log(`${name.padEnd(30)} ${b.toFixed(1).padStart(8)}ms ${c.toFixed(1).padStart(8)}ms ${(b / c).toFixed(2).padStart(7)}×`);
}
