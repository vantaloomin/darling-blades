<!-- source-of-truth: src/data/opponents.ts, scripts/darlingsDeckBuilder.ts, tests/ai/winrate.test.ts, scripts/balance-matrix.ts, tests/data/avatarReserveDecks.test.ts · last-verified: 2026-10-04 · measurement record — the 1.9 wave-4 tower baseline, tune plan and tunes; re-verify at the end-of-wave measurement -->

# Wave 4 tunes, phase 1: the tower baseline and the tune plan (1.9)

> **Record, not spec.** The wave-4 tune pass as measured on 2026-10-04 (phase 1: the baseline and plan; phase 2, section 11: the tunes as landed). The end-of-wave measurement, ratchet and new gates are still to run; the handoff steps are in [plan-1.9.md](plan-1.9.md#handoff-2026-10-04). Paths under `scratchpad/` were the measuring session's local working files (raw JSON per run, variant lists, the `tower.mts` runner) and are not in the repo; every number they produced is in the tables below.


Measured 2026-10-04 in the worktree `w9-ai`, branch `feat/19-w4-tunes` (0d98e866 plus the Maiden edit below), on the frozen AI.

- The only code change is the owner-ruled Hearth-Shield Maiden recost and its converter knock-ons (section 0). No floor, band or `src/ai/` file was touched. No git command was run.
- Every number below is fresh from this tip unless it is marked as quoted.
- Raw JSON (one file per rung per run) is in `scratchpad/w4/tunes/out/<run>/`. The command log is `scratchpad/w4/tunes/commands.log`. The runner is `scratchpad/w4/tunes/tower.mts`.
- **The runner.** Each work unit (one rung, or one floor) calls the committed `runAvatarMatrix` or `runAvatarReserveMatrix` for that rung alone, so every cell has the committed harness's seed. The floors mode copies `runFloorMatrix`'s cell spec. Four workers share a claims directory. They run at below-normal priority with `OMP_NUM_THREADS=1 ORT_NUM_THREADS=1`. Only one job ran at a time.
- **Variants** are applied in memory only:
  - `pre-maiden` restores the exact pre-edit literals, parsed from a backup of `opponents.ts`, and the {1}{W} cost.
  - `wild-maiden` gives Wild Communion the converter's post-edit list.
  - `--list` swaps whole boss lists.
- **Cross-check.** A 2-seed probe of the column-only mode reproduced the full gate cell exactly.

## 0. The Maiden edit, and the decision it raised

### What changed

- **The card:** `fdr-hearth-shield-bulwark`'s cost goes from {1}{W} to {W} in `src/data/cards/first-dawn.ts`. Text, stats and rarity are unchanged.
- **The art bible:** her Card facts line in `docs/art-bible/first-dawn.md` now reads {W}.
- **Other docs that quote her cost:** only design history. These are the overplan rows under the pre-transcription id `fd-hearth-shield`, which also predate her Bulwark. They are left as history, the same convention the overplan's own header states.
- **The corpus:**
  - `npx tsx scripts/blades-db.ts build` was run with a temporary copy of the main checkout's gitignored `scripts/blades-db.ts`, removed again afterwards. It reads 1,685 cards and shows Maiden at {W}, mv 1.
  - **`terms --check` exits 1**, but on a leak that predates this change. "arrives" survives translation on Orbital Graft, Salt Chapel and Tahla. That is a gap in the local tool's TERMS table, not in game data.
  - `power-scores.json` is still the 2026-09-28 file and was not rescored. The Forge rescore procedure is in `docs/forge.md`.

### The converter knock-ons

The converter-owned lists that moved are in `src/data/opponents.ts`, all as anchored edits:

| Boss | List | Before -> after |
| --- | --- | --- |
| R27 The Shepherdess of Giants | reserve | Maiden 3 -> 4, The Clan Hearth 3 -> 2 |
| R2 Hestia | Darlings (themed builder) | -1 Blessed Respite, +1 Maiden |
| R4 Hera | Darlings (themed builder) | -1 Nirra, -1 Salt Ward, +1 Maiden, +1 Choir of the Dead |

### What the edit measured

All runs at 200 seeds, paired against the pre-edit literals:

| Row | Before the edit | After the edit |
| --- | --- | --- |
| R27 gate | 68.1 | 68.7 |
| R27 Darlings | 67.1 (41 draws) | 67.9 (45 draws) |
| R2 Darlings | 9.3 | 8.5 |
| R4 Darlings | 56.6 | 57.9 |

All of these moves are inside the noise. The edit is neutral for the tower.

### OPEN, for the main session: Wild Communion

The converter also moves a **starter**. Wild Communion's (`starter-wild`) reserve build would take the Maiden in place of its singleton **Mother of the Long-Necks** (`fd-long-neck-mother`). I applied that change, then **reverted it**, because it trips a second test:

- Mother of the Long-Necks is the **only Mark source in the five gate columns**.
- `tests/data/avatarReserveDecks.test.ts` "the five starter columns really do supply no artifact or enchantment" asserts `columnSupply.has('marked')`, and it fails without her.
- No boss list's converter output changes either way; I checked every pinned list.

So the files are in this state:

- `starterDecks.ts` is unchanged.
- **One test is red:** `tests/data/starterReserveDecks.test.ts`, "is the deterministic converter output". Its first diff is starter-wild.
- Everything else in `tests/data` and `tests/power` is green (969/970).

Both ways out need a test edit, which this contract did not allow:

| Option | Edit | Effect |
| --- | --- | --- |
| **(A), recommended** | Register `starter-wild` in `HAND_TUNED_STARTER_IDS` (`tests/data/starterReserveDecks.test.ts`), with a dated comment | Wild Communion keeps Mother of the Long-Necks and every gate column stays exactly as measured here |
| (B) | Take the converter's Maiden, and rewrite the Mark-supply premise test to accept a format with no Mark source in the columns | Wild Communion changes for players, and every gate column moves |

What (B) would cost, measured as the Communion column only, all 28 rungs at 200 seeds (5,600 games):
- The bosses win **+2.0 points** more against Wild Communion on average (range -0.5 to +6.5).
- Rows move **+0.4**.
- No floor gets worse.

It weakens the weakest of the five starters, which is why I recommend (A). On the wide matrix, Wild Communion takes 29.1% of its games against the tower, the lowest of the starters.

## 1. Baseline

### The gate, wide and Darlings rows

Gate format: `runAvatarMatrix`, 200 seeds per cell, 28,000 games, 2 draws.

Wide matrix: `runAvatarReserveMatrix('warchest')`, 15 columns (5 starters and 10 theme precons), 200 seeds per cell, 84,000 games, 13 draws.

Darlings: `runAvatarReserveMatrix('darlings')`, 200 seeds per cell, 28,000 games, 167 draws. Each row's mean is about ±1.6 points (1 SE).

Column legend:
- **Floor** is the floor in `tests/ai/winrate.test.ts` at 0d98e866.
- **Margin** is the 200-seed mean minus the floor.
- **themed** is the spot check in section 3.

| Rung | Boss | Brain | Gate mean (Mus/Com/Tid/Man/Har) | Wide mean (15 cols) | Darlings mean (draws) | Floor | Margin | RUNG_BANDS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Meng Huo | easy | **23.7** (14/11/26/50/19) | 29.5 | 32.0 (47) | none | - | <=45.0 cell<=65.0 |
| R2 | Hestia | easy | **7.8** (5/7/2/21/5) | 11.3 | 8.5 (12) | none | - | <=45.0 cell<=65.0 |
| R3 | Lupa, Wolfqueen | easy | **24.1** (11/3/33/52/23) | 34.9 | 28.8 (9) | none | - | <=45.0 cell<=65.0 |
| R4 | Hera | medium | **38.2** (23/48/38/39/44) | 40.4 | 57.9 (3) | none | - | >=22.0 <=62.0 |
| R5 | Zhurong | medium | **43.6** (43/26/37/66/47) | 48.0 | 50.2 (13) | none | - | >=37.0 <=67.0 |
| R6 | Sima Yi | medium | **42.3** (41/77/24/33/37) | 41.0 | 40.8 (7) | none | - | >=15.5 <=72.0 |
| R7 | Yohime, Kitsune Matriarch | hard | **77.2** (59/88/76/79/85) | 79.1 | 71.0 (2) | none | - | >=69.5 |
| R8 | Cao Cao | hard | **63.1** (33/90/63/77/54) | 69.1 | 56.6 (1) | none | - | >=56.5 |
| R9 | Hel, Queen of Mist | hard | **69.0** (61/85/63/81/56) | 72.9 | 69.9 | none | - | >=61.0 |
| R10 | Brunhild, the Last Valkyrie | hard | **72.3** (65/78/47/89/83) | 76.3 | 68.5 (1) | none | - | >=69.0 |
| R11 | The Morrigan | hard | **40.9** (44/52/16/31/62) | 37.5 | 59.2 | none | - | >=36.5 |
| R12 | Titania | hard | **63.1** (34/96/69/65/52) | 68.6 | 70.2 (6) | none | - | >=52.0 |
| R13 | Morgan of the Thorn Crown | hard | **47.4** (27/74/35/63/39) | 47.9 | 51.1 | none | - | >=43.0 |
| R14 | Artoria, Once and Future Queen | hard | **67.2** (29/93/65/74/76) | 68.2 | 63.3 (3) | none | - | >=56.5 |
| R15 | Carmilla, Crimson Host | hard | **67.6** (54/65/47/87/85) | 67.9 | 63.0 | 65.5 | 2.1 | >=65.5 |
| R16 | The Storm-Crowned Bride | hard | **71.0** (67/73/49/78/89) | 71.5 | 57.2 | 64.5 | 6.5 | >=62.5 |
| R17 | Glass-Coffin Queen | hard | **78.0** (74/76/62/94/85) | 83.5 | 75.0 | 71.5 | 6.5 | >=70.5 |
| R18 | Abyssal Songstress | hard | **89.1** (92/92/73/94/96) | 87.9 | 63.3 (1) | 82.5 | 6.6 | >=82.0 |
| R19 | Queen of the Lanterned Roof | hard | **74.8** (64/89/62/81/80) | 74.0 | 67.2 (1) | 67.5 | 7.3 | >=65.0 |
| R20 | Kitsune Neon Tyrant | hard | **90.2** (84/87/87/98/96) | 92.2 | 61.0 | 83.5 | 6.7 | >=81.5 |
| R21 | Anubis, Who Holds the Scale | hard | **62.8** (69/78/63/57/48) | 69.1 | 56.9 (1) | 58.5 | 4.3 | >=58.5 |
| R22 | Bastet, Mistress of the Ninth Return | hard | **75.2** (54/84/63/87/89) | 79.9 | 79.9 | 68.5 | 6.7 | >=68.5 |
| R23 | Chrome Broodmother | hard | **74.1** (57/87/66/73/88) | 76.0 | 21.8 (7); themed 59.4 | 67.5 | 6.6 | >=65.5 |
| R24 | The Violet Signal Queen | hard | **71.5** (53/92/65/60/89) | 70.1 | 11.9 (5); themed 54.8 | 64.5 | 7.0 | >=64.5 |
| R25 | The Drowned Deacon | hard | **66.2** (41/65/64/85/77) | 72.4 | 9.8; themed 57.3 | 60.5 | 5.7 | >=59.5 |
| R26 | The Marsh-Mother | hard | **75.0** (57/84/72/77/86) | 78.4 | 30.0 (3); themed 58.1 | 68.5 | 6.5 | >=68.5 |
| R27 | The Shepherdess of Giants | hard | **68.7** (44/96/74/55/75) | 75.9 | 67.9 (45); themed 84.0 | none | - | none |
| R28 | The Tyrant Queen | hard | **63.6** (57/82/57/62/61) | 72.4 | 46.6; themed 69.5 | none | - | none |

**The precon (theme deck) rows.** This is the wide matrix seen from the columns: each column's win % against the boss rows, over decided games. There is no precon floor in CI; this is what the tune step measures the theme decks against. Hooves and Fire reads 38.6% across the tower and 26.1% against the summit. The softest precons are Valhalla's Muster (19.6) and Lanterns Below (20.8).

| Column | All 28 | R1-R13 | R14-R22 | R23-R28 | vs R11 |
| --- | --- | --- | --- | --- | --- |
| Crimson Muster | 52.3 | 66.8 | 35.2 | 46.8 | 60.5 |
| Wild Communion | 29.1 | 43.5 | 17.4 | 15.2 | 44.0 |
| Burning Tides | 45.1 | 58.0 | 34.8 | 32.7 | 86.0 |
| Shadow Mandate | 31.5 | 43.5 | 16.3 | 28.3 | 71.0 |
| Grave Harvest | 35.2 | 53.1 | 18.7 | 21.3 | 35.0 |
| Valhalla's Muster | 19.6 | 32.4 | 6.1 | 12.0 | 12.5 |
| Glimmer Bargain | 22.7 | 35.1 | 10.8 | 13.5 | 26.0 |
| Questing Table | 30.9 | 45.3 | 17.6 | 19.8 | 63.5 |
| Bloodmoon Masquerade | 51.2 | 68.1 | 34.5 | 39.7 | 91.5 |
| Midnight Storybook | 43.8 | 59.4 | 26.0 | 36.7 | 79.5 |
| Neon Afterimage | 29.6 | 38.4 | 19.1 | 26.3 | 67.0 |
| Pride at the Ninth Gate | 48.7 | 60.2 | 42.2 | 33.6 | 89.0 |
| Chrome-Violet Broodship | 38.8 | 53.4 | 26.9 | 24.8 | 85.5 |
| Lanterns Below | 20.8 | 31.5 | 12.3 | 10.4 | 37.5 |
| Hooves and Fire | 38.6 | 53.8 | 24.9 | 26.1 | 88.5 |

### The floors harness (the tower as the player meets it)

`--floors` layout, 80 seeds per cell, 11,200 games, 0 draws.

| Tier | Floors | Today | QC day (2026-09-21) | Band |
| --- | --- | --- | --- | --- |
| T1 | 1-3 | 18.4 | 15.5 | at most 33 |
| T2 | 4-6 | 24.0 | 20.7 | at least 20 |
| T3 | 7-9 | 40.3 | 39.5 | at least 34 |
| T4 | 10-12 | 54.9 | 49.6 | at least 40 |
| T5 | 13-15 | 53.9 | 53.5 | at least 50 |
| **T6** | **16-28** | **65.6** | 65.0 | **at least 58.5** |

The T6 floors read 65.8 / 66.5 / 67.3 / 67.0 / 66.0 / **58.8** / 68.3 / 64.5 / 63.7 / 65.3 / 65.3 / 69.8 / 64.3.

- **F21 reads 58.8, 0.3 above its band.** Its neighbours read 64-68, and F21 read 67.3 on 1.8.1. At 80 seeds a floor row's SE is about 2.4. This floor rotates every roster list, so no boss is to blame. Re-read it at 200 seeds before treating it as real; that read belongs to the end-of-wave measurement.
- **Floors 27-28 have no `FLOOR_BANDS` row**, so they are ungated today.
- **T4 now reads above T5** (54.9 against 53.9). T4 is medium/0. This is the tier dial, which is AI and frozen.

## 2. Inversions

A flag means the rung reads beyond 4.5 points under the one below it, about 2 SE of a difference between two 200-seed rows. The harness's own flag is 12 points.

### The six the plan named (gate format)

| Pair | 1.8.1 | Today | Status |
| --- | --- | --- | --- |
| R2/R1 | flagged | 7.8 vs 23.7 (-15.9) | **still there** |
| R6/R5 | flagged | 42.3 vs 43.6 (-1.3) | **closed**: noise. It closed in 1.8.5, when Sima Yi took his buffed cards |
| R8/R7 | flagged | 63.1 vs 77.2 (-14.1) | **still there** |
| R11/R10 | flagged | 40.9 vs 72.3 (-31.4) | **still there**, the worst on the ladder |
| R19/R18 | flagged | 74.8 vs 89.1 (-14.3) | **still there** (a peak at R18) |
| R21/R20 | flagged | 62.8 vs 90.2 (-27.4) | **still there** (a peak at R20) |

### New in the gate format

| Pair | Today | Note |
| --- | --- | --- |
| **R13/R12** | 47.4 vs 63.1 (-15.7) | Now past the 12-point flag. On 2026-09-21 it was -8.7: Titania rose 58.6 -> 63.1 |
| R25/R24 | 66.2 vs 71.5 (-5.3) | |
| R27/R26 | 68.7 vs 75.0 (-6.3) | |
| **R28/R27** | 63.6 vs 68.7 (-5.1) | The summit sits under the rung below her and under R26 |

### In Darlings

| Pair | Today |
| --- | --- |
| R2/R1 | -23.5 |
| R5/R4 | -7.7 |
| R6/R5 | -9.4 |
| R8/R7 | -14.4 |
| R11/R10 | -9.3 |
| R13/R12 | -19.1 |
| R16/R15 | -5.8 |
| R18/R17 | -11.7 |
| R20/R19 | -6.2 |
| **R23/R22** | **-58.1** |
| R24/R23 | -9.9 |
| **R28/R27** | **-21.3** |

The summit cliff (R23-R26 at 10-30, against R22 at 80) is one cause; see section 3.

### On the wide matrix (15 columns)

Flagged: R2/R1 -18.3, R6/R5 -7.1, R8/R7 -10.0, **R11/R10 -38.8**, **R13/R12 -20.8**, R19/R18 -13.9, R21/R20 -23.1 and R24/R23 -5.9.

Unflagged: R27/R26 -2.4 and R28/R27 -3.5. **The summit pair's gate inversion is mostly the five starter columns:** R28 reads 72.4 wide but 63.6 on the gate.

## 3. The headline: the summit's Darlings lists are still the converter's fill

**What the lists are.** R23-R28's Darlings lists come from the stage-2 converter's catalog fill (`convertAvatarReserveDecks`, `darlingsDeck`), which is what `tests/data/avatarReserveDecks.test.ts` pins for Starborne, Drowned Deep and First Dawn bosses.
- R1-R22 moved to the themed builder (`scripts/darlingsDeckBuilder.ts`) on 2026-08-08. The builder's header says why: the converter fill "measured 26-31%".
- The six summit lists are each about **59-67 one-mana singletons**: Skim rituals, life-gain trinkets and pump Charms. The creature counts are 12-21, against the builder's 49-59.

This is the cause of the 1.8.1 summit finding, and of R27's stall. It also explains R28's 46.6.

**Spot check (it decides between plans).** `buildDarlingsDeck(avatar, CARD_DB)` was run for each summit boss. All six lists validate (`validateDarlingsDeck`: no issues), and the Darling is the same. Darlings at 200 seeds:

| Rung | Converter fill (today) | Themed builder | Change | Draws |
| --- | --- | --- | --- | --- |
| R23 Chrome Broodmother | 21.8 | **59.4** | +37.7 | 7 -> 20 (all against Ledger) |
| R24 The Violet Signal Queen | 11.9 | **54.8** | +42.9 | 5 -> 1 |
| R25 The Drowned Deacon | 9.8 | **57.3** | +47.5 | 0 -> 0 |
| R26 The Marsh-Mother | 30.0 | **58.1** | +28.2 | 3 -> 2 |
| R27 The Shepherdess of Giants | 67.9 | **84.0** | +16.1 | **45 -> 3** |
| R28 The Tyrant Queen | 46.6 | **69.5** | +22.9 | 0 -> 0 |

**Reading.** One regeneration does most of the summit's Darlings work:
- It lifts R23-R26 into the R14-R22 band (57-80).
- It ends R27's stall.
- It drops Rite of the Lamp-Fire from R28's list, since the builder does not pick it.

It leaves two things for the tune:
- **R28 still sits under R27, 69.5 against 84.0.**
- R23 has 20 turn-limit draws against Ledger.

## 4. The tune items

Each lever is a list operation. Every lever runs at 200 seeds on the gate and wide matrices (Darlings where that is the format), on the committed list. The second lever waits until the first is confirmed on the wide matrix.

### 4.1 The top tier (T6): no list tune can reach it. Owner call.

**Measured.** T6 reads 65.6 on the floors harness (QC day 65.0; 72.0 during 1.7). That is 7.1 above the .585 band, with F21's noise dip at 0.3.

**Cause.** The T6 brain is hard/0, and it pilots every roster list in rotation: game i uses avatar i mod 28. So each boss list is 1/28 of every floor's games. The 6-point drop since 1.7 was the Medium proxy in the player's seat getting better (the 2026-09-21 note), not the lists.

**The levers that exist:**
1. **Tune the weakest reserve lists the T6 brain pilots.** These are R11 (40.9), R13 (47.4) and R28 (63.6), from sections 4.4-4.6 below. Each +10 on a row is about +0.36 on T6. All the planned tunes together move T6 by **about +1 to +1.5**.
2. **Lift the Easy/Medium lists the T6 brain also pilots.** These are R1-R6; Hestia reads 7.8 under her Easy brain. This is **not recommended**: those lists are the welcome mat, and they are capped at 45 on rungs 1-3.
3. **The tier dial** (`src/ai/tiers.ts`, noise and brain per tier). This is the only lever that moves T6 by points, and it is **AI, frozen for wave 4**.

**Recommendation.** Accept T6 at about 66 against the .585 band. Record that wave 4's list tunes add about +1. If the owner wants 72 back, the tier dial goes to 1.9.x or 2.0, measured against a human, as the 2026-09-21 note itself proposed.

**At the end of wave 4:** add `FLOOR_BANDS` rows 27-28 at .585, and re-read F21 at 200 seeds.

### 4.2 R19, Queen of the Lanterned Roof: closed, no tune

Today she reads **74.8 on the gate** (64/89/62/81/80) against her .675 floor, a 7.3 margin.
- Wide: 74.0 (no flag).
- Darlings: 67.2.

D7's "restore her list, raise her floor toward .57" was done by #402 in 1.8: four Lantern Fixers, 58.6 -> 71.7, and the floor already went past .57 to .675.

The R19/R18 inversion is a peak at R18 (Songstress 89.1), not a weak R19. Recommendation: no change. Her floor ratchets on the end-of-wave reading, as every row's does.

### 4.3 The Darlings summit (R23-R26), and R2's Darlings drop

**Problem.** In Darlings, R23-R26 read 21.8 / 11.9 / 9.8 / 30.0, against R22's 79.9.

**Cause.** Section 3: the lists are converter fill.

**Levers:**
1. **Switch R23-R28 to the themed builder** (measured: +28 to +48).
   - The data change is six `darlingsDeck` literals in `opponents.ts`, in builder order, because order feeds the shuffle.
   - The test change: in the "untuned committed data IS the deterministic converter output" test, the Starborne, Drowned Deep and First Dawn branches change their Darlings pin from `first.darlingsDeck` to `buildDarlingsDeck(avatar, CARD_DB).cards`.
   - It risks nothing gated; Darlings has no gate yet.
2. **After lever 1, per-list hand tunes** only where a row still sits under R14-R22's Darlings band (56-80).
   - The candidate is R24 (54.8), with her Signal Drown (see 4.7).
   - A hand-tuned Darlings list needs a new `HAND_TUNED_DARLINGS` registration. Today a hand-tuned reserve boss skips the Darlings pin entirely, and nothing pins hand-tuned Darlings lists alone.
3. **R23's 20 draws against Ledger.** Read it after the switch, at the end-of-wave measurement. If the Darlings gate keeps a zero-draw termination check, she fails it. Section 7 proposes a draw ceiling instead.

**R2's Darlings drop (12.3 -> 7.0, recorded at PR #521).** It reads **8.5** today (12 draws). It is not the Maiden: the pre-edit list reads 9.3, inside the noise.
- The drop came with the wave-3 Easy fixes (U1: Easy calls her Darling on purpose).
- R2 is the welcome mat. Her gate row reads 7.8, and rungs 1-3 carry only ceilings.
- **Recommendation: accept, no tune.** Record that R2's Darlings row equals her gate row. If the owner wants R2 at or above R1 in Darlings, the lever is her builder-owned list, which would make her a hand-tuned Darlings list. That should not be done for an Easy rung.

### 4.4 The ladder inversions, R28 included

**Accept as the documented shape** (peaks, not soft rungs):
- R19/R18 and R21/R20. Lowering R18 or R20 would mean lowering a boss under a floor that only ratchets up.
- R2/R1. Hestia is the welcome mat.
- R25/R24 (-5.3). Both rows sit above their floors.
- R6/R5. Closed.

**Tune (the lower rung is soft):**

**R28 The Tyrant Queen. Gate 63.6, wide 72.4, Darlings 46.6 (69.5 themed). The summit must top the tower.**

Her reserve is converter-owned. The converter dropped her authored Korru, Eldest of the Trackers (curve cap) and added Blaze-Horn Charge +2, Cinder-Crest +1 and The Fire-Pit +2 to fill. The cells are flat, 57/82/57/62/61; she wins no matchup big.
- **Hypothesis:** too many 2-mana enablers that do nothing alone (Fire-Pit ×3, Spear and Fang ×2, Blaze-Horn ×4, Ring of Embers). There are 16 two-drops, only 6 of them creatures, and the top end is thin.
- **Levers, most promising first:**
  1. **-2 The Fire-Pit +2 Hurled Firebrand** (Firebrand 2 -> 4). That is removal plus 2 to the face: reach, and an answer to the walls that stop her.
  2. **-2 Blaze-Horn Charge +1 Korru +1 Ember-Crest Tyrant.** This restores the authored legend and a second Warcry Provoked tyrant. It moves the curve up by four mana values.
  3. **-2 Spear and Fang +2 Tusk-Rage Tyrant** (2 -> 4). More 5-mana bodies that Provoke into face damage.
  4. -1 Ring of Embers -1 Coal-Thrower +2 Fern-Crest Raptor. This adds 2-drop bodies.
- **Expected:** lever 1 adds +3 to +6 on Tides and Mandate (the removal cells). Levers 2 and 3 lift the Muster and Harvest cells.
- **Risks:** her gate is a termination check only, and she plays short games (17 engine turns), so no time risk. A hand tune makes her HAND_TUNED. The First Dawn branch of the converter test pins reserve and Darlings unconditionally, so that branch must honour `HAND_TUNED_WARCHEST` (a test edit).

**R28 in Darlings, after the section 3 switch.** Themed R28 reads 69.5 against themed R27's 84.0. The owner said to lift R28, not R27.
- **Levers, on her themed list:**
  - drop Great-Horn Herder (no Attack-4 bodies to target until her 5-drops land);
  - drop the weakest one-mana filler for a second burn spell (Hurled Firebrand, or Fire Attack);
  - add Korru and Ember-Crest if the builder left them out.
- I have not measured these. 69.5 -> 84 is +14.5, which is a lot for list edits.
- **Owner question Q3** asks which way to go if R28 cannot pass R27 (section 8).

**Rite of the Lamp-Fire:** gone with the themed switch. Without the switch, the fallback is to cut it from her converter list for her second Fire Attack-shaped burn spell, which needs a Darlings hand-tune registration.

**R27 The Shepherdess of Giants. Gate 68.7, under R26's 75.0.**
- **Recommendation: leave her.** Her gate row is honest, and her list is the Provoked-wall deck by design.
- The tune lifts R28 above R27 instead. A floor for her comes from the end-of-wave reading (about 62 at today's number).

**R11 The Morrigan (gate 40.9; R11/R10 -31.4):** see 4.9.

**R13 Morgan of the Thorn Crown (gate 47.4, 4.4 over her .43 band; R13/R12 -15.7, newly past the harness flag).** Her list is already hand-tuned.
- **Cells:** 27/74/35/63/39. Her weak columns are Muster and Tides, the fast decks.
- **Hypothesis:** her early game is 2 Lantern in Fog and 4 Undertow (tempo, not answers) and 4 Black Chapel Curse (slow). Her removal is 4 Doom Bolt and 1 Reaper's Due, at 3-4 mana.
- **Levers:**
  1. **-4 Black Chapel Curse +4 Cut the Wrappings** (cheap -3/-3).
  2. -2 Lantern in Fog +2 Grave Chill.
  3. -1 Reaper's Due +1 Doom Bolt (a fifth hard answer at 3).
- **Expected:** +5 to +8 on Muster and Tides.
- **Risks:** none gated (she has a band, no floor). The R14 ordering relation (R16 at least R14 - 0.05) does not involve her.

**R8 Cao Cao (63.1, under R7 Yohime's 77.2).**
- **Recommendation: accept.** Yohime is the documented "wall at rung 7", and R8 sits 6.6 over her .565 band.
- If the owner wants it closed, the lever is R8's Muster cell (33): **-3 Jia Xu +3 Doom Bolt** (to 6). That needs a hand-tune registration.

### 4.5 Festival Rocket: closed, no tune

The wave-4 slate measured four Rockets in R23 at 200 seeds, on this AI's Duty timing:
- in place of Ashwood Rangers: **-11.2 gate / -11.5 wide**;
- in place of Starfall Barrage: -7.0 / -7.4;
- worse than a blank in the warband lab.

ai.md's re-measure item closes as "not added". The AI-audit row (Rocket activations are net-negative in Medium's hands) is logged for lane E. No boss list carries the card today.

### 4.6 The shared red core (W3): no tune

- The core is a player-side persona finding (warband, 86% on Medium).
- Boss lists carry its cards only as Darlings singletons: Wreck-Runner in 8 lists, Brazier in 4, Ember-Pot in 8.
- The slate's verdicts stand:
  - Wreck-Runner is covered by the ruled D8 B1 (1.9.x);
  - Brazier is mildly over, and its one lever overshoots;
  - Lu Bu and Ember-Lane Flare now read under.

Nothing for the tower. The sweep reads it again last.

### 4.7 R24: Signal Drown ×2 -> Cold Refusal ×2

**Problem.** Signal Drown's draw needs her own Marked creature, and her list has no Mark source, so the card is a five-mana Cancel.

**Measured (quoted from the wave-4 slate, 200 seeds, e365cc0c):** base 71.5 / with Cold Refusal 72.9 on the gate (+1.4), and 70.5 / 73.2 on the wide matrix (+2.7). Today's base gate is 71.5, the same.

**Lever:** **-2 Signal Drown +2 Cold Refusal** (FD C, {2}{U}: Cancel, then grind 1).
- The gain sits inside the noise, but the card it removes is dead text.
- The Collapse the Lane ×4 alternative read +1.3 / +0.7.

**Ownership.** R24's reserve is a Starborne **authored** list. The test's Starborne branch does not pin her reserve, so the swap needs no registration, but it does edit an authored contract field. Her Darlings list carries one Signal Drown; under the themed switch it carries it too.

**Recommendation:** take the swap. Re-measure gate and wide at 200, and her Darlings row with the same swap (-1 Signal Drown +1 Cold Refusal) on the themed list. Low risk: she has a 7.0 margin on her .645 floor.

### 4.8 R27's Darlings stall: the themed list gives the reach

**Measured.**
- R27 Darlings today: **45 turn-limit draws in 200 games against Sunwell Ledger** (65/51/94/60/71, 45 draws). The usage read had 20 of 100; the pre-edit list has 41.
- Her converter list is 60 one-mana cards, mostly life-gain trinkets (Dawn Torc, Candle in the Window, Glass Slipper and so on). It has no burn and no evasion, so it cannot close.

**With the themed builder:** 84.0, with **3 draws**. The stall is a list artefact, not a deck trait.

**Recommendation:** fix it through section 3's switch, not by accepting it. **Owner question Q2.** If the switch is declined, the fallback is a hand tune of the converter list, cutting about 10 trinkets for Stampede-style Overrun and burn, which needs a Darlings registration. Accepting the stall as a trait is the third option, and its numbers are the 45 draws above.

### 4.9 R11 The Morrigan: recheck after the recost

**Measured.**
- Gate **40.9** (44/52/**16**/31/62), 4.4 over her .365 band.
- Wide **37.5**: the worst wide row from R4 up. Her boss cells read Tides 14, Bloodmoon Masquerade 9, Pride at the Ninth Gate 11, Broodship 14 and Hooves and Fire 12.
- Darlings 59.2.
- Hooves and Fire against her: **88.5%** in 200 games (boss cell 11.5). The usage read had 37 of 40, before the AI fixes.

**Cause (from her list).** Her reserve is converter-owned.
- **She has no 2-drop.** Her curve is 8 one-drops, then 24 three-drops.
- Her one-drops are 4 Bitter Geas (-1/-1 aura) and 4 Barrow Whisper (self-mill and Foresee, in a deck with no graveyard payoff).
- Her only removal is Bitter Geas, so Burning Tides (16) and Mandate (31) run her over.
- The {4}{B}{G} recost put her 2 legends at six mana.

**Levers:**
1. **-4 Barrow Whisper +4 Cut the Wrappings** ({1}{B}, -3/-3). This is a real answer at 2, and it fills the hole in her curve.
2. -4 Bitter Geas +4 Grave Chill (an instant -2/-2 in place of the aura), or +4 Doom Bolt for the top end.
3. -3 Crowbone Prophet +3 of a B/G 2-drop body (she has none; even Black Dog of the Lane costs 3), chosen after lever 1 reads.

**Expected:** lever 1 adds +8 to +12 on Tides and Mandate.

**Risks:** she has a band, no floor. A hand tune registers her in `HAND_TUNED_WARCHEST`. It moves T6 by about +0.3.

### 4.10 Great-Horn Herder and Fern-Crown Tyrant in the Darlings lists

**Where they are:**
- Fern-Crown Tyrant is in the builder-owned Darlings lists of R1, R3, R7, R11 and R12. Each carries 2-3 Dinokin, so her arrival Hunt rarely fires (0.07-0.18 Hunts a cast).
- Great-Horn Herder is in R1 and R11 (R11: no Attack-4 bodies, 34% cast, 8 uses).
- The themed summit lists add both to R26-R28.

**Levers:**
1. **A builder rule** in `scripts/darlingsDeckBuilder.ts`: skip a conditional card whose condition the list cannot meet. Fern-Crown would need at least N other Dinokin, and Herder at least M creatures with Attack 4 or more.
   - **Recommended.** It is one regeneration of every builder-owned list, and it keeps them generated.
   - It moves R1, R3, R7, R11, R12 and (after section 3) R26-R28 by one card each.
2. Per-list swaps. Each list then becomes a hand-tuned Darlings list, which needs a registration, and five or more of them is churn.

**Expected:** small, about a point. Each is one card in 79.

**Order:** do it **before** section 3's regeneration, so the summit lists are built once.

### 4.11 New, not on the contract's list: R15 Carmilla's floor margin is 2.1

**Measured.** Gate **67.6** (54/65/47/87/85) against her **.655** floor: a 2.1-point margin. She read 72.3 on QC day and about 72 at the floor's setting.

**Where she lost it.** Against the QC-day cells (61/78/52/85/86), today reads 54/65/47/87/85:
- **Communion: -13** (78 -> 65)
- **Muster: -7**
- **Tides: -5**

Her converter list is 10 catalog singletons out of 40, and the First Dawn regen (wave 3) swapped two of them: Kesh, Raptor-Rider and Rage-Horn Tyrant in, Sun-Rope Hauler and Black Chapel Curse out.

**Spot check (it decides between plans).** Her pre-First Dawn converter list (-1 Kesh, -1 Rage-Horn, +1 Sun-Rope Hauler, +1 Black Chapel Curse) at 200 seeds:

| Matrix | Pre-FD list | Today |
| --- | --- | --- |
| Gate | **69.3** (53/69/52/87/86) | 67.6 |
| Wide | **68.1** | 67.9 |

That is +1.7 and +0.2, both inside the noise. **The First Dawn regen is not the cause.** The drop came with the brain changes between the floor's setting and today (waves 2-3 and the wave-4 Medium fixes). Those changes made the Medium-piloted starter columns, Communion most of all, better at handling her. Restoring the old list is not a lever.

**How exposed she is.** The CI gate is seeded, so it reads the same on every run and passed today (`winrate.test.ts` is green). But any later list or AI change re-rolls her 40-seed sample, and a 2.1-point margin sits inside the 6.5-point band that floors are set against.

**Levers, most promising first.** All need a hand-tune registration.
1. **-1 Kesh, Raptor-Rider -1 Rage-Horn Tyrant +2 Hurled Firebrand** (3 damage to a creature plus 2 to the face). Removal that is also reach, aimed at the Communion and Muster bodies that now hold her off.
2. Collapse singletons into her own playsets: -1 Sun Ce -1 Madame Macabre +2 Blood-Opera Soloist (to 4). More Dreaded attackers.
3. -1 Due to the Deep -1 Bean Sidhe Keening +2 Doom Bolt.

**Expected:** +3 to +6, mostly on Communion and Muster.

**Risks:** this is a floor. Per the plan's rule ("her list tune is pulled forward"), she goes **first** in the order.

## 5. Converter-owned and hand-tuned lists

| Surface | Owner | Who |
| --- | --- | --- |
| Reserve | Converter (pinned to `convertAvatarReserveDecks`) | R1 Meng Huo, R2 Hestia, R3 Lupa, R4 Hera, R5 Zhurong, R6 Sima Yi, R7 Yohime, R8 Cao Cao, **R11 the Morrigan**, R12 Titania, **R15 Carmilla**; R27 and R28 (the First Dawn branch, pinned unconditionally) |
| Reserve | Hand-tuned (`HAND_TUNED_WARCHEST`; the test asserts the list *differs* from the converter) | R9 Hel, R10 Brunhild, R13 Morgan, R14 Artoria, R16 the Bride, R17 Glass-Coffin, R18 Songstress, R19 Lanterned Roof, R20 Kitsune, R21 Anubis, R22 Bastet, R23 Broodmother, R25 Deacon, R26 Marsh-Mother |
| Reserve | Authored, unpinned | R23 and R24 (Starborne's locked authored lists) |
| Darlings | Themed builder (pinned to `buildDarlingsDeck(avatar, PRE_STARBORNE_DB)`) | R1-R8, R11, R12, R15 (non-hand-tuned) |
| Darlings | Unpinned literals | Every hand-tuned reserve boss above except R23, R25, R26 |
| Darlings | Converter fill (pinned) | **R23-R28** |

What a hand tune means for the converter test:

| Case | What it takes |
| --- | --- |
| A converter-owned reserve (R11, R15) | Add the id to `HAND_TUNED_WARCHEST` with a dated, measured-intent comment. The test then asserts the list no longer equals the converter output, so a "tune" that lands back on the converter's list fails it. That is correct. |
| The First Dawn pair (R27, R28) | The `isFirstDawn` branch runs before the hand-tuned check and pins reserve and Darlings unconditionally. A hand tune of R28 needs that branch to respect `HAND_TUNED_WARCHEST`. |
| Any Darlings hand tune | Needs a new set, because no mechanism today pins "Darlings hand-tuned, reserve converter". |
| Section 3's switch | Changes the pin for R23-R28 Darlings to the themed builder. It is a pin change, not a hand-tune exemption. |
| Wild Communion (section 0, option A) | `HAND_TUNED_STARTER_IDS` in `tests/data/starterReserveDecks.test.ts`. |

## 6. RUNG_BANDS 1-13 re-centre (OWNER CALL)

**Method.** The same as every other band: the 200-seed mean minus 6.5, rounded down to the half point. The ceilings on R1-R6 are kept. **Re-centre on the end-of-wave reading, not on today's**, because R11 and R13 are planned tunes. Today's numbers for reference:

| Rung | Current band | Today (gate, 200 seeds) | Proposed minimum (today's numbers) | Direction |
| --- | --- | --- | --- | --- |
| R1 | at most 45, cell at most 65 | 23.7 (max cell 50) | keep | - |
| R2 | at most 45, cell at most 65 | 7.8 (max cell 21) | keep | - |
| R3 | at most 45, cell at most 65 | 24.1 (max cell 52) | keep | - |
| R4 | 22-62 | 38.2 | 31.5-62 | up |
| R5 | 37-67 | 43.6 | 37.0-67 | same |
| R6 | 15.5-72 | 42.3 | 35.5-72 | up |
| R7 | at least 69.5 | 77.2 | 70.5 | up |
| R8 | at least 56.5 | 63.1 | 56.5 | same |
| R9 | at least 61 | 69.0 | 62.5 | up |
| R10 | at least 69 | 72.3 | **65.5** | **down** |
| R11 | at least 36.5 | 40.9 | 34.0 now; re-read after 4.9 | **down** today; up after the tune |
| R12 | at least 52 | 63.1 | 56.5 | up |
| R13 | at least 43 | 47.4 | 40.5 now; re-read after 4.4 | **down** today |

Three bands (R10, R11, R13) would come **down** on today's numbers. Only the owner authorizes that.

**Also for the owner: RUNG_BANDS 14-26 have drifted below the gate floors.** The 2026-09-19 sync comment says they move together, but these pairs differ:

| Rung | RUNG_BANDS | Gate floor |
| --- | --- | --- |
| R16 | .625 | .645 |
| R17 | .705 | .715 |
| R18 | .82 | .825 |
| R19 | .65 | .675 |
| R20 | .815 | .835 |
| R23 | .655 | .675 |
| R25 | .595 | .605 |

The 1.8.5 ratchet moved the floors and not the bands. Syncing them is an upward move, so it needs no owner sign-off. Do it in the end-of-wave PR, and add R27 and R28.

## 7. Ordering and interactions

**`opponents.ts` is single-writer, so the tunes run one list at a time.** In order:

1. **Wild Communion** (section 0). This is the main session's decision. It moves a gate column for every rung (about +0.4 on rows under option B, 0 under A), so it lands before any boss is measured against it.
2. **R15 Carmilla** (floor at risk; 4.11).
3. **The builder rule** (4.10). Regenerate every builder-owned Darlings list, then measure Darlings R1-R12.
4. **The summit Darlings switch** (section 3), with the R24 Signal Drown change on her themed list. Measure Darlings R23-R28.
5. **R28**: reserve (gate and wide), then her themed Darlings list.
6. **R24's reserve** (Cold Refusal).
7. **R11**, then **R13**. The lower tower. R8 only if the owner wants R8/R7 closed.
8. The end-of-wave measurement (section 8).

**Interactions:**
- The gate, wide and Darlings **columns** are starters, theme precons and shop precons, and no tune touches them except step 1. So boss tunes do not move each other's rows.
- The **floors harness** rotates every reserve list, so every reserve tune moves every floor by about 1/28 of its own change. Read the floors once, at the end.
- **Ordering relations** in `winrate.test.ts` (R16 at least R14 - 5; R20 at least R19) involve no planned tune.
- **Time:** R27's gate at 40 seeds is the slowest summit cell (her games are long). A stronger R28 shortens her games, so no time risk there. A Darlings gate is new time (see below).

## 8. The end-of-wave measurement and the ratchet

On the tip after the last tune, one job at a time:

1. **Gate:** `--avatars --seeds 200`, all 28 rows, 28,000 games. With the 4-shard runner this takes about 75 minutes of CPU, about 20 minutes wall.
   - Floors for R15-R26 ratchet to max(standing, mean - 6.5 rounded down to .5).
   - **New floors for R27 and R28** use the same rule, in the existing First Dawn test, which gains floor asserts. Today's numbers would give about .62 and .57.
   - Add RUNG_BANDS 27-28 and sync 14-26 to the floors.
2. **Wide:** `--avatars-reserve --seeds 200`, on every tuned row at least. This confirms each tune (no gate).
3. **Darlings:** `--avatars-darlings --seeds 200`, all 28.
   - **New gate: the summit's Darlings rows R23-R28**, with floors = mean - 6.5 rounded down, at 40 seeds, in two tests (R23-R25 and R26-R28).
   - Timing at 40 seeds: R23 about 67 s, R24 49, R25 45, R26 62, R27 136, R28 70. That is about 430 s locally, about 680 s on CI at 1.57x, so it must be split.
   - **Termination:** use a draw ceiling, not zero draws (for example, at most 2 of 200 per row). Darlings has command-zone stalls by format, and R23 themed draws 20 of 200 against Ledger today. Owner question Q5.
4. **Floors:** `--floors --seeds 80`, plus F21 at 200. Add FLOOR_BANDS 27-28 at .585.
5. **`tests/ai/winrate.test.ts` alone**, then the light ladder. Today's run: 8/8 green, 470 s.

## 9. Owner questions

| # | Question | Options | Recommendation |
| --- | --- | --- | --- |
| Q1 | Wild Communion after the Maiden recost | (A) keep Mother of the Long-Necks, registering the starter hand-tuned; (B) take the converter's Maiden and rewrite the Mark-supply premise test | **A**. It keeps the only Mark source in the columns, and the player's weakest starter is not weakened (B costs that column 2 points) |
| Q2 | Summit Darlings lists R23-R28 | (A) switch to the themed builder (+16 to +48, R27's stall gone); (B) hand-tune each converter list | **A** |
| Q3 | Darlings after the switch, R28 69.5 against R27 84.0 | (A) lift R28's themed list by hand tune; if it cannot pass R27, (B) accept R27 over R28 in Darlings only, or (C) use a weaker R27 list | **A, then B**. Leave R27 alone, per the owner's "lift her, not R27" |
| Q4 | T6 at 65.6 (band .585, 72 in 1.7) | (A) accept, list tunes add about +1; (B) tier-dial retune after the AI freeze (1.9.x or 2.0) | **A** now. B is the only real lever |
| Q5 | Darlings gate termination | (A) zero draws, like the gate; (B) a draw ceiling | **B**. Darlings stalls by format |
| Q6 | RUNG_BANDS 1-13 | re-centre on the end-of-wave reading; R10, R11 and R13 would come down on today's numbers | **Re-centre at the end**, owner-authorized |
| Q7 | R8/R7 (Cao Cao 63 under Yohime 77) | (A) accept the documented shape; (B) lift R8 (+3 Doom Bolt, hand-tuned) | **A** |

## 10. Commands run

All `npx tsx` runs were from the worktree. S = `scratchpad/w4/tunes`.

| What | Command |
| --- | --- |
| Converter before and after | `npx tsx scripts/avatarReserveDecks.ts --print` -> `S/convert.before.txt`, `convert.after.txt`, `convert.after2.txt` |
| Exact pinned-list diffs | `npx tsx S/pin-diff.mts`, `S/starter-diff.mts`, `S/order-check.mts` |
| Corpus | `npx tsx scripts/blades-db.ts build`, `... terms --check` (temporary copy, removed) |
| Light ladder | `npx tsc --noEmit`; `npm run lint`; `npm run check-art-bible`; `npx tsx scripts/gen-docs-tables.ts --check`; `npm run check-docs`; `npx vitest run tests/data tests/power --maxWorkers 4` |
| Win-rate gates | `npx vitest run tests/ai/winrate.test.ts --maxWorkers 1` (alone) |
| Baseline queue (`S/queue1.sh`, one job at a time) | `S/run-job.sh <tag> <mode> <seeds> <ids> [variant]`: gate 200 all; gate-wildmaiden 200 all `--col starter-wild`; darlings 200 all; darlings-themed 200 R23-R28 `--list themed-summit.json`; pre-gate R27; pre-darlings R2, R4, R27; floors 80; wide 200 all. pre-wide R27 was **stopped after 37 s by me**, because R27's wide unit runs about 32 minutes on one worker and its gate and Darlings pairs had already shown the edit is noise. It has no output |
| Spot check | `NW=1 S/run-job.sh carmilla-prefd-gate gate 200 R15 --list S/prefd-carmilla.json`, then the same with `wide`. `S/queue2.sh`, a detached waiter for this, failed: it was launched without PATH, so its `sleep` was not found and it busy-looped on one core for about two hours, then exited without running anything. The spot check was then run by hand |
| Summaries | `npx tsx S/summarize.mts <tag> [baseTag]`, `npx tsx S/table.mts` |

## 11. Phase 2 results (2026-10-04)

All numbers are 200 seeds per cell. Gate = the 5 starter columns; wide = 15 columns. Variants were in-place swaps on the committed list. A second lever was stacked only after the first was confirmed on the wide matrix. Every committed list was re-measured, or checked to be the measured list in the same order.

| # | Item | Result | Gate before -> after | Wide before -> after | Darlings before -> after |
| --- | --- | --- | --- | --- | --- |
| 1 | Wild Communion (Q1 A) | `starter-wild` registered in `HAND_TUNED_STARTER_IDS`; she keeps Mother of the Long-Necks | unchanged | unchanged | - |
| 2 | R15 Carmilla | **No lever found; list kept.** Eleven swaps measured, 62.9-68.0, none outside the noise | 67.6 (kept) | 67.9 | - |
| 3 | Darlings builder rule (4.10) | `unsupportedCondition` in `scripts/darlingsDeckBuilder.ts`: a card needs 6 other supporting creatures in the list. Fern-Crown left R1, R3, R7, R11 and R12; Great-Horn Herder stays (those lists hold at least 6 Attack-4 creatures) | - | - | R1 32.0 -> 31.9, R3 28.8 -> 27.5, R7 71.0 -> 70.3, R11 59.2 -> 59.0, R12 70.2 -> 69.9 (R1 draws 47 -> 22) |
| 4 | Summit Darlings switch (Q2 A) | R23-R28 built by the themed builder; the test pins changed | - | - | R23 21.8 -> 58.3; R24 11.9 -> 54.8 (-> 55.4 with item 6); R25 9.8 -> 57.3; R26 30.0 -> 56.8; R27 67.9 -> 84.0 (draws 45 -> 3); R28 46.6 -> 69.5 |
| 5 | R28 reserve | **Taken:** -2 Fire-Pit +2 Hurled Firebrand, then -2 Blaze-Horn Charge +1 Korru +1 Ember-Crest. Registered hand-tuned | 63.6 -> **68.5** | 72.4 -> **76.0** | - |
| 5b | R28 Darlings (Q3) | **Not taken.** Burn / no walls / dead cards / all three / Dinokin density read 71.0 / 68.0 / 69.1 / 69.9 / 66.8 / 68.5. R27 stays above her in Darlings, as the owner ruled | - | - | 69.5 (builder list kept) |
| 6 | R24 Cold Refusal | Reserve -2 Signal Drown +2 Cold Refusal (authored list). Darlings -1/+1, registered in `HAND_TUNED_DARLINGS` | 71.5 -> **72.9** | 70.1 -> **73.1** | 54.8 -> **55.4** |
| 7 | R11 The Morrigan | **Taken:** -4 Barrow Whisper +4 Cut the Wrappings, then -3 Crowbone Prophet +3 Court Archer. Registered hand-tuned | 40.9 -> **64.8** | 37.5 -> **62.3** | 59.0 (unchanged) |
| 8 | R13 Morgan | **Taken:** -4 Black Chapel Curse +4 Cut the Wrappings, then -2 Lantern in Fog +2 Grave Chill. Already hand-tuned | 47.4 -> **54.4** | 47.9 -> **59.8** | unchanged |

**Rejected levers** (gate / wide):

| Rung | Lever | Gate | Wide |
| --- | --- | --- | --- |
| R28 | -2 Spear and Fang +2 Tusk-Rage | 65.1 | 74.0 |
| R28 | the same, stacked third | 69.2 | 76.7 (below the pair's 77.1) |
| R28 | Ring of Embers and Coal-Thrower for 2 Fern-Crest Raptor | 63.0 | - |
| R28 | on top of the pair: 2 Kindler for 2 Fern-Crest Raptor | 67.8 | - |
| R28 | on top of the pair: 2 Coal-Thrower for 2 Horn-Crest Charger | 62.6 | - |
| R28 | on top of the pair: 2 Kindler for 2 Ridge-Raptor | 62.9 | - |
| R28 | on top of the pair: 2 Grip for 2 Fern-and-Fire | 68.5 | - |
| R11 | -4 Bitter Geas +4 Grave Chill, alone | 47.5 | 45.7 |
| R11 | the same, stacked third | 69.4 | 68.4 (lifts her past R12) |
| R11 | -4 Barrow Whisper +4 Doom Bolt | 43.6 | - |
| R13 | -4 Undertow +4 Cut the Wrappings | 45.1 | - |
| R13 | -4 Black Chapel Curse +4 One Clean Cut | 46.6 | - |
| R13 | third lever: -2 Undertow +2 Grave Chill | 55.4 | - |
| R13 | third lever: -2 Omen Raven +2 Salt in the Wound | 55.2 | - |

**Gate ladder after the tunes:**
- R10 72.3 > **R11 64.8** > R12 63.1. R11/R10 goes from -31.4 to -7.5. R12/R11 reads -1.7, which is noise.
- R12 63.1 > **R13 54.4**. The gap was -15.7 and is now -8.7, under the harness's 12-point flag.
- R26 75.0, R27 68.7, **R28 68.5**. R28 and R27 are now level (noise), and both still sit under R26.

**On the wide matrix**, R28 (76.0) is above R27 (75.9).
