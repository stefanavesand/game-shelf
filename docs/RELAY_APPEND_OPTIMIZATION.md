# Confirmed append replay — 0.15.8

## Motivation and measured scope

Owner-reported Solo-via-backend samples: `message.list` 86 requests, median 296 ms / p95 408 ms; `message.append` 34 requests, median 302 ms / p95 406 ms; zero failures. These are a rolling window, including idle polls, not an end-to-end move measurement. The existing per-request latency accumulates across sequential reads and writes.

For an uncontended ordinary command with an empty outbox, the old path was pre-read → command append → read back → verification append → read back. The new path is pre-read → command append → verification append. The normal case uses **3 HTTP requests instead of 5**. At about 300 ms per request, the two removed round trips model roughly 600 ms less waiting; this is an estimate, not a measured production speedup. Per-request medians are not expected to change from this client-only optimization. Idle polls, conflicts, proposals/host resolutions and recovery have different request counts.

## Proof and replay

The existing backend response already identifies the durably stored append. Inspected backend `stefanavesand/stefan-game-shelf` commit `d041e44b61c708ffa684ddffe576b488f658ab71`, `relay/migrations/0001_relay_v1.sql`: `relay_message_append` checks membership, idempotency and `latest_sequence = expected_sequence`, then stores the exact message and returns channel/message/sequence metadata plus the stored receipt. No backend API or database change is required.

The client binds that result to the exact persisted request, validates the receipt's mutation ID, operation/channel when supplied, and `sequence = expectedSequence + 1`. It can replay its acknowledged message locally only when the sequence is also exactly `cursor + 1`. Full-message echoes additionally require matching sender, message ID, sequence and canonical contents. Missing/opaque metadata or an already-replayed duplicate receipt uses ordinary ordered-log catch-up instead.

Both read pages and confirmed appends use the same `applyMessage`/hash validation and private-observation callback. State, cursor, observations, generated verification and removal of the pending request commit in one checkpoint. A failed checkpoint retains the original request so replay after restart uses the same mutation and game-intent IDs. A wrong receipt/result preserves pending delivery rather than accepting a different message. Concurrent peer traffic still triggers normal compare-and-swap rejection, catch-up and retry. Pre-command synchronization, verification writes, authoritative game rules, peer verification and polling are retained. Client-only replay occurs after server acknowledgement, never speculatively before it.

## Verification and next work

The relay contract double now defaults to the actual flat append-response shape. Tests cover exact request counts for flat/echo/opaque responses, post-ack storage failure and idempotent retry, contradictory metadata, altered echoes, duplicate receipts, concurrent peer verification and the existing lost acknowledgements/CAS/hash mismatch paths. Private-theft observer tests retain equal replica hashes and no wire disclosure. Browser regressions run against the same response shape. Rule-source digest, session schema and engine compatibility remain unchanged.

Compare again in Solo via backend after **Reset measurements**, using similar moves and idle time. Expect fewer `message.list` requests per command, with similar individual HTTP durations. Next server-side targets remain those in [the backend proposal](ONLINE_FEEDBACK.md): add auth/quota/database `Server-Timing`, combine the sequential quota/operation RPCs, consider locally verified cached-JWKS claims with the required authorization semantics, and push wakeups for real multi-client notification latency. This release changes no server code and does not establish which component dominates the measured 300 ms.
