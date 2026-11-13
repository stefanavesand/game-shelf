# Robber and Knight experiment

`robber-knight-0.1.0` wraps the unchanged shipped `build-trade-0.2.0` policy. It adds public-board robber valuation and an optional gate on Knights the previous policy would play. Purchases, building/trade weights and existing resource-card selectors are unchanged. This is an offline experiment; PWA 0.10.0, its generated profile and saved policy memory remain unchanged.

## Behavior

Each legal destination scores the **net change** from vacating the old tile and blocking the new one. Production uses actual dice probability and one/two units per settlement/city. Own missing resources for the currently valued goal increase protection; opponent production is weighted by public VP and proximity to victory. A configurable four-roll horizon and inherited production utility weight normalize the estimate. The horizon is a heuristic, not a prediction of how long the robber will remain.

Victims are legal, nonempty adjacent opponents ranked by public threat, with deterministic ID ties. The expected steal value is a neutral configurable value scaled for public denial, minus the existing soft hand-count risk of receiving one card. No victim resource type is guessed and a larger hand is not treated as a better chance to steal the desired resource. This first model does not infer per-victim hand composition or optimize a stolen-card distribution.

Forced robber actions preserve the existing private goal memory. They may read a revalued goal to protect production but do not commit a new construction target. Robber diagnostics are private experiment data; their production/steal utilities are heuristic estimates, not realized card gains.

Knight timing is deliberately limited: an already selected winning action, build, trade or other action card is retained. For a Knight the old policy would use, ordinary deterministic economy/score helpers preview the army effect, followed by the legal destination/victim evaluation. With new robber valuation disabled, the predictor follows the old destination and victim at the corresponding next revisions, without sampling theft. Actual Largest Army gain uses the engine score delta; bounded distance/defense potential values partial progress without awarding two points to every Knight. A retained-card cost and current legal same-goal Year of Plenty/Monopoly gain can justify holding Knight. Those alternatives use own/public information and the existing validated aggregate Monopoly inference.

When holding, a private counterfactual masks only own Knight availability and asks the unchanged previous selector for the alternative action. The real card is not marked played; ordinary validation applies against the original state. This preserves old build/trade/other-card selection instead of forcing an End turn when another useful action exists. Buying-card value remains 0.35. Different future hands and timing may naturally change purchase counts.

This is not the complete card arbiter in the [larger spec](BOT_ROBBER_CARDS_SPEC.md). It does not newly override a chosen Year of Plenty for a non-winning army award or search new Road Building award sequences. Future-turn dice/card arrivals and opponent decisions are not simulated. Immediate winning Knight/build behavior remains inherited and bypasses retention thresholds.

## Controls

The strict registry adds twelve controls to the unchanged 23-field counter-on profile:

| Parameter | Default | Bounds | Meaning |
| --- | ---: | --- | --- |
| enableRobberValuation | 1 | 0/1 | New destination/victim value; zero delegates old choices |
| enableKnightTiming | 1 | 0/1 | Retain an insufficient-value Knight; zero delegates old use |
| robberExpectedRolls | 4 | 1–12 integer | Expected blocking horizon |
| robberOwnProductionWeight | 2 | 0.5–5 | Own production protection |
| robberThreatWeight | 1.5 | 0–5 | Continuous public VP plus near-winner weighting |
| robberThreatVp | 7 | 5–9 integer | Extra public threat boundary |
| robberPlanResourceWeight | 1 | 0–3 | Missing-goal resource protection |
| robberStealValue | 0.05 | 0–0.5 | Neutral unknown-card/public-denial utility |
| knightArmyProgressWeight | 0.25 | 0–1 | Bounded army progress/defense potential |
| knightHoldValue | 0.04 | 0–1 | Retained Knight value |
| knightMinGain | 0.02 | 0–0.5 | Required net play gain |
| knightOtherCardWeight | 1 | 0–2 | Current legal resource-card opportunity weight |

Both flags zero exactly delegate previous behavior; neither disables legal robber movement or all Knight play. Timing-only and valuation-only are supported separately. These defaults are scenario-tested hypotheses, not tuned optima or calibrated difficulty labels. Base-game placement enumeration is capped at eighteen candidates, with at most three valid victims and the ordinary bounded resource-card combinations. Observation/choice/memory limits and per-decision scope remain inherited.

## Tests and initial screening plan

Thirteen focused tests cover city weighting, own/goal-resource protection, public threat versus hand size, retained Knight without mutation/spending, army acquisition/tie/takeover and immediate wins, winning build priority, flag-off and unaffected-action parity, hidden resource/development-card permutations, profile-scoped memory, friendly-robber/empty-victim legality, useful competing resource cards, timing-only legacy destination/victim prediction, phase return, and full natural action/plan/state replay. Prepared public-score cases are strategy fixtures, not claims of naturally reached card coverage.

Four fixed profiles isolate both gates: `robber-none`, `robber-placement`, `robber-timing`, `robber-both`. The training screen uses known seeds 37/91 and every focal seat rotation against unchanged Standard, with three/four seats: fourteen games per profile, 56 total. All base parameters are verified equal to the shipped counter-on file. No tuning, early stopping or promotion follows interim win counts. Replay all policy/state traces; additionally compare all fourteen none cases with the original shipped profile, using the same case identities. Report forced placement/victim metrics, actual Knight plays/holds and natural card coverage separately; do not infer Knight strength from cases where none were played. Mixed opponents, fresh held-out cases and physical-device limits remain later gates.

## Initial committed-source screen results

All 56 games ended normally: zero rule/decision, action-cap or watchdog failures. Source identity is `1bf1289dc4068d6f5b8e828b090027122328a73f`, committed before these runs. Every actor command was recomputed from a fresh authorized view/scoped memory, and compressed plan-trace, winner and final-state hashes matched. Separate authoritative command replay verified all 56 final-state hashes. Setup prefixes matched in all 42 comparisons against the fourteen none reference cases. All fourteen none cases additionally reproduced the original shipped 0.2 action/plan/state/winner results, not just its win totals.

| Variant | Three-seat wins | Four-seat wins |
| --- | ---: | ---: |
| Both gates off (previous behavior) | 6 / 6 | 5 / 8 |
| New robber valuation only | 5 / 6 | 4 / 8 |
| New Knight timing only | 6 / 6 | 5 / 8 |
| Both enabled | 5 / 6 | 4 / 8 |

The new placement point result lost one additional game in each stratum. Two known training seed blocks cannot establish a strength change; no parameter optimization, difficulty calibration or gameplay promotion follows. Corrected city accounting and legality do not by themselves prove a winning placement strategy. Mixed opponents and fresh validation remain open.

### Behavior and coverage

The robber-only/combined games selected victims with mean **public** VP of 4.00 (three seats) and 3.82 (four), versus 3.22 and 3.70 with previous behavior. There were 31/33 forced placements for the new valuation, versus 28/33 in the reference; these counts describe diverging games. All variants had zero moves with a net increase in own potential blocked production in this cohort. The new own-protection code is covered by prepared cases; these natural cases do not demonstrate a safety improvement over the old policy.

Audited production figures are city-weighted potential cards per roll, with no future bank shortage or robber-duration forecast. Vacating the old tile is mandatory in all variants, so a larger measured release of own production across different games is not creditable to a better destination choice. These are diagnostics rather than realized denied resources or causal win effects.

**No focal development cards were bought or Knights played in any of the four cells.** There were consequently zero natural Knight-hold decisions. Timing-only exactly matched none action/plan/state hashes in all fourteen paired cases; both exactly matched placement-only in all fourteen. Those are repetitions of the same natural trajectory, not independent evidence for Knight quality. Knight timing/army/other-card behavior is supported only by the prepared tests here.

This exposes the next dependency clearly: evaluate the proposed purchase-value change to obtain meaningful natural card behavior, without forcing purchases merely to increase test coverage. Retain the robber/timing gates so later comparisons can separate effects. The current placement weights still need wider evaluation, and a full action-card arbiter is not implemented in this slice.

Evidence: [screen summaries and exact cell parity](../experiments/bots/results/robber-knight-screen-v1.json), [full decision/memory/engine replay and public metrics](../experiments/bots/results/robber-knight-replay-v1.json). Thirteen new focused tests, all 92 bot tests, source/document checks, build and eight package tests passed. Original profile/policy sources and generated PWA assets are unchanged; no real-player data or raw synthetic plan/command traces are committed.
