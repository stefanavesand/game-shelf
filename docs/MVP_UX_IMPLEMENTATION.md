# MVP UX implementation

2026-11-04. Initial delivery of UX-09, SCORE-01, CARD-HELP-01, HELP-01, TRADE-ELIGIBILITY-01 and TRADE-FEEDBACK-01. Actual iPad usability and release acceptance remain open; this is not a complete MVP-release claim.

## Acting player and score

The board names the acting player, outlines their player card and retains the turn-owner marker. During discards or a trade response, the acting players are distinguished from the turn owner. A recent committed action is shown next to Score breakdown. No new animation is required; existing reduced-motion behavior remains in force. Unchanged polling must preserve board nodes, focus, previews and expanded history.

Score breakdown shows settlement/city contributions, Longest Road and Largest Army bonuses and private victory cards. Own hidden points are shown; opponent hidden points remain hidden during play. Final totals can disclose their contribution after the game. Award ownership comes from the engine's projected game state; the UI does not award points or decide wins.

## Help and cards

The header help control is available on home and in games. Expandable topics explain goals, setup, production, costs, seven/robber, trading/ports, saving, expiry, identity loss and updates. All five development-card descriptions include effect and timing. Clicking a held card shows its full description even when it is unavailable, with a contextual reason. The help module is included in the verified offline package. The compact header wraps without hiding controls on phone layouts.

## Trade filtering and feedback

A foreground PWA automatically declines an incoming offer it cannot supply, using its own hand and the ordinary durable `TRADE_DECLINE` command. It never auto-accepts. The unusable offer has no enabled Review action. A failed or stale decline is not falsely reported as successful; unknown delivery follows the existing pending-command path. An absent/suspended client still waits until it reconnects. Bots keep their existing restricted observations and ordinary command behavior; no rule engine or server change is required.

Trade activity records acceptance, decline, cancellation and invalidation. A proposer sees the accepted quantities, including a bot response completed within the original submit. Feedback tracking saves outgoing terms before submission, keys outcomes by game/offer revision and serializes local updates through a Web Lock. It survives ordinary retry/reload without appending duplicate events. Older browser views cannot overwrite newer tracking. No event is described as acceptance merely because an offer disappeared: a gap in retained history produces a generic unavailable/invalidation message. Feedback is a bounded local convenience log, not an exhaustive server audit.

The log uses separate localStorage records scoped to principal and game; the authoritative checkpoint/outbox remains in IndexedDB. If feedback storage fails, the app reports it and directs the player to Recent moves rather than failing a legal game command or claiming a durable notification. Clearing browser data clears the convenience log too. No credentials or game snapshots are added to source control or CI output.

## Verification

- Six pure feedback tests cover immediate acceptance, lost reply/reload, no duplicate outcome, later-offer isolation, gaps, cancellation, own-hand eligibility and older-window fencing.
- Chromium scenarios cover offline help/all five descriptions on a 390 px viewport, score privacy, own VP description, ordinary-command filtering of an unaffordable incoming offer and feedback after reload.
- The full browser suite includes unchanged-poll/no-blink, cards, trades, placement, outbox/recovery and emulated multiplayer regression. Final local result: 57 passed, 5 opt-in live tests skipped (62 discovered), about 3 minutes. The live backend was not exercised again in this slice.
- [Current rule validation](RULE_VALIDATION.md), [real-service evidence](EMULATED_MULTIPLAYER.md) and [save/update abandonment](OFFLINE_SOLO.md) are distinct evidence, not substitutes for human/device validation.

All-recipient offers, bank batches and a persistent editable sent-offer dialog remain after MVP. Independent rule review, actual iPad/VoiceOver/reduced-motion playtests, interrupted worker-update tests, device performance and operational/legal/documentation release gates remain open.

## Tangible move feedback trial — 2026-11-08

The owner selected the more playful animation direction. The first trial shows a short actor bounce, settlement/road/city landing, dice motion and producing-tile highlight, own resource gains, public building costs moving toward a Bank badge, robber movement and score/award feedback. A named caption explains the committed action. Effects have no hit targets or layout footprint. They never block menus, dialogs or human command acknowledgement. Public building costs come from the shared engine constants; free setup/Road Building placements show no cost. Opponent resource types and development-card identities are never inferred or shown.

`presentation/move-events.js` derives display events from consecutive authorized views. `motion.js` renders transient effects; `motion.css` owns their appearance. `move-pacer.js` limits the foreground coordinator to one bot command per 1.5-second interval. Rule execution, per-command persistence, transport and headless simulations retain their existing behavior. Human commands still use a zero bot budget and save before the next bot step. Background/foreground checks cannot bypass the bot interval. Guests observe the coordinator through the existing relay and briefly poll faster while bots act; network latency may combine revisions, so this is not a guaranteed network-wide animation timeline.

Unchanged polls do not replay effects. Initial load, resume, revision gaps and room/identity changes establish a baseline rather than replaying a backlog. Backgrounding clears effects and resets pacing; the app does not rely on iOS background execution. The reduced-motion preference keeps text feedback and readable bot pacing while suppressing movement. There is no separate persisted presentation queue, cosmetic acknowledgement or engine/schema change.

Pure tests cover the command budget, refresh/reset gating, authorized transitions, free placements, public costs and private-card exclusion. Browser regression scenarios exercise real local saves, consecutive paced bot placements, responsive menus, reduced motion and reload without replay. Physical iPhone/iPad feel and screen-reader announcement timing still need owner evaluation; adjust the single pacing constant after that trial.
