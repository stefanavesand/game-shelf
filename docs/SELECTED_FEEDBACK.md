# Selected feedback — 2026-11-21

The owner selected four exported settings from the standalone [Sites studio](https://game-shelf-feedback-studio.amberpaste8.chatgpt.site). Release 0.15.6 adopts them in the game. The studio remains an independent Site; no studio UI, file upload, recording or experimental variants are added to the PWA.

| Event | Sound | Motion duration | Volume | Lift | Rotation | Respect reduced motion | Offset |
|---|---|---|---|---|---|---|---|
| Cards | Soft slide | 2200 ms | 35 | 12 px | 140° | Yes | 0 |
| Turn | Pluck | 800 ms | 35 | 12 px | 140° | Yes | 0 |
| Piece | Felt tap | 1450 ms | 35 | 9 px | 140° | Yes | 0 |
| Dice | Felt tumble | 1100 ms | 35 | 0 px | 510° | No | 0 |

`play/presentation/feedback-profile.js` retains the selected parameters. `sound-score.js` contains only the chosen original recipes from the softened Sites version: sine-squared noise envelopes, a gentle cue onset, felt impacts and the three-note pluck. Each cue has its own gain bus so overlapping cues cannot reset each other's envelope. All sound remains gesture-unlocked, optional and foreground-only. Mute/backgrounding stops scheduled sources. Audio randomness remains separate from gameplay entropy.

Dice rotate linearly in one direction. The owner's explicit dice setting overrides the OS reduced-motion preference for dice only; other effects respect it. Counter presentation waits for visible dice completion even when other motion is reduced. Resource-flight duration stays 2200 ms. Piece sound coincides with the start of its visual placement, rather than its landing; zero sound offset is relative to each effect's existing lead-in. Turn attention uses the selected 800 ms fade/lift on the current action. Existing resource/board animation staging and authoritative synchronization remain separate.

Focused tests cover the selected recipe events, smooth envelopes, mute/background cleanup, per-event reduced motion, sound deduplication, pacing and deferred counts. Browser regressions check 1100 ms / 510° dice and deferred gains with OS reduced motion both enabled and disabled. CI and public asset verification remain the production release gates. Physical audio preference remains an owner playtest judgement. Engine/compatibility IDs are unchanged; no saves are discarded.
