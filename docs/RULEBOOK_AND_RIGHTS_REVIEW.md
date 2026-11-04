# Rulebook and rights review

2026-11-04. Review baseline: `c5108920f1e9ac2ee1e6cf6f87f64bda1fccf486`, engine 2.0.0, artifact `0b6ec737a127830c017a7c46f757ad81047d247760527968266c3e178ed2821b`.

## Scope and conclusion

This is a fresh source/reference audit by the same assistant that helped develop the implementation, using published references and explicit expected outcomes. It is **not an independent human review**, legal opinion, comprehensive code-similarity clearance or certification of all reachable game states. No game behavior, product naming, repository visibility or hosting was changed by this review.

The core implementation is substantially aligned with the reviewed base-game reference. However, three reproduced restrictions exclude legal player choices. The supported layout is a product variant rather than an exact official beginner setup. Rights clearance remains open: a small dependency graph and new repository do not grant permission to brand or distribute an adaptation as CATAN.

## References and edition limitation

- [Official rulebook index](https://www.catan.com/understand-catan/game-rules), consulted 2026-11-04.
- Primary baseline actually read: [English fifth-edition Game Rules & Almanac, official 2020 PDF](https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf). Page references below are printed page numbers, not zero-based PDF indices.
- [Official base-game FAQ](https://www.catan.com/faq/basegame), consulted 2026-11-04; used only for applicable 3–4-player base rules, excluding extension-specific entries.

The index also links a 2025 sixth-edition PDF. Browser retrieval rejected its size; a shell download never executed because its permission request was interrupted. **No sixth-edition parity claim is made.** Pin the above reference for this audit; choosing the edition for the product remains a product decision. A newer rulebook needs a separate delta review.

## Reference-to-implementation matrix

“Aligned” means source review plus the stated scenario evidence, not exhaustive proof. B = `tests/catan/engine.test.js`, V = `tests/catan/validation.test.js`, T = `tests/catan/trading.test.js`, D = the diagnostic below. Existing B tests were read; V and T were rerun in this review.

| Area / printed reference | Implementation | Evidence / assessment |
|---|---|---|
| Components, pp. 2–3 | `model.js`, `session.js` | B/V: quantities, finite bank/deck; aligned. |
| Setup order/income, pp. 12–13 | `session.js: setup`, `setup.js` | D independently checks snake order and second-settlement income; aligned. |
| Beginner map / variable setup, pp. 2–3, 12–13 | `model.js`, `board.js` | Fixed custom terrain/token/port configuration plus freely selected placements; not official beginner reproduction or random-board mode. |
| Production/shortage, pp. 4, 10 | `turn.js` | V: city multiplier, blocking, multi-player shortage, single-player remainder; aligned. |
| Turn structure, pp. 4, 6, 8 | `session.js`, `economy.js` | Combined trade/build phase is supported; permitted reference option. |
| Costs/pieces/cities, pp. 4–6 | `economy.js`, `model.js` | B/V and source: costs, returned settlement, piece limits; aligned, direct city without settlement rejected. |
| Distance/connectivity/coast, pp. 7, 11 | `setup.js`, `board.js` | B topology and source: occupied/adjacent/connected sites, enemy junction blocking; no exhaustive placement-state proof. |
| Domestic exchange, pp. 4, 7 | `session.js` | T: authorization, simultaneous transfer, owned resources, no gifts/overlap; aligned outcomes. Counterproposal restriction RV-02 below. |
| Maritime rates/ports, pp. 4, 9 | `board.js`, `economy.js` | B/T and source: port ownership and best rate; optional worse rate restriction RV-01 below. |
| Seven/discard, pp. 5, 11 | `turn.js` | V: frozen half-hand counts, exact quantities, all discards first; aligned. |
| Robber/victim, pp. 8, 11 | `turn.js` | V: new hex, random existing resource, phase continuation; empty-victim restriction RV-03 below. |
| Development deck/purchase, pp. 2, 5, 7 | `economy.js`, `model.js` | B/V: finite draw, costs and purchase-turn restriction; aligned. |
| Action-card timing, pp. 5, 7 | `economy.js`, `session.js` | V: one per turn, purchase-turn restriction, pre-roll continuation; aligned in supported phases. Resolution cannot be interrupted by other actions. |
| Knight/Army, pp. 5, 8 | `economy.js`, `turn.js` | V: threshold/ties/transfer; no discard branch from Knight in source. |
| Road Building, p. 10 | `economy.js` | V: free consecutive placements, available-piece limit; stopping voluntarily before second placement not implemented, interpretation follow-up below. |
| Plenty/Monopoly, p. 10 | `economy.js` | V: bank availability, same-type pair, all opponents; extreme depleted-bank interpretation follow-up below. |
| Longest Road, pp. 5, 9 and FAQ | `scoring.js` | V: trails, forks, loops, blocking and award ties/transfer; aligned for reviewed scenarios. |
| Victory/hidden points, pp. 6–7, 14 | `scoring.js`, `projection.js` | V: own-turn win, bought VP, next-turn immediate win; aligned. Final totals exposed; individual opponent VP cards are not revealed in projection. |

### Reproduced discrepancies

Run `node scripts/review-rulebook.mjs`. Its JSON is a diagnostic report, **not a pass/fail test runner**; a successful exit means the diagnostic executed, not that conformance passed. Captured output: [RULEBOOK_REVIEW.json](provenance/RULEBOOK_REVIEW.json). Fixtures are prepared states; they do not prove a natural full-game trace.

1. **RV-01 — Maritime choices narrower than reference.** With an owned brick port and four brick, 2-for-1 succeeds but 4-for-1 is rejected with `Invalid bank trade ratio`. The reference permits 4:1 regardless of port ownership (p. 4). The comparison in `economy.js` demands exactly `bankRate`, and `catanChoices` exposes only that rate. Low practical impact, but a genuine choice restriction. Future change should enumerate allowed rates, not accept arbitrary overpayment.
2. **RV-02 — No off-turn proposal/counteroffer.** A nonactive participant holding brick cannot propose it for the active player's ore; `Cannot offer this trade now.` Only the current player can originate an offer. The reference permits other players to propose/counteroffer with the active player (p. 4). Existing active-player re-proposal can realize the same exchange, but the interaction is incomplete. Recipient acceptance alone is not a counteroffer implementation. Any extension must still prohibit exchange solely between inactive seats.
3. **RV-03 — Empty adjacent victim cannot be selected.** With one funded and one empty adjacent opponent, selecting the empty opponent fails with `Invalid steal target`. The reference describes selecting an adjacent player and receiving nothing when that player has no cards (p. 8). `victims` filters zero-card hands; the app deliberately forces a funded target when present. Treat as a documented simplification until reviewed/fixed, not a rulebook requirement.

These restrictions did not establish an illegally granted resource or award. They still prevent a claim of full reference conformance. Do not change the reference expectations merely to make existing behavior pass.

### Additional gaps requiring a decision or stronger oracle

- **RV-04 — Card edge cases:** voluntary early completion of Road Building and Year of Plenty when fewer than two total bank cards remain need an explicit edition/FAQ interpretation. Current implementation requires every available free-road placement and exactly two bank cards. No definitive official clarification was obtained here; these are questions, not confirmed defects.
- **RV-05 — Public action visibility:** current offer terms are public while pending, but after acceptance history records only the action name. A player missing that transient offer lacks a public record of its quantities. Played opponent progress cards are omitted by projection. Audit log/reveal behavior against the chosen tabletop information model; resource totals alone are not equivalent to a visible exchange record.
- **RV-06 — Variant labeling:** document the custom fixed map, randomized seating/start selection, three-seat MVP wrapper, combined trade/build and trusted-friends replication. Engine-level four-seat support does not mean four seats are supported by the product.
- **RV-07 — Exhaustiveness/device:** graph/property exploration, unusual bank states, an independent human rules review and actual full human multiplayer acceptance remain open. Existing 100-game regression is supporting evidence, not an external rules oracle.

### Execution evidence

This review reran V (**21/21**) and T (**26/26**), and executed the five diagnostic cases: two aligned observations and three reproduced restrictions. The diagnostic also asserts input immutability and the setup income/order result. Existing full simulations/browser evidence was read, not rerun or relabeled as new evidence. `npm run check` and documentation-link validation must pass before committing this review. Runtime artifact is unchanged.

## Rights and dependency review

### Can the product use the name CATAN?

**There is no established permission in this repository. Do not treat CATAN as a cleared product/module marketing name.** The rights holder identifies CATAN as its trademark and says free electronic works are not exempt from IP restrictions. Its [IP policy](https://www.catan.com/guidelines-dealing-intellectual-property-catan), consulted 2026-11-04, describes a narrow personal-use position and authorization for publication of derivative works outside applicable legal exceptions. That policy is the rights holder's position, not a court ruling or a complete statement of every jurisdiction's law.

Descriptive reference to someone else's game in technical documentation is a different use from branding a playable substitute. Whether a particular reference is lawful depends on context/jurisdiction; it does not grant a license for the rest of the product. “Unofficial”, free access, private invitations and an attribution notice do not by themselves settle infringement. The current repo **and Pages app are public**, even though intended play is among friends. A digital app shared with friends is not automatically the policy's single handmade personal copy.

Recommendation before wider sharing/store distribution: seek written permission covering the app/name and distribution, or have qualified counsel review an independently branded version. Renaming alone does not clear copied expression or the overall presentation. Do not add a claim that permission has been granted, and do not send a licensing request without the owner's explicit instruction. Keep `LEG-01` open.

### What else can be protected?

Original illustration, graphic layout/expression, text (including rulebook/card wording), music, sound, software and logos can carry separate rights. Underlying ideas/methods of play are distinct from their expressive implementation: see the [U.S. Copyright Office's game guidance](https://www.copyright.gov/register/tx-games.html). This is not worldwide permission to clone a branded product. [PRV's game-development guidance](https://www.prv.se/sv/spelutveckling/hantera-spelkoncept-strategiskt/upphovsratt/) describes the Swedish copyright context. Trademark, design and other applicable rights need their own assessment; no patent/design-register clearance was performed.

No original CATAN/OpenCatan artwork, sound or official PDF was found in the current shipping asset folders. `ui/art.js` and `play/icon.svg` contain newly authored vectors; help uses project-written descriptions. This provenance/source audit is not a visual substantial-similarity opinion. Original authorship/AI generation also does not guarantee noninfringement or establish exclusive copyright in generated outputs. Review the overall game presentation before public release.

### Are we completely free of OpenCatan?

**Operationally separate, but not without historical code lineage.**

- Nine current engine/session/bot/projection modules were extracted from the owner's `stefanavesand/OpenCatan` history. All nine recorded source SHA-256 values were recomputed and matched source commit `e6695090a603e7c831ce8c24ccaecf77d0c130b6`.
- None has a same-path counterpart in reviewed original-upstream baseline `97786b131a4af8eae8aada53578bfca9b1789982`. The original five upstream helper counterparts were excluded; current geometry/model helpers were newly written. See [source manifest](provenance/CATAN_SOURCE.json) and [engine guide](CATAN_ENGINE.md).
- A mechanical comparison of `play/`, `ui/`, `prototype/` against 988 upstream TS/JS/CSS/SVG files found **zero identical files**. Exact trimmed-line matching (minimum 65 characters) found one ordinary player-lookup statement in scoring. This is a limited similarity signal, not proof that no expressive fragment was adapted or that authorship rights are clear. File absence is not proof of independent authorship.
- The old upstream README asserts MIT, but no project LICENSE/COPYING/NOTICE file was present in that pinned tree. This does not prove there is no license grant; it means complete grant/notice evidence has not been established here. Current upstream HEAD was not verified. Do not copy its remaining code/assets or label everything MIT on that basis.
- Planning/provenance documents retain upstream references. Erasing attribution, changing repository name or JavaScript transpilation would not remove applicable obligations. Confirm contributor/contract rights for reused owner-history code before granting a blanket project license.

The present app has no dependency on the original React/Redux/PartyKit runtime packages. That is a dependency observation, not an all-rights clearance.

### GPL, AGPL and other open-source obligations

| Component / inspected scope | Evidence | Assessment |
|---|---|---|
| PWA production npm dependencies | `package.json`, complete `package-lock.json` | None. Runtime uses project JS and browser APIs. |
| Locked test tools | `@playwright/test`, `playwright`, `playwright-core` 1.64.1 | All three declare Apache-2.0; installed notices/license files inspected. Not shipped by site's allowlist. |
| Adapted settlement heuristic | `play/catan/rules/bot.js`, `licenses/catan-ai-MIT.txt` | MIT notice retained, including inside shipped JS. Pinned external origin recorded. No broader engine/trademark license follows. |
| Shipping assets | 50 files in `play/`, 2 in `ui/`, 4 in `prototype/`, plus root entrypoint | Build ships allowed HTML/CSS/JS/SVG/manifest extensions; no node_modules, old art or official rulebook. Prototype is also packaged and was included in this review. |
| Managed Lovable backend | Separate checkout `stefan-game-shelf` at `5d6683467a6e5e601de42d6656d3f961344323cd` | Manifest inspected only; its full transitive Bun graph, embedded generated server bundle, platform service terms and deployment were **not comprehensively license-audited**. No all-system GPL-free claim. |
| Browser/Node/CI/container tools | Separately installed execution infrastructure | Not part of the shipped PWA; their use alone does not relicense app code. Redistributing such tools requires their own notices/review. |

**No GPL/LGPL/AGPL dependency was found in the PWA's complete locked npm graph or identified reused runtime component.** This is the bounded finding, not a guarantee about all code ever used in either repository or managed infrastructure. A plain text search of the backend lockfile is not a license inventory; integrity hashes can even contain strings resembling “gpl”.

GPL is not inherently “toxic”: it imposes reciprocal conditions in applicable distribution/combination cases. Browser JavaScript is delivered to recipients, so a future GPL runtime import would need careful compatibility/source review. AGPL can add source-offer duties for modified programs used over a network. Merely using a separate GPL development tool does not automatically put its output under GPL. Evaluate actual license text, linking/combination, modifications and distribution; do not infer obligations from a package name or the existence of an HTTP connection alone.

The repo currently has **no blanket project license**. A public GitHub repository is not equivalent to a general open-source redistribution license. Decide one only after applicable ownership/grants are established; retain third-party notices either way. The bot notice's first legacy path in `THIRD_PARTY_NOTICES.md` is historical; its current shipped path is `play/catan/rules/bot.js`.

## Prioritized follow-up

1. **LEG-01:** choose licensed CATAN distribution versus an independently branded product reviewed for applicable rights; audit the actual public offering before wider promotion. Obtain legal advice/permission as appropriate. Nothing was taken offline or renamed by this review.
2. **RULE-VALIDATION-01:** decide/fix RV-01/02/03; settle RV-04 interpretations, label RV-06 variants and add acceptance regressions for the chosen behavior. Keep current reference expectations visible.
3. **LEG-01:** finish contributor/source and separate backend/transitive dependency review; archive actual license/notice evidence, choose a project license and maintain the inventory.
4. **DOCS-SHARE-01 / QA-01:** resolve public action/reveal documentation, human rules review and full two-person-plus-bot device acceptance. No release gate is closed merely by this report.
