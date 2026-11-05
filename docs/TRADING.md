# Player trading and bank exchanges

2026-11-05. Rules 2.1.0. Implements the owner's All/default and persistent-dialog request, TRADE-EDITOR-01 and the All portion of CATAN-RELAY-03. No backend API/schema/rule-engine change is required: online commands remain opaque ordered relay messages, and solo uses the same PWA engine.

## Player behavior

- The current player defaults to **All**; an individual recipient can also be selected. A player acting off-turn can propose only to the current player, never to another inactive seat.
- All is one offer with multiple recipients. The first valid acceptance performs one exchange. Others close without transferring a second set of resources. One decline leaves other recipients eligible; all declines complete the offer without transfer.
- Send offer submits directly from the resource rows without a separate review screen. The sender dialog stays open while waiting or editing after declines; individual replies remain in the gray response area. A completed accepted offer shows an enabled Close button. Accepting/declining an incoming offer closes the dialogs. Bank exchanges submit directly and close the composer.
- A counteroffer appears in a second modal above the still-open sender dialog, with exact terms and Accept/Decline. Reply actions bind its offer ID, so replaced or closed offers cannot be accepted.
- Edit offer prepares revised terms without moving cards. Sending the revision atomically replaces the outstanding offer. A recipient can select Counteroffer; the new proposal replaces the previous one and still involves the current turn owner. Replacement invalidates all responses to the original ID.
- Reply availability is checked against the recipient's own hand. Existing automatic decline handles unaffordable human offers; bots use only their projected observations. Public total counts bound the composer without exposing hidden resource types.
- Close only dismisses the dialog. Cancel offer is an explicit game command. An unresolved offer must be answered, replaced or cancelled before unrelated game actions continue.

## State and command contract

`TRADE_OFFER` keeps `to`, `give` and `receive`; `to: "all"` selects every other seat only when the proposer is the turn owner. With a pending offer, the command must include `replaces: <current offer ID>`. The proposer or an eligible recipient can replace it; invalid/missing/stale replacement IDs reject atomically.

The active offer includes `id`, `from`, `to`, explicit `recipients`, per-seat `responses`, `turnPlayerId`, `give` and `receive`. Responses use the existing `TRADE_ACCEPT`, `TRADE_DECLINE`, `TRADE_CANCEL` plus `offerId`. A declined recipient cannot later accept the same offer. Input state/entropy is unchanged on rejection.

The snapshot and public seat view retain the latest 20 offers in `trades`, including terms, recipient replies, status, last actor and revision. This bounded public ledger allows an app that missed every intermediate poll, including immediate bot replies, to recover outcomes after reload. Local notification deduplication uses stable offer IDs and terminal status. This adds no opponent hand/deck information. History beyond the bounded ledger is not an unlimited archive.

For a targeted or broadcast offer, the active player must be involved. For a counteroffer initiated off-turn, the original turn owner remains pinned; a recipient being active is valid. Ordered execution plus revalidation prevents double acceptance. A UI revision conflict still requires review; no pending transport mutation is discarded to edit an offer.

## Bank and ports

The engine enumerates owned-port rates and ordinary 4:1. An owned specific port does not remove 4:1; an owned generic port also permits 3:1. The composer defaults to the best affordable rate and exposes an Exchange rate selector when multiple rates are available. Rates come from actual legal choices; ownership, exact positive integer quantities, distinct resources and finite bank stock are validated again on apply. Bank exchanges remain one exact action, not a multi-resource batch. A player offer must be resolved before a bank exchange.

## Validation and release scope

Added deterministic scenarios cover both possible All winners, duplicate/late acceptance, partial/all declines, both bot levels, stale replacement IDs, active-player counteroffers, forbidden inactive-seat exchanges, owned generic/specific/ordinary rates and persisted results. Browser scenarios use the real local engine/bot scheduler for immediate acceptance/decline and retained editing/reload; the mixed waiting/replacement screen uses an intercepted service fixture. This is not new live-service or physical iPad evidence.

The rules artifact/version changed. Existing unfinished saves retain their original engine pin; do not delete or bypass that guard. Finish or explicitly abandon old games before applying an incompatible update, then start a new game for the new behavior. Online participants must use compatible engine releases and still compute matching state hashes; see [release compatibility](RELEASES.md). OAuth, bank batches, rights clearance and independent full rule/device acceptance remain separate work.

RV-01 (worse but allowed port rate) and RV-02 (off-turn proposals) from the [rulebook review](RULEBOOK_AND_RIGHTS_REVIEW.md) are addressed in this version. RV-03 and the remaining card/reference/rights questions are unchanged. The historical review/diagnostic JSON remains evidence of the earlier version; rerunning its script against 2.1.0 reports the current behavior.

Local execution: 34 trading-rule tests, 21 boundary-rule tests, the core regression including 100 natural games, 20 client-helper tests and 7 feedback tests passed. A clean browser run passed 73 scenarios with 5 opt-in live scenarios skipped and the previously exercised natural relay game excluded from that rerun; the earlier overlapping run is not counted as a clean suite. After final turn/phase guard adjustments, all 10 targeted trading browser scenarios passed again using the installed system Chromium. Build, package integrity and source/document checks passed. Normal GitHub Actions retains the full browser suite, including natural relay play; no CI gate was removed.

## Simplified interaction and release policy — 2026-11-05

The owner requested direct sending, retained decline results, a Close action after accepted outgoing offers, a stacked counteroffer dialog, and no remaining composer after own accept/decline or bank exchange. Unaffordable incoming offers are still automatically declined through ordinary validated commands, without showing the unaffordable-offer banner. Release compatibility is now explicit and defaults to non-breaking; original 2.1 saves retain their compatibility ID while source-file integrity hashes remain independent. See [release policy](RELEASES.md).

Executed for this refinement: 130 core tests passed including the 100-game regression; 32 targeted trading/offline/update browser scenarios passed. After final wording/draft-reset cleanup, all 12 trading browser scenarios passed again. Package policy tests cover non-breaking default, explicit breaking transitions and stable repeated generation. Full packaged-browser/public-release validation remains in the normal deployment workflow.

Release 0.2.1 additionally checks creating a counteroffer through the incoming overlay: editing stays in the parent composer without reopening the incoming modal, and sending binds the replaced offer ID. All 13 targeted trade browser scenarios and 4 package/policy tests passed after this correction. The correction is non-breaking and retains the compatibility identity.

Release 0.2.2: opening a new Trade resets recipient/quantities and shows no historic response. The response panel is scoped to offers sent within that dialog session; reopening an active outgoing offer explicitly reconnects its responses. Closing and reopening after acceptance or decline keeps the public Trade activity history but starts an empty composer. Affordable incoming offers open their own actionable dialog automatically during play, once per offer; manual dismissal permits later reopening. Two real-local-engine browser scenarios verify incoming bot offers remain pending across refreshes and close only after explicit acceptance/decline or a valid offer-state change.

Local evidence for 0.2.2: 33 targeted trade/update browser scenarios passed, including fresh composer state after historical acceptance/decline, normal incoming bot offers staying actionable across repeated refreshes, automatic idle activation, dialog deferral and breaking-release deferral. After reducing automatic polling to inspect lightweight metadata before hashing, the three automatic-update scenarios passed again. Four package/policy tests and source/manifest/document checks passed; rules and compatibility ID are unchanged.
