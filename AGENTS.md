# Agent instructions

## Language

Use English for maintained source, comments, UI, tests, documentation and commits. Swedish is permitted in conversation with the product owner.

## Product baseline

Read PRD.md and docs/MVP_REQUIREMENTS.md. The private MVP is two humans plus one bot online, plus optional one-human/two-bot solo internet play requested on 2026-11-02, iPad first, both orientations, with phone-ready responsive design. A — Calm Table is the selected visual direction; the owner approved the prototype layout and authorized real-game integration on 2026-11-02. Device/operations release gates remain open.

## Migration and compatibility

Read SOURCE_PROVENANCE.md and docs/MIGRATION_MVP_TODO.md. The initial bootstrap contained planning/design artifacts only. It now also contains an original standalone UI prototype in prototype/, with isolated Playwright tests. Its scripted fixtures are not a second authoritative engine or proof of actual multiplayer. The original real client in play/ connects to the existing managed authority; see docs/ONLINE_INTEGRATION.md for new execution evidence and remaining migration gates. Do not claim that historical prototype tests ran here. Preserve upstream attribution, the verified bot MIT notice and an auditable origin for moved code. Resolve applicable rights before importing runtime code or assets. Do not copy the entire legacy application as a shortcut.

Keep rules, authorized private views, sessions, transports, storage and UI separate. Do not let viewport or provider APIs enter the rule engine. Preserve installed app identity, original serving path, persisted player IDs, saves, pending command IDs and active room links during migration. Publishing or moving hosting is a distinct deployment step.

## Verification and delivery

Track follow-ups using the stable IDs in docs/MIGRATION_MVP_TODO.md; no external tracker or bd CLI is required. Run checks appropriate to the change. Once a runnable project exists, establish clean lint/typecheck/test/build commands and document them. Validate relative documentation links and provenance on documentation-only changes; do not invent passing app tests.

Never commit credentials, tokens, private game snapshots or environment files. Keep secrets on the managed server. Commit and push completed authorized work; verify branch status and report any real blocker. Do not merge or change the existing pilot as a side effect of repository setup.
