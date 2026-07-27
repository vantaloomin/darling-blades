<!-- source-of-truth: docs/roadmap.md, docs/mobile-lan-plan.md, docs/architecture.md, docs/ai.md, src/engine/Game.ts, src/engine/types.ts, src/engine/actions.ts, src/engine/events.ts, src/engine/view.ts, src/meta/Replay.ts, src/meta/SaveManager.ts, src/scenes/DuelScene.ts · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Multiplayer trust decision and 1.9 implementation plan

## Goal

Release 1.8 ends with an explicit multiplayer trust-model decision backed by executable spikes. Release 1.9 then ships private invite codes or lobby URLs, two-seat matches, reconnect, and read-only spectating on that chosen foundation. The recommended architecture runs the existing seeded, deterministic `Game` on a thin authoritative relay and sends each participant only their redacted view, legal actions, and recipient-safe events. If that choice is approved, the roadmap's shorthand `P2P multiplayer` describes private player-to-player rooms, not peer-owned rules authority.

## Non-goals

The initial 1.9 release does not include ranked ladders, tournaments, public matchmaking, chat, trading, anti-bot guarantees, authoritative offline play, host migration, or match rewards. It does not claim that `PlayerView` alone makes full-state lockstep safe. It does not ship a naive commit-reveal shuffle that protects the opening order but leaks Foresee, Skim, fetch-and-shuffle, random discard, hand legality, or future draws. Competitive economy integration requires a separate threat model after private rooms work.

## Player-facing spec

Play gains `Online room`. A player chooses `Create room` or opens an invite link. The room shows both seats, selected deck names and formats, readiness, rules version, connection status, and a `Start` action for the room owner only after both decks validate. The invite surface says:

> Share this private link with the player you want to face. Anyone with the link may try to join until the room starts.

Neither player sees the other's deck list before the match unless both opt into an open-list setting. During play, the battlefield uses normal Darling Blades rules and words: Foresee remains private to its player, hands remain hidden, Severed cards stay public, and public marks and history match local play. Connection states say `Reconnecting`, `Opponent reconnecting`, `Match restored`, or `Match ended after disconnect`. A paused network match accepts no game actions.

The reconnect flow uses an opaque device/session credential automatically when possible and a `Rejoin` action from the room screen. The exact grace duration is shown before play only after it is measured and approved. When the grace expires, the remaining player may receive a win for the session record, but 1.9 grants no economy reward.

Spectators join through a separate room permission. They see both public battlefields, life, mana, stack, graveyards, Severed cards, public marks, and redacted history. Both hands remain card backs. They receive no game seed, deck order, private choice, or legal-action menu. Spectating is view-only and follows the delay policy selected in the open decisions.

## System touchpoints

### Engine

Keep `src/engine/Game.ts` as the single rules authority. Add a pure session wrapper, not network code, that accepts seat-checked `Action`, calls `legalActions`/`submit`, assigns monotonically increasing public sequence numbers, and projects results per recipient. A local duel can use the same wrapper in-process so protocol and local paths do not diverge.

Current `src/engine/events.ts` explicitly carries full information, including `drew.cardId` and `foresaw` card arrays. It is unsafe to serialize directly. Add pure redaction functions beside `src/engine/view.ts` or under `src/net/redaction.ts`:

```ts
projectPlayerSnapshot(state, seat): PlayerView;
projectSpectatorSnapshot(state): SpectatorView;
projectEvent(event, recipient, publicState): PublicGameEvent[];
```

A seat receives its own private draw/Foresee detail and only counts for the opponent's private actions. A spectator receives counts for both. Public zone transitions retain IDs. The exact event secrecy table is a checked-in protocol artifact and must cover every union member whenever `GameEvent` grows.

The recommended relay process owns full `GameState`, both submitted deck lists, RNG state, action validation, timers, and resumption snapshots. Clients render projected state and submit intent only. The seed remains server-private until an optional post-match audit package is approved.

### Meta, save, and economy

Add pure protocol message types under `src/net/protocol.ts` and a client `DuelSession` interface with local and remote implementations. Suggested message families are version negotiation, room state, seat assignment, match start, action request, action submission, projected event batch, redacted snapshot, acknowledgement, pause/resume, and terminal result. Every client message includes protocol version, room/match ID, seat credential where applicable, and expected sequence. Unknown fields do not bypass validation.

Room tokens, WebRTC/session secrets, auth tokens, and rejoin credentials are session or secure-platform data, never `SaveData`, save codes, replay codes, URLs after initial exchange, logs, or analytics. The server validates card IDs, deck legality, format, database stamp, and action legality. Ownership validation depends on the cloud-account decision; if unavailable, 1.9 private rooms are explicitly unranked and reward-free.

Economy hooks are disabled for remote v1 matches. A disconnect result may update a separate ephemeral room record, not local gold, packs, quests, achievements, tower progress, or collection. Replays are produced by the authority after completion and may be offered to both players only under the disclosure policy in `docs/plan-player-replays.md`.

### AI

Human remote seats have no brain. An optional room bot still receives only its seat's `PlayerView` and legal actions. Client code never asks an AI to reconstruct missing authoritative state. The deterministic engine and brains make server-side bot substitution technically possible, but takeover on disconnect is a later product decision and not a silent 1.9 fallback.

### UI scenes

Add `src/scenes/MultiplayerLobbyScene.ts` or an equivalent bounded room scene for create/join/readiness/errors/rejoin. `src/scenes/DuelScene.ts` consumes a `DuelSession` stream rather than accessing remote engine state. Local and replay sessions adapt to the same presentation interface incrementally. A spectator session omits all actionable controls and own-hand assumptions. Shared overlays coordinate reconnect, result, settings, card detail, and leave confirmation so a network status modal cannot allow clicks through it.

Mobile invite copy/paste, lobby URL handling, compact Duel, safe areas, and reconnect visuals use `docs/plan-mobile-overhaul.md`. Desktop/browser lifecycle adapters handle visibility, WebSocket/WebRTC, and credential storage outside pure layers.

### Tooling and invariants

Build an in-memory deterministic transport with configurable delay, drop, duplicate, reorder, disconnect, and reconnect before using real sockets. Add a protocol fuzzer with decoded-size/rate limits, seat spoofing, replayed action, stale sequence, illegal action, malformed deck, wrong database stamp, and spectator privilege cases. Golden tests assert local and relay-authoritative sessions produce the same terminal state and public event projection for the same seed/actions.

The engine stays Phaser/browser-free and seeded-deterministic. Clients receive only their `PlayerView`; spectators receive a stricter projection. Tests do not import Phaser. Save changes require version/migration/tests, though none are recommended. Balance gates only ratchet upward. Production operations must rate-limit room creation/join, avoid logging secrets or hidden card data, and expose protocol/build compatibility clearly.

## Save-schema impact

No SaveData field and no schema bump are required for the recommended private-room 1.9 scope. Room IDs, seat credentials, server revisions, and reconnect tokens are short-lived session data. Recent room links may be platform history only if they contain no live credential; the safer default is no persistence. Migration sketch: `none`.

`ReplayLog` may need a version bump for `context.mode: 'multiplayer'`, authority/build metadata, and both final deck snapshots. That is governed by `REPLAY_LOG_VERSION`, not `SaveData.version` unless the stored replay guard shape changes incompatibly.

If the user later approves ranked history or remote rewards, design a separate versioned field such as a server-signed match ledger. Do not add unsigned `wins`, rating, reward, or ownership claims to local SaveData and call them authoritative.

## AI and balance impact

Rules and win rates should be identical to local play. The core correctness gate is local/remote equivalence: feed the same valid action sequence and seed to in-process and authoritative-relay sessions, then compare full authority state, per-seat views, redacted event batches, replay log, and result.

Run existing AI gates after the session abstraction touches Duel/automation:

```text
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
```

No progression simulation is required while remote matches are reward-free. If rewards or ownership enforcement are proposed, the exploit impact is `TO MEASURE` with `npx tsx scripts/progression-sim.ts --seeds 8 --days 60` plus a new adversarial match-ledger simulator.

Protocol latency, bandwidth, reconnect success, server games per process, action-timeout distribution, and spectator fan-out are all `TO MEASURE` with a proposed `npx tsx scripts/net-sim.ts --matches <M> --spectators <S> --profile <P>`. The 4.61x craft-metagame speedup at 14 workers is unrelated to relay capacity.

## Phased implementation plan

### Wave 1: 1.8 trust-model spikes and decision

Implement the same short seeded match under four threat-model sketches: full-state lockstep, host authority, authoritative thin relay, and a written/prototyped commit-reveal sequence covering at least shuffle, draw, Foresee, random discard, fetch-and-shuffle, and reconnect. Capture exactly what each participant learns and can falsify. Verification: hidden-ID inspection, illegal-action attempts, disconnect matrix, protocol notes, full Vitest, build, lint, docs. End with a signed user decision; no 1.9 transport starts before it.

### Wave 2: protocol core and in-memory authority

For the selected model, add protocol schemas/versioning, DuelSession abstraction, per-recipient snapshots/events, sequence/ack/resnapshot, and a fake transport. Keep UI behind test fixtures. Verification: local/remote equivalence corpus, event secrecy table tests, fuzz/rate/size cases, delay/drop/reorder/disconnect simulation, replay round-trip, full Vitest, build, lint.

### Wave 3: invites, lobbies, and two-seat matches

Connect the approved signaling/relay backend, implement room lifecycle/readiness/deck validation/rejoin, and move Duel presentation onto remote sessions. Ship private unranked rooms first. Verification: two real browser/device clients, incompatible build/database cases, duplicate join/seat theft attempts, expired invite/rejoin, load/latency `TO MEASURE` report, avatar/floor gates, full Vitest, platform builds, lint, docs.

### Wave 4: spectating and operational hardening

Add spectator permission/delay, read-only presentation, fan-out snapshots, abuse limits, monitoring, deletion/retention policy, and rollout controls. Verification: adversarial hidden-information capture, spectator join-midgame/resync/disconnect, player plus multiple spectator load tests, secret/log audit, incident/rollback drill, full Vitest, builds, lint, docs, human UX pass.

## Open decisions for the user

- **Trust model by the 1.8 architecture freeze:** full-state lockstep/honor system, host-authoritative rooms, authoritative thin relay, or a research-grade cryptographic protocol. **Recommendation:** authoritative thin relay; it is the smallest honest way to preserve hidden information and validate actions.
- **Roadmap naming if relay wins:** keep `P2P` as product shorthand or rename the pillar `private multiplayer`. **Recommendation:** rename it `private multiplayer` in technical docs so transport authority is never misrepresented.
- **Identity:** account-required rooms, guest invite rooms, or both. **Recommendation:** guest private rooms first, with optional cloud account binding for rejoin; no rewards.
- **Deck ownership:** validate against cloud collection, allow any legal list, or use curated room decks. **Recommendation:** any legal list in unranked private rooms until cloud identity/ownership is authoritative.
- **Disconnect result:** pause then forfeit, immediate forfeit, or bot takeover. **Recommendation:** pause with a visible measured grace period, then session forfeit; no bot takeover in 1.9.
- **Spectator permission and delay:** host approval/live, both-player approval/live, or fixed delay. **Recommendation:** both-player approval and live state for private unranked rooms, while keeping delay possible in protocol.
- **Post-match audit:** publish seed and both decks, publish a signed replay only, or reveal nothing extra. **Recommendation:** signed replay to both players; reveal seed only after a security review confirms it exposes no reusable server secret.

## Risks and dependencies

The trust choice is architectural, not cosmetic:

| Model | Hidden information | Cheating surface | Disconnect story | Operational cost |
| --- | --- | --- | --- | --- |
| Full-state lockstep | Both peers need full state to simulate, so seed plus decks reveals order, hands, and choices. `PlayerView` only redacts output; it cannot hide state from the process running `Game`. | Either client can inspect hidden state, alter its simulation, stall, or submit selective messages. Hash agreement detects some divergence after the leak, not the leak itself. | Either peer loss pauses or ends the match. State migration cannot restore secrecy already lost. | Lowest backend cost, highest integrity compromise. |
| Host-authoritative peer | Guest can receive a redacted view, but host owns full guest deck/order/hand and engine state. | Host can inspect or alter everything; guest can still stall or attack protocol. Authority is asymmetric and cannot be described as fair. | Host loss ends the match unless a relay already mirrors full private state. Guest can reconnect to host while it remains. | Signaling/STUN/TURN plus asymmetric support burden. |
| Authoritative thin relay | Server alone holds full state; each seat and spectator receives a tested projection. | Server validates actions and prevents client state edits. Clients can still automate, collude, abuse timing, or attack accounts/service. Server/operator becomes trusted. | Server retains state for a bounded grace period and issues redacted resnapshots on rejoin. | Backend execution, storage-in-memory, monitoring, abuse, privacy, and availability cost. |
| Commit-reveal or verifiable hidden zones | A simple shared-seed commit reveals too much. Protecting draws while proving Foresee reorder, fetch shuffle, random discard, hand legality, and reconnect requires committed hidden zones, private proofs or card custody, and a full protocol research effort. | Can reduce trust in a server only if every hidden transition and abort is proven. Selective abort and denial remain. | Recovery needs committed state and key-share rules; a missing peer can make continuation impossible. | Highest research, implementation, audit, payload, and UX cost; not specified enough for 1.9. |

Cloud accounts/save sync in `docs/plan-save-portability.md` are a roadmap prerequisite for durable identity but should not make local SaveData authoritative on the server. Spectator projection and replay disclosure come from `docs/plan-player-replays.md`. Mobile lobby/Duel layouts come from `docs/plan-mobile-overhaul.md`. Darlings format and variant instances affect deck/session serialization. Core Set II changes protocol/database/replay versions if it lands concurrently. No multiplayer implementation should begin until the 1.8 user decision resolves the table above.

## Acceptance criteria

- The user records one trust model after Wave 1 evidence, and technical naming accurately states who owns full rules state.
- For every match fixture, local and selected-network-authority runs end in identical authority state, action log, and result for the same seed/actions.
- A client cannot submit for the other seat, replay a stale action, bypass legality, or advance while paused.
- Neither seat receives the other's hand/order/private Foresee details; spectators receive neither seat's private data, seed, decks, or legal actions.
- Raw full-information GameEvents never cross a network boundary without recipient projection.
- Disconnect/reconnect, expiry, duplicate join, incompatible build/database, and redacted resnapshot behavior are deterministic and tested.
- Remote v1 matches cannot grant or duplicate economy/progression state.
- Load, bandwidth, latency, timeout, and spectator fan-out `TO MEASURE` values are published and meet user-approved service budgets before release.
- Room credentials and hidden card data are absent from SaveData, share codes, URLs after exchange, logs, and analytics.

