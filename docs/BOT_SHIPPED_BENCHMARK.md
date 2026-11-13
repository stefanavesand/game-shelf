# Benchmark of the shipped Solo Planner

## Frozen setup

This benchmarks the exact opt-in PWA 0.10.0 bot Stefan playtested: `counter-on`, `build-trade-0.2.0`, canonical profile hash `bd7e1e1bb9c665657ecd3d326f8b34862ef89c204f1d4ccd1f9a414acb3d151a`. Counters, hand risk and shared construction goals remain enabled with the shipped parameters; no tuning is part of this benchmark. The generated runtime profile is checked against the experiment file before timing. Source base is published app commit `e2a9967ce815484c9e7c4e8efde33b246daf7de5`.

The head-to-head comparison is against the frozen heuristic-1.1.0 Standard used by the ordinary PWA, rather than another unreleased planner. Twelve new seeds (6007, 6101, 6203, 6301, 6407, 6503, 6607, 6701, 6803, 6907, 7001, 7103) were checked absent from previous top-level manifests before running. Each policy has 168 games: 36 three-Standard, 48 four-Standard, 36 three-mixed and 48 four-mixed. Mixed rosters replace one Standard opponent with unchanged Easy; every focal seat rotates. Both cohorts share case identities, seeds, decision seed 92831, 2,500-action cap and 120-second match watchdog. Failures remain in denominators. Three-seat Standard is the primary competitive check; all strata are reported separately, without early stopping or parameter changes.

Fourteen separate stress games use three/four Planner seats on the first two new seeds, rotating seats. They verify complete self-play with separate per-seat plan memory; their wins are not a comparison of strength.

Every synthetic command passes the ordinary reducer. Authoritative state hashes and initial placements are checked, and the first two seeds/all rotations in each paired stratum are selected in advance for candidate policy/memory replay (28/168 cases). All fourteen self-play games are selected for policy replay. Paired intervals resample whole seed blocks; twelve blocks are still limited, and the fixed beginner board does not establish board diversity or a calibrated difficulty. Development-card/robber behavior is not tuned.

## Host timing design

`scripts/bots/shipped-runtime-benchmark.mjs` generates authorized observations with retained private plan envelopes from natural synthetic Solo games, using up to two known seeds per seat count. It captures setup, early main, late main, affordable incoming offers and discard for three/four players, preferring observed high-choice/large-discard/counter cases. No real-player saves, accounts or private observations are accessed. Raw fixtures stay local; the report includes their hash and numeric descriptors.

After match workers finish, one warmup and seven measured rounds interleave frozen Standard and Planner controller calls on identical observations. Each Planner fixture also runs through the actual shipped dedicated-worker entrypoint in a fresh Node worker-thread shim, including startup, imports and postMessage overhead. Every action and scoped plan envelope must match the source controller. Source/runtime hashes identify the measured implementation. These host wall-time figures are not iPad/Safari latency, CPU cycles, incremental heap measurements or worst-case bounds; repeated fixtures are not independent positions. The older public diagnostic page still benchmarks its explicitly labeled earlier trade policy and is not evidence for this new bot.

## Results

All 336 paired games and 14 additional self-play stress games ended normally: zero decision/rule failures, action caps or watchdog failures. Every authoritative final-state hash was separately reproduced (350 total); all 168 paired setup prefixes matched. The preselected 28 candidate policy/memory replays and all fourteen self-play policy/memory replays reproduced command, winner, final-state and plan-trace hashes. This is deterministic rule-driven simulation evidence, not a physical iPad or human-opponent tournament.

| Stratum | Shipped Planner wins | Previous Standard control wins | Exploratory paired 95% win-rate difference |
| --- | ---: | ---: | --- |
| Three seats, Standard opponents | 15 / 36 (41.7%) | 12 / 36 (33.3%) | −16.7 to +33.3 pp |
| Four seats, Standard opponents | 19 / 48 (39.6%) | 15 / 48 (31.3%) | −10.4 to +29.2 pp |
| Three seats, one Easy opponent | 22 / 36 (61.1%) | 16 / 36 (44.4%) | −2.8 to +36.1 pp |
| Four seats, one Easy opponent | 24 / 48 (50.0%) | 18 / 48 (37.5%) | −6.3 to +33.3 pp |

All point estimates favor the shipped Planner, consistent with a promising playtest impression, but every exploratory interval includes zero. Twelve seed blocks, a fixed board and multiple strata do not establish general superiority or a new calibrated difficulty. Do not pool these counts into a single strength rating. Earlier shared-goal/planner controls and seed sets were different comparisons; their results must not be subtracted or pooled with this benchmark. No parameters or app behavior changed during the measurement.

### Resource and trade behavior

| Stratum | Outgoing offers accepted: Planner / Standard | Own end turns above seven cards: Planner / Standard | Discarded resource cards: Planner / Standard |
| --- | ---: | ---: | ---: |
| Three seats, Standard | 182/837 · 75/710 | 57/767 (7.4%) · 15/898 (1.7%) | 254 · 108 |
| Four seats, Standard | 254/803 · 58/693 | 47/787 (6.0%) · 22/895 (2.5%) | 395 · 250 |
| Three seats, one Easy | 211/833 · 85/692 | 60/774 (7.8%) · 13/918 (1.4%) | 275 · 117 |
| Four seats, one Easy | 311/870 · 92/736 | 32/794 (4.0%) · 23/956 (2.4%) | 470 · 241 |

Planner's observed outgoing conversion is higher, while it also negotiates more; counts include off-turn replacement counters. Affordability/recipient-hand diagnostics remain post-hoc synthetic audit evidence, never proposer input. Conversion does not by itself establish useful or winning trades.

Compared with **the old Standard**, Planner has greater end-turn exposure above seven and more raw losses at sevens, despite its active hand-risk weight. Earlier risk improvements were versus other experimental planners, not this card-spending Standard. Different production and game lengths prevent treating raw losses as discard-quality or causal win estimates. Planner made 530 city upgrades and eight development purchases; Standard made 196 upgrades and 1,017 purchases across the same number of games. This large strategic difference remains deliberate evidence to investigate later, not a tuning change in this task. Development-card/robber improvements remain deferred per owner scope.

### Timing on the execution host

Ten authorized natural Solo observations cover both seat counts and the five declared categories, including retained goal memory, affordable counter decisions, 9/12-card discards, 18/19-card late hands and up to 54 choices. Every measured action and returned plan envelope matched the source. Each row has 70 measured samples after warmup.

| Measurement | Median | p95 | Observed maximum |
| --- | ---: | ---: | ---: |
| Standard controller, same observations | 1.56 ms | 12.24 ms | 38.12 ms |
| Planner controller, same observations | 7.92 ms | 16.46 ms | 17.49 ms |
| Planner through a fresh actual runtime worker | 55.72 ms | 72.09 ms | 80.32 ms |

Fresh-worker figures include cold worker startup/imports and message handling via a Node worker-thread shim. They are not physical iPad/Safari measurements, UI animation times or a comparison with a Standard worker. Main game buttons retain the immediate-save path; this benchmark does not measure touch-to-paint latency. Incremental heap/device memory was not measured.

The ten-position timing sample is not a full-game tail bound. Across the broader concurrent simulations, Planner controller p95 ranged from 22.6 to 72.4 ms by stratum, with a 149.1 ms observed maximum; Standard p95 ranged from 8.7 to 18.0 ms with a 147.8 ms maximum. Those distributions include different observations, JIT/GC and host contention. They should not be combined with the quiet matched-fixture worker figures into one latency estimate.

## Evidence and reproduction

- [Paired strength comparison](../experiments/bots/results/shipped-planner-benchmark-v1.json)
- [Complete descriptive simulation summaries](../experiments/bots/results/shipped-planner-simulation-summary-v1.json)
- [Authoritative replay, sampled policy replay and hand metrics](../experiments/bots/results/shipped-planner-replay-v1.json)
- [All-new-policy self-play replay](../experiments/bots/results/shipped-planner-selfplay-v1.json)
- [Aggregate offer ledger audit](../experiments/bots/results/shipped-planner-offer-audit-v1.json)
- [Runtime/source parity, source hashes and numeric timing samples](../experiments/bots/results/shipped-planner-runtime-v1.json)

```sh
node scripts/bots/cli.mjs simulate --manifest experiments/bots/shipped-planner-benchmark.json --out /tmp/shipped-benchmark-planner
node scripts/bots/cli.mjs simulate --manifest experiments/bots/shipped-standard-benchmark.json --out /tmp/shipped-benchmark-standard
node scripts/bots/cli.mjs simulate --manifest experiments/bots/shipped-planner-selfplay.json --out /tmp/shipped-benchmark-selfplay
node scripts/bots/cohort-analysis.mjs /tmp/shipped-benchmark-planner /tmp/shipped-benchmark-standard /tmp/comparison.json counter-on benchmark-standard-control
node scripts/bots/trade-audit.mjs /tmp/shipped-benchmark-planner counter-on /tmp/planner-trades.json
node scripts/bots/trade-audit.mjs /tmp/shipped-benchmark-standard benchmark-standard-control /tmp/standard-trades.json
node scripts/bots/shipped-runtime-benchmark.mjs /tmp/runtime.json
```

Run timing after other simulation workers finish. New measurements naturally record the current commit/runtime; exact CLI replay of an existing run requires its original identity. The analysis/timing script hash identifies the new benchmark tool added alongside this report, while the frozen policy source base is the published app commit above. Full synthetic command traces, observations and private plan envelopes stay in local experiment artifacts. All new validation seeds are now consumed; no tuning or automatic gameplay promotion follows from this benchmark.
