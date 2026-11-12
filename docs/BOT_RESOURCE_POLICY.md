# Goal-aware resources and development cards

BOT-AI-03 introduces the offline-only `resource-heuristic-0.1.0` policy. It wraps the frozen Standard heuristic so opening placement, ordinary construction, robber choices, trading and unrelated phases retain their existing decision code. The economic planner is reused only for bounded resource-hand valuation. This isolates resource changes from the parked trading experiments; it does not promote their policy or change gameplay.

## Behavior

- **Discard:** the old legal heuristic is seeded first. Goal-preserving and production-scarcity seeds plus bounded alternative enumeration generate candidate bundles. Every bundle is validated and applied by the existing `applyTurn` reducer, including the bank return. The remaining whole hand is valued against build plans. There is no second discard-legality implementation or exhaustive-search guarantee.
- **Year of Plenty:** compare every authorized legal pair using the complete resulting hand, with the existing deterministic economy reducer checking bank availability and card eligibility. Two copies of a one-card deficit do not receive two independent original-deficit bonuses.
- **Monopoly:** under the current visible-bank base rules, `19 - bank[r] - own[r]` gives the exact total opponents hold. The policy checks ledger/count consistency and disables inference for hidden banks or unsupported modes. It never allocates that total to an individual. The projected own-hand counterfactual is used only for valuation/winning-build checks; it is not a fabricated full-state transfer or a committed successor. The real command still runs through the authoritative engine.
- **Timing:** normally defer resource cards until after rolling; retain low-value cards, compare with immediate build/bank alternatives and an expected-value development purchase, and, when a resource card is available, take an existing winning build first. A resource card enabling an immediate winning build can override normal priorities, including another development card. No private deck/card is sampled. Knight and Road Building strategy is otherwise left to the existing heuristic.

Trade response/proposal code is unchanged. Changed resource hands and card timing can naturally change later game paths and which trades become possible. The policy is not a general opponent model, full turn search or complete development-card strategy. An enabling-card check proves that a winning build is available afterward; subsequent ordinary construction still follows the frozen heuristic and is not a guaranteed multi-action winning sequence.

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

Fourteen prepared scenario/contract tests plus one natural full-game audit cover:

- Preserving three ore/two grain while discarding five wool, where the old suggestion breaks the city hand; custom bundles accepted by the ordinary engine, including an off-turn discard.
- Strict candidate/node limits and legal generated bundles in a 40-card prepared hand.
- Complementary Year of Plenty cards both with and without a winning-build override, bank shortages and stale choices.
- A visible Monopoly pool of eight wool when the legacy choice would request zero available ore; the actual engine transfer matches the aggregate plus the bot's existing card.
- Equal decisions under hidden-hand permutations; no inference with hidden, inconsistent or unsupported-mode banks.
- Before-roll deferral, low-value retention, immediate winning construction, expected purchase opportunity, other-card interaction, bought-this-turn/played-card exclusions, frozen observations and strict profile validation.
- Frozen heuristic parity for unrelated actions and incoming trades.

Prepared states are diagnostic scenarios, not naturally reached match evidence. They do not establish playing strength. The full-game screen uses actual seeded rule-driven play.

## Initial full-game screen

The committed implementation `ce02b4ef81b781875e3dc4b191679217118af4ab` ran `resource-screen.json` against `resource-control-screen.json`: four previously used training seeds (37, 91, 143, 211), all 3/4-seat rotations and frozen Standard opponents. There are 28 candidate and 28 control games. This is training screening, not independent validation or a locked strength test.

All 56 games ended normally with resource conservation and ordinary rule validation. Every final-state hash was independently reproduced by the new resource audit. The clean committed run also reproduced all trace/final-state hashes from the same-source precommit development run; no weights were tuned from these win results.

| Stratum | Candidate wins | Frozen-control wins | Exploratory paired 95% difference interval |
| --- | ---: | ---: | --- |
| Three seats | 2 / 12 | 3 / 12 | −50.0 to +25.0 pp |
| Four seats | 2 / 16 | 4 / 16 | −25.0 to +12.5 pp |

Only four independent seed blocks are available. The point estimates are lower, the intervals broad, and stronger overall play is **not demonstrated**. Keep the candidate outside gameplay. Do not select a difficulty or claim optimal parameters.

Observed resource behavior:

- Candidate: 27 discards, 14 Year of Plenty plays and 13 Monopoly plays, all validated by ordinary rules.
- Candidate resource cards were all played after rolling; the control played all 12 Year of Plenty and 18 Monopoly cards before rolling. This verifies the timing rule, not a proven strategic advantage of universally deferring.
- Three-seat Monopoly: candidate seven plays collected 19 cards with zero empty plays; control nine plays collected seven cards, including five empty plays.
- Four-seat Monopoly: candidate six plays collected 20 cards; control nine collected 32. Both had zero empty plays. Higher per-match totals are not a causal quality measure because game paths and play counts differ.
- Two candidate main-phase Year of Plenty plays unlocked an immediately legal city. The control played its cards before rolling, so the main-phase unlock metric is not an apples-to-apples assessment of all its future city opportunities.
- Neither cohort encountered a discard with a complete city-cost hand that could be preserved. That improvement is demonstrated in prepared probes only, not these natural matches.

Candidate aggregate policy p95 was about 11/16 ms and maximum about 102/156 ms for 3/4 seats on this host. Those aggregates contain many unchanged heuristic turns and conceal rare decision costs. See the separate action-conditioned timing evidence. Concurrent-host measurements are not physical-device latency, worst-case bounds or incremental memory results. The existing device benchmark does not exercise this policy.

Evidence: [paired screen](../experiments/bots/results/resource-screen-v1.json), [resource audit](../experiments/bots/results/resource-audit-v1.json), [timing breakdown](../experiments/bots/results/resource-timing-v1.json). Full synthetic traces remain local artifacts. Scenarios, strict profile validation, frozen input/hidden-hand invariance, deterministic replay and duplicate-free resume are checked separately; the full bot suite now has 50 passing tests.

```sh
node scripts/bots/cohort-analysis.mjs CANDIDATE_RUN CONTROL_RUN OUTPUT.json resource-default resource-control
node scripts/bots/resource-audit.mjs CANDIDATE_RUN resource-default OUTPUT.json
```

The resource audit replays actual engine commands rather than executing a second rules implementation. City preservation is a feasible resource-cost proxy. It does not assume that city preservation is always strategically best or that a card caused a win.

Remaining work: tune/evaluate play-versus-retain thresholds and future discard risk, cover more plans/opponents/boards, expand physical-device fixtures and memory measurements, and separately improve Knight/Road Building/award timing. Trading stays parked. No change to production bot, PWA UI, engine artifact, saves, server or release version is included.
