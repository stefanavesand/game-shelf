# Local Solo and relay-backed online play

2026-11-03. The ordinary game UI now uses the same PWA Catan engine for both modes.

- Solo runs one human and two bots locally, without cloud identity, login or API calls. IndexedDB commits each accepted human/bot transition before success; reopening validates the saved state and engine pin. Bot work is bounded and resumes in the foreground.
- Friends uses the authenticated relay for invitations, durable ordering and reconnect history. Both PWAs execute the rules. The creator schedules the bot from its seat observation; a suspended creator can pause bot work. The old Catan rules endpoint is no longer used by the application.
- The compact resource-row trade UI is retained. All-recipient offers and atomic bank batches remain deferred.

## Offline installation

Open the app online and wait for **Ready for offline**. In Safari, Share → Add to Home Screen. Open the installed app, choose New game → Solo offline, then test airplane mode with Wi-Fi off. Browser automation verifies offline operation; physical iPad installation/eviction remains a manual acceptance check.

The service worker installs a build-specific cache only after every required app/engine/UI/manifest/icon file passes SHA-256 verification. A failed candidate leaves the old active worker/cache intact. Readiness rechecks the cache rather than trusting a prior flag. Private API/auth responses are never cached. Updates wait for an explicit click from home with no pending intent; an incompatible engine update is blocked while an unfinished local/relay game requires it. No background execution is required.

Local data can still be removed by the browser/user. Persistent storage is requested, and denial is recorded/reported. Storage errors prevent a successful move acknowledgment. There is no cloud backup or automatic recovery from deleted/corrupted local saves. The icon is an original SVG; device-specific icon rendering remains part of iPad acceptance.

## Bot and card corrections

Bot policy heuristic-1.1.0 can propose a bounded 1:1 surplus-for-needed-resource offer when it would otherwise end its turn. Trade acceptance evaluates progress across build goals and accepts useful fair/generous offers; it still rejects unaffordable or harmful trades. The scheduler waits for the recipient: it must not select an offering bot just to immediately cancel its own offer. This applies equally to human/bot senders.

After a committed development-card purchase the UI identifies the actual new card from the returned hand and shows confirmation. It remains in the hand after reload; action cards bought this turn remain unavailable until a later turn. Offline card buttons no longer require internet.

## Verification scope

- A full natural local solo game, save/reopen, storage failure and engine-update compatibility are tested without network/auth.
- Browser tests cover verified offline startup, a completed action, full offline reload, missing-cache detection and a development-card purchase/display/save/reload.
- The normal online UI is exercised with two independent browser identities over an intercepted relay contract, with the old Catan endpoint denied. This is independent of the older authorized-view UI fixtures, which explicitly mock the session port.
- Existing older UI tests retain synthetic views; they do not prove live server semantics. Explicit live tests remain opt-in and are not run by normal CI.
- Targeted bot regressions cover useful trade acceptance and a bot-originated offer waiting for a human. No assertion that every offer should be accepted.

No old-game migration is attempted, as authorized by the owner. Historical engine/relay verification remains in [the engine guide](CATAN_ENGINE.md) and [relay guide](PWA_RELAY.md).

## Abandonment and updates — 2026-11-04

Home offers **Abandon game** with explicit confirmation for local and online entries. This marks the browser's entry abandoned, clears its current selection if needed and excludes it from resume/update pinning. Data is retained as a tombstone; this is not a deletion or backup feature. Online abandonment does not notify the peer or delete relay history. Creator-dependent bots may pause. There is no supported undo/resume of an abandoned entry.

The online client serializes index/command operations across windows using an origin-scoped Web Lock. An admission intent or pending delivery blocks abandonment. Original game records/outboxes remain intact, and pending delivery blocks updates even on an abandoned entry. Local storage failure must leave the game listed and its engine pin intact. Abandonment needs no new backend endpoint or network request.

Verified: unit coverage for persisted local abandonment, local write failure, online pending-intent protection and no-network abandonment; Chromium confirmation/cancel, reload and update-unpin flow. These do not certify interrupted worker activation, corrupt selected-save escape or actual iPad update behavior; those remain open under MVP-R02.
