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
| Candidate advertises an incompatible engine | Remains waiting while saved game pins it; deliberate abandonment releases the pin and permits activation |
| Candidate resource deleted after installation | Worker refuses direct activation; failed repair preserves old app; restoring network resources and retrying repairs/activates the same release |
| Active-cache resource deleted after installation | Failed repair preserves the other files; retry restores offline readiness and saved-game reopening without a new release |

Targeted result: **6/6 update tests passed**. Combined with existing offline scenarios: **11/11 passed**, approximately 29 seconds. The incompatible-engine candidate advertises a future engine ID to test the guard; it is not an implementation or certification of a future rule engine. Prepared failure resources are synthetic; game creation/saving/resume use the ordinary local session.

Package checks also verify that the version includes the current template and that generated worker bytes match the template and manifest SHA. CI repeats these checks against the packaged site before publication.

## Remaining acceptance

- Actual iPad/Safari install, cold offline reopen and update/interruption behavior. Reference device: owner-reported iPad Pro 13-inch (2025), iPadOS 27 tentative; exact OS/build unconfirmed.
- Cross-window activation races: current single-window tests do not prove that another window cannot begin a new game between compatibility approval and worker activation.
- Browser termination at arbitrary points, storage eviction/quota during installation/activation and recovery of an incompatible/corrupt selected save need further tests.
- Anonymous identity/network behavior and live-game unknown delivery are separate session tests; these worker tests use Solo and make no real backend calls.

These passes narrow the update gate; they do not close it. Do not infer iOS behavior from Chromium or require iOS background execution.
