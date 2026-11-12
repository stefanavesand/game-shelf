# Browser/device bot benchmark

Open `https://stefanavesand.github.io/game-shelf/diagnostics/bots/` after the corresponding Pages deployment succeeds. This is a separate diagnostic page, outside the installed PWA's service-worker scope/offline package. It does not authenticate, read accounts/saves, call the relay/backend or change the gameplay bot.

## Device procedure

1. Open in Safari on the physical iPad/iPhone; leave the device idle and the page visible.
2. Enter the device model and exact OS version in Device notes. Do not enter account information.
3. Select **Run benchmark**. One warmup round is discarded, then three measured rounds alternate candidate/baseline order over eight fixed synthetic observations.
4. Download the JSON report. Repeat the run to inspect variation, recording battery/thermal conditions when relevant. Closing/backgrounding or cancelling the page terminates the worker; incomplete runs are not success results.

The positions come from deterministic 3/4-seat baseline games: early, middle, late and incoming-offer observations for each seat count. Each is an authorized synthetic player projection. Both the frozen Standard baseline and experimental trading candidate are compared against Node-generated golden decision results on identical observations. This checks browser/runtime parity, not independent strategic correctness or playing strength. Small fixture coverage is not a performance release gate by itself.

## Report interpretation

- `decisionMs`: clone/freeze of the observation plus policy/preview work inside a dedicated module Web Worker, with p50/p95/max and count per policy (24 measured decisions each).
- `roundTripMs`: main-thread dispatch through completed worker response; includes message/scheduling overhead. Worker/module startup and warmup are excluded from these decision summaries.
- `animationFrameGapsMs`: main-thread animation-frame gaps during loading and execution. These are a responsiveness signal, not a measurement of individual main-thread tasks or proof of the proposed 50 ms gate.
- `metadata`: rules digest, original policy source hashes, profile/hash and fixture hash. The published site manifest separately hashes the generated served assets, which only remap module imports.
- `memory.measured` is always **false**. Safari has no portable per-worker incremental-memory API. Neither payload size, process heap nor frame timing is a substitute for the proposed 8 MiB search-memory measurement. That gate still requires external profiling on physical devices.

The 10-second per-decision diagnostic timeout stops pathological runs without freezing the UI. It is deliberately more permissive than the proposed production 1-second watchdog and is not production fallback behavior. The page makes no promotion/difficulty or performance-pass decision. There is no server upload; Download report saves locally and includes the user-entered notes and browser user agent.

## Packaging and verification

`scripts/bots/browser-benchmark.mjs` builds exactly eight diagnostic files: four UI/worker sources, three browser-compatible policy copies and one synthetic fixture module. It preserves the frozen baseline MIT notice. Only module import paths/extensions change in policy copies. Generated copies/fixtures are ignored by Git; build regenerates them from tracked sources. No arbitrary bot-results files, Node runner or real snapshot is published. Shared production rules are reused unchanged.

Run `npm run build`, `npm run test:package`, and `GAME_SHELF_STATIC_ROOT=dist npx playwright test --project=bot-benchmark`. Package tests verify allowlisting, source/content hashes, offline exclusion, license notice and all synthetic golden decisions. Browser tests cover real worker completion/parity, report download, cancellation and startup failure. They run against the packaged site in the existing GitHub Actions deployment gate. A Chromium run is not physical Safari evidence.

Local browser execution may require permission to bind the test HTTP server. If the environment blocks it, rely on the explicit CI result and report the local limitation; do not claim a local browser pass.
