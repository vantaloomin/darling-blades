<!-- source-of-truth: tests/ai/winrate.test.ts, scripts/balance-matrix.ts, src/config/rules.ts · last-verified: 2026-10-16 · measurement record — the 2.0 P8 one-time floor reset at starting life 25 -->

# 2.0 floor reset at 25 life (P8)

> **Record, not spec.** The one owner-approved re-baseline of every test gate floor at the new starting life ([plan-2.0.md](plan-2.0.md) P8, ruled 2026-10-08; the life ruling 2026-10-08, "flip at the reset" 2026-10-09). Branch `feat/20-floor-reset-25` from `release/2.0` 9dcf528b. Rule: floor = 200-seed mean - 6.5, rounded down to the half point; every floor that drops is listed. After this PR floors only ratchet up again.

**Status: review point (c), done. Every floor, ceiling and band is set (sections 5-7); R15 Carmilla was lifted over R14 (section 6). The PR opens from the cloud thread.**

## 1. The flip

- `RULES.startingLife` 20 -> 25 (`src/config/rules.ts`). `docs/rules.md` regenerated and its prose updated.
- Replays: `GameConfig.startingLife` and the v17 log field exist (#602). `createReplayDraft` records `RULES.startingLife`; `replayStartingLife` maps a log without the field to 20, and `DuelScene` passes it when replaying. Checked; no change needed.
- Tests that assumed 20 at the rules default, fixed: `tests/engine/darlingZone.test.ts` and `tests/engine/landArrival.test.ts` (now `RULES.startingLife + n`), `tests/engine/overchargeNotAMark.test.ts` (compared the `board()` fixture's 20 against the rules default; now compares against the fixture's own life), `tests/meta/replay.test.ts` (the legacy-log test now records its game at 20 explicitly, so it still proves a pre-v17 log replays at 20).
- `tests/personas/fanout.test.ts` "merges fanned-out crafts": the equivalence still holds byte for byte, but at 25 life the seed-13003 loop stops after 4 crafts instead of 6, so it no longer reaches both response rounds. Moved to seed 13005, the first after it that reaches six crafts at 25 (13004 also stops at 4).
- Glossary, tutorial copy, music (`selectDuelMood` takes a fraction of `startingLife`) and the Story code read nothing at 20. Unit fixtures that set life 20 explicitly (`makeTestState`) are fixtures, not the rules default, and stay.

**Taste-sensitive, listed rather than decided:**

1. **The AI's life curve** (left as is: the AI is frozen and the P14 retune follows the life change) (`src/ai/evaluate.ts`, `14 * tanh(life / 9)`, knee `LIFE_CURVE_KNEE`; the clock terms use `their.life * 0.5`). Not scaled with starting life. At 25 the top 5 points are worth almost nothing to the evaluator. Plan-2.0 D3 says "the scorer's life-related terms re-derived"; that is an AI tune and would move every reading, so it is not in this PR. The readings below are the AI as it stands.
2. **`burnFaceLife: 20`** on R5 Zhurong (`src/data/opponents.ts`) meant "burn face from the first turn" at 20 life; at 25 she would hold burn until the foe is at 20. **Scaled to 25** (the recommended default, its own commit, before R5 is measured), pending the owner's pick. Default `burnFaceLife` is 8. Story opponents use 30 and are unaffected.
3. **`docs/ai.md`** and the evaluator comments say "nearly worthless at 20"; still true, left.
4. **Medium >= .80 vs Easy and Hard >= .70 vs Medium** (`winrate.test.ts`) are plan targets on TEST_DB decks, not mean-6.5 floors. Kept as targets: measured and reported, not moved.

## 2. Inventory of gates with a measured floor, band or ceiling

| Gate | Where | Today | Harness | Measured here by |
| --- | --- | --- | --- | --- |
| Medium beats Easy | `winrate.test.ts:93` | >= .80 (plan target) | test loop, TEST_DB GR/WB, 200 seeds | the test itself |
| Hard beats Medium | `winrate.test.ts:121` | >= .70 (78.0 measured 2026-07-02) | same, seeds 5000+ | the test itself |
| R15-R18 floors | `winrate.test.ts:256-270` | .655 / .645 / .715 / .825 | `runAvatarMatrix(40)` | `--avatars --seeds 200` |
| R19-R22 floors | `:305-336` | .68 / .835 / .585 / .685 | same | same |
| R23-R24 floors | `:373-379` | .675 / .66 | same | same |
| R25-R26 floors | `:447-456` | .605 / .685 | same | same |
| R27-R28 floors | `:408-411` | .62 / .695 | same | same |
| Rung order checks | `:271-277, :337` | R15 > R14, R16 >= R14 - .05, R17 > R16, R18 > R17, R20 >= R19 | same | same |
| Zero-draw / decided checks | R17-R28 cells | 0 draws at 40 seeds | same | same |
| Darlings summit floors | `:476-490` | R23 .515, R24 .485, R25 .505, R26 .50, R27 .775, R28 .63 | `runAvatarReserveMatrix('darlings', 40)` | `--avatars-darlings --seeds 200` R23-R28 |
| Darlings draw ceilings | same | R23 10, R27 3, the rest 2 (200-seed draw rate + 3 SD, min 2) | same | same |
| `RUNG_BANDS` 1-14 | `scripts/balance-matrix.ts:443` | harness bands, not CI floors (P8, 1.9 Q6) | `runAvatarMatrix` flags | `--avatars --seeds 200` |
| `RUNG_BANDS` 15-28 | same | equal to the gate floors by rule | same | synced to the new floors |
| `FLOOR_BANDS` | `balance-matrix.ts:1815` | harness bands, no CI test | `runFloorMatrix` | `--floors --seeds 80` (if run) |
| Coarse progression bands | `tests/meta/economyGates.test.ts:116` | `COARSE_PROGRESSION_BANDS` | progression sim, real duels | passes at 25 (the fast suite) |
| Optimizer cap | `tests/meta/optimizerCap.test.ts:59` | <= 1.5x | progression sim | passes at 25 |
| AI smoke | `tests/ai/ai-smoke.test.ts:44` | >= 20 of 30 games won on life | Easy mirror | passes at 25 |
| Divergence | `tests/ai/divergence.test.ts:56` | attack-rate gap >= .15 | custom loop | passes at 25 |
| First Dawn rate anchors | `tests/power/firstDawnRates.test.ts` | lab 95% intervals | static scorer, plays no games | not re-measurable here (local lab) |

`tests/ai/balance.test.ts` asserts on `RUNG_BANDS` and `FLOOR_BANDS` but is `describe.skip`. `tests/ai/tiers.test.ts` checks static tier tables and synthetic numbers only; it has no measured floor.

## 3. How it is run

A local resumable runner (not committed): each rung is one unit that calls the committed `runAvatarMatrix` or `runAvatarReserveMatrix` for that rung alone, so every cell keeps the committed harness's per-(rung, column) seed and the first 40 seeds are CI's. One JSON per unit on disk; a stopped run resumes. Four workers, below-normal priority, `OMP_NUM_THREADS=1 ORT_NUM_THREADS=1`, one job at a time. A passive hook on the telemetry finish records how each game ended (life, deck, draw) and its length; checked to leave the results byte-identical.

## 4. The gate at 25 (`--avatars`, 200 seeds/cell)

Measured 2026-10-16 at `feat/20-floor-reset-25` 5c76ad5e (25 life, Zhurong's `burnFaceLife` 25). 28,000 games, 5 draws, about 23 minutes wall on four workers. "20 now" is the same harness on the same commit with `RULES.startingLife` set to 20 in the measuring process, for the summit only; it reproduces the 1.9 wave-4 reading within 0.5 points on every rung, so the moves below come from the life change, not from drift since 1.9. "Deck" is games (of 1,000) that ended by a player drawing from an empty deck. Cells in Muster / Communion / Tides / Mandate / Harvest order.

| Rung | Boss | 25 life (cells) | 1.9 at 20 | 20 now | Deck at 25 (at 20) | Mean turns 25 (20) | 40 seeds at 25 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Meng Huo | 19.3 (12/10/23/41/12) | 23.7 | | 0 | 17.5 | |
| R2 | Hestia | 5.7 (6/4/3/14/3) | 7.8 | | 2 | 20.9 | |
| R3 | Lupa, Wolfqueen | 18.8 (9/2/26/42/16) | 24.1 | | 0 | 15.8 | |
| R4 | Hera | 34.2 (21/51/27/32/41) | 38.2 | | 70 | 24.6 | |
| R5 | Zhurong | 40.8 (40/31/38/55/40) | 43.6 | | 0 | 19.4 | |
| R6 | Sima Yi | 46.1 (48/86/27/32/39) | 42.3 | | 14 | 25.8 | |
| R7 | Yohime | 76.3 (63/87/76/72/85) | 77.2 | | 3 | 20.1 | |
| R8 | Cao Cao | 70.4 (41/94/68/87/63) | 63.1 | | 0 | 19.0 | |
| R9 | Hel | 67.6 (62/86/64/73/54) | 69.0 | | 151 | 19.9 | |
| R10 | Brunhild | 79.5 (73/87/55/92/92) | 72.3 | | 0 | 19.1 | |
| R11 | The Morrigan | 71.2 (79/91/36/55/95) | 64.8 | | 0 | 22.1 | |
| R12 | Titania | 66.1 (38/98/73/63/60) | 63.1 | | 4 | 23.2 | |
| R13 | Morgan | 56.8 (52/88/46/59/40) | 54.4 | | 21 | 27.2 | |
| R14 | Artoria | 73.2 (35/97/73/81/81) | 67.2 | | 0 | 21.2 | 76.0 |
| R15 | Carmilla | 68.8 (55/70/46/85/89) | 67.6 | 67.5 | 0 (0) | 17.2 (15.7) | 71.5 |
| R16 | The Bride | 77.0 (76/81/53/82/94) | 71.0 | 71.0 | 0 (0) | 19.8 (18.2) | 75.5 |
| R17 | Glass-Coffin Queen | 84.4 (85/82/70/95/91) | 78.0 | 78.0 | 0 (0) | 23.8 (21.9) | 86.5 |
| R18 | Abyssal Songstress | 90.7 (94/96/76/92/96) | 89.1 | 89.1 | 0 (0) | 19.2 (17.7) | 89.0 |
| R19 | Lanterned Roof | 77.9 (74/92/62/80/82) | 74.8 | 73.5 | 18 (10) | 24.0 (21.8) | 73.0 |
| R20 | Kitsune Neon Tyrant | 90.0 (76/95/88/95/97), 2 draws | 90.2 | 90.2 | 0 (0) | 14.6 (13.2) | 91.5 |
| R21 | Anubis | 67.3 (76/89/70/57/45) | 62.8 | 61.2 | 0 (0) | 23.8 (21.8) | 70.0 |
| R22 | Bastet | 78.5 (60/91/67/86/90) | 75.2 | 75.2 | 1 (2) | 17.9 (16.9) | 77.0 |
| R23 | Chrome Broodmother | 80.9 (70/91/73/74/97) | 74.1 | 75.6 | 0 (0) | 20.5 (19.1) | 80.5 |
| R24 | Violet Signal Queen | 76.5 (61/95/67/64/96), 1 draw | 72.9 | 72.6 | 3 (3) | 22.8 (20.9) | 80.0 |
| R25 | The Drowned Deacon | 68.4 (49/69/64/88/73) | 66.2 | 65.5 | 57 (40) | 19.8 (18.3) | 70.5 |
| R26 | The Marsh-Mother | 76.1 (61/89/71/76/84) | 75.0 | 74.8 | 5 (2) | 20.4 (18.4) | 73.5 |
| R27 | Shepherdess of Giants | 71.2 (50/97/77/58/75) | 68.7 | 68.7 | 27 (18) | 28.0 (25.7) | 70.0 |
| R28 | The Tyrant Queen | 81.2 (72/87/71/90/88) | 76.0 | 75.8 | 0 (0) | 17.3 (15.7) | 83.0 |

**What 25 does.** The summit gains (13 of 14 rungs up, by 1 to 7 points); the low aggro rungs R1-R5 lose 3 to 5 points (the starters survive their rush); games run 1.5 to 2.5 turns longer. Decking stays small except where it is the plan: Hel (R9, mill-reanimator) ends 151 of 1,000 games by deck and Hera (R4) 70; the summit's grind decks deck a little more than at 20 (Deacon 57 against 40). Draws stay negligible (5 in 28,000; at 40 seeds, CI's sample, none).

## 5. The gate floors (`tests/ai/winrate.test.ts`)

Floor = 200-seed mean at 25 - 6.5, rounded down to the half point. Each passes at CI's 40 seeds (the last column above). **No gate floor drops.** R15 is set from her reading after the lift in section 6; before it her candidate was .62, a drop from .655.

| Rung | Old floor | New floor | Direction |
| --- | --- | --- | --- |
| R15 Carmilla (lifted, 77.7) | .655 | .71 | up |
| R16 | .645 | .705 | up |
| R17 | .715 | .775 | up |
| R18 | .825 | .84 | up |
| R19 | .68 | .71 | up |
| R20 | .835 | .835 | same |
| R21 | .585 | .605 | up |
| R22 | .685 | .72 | up |
| R23 | .675 | .74 | up |
| R24 | .66 | .70 | up |
| R25 | .605 | .615 | up |
| R26 | .685 | .695 | up |
| R27 | .62 | .645 | up |
| R28 | .695 | .745 | up |

**R15 Carmilla's reading:** 68.8 at 200 seeds before the lift (67.5 at 20 on this commit, 67.6 at 1.9), **77.7 after it**; floor .71. Her old .655 sat above her own candidate since 1.9 (61.0) and was held only by the ratchet.

**Medium >= .80 vs Easy and Hard >= .70 vs Medium** are plan targets, measured and kept (section 7).

**Order checks at 25, after the lift:** R15 > R14 (77.7 against 73.2; 40 seeds 77.0 against 76.0), R16 >= R14 - .05, R17 > R16, R18 > R17, R20 >= R19 all hold; R28 still tops R26 and R27. R15 now reads 0.7 above R16 at 200 seeds (no check asserts that order).

## 6. The R14/R15 order and the Carmilla lift

At 25, `rung 15 must clear rung 14` (`winrate.test.ts`) failed: R14 Artoria gains 6 points (67.2 -> 73.2) and Carmilla 1.2, so R14 topped R15 by 4.4 at 200 seeds and by 4.5 at CI's 40 (76.0 against 71.5); at 20 the margin was 0.4. Ruling (default, 2026-10-16): lift the higher rung, never weaken the lower (the 1.9 R28-over-R27 precedent); the check stays as it is.

Measured at 25 life, 200 seeds/cell, cells Muster / Communion / Tides / Mandate / Harvest:

| Variant | Avg | Cells |
| --- | --- | --- |
| Standing list | 68.8 | 55/70/46/85/89 |
| Three personality variants (aggression, attackThreshold, removalBias) | 68.9-69.0 | no move |
| Eighteen card-list variants (singletons for Dragonmaid / Bog Banshee / Xuchu / Rainflash Duelist playsets, Elizabeth or Heiress swaps, a full rebuild) | 62.2-73.4 | best 59/80/50/91/89 |
| **Basics for her four Burning Luoyang (taken)** | **77.7** | **68/80/56/93/93** |
| One Luoyang kept | 77.0 | 66/80/56/92/93 |
| Best lists plus basics | 81.0-83.7 | (past R16, near R17) |

The tapped duals were the lever: every Luoyang enters tapped. The taken change is lands only, every card list unchanged: her classic `deck` lands become 12 Swamp + 12 Mountain, and her `landReserve` (which the converter derives from them, pinned by `tests/data/avatarReserveDecks.test.ts`) becomes 5 Swamp + 5 Mountain. CI's 40 seeds 71.5 -> 77.0; the 15-column matrix 68.6 -> 77.1, up in all 15 columns; 0 draws, 0 decked games. Artoria is untouched. It also changes her Darlings land base (not gated at R15).

## 7. Darlings, the TEST_DB targets and `RUNG_BANDS`

**Darlings summit** (`--avatars-darlings --seeds 200` at 25, Red Cliffs / Queen Below / Sunwell / Mirror-Blood / Sable order; 1.9 at 20 in brackets):

| Rung | Reading at 25 | Draws in 1,000 | Floor | Draw ceiling |
| --- | --- | --- | --- | --- |
| R23 | 59.6 (49/48/98/46/57) [58.3] | 30 [18] | .515 -> .53 | 10 -> **14** (loosens) |
| R24 | 59.7 (47/40/96/53/64) [55.4] | 0 | .485 -> .53 | 2 |
| R25 | 61.1 (45/44/95/54/68) [57.3] | 0 | .505 -> .545 | 2 |
| R26 | 61.8 (51/44/98/53/64) [56.8] | 0 | .50 -> .55 | 2 |
| R27 | 87.7 (89/79/91/84/96) [84.0] | 4 [3] | .775 -> .81 | 3 -> 4 (loosens) |
| R28 | 72.6 (64/59/99/64/78) [69.5] | 1 [0] | .63 -> .66 | 2 |

Ceiling = the 200-seed draw rate scaled to 200 games plus three standard deviations, rounded up, at least 2 (1.9 Q5). Two ceilings rise with the longer games; R27 still tops R28 in Darlings.

**TEST_DB targets** at 25 (the tests' own 200 seeds, kept as plan targets): Medium vs Easy 166/200 = 83.0% (target .80), Hard vs Medium 147/200 = 73.5% (target .70; 78.0 when it was set, 2026-07-02). Both pass with about 3 points to spare.

**The gate run:** `npx vitest run tests/ai/winrate.test.ts` at the new floors, 10 of 10 pass (621 s locally, four workers).

**`RUNG_BANDS` 1-14** (harness bands; same rule, downs allowed, the 1-6 ceilings kept): R4 .315 -> .275 down, R5 .37 -> .34 down, R6 .355 -> .395, R7 .705 -> .695 down, R8 .565 -> .635, R9 .625 -> .61 down, R10 .655 -> .73, R11 .58 -> .645, R12 .565 -> .595, R13 .475 -> .50, R14 .565 -> .665. 15-28 equal the new gate floors. `FLOOR_BANDS` (the tier dial, no CI test) were not re-measured.

**Everything that comes down, for the PR:** no gate floor. Two Darlings draw ceilings loosen (R23 10 -> 14, R27 3 -> 4). Four harness bands (R4, R5, R7, R9).
