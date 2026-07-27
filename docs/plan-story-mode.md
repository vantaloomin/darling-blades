<!-- source-of-truth: docs/roadmap.md, docs/plan-expansion-slate.md, docs/architecture.md, docs/rules.md, src/meta/SaveManager.ts, src/meta/Replay.ts, src/meta/services.ts, src/scenes/MainMenuScene.ts, src/scenes/DuelScene.ts, src/data/tutorial.ts, src/data/catalog.ts, src/data/opponents.ts, scripts/balance-matrix.ts, scripts/progression-sim.ts · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Story Mode implementation plan

## Goal

Release 1.7 ships a data-driven Story Mode that combines authored scenes, deterministic duels, progression-gated chapter selection, and exactly-once rewards. Expansion 8 may carry the campaign theme, but its setting and plot remain a user decision. The implementation must let writers add or reorder content without putting narrative branches into `DuelScene` or weakening replay, save, AI, and economy invariants.

## Non-goals

Release 1.7 does not add a general visual-novel engine, arbitrary scripting, mid-duel saves, procedurally generated prose, unbounded branching, voice acting, or a second combat ruleset. It does not let story data execute code, grant rewards outside an idempotent meta service, or make campaign cards silently legal in the player's collection before they are awarded.

## Player-facing spec

The main menu gains `Story`. Opening it shows a chapter map with completed, available, and locked nodes. A node preview names the chapter, gives a short premise, shows whether it contains a duel, identifies any required deck rule, and lists its first-clear reward without spoiling later scenes.

Scenes present a speaker name, portrait or background, and short blocks of text with `Continue`, `Backlog`, `Skip scene`, and `Auto` controls if approved below. Player choices may select flavor lines or one of a small authored branches, but no choice can secretly alter combat rules. All visible choices state their immediate consequence when it affects a duel or reward.

A story duel uses the ordinary battlefield and Darling Blades vocabulary. The player sees any special setup before queueing, for example:

> Hold the bridge for six turns. Cards sent to Sever still count as gone.

> Win with the supplied deck. Your collection will not be changed.

On victory, the results screen advances the chapter and previews the next node. A first-clear reward is labeled `First clear`; replaying the node can be reward-free. Losing returns to the node with `Try again`, `Change deck`, and `Leave story`. If the story uses a supplied deck, the result never saves it into the collection unless the reward explicitly does so.

## System touchpoints

### Engine

Use the existing `Game` constructor and action pipeline. Story setup is compiled into ordinary deck lists, seed derivation, player/AI choice, and a narrow pure objective descriptor evaluated from public engine events. Avoid tutorial-only branching inside `Game`. If a node needs a new objective such as survive N turns, implement a pure observer under `src/meta/story/StoryObjective.ts`; it must not mutate rules state or read opponent secrets beyond what the objective is entitled to know.

Any true set mechanic for Expansion 8 follows engine-first discipline in its own set specification: rules contract, `src/engine/types.ts` union change if required, interpreter/ordering tests, PlayerView redaction, AI support, data, then scenes. Seeded determinism and replay compatibility remain mandatory.

### Meta, save, and economy

Add pure definitions under `src/data/story/`, or one `src/data/story.ts` while the campaign is small:

```ts
interface StoryCampaign {
  id: string;
  version: number;
  title: string;
  startNodeId: string;
  nodes: StoryNode[];
}

interface StoryNode {
  id: string;
  prerequisiteIds: string[];
  scenes: StorySceneBlock[];
  duel: StoryDuelSpec | null;
  firstClearReward: StoryReward[];
  nextNodeIds: string[];
}
```

`src/meta/story/StoryProgress.ts` validates the directed graph, computes availability, and applies completion plus rewards atomically. Reward operations call existing economy/collection services and record the claim in the same save transaction. A node ID is a permanent data key; changing display text never changes progress. Removing or renaming a shipped node requires an explicit campaign migration map.

### AI

Each story duel selects an existing difficulty/personality or a data-authored public profile. The brain still reads only `PlayerView`. Supplied opponent deck, objective, and scripted opening configuration are game setup, not information the AI may inspect mid-turn. If a narrative duel requires deliberate suboptimal behavior, create a tested personality/constraint with a player-visible rationale rather than script hidden actions.

### UI scenes

Add `src/scenes/StoryScene.ts` for map and dialogue, with pure layout/state helpers separated from Phaser. `src/scenes/MainMenuScene.ts` adds entry and progress summary. `src/scenes/DuelScene.ts` accepts a narrow story launch context such as `{ campaignId, nodeId }`, resolves it through meta before constructing the game, and returns a typed result. Do not grow the tutorial flag set into a story scripting API. Existing scene header/footer, modal, text, portrait, animation-policy, and save-service primitives remain the owners of shared behavior.

### Tooling and invariants

Add `scripts/check-story.ts` or extend the docs/data checker to reject duplicate IDs, missing links, unreachable nodes, cycles where forbidden, missing card/opponent IDs, invalid deck lists, empty localized strings, and rewards with unknown IDs. Add deterministic node tests, exactly-once reward tests, all-path graph tests, replay tests, and scene text overflow fixtures. No narrative JSON can contain executable code. Engine/meta/data remain Phaser/browser-free, AI reads only `PlayerView`, tests do not import Phaser, save changes migrate stepwise, and balance floors only ratchet.

## Save-schema impact

Add exactly this top-level field in the next available SaveData version:

```ts
story: {
  campaignVersion: 1;
  completedNodeIds: string[];
  claimedRewardNodeIds: string[];
  seenSceneIds: string[];
};
```

A version bump is required. Migration initializes the three arrays empty and `campaignVersion: 1`. Normalization deduplicates strings, drops unknown/malformed values only according to an explicit shipped-content policy, and never infers a claimed reward merely from completion. On load, a repair pass may offer an unclaimed reward for a completed node; it must not auto-claim silently if collection capacity or future reward choices exist.

No active node, dialogue cursor, or in-progress duel is saved in 1.7. Leaving dialogue restarts that scene or resumes at node-level granularity; entering a duel creates a replayable match but not a resumable engine snapshot. If branch choices affect future content, add `choices: Record<string, string>` before the first campaign ships and bump once; do not overload `seenSceneIds`.

`ReplayContext` should add a `story` mode plus stable `campaignId` and `nodeId` metadata if story replays are retained. That may bump `REPLAY_LOG_VERSION`, not automatically SaveData.version beyond the story field bump.

## AI and balance impact

Every story duel needs a clear intended experience band rather than one universal 50% target. First measure supplied-deck nodes independently from collection-deck nodes. Outcomes are `TO MEASURE` with a new matrix mode:

```text
npx tsx scripts/balance-matrix.ts --story --seeds <N>
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
npx tsx scripts/progression-sim.ts --seeds 8 --days 60
```

Choose `<N>` and per-node bands only after the campaign graph, decks, difficulty options, and retry policy exist. Report wins, draws, turn length, objective completion, matchup/player-start split, and any impossible seed. Story rewards must be added to the canonical progression scenario and remeasured before lock. Run the informational metagame sweep after Expansion 8 cards join the pool; the measured 4.61x speedup at 14 workers shortens the run but supplies no result in advance.

## Phased implementation plan

### Wave 1: schema, graph, and one vertical node

Build the pure data schema, graph validator, StoryProgress service, migration, and one no-reward dialogue-plus-duel fixture using existing cards. Verification: graph/property tests, completion/reload tests, deterministic duel/replay test, SaveManager migration tests, full Vitest, build, lint, docs.

### Wave 2: map and dialogue shell

Add menu entry, chapter map, node preview, dialogue/backlog/skip behavior, text-scale reflow, and typed launch/result routing. This independently ships a reusable content shell behind a feature flag. Verification: UI state tests, all input methods, production build, full Vitest, lint, pseudo-long-text fixtures, desktop and mobile-landscape manual pass.

### Wave 3: campaign and rewards

Author the approved campaign with Expansion 8, first-clear rewards, difficulty policy, replay metadata, and check-story coverage. Verification: every path reachable, every node/deck ID valid, reward idempotency, story matrix with published seed count/bands, progression simulation, avatar/floor gates, replay round-trip, full Vitest, build, lint, docs.

### Wave 4: content and release QA

Run editorial, accessibility, localization-decision, spoiler, and full playthrough passes; freeze IDs; remove feature flag. Verification: fresh-save and migrated-save end-to-end runs, loss/retry/skip/replay/import cases, all supported layout profiles, full ladder, and documented human narrative review.

## Open decisions for the user

- **Campaign premise and Expansion 8 theme:** bind the story to Expansion 8, use the existing world as a crossover, or keep the first campaign set-neutral. **Recommendation:** bind it to Expansion 8 so art, opponents, rewards, and narrative share one production budget.
- **Structure:** linear chapters, a small branching map, or persistent consequence branches. **Recommendation:** a small branching map whose branches reconverge; it proves the graph without multiplying content and QA.
- **Deck policy:** player collection decks, supplied story decks, or node-by-node mix. **Recommendation:** a mix, clearly labeled, with supplied decks for teaching story mechanics and player decks for ownership fantasy.
- **Difficulty:** one authored level, selectable Easy/Normal/Hard, or dynamic adjustment. **Recommendation:** selectable levels with identical rewards; avoid opaque dynamic adjustment.
- **Dialogue controls:** manual only, or add backlog, skip-seen, and auto. **Recommendation:** backlog and skip-seen at launch; add auto only after text timing and accessibility review.
- **Replay policy:** store all completed story duels, wins only, or none. **Recommendation:** wins and losses through the existing cap, tagged with stable node metadata.
- **Reward scale:** cosmetic-first, cards/packs, or substantial gold progression. **Recommendation:** cosmetic-first plus modest explicit card/pack rewards, then validate the exact package in progression simulation.

## Risks and dependencies

Story content can overwhelm engineering QA, hardcoded strings can make the localization decision expensive, and reward retries can duplicate economy. Shipped node IDs become save compatibility keys. Scripted behavior can also tempt hidden-state AI violations or one-off DuelScene branches. This plan depends on the localization choice in `docs/plan-accessibility-i18n.md`, the 1.6 replay contract in `docs/plan-player-replays.md`, and mobile dialogue layouts in `docs/plan-mobile-overhaul.md`. Expansion 8 follows `docs/plan-expansion-slate.md` and needs its own engine-first card design. Save export/cloud in `docs/plan-save-portability.md` must carry story state. Core Set II is not a prerequisite.

## Acceptance criteria

- The campaign graph has unique stable IDs, no unintended unreachable nodes, valid links, and no executable content.
- A node launches the same setup and produces the same replay for the same seed and action sequence.
- Completion and first-clear reward apply atomically and at most once across reload, retry, replay, import, and crash-recovery tests.
- Every story duel uses the ordinary Game and redacted `PlayerView`; there is no story-only hidden-state branch.
- Old saves migrate with empty story progress and no change to existing economy or records.
- All campaign paths, supplied/player deck rules, difficulty options, and skip/backlog behavior are test-covered.
- Story matrix and progression `TO MEASURE` placeholders are replaced with dated results before release.
- Player-facing text passes editorial, no-em-dash, text-scale, supported-layout, and chosen localization-scope review.
