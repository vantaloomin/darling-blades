<!-- source-of-truth: tests/ai/winrate.test.ts, scripts/balance-matrix.ts, src/data/opponents.ts · last-verified: 2026-10-05 · measurement record — the 1.9 wave-4 end-of-wave tower reading, the floor ratchet and the new gates -->

# Wave 4 end-of-wave measurement (1.9)

> **Record, not spec.** The tower as measured on 2026-10-05 at `release/1.9` cb335b10 (#535 merged: the wave-4 tunes, R28's gate rebuild included), on the frozen AI. The tunes themselves are in [plan-1.9-wave4-tunes.md](plan-1.9-wave4-tunes.md); the handoff is in [plan-1.9.md](plan-1.9.md#handoff-2026-10-04).

**How it was run.** The same runner as the tunes record: each rung (or floor) is one unit that calls the committed `runAvatarMatrix`, `runAvatarReserveMatrix` or the `runFloorMatrix` cell spec, so every cell has the committed harness's seed. Four workers, one job at a time, below-normal priority, `OMP_NUM_THREADS=1 ORT_NUM_THREADS=1`.

| Run | Seeds per cell | Games | Draws | Wall |
| --- | --- | --- | --- | --- |
| Gate (`--avatars`) | 200 | 28,000 | 2 | 17.5 min |
| Darlings (`--avatars-darlings`) | 200 | 28,000 | 103 | 31 min |
| Floors (`--floors`) | 80 | 11,200 | 0 | 6.5 min |
| Wide (`--avatars-reserve`) | 200 | 84,000 | 13 | 51 min |
| F21 re-read | 200 | 1,000 | 0 | 2.6 min |

Every row the tunes record measured on the same lists reproduced exactly (the harness is deterministic), so the wide check of the tunes holds: R11 62.3, R13 59.8, R24 73.1, R28 81.0.

## 1. The tower

Gate cells are in Muster / Communion / Tides / Mandate / Harvest order.

| Rung | Boss | Gate (cells) | Wide | Darlings (draws) |
| --- | --- | --- | --- | --- |
| R1 | Meng Huo | 23.7 (14/11/26/50/19) | 29.5 | 31.9 (22) |
| R2 | Hestia | 7.8 (5/7/2/21/5) | 11.3 | 8.5 (12) |
| R3 | Lupa, Wolfqueen | 24.1 (11/3/33/52/23) | 34.9 | 27.5 (7) |
| R4 | Hera | 38.2 (23/48/38/39/44) | 40.4 | 57.9 (3) |
| R5 | Zhurong | 43.6 (43/26/37/66/47), 1 draw | 48.0 | 50.2 (13) |
| R6 | Sima Yi | 42.3 (41/77/24/33/37) | 41.0 | 40.8 (7) |
| R7 | Yohime, Kitsune Matriarch | 77.2 (59/88/76/79/85) | 79.1 | 70.3 (2) |
| R8 | Cao Cao | 63.1 (33/90/63/77/54) | 69.1 | 56.6 (1) |
| R9 | Hel, Queen of Mist | 69.0 (61/85/63/81/56) | 72.9 | 69.9 |
| R10 | Brunhild, the Last Valkyrie | 72.3 (65/78/47/89/83) | 76.3 | 68.5 (1) |
| R11 | The Morrigan | 64.8 (66/85/28/56/89) | 62.3 | 59.0 |
| R12 | Titania | 63.1 (34/96/69/65/52), 1 draw | 68.6 | 69.9 (8) |
| R13 | Morgan of the Thorn Crown | 54.4 (47/77/42/66/40) | 59.8 | 51.1 |
| R14 | Artoria, Once and Future Queen | 67.2 (29/93/65/74/76) | 68.2 | 63.3 (3) |
| R15 | Carmilla, Crimson Host | 67.6 (54/65/47/87/85) | 67.9 | 63.0 |
| R16 | The Storm-Crowned Bride | 71.0 (67/73/49/78/89) | 71.5 | 57.2 |
| R17 | Glass-Coffin Queen | 78.0 (74/76/62/94/85) | 83.5 | 75.0 |
| R18 | Abyssal Songstress | 89.1 (92/92/73/94/96) | 87.9 | 63.3 (1) |
| R19 | Queen of the Lanterned Roof | 74.8 (64/89/62/81/80) | 74.0 | 67.2 (1) |
| R20 | Kitsune Neon Tyrant | 90.2 (84/87/87/98/96) | 92.2 | 61.0 |
| R21 | Anubis, Who Holds the Scale | 62.8 (69/78/63/57/48) | 69.1 | 56.9 (1) |
| R22 | Bastet, Mistress of the Ninth Return | 75.2 (54/84/63/87/89) | 79.9 | 79.9 |
| R23 | Chrome Broodmother | 74.1 (57/87/66/73/88) | 76.0 | 58.3 (18) |
| R24 | The Violet Signal Queen | 72.9 (54/93/64/63/92) | 73.1 | 55.4 |
| R25 | The Drowned Deacon | 66.2 (41/65/64/85/77) | 72.4 | 57.3 |
| R26 | The Marsh-Mother | 75.0 (57/84/72/77/86) | 78.4 | 56.8 |
| R27 | The Shepherdess of Giants | 68.7 (44/96/74/55/75) | 75.9 | 84.0 (3) |
| R28 | The Tyrant Queen | 76.0 (62/79/68/92/81) | 81.0 | 69.5 |

**Summit order.** On the gate R28 (76.0) tops R26 (75.0) and R27 (68.7). On the wide matrix she tops it too, 81.0 against 78.4 and 75.9. In Darlings R27 (84.0) stays above her (69.5), as the owner ruled on 2026-10-04.

## 2. The floor ratchet (gate, `tests/ai/winrate.test.ts`)

Candidate = 200-seed mean - 6.5, rounded down to the half point. A floor only rises.

| Rung | Mean | Candidate | Standing floor | New floor |
| --- | --- | --- | --- | --- |
| R15 Carmilla | 67.6 | 61.0 | .655 | .655 kept (margin 2.1) |
| R16 | 71.0 | 64.5 | .645 | .645 |
| R17 | 78.0 | 71.5 | .715 | .715 |
| R18 | 89.1 | 82.5 | .825 | .825 |
| R19 | 74.8 | 68.0 | .675 | **.68** |
| R20 | 90.2 | 83.5 | .835 | .835 |
| R21 | 62.8 | 56.0 | .585 | .585 kept |
| R22 | 75.2 | 68.5 | .685 | .685 |
| R23 | 74.1 | 67.5 | .675 | .675 |
| R24 | 72.9 | 66.0 | .645 | **.66** |
| R25 | 66.2 | 59.5 | .605 | .605 kept |
| R26 | 75.0 | 68.5 | .685 | .685 |
| R27 | 68.7 | 62.0 | none | **.62 (new)** |
| R28 | 76.0 | 69.5 | none | **.695 (new)** |

**Carmilla (R15)** stays the thinnest margin on the ladder: 2.1 points over her floor at 200 seeds. No list lever moved her in wave 4.

## 3. The Darlings summit gate (new)

At 40 seeds per cell, in two tests (R23-R25 and R26-R28). Floor = mean - 6.5 rounded down. Draw ceiling (Q5) = the 200-seed draw rate scaled to the gate's 200 games per row, plus three standard deviations, rounded up, at least 2.

| Rung | Mean | Floor | Draws in 1,000 | Ceiling at 40 seeds |
| --- | --- | --- | --- | --- |
| R23 | 58.3 | .515 | 18 | 10 |
| R24 | 55.4 | .485 | 0 | 2 |
| R25 | 57.3 | .505 | 0 | 2 |
| R26 | 56.8 | .50 | 0 | 2 |
| R27 | 84.0 | .775 | 3 | 3 |
| R28 | 69.5 | .63 | 0 | 2 |

## 4. `RUNG_BANDS` (`scripts/balance-matrix.ts`)

**1-13 re-centred (owner, Q6)**, mean - 6.5 rounded down, downs allowed, the 1-6 ceilings kept:

| Rung | Old | New | Direction |
| --- | --- | --- | --- |
| R4 | .22 | .315 | up |
| R5 | .37 | .37 | same |
| R6 | .155 | .355 | up |
| R7 | .695 | .705 | up |
| R8 | .565 | .565 | same |
| R9 | .61 | .625 | up |
| **R10** | **.69** | **.655** | **down** |
| R11 | .365 | .58 | up |
| R12 | .52 | .565 | up |
| R13 | .43 | .475 | up |

**One band comes down: R10 Brunhild**, .69 to .655 (she reads 72.3).

**14-28 synced to the gate floors** (all up or unchanged): R16 .625 -> .645, R17 .705 -> .715, R18 .82 -> .825, R19 .65 -> .68, R20 .815 -> .835, R23 .655 -> .675, R24 .645 -> .66, R25 .595 -> .605, and new R27 .62, R28 .695.

## 5. `FLOOR_BANDS` (the tier dial)

F27 71.8 and F28 68.0 at 80 seeds; both get the T6 plateau band, .585. F21, the baseline's low row (58.8), reads 61.8 at 80 seeds and **67.0 at 200 seeds**, so it was noise. T6 averages 67.5 across F16-F28 (owner, Q4: accepted for 1.9).
