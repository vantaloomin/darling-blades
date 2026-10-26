<!-- source-of-truth: src/data/story/endless.ts, src/meta/story/StoryProgress.ts, src/meta/story/storyState.ts, src/meta/story/storyFlow.ts, src/meta/story/headlessRun.ts, src/meta/story/endlessMatrix.ts, src/meta/story/storyContent.ts, src/meta/story/storyEvents.ts, src/meta/Achievements.ts, src/scenes/StoryScene.ts, src/scenes/StoryCompact.ts, src/ui/storyPresentation.ts, src/ui/duelCopy.ts, src/engine/Game.ts, src/meta/Replay.ts, src/scenes/DuelScene.ts, scripts/balance-matrix.ts · last-verified: 2026-10-16 · design/plan doc - re-verify when the referenced code changes -->

# Story Mode endless (2.0)

**Status: owner rulings E1 to E7 given 2026-10-16; the headless half (wave 1) and the screens and achievements (wave 3) are built; measured again after the P8 floor reset and early loops eased (owner pick); further tuning waits on real runs.** Endless is the run that follows Story Mode's Act 1 ([plan-story-mode.md](plan-story-mode.md), P9 in [plan-2.0.md](plan-2.0.md)). This doc holds endless's rulings, design and measurements; the Act 1 plan stays in plan-story-mode.md.

## Rulings

Already ruled before this doc: **P9** (2026-10-08): after Act 1, or from the menu once Act 1 is cleared, the run goes on through generated maps with scaling bosses until a loss; a daily seed shared by every player; no keep beyond Act 1's; run counting applies. **S1** (2026-10-11): the Mandate will not stay held, so each loop ends at a new claimant who holds it. The approved script's `endless-intro` scene plays once, on the first loop.

Asked as two groups in the "Story endless mode plan" project thread and answered 2026-10-16 ("E1. A. E2. A E3. A E4. A. E5. A E6. B E7. A"):

- **E1. Loop length: A.** A loop is 6 floors with about 4 duels.
- **E2. Scaling: A.** Opponents climb the Tower roster, on Medium brains first and Hard from loop 2; from loop 7 the claimant starts the duel holding the Mandate, and from loop 8 she also starts with 3 more life per loop.
- **E3. Menu start: A.** A run started from the menu gets the starter deck, the opening boon, 3 card picks from the heroine's pool and about 150 run gold before loop 1.
- **E4. Rewards: A.** Records and a few achievements only; endless shops sell run cards only (no permanent buys). The owner later ruled out permanent buys in Story for 2.0 altogether.
- **E5. The daily: A.** Any unlocked heroine plays the day's seed; the maps and opponents are the same for everyone that day.
- **E6. Daily tries: B.** Unlimited tries; the day keeps its best one.
- **E7. Claimant lines: A.** No new dialogue in 2.0: the approved `endless-intro` plays once, and each loop opens on a plain title card naming the claimant.

## Design (built, headless)

**Loops.** `src/data/story/endless.ts`. A loop is an ordinary act to the rest of the code (`endlessLoopAct(loop)`), so maps, duels, shops and rests run unchanged: floor 1 fight; 2 fight or rest; 3 shop or fight; 4 elite or fight; 5 rest or shop; 6 the claimant. Loop N's map seed and node ids use act number 100 + N (`a101-f1-n0`), so every loop's map differs. Endless has **no event floors**: the nine Act 1 events are scenes on the road to Sima Yi's crater, which is behind the player by then, and E7 adds no writing. Gold, prices and reward sizes are Act 1's.

**Opponents (E2).** `ENDLESS_ROSTER` is the Tower roster by rung without Sima Yi (Act 1's boss never comes back; check-story enforces it, by id and by portrait). Each loop draws fights, elites and claimants from three adjacent bands of 2 roster places. The bands climb 1 place a loop through loop 3 and 2 places a loop after that, so the roster tops out at loop 13 and every later loop fields its strongest 6. Loop 1's claimant is Zhurong or Yohime; loop 10's is Bastet or the Chrome Broodmother. The claimant is picked from her band by the boss node's seed. Before loop 4 no opponent plays above a Medium brain (`endlessBrain`); from loop 4 each plays its own Tower brain. From loop 7 the claimant starts holding the Mandate, and from loop 8 she starts with 3 more life per loop (3 at loop 8, 6 at loop 9, and so on), which never runs out.

**Engine options.** Two pieces of game setup, not rules, in `GameConfig`: `startingMandateHolder` (the seat that begins holding the Mandate; no event, no claim abilities) and `lifeBonus` (extra starting life per seat). The replay log records them (`mandateHolder`, `lifeBonus`) inside v17, which has not shipped, and an ordinary game records neither. The duel screen passes both through from `storyDuelSetup` and back from a replay.

**The run.** `src/meta/story/StoryProgress.ts`:

- `enterEndless` goes on after Act 1, only once the act is cleared and its keep claimed, so the keep is never skipped. The deck, run gold and fight count carry on; the run's `act` stays 1.
- `startEndlessRun` starts from the menu once any heroine has cleared Act 1 (`isEndlessOpen`), for any unlocked heroine: loop 1, the starter deck, `ENDLESS_HEAD_START_GOLD` (150) run gold, the boon to choose and `ENDLESS_HEAD_START_PICKS` (3) card picks waiting.
- Beating a claimant pays elite gold and a card reward (there is no keep in endless), records the loop and shows the `loopCleared` screen; `nextEndlessLoop` moves on once the reward is taken. A loss ends the run, as in Act 1. Runs count toward unlocks at three fights (R9); an endless run is never an Act 1 win (S4).
- Records (E4, E6): `story.endless.bestLoop` per heroine is the deepest loop cleared; a daily run (`dailyDateKey`, seed `dailyEndlessSeed(date)`) also keeps that day's best in `story.endless.daily`, however many tries it takes, and a new day replaces it. The v38 save already had both fields, so endless needs no save bump.
- A saved endless run reloads: the normalizer accepts `phase: 'endless'` with a loop of 1 or more, checks the path against that loop's map, and requires the fights played to cover at least this loop's duels.

**Measuring.** `npx tsx scripts/balance-matrix.ts --story --endless <act1|menu> --seeds <N> [--character <id>] [--max-loops <n>]` (`src/meta/story/endlessMatrix.ts`) plays seeded headless runs with the Act 1 matrix's fixed choices and reports loops cleared per run and W-L by loop and node kind. Not a gate.

## Measurement, 2026-10-16

Headless, MediumAI heroine against each opponent's (capped) brain, seeds 1 to 100 per heroine, starting life 20 (before the P8 reset). "Loops" counts claimants beaten.

| Start | Heroine | Reached endless | Median loops | Mean loops | Loop 3+ |
| --- | --- | --- | --- | --- | --- |
| act1 | Guan Yu | 52 | 0 | 0.58 | 0 |
| act1 | Persephone | 47 | 0 | 0.74 | 4 (8.5%) |
| act1 | Yutu | 49 | 1 | 0.78 | 0 |
| menu | Guan Yu | 100 | 0 | 0.52 | 0 |
| menu | Persephone | 100 | 1 | 0.85 | 5 (5.0%) |
| menu | Yutu | 100 | 1 | 1.12 | 13 (13.0%) |

Reading: the headless pilot reaches loop 1's claimant about half the time and beats her about three times in four; with about five duels a loop and one loss ending the run, few headless runs pass loop 2. The proposed target in the planning file (about half of runs from an Act 1 clear reaching loop 3) is out of reach for the headless pilot without making early loops much easier: holding Hard back to loop 4 moved the mean by about 0.1 loop. A human plays far better than MediumAI, so final tuning waits on the P8 floor reset and is better judged against real play; the numbers above are a baseline, not a target.

## Measurement at 25 life, 2026-10-16

The same matrix after the P8 reset (#694, starting life 25 for both seats), seeds 1 to 100 per heroine.

| Start | Heroine | Reached endless | Median loops | Mean loops (at 20) | Loop 3+ |
| --- | --- | --- | --- | --- | --- |
| act1 | Guan Yu | 47 | 0 | 0.38 (0.58) | 0 |
| act1 | Persephone | 50 | 1 | 0.82 (0.74) | 2 (4.0%) |
| act1 | Yutu | 52 | 1 | 0.94 (0.78) | 4 (7.7%) |
| menu | Guan Yu | 100 | 0 | 0.48 (0.52) | 0 |
| menu | Persephone | 100 | 1 | 0.88 (0.85) | 7 (7.0%) |
| menu | Yutu | 100 | 1 | 1.12 (1.12) | 11 (11.0%) |

Reading: the reset barely moves endless, because both seats gain the same life. No headless run reaches loop 6. Guan Yu is the outlier: loop 1's claimant beats her about 4 times in 10 (59% and 65% wins from Act 1 and the menu), against 80% to 92% for the other two. Tuning still waits on real runs, per the owner's ruling.

## Early loops eased, 2026-10-16

The owner picked "ease early loops" after the reading above. Four setups were measured side by side (100 seeds per heroine, both starts): Hard from loop 4 alone; plus a 1-place climb; bands of 2; and bands of 2 with a 1-place climb. The last moved runs most and is built, with the climb back to 2 places a loop after loop 3 so late loops still reach the top of the roster.

| Start | Heroine | Median loops | Mean loops (before) | Loop 3+ | Loop 6+ |
| --- | --- | --- | --- | --- | --- |
| act1 | Guan Yu | 0 | 0.72 (0.38) | 1 (2.1%) | 0 |
| act1 | Persephone | 1 | 1.24 (0.82) | 9 (18.0%) | 0 |
| act1 | Yutu | 2 | 1.77 (0.94) | 13 (25.0%) | 1 (1.9%) |
| menu | Guan Yu | 0 | 0.59 (0.48) | 1 (1.0%) | 0 |
| menu | Persephone | 1 | 1.16 (0.88) | 11 (11.0%) | 0 |
| menu | Yutu | 1 | 1.47 (1.12) | 24 (24.0%) | 2 (2.0%) |

Reading: headless runs from an Act 1 clear now clear about 1.5 to 1.9 times as many loops, and menu runs about 1.2 to 1.3 times as many, but the loop 3 target stays out of reach for it. Fights against the weakest avatars are already won about 9 times in 10, and with about 5 duels a loop and one loss ending the run, no roster or brain setting gets most headless runs to loop 3. Further easing would have to change the run's shape (fewer duels a loop, or a second chance), which the rulings don't allow. Guan Yu still lags: from an Act 1 clear she wins about 85% of loop 1's fights against 95% to 97% for the others, and beats loop 1's claimant about 7 times in 10 against 8 to 9.

## Screens (built)

- **Going on.** The Act 1 cleared summary (after the keep) offers Finish run or Continue to endless (`enterEndless`). The approved `endless-intro` scene plays the first time any run reaches endless (`endlessIntroSceneDue`), whether from Act 1 or the menu.
- **The Endless screen (Version C frame N-38).** Once any heroine has cleared Act 1, character select's column gets an Act 1 / Endless switch. Endless shows the chosen heroine's portrait, a Daily seed / Random seed switch, what the seed means, her best run and today's daily best, and what a menu run starts with; the column lists the heroines and starts the run. The mock's "One try" line is gone (E6), floors became loops cleared, and its "Yesterday" record is not kept (the save holds today's daily only). The daily's date is the player's local calendar day, as the Tower's daily roster.
- **Each loop.** A fresh loop's map opens under a title card naming the claimant (E7), with what she starts the duel holding from loop 7 and her extra life from loop 8. The heroine's opening scene plays only at Act 1's start. Top bars say "Loop N" in place of "Act 1".
- **A beaten claimant.** After her card reward, the loop cleared screen shows who fell, the run's numbers and the records, then Go on to loop N+1 or End run (asked first). The duel result names the loop cleared, and an endless loss says how many loops the run cleared.
- **Achievements (E4).** Third, Fifth and Tenth Claimant: clear loop 3, 5 or 10 with any heroine (150, 300 and 600 gold). Hidden while `FEATURES.storyLive` is off, so the public build never lists goals it cannot reach.

## Not built yet

- **Tuning** against real runs and play stats (owner ruling 2026-10-16). Early loops are eased (above); anything further waits on real runs.
- Claimant medallions on endless maps use the crown icon: only Act 1's boss has a dialogue portrait.
