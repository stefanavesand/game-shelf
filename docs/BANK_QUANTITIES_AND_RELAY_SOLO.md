# Bank quantities and Solo via backend — 0.15.7

## Bank and port quantities

Repeated plus/minus presses scale the selected exchange: for example, 8 wood for 2 ore at 4:1, or 4 ore for 2 brick at an owned 2:1 port. Either side's quantity control adjusts the complete exchange at its selected rate. Changing the give resource or rate resets the multiplier. Selecting another receive resource retains the quantity when the bank can supply it.

The UI scales one authenticated legal choice and caps it by the player's hand and the public bank stock. Displayed unaffordable owned ports remain visible. Submission is one ordinary `BANK_TRADE` with multiplied positive integer amounts; the existing reducer already validates this ratio, funds and stock atomically. No queue of partial trades, new rule action or protocol change is introduced. Each submitted exchange has one give resource and one receive resource. Player-to-player offers retain their existing multi-resource bundles.

## Solo via backend

New-game Play mode adds **Solo via backend · test connection** alongside Solo offline and Online. It creates a normal relay channel and immediately starts one human with bots, using the selected three/four seats, level, scenario and robber rule. No invitation or manual lobby start is needed. The mode flag lives in the account-scoped room index, outside hashed game state. Saved games identify this mode explicitly. Existing games keep their transport.

Human and bot commands use the same HTTP relay, durable outbox, ordered log, revision/hash checks, random-dice coordinator and replay path as ordinary online games. Admission retries retain the original mode and mutation identity. Reload/reconnect restores the same room; network failure does not silently switch to local Solo. Internet is required. Rules and bot thinking still run in the browser; backend code and database schema are unchanged.

A single-human session measures relay requests and recovery but cannot reproduce another human client's polling delay, concurrent moves, independent verification or differing network conditions. Those still require two clients. This mode is useful for isolating HTTP cost without coordinating a second player.

## Connection timing

In this mode, the sidebar offers **Connection timing**. It shows per-operation request count, failures, median and p95 for the existing bounded 120-sample HTTP journal, since page load or the last reset. Refresh measurements reads local samples; Reset measurements clears them. Neither sends a backend request. HTTP timing includes network and server response parsing, excluding identity-adapter work, animation, UI scheduling and local bot thinking. The panel contains no tokens, room IDs, messages or private game data. Start a test, reset after creation, play a repeatable sequence and compare request counts/latency before and after an optimization.

## Verification

Focused tests cover quantity bounds and exact scaled actions, atomic reducer conservation/one revision/one trade count, no mutation on insufficient bank stock, automatic backend Solo for three/four seats, normal command delivery, persisted mode, lost admission response and disconnected reads. Browser regressions cover bank steppers submitting one command and the real session/UI using a contract-double relay with diagnostics, reload and saved-game labels. The contract double is not a measurement of the live backend. Production CI and asset verification remain release gates. Rule-source digest and engine compatibility ID are unchanged; no saved-game cleanup is needed.
