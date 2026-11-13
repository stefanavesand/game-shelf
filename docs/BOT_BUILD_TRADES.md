# Shared construction goals, player trades and hand risk

This offline experiment implements the owner's next scope: connect trades to construction, and reduce unnecessary resource accumulation. Development-card goal value, card play and robber decisions are deferred and delegate to the existing shared-plan policy. Production gameplay is unchanged.

## Composition and controls

`build-trade-0.1.0` wraps immutable `shared-plan-0.1.0`; earlier policies/profiles are unchanged. The same private goal key, current-state goal revaluation and route recipe are used for outgoing offers, acceptance, counteroffers and subsequent road/building steps. Prepared engine-driven tests cover a two-road route, a missing-resource exchange and construction of the original settlement, as well as a trade followed by the original city upgrade. Parameter/memory isolation uses the existing controller.

Legal construction, immediate wins and existing development actions take precedence over speculative offers. Trades cannot increase any missing resource quantity for the **next** build step; this is a conservative protection rule, not a proof of global optimality. Waiting/bank decisions compare own-hand utility for the selected full goal. Outgoing requests target a resource actually missing from that goal. Incoming terms are evaluated against the same goal and an available bank alternative. Improving counteroffers use ordinary `TRADE_OFFER` with `replaces` and target the original proposer. No new protocol or rule changes are needed. Unaffordable incoming offers are declined; searching counters for those offers is deferred.

A bounded proposal set gives one or two cards of one resource for one missing card of another resource: at most 40 bundles and four recipient choices per bundle on the base game. Recipient resource **totals** can rule out empty hands; types are never consulted. All is preferred on equal utility, but public near-winner penalties can favor an individual recipient. Declined terms have a conservative history-based cooldown. Unknown history suppresses new proposals. One new outgoing proposal/counteroffer per active turn is the default; the budget resets at an observed end turn. Already outstanding own offers are cancelled through the ordinary response path. Counteroffers are not an unlimited negotiation loop.

Hand risk subtracts `discardRiskWeight * expectedDiscard` from same-goal hand value, where expectedDiscard is zero at seven or fewer cards and `floor(handSize / 2) / 6` above seven. This approximates exposure to one future fair-dice roll; it does not predict intervening production, multiple rolls, robber theft or actual discard composition. Seven is **not** a hard hand limit. Goal gain and protected next-step costs can justify retaining a larger hand. Risk affects exchange/bank ranking in this version; it does not yet change goal selection, the existing discard search or construction ordering. It does not pay a bot to throw useful resources away just to cross the threshold.

The strict `buildTrade` registry adds eight configurable controls to the fourteen existing shared-goal controls: risk weight, minimum gain, maximum give count, outgoing budget, rejection cooldown, speculative proposal discount, public leader penalty and leader VP threshold. Zero risk and disabled outgoing proposals are supported. Defaults are hypotheses, not tuned optima or calibrated difficulty levels. No new dependency or third-party implementation is used.

## Verification plan

Ten focused tests cover accepted/offered trade follow-through, multi-road site follow-through, legal replacement counters, next-road protection, soft risk/bank actions, stale/budget/cooldown fences, hidden-hand permutation invariance, scoped serializable memory, unchanged roll/resource-card actions and deterministic full-game action/plan/state replay.

The initial training screen uses only known seeds 37 and 91, all focal seat rotations, three/four Standard seats and unchanged policy parameters. Fourteen games each compare full overlay, identical overlay with risk weight zero, and previous shared-goal policy. The risk-off comparison isolates that weight; previous-policy comparison bundles changed trade and bank decisions. These small reused cases test legality/completion and help diagnose behavior, not independent strength. Development cards remain in ordinary games, with no tuning of their behavior. Failures/action caps/watchdogs stay visible; no automatic gameplay promotion follows.

## Initial training results

The implementation and fixed profiles were committed as `c6ebcf4b740334cd2993495d436f95cea68e55d6` before running the screen. All 42 games ended normally, with no decision/rule, action-cap or watchdog failures. No parameters were changed during the screen.

| Variant | Three-seat wins | Four-seat wins |
| --- | ---: | ---: |
| Shared build/trade, risk weight 0.08 | 5 / 6 | 2 / 8 |
| Same overlay, risk weight 0 | 5 / 6 | 3 / 8 |
| Previous shared-goal policy | 2 / 6 | 2 / 8 |

These are only two reused training seed blocks. The differing four-seat result does not establish that either risk setting is better; the three-seat counts do not establish a general strength improvement. Case identities include the new experiment ID, so these results are not replications of an older manifest merely because seeds match. Difficulty calibration, mixed opponents, fresh validation and physical-device costs remain open. The live PWA bot is unchanged.

All 42 results reproduced command, final-state, winner and plan-trace hashes with fresh policy memory. The authoritative command replay independently verified all final-state hashes. Initial placement prefixes matched in all fourteen cases across all three variants. Candidate resume completed without duplicate checkpoints. Full synthetic commands and goal traces remain local artifacts.

| Variant | Three seats: own end turns above seven | Four seats: own end turns above seven |
| --- | ---: | ---: |
| Overlay, risk 0.08 | 5 / 143 (3.5%) | 13 / 173 (7.5%) |
| Overlay, risk 0 | 10 / 146 (6.8%) | 21 / 170 (12.4%) |
| Previous shared goal | 11 / 149 (7.4%) | 26 / 187 (13.9%) |

This screen shows lower observed end-turn exposure with risk enabled. It does not show a uniform reduction in actual losses: three-seat discarded-card totals were 43 with risk versus 39 without it; four-seat totals were 90 versus 96. Games/production/turn counts diverged. The policy also leaves the existing discard choice unchanged, so exposure and card-selection quality are distinct. No causal or population strength claim follows from these trajectories.

The overlay produced 88 replacement counteroffers across its fourteen games. Automatic counters raise negotiation activity; human-facing pacing/noise and repeated-term outcomes need validation before adoption. The outgoing budget includes counters per active turn, not just the bot's own turn.

[Aggregate replay and hand metrics](../experiments/bots/results/build-trade-screen-v1.json) record the fixed source identity, counts and definitions. Ten new targeted tests and the complete 75-test bot suite passed, as did source/document checks, build and seven package tests. Existing PWA rules and release artifacts are unchanged. Next priorities are held-out mixed-opponent validation and negotiating quality, keeping development-card/robber improvements deferred.

The [offer ledger audit](../experiments/bots/results/build-trade-offer-audit-v1.json) independently replayed all three cohorts. Full-overlay outgoing offers/counters were accepted 27/153 times (three seats) and 49/196 (four seats), versus previous shared-goal 11/76 and 15/133. Risk-off conversion was 35/160 and 37/202. These are different reached offers/positions, not matched offer-quality experiments. Counts include off-turn replacement counters: offers per own turn is not a budget-violation metric. Incoming counters are replacement offers rather than decline responses. In 69/153 and 66/196 full-overlay proposals no recipient could afford the requested types; that is synthetic post-hoc knowledge, never policy input. Better trade quality must preserve this privacy boundary.
