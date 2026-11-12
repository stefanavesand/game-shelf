# Production-aware economic planner experiment

First BOT-AI-01 candidate, 2026-11-12. This is an offline experiment, not a shipped difficulty or a promotion of the app's unchanged `heuristic-1.1.0` bot. See [experiment tooling](BOT_EXPERIMENTS.md) and [ranked specification](BOT_IMPROVEMENT_SPEC.md).

## Behavior

`planner-0.1.0` evaluates concrete city sites, currently reachable settlements, a bounded set of one-road-to-settlement plans, and development-card investment. It compares deterministic build/bank successors with retaining the current hand. Legal winning deterministic builds override economic weights. It uses the same authoritative `applyEconomy` and scoring helpers for deterministic previews, from a projected observation only; no actual session snapshot, hidden opponent hand, deck or game RNG is supplied. Candidate output is still validated by the ordinary rules in each simulated match.

Resource acquisition is a **fluid production approximation evaluated at integer dice rolls**, not an exact expected completion time. It combines own holdings, expected production per roll, bank/port ratios and the currently visible finite bank. Cities produce twice a settlement. A currently robber-blocked tile contributes zero; future robber movement, opponent spending and correlated random arrivals are not forecast. A plan beyond the configured horizon has zero future-plan value. This is intentionally conservative about future bank inflows.

Utility includes known own VP (coefficient 1), expected production over the horizon, the discounted best remaining plan, resource readiness and available settlement opportunities. Readiness distinguishes a useful bank conversion from merely possessing enough exchangeable surplus. A road gets no unconditional positive build bonus: it must improve the projected position or win. Costs come from shared production-rule constants.

A development purchase receives a configurable expected utility after accounting for its shared cost. This evaluates an unknown investment; it never guesses or inspects a real drawn card. Opening, discard, robber, card-play and incoming player-trade decisions retain the frozen baseline behavior for now. If the economic planner elects to wait and the baseline has a proposal, it can retain that proposal. This stage does **not** fix the separate BOT-AI-02 asymmetric-trade acceptance restriction.

The candidate is stateless between decisions. Proposed future plans are recomputed; no persisted goal, hidden belief, beam search or Monte Carlo rollout is introduced. One-road candidates use existing legal graph helpers but a bounded first-N expansion list, not the deeper graph/path ranking planned in BOT-AI-04.

## Profiles and commands

```sh
npm run --silent bots:profile -- template planner-0.1.0 > /tmp/planner.json
npm run bots:profile -- validate experiments/bots/planner-default.json
npm run bots:simulate -- --manifest experiments/bots/planner-smoke.json --dry-run
npm run bots:simulate -- --manifest experiments/bots/planner-screen.json --out bot-results/planner-screen
npm run test:bots
```

`bots:profile -- registry` now groups the legacy and planner registries explicitly. Existing legacy profile JSON is unchanged. Planner profiles require every effective field; integer work bounds and unknown/missing fields are validated. The policy version separates these VP-scale parameters from legacy heuristic-score units.

| Parameter | Default | Meaning |
|---|---:|---|
| `productionWeight` | 0.08 | VP utility per expected resource over the horizon |
| `horizonRolls` | 12 | Acquisition/production horizon, integer dice rolls |
| `etaPenaltyPerRoll` | 0.08 | Discount of delayed goal benefit |
| `readinessWeight` | 0.2 | Value of directly held fractions of a plan's resource cost |
| `handReserveWeight` | 0.7 | Weight of the best remaining goal |
| `expansionWeight` | 0.08 | Weight of currently reachable settlement opportunities |
| `developmentValue` | 0.35 | Expected utility of an unknown development purchase |
| `maxPlans` | 8 | Maximum retained plans after bounded candidate generation |
| `maxRoadCandidates` | 8 | Maximum one-road extensions considered per projected state |
| `minActionGain` | 0.005 | Minimum positive improvement over waiting |
| `noiseAmplitude` | 0 | Seeded tie/near-tie score variation |

These are initial experimental values, not tuned optima. `maxPlans` limits retained plans; candidate generation also scans the finite base board and up to `maxRoadCandidates` extensions. It is not a promise of exactly eight rule/helper calls per decision. Search remains absent.

## Initial screening evidence and limits

The training manifest uses seeds 37, 91, 143, 211, 307 and 401. Each seed runs all three/four focal-profile seat rotations against frozen Standard baselines: 18 three-seat games plus 24 four-seat games. All 42 completed without rule or action-cap failures in the initial screening.

| Stratum | Candidate wins | Focal games | Equal-policy reference |
|---|---:|---:|---:|
| Three seats | 7 | 18 | 1/3 |
| Four seats | 5 | 24 | 1/4 |

The results are mixed, with very wide uncertainty and correlated rotation blocks. They do **not** demonstrate stronger play or justify changing the app's Standard label. This is a training/screening cohort, not untouched confirmation data. A production release needs held-out seed groups, opponent mixtures, ablations, measured device budgets and the promotion criteria in the specification.

In that Linux/Node run the candidate's p95 decision costs were about 24 ms (three seats) and 27 ms (four seats), with maxima about 67/64 ms. Timings include observation cloning/freezing, planner evaluation and previews; they are neither iPad measurements nor evidence of a ≤50 ms main-thread task guarantee. A browser worker and physical device validation are still needed before shipping heavier policy work.

`tests/bots/planner.test.mjs` covers acquisition-speed differences, port conversion without local production, a depleted bank, city yield, complete bounded profiles, immutable authoritative previews, winning-action priority, useful conversion versus waiting, determinism, hidden-hand redistribution invariance and a naturally completed projected-input game. The existing baseline/foundation tests continue to run. The public app/rules artifact is unchanged; planner code and experiment files are excluded from the PWA package.

## Next decisions

Continue with BOT-AI-02 goal-aware player trading, plus controlled weight/feature comparisons through the existing runner. Preserve this candidate/profile as a named experiment; do not silently retune or promote it using these same screening results. Automatic optimization, deeper graph planning, stronger setup, worker integration and calibrated difficulty remain separate deliverables.
