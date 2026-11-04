# Emulated human multiplayer

`tests/play/relay-game.spec.js` includes a complete natural game with two emulated human seats and one ordinary application bot.

- Two isolated Chromium contexts create and join through the real home/invitation UI.
- Each human driver receives only its seat's projected view and uses the existing Standard heuristic to choose an action. It submits through the production `play/session.js` API, without changing hands, dice, deck, scores or rules.
- The third seat runs through the normal creator-side bot scheduler. The test driver never commands that bot directly.
- Both contexts use real IndexedDB, local engine and relay adapter code. Relay HTTP responses come from an in-memory contract double with fixture identities, not the live internet service.
- The guest reloads during play; the creator reloads after victory. Completion, matching revision and internal state hashes, empty outboxes and no divergence halt are required.
- Legacy Catan and database RPC endpoints are denied and counted. No call to them is allowed.
- The loop is bounded at 1,600 iterations and four minutes; an incomplete game fails rather than being reported as a victory. A JSON test attachment records command count and final revision.

Run with installed Playwright Chromium:

```sh
npx playwright test --project=play tests/play/relay-game.spec.js --grep emulated
```

This is production-session integration coverage in browsers, **not** a full click-by-click UI usability test. Human decisions share the bot heuristic, so it cannot independently validate strategic quality or rule correctness. It does not certify live service quotas, authentication, real-network failures, Safari or physical iPad behavior. Those release gates remain open in [the review](MVP_REVIEW.md).

## Execution evidence

2026-11-04: targeted Chromium run passed in approximately 1.1 minutes. Both replicas finished, agreed on the final hash/revision, had no halt or pending outbox, and recovered through the asserted reloads. Forbidden legacy route count was zero. `npm run check` and `git diff --check` also passed. This is one naturally generated game, not a multi-seed completion baseline.
