<!-- source-of-truth: tests/ai/winrate.test.ts, scripts/balance-matrix.ts, src/config/rules.ts · last-verified: 2026-10-16 · measurement record — the 2.0 P8 one-time floor reset at starting life 25 -->

# 2.0 floor reset at 25 life (P8)

> **Record, not spec.** The one owner-approved re-baseline of every test gate floor at the new starting life ([plan-2.0.md](plan-2.0.md) P8, ruled 2026-10-08; the life ruling 2026-10-08, "flip at the reset" 2026-10-09). Branch `feat/20-floor-reset-25` from `release/2.0` 9dcf528b. Rule: floor = 200-seed mean - 6.5, rounded down to the half point; every floor that drops is listed. After this PR floors only ratchet up again.

**Status: review point (a), the flip and the inventory. No floor has been measured or changed yet.**

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
