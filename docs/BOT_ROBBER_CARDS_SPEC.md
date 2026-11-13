# Robber and development-card strategy

Status: staged requirements, with a narrow first robber/Knight slice implemented in a separate experiment linked below. A separate first purchase overlay is implemented in [development investment](BOT_DEVELOPMENT_INVESTMENT.md); the full owned-card arbiter remains planned work. This opens the scope previously deferred by the owner. The shipped PWA 0.10.0 counter-on profile remains unchanged.

## Verified current behavior

The [shared planner](../scripts/bots/shared-plan-policy.mjs) delegates robber placement/theft to the [frozen heuristic](../scripts/bots/baselines/heuristic-1.1.0.js). Its tile score counts adjacent buildings times dice pips, with a larger own-building penalty, but does not distinguish a city from a settlement or weight opponents by public win threat. Its victim choice maximizes resource-card count. Neither can inspect victim resource types.

Knight is valued at a fixed 95 in the fallback. Immediate winning construction/Knight is already checked separately, but ordinary Knight use has no common utility comparison with other development actions. Main-phase building/resource-card decisions can precede the Knight fallback. The shared planner defers Monopoly/Year of Plenty until after rolling and already evaluates them against its current goal. Road Building already supports a legal two-free-road route recipe and subsequent site placement; one-road and award-only value are not represented fully.

Development purchase is already a candidate goal, with fixed gain 0.35, while building goals add expected production. This asymmetry and the existing switch margin are plausible reasons for under-purchasing, not a causal finding. The [shipped benchmark](BOT_SHIPPED_BENCHMARK.md) observed eight purchases in 168 Planner games versus 1,017 for old Standard. Raising a flat weight alone is not the proposed solution.

The ordinary rules already provide legal robber positions/victims, correct city production, public army sizes, Largest Army ownership/ties, deck exhaustion, bank limitations and card timing. A Knight command enters robber movement; its `hex` field in the choices list is not a final selected destination. Movement and theft are subsequent ordinary commands. These rule mechanics must be reused.

## Ranked changes

| Priority | Change | Required behavior |
| --- | --- | --- |
| 1 / BOT-AI-06 | Robber destination and victim | Value blocked production with cities counted twice; protect own production needed by the active plan; consider public opponent threat and valid theft opportunities. |
| 2 / BOT-AI-06 | Knight timing and Largest Army | Compare freeing production, blocking opponents, expected theft, army progress and retaining the card/other card opportunities. Preserve immediate winning actions. |
| 3 / BOT-AI-01/06 | Development purchases | Replace flat purchase gain with a state-dependent expected investment; compare against concrete builds, bank options, saving and hand exposure in compatible utility units. |
| 4 / BOT-AI-03/04/06 | Shared owned-card choice | Compare all legal action cards before spending the one-card-per-turn opportunity. Improve resource choices/free-road cases without disconnecting from the construction plan. |

### 1. Robber placement and theft

Enumerate authoritative legal choices; do not introduce new placement rules. Score each candidate using its actual dice probability and adjacent production units (one per settlement, two per city). Public near-winner/army/road information can weight the cost to opponents, while own resource scarcity relative to the selected plan weights self-harm. Desert/neutral placements remain valid alternatives; avoiding own tiles is a preference, not an extra legality restriction.

For placement ranking the old tile is vacated for every candidate. For deciding **whether to play Knight**, account for the gain from releasing the old tile as well as blocking the new tile. Use a bounded expected blocking horizon with explicit uncertainty; do not assume that the robber remains forever or knows an opponent's next Knight.

Choose the destination and subsequent legal victim consistently. Theft is one random card regardless of victim hand size. A larger hand does not, without composition information, imply a larger chance of obtaining the needed resource. The first version should use public threat, legal nonempty victims and a documented neutral/coarse expected own-hand gain rather than guessing private types. Never inspect the actual sampled stolen card in a preview. If victim types are unknown, equally plausible compositions should not manufacture spurious certainty.

Required scenarios: equal dice number, city versus settlement; shared own/opponent tile; freeing own ore production needed for a city; a public near-winner versus a lower-threat opponent; no productive opponent tile; empty/ineligible victim excluded; multiple valid victims; identical observations after redistribution of hidden victim types. Keep optional friendly-robber restrictions in the reducer's legal choices.

### 2. Knight and army timing

Keep the known immediate-win override. Evaluate the **best legal resulting robber move**, not the placeholder hex on `PLAY_KNIGHT`. Include production release/blocking, expected theft, own hand exposure and army progress, with a cost for consuming a playable card and today's development action.

Largest Army requires at least three played Knights. A tie retains the existing holder; taking the award requires a strictly larger army. Do not grant two expected VP to every Knight or assume hidden opponent Knights. Distinguish taking, approaching and defending the award using public army sizes and known own cards.

Before-roll Knight can restore blocked production for the upcoming roll and can win immediately through the army award. Waiting may be better when another owned action card has higher expected value. A random steal can raise the hand over seven before rolling; include this uncertainty. Preserve the ordinary phase return after the full Knight/move/theft sequence and the one-action-card limit. Before-roll policy changes must be tested separately from placement quality.

Required scenarios: blocked own high-production city before rolling; no useful block/award gain and a valuable card to retain; army size two with no holder; tying a holder at three; overtaking a holder at four; immediate winning Knight; an already winning build; Knight versus a useful Year of Plenty; valid return to roll/main after movement/theft. Preview deterministic army effects with existing helpers; never ask game entropy to predict a theft.

### 3. State-dependent purchase value

Start from documented base-game facts: 14 Knights, five Victory Points, two Road Building, two Year of Plenty and two Monopoly cards. An initial-mixture prior is an approximation, not the exact remaining-deck distribution. Set a type probability to zero when own-known cards and unambiguous public facts prove that all cards of that type are exhausted; do not double count own played Knights and public army totals. Opponent unplayed cards are hidden; remaining deck count alone does not reveal its composition. Conditional priors require a demonstrably complete public/own-known ledger without double counting own played cards. Do not reconstruct that ledger from a truncated history or read the private deck; defer that refinement in the first purchase implementation.

Expected card benefit should depend on army distance/current holder, robber exposure, resource needs, a feasible free-road path, own known VP/late-game distance, existing playable-card inventory and the delay before a newly bought action card can be used. Include opportunity cost of paying ore/grain/wool and the effect on the current build plan/hand risk. Use one consistent comparison with waiting/building/bank alternatives; do not charge the same payment twice through both a hand delta and an additional arbitrary cost penalty.

A useful investment may become the active goal, so subsequent trades/resource-card choices must follow it. Hysteresis must still prevent marginal changes from constantly abandoning a valid construction plan. Test purchase decisions both with no prior goal and with a remembered city/site. Do not buy just to fall below eight cards. Do not assume a VP draw is guaranteed; an actually drawn own VP is counted by the ordinary scoring engine. Multiple buys may be legal, while only one action card can be played per turn; own queued cards should lower the marginal value of another speculative purchase.

Required scenarios: affordable investment with no nearby build; ore/grain reserved for an immediately winning or clearly better city; near army award; no road pieces/route; many unplayed action cards; deck empty or a type provably exhausted; newly drawn action card unavailable this turn; Victory Point counted automatically; hand-risk threshold alone insufficient; changed resource hand reverses the preferred buy/build decision; all draws remain ordinary reducer effects.

### 4. Common action-card comparison

Year of Plenty and Monopoly already have same-goal evaluation. Extend rather than replace that work: compare marginal goal progress, retained-card value, hand exposure and competing legal action cards on the same scale. Select Year of Plenty resources jointly with actual bank availability. Monopoly may use the validated **aggregate** base-game bank/own-hand inference already implemented, without attributing private types to individual victims; unsupported/hidden bank observations need an explicit conservative fallback. Do not play a zero-yield Monopoly.

Road Building must value the actual legal one/two-road sequence, remaining road pieces and a reachable site or feasible Longest Road finish; no arbitrary roads merely because the card is available. Existing two-road site follow-through must retain the same goal. Preserve mandatory free-road placement/automatic phase exit using authoritative choices. Year of Plenty/Monopoly should normally wait until after rolling; before-roll exceptions need distinct evidence. A known winning free-road/army sequence must not be displaced by a tiny resource gain. Victory Point is not an action card to play.

Required scenarios: two-resource city/settlement unlock; same-resource bank stock shortage; Monopoly aggregate gain versus useful goal gain; zero yield; one legal free road/one piece left; two roads to the remembered site; award finish; resource card versus Knight army award; one card already played; owned old card versus same type bought this turn; consistent bank/trade/build follow-through after the card.

## Adjustable controls and limits

New experiment profiles must expose strict, bounded controls; do not change published 0.2 defaults. Proposed groups (ranges/defaults to be justified with prepared positions before tuning):

- Robber: own-production protection, public threat multiplier/boundary, plan-resource scarcity weight, expected blocked rolls and theft utility weight.
- Knight/army: award-progress weight, retained-card cost, minimum play gain and separately gated before-roll timing.
- Purchases: expected-type value/weights, newly bought action-card delay discount, queued-card penalty, phase/VP horizon and minimum buy improvement/switch margin.
- Resource/free-road use: card opportunity cost, hand-risk contribution and bounded road/card alternatives, reusing existing route/choice limits.

Keep gates for **new robber valuation**, **new Knight timing**, **new purchase valuation**, and **new owned-card comparison**. Off delegates unchanged behavior, not “never play/buy that card.” Only one implementation slice should change at a time: first robber/Knight, then purchase value against a frozen robber baseline, then the remaining card comparison. Do not perform an unreviewed full power-set parameter search. Reuse per-decision public topology calculations; keep observation/choice caps and explicit limits on candidate sequences. No unbounded game-tree search, real-deck sampling, UI, storage or network API belongs in policy code.

## Verification, metrics and rollout

First run prepared legal positions through the ordinary reducer, check input immutability and deterministic action/goal replay, and repeat hidden-data permutation tests. Cases with injected known cards are **prepared strategy tests**, not natural coverage or proof of strength. Check that all-zero gates reproduce the shipped profile before interpreting win changes.

Freeze profiles and use known training seeds for each isolated change. Track blocked/released expected production (city-weighted), own blocked production, public threat of selected victim, Knights played/held, actual army changes, purchases/queued cards, resource-card yield and subsequent plan steps, hand exposure/losses, latency and completion failures. Separate expected proxies from actual sampled outcomes and winning causality. Synthetic stolen-card/deck details are allowed in **post-hoc audits only**, never policy input. Do not optimize card purchase counts or acceptance rates as a substitute for competitive performance.

Then use fresh held-out seed blocks, all seat rotations, Standard/mixed opponents and all-new-policy self-play. Do not recycle consumed shipped-benchmark validation seeds as new evidence. Current policy purchases few cards, so prepared scenarios plus separately reported natural card coverage are necessary. Measure the new worst observed decisions with the real worker before another device playtest; no current iPad heap/latency guarantee exists.

The first implementation should be a separate experimental policy/profile with robber valuation and Knight timing only; purchase/build/trade weights remain fixed. Existing PWA 0.10.0 games pin 0.2 profile/worker memory. A later app integration must preserve that loader/profile alongside the new version and pin new games explicitly; overwriting the current generated profile would reject saved plan envelopes. Rule-engine changes are not implied by this strategy work. No server or protocol change is required for Solo.

Review baseline evidence: the existing 21 rule-validation tests and 14 shared-plan tests passed before implementation, including card timing, army ties and prepared card/build sequences. Those verify the existing engine/planner only. Current-strategy findings above are code-review evidence plus the published benchmark counts. The separate experiment records added scenario evidence; the full matrix, new purchase quality, device performance and competitive benefit remain unproven.

The first [robber/Knight experiment](BOT_ROBBER_KNIGHT.md) is now implemented separately with two independent gates and thirteen focused tests. Its narrow timing gate preserves selected builds/trades/other cards and can retain an otherwise selected Knight; the full owned-card arbiter and purchase valuation above remain future slices. The shipped PWA profile remains unchanged.
