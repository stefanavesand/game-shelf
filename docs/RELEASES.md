# Release compatibility

`release.json` declares the app release version and `breaking`, which defaults to **false**. Normal compatible releases retain `compatibilityId`, independently of source hashes. The generated Catan artifact records both this ID and the exact source digest; downloaded assets remain SHA-256 verified.

For a breaking release, increment `version`, set `breaking: true`, and run `npm run build`. Generation advances and persists the compatibility ID once per declared breaking version. Repeated builds are stable. Commit the resulting release policy and artifact. Set `breaking` back to false for subsequent compatible releases; the new compatibility ID remains. Do not manually reuse a pre-breaking ID.

Local saves, online module bindings and service-worker save pins use the compatibility ID. Existing rules-2.1 saves retain their current identifier. Non-breaking UI or compatible engine changes therefore do not force abandonment merely because bytes changed. Breaking changes still require migration, an older engine, or explicit abandonment. There is no retroactive migration of rules-2.0 saves.

The flag is an author assertion of compatibility, not an automatic migration. Unsupported storage/config/rule schemas still reject; snapshot integrity, pending-delivery guards, peer state-hash comparisons and halt-on-disagreement remain enforced. If a change cannot replay existing commands with the same results or interpret existing saves, mark it breaking. Mixed compatible clients that disagree still stop the game rather than silently accepting different results.
