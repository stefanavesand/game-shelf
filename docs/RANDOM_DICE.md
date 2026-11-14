# Recorded random dice

PWA 0.12.0 uses `host-random-v1` for new Solo and online games. Existing games omit this field and keep their exact seeded behavior. The optional mode is part of the hashed module state and begin configuration. Base-game rules and the managed relay API are unchanged.

## Responsibility boundaries

`play/core/random-effects.js` is the side-effect adapter: two independent WebCrypto bounded draws, using rejection of the uneven uint32 tail before modulo six. It never enters the pure rules. The reducer strictly accepts exactly two integer faces in 1–6 for a random-mode roll and rejects missing/excess/malformed effects. It records the faces in the ordinary roll history entry. Other actions cannot supply dice effects.

The initial board/deck/seat setup and robber theft still use the existing seeded entropy. This change makes **dice** unpredictable; it is not a conversion of all game randomness or a competitive anti-cheat system. The trusted host can choose supplied values dishonestly; peers validate legality and state hashes, not physical randomness.

Direct seeded `catanConfig` remains the default for simulations and regression traces. New app sessions explicitly opt into recorded random dice. Headless local-client tests inject reproducible effects rather than trying to compare two independent WebCrypto histories. No production fallback silently substitutes seeded randomness if WebCrypto fails.

## Online request/result protocol

The existing versioned session envelope gains two message types:

1. `game.propose`: the active guest requests a roll, with unique intent ID, game ID, base game revision, before hash and command. All peers validate the request against the ordinary module. This persists in the relay and local replica, does not advance the game revision, and contains no chosen dice.
2. `game.resolve`: only the original channel creator may resolve that recorded proposal. It references the same intent, proposer, command, base revision/hash, and adds `{dice:[face1,face2]}` and the resulting state hash. The host computes then durably saves the entire outgoing message before any network mutation. Every peer applies the same ordinary reducer with these recorded effects, advances one game revision and verifies the hash.

Host-human and bot rolls use the existing `game.command` path with host-generated dice effects. A guest cannot bypass the request path by sending a result directly. Host resolution acts for the original authorized proposer only; it cannot replace their command. Duplicate requests, repeated UI submission while waiting, old revisions and duplicate result delivery cannot execute an extra roll. A proposal ID cannot be reused as an ordinary command ID.

The durable outbox preserves the exact message, effects and transport mutation ID across lost acknowledgments, CAS retries and host restarts. Peers never generate replacement randomness while replaying. Requests from a superseded revision cannot advance the game. A malformed proposed acceptance or unequal resulting hash stops the game using the existing disagreement handling.

The server remains an ordered relay plus identities. No backend rule engine, new endpoint or database migration is required. Everyone should update before starting a new online game; older clients do not understand recorded-dice requests. Existing seeded games remain readable by the new app.

## Solo, waiting and presentation

Solo generates effects locally, saves the resulting snapshot/hash/history before returning success, and checks the expected revision before a repeated command can sample. Reload restores the saved result. Local saves remain snapshot based, with the existing bounded history; this does not introduce a complete local all-move replay log.

A pending online roll disables further actions and displays a host-wait message. Pending requests also fence account/update/abandonment operations through the existing pending-command checks. If the host closes the app, the guest waits; there is no automatic host transfer or background-execution promise.

Request transport sequences do not become game revisions or animation events. A confirmed result advances one revision, and the existing animation consumes its recorded `lastRoll`. Refreshing that revision cannot animate it twice. Opening/reconnecting at a later revision shows current state/history without replaying the entire animation backlog. Dice faces are available in stored history even after `lastRoll` is cleared on a later turn.

On host refresh, incoming changes are returned to presentation before another bot step runs. Existing foreground pacing then reserves the full dice/flight interval before the next bot command. Animation clocks do not enter the reducer, transport or hashes; clients may animate at different wall-clock times. Existing reduced-motion behavior remains.

## Verification

Focused tests cover unbiased bounded mapping/rejection, strict effects, unchanged seeded mode, exact recorded-result replay, sole host authority, repeated guest requests, restart and lost acknowledgments on both sides, local revision retry/reload, rejected tampering, and request-versus-confirmation animation events. Existing full-game local tests use injected deterministic effects for batched/stepped comparison. Browser tests add Node/browser replay of a recorded-random trace and two real browser replicas using WebCrypto with guest reload. These use a synthetic ordered relay; physical-device/two-network acceptance remains separate.

Backend code review: local `stefan-game-shelf` revision `5d6683467a6e5e601de42d6656d3f961344323cd`, `src/lib/relay/protocol.ts`, accepts bounded arbitrary schema/type strings and a canonical JSON payload (8 KiB). The new messages fit that existing contract. This is source review, not a new live-backend execution claim. Each guest roll adds one request envelope before the normal result/verification traffic.
