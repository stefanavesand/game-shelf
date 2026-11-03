# Lovable implementation brief: identity and private relay

Prepared 2026-11-03. Reviewable instructions only; not yet sent to Lovable.

Implement stages 1–2 of [the identity and relay spec](SESSION_API_SPEC.md) in the existing connected project. Treat the spec as the contract and this brief as scope guidance. If the chosen platform cannot support a guarantee, report that limitation rather than silently weakening it.

## Scope

- Add the game-independent `/api/public/relay/v1` route, identity/profile adapter, private channels, invitation admission, ordered append/list and durable principal-bound mutation receipts.
- Include capabilities, effective limits, fixed access expiry and late-intent/tombstone behavior. Use the proposed pilot values explicitly; document any requested adjustments before deploying.
- Use existing anonymous auth. Preserve subject IDs and existing auth behavior; never auto-replace a failed identity.
- Keep all database mutations behind authenticated server handlers and service-only atomic SQL functions. Enforce membership, CAS, dedup, payload binding and quotas transactionally. SQL contains no game rules.
- Create a small separate developer client for two browsers to create/share/join a channel and exchange text/JSON messages. Show stable ID/name, pending/delivered state, sequence/catch-up and errors. Keep maintained UI/docs English and the test client separate from the normal game home.
- Add versioned migrations, request/response schemas, canonical payload hash vectors and offline unit tests. Make live integration tests explicit opt-in against a dedicated test environment; do not consume production quotas or create production identities automatically.

## Out of scope

Do not modify Catan rules, the pinned runtime, existing `/api/public/catan`, existing tic-tac-toe RPCs, live games or the external PWA. Do not implement bots, game snapshots, game rules, game-specific room fields, name search, friend directory, chat moderation, consensus, host migration, push or Bluetooth. Do not remove existing source or relax its access controls.

The relay cannot mark game commands legal. A stored receipt confirms communication persistence only. Divergence detection/halt and local game storage are later PWA work.

## Verification and handoff

Implement and report RELAY-01–09 and RELAY-14 from the spec, marking each as executed, code-reviewed or not run. Test actual lost-response/retry and concurrent CAS/duplicate/admission behavior with fixtures in the isolated environment. Verify unauthorized HTTP and direct database paths. No unannounced production load tests.

Run appropriate existing unit/lint/typecheck/build checks and distinguish pre-existing failures from new ones. Deliver source commit IDs, migrations, schema/examples, test commands/results, limits/expiry behavior and rollback instructions. No credentials, invitation tokens or private messages in logs or GitHub.

Keep pushed history intact so GitHub–Lovable synchronization remains usable. Do not publish automatically. First provide the concrete testable implementation and evidence; production publication is a separate step after review.
