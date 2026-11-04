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

Complete the independent rule-reference matrix, unusual board/resource edge cases and trade-policy rationale checks, storage/update failure coverage and actual iPad acceptance/performance. The targeted follow-up below supplies explicit Road Building/robber/award cases and the sender/recipient trading matrix. The above passes do not close RULE-VALIDATION-01, BOT-VALIDATION-01 or QA-01 as a whole.

## Targeted rule/trading follow-up — 2026-11-04

The focused suites now contain **21 rule-boundary tests and 24 trading tests**, adding 36 scenarios to the earlier nine. All 45 focused tests passed locally. No engine, bot policy, protocol, UI or server behavior changed in this follow-up; the engine artifact remains the same. The tests run in ordinary `test:catan` and `test:core` CI commands alongside the existing 100-game regression.

New fixed rule expectations:

- Road Building permits two resource-free placements before rolling, returns to the roll phase, rejects a third road, and stops after one remaining piece after a roll.
- A pre-roll Knight rejects the current robber tile and invalid/empty victims, cannot skip an available victim, steals exactly one existing card, preserves bank stock and leaves the roll due. An empty destination needs no victim choice.
- A six-road loop counts six; three two-edge branches count a maximum four-road trail. Ties without a qualifying existing holder have no award. Losing a holder's road to a blocking settlement does not give the award to either of two tied opponents.
- Largest Army transfer moves its two points between holders. A player at ten off-turn wins when their own turn begins, before rolling.
- Knight, Road Building, Year of Plenty and Monopoly are unavailable on their purchase turn but usable on a later turn. The Victory Point purchase exception remains covered by the earlier immediate-win test.

Trading matrix: Easy and Standard × human-to-bot / bot-to-human / bot-to-bot / human-to-human × accepted useful offer / unaffordable offer declined. Offers use ordinary validated commands; bot recipients use the actual policy/scheduler, while human responses are explicit test commands. Clearly useful offers are deliberately generous and complete several build goals; this does not promise that bots accept every fair-looking or marginal trade.

The matrix checks no premature transfer, recipient authorization, resource conservation, no repeated transfer after late acceptance, and inability to accept cards not owned. Further cases cover Standard declining an affordable but resource-losing offer; bots proposing bounded offers, waiting for humans and not immediately reoffering after decline; accept/cancel in either command order; old responses against replacement offers; and atomic rejection of malformed quantities, unowned resources and overlapping resource types.

Fair-information cases redistribute unseen resources while preserving public totals/bank stock, swap hidden card types with the deck, reorder the future deck and change future entropy. Bot observations and decisions must remain identical. Repeated identical observations produce identical choices. Easy's noisy priorities remain intentional: legality and reproducibility are tested, not universal agreement with Standard's strategic preferences.

All added cases are prepared scenarios or policy observations, not natural human play. In particular, the one-piece Road Building fixture isolates the remaining-piece limit rather than constructing fourteen roads, and scoring graph fixtures isolate awards rather than proving every prior placement legal. Ordered accept/cancel tests cover transition outcomes, not real backend concurrency. No live service calls or real-player data were used.

The independent edition/clause review and unusual board/resource edge cases remain open. Test coverage is stronger; RULE-VALIDATION-01 and BOT-VALIDATION-01 are not automatically complete, and iPad/multiplayer/performance acceptance remains separate.
