# MVP review and scope decision register

Review date: 2026-11-04. Baseline: `f3505b11a66c40a0d70ccf83effed57a98f2a3be`.
Status: review and recommendations, **not an approved MVP scope**. No feature behavior changed by this review.

## Assessment

The project is a playable pilot with a credible architecture, not yet a release-qualified MVP. The highest-value next work is proving complete current-version games and making failures understandable, rather than adding transports, providers or stronger AI. A green deployment demonstrates delivery integrity; it does not establish independent rule correctness or physical-device usability.

The production [session facade](../play/session.js) routes Solo to the local client and Friends to the relay client. Rules, deterministic entropy and bot policy execute in the PWA. The internet service authenticates identities, admits channel members and orders messages. The old server-rule endpoints still existing does not imply the active UI uses them. Conversely, source separation alone is insufficient proof that every production action avoids them.

### What exists

| Area | Current implementation | Remaining evidence or limitation |
|---|---|---|
| Game | Setup, ordinary turns, resources, building, development cards, robber, trading, awards and victory | Independent base-rule matrix and a natural complete current-version human game |
| Solo | One human, two bots; local rules and IndexedDB; no login needed | Actual iPad cold offline start, full close/reopen and long-session behavior |
| Friends | Two humans, one bot; invites, anonymous identity, ordered relay and local replay | Complete normal-UI game against the actual relay on two physical networks |
| Bots | Easy/Standard, deterministic bounded heuristic, ordinary validated commands, restricted observations | Current-policy trading regression, completion baseline, measured CPU/latency/memory and clear failure UX |
| Reliability | Persisted command IDs/outbox, retry/deduplication, revision checks, hashes and halt on disagreement | Main-UI failure paths, cross-tab admission and interrupted update acceptance |
| PWA | Manifest, hashed offline cache, readiness verification, storage request and guarded updates | Safari/iPad installation/update certification for the current release |
| UI | New/join/resume, direct board targets, row-based trades, bank/ports and card-purchase feedback | Actor clarity, trade lifecycle, help, card explanations, score breakdown and accessibility |
| Delivery | Actions checks, packaged-site tests, Pages deployment and public asset verification | Clean-checkout release evidence tied to an agreed device/product contract |

## Findings, in priority order

1. **Release evidence is incomplete.** Existing browser coverage includes synthetic session fixtures and a fake relay. The legacy UI helper replaces `play/session.js`; these passes must not be counted as current local/relay integration evidence. Historical live developer-flow tests and older 100-game simulations are useful, but do not certify the latest normal UI or latest bot policy. See [engine evidence](CATAN_ENGINE.md), [offline Solo](OFFLINE_SOLO.md), [relay integration](PWA_RELAY.md) and `tests/play/mock-service.js`.
2. **Rules and bot validation need independent expectations.** Two replicas agreeing or self-play finishing proves useful properties, but both may share the same rule bug. Define boundary scenarios from an agreed rule reference: award ties/transfers, blocked/branched roads, finite-bank shortages, development-card timing, seven/discard/robber, trade races and victory. Re-run natural games for the exact policy being released. The recent trade/card fixes still need human confirmation.
3. **Saved games can block upgrades indefinitely.** Both [local](../play/local/client.js) and [online](../play/relay/game-client.js) `canUpdate` reject a different engine artifact while an unfinished game remains. This scans all saved games, not only the visible game. No supported abandon/delete operation is exposed by those clients. Pinning protects games, but the product needs a deliberate abandon/update route and tests; never silently discard a pending command. A corrupt selected local save also makes `inspect` throw: verify that the UI still offers a usable escape to home/new game.
4. **Bot availability depends on the creator PWA.** The current relay game client schedules bots from the creator. Sleep/closure can pause progression; there is no coordinator transfer. This is consistent with avoiding iOS background assumptions, but contradicts older managed-scheduler requirements. Decide whether a clear pause/resume limitation is acceptable for MVP; otherwise it is additional architecture work.
5. **Trading is functional but its lifecycle is weak.** Missing-resource recipients, unclear accept/decline feedback and a disappearing composer cause confusion. All-recipient offers and multi-exchange bank batches are separate unimplemented features. Preserve ordinary revision/command guarantees when editing or replacing offers.
6. **Operating limits need a product contract.** Relay access expires after seven days; expiry is not a deletion policy. Cleanup, budget alerts, ownership, load estimates and realistic quota/retry tests remain open. Anonymous identities are authenticated, but not recoverable accounts. OAuth is deferred. No new live load testing was performed for this review.
7. **Documentation and backlog status are stale.** PRD, agent guidance, requirements and historical follow-ups mix server authority with current PWA authority, online-only Solo with offline Solo, and waived migration work with release gates. CI/API checkboxes also lag delivered work. The repository has syntax/manifest/link checks, not dedicated semantic lint/typecheck commands. Rewrite maintained guidance after scope agreement; archive history rather than treating every old statement as current.
8. **Distribution rights are not closed by moving repositories.** Original SVG visuals and retained bot MIT attribution reduce the asset burden, but the source inventory and intended distribution/name/license still need an explicit evidence-based conclusion. Keep required attribution even when removing historical product branding.

Trusted friends are an intentional security model: a participant can inspect full replicated state, including hidden hands and future randomness. Normal UI and bot projections restrict information; they do not protect it from a participant inspecting their device. Do not introduce tournament-grade anti-cheating as an unstated MVP requirement.

## Complete backlog reconciliation

Sources: [main ledger](MIGRATION_MVP_TODO.md), [historical follow-ups](FOLLOW_UPS.md), [bot requirements and BT acceptance cases](BOT_REQUIREMENTS.md), [design tasks D-01–07](MVP_UI_DESIGN.md), [MVP requirements](MVP_REQUIREMENTS.md), PRD and HLD. Grouping consolidates duplicate work without deleting IDs. “Recommend” means an input to the owner discussion, not approval. Historical completed slices remain useful evidence, not automatic release acceptance.

| Group | Existing IDs covered | Assessment and proposed disposition |
|---|---|---|
| Contract | REQ-01; PLAN-01–03; DESIGN-1 | Planning delivered; finalize device/OS, rule reference, audience, seven-day expiry, budget/operator and release name. Recommend MVP. |
| Rights | LEG-01; RIGHTS-1; CATAN-FULL-5; BOT-16 | Open evidence/notice/distribution review. Recommend release gate. |
| Repository transition | MIG-00–05; REL-03; SESSION-1; CATAN-PWA-1 | Independent repo, native JS engine and ports exist. Retire old-save migration/parity obligations waived by owner; retain determinism, version, clean build, rights and update safety checks. No new rewrite. |
| Service reproducibility | BE-01; CATAN-FULL-4; API-01 | Backend source is in the private Lovable GitHub repo; generic relay implemented. Verify fresh deployment/migration chain and operator access. No need to copy secrets/backend into the public frontend repo. |
| Session/API safety | BE-02; API-02/03; PWA-RELAY-01/02; CATAN-RELAY-01/02; ONLINE-RELAY-01; SESSION-2/3/4; SESSION-STATE-1; ONLINE-1 | Substantial implementation. Retain real-adapter fault, authorization, deduplication and expiry tests; replace obsolete server-rule authority/private-state assumptions. Recommend MVP. |
| Production architecture proof | ARCH-VALIDATION-01 | Deny legacy rules endpoints through actual main flows; deny all network for Solo. Recommend MVP. |
| Operations | OPS-01/02; CATAN-FULL-3 | Define quotas/cost/cleanup/diagnostics/operator/rollback. Backups cannot promise anonymous identity or local-save recovery. Agree minimum runbook and restore scope, rather than inheriting old server-snapshot recovery requirements. Recommend minimal MVP controls. |
| Entry and normal play | UI-01/02/04/05/06; UX-09; SOLO-01; CATAN-FULL-1/2 | Much implemented. Verify invitations/resume, selected versus committed actions, actor/status clarity and actionable stops. Recommend MVP. |
| Visual/accessibility completion | UX-01/02/03; D-01–07; QUALITY-1 | Direction/initial prototype approved; remaining phase/failure states, focus, touch and contrast not all accepted. Prefer a focused walkthrough of the real current UI over rebuilding a separate complete prototype. Recommend MVP usability gate. |
| Core trade flow | UI-03/07/08; BUG-TRADE-CARDS-01; TRADE-ELIGIBILITY-01; TRADE-FEEDBACK-01; TRADE-EDITOR-01 | Row UI and recent fixes delivered. Validate bot/human offers and bought cards. Recommend eligibility and clear outcomes for MVP; decide whether persistent edit/replace is essential or a later improvement. |
| Additional trade features | CATAN-RELAY-03 (All and bank-batch portion) | Separate from already-delivered main integration. Recommend defer All-recipient and atomic bank batches; retain single-recipient offers and single bank exchanges. Owner decision required. |
| Rules and scores | RULE-VALIDATION-01; SCORE-01; GAMEPLAY-1 | Recommend independent rule validation and visible award/score explanation for MVP; four-seat testing only if four seats enter scope. |
| Help/cards | HELP-01; CARD-HELP-01 | Recommend compact offline help plus complete five-card descriptions and unavailable reasons for MVP. Can share content; no large tutorial system required. |
| Bot correctness | BOT-PLAN-1; BOT-01–13/15/17/18; BT-01–12; BOT-VALIDATION-01 | Keep supported three-seat modes, Easy/Standard, fair observations, reproducibility, legality, bounded progress and visible faults. Restrict matrix to supported seats. Rewrite managed scheduling/no-human-client dependency and old-save assumptions. Explicitly decide halt versus bounded fallback; do not silently guess after an unknown command outcome. |
| Bot performance | BOT-14; CATAN-FULL-3; BT-07/10/12 | Difficulty exists; strength is not established. Measure choice p95, responsiveness and incremental memory on the reference iPad; CPU/work and requests per game also matter. Existing 250 ms choice / 50 ms continuous-task targets are proposed, unmeasured targets. Recommend basic measurement/bounds for MVP, advanced optimization later. |
| Offline/update safety | SESSION-5; PWA-1; SOLO-OFFLINE-01; LANGUAGE-1 | Offline implementation exists. Recommend current iPad install/cold-start/reopen, storage refusal and interrupted update checks; add safe abandoned-save handling. No old installation migration requirement. |
| CI and automation | CI-01; QA-01 | CI implemented, old checkbox stale. Map current tests to supported flows; add only missing high-risk checks. Historical simulation success is not current-policy acceptance. Recommend MVP gate. |
| Device and release | QA-02; REL-01/02; CATAN-RELAY-03 (acceptance portion) | Pilot deployed; release qualification open. Complete one natural two-human/one-bot game on actual devices/two networks plus suspend/reopen/update checks. Recommend MVP gate. |
| Shareable documentation | DOCS-SHARE-01 | Rewrite current README/setup/architecture/test limits and backlog after decisions; retain notices/provenance separately. Recommend MVP. |
| Future identity | AUTH-01 | Google/Microsoft OAuth, linking/recovery and friends directory. Previously deferred; recommend retain deferral. |
| Future platforms/game scope | MOBILE-01; SESSION-6; broader BOT-01/BT-01 and PRD E2/E3 | Responsive phone layout now. Full phone certification, four-player configurations, Capacitor, LAN/TCP/Bluetooth, WebRTC, spectators, expansions, advanced AI and automatic coordinator/recovery mechanisms: recommend later. |

### Proposed MVP boundary to discuss

A private invitation-based iPad PWA: two humans and one bot over the internet, plus existing one-human/two-bot offline Solo; fixed base board, ten points, Easy/Standard, anonymous identity, single-recipient trading and bank/ports. Complete and understandable games, durable commands, clear failures and safe installation/updates are the release standard. Phone-responsive layout is included; phone certification is later.

Suggested decision order:

1. Confirm the two modes, supported reference iPad/iPadOS, and explicit limitations: trusted peers, anonymous identity loss, seven-day relay access and creator-dependent bots.
2. Decide each visible enhancement: actor cue, help, score breakdown, card descriptions, impossible-offer filtering, outcome notifications and persistent trade editor. The table above states recommendations for each; none are silently approved.
3. Agree release gates: rules/bot validation, real two-device complete game, offline/update/storage tests, rights, basic operating limits and shareable docs.
4. Confirm deferrals, then update PRD first, HLD second, and replace stale backlog statuses. Implementation follows that agreed scope.

## Verification and limits of this review

Source inspection covered the active session/local/relay entrypoints, artifact/update guards, package scripts, test fixtures and the linked planning/evidence documents. This is a targeted readiness review, not an exhaustive security audit or line-by-line independent rules certification.

Fresh commands and their results are recorded below after execution. No browser suite, backend load test or physical iPad playtest was rerun for this documentation review. Previous CI/browser/live evidence remains historical and must retain its original adapter/version qualifications.

- `npm run check`: passed; pinned artifact, JavaScript syntax, manifests and documentation links.
- `npm run test:core`: passed, 60 tests across legacy core (19), relay (21), Catan (17) and local Solo (3). These are mixed layers, not 60 full-game E2E cases.
- Current policy natural seeded game: 473 actions / 85 turns; local saved-and-resumed full-game unit scenario also passed. Neither substitutes for independent rule expectations or a human internet game.

Subsequent targeted coverage: [two emulated human seats and the normal bot](EMULATED_MULTIPLAYER.md) completed a natural game through two browser contexts and the production session adapter, with equal final state hashes and reload recovery. The relay was simulated; actual-service and physical-device release gates remain open.

Live follow-up (2026-11-04): [real-service emulated multiplayer](EMULATED_MULTIPLAYER.md) now passed on `52d2d0`: 254 human commands, final revision 345, equal stored hashes, empty outboxes, reload recovery and zero legacy-rule requests. This supplies the previously missing complete **production-session / actual-relay** game evidence. Human moves were submitted via the session API and HTTPS used Node egress; physical-device, direct-browser and click-by-click UI acceptance remain open. The run found and led to fixes for fresh-guest admission and concurrent initialization. Its 3,262 requests are a measured trace for OPS-01, not a load/cost certification.

Scope decision (2026-11-04): the owner accepted the five proposed limitations, now recorded as MVP-L01–05 in [MVP requirements](MVP_REQUIREMENTS.md) and the PRD/HLD. Feature recommendations and individual release gates in this review remain pending prioritization; this acceptance does not approve the whole table.

UX scope decision (2026-11-04): the owner approved UX-09, SCORE-01, CARD-HELP-01, HELP-01, TRADE-ELIGIBILITY-01 and TRADE-FEEDBACK-01 for MVP. TRADE-EDITOR-01, All-recipient offers and bank batches are explicitly after MVP. This supersedes their recommendation-only status above. Other feature/release proposals remain pending. See the current [requirements](MVP_REQUIREMENTS.md) and [backlog](MIGRATION_MVP_TODO.md).

Release decision (2026-11-04): the owner approved MVP-R01–06 in [MVP requirements](MVP_REQUIREMENTS.md): rules/bots, durability/offline/update/abandonment, real iPad multiplayer, usability/performance, operations and rights/shareable docs. The completed automated real-relay game is accepted as existing evidence. Approved requirements remain open until verified; exact device/OS and operating values still need specification. This supersedes recommendation-only status for those gates, without approving unrelated roadmap features.
