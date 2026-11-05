# Catan PWA engine: deterministic relay slice

Current follow-up: [rules 2.1.0 trading](TRADING.md) adds All offers, public replies, safe replacement/counteroffers and allowed maritime rates to the main PWA. The dated extraction evidence below remains historical.

2026-11-03 · Rules 2.0.0 · Separate developer interface; the main game UI still uses the managed Catan flow.

## Delivered boundary

`play/catan/rules/` contains the extracted base rules, complete session transitions, seat projection and basic bot policy as native ES modules. There are no React, Redux, PartyKit, Supabase, HTTP, DOM or storage dependencies in the rule module. `play/catan/module.js` adapts it to the replicated session interface; the relay server remains unchanged and transports opaque messages.

The small developer interface at `play/catan/` uses the shared identity/relay demo controller. Two human identities join a private channel, initialize a three-seat game, place directly on the actual board with explicit confirmation and observe one coordinator-run bot. The interface renders legal choices and the player's projected hand. It is an integration harness, not the approved final Catan workspace or a completed MVP.

The counter page remains at `play/relay/`. Its generic connection UI is extracted into `play/relay/demo.js`; each demo uses its own local IndexedDB namespace to avoid resuming a different game module accidentally. No legacy-game migration is required by the owner.

## Deterministic state and effects

A new game's configuration pins rulesVersion=2.0.0, module version 2, an artifact digest, fixed layout, participants and randomAlgorithm=xorshift32-v1. The creator supplies a nonzero uint32 seed using browser crypto. The shared rule module receives an injected deterministic context:

- A versioned PRNG state supplies bounded random integers with rejection sampling. Initialization shuffles order/deck; all later accepted actions consume the same stream. The state is committed with the snapshot. Rejected moves do not consume it.
- Logical time is the engine revision, starting at zero. No wall-clock timestamps are needed because the scoped game has no turn timer.
- Entity IDs use game ID plus a monotonic counter, saved with the state. No client independently invents piece/card IDs during replay.

This is an explicit deterministic effect representation: the initial seed, algorithm/version and saved continuation state determine every draw. It replaces the earlier proposal to record a separate tape of all dice/ID/time calls. It avoids an extra coordinator request for a human die roll. Only bot actions need the coordinator, and each bot action is an ordinary validated game command. Future real timers/external effects need another versioned contract rather than adding Date.now() inside rules.

This PRNG is not cryptographically secure. Participants can inspect seed, deck, hands and future draws because the approved model trusts friends. Bots still receive only their seat projection; no raw snapshot is passed into botDecision. This is not tournament anti-cheat or proof of independent randomness fairness.

Rendering-only floating port positions were removed from snapshots; the UI renders from integer edge coordinates. Rule state contains JSON-safe integers/strings/arrays/objects. Geometry identities and board traversal order are stable. Node and browser runs replay the same command trace and compare hashes at every step.

`play/catan/artifact.js` is generated from the exact rules, adapter, entropy and shared protocol/replica bytes. `npm run check` rejects a stale manifest; `npm run build` regenerates it. It is a build-time version pin, not a claim that all downloaded resources were independently verified for offline installation. Safe service-worker updates remain separate work.

Human UI actions explicitly bind the displayed game revision/hash. Synchronization cannot silently rebase an old confirmation onto changed game state. An outdated selection asks for review again. The coordinator can recompute a bot proposal after synchronization within its bounded work budget. Replicas still compare outcomes and halt on disagreement; missing peer verification is pending, not a bug.

## Source/provenance decision

[The source inventory](provenance/CATAN_SOURCE.json) records original repository commit, source SHA-256 and every moved file. Nine modules were added in the owner's OpenCatan project history and have no file counterparts in the reviewed upstream baseline `97786b131a4af8eae8aada53578bfca9b1789982`. They were type-erased once with TypeScript 5.9.3 and now live as maintained native JavaScript with remapped local imports. This is not a TypeScript typechecking claim or a copy of the entire original application.

The five upstream-counterpart helper implementations identified in the earlier inventory were **not imported**: hex.ts, hexMath.ts, boardGenerator.ts, types/player.ts and types/cards.ts. New `geometry.js` implements integer axial topology using the independently implemented UI coordinate contract and mathematical hex relations. New `model.js` supplies minimal player fields, base-game card counts and an explicit fixed radius-two layout. These are newly written helpers using the required data contract/game facts; this is not a claim of a formal clean-room process. No upstream artwork, Redux types, private backend bundle or environment files were copied.

The new fixed layout is versioned configuration; bit-for-bit parity with old generated boards/snapshots is not claimed or needed. Rights to the excluded upstream code remain unresolved for the older application. The settlement-scoring adaptation retains the full verified catan-ai MIT notice inside bot.js and in the existing notice files. The notice applies to that adaptation, not the entire rules module. No blanket repository license or trademark permission is asserted. Broader distribution/name/asset review remains LEG-01.

## Executed verification

- 15 Catan Node tests passed: artifact/import boundary, topology (19 hexes/54 vertices/72 edges), reciprocal incidence, all rule/UI edge endpoints, finite deck/ports/seed, entropy continuation, setup, 150-action two-state replay, actor/effect rejection, private projections, longest road and actual Catan relay replication.
- One natural seeded policy game reached a winner in 354 actions/92 turns without privileged state fixtures. This is simulated play, not a physical two-human acceptance game.
- `node scripts/simulate-catan.mjs 100`: **100/100 games finished**, 30,111 total actions, maximum 474 actions. Resource, card and piece conservation checked after every action; no failures or action-budget exhaustion. This exercises the supported three-seat policy configuration, not a rating of bot strength or all future variants.
- Two Catan browser checks passed against packaged files: Node/browser hashes match over 100 actions; two independent browser identities complete direct-board setup with a coordinator bot and reload the saved state over intercepted relay HTTP. Four existing relay browser regressions also passed.
- The new stale-confirmation core regression verifies no implicit rebase after another player's accepted move.

These results do not certify full manual UI coverage, real iPads, interrupted app updates or all Catan rule edge cases. Live Catan API/device evidence, if run, is recorded below rather than inferred from the existing counter live test.

## Remaining work

Replace the developer surface with the approved main game workspace. Add proper player trade composition/All recipients, batch bank exchanges, complete special-phase interactions and explicit selected/pending/rejected/bot-error presentation. Keep these in the shared game/session modules, not in the relay server. Finish installable app-shell caching and update safety, then run a natural two-person/one-bot game on real iPads. Google/Microsoft accounts remain AUTH-01.

Related: [PWA relay foundation](PWA_RELAY.md), [API spec](SESSION_API_SPEC.md), [migration backlog](MIGRATION_MVP_TODO.md), [source provenance](../SOURCE_PROVENANCE.md).

## Live Catan slice and budget-focused delivery

A live two-browser Catan relay test passed against the published service on 2026-11-03 in 58 seconds: independent anonymous identities, invite/join, deterministic initialization, an actual direct-board placement, matching state hashes and peer verification. Real HTTPS was forwarded through the executor's TLS-verifying proxy as documented for the counter. Traces/screenshots were disabled and no tokens were printed. This is one real move, not a complete human game or iPad certification.

The owner then requested a smaller usage budget and prioritized the ordinary Catan view with the resource-row trade UI. The existing managed game remains that entrypoint; its composer now uses five resource rows, own holdings, Give/Request steppers and a compact recipient select. Bank & ports uses the same layout and exact authoritative legal rates. Seven targeted browser checks passed, including both iPad orientations and 360/390px widths. All-recipient offers and multi-exchange bank commands remain follow-ups because the current managed game contract does not support them. No false broadcast or partially executed client batch was added.
