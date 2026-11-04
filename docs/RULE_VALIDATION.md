# Current rule and bot validation

2026-11-04. Tracks RULE-VALIDATION-01, BOT-VALIDATION-01 and QA-01 / MVP-R01. This is incremental evidence, not certification of every base-game rule.

## Fixed expected outcomes

`tests/catan/validation.test.js` adds nine scenario tests with explicit expected results rather than using a second replica as the oracle:

- Settlement/city production of one/two cards; no partial payout if several players need a resource with insufficient bank stock; remaining stock paid when only one player is entitled; robber blocks production.
- Seven requires half (rounded down) from hands over seven; off-turn discards are legal, incorrect quantities do not mutate state, and all required discards precede robber movement.
- Longest Road threshold five, holder retention on ties, interruption by an opponent settlement and transfer to the remaining longest qualifying route.
- Largest Army threshold three, holder retention on ties and transfer only to a strictly larger army.
- Four cities plus one settlement plus a bought victory point immediately wins at ten. Off-turn points alone do not end the game.
- Year of Plenty rejects an unavailable duplicate resource atomically; Monopoly takes only the selected resource from both opponents; a second action card in the same turn is rejected.
- Easy/Standard reject unaffordable incoming offers. Redistributing unseen resources between opponents while preserving public totals and bank stock produces identical observations and decisions.

These are intentionally prepared scenario states, isolated from natural-game evidence. Scoring fixtures do not prove settlement placement legality. Intended base-rule reference: [official CATAN rules](https://www.catan.com/understand-catan/game-rules); the specific edition and complete clause-to-test matrix remain to be agreed/reviewed. Expected results were made explicit in tests; an independent rules review is still required.

## Current-policy natural-game regression

`tests/catan/simulations.test.js` runs 100 natural games from ordinary initialization, without funded hands, edited dice/decks or privileged actions:

| Configuration | Easy | Standard |
|---|---:|---:|
| Two emulated humans and one ordinary bot | 25 | 25 |
| One emulated human and two ordinary bots | 25 | 25 |

Human seats are driven through the same validated command path using seat-restricted heuristic observations; their ordering alternates in the two-human configuration. Ordinary bots use the production scheduler decision function. This is not evidence of actual human usability, independent bot playing strength or every possible seat rotation.

Each action checks finite resource conservation/nonnegative integer quantities, the 25-card deck plus held/played-card inventory, and road/settlement/city piece inventories. Each game must finish before 2,500 actions; caps fail rather than count as wins. Failure output contains the seed, configuration, policy/artifact and action index/type needed to reproduce the deterministic trace, without real-player data.

Executed locally on Node: **100/100 completed**, 44,185 actions, maximum 647 actions/game, policy `heuristic-1.1.0`, artifact `0b6ec737a127830c017a7c46f757ad81047d247760527968266c3e178ed2821b`. Suite runtime approximately 43 seconds on this executor, not an iPad performance result. No backend requests were needed.

Both suites are included in `npm run test:catan` and `npm run test:core`, so normal CI checks the current policy. Existing [live multiplayer evidence](EMULATED_MULTIPLAYER.md) remains separate.

## Remaining gate work

Complete the independent rule-reference matrix, explicit Road Building/robber/award branching and trade-race cases, all sender/recipient bot trade combinations and rationale checks, storage/update failure coverage and actual iPad acceptance/performance. The above passes do not close RULE-VALIDATION-01, BOT-VALIDATION-01 or QA-01 as a whole.
