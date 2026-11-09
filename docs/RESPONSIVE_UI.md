# Responsive game UI

Owner-approved direction (2026-11-07): one fixed game viewport on phones and iPads, compact player chips, board plus an action dock, left overlay navigation, and dialogs that fit the available screen. Landscape uses a right action panel; portrait uses the bottom dock. The page does not scroll during play. The entire board, including port labels, scales uniformly to the largest size that fits the board area. There are no zoom/pan controls. Static board bounds keep the framing stable during placement previews and moves. Home and the saved-game library remain ordinary document views.

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

The same components are used at every breakpoint. Rotation changes placement without rebuilding the session or clearing a draft. Unchanged polling continues to preserve board DOM, selection and focus. Sidebar DOM lives outside the game render target. Its contents update when an in-flight game creation finishes, while unchanged updates retain menu nodes and focus. The header exposes no update arrow or connection dot. The sidebar carries readable game status, read-only automatic-update status and app version, game details, scores, activity, help and account access. Blocking game errors remain in the action panel; informational notices use the live announcement region rather than shifting the board.

## Overlays and overflow

Native dialogs provide the inert background, focus trap and Escape handling. Closing a sidebar restores the menu trigger. A counteroffer may overlay an existing trade editor; its draft remains owned by the controller. Other primary navigation closes the sidebar before opening content.

The trading editor uses all five rows when height permits. On shorter screens it pages resources, preserving all quantities. A compact Trade settings step exposes player/bank mode and recipient on landscape phones. Help uses topic selection and text pages; score details select a player; card lists and activity use pages. Discard selection uses the same minus/count/plus controls as trading, bounded by holdings and the required total; no numeric keyboard is needed. Content is reachable through explicit controls rather than merely clipped with `overflow: hidden`.

## Verification

`tests/play/layout.spec.js` checks phone and tablet portrait/landscape geometry, no page overflow, sidebar overlay geometry, resource reachability, rotation/polling draft persistence, preview persistence and setup confirmation. Existing trading, offline, Google identity and safe-update regressions remain part of the CI release gate. Chromium emulation is automated evidence; physical Safari/iPad keyboard, safe-area and touch acceptance still need device verification.

## Automatic updates — 2026-11-07

Downloads, repairs and compatible activation run automatically while the app is in the foreground. Home with no open overlay is the activation point. Other open app windows must acknowledge being idle before activation; suspended/older clients make it wait. Saved games and pending commands retain all existing compatibility/lifecycle guards. An incompatible engine waits for its games to finish or be explicitly abandoned; updates never delete games. There is no app-update button or confirmation prompt.

## Illustrated fixed shell — owner approval 2026-11-08

The generated PNG is the visual reference, including illustrated terrain/resources, cream/green colors, serif typography, port pennants and shaded player pieces. The active game uses an exact square board surface. Portrait keeps players above the square, followed by a permanent event/dice strip, own hand, instruction and three-slot control row. Landscape places players and those same components to the right of the square, with two recent public moves in the remaining space; short landscape hides that secondary history. Short portrait uses tighter spacing. Geometry depends on the viewport rather than the current phase; setup retains the hand and uses the same bottom control slots. The board may be narrower than the viewport on short screens to preserve square geometry and accessible controls without page scrolling.

`game-screen.js` owns one component tree, `game-layout.css` its placement, and `viewport.js` computes a square-size constraint from available space. Event captions are outside the board and never cover ports. Real state supplies all tokens/pieces; the design image is not used as a flattened playable board. Terrain and resource artwork is prepared as local WebP assets, included in the verified offline package; see [asset provenance](../play/art/README.md).

Dice movement lasts 1.2 seconds. The foreground bot pacer reserves 2.6 seconds after a roll so the settled result and resource feedback can be read; other commands retain the 1.5-second interval. Resource delivery effects follow the dice movement. Reduced-motion retains the same readable pacing and text. Saving and human interactions do not wait for animation.

## Installed iOS top-edge blur — 2026-11-08

The owner reports a gradient blur over the header in the installed iPhone app. The header had an opaque background but normal-flow positioning; no app blur/filter was applied to it. A [matching iOS 27 report](https://github.com/yetone/magpie/issues/3515) describes WebKit's native top-edge sampling of opaque sticky/fixed views. The header now uses `position: sticky; top: 0`, an explicit solid background and a stacking level below native dialogs. The status-bar style is explicitly `default`; safe-area padding, app identity and game geometry are unchanged.

The browser regression verifies computed styling, width/height, and stationary placement during actual Home scrolling and in the game. It does not emulate the installed iOS compositor or prove the native blur has disappeared. Physical iPhone confirmation is still required. No header transforms, artificial safe-area spacers, forced scrolling or game/session changes were added.

## Fast animation experiments — 2026-11-08

The owner requested side-by-side iteration because a release takes roughly ten minutes. The separate [motion lab](../prototype/motion-lab/README.md) reuses production presentation code with bounded runtime overrides. Presets, sliders, replay, reduced-motion diagnostics and shareable settings run entirely in the browser after one initial publication. It is outside the PWA worker scope and uses no accounts, saves or service calls. Production animation defaults and bot timing remain unchanged until the owner approves a setting set. A successful lab clip does not prove that multiplayer events arrive consecutively in the real app.

## Approved motion profile — 2026-11-09

The owner supplied the lab profile: dice 3100 ms, rotation 140°, lift 0 px; piece movement 1450 ms, lift 9 px; resource flight 2200 ms; result hold 0 ms; minimum interval 300 ms. Reduced motion remains respected. The last selected lab clip (`robber`) is not a production preference. Robber movement now uses the shared piece duration, so that control applies to the displayed clip too.

Production pacing and the lab sequencer now share per-action interval bounds. The 300 ms value is a floor: a roll reserves 5550 ms for dice/resource delivery, a paid build up to 2950 ms for staggered resource costs, and a robber move 1700 ms. Saving and human controls do not wait on these effects. Rule execution, save formats and headless bot execution remain unchanged.

The profile release also exposed a startup-discovery race: a foreground event arriving during an ongoing update check could be lost until the next periodic check. Discovery now coalesces that event into one subsequent check, retaining the existing 30-second rate limit and idle-game activation guards. The regression holds completion of a native update check, publishes a candidate while that completion is pending, then fires focus and verifies that a subsequent discovery finds the candidate.

## Chronological game flow — owner approval 2026-11-09

This supersedes the separate event/dice strip, recent-moves box and instruction box. Player chips remain side by side and open the selected player's detailed score breakdown. The square board stays fixed; one independently scrollable activity feed contains confirmed moves, observed dice results and the current action as its final entry. Confirmation shows a pending saving state until acknowledgement; only confirmed moves enter history. Reading older entries preserves position across updates, with a jump-to-latest/action button. A fixed six-tile hand includes development Cards, with Build, Trade and End turn immediately beneath it in the same panel. The page itself does not scroll during play.

The presentation-only activity journal retains at most 200 entries per account, room and seat. It stores public descriptions and only the current player's observed positive resource gains. It is a best-effort local display cache, not an authoritative log or cross-device archive; denied/quota-limited storage does not block games. Older imported history may lack dice totals or gains, which are not invented. Opponents' VP cards remain hidden during play; final totals allow the detailed score breakdown after completion, also via Home's View result. Rules, relay, command IDs and save compatibility are unchanged.

Presentation modules `activity.js`, `activity-scroll.js` and `scores.js` own journal/markup, reader positioning and score derivation; `feed-layout.css` supplies the shared responsive arrangement. Focused unit/browser regressions cover persistence/privacy, action visibility, six hand tiles, selected-player scores, final scores, reader anchoring and jump behavior, alongside existing geometry, motion and gameplay checks. Physical installed iOS acceptance remains separate from Chromium evidence.
