# Game Shelf

An independent board-game collection, starting with a private Catan-style internet MVP for two human friends and one bot. iPad is the first release target; responsive phone layouts are designed in from the start.

## Current status

This public, independent repository starts with the agreed product baseline, migration inventory, backlog and UI concepts. The owner created the remote and explicitly chose public visibility on 2026-11-02. Public source visibility does not change the private, invitation-based MVP audience. It is not a fork. Application code, rule engine, managed backend and deployment automation have **not yet been migrated**. A separate, original clickable design prototype is now runnable; it is not the migrated game or an MVP release.

Selected visual direction: **A — Calm Table**. The first clickable prototype is available for review; physical-device walkthrough and final design agreement remain pending.

Run `npm ci`, then `npm run prototype:dev`. Open `http://127.0.0.1:4176/game-shelf/prototype/`. Run `npm run prototype:check` and `npm run prototype:test` for its isolated checks (install Chromium with `npx playwright install chromium` if needed). See the [prototype guide](docs/design/CLICKABLE_PROTOTYPE.md) for scenarios and verification limits. Twelve prototype browser tests pass. Public preview deployment awaits the owner enabling GitHub Pages from main / (root); the integration cannot enable it (HTTP 403).

- [MVP requirements](docs/MVP_REQUIREMENTS.md)
- [UI design brief](docs/MVP_UI_DESIGN.md)
- [Visual concepts and user journey](docs/design/UI_CONCEPTS.md)
- [Migration and MVP release todo](docs/MIGRATION_MVP_TODO.md)
- [Dependency/provenance inventory](docs/MIGRATION_INVENTORY.md)
- [Wider product roadmap](PRD.md)
- [Bootstrap and source provenance](SOURCE_PROVENANCE.md)

## Existing pilot

The existing installed PWA remains at https://stefanavesand.github.io/OpenCatan/hello/. Its hosting, service-worker scope, identities, active games and saved data are unchanged by creation of this repository. The old OpenCatan repository remains the pilot implementation/reference until a separately tested migration.

## Language and rights

All application and repository content is English. Product-owner conversation may be Swedish. Code/asset rights are reviewed per component before migration; no blanket project license has been chosen. Included third-party notices preserve the earlier prototype's recorded attribution and do not imply that its engine has been migrated.
