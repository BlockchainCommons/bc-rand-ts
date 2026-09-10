//! Replays tests/vectors/vectors.json against the Rust reference (bc-rand 0.5.0).
//!
//!   cargo run --release -- ../vectors/vectors.json
//!
//! Exit 0 iff every vector matches, or is an allowlisted expected divergence.
use bc_rand::{
    rng_next_in_closed_range, rng_next_in_range, rng_next_with_upper_bound, rng_random_bool,
    RandomNumberGenerator, SeededRandomNumberGenerator,
};
use rand::RngCore;
use serde::Deserialize;
use std::panic::{catch_unwind, AssertUnwindSafe};

#[derive(Deserialize)]
struct File { count: usize, vectors: Vec<Vector> }
#[derive(Deserialize)]
struct Vector { name: String, seed: [String; 4], ops: Vec<Op>, expect: Outcome }
#[derive(Deserialize)]
#[serde(tag = "op")]
enum Op {
    #[serde(rename = "u64")] U64,
    #[serde(rename = "u32")] U32,
    #[serde(rename = "bytes")] Bytes { n: usize },
    #[serde(rename = "bound")] Bound { w: String, b: String },
    #[serde(rename = "range")] Range { w: String, s: String, e: String, closed: bool },
    #[serde(rename = "bool")] Bool,
}
#[derive(Deserialize, PartialEq, Debug)]
struct Outcome { out: Vec<String>, state: Vec<String> }

const THROW: &str = "throw:from_u64 conversion overflow";

/// Expected divergences: documented in RUST_DIVERGENCES.md. Keep in sync.
fn expected_divergence(name: &str) -> Option<&'static str> {
    // T1: TS i64 range samplers with a negative start apply wrapping-abs to
    // the start; Rust does signed addition. Frozen TS bug until Phase 3.
    if name.starts_with("range/i64/-") { return Some("T1"); }
    None
}

fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }

macro_rules! bound {
    ($rng:expr, $t:ty, $b:expr) => {{
        let b: $t = $b.parse().unwrap();
        catch_unwind(AssertUnwindSafe(|| rng_next_with_upper_bound::<$t>($rng, b).to_string()))
            .unwrap_or_else(|_| THROW.to_string())
    }};
}
macro_rules! range {
    ($rng:expr, $t:ty, $s:expr, $e:expr, $closed:expr) => {{
        let s: $t = $s.parse().unwrap();
        let e: $t = $e.parse().unwrap();
        catch_unwind(AssertUnwindSafe(|| {
            if $closed { rng_next_in_closed_range::<$t>($rng, &(s..=e)).to_string() }
            else { rng_next_in_range::<$t>($rng, &(s..e)).to_string() }
        })).unwrap_or_else(|_| THROW.to_string())
    }};
}

fn run(v: &Vector) -> Outcome {
    let seed: [u64; 4] = [v.seed[0].parse().unwrap(), v.seed[1].parse().unwrap(), v.seed[2].parse().unwrap(), v.seed[3].parse().unwrap()];
    let mut rng = SeededRandomNumberGenerator::new(seed);
    let mut out = Vec::new();
    for op in &v.ops {
        let r = match op {
            Op::U64 => rng.next_u64().to_string(),
            Op::U32 => RngCore::next_u32(&mut rng).to_string(),
            Op::Bytes { n } => hex(&rng.random_data(*n)),
            Op::Bool => if rng_random_bool(&mut rng) { "1".into() } else { "0".into() },
            Op::Bound { w, b } => match w.as_str() {
                "u8" => bound!(&mut rng, u8, b), "u16" => bound!(&mut rng, u16, b),
                "u32" => bound!(&mut rng, u32, b), "u64" => bound!(&mut rng, u64, b),
                _ => unreachable!(),
            },
            Op::Range { w, s, e, closed } => match w.as_str() {
                "u8" => range!(&mut rng, u8, s, e, *closed), "u16" => range!(&mut rng, u16, s, e, *closed),
                "u32" => range!(&mut rng, u32, s, e, *closed), "u64" => range!(&mut rng, u64, s, e, *closed),
                "i8" => range!(&mut rng, i8, s, e, *closed), "i16" => range!(&mut rng, i16, s, e, *closed),
                "i32" => range!(&mut rng, i32, s, e, *closed), "i64" => range!(&mut rng, i64, s, e, *closed),
                _ => unreachable!(),
            },
        };
        out.push(r);
    }
    let state = (0..4).map(|_| rng.next_u64().to_string()).collect();
    Outcome { out, state }
}

fn main() {
    std::panic::set_hook(Box::new(|_| {})); // keep expected panics quiet
    let path = std::env::args().nth(1).expect("path to vectors.json");
    let file: File = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(file.count, file.vectors.len());
    let (mut ok, mut expected, mut mismatch) = (0, 0, 0);
    for v in &file.vectors {
        let got = run(v);
        if got == v.expect { ok += 1; continue; }
        if let Some(id) = expected_divergence(&v.name) { expected += 1; eprintln!("expected-divergence [{id}] {}", v.name); continue; }
        mismatch += 1;
        eprintln!("MISMATCH {}\n  rust: {:?}\n  ts:   {:?}", v.name, got, v.expect);
    }
    println!("{} vectors - {ok} match, {expected} expected-divergence, {mismatch} MISMATCH", file.vectors.len());
    std::process::exit(if mismatch == 0 { 0 } else { 1 });
}
