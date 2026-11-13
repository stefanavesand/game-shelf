# Experimental development investment

BOT-AI-01/06, separate `development-investment-0.1.0` policy. The PWA remains on its pinned `build-trade-0.2.0` profile. This is an experiment, not a strength or device-performance claim.

## Design

[Purchase valuation](../scripts/bots/purchase-policy.mjs) wraps the unchanged robber/Knight experiment. A gated scalar expected benefit replaces the flat development goal gain throughout the existing shared planner: target selection, hysteresis, saving, bank trades, offers and discards use the same investment recipe. Construction rewards/parameters are unchanged. Below the minimum investment value, a private availability counterfactual masks purchase choices/deck availability for this decision; authoritative state is untouched. No existing policy implementation is modified. Gate-off delegates exactly.

The recipe already represents ore/grain/wool availability and acquisition delay. Competing construction recipes reserve those resources through goal comparison and remembered-goal hysteresis. No additional flat payment penalty is subtracted; this is approximate recipe/ETA comparison, **not** a complete after-payment successor search or proof of optimal opportunity cost. Immediate winning construction retains priority. A minimum investment value excludes negligible goals, so hand exposure alone cannot trigger a zero-value purchase. Soft discard risk remains unchanged.

Type probabilities start with the base-game mixture: 14 Knights, five VP, two of each action card. Types provably exhausted by own known cards are zeroed. Knights use public army totals plus own unplayed Knights, avoiding double counting own played Knights. Remaining initial weights are renormalized. This is a coarse masked initial-mixture prior, **not** the conditional remaining-deck distribution. Opponents' unplayed types, actual deck order and truncated history are never read. Public non-Knight play counts are not reconstructed. Ordinary reducer entropy draws the actual card.

Type benefits use:

- VP: one weighted point, increased gradually by own scored progress, including own known VP. It is never assumed to be the next draw.
- Knight: neutral utility, public army distance and currently blocked own city-weighted production. A held award gets no acquisition bonus. Future defense/block/theft uncertainty remains approximate.
- Road Building: bounded discount for a reachable site requiring one or two roads and actual remaining road pieces. No feasible route means zero. Award-only paths remain deferred.
- Year of Plenty/Monopoly: missing resources for the current best concrete construction recipe, capped at two. Monopoly has a separate uncertainty discount; no future victim composition or guaranteed yield is assumed.
- New action cards receive a delay discount; existing own unplayed action cards reduce their marginal value. VP is exempt from the action-card queue. All actual timing and scoring remain reducer responsibilities.

Valuation is recomputed once per observation, then held fixed through that decision's resource counterfactuals. This deliberately bounds work and keeps the shared gain scale coherent, but does not fully recompute card investment after every hypothetical exchange. The construction context is the best current construction recipe, not a forced commitment. Actual goal selection retains normal remembered-goal hysteresis. Work adds one bounded goal enumeration and two public production passes; no game-tree search or hidden draw preview.

## Controls

All inherited build/trade/robber controls remain explicit and unchanged. New strict registry controls:

| Parameter | Default | Range |
| --- | --- | --- |
| enablePurchaseValuation | 1 | 0–1 integer |
| purchaseVpValue | 1 | 0–2 |
| purchaseLateVpWeight | 0.5 | 0–2 |
| purchaseKnightValue | 0.4 | 0–2 |
| purchaseArmyWeight | 0.6 | 0–2 |
| purchaseRoadValue | 0.6 | 0–2 |
| purchaseResourceValue | 0.5 | 0–2 |
| purchaseMonopolyDiscount | 0.5 | 0–1 |
| purchaseDelayDiscount | 0.8 | 0–1 |
| purchaseQueuePenalty | 0.5 | 0–2 |
| purchaseMinValue | 0.05 | 0–1 |

Defaults are prepared-scenario starting values, not optimized parameters or calibrated difficulty levels. Flags for robber placement and Knight timing remain independent; the first purchase screen freezes both on in both arms. The full owned-card arbiter remains deferred.

## Verification and planned screen

Focused scenarios check exact off delegation, immutable observations, strict bounds, army distance, own blocked production, action-card queue, exhaustion/double counting, absent road routes, empty deck, high-hand non-trigger, ordinary draws/timing/VP scoring, winning city priority, remembered goals, changed-hand decisions and hidden-deck/opponent-card invariance. A natural match checks deterministic action/plan/state replay and gate-off parity.

The first training screen is frozen before execution: seeds 37/91, all seat rotations, three/four total players against frozen Standard, 2 workers/run, 2,500-action cap and 120-second watchdog. Compare purchase gate off/on with identical robber/Knight settings. These are reused training blocks; they cannot establish general strength. Report purchases and natural Knight use as coverage, not optimization targets. Fresh mixed/self-play cohorts, full owned-card comparison and worker/device measurements remain rollout gates.


## Initial fixed-profile results

Implementation/source identity: `1763d813f255e5ae5a535408a4beab2067ec1911`. All 101 bot tests passed (nine new purchase scenarios), as did source/documentation checks, build and eight package tests. An initial package check after restoring generated files failed on source/package byte mismatch; rebuilding the package resolved it. Existing PWA policy implementation/profile bytes are unchanged; no browser/device performance claim is made.

All **28/28 games ended**, with zero failures/caps/watchdogs. The audit reconstructed every actor decision from authorized views/fresh scoped memory and reproduced command, compressed plan, final-state and winner hashes. All 14 paired setup prefixes matched. Gate-off also exactly reproduced all 14 cases with the frozen robber-both policy, including action/plan/state/winner hashes.

| Purchase gate | Three-seat wins | Four-seat wins | Purchases | Knights played | Knights before roll | Army acquisitions |
| --- | --- | --- | --- | --- | --- | --- |
| Off | 2/6 | 5/8 | 0 | 0 | 0 | 0 |
| On | 3/6 | 3/8 | 21 | 16 | 15 | 3 |

The on arm also played one Road Building and one Monopoly, with four Knight hold decisions on two distinct turns. Neither arm naturally played Year of Plenty. These are focal-policy metrics, not all participants. More purchases and army awards establish natural execution coverage, **not** better purchasing decisions or strength. Results are mixed and the two seed blocks are too small for a promotion decision. The PWA remains unchanged.

Observed on-arm decision p95 was 72.3 ms (three seats) and 58.5 ms (four), maximum 144.0 ms in these concurrent Linux simulations. This excludes real PWA fresh-worker startup and is not an iPad budget guarantee. No parameters were adjusted after seeing results.

[Aggregate run summaries/profiles](../experiments/bots/results/development-investment-screen-v1.json) and [full decision/state replay metrics](../experiments/bots/results/development-investment-replay-v1.json) retain source/profile identities; no private raw traces are published. Audit source SHA is recorded in the replay artifact; the standalone audit and synthetic run outputs are local workspace artifacts.

Next: inspect purchase-versus-construction opportunity cost and actual card follow-through, then implement the separately gated common owned-card comparison. Retain existing prepared scenarios and distinguish natural card coverage from strength. Fresh held-out mixed/self-play and real-worker/device measurements remain required before app promotion. Case identities differ from the older robber screen, so compare on/off within this manifest rather than treating older screen wins as its control.

## Owner-authorized PWA playtest, 0.11.0

The owner requested app integration after reviewing the mixed training results. New Solo games selecting **Planner (experimental)** now pin `development-investment-0.1.0` and the exact `purchase-on` profile; this includes robber and Knight gates. It is a playtest, not a strength promotion or new calibrated difficulty. Standard/Easy and online policy selection remain unchanged. The generator copies the original pure policies with browser import-path rewriting only; no experiment controller or diagnostic goals are exposed in gameplay packets.

Existing `build-trade-0.2.0` Solo saves keep their original profile hash, memory and decision implementation. Both profiles and all policy dependencies are included in the verified offline package. Worker requests explicitly select a supported pinned policy, and memory validation remains scoped to that profile/game/seat/revision. Full Solo, failure/atomic-save and real generated worker tests cover the new implementation; a legacy real-worker parity/reuse check covers the old policy loader.

UI refinements in this release: a sole legal human robber victim is submitted automatically through the ordinary revision-checked command path; multiple victims still require a choice. Selects lose the outer focus ring but keep an inset keyboard focus cue. Score details remain available through player tiles and are removed from the sidebar. Foreground bot steps while an offer is pending wait a stable random 2–5 seconds per observed revision; polling cannot redraw the delay or advance early, and the wait uses scheduling rather than blocking client/storage locks. This pacing applies to both local and host-coordinated online UI bot steps; it does not alter headless simulations, rules or transport messages. There is no iOS background execution promise.
