# Resource-component ablation

This separates the two components of [the initial resource policy](BOT_RESOURCE_POLICY.md) without changing weights or the parked trade logic. It is offline training diagnosis, not a stronger gameplay release or independent validation.

## Frozen setup

A new `resource-heuristic-0.2.0` composition wrapper delegates to the unchanged v0.1 resource policy or frozen Standard heuristic by phase. Two validated integer controls (0/1) are added:

| Profile | enableGoalDiscard | enableResourceCards |
| --- | ---: | ---: |
| resources-none | 0 | 0 |
| resources-discard | 1 | 0 |
| resources-cards | 0 | 1 |
| resources-both | 1 | 1 |

All fifteen original resource parameters remain identical to `resource-default.json`. Their effects are conditional on their component being enabled; disabled weights are not implicitly retuned. Only Standard metadata is accepted. v0.1, its profiles, the frozen heuristic and production policy remain untouched. v0.2 is a feature-switch interface, not a calibrated skill increase.

Discard is selected by the `discard` phase. The card component includes whole-hand Year of Plenty, aggregate Monopoly, resource-card retention and before-roll deferral; this experiment cannot separate those card subcomponents from one another. Setup, building, trades and other fallback behavior remain in the original frozen heuristic or unchanged delegated policy.

The four manifests reuse `resource-screen-v1`, its two roster IDs, four training seeds (37, 91, 143, 211), and all seat rotations. Each variant plays 12 three-seat and 16 four-seat games against frozen Standard opponents: 112 executions total, only four independent seed blocks per seat-count stratum. One worker per variant permits four concurrent workers; each match has a 2,500-command cap and 120-second watchdog (280,000 reserved slots total). Failures stay in totals and are never retried until green.

Case identities deliberately match the earlier 56-game screen. None/both are replication controls, not independent additional strength evidence. The expected controls are exact command/final-state parity with the previous frozen-control/full-resource runs, respectively, despite new profile IDs and policy version. Candidate decision noise is not introduced and neither wrapper nor resource policy consumes engine entropy.

## Analysis fixed before execution

Compare discard/none, cards/none and both/none separately per 3/4-seat stratum using paired whole-seed bootstrap summaries. Shared-control comparisons are dependent, unadjusted and exploratory. Record the point contrast `both - discard - cards + none` as a diagnostic interaction description only; it is not causal attribution or a significance test. Never pool repeated control executions as new independent observations.

Replay all completed games through the resource-outcome audit. Report discard count, feasible city-cost preservation opportunities, played-card timing and zero-yield Monopoly. Absence of a rare city-preservation opportunity in natural games is not a failed scenario test. More card resources or more accepted trades do not establish stronger play.

A useful outcome identifies a component/subcomponent worth investigating on training data. No outcome automatically promotes a gameplay policy or selects a difficulty. Fresh validation, broader board/opponent coverage, physical-device stress/memory and human playtests remain open.

## Commands

Use `experiments/bots/resource-components-{none,discard,cards,both}.json` with `bots:simulate` in separate directories. Then use the existing comparison tool with explicit focal IDs, for example:

```sh
node scripts/bots/cohort-analysis.mjs DISCARD_RUN NONE_RUN OUTPUT.json resources-discard resources-none
node scripts/bots/resource-audit.mjs DISCARD_RUN resources-discard AUDIT.json
```

Run the committed composition source for reproducible replay/resume. The wrapper is included in the source fingerprint. `bots:profile -- registry` exposes `resourceComponents` alongside the existing registries. Contract tests check fully-on v0.1 parity, fully-off heuristic parity, independent phase gating and strict flags. No server/UI/PWA package changes are included.
