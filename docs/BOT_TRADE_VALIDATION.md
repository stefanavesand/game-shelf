# Fresh-seed validation of equal-only proposals

This tests the parameter-only proposal profile from the [trade diagnosis](BOT_TRADE_DIAGNOSIS.md). Profiles and the validation manifest were frozen before inspecting results. See the [recorded analysis plan](../experiments/bots/results/trade-validation-plan-v1.json). Run setup was fixed before launch; the analysis/decision plan was recorded while execution was running, before inspecting win outcomes. This is not external preregistration. The strategy, rules, production bot and browser benchmark remain unchanged.

## Locked setup and analysis plan

- Candidate: existing `focal-equal-trade` profile; one-for-one outgoing terms, asymmetric incoming offers still permitted.
- Control: unchanged `focal-trade` incumbent. This is a comparison within experimental trading policies, not a new comparison against the production heuristic.
- Twelve fresh seeds: 2203, 2309, 2411, 2503, 2609, 2707, 2801, 2903, 3001, 3109, 3203, 3301. Checked disjoint from all existing top-level experiment manifests before creation of these manifests.
- All 3/4-seat rotations, Standard and mixed opponent rosters identical to the prior training experiment. Three-seat/Standard is primary; other strata remain separate secondary comparisons.
- 168 games per variant, 336 total, at most 2,500 commands per match, 120-second watchdog and two workers per variant. Reserved command slots: 840,000 total.
- No in-batch parameter changes, candidate selection, optional early stopping or rerunning failed games until success. Failed/capped games remain in denominators.

Paired whole-seed percentile bootstrap intervals use the existing deterministic analysis tool. There are twelve independent blocks per stratum; rotations are correlated. Intervals are exploratory and not multiplicity-adjusted. A positive primary point difference with no negative secondary point differences supports more investigation only. A nonpositive primary result does not confirm the training improvement. No outcome in this batch automatically promotes a gameplay bot or creates a named difficulty.

Initial random seeds do not guarantee identical subsequent dice when action paths consume entropy differently. The beginner terrain/port layout remains fixed; this batch broadens stochastic trajectories and preserves opponent-stratum coverage, not board diversity. Profiles have zero decision noise and the original threat coefficient remains normalized.

## Reproduction

```sh
node scripts/bots/cli.mjs simulate --manifest experiments/bots/trade-equal-validation.json --out /tmp/trade-equal-validation
node scripts/bots/cli.mjs simulate --manifest experiments/bots/trade-incumbent-validation.json --out /tmp/trade-incumbent-validation
node scripts/bots/cohort-analysis.mjs /tmp/trade-equal-validation /tmp/trade-incumbent-validation /tmp/trade-validation-comparison.json focal-equal-trade focal-trade
node scripts/bots/trade-audit.mjs /tmp/trade-equal-validation focal-equal-trade /tmp/trade-validation-equal-audit.json
node scripts/bots/trade-audit.mjs /tmp/trade-incumbent-validation focal-trade /tmp/trade-validation-incumbent-audit.json
```

Run under the recorded source/runtime identity for replay/resume. A checkout with analysis-only new commits still produces a distinct runner fingerprint by design. Resolved manifests/profiles and code/rules hashes accompany the results. Full synthetic traces stay local/ignored; aggregate evidence is checked in. Once inspected, these seeds are validation evidence and must not later be described as untouched final-test seeds.

## Results (2026-11-12)

All 336 games ended normally. There were no rule/decision failures, action caps or watchdog failures. All recorded final-state hashes were independently reproduced by the offer audit.

| Stratum | Equal-only wins | Incumbent wins | Difference | Exploratory paired 95% interval |
| --- | ---: | ---: | ---: | --- |
| Three / Standard (primary) | 16 / 36 | 13 / 36 | +8.3 pp | −11.1 to +25.0 pp |
| Three / mixed | 15 / 36 | 22 / 36 | −19.4 pp | −38.9 to 0.0 pp |
| Four / Standard | 24 / 48 | 20 / 48 | +8.3 pp | −12.5 to +31.3 pp |
| Four / mixed | 32 / 48 | 27 / 48 | +10.4 pp | −2.1 to +22.9 pp |

The primary point difference is positive, but the Three/mixed secondary point regression fails the recorded no-negative-secondary condition. The candidate is **not promoted** as a uniform replacement. These are point estimates with twelve independent seed blocks and exploratory, unadjusted intervals; do not describe the table as proof of population-level strength or harm. Pooling the four strata would hide the primary three-seat product risk.

Outgoing offer conversion improved consistently:

| Stratum | Equal-only accepted / proposed | Incumbent accepted / proposed |
| --- | ---: | ---: |
| Three / Standard | 159 / 719 (22.1%) | 63 / 846 (7.4%) |
| Three / mixed | 190 / 666 (28.5%) | 79 / 770 (10.3%) |
| Four / Standard | 223 / 769 (29.0%) | 72 / 904 (8.0%) |
| Four / mixed | 277 / 729 (38.0%) | 97 / 843 (11.5%) |

Three/mixed equal-only accepted proposals were followed by a focal investment in 109 of 190 trade turns, versus 52 of 79 for the incumbent. Enabling more own investments and completing more trades did not translate into more focal wins in this stratum. The opposing planner won 16/36 equal-only games versus 11/36 control games; Easy won 5 versus 3. These observations motivate recipient-benefit/opponent-strength analysis, but do not establish that any specific trade caused those outcomes. Private recipient hands from the audit must never enter proposing policies.

Evidence: [paired comparison](../experiments/bots/results/trade-equal-validation-v1.json), [offer audit](../experiments/bots/results/trade-validation-audit-v1.json), and [decision record](../experiments/bots/results/trade-validation-decision-v1.json). Profile/rules/tool hashes and the resolved manifests identify source commit `d40015be1fcf9cad315569d5b20a2cd27a0cb7a3`. Both profiles match the locked plan, and one exact command replay per variant plus duplicate-free resume are checked separately. Full synthetic traces and detailed audit records remain local artifacts.

Next: develop recipient-benefit/public-threat evaluation on training data and retain this mixed-roster regression as a diagnostic, not an untouched final test. Do not keep tuning until these validation seeds look favorable and call that independent confirmation. Gameplay policy, installed browser benchmark, rules, UI and release version remain unchanged. Device stress, memory, board diversity, final-test design and private human playtests remain open.
