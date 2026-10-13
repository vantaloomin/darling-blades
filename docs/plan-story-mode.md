<!-- source-of-truth: docs/roadmap.md, docs/plan-road-to-2.0.md, docs/plan-core-set-2.md, docs/plan-darlings.md, docs/architecture.md, docs/rules.md, src/engine/Game.ts, src/engine/view.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, src/meta/services.ts, src/meta/Limited.ts, src/meta/gauntletSeed.ts, src/scenes/MainMenuScene.ts, src/scenes/DuelScene.ts, src/data/opponents.ts, src/data/cards/tk-shu.ts, src/data/cards/greek.ts, src/data/cards/beastkin.ts, scripts/balance-matrix.ts, scripts/progression-sim.ts, src/data/story/act1.ts, src/data/story/characters.ts, src/data/story/opponents.ts, src/ai/combatPlans.ts, src/meta/story/storyMap.ts, src/meta/story/storyState.ts, src/meta/story/StoryProgress.ts, src/meta/story/storyContent.ts, src/meta/story/headlessRun.ts, src/meta/story/storyMatrix.ts, scripts/check-story.ts, src/meta/SaveCode.ts, public/assets/art/story/, src/scenes/StoryScene.ts, src/meta/story/storyFlow.ts, src/data/story/script.ts, src/meta/story/storyEvents.ts, src/scenes/StoryDialogue.ts, src/ui/storyDialogue.ts · last-verified: 2026-10-13 · design/plan doc - re-verify when the referenced code changes -->

# Story Mode plan (2.0)

**Status: direction ruled 2026-09-29, premise ruled 2026-10-11, wave 1 built 2026-10-12, wave 2's run shell built 2026-10-12 and its dialogue screen 2026-10-13, wave 3's starters and Act 1 elites built and tuned 2026-10-13, behind `FEATURES.storyLive` (dev builds only).** Story Mode is a roguelite run with a story spine, shipping in 2.0 with Core Set II. This rewrite replaces the 2026-07-26 plan, which targeted 1.7 and "Expansion 8". Its engineering skeleton is kept: the node graph and validator, StoryProgress, exactly-once rewards, story duels on the ordinary `Game`, check-story tooling and one save field. Wave 1 is in code: the data under `src/data/story/`, the map generator, validator, save record, StoryProgress and a headless Act 1 runner under `src/meta/story/`, and the `story` save field. Wave 2's run shell is in code behind `FEATURES.storyLive` (on in dev builds): `src/scenes/StoryScene.ts` (character select, opening boon, the Act 1 map, card rewards, event, shop, rest, the act-clear keep, abandon, all over the Act 1 `bg-mandate-sky` still), its Phaser-free helpers (`src/ui/storyPresentation.ts`, `src/ui/storyLayout.ts`, `src/meta/story/storyFlow.ts`), a Story entry first on the Play screen, and story duels on the ordinary `DuelScene` (launched with the run and node, recorded once by `applyStoryDuelResult`, an abandoned story duel counted as a loss at the next launch like the Tower's). The dialogue screen is in code too: the approved Act 1 script as data (`src/data/story/script.ts`), its nine events with their choices (`src/meta/story/storyEvents.ts`, replacing wave 1's gold-or-card event), and the scene player (`src/scenes/StoryDialogue.ts`, layout in `src/ui/storyDialogue.ts`) with Continue, Backlog and Skip over the Act 1 stills, half size on the lite tier. Openings play after the boon, Sima Yi's intro before the boss duel and her defeat lines before the keep, and the ending before the cleared summary. Wave 3's first content landed 2026-10-13 (rulings W1 to W4): all three 30-card starters and reward pools are rebuilt from Core Set I and II, Act 1's elites are the three Story-only opponents the script's elite intros name (`gongsunzan`, `penthesilea`, `shanjun`, in `src/data/story/opponents.ts`, outside the Tower roster), and each heroine clears Act 1 in 40 to 50% of the 200-seed story matrix (Measurement, under Wave 1). Not built yet: permanent collection buys (price and limits are an open owner decision), and endless (a run ends after the Act 1 keep); everything not marked built below is still planned.

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

  The premise is **the Fallen Mandate**, Core Set II's own world (ruled for the set 2026-10-08). The Mandate of Heaven has fallen out of the sky where the three realms meet, and whoever holds it rules every realm under heaven. Each heroine goes after it for her own reason: Guan Yu to keep her Peach Garden oath and carry it home to the rightful house, Persephone because its fall cracked the gates between the living world and the underworld and she must close them, and Yutu to steal it for the Moon Palace. The Act 1 boss is **Sima Yi, the Patient Serpent** (the existing `simayi` avatar, U/B Jin control), who reached it first and holds it. Endless follows from it: the Mandate will not stay held, so each endless loop ends at a new claimant.
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

## Player-facing spec

**Character select (R2, R3, R4, R8, R9, R10).** Three characters: Guan Yu, Saint of War (Three Kingdoms), Persephone, Queen of Two Courts (Olympian), and a new Core Set II Beastkin legend. Guan Yu is open at the start. Persephone unlocks on a Guan Yu win or 3 counted Guan Yu runs; the Beastkin legend unlocks on a Persephone win or 3 counted Persephone runs (R10). A run counts once it has had at least three fights, however it then ends: win, loss or abandon (R9). For scale, today's cards: Guan Yu is {W}{R}{R}, a 5/4 with First Blade and Sentinel (UR); Persephone is {2}{B}{G}, a 3/3 with Deathblade that leaves two Bloom tokens when she dies (SSR).

**Opening boon (R5).** After picking a character the player chooses one of three small boons. Player copy calls it an opening boon; Slay the Spire's "Neow" is a design reference only and never appears in the game.

**The run.** Three acts of mapped nodes, each ending on a boss; 2.0 ships Act 1 and endless (P9). Act 1 is 9 floors with about 6 duels: 4 fights, 1 elite and Sima Yi as the boss, plus events, a shop and a rest (S3). Endless loops are shorter generated maps, each ending at a stronger claimant who holds the Mandate. Duels use the ordinary battlefield and vocabulary, and any special setup is shown before the duel starts.

**Keeping cards (R6, R8b).** Clearing an act keeps one card to the collection. Shops can also sell a card as a permanent collection card for a large amount of run gold; the limits and price are open. A run card that is not kept never reaches the collection.

**The story spine.** Scenes show a still background, the speaker's name and a still portrait insert beside the dialogue (V1: no motion in Act 1), with short text blocks and Continue, Backlog and Skip. A choice that affects a duel or a reward states its effect. Act 1's scenes: an opening per heroine, Sima Yi's intro and defeat lines per heroine, 8 to 10 event vignettes, an Act 1 ending per heroine and one line into endless, about 1,500 to 2,500 words in all, in the S2 tone. The Act 1 script was approved by the owner on 2026-10-12 and is in the game as data.

## Recommended (the planning session's proposals)

None of these is a ruling. Each waits on the owner.

- **Run structure.** Recommended (the planning session's proposal): 3 acts, a map of fight / elite / event / shop / rest nodes, an avatar boss per act; short text scenes at act starts, boss intro and defeat lines, events as vignettes.
- **Character shape.** Recommended (the planning session's proposal): each character is her Darling in the Darlings command zone, a fixed 30-card starter deck in her colours (owner ruling 2026-10-12; the earlier 15 to 20 ran out of cards first), and a Warchest land reserve; card rewards weighted to her faction plus a small neutral pool.
- **The new Beastkin legend.** Recommended (the planning session's proposal): a blue-inclusive pair (U/W, U/B or U/R) so all five colours stay covered, a Beastkin tribal anthem, built to lead from the command zone, not a Gauntlet boss.
- **Fallback.** Recommended (the planning session's proposal): Yohime as-is if Core Set II slips. The owner accepted option 3 without addressing it.
- **Permanent shop buy.** Recommended (the planning session's proposal): one per shop, only cards that shop offers, premium price; measured in progression-sim together with keep-1-per-act.
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

**Exactly-once rewards.** Each keep (one per act) and each permanent buy has a stable reward key (run id plus act or shop node), recorded in the same save transaction that grants the card. Reload, retry, crash and import never grant it twice. The run deck is run-scoped and never touches the collection.

**Run state.** Unlike the old plan, which saved no in-progress state, a roguelite run must survive a reload. The precedent is Limited's `activeRun` (`src/meta/Limited.ts`), which keeps a draft run in the save between matches. Run state saves at node boundaries, never mid-duel.

### AI

Story duels pick an existing avatar, or one of the Story-only elite opponents in `src/data/story/opponents.ts`, and its difficulty. Brains read only the redacted `PlayerView` (`src/engine/view.ts`, which already carries the public `darlingZone`). Opponent decks and node rules are game setup, not information the AI inspects mid-turn. A duel that needs weaker play uses a tested difficulty or personality, never scripted hidden actions.

### UI scenes

`src/scenes/StoryScene.ts` (planned) owns character select, the boon choice, the map, shops, events and the dialogue shell, with pure layout and state helpers kept out of Phaser. `MainMenuScene` gains a Story entry. `DuelScene` accepts a narrow launch context such as `{ runId, nodeId }`, resolved through meta before the game is built, and returns a typed result. The tutorial flag set does not grow into a story scripting API. Recommended (this plan's, not the planning session's): locked characters show their unlock condition on character select.

### Tooling and invariants

`npm run check-story` (`scripts/check-story.ts`, built 2026-10-13, a thin CLI over `src/meta/story/storyContent.ts`) rejects duplicate character, scene, event, speaker and boon IDs; an event without its scene or a scene without its event; unknown speakers or expressions; backgrounds and portraits missing from `public/assets/art/story/` or `story-half/`; a heroine missing her own opening, boss intro, boss defeat or ending; empty strings and em-dashes; unknown avatars in act data and elite intros (an id resolves through `storyAvatarById`, the Story-only opponents and then the Tower roster); an act whose elite is not stronger than every fight (a harder brain, or the same brain on a higher Tower rung); starter, reserve and reward cards that are unknown, lands, tokens, outside the heroine's colours or neither collectible nor Core Set II (W2); invalid starter decks and reserves; and event filters that match no card for some heroine (pool) or in the catalog. It exits non-zero on any error, and the content passes with 0 errors and 0 warnings (2026-10-13). Map reachability is checked by the map validator over many seeds in the tests. Tests cover graph validation over many seeds, deterministic run generation, exactly-once rewards across reload and retry, run counting, unlocks, replay, and scene text overflow. Engine, meta and data stay Phaser-free, tests do not import Phaser, and gates only ratchet up.

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

Every outcome is `TO MEASURE`. `scripts/balance-matrix.ts --story` (built 2026-10-13, `src/meta/story/storyMatrix.ts`) plays N seeded headless Act 1 runs per character (seeds 1 to N, the headless run's fixed choices; `--character <id>` for one heroine) and reports clears, survival by floor, duel W-L overall and by node kind, the boss win rate when reached, mean game turns per duel, life losses against deck-outs, and any impossible seed (a run that threw, or a duel that hit the headless action cap). About 0.2 s a run on one core; it is not a gate. Keeps and permanent buys go into the canonical progression scenario before lock.

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

- **Data** (`src/data/story/`): the three characters in unlock order. Guan Yu (`guan-yu`, Darling `tk-shu-guanyu`) had a 30-card W/R starter deck of shipped Shu and Three Kingdoms cards, a ten-land reserve and a reward pool about three quarters Three Kingdoms; since wave 3 it is Three Kingdoms and Human warriors from Core Set I and II, with a pool about half Three Kingdoms. Persephone (`persephone`, `gk-persephone`) and Yutu (`yutu`, `cs2-yutu`) had stand-in decks of shipped cards so every entry validated; wave 3 replaced all three from Core Set I and II (W2, 2026-10-13). Act 1 follows the S3 floor table, with fights drawn from Tower rungs 1 to 3, elites from rungs 4 and 5 (wave 1; wave 3 replaced them with the Story-only elites, W3), and Sima Yi as the boss. The four opening boons are extra run gold, a seeded SR card from the pool, removing two starter cards, and one extra card reward after the first fight; a run is offered three of them by its seed.
- **Maps** (`src/meta/story/storyMap.ts`): 2 or 3 nodes a floor, edges only to the next floor, every node reachable from floor 1 and every path ending at the boss. A map is never saved; it regenerates from the run seed, derived the way `gauntletSeed.ts` derives rung seeds. Floors with two options always show both.
- **StoryProgress** (`src/meta/story/StoryProgress.ts`): start a run (a locked character is refused), the boon, legal next nodes, entering a node, recording a duel, card rewards, events, shops (run gold only) and rests, abandon, and the keep. A run counts once, when its third fight is recorded (R9), whether it then wins, loses or is abandoned; a loss ends the run. Beating Sima Yi is a win (S4). Unlocks read only the predecessor's wins and counted runs (R4, R10). The keep records `<runId>:act1:keep` in the same mutation that grants the card through `Collection.addCards`, so a second claim, before or after a reload, changes nothing.
- **Duels**: each duel node compiles to an ordinary Darlings-format `GameConfig` (the run deck, the character's Darling and reserve, against the avatar's own Darlings deck and reserve), with no engine change.
- **Headless run** (`src/meta/story/headlessRun.ts`): plays a whole Act 1 on a seed with MediumAI for the heroine and each avatar's own brain, by fixed choice rules, and returns a summary and, on request, each duel's replay log.
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

The table above is the wave 1 history. Story matrix, 2026-10-13, after wave 3's starters and elites (W1 to W3; same command, seeds 1 to 200 per heroine, 1,560 duels, 115 s on one core; the W1 band is 40 to 50% clears). Starters, reserves and pools are in `src/data/story/characters.ts`, the elites in `src/data/story/opponents.ts`; the fight pool and the Act 1 economy are unchanged (W4).

| Heroine | Clears | Duel W-L | Boss W-L (reached) |
| --- | --- | --- | --- |
| Guan Yu | 88 (44.0%) | 677-112 (85.8%) | 88-30 (74.6%) |
| Persephone | 81 (40.5%) | 607-119 (83.6%) | 81-13 (86.2%) |
| Yutu | 95 (47.5%) | 668-105 (86.4%) | 95-11 (89.6%) |

| Heroine | Fight W-L | Elite W-L | Mean turns | Losses: life / deck | Impossible seeds |
| --- | --- | --- | --- | --- | --- |
| Guan Yu | 465-56 (89.3%) | 124-26 (82.7%) | 16.5 | 98 / 14 | 0 |
| Persephone | 420-69 (85.9%) | 106-37 (74.1%) | 21.3 | 79 / 40 | 0 |
| Yutu | 454-63 (87.8%) | 119-31 (79.3%) | 17.2 | 96 / 9 | 0 |

The cut now falls late: the boss ends about a quarter of Guan Yu's survivors, and floor 5 (the elite floor) is the biggest single cut for Persephone and Yutu. The elites are harder than the fights for all three (a Medium brain against the fights' Easy ones) and easier than Sima Yi for Guan Yu, but a little harder than Sima Yi for Persephone and Yutu, whose slower or wider decks match up well against her. Persephone sits at the band's floor (81 of 200, about plus or minus 3.5 points of seed noise); her losses carry the most deck-outs (40), since her control list is the slowest. Two fixes came with the measurement: the headless run counts a drawn duel as a loss, as the duel screen does (a drawn Yutu duel used to throw), and MediumAI now declares an attacker the Mandate makes legal (a creature compelled to attack by an attack-each-combat keyword granted only while its controller holds the Mandate was left home, an illegal declaration; `src/ai/combatPlans.ts`, test in `tests/ai/mandateReads.test.ts`).

### Wave 2: the run shell

Character select, opening boon, map, node types, shop and permanent buy, dialogue shell, and typed launch and result routing, behind a feature flag. Built 2026-10-12 except the dialogue shell (next) and the permanent buy (waits on the owner's price and limits). Story duels send the play-stats duel digest under their own `story` format (owner ruling 2026-10-13), so a run deck never skews the Darlings data; the Worker's schema must be redeployed with the new value before 2.0 ships. Verification: UI state tests, all input methods, text-scale reflow from 1.9's accessibility work, the 2.0 mobile layouts, build, lint.

### Wave 3: content and measurement

Acts, bosses, events, scenes and the three starter pools from Core Set II; rewards; check-story coverage; the story matrix and progression runs with dated results. Built 2026-10-13: the three starters and reward pools from Core Set I and II, the three Story-only Act 1 elites, check-story at 0 warnings, and the story matrix in the W1 band (Measurement, under Wave 1). Still to do: progression runs with keeps, and the avatar and floor gates re-run. Verification: every node and deck ID valid, reward idempotency, story matrix with published seeds and bands, progression-sim, avatar and floor gates, replay round-trip.

### Wave 4: release QA

Editorial, accessibility, spoiler and full playthrough passes on every character; freeze IDs; remove the flag. Verification: fresh-save and migrated-save runs, loss, abandon, reload and import cases, the full ladder, and a documented human playthrough.

## Open decisions for the owner

From the planning session's handoff:

- **Voice (R7, TBD).** The planning session recommends no AI voice at launch (see Recommended).
- **The new Beastkin legend:** settled by [plan-2.0.md](plan-2.0.md) P13 as Yutu, Jade Rabbit of the Moon Palace (W/U), with Yohime as the fallback if Core Set II slips. Before that ruling this item read: colour pair, tribe, name, and the fallback (the planning session recommends Yohime as-is).
- **Permanent-buy price and limits.** See Recommended for the planning session's proposal.
- **Other unlock routes.** Whether characters 2 and 3 can be unlocked any other way. Not discussed.

Closed 2026-09-29: the run-count threshold (R9) and whose runs count (R10). Closed 2026-10-11: the premise, tone, Act 1 length and what counts as a win (S1 to S4). Closed 2026-10-12: scene art (V1).

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
