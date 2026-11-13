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

## Navigation revision (2026-11-03)

Original work adds browser-local authorized game history/resume, plain product copy, new-game configuration, direct SVG targets and explicit number-token baselines. No engine, upstream geometry or art was imported. The root now opens the real client instead of the historical scripted prototype; the latter remains separately accessible and labeled. Existing storage keys/database version, identities and server contracts are preserved. Historical design names and internal CSS identifiers remain provenance/compatibility context, not product branding. See docs/ONLINE_INTEGRATION.md for current verification.

## Original trade composer (2026-11-03)

The resource-card trade UI and pure play/trade.js helpers are original presentation work. They consume the existing authenticated view/choices, derive own-hand previews and validate draft bounds, without importing a rules engine, upstream art or a provider dependency. Bank/port rates/actions remain authoritative server choices. Existing engine rights/reproducible backend gates remain open; no backend build was made for this UI update.

## Original replicated relay foundation (2026-11-03)

play/relay/, its tests and docs are original work: game-independent transport, IndexedDB records/outbox, deterministic session replication and an independent counter fixture. Provider identity code was extracted from this repository's original client without importing backend/upstream engine code or art. Client wire shapes were independently implemented from the reviewed relay API. No private backend source or fixtures were copied into this public repository. The owner removed the old-data/old-game migration requirement; no new legacy save bridge is implemented. See [foundation evidence](docs/PWA_RELAY.md).

## Scoped Catan engine extraction (2026-11-03)

Nine owner-project modules are now maintained as native JavaScript under play/catan/rules/, with exact source commit/hashes and transformation notes in [the source manifest](docs/provenance/CATAN_SOURCE.json). The five previously inventoried upstream helper implementations were excluded and replaced with newly authored geometry/model helpers. No upstream types/art or private backend runtime were copied. The bot settlement adaptation includes its full verified MIT notice in the shipped module; no broader license is claimed. See [engine boundaries, deliberate version changes and executed evidence](docs/CATAN_ENGINE.md). The earlier bootstrap statements describe that earlier stage, not the current module inventory.

## Game Shelf app icon (2026-11-05)

The owner selected the original card/die/board concept B and approved its refinement. The artwork was generated for Game Shelf using OpenAI image generation, with the owner's selected generated concept as the reference; no third-party game artwork or brand logo was supplied. The square, opaque PNG exports in `play/icons/` serve the PWA manifest, iPad Apple touch icon, favicon and app header. ImageMagick resized the selected artwork and stripped metadata for these delivery sizes; it did not introduce a new visual design. The unmasked square allows each operating system to apply its own icon shape. These files are not declared maskable because the motif was not certified against the maskable safe area. Existing installed iOS icons may remain cached by the OS; updating the app does not guarantee immediate home-screen icon replacement. Do not delete app data or reinstall an active player's app just to refresh its icon.

## Original Google identity adapter (2026-11-06)

`play/core/google-auth.js` and its UI/test integration are original code for this repository, implemented against the documented Supabase OAuth/PKCE HTTP contract. No vendor SDK or third-party runtime was copied or added. Google credentials stay in the managed auth configuration. The owner explicitly waived anonymous-account/game migration for this feature; [scope and verification](docs/GOOGLE_SIGN_IN.md) distinguish simulated auth tests from the remaining physical Google/iPad test.

## Account simplification (2026-11-06)

Original PWA session, identity and UI changes remove anonymous signup, derive player names from Google profile metadata and scope Solo storage to the account. No external runtime code, assets or dependencies were added. The backend is unchanged.

## Responsive presentation — 2026-11-07

The presentation modules, responsive CSS, native-dialog host and pagination are original repository code. Existing UI fragments were extracted from the original Game Shelf controller. No external UI library, upstream game code, new runtime dependency or generated concept artwork was imported.

## Automatic maintenance (2026-11-07)

The automatic foreground repair/retry flow, idle-window activation handshake and read-only status presentation are original repository code. They add no runtime dependencies and do not change the rule engine, relay service, identity or saved-game formats.

## Tangible move feedback (2026-11-08)

The event derivation, transient Web Animations presentation, foreground bot pacing, styles and tests are original Game Shelf code. They use existing repository geometry, resource artwork and shared cost constants. No external animation library, new runtime dependency, concept artwork or upstream code was imported. Rules and save schemas are unchanged.

## Illustrated fixed layout (2026-11-08)

The owner explicitly requested the approved generated reference's graphics as well as its layout. Original generated terrain/resource sheets were prepared into offline WebP assets. Source identifiers and preparation details are recorded in [the art inventory](play/art/README.md). Brand/piece/port vectors and dice CSS are original repository drawings. System Georgia supplies the serif typography without distributing a font. No external game assets or runtime libraries were added. Generated artwork is not a claim of exclusive rights or publisher endorsement.

## Motion lab (2026-11-08)

The standalone tuning page, bounded motion settings and demo scenarios are original repository code. They reuse the current production presentation and rule engine with prepared demo states. No runtime libraries, external artwork or third-party code were added. Existing game saves and authentication are not used by the lab.

## Unified activity and scores (2026-11-09)

The bounded presentation journal, reader-position controller, score derivation, unified layout and six-tile hand are original Game Shelf code. The development-card tile uses an original inline vector drawing. No external runtime, artwork, fonts or dependencies were added; rule engine, relay and save formats are unchanged.

The 0.8.1 compact-hand and typography refinement uses platform system fonts and original CSS only; no font files or dependencies were added.

## Compact phone framing and harbor tokens (2026-11-10)

Original CSS/SVG presentation changes reuse the existing resource illustrations. The anchor vector, coastal highlight and midpoint connector are original drawings; no mockup image, third-party assets or runtime dependencies were imported. Rules and saves are unchanged.

The temporary motion lab was removed on 2026-11-10 at the owner’s request. Original reusable scenario fixtures moved into tests; production motion code and approved settings remain.

## Bot improvement specification (2026-11-11)

The ranked tuning/simulation specification is original planning material informed by cited publications and pinned external source reviews. It imports no external code, model weights, assets or dependencies and does not change runtime behavior. Implementation reuse remains subject to BOT-16 license/provenance review.

## Bot experiment foundation (2026-11-11)

The experiment runner, JSON registry, reports and tests are original code. A frozen copy and a parameterized experimental adaptation of the existing Game Shelf heuristic preserve its settlement-heuristic MIT notice and origin; snapshot hashes and import-only baseline changes are recorded in `scripts/bots/baselines/manifest.json`. No external runtime, model, assets or new dependencies were imported. Experiments reuse the production rules and are excluded from the packaged PWA.

## Economic planner experiment (2026-11-12)

The observation-only economic planner, fluid acquisition estimate, parameter registry extensions and tests are original code. They reuse the existing authoritative economy/board/scoring helpers and retain the existing frozen policy only for fallback phases. No external algorithm implementation, runtime, model, artwork or dependency was imported. Production rules and app policy are unchanged.

## Goal-aware trading experiment (2026-11-12)

The trade planner, bounded proposal search, registry extensions and tests are original code using authorized observations and existing authoritative rule helpers. No external implementation, model, assets or dependencies were imported. Frozen baseline and economic planner sources, production rules and app policy remain unchanged.

The 2026-11-12 trade optimization adds original decision-local memoization, structural own-hand copies and conservative search guards. It changes no shared planner, rules, third-party code or production policy.

## Browser bot diagnostic (2026-11-12)

The diagnostic UI, worker, deterministic synthetic fixture generator and tests are original code. Browser policy copies are generated solely from the existing experiment policies with import remapping; the frozen heuristic MIT notice is preserved. They reuse existing authoritative rule modules and introduce no dependency or external assets. They are explicitly packaged outside the PWA offline cache and never replace its gameplay bot.

## Broader bot evidence (2026-11-12)

The paired checkpoint analysis, deterministic seed-block bootstrap, synthetic stress extraction and tests are original code with no dependencies or external implementation imports. Aggregate synthetic evidence is checked in; full synthetic traces and the owner’s raw device report remain outside the repository. No production policy, rules or assets changed.

## Trade diagnosis and parameter ablation (2026-11-12)

The synthetic replay audit, normalized proposal/completion metrics, profile-contract tests and statistical warnings are original code. The one-for-one proposal experiment changes existing parameters only and preserves incoming public-threat normalization. No runtime policy, rule, asset, external code or dependency was imported or modified. Aggregate synthetic evidence is committed; full traces remain local.

## Frozen-profile trade validation (2026-11-12)

The fresh-seed manifests, analysis plan and aggregate validation/decision records are original experiment evidence using unchanged existing profiles and tools. No policy, rules, assets, external code or dependency changed. All 336 final-state hashes were independently audited; detailed synthetic traces remain local.

## Resource/card experiment (2026-11-12)

The bounded discard generator, whole-hand resource-card evaluation, public-aggregate inference, profile controls and scenario tests are original code. They reuse existing authoritative turn/economy/choice/scoring helpers and the original experiment planner. The frozen heuristic and its MIT notice are unchanged; no external implementation, dependency, model or asset was imported. Rule and gameplay policy sources remain unchanged.

The resource-outcome audit is original observational tooling. It replays authoritative synthetic commands, checks final-state hashes and reports discard/card outcomes without exposing private observations to policies. Aggregate evidence and tests are committed; full synthetic traces remain local.

## Resource-component isolation (2026-11-12)

The composition wrapper, strict phase controls and contract tests are original code delegating to unchanged resource/frozen policies. No external implementation or dependency was imported. Original policy/heuristic source and gameplay/rule assets remain unchanged.

Component results include aggregate synthetic outcomes, exact replicated-control hashes and one post-hoc authorized-own-observation discard probe. Both candidate actions in that probe use the existing authoritative reducer; no alternate rules implementation, opponent private input or real-player data was introduced.

## Shared adaptive goals (2026-11-13)

The public-topology shortest-path planner, goal scoring/hysteresis, shared resource decisions, memory controller and tests are original code using existing authoritative topology/economy/turn/choice/scoring helpers and unchanged frozen/resource policies. No external implementation, dependency or model was imported. Private policy memory is separate from authoritative state; gameplay, rules, UI and assets remain unchanged.

Shared-goal aggregate evidence includes synthetic plan/command correspondence and deterministic memory replay. The private-memory protocol and plan diagnostics are confined to offline experiment tooling; no real-player data or private plan trace is committed or broadcast.

The fresh shared-goal validation adds only original experiment manifests, aggregate synthetic results and documentation. Existing policies, dependencies, rules and gameplay assets are unchanged. Full policy/memory and authoritative command replays remain local; no real-player data is included.

## Construction-linked trades and hand exposure

The trade overlay, own-hand counterfactual valuation, soft discard-exposure heuristic, strict profile controls and tests are original code using existing shared-goal, topology/economy and ordinary session helpers. No external code, dependency or asset was imported. Frozen policy implementations and production rules/gameplay remain unchanged; synthetic goal diagnostics stay private to experiment artifacts.

The counteroffer component gate, strict parameter and contract tests are original code wrapping the unchanged construction/trade policy. It substitutes an ordinary engine-authorized decline only when counters are disabled. No external implementation, dependency, asset, authoritative rule or production gameplay changed.

## Opt-in PWA planner runtime

The Solo controller, dedicated-worker adapter, private-memory contract, explicit asset generator and integration tests are original code. Seven existing experiment policy sources are shipped through import-path/extension rewriting only; their algorithms and the frozen baseline's complete MIT notice are retained. No new library, external implementation or asset was imported. The fixed counter-on profile/hash is generated from the tested experiment. Worker proposals use the unchanged authoritative reducer; private goal memory remains in account-scoped local storage and is never added to public state or relay messages.

The shipped-bot benchmark tool and aggregate reports are original synthetic simulation/measurement work. The real optional PWA worker is measured through a Node worker-thread shim with the unchanged fixed profile, not a replacement policy or external model. Only numeric timing/aggregate outcomes are committed; no real-player saves, private game snapshots or synthetic command/plan traces are published. No runtime dependency, app asset, authoritative rule or bot parameter changed.

## Robber and Knight experiment

The public production/threat scorer, deterministic victim choice, bounded Knight/army/other-card previews, own-card availability counterfactual, strict controls and tests are original code using existing authoritative geometry/turn/economy/scoring helpers. No external implementation, model, dependency or asset was imported. Actual theft remains ordinary engine entropy; policies receive only authorized observations. Existing published policy files and PWA runtime/profile remain unchanged.
