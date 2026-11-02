# Repository bootstrap and source provenance

Prepared locally on 2026-11-02 as the independent repository [stefanavesand/game-shelf](https://github.com/stefanavesand/game-shelf), at the product owner's request. Default branch: `main`. The owner created the remote after the configured GitHub integration denied repository creation through GraphQL and REST (HTTP 403). The remote was verified empty and not a fork before the first push. The owner explicitly chose **public** repository visibility; the initial private-repository assumption is superseded. The MVP audience remains private/invitation-based. No application deployment is created by this bootstrap.

The initial PRD, docs, UI concept images, third-party notices and recorded license text were copied from the project history in [stefanavesand/OpenCatan](https://github.com/stefanavesand/OpenCatan/tree/5418f60) at source commit `5418f60`. These are planning/design and historical verification records. They are not a migration of the game implementation or proof of independently authored upstream code. Their source history remains available in that repository; it has not been rewritten or deleted.

Documents referring to `src/`, `pwa/`, `backend/`, scripts or historical test results describe the previous pilot unless explicitly updated with new-repository evidence. The initial bootstrap has no corresponding runtime files. Historical records retain their dates and scopes. Current work starts from the migration backlog; exact release/device/operations decisions and detailed design still need resolution.

The Calm Table direction was selected by the product owner. Both generated original concept images are retained as exploratory references, not approved shipping artwork or a playable prototype.

OpenCatan-derived runtime/types/geometry have not been copied into this initial repository. Their rights review remains LEG-01. The existing catan-ai MIT notice is preserved for provenance; no bot module is imported by this bootstrap. No blanket project license is assigned by retaining that notice.

The existing PWA URL, manifest identity, browser storage, anonymous principal credentials, Supabase data and Lovable deployment are unchanged. No secret/environment/live-game data was copied. Future moves require scoped extraction, preserved origin/attribution, test parity and explicit installed-client continuity checks.

## Original design prototype

Added after bootstrap on 2026-11-02: prototype/ HTML, CSS, controller, board artwork/math, static server, browser tests and development tooling are original work for this repository. No OpenCatan runtime or art was copied for that preview. The prototype imports no backend/auth/provider integration and does not change the existing pilot. Its disposable fixture transitions are for interaction review, not game-rule execution. Production migration and rights review remain open.

## Original real-game client

Added 2026-11-02 after owner approval of the prototype: play/ connects the original Calm Table UI to the existing managed API without importing the old runtime, types, geometry or artwork. The coordinate adapter was independently written from standard hex geometry and checked against the deployed v1 wire contract. Shared original presentation assets now live in ui/. Synthetic test projections were generated locally from the old reference for contract tests; they contain no real credentials/game data or full snapshots. The actual rules/bot still run in the existing managed service. This does not close its licensing, source-extraction or backend-reproducibility work. See docs/ONLINE_INTEGRATION.md.

## Solo extension

Requested 2026-11-02. The original client adds solo creation, mode-aware UI and replay coverage without importing an engine or bot runtime. The existing Lovable managed project was updated in place for two-bot scheduling and atomic solo creation; backend source revision `0705b861ea677b0c1a211b9bb40a8644022a9b91`, migration `drizzle/migrations/0004_catan_solo_mode.sql`. This additive managed deployment preserves existing rooms/identity contracts; it does not complete backend source migration or resolve engine rights. See docs/SOLO_INTEGRATION.md for execution and publication evidence.
