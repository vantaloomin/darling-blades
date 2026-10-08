<!-- source-of-truth: docs/roadmap.md, docs/plan-road-to-2.0.md, docs/plan-core-set-2.md, docs/plan-darlings.md, docs/architecture.md, docs/rules.md, src/engine/Game.ts, src/engine/view.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, src/meta/services.ts, src/meta/Limited.ts, src/meta/gauntletSeed.ts, src/scenes/MainMenuScene.ts, src/scenes/DuelScene.ts, src/data/opponents.ts, src/data/cards/tk-shu.ts, src/data/cards/greek.ts, src/data/cards/beastkin.ts, scripts/balance-matrix.ts, scripts/progression-sim.ts · last-verified: 2026-09-29 · design/plan doc - re-verify when the referenced code changes -->

# Story Mode plan (2.0)

**Status: direction ruled 2026-09-29, no code.** Story Mode is a roguelite run with a story spine, shipping in 2.0 with Core Set II. This rewrite replaces the 2026-07-26 plan, which targeted 1.7 and "Expansion 8". Its engineering skeleton is kept: the node graph and validator, StoryProgress, exactly-once rewards, story duels on the ordinary `Game`, check-story tooling and one save field. None of it exists in code: there is no `src/meta/story/`, `src/data/story/`, `StoryScene` or `scripts/check-story.ts`. Everything below is planned.

How to read this doc: the **Owner rulings** section is the only ruled part. Items marked **Recommended (the planning session's proposal)** came from the 2026-09-29 Story Mode planning session and wait on the owner. The engineering sections are this plan's own and may change until the waves start.

## Goal

2.0 ships a replayable Story Mode: pick a character, fight through a seeded run of duels, keep a few cards from it, with short authored scenes carrying a story through the run. It is 2.0's headline feature and the mode the itch.io launch advertises (the itch launch moved to a 2.0.x on 2026-10-08, [plan-2.0.md](plan-2.0.md) P2; 2.0 itself ships Act 1 plus an endless run, the owner's 2026-10-08 order). Content (acts, maps, events, scenes, rewards) is data, so it can be added or reordered without narrative branches in `DuelScene` and without weakening replay, save, AI or economy invariants.

## Non-goals

No general visual-novel engine, arbitrary scripting, or story data that runs code. No mid-duel saves or resumable engine snapshots. No procedurally generated prose. No second combat ruleset: story duels are ordinary games. No rewards outside the idempotent StoryProgress service, and no run card becomes legal in the collection before it is awarded.

Voice is **not** a non-goal. It is TBD (R7) and listed under open decisions.

## Owner rulings, 2026-09-29

All ten were given in the Story Mode planning conversation on 2026-09-29 and are quoted verbatim; R9 and R10 came later that day and closed two open decisions. The owner framed Story Mode as 2.0's "major marquee feature", the patch "where we will start advertising the game and get it on itchio, advertises on reddit". The options the owner raised were a "Story Lite" roguelite ("a fancy Draft Mode, where you get to keep a certain number of cards", "re-using things like the Avatar Gauntlet as levels") and a "true Story Mode" visual novel with "ElevenLabs or other TTS".

- **R1. Direction.** Question: the roguelite, the visual novel, or the planning session's recommended roguelite with a story spine?
  > "Rogue-lite with a story spine makes sense to me."
- **R2. Starters.** Question: what does a run start from?
  > "And like Slay the Spire, we should pick 1 Olympian, 1 Beastkin, and 1 Three Kingdom card as our Starter."

  The planning session read this as a character select (pick one of three) and said so; the owner then named three characters (R3), which confirms that reading.
- **R3. Characters.** Question: which three?
  > "Choice 1: Guan Yu, Saint of War / Choice 2: Persephone, Queen of Two Courts / Choice 3: Kitsune Matriarch Yohime"

  Cards: `tk-shu-guanyu` (W/R), `gk-persephone` (B/G), `bk-kitsune-matriarch` (U/G). **Choice 3 is superseded by R8(c).**
- **R4. Unlock chain.** Question: are all three open at the start, or unlocked by play?
  > "Start with Guan Yu -> Guan Yu win OR 3 runs = Persephone -> Persephone Win OR 3 runs = Yohime."

  After R8(c), the third step unlocks the new Core Set II Beastkin legend, not Yohime.
- **R5. Opening boon.** Question: "after picking a character, do you get one of three small boons, like Neow in Slay the Spire?"
  > "Yes"
- **R6. Kept cards.** Question: how many cards does a run keep? The planning session suggested "1 per act cleared".
  > "1 per act cleared ++ the ability to "buy a permanent card" from shops for a large amount of currency?"

  "1 per act cleared" is the planning session's suggestion, accepted; the shop buy is the owner's addition.
- **R7. Voice.** Question: voice never, trailer only, or optional later?
  > "TBD on voice."
- **R8. Run counting, shop currency, third character.**
  - (a) Question: what counts as a run for R4's "3 runs"? The planning session proposed "count a run only when it ends in a win or a loss; abandoned runs don't count."
    > "Agreed, maybe at least 3 "fights" counts as a run."

    The three-fight minimum was tentative here ("maybe"). **R9 settles it** and replaces the "abandoned runs don't count" half of this answer.
  - (b) Question: does the permanent buy cost run gold or meta gold?
    > "Run gold, yes."

    Only the currency is ruled. Limits and price are open.
  - (c) Question, the owner's: "Is there another legendary Beastkin anthem/lord that might fit instead of Yohime?" The planning session offered Yohime, Wolfqueen Lupa, or option 3, a new Core Set II Beastkin legend built for the slot.
    > "Option 3 sounds good."

    This supersedes R3's Choice 3, and R4's chain applies to that slot. Blue and an anthem were part of the option-3 description the owner accepted; the colour pair, tribe and name are open. What happens if Core Set II slips was not addressed.
- **R9. Run counting.** Question: (a) abandoned runs never count, and a run also needs at least 3 fights; (b) any run with at least 3 fights counts, even if abandoned after that; or (c) something else?
  > "1 - B"

  A run counts toward an unlock once it has had at least three fights, whether it then ends in a win, a loss or an abandon. This supersedes R8(a)'s "abandoned runs don't count" and its "maybe".
- **R10. Whose runs count.** Question: to unlock Persephone, do you need 3 runs as Guan Yu, or any 3 runs?
  > "2 - Runs with the previous character sequentially."

  Each unlock counts only runs with the character just before it in the chain: Persephone needs 3 counted Guan Yu runs, and the Beastkin legend 3 counted Persephone runs.

## Player-facing spec

**Character select (R2, R3, R4, R8, R9, R10).** Three characters: Guan Yu, Saint of War (Three Kingdoms), Persephone, Queen of Two Courts (Olympian), and a new Core Set II Beastkin legend. Guan Yu is open at the start. Persephone unlocks on a Guan Yu win or 3 counted Guan Yu runs; the Beastkin legend unlocks on a Persephone win or 3 counted Persephone runs (R10). A run counts once it has had at least three fights, however it then ends: win, loss or abandon (R9). For scale, today's cards: Guan Yu is {W}{R}{R}, a 5/4 with First Blade and Sentinel (UR); Persephone is {2}{B}{G}, a 3/3 with Deathblade that leaves two Bloom tokens when she dies (SSR).

**Opening boon (R5).** After picking a character the player chooses one of three small boons. Player copy calls it an opening boon; Slay the Spire's "Neow" is a design reference only and never appears in the game.

**The run.** The shape is Recommended (the planning session's proposal), listed below: three acts of mapped nodes, each ending on an avatar boss. Duels use the ordinary battlefield and vocabulary, and any special setup is shown before the duel starts.

**Keeping cards (R6, R8b).** Clearing an act keeps one card to the collection. Shops can also sell a card as a permanent collection card for a large amount of run gold; the limits and price are open. A run card that is not kept never reaches the collection.

**The story spine.** Scenes show a speaker name, a portrait or background, and short text blocks with Continue, Backlog and Skip. A choice that affects a duel or a reward states its effect. Where scenes go is Recommended (the planning session's proposal), below. No scene text is written: every line is a placeholder until the owner approves the premise and the copy.

## Recommended (the planning session's proposals)

None of these is a ruling. Each waits on the owner.

- **Run structure.** Recommended (the planning session's proposal): 3 acts, a map of fight / elite / event / shop / rest nodes, an avatar boss per act; short text scenes at act starts, boss intro and defeat lines, events as vignettes.
- **Character shape.** Recommended (the planning session's proposal): each character is her Darling in the Darlings command zone, a fixed starter deck of about 15 to 20 cards in her colours, and a Warchest land reserve; card rewards weighted to her faction plus a small neutral pool.
- **The new Beastkin legend.** Recommended (the planning session's proposal): a blue-inclusive pair (U/W, U/B or U/R) so all five colours stay covered, a Beastkin tribal anthem, built to lead from the command zone, not a Gauntlet boss.
- **Fallback.** Recommended (the planning session's proposal): Yohime as-is if Core Set II slips. The owner accepted option 3 without addressing it.
- **Permanent shop buy.** Recommended (the planning session's proposal): one per shop, only cards that shop offers, premium price; measured in progression-sim together with keep-1-per-act.
- **Yohime and the Tower.** Recommended (the planning session's proposal): Yohime is also Gauntlet rung 7 (`yohime` in `src/data/opponents.ts`); if she is used, she should not also be a Story boss.
- **Per-character tuning.** Recommended (the planning session's proposal): each starter deck tuned so act-1 win rates land in a band, measured per character with the balance harness (Guan Yu is a 3-mana 5/4; Yohime costs 6).
- **Scope lever.** Recommended (the planning session's proposal): if 2.0 is overloaded, ship 1 act plus an endless or daily-seed run, and add acts in 2.0.x.
- **Voice.** Recommended (the planning session's proposal; the owner has not ruled): no AI voice at launch; trailer-only, or optional in 2.x. Reasons given: subreddit hostility to AI voice and art, itch's AI-content disclosure, itch's 1,000-file cap (voice would need packing like art), and ElevenLabs' commercial licensing. ElevenLabs is only the owner's example of TTS; no vendor decision exists.
- **Premise.** Recommended (the planning session's proposal): Core Set II's world is implied by R2 and R3; the premise itself (why the three fight through the acts) is open. One idea floated: the Tower as the place, the avatars as its floors.

## System touchpoints

### Engine

No engine change is planned. A story duel compiles to an ordinary `GameConfig` (`src/engine/Game.ts`): two deck lists, a seed, and for the command-zone shape the existing `format`, `landReserves` and `darlings` fields the Darlings format already uses. The engine enforces no deck size, so a short run deck needs no rules change. Special node rules, if any, are a pure observer under `src/meta/story/` over public engine events and never mutate rules state. Any Core Set II mechanic follows that set's engine-first plan.

### Meta, save, and economy

Pure definitions under `src/data/story/` (planned):

```ts
interface StoryCharacter { id: string; darlingId: string; starterDeck: string[]; landReserve: string[]; rewardPool: string[]; unlock: UnlockRule | null }
interface StoryAct { id: string; mapTemplate: MapTemplate; bossAvatarId: string; scenes: StorySceneBlock[] }
interface StoryNode { id: string; kind: 'fight' | 'elite' | 'event' | 'shop' | 'rest' | 'boss'; nextNodeIds: string[] }
```

`src/meta/story/StoryProgress.ts` (planned) keeps the old plan's role: it validates graphs, computes what is available, and applies completions and rewards atomically through the existing economy and collection services behind the `Services` singleton (`src/meta/services.ts`). The validator now runs on every generated act map (every node reachable, every path ends at the boss) as well as on authored scene graphs. A run's maps derive from one run seed, the way `src/meta/gauntletSeed.ts` derives each Tower rung's seed today, so the same seed gives the same run.

**Exactly-once rewards.** Each keep (one per act) and each permanent buy has a stable reward key (run id plus act or shop node), recorded in the same save transaction that grants the card. Reload, retry, crash and import never grant it twice. The run deck is run-scoped and never touches the collection.

**Run state.** Unlike the old plan, which saved no in-progress state, a roguelite run must survive a reload. The precedent is Limited's `activeRun` (`src/meta/Limited.ts`), which keeps a draft run in the save between matches. Run state saves at node boundaries, never mid-duel.

### AI

Story duels pick an existing avatar or difficulty. Brains read only the redacted `PlayerView` (`src/engine/view.ts`, which already carries the public `darlingZone`). Opponent decks and node rules are game setup, not information the AI inspects mid-turn. A duel that needs weaker play uses a tested difficulty or personality, never scripted hidden actions.

### UI scenes

`src/scenes/StoryScene.ts` (planned) owns character select, the boon choice, the map, shops, events and the dialogue shell, with pure layout and state helpers kept out of Phaser. `MainMenuScene` gains a Story entry. `DuelScene` accepts a narrow launch context such as `{ runId, nodeId }`, resolved through meta before the game is built, and returns a typed result. The tutorial flag set does not grow into a story scripting API. Recommended (this plan's, not the planning session's): locked characters show their unlock condition on character select.

### Tooling and invariants

`scripts/check-story.ts` (planned) rejects duplicate IDs, missing links, unreachable nodes, unknown card, avatar or reward IDs, invalid starter decks and empty strings. Tests cover graph validation over many seeds, deterministic run generation, exactly-once rewards across reload and retry, run counting, unlocks, replay, and scene text overflow. Engine, meta and data stay Phaser-free, tests do not import Phaser, and gates only ratchet up.

## Save-schema impact

One top-level field, added in the next free `SaveData` version when wave 1 lands (`CURRENT_SAVE_VERSION` is 36 on `release/1.9`; v36 was 1.9's one bump):

```ts
story: {
  contentVersion: 1;
  activeRun: StoryRun | null;           // seed, character, boon, act, node, run deck, run gold, fights played
  unlockedCharacterIds: string[];       // starts with Guan Yu's story character
  countedRuns: Record<string, number>;  // per character: runs that reached 3 fights, counted once each (R9); an unlock reads only its predecessor's count (R10)
  wins: Record<string, number>;         // per character
  claimedRewardKeys: string[];          // exactly-once keeps and buys
  seenSceneIds: string[];
};
```

The bump needs a real `migrate()` and a migration test. Migration starts every save with only the first character unlocked, empty counts and no active run. Normalization deduplicates strings and never infers a claim from a completion. `activeRun` records fights played so the open run-count threshold can apply without another bump.

`ReplayContext.mode` is `'practice' | 'gauntlet' | 'limited'` today (`src/meta/Replay.ts`); story duels add `'story'` with run and node metadata, which may bump `REPLAY_LOG_VERSION` (16 today) but not `SaveData.version` beyond the story bump. Save codes and save cards must carry the new field ([plan-save-portability.md](plan-save-portability.md)).

## AI and balance impact

Every outcome is `TO MEASURE`. `scripts/balance-matrix.ts` has no story mode today; wave 3 adds one (planned) that plays whole seeded runs per character and reports act-by-act survival, boss win rates, turn length and any impossible seed. Keeps and permanent buys go into the canonical progression scenario before lock.

```text
npx tsx scripts/balance-matrix.ts --story --seeds <N>   # planned, does not exist yet
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
npx tsx scripts/progression-sim.ts --seeds 8 --days 60
```

`<N>` and any per-character bands are chosen once starter decks and maps exist.

## Dependencies on Core Set II

Story Mode needs from [plan-core-set-2.md](plan-core-set-2.md): the three characters' starter pools (Darlings, starter decks, reward pools), designed with the set rather than retrofitted; the new Beastkin legend (R8c); and Core Set II's versions of Guan Yu and Persephone if the set reprints or revises them. Both exist today, so waves 1 and 2 can build and test on current cards.

## Phased implementation plan

### Wave 1: schema, run state, and one headless run

Data schema, graph validator, StoryProgress, seeded map generation, the save field and migration, and one headless fixture run with Guan Yu on existing cards. Verification: graph and seed property tests, exactly-once and reload tests, run-count and unlock tests, the migration test, a deterministic duel and replay test, build, lint, docs.

### Wave 2: the run shell

Character select, opening boon, map, node types, shop and permanent buy, dialogue shell, and typed launch and result routing, behind a feature flag. Verification: UI state tests, all input methods, text-scale reflow from 1.9's accessibility work, the 2.0 mobile layouts, build, lint.

### Wave 3: content and measurement

Acts, bosses, events, scenes and the three starter pools from Core Set II; rewards; check-story coverage; the story matrix and progression runs with dated results. Verification: every node and deck ID valid, reward idempotency, story matrix with published seeds and bands, progression-sim, avatar and floor gates, replay round-trip.

### Wave 4: release QA

Editorial, accessibility, spoiler and full playthrough passes on every character; freeze IDs; remove the flag. Verification: fresh-save and migrated-save runs, loss, abandon, reload and import cases, the full ladder, and a documented human playthrough.

## Open decisions for the owner

From the planning session's handoff:

- **Voice (R7, TBD).** The planning session recommends no AI voice at launch (see Recommended).
- **The new Beastkin legend:** colour pair, tribe (continue Kitsune or a new one), name. Also the fallback if Core Set II slips, which the owner has not addressed (the planning session recommends Yohime as-is).
- **Story premise.** Open; one idea floated is the Tower as the place and the avatars as its floors.
- **Permanent-buy price and limits.** See Recommended for the planning session's proposal.
- **Other unlock routes.** Whether characters 2 and 3 can be unlocked any other way. Not discussed.

Closed 2026-09-29: the run-count threshold (R9) and whose runs count (R10).

## Risks and dependencies

- **Scope.** 2.0 already carries Core Set II, The Mandate, shared game state and Mobile; Story Mode stays the separable piece ([plan-road-to-2.0.md](plan-road-to-2.0.md)).
- **Core Set II timing.** The starter pools and the third character come from the set; a late roster delays wave 3.
- **Economy.** Keeps and run-gold buys add collection income; progression-sim measures them before lock.
- **Text.** Accessibility precedes Story Mode for text size ([plan-accessibility-i18n.md](plan-accessibility-i18n.md)); localization is ruled English only (1.9 D3), so 2.0 makes no localization promise.
- **itch.io.** The 1,000-file cap applies to new art or audio: scene backgrounds, portraits or voice ship in packs like card art.
- **Save and replay.** Shipped character, node and reward IDs become save keys; renaming one needs a migration map. Replay rules follow [plan-player-replays.md](plan-player-replays.md).

## Acceptance criteria

- Every generated map and authored graph passes the validator across a large seed sample; content has no executable code.
- The same run seed and the same choices give the same run and the same replays.
- Keeps and permanent buys apply at most once across reload, retry, replay, import and crash-recovery tests.
- Unlocks follow R4, R9 and R10 exactly: an abandoned run counts once it has had three fights, and each unlock reads only its predecessor's runs.
- Every story duel uses the ordinary `Game` and the redacted `PlayerView`.
- Old saves migrate with only the first character unlocked and no change to existing economy or records.
- Story matrix and progression `TO MEASURE` values are replaced with dated results before release.
- Player-facing text passes editorial, no-em-dash, text-scale and layout review, and borrows no other game's terms.
