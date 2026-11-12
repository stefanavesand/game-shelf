# Broader bot screening and stress probes

This extends BOT-AI-02 evidence without changing the gameplay bot or the installed benchmark corpus. It is descriptive screening, not difficulty calibration or a locked final test.

## Predeclared comparison

The trading policy and the unchanged economic-planner control each play 112 games: eight new seeds (`1201, 1301, 1409, 1511, 1601, 1709, 1801, 1907`), all seat rotations, and four strata:

- Three seats against two frozen Standard opponents.
- Four seats against three frozen Standard opponents.
- Three seats against the planner and frozen Easy.
- Four seats against the planner, frozen Standard and frozen Easy.

The explicit `focal-trade`/`focal-planner` profile aliases identify the single evaluated seat even when an opponent uses the same planner implementation. Parameters remain the existing defaults. Aliases change profile hashes/derived candidate decision seeds, but both experimental profiles have zero decision noise. Opponent hashes, case identities, initial game seeds, rotations and command budgets match across variants. Actions can change subsequent random consumption.

Both manifests use two workers, at most 2,500 commands per match and a 120-second watchdog. Total reserved slots are 560,000 across 224 games. No parameters are selected or retuned from this batch. The existing beginner board layout is fixed; new seeds vary stochastic outcomes, not terrain/port layouts. Wider board coverage remains open.

## Analysis and reproducibility

Run the checked-in manifests with `bots:simulate` into separate output directories, then:

```sh
node scripts/bots/cohort-analysis.mjs /tmp/bot-broad-trade /tmp/bot-broad-planner /tmp/bot-broad-comparison.json
node scripts/bots/stress-probes.mjs /tmp/bot-broad-trade /tmp/bot-broad-stress.json
```

The comparison verifies complete planned checkpoint sets and hashes, matched focal seats and opponent hashes, and complete single-repeat 3/4-seat rotation blocks. Failed/unfinished games stay in denominators. Results are separate per stratum. Exploratory percentile intervals use 4,000 deterministic paired whole-seed bootstrap resamples, not independent-seat sampling. Eight seed blocks are few, and these intervals have no multiple-comparison correction; no promotion claim follows from excluding zero in any one interval.

Stress extraction selects two slowest observed candidate decisions from distinct matches per stratum. It reconstructs authorized synthetic observations, checks the exact recorded source/runtime identity, repeats each decision after warmup, compares its action with the recorded command and passes it through ordinary rules validation. Host timings selected from a concurrent run are not worst-case bounds, unbiased performance samples or device measurements. The isolated repeat starts only after the tournament workers finish.

Raw checkpoints, reports and synthetic stress observations remain local/ignored artifacts. Copying a manifest to another source commit creates a new fingerprinted cohort; resume/replay never silently accepts a changed identity. The existing device benchmark remains eight earlier fixtures until an explicitly tested corpus update.

## Results (2026-11-12)

All 224 games ended normally: zero command caps, rule/decision failures or watchdog failures. Frozen policies, rule artifact and default parameters are unchanged.

| Stratum | Trade candidate wins | Planner control wins | Difference | Exploratory paired 95% interval |
| --- | ---: | ---: | ---: | --- |
| Three / Standard | 7 / 24 | 9 / 24 | −8.3 pp | −25.0 to +12.5 pp |
| Four / Standard | 12 / 32 | 7 / 32 | +15.6 pp | −3.1 to +34.4 pp |
| Three / mixed | 11 / 24 | 12 / 24 | −4.2 pp | −33.3 to +25.0 pp |
| Four / mixed | 18 / 32 | 10 / 32 | +25.0 pp | +9.4 to +40.6 pp |

The candidate is promising in four-seat games but not consistently better in the primary three-seat use case. The four/mixed interval is exploratory, unadjusted and based on eight seed blocks; it does not justify a stronger-bot or difficulty claim. No production promotion is made.

The eight extracted decisions all reproduced their recorded actions and passed normal rules validation on four invocations each (one warmup, three measured). Isolated host measurements ranged approximately 69–173 ms. They came from main-phase positions with 18–31 legal choices and up to 39 total roads. The concurrent screen's largest selected timing was approximately 490 ms; CPU contention makes it unsuitable as a device estimate. No per-worker memory measurement was available.

See the checked-in [aggregate comparison](../experiments/bots/results/broad-screen-v1.json) and [stress summary](../experiments/bots/results/broad-stress-v1.json). Their identity records source commit `fa39e3454248c76f00aa680539626f872ef50bfc`, exact policy/rules/tool hashes and Node version; resolved new manifests/profiles are stored with the artifacts. Analysis-only changes are outside the runner fingerprint. Reproduction under a new commit intentionally receives a new identity.

Next: investigate the three-seat trade regression with normalized offer/completion metrics and focused strategic probes; test these heavier positions on physical devices before claiming a broad latency gate. Keep memory profiling, board diversity, locked test design and private human playtests open. Do not tune directly against the now-inspected validation blocks and call them held-out afterwards.
