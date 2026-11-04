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

## Opt-in real-service game

`tests/play/relay-game-live.spec.js` uses the current home/create/invitation flow with two new anonymous identities and one real channel. The human drivers use the production session API; the ordinary creator-side scheduler runs the third seat. After admission, the UI stays on home to avoid redundant background polling while the driver explicitly synchronizes. The game still uses the unmodified production local rules, IndexedDB and relay adapters.

```sh
GAME_SHELF_FULL_RELAY_LIVE=1 npx playwright test --project=play tests/play/relay-game-live.spec.js
```

In a managed executor using an environment HTTPS proxy, Node 24 can require `NODE_USE_ENV_PROXY=1`. Browser HTTPS is forwarded through TLS-verifying Node fetch; responses are genuine service responses, not fixtures. This is not a test of direct browser CORS or iPad networking. The runner paces requests per principal, stops on quota exhaustion and bounds the attempt to one game, 1,600 driver iterations and 90 minutes. Traces/screenshots/video are disabled; sanitized progress reports contain only counts/revisions. Ordinary CI explicitly disables the live opt-in. No cleanup endpoint exists: test channels follow the service's access-expiry policy, which is not a deletion guarantee.

### Fresh-invitation regression

The first real-service attempt exposed a first-install guest bug: boot synchronized a roomless guest before anonymous sign-up, causing `AUTH_REQUIRED` and disabling Join. Boot now synchronizes only an existing room or pending operation. Anonymous creation still occurs through the explicit join/create operation; lost or invalid saved identities are not silently replaced. A separate browser regression verifies that a fresh invitation keeps Join enabled and makes no external request before submission.
