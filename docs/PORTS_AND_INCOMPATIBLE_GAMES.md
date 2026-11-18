# Ports and incompatible-game recovery — 0.15.1

## Port investigation and presentation

The owner reported red owning two ports but apparently being able to use only one. Code inspection and a prepared two-port regression confirm that the rule engine uses both: a resource port supplies 2:1 for its resource and a generic port supplies 3:1 for other resources. Either endpoint and either a settlement or city grant access. Rates do not stack. The best rate is independent of port iteration order. A screenshot/save-specific cause has not yet been established.

The composer previously hid a resource's port rate when no executable exchange existed for the current hand. It now lists owned ports explicitly and keeps resource rates visible when unaffordable; executable buttons and submitted quantities still come exclusively from authorized `BANK_TRADE` choices. Public-ownership presentation is not a second exchange validator. The explanation says ports apply to what the player gives, not what they receive. Existing alternative-rate selection is preserved.

## Immediate recovery prompt

On startup, and when an update reports incompatible games, the app asks **Remove incompatible games?**. It lists only obsolete device-local game references and offers **Remove old games** or **Keep for now**. Current-account names can be shown; other accounts' games are described generically. Keeping them leaves Home usable for a compatible new game. Attempting to resume an incompatible row offers recovery again rather than opening its unsupported engine.

The classic `GameShelfUpdateState` metadata helper audits all account-keyed Solo libraries and online room records on this device. This is necessary because worker update checks also cover other accounts. Account credentials and compatible games are never removed. The UI recognizes incompatible engine identifiers and retired Solo bot-policy identifiers.

After explicit confirmation, cleanup acquires the exclusive app lifecycle lock without passing an incompatible engine fence. It rechecks each approved reference inside its write transaction. Solo games are marked abandoned and their selected pointer is cleared when necessary. Online room and index changes share one transaction: the room is marked abandoned, its selected pointer is cleared, and any old outbox is quarantined as `abandonedOutbox` with a halted record so those moves cannot be retried. The saved snapshot remains for diagnosis. Compatible pending deliveries and creation intents are not discarded. No server mutation or notification is sent; peers retain their copies and bots may pause if the departing device was host.

If another window is saving, cleanup reports that condition and can be retried. Partial progress across different libraries is idempotent; each library/room transaction is atomic. Other storage format errors are reported rather than causing a blanket browser-data reset. The standalone [recovery page](../recovery/index.html) remains available for very old installations that cannot obtain the new prompt.

The service worker reports the target engine in `UPDATE_BLOCKED`. A UI repair for the already-active engine may download despite opaque snapshots or stale deliveries belonging to a different, already-unsupported engine. Those old records are not replayed or deleted by installation; the new UI can offer cleanup. Pending deliveries for the active engine and creation intents still block installation, and cross-engine updates retain the original strict save audit. Cache verification and other-window-idle activation checks remain. A non-breaking UI release retains the 0.15 engine compatibility ID; this patch does not require abandoning currently compatible games.

## Verification

Focused rule/presentation tests exercise simultaneous generic/resource-port exchanges and visible rates without sufficient cards. Browser regressions exercise both exchanges through the real local session, immediate recovery, cancellation without disabling Home, account isolation, cross-account obsolete libraries, quarantined online outboxes and preservation of compatible snapshots/identity. Existing UI-repair update coverage is updated to expect the direct confirmation flow.

The reported user's exact port types/holdings remain to be confirmed. Physical-device acceptance and legacy-install recovery remain separate from browser test evidence.
