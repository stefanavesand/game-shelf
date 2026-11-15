# Strategic Planner 0.1

Superseded for current runtime selection by [0.15 levels and Friendly robber](BOT_LEVELS_AND_ROBBER.md). This document retains the 0.14 design and experimental evidence.

Owner-requested improvements 1–4, release 0.14.0. This is a new experimental Planner policy for new Solo games, not a calibrated difficulty level. Standard/Easy and online bot selection retain their current implementations. Existing Solo saves keep their pinned `development-investment-0.1.0` or `build-trade-0.2.0` worker/profile and private goal memory.

## Design

The existing shared objective still drives construction, bank exchanges, player offers, incoming responses and discards. The purchase/Knight/robber overlays retain their algorithms and consume the updated plan. No rule-engine change, Monte Carlo, hidden-hand sampling or network API change is involved.

1. **Two-build planning.** Rank reachable city and settlement goals, then examine at most three first-build branches by default. Estimate one feasible successor using the same public topology and resource acquisition model. Compare an immediate city with a road/settlement route and its follow-up. Add a discounted successor benefit. Recompute after each observation; retain the current target only within the existing switching margin. A deterministic immediate winning command still overrides the plan.
2. **Competition for sites.** Build bounded road-distance maps from public opponent roads/buildings. Penalize goals that require more roads than the closest opponent and give a small urgency bonus to nearby contested sites. Occupied targets and blocked routes disappear through the existing legality checks. These distances describe reach, not an opponent's hand, affordability or intention.
3. **Resource economy.** Add marginal production diversity and incremental port conversion value to building goals. Discount stock beyond the recipe plus a bank-exchange bundle, using actual owned port rates. This complements the existing next-roll discard-risk estimate and next-build protection. The same hand valuation is used by trades and builds; no separate sender-specific trade strategy is introduced.
4. **Game stage.** Use own total VP divided by the victory threshold, including own private VP: expansion below 40%, production below 75%, finishing thereafter. Expansion increases the production premium; finishing reduces it and increases the ETA discount. Turn count alone cannot force a stage change.

The successor is a hypothetical completed build, **not an engine command**: missing resources are assumed acquired at the separately estimated fluid ETA, known remaining stock is retained, public topology/inventories and bank returns are adjusted, and a used Road Building card is consumed. Future random outcomes and opponent actions are not simulated. Only the final proposed real action is sent to the ordinary rules for validation.

## Parameters and budgets

The complete strict registry is `strategyRegistry` in [profiles.mjs](../scripts/bots/profiles.mjs). Profiles are checked for exact keys, finite values, bounds and policy version. The shipped [strategy-on.json](../experiments/bots/strategy-on.json) is generated into the offline worker package; [strategy-off.json](../experiments/bots/strategy-off.json) disables all four gates.

| Parameter | Default | Meaning |
| --- | ---: | --- |
| `enableBuildLookahead` | 1 | Enable the successor comparison |
| `enableSiteCompetition` | 1 | Enable public site competition |
| `enableResourceEconomy` | 1 | Enable balance, ports and excess-stock valuation |
| `enableStageStrategy` | 1 | Enable score-based stage adjustments |
| `maxLookaheadGoals` | 3 | First-build branches, maximum 6 |
| `lookaheadWeight` | 0.25 | Discounted successor utility |
| `raceRiskWeight` / `raceUrgencyWeight` | 0.45 / 0.12 | Public reach risk and urgency |
| `balanceWeight` / `portWeight` | 0.12 / 0.2 | Marginal production/port utility |
| `surplusWeight` | 0.015 | Excess retained-card penalty |
| `earlyProductionScale` / `lateProductionScale` | 1.3 / 0.3 | Production premium multipliers |
| `finishEtaScale` | 1.5 | Late-game completion urgency |

Existing route depth (2), per-search graph expansion (96), acquisition horizon (24 rolls), trade limits, memory envelope and worker timeout remain bounded. There is only one successor level. A weak, observation/parameter-scoped cache avoids repeating identical goal generation within a decision; it neither retains game histories nor changes the authoritative state. There is no incremental heap measurement or calibrated mobile CPU claim.

## Verification

- Nine focused strategy tests: bounded successors, immutable input, public site reach, excess stock, useful resource improvements, score-based phases, all-off parity, search/parameter limits, deterministic engine-accepted output, opponent-hand independence and occupied-site replanning.
- 305 native tests passed, including a complete experimental Solo game, saved-plan restoration and real worker parity for the new policy and both pinned predecessors.
- Eight package tests passed, including source/packaged decision parity and offline inclusion of all three profiles and the strategy module.
- Two full all-off control games (3 and 4 seats, seed 37) matched the previous policy's complete action trace and final state hashes exactly.
- The initial screen completed 14/14 seeded games without decision/rule failures, with rotated focal seats and unchanged parameters. The new policy won 2/6 three-seat and 3/8 four-seat games against the previous purchase-on policy. One complete game in each configuration and each cohort (four games total) was replayed with exact action, plan and final-state hash agreement.
- A separate synthetic runtime sample used ten authorized positions across three/four seats, one warmup and one measured round, and the real worker entry point through a Node thread shim. All source/worker results matched. Controller p50/p95: 34.5/43.7 ms; fresh worker including startup p50/p95: 85.4/98.3 ms. These are host wall times, not Safari/iPhone latency, worst-case guarantees or independent trials.

The initial sample is small and correlated by board seed/seat rotation; it is not proof of higher strength. Parameters have not been optimized against these outcomes. Separate validation completed another 14/14 games on fresh seeds 1009 and 2017 with the same frozen profile: 6/6 wins at three seats and 2/8 at four seats. This marked variation between two-seed cohorts is a reason to expand coverage, not claim a calibrated improvement. Physical iPhone/iPad performance and player acceptance remain open. Exact profiles, source hashes, per-match hashes, summaries, gate-off controls and runtime samples are in the [verification report](../experiments/bots/results/strategy-verification-v1.json). These are pre-commit working-tree runs; the report explicitly distinguishes the pre-change HEAD from the exact tested policy source hash.

## Reproduction

```sh
npm run bots:profile -- registry
npm run bots:profile -- validate experiments/bots/strategy-on.json
npm run bots:simulate -- --manifest experiments/bots/strategy-screen.json --out bot-results/strategy-screen-v1
npm run bots:simulate -- --manifest experiments/bots/strategy-validation.json --out bot-results/strategy-validation-v1
npm run bots:replay -- --out bot-results/strategy-screen-v1 --match MATCH_ID
node scripts/bots/shipped-runtime-benchmark.mjs bot-results/strategy-runtime.json
```

Use a new output directory for each source/profile revision. Existing source fingerprints include the strategy implementation; resume/replay rejects a mismatch. Change one gate/weight at a time in a copied profile, then compare rotated fixed seeds before evaluating fresh boards. Do not label Easy/Hard from this small screen.
