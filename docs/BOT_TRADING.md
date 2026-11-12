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

Eleven trading tests cover the previously missed city-enabling ore/wool exchange, harmful/unaffordable/stale offers, bank alternatives, public leader threat, own-win override, bounded proposals, cooldown expiry, hidden-hand permutation invariance, immediate builds, recipient choice and development investment. A natural full game checks the per-turn offer cap. Together with foundation/planner tests, 27 bot tests pass.

Next gates: reduce repeated plan/alternative evaluations, run budget and memory measurements on devices, add broader opponent/board cohorts and clustered uncertainty, then consider a production worker integration. Do not promote this policy or assign difficulty labels from this screen.
