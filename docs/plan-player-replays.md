<!-- source-of-truth: docs/roadmap.md, docs/architecture.md, docs/ai.md, src/meta/Replay.ts, src/meta/SaveManager.ts, src/engine/Game.ts, src/engine/view.ts, src/engine/types.ts, src/scenes/DuelScene.ts, src/scenes/ProfileScene.ts, src/ui/HistoryPanel.ts · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Player replay sharing and spectating hooks

## Goal

Release 1.6 turns the already-shipped deterministic replay viewer into a player-facing rewatch and share flow: browse the capped local replay list, watch with current controls, export a bounded replay code, and import a compatible code safely. Release 1.9 builds the redacted event and view contracts required for live spectating without treating a full reconstruction log as a safe network stream.

## Non-goals

Release 1.6 does not invent a second replay engine, guarantee old logs survive observable engine changes, upload codes to a public service, or conceal decklists from someone who imports a full post-match reconstruction. Release 1.9 does not send the game seed, deck order, either private hand, or legal action menu to a spectator. It does not imply that spectating transport exists without the trust-model decision in `docs/plan-multiplayer.md`.

## Player-facing spec

Profile already stores and opens recent replays, and Duel already provides watch, play/pause, step, speed controls, and exit. The 1.6 product slice makes that capability discoverable and adds `Share code` plus `Import replay`.

Each replay row shows opponent or mode label, result, turns, date, and compatibility. An incompatible row says `This replay was made with an older game version` and offers delete, not a broken Watch action. Sharing warns:

> Anyone with this replay code can see both decks and every play in this completed match.

Import previews the two deck names when available, mode, result, turns, end date, replay version, and database compatibility before appending it to the existing capped list. Invalid, oversized, corrupt, or incompatible codes never enter the list. The code prefix is `DBR1`, distinct from save code `DBS1`.

During playback, hidden cards may be revealed because this is a completed-match reconstruction and the warning is explicit. The viewer must still avoid showing future actions before their timeline point. In 1.9, a live spectator sees both public battlefields, life, mana, stack, graveyards, Severed public cards, public marks, and public history. Both hands remain card backs and no future deck information appears. On disconnect, the spectator can retry or leave without affecting the match.

## System touchpoints

### Engine

`src/meta/Replay.ts` remains the reconstruction authority: a versioned `ReplayLog`, database stamp, seed, both decks, ordered actions, context, and result. `src/engine/Game.ts` replays actions through the same legality and resolution path. `canReplay` continues to fail closed on replay-version or database-stamp drift. Any observable engine-code change that invalidates old action logs bumps `REPLAY_LOG_VERSION`; it is not papered over by trusting stored results.

Live spectating uses a different contract. Current full engine events can contain hidden identifiers, including drawn card IDs and Foresee card IDs. Add a pure per-recipient projection that derives `SpectatorView` from game state and redacts every `GameEvent` before transport. The spectator view is stricter than either seat's `PlayerView`: both hands and ordered decks are hidden, and no legal-action set is present. A public sequence number and state digest support gap detection without revealing the seed.

### Meta, save, and economy

Add pure `src/meta/ReplayCode.ts` for bounded canonical serialization, compression, checksum, structured errors, preview, and `canReplay` validation. It may share low-level envelope helpers with `src/meta/SaveCode.ts` but has a separate magic prefix and limits. Import appends through the existing replay helper and respects `REPLAY_CAP = 10`; eviction behavior must be visible before import if a saved replay would be displaced.

Replays and spectators grant no rewards. A replay cannot call match-completion economy hooks, quests, achievements, tower advancement, or record updates. Spectator state is session data, not save data.

### AI

Playback invokes recorded actions, not a newly chosen AI line. If the replay viewer reconstructs an AI turn, it still never feeds full hidden state into a live brain. Spectator projections share redaction tests with `PlayerView` but are not an AI input. Coach v2 in `docs/plan-suggested-decks.md` reconstructs internally, then evaluates only the selected seat's historical `PlayerView` and legal actions.

### UI scenes

`src/scenes/ProfileScene.ts` owns replay list discoverability, compatibility labels, import, share, and cap management. `src/scenes/DuelScene.ts` keeps the existing viewer controls and must present replay mode without firing normal completion side effects. Shared modals handle long code copy/paste and clipboard fallback. Live spectators use Duel presentation through a read-only session adapter; interactive hand, phase, target, and concession controls are absent rather than merely disabled.

### Tooling and invariants

Golden replay fixtures cover current version, wrong database stamp, corrupt code, truncated actions, illegal action, future version, size cap, and cap eviction. Determinism tests compare reconstructed terminal state and result. Adversarial spectator tests seed distinctive card IDs into each hidden zone and assert they appear nowhere in serialized view/events. Engine/meta purity, no Phaser in tests, seeded determinism, PlayerView redaction, and ratchet-only balance gates remain mandatory.

## Save-schema impact

No SaveData bump is required for 1.6 if imported logs use the existing `replays: ReplayLog[]` field and current cap. The replay envelope is external:

```ts
interface ReplayCodeEnvelope {
  magic: 'DBR1';
  codec: 'deflate-json-v1';
  replayVersion: number;
  dbStamp: string;
  checksum: string;
  payload: string;
}
```

Encoded and decoded caps are `TO MEASURE` with a proposed `npx tsx scripts/measure-replay-code.ts --fixtures all`; publish percentiles for short, typical, turn-cap, and decision-heavy logs before fixing limits.

Adding new context metadata, variant-instance fields, or event semantics may require `REPLAY_LOG_VERSION` to move from 2 to the next version. That is a replay-log version, not automatically a SaveData version. `SaveManager` already validates replay entries and discards malformed ones; update its replay type guard and tests when the replay schema changes. Live spectator sequence/digest state is not persisted, so migration is `none`.

## AI and balance impact

Rewatch/share is balance-neutral. Its gate is deterministic reproduction across a corpus of modes, decisions, and terminal outcomes. For each fixture, reconstructing twice must produce the same public timeline and terminal state, and replay-mode completion must produce zero save/economy changes.

No progression simulator or metagame sweep is required unless replay/spectator completion can reach rewards, which is a defect. The avatar and floor matrices are prudent after a replay-version engine refactor:

```text
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
```

Spectator bandwidth, recovery time, and code sizes are `TO MEASURE` with protocol/replay fixture tools. The metagame sweep's measured 4.61x speedup is unrelated.

## Phased implementation plan

### Wave 1: replay contract hardening

Inventory current ReplayLog fields and every completion side effect, add canonical code helpers, size measurements, preview, corruption cases, and deterministic fixture coverage. Verification: focused Replay/SaveManager tests, golden reconstruction corpus, full Vitest, build, lint, docs.

### Wave 2: 1.6 share product slice

Add list labels, compatibility states, export/import, warning, cap eviction, and clipboard fallback around the existing viewer. Verification: UI model tests, import round-trip, incompatible build case, no-reward assertion, full Vitest, build, lint, and manual desktop/mobile-landscape copy/paste checks.

### Wave 3: spectator redaction spike

Define `SpectatorView`, enumerate event secrecy, implement per-recipient event projection, sequence numbers, public digest, and state snapshot recovery using an in-memory transport. Do not add network code yet. Verification: adversarial hidden-ID leak suite, property test that spectator output is a projection of public state, dropped/duplicated/reordered message tests, full Vitest, build, lint.

### Wave 4: 1.9 session integration

Connect the redacted projection to the transport selected in `docs/plan-multiplayer.md`, add read-only Duel presentation and reconnect/leave flow, and measure bandwidth/latency. Verification: two-player plus spectator integration, forced disconnect/resnapshot, malicious-client payload inspection, platform builds, full Vitest, lint, docs, and manual usability pass.

## Open decisions for the user

- **Replay code disclosure:** reveal both complete decklists after a match, or omit sharing until selective disclosure exists. **Recommendation:** reveal both with the explicit warning; full deterministic reconstruction already requires them.
- **Import cap behavior:** evict the oldest replay automatically, ask first, or reject when full. **Recommendation:** preview the oldest eviction and ask in the same import confirmation.
- **Compatibility policy:** fail closed on any database stamp change, or attempt best-effort playback when referenced cards are unchanged. **Recommendation:** keep current fail-closed behavior; selective compatibility is a future content-hash spike.
- **Spectator delay:** live public state, fixed delay, or host choice. **Recommendation:** live for private unranked rooms; retain protocol support for delay before competitive modes.
- **Spectator chat/reactions:** include in 1.9 or keep view-only. **Recommendation:** view-only for the first release to avoid moderation and persistence scope.

## Risks and dependencies

A share code necessarily discloses both decks and the action history needed to replay them. Engine/database drift can invalidate old logs, and compressed hostile inputs need strict caps. The greatest live risk is reusing full ReplayLog or raw GameEvent payloads for spectators and leaking draws, Foresee results, ordered decks, or legal choices. Code framing and optional save inclusion depend on `docs/plan-save-portability.md`. Variant identity depends on `docs/plan-variant-decks.md`. Darlings and Story add replay contexts through `docs/plan-darlings.md` and `docs/plan-story-mode.md`. Coach annotations depend on this reconstruction contract. Live transport, disconnect authority, and trust depend on `docs/plan-multiplayer.md`.

## Acceptance criteria

- Existing compatible local replays remain watchable through the current control set; incompatible logs fail closed with a clear reason.
- A compatible replay code round-trips to the same log and terminal reconstruction, and invalid/oversized codes never enter SaveData.
- Import respects the cap and obtains confirmation before displacing a replay.
- Replay playback and spectator sessions cannot award gold, packs, quests, achievements, tower progress, or records.
- Encoded limits are backed by published `TO MEASURE` fixture results.
- Spectator payloads contain neither hand/deck identities, game seed/order, private decisions, nor legal action menus for either seat.
- Dropped or reordered spectator messages recover through sequence detection and a redacted snapshot.
- Network integration uses only the transport and disconnect policy approved in `docs/plan-multiplayer.md`.
