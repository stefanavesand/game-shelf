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

## Frozen-profile fresh validation plan

The next comparison fixes the existing full overlay against `shared-plan-default`, with no retuning or early stopping. Six seeds (5003, 5101, 5209, 5303, 5407, 5501) were checked absent from prior top-level experiment manifests. Each variant has 84 cases with every focal seat rotation: 18 three-Standard, 24 four-Standard, 18 three-mixed and 24 four-mixed. Mixed opponents are unchanged planner plus Easy, with another Standard at four seats. The profile pair, decision seed, action cap and watchdog are unchanged; resolved manifests capture the comparison. This isolates the combined trade/bank/risk overlay against the previous shared planner, not against production and not individual components.

Reliable rule-driven completion and policy/memory replay remain gates. Three-seat Standard is the primary competitive check; report other strata separately, retaining failures. Analyze paired whole-seed uncertainty without pooling correlated seat rotations. Report end-turn hand exposure, accepted offers, off-turn replacement counters and subsequent active-turn construction proxies, without treating conversion or raw losses as causal win benefit. Six blocks remain exploratory. No gameplay promotion or new difficulty follows automatically; board layout and starting policy remain fixed. Development-card and robber improvements stay out of scope.

## Fresh validation outcomes

All 168 planned games ended normally, with zero rule/decision failures, action caps or watchdog failures. Policy/profile bytes remained frozen; source identity is `f2cdae60c0db94a001b14bb7e74a792703dad9b1`. The new manifests are resolved in run metadata; this source commit contains the complete unchanged implementation and earlier screen evidence.

| Stratum | Build/trade overlay wins | Previous shared-goal wins | Exploratory paired 95% difference interval |
| --- | ---: | ---: | --- |
| Three seats, Standard | 4 / 18 | 6 / 18 | −22.2 to 0.0 pp |
| Four seats, Standard | 11 / 24 | 9 / 24 | −16.7 to +37.5 pp |
| Three seats, mixed | 8 / 18 | 8 / 18 | −16.7 to +16.7 pp |
| Four seats, mixed | 11 / 24 | 7 / 24 | −20.8 to +50.0 pp |

The primary three-seat Standard point result regressed. Six paired seed blocks, fixed board, wide exploratory percentile intervals and no multiplicity correction do not establish superiority or equivalence. The zero upper boundary in the primary interval does not imply precise population inference. No pooled win result, automatic promotion or calibrated difficulty is claimed. These seeds are now consumed validation; subsequent tuning needs training cases and another held-out cohort.

### Offer outcomes

| Stratum | Overlay accepted / outgoing offers | Previous shared accepted / outgoing offers | Active focal turns with accepted trade followed by investment: overlay / previous |
| --- | ---: | ---: | ---: |
| Three seats, Standard | 98 / 431 | 25 / 290 | 37 / 8 |
| Four seats, Standard | 120 / 463 | 24 / 308 | 47 / 8 |
| Three seats, mixed | 106 / 393 | 34 / 269 | 38 / 11 |
| Four seats, mixed | 135 / 445 | 32 / 294 | 48 / 9 |

Outgoing counts include off-turn replacement counters. The final column counts focal active turns, not all accepted deals or all off-turn counter exchanges; it is a temporal construction/development-purchase proxy, not proof that the trade caused the investment. Different reached positions, opponents' gains and game lengths preclude interpreting higher conversion as a win benefit. Incoming replacements are outgoing offers, not decline responses. Post-hoc replay found no recipient able to afford the requested resource types for 191/431, 184/463, 165/393 and 164/445 overlay offers respectively. Proposers never receive that private information.

[Paired outcomes](../experiments/bots/results/build-trade-validation-v1.json) and [aggregate offer ledger audit](../experiments/bots/results/build-trade-validation-offer-audit-v1.json) preserve identities and exact counts. The overlay improves observed trade conversion against this control but has not established competitive improvement. Next diagnosis should stay within the approved build/trade scope: usefulness and cost of counters, resource surplus valuation, and the public benefit given to the recipient. Development-card/robber tuning remains deferred, and production remains unchanged.

### Hand exposure, counters and replay

| Stratum | Overlay own end turns above seven | Previous shared-goal own end turns above seven | Cards discarded: overlay / previous |
| --- | ---: | ---: | ---: |
| Three seats, Standard | 21 / 409 (5.1%) | 37 / 433 (8.5%) | 146 / 166 |
| Four seats, Standard | 32 / 416 (7.7%) | 53 / 480 (11.0%) | 161 / 330 |
| Three seats, mixed | 29 / 359 (8.1%) | 45 / 392 (11.5%) | 116 / 195 |
| Four seats, mixed | 23 / 422 (5.5%) | 56 / 439 (12.8%) | 216 / 332 |

Exposure and raw discarded-card counts were lower in all observed strata. This comparison bundles different trade, bank and risk behavior; unlike the earlier risk-off screen, it cannot attribute that change to the risk weight alone. Different production, game lengths and reached hands still matter.

The overlay issued 379 replacement counters (95/99/96/89 in table order), of which 50 were accepted: 13.2%, versus 409/1,353 ordinary offers (30.2%). Records were matched by focal outgoing command order and verified give/receive/recipient terms; `replaces` identifies counters. Counters and ordinary proposals arise in different positions, so this is a diagnostic difference, not causal evidence that removing counters helps. It does make **separate counteroffer on/off isolation on training cases** the next priority before increasing negotiation sophistication. Consider recipient benefit and saved resources only after distinguishing that mechanism; do not tune on these validation seeds.

All 84 candidate command, final-state, winner and plan-trace results reproduced with fresh policy memory. Independent authoritative replays verified all 168 final-state hashes; all 84 candidate/control initial placement prefixes matched. Duplicate-free candidate resume was verified. [Replay and hand/counter counts](../experiments/bots/results/build-trade-validation-replay-v1.json) retain the fixed source identity and definitions. Raw synthetic observations/plan traces remain local. No policy code, parameters, rule artifact, PWA release or live gameplay changed during this validation; source/document checks apply to the evidence-only change.

## Counteroffer component isolation

`build-trade-0.2.0` adds one strict integer flag, `enableCounterOffers` (0/1, default 1), around the unchanged 0.1.0 policy. On delegates the entire decision unchanged. Off replaces only an otherwise selected replacement `TRADE_OFFER` with the current authoritative `TRADE_DECLINE`, preserving the private goal key. Own pending-offer cancellation, useful acceptance, ordinary proposals, bank valuation, hand risk, construction, development cards and robber behavior are unchanged. Suppressed hypothetical counter gain is labeled separately from executed trade gain. This is a behavioral isolation gate, not a runtime optimization: the underlying proposal is still computed before suppression.

Four tests verify exact delegation and engine-valid declines with retained goal, unchanged acceptance/proposal/construction, strict flag and cross-profile memory fencing, full natural-game on/previous-policy trace/plan/state parity, deterministic off replay and absence of off replacement offers. Previous published policy/profile versions remain unchanged.

The fixed training ablation uses four already known seeds (37, 91, 143, 211), all seat rotations and the same four Standard/mixed rosters as validation: 56 games per flag setting, 112 total. All parameters except the flag are equal. Primary diagnostic is negotiation activity and actual accepted deals; report construction/hand exposure and wins in each stratum separately, retaining failures. No early stopping or retuning follows interim results. Seed blocks are reused training evidence, not a fresh strength test; do not tune on consumed validation seeds. No automatic gameplay promotion or difficulty calibration follows.
