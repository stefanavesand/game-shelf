# Private MVP requirements — agreed product baseline

## Fixed responsive game viewport — 2026-11-07

The owner approved the same no-page-scroll game design for phone and iPad: compact player row, a board with bottom actions in portrait/right actions in landscape, left overlay sidebar, fitted dialogs and explicit paging for longer content. Rule/session behavior remains unchanged. See [UI architecture and verification](RESPONSIVE_UI.md). This supersedes the earlier long-page game layout.

## Google accounts — owner decision 2026-11-06

Google sign-in is required by the PWA for all gameplay, including Solo. Home shows sign-in and Help when signed out. Game dialogs use the Google profile name automatically and never ask for a player name. After a successful sign-in, Solo can create/resume games offline even with an expired internet access token. Solo saves are scoped to the account on this device; signing out hides all games, and signing back into the same account restores access. Invitation room/token survive the OAuth round trip. Anonymous signup and guest-play branches are removed from the PWA. The existing backend and its anonymous-token policy remain unchanged for now; this is a product/code simplification, not a new server authorization boundary. Historical anonymous accounts/unowned saves are not migrated. No server data is deleted. Account changes remain fenced against pending moves. Cross-device game discovery, Solo synchronization, other OAuth providers and device handoff verification remain separate work.


## Current player configurations — 2026-11-05

Owner-approved extension: choose **3 or 4 total players**. Online games open an invitation lobby; the creator explicitly starts after friends join. At start, connected channel members take human seats in admission order (creator first), and bots fill every unclaimed seat. The roster then stays fixed: late joins cannot replace bots. A selected three-player game admits only the first three members as players even though the generic relay channel can hold four. Solo starts immediately offline with two or three bots. Choose Easy/Standard for the bots at creation; deterministic, distinct names replace numbered bot labels in new games. Existing games retain their original roster and rules. This supersedes older fixed-three-seat and automatic-start descriptions below.


Version 0.9 · 2026-11-04. The user confirmed the product baseline: private iPad PWA in both orientations; two people plus one bot online; base game to ten points on a fixed beginner board without a timer; first invited guest claims the empty seat; persistent anonymous identity without account recovery after storage deletion; Easy/Standard at creation; Catan/resume as the main entry with experiments separate; save after every accepted action and reconnect after closing. The UI must also support phones later. Detailed operational choices and visual design remain open; this does not mark every acceptance test or release gate complete. Existing PRD/HLD remain the wider roadmap.

Owner scope addition on 2026-11-02: an optional solo internet mode with one human and two bots (M-17). The friend invitation flow remains supported.

## Reference device — owner report (2026-11-04)

- Hardware: iPad Pro, 13-inch, reported as a 2025 model. Chip and RAM have not been independently identified.
- OS: owner believes the latest version is iPadOS 27. Treat this as tentative; confirm exact version/build during device acceptance rather than claiming a verified OS matrix.
- Target: installed PWA, portrait and landscape. Actual-device completion, accessibility and performance checks remain open. The second participant's device/OS and physical network still need recording.

## Approved MVP release gates — 2026-11-04

The owner accepted these requirements before MVP release. Acceptance of the requirements is not evidence that they have passed. Existing stable backlog IDs and detailed acceptance criteria remain in use.

| Gate | Existing IDs | Required evidence / remaining work |
|---|---|---|
| MVP-R01: rules and bots | RULE-VALIDATION-01, BOT-VALIDATION-01, QA-01 | Validate base rules and supported bot behavior, especially trading and development cards, with independent expected outcomes and reproducible regressions. |
| MVP-R02: durability and updates | UI-01/04, SESSION-2/3/5, SOLO-OFFLINE-01, QA-01/02 | Verify saving, reconnect, offline Solo and safe updates; provide a supported way to abandon old games. Do not silently discard unresolved commands or imply recovery after storage deletion. |
| MVP-R03: physical multiplayer | QA-02, CATAN-FULL-2, REL-01 | The owner and a friend complete a real iPad game with one bot, including interruption/reopening and two physical networks. Record devices, OS and candidate version. |
| MVP-R04: device usability and performance | UX-02, UX-09, QUALITY-1, BOT-14, CATAN-FULL-3 | Check readability, touch controls and basic accessibility in both orientations; measure bot latency, responsiveness, CPU/work and incremental memory on the selected iPad. Exact device and numerical acceptance values still require specification; existing proposed targets are not measured results. |
| MVP-R05: operations | OPS-01/02, BE-01/02 | Assign operating responsibility; specify and verify appropriate quotas, budget, retention/cleanup and rollback. Select concrete values and recovery scope without promising anonymous identity/local-save restoration. |
| MVP-R06: rights and documentation | LEG-01, DOCS-SHARE-01, REL-01/02 | Complete the applicable rights/notice review and prepare accurate shareable setup, architecture, testing, limitations and operating instructions. Preserve required attribution. |

The completed emulated real-relay game is accepted as existing automated evidence: 254 human commands, matching final hashes/revision, reload recovery and zero legacy-rule requests. It does not replace physical iPad, independent rules, accessibility or operations acceptance. See [execution evidence](EMULATED_MULTIPLAYER.md).

Delivery sequence: validate correctness and storage/update failure paths; implement the approved UX; perform device/performance acceptance and finish operations/rights/documentation; assemble the release evidence. Prepare the device playtest after automated blockers are resolved. This is a working sequence, not an additional feature commitment.

## Approved UX scope — 2026-11-04

The owner accepted this split during MVP prioritization. Inclusion is a delivery requirement, not a claim of completion. These decisions supersede earlier proposed priorities for the listed items; other scope and release decisions remain open.

| Delivery | Existing IDs | Required behavior |
|---|---|---|
| MVP | UX-09 | Clearly identify the acting player using name and color, accessible cues and reduced-motion support. |
| MVP | SCORE-01 | Show score breakdown, including Longest Road/Largest Army bonuses and their changes; keep hidden victory points seat-specific. |
| MVP | CARD-HELP-01 | Complete descriptions, timing restrictions and unavailable reasons for all five development-card types. |
| MVP | HELP-01 | Simple offline-accessible rules and instructions for supported actions. |
| MVP | TRADE-ELIGIBILITY-01 | Do not offer an actionable incoming trade to a player lacking the requested resources; revalidate before acceptance without expanding bot access to hidden hands. |
| MVP | TRADE-FEEDBACK-01 | Clear acceptance/decline feedback, with cancellation/invalidation handling and no duplicate notifications after retry/reload. |
| After MVP | TRADE-EDITOR-01 | Keep a sent offer open and support safe editing/replacement. Existing single-recipient trading remains supported. |
| After MVP | CATAN-RELAY-03, All-recipient portion only | All-recipient offers/default recipient selection. This does not defer already-delivered relay integration or release acceptance. |
| After MVP | CATAN-RELAY-03, bank-batch portion only | Multiple bank/port exchanges in one submission. Existing single exchanges remain supported. |

Detailed acceptance criteria remain in the backlog under the same stable IDs. Validation, device, storage/update, operations and release gates are approved in MVP-R01–06 above; their verification and concrete operational/device values remain open.

## Approved MVP limitations — 2026-11-04

The owner explicitly accepted the five limitations below during MVP prioritization. This decision approves these boundaries, **not** every proposed feature priority or release gate. Exact iPad/iPadOS coverage and the remaining feature scope still need agreement. These current-mode boundaries take precedence over conflicting historical text below.

| ID | Accepted boundary |
|---|---|
| MVP-L01 | Private invitation-based games between trusted friends. Participants can technically inspect full replicated state; normal UI and bot observations remain restricted to their seat. Tournament-grade anti-cheating is outside MVP. |
| MVP-L02 | Persistent anonymous identity, without account or save recovery after browser storage is cleared. Clearing storage can lose the identity and local games. OAuth/account linking remains later work. |
| MVP-L03 | Online relay access lasts seven days. Disclose expiry to players. This is an access limit, not a promise that records are deleted after seven days; cleanup/retention policy remains an operational decision. |
| MVP-L04 | Bots may pause when the creator PWA closes or is suspended, and resume when it reopens and synchronizes. No background-execution dependency, automatic coordinator transfer or replacement of a human seat. |
| MVP-L05 | Certify iPad for MVP; design responsive layouts for later phone support now. Full iPhone/Android certification and native packaging are later work. |

Other backlog proposals in [the review](MVP_REVIEW.md) remain recommendations until separately accepted. Device testing, correctness and release readiness are not implied by accepting limitations.

## Product outcome

Two friends install/open the app on separate iPads, create/join a private invitation room, finish a base game against one bot, and resume the same seats after a normal interruption. Neither person operates a server. The UI/repository are English; conversation with the product owner may be Swedish.

The MVP is a private pilot for invited friends, not an app-store or public matchmaking launch. It is releasable when the agreed flows work on real target devices, operational limits are owned, and distribution rights are resolved. Existing PWA 1.4.0 is a prototype baseline, not evidence that all MVP gates are closed.

## Proposed acceptance contract

| ID | Requirement | Acceptance evidence |
|---|---|---|
| M-01 | Install and safely update on the agreed iPad/iPadOS matrix. Show offline readiness only after verified resources; retain compatible installs/saves and unresolved commands. | Real install/full close/reopen and interrupted-update test; old install upgrades without reinstalling. Exact devices/OS versions recorded. |
| M-02 | Create one room with a human name and Easy/Standard bot; share/join its invitation with the second human. Exactly two human seats and one visibly labeled bot; no public room directory. | Two physical devices join correct seats. Repeat join retains seat; a third principal is denied. The first valid invitation-link holder claims the empty guest seat; no host approval step is required in this baseline. |
| M-03 | Play the scoped base game from legal snake setup to active-player victory at ten points on a fixed beginner board. | Natural full real game plus rule fixtures: production, finite bank, builds, ports/bank trades, player trade responses, all development-card phases, discards, robber/victims, longest road/largest army and victory. Agree the rule reference/variants before sign-off. |
| M-04 | Make the current actor, own legal choices, costs, turn phase and outcome understandable without reading implementation details. Board, own hand and primary turn action stay readily accessible. | Task-based prototype and real-game playtest; people can place, build, trade, discard and end turn without developer guidance. Design specifies both orientations. |
| M-05 | Every accepted action is saved by the authority before durable success. Unknown outcomes retry the same ID/payload; duplicates and stale/forged commands cannot create extra moves. | Lost acknowledgment/reload after commit, changed-payload conflict, concurrent browser attempts and winning-command retry. Server receipt and snapshot are committed atomically. |
| M-06 | Pause safely offline; foreground reopen/reconnect restores the same identity and current game. Show synchronizing, pending outcome, retry cooldown and permanent recovery problems distinctly. | Airplane mode, Wi-Fi interruption and full close/reopen on real devices; no iOS background dependency or human-seat takeover. Internet Catan remains paused until authority is reachable. |
| M-07 | Keep opponents' hands/deck private; the bot receives only its authorized player observation. Server derives seat from verified principal. | Inspect both human projections and bot input; equal public observations with different hidden contents give equal decisions. Non-members/direct browser database access are denied. No tokens/private snapshots in diagnostics. |
| M-08 | Offer two named basic bot levels and preserve the chosen policy/version for a room. Bot covers every eligible phase and can respond off turn. Surface a recoverable bot failure without retry storms. | Natural seeded three/four-seat engine regression plus mixed internet game; bounded scheduler/concurrent retry tests. Relative strength is not advertised as established. Numeric resource targets remain in BOT_REQUIREMENTS.md and require measured evidence. |
| M-09 | Support bounded two-party resource offers, accept/decline/cancel and clear pending state. Never execute a different trade after an outdated confirmation. | UI task test plus atomic transfer/race/insufficient-resource tests; inviter can cancel a pending offer. No auction/counteroffer system is required. |
| M-10 | Keep anonymous browser identity durable across normal updates/reopens. Explain identity loss without silently replacing a participant or granting access from a room link. | Failed refresh, unavailable storage and missing identity retain original data and show explicit recovery guidance. Agreed MVP limitation: cross-device account recovery/account linking and recovery after browser storage deletion are deferred; clearly explain the loss of seat access. |
| M-11 | Use original or authorized assets/code with documented provenance and notices. | License/dependency inventory reviewed; unresolved OpenCatan rights settled or affected code replaced with evidence of independent implementation. Product name/art reviewed. |
| M-12 | Deploy frontend, shared engine and managed authority reproducibly from versioned source. Keep secrets server-only, compatible protocol/schema handling and a rollback path. | Clean checkout builds/tests; fresh test database migration and restore exercise; frontend/backend hash or semantic parity checked automatically; no manual code transcription. |
| M-13 | Operate within an agreed private-pilot budget with bounded requests/bot work, access controls, expiry/retention and useful sanitized diagnostics. | Atomic quota/concurrency and 429/backoff tests, bounded load test, billing alert, documented owner and incident/restore procedure. Proposed seven-day inactivity expiry must be made visible and its data-deletion policy agreed. Editor credits and runtime/hosting charges are tracked separately. |
| M-14 | Provide accessible iPad controls: touch targets at least 44 CSS px, labels beyond player color alone, readable contrast/text, keyboard focus and visible commit/selection feedback. | Design specifications plus manual touch/VoiceOver/keyboard spot checks and automated checks where applicable. Resolve accidental double-tap/build/turn-end behavior. |
| M-15 | Complete release verification on the supported device matrix with no known blocking defect. | Clean scoped lint/typecheck/build, mapped unit/integration/browser tests, old-save/update compatibility and a complete two-human/one-bot physical-device game. Separate historical passes from tests rerun on the release candidate. No open data-loss, secret-leak, wrong-rule, duplication or deadlock defect. |
| M-16 | Design responsive layouts for later phone support from the start, while iPad remains the first release/device gate. Keep rules/session/transport independent of viewport, orientation and touch layout. | Review compact phone designs around 360–390 CSS px with readable board/hand/action access, touch targets, safe areas and overflow behavior. Use trays/sheets or deliberate board pan/zoom rather than shrinking the iPad screen. Full iOS/Android phone certification is a later gate; do not claim it from a mockup. |
| M-17 | Start a saved solo internet game with one human and two distinct visibly labeled bots. Easy/Standard applies to both bots. Start directly without an invitation. Both bots act only on their own fair observation and handle all eligible phases; guests cannot claim a bot seat or read the room. | Real solo creation/full game, both bot seats advance, denied non-member view/join/command, exact create replay/mode conflict, unchanged identity/room on reload and interruption, deterministic UI/outbox checks at tablet/phone sizes. Keep existing friend rooms and legacy create receipts compatible. Physical device acceptance remains required. |

## UI revision requested 2026-11-03

M-18: use New game / Join a game / Resume game rather than design branding or table metaphors. A single creation form selects the supported solo/friends configuration and bot level. List saved authorized games known to this browser, including pre-existing cached views; resuming requests the selected authorized view and switches current game only on success. A pending command blocks switching. Expired/unavailable games must not erase another save or prevent starting a new game. Browser-local history is not cross-device account recovery or a cloud-wide room directory.

M-19: remove numbered external location buttons and choose legal targets on the actual board, retaining visible preview/confirmation, keyboard operation and 44 CSS px hit areas. Center token glyphs using an explicit SVG baseline and remove the decorative entry board. The repository root opens the real app; the older scripted design preview stays separate and explicitly labeled. Acceptance: home/configuration/history, principal isolation and old-game resume tests; real target taps and token geometry at both iPad orientations and compact phone width; existing recovery/outbox regressions and physical-device follow-up.

## Trade UX addition (2026-11-03)

M-20 extends M-09: choose resources using tappable cards and selected-quantity steppers rather than a numeric matrix. Show all own resource holdings, what remains per resource and the total of current cards kept; review shows the whole hypothetical hand after acceptance. Player recipients display public total resource counts without revealing types. Cap offers at own holdings and requests at public total/count limits; show a reason when review is unavailable. Preserve same-revision drafts through editing/tab changes and unchanged polls; stale revisions or offline/pending state block confirmation. Separate Players and Bank & ports; bank selection uses the exact legal exchange/port rate supplied by the authority, with review/confirmation before submission. Both iPad orientations and narrow phones must retain readable counts, 44 px targets, visible close/summary controls and no horizontal overflow. Unsent drafts are UI state, not accepted or saved game actions.

## Deliberately outside this MVP

Full offline Catan, LAN/Bluetooth/WebRTC/native packaging; configurable four-seat internet rooms; expansions/random maps; accounts/friends directory/matchmaking/chat/spectators; host transfer or disconnected-human takeover; competitive bot ratings; public-service scale. Preserve existing local setup/tic-tac-toe saves and behavior during migration. Hello world, tic-tac-toe and local setup entrypoints move to a separate experiments area; Catan and resume are primary.

## Decisions needed before implementation scope is fixed

| Decision | Proposed baseline | Status |
|---|---|---|
| Optional solo internet mode | One human plus two bots; Easy/Standard; managed authority and normal save/reconnect | Requested by owner on 2026-11-02 |
| Private MVP audience and two-human/one-bot internet flow | Confirmed by user on 2026-11-02 | Agreed scope |
| Supported devices/orientations | iPad first, portrait and landscape; phone support later, responsive design now. Exact device/OS acceptance matrix still to record. | Product direction agreed |
| Rules/map | Base game, ten VP, fixed beginner board, no timer; document the specific rules reference and edge cases | Product rules agreed; reference to record |
| Entry/identity | Persistent anonymous principals, first valid invited guest claims slot, no host confirmation or account requirement; disclose loss after storage deletion | Agreed |
| Reference games | Keep existing data; move Hello world, tic-tac-toe and local setup to experiments; prioritize Catan/resume | Agreed |
| Naming/visual style | A — Calm Table selected: warm light surfaces, pine-green primary action, original tabletop-inspired visuals; working name Game Shelf | Direction agreed; detailed design/name/asset review still needed |
| Expiry, budget and operation | Start from explicit pilot limits; choose retention/deletion period, monthly runtime cap and operational owner | Open |
| Requirements/design agreement | Owner approved the working prototype layout and authorized real-game integration on 2026-11-02; operational/device/second-person acceptance remains | Owner UI baseline agreed; release gates open |

The next step is UI concepts against the agreed product baseline, including phone adaptation. Resolve remaining release/operational decisions alongside design; do not reopen agreed scope without a reason. Tasks, dependencies and release gates: [migration/MVP todo](MIGRATION_MVP_TODO.md). Design deliverables: [UI design brief](MVP_UI_DESIGN.md).

## Automatic app maintenance — owner decision 2026-11-07

Remove the header update arrow and connection dot. Updates require no manual check, installation button or confirmation. Retry foreground downloads/repairs automatically and activate at a safe Home state without interrupting other open games or unresolved moves. Read-only status remains in the sidebar. Compatibility guards take precedence over activation; never discard a saved game automatically.
