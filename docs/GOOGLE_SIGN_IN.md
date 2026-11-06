# Google sign-in

The PWA uses the existing Supabase Auth service and an original small PKCE adapter, `play/core/google-auth.js`. Google credentials remain in the managed provider settings; no client secret or Google API access token is shipped or stored by the adapter. There is no new runtime dependency or relay endpoint.

## Owner-approved scope (2026-11-06)

Google sign-in is required by the PWA for all gameplay, including Solo. Home shows sign-in and Help when signed out. Game dialogs use the Google profile name automatically and never ask for a player name. After a successful sign-in, Solo can create/resume games offline even with an expired internet access token. Solo saves are scoped to the account on this device; signing out hides all games, and signing back into the same account restores access. Invitation room/token survive the OAuth round trip. Anonymous signup and guest-play branches are removed from the PWA. The existing backend and its anonymous-token policy remain unchanged for now; this is a product/code simplification, not a new server authorization boundary. Historical anonymous accounts/unowned saves are not migrated. No server data is deleted. Account changes remain fenced against pending moves. Cross-device game discovery, Solo synchronization, other OAuth providers and device handoff verification remain separate work.

## Provider configuration

- Enable Google on the existing project, `ppaixjqaixwnebhxfjeb`.
- Store the Google OAuth client ID and secret directly in the provider's secure settings.
- Retain `https://ppaixjqaixwnebhxfjeb.supabase.co/auth/v1/callback` in Google's authorized redirect URIs. The PWA's direct Supabase authorize endpoint was verified live to redirect to Google with this callback. Lovable's configuration UI can also require its own broker callback URLs; those do not replace the direct Supabase callback for this adapter.
- Allow `https://stefanavesand.github.io/game-shelf/play/` in the authentication redirect allowlist. Keep other existing URLs and the configured Site URL.
- Restrict scopes to `openid email profile`. Add intended Google test accounts while the OAuth project is in testing.
- Manual identity linking is disabled in the live service and is not required by this owner-approved scope.

References: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Lovable provider settings](https://docs.lovable.dev/features/google-auth).

## Flow and failure behavior

Home offers Sign in with Google. Before navigation, the adapter saves a cryptographically random PKCE verifier, expected starting principal, return URL and timestamp in local storage. The return accepts an authorization code only with a matching recent local flow; it scrubs OAuth parameters from the URL before exchanging the code. The page sends no referrer. It does not accept access tokens inserted into the fragment. A changed principal in another app window, expired/missing verifier, denied consent, failed exchange or storage failure leaves the previous identity intact. Raw provider error descriptions are not echoed into the UI.

Account changes use the exclusive application lifecycle lock and reject unresolved deliveries across saved online rooms. Google sign-out requires connectivity, revokes only the current Supabase session (`scope=local`), clears its stored credentials after success, and reloads Home. It does not sign the user out of Google itself or remove game records. A failed logout preserves the stored session for recovery. Connected Google accounts also offer Sign in again, including during an authentication error, so an expired/revoked session can be repaired without clearing app data.

## Verification and limits

Eleven Node tests cover PKCE exchange, no unsolicited signup, denial, missing/expired state, implicit-token rejection, cross-window identity changes, network/provider/storage errors and scoped logout. Browser scenarios exercise success from guest/fresh installations, cancellation, unsolicited callbacks and a pending delivery in another room and recovery from a rejected expired session. Additional browser checks cover signed-out session entry points, invitation preservation, automatic names, account-isolated Solo saves and logout. These use simulated auth HTTP responses, not a real Google consent screen. Existing relay/solo UI smoke tests also run.

Live verification confirmed Google is enabled and the authorize endpoint redirects to `accounts.google.com` using the direct Supabase callback and a configured OAuth client, without exposing credentials. A real Google consent/code exchange still requires the owner's account. Installed iPad Safari/PWA handoff is not verified by Chromium tests: the callback must return to the initiating storage context for PKCE. If it opens another browser context, the app rejects the missing local flow and asks the user to start sign-in again. Do not claim device acceptance until that actual flow is tested.
