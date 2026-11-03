# PWA relay foundation

2026-11-03 · Original client implementation, counter fixture only. Catan has not moved into the browser engine yet.

## Scope and use

Run `npm run play:dev` and open `http://127.0.0.1:4176/game-shelf/play/relay/`. This separate developer page connects to a configured relay, creates/restores an anonymous identity explicitly, sets a display name, creates/shares or joins a private channel and runs a tiny replicated counter. The creator can roll a die with an explicit shared effect; either participant can add one. Both derive their own state and exchange hashes.

The relay must have its migration applied and route published before online use. The endpoint is editable; choose the deployed backend's `/api/public/relay/v1`. The page permits the configured Lovable hosting domain or localhost so an auth token is not sent to an arbitrary pasted host. No production credentials are bundled; the existing publishable auth key is public configuration.

Open the invitation in a second browser/device, connect explicitly and join with its token. Start the counter on the creator. Synchronize in both clients; matching state hashes and “Both players agree” demonstrate independent execution. A missing/offline peer remains pending, not a failure. The page polls every five seconds only while visible/online and allows manual sync/retry. It requests persistent storage and reports denial without pretending persistence was granted.

This is not an installable/offline-app-shell release. IndexedDB game persistence exists; service worker/offline resource caching and the main Catan UI integration are later work. Browser test evidence is not physical iPad certification.

## Modules

| Module | Responsibility |
|---|---|
| `play/core/identity.js` | Provider-specific anonymous identity adapter, separated from Catan transport; same-subject refresh, explicit initial signup, no silent replacement. Future OAuth plugs in here. |
| `play/relay/transport.js` | HTTP framing, token binding, timeout, one same-identity refresh after 401, structured errors, byte limits and Retry-After. No game rules. |
| `play/relay/lobby.js` | Persist profile/create/join intent before sending; recover exact admission request after a lost response. Retain last channel selection. |
| `play/relay/store.js` | IndexedDB snapshot/cursor/outbox in one record transaction, scoped by principal and channel. No legacy save migration. |
| `play/relay/replica.js` | Version/artifact pins, ordered application, intent dedup, separate game revisions, injected effects, hash verification and irreversible halt. |
| `play/relay/client.js` | Locked synchronization, pagination, immutable pending requests, CAS-conflict catch-up and durable generated verification/halt replies. |
| `play/relay/fixture.js` | Independent deterministic counter test module; not a second Catan engine. |

The fixture artifact digest covers fixture, replica and canonical-protocol source. Versions and state integrity are checked when reopening a saved replica. This is a small test-module boundary, not a completed packaging solution for Catan dependencies. Canonical game data uses safe integers; the generic server can transport other finite JSON numbers, but game replay rejects them deliberately.

No game engine or assets have been copied from private backend/upstream sources. Existing rights/provenance review is still required before extracting Catan. The owner explicitly removed old-save/active-game compatibility as a migration requirement on 2026-11-03; this foundation adds no migration/mirroring bridge. The existing client is left as the usable game while the counter experiment is developed, not as an obligation to preserve pilot data.

## Semantics and limitations

A relay stored receipt means delivery, not a valid game move. The PWA applies only ordered messages from channel members; only the channel creator initializes the fixture. A stale game command loses by channel order and never applies twice. A deterministic proposed-result/hash disagreement durably stops local play and queues a halt message. Peers stop when that ordered halt arrives; later messages remain available for diagnosis. There is no majority voting, repair, takeover or continuing play after halt.

An uncertain append keeps its exact mutation ID, timestamp and payload across reload. A definitive sequence conflict permits a new relay envelope after catch-up, preserving the game intent ID. Both the original game outcome and verification progress are independent of relay sequence. Unknown version, missing history, changed identity or corrupted checkpoint stops unsafe play. Local storage failure prevents new mutation sends.

Web Locks serialize sessions across windows; IndexedDB commits state/cursor/generated outbox together. A request already in flight is resolved before replacement. Foreground sync work is bounded to 20 pages/20 outgoing messages per invocation. Large catch-up can need more sync passes; quotas/cooldown still apply. No background processing guarantee.

Full state is available to participants in this trusted-friend model. Bots must still use seat projections when later integrated. Current fixture effects only support creator-generated die rolls. Catan effect request/response, bot scheduling, engine extraction and user-friendly game outcome/rejection presentation remain follow-ups. No full Catan online/offline game is claimed.

## Verification

- `npm run test:relay`: 20 Node contract/replica tests against an in-memory relay double, including lost acknowledgments, exact retries, CAS races, duplicate game intents, delayed peer, mismatches, version/hash corruption, auth binding/refresh and admission retry.
- `npm run test:core`: includes those tests plus the existing 19 client tests. All 39 passed locally.
- `npx playwright test --project=relay`: four browser tests against intercepted HTTP and real IndexedDB: two independent browser identities, mobile-width layout/denied persistence, full reload after commit/lost response, durable halt across reload, and denied storage preventing mutation. All four passed against the packaged dist files.
- Complete packaged browser run: 46 passed, two opt-in live Catan checks skipped (48 cases). No live relay test is included in that count.
- `npm run check`, `npm run build`, `npm run test:package`: syntax/docs/package integrity; package checks passed. CI automatically includes the relay project and new assets.

The relay double follows the reviewed backend source shapes at `5d6683467a6e5e601de42d6656d3f961344323cd`. These tests do not prove the live API/database or physical iPad behavior. Backend offline suite independently rerun locally: 31 passed, 27 integration tests skipped. Lovable reports 74 disposable-PostgreSQL checks; those database checks were not rerun here.

The initial browser run exposed an incorrect requestId-sensitive hash in the test double and asynchronous test timing. The double now excludes correlation IDs as the real backend does, and busy controls stay disabled until client work completes. No production service was used for these browser tests.

## Next steps

1. Activate the relay migration/server route and verify authenticated live HTTP and CORS. Explicit owner instruction sent to Lovable, message `umsg_01m6gy3yckf2jbd5s1d5jkwm1z`; activation/publication is tracked separately from this client branch.
2. Run this same counter over the real API in two browser contexts/devices, record endpoint/build and results, then try iPad suspension/reopen.
3. Extract the shared Catan module with provenance; replace the fixture with deterministic initialization/effects and bot scheduling. Complete real-game UI integration and app-shell caching before claiming the new mode playable/installable.

See [API contract](SESSION_API_SPEC.md), [Lovable brief](LOVABLE_RELAY_BRIEF.md) and [backlog](MIGRATION_MVP_TODO.md).
