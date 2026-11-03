# Calm Table — real internet integration

2026-11-02. The owner reported the published prototype working, approved the layout and explicitly authorized connecting the actual game. This approves the UI direction and implementation step; it does not certify the device/OS matrix, a second participant's walkthrough, accessibility or MVP operational gates.

## Delivered slice

`play/` is an original browser client for the existing managed Catan authority. It uses actual authorized player views, legal choices, invitations, commands and persisted receipts. `prototype/` remains the separate scripted design review. No OpenCatan rule engine, upstream geometry/type modules or artwork was imported into the new repository. The installed pilot at `/OpenCatan/hello/` and its managed backend are not redeployed by this change.

The initial playtest address is `https://stefanavesand.github.io/game-shelf/play/`. It is a browser playtest, not the completed install/update cutover. Do not claim verified publication until the checks below record a public deployment.

The rendering layer follows the approved Calm Table composition. It displays real room occupancy, randomized setup order, legal placement previews, own hand/cards, public opponent counts, builds, dice, player/bank/port trades, discards, robber/victim choices, development cards and actual victory. It derives action availability from the authenticated player's server choices. Local UI selection is never applied as a game-state mutation.

A later owner-requested [solo extension](SOLO_INTEGRATION.md) adds one-human/two-bot rooms and a managed backend update; the original two-human integration evidence below retains its scope.

## Boundaries and contracts

| Area | Implementation and limits |
|---|---|
| Rules/authority | Existing managed server route `https://stefan-game-shelf.lovable.app/api/public/catan`, API 1 / engine 1.0.0. This is a real engine connection, **not** completion of engine-source migration, licensing or reproducible backend deployment. No SQL/rule reimplementation in the new client. |
| UI | `play/app.js` and `play/board.js`; original vector assets in `ui/art.js`; shared original Calm Table styles in `ui/calm-table.css`. Prototype and real client share presentation assets, not fixture controllers. |
| Coordinates | Original analytical pointy-hex projection for the deployed v1 N/S vertex and NE/E/SE edge format. Checked against black-box reference outputs and standard geometry; no upstream source implementation copied. Direct, keyboard-focusable SVG targets provide 44 CSS px hit areas; numbered external shortcuts were removed at the owner’s request on 2026-11-03. |
| Protocol | `play/core/protocol.js` validates API/engine/schema versions, phases, bounded arrays, actor/view binding and other-player hand redaction. Unknown protocol/domain error codes stop normal progression while retaining the outbox. Transport messages remain separate from drawing code. |
| Provider adapter | `play/core/transport.js` owns anonymous auth and managed HTTP; `client.js` exposes execute/refresh/inspect. Capability declaration records internet dependency, foreground polling, payload/seat limits and absence of LAN/Bluetooth/takeover. No provider call exists in rendering geometry. |
| Storage | `play/core/store.js` persists current room/outbox and authorized cached views in IndexedDB `game-shelf-online`, version 1, store `records`. The authority durably owns the full snapshot; only the recipient view is cached by the client, bound to principal and room. |
| Compatibility | Retains localStorage `spelhyllan-online-auth-v1` and `game-shelf-catan-online-v1`, plus exact locks `spelhyllan-online-auth` and `game-shelf-catan-command`. They coordinate with the older client when the browser shares the same origin/storage partition. This is not a guarantee that separate iOS standalone-app partitions share identity. |
| Identity | Reuses the saved principal; refresh failures never fall back to anonymous signup. A new identity is allowed only when starting with no saved room/unresolved command. Missing/corrupt/changed identity blocks replay; credentials and original data remain untouched. The configured Supabase publishable key is public; no server secret is included. |
| Command lifecycle | Save exact principal/UUID/body before sending. Request loss, 429, server failure and reload reuse that intent. Known stable rejection clears it and refreshes state. Concurrent windows coordinate under the compatibility lock; the server still enforces payload binding/revision/receipt dedup. |
| Reconnection | Foreground five-second polling, visibility/online resume, persisted cooldown with Retry-After/jitter. No assumption of iOS background execution. Persistent bot-turn stalls get a check/retry hint and bounded automatic checking; the authority currently lacks an explicit bot-fault status. |
| Privacy | Only the player's authorized view reaches the renderer. Other hands remain zeroed with counts only; hidden deck is not sent. Cached views are keyed by principal/room. No tokens or private authoritative snapshots are committed or printed. |

### IndexedDB/legacy handoff

The current record stores a fingerprint of its last legacy mirror. A changed valid legacy value means the old client wrote under the shared lock, so it is adopted. The new client commits IndexedDB before mirroring localStorage; a failed mirror leaves its prior fingerprint, so the stale mirror cannot erase a newly persisted intent. Missing legacy state is repaired from IndexedDB. A later successful mirror completes the handoff before another request. Future/invalid stored schemas stop without overwriting the original data.

This is a compatibility bridge, not a distributed transaction between browser databases. Safety still depends on all supported windows honoring the same Web Lock and the authority deduplicating the original command. Browsers without that lock capability are explicitly blocked. Account recovery/linking, cross-origin migration and native credentials remain separate work.

## Verification and evidence

- Native Node tests: **12 passed** for intent-before-send, identical retry, denied storage, concurrent resolvers, principal mismatch, future schema/projection secrecy, coordinate contract, token refresh and auth cooldown. Run `npm run test:core`.
- Deterministic Chromium tests: **21 passed**, one live-service case skipped by default. Includes the twelve prototype regressions and nine real-client network/storage/UI checks. Real-client tests use synthetic authorized wire vectors and scripted responses; they are not new rule-engine verification. Run `npm run test:browser`.
- `npm run check` passed for source syntax and package manifests. No framework runtime dependency was introduced. This is JavaScript with runtime protocol guards; no TypeScript engine extraction/typecheck is claimed.
- Live managed game: **passed in 15.6 minutes**, with 244 human commands, a real accepted player trade, offline pause and online reload with unchanged identity, and natural victory shown by both clients. Opt in with `GAME_SHELF_LIVE=1 npm run play:test -- live.spec.js`. It creates two real anonymous users and a real managed room. An original test driver selects from each human's own authorized legal choices. The managed third-seat bot remains the deployed authority policy. Trade orchestration reads the two permitted human views, never the bot's private data.

The live test exercises UI create/join, natural setup/game progression, a real player trade, projection secrecy, offline pause and online reload with retained identity, and both result views. Automated human decisions complement manual gameplay/physical-device checks; they are not a human usability sign-off. Actual offline cold reload is deliberately not tested as supported: this new client has no service worker yet.

## Remaining before MVP

Engine/type/source extraction and rights review remain MIG-02/03 and LEG-01. The same running engine is used remotely; that does not settle its distribution rights or the managed backend's incomplete migration chain. Do not mark these tasks complete merely because internet play works.

The new `/play/` URL does not replace the old installation identity/scope. PWA caching, persistence permission, verified offline shell, compatible installed-client update/cutover and rollback remain M-01/MIG-05. The old installation stays available. Ordinary online close/reopen retains this client's identity and room; cold offline startup has not been added here.

Still open: physical iPad/friend/full-game acceptance and phone certification, precise OS matrix, full accessible focus/touch audit, rule/port/trade UI edge-case review, aggregate abuse/cost controls, atomic server quotas, explicit bot-error signaling, cleanup/retention and restore exercises. Existing provider pilot quotas and seven-day logical expiry remain in force; no managed backend build or policy/limit change is part of this integration.

## Publication

Published browser playtest: https://stefanavesand.github.io/game-shelf/play/. Source revision `748e24dd173b1a71b59b02ec0e3146a92c3e3d4b` was verified on 2026-11-02: all 17 public HTML/CSS/JS assets across the root, real client, shared UI and prototype returned HTTP 200 and matched local SHA-256 hashes. The managed API accepted the published origin in its OPTIONS preflight. A Chromium smoke check opened the public client, initialized IndexedDB and reached both create/join forms without browser errors; it created no account or room. The complete managed-game test above was executed separately against the same client source. Do not treat this browser playtest as an MVP release approval.

## Stable background refresh (2026-11-02)

UI-05 fixes periodic flicker: a healthy read no longer enters command loading state. The renderer retains the existing app DOM when its output is unchanged and separately invalidates the SVG using board, player-color, legal-choice and local preview/navigation inputs. Unchanged header labels are not rewritten. The current board, placement preview, focus and expanded history survive normal polling. This is a small render guard, not a full incremental renderer: genuine visible changes or errors can still replace the app subtree.

Reads and mutations share one in-flight synchronization operation. A command selected during a slow read waits for that read and retains its exact action and expected revision; if the server state moved ahead it receives the ordinary stale-revision rejection. A failed read shows recovery and blocks subsequent mutation. Durable outbox/identity/authority rules remain unchanged; no backend or provider build was needed.

Execution: 12 core tests passed; the complete deterministic browser suite passed 26 tests (two managed full-game tests explicitly skipped), followed by two additional focused browser passes for remote board invalidation and stale queued placement. The regression checks measured zero DOM mutations under the app across three unchanged automatic polls and retained the exact SVG nodes, selected location, focus and open history. Slow-read command submission was accepted once; failed polls disabled actions. Existing full managed game evidence above predates this UI fix and was not rerun for it. Public delivery verified for source `a87cadad701d18dc05dd3d759c2f3bd403bb3d80`: Pages run `41480837914` succeeded, all 17 public HTML/CSS/JS assets matched source SHA-256 hashes, and managed API CORS preflight accepted the published origin. A fresh Chromium visit loaded the public client with synthetic authorized test responses and confirmed three automatic polls with zero app DOM mutations and the same board/tile nodes. It created no real principal or room. Physical iPad confirmation remains open.

## Home, saved games and direct board selection (2026-11-03)

UI-06 / M-18/19 implement the owner’s navigation and presentation revision. Product copy now uses plain game terminology; the old design name and table metaphors are absent from active UI. Home offers New game, Join a game and cached authorized saved-game summaries with Resume game/View result. Creation selects solo/friends and bot level in one form. Root redirects to /play/#home; explicit home URLs are honored even with an active game. Successful game entry updates the fragment to #game so the home link remains operable. The separate scripted prototype is retained, with its misleading home-board illustration removed.

The storage adapter lists existing view records for the saved principal without changing IndexedDB version 1, legacy keys or existing records. Optional cache timestamps sort summaries. This discovers games opened in this browser, not all cloud rooms or games from deleted storage/other devices. Resume performs authenticated view, validates the selected room and changes current state only after success; no create/join or new identity is used. Pending mutations block switching; denied/unavailable games retain the previous game and allow New game. Home avoids polling an unrelated active room while browsing/configuring.

External numbered location controls are removed in both clients. The real board retains keyboard-focusable targets and adapts hit radius to at least 44 CSS px, with nearest-target pointer resolution and preview/Confirm/Cancel. Number-token glyphs in both renderers use the circle’s center and an explicit central baseline. No rule/coordinate protocol was changed; real roads/buildings still come only from the authorized server view. The incorrect decorative entry state is removed rather than presented as a real saved game.

Executed: 15 core tests and 33 deterministic browser tests passed; two opt-in full managed games were skipped, not rerun. New evidence covers principal-bound history, opening a previous game without joining or overwriting other saves, unavailable-game handling, one creation form retaining name/configuration, no entry SVG/design branding, target taps/44 px hit areas and token-center geometry at 1024×768, 768×1024 and 390×844. Screenshots at those sizes were visually reviewed. Existing polling stability, lost replies, retained command IDs, secrecy and storage/recovery regressions passed. No managed backend build was required. Physical iPad acceptance remains a separate follow-up. Public delivery verification is pending the source push.
