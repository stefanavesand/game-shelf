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

## Results (2026-11-12)

All 112 executions ended normally with zero rule/decision failures, caps or watchdog failures. Every final-state hash was reproduced by the resource audit. Both replication controls exactly matched all 56 original command traces, final-state hashes and winners. Implementation/profile/seed identities are recorded under committed source `a391ddf77a1a1a77e51cb936df6ad06f40b2b4e1`.

| Component configuration | Three-seat wins | Four-seat wins |
| --- | ---: | ---: |
| None (frozen heuristic) | 3 / 12 | 4 / 16 |
| Goal-aware discard only | 2 / 12 | 6 / 16 |
| Resource cards only | 3 / 12 | 3 / 16 |
| Both | 2 / 12 | 2 / 16 |

The discard-only point estimate is higher in four-seat games but lower in three-seat games. Cards-only is unchanged in three-seat games and slightly lower in four-seat games. Both does not combine into a stronger policy in this sample. The descriptive interaction contrast is 0 pp for three seats and −18.75 pp for four seats; it does not identify a causal bug or establish a population-level interaction.

There are only four seed blocks. Paired percentile intervals are wide, shared-control comparisons are dependent, and a boundary at zero is not superiority/noninferiority evidence. No candidate is promoted and no difficulty is calibrated. Do not pool the 56 replicated control games as additional independent evidence or pick a four-seat-only default from these counts.

### Resource outcomes

Both card-enabled configurations had zero empty Monopoly plays and no resource cards played before rolling, as specified. Frozen-card configurations still had empty Monopoly plays (five in None/three seats; four in Discard/three seats and one in Discard/four seats). This verifies the local behavior change but not stronger play or optimal timing.

Only the cards-only trajectory naturally reached a qualifying discard with a complete city-cost hand that could be kept. Its frozen discard broke the city cost. A counterfactual probe on that exact authorized observation applied the unchanged goal-discard profile:

- Original hand: two brick, zero wood, five ore, two grain, four wool. Discard six.
- Recorded frozen discard left one brick, two ore, two grain, two wool: no complete city cost.
- Goal-aware discard left two brick, three ore, two grain: city cost preserved.

Both commands were validated against the same authoritative snapshot. This is a post-hoc local decision probe, not a continued alternate game or proof of a win benefit. All qualifying city-cost opportunities in this batch were counted; there was only this one. The probe records case ID, trace index, profile hash and both outcomes for reproduction from the synthetic checkpoint. It introduces no opponent-hand information into the policy.

Evidence: [factor comparisons](../experiments/bots/results/resource-components-v1.json), [resource audit](../experiments/bots/results/resource-components-audit-v1.json), [exact control parity](../experiments/bots/results/resource-components-parity-v1.json), [natural discard probe](../experiments/bots/results/resource-components-city-probe-v1.json). Full synthetic traces remain local artifacts. The full bot suite has 51 passing tests; package/source/document checks pass. Exact replay and duplicate-free resume are checked separately.

Decision: retain the isolated profiles as diagnostic controls. Keep gameplay unchanged. The next focused question is to separate per-card resource selection from the combined retention/before-roll timing rule, with explicit seven/discard-risk and bank-stock scenarios. This experiment does not prove that timing, valuation or discards alone caused the lower combined results. Larger/fresh cohorts, realistic opponents/boards and device/memory/human-playtest gates remain open.
