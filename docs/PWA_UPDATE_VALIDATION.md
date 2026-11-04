# PWA update verification

2026-11-04. Evidence for MVP-R02 / QA-01; not full release certification.

## Implementation

Offline cache identity now includes both the app asset manifest and the worker template. A worker-only release therefore stages into a different cache from the active version. Downloading uses a temporary cache; only verified resources are copied into the candidate cache. Failed downloads discard their staging cache and preserve pre-existing cache files, including surviving files of an incomplete active cache.

A waiting worker verifies all resources again before activation. The PWA checks/repairs an incomplete waiting package before requesting activation; the worker independently refuses activation if its cache is incomplete. A failed repair keeps the current app. A later retry can repair the same candidate without a new release. The same verified repair flow can restore missing active-cache resources without replacing the app. Game/command compatibility checks still apply after repair. No app/API identity or game data is put in the service-worker cache.

## Executed browser scenarios

`tests/play/updates.spec.js` serves two controlled releases over real local HTTP and runs real Chromium workers, CacheStorage, IndexedDB and production PWA/session code. It does not mock worker lifecycle events or mutate production files.

| Scenario | Result |
|---|---|
| UI release interrupted by a resource download failure | Candidate/staging cache removed; previous cache verifies and saved Solo reopens offline |
| Worker-only release interrupted by a resource download failure | Separate version/cache; previous offline app/game retained |
| Complete compatible release while a game is active | Activation blocked on board; permitted at home; unfinished game resumes offline after activation/reload |
| Candidate advertises an incompatible engine | Installation is refused while a saved game pins the old engine, even across last-window close/reopen; deliberate abandonment permits a later installation/activation |
| Candidate resource deleted after installation | Worker refuses direct activation; failed repair preserves old app; restoring network resources and retrying repairs/activates the same release |
| Active-cache resource deleted after installation | Failed repair preserves the other files; retry restores offline readiness and saved-game reopening without a new release |
| Active version misses a module while hosting serves a newer version | Rejects mismatched network bytes, displays startup recovery, retains the game and resumes when compatible original resources return |

Initial single-window slice: **7/7 update tests passed**. Current update suite: **14/14 passed**, approximately 44 seconds, including multi-window and automatic-activation coverage. An earlier combined run also passed all five existing offline scenarios. The incompatible-engine candidate advertises a future engine ID to test the guard; it is not an implementation or certification of a future rule engine. Prepared failure resources are synthetic; game creation/saving/resume use the ordinary local session.

Package checks also verify that the version includes the current template and that generated worker bytes match the template and manifest SHA. CI repeats these checks against the packaged site before publication.

## Cache-miss integrity and recovery limits

A known app resource missing from cache is now checked against the active version’s expected hash before network bytes are served and cached. A newer release cannot silently fill the old version’s missing module. A rejected or unavailable module stops startup with a recovery message; the resource check never deletes or changes game snapshots.

The controlled test restores the original files at its HTTP server. Real repair still requires compatible files to be available from hosting or an operator rollback. There is no automatic historical-artifact download or engine-pin bypass. Operator rollback, arbitrary cache eviction and physical iPad recovery remain release work.

## Remaining acceptance

- Actual iPad/Safari install, cold offline reopen and update/interruption behavior. Reference device: owner-reported iPad Pro 13-inch (2025), iPadOS 27 tentative; exact OS/build unconfirmed.
- The supported cross-window cases now have executable coverage below; arbitrary process termination and actual Safari/iPad suspension still require acceptance.
- Browser termination at arbitrary points, storage eviction/quota during installation/activation and recovery of an incompatible/corrupt selected save need further tests.
- Anonymous identity/network behavior and live-game unknown delivery are separate session tests; these worker tests use Solo and make no real backend calls.

These passes narrow the update gate; they do not close it. Do not infer iOS behavior from Chromium or require iOS background execution.

## Multi-window and automatic-activation protection — 2026-11-04

Manual activation and session mutations now share the origin-scoped `game-shelf-app-lifecycle` Web Lock. `execute`, bot-progressing `refresh`, `resume` and `abandon` hold shared locks; activation obtains an exclusive lock, checks current saves/pending operations and retains it through activation. A busy operation causes the update control to ask the player to retry. Reads that do not persist/schedule work do not acquire this outer lock.

Before mutation, the session checks the registration's active version. A stale window cannot write even if it missed its controller-change reload. The recovery panel offers Reload app. Existing game/index locks still serialize actual storage and commands inside this outer gate.

A waiting worker can activate automatically after the final client closes. UI approval alone cannot protect incompatible saves. Installation therefore audits supported IndexedDB stores under the same exclusive lock. An incompatible unfinished game, pending admission/delivery or unreadable/unsupported save layout prevents installation. The audit never deletes games and exposes no game/identity contents in worker messages.

After a compatible audit, the installer stores a version/engine fence in `game-shelf-update-v1`. While an incompatible candidate installs or waits, old-engine windows cannot start another game; Apply update returns home and activates it safely. Failed downloads leave the old app in place; a stale fence is cleared on the next session operation only when no installing/waiting candidate remains. The fence also applies when no active controller exists yet. New engines can install after the incompatible games have finished or have been deliberately abandoned.

These guarantees describe cooperating current main-PWA windows and the current storage schemas. They are not a claim of compatibility with arbitrary historical clients or direct developer-console writes. Future storage implementations/schema versions must update the audit adapter as part of their release work.

Additional browser scenarios cover real session creation blocked before saving, commands queued after compatibility approval, a window that deliberately misses reload, lost online acknowledgments blocking installation/activation while retaining their exact original request, last-window automatic activation, a controlled first-install boundary and recovery after a failed engine download. The online case uses the in-memory relay contract double, not another live-backend game.

The earlier statement that cross-window activation had no executable coverage is superseded for these scenarios. Actual iPad/Safari suspension, arbitrary process termination, quota failure and all historical upgrade paths remain unverified.
