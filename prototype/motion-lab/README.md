# Motion lab

Open `/game-shelf/prototype/motion-lab/` in a normal phone/iPad browser. This is outside the installed PWA's service-worker scope. After the initial deployment, tuning values, selecting presets and replaying clips require no build, deployment or login.

Use **Tune**, choose a clip or **More visible**, then **Apply & replay**. Sliders control dice duration/rotation/lift, piece duration/lift, resource flights, and demo sequence intervals/result holds. **Play sequence** cycles clips; **Replay** repeats the selected clip. Opening Tune or backgrounding stops the sequence. **Share settings** produces a URL; **Copy JSON** exports the values for review. Only `game-shelf-motion-lab-v1` is persisted. The lab does not read account identity, open game databases, register a service worker or contact a game service.

The device's reduced-motion preference is shown explicitly. It is respected by default. The checkbox can override it for this lab only, making it possible to diagnose why a real device shows no movement. Production behavior is unchanged.

The lab imports the production board renderer, game-screen components, artwork and `createGameMotion`. It passes bounded timing overrides to the shared implementation. Scripted fixtures use ordinary engine commands on prepared deterministic demo states and project a seat's authorized view. They are not real user games or multiplayer/bot-strategy validation. Demo sequence interval controls model presentation timing; network latency and revision gaps in actual multiplayer are not simulated. Once settings are approved, update production motion defaults and the separately owned bot-pacing constants in a reviewed release.

Tests verify hot tuning without a page navigation, shared URL parameters, no identity/database/network effects, reduced-motion override and valid consecutive command views. The normal game motion tests verify the approved production dice duration.
