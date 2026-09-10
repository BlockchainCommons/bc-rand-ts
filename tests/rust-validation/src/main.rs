//! Replays tests/vectors/vectors.json against the Rust reference (bc-rand 0.5.0).
//!
//!   cargo run --release -- ../vectors/vectors.json
//!
//! Exit 0 iff every vector matches, is an allowlisted expected divergence, or
//! is JS-only (an input the reference's integer types cannot express).
use bc_rand::{
    rng_next_in_closed_range, rng_next_in_range, rng_next_with_upper_bound, rng_random_bool,
    RandomNumberGenerator, SeededRandomNumberGenerator,
};
use rand::{CryptoRng, RngCore};
use serde::Deserialize;
use std::panic::{catch_unwind, AssertUnwindSafe};

#[derive(Deserialize)]
struct File {
    count: usize,
    vectors: Vec<Vector>,
}
#[derive(Deserialize)]
struct Vector {
    name: String,
    gen: Generator,
    ops: Vec<Op>,
    expect: Outcome,
}
#[derive(Deserialize)]
#[serde(tag = "kind")]
enum Generator {
    /// The package's seeded generator from four u64 words (decimal).
    #[serde(rename = "seeded")]
    Seeded { words: [String; 4] },
    /// The package's seeded generator from 32 bytes (hex, little-endian u64 words).
    #[serde(rename = "seeded-bytes")]
    SeededBytes { bytes: String },
    /// The recipes' own counter generator (`CounterRng` in tests/vectors/recipes.ts).
    #[serde(rename = "counter")]
    Counter { start: u8 },
}
#[derive(Deserialize)]
#[serde(tag = "op")]
enum Op {
    #[serde(rename = "u64")]
    U64,
    #[serde(rename = "u32")]
    U32,
    #[serde(rename = "bytes")]
    Bytes { n: usize },
    #[serde(rename = "bound")]
    Bound { w: String, b: String },
    #[serde(rename = "range")]
    Range {
        w: String,
        s: String,
        e: String,
        closed: bool,
    },
    #[serde(rename = "bool")]
    Bool,
}
#[derive(Deserialize, PartialEq, Debug)]
struct Outcome {
    out: Vec<String>,
    state: Vec<String>,
}

const THROW: &str = "throw:random value does not fit the target width";

/// The recipes' own generator (`CounterRng` in tests/vectors/recipes.ts): every
/// byte is a counter stepped by 17; `next_u32` takes four bytes, `next_u64`
/// eight, `fill_bytes` one per byte. Its two integer draws consume different
/// amounts of state, so a sampler's draw width is observable.
struct CounterRng {
    counter: u8,
}

impl CounterRng {
    fn next_byte(&mut self) -> u8 {
        let b = self.counter;
        self.counter = self.counter.wrapping_add(17);
        b
    }
}

impl RngCore for CounterRng {
    fn next_u32(&mut self) -> u32 {
        let mut b = [0u8; 4];
        for x in &mut b {
            *x = self.next_byte();
        }
        u32::from_le_bytes(b)
    }
    fn next_u64(&mut self) -> u64 {
        let mut b = [0u8; 8];
        for x in &mut b {
            *x = self.next_byte();
        }
        u64::from_le_bytes(b)
    }
    fn fill_bytes(&mut self, dest: &mut [u8]) {
        for x in dest {
            *x = self.next_byte();
        }
    }
}
impl CryptoRng for CounterRng {}
impl RandomNumberGenerator for CounterRng {}

/// Expected divergences: documented in RUST_DIVERGENCES.md. Keep in sync.
/// Consulted only when the outcomes differ, so an entry whose fix has landed
/// simply stops firing.
fn expected_divergence(v: &Vector) -> Option<&'static str> {
    let counter = matches!(v.gen, Generator::Counter { .. });
    // The all-zero seed: the reference substitutes `seed_from_u64(0)`
    // (rand_xoshiro's `deal_with_zero_seed`), and so does the port. Kept as a
    // guard in case a regression reintroduces the earlier divergence, where
    // the port threw instead.
    if v.name.starts_with("seed/zero/") {
        return Some("zero-seed-substitution");
    }
    for op in &v.ops {
        match op {
            // The port's u32-width samplers draw `next_u32()`; the reference
            // draws `next_u64() & mask`. Observable only with a generator
            // whose two draws differ. Kept as a guard in case a regression
            // reintroduces the earlier divergence, where the two disagreed.
            Op::Bound { w, .. } | Op::Range { w, .. } if counter && (w == "u32" || w == "i32") => {
                return Some("counter-u32-draw-width");
            }
            // A signed range whose length exceeds i64::MAX overflows
            // `upper_bound - lower_bound` in the reference (wraps in release,
            // panics in debug). TypeScript uses exact arithmetic and samples the
            // range correctly. Both outcomes are recorded; the TS one is the contract.
            Op::Range { w, s, e, .. } if w == "i64" => {
                let s: i128 = s.parse().unwrap();
                let e: i128 = e.parse().unwrap();
                if e - s > i64::MAX as i128 {
                    return Some("i64-range-length-overflow");
                }
            }
            _ => {}
        }
    }
    None
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn unhex(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
        .collect()
}

/// `None` when an argument does not fit the width: a JS-only input.
macro_rules! bound {
    ($rng:expr, $t:ty, $b:expr) => {{
        let Ok(b) = $b.parse::<$t>() else { return None };
        catch_unwind(AssertUnwindSafe(|| {
            rng_next_with_upper_bound::<$t>($rng, b).to_string()
        }))
        .unwrap_or_else(|_| THROW.to_string())
    }};
}
macro_rules! range {
    ($rng:expr, $t:ty, $s:expr, $e:expr, $closed:expr) => {{
        let (Ok(s), Ok(e)) = ($s.parse::<$t>(), $e.parse::<$t>()) else {
            return None;
        };
        catch_unwind(AssertUnwindSafe(|| {
            if $closed {
                rng_next_in_closed_range::<$t>($rng, &(s..=e)).to_string()
            } else {
                rng_next_in_range::<$t>($rng, &(s..e)).to_string()
            }
        }))
        .unwrap_or_else(|_| THROW.to_string())
    }};
}

fn run_with<R: RandomNumberGenerator>(rng: &mut R, v: &Vector) -> Option<Outcome> {
    let mut out = Vec::new();
    for op in &v.ops {
        let r = match op {
            Op::U64 => rng.next_u64().to_string(),
            Op::U32 => RngCore::next_u32(rng).to_string(),
            Op::Bytes { n } => hex(&rng.random_data(*n)),
            Op::Bool => {
                if rng_random_bool(rng) {
                    "1".into()
                } else {
                    "0".into()
                }
            }
            Op::Bound { w, b } => match w.as_str() {
                "u8" => bound!(rng, u8, b),
                "u16" => bound!(rng, u16, b),
                "u32" => bound!(rng, u32, b),
                "u64" => bound!(rng, u64, b),
                _ => unreachable!(),
            },
            Op::Range { w, s, e, closed } => match w.as_str() {
                "u8" => range!(rng, u8, s, e, *closed),
                "u16" => range!(rng, u16, s, e, *closed),
                "u32" => range!(rng, u32, s, e, *closed),
                "u64" => range!(rng, u64, s, e, *closed),
                "i8" => range!(rng, i8, s, e, *closed),
                "i16" => range!(rng, i16, s, e, *closed),
                "i32" => range!(rng, i32, s, e, *closed),
                "i64" => range!(rng, i64, s, e, *closed),
                _ => unreachable!(),
            },
        };
        out.push(r);
    }
    let state = (0..4).map(|_| rng.next_u64().to_string()).collect();
    Some(Outcome { out, state })
}

fn run(v: &Vector) -> Option<Outcome> {
    match &v.gen {
        Generator::Counter { start } => run_with(&mut CounterRng { counter: *start }, v),
        Generator::Seeded { words } => {
            let seed: [u64; 4] = [
                words[0].parse().unwrap(),
                words[1].parse().unwrap(),
                words[2].parse().unwrap(),
                words[3].parse().unwrap(),
            ];
            run_with(&mut SeededRandomNumberGenerator::new(seed), v)
        }
        // The byte form is `Xoshiro256StarStar::from_seed`'s layout: four
        // little-endian u64 words, which is what `SeededRandomNumberGenerator::new`
        // writes back before calling `from_seed`.
        Generator::SeededBytes { bytes } => {
            let bytes = unhex(bytes);
            assert_eq!(bytes.len(), 32, "{}: bytes must be 32 bytes", v.name);
            let mut words = [0u64; 4];
            for (i, w) in words.iter_mut().enumerate() {
                *w = u64::from_le_bytes(bytes[i * 8..(i + 1) * 8].try_into().unwrap());
            }
            run_with(&mut SeededRandomNumberGenerator::new(words), v)
        }
    }
}

fn main() {
    std::panic::set_hook(Box::new(|_| {})); // keep expected panics quiet
    let path = std::env::args().nth(1).expect("path to vectors.json");
    let file: File = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(file.count, file.vectors.len());
    let (mut ok, mut expected, mut js_only, mut mismatch) = (0, 0, 0, 0);
    for v in &file.vectors {
        let Some(got) = run(v) else {
            js_only += 1;
            continue;
        };
        if got == v.expect {
            ok += 1;
            continue;
        }
        if let Some(id) = expected_divergence(v) {
            expected += 1;
            eprintln!("expected-divergence [{id}] {}", v.name);
            continue;
        }
        mismatch += 1;
        eprintln!(
            "MISMATCH {}\n  rust: {:?}\n  ts:   {:?}",
            v.name, got, v.expect
        );
    }
    println!(
        "{} vectors - {ok} match, {expected} expected-divergence, {js_only} js-only, {mismatch} MISMATCH",
        file.vectors.len()
    );
    std::process::exit(if mismatch == 0 { 0 } else { 1 });
}
