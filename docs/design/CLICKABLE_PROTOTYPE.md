# Calm Table — clickable design prototype

Version 0.1 · 2026-11-02. Implements an original, buildless design preview in `prototype/` in the new Game Shelf repository. It is separate from the running OpenCatan pilot. All interactions use disposable scripted example data; there is no networked authority, authentication, real room, rule engine, service worker or production save migration.

Intended review URL: `https://stefanavesand.github.io/game-shelf/prototype/`. Deployment status and executed checks are recorded below when confirmed. This is a UI review artifact, not an MVP release or an installable replacement for the existing PWA.

## Try the design

1. Create a sample room with your name and bot level. Open its invitation panel; preview Alex joining.
2. Place and confirm your first settlement/road, then the reverse-round placement. Use board targets or the accessible location buttons. Cancel a preview before committing it.
3. Roll the example dice, or choose **Explore scenarios → Ordinary turn** for a mid-game fixture with more choices.
4. Try Build, Trade, Edit offer, accept/decline/cancel and bank/port exchange. Outgoing acceptance is a clearly marked preview control, not a response from another device.
5. Use **Explore scenarios** for incoming trade, discard/robber/victim, each card effect, city upgrade, bot error, identity loss, expiry, cooldown and victory. Victory is an explicit example scene; these scripted actions do not implement a complete game.
6. Choose **Lose the next response**, preview a placement and confirm it. The original preview move becomes unresolved; reload and resolve it before making another. It is a local UI demonstration of the intended recovery interaction, not a server-deduplication test.
7. Check portrait/landscape iPad and compact phone layouts. On small screens, the action bar stays reachable while the hand and board remain scrollable; reserved bottom space prevents covering the last content. Zoom and directional view controls let you inspect the board. Actual pinch/drag navigation remains a design follow-up.

## Local development and verification

```sh
npm ci
npm run prototype:dev
```

Open `http://127.0.0.1:4176/game-shelf/prototype/`. There is no build step or framework runtime. This small prototype does not select the production app framework.

```sh
npm run prototype:check
npx playwright install chromium
npm run prototype:test
```

The browser suite covers create/invite/setup, selection/confirmation, unresolved outcomes through reload, explicit trades, discard/robber/victim, card decisions/new-card availability, failure/result/resume states and layout at 1024×768, 768×1024, 390×844 and 360×800 CSS pixels. It also checks absence of external application requests. It does not certify real iOS/Android, VoiceOver, complete WCAG compliance, real multiplayer, the rules or actual backend durability.

The preview retains only disposable UI fixture state under `sessionStorage['game-shelf-ui-prototype-v1']`. It never accesses the old pilot's origin/storage keys, credentials, Supabase or Lovable service. **Reset preview** deliberately resets this example state. Actual network loss pauses an already loaded preview, but cold offline startup is not provided: the prototype has no service worker.

## Component and state specification (draft)

| Element | Prototype specification | Needs device/design review |
|---|---|---|
| Surfaces | Warm background `#f7f3e9`, paper panels `#fffaf0`, fine borders `#dedbca`, restrained shadows | Text scaling and daylight contrast on the actual iPad |
| Primary action | Pine green `#164b3e`, white text; selection and commitment are visually distinct | Primary/secondary hierarchy and accidental-tap behavior |
| Players | Red/blue/ochre plus names and explicit role labels; bot level visible | Color-vision/VoiceOver review; do not depend on color alone |
| Board | Original inline SVG terrain patterns, number tokens, piece shapes and preview targets; own presentation-only coordinates | Valid state/geometry adapters will be required when the actual engine is migrated; these targets are scripted examples, not legal-move discovery |
| Own hand | Explicit labeled resource quantities and individual development cards; existing cards retained after sample purchase; bought-this-turn status explained | Multiple-card layout, text size and long-name stress testing on physical devices |
| Controls | Native buttons at least 44 CSS px high; explicit SVG target names and native location alternatives; keyboard Confirm/Cancel; focus outlines and polite outcome announcements | Complete touch-size/contrast/focus-order audit and screen-reader walkthrough |
| Responsive composition | Landscape wide screens: board beside hand/actions. At 900 CSS px and below: stacked board and hand, bottom action bar, bottom-sheet dialogs | Breakpoints and tablet portrait polish; actual safe areas, virtual keyboard and browser bars |
| Dialogs | Native modal dialog, heading association, close control/Escape, contained scrolling; room/share separate from active play | Focus-return refinement and incoming off-turn interruption behavior |
| Commit states | Selection → preview → Confirm → pending → local fixture acknowledgment; scripted rejection/unknown outcome retains original intent until resolved | Integrate real session/transport later; do not infer authority correctness from this mock |
| Recovery | Offline, unresolved move, checking, cooldown, identity missing, expired/incompatible room and bot failure differ | Final copy/actions and actual provider/install recovery |

No source was copied from OpenCatan's runtime or assets. Board math, fixture controller, inline art, HTML and CSS were written for this prototype. This does not close rights review for the future migrated engine. No image-generation assets, external fonts, CDNs or backend calls are required by the runnable preview.

## Remaining review and release boundaries

This is the first implemented design pass for D-03–05. D-06 (owner/friend iPad walkthrough) and D-07 (agreed final design/version) remain open. Additional hi-fi/state work includes exhaustive storage/auth/version/migration variants, pinch/drag behavior, long-name/text-scaling stress cases, all resource-port restrictions, complete card/deck inventories and final onboarding/copy. The prototype provides representative transitions, not full rules or a second authoritative game implementation.

Existing historical full-game tests in this repository describe the old pilot. Prototype browser tests are a separate result. Migrating the engine/authority, resolving rights, operational acceptance and releasing the MVP remain separate tasks in MIGRATION_MVP_TODO.md. The old `/OpenCatan/hello/` app is unchanged.

### Executed checks and publication

Local verification on 2026-11-02: syntax checks passed; **12 Playwright/Chromium tests passed** in 27.8 seconds, including all four viewport cases. Relative documentation links and dependency lock were validated. The final screenshots were inspected for tablet/phone layout and saved as [iPad](prototype-ipad.png) and [phone](prototype-phone.png). These are rendered prototype screenshots, separate from the generated concept images.

GitHub Pages deployment is pending; no live URL verification is claimed yet.
