# Trading diagnosis and one-for-one proposal ablation

This investigates the three-seat weakness seen in the [broader comparison](BOT_BROAD_SCREEN.md). It changes no gameplay policy or rule module. The observed win-rate differences remain uncertain; a mechanism found in replay is not proof that it caused the win-rate difference.

## Audit of all 224 recorded games

`trade-audit.mjs` replays the complete authoritative command traces and verifies every final-state hash. It checks the original rule/policy/runner byte identities and Node version; analysis-only commit metadata may differ. It correlates offer IDs with the persisted ledger, distinguishing an individual decline from a final declined/replaced/cancelled/accepted outcome. It normalizes proposals by observed own turns, including a final winning turn without an End Turn command.

Recipient affordability is measured **post hoc** using each recipient’s own authorized synthetic view. These observations never enter the proposing policy. The proposer still cannot see anyone else’s resource types. Actual subsequent investments and newly available investment action types are measured only during the active focal turn. They are useful proxies, not causal proof that a trade was necessary or strategically good. Incoming responses, outgoing proposal acceptance and third-party trades are kept separate.

| Stratum | Candidate accepted / proposed | Planner accepted / proposed | Candidate offers / own turn |
| --- | ---: | ---: | ---: |
| Three / Standard | 29 / 605 (4.8%) | 35 / 340 (10.3%) | 0.948 |
| Three / mixed | 48 / 506 (9.5%) | 53 / 364 (14.6%) | 0.922 |
| Four / Standard | 43 / 618 (7.0%) | 37 / 365 (10.1%) | 0.949 |
| Four / mixed | 75 / 591 (12.7%) | 41 / 308 (13.3%) | 0.955 |

The candidate proposed 439 give-one/request-two bundles in Three/Standard games: zero were accepted. Four/Standard similarly had 470 such offers and zero acceptance. The frozen Standard recipient explicitly requires cards gained ≥ cards paid before accepting; these terms cannot pass that condition. Easy's scoring noise can occasionally choose a strategically negative acceptance, so mixed-roster results differ. Do not hardcode knowledge of opponent implementation into the production strategy.

Three/Standard one-for-one candidate offers converted 27/157 (17.2%). In 358/605 outgoing candidate offers, no recipient could afford the exact request; that post-hoc fact is unavailable to the proposer. More potential recipients can improve the chance of a match in four-seat games, but these data alone do not establish the reason for higher win performance.

Of the 29 accepted Three/Standard candidate proposals, 19 occurred in turns followed by a focal investment, and 14 unlocked a previously unavailable investment action type. For the planner these counts were 13 and 24 of 35. The candidate's fewer completed proposals are not automatically worse quality; success rate alone must not replace winning performance or strategic validation.

See [aggregate audit evidence](../experiments/bots/results/trade-audit-v1.json). Full synthetic offer records remain local artifacts. No real game data or raw device report is committed.

## Predeclared exploratory ablation

`focal-equal-trade.json` uses the same `trade-planner-0.1.0` implementation with proposal bundle cap `maxCardsPerSide: 1`, allowing only one-for-one outgoing terms. This removes both asking two for one and offering two for one; it does **not** ban asymmetric incoming offers. `leaderPenalty` is scaled from 1.5 to 0.75 so its coefficient divided by the bundle cap stays 0.75, preserving the existing public-threat weighting. All other weights and budgets remain unchanged. Contract tests check incoming decision parity, threat normalization and legal one-for-one proposals.

This is a simple, bounded baseline for a future acceptance-aware model, not a claim that unequal trades are always bad. Human recipients may accept strategically useful asymmetric trades.

Both variants run the same `trade-proposal-ablation-v1` training case identities with six previously used training seeds (37, 91, 143, 211, 307, 401), all rotations, and the same four Standard/mixed strata. Each has 84 games, at most 2,500 commands and a 120-second watchdog per game, with two workers. The equal-proposal profile is compared with the unchanged trading incumbent, not the older planner. No parameter selection occurs inside this batch. These data are exploratory training evidence, not fresh validation or a locked test.

```sh
node scripts/bots/trade-audit.mjs RUN_DIRECTORY FOCAL_PROFILE OUTPUT.json
node scripts/bots/cohort-analysis.mjs EQUAL_RUN INCUMBENT_RUN OUTPUT.json focal-equal-trade focal-trade
```

The comparison tool accepts optional focal profile IDs; its original defaults and existing cohorts remain supported. Audit tooling and tests are original code without new dependencies. The installed app and the browser/device benchmark retain their earlier policies and fixture corpus.

## Ablation results (2026-11-12)

All 168 games ended normally, with zero rule/decision/cap/watchdog failures. Every final-state hash was additionally verified by audit replay.

| Stratum | Equal-only wins | Incumbent wins | Equal-only accepted / proposed | Incumbent accepted / proposed |
| --- | ---: | ---: | ---: | ---: |
| Three / Standard | 8 / 18 | 5 / 18 | 93 / 373 (24.9%) | 29 / 458 (6.3%) |
| Three / mixed | 11 / 18 | 11 / 18 | 98 / 320 (30.6%) | 44 / 358 (12.3%) |
| Four / Standard | 10 / 24 | 10 / 24 | 113 / 380 (29.7%) | 44 / 417 (10.6%) |
| Four / mixed | 12 / 24 | 10 / 24 | 118 / 366 (32.2%) | 61 / 415 (14.7%) |

Three/Standard proposal frequency fell from 0.939 to 0.871 per own turn, and offers with no affordable recipient fell from 245/458 to 113/373. Accepted-proposal turns followed by an investment rose from 10/29 to 52/93; the number unlocking a new investment action type rose from 9 to 39. These remain observational proxies, not proof that every accepted trade benefits the focal player more than opponents.

The Three/Standard win-rate difference was +16.7 pp with an exploratory paired interval approximately −5.6 to +44.4 pp. Four/Standard and Four/mixed intervals also included zero. Three/mixed had zero observed difference in every seed block: its percentile interval is mechanically [0, 0], which is **not** evidence of a precisely zero population effect. The analysis now flags degenerate resampling and reports the number of independent blocks. There were only six blocks per stratum; these results do not justify statistical strength/difficulty promotion.

See [paired comparison](../experiments/bots/results/trade-equal-comparison-v1.json) and [aggregate offer audit](../experiments/bots/results/trade-equal-audit-v1.json). Candidate/control replay and duplicate-free resume are checked separately. The experiment identity records source commit `365053ab2ad7e8a598df8992bb9e6d1b8859e444`, exact policy/rules/tool hashes and resolved manifests/profiles. Audit and statistical-tool source hashes are recorded with their aggregate evidence.

Decision: retain the equal-proposal profile as a promising experimental candidate for fresh validation. Do not replace the gameplay bot or assume unequal trades are intrinsically bad. Next gates are independent validation against several opponent mixtures, heavier physical-device observations, memory profiling and private human playtests. More realistic acceptance-aware proposals should use public information; audit-only recipient hands must never leak into strategy.

The [fresh 336-game validation](BOT_TRADE_VALIDATION.md) reproduced higher conversion but found a three-seat/mixed point regression. The equal-only profile is not promoted as a uniform replacement.
