# Responsive game UI

Owner-approved direction (2026-11-07): one fixed game viewport on phones and iPads, compact player chips, board plus an action dock, left overlay navigation, and dialogs that fit the available screen. Landscape uses a right action panel; portrait uses the bottom dock. The page does not scroll during play. Board zoom/pan is independent of page navigation. Home and the saved-game library remain ordinary document views.

## Boundaries

- `play/catan/`: deterministic rules and authorized views. No viewport, DOM or navigation dependencies were introduced.
- `play/session.js`: commands, persistence, transport selection and bot scheduling. Layout does not alter this contract.
- `play/presentation/game-view.js`: pure turn-instruction projection from the authorized view and explicit UI inputs.
- `play/presentation/game-screen.js`: markup for player chips, board frame and action dock. It receives already selected actions and resource markup; it does not send commands or fetch state.
- `play/presentation/html.js`: shared escaping and button markup.
- `play/presentation/overlays.js`: native-dialog navigation, backdrop dismissal and focus restoration. One primary overlay, with the existing explicit counteroffer layer supported.
- `play/presentation/dialog-pages.js`: resource and item pagination; it hides/reveals existing controls without changing draft quantities or player data.
- `play/presentation/viewport.js` and `layout.css`: available viewport height (including Safari chrome/keyboard), responsive placement and safe areas.
- `play/app.js`: entrypoint/controller. It owns previews, draft trades, pending-operation guards and event routing. Remaining controller extraction is incremental; this is not a second game engine or framework rewrite.

The same components are used at every breakpoint. Rotation changes placement without rebuilding the session or clearing a draft. Unchanged polling continues to preserve board DOM, selection and focus. Sidebar DOM lives outside the game render target. The sidebar carries connection/update status, game details, scores, activity, help and account access. Blocking game errors remain in the action panel; informational notices use the live announcement region rather than shifting the board.

## Overlays and overflow

Native dialogs provide the inert background, focus trap and Escape handling. Closing a sidebar restores the menu trigger. A counteroffer may overlay an existing trade editor; its draft remains owned by the controller. Other primary navigation closes the sidebar before opening content.

The trading editor uses all five rows when height permits. On shorter screens it pages resources, preserving all quantities. A compact Trade settings step exposes player/bank mode and recipient on landscape phones. Help uses topic selection and text pages; score details select a player; card lists and activity use pages. Content is reachable through explicit controls rather than merely clipped with `overflow: hidden`.

## Verification

`tests/play/layout.spec.js` checks phone and tablet portrait/landscape geometry, no page overflow, sidebar overlay geometry, resource reachability, rotation/polling draft persistence, preview persistence and setup confirmation. Existing trading, offline, Google identity and safe-update regressions remain part of the CI release gate. Chromium emulation is automated evidence; physical Safari/iPad keyboard, safe-area and touch acceptance still need device verification.
