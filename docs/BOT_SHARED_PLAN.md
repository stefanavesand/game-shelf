# Adaptive shared goal experiment

`shared-plan-0.1.0` is the first offline integration of concrete goals across construction, discard, bank/port acquisition and resource cards. It addresses the mismatch between earlier resource valuation and frozen ordinary construction. Existing policy versions remain unchanged; no gameplay/PWA/server integration or strength claim is included.

## Goal and alternatives

Each goal identifies a specific city upgrade, a specific settlement vertex, or an expected-value development purchase. A site plan contains a shortest legal route of new roads and the **remaining** resource cost for those roads plus the settlement. Already owned roads are network sources, not an additional sunk-cost bonus. The planner reports the best city/site/development alternatives while keeping an active target separately.

Routes use a bounded multi-source breadth-first search over the public land-edge graph. Existing own roads/buildings are sources, occupied roads cannot be bought, and opponent buildings cannot be crossed. Every proposed route and destination are checked with the existing `validRoads`/`validSettlements` helpers. Piece availability bounds depth. No rule implementation, pixel-distance shortcut or UI coordinates replace those authoritative checks. Only one shortest route per site is retained; a later observation can find a different route to the same site.

Goal value combines expected VP/production, approximate acquisition ETA, resource readiness and remaining-road penalty. Existing owned port rates enter acquisition estimates and actual bank actions use engine-provided legal ratios. New-port value, resource diversity, opponent blocking value and a complete win-probability model are not yet included. Development purchase value is an expectation, never a prediction of a secret deck draw.

## Flexible commitment

At each decision, routes, costs and values are recomputed from the latest authorized observation. Memory stores only the active goal key, not a stale route, hand or past utility.

- Keep a valid goal unless the current best alternative exceeds it by `switchMargin`.
- Replan immediately when the goal is completed or no longer available within the search bounds; bounded absence is not proof that no longer route exists.
- Recalculate after new cards, construction or opponent changes. The runner invokes this at eligible decision points, not continuously during another player's turn.
- A changed route can retain the same target. New resources may justify a different goal. Previously spent resources do not force continued commitment.
- Public opponent VP near the configured urgency threshold increases the penalty for waiting. It is a heuristic race signal, not access to opponents' hidden cards.
- Immediately winning legal construction and a winning Knight override goal inertia, including when no resource card is held.

## One plan, several actions

Ordinary main-phase construction executes the next step toward the selected target. Bank/port actions and whole-hand Year of Plenty/aggregate Monopoly are valued against that **same goal**, rather than each subsystem silently selecting a different target. Goal-specific discard candidates include a protected-cost seed, retain the engine-suggested legal fallback and pass every bundle through `applyTurn` before valuation. Discard and resource-card success still do not guarantee a future win.

An owned, currently playable Road Building card can be an explicit two-free-road recipe. The card is played for that route; subsequent free-road actions follow it. A mandatory spare free road can serve another candidate route or fall back to the existing legal heuristic. Future cards are never assumed. Resource cards are initially deferred until after rolling; this timing rule is not claimed optimal. Knight/robber decisions outside an immediate win still use the frozen fallback.

**Player trading remains a staged boundary:** incoming offers and outgoing legacy offers while waiting use the unchanged frozen helper. Such offers are not yet shared-goal-aware and may conflict with the active goal. A resulting actual hand change is reconsidered at the next decision. No trade weights or acceptance logic are retuned here. Bank/port acquisition is already goal-aware.

## Explicit private policy memory

`decideWithMemory` accepts/returns a bounded JSON envelope containing schema/policy version, full profile hash, game ID, actor, engine version, last observation revision and `{schemaVersion, goalKey}`. Cross-game, cross-seat, wrong-profile/version, future-revision, malformed or oversized memory is rejected. Inputs and results are frozen/cloned at the controller boundary; a JSON round trip preserves behavior. Maximum serialized envelope size is 4 KiB.

The experiment runner owns a separate map per seat. It updates memory only after the ordinary command succeeds. This memory is **not** part of the authoritative rules snapshot, a public message, another seat's observation or persisted game data. The PWA does not save or restore it yet; production worker/storage integration is future work.

Optional `planTrace`/`planTraceHash` fields record goal selection, structural/missing-resource progress, reasons and next-step diagnostics for this policy only. Old policies retain their result shape and decision path. Replay checks both command/final-state hashes and plan diagnostics. Timings are excluded from deterministic comparison. Diagnostics contain synthetic bot intent/own-hand-derived needs and should remain private if adapted for real games.

## Controls and bounds

The immutable `shared-plan-default.json` profile has fourteen meaningful controls: `maxRouteLength` (default 2; up to 3), `maxGraphNodes` (96; up to 128), `horizonRolls` (24), production/ETA/readiness/route weights, `switchMargin` (0.15), expected development value, retained-card value, resource-card gain threshold, discard candidate cap (24), public VP urgency threshold and urgency strength. The strict registry exports types, ranges and units under `sharedPlan`; Standard metadata only, no calibrated difficulty or decision noise.

The base board graph is public and fixed-size. Graph-node limits concern expanded vertices, not a general arbitrary-map heap ceiling. Discard enumeration has five levels and a `100 * maxDiscardCandidates` node guard (one terminal guard increment possible). The existing 256-choice/131,072 UTF-16-unit observation guards also apply. These are bounded offline work limits, not achieved physical-device latency or incremental-memory results.

## Verification and initial screening plan

Fourteen focused tests cover real legal multi-road costs and follow-through, target completion, enemy occupation/roads, rerouting, configurable inertia, changed-card replanning, common-goal discard/Year of Plenty/city sequence, bank acquisition, explicit free-road recipes, winning build/Knight overrides, memory isolation/serialization, hidden-hand permutation invariance, unchanged trade response and deterministic full-game action/plan replay.

The committed-source training screen uses two known seeds (37, 91), all seat rotations, and frozen Standard opponents: 14 focal games plus 14 frozen-control games. Both case sets use `shared-plan-screen-v1`; this is architecture/completion screening, not independent validation. The policy, weights, memory protocol and manifests are frozen before those runs. No automatic promotion follows from the small win counts.

## Initial committed-source results (2026-11-13)

All 28 games ended normally: zero rule/decision errors, action caps or watchdog failures. The candidate and control had identical initial-placement command prefixes in all 14 paired cases. Every candidate command, final-state and plan-trace hash was reproduced by a fresh policy/memory replay; all 28 authoritative final-state hashes were independently reproduced by the resource-outcome audit.

| Stratum | Shared-goal wins | Frozen-control wins | Exploratory paired 95% difference interval |
| --- | ---: | ---: | --- |
| Three seats | 3 / 6 | 2 / 6 | 0.0 to +33.3 pp |
| Four seats | 3 / 8 | 1 / 8 | 0.0 to +50.0 pp |

These positive point counts are not a strength result: only two previously used training seed blocks per stratum were run. Percentile intervals cannot express unseen block variation here; a zero lower boundary is not proof of superiority. No automatic gameplay promotion, difficulty calibration or parameter optimality claim follows.

### Coherence evidence

The compressed diagnostic trace was checked against the accepted commands:

- 136 observed paid construction/development-purchase actions matched the active target and its next road/site/upgrade step.
- Four different final winning construction actions were allowed to override the active goal. No observed paid construction needed a no-goal fallback.
- Across the logged changes, 34 events selected a clearly better current alternative, four reported a goal unavailable within the search bounds, and 77 reported completed goals. Each reported completion was checked against an actual prior own construction/purchase; no duplicate or unsupported completion was found.
- Diagnostics are recorded for structural/missing-resource changes and non-Keep selections, not every decision. Their Keep counts are not an overall retention percentage. Unavailable events are not individually classified as opponent actions versus bounded reachability.
- One natural complete city-cost discard opportunity in four-seat games and three in three-seat games were all preserved. This is a local resource-cost proxy, not proof that preserving a city hand always maximizes winning chances.

Only three development cards were purchased by the candidate in these trajectories, with two Knight plays. No Year of Plenty, Monopoly or Road Building plays occurred in the candidate cohort. Shared-card selection and free-road recipes therefore remain supported by prepared tests rather than this natural screen; do not imply that all card paths were covered in these games.

Candidate invocation p95 was approximately 44/39 ms and observed maxima 98/70 ms for 3/4 seats on the concurrent Linux/Node host, including controller cloning/freezing. Those are not physical-device or worst-case bounds. The 4 KiB serialized memory guard is not an incremental-heap measurement; worker/device/memory gates remain open.

Evidence: [paired screen](../experiments/bots/results/shared-plan-screen-v1.json), [resource outcomes](../experiments/bots/results/shared-plan-resource-audit-v1.json), [full policy/memory replay](../experiments/bots/results/shared-plan-replay-v1.json), [construction/goal correspondence](../experiments/bots/results/shared-plan-coherence-v1.json). The immutable implementation/profile/manifests are recorded at `97c8a6201a67784b32784e3178405579b9107fa3`. Full synthetic commands and private plan traces remain local artifacts. Exact CLI replay checks the additional plan-trace hash; duplicate-free resume is also verified. The complete bot suite has 65 passing tests, with seven package tests and source/document checks passing.

The next integration boundary is still deliberate: bank/ports and resources use the common goal, while player offers/responses remain in the frozen helper. Before gameplay adoption, investigate that boundary, value/timing quality, larger independent cases, board/opponent diversity and production worker/storage integration. Current PWA UI, rule artifact, server, release version and gameplay bot are unchanged.

## Frozen-profile fresh-seed validation

The next cohort fixes `shared-plan-default` and `shared-plan-control` without parameter search. Candidate/control manifests use `shared-plan-validation-v1`, validation split, six seeds (4001, 4103, 4201, 4303, 4409, 4507) checked absent from all prior top-level experiment manifests, and every focal seat rotation. Each side has 84 games: 18 three-Standard, 24 four-Standard, 18 three-mixed and 24 four-mixed. Mixed opponents are the unchanged planner plus Easy (three seats), with another Standard at four seats. The board layout and starting-placement policy remain fixed; fresh randomness does not establish board diversity.

The first question is reliable goal/memory execution; competitive performance against Standard is the primary strength check, with mixed-opponent results reported separately. No pooling, retuning, early stop on winning results or automatic promotion is planned. The ordinary 2,500-action cap and 120-second per-match watchdog retain failures in the results. Paired intervals resample entire seed blocks; six blocks are still exploratory. Full candidate policy/memory replay, matched initial placements and both cohorts' authoritative final-state replay are checked before interpreting outcomes. Natural card/discard coverage and the unresolved player-trade boundary are reported explicitly.

### Fresh-seed outcomes

All 168 planned games ended normally, with zero rule/decision, action-cap or watchdog failures. Profiles and policy code were unchanged throughout the cohort.

| Stratum | Shared-goal wins | Frozen-control wins | Exploratory paired 95% difference interval |
| --- | ---: | ---: | --- |
| Three seats, Standard | 4 / 18 | 7 / 18 | −44.4 to +11.1 pp |
| Four seats, Standard | 8 / 24 | 7 / 24 | −16.7 to +29.2 pp |
| Three seats, mixed | 9 / 18 | 9 / 18 | −27.8 to +22.2 pp |
| Four seats, mixed | 5 / 24 | 3 / 24 | −8.3 to +20.8 pp |

The primary three-seat Standard point result regressed. Every exploratory interval includes zero, with only six independent seed blocks and no multiplicity correction. Coherent execution does not establish better strategy. This candidate is **not promoted** to gameplay and is not a calibrated difficulty. These validation seeds are now consumed; any subsequent tuning must use training cases and a new held-out cohort.

Resource-outcome replay verifies every final-state hash in both cohorts. The candidate preserved all eight observed feasible city-cost discard opportunities; control preserved none of its three opportunities. These are different reached positions, not a matched causal comparison. Candidate discarded 850 resource cards across 185 discard actions versus control's 356 cards across 83 actions. Raw counts also depend on different hands, production, game duration and trajectories; they flag resource accumulation for diagnosis, rather than proving a faulty discard choice.

The planner made 220 city upgrades but purchased only six development cards across 84 games. Control made 79 upgrades and purchased 467 cards. Candidate played one Monopoly (three cards taken), four Knights, no Year of Plenty and no Road Building. Resource-card and free-road natural coverage remains inadequate. The large city/development imbalance makes relative goal value and the opportunity cost of saving the next priorities; those are hypotheses to isolate, not established causes of the win result. Player trading remains frozen as planned, including its possible mismatch with the selected goal.

Evidence: [paired outcomes](../experiments/bots/results/shared-plan-validation-v1.json), [candidate resource outcomes](../experiments/bots/results/shared-plan-validation-resource-audit-v1.json), [control resource outcomes](../experiments/bots/results/shared-plan-validation-control-audit-v1.json). The source identity is `62d17b278607652db56d039869d37ab5bd3a059c`; the resolved new manifests and profile hashes are captured in the experiment metadata. The code fingerprint matches the initial screen; the commit changed only to record that earlier evidence before this cohort.

All 84 candidate command/final-state/winner/plan-trace results were reproduced with fresh policy memory, and all 84 candidate/control initial-placement prefixes matched. Duplicate-free candidate resume was verified. Compressed diagnostics logged 192 better-alternative selections, ten unavailable-within-bounds selections and 424 goal-completed selections. These are emitted diagnostic classifications, not independently attributed opponent blocks or per-decision transition rates. See [full replay and diagnostic aggregates](../experiments/bots/results/shared-plan-validation-replay-v1.json).

Candidate invocation p95 ranged from 43.2 to 45.5 ms across strata on the concurrent Node host; observed maxima ranged from 74.2 to 85.3 ms. This includes controller cloning/freezing and does not close physical-device or incremental-memory gates. All 65 bot tests and source/document checks passed for this evidence-only change. Production policy, PWA assets, rules and release remain unchanged.

Reproduce the two cohorts with the committed manifests, then run the existing audits:

```sh
node scripts/bots/cli.mjs simulate --manifest experiments/bots/shared-plan-validation.json --out /tmp/shared-plan-validation
node scripts/bots/cli.mjs simulate --manifest experiments/bots/shared-plan-control-validation.json --out /tmp/shared-plan-control-validation
node scripts/bots/cohort-analysis.mjs /tmp/shared-plan-validation /tmp/shared-plan-control-validation /tmp/shared-plan-validation-comparison.json shared-plan-default shared-plan-control
node scripts/bots/resource-audit.mjs /tmp/shared-plan-validation shared-plan-default /tmp/shared-plan-validation-resource-audit.json
node scripts/bots/resource-audit.mjs /tmp/shared-plan-control-validation shared-plan-control /tmp/shared-plan-validation-control-audit.json
node scripts/bots/cli.mjs replay --out /tmp/shared-plan-validation --match MATCH_ID_FROM_EXPERIMENT
```

Use the source identity recorded in a run for exact CLI replay; a new run at a later evidence commit records that new commit even when policy bytes match. No raw private plan traces are committed.
