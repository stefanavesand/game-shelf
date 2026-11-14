# Base-game scenarios

PWA 0.13.0 adds a Scenario choice for new Solo and online games. **Classic** is the initial default and preserves the existing fixed beginner island. **Random Island** shuffles terrain, number tokens and port types on the same radius-two island, with ordinary base-game rules and ten-point victory. This release does not implement expansion rules, harbor awards or the commercial scenarios shown in the owner's reference image.

## Configuration and validation

The pure catalog/generator/validator lives in `play/catan/rules/scenarios.js`. A recipe contains stable `id: random-island`, `version: 1` and ordered terrain/number/port-type arrays. Coordinates and nine non-overlapping coastal port edges remain canonical. There are 19 hexes, one desert, normal base-game terrain/number inventories, four generic ports and one of each resource port. Desert has no production number and starts with the robber.

The generator uniformly shuffles inventories using an injected bounded RNG. It enumerates the valid four-position independent sets on the 18 producing hexes (at most C(18,4) candidate sets), chooses one, then shuffles the two 6/two 8 tokens over it and the remaining tokens over remaining land. Thus no red tokens share an edge, without an unbounded rejection loop. This is a constrained random layout, not a guarantee of equal starting opportunities or resource/port balance. Port types change; port positions and their two eligible intersections do not.

The strict recipe validator rejects unknown IDs/versions/extra keys, altered inventories, desert/number mismatch and adjacent red tokens. Initialization applies the recipe without RNG or provider calls. Scenario metadata is stored in `game.settings.scenario`; terrain, numbers, robber and port types are ordinary authoritative board data. No scenario condition enters movement, trading or scoring rules in this first release.

## Generation, transport and storage

The host adapter `play/core/scenario.js` injects the existing unbiased WebCrypto bounded sampler. It generates the final recipe once at game creation, independently of dice, seat/deck setup and presentation. Solo saves the initialized board normally. Online saves the recipe in the creation intent before its first network mutation, retains it across retries, publishes it in the lobby configuration and includes it in `game.begin`. Peers independently validate and initialize the exact same explicit layout, then compare hashes. No server endpoint, backend rule or database migration is required; the compact recipe fits the existing relay payload limit.

Old games and direct configuration calls without a scenario retain the existing beginner layout and serialized state shape. Classic consumes no extra entropy. A saved or resumed game never runs the board generator again. Future versioned scenario recipes may add genuinely different rules through explicit engine work; arbitrary rule plug-ins are not part of this implementation.

## UI

New-game configuration has a labeled selector, original small SVG preview and English descriptions. The Random Island preview is explicitly an **example**; the final recipe is generated at creation and remains fixed thereafter. Changing game size/mode retains the scenario choice. Lobby and saved-game summaries identify the scenario. Existing production board artwork and actual port targeting/rendering are reused; no commercial screenshot artwork or descriptions are imported.

## Verification and limits

Focused tests validate 1,000 generated seeds, recipe rejection, deterministic initialization, real port endpoints/rates, online configure/begin/reopen parity, Solo persistence and online creation with a lost acknowledgment before retry. Standard and the current Planner each finish a three-seat and four-seat random-island self-play regression with resource conservation checked after every action. These four completed games establish basic legality/liveness, not calibrated bot strength or balanced-map statistics.

Code review found that both policies read actual terrain/numbers, legal topology and owned ports; the robber policy's off-board sentinel still lies outside the unchanged radius-two shape. No fixed beginner-coordinate strategy was introduced or changed. Broader bot strength testing on diverse maps remains open.

The browser regression creates a four-seat random Solo game on a phone viewport, verifies configuration and board inventories, and reloads offline to compare the exact terrain/numbers/ports. Existing packaged-site tests cover worker/profile/source parity and offline assets. Physical iPad acceptance and a two-device random online party remain separate from synthetic relay execution.
