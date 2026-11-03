# Frontend checks and GitHub Pages deployment

Requested 2026-11-03. This automates the independent Game Shelf frontend. It does not deploy the managed Lovable authority, migrate its engine source, alter the old installed OpenCatan PWA, or complete the physical-device/operations release gates.

## Workflow

`.github/workflows/client-checks.yml` runs on pull requests, pushes to main and manual dispatch. PRs can test/package but cannot publish. Main deployments wait for the same run's check job to pass; workflow-level serialization prevents main releases overtaking each other. Superseded PR runs may be cancelled.

1. Install the locked npm dependencies and Chromium under Node 22.
2. Check source syntax, package JSON and relative documentation links.
3. Run the native core tests.
4. Build an allowlisted static site into dist/ and test its contents/source hashes.
5. Run the complete deterministic browser suite against dist/, using the existing routes and public serving prefix.
6. Keep browser review artifacts and a tested-site package for seven days. Only main publishes a Pages artifact.
7. Deploy that tested artifact with the GitHub Pages action and short-lived GitHub OIDC token.
8. Rebuild the expected manifest from the same source revision and verify every public asset's HTTP status, length and SHA-256. A bounded retry accommodates CDN propagation. The check does not sign in, create rooms or make moves.

The check/verify jobs have read-only repository access. Only the deploy job receives pages:write and id-token:write, and uses the github-pages environment. No personal token or managed-service secret is required. The two natural managed-game tests are explicitly disabled in ordinary CI to avoid creating accounts/rooms or spending provider quotas. Browser tests use synthetic authorized projections and network fixtures; they do not substitute for managed-service rule/atomicity tests or a physical iPad playthrough.

## Package and serving compatibility

`npm run build` copies index.html and HTML/CSS/JS under play/, ui/ and prototype/ only. It adds .nojekyll and site-manifest.json. The repository remains public, but documentation, fixtures, tests, dependencies, backend references and environment files are not part of the served app package. Symlink assets are rejected. Existing /game-shelf/play/, /prototype/, shared asset paths and the root redirect remain intact.

`npm run test:package` checks required entrypoints, the closed package file set and exact source/hash parity. `GAME_SHELF_STATIC_ROOT=dist npm run test:browser` serves the package rather than the working source. Ordinary local development still serves source. Local manifests use commit "local" unless GITHUB_SHA is supplied; Actions always stamps its exact tested SHA.

## Activation and rollback

GitHub Pages must use **Source: GitHub Actions**, replacing the old main / (root) branch build. Until that setting changes, the old branch publisher can bypass this test gate. The main-only deployment job sets this source using its scoped Pages permission; if denied, the owner must do it in Settings → Pages → Source. Do not describe the pipeline as fully active until the source setting, main workflow deployment and public verification have all succeeded. Keep the current published client available while preparing/testing the workflow.

A failed check prevents a new deployment. A failed post-deployment content verification marks the run failed but does not automatically roll back the already published artifact. Roll back app source with a normal revert commit on main; the previous implementation then passes the same tests/package/deploy/verify path under a new auditable revision. Keep browser storage keys and save schemas compatible; this pipeline alone does not make an incompatible migration safe.

## Current verification

Local source checks, 19 native core tests, the 18-file package build and two package-integrity tests passed. The earlier bootstrap Actions run 41626104814 passed its source-based checks and 42 deterministic browser tests; that predates packaged-site testing. PR run [41629610270](https://github.com/stefanavesand/game-shelf/actions/runs/41629610270) passed source checks, 19 core tests, two package-integrity tests and 42 deterministic browser tests against dist/. PR deploy/verify jobs were correctly skipped. The Pages source is still legacy main/root. Updating it through the connected integration returned HTTP 403 (Resource not accessible by integration); the source must change to GitHub Actions (Settings → Pages → Source is the manual fallback). The main-only deploy job attempts the same source activation with its already declared job-scoped pages:write GitHub token after checks pass. If that is also denied, the repository owner must set the source manually and rerun the failed deploy job. This one-time cutover changes only CI/package tooling; application asset bytes remain unchanged from the existing tested production client. Activation and first gated public verification remain open.
