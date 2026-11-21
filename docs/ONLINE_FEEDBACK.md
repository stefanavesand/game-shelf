# Live multiplayer feedback — 2026-11-20

## Changes in 0.15.4

- Device-local sound, on by default: a turn chime, a placement click, card swoosh and procedural dice rattle. The sidebar toggles sound. Audio unlocks after a user gesture and stops while hidden; no assets, requests or changes to game randomness. New/reloaded games do not replay historical sounds. Move cues follow the existing foreground animation lifecycle.
- Dice rotate in one direction with linear timing over 1.5 seconds instead of 3.1 seconds and an overshooting final keyframe. Card-flight completion still controls resource-count updates.
- Online trade dialogs compare the transport channel ID with the dialog's channel ID. Previously they compared channel ID with game ID, which differ online, and closed immediately. Reviewing an offer is available during delivery; mutation controls retain their revision/pending guards. Reopening one's offer always selects Players. The same channel/game distinction also fixes online result-statistics lookup.
- Theft details are inferred from consecutive authorized views of the recipient's own hand. Only thief/victim see the resource icon and type; everyone else sees the ordinary public event. Online observation happens for every replayed theft, including several events received in one poll, and is saved atomically with the cursor. It is a bounded, recipient-local journal outside commands and hashed state. Solo uses the same projection-based helper. Older theft details cannot be reconstructed from already-redacted history.
- Started games reuse channel metadata rather than reading it on every refresh/command. Lobby reads remain fresh; an unknown sender triggers an authenticated membership refresh before normal validation. Late members cannot change the fixed game roster. Foreground polling changes from five to 2.5 seconds; ordered delivery, cursor checks, pending commands and verification are unchanged.

## Backend analysis and recommended order

Inspected `stefanavesand/stefan-game-shelf` commit `d041e44b61c708ffa684ddffe576b488f658ab71`: `src/routes/api/public/relay/v1.ts`, `src/lib/relay/relay.server.ts` and `src/lib/relay/protocol.ts`. This is source analysis, not a measurement of the live service. No server code is changed by this release.

Each relay HTTP request performs network-backed `auth.getUser`, then sequential ingress quota, operation quota and operation database RPCs. A move involves synchronization, append and follow-up reads/verification. Guest random requests also await the host coordinator. Consequently request latency is multiplied across several round trips. Polling adds notification latency independently of backend processing. CORS preflight already has a ten-minute cache.

1. **Measure first.** The PWA now keeps at most 120 in-memory HTTP timing samples, containing only operation, duration, HTTP status and success. From the browser console: `const {relayPerformanceSnapshot}=await import('./relay/transport.js'); relayPerformanceSnapshot()`. Summary rows contain median/p95 and failure count, without tokens, channel IDs or game data. These timings exclude local identity-adapter work, but include HTTP/response parsing; they do not separate server/database time. Add server-side `Server-Timing` for auth, quotas and operation, then compare host/guest moves, warm/cold requests and regions. No telemetry is uploaded.
2. **Combine database work.** Enforce ingress/operation quotas and execute the operation in one transactional RPC. Preserve all membership/authorization checks, limits, idempotency receipts and append CAS. This removes sequential network trips without adding game rules to the relay.
3. **Verify JWTs locally where supported.** Use validated claims with cached JWKS instead of `getUser` for every request, preserving signature, issuer, audience, expiry and provider requirements. Document the revocation/fresh-account-state tradeoff; decoding an unverified JWT is not sufficient.
4. **Push wakeups.** Realtime/WebSocket/SSE hints can trigger a normal cursor read immediately. The ordered log remains authoritative and polling/reconnect remain fallbacks. Do not apply game state directly from push notifications.
5. **Reduce append/read round trips.** A versioned API extension could return the accepted message and ordered tail with the append response. Preserve durable outbox identity, CAS, page validation, replay and independent verification. Do not remove synchronization to make commands appear faster.

The 2.5-second interval implies about 24 idle reads/minute per foreground principal. The inspected backend allows 120 reads/minute, 120 appends/minute and 300 ingress/minute per principal; command/verification traffic uses the same budgets. Do not reduce polling to one second without load/quota evidence. Existing backoff remains in effect. Backend latency gains are not quantified until measured.

## Verification and remaining acceptance

Pure tests cover turn-sound deduplication/muting/hidden state, monotonic dice frames, recipient-only theft details, batched relay catch-up/reload, equal replica hashes and absence of private observations on the wire. Relay tests cover metadata reuse, authenticated late-membership refresh, unchanged fixed seats and diagnostic privacy. Browser scenarios cover real online channel/game IDs with offer close/reopen on both seats, sound preference persistence and linear dice timing. CI executes the browser suite; local sandbox cannot launch its server/browser. Physical installed-iOS sound behavior and perceived online latency need another playtest. Existing rules/compatibility IDs remain unchanged.

The harbor browser regression waits for the committed revision and exact resource hand after both bank exchanges. Closing the trade sheet begins asynchronous submission; an immediate storage read can precede the command. PR checks passed, but that one-shot read raced in the subsequent release run and correctly blocked deployment. The regression now checks eventual durable completion rather than treating dialog dismissal as an acknowledgement.

## Owner-selected sound and motion — 0.15.6

The later Sites playtest replaces the initial sound recipes and dice timing above with the [selected feedback profiles](SELECTED_FEEDBACK.md), including 1100 ms / 510° dice.
