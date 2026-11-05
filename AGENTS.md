# Agent instructions

## Language

Use English for maintained source, comments, UI, tests, documentation and commits. Swedish is permitted in conversation with the product owner.

## Product baseline

Read PRD.md and docs/MVP_REQUIREMENTS.md. The private MVP is two humans plus one bot online, plus optional one-human/two-bot solo internet play requested on 2026-11-02, iPad first, both orientations, with phone-ready responsive design. The owner approved the warm light visual style and real-game integration on 2026-11-02. On 2026-11-03 they removed its design name/table metaphors from product copy, requested a plain new/resume home, and replaced numbered location shortcut buttons with direct board targets. Trade UI now shows own holdings, retained/projected quantities and distinct player/bank modes; bank actions/rates must come from authenticated legal choices and opponent types remain secret. Device/operations release gates remain open.

## Migration and compatibility

Read SOURCE_PROVENANCE.md and docs/MIGRATION_MVP_TODO.md. The initial bootstrap contained planning/design artifacts only. It now also contains an original standalone UI prototype in prototype/, with isolated Playwright tests. Its scripted fixtures are not a second authoritative engine or proof of actual multiplayer. The original real client in play/ connects to the existing managed authority; see docs/ONLINE_INTEGRATION.md for new execution evidence and remaining migration gates. Do not claim that historical prototype tests ran here. Preserve upstream attribution, the verified bot MIT notice and an auditable origin for moved code. Resolve applicable rights before importing runtime code or assets. Do not copy the entire legacy application as a shortcut.

Keep rules, authorized private views, sessions, transports, storage and UI separate. Do not let viewport or provider APIs enter the rule engine. Preserve installed app identity, original serving path, persisted player IDs, saves, pending command IDs and active room links during migration. Publishing or moving hosting is a distinct deployment step.

## Verification and delivery

Track follow-ups using the stable IDs in docs/MIGRATION_MVP_TODO.md; no external tracker or bd CLI is required. Run checks appropriate to the change. The frontend workflow tests the allowlisted dist/ package before Pages deployment and verifies public asset hashes; keep this gate intact. See docs/CI_DEPLOYMENT.md. Once a runnable project exists, establish clean lint/typecheck/test/build commands and document them. Validate relative documentation links and provenance on documentation-only changes; do not invent passing app tests.

Never commit credentials, tokens, private game snapshots or environment files. Keep secrets on the managed server. Commit and push completed authorized work; verify branch status and report any real blocker. Do not merge or change the existing pilot as a side effect of repository setup.

## Owner delivery decisions (2026-11-03)

The owner authorizes merging finished PRs when appropriate checks pass and completing gated deployment without asking again. There are no current players or valuable pilot games; old-game/save migration is not a requirement. Keep secrets safe and follow actual source provenance. The current usage budget is tight: prioritize a playable Catan entrypoint and the resource-row trading UI; avoid unrelated refactors and repeated broad test runs. The owner requested All-recipient offers and a persistent trade editor on 2026-11-05; see docs/TRADING.md. Bank batches remain a separate follow-up.
