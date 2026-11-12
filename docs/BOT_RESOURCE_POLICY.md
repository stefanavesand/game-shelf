# Goal-aware resources and development cards

BOT-AI-03 introduces the offline-only `resource-heuristic-0.1.0` policy. It wraps the frozen Standard heuristic so opening placement, ordinary construction, robber choices, trading and unrelated phases retain their existing decision code. The economic planner is reused only for bounded resource-hand valuation. This isolates resource changes from the parked trading experiments; it does not promote their policy or change gameplay.

## Behavior

- **Discard:** the old legal heuristic is seeded first. Goal-preserving and production-scarcity seeds plus bounded alternative enumeration generate candidate bundles. Every bundle is validated and applied by the existing `applyTurn` reducer, including the bank return. The remaining whole hand is valued against build plans. There is no second discard-legality implementation or exhaustive-search guarantee.
- **Year of Plenty:** compare every authorized legal pair using the complete resulting hand, with the existing deterministic economy reducer checking bank availability and card eligibility. Two copies of a one-card deficit do not receive two independent original-deficit bonuses.
- **Monopoly:** under the current visible-bank base rules, `19 - bank[r] - own[r]` gives the exact total opponents hold. The policy checks ledger/count consistency and disables inference for hidden banks or unsupported modes. It never allocates that total to an individual. The projected own-hand counterfactual is used only for valuation/winning-build checks; it is not a fabricated full-state transfer or a committed successor. The real command still runs through the authoritative engine.
- **Timing:** normally defer resource cards until after rolling; retain low-value cards, compare with immediate build/bank alternatives and an expected-value development purchase, and take an existing winning build first. A resource card enabling an immediate winning build can override normal priorities, including another development card. No private deck/card is sampled. Knight and Road Building strategy is otherwise left to the existing heuristic.

Trade response/proposal code is unchanged. Changed resource hands and card timing can naturally change later game paths and which trades become possible. The policy is not a general opponent model, full turn search or complete development-card strategy.

## Profiles and work limits

`resource-default.json` is a complete immutable profile, separate from all trading profiles. Only Standard metadata is accepted; Easy/Hard calibration and random decision noise are not implemented. The registry excludes inherited planner fields that this policy does not use.

Nine planner controls are reused: production weight, horizon, acquisition discount, readiness weight, hand reserve weight, expansion weight, expected development value, retained-plan cap and road-candidate cap. See [planner definitions](BOT_PLANNER.md). Six additional controls are explicit:

| Parameter | Default | Meaning |
| --- | ---: | --- |
| cardReserveWeight | 0.01 | Scarcity-weighted stock value; each resource contribution caps at five cards |
| resourceCardThreshold | 0.08 | Minimum estimated gain to spend a resource card |
| cardOpportunityMargin | 0.02 | Required margin above immediate alternative value |
| maxDiscardCandidates | 32 | Maximum distinct engine-validated discard bundles (8–128) |
| maxCardBuildComparisons | 4 | Immediate economic value previews, ordered city/settlement/bank/road (0–16) |
| allowResourceCardBeforeRoll | 0 | 0 defers; 1 permits resource cards before rolling |

The discard DFS also has a node guard of `100 * maxDiscardCandidates` (at most one terminal guard increment), depth five, and never drops the seeded legal fallback. Resource cards have at most 15 legal pairs plus five Monopoly choices. Winning-build checks use the existing input cap of 256 choices and a conservative score upper bound before previewing; their previews are separate from the tunable alternative-value cap. One expected purchase comparison is also separate. Input is bounded to the existing 128 KiB observation limit. These are offline work bounds, not achieved device latency or incremental memory claims.

Decision entropy never consumes dice/deck randomness. New module/profile/registry contents are included in the experiment fingerprint; previous cohorts require their recorded source identity for replay. Production rule artifact and bot source stay unchanged. Browser benchmark copies/fixtures still cover the earlier trading candidate, not this new policy.

## Focused verification

Fourteen scenario/contract tests cover:

- Preserving three ore/two grain while discarding five wool, where the old suggestion breaks the city hand; custom bundles accepted by the ordinary engine, including an off-turn discard.
- Strict candidate/node limits and legal generated bundles in a 40-card prepared hand.
- Complementary Year of Plenty cards both with and without a winning-build override, bank shortages and stale choices.
- A visible Monopoly pool of eight wool when the legacy choice would request zero available ore; the actual engine transfer matches the aggregate plus the bot's existing card.
- Equal decisions under hidden-hand permutations; no inference with hidden, inconsistent or unsupported-mode banks.
- Before-roll deferral, low-value retention, immediate winning construction, expected purchase opportunity, other-card interaction, bought-this-turn/played-card exclusions, frozen observations and strict profile validation.
- Frozen heuristic parity for unrelated actions and incoming trades.

Prepared states are diagnostic scenarios, not naturally reached match evidence. They do not establish playing strength. The full-game screen uses actual seeded rule-driven play.
