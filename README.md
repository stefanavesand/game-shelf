# Game Shelf

An independent board-game collection, starting with a private Catan-style internet MVP for two human friends and one bot. iPad is the first release target; responsive phone layouts are designed in from the start.

## Current status

This public, independent repository starts with the agreed product baseline, migration inventory, backlog and UI concepts. The owner created the remote and explicitly chose public visibility on 2026-11-02. Public source visibility does not change the private, invitation-based MVP audience. It is not a fork. The original Calm Table client in play/ now connects to the existing managed game authority for real internet games. Rule-engine source, managed backend reproducibility and installed-PWA cutover have not yet been migrated. The separate prototype/ review remains scripted. This is an early browser playtest, not an MVP release.

[Open the real Calm Table internet playtest](https://stefanavesand.github.io/game-shelf/play/). Create a room and share its invitation link with your friend; the third seat is a bot. Public delivery and create/join startup have been verified. This new URL is currently a browser playtest; installation and offline startup remain pending.

Selected visual direction: **A — Calm Table**. The owner reported the prototype working, approved its layout and authorized real-game integration. Physical device/OS, second-participant, accessibility and MVP operational acceptance remain pending.

Run `npm ci`, then `npm run prototype:dev`. Open `http://127.0.0.1:4176/game-shelf/prototype/`. Run `npm run prototype:check` and `npm run prototype:test` for its isolated checks (install Chromium with `npx playwright install chromium` if needed). See the [prototype guide](docs/design/CLICKABLE_PROTOTYPE.md) for scenarios and verification limits. Twelve prototype browser tests pass. [Open the published Calm Table prototype](https://stefanavesand.github.io/game-shelf/prototype/). GitHub Pages is enabled on main / (root); all 17 current public HTML/CSS/JS assets, including the real client and shared presentation files, were verified against the committed source with SHA-256 hashes.

- [Real internet integration and evidence](docs/ONLINE_INTEGRATION.md)
- [MVP requirements](docs/MVP_REQUIREMENTS.md)
- [UI design brief](docs/MVP_UI_DESIGN.md)
- [Visual concepts and user journey](docs/design/UI_CONCEPTS.md)
- [Migration and MVP release todo](docs/MIGRATION_MVP_TODO.md)
- [Dependency/provenance inventory](docs/MIGRATION_INVENTORY.md)
- [Wider product roadmap](PRD.md)
- [Bootstrap and source provenance](SOURCE_PROVENANCE.md)

## Real client development

Run `npm ci`, then `npm run play:dev`, and open `http://127.0.0.1:4176/game-shelf/play/`. `npm run check`, `npm run test:core` and `npm run test:browser` run syntax checks, core tests and deterministic browser tests. The live service test is opt-in; see ONLINE_INTEGRATION.md. The real client uses persistent anonymous identity and saved server games; it is not a scripted demo. Its new browser URL does not yet provide installable/offline PWA startup.

## Existing pilot

The existing installed PWA remains at https://stefanavesand.github.io/OpenCatan/hello/. Its hosting, service-worker scope, identities, active games and saved data are unchanged by creation of this repository. The old OpenCatan repository remains the pilot implementation/reference until a separately tested migration.

## Language and rights

All application and repository content is English. Product-owner conversation may be Swedish. Code/asset rights are reviewed per component before migration; no blanket project license has been chosen. Included third-party notices preserve the earlier prototype's recorded attribution and do not imply that its engine has been migrated.
