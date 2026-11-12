# Experimental goal-aware trading

BOT-AI-02 adds `trade-planner-0.1.0` to the offline simulator. The installed app still uses its existing policy. This is an original implementation, not imported third-party AI code.

## Decisions

Incoming offers are checked against authoritative legal choices and the current offer ID. The bot values its own resulting hand and reachable build plan, compares bank and immediate build/development alternatives, and penalizes helping an opponent with high public VP. An immediate winning build can override that penalty. It never reads opponents’ resource types or the development deck.

Proposals search bounded single-resource bundles (1:1, 2:1 and 1:2), consider All and individual recipients, and use public production as a supply-affinity heuristic. Affinity and proposal discount are not calibrated acceptance probabilities. A proposal is conditional on acceptance; actual transfers always use the existing rules. Counterfactual valuation adjusts only the bot’s own hand, not a fabricated opponent hand.

Defaults allow one offer per own turn and avoid recently rejected terms for the next own turn. Truncated history suppresses proposals when the turn budget cannot be established; observed own turn endings can establish cooldown expiry. There is no counteroffer chain or persistent private policy memory.

## Parameters

The profile inherits the eleven [economic planner parameters](BOT_PLANNER.md) and adds:

| Parameter | Default | Meaning |
| --- | ---: | --- |
| minOwnUtilityGain | 0.01 | Minimum net plan-value improvement |
| retainedCardWeight | 0.005 | Small value for retained cards |
| leaderPenalty | 1.5 | Public-VP threat penalty scale |
| leaderPublicVp | 8 | Public VP threshold for threat weighting |
| maxCardsPerSide | 2 | Bundle size bound |
| offersPerOwnTurn | 1 | Proposal budget |
| rejectionCooldownOwnTurns | 1 | Own turns to skip after rejection |
| maxTradeBuildPreviews | 2 | Immediate city/settlement previews per valuation |
| maxProposalBundles | 12 | Fully valued bundles |
| proposalDiscount | 0.65 | Discount for conditional proposals |
| publicSupplyWeight | 0.5 | Public production affinity weight |

The exported registry defines validated ranges, integer constraints and units. Complete immutable profiles and source fingerprints are recorded with each run. Use `trade-default.json` and the train/validation manifests under `experiments/bots/`; see [runner commands](BOT_EXPERIMENTS.md).

## Screening evidence (2026-11-12)

Each cohort uses six seeds with all seat rotations, one candidate against frozen Standard opponents. Validation seeds are disjoint from training. The planner control uses the same validation case identities, though policy choices can change subsequent random consumption.

| Cohort | Three seats | Four seats | Completed |
| --- | --- | --- | --- |
| Trade training | 8 / 18 wins | 4 / 24 wins | 42 / 42 |
| Trade validation | 6 / 18 wins | 8 / 24 wins | 42 / 42 |
| Planner validation control | 4 / 18 wins | 8 / 24 wins | 42 / 42 |

All 126 games ended normally with ordinary command validation and resource-conservation checks. Rotations within a seed are correlated: this is descriptive screening, not a significant strength improvement or calibrated difficulty. Validation has now been inspected and must not become a final test set for subsequent tuning.

Trade decision p95 was approximately 153–162 ms on this Linux/Node host, versus 26–31 ms for the planner control; observed trade maxima were approximately 384–551 ms. These include observation cloning/freezing and concurrent-worker contention. They are not iPad measurements or a memory benchmark. Keep this candidate out of the UI thread and production until optimized and device-tested.

Eleven trading tests cover the previously missed city-enabling ore/wool exchange, harmful/unaffordable/stale offers, bank alternatives, public leader threat, own-win override, bounded proposals, cooldown expiry, hidden-hand permutation invariance, immediate builds, recipient choice and development investment. A natural full game checks the per-turn offer cap. A further frozen-observation/profile-isolation regression brings the total to 28 passing bot tests.

Next gates: reduce repeated plan/alternative evaluations, run budget and memory measurements on devices, add broader opponent/board cohorts and clustered uncertainty, then consider a production worker integration. Do not promote this policy or assign difficulty labels from this screen.

## Behavior-preserving optimization (2026-11-12)

CPU sampling identified cloning and repeated board/planner queries as major costs. Trading now uses decision-local WeakMap caches for unchanged states, copies only the own-hand branch for conditional exchanges, avoids proposal work after the per-turn budget is exhausted, and skips deterministic winning-build search when even three additional VP cannot reach the target. Three VP conservatively bounds a building increment plus Longest Road; actual winning moves still use authoritative previews. Shared planner/rules and profile parameters remain unchanged. Caches are discarded after each decision and are never shared across players, revisions or profiles.

The same 42 training cases reproduced every command-trace hash, final-state hash and winner from commit `6a138aed365638d9504322f000cd9652cb0598b7`. A new regression exercises frozen observations, alternating parameter profiles and incoming offers to catch mutation and stale-cache leakage.

An interleaved, same-process benchmark used 64 synthetic main-phase observations from four recorded games, three repetitions, and checked complete decision-result equality. Total decision time was 2,996 ms before and 2,481 ms after (about 17% lower); p95 was 48.3 vs 46.9 ms. This small selected sample excludes projection/profile wrapping and does not establish a general latency guarantee. The 42-game concurrent screen had candidate p95 55/66 ms for 3/4 seats; its previous run had different contention, so that difference is not an isolated speedup measurement. Physical-device latency/memory and production worker integration remain open. No new difficulty or stronger play is claimed.

A separate [browser/device benchmark](BOT_DEVICE_BENCHMARK.md) now packages the candidate for explicit diagnostics only. This is not gameplay integration or device performance evidence.

A subsequent [224-game comparison and heavier-position probe](BOT_BROAD_SCREEN.md) found mixed strength by seat count. The candidate remains experimental.

The [trade diagnosis and one-for-one ablation](BOT_TRADE_DIAGNOSIS.md) identify low-conversion give-one/request-two proposals and a promising parameter-only variant. Defaults and gameplay remain unchanged.
