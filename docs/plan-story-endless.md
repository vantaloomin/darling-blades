<!-- source-of-truth: src/data/story/endless.ts, src/meta/story/StoryProgress.ts, src/meta/story/storyState.ts, src/meta/story/storyFlow.ts, src/meta/story/headlessRun.ts, src/meta/story/endlessMatrix.ts, src/meta/story/storyContent.ts, src/engine/Game.ts, src/meta/Replay.ts, src/scenes/DuelScene.ts, scripts/balance-matrix.ts · last-verified: 2026-10-16 · design/plan doc - re-verify when the referenced code changes -->

# Story Mode endless (2.0)

**Status: owner rulings E1 to E7 given 2026-10-16; the headless half is built (wave 1), the screens are not.** Endless is the run that follows Story Mode's Act 1 ([plan-story-mode.md](plan-story-mode.md), P9 in [plan-2.0.md](plan-2.0.md)). This doc holds endless's rulings, design and measurements; the Act 1 plan stays in plan-story-mode.md.

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

**Opponents (E2).** `ENDLESS_ROSTER` is the Tower roster by rung without Sima Yi (Act 1's boss never comes back; check-story enforces it, by id and by portrait). Each loop draws fights, elites and claimants from three adjacent bands of 3 roster places that climb 2 places a loop, so the roster tops out at loop 10 and every later loop fields its strongest 9. The claimant is picked from her band by the boss node's seed. Before loop 2 no opponent plays above a Medium brain (`endlessBrain`); from loop 2 each plays its own Tower brain. From loop 7 the claimant starts holding the Mandate, and from loop 8 she starts with 3 more life per loop (3 at loop 8, 6 at loop 9, and so on), which never runs out.

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

## Not built yet

- **Screens (wave 3 of the planning file):** the go-on-or-stop choice after the Act 1 keep (playing `endless-intro` the first time), the Endless and daily entry on Story's character select (Version C frame N-38, without its "One try" line, which E6 retired, and with "Best: loop N" for floors), the `loopCleared` screen and the loop title card, records on character select.
- **Achievements:** reach loop 3, 5 and 10 (E4).
- **Tuning** at the new starting life, after the P8 reset.
