# Bot experiment foundation

Implemented 2026-11-11 for the first BOT-AI-00 delivery. See the [ranked specification](BOT_IMPROVEMENT_SPEC.md). These tools run in Node, outside the PWA bundle. The app still uses its unchanged `heuristic-1.1.0` policy; no new difficulty or playing-strength claim is introduced.

## Quick start

```sh
npm run bots:profile -- registry
npm run bots:profile -- template > /tmp/candidate.json
npm run bots:profile -- validate experiments/bots/candidate-default.json
npm run bots:simulate -- --manifest experiments/bots/smoke.json --dry-run
npm run bots:simulate -- --manifest experiments/bots/smoke.json --out bot-results/smoke
npm run bots:simulate -- --manifest experiments/bots/smoke.json --out bot-results/smoke --resume
npm run bots:compare -- bot-results/smoke bot-results/another-run
npm run bots:replay -- --out bot-results/smoke --match MATCH_ID_FROM_RESULTS
npm run test:bots
```

The smoke manifest expands to seven complete matches: three rotations of a three-seat baseline roster and four rotations of a four-seat mixed candidate/baseline roster. Each seat is controlled by a policy through the normal human-seat command path; these are headless synthetic experiments, not internet games or human playtests. The same production rules module creates and validates all transitions. The beginner map is fixed; seeds vary game entropy and starting order, not board layouts.

Edit a profile JSON, validate it, and use a new empty output directory for the next experiment. Manifest profile paths are relative to the manifest. Keep experiment/roster IDs and seed blocks stable for comparisons; profile hashes change while the underlying case identities stay stable. The supplied manifest is training/smoke data, not an untouched strength-confirmation set.

## Profiles and frozen baseline

- `baseline-standard.json` and `baseline-easy.json` select the frozen policy snapshot under `scripts/bots/baselines/`. Only import paths differ from the source recorded in its integrity manifest; the existing MIT notice remains. Shared rule helpers are pinned by the run's rules artifact. A future engine change requires a new comparison cohort.
- `candidate-default.json` selects the experimental `heuristic-params-0.1.0` policy. It adapts our existing heuristic to expose seven controls: settlement/city/road/development priorities, bank-trade and acceptance bonuses, and noise amplitude. The registry states types, units, ranges and authoring defaults. These use **legacy heuristic score units**, not the future planner's VP-normalized utility scale.
- All effective fields must be explicit. Unknown, missing, non-finite, out-of-range and unsupported values are rejected. Baseline profiles reject parameters so a purported frozen opponent cannot silently change. Exported JSON is canonicalized and SHA-256 hashed; profiles and policy inputs are deep-frozen.
- The experimental `level` field is a legacy metadata tag; its explicit `noiseAmplitude` controls variation. It is not a new calibrated Easy/Standard rating. The frozen policy retains its original level behavior and original room/revision/actor-derived random stream, deliberately ignoring the new candidate decision seed to preserve baseline behavior. Candidate randomness uses a separate derived decision seed and never consumes engine dice/deck entropy.
- Optimized values, planner weights, feature flags, beam/MCTS controls and new difficulty labels from the larger specification are **not implemented yet**. Unsupported profile versions fail validation rather than ignoring those controls.

## Simulation, limits and reproducibility

The strict manifest declares train/validation/test split, unique uint32 game seeds, independent candidate decision seed, profile roster, all seat rotations, repeats, parallel worker count, action cap and match watchdog. Dry run prints exact matches per roster/seat count, profile hashes and the total command-slot budget before simulation.

Each isolated Node worker receives the synthetic match setup; each decision policy is passed only a cloned/frozen authorized seat observation. No DOM, network, account credentials, real-player saves, animation pacing or privileged state are passed to the policy. Worker isolation is for scheduling/cost containment, not a security sandbox for arbitrary third-party code. Policy output still passes ordinary rules validation; resource conservation is checked after each committed action.

Hard experiment limits: 1–4 workers, at most 10,000 matches and 2,000,000 reserved command slots, 1–10,000 commands per match, and a 1–120 second wall-clock watchdog per match. A worker's old-generation heap limit is 128 MiB; this is an offline process safeguard, **not** measured incremental policy memory or the proposed 8 MiB device target. Total parent/output memory remains relevant for large batches; use smaller manifests. There is no paid service or new dependency.

Command caps, rule/decision errors and watchdog/worker failures produce failed results, never draws or silently excluded games. A fixed command cap and seeded policy define replayable experiments; watchdogs are infrastructure safety limits. If a watchdog kills a worker, no complete command trace is available and exact replay is refused. Such a run must remain a failure record and can be attempted in a separate experiment.

Case IDs are independent of candidate weights and concurrency. Match IDs additionally bind ordered profile hashes, candidate seed and command budget. All engine/policy/tool source hashes, Git commit, Node version and resolved profiles are recorded in `experiment.json`. Resume rejects incompatible source/runtime/configuration, corrupt checksums, mismatched jobs and unknown checkpoint files. Changing only worker count is allowed; actual worker count is printed in the run result. Repeats retain the game seed but derive distinct case/decision identities; they are not independent seed samples.

Completed match envelopes are written through a temporary file and atomic rename. SIGINT/SIGTERM stops scheduling and cancels incomplete work; completed matches survive. Resume reruns missing matches from their initial state. It does not checkpoint halfway through a game. An exclusive `.lock` prevents concurrent writers to the same output directory. SIGINT/SIGTERM and ordinary errors release it. After a hard process/host crash, inspect its PID and remove the stale lock only after confirming its owner has stopped. Completed failures are retained on resume, not repeatedly retried until green.

## Results and interpretation

The output directory contains:

- `experiment.json`: resolved manifest, profiles, source/runtime fingerprint and plan hash.
- `matches/MATCH_ID.json`: integrity-checked result and command trace for each completed match, including failures with an available trace.
- `matches.jsonl`: sorted completed match records.
- `summary.json`, `summary.csv`, `report.html`: per-roster, seat-count and profile summaries.

Results include terminal/failure status, winning seat, command/turn count, action counts, decision times, trace and final-state hashes. Reports include all appearances and failures in win-rate denominators. Timings wrap decision invocation (including cloning/freezing the observation); they exclude game projection, rule execution, persistence, presentation and network. These Node results are not physical-iPad measurements. Files contain only synthetic game information, but traces include synthetic private choices and should not be mistaken for production telemetry.

`bots:replay` reconstructs the match from the recorded setup and profiles and checks outcome, command trace and final state. Timing is intentionally excluded from deterministic equality. `bots:compare` is descriptive only: it prints summaries without confidence intervals, statistical significance or automatic level assignment. Multiple seats/rotations sharing a seed are correlated. Homogeneous-roster aggregate win rates mechanically approach 1/n and cannot prove strength. Candidate-v-baseline focal seats and held-out, rotated seed blocks are needed for later strength claims.

Automatic random search/successive halving, seed-set overlap enforcement across separate manifests, clustered uncertainty intervals, richer strategic metrics, scenario CLI suites and difficulty promotion remain BOT-AI-08/follow-up work. The runner provides the deterministic foundation for them; it does not find a global optimum.

## Verification

`tests/bots/foundation.test.mjs` covers strict profile/manifest validation, frozen source integrity and current-policy parity at both levels, a real legal choice changed by parameters, full-game deterministic replay, command-cap failure, concurrency invariance, interrupted resume, duplicate prevention, reports and checkpoint corruption. These tests are included in `test:core`. Existing app/game tests remain unchanged.
