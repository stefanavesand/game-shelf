# Bot improvement, tuning and difficulty specification

Version 0.1 · 2026-11-11 · Implementation proposal requested by the owner.

This document specifies the ranked work, configuration contract and experiments. It does **not** implement a stronger bot or claim that the initial parameter values are optimal. Numerical ranges and promotion thresholds below are proposed experiment/release criteria. They supplement [bot requirements](BOT_REQUIREMENTS.md), particularly BOT-03/06/07/09/10/13/14/16/18, and [validation](RULE_VALIDATION.md).

## 1. Objective and boundaries

Produce fair, understandable opponents for three/four-player base Catan, including two humans plus a bot and offline Solo. Improve strength and usefulness of trading while maintaining responsive iPhone/iPad play. Every improvement must be switchable for controlled comparison.

Use the same local rules for online and offline games. A trusted PWA coordinator schedules bot suggestions, validates them through the ordinary command path and commits them once. The backend retains identity and internet transport responsibilities. This supersedes historical requirements that put policy execution on a managed game server. Sleeping or backgrounding iOS pauses work; workers are not a background-execution guarantee.

The policy gets only its immutable authorized observation, public history, legal-choice information and decision context. Full opponent hands, real deck order and actual game RNG state must never enter policy/search/optimizer input. An experiment harness can inspect full state to validate outcomes, but its privileged metrics channel must be separate from policy input. No external inference/API or new runtime engine is required.

## 2. Ranked delivery order

Rank 0 is the measurement prerequisite. Ranks 1–6 form the first stronger heuristic candidate. Search is justified only by measured improvement after that baseline exists. The optimizer can be used as soon as any parameterized component is available; rank 8 is profile calibration/promotion, not a reason to postpone experiments.

| Rank / stable ID | Improvement | Adjustable controls | Completion evidence |
|---|---|---|---|
| 0 / BOT-AI-00 | Freeze `heuristic-1.1.0`; introduce validated immutable parameter profiles, scenario probes, tournament runner and results format. | Policy/profile IDs, experiment seeds, opponent roster, worker count and fixed work budgets. | Replays reproduce commands; old baseline unchanged; distinct policy/engine seeds; checkpoint/resume produces the same game set without duplicate results. |
| 1 / BOT-AI-01 | Select concrete feasible build plans using production-aware acquisition estimates and successor value, rather than raw missing-card count and unconditional action bonuses. | Production/expansion/hand weights, approximate ETA penalty, planning horizon and switching threshold. | A slow missing resource differs from a fast one; zero production can be served by a feasible port path; waiting can beat a wasteful build; direct winning actions take precedence. |
| 2 / BOT-AI-02 | Evaluate player/bank trades against the chosen plan and best alternative. Consider recipients rather than always the first peer; limit repeated proposals. | Minimum own gain, public opponent-threat penalty, permitted proposal sizes, per-turn proposal limit and rejection cooldown. | Useful two-for-one accepted in the research probe; unfavorable equal-count deal rejected; superior bank alternative selected; stale/unaffordable offers remain rejected; no offer loops. |
| 3 / BOT-AI-03 | Improve resource-sensitive actions: Year of Plenty, Monopoly, discarding and preserving cards for the next useful build. | Reserve horizon, discard-risk penalty, card-use threshold and maximum discard candidates. | Score whole resulting hands, not duplicate original deficits; Monopoly uses legitimate public aggregate information; discards preserve an imminent city where appropriate. |
| 4 / BOT-AI-04 | Plan expansion on the actual legal graph. Score each road's marginal contribution and avoid redundant roads. | Reachability depth, site value, road cost, contention penalty and bounded site count. | Opponent buildings/occupied roads block routes correctly; an unrelated road gets no credit for a previously reachable site; a useful road-to-settlement sequence beats a dead end. |
| 5 / BOT-AI-05 | Improve the paired opening: complementary production, number correlation, expansion access, ports and expected availability of the second site. | Opening beam, diversity/correlation/port/expansion weights. | Both setup rounds and all seat orders legal; same-number concentration recognized; first placement cannot assume an already-taken or guaranteed future site. |
| 6 / BOT-AI-06 | Add game-phase and public win-race awareness: city/development choices, award races, robber targets and retaining development cards. | Late-game boundary, award-distance weight, public threat weight and card opportunity cost. | Winning city/settlement/award is selected; cities count double in robber production; unattainable Longest Road is not chased indefinitely; avoid helping a near-winner unless our own winning line dominates. |
| 7 / BOT-AI-07 | Add bounded same-turn beam search over deterministic own actions, retaining strategically different action categories. | Beam width, depth, node cap and per-category minimum representation. | Finds bank trade → city and road → settlement sequences; same projected input/seed/budget yields same choice; cancellation, stale result, node exhaustion and fallback covered. |
| 8 / BOT-AI-08 | Tune weights, compare algorithm variants, and calibrate named difficulty profiles using held-out tournaments and device budgets. | Search space, candidate count, evaluation schedule and training/validation seed manifests. | Reproducible leaderboard, uncertainty estimates, ablations and frozen profile files; measured ordering for Easy/Standard/Hard before advertising it. |
| 9 / BOT-AI-09 | Optional information-set MCTS/POMCP research after beam search. | Determinizations/particles, rollout/tree budgets, exploration and action-category sampling. | Beats beam within the same device budget; no hidden-state dependence or impossible sampled hands; bounded memory and replayable randomness. Not a dependency for the first stronger release. |

Each row needs a feature flag, focused acceptance scenarios, cost instrumentation, and an ablation comparing that component enabled/disabled. Flags cannot relax legality, privacy, resource limits or durable command delivery.

## 3. Decision model

### Plans and utility

A plan identifies an objective and, where relevant, a real board location and legal access path. Candidate plans include city, settlement with necessary roads, development/army progress and a feasible award finish. Compare them with end turn/waiting.

Use a versioned feature extractor. Keep utility units fixed: one immediate VP is the reference coefficient of 1; remaining feature weights convert their defined units into this utility scale. Define production per dice roll and ETA in dice rolls (not ambiguous player turns). Stage/seat-count transformations must be explicit and versioned. A direct legal win is a lexicographic override, not a weight the optimizer can accidentally underbid.

The first ETA model is a documented approximation using own holdings, a per-roll production matrix, owned port rates and finite bank availability. Do not describe `deficit / mean production` as an exact expectation. Same-roll resource correlation matters; any later stochastic estimate must preserve it. Speculative player trades are conditional opportunities, never guaranteed future resources.

Score the best feasible plan after an action against the best feasible plan before it. Re-evaluate when a route is blocked or a meaningful resource/award change occurs; a small switching threshold may prevent indecisive churn. Stateless recomputation is preferred initially. Any retained memory must be bounded, account/seat scoped, versioned and derived only from allowed observations.

### Trading

Compare each proposal with waiting and the best legal bank/port alternative. Card counts alone must not veto beneficial asymmetric deals. Do not assume another player's resources merely because their total resource count is positive. An active bot may consider an All offer when legal; off-turn offers must still target the active player according to the rules.

Opponent benefit is an estimate from public facts or allowed history, not their hidden hand. Apply a bounded penalty for advancing a public near-winner. A trade leading to our immediate legal win outranks this penalty. Log whether rejected offers were unaffordable, stale, worse than an alternative, or strategically unfavorable.

Start with bounded proposal shapes (one-for-one, two-for-one and one-for-two) and no counteroffer chain. Later counteroffers require their own candidate generator, bounded signature memory and stale-offer tests. A rejection cooldown key includes recipient, bundle and relevant economic context, so useful offers can be reconsidered after genuine changes.

### Resource choices

Year of Plenty evaluates the complete resulting hand. Monopoly can use `19 - bank[r] - own[r]` as the exact aggregate held by opponents under the current visible-bank base rules; it must not attribute that total to an individual. Disable that shortcut if bank visibility/rules change.

Today the legal-choice list supplies just one suggested discard bundle. A goal-aware policy needs bounded alternative bundle generation through a validated extension point, not just different scoring of that single bundle. No second implementation of discard legality is permitted. Bundle enumeration must have a cap and a legal heuristic fallback.

## 4. Parameter and profile contract

### Registry and immutable profiles

Maintain a registry declaring each parameter's type, units, minimum, maximum, default, tuning scale (linear/log/categorical), feature dependency and introduction version. Reject unknown keys, invalid enum values, non-finite numbers, incompatible feature combinations and out-of-range values. Profiles are immutable JSON; canonical serialization plus SHA-256 identifies the exact configuration. Validate and apply changes atomically.

Distinguish four versions: rules artifact, policy code, feature/scoring schema, and profile schema/hash. Store exact profile content (bounded size), not only a mutable difficulty label, in new game's bot configuration and replay metadata. Policy replacement cannot silently alter an existing game's profile. Missing versions pause safely. Current artifact hashing includes policy code; separating that coupling is a deliberate later compatibility change, not an assumption in this spec.

One seed controls game entropy; a separately derived decision seed uses game/seat/revision/policy/profile identifiers. The optimizer's seed and per-match assignment seeds are separate again. Changing search depth or tie-break randomness must not consume the engine dice/deck RNG.

### Initial parameter space

Ranges below are candidate exploration domains, not measured optima. Tune one group at a time before optimizing interactions. Avoid redundant global rescaling of all utility weights.

| Group | Parameters and candidate ranges |
|---|---|
| Evaluation | `productionWeight` 0–4; `expansionWeight` 0–2; `etaPenaltyPerRoll` 0.01–0.5 (log); `handReserveWeight` 0–1; `discardRiskWeight` 0–1. Immediate-VP reference stays 1. |
| Planning | `horizonRolls` 4–24 integer; `switchMargin` 0–0.25 utility; `maxPlans` 4–16 integer. |
| Trading | `minOwnUtilityGain` 0–0.25; `leaderPenalty` 0–2; `maxCardsPerSide` 1–2 initially; `offersPerOwnTurn` 0–2; `rejectionCooldownOwnTurns` 0–3. |
| Cards/discard | `minCardUtilityGain` 0–0.5; `reserveHorizonRolls` 2–12; `maxDiscardCandidates` 8–64. |
| Expansion | `maxRoadDepth` 1–4; `maxExpansionSites` 4–16; `roadCostWeight` 0–1; `contentionWeight` 0–2. |
| Opening | `openingBeam` 4–16; diversity/correlation/port weights each 0–2; `openingExpansionWeight` 0–2. |
| Race | `lateGamePublicVp` 6–9; `awardDistanceWeight` 0–2; `robberThreatWeight` 0–2; `cardOpportunityCost` 0–1. |
| Beam search | `beamWidth` 4–12; `depth` 1–3; `maxNodes` 32–512; `categoryMinCandidates` 1–2, subject to the beam cap. Disabled search must not spend search nodes. |
| Controlled variation | `epsilon` 0–0.15; `nearBestUtilityGap` 0–0.2; `nearBestTopK` 1–3. Variation samples only legal near-best choices and never bypasses immediate-win handling. |

Illustrative complete profile shape (experimental, not a shipped difficulty):

```json
{
  "schemaVersion": 1,
  "id": "standard-candidate-001",
  "policyVersion": "planner-0.1.0",
  "featureSchemaVersion": 1,
  "features": {
    "planner": true, "tradeUtility": true, "resourceChoices": true,
    "graphExpansion": true, "pairedOpening": true, "raceAwareness": true,
    "beamSearch": false, "informationSetSearch": false
  },
  "evaluation": {
    "productionWeight": 1, "expansionWeight": 0.5,
    "etaPenaltyPerRoll": 0.05, "handReserveWeight": 0.25,
    "discardRiskWeight": 0.25
  },
  "planning": {"horizonRolls": 12, "switchMargin": 0.05, "maxPlans": 8},
  "trade": {
    "minOwnUtilityGain": 0.02, "leaderPenalty": 0.5,
    "maxCardsPerSide": 2, "offersPerOwnTurn": 1,
    "rejectionCooldownOwnTurns": 1
  },
  "resources": {"minCardUtilityGain": 0.02, "reserveHorizonRolls": 6, "maxDiscardCandidates": 32},
  "expansion": {"maxRoadDepth": 3, "maxExpansionSites": 8, "roadCostWeight": 0.25, "contentionWeight": 0.5},
  "opening": {"openingBeam": 8, "diversityWeight": 0.5, "correlationWeight": 0.25, "portWeight": 0.25, "openingExpansionWeight": 0.5},
  "race": {"lateGamePublicVp": 8, "awardDistanceWeight": 0.5, "robberThreatWeight": 0.5, "cardOpportunityCost": 0.1},
  "search": {"beamWidth": 6, "depth": 2, "maxNodes": 128, "categoryMinCandidates": 1},
  "variation": {"epsilon": 0, "nearBestUtilityGap": 0.05, "nearBestTopK": 2}
}
```

Schema validation resolves no hidden defaults: an exported profile contains all effective values, its feature flags and hash. Registry defaults are only for authoring a new profile. Frozen profiles do not change when defaults change. UI pacing, hard safety ceilings, authority identity, privacy and actual game RNG are not tunable strategic parameters.

### Adjusting parameters

The first tuning interface is JSON plus CLI, suitable for local Node and optional CI batch execution. Include template/export, validate and dry-run commands; print changed parameters and expected match count before an expensive run. The owner can edit a file and rerun the same evaluation command. Keep experimental profiles out of normal game creation until promoted. An in-app expert editor is not required, and this does not recreate the retired animation lab.

## 5. Simulation and optimization contract

The commands below are **proposed interfaces**, not commands implemented in the current repository:

```text
npm run bots:profile -- validate experiments/candidate.json
npm run bots:scenario -- --profile experiments/candidate.json --suite decision-regressions
npm run bots:simulate -- --manifest experiments/train.json --dry-run
npm run bots:simulate -- --manifest experiments/train.json --out artifacts/run-001
npm run bots:tune -- --manifest experiments/tune.json --method random-halving --resume artifacts/tune-001
npm run bots:compare -- --runs artifacts/baseline artifacts/run-001 --out artifacts/comparison
npm run bots:replay -- --trace artifacts/run-001/failures/match-0042.json
```

A profile can be per seat, permitting one candidate against 2/3 baselines, mixed opponents and all-candidate play. Simulations use the actual rules/session module with policy-only projected inputs; no DOM, network, OAuth, service worker or presentation delay. All-bot harness support does not add an unattended public-app mode.

### Experiment manifest

An immutable manifest names:

- source commit, rules digest, baseline policy snapshot, profile hashes and feature schema;
- split ID (train/validation/test), seed-file content/hash and optimizer seed;
- seat count, starting-order assignment, profile roster/rotation, supported map/rules configuration;
- maximum commands (initial screening cap 2,500), runtime watchdog, node caps, number of repeats and worker count;
- primary objective/constraints and stopping criteria chosen before results are seen;
- expected match IDs/count, output format, runtime/device metadata and resume policy.

Derive each match ID from canonical manifest + roster + seed + rotation + repeat. Resume only incomplete IDs, write results atomically and reject incompatible source/profile versions. Do not duplicate matches or seed worker RNGs according to completion order. Parallel workers run isolated matches; concurrency does not change outcomes. Use bounded worker count and total wall/CPU/memory budgets, including an explicit stop control.

Use training seeds for candidate search, validation seeds for shortlisting, and a locked test manifest only for final confirmation. No overlap. Do not tune again using the same test set; if test results influence another candidate, reserve a fresh untouched confirmation set and retain all prior results. Current production supports a fixed beginner map: seed diversity is not board-layout diversity. Unsupported randomized maps cannot silently enter the promotion test.

### Optimization procedure

1. Run focused correctness/privacy scenarios; infeasible candidates receive no competitive score.
2. Establish baseline-v-baseline results to check seat balance and harness integrity.
3. Use seeded random search or a space-filling sample over one enabled parameter group; start with 32 candidates, retaining the incumbent unchanged.
4. Apply successive halving with identical training seed/seat blocks at each rung. Example focal-match counts per candidate: 60 → 240 → 960, multiples of full 3/4-seat rotation blocks. These counts are per seat-count/opponent stratum, not a total hidden inside a pooled score. Print the actual total before running. Selected candidates continue on the union of assigned blocks without duplicate games.
5. Evaluate the shortlist on independent validation blocks, with both baseline and mixed opponent rosters. A candidate that exploits one weak opponent is not enough.
6. Confirm the selected profiles once on the locked test set; tune dataset size to the predeclared detectable effect, not a desired p-value. Initial planning budget: at least 2,016 focal matches per seat-count stratum (complete rotation blocks) for a promoted profile, with uncertainty computed on independent seed blocks. This is not a universal statistical guarantee; increase the planned sample if intervals are too broad.
7. Run ablations for changed components and sensitivity checks around selected weights. Prefer a broad stable region over one lucky parameter spike; among similarly strong profiles choose lower cost and fewer dependencies.
8. Validate selected profiles on physical iPad/iPhone and a private human playtest before release.

Begin with random search; evolutionary or Bayesian search is an optional later optimizer, not a dependency. Log every candidate, including failures and rejected candidates. Do not describe a winner as globally optimal: it is the best observed candidate within a specified search space, opponent mixture and compute budget.

### Objective and statistics

Optimize win performance under hard correctness, fairness, completion, experience and compute constraints. Do not add all metrics into an arbitrary single reward that can trade away safety or legality.

For each stratum, report candidate focal-seat win rate and expected equal-policy reference `1 / playerCount`. Average normalized lift equally over declared seat-count/opponent strata for ranking; never let a larger batch hide regression in a smaller stratum. Use the same seed/assignment blocks for comparisons, with seat rotations. A common initial seed does not guarantee identical later dice when policies consume stochastic actions differently; record the actual effect/command trace.

Compute 95% uncertainty intervals with resampling by seed/rotation block, not by treating correlated seats from the same game as independent observations. Predeclare the primary comparisons; apply an appropriate multiple-comparison correction if claiming several level/algorithm improvements. Screening leaderboard scores are exploratory. Final strength claims come from the held-out test.

Nonterminal action-cap games, crashes and policy timeouts are failures, not wins/draws. Include them in totals; do not silently drop them to improve win rate. Attribute candidate faults versus harness/engine faults separately. A rules-defined terminal draw, if introduced later, needs an explicit scoring rule. Current base games normally finish with a winner.

## 6. Metrics and artifacts

Per match: configuration/seed IDs; ordered roster and initial order; terminal result; winner; commands/turns; failures; draws/action caps distinguished; policy/engine versions; timing by phase; fallback/cancel counts; policy work/memory diagnostics.

Per policy/seat: offers sent/accepted/declined/stale/unaffordable, cards traded, useful bank trades, proposal repetition, resource gains/spending, discarded resources, building/road/development actions, production growth, award changes, and development-card outcomes. Some strategic metrics are proxies: log the exact definition rather than labeling a road objectively useless without a reproducible criterion.

Separate policy computation, preview/rule execution, projection, serialization/worker transfer, persistence/network, and presentation delay. Report p50/p95/max with sample count; aggregate/peak allocated search nodes, incremental memory and maximum policy main-thread task. A whole-process Node heap reading is not incremental device memory.

Outputs: canonical manifest, resolved profiles and hashes, per-match JSONL, aggregate JSON/CSV, static HTML comparison report, decision-level reason codes, failure traces and replay commands. A headless diagnostic may record private synthetic state, but it must be marked privileged and never sent into policy or production telemetry. Real-player private data/tokens must not be included in shared reports. Successful-game traces may be sampled; retain every failure trace within a bounded artifact budget.

## 7. Difficulty profiles and promotion

Use the same fair input and rules for every level. No level may cheat, alter dice, grant resources or deliberately hang the UI. Difficulty must change the quality/consistency of decisions, not just cosmetic latency. Human pacing remains separate and configurable for accessibility/testing.

| Profile | Intended behavior | Initial experimental search budget | Evidence before claiming the level |
|---|---|---|---|
| Easy | Coherent basic goals, ordinary useful trades, occasional seeded variation among near-best choices. | Heuristic only; epsilon 0.05–0.15 and top 2–3 near-best choices are candidate ranges, not final values. | Legal, completes games, no trade spam or gratuitous blunders; measurably below Standard. Keep old baseline as an experiment opponent, not an assumed calibrated Easy. |
| Standard | Production/plan-aware heuristic and trade/resource improvements; conservative variation. | Heuristic first; optional small beam only if it improves held-out strength within budget. | Beats frozen current policy and Easy under the declared matrix; passing human experience/device gates. |
| Hard | Stronger measured planning, public threat handling and deeper combinations. | Initial beam 6–8, depth 2–3, cap 128–256 nodes; MCTS not required. | Beats Standard on held-out games for both seat counts under its own measured compute cap. Do not ship a Hard label just because it searches deeper. |

Proposed minimum practical promotion criterion for stronger profile versus a homogeneous lower-level roster: focal win-rate point estimate at least `1/n + 0.05`, with corrected 95% lower confidence bound above `1/n`, independently for 3 and 4 seats. This is an absolute five-percentage-point effect, not a two-player 55% target. Also require no material regression against the separately declared mixed-opponent pool; predeclare a two-point noninferiority margin if using one. Failure to demonstrate ordering means continue tuning or retain fewer advertised levels.

Initial device gates: p95 end-to-end policy/preview/worker computation ≤250 ms for Easy/Standard and ≤500 ms for Hard, excluding cosmetic delay; no policy main-thread task >50 ms. Proposed incremental decision/search-memory ceiling: 8 MiB for each profile, measured separately from shared assets/runtime. A hard worker watchdog at 1,000 ms cancels once and uses the pinned baseline fallback at most once, then pauses visibly on failure. These are proposed release limits, not achieved device results. A frequent fallback is a failed performance gate, not a successful Hard implementation. Set an experiment maximum fallback rate of 0.1%, report every event, and require ordinary scenario tests to produce zero fallbacks.

Default resource/noise controls cannot override fixed safety ceilings. Tuning may choose lower budgets, never expand a release ceiling. Check configuration size (initial hard limit 16 KiB canonical JSON), output size, maximum nodes and retained memory independently of user-editable weights.

Persist exact profile versions/hashes with new games. Expose Easy/Standard/Hard selection at creation only when promoted; a details panel may show profile version. Changing an experiment file cannot change a running game. Keep compatible policy/profile assets cached for pinned games; unavailable versions produce an explicit compatibility state, not silent substitution.

## 8. Architecture and integration acceptance

Suggested modules: profile registry/validation; shared feature extraction; goal/value evaluator; bounded action generators; optional same-turn search adapter; decision worker/scheduler; headless experiment runner and report/optimizer tooling. They remain independently testable.

Reuse authoritative pure rules through a narrow preview adapter for supported deterministic own actions. The current `module.apply` accepts a full session; passing that full session into a bot is prohibited. Do not create a duplicate engine to support lookahead. Hidden/chance-dependent actions and human acceptances are outside the first beam's guaranteed transitions. Later sampled worlds contain hypothetical consistent hidden data and independent simulated entropy, never the coordinator's secrets.

Capture immutable revision/authority epoch/profile/decision seed before scheduling. Discard late or stale results, then re-evaluate from a fresh permitted observation. Preserve the original unresolved command ID for unknown delivery outcomes; do not rerun policy to replace that command. Sleeping iOS or losing the coordinator pauses existing execution; profile changes do not add server scheduling or host transfer.

Version feature normalization, rounding, canonical action ordering, seeded tie-breaking and budget semantics. Freeze these with policy/profile artifacts so optimization results can be reproduced. A watchdog fallback may vary with hardware, so its committed command and fallback reason must be recorded; it cannot be replayed by pretending the normal full search completed.

## First foundation delivery — 2026-11-11

[Implemented experiment tooling](BOT_EXPERIMENTS.md) now provides frozen Easy/Standard baselines, seven tunable legacy-heuristic controls, strict JSON profiles, headless 3/4-seat rotated experiments, deterministic replay, parallel workers, interrupted resume and descriptive reports. This is a partial BOT-AI-00 foundation: the planner schema/example above, automatic optimization, formal uncertainty and calibrated difficulty remain proposals. The tools do not change the bot used by the PWA.

## 9. Delivery checklist and current status

1. BOT-AI-00: profile schema/registry + frozen baseline + runner/report contract.
2. BOT-AI-01–03: economic plans, trading and resource decisions, with isolated probes and ablations.
3. BOT-AI-04–06: graph expansion, opening and race logic; tune small groups incrementally.
4. BOT-AI-07: optional beam adapter/worker and bounded experiments.
5. BOT-AI-08: freeze Easy/Standard; ship Hard only with separate evidence.
6. BOT-AI-09: optional later MCTS study.

The foundation subset described above is implemented; remaining items are **specified, not implemented**. Existing policy remains `heuristic-1.1.0`; current Easy/Standard labels have no new calibrated-strength claim. The earlier review executed 12 baseline games and a legal trade probe; no stronger candidate has yet been benchmarked.

## 10. Research basis and reuse policy

The design draws on production-aware plans and negotiation alternatives described by [Guhe and Lascarides (2014)](https://www.pure.ed.ac.uk/ws/portalfiles/portal/19351482/CIG2014_GS.pdf), and [action-category sampling research](https://homepages.inf.ed.ac.uk/alex/papers/intellisys.pdf). External source reviewed: [Catanatron](https://github.com/bcollazo/catanatron/tree/ecf931181b9a65bb4116a2153fb78c16f1438e00/catanatron/catanatron/players) (GPL-3.0), [JSettlers2](https://github.com/jdmonin/JSettlers2/tree/7a756baac6ad675f0930605bfb3a8e1bd7a796a5/src/main/java/soc/robot) (GPL-3.0+), [CatanAPI](https://github.com/FerrisOfficial/CatanAPI/tree/eed03e01db09d48dc7605fbf7049e053f065486f/players) (root MIT; different two-player rules), and [sorinMD/MCTS](https://github.com/sorinMD/MCTS/tree/f1d87206655b59b383e2bddda26e60bbaf49dcf6) (root MIT with inherited game-model provenance to review).

No external code or weights are imported by this specification. Reusing any implementation requires file/dependency/weight-license review and notices under BOT-16. Describing algorithms is not permission to translate GPL implementation code into the current application.

## Robber and card scope opened after the shipped playtest

The owner has opened robber/development strategy after the 0.10.0 playtest and shipped-profile benchmark. [The focused ranked spec](BOT_ROBBER_CARDS_SPEC.md) defines robber/Knight evaluation first, then state-dependent purchases and common owned-card choice. It preserves observation privacy, existing builds/trades and pinned saved profiles; earlier deferral notes are historical, not the current roadmap. No policy or PWA change is made by this specification.
