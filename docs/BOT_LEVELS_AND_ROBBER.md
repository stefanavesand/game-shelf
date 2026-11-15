# Bot levels and Friendly robber — 0.15.0

Owner-approved: the 0.14 Strategic Planner becomes Standard. Easy and Hard share its policy and use the proposed parameter profiles; they are initial difficulty candidates, not calibrated strength guarantees. Both Solo and online lobbies offer Easy, Standard and Hard. Planner/experimental and the old runtime profile versions are removed from the product.

## Profiles

Standard is exactly [strategy-on.json](../experiments/bots/strategy-on.json), unchanged. [Easy](../experiments/bots/strategy-easy.json) disables successor planning, limits routes to one new road and public graph searches to 48 nodes, and lowers race/economy weights. [Hard](../experiments/bots/strategy-hard.json) compares six successors, permits three-road routes and 128-node searches, and raises race/economy weights. The registry validates exact keys, level/policy support, numeric limits and finite values. Other parameters, immediate-win handling and trade legality remain shared. No deliberate illegal or random blunders are introduced.

The browser worker and the headless adapter share `play/bots/decision.js`, with profile selection from the bot seat's configured level. Memory hashes include the exact profile. Browsers use a dedicated worker; hosts without Worker use the same pure bounded decision adapter. The Node test lifecycle generates the explicit runtime modules before core tests. Old purchase/build-trade profiles are removed before packaging; historical experiment code/results remain available for comparisons and provenance.

Local games save each accepted command and its actor-specific plan together. For online games the creator runs the same strategic runner. The creator's account-scoped room index holds each bot's private plan; a successful committed command is followed by a plan save. A lost acknowledgment, stale command or storage failure must not turn a proposal into a second move. Replica command IDs, revision/hash checks and the durable outbox remain authoritative. If plan saving fails after a move committed, the last plan is retained and can be recomputed from the current authorized view; the move is not replayed to restore a plan. Goal memory never enters public packets or the relay protocol.

## Robber rule

New games default to **Friendly robber**. The alternative is **Normal robber**. The lobby and game details display the chosen rule, and help explains it.

Friendly prevents placement on any tile touching an opponent with at most **two visible victory points**, even if that opponent holds private VP cards. It applies to movement after a seven and after a Knight. The active player's own buildings are not protected against their own placement. A tile shared by protected and unprotected opponents remains protected. Discarding on seven is unchanged. Once an opponent has three visible VP, their buildings no longer impose this protection. The normal rule removes this restriction.

The existing rule-engine placement filter is reused. `friendlyRobber` is a strict boolean in the creation/lobby configuration and is persisted in the initialized snapshot. Both host and guests replay the same configuration; resumes never derive it from current UI defaults. The pure engine keeps omitted configuration equivalent to its historical Normal baseline for archived traces; the production new-game entry points explicitly supply Friendly by default.

## Release compatibility

0.15.0 is declared breaking because the supported bot levels and agreed new-game configuration changed and retired bot runtimes are no longer shipped. Do not mix old and new clients in a room. Account identity is retained; incompatible unfinished games must be explicitly abandoned using the existing Home action before the update can activate. No remote account, server data or browser identity is deleted automatically.

## Verification and limits

- Rule tests cover two visible VP, private VP independence, three-visible-VP eligibility, normal mode, Knight movement, all levels and strict configuration validation.
- All six level/rule combinations are created, stepped, saved and reopened through the local client with the exact selected profile hash.
- The offline package includes Easy/Standard/Hard profiles and excludes the two retired runtime profiles. Standard remains byte-for-byte equivalent as a profile to the shipped 0.14 candidate.
- Four complete mixed-level games finished with ordinary rule validation and resource conservation: 3 seats/Friendly 406 commands; 3 seats/Normal 422; 4 seats/Friendly 385; 4 seats/Normal 515. This is legality/completion evidence, not a strength ranking.
- A native online-session regression verifies host/guest agreement on Hard/Friendly, host-only plan persistence across reopening, exact Hard profile identity and absence of goal memory from guest packets.
- Browser regressions exercise the three level choices, Friendly default, offline Standard worker reload, and an online Hard/Normal room replicated to another player. Existing natural two-human/one-bot relay coverage now uses the strategic bot.

Broader paired strength comparisons, Hard decision-time and memory measurements on physical iPhone/iPad hardware, and two-device acceptance remain follow-ups. Historical baseline simulation tests are labeled as frozen-baseline rule coverage; they are not evidence for current levels.

The overall CI check-job budget is 20 minutes to accommodate the expanded complete-game coverage; individual browser tests retain their existing limits.
