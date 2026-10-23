<!-- source-of-truth: docs/roadmap.md, docs/plan-road-to-2.0.md, docs/plan-core-set-2.md, docs/plan-darlings.md, docs/architecture.md, docs/rules.md, src/engine/Game.ts, src/engine/view.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, src/meta/services.ts, src/meta/Limited.ts, src/meta/gauntletSeed.ts, src/scenes/MainMenuScene.ts, src/scenes/DuelScene.ts, src/data/opponents.ts, src/data/cards/tk-shu.ts, src/data/cards/greek.ts, src/data/cards/beastkin.ts, scripts/balance-matrix.ts, scripts/progression-sim.ts, src/data/story/act1.ts, src/data/story/characters.ts, src/data/story/opponents.ts, src/ai/combatPlans.ts, src/meta/story/storyMap.ts, src/meta/story/storyState.ts, src/meta/story/StoryProgress.ts, src/meta/story/storyContent.ts, src/meta/story/headlessRun.ts, src/meta/story/storyMatrix.ts, scripts/check-story.ts, src/meta/SaveCode.ts, public/assets/art/story/, src/scenes/StoryScene.ts, src/meta/story/storyFlow.ts, src/data/story/script.ts, src/meta/story/storyEvents.ts, src/scenes/StoryDialogue.ts, src/ui/storyDialogue.ts · last-verified: 2026-10-23 · design/plan doc - re-verify when the referenced code changes -->

# Story Mode plan (2.0)

**Status: direction ruled 2026-09-29, premise ruled 2026-10-11, wave 1 built 2026-10-12, wave 2's run shell built 2026-10-12 and its dialogue screen 2026-10-13, wave 3's starters, Act 1 elites and Story-only boss built and tuned 2026-10-13, behind `FEATURES.storyLive` (dev builds only).** Story Mode is a roguelite run with a story spine, shipping in 2.0 with Core Set II. This rewrite replaces the 2026-07-26 plan, which targeted 1.7 and "Expansion 8". Its engineering skeleton is kept: the node graph and validator, StoryProgress, exactly-once rewards, story duels on the ordinary `Game`, check-story tooling and one save field. Wave 1 is in code: the data under `src/data/story/`, the map generator, validator, save record, StoryProgress and a headless Act 1 runner under `src/meta/story/`, and the `story` save field. Wave 2's run shell is in code behind `FEATURES.storyLive` (on in dev builds): `src/scenes/StoryScene.ts` (character select, opening boon, the Act 1 map, card rewards, event, shop, rest, the act-clear keep, abandon, all over the Act 1 `bg-mandate-sky` still), its Phaser-free helpers (`src/ui/storyPresentation.ts`, `src/ui/storyLayout.ts`, `src/meta/story/storyFlow.ts`), a Story entry first on the Play screen, and story duels on the ordinary `DuelScene` (launched with the run and node, recorded once by `applyStoryDuelResult`, an abandoned story duel counted as a loss at the next launch like the Tower's). The dialogue screen is in code too: the approved Act 1 script as data (`src/data/story/script.ts`), its nine events with their choices (`src/meta/story/storyEvents.ts`, replacing wave 1's gold-or-card event), and the scene player (`src/scenes/StoryDialogue.ts`, layout in `src/ui/storyDialogue.ts`) with Continue, Backlog and Skip over the Act 1 stills, half size on the lite tier. Openings play after the boon, Sima Yi's intro before the boss duel and her defeat lines before the keep, and the ending before the cleared summary. Wave 3's first content landed 2026-10-13 (rulings W1 to W4): all three 30-card starters and reward pools are rebuilt from Core Set I and II, Act 1's elites are the three Story-only opponents the script's elite intros name (`gongsunzan`, `penthesilea`, `shanjun`, in `src/data/story/opponents.ts`, outside the Tower roster), its boss is a Story-only Sima Yi (`simayi-mandate`, D2) who is each heroine's hardest duel, and each heroine clears Act 1 in 40 to 50% of the 200-seed story matrix (Measurement, under Wave 1). Permanent collection buys are out of 2.0 (owner ruling 2026-10-16, below R8); not built yet: endless (a run ends after the Act 1 keep); everything not marked built below is still planned.

How to read this doc: the two **Owner rulings** sections are the only ruled parts. Items marked **Recommended (the planning session's proposal)** came from the 2026-09-29 Story Mode planning session and wait on the owner. The engineering sections are this plan's own and may change until the waves start.

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
  - **2026-10-16 ruling: no permanent buys in 2.0.** The owner picked "C" for the price and limits question: Story shops sell run cards only, and the only way a run card reaches the collection in 2.0 is the keep after each cleared act. The R6 and R8(b) answers above stay on record for a later version.
  - (c) Question, the owner's: "Is there another legendary Beastkin anthem/lord that might fit instead of Yohime?" The planning session offered Yohime, Wolfqueen Lupa, or option 3, a new Core Set II Beastkin legend built for the slot.
    > "Option 3 sounds good."

    This supersedes R3's Choice 3, and R4's chain applies to that slot. Blue and an anthem were part of the option-3 description the owner accepted; the colour pair, tribe and name are open. What happens if Core Set II slips was not addressed.
- **R9. Run counting.** Question: (a) abandoned runs never count, and a run also needs at least 3 fights; (b) any run with at least 3 fights counts, even if abandoned after that; or (c) something else?
  > "1 - B"

  A run counts toward an unlock once it has had at least three fights, whether it then ends in a win, a loss or an abandon. This supersedes R8(a)'s "abandoned runs don't count" and its "maybe".
- **R10. Whose runs count.** Question: to unlock Persephone, do you need 3 runs as Guan Yu, or any 3 runs?
  > "2 - Runs with the previous character sequentially."

  Each unlock counts only runs with the character just before it in the chain: Persephone needs 3 counted Guan Yu runs, and the Beastkin legend 3 counted Persephone runs.

## Owner rulings, 2026-10-11 (premise)

Asked as one group in the "Story Mode draft" project thread, with the three premises written up in the project's `plans/2.0/story-mode/01-premise-options.md`. The answers are quoted verbatim.

- **S1. Premise.** Question: A, The Fallen Mandate; B, The Contest of Heaven (every realm sends a champion); or C, The Tower Where It Fell (the 2026-09-29 idea)?
  > "Option A approved."

  The premise is **the Fallen Mandate**, Core Set II's own world (ruled for the set 2026-10-08). The Mandate of Heaven has fallen out of the sky where the three realms meet, and whoever holds it rules every realm under heaven. Each heroine goes after it for her own reason: Guan Yu to keep her Peach Garden oath and carry it home to the rightful house, Persephone because its fall cracked the gates between the living world and the underworld and she must close them, and Yutu to steal it for the Moon Palace. The Act 1 boss is **Sima Yi, the Patient Serpent** (the existing `simayi` avatar, U/B Jin control; since D2 Act 1 fields a Story-only variant of her, `simayi-mandate`), who reached it first and holds it. Endless follows from it: the Mandate will not stay held, so each endless loop ends at a new claimant.
- **S2. Tone.** Question: A, sincere myth-adventure with warmth and some humour; B, grim; C, mostly comic?
  > "A, as recommended."

  Guan Yu is earnest, Persephone is wry, Yutu is playful.
- **S3. Act 1 length.** Question: A, 9 floors and about 6 duels (about 45 to 60 minutes); B, about 4 duels; C, about 8 duels?
  > "A, approved."
- **S4. What counts as a win while only Act 1 exists.** Question: A, clearing Act 1 for now and the final act once Acts 2 and 3 ship, earned wins kept; B, always Act 1; C, no win route until all three acts ship?
  > "Clearing Act 1 counts as a win for now."

  For 2.0, an Act 1 clear is a win for R4's unlock chain. "For now" leaves open what a win means once Acts 2 and 3 ship; that is decided with those acts, and wins already recorded are never taken away.

- **V1. Scene art (2026-10-12).** Question: animated story scenes (short generated video loops) in 2.0, after a one-clip pilot, or later?
  > "Let's plan for Stills and dialogue inserts for launch for Act 1, and then we'll do full animations for "Full Story" launch."

  Act 1 ships with still scene backgrounds and still speaker portraits inserted beside the dialogue, with no motion. Full scene animation comes with the Full Story launch (Acts 2 and 3, [plan-2.0.md](plan-2.0.md) lane G), and it covers Act 1's scenes too then.

  The Act 1 stills are made and approved (owner, 2026-10-12): 18 backgrounds and 24 portraits, two expressions per speaker (V2 A, V3), full size in `public/assets/art/story/` and half size in `public/assets/art/story-half/`. Their rules and prompts are in [art-bible/story-act-1.md](art-bible/story-act-1.md). Nothing loads them until the scene screen is built.

## Owner rulings, 2026-10-13 (wave 3 tuning)

Relayed to the wave 3 session by the main session; recorded here as ruled, not quoted.

- **W1. The Act 1 band.** Each heroine's target Act 1 clear rate is 40 to 50%, measured by the headless 200-seed story matrix (`npx tsx scripts/balance-matrix.ts --story --seeds 200`, the headless run's fixed choices).
- **W2. Starter cards.** Starters and reward pools may use Core Set I (the shipped catalog) and Core Set II (`cs2-`). All three starters are rebuilt at 30 cards, each keeping the heroine's identity and colours, with reward pools to match. check-story accepts Core Set II cards whether or not that set's flag is on.
- **W3. The Act 1 elites.** Three Story-only elites are built so the written elite intros play: Gongsun Zan (`gongsunzan`, Darling `cs2-gongsun-zan`, mono-W cavalry), Penthesilea (`penthesilea`, `cs2-penthesilea`, mono-R Amazon aggro) and Shanjun (`shanjun`, `cs2-shanjun`, R/G Beastkin tiger). They replace Hera and Zhurong as Act 1's elites and never join `AVATARS` or the Tower.
- **W4. The floor-1 pool.** Act 1's fight pool (`fightAvatarIds`) is left alone unless deck tuning alone cannot reach the band; if it cannot, the session stops and reports rather than changing it. Deck tuning reached the band, so the pool is unchanged.
- **D1. Guan Yu's warriors.** Guan Yu's starter keeps its Human warriors from outside Three Kingdoms (relayed 2026-10-13).
- **D2. The boss is the hardest fight.** "Buff Sima Yi above elites, and then tweak Persephone in relation" (relayed 2026-10-13). For every heroine, her win rate against the boss (wins over boss duels reached) is below her win rate against each elite and below her overall elite win rate, and each heroine is back inside the W1 band, preferring changes to Persephone's starter or pool while keeping her a B/G Greek underworld control deck. The Tower's `simayi` avatar does not change (it drives the Tower ladder and the win-rate gates), so Act 1's boss is a Story-only variant (`simayi-mandate`, Measurement).
- **E1. Soften two elites.** Option A, "soften Gongsun Zan and Penthesilea a little" (relayed 2026-10-13), so the boss clearly tops every elite and the clear rates get headroom inside the W1 band. Judged on seeds 1 to 400: each heroine's boss rate at least about 5 points under her rate against each elite, and each heroine 40 to 50% clears on 1 to 400 and on the published 1 to 200. Small one-card starter changes are allowed to re-centre a heroine; the boss, Shanjun, the fight pool and the Act 1 economy stay as they were.

## Player-facing spec

**Character select (R2, R3, R4, R8, R9, R10).** Three characters: Guan Yu, Saint of War (Three Kingdoms), Persephone, Queen of Two Courts (Olympian), and a new Core Set II Beastkin legend. Guan Yu is open at the start. Persephone unlocks on a Guan Yu win or 3 counted Guan Yu runs; the Beastkin legend unlocks on a Persephone win or 3 counted Persephone runs (R10). A run counts once it has had at least three fights, however it then ends: win, loss or abandon (R9). For scale, today's cards: Guan Yu is {W}{R}{R}, a 5/4 with First Blade and Sentinel (UR); Persephone is {2}{B}{G}, a 3/3 with Deathblade that leaves two Bloom tokens when she dies (SSR).

**Opening boon (R5).** After picking a character the player chooses one of three small boons. Player copy calls it an opening boon; Slay the Spire's "Neow" is a design reference only and never appears in the game.

**The run.** Three acts of mapped nodes, each ending on a boss; 2.0 ships Act 1 and endless (P9). Act 1 is 9 floors with about 6 duels: 4 fights, 1 elite and Sima Yi as the boss, plus events, a shop and a rest (S3). Endless loops are shorter generated maps, each ending at a stronger claimant who holds the Mandate. Duels use the ordinary battlefield and vocabulary, and any special setup is shown before the duel starts.

**Keeping cards (R6, R8b).** Clearing an act keeps one card to the collection. Shops sell run cards only: the permanent collection buy (R6, R8b) is out of 2.0 (owner ruling 2026-10-16). A run card that is not kept never reaches the collection.

**The story spine.** Scenes show a still background, the speaker's name and a still portrait insert beside the dialogue (V1: no motion in Act 1), with short text blocks and Continue, Backlog and Skip. A choice that affects a duel or a reward states its effect. Act 1's scenes: an opening per heroine, Sima Yi's intro and defeat lines per heroine, 8 to 10 event vignettes, an Act 1 ending per heroine and one line into endless, about 1,500 to 2,500 words in all, in the S2 tone. The Act 1 script was approved by the owner on 2026-10-12 and is in the game as data.

## Recommended (the planning session's proposals)

None of these is a ruling. Each waits on the owner.

- **Run structure.** Recommended (the planning session's proposal): 3 acts, a map of fight / elite / event / shop / rest nodes, an avatar boss per act; short text scenes at act starts, boss intro and defeat lines, events as vignettes.
- **Character shape.** Recommended (the planning session's proposal): each character is her Darling in the Darlings command zone, a fixed 30-card starter deck in her colours (owner ruling 2026-10-12; the earlier 15 to 20 ran out of cards first), and a Warchest land reserve; card rewards weighted to her faction plus a small neutral pool.
- **The new Beastkin legend.** Recommended (the planning session's proposal): a blue-inclusive pair (U/W, U/B or U/R) so all five colours stay covered, a Beastkin tribal anthem, built to lead from the command zone, not a Gauntlet boss.
- **Fallback.** Recommended (the planning session's proposal): Yohime as-is if Core Set II slips. The owner accepted option 3 without addressing it.
- **Permanent shop buy.** Out of 2.0 (owner ruling 2026-10-16). The planning session's proposal, kept for a later version: one per shop, only cards that shop offers, premium price; measured in progression-sim together with keep-1-per-act.
- **Yohime and the Tower.** Recommended (the planning session's proposal): Yohime is also Gauntlet rung 7 (`yohime` in `src/data/opponents.ts`); if she is used, she should not also be a Story boss.
- **Per-character tuning.** Recommended (the planning session's proposal): each starter deck tuned so act-1 win rates land in a band, measured per character with the balance harness (Guan Yu is a 3-mana 5/4; Yohime costs 6).
- **Scope lever.** Recommended (the planning session's proposal): if 2.0 is overloaded, ship 1 act plus an endless or daily-seed run, and add acts in 2.0.x.
- **Voice.** Recommended (the planning session's proposal; the owner has not ruled): no AI voice at launch; trailer-only, or optional in 2.x. Reasons given: subreddit hostility to AI voice and art, itch's AI-content disclosure, itch's 1,000-file cap (voice would need packing like art), and ElevenLabs' commercial licensing. ElevenLabs is only the owner's example of TTS; no vendor decision exists.

## System touchpoints

### Engine

No engine change is planned. A story duel compiles to an ordinary `GameConfig` (`src/engine/Game.ts`): two deck lists, a seed, and for the command-zone shape the existing `format`, `landReserves` and `darlings` fields the Darlings format already uses. The engine enforces no deck size, so a short run deck needs no rules change. Special node rules, if any, are a pure observer under `src/meta/story/` over public engine events and never mutate rules state. Any Core Set II mechanic follows that set's engine-first plan.

### Meta, save, and economy

Pure definitions under `src/data/story/` (built in wave 1: `types.ts`, `characters.ts`, `act1.ts`; the shapes below are the plan's sketch, and the built ones add names, colours, act economy numbers and boons):

```ts
interface StoryCharacter { id: string; darlingId: string; starterDeck: string[]; landReserve: string[]; rewardPool: string[]; unlock: UnlockRule | null }
interface StoryAct { id: string; mapTemplate: MapTemplate; bossAvatarId: string; scenes: StorySceneBlock[] }
interface StoryNode { id: string; kind: 'fight' | 'elite' | 'event' | 'shop' | 'rest' | 'boss'; nextNodeIds: string[] }
```

`src/meta/story/StoryProgress.ts` (built in wave 1) keeps the old plan's role: it validates graphs, computes what is available, and applies completions and rewards atomically through the existing economy and collection services behind the `Services` singleton (`src/meta/services.ts`). The validator now runs on every generated act map (every node reachable, every path ends at the boss) as well as on authored scene graphs. A run's maps derive from one run seed, the way `src/meta/gauntletSeed.ts` derives each Tower rung's seed today, so the same seed gives the same run.

**Exactly-once rewards.** Each keep (one per act) has a stable reward key (run id plus act or shop node), recorded in the same save transaction that grants the card. Reload, retry, crash and import never grant it twice. The run deck is run-scoped and never touches the collection.

**Run state.** Unlike the old plan, which saved no in-progress state, a roguelite run must survive a reload. The precedent is Limited's `activeRun` (`src/meta/Limited.ts`), which keeps a draft run in the save between matches. Run state saves at node boundaries, never mid-duel.

### AI

Story duels pick an existing avatar, or one of the Story-only elite opponents in `src/data/story/opponents.ts`, and its difficulty. Brains read only the redacted `PlayerView` (`src/engine/view.ts`, which already carries the public `darlingZone`). Opponent decks and node rules are game setup, not information the AI inspects mid-turn. A duel that needs weaker play uses a tested difficulty or personality, never scripted hidden actions.

### UI scenes

`src/scenes/StoryScene.ts` (planned) owns character select, the boon choice, the map, shops, events and the dialogue shell, with pure layout and state helpers kept out of Phaser. `MainMenuScene` gains a Story entry. `DuelScene` accepts a narrow launch context such as `{ runId, nodeId }`, resolved through meta before the game is built, and returns a typed result. The tutorial flag set does not grow into a story scripting API. Recommended (this plan's, not the planning session's): locked characters show their unlock condition on character select.

### Tooling and invariants

`npm run check-story` (`scripts/check-story.ts`, built 2026-10-13, a thin CLI over `src/meta/story/storyContent.ts`) rejects duplicate character, scene, event, speaker and boon IDs; an event without its scene or a scene without its event; unknown speakers or expressions; backgrounds and portraits missing from `public/assets/art/story/` or `story-half/`; a heroine missing her own opening, boss intro, boss defeat or ending; empty strings and em-dashes; unknown avatars in act data and elite intros (an id resolves through `storyAvatarById`, the Story-only opponents and then the Tower roster); an act whose elite is not stronger than every fight (a harder brain, or the same brain on a higher Tower rung), or whose boss is not stronger than every elite by the same measure (D2); starter, reserve and reward cards that are unknown, lands, tokens, outside the heroine's colours or neither collectible nor Core Set II (W2); invalid starter decks and reserves; and event filters that match no card for some heroine (pool) or in the catalog. It exits non-zero on any error, and the content passes with 0 errors and 0 warnings (2026-10-13). Map reachability is checked by the map validator over many seeds in the tests. Tests cover graph validation over many seeds, deterministic run generation, exactly-once rewards across reload and retry, run counting, unlocks, replay, and scene text overflow. Engine, meta and data stay Phaser-free, tests do not import Phaser, and gates only ratchet up.

## Save-schema impact

**Built in wave 1 (2026-10-12):** `SaveData.story` rides the v37 -> v38 step with `openDuel`, with no bump to 39. The shape is below; `src/meta/story/storyState.ts` holds the real types. Besides the fields listed in the comment, an active run also saves `nodeResolved` (whether the current node's encounter is over) and `pendingCardRewards` (card rewards waiting for a pick), so a reload between a won duel and its reward can neither lose the reward nor take it twice. A v38 save without the field (dev saves from before wave 1) or with a malformed one loads with the fresh record, and an active run that fails validation is dropped. Save codes carry the field, and the import preview gains a story summary (characters unlocked, act clears, run in progress).

One top-level field, added in the next free `SaveData` version when wave 1 lands (`CURRENT_SAVE_VERSION` is 37 as of 1.9.1; v36 was 1.9's one bump and v37 the 1.9.1 Hooves and Fire grant, so Story takes v38; the tower reload fix opened v38 on release/2.0 with the optional `openDuel` mark, so Story adds its field to that same v37 -> v38 step rather than bumping again):

```ts
story: {
  contentVersion: 1;
  activeRun: StoryRun | null;           // seed, character, boon, act, node, run deck, run gold, fights played
  unlockedCharacterIds: string[];       // starts with Guan Yu's story character
  countedRuns: Record<string, number>;  // per character: runs that reached 3 fights, counted once each (R9); an unlock reads only its predecessor's count (R10)
  wins: Record<string, number>;         // per character; in 2.0 a win is an Act 1 clear (S4)
  claimedRewardKeys: string[];          // exactly-once keeps and buys
  seenSceneIds: string[];
  endless: {
    bestLoop: Record<string, number>;   // per character, deepest endless loop reached
    daily: { dateKey: string; bestLoop: number } | null;  // today's shared daily seed
  };
};
```

The bump needs a real `migrate()` and a migration test. Migration starts every save with only the first character unlocked, empty counts and no active run. Normalization deduplicates strings and never infers a claim from a completion. `activeRun` records fights played so the open run-count threshold can apply without another bump.

`ReplayContext.mode` gained `'story'` in wave 1 (`src/meta/Replay.ts`), with a `story` record (run id, character, act, node id and kind, endless loop) present exactly on story logs. It rides `REPLAY_LOG_VERSION` 17, the train's one replay bump (plan-2.0 P16), because the replayer never reads the context; `SaveData.version` does not move beyond the story bump. Save codes and save cards must carry the new field ([plan-save-portability.md](plan-save-portability.md)).

## AI and balance impact

Every outcome is `TO MEASURE`. `scripts/balance-matrix.ts --story` (built 2026-10-13, `src/meta/story/storyMatrix.ts`) plays N seeded headless Act 1 runs per character (seeds 1 to N, the headless run's fixed choices; `--character <id>` for one heroine) and reports clears, survival by floor, duel W-L overall and by node kind, elite and boss W-L by opponent (the rows D2 compares), the boss win rate when reached, mean game turns per duel, life losses against deck-outs, and any impossible seed (a run that threw, or a duel that hit the headless action cap). About 0.2 s a run on one core; it is not a gate. Keeps go into the canonical progression scenario before lock.

```text
npx tsx scripts/balance-matrix.ts --story --seeds <N> [--character <id>]
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
npx tsx scripts/progression-sim.ts --seeds 8 --days 60
```

`<N>` is 200 and the per-character band is a 40 to 50% Act 1 clear rate (W1, 2026-10-13).

## Dependencies on Core Set II

Story Mode needs from [plan-core-set-2.md](plan-core-set-2.md): the three characters' starter pools (Darlings, starter decks, reward pools), designed with the set rather than retrofitted; the new Beastkin legend (R8c); and Core Set II's versions of Guan Yu and Persephone if the set reprints or revises them. Both exist today, so waves 1 and 2 can build and test on current cards.

## Phased implementation plan

### Wave 1: schema, run state, and one headless run

**Built 2026-10-12.** Data schema, graph validator, StoryProgress, seeded map generation, the save field and migration, and one headless fixture run with Guan Yu on existing cards. Verification: graph and seed property tests, exactly-once and reload tests, run-count and unlock tests, the migration test, a deterministic duel and replay test, build, lint, docs.

What landed:

- **Data** (`src/data/story/`): the three characters in unlock order. Guan Yu (`guan-yu`, Darling `tk-shu-guanyu`) had a 30-card W/R starter deck of shipped Shu and Three Kingdoms cards, a ten-land reserve and a reward pool about three quarters Three Kingdoms; since wave 3 it is Three Kingdoms and Human warriors from Core Set I and II, with a pool about half Three Kingdoms. Persephone (`persephone`, `gk-persephone`) and Yutu (`yutu`, `cs2-yutu`) had stand-in decks of shipped cards so every entry validated; wave 3 replaced all three from Core Set I and II (W2, 2026-10-13). Act 1 follows the S3 floor table, with fights drawn from Tower rungs 1 to 3, elites from rungs 4 and 5 (wave 1; wave 3 replaced them with the Story-only elites, W3), and Sima Yi as the boss (the Tower's `simayi` until D2, then the Story-only `simayi-mandate`). The four opening boons are extra run gold, a seeded SR card from the pool, removing two starter cards, and one extra card reward after the first fight; a run is offered three of them by its seed.
- **Maps** (`src/meta/story/storyMap.ts`): 2 or 3 nodes a floor, edges only to the next floor, every node reachable from floor 1 and every path ending at the boss. A map is never saved; it regenerates from the run seed, derived the way `gauntletSeed.ts` derives rung seeds. Floors with two options always show both.
- **StoryProgress** (`src/meta/story/StoryProgress.ts`): start a run (a locked character is refused), the boon, legal next nodes, entering a node, recording a duel, card rewards, events, shops (run gold only) and rests, abandon, and the keep. A run counts once, when its third fight is recorded (R9), whether it then wins, loses or is abandoned; a loss ends the run. Beating Sima Yi is a win (S4). Unlocks read only the predecessor's wins and counted runs (R4, R10). The keep records `<runId>:act1:keep` in the same mutation that grants the card through `Collection.addCards`, so a second claim, before or after a reload, changes nothing.
- **Duels**: each duel node compiles to an ordinary Darlings-format `GameConfig` (the run deck, the character's Darling and reserve, against the avatar's own Darlings deck and reserve), with no engine change.
- **Headless run** (`src/meta/story/headlessRun.ts`): plays a whole Act 1 on a seed with MediumAI for the heroine and each avatar's own brain, by fixed choice rules, and returns a summary and, on request, each duel's replay log. Its event rule (`resolveStoryEventByRule`) takes the first available choice whose card reward can be in the heroine's colours (some card the choice could add has only her colours, or none), the first offered card in her colours, and the fewest removals; when every available choice's reward is off-colour it takes the first available one. Since 2026-10-13 (E1) it passes over ev-cats-in-the-dark's random black Beastkin for Guan Yu and Yutu, who cannot cast it, when they can pay the 15 gold for the other choice; before that it took each event's first available choice.
- **Content check** (`src/meta/story/storyContent.ts`): the core of `npm run check-story`, run by the tests; the CLI wrapper landed with wave 3's tooling (2026-10-13).

First measurement, not a gate (200 seeds, the headless run's fixed choices, 2026-10-12): at 20 cards the run deck faced 79-card avatar decks and ran out first. Over the first fight on seeds 1 to 100, Guan Yu lost 54, and 33 of those were an empty deck with life left; 16 Act 1 clears in 200. Owner ruling 2026-10-12: starter decks are 30 cards (data only; the ordinary empty-deck loss stays). Re-measured at 30 on the same seeds: first-fight losses 47, of which 18 were deck-outs; Guan Yu won 270 of 454 duels, and Act 1 clears stayed at 16 in 200. So 30 cards halves the first-fight deck-outs but does not move the clear rate; the per-character bands (avatar picks, starter quality) are still wave 3 tuning. Re-measured 2026-10-13 after the Act 1 script's nine events replaced the generic one (same 200 seeds; the fixed rule now takes each event's first available choice, `resolveStoryEventByRule`, where it used to take a free card): Guan Yu won 265 of 453 duels and Act 1 clears fell from 16 to 12 in 200 (still a measurement, not a gate).

Story matrix, 2026-10-13 (`npx tsx scripts/balance-matrix.ts --story --seeds 200`, seeds 1 to 200 per character, 1,313 duels, 111 s on one core; a measurement, not a gate). Guan Yu's row reproduces the figures above (12 clears, 265 of 453 duels). Persephone's and Yutu's decks are the wave 1 stand-ins, so their rows describe placeholder decks, not the Core Set II starters. Turns count both players' turns.

| Character | Clears | Duels W-L | Fight W-L | Elite W-L | Boss W-L (reached) | Mean turns | Losses: life / deck | Impossible seeds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guan Yu | 12 (6.0%) | 265-188 (58.5%) | 229-136 (62.7%) | 24-41 (36.9%) | 12-11 (52.2%) | 24.3 | 135 / 53 | 0 |
| Persephone (stand-in deck) | 5 (2.5%) | 243-195 (55.5%) | 221-134 (62.3%) | 17-45 (27.4%) | 5-16 (23.8%) | 26.6 | 123 / 72 | 0 |
| Yutu (stand-in deck) | 12 (6.0%) | 234-188 (55.5%) | 191-150 (56.0%) | 31-31 (50.0%) | 12-7 (63.2%) | 20.7 | 143 / 45 | 0 |

Runs reaching each floor, of 200 (runs lost on that floor in brackets):

| Character | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 | F9 (boss) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guan Yu | 200 [86] | 114 [15] | 99 [21] | 78 | 78 [37] | 41 | 41 [18] | 23 | 23 [11] |
| Persephone | 200 [83] | 117 [21] | 96 [21] | 75 | 75 [42] | 33 | 33 [12] | 21 | 21 [16] |
| Yutu | 200 [86] | 114 [29] | 85 [18] | 67 | 67 [35] | 32 | 32 [13] | 19 | 19 [7] |

The first fight is the biggest cut for all three (about 43% of runs end there), then floor 5, the first floor that can hold an elite; elites win about a third of the time against Guan Yu and Persephone.

The table above is the wave 1 history. Wave 3's first tuning (W1 to W3, 2026-10-13, the Tower's Medium `simayi` as boss) cleared 88, 81 and 95 of 200 for Guan Yu, Persephone and Yutu, with the boss easier than the elites for Persephone (boss 86.2% against elites 74.1%) and Yutu (89.6% against 79.3%), which D2 then ruled out.

History: after D2 (2026-10-13, seeds 1 to 200) the clears were Guan Yu 100 (50.0%), Persephone 92 (46.0%) and Yutu 82 (41.0%), with the boss 73.5%, 71.3% and 69.5% against weakest elites of 82.0% (Gongsun Zan), 72.3% and 70.2% (Penthesilea): D2 held by 1 point or less for Persephone and Yutu.

Story matrix, 2026-10-13, after E1 (`npx tsx scripts/balance-matrix.ts --story --seeds 400`, and `--seeds 200` for the published seeds; 400 runs per heroine, 272 s on one core; no impossible seeds). The rates below are wins over duels met, over seeds 1 to 400. The event rule changed first (Headless run, above), then two elites were softened (E1): Gongsun Zan's list swaps its six common fliers (Dawnfeather Valkyrie, Valkyrie Scout, Whitecap Rider, Eos, Nike and Dawn-Crest Skywing) and four removal spells (The Court Condemns, Strike Down the Charge, Stare of the Sun and Prism Deflection) for ten ground bodies of power 2 or more, staying a mono-W cavalry deck; Penthesilea's list is unchanged and her personality sends burn at the face (`burnFaceLife` 30). Persephone swaps her Oathsworn of the Styx for Reaper's Due, and Yutu gets Turn of the River Current back for her third Court Condemns. Guan Yu, the boss, Shanjun, the fight pool and the Act 1 economy are unchanged.

| Heroine | Clears 1-200 | Clears 1-400 | Weakest elite WR (1-400) | Boss WR (1-400) |
| --- | --- | --- | --- | --- |
| Guan Yu | 95 (47.5%) | 172 (43.0%) | Gongsun Zan 89-20 (81.7%) | 172-85 (66.9%) |
| Persephone | 97 (48.5%) | 175 (43.8%) | Gongsun Zan 88-20 (81.5%) | 175-75 (70.0%) |
| Yutu | 88 (44.0%) | 179 (44.8%) | Gongsun Zan 86-22 (79.6%) | 179-72 (71.3%) |

The other elites over seeds 1 to 400: Guan Yu beats Penthesilea 92.8% and Shanjun 85.6% (all elites 86.8%), Persephone 83.8% and 88.9% (84.5%), Yutu 83.6% and 83.8% (82.4%). So each boss rate is 14.8, 11.5 and 8.3 points under that heroine's weakest elite. On the published seeds 1 to 200 the margins are 15.1 (Guan Yu, Gongsun Zan 85.5%), 3.4 (Persephone, Penthesilea 78.0% against the boss's 74.6%) and 8.1 points (Yutu, Gongsun Zan 77.4%). Persephone's 3.4 is inside the noise of a 50-duel row, which is why E1 is judged on 400 seeds. Seeds 201 to 400 alone clear Guan Yu 38.5%, Persephone 39.0% and Yutu 45.5%. The elite levers level off: under every softer Penthesilea tried, Persephone's rate against her stayed near 80%. Most of what is left of the band now sits in the fights and the boss.

Story matrix, 2026-10-23, at 25 starting life (plan-2.0 P8; `npx tsx scripts/balance-matrix.ts --story --seeds 200` for seeds 1 to 200, and the same runs over seeds 201 to 400 from a one-off script around `playStoryMatrixRun`, since the CLI has no seed offset; about 190 s per 200 seeds for all three on one core; no impossible seeds). At 25 life Persephone cleared 103 of 200 (51.5%), outside W1, with Guan Yu at 93 (46.5%) and Yutu at 99 (49.5%). What changed: Persephone swaps one of her two Edicts of the Fallen Mandate (`cs2-heavens-edict`) for Sentence of Death (`cs2-sentence-of-death`, already in her pool), keeping her B/G underworld removal. Guan Yu, Yutu, the boss, the elites, the fight pool and the Act 1 economy are unchanged: seeds 201 to 400 read lower than 1 to 200 for all three (Guan Yu 34.5%, Persephone 47.5%, Yutu 41.0% before the swap), so over 1 to 400 Guan Yu sits at 40.5% and Yutu at 45.3%, and the one-card trims tried for them (a Court Condemns for White Horse Rally, which put both at 37 to 42% over 1 to 400) or lifts (Shore Patrol for Taishi Ci for Guan Yu, 38.8%) did not centre them better.

| Heroine | Clears 1-200 before / after | Clears 201-400 before / after | Clears 1-400 after | Elites 1-400 after (Gongsun Zan, Penthesilea, Shanjun) | Boss WR 1-400 after |
| --- | --- | --- | --- | --- | --- |
| Guan Yu | 93 (46.5%) / unchanged | 69 (34.5%) / unchanged | 162 (40.5%) | 76.9%, 97.2%, 83.3% | 162-82 (66.4%) |
| Persephone | 103 (51.5%) / 94 (47.0%) | 95 (47.5%) / 91 (45.5%) | 185 (46.3%) | 87.9%, 85.5%, 87.6% | 185-98 (65.4%) |
| Yutu | 99 (49.5%) / unchanged | 82 (41.0%) / unchanged | 181 (45.3%) | 87.3%, 85.0%, 86.5% | 181-83 (68.6%) |

On seeds 1 to 200 after the swap the boss rates are 72.1%, 66.2% and 72.8% against weakest elites of 80.0% (Gongsun Zan), 82.4% (Shanjun) and 81.8% (Penthesilea), so D2 holds by 7.9, 16.2 and 9.0 points; over 1 to 400 by 10.5, 20.1 and 16.4. Guan Yu's seeds 201 to 400 alone (34.5%) sit under the band, as Guan Yu's and Persephone's did after E1 (38.5%, 39.0%); W1 is read on 1 to 200 and 1 to 400, as for E1.

What changed for D2: Guan Yu swaps White Horse Rally for a second Court Condemns (her Human warriors stay, D1). Persephone swaps one Tidepool Wall for Gaia, both Artemis for two Marsh-Grave Risen, a Hecate for a second Lamia, both Hecatombs for Thanatos and a second Doom Bolt, Reaper's Due and Oath on the Styx for two more Hydra Venoms (four, the copy limit), and Toll of the Styx for Altar of Hades; her pool drops Gaia and Nyx for Marsh-Grave Risen and Altar of Hades. She stays B/G underworld control, with Gaia as a finisher: her deck-outs fell from 40 to 11, and the cheap removal lifts her Penthesilea matchup. Yutu swaps White Horse Rally, Moon Pestle and River Current for three Court Condemns. Tuning notes: Guan Yu and Yutu needed lifts too, because a heroine's clear rate is at most her boss-reach rate times her weakest elite rate (Yutu reaches the boss in about 60% of runs and beats Gongsun Zan about 73% of the time, so a boss under that caps her near 43%). Bosses that are harder for Guan Yu (cheap ground walls) are easier for Yutu, and fliers and sweepers the reverse, so one Sima Yi lands near the line for Yutu. Until E1 the headless rule took ev-cats-in-the-dark's first choice, a random black Beastkin card that Guan Yu and Yutu cannot cast (32 of each one's 200 runs carried one into an elite or the boss); since E1 it passes over an off-colour card reward (Headless run, above).

Two fixes came with wave 3's first measurement: the headless run counts a drawn duel as a loss, as the duel screen does (a drawn Yutu duel used to throw), and MediumAI now declares an attacker the Mandate makes legal (a creature compelled to attack by an attack-each-combat keyword granted only while its controller holds the Mandate was left home, an illegal declaration; `src/ai/combatPlans.ts`, test in `tests/ai/mandateReads.test.ts`). The matrix now also prints elites and the boss by opponent, the rows D2 compares.

### Wave 2: the run shell

Character select, opening boon, map, node types, shop and permanent buy, dialogue shell, and typed launch and result routing, behind a feature flag. Built 2026-10-12, the dialogue shell 2026-10-13. The permanent buy is out of 2.0 (owner ruling 2026-10-16). Story duels send the play-stats duel digest under their own `story` format (owner ruling 2026-10-13), so a run deck never skews the Darlings data; the Worker's schema must be redeployed with the new value before 2.0 ships. Verification: UI state tests, all input methods, text-scale reflow from 1.9's accessibility work, the 2.0 mobile layouts, build, lint.

The map (2026-10-13) draws each stop as a round medallion tinted by kind with its icon and no word (`src/ui/storyMapStops.ts`, tints in `theme.storyStop`), the boss as her portrait in a gold ring (the crown when the art is not loaded), joined by dotted trails; hovering or tapping a stop names it in the side panel. A Map Key modal lists every stop kind's medallion, name and one line; it opens by itself the first time a player ever sees a map (`story.seenMapKey` in the v38 record, no version bump) and from the Map Key button beside View Deck after that, and the same lines (`STORY_STOP_SUMMARY` in `src/data/glossary.ts`) fill the side panel and the Glossary's Story Map tab, shown only while `FEATURES.storyLive` is on.

### Wave 3: content and measurement

Acts, bosses, events, scenes and the three starter pools from Core Set II; rewards; check-story coverage; the story matrix and progression runs with dated results. Built 2026-10-13: the three starters and reward pools from Core Set I and II, the three Story-only Act 1 elites, the Story-only boss `simayi-mandate` (D2: a Hard Sima Yi with her own list, so the boss is each heroine's hardest duel; check-story requires the boss to be a stronger avatar than every elite), check-story at 0 warnings, and the story matrix in the W1 band with D2 met (Measurement, under Wave 1). Still to do: progression runs with keeps, and the avatar and floor gates re-run. Verification: every node and deck ID valid, reward idempotency, story matrix with published seeds and bands, progression-sim, avatar and floor gates, replay round-trip.

### Wave 4: release QA

Editorial, accessibility, spoiler and full playthrough passes on every character; freeze IDs; remove the flag. Verification: fresh-save and migrated-save runs, loss, abandon, reload and import cases, the full ladder, and a documented human playthrough.

## Open decisions for the owner

From the planning session's handoff:

- **Voice (R7, TBD).** The planning session recommends no AI voice at launch (see Recommended).
- **The new Beastkin legend:** settled by [plan-2.0.md](plan-2.0.md) P13 as Yutu, Jade Rabbit of the Moon Palace (W/U), with Yohime as the fallback if Core Set II slips. Before that ruling this item read: colour pair, tribe, name, and the fallback (the planning session recommends Yohime as-is).
- **Other unlock routes.** Whether characters 2 and 3 can be unlocked any other way. Not discussed.

Closed 2026-09-29: the run-count threshold (R9) and whose runs count (R10). Closed 2026-10-11: the premise, tone, Act 1 length and what counts as a win (S1 to S4). Closed 2026-10-12: scene art (V1). Closed 2026-10-16: no permanent buys in 2.0 (R8 ruling).

## Risks and dependencies

- **Scope.** 2.0 already carries Core Set II, The Mandate, shared game state and Mobile; Story Mode stays the separable piece ([plan-road-to-2.0.md](plan-road-to-2.0.md)).
- **Core Set II timing.** The starter pools and the third character come from the set; a late roster delays wave 3.
- **Economy.** Keeps add collection income; progression-sim measures them before lock.
- **Text.** Accessibility precedes Story Mode for text size ([plan-accessibility-i18n.md](plan-accessibility-i18n.md)); localization is ruled English only (1.9 D3), so 2.0 makes no localization promise.
- **itch.io.** The 1,000-file cap applies to new art or audio: scene backgrounds, portraits or voice ship in packs like card art.
- **Save and replay.** Shipped character, node and reward IDs become save keys; renaming one needs a migration map. Replay rules follow [plan-player-replays.md](plan-player-replays.md).

## Acceptance criteria

- Every generated map and authored graph passes the validator across a large seed sample; content has no executable code.
- The same run seed and the same choices give the same run and the same replays.
- Keeps apply at most once across reload, retry, replay, import and crash-recovery tests.
- Unlocks follow R4, R9 and R10 exactly: an abandoned run counts once it has had three fights, and each unlock reads only its predecessor's runs.
- Every story duel uses the ordinary `Game` and the redacted `PlayerView`.
- Old saves migrate with only the first character unlocked and no change to existing economy or records.
- Story matrix and progression `TO MEASURE` values are replaced with dated results before release.
- Player-facing text passes editorial, no-em-dash, text-scale and layout review, and borrows no other game's terms.
