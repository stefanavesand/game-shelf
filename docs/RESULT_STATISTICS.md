# Result statistics and setup roads

Owner request, 2026-11-20. Compatible release 0.15.3 changes presentation, local observations and bot decisions; it does not change rules, authoritative state, dice generation or the relay API.

## Statistics

The result dialog replaces New game with Statistics. This game shows totals 2–12, actual counts, expected counts for two fair independent dice, total recorded rolls and sevens. Expected marks describe probabilities, not a requirement that a short game be balanced. My results shows completed games recorded for this account on this device, wins, losses, win rate, average VP and best VP. Solo and online results are combined; difficulty/mode breakdowns and account synchronization are follow-ups.

`play/core/statistics.js` observes confirmed authorized packets at the session boundary. It stores bounded counters and completion summaries in the separate `game-shelf-statistics-v1` IndexedDB database, scoped by principal and game. It does not store private hands, modify game snapshots, participate in hashes or send statistics over the network. Read/write transactions and revisions prevent duplicate counting across reloads and windows. An in-memory revision cache avoids writes on unchanged polling. Storage failure never turns a committed move into a failed move.

The engine retains only 30 history entries. Collection keeps earlier counters when that window rolls forward, but cannot reconstruct discarded events from an older game or an unobserved long reconnect. Such games are explicitly labeled Partial history; no rolls are invented. Completed-game totals include results opened with this version; older saved games contribute after their result is opened. Removing a game from the game library keeps its statistics. Clearing browser storage removes these records. Signing out hides them, and another account cannot query them through the session client.

## Setup roads

The frozen baseline valued a setup road using approximate coordinate proximity to possible settlements. The current bot instead follows public land edges from the candidate's far endpoint. It excludes opponent roads and buildings, cannot return through the origin to falsely credit another branch, and values only future settlements allowed by the distance rule. Existing `maxRouteLength` and `maxGraphNodes` parameters bound search and distinguish difficulty levels. Choices stay deterministic and come from engine-authorized setup actions. If every candidate lacks a reachable site within that bounded horizon, the mandatory setup road still has to be placed.

The supplied screenshots are not a full command trace: a later opponent settlement can close an initially viable route. The regression therefore establishes a precise public-topology case rather than claiming to reproduce that exact historical move. No adversarial prediction of future human setup locations is introduced.

## Verification

Focused tests cover accumulation beyond the history window, duplicates, stale views, missing history, legacy current-roll fallback, completed-result accounting and accessible expected-count chart markup. The bot regression has an engine-legal setup road whose onward edges are occupied by opponents; the production runtime chooses an alternative and the engine accepts it. Browser cases cover result navigation, phone/tablet layouts, reload, account separation and a statistics-only storage denial. Workflow execution results are reported separately; a test definition is not evidence of a passing run.
