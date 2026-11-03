# Identity and relay API

Draft 0.3 · 2026-11-03 · Proposed implementation contract, not deployed.

Owner direction: trusted friends, replicated rules in PWAs, a game-independent service for identity and internet communication. Divergent rule results stop the game; automatic repair is deferred. This replaces the earlier managed-authority draft. It changes no existing game, endpoint, identity or save.

## 1. Boundaries and decisions

The service authenticates identities, manages invitation-based channel access, orders messages and temporarily retains them for reconnect. It does not run game rules, bots, random draws or turn logic. It does not store authoritative game snapshots or decide winners. No game-specific tables, endpoints or SQL rule functions.

Each PWA runs the same pinned game module, stores game state and pending messages in IndexedDB, and replays the same ordered commands/effects. Bots receive only their own projected observation, although complete snapshots are technically inspectable by every participant in this trusted-friend model. Non-members must still be denied access. This deliberately relaxes the older participant-secret-isolation requirement for new replicated games; existing managed games retain their current guarantees.

A channel is an access-controlled ordered message stream, not a game lobby. It knows a creator and members, but nothing about seats, bot levels, game phases or active players. Generic channel membership is necessary for private communication; game configuration and admission to game seats are application messages.

The creator initially coordinates initialization, random effects and bot proposals in the PWA. Its suspension can pause these actions; no automatic transfer is included. Clients need not run continuously or rely on iOS background execution. A disconnected client catches up later; missing verification is not disagreement.

## 2. Identity

Use the existing anonymous authentication provider through an adapter. The service derives playerId from the verified subject; clients never assert a sender ID. Preserve current subject IDs and auth storage during migration. Refresh failure does not silently create a replacement identity.

A profile contains playerId and displayName. Names need not be unique and never grant access. MVP invitations are links, so no global name directory or friendship graph is needed. The profile name is mutable; messages are attributed by stable ID. The PWA may record the name used when a game began as game metadata.

Normal reopen/update preserves identity. Clearing browser storage or using a new device may create a different identity; account linking/recovery is outside this stage. Local offline play uses local identity and requires no online auth service.

## 3. HTTP contract

Proposed endpoint: POST `/api/public/relay/v1`, JSON; Bearer JWT on every operation. OPTIONS is 204. Use HTTPS, explicit CORS allowlist, no-store responses and no shared/private-response service-worker caching. Discovery also requires auth in this first version.

Every request has protocolVersion=1, requestId (UUID) and op. Mutations additionally have mutationId (UUID), generated once, persisted before sending and reused unchanged after uncertain outcomes. requestId may change on retry. Authentication headers and requestId are excluded from semantic payload hashing. Reject unknown semantic fields and unsupported versions explicitly.

| op | Fields beyond common envelope | Result |
|---|---|---|
| capabilities | none | Supported protocol, effective limits and retention policy. |
| profile.get | none | Own playerId and displayName. |
| profile.set | mutationId, displayName | Updated own profile and durable receipt. Trim name, require 1–30 characters; no uniqueness claim. |
| channel.create | mutationId | Private channel, creator membership and one reusable invitation for this pilot, atomically with receipt. |
| channel.join | mutationId, inviteToken | Channel and own membership, atomically with receipt. Same identity remains the same member. |
| channel.read | channelId | Member IDs/names, access expiry, latest sequence and policy. No game state. |
| message.append | mutationId, channelId, expectedSequence, message | Atomically ordered message and receipt. |
| message.list | channelId, afterSequence, optional limit | Ordered bounded page, highWatermark, nextAfterSequence, hasMore, earliestAvailableSequence. |
| receipt.get | mutationId | Own receipt or outcome=unknown; no side effect. |

No leave/kick, public channel search, friend requests, direct player inbox, rematch, spectator, game list, WebSocket or push subscription in this slice. Invitations are shared through the existing OS/browser share flow, not delivered as unsolicited messages to other users.

### Example append

```json
{
  "protocolVersion": 1,
  "requestId": "<uuid>",
  "op": "message.append",
  "mutationId": "<stable-uuid>",
  "channelId": "<uuid>",
  "expectedSequence": 12,
  "message": {
    "schema": "game-shelf/session/1",
    "type": "game.command",
    "payload": {
      "gameId": "<uuid>",
      "baseGameRevision": 7,
      "command": {},
      "effects": {},
      "resultHash": "<sha256>"
    }
  }
}
```

The relay validates a bounded JSON envelope, schema/type string lengths and byte limits, not payload game semantics. The example game payload is illustrative, not a complete executable Catan action. The sender ID, message ID, sequence and receivedAt are server assigned. Message ID equals mutationId; it is scoped to the sending principal.

### Success and errors

Success: `{ok:true, protocolVersion:1, requestId, result, receipt?}`.

Receipt: `{mutationId, op, outcome:"stored", channelId?, sequence?, duplicate}`. Stored means the relay persisted the mutation, not that a game engine accepted a move. Profile/admission responses similarly confirm only their own mutation.

Errors: `{ok:false, protocolVersion:1, requestId, error:{code,message,retryable}, details?}`. Never return payloads or membership to unauthorized callers. Use stable codes; message is not branching logic.

| HTTP | Code | Handling |
|---|---|---|
| 400 / 413 | invalid_request / payload_too_large | Fix request, no retry loop. |
| 401 | unauthenticated | Refresh same principal once; preserve pending intent. |
| 404 | channel_unavailable / invite_unavailable | Nonexistent, inaccessible or invalid invitation; do not disclose membership. |
| 409 | sequence_conflict | Return latestSequence only to members; synchronize before deciding whether to propose again. |
| 409 | mutation_id_conflict | Same ID with altered semantic content; stop and preserve diagnostics. |
| 409 | channel_full | Valid invitation, generic member limit reached. |
| 410 | channel_expired / history_unavailable / intent_expired | Stop unsafe replay; do not silently recreate a channel or game. |
| 422 | unsupported_protocol | Preserve data; use a compatible client. |
| 429 | rate_limited | Honor Retry-After with bounded jittered backoff. |
| 500 / 503 | internal / unavailable | Outcome may be unknown; retry identical mutation or query receipt. |

If auth/expiry is denied, receipt lookup must not bypass it. An unknown receipt does not prove an in-flight request cannot still commit. Never replace an uncertain intent merely because receipt.get returned unknown.

## 4. Ordering and idempotency

Sequence starts at 0 for an empty channel; each stored message increments it exactly once, with no committed gaps. expectedSequence must equal the latest sequence inside the append transaction. An identical retry returns its original sequence even if later messages exist. Check a finalized receipt before CAS. Two concurrent new appends against the same sequence cannot both succeed.

Scope mutation deduplication to principal + mutationId across all mutation operations. Bind ID to validated canonical operation and full semantic content, including channel, expectedSequence and message. Provide shared canonicalization/hash fixtures. Authentication identity cannot be changed on replay. Same ID with changed content fails rather than overwriting a receipt.

Atomically persist append, sequence and receipt, or create/join/profile change and receipt. Crash after commit before response must be recoverable. Clients cannot write tables directly. Membership and channel access are checked transactionally on every operation. A replayed channel.create returns its original invitation, not a second channel; retain its secret result server-side under the same access restrictions.

sequence_conflict has no stored mutation outcome. Synchronize and revalidate locally. If still appropriate, use a new mutationId for the changed expectedSequence/payload only after the original attempt is known not to have committed. Domain game.commandId is separate from relay mutationId: a re-enveloped game intent must not apply twice. Verification/diagnostic messages consume channel sequences too; sequence is not the game's revision.

message.list captures a highWatermark per page and returns a consecutive range after afterSequence. Clients continue with nextAfterSequence, fetch new pages until caught up, deduplicate and never apply across a gap. The stream is append-only; no edits, deletion or compaction within its retention window. HTTP delivery itself may be duplicated or reordered.

## 5. Invitations and retention

Create high-entropy opaque tokens (at least 128 random bits), separate from channel IDs. Store token lookup hashes; a recoverable original token/result needed for create retries is service-only. A token authorizes membership acquisition, never unauthenticated snapshot access. Do not log tokens or place them in analytics. Prefer a URL fragment carried explicitly into channel.join, so ordinary page request/referrer paths do not expose it. First implementation allows one creator plus one guest; bots consume no relay membership. This is an advertised generic capacity limit, not a Catan rule.

Proposed pilot policy, requiring explicit implementation/reporting:

- Channel access: seven days after creation, fixed; expose accessExpiresAt. Reads do not extend it. This differs from existing Catan inactivity expiry and applies only to new relay channels.
- Retain the whole message stream and receipts throughout channel access. This avoids partial-history recovery in the first slice. Expired channels reject read/append/join; access expiry is distinct from deletion/backups.
- Retain inaccessible channel/receipt tombstones for 30 additional days, then permit deletion under an agreed backup policy. Clients never automatically replay expired intents.
- Include intentCreatedAt in mutation requests and semantic hashes; accept new unknown intents only within 24 hours of server time (up to five minutes clock skew). Check known receipts first, within their permitted access/retention. This makes a very late channel.create retry fail after its tombstone expires instead of creating a new channel. Repeated profile updates must obey the same rule. Return serverTime in capabilities so clients can diagnose clock skew.

The common request fields therefore also include intentCreatedAt (ISO-8601) on mutations; omitted in the shortened example above. These periods are concrete proposal values, not claims about existing provider retention. User-facing UI must disclose fixed channel expiry before starting a game. Test at boundary times without waiting real days.

Report actual effective quotas via capabilities. Initial targets: 8 KiB per message payload, 16 KiB HTTP request bound, at most 50 messages/256 KiB per page, 10,000 messages/16 MiB per channel, 5 channel creates/hour, 20 joins/minute, 120 reads/minute and 120 appends/minute per principal. Profile/receipt/capabilities endpoints also need bounded platform request quotas. Measure game traces before freezing values; verification traffic counts too. On capacity exhaustion reject new messages without deleting earlier ones. Use atomic quota accounting, Retry-After and a separate cheap ingress ceiling including duplicate retries. Do not run load tests on the pilot.

## 6. PWA responsibilities

The replicated session protocol is a separate module over this relay. It owns game.begin, game.command, verification and halt messages; version pins; seats; coordinator roles; injected randomness; state hashes; and local saves. Unsupported payload/schema versions stop synchronization safely. The relay must not learn these rules just to transport a new game.

Every client consumes messages in channel order, validates application-level sender permissions from the game participant configuration, and independently derives the resulting game state. It saves accepted transitions and its stream cursor atomically in IndexedDB. It does not trust a proposed snapshot instead of replaying a transition. Determinism requires explicit recorded randomness/IDs/time effects, canonical hashing and the exact pinned engine artifact. No platform random or clock calls during replay.

Application revision increments only for accepted game transitions. Two commands with the same base revision are resolved by channel order; stale/illegal commands are deterministic rejected game intents, not applied moves. Relaying an invalid proposal is not itself divergent execution if every engine rejects it identically. The UI distinguishes proposed/pending, durably delivered and locally applied; relay acknowledgment alone is not game success.

Each human PWA reports its computed hash/rejection against the same game revision and intent ID. Missing/offline reports are pending verification, not failure. On a reproducible mismatch, the detecting PWA immediately stops local play and sends game.halt with revision and sanitized incident ID. Other PWAs stop on receiving it, retain evidence, and show an error. Before receiving halt, other clients may have progressed further; retain those later messages for diagnosis and do not silently repair/restart. The service continues transporting messages because it does not understand game.halt. No majority vote or tournament anti-cheat.

Bot policies get only their seat observation even though the browser has complete state. Only the designated coordinator submits bot and random-effect proposals, identified by application-level participant configuration. Define and test effect request/response and pending-intent behavior before Catan integration; a suspended coordinator produces waiting status, not a fabricated move or engine failure.

IndexedDB contains full local snapshots, ordered game intents/effects needed for replay, stream cursor and stable outbox IDs. Reopen catches up from retained relay history. If a local save is lost, this stage does not promise game recovery even if replay might be possible. If history has expired or is unavailable, stop with a clear error. No silent online-to-offline switch, background execution, automatic coordinator transfer or automatic divergence recovery.

## 7. Incremental delivery

1. Build only identity/relay and a small developer test client. Keep the current Catan endpoint and live frontend unchanged. Use a dedicated test environment/identities.
2. Verify two independent browsers can invite/join, append in order, survive disconnect and retry, and cannot access a third player's channel. Test atomic races and bounded history.
3. Extract the shared deterministic game/session module with provenance and engine hash checks. Prove injected-effect replay and divergence handling with a tiny fixture game before Catan.
4. Integrate new Catan sessions and PWA persistence behind an explicit feature/version boundary. Keep current auth identities and old games on their existing backend. Do not route unresolved legacy commands through the relay as fresh intents.

No server rule removal, database deletion, existing game conversion or deployment is part of this documentation change. New games later reuse relay unchanged; only PWA game modules and application message schemas differ.

## 8. Acceptance cases

| ID | Given / action | Expected evidence |
|---|---|---|
| RELAY-01 | Same browser identity across reopen/token refresh; change name | Stable playerId; duplicate names allowed; other identity unchanged. |
| RELAY-02 | Create, lose response, replay same mutation | Exactly one channel, same invitation and receipt. Altered payload conflicts. |
| RELAY-03 | Guest joins with invitation; retries; third principal joins | Same guest binding; third denied at capacity; invalid token reveals no channel. |
| RELAY-04 | Non-member calls read/list/append or another user's receipt | No member IDs/messages/receipt contents returned; direct DB access denied. |
| RELAY-05 | Two appends against sequence N, or concurrent identical IDs | One new append per CAS position; duplicates recover original result; no gaps. |
| RELAY-06 | Commit succeeds, response lost, later messages arrive | Original retry returns original sequence; no duplicate game application. |
| RELAY-07 | Disconnect during pagination; deliver pages twice/out of order | Client fills every gap, deduplicates, resumes cursor; preserves pending IDs. |
| RELAY-08 | Expiry/retention/clock boundaries; very old create intent | Declared errors, no silent new channel and no premature live-history deletion. |
| RELAY-09 | Concurrent quota/body/history-limit attempts | Atomic bounds, bounded reads, proper 429/413, no existing-message loss. |
| RELAY-10 | Two engine instances replay ordered command/effect fixtures | Identical hashes after each accepted move; relay contains no game imports. |
| RELAY-11 | Same command rejected by both engines; inject one differing result | Rejection agrees normally; real mismatch stops clients and propagates halt. |
| RELAY-12 | Peer/coordinator sleeps; later catches up | No false divergence; waiting/pending visible; no iOS background dependency. |
| RELAY-13 | Restart PWA around IndexedDB save/outbox commit | Cursor/state stay consistent; resend original IDs; unavailable storage blocks unsafe play. |
| RELAY-14 | Run existing frontend/API compatibility checks | Old managed games/auth/pending commands unaffected; no premature cutover. |

These are specified cases, not executed test results. Stage 1–2 covers RELAY-01–09 and compatibility; replicated-game cases belong to later stages.

Related documents: [HLD](HLD.md), [MVP requirements](MVP_REQUIREMENTS.md), [migration backlog](MIGRATION_MVP_TODO.md), [Lovable brief](LOVABLE_RELAY_BRIEF.md). Older cloud-authority requirements remain applicable to the existing pilot; reconcile new-mode requirements before its release.
