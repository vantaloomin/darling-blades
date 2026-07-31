import type { Difficulty } from '../meta/Economy';
import { makePersonality, type Personality } from '../ai/personality';
import { expand } from './starterDecks';

/**
 * The AI Avatar Gauntlet roster. Each avatar is pure data: a themed 60-card
 * deck built from real catalog ids, a brain difficulty, and a Personality
 * spread over the neutral DEFAULT. Portraits cost zero new art code — the
 * `portraitCardId` is a real creature in the deck whose placeholder bust is
 * already baked into the atlas after Preload.
 *
 * Gauntlet ordering is by `tier` (1..20, unique). Difficulty follows the plan:
 * tiers 1-3 Easy, 4-6 Medium, 7-20 Hard (9-10 are the Ragnarök bosses,
 * 11-12 are the Celtic Fae bosses, 13-14 are the Arthurian Court pair, and
 * 15-16 are the Gothic Monsters pair, 17-18 are the Dark Tales summit pair,
 * and 19-20 are the Yokai Nights summit pair).
 */
export interface Avatar {
  id: string;
  name: string;
  title: string;
  blurb: string;
  theme: string;
  tier: number; // 1..20 (unique)
  difficulty: Difficulty;
  deck: string[]; // 60 real cardIds
  personality: Personality;
  portraitCardId: string;
}

/*
 * GAUNTLET BALANCE BASELINE — 2026-07-02 (re-measured after the MediumAI
 * trick-respect evidence gate + the Wild Communion trick swap, see below),
 * 40 seeds/cell, measured with
 * `npx tsx scripts/balance-matrix.ts --avatars --seeds 40`
 * (scripts/balance-matrix.ts; avatar plays its own brain+personality, a
 * neutral MediumAI proxies the human on each of the 5 starters; sides
 * alternate; fully seed-deterministic).
 *
 *                            Muster  Communion  Tides  Mandate  Harvest | avg
 *   R1 Meng Huo   [easy]       38%      35%      38%     25%      20%   | 31%
 *   R2 Hestia     [easy]       28%      33%      13%     13%      18%   | 21%
 *   R3 Lupa       [easy]       20%      18%      45%     35%      40%   | 31%
 *   R4 Hera       [medium]     33%      42%      38%     70%      50%   | 47%
 *   R5 Zhurong    [medium]     43%      78%      60%     57%      57%   | 59%
 *   R6 Sima Yi    [medium]     64%      80%      63%     48%      30%   | 57%
 *   R7 Yohime     [hard]       63%      93%      78%     68%      63%   | 73%
 *   R8 Cao Cao    [hard]       73%      88%      73%     80%      50%   | 73%
 *   R9 Hel        [hard]       55%      95%      83%     75%      45%   | 71%
 *   R10 Brunhild  [hard]       93%      90%      73%     85%      98%   | 88%
 *
 * (Rungs 9-10 are the Ragnarök expansion bosses, measured 2026-07-05 at 40
 * seeds/cell with `--only hel,brunhild`; rungs 1-8 carry forward unchanged — the
 * expansion added no base cards and did not touch the starters, so their rows are
 * still valid. Both new rungs clear their bands with no flags: Hel (U/B
 * mill-reanimator) avg 71% ≥ 55%; Brunhild (R/W Valkyrie double-strike) avg 88% ≥
 * 60% — the steepest wall in the game, by design, as the summit rung.)
 *
 * Rungs 11-12 — the Celtic Fae bosses, measured 2026-07-12 at 40 seeds/cell
 * (full `--avatars` matrix; rungs 1-10 re-measured in the same run and
 * unchanged within noise):
 *
 *                              Muster  Communion  Tides  Mandate  Harvest | avg
 *   R11 The Morrigan [hard]      70%      80%      83%     75%      83%   | 78%
 *   R12 Titania      [hard]      48%      80%      85%     78%      63%   | 71%
 *
 * Both clear their bands (R11 ≥ 65%, R12 ≥ 70%) with no flags. The
 * user-directed tier matrix (`--cf-bosses`, 50 seeds/cell vs LOW Wild
 * Communion / MID Grave Harvest / HIGH Glimmer Bargain): Morrigan
 * 82/82/94 avg 86%; Titania 88/58/84 avg 77%. Tuning history (honest):
 * Titania first measured 49% avg with a ladder inversion — root cause was
 * Bloomling tokens lacking the Fae subtype, so Ash and Mistletoe's anthem
 * never pumped her own court (tokens.ts fix), plus a cantrip-heavy list; a
 * wall-heavy variant (Mushroom-Ring Guards) measured WORSE (61%) — passivity
 * loses; the shipped list maxes untouchable beef (4x Selkie Tide-Queen) and
 * anthem density (4x Ash and Mistletoe). Grave Harvest stays her hardest
 * matchup by design — attrition is the court's intended counter-play.
 * Both matrices re-measured after merging the #68 playtest batch (SBA
 * death batching + AI self-bleed clock/desperation attacks): every R11/R12
 * cell reproduced identically — neither boss runs self-bleed effects.)
 *
 * Rungs 13-14 — the Arthurian Court bosses, measured 2026-07-16 at 40
 * seeds/cell (full `--avatars` matrix; rungs 1-12 re-measured in the same
 * runs, unchanged within noise):
 *
 *                              Muster  Communion  Tides  Mandate  Harvest | avg
 *   R13 Morgan     [hard]        43%      88%      68%     68%      65%   | 66%
 *   R14 Artoria    [hard]        50%      83%      83%     68%      48%   | 66%
 *
 * Boss harness (`--ac-bosses`, 50 seeds/cell vs LOW Crimson Muster / MID
 * Shadow Mandate / HIGH Questing Table): Morgan 54/64/90 avg 69%; Artoria
 * 62/58/94 avg 71%. Tuning history (honest): both first measured 59-60%
 * with a hard aggro hole (Artoria 18-30% vs Crimson across three
 * wall-heavy variants — the CF "passivity loses" law re-confirmed three
 * separate times); the levers that measured REAL were (1) base-set
 * interaction splash (Undertow tempo + Shieldwall blowouts, +12pp LOW for
 * Artoria — the same recipe as Morgan's doom-bolts), and (2) two
 * user-approved rounds of targeted AC card buffs (Artoria 5/5 + awakening
 * +3/+3, Galahad 4/4, Banneret 3/3, Lakeblade 3/3, Morgan 4/6, Excalibur
 * +2/+1, Quest for the Grail {2}{W}, Squire to Champion {1}{W}, Black
 * Chapel Curse {2}{B}) which moved the tower rows 59% -> 66% and also lift
 * the Questing Table precon and the set's draft presence. Personality
 * retunes measured neutral. Residual, accepted with calibrated bands
 * (R13 >= 60%, R14 >= 62%): the AC rungs sit ~10pp under R11/12 — W/U
 * Quest tribal has no in-color hard removal by design, and the tower's
 * power peak has been R10 Brunhild (85%) since Celtic Fae shipped, so a
 * non-monotonic summit continues the accepted pattern. Closing the gap
 * needs in-color W/U removal in a future set or heavier cross-set splash.
 *
 * (R7/R8 rows re-measured once more after HardAI.openManaBuff gained the same
 * evidence gate — Hard's combat baselines no longer pay the phantom-trick tax
 * either; Hard vs Medium gate moved 76.5% → 78.0%. Rungs 1-6 unchanged.)
 *
 * WHAT MOVED vs the morning baseline (35/28/35 | 55/57/52 | 69/73): MediumAI's
 * trick respect is now evidence-gated (MediumAI.trickBuff — no +2/+2 phantom
 * tax until the opponent has shown an instant), which strengthens the human
 * proxy on every rung AND the Medium/Hard avatar brains. Early Easy rungs got
 * a few points easier for skilled play (correct: a competent human also
 * doesn't fear open mana with nothing behind it); Medium/Hard rungs held or
 * rose. All bands green, no ladder flags.
 *
 * Difficulty round-robin on the (updated) Crimson/Wild pair, 60 seeds/cell:
 * Medium over Easy 68%/68% (was 60%/62% before the trick-gate fix — the
 * documented "Medium only ~57% over Easy on real starters" anomaly is
 * resolved; the residual vs the 82.5% TEST_DB gate is structural: Crimson
 * Muster is a zero-instant deck, so most of Medium's edges — removal timing,
 * response windows, counter/pump rules — have no cards to act on, and Easy's
 * 20% random main actions are nearly free in creature-only games). Hard over
 * Medium 72%/70%, Hard over Easy 80%/87%.
 *
 * Starter mirror (100 seeds/cell): Communion row was the casualty of the
 * trick-gate fix (only starter with zero instants → opponents correctly
 * stopped respecting its open mana; row fell to 20-28%). Fixed with a 3-card
 * swap (-2 gk-nike, -1 bk-bunny-vanguard, +3 in-wild-surge — see
 * starterDecks.ts). Worst cells after: Communion vs Tides 24% on the official
 * cell seeds, but 36.9% over 300 independent games (pooled 493 games ≈ 33%) —
 * the flag on that one cell is a seed artifact, not a crushed matchup;
 * Communion vs Harvest pools to ≈27%. All other cells 36-73%.
 *
 * Bands (RUNG_BANDS in scripts/balance-matrix.ts): rungs 1-3 avg ≤45% with no
 * single starter above 65%; rungs 8-10 avg ≥55/55/60%; roughly monotonic between.
 * All green on this baseline. Known texture, accepted as matchup flavor:
 * Lupa's hyper-aggro is polarized (crushed by W-heavy blockers, strong vs
 * tempo/attrition); Hera go-wide preys on Shadow Mandate's spot removal (70%);
 * Grave Harvest's deathtouch attrition is the natural foil to Sima Yi (27%)
 * and Cao Cao (45%); the linear Communion creature deck is the favorite prey
 * of the tempo/control rungs (Zhurong/Sima Yi/Yohime 78-93%). Hestia at 21%
 * is the gentlest rung (her passive lifegain plan folds to a proxy that now
 * blocks correctly; her Easy-brain knobs — easyNoise/easyPassRate/easyAllIn —
 * were all measured and none lift her without breaking theme, so rung 2 stays
 * the welcome mat). Re-measure and refresh this table after ANY change to
 * decks, personalities, starters, or AI brains — the skipped suite
 * tests/ai/balance.test.ts runs the same harness with the same seeds.
 *
 * 2026-07-07 — fetchLand (Demeter etc.) now offers a basic-land CHOICE when the
 * deck holds >1 basic type (was: topmost basic); MediumAI picks the type it
 * controls fewest of. Among the matrix starters only Grave Harvest (swamp+forest,
 * Demeter×3) is affected. Re-measured --starters + --avatars at 40 seeds: no new
 * flags, ladder still monotonic, Grave Harvest mirror avg 55%; bands unchanged.
 *
 * 2026-07-12 — SBA deaths now batch (unified across categories) before dies
 * triggers fire (engine/sba.ts, the token-cap fix) and the AI prices its own
 * NET dawn self-bleed clock + scored desperation attacks (ai/evaluate.ts,
 * ai/value.ts, ai/combatPlans.ts). Re-measured --avatars at 40 seeds: R4
 * Hera 46→47% (Muster 36→33, Harvest 45→50), R6 Sima Yi Muster 67→64 and
 * Harvest 27→30, R7 Yohime 72→73% (Muster 60→63); every other row
 * byte-identical. No flags, bands green, ladder monotonic. Table above
 * updated in place.
 *
 * 2026-07-16 — Arthurian Court adds the next two hard rungs: Morgan of the
 * Thorn Crown (U/B Quest-control) and Artoria, Once and Future Queen (W/U
 * knight-Quest awakening). The 50-seed full calibration is intentionally
 * deferred to the main session; the companion --ac-bosses harness has a
 * separate 10-seed smoke pass for these provisional decks. Smoke result with
 * LOW Crimson Muster / MID Shadow Mandate / HIGH Questing Table: Morgan
 * 40/50/80% (57% avg), Artoria 50/60/100% (70% avg), all 10 games decided.
 *
 * 2026-07-17 — prefab round-robin tuning (PR #85): the new
 * `--prefabs --ai hard --seeds 500` harness measured Grave Harvest 63.9% /
 * Glimmer Bargain 29.8% aggregate, so Grave Harvest was shaved (-1 Doom
 * Bolt, -1 Thanatos, Gaia out, situational 1-ofs in) and Glimmer Bargain
 * rebuilt (6 cf duals, singletons consolidated) — see starterDecks.ts.
 * Post-tune prefab aggregates: Grave 54.3, Glimmer 46.5, spread 39.7-59.4
 * (measured on the pre-#84 7-deck pool). Full --avatars re-measure at 40
 * seeds AFTER merging #84's 14-rung roster (rungs 1-12 rows reproduced
 * byte-identical across the merge — the 1.2 engine additions do not touch
 * these matchups; only the Harvest column moved vs the 2026-07-16 tables):
 *
 *                            Muster  Communion  Tides  Mandate  Harvest | avg
 *   R1 Meng Huo   [easy]       38%      35%      38%     25%      30%   | 33%
 *   R2 Hestia     [easy]       28%      33%      13%     13%      18%   | 21%
 *   R3 Lupa       [easy]       20%      15%      38%     35%      38%   | 29%
 *   R4 Hera       [medium]     33%      42%      38%     70%      61%   | 49%
 *   R5 Zhurong    [medium]     45%      80%      63%     55%      68%   | 62%
 *   R6 Sima Yi    [medium]     64%      80%      63%     50%      47%   | 61%
 *   R7 Yohime     [hard]       60%      90%      63%     53%      65%   | 66%
 *   R8 Cao Cao    [hard]       73%      88%      80%     80%      57%   | 76%
 *   R9 Hel        [hard]       65%      90%      70%     68%      55%   | 70%
 *   R10 Brunhild  [hard]       93%      80%      70%     85%     100%   | 86%
 *   R11 Morrigan  [hard]       68%      78%      78%     75%      88%   | 77%
 *   R12 Titania   [hard]       63%      88%      88%     78%      68%   | 77%
 *   R13 Morgan    [hard]       43%      88%      68%     68%      70%   | 67%
 *   R14 Artoria   [hard]       50%      83%      83%     68%      70%   | 71%
 *
 * Bands green (R13 67 ≥ 60, R14 71 ≥ 62 — the Grave Harvest nerf lifted
 * Artoria's Harvest cell 48→70, closing part of the accepted AC summit
 * gap for free). ONE WARNING (accepted): rung 2 (21%) sits exactly 12pp
 * below rung 1 (33%) — the gap was already 10pp before this tuning (Hestia
 * as the documented welcome mat); the Grave Harvest nerf lifted Meng Huo's
 * hardest cell (Harvest 20→30), widening it to the flag threshold. Revisit
 * only if Meng Huo gets further buffs. CF-boss tier matrix unflagged
 * (Morrigan avg 89, Titania 80 at 40 seeds). Post-merge 8-deck prefab
 * sanity (hard, 100 seeds/cell): Grave 58.6 / Glimmer 49.9 hold mid-band;
 * the NEW 1.2 Questing Table precon measures 24.4% aggregate vs the tuned
 * field — a bottom outlier flagged for a future tuning pass (its list is
 * also the --ac-bosses HIGH reference, so tune with that in mind).
 *
 * Rungs 15-16 - the Gothic Monsters summit pair, measured 2026-07-17 at 40
 * seeds/cell with the full `--avatars` matrix. Every cell below had 40 decided
 * games and zero draws:
 *
 *                              Muster  Communion  Tides  Mandate  Harvest | avg
 *   R15 Carmilla    [hard]       80%      80%      68%     80%      80%   | 78%
 *   R16 The Bride   [hard]       63%      88%      65%     85%      83%   | 77%
 *
 * Calibrated floors for the new rows are R15 >= 72% and R16 >= 73%, leaving
 * CI-variance margin below these fresh point estimates. Carmilla clears the
 * preceding R14 Artoria row by 7pp; The Bride clears it by 6pp and is the new
 * sixteenth and final tower slot. Honest residual: this 40-seed sample puts
 * The Bride 1pp below Carmilla, so strict pairwise monotonicity is not claimed
 * at this sample size. Genuine tuning iterations included The Bride's initial
 * 34% artifact/control list, 49% after replacing weak setup with Doom Bolt and
 * Undertow, 73% after adding the low-curve vampire bodies, 62% for a Summon the
 * Dead substitution, and 77% after restoring the artifact finisher and adding
 * Divination. The final Black-Veil variant keeps the strongest measured spread.
 *
 * Post-AI-fix W1 tuning history, 2026-07-29, retained floor >= 73%:
 * the restored control list measured 55/78/48/90/80, avg 70%, at 40 seeds/cell.
 * Scoped probes included Stormglass Golem -> Moon-Doll Orchestra (70/70/55/65/40,
 * avg 60%, 20 seeds), Stormtower Resurrection -> Midnight Autopsy (55/90/65/65/75,
 * avg 70%, then 50/83/57/73/73, avg 67%, at 40 seeds), and Black-Veil Matron ->
 * Velvet Coffin (35/85/55/75/45, avg 59%, 20 seeds). The best scoped candidate,
 * Black-Veil Matron -> Ravenloft Heiress, measured 55/85/65/95/60, avg 72%, at
 * 20 seeds and 53/80/60/95/70, avg 72%, at 40 seeds, still below the floor.
 * The Heiress plus Manor Thrall package measured 64% at 20 seeds; Heiress plus
 * Blood-Opera Soloist measured 67% at 20 seeds. A removalBias -1.25 probe measured
 * 68% at 40 seeds; aggression 1.4 on the best list tied 72% at 20 seeds. All
 * candidates were rejected. Early broad text replacements that could match
 * duplicate Carmilla card ids were excluded from attribution and fully restored.
 * The original list and personality remain shipped; the floor was not lowered.
 *
 * Revision-4 W1 repair, 2026-07-30, after the W0 AI fixes: clean control was
 * 67/72/45/87/72 at 60 seeds/cell (avg 68%) and 61/73/48/73/66 at 200
 * seeds/cell (avg 64%). Replay inspection identified Burning Tides as the
 * inverted cell: its four Undertow copies were now correctly classified as
 * recall by the starter's Medium AI, which repeatedly returned Bride bodies.
 * Candidate 1, replacing four Batcloak Cutthroats with four Broken Mirrors,
 * measured 48/65/33/50/57 at 60 seeds (avg 51%) and was rejected for gutting
 * every control cell. Candidate 2, replacing four Batcloaks with four Ravenloft
 * Heiresses, measured 65/75/48/88/70 at 60 seeds (avg 69%) and 60/73/50/75/66
 * at 200 seeds (avg 64%); it was rejected in favor of the stronger targeted
 * swap. Candidate 3, replacing four Black-Veil Matrons with four Ravenloft
 * Heiresses, measured 63/75/57/92/63 at 60 seeds (avg 70%) and 59/78/56/78/60
 * at 200 seeds (avg 66%). It is retained: the inverted Tides cell recovered
 * eight points from control without a new near-hopeless cell, though the old
 * 73% floor remains unmeetable at this honest sample and is re-centred in W7.
 * Candidate 4, replacing four Batcloaks with four Blood-Opera Soloists,
 * measured 58/72/45/75/70 at 60 seeds (avg 64%) and was rejected.
 *
 * Rungs 17-18 — the Dark Tales summit pair, measured 2026-07-24 at 40
 * seeds/cell with the full `--avatars` matrix. Every cell below had 40 decided
 * games and zero draws:
 *
 *                              Muster  Communion  Tides  Mandate  Harvest | avg
 *   R17 Glass-Coffin Queen [hard]  85%       83%       73%      68%      78%   | 77%
 *   R18 Abyssal Songstress [hard]  93%      100%       70%      78%      93%   | 87%
 *
 * Calibrated floors are R17 >= 72% and R18 >= 82%, leaving 5pp below each
 * point estimate for CI variance. R17 clears the current fresh R16 row by 2pp;
 * R18 is the highest measured row by 1pp. Every new cell had 40 decided games
 * and zero draws. Strict pairwise monotonicity beyond these sampled point
 * estimates is not claimed at 40 seeds/cell.
 *
 * Tuning history (honest): R17's all-Dark-Tales first list measured 19% avg;
 * adding proven Doom Bolt/Reaper's Due removal and a low-curve Gothic shell
 * moved it to 46%, and the final one-of Retell package measured 77%. R18's
 * all-Dark-Tales list measured 0% avg; a proven Bride-style U/B control shell
 * measured 64%; a first low-curve Skim/foresee shell with four Undersea Bargains
 * measured 78%; and the final six-threat shell with an 8/12 basic-land split,
 * one-of Skim cards, and Undersea Bargain measured 87%. Each result above used
 * 40 seeds/cell; the final rows are from the standard full `--avatars` protocol.
 *
 * Rungs 19-20 - the Yokai Nights summit pair. These began as the approved B1
 * starting lists; the dated 40-seed calibration history is recorded below
 * after each matrix iteration, with failures retained. Iteration 1 (approved
 * B1 starters, 2026-07-29, 40 seeds/cell): R19 85/60/68/60/73, avg 69%; R20
 * 65/63/50/70/83, avg 66%. Failure: R19 did not clear the R18 neighborhood
 * and R20 inverted below R19, so neither list was accepted.
 * Iteration 2 (low-curve R19 and low-curve R20, 2026-07-29, 40 seeds/cell):
 * R19 75/45/53/80/78, avg 66%; R20 57/73/55/75/83, avg 69%. Failure: the
 * R19 control cells fell further and R20 still did not clear R19.
 * Iteration 3 (anthem/evasion R19 and proven burn-tempo R20, 2026-07-29,
 * 40 seeds/cell): R19 83/60/53/73/73, avg 68%; R20 75/73/60/75/90, avg 75%.
 * Partial failure: the pressure climb was restored, but R19 still did not
 * clear the R18 neighborhood.
 * Iteration 4 (base Kitsune resilience experiment, 2026-07-29, 40
 * seeds/cell): R19 73/45/60/75/55, avg 62%; R20 stayed 75%. Failure: the
 * alternate R19 bodies lost too much board pressure and attrition resilience.
 * Iteration 5 (broad-target recall and Foresee experiment, 2026-07-29, 40
 * seeds/cell): R19 60/68/50/73/68, avg 64%; R20 stayed 75%. Failure: the
 * extra card-selection value did not solve R19's low Tides and Muster cells.
 * Iteration 6 (expensive counter/draw experiment, 2026-07-29, 40 seeds/cell):
 * R19 73/50/48/70/63, avg 61%; R20 stayed 75%. Failure: the slower answers
 * were worse across the tempo cells.
 * Iteration 7 (efficient-control final candidate, 2026-07-29, 40 seeds/cell):
 * R19 88/70/68/63/68, avg 71%; R20 75/73/60/75/90, avg 75%. Every cell had
 * 40 decided games and zero draws. Provisional floors are R19 >= 66% and
 * R20 >= 70%, five percentage points below these point estimates. R20 clears
 * R19 as intended; honest residual: R19 remains 16pp below R18's 87% row,
 * so the requested R18-neighborhood climb is not claimed before the end-of-set
 * re-baseline.
 * Iteration 8 (R19 defensive-personality probe, 2026-07-29, 40 seeds/cell):
 * R19 90/65/68/60/73, avg 71%; R20 stayed 75%. Neutral tie with Iteration 7,
 * so the extra knobs were reverted and the simpler list-only candidate remains
 * shipped.
 *
 * 2026-07-20 - 1.3 prefab tuning pass (user-approved slate) on the 518
 * pool, measured `--prefabs --ai hard --seeds 300` (10,800 games,
 * reproduced independently by the main session): Questing Table rebuilt
 * into the W/U pressure shell 23.5% -> 45.2%; Bloodmoon Masquerade shaved
 * (Heiress/Cutthroat/Kicked Door out) 69.6% -> 57.3%; Wild Communion best
 * small identity-preserving swap 42.0% -> 42.1% (honest stall - Boarkin
 * and Zhao Yun variants measured worse; recorded at the deck). Nine-deck
 * spread 42.1-59.9, all inside the rough 40-60 band. Per-deck tuning
 * history lives at each list in starterDecks.ts. AC boss harness after
 * the Questing Table rebuild (its HIGH reference): Morgan 70% / Artoria
 * 67% / Carmilla 76% / Bride 77% avg at 50 seeds, no flags.
 *
 * 2026-07-20 - 1.3 Pillar 1 changes what this table gates. The tower now
 * rotates the roster daily and the FLOOR sets the AI brain via the tier dial
 * (src/ai/tiers.ts, measured ladder stamped there), so the avatar rows above
 * measure INTRINSIC avatar strength (own brain + personality + deck) - the
 * quantity Practice mode and the boss win-rate gates still use - while the
 * tower itself is baselined by the FLOOR matrix (FLOOR_BANDS + runFloorMatrix
 * in scripts/balance-matrix.ts, `--floors --seeds 80`, dated baseline in that
 * comment block: tier plateaus 23/31/34/51/60/77). The `difficulty` field
 * below no longer sets tower brains; it still drives Practice-vs-avatar duels
 * and the avatar matrix rows.
 *
 * 2026-07-24 - Pillar 1 board-answer pass, final measured slate. The current
 * rg-/cf- recosts plus the Midnight Storybook rebuild were checked with the
 * standard matrices. Avatar averages at 40 seeds/cell: R1 33%, R2 17%, R3
 * 28%, R4 45%, R5 61%, R6 60%, R7 66%, R8 76%, R9 68%, R10 86%, R11 78%,
 * R12 77%, R13 66%, R14 70%, R15 77%, R16 75%, R17 76%, R18 87%. All hard
 * boss bands are green. The existing R2/R1 ladder inversion remains the only
 * flag at this sample size.
 *
 * Final prefab round-robin at 300 seeds/cell: Crimson 62.1%, Bloodmoon 58.5%,
 * Burning 58.0%, Grave 52.3%, Shadow 50.4%, Glimmer 48.3%, Valhalla 48.2%,
 * Questing 46.5%, Wild 44.5%, Midnight Storybook 30.5% (13,500 games).
 * Midnight improved from the 6.7% baseline but remains below the requested
 * mid-band because the Dark Tales card pool still lacks rate-efficient threats
 * and answers. The final list preserves the U/B/W Skim/Retell shell and uses
 * 20 off-set nonlands.
 *
 * Tier matrix at 80 seeds/cell passed monotonicity with T1-T6 averages of
 * 18.0%, 23.4%, 31.3%, 48.2%, 60.3%, and 75.9%. Floor matrix at 80 seeds/cell
 * had no flags; F1-F18 averages were 25.8%, 21.1%, 23.0%, 26.6%, 33.9%,
 * 28.0%, 32.8%, 34.5%, 34.3%, 47.0%, 52.3%, 52.5%, 59.8%, 59.9%, 62.2%,
 * 75.2%, 72.9%, and 72.7%.
 *
 * Retained go-wide artifact `2026-07-21-weenie-all.json`, remeasured at 150
 * seeds against the final 10-prefab field: 78.1% (1,172/1,500, zero draws),
 * with Bloodmoon Masquerade the worst matchup at 72.7% (109/150). Against
 * the pre-1.4 reference of 77.6% aggregate and 73% worst matchup, the gap did
 * not close. The only Dark Tales creature sweeper was narrowly recosted from
 * 5B to 4B; it was not retained in Midnight because the 60-seed probe fell
 * from 34.3% to 33.3% when two copies replaced Judgment of Heaven.
 *
 * ========================================================================
 * 2026-07-31 - W7 COMBINED RE-BASELINE (the 1.5 balance pass's closing
 * measurement; THE calibration tables until the next pass). Field: pool 787
 * / Base 209, cap-4 blockers, the two new common sweepers, 21 tapland ETB
 * riders, tribal lords (W5), the Neon Afterimage rebuild, and the W0 AI
 * fixes. Full `--avatars` at 200 seeds/cell (5x sample vs every prior
 * table):
 *
 *                              Muster  Communion  Tides  Mandate  Harvest | avg
 *   R1  Meng Huo      [easy]     41%      28%      26%     28%      30%   | 30%
 *   R2  Hestia        [easy]     30%      12%      10%     31%      16%   | 19%
 *   R3  Lupa          [easy]     15%       9%      26%     41%      33%   | 25%
 *   R4  Hera          [med]      35%      37%      45%     56%      44%   | 43%
 *   R5  Zhurong       [med]      53%      61%      48%     53%      70%   | 57%
 *   R6  Sima Yi       [med]      70%      67%      49%     55%      48%   | 58%
 *   R7  Yohime        [hard]     65%      81%      67%     71%      69%   | 70%
 *   R8  Cao Cao       [hard]     62%      89%      67%     81%      61%   | 72%
 *   R9  Hel           [hard]     56%      82%      63%     74%      45%   | 64%
 *   R10 Brunhild      [hard]     79%      78%      64%     84%      90%   | 79%
 *   R11 The Morrigan  [hard]     77%      82%      59%     82%      87%   | 77%
 *   R12 Titania       [hard]     67%      92%      77%     80%      53%   | 74%
 *   R13 Morgan        [hard]     46%      84%      51%     75%      62%   | 63%
 *   R14 Artoria       [hard]     56%      84%      57%     60%      61%   | 63%
 *   R15 Carmilla      [hard]     76%      80%      50%     77%      88%   | 74%
 *   R16 The Bride     [hard]     59%      78%      56%     81%      60%   | 67%
 *   R17 Glass-Coffin  [hard]     74%      85%      64%     84%      79%   | 77%
 *   R18 Songstress    [hard]     84%      91%      67%     88%      92%   | 84%
 *   R19 Lanterned Roof[hard]     66%      73%      47%     61%      64%   | 62%
 *   R20 Neon Tyrant   [hard]     68%      73%      55%     77%      84%   | 71%
 *
 * Floors re-centred DOWN from this table (user-authorized one-time
 * override of ratchet-up, same rationale as the economy bands): every
 * rewritten floor = the 200-seed average minus a 6.5pp 40-seed noise band
 * (winrate.test.ts + RUNG_BANDS). The Bride's tuning history CLOSES at
 * 67%: the W1 repair fixed the Tides matchup inversion the AI fixes
 * caused, and her dead 73% floor (set 4pp under a 40-seed estimate whose
 * noise band is ~6pp) is re-centred to 60.5%, not chased. Yohime's rung-7
 * row is re-stamped at 70% (the W4.5 Dreamveil Kitsune buff lifted her
 * from the 66% 2026-07-17 row). Honest residuals: R19 measures 62%, a
 * 22pp inversion below R18's 84% summit - the Yokai pair plays a control
 * shell into a field that now carries answers, and closing it needs
 * in-color tools from a future set (recorded, not chased); R2 Hestia at
 * 19% keeps the known easy-rung inversion vs R1.
 *
 * Prefab round-robin at 300 seeds/cell (16,500 games, cap-4 field):
 * Neon 59.8%, Crimson 59.4%, Burning 58.3%, Bloodmoon 58.3%, Grave 49.5%,
 * Shadow 47.8%, Valhalla 46.9%, Wild 45.7%, Questing 45.6%, Glimmer 45.4%,
 * Midnight Storybook 33.3%. Ten of eleven inside the rough 45-60 target;
 * Crimson's reign is broken (cap-4 + sweepers), Neon's rebuild holds at
 * the top without a runaway, Midnight remains the honest miss (W2 closed
 * it as such; its 29.9% like-for-like control history lives at its list).
 *
 * Floor matrix at 80 seeds/cell, FLAGS none: F1-F20 averages 25.3, 20.5,
 * 23.5, 29.0, 34.7, 28.9, 34.0, 35.3, 36.0, 46.0, 53.0, 50.3, 61.3, 58.1,
 * 56.0, 68.5, 70.8, 72.0, 68.2, 70.6 - a clean T6 plateau across F16-F20
 * confirms floors 19-20 stay tier 6 (stamped in src/ai/tiers.ts).
 *
 * 2026-07-31 - RESERVE FORMAT BASELINES (1.5.5 reveal gate; the two
 * matrices the 1.5.0 release split left TO MEASURE). Fixture fleets from
 * scripts/reserveMatrixDecks.ts (deterministic, validator-gated; they
 * measure the FORMAT, not tuned decks - no product balance claim, and no
 * classic-pool change may be justified by these numbers per
 * docs/plan-battle-box.md).
 *
 * LOSSLESSNESS (the reveal gate's primary result): across both formats
 * 5,000 of 5,000 games decided, 0 turn-limit draws, 0 engine exceptions.
 * No seed produced a stuck or dead game state.
 *
 * Warchest (--warchest, 200 seeds/cell, 2,000 games, neutral hard,
 * starter-derived playset fleet): Crimson 63.9, Burning 60.0, Grave 44.1,
 * Shadow 43.3, Wild 38.8. Aggro-topped 25pp spread, worst cell 78
 * (Burning vs Shadow); coherent field, no degenerate matchup.
 *
 * Darlings (--darlings, 200 seeds/cell, 3,000 games, neutral hard,
 * curve-greedy singleton fleet per color spread): Ares [R] 76.1,
 * Gaia [G] 72.1, Dian Wei [B] 58.2, Athena [W] 48.0, Ghost-Net
 * Archon [U] 23.5, Aphrodite [WU] 22.1. The wide spread is a property
 * of the greedy cheapest-first fixtures (mono-R aggro naturally tops
 * it), not a roster claim - the curated rival ladder stays unpromised
 * and would need its own measured baseline.
 */
export const AVATARS: readonly Avatar[] = [
  // ---------------------------------------------------------------------
  // Rung 1 — Meng Huo: mono-G stompy midrange bruiser. (Easy)
  {
    id: 'menghuo',
    name: 'Meng Huo',
    title: 'Queen of the Southern Wilds',
    blurb: 'Seven times captured, seven times freed, and every time she comes back bigger. Meng Huo simply plays the largest beasts she can find and runs them at your face.',
    theme: 'Mono-Green Stompy',
    tier: 1,
    difficulty: 'easy',
    portraitCardId: 'tk-other-menghuo',
    personality: makePersonality({ aggression: 1.15, easyAllIn: 1, easyNoise: 0.3 }),
    deck: expand([
      ['land-forest', 24],
      ['bk-bearkin-guardian', 4],
      ['bk-squirrelkin-hoarder', 4],
      ['tk-shu-madai', 4],
      ['tk-shu-jiangwei', 4],
      ['gk-pan', 4],
      ['tk-shu-zhangbao', 1],
      ['tk-shu-huangzhong', 2],
      ['tk-shu-weiyan', 2],
      ['bk-rhinokin-charger', 4],
      ['tk-other-menghuo', 4],
      ['so-rampant-growth', 3],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 2 — Hestia: mono-W lifegain obsessive. (Easy)
  {
    id: 'hestia',
    name: 'Hestia',
    title: 'Keeper of the Hearth',
    blurb: 'The gentlest Olympian tends her flame and drains your patience. Every lifelinker she plays buys another turn; she is content to outlast you by a hundred small mercies.',
    theme: 'Mono-White Lifegain',
    tier: 2,
    difficulty: 'easy',
    portraitCardId: 'gk-hestia',
    personality: makePersonality({ aggression: 0.85, lifegainBias: 2 }),
    deck: expand([
      ['land-plains', 24],
      ['bk-bunny-vanguard', 4],
      ['gk-hestia', 4],
      ['gk-hoplite', 4],
      ['bk-holstaur-milkmaid', 4],
      ['tk-wei-caiwenji', 4],
      ['bk-foxfire-priestess', 4],
      ['gk-apollo', 4],
      ['gk-eos', 3],
      ['tk-wei-pangde', 2],
      ['in-blessed-respite', 3],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 3 — Lupa, Wolfqueen: R/G hyper-aggro wolfkin. (Easy)
  {
    id: 'lupa',
    name: 'Lupa, Wolfqueen',
    title: 'Alpha of the Blood Moon',
    blurb: 'The pack does not wait. Lupa keeps almost any hand, throws every wolf at your throat on turn one, and never respects a bluff. Race her or die.',
    theme: 'Red-Green Wolfkin Aggro',
    tier: 3,
    difficulty: 'easy',
    portraitCardId: 'bk-wolfqueen',
    personality: makePersonality({
      aggression: 1.6,
      attackThreshold: -1.5,
      trickRespect: 0,
      mulliganShift: -1,
      easyAllIn: 1,
    }),
    deck: expand([
      ['land-mountain', 12],
      ['land-forest', 12],
      ['bk-wolfkin-raider', 4],
      ['bk-boarkin-rioter', 4],
      ['tk-other-huaxiong', 4],
      ['bk-bearkin-guardian', 4],
      ['tk-wei-xiahouyuan', 4],
      ['tk-shu-baosanniang', 4],
      ['bk-wolfqueen', 4],
      ['bk-rhinokin-charger', 2],
      ['in-boar-rush', 3],
      ['in-wild-surge', 3],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 4 — Hera: W/B go-wide token queen. (Medium)
  {
    id: 'hera',
    name: 'Hera',
    title: 'Queen of Olympus',
    blurb: 'Hera does not fight; her court fights for her. She floods the board with peacocks, blooms, and militia, then buffs the swarm until it crests over your defenses.',
    theme: 'White-Black Go-Wide Tokens',
    tier: 4,
    difficulty: 'medium',
    portraitCardId: 'gk-hera',
    personality: makePersonality({
      subtypeBias: 1,
      preferredSubtypes: ['Olympian'],
      blockThreshold: -0.5,
    }),
    deck: expand([
      ['land-plains', 12],
      ['land-swamp', 8],
      ['ld-shadowed-court', 4],
      ['gk-hera', 3],
      ['bk-bunny-vanguard', 4],
      ['gk-nike', 3],
      ['gk-iris', 3],
      ['in-stand-as-one', 2],
      ['gk-thanatos', 3],
      ['gk-apollo', 3],
      ['gk-eos', 2],
      ['bk-mousekin-pantry-guard', 4],
      ['en-vow-of-peace', 2],
      ['so-muster-militia', 4],
      ['so-parade-of-heroes', 3],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 5 — Zhurong: mono-R burn mage. (Medium)
  {
    id: 'zhurong',
    name: 'Zhurong',
    title: 'Flame of the South',
    blurb: 'Meng Huo swings the axe; Zhurong lights the fuse. She points every spell at your face and only pauses to burn down whatever tries to block the fire.',
    theme: 'Mono-Red Burn',
    tier: 5,
    difficulty: 'medium',
    portraitCardId: 'tk-other-zhurong',
    personality: makePersonality({ burnFaceLife: 20, removalBias: 1, holdback: 0.6 }),
    deck: expand([
      ['land-mountain', 24],
      ['tk-other-zhurong', 4],
      ['tk-wei-xiahoudun', 4],
      ['tk-other-huaxiong', 4],
      ['tk-wei-yuejin', 3],
      ['tk-wu-zhuran', 3],
      ['in-fire-attack', 4],
      ['in-char', 4],
      ['so-flame-lash', 4],
      ['so-lava-axe', 2],
      ['in-comet-blast', 2],
      ['so-warcry', 2],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 6 — Sima Yi: U/B defensive attrition plotter. (Medium)
  {
    id: 'simayi',
    name: 'Sima Yi',
    title: 'The Patient Serpent',
    blurb: 'Sima Yi never moves until the moment is hers. She strips your hand, kills your threats, and walls up behind deathtouch until the game is already lost. You just do not know it yet.',
    theme: 'Blue-Black Attrition Control',
    tier: 6,
    difficulty: 'medium',
    portraitCardId: 'tk-jin-simayi',
    personality: makePersonality({
      aggression: 0.85,
      attackThreshold: 0.75,
      holdback: 1.25,
      removalBias: -1,
      mulliganShift: 1,
    }),
    deck: expand([
      ['land-island', 10],
      ['land-swamp', 10],
      ['ld-moonlit-marsh', 4],
      ['tk-jin-simayi', 3],
      ['tk-jin-wangyuanji', 3],
      ['tk-jin-zhangchunhua', 3],
      ['tk-jin-jiachong', 4],
      ['bk-lamia-nightblade', 4],
      ['bk-spiderkin-weaver', 4],
      ['tk-wei-chenqun', 2],
      ['tk-jin-zhonghui', 3],
      ['in-doom-bolt', 4],
      ['in-reapers-due', 2],
      ['so-night-extortion', 3],
      ['so-dirge-of-loss', 1],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 7 — Yohime, Kitsune Matriarch: U/G counterspell tempo. (Hard)
  {
    id: 'yohime',
    name: 'Yohime, Kitsune Matriarch',
    title: 'The Nine-Tailed Veil',
    blurb: 'Yohime answers everything and commits to nothing until she must. She counters your key spell, bounces your best blocker, and rides a rising tide of fox spirits to victory.',
    theme: 'Blue-Green Kitsune Tempo',
    tier: 7,
    difficulty: 'hard',
    portraitCardId: 'bk-kitsune-matriarch',
    personality: makePersonality({
      counterFloor: 3,
      subtypeBias: 1.5,
      preferredSubtypes: ['Kitsune'],
      holdback: 1.5,
    }),
    deck: expand([
      ['land-island', 11],
      ['land-forest', 9],
      ['ld-foxglade-springs', 4],
      ['bk-kitsune-matriarch', 3],
      ['bk-kitsune-illusionist', 4],
      ['bk-kitsune-dreamweaver', 4],
      ['bk-nekomata-scout', 4],
      ['bk-mermaid-chartsinger', 2],
      ['gk-artemis', 4],
      ['tk-wu-luxun', 3],
      ['in-read-the-ruse', 4],
      ['in-dream-fracture', 2],
      ['in-sudden-insight', 2],
      ['in-undertow', 4],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 8 — Cao Cao: W/B Wei tribal swarm boss. (Hard)
  {
    id: 'caocao',
    name: 'Cao Cao',
    title: 'Hero of Chaos',
    blurb: "The gauntlet's final wall. Cao Cao musters the whole of Wei: a tide of soldiers behind the Hegemon's banner, led by the woman herself, who takes a card from your hand each time she connects.",
    theme: 'White-Black Wei Tribal',
    tier: 8,
    difficulty: 'hard',
    portraitCardId: 'tk-wei-caocao',
    personality: makePersonality({
      subtypeBias: 2,
      preferredSubtypes: ['Wei'],
      attackThreshold: -0.75,
    }),
    deck: expand([
      ['land-plains', 10],
      ['land-swamp', 10],
      ['ld-shadowed-court', 4],
      ['tk-wei-caocao', 3],
      ['tk-wei-zhangliao', 4],
      ['tk-wei-dianwei', 4],
      ['tk-wei-xuhuang', 4],
      ['tk-wei-yujin', 3],
      ['tk-wei-wangyi', 4],
      ['tk-wei-caoren', 3],
      ['tk-wei-xunyu', 4],
      ['tk-wei-jiaxu', 3],
      ['en-banner-of-the-hegemon', 3],
      ['in-doom-bolt', 1],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 9 — Hel: U/B mill-reanimator control. (Hard · Ragnarök)
  {
    id: 'hel',
    name: 'Hel, Queen of Mist',
    title: 'Warden of the Dishonored Dead',
    blurb: 'The first Ragnarök boss buries her own deck to raise an army from it. Hel mills, reanimates the fallen, and grinds you down behind a wall of deathtouch draugr. Every creature you trade away only feeds her return.',
    theme: 'Blue-Black Mill Reanimator',
    tier: 9,
    difficulty: 'hard',
    portraitCardId: 'rg-hel',
    personality: makePersonality({
      aggression: 0.9,
      holdback: 1.2,
      removalBias: 0.5,
      mulliganShift: 1,
    }),
    deck: expand([
      ['land-island', 10],
      ['land-swamp', 10],
      ['ld-moonlit-marsh', 4],
      ['rg-hel', 3],
      ['rg-norns', 3],
      ['rg-mist-seer', 4],
      ['rg-hels-handmaiden', 4],
      ['rg-corpse-taker', 4],
      ['rg-barrow-wight', 3],
      ['rg-draugr-jarl', 3],
      ['rg-plaguebearer-draugr', 3],
      ['rg-thanatos', 2],
      ['rg-call-the-einherjar', 3],
      ['in-doom-bolt', 4],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 10 — Brunhild: R/W Valkyrie double-strike aggro. (Hard · Ragnarök)
  {
    id: 'brunhild',
    name: 'Brunhild, the Last Valkyrie',
    title: 'Chooser of the Slain',
    blurb: "The gauntlet's summit. Brunhild leads a wing of double-striking Valkyries and Einherjar that hit twice and hit first, a curve that opens fast and only accelerates. Race her and you lose the race; block her and you lose the blockers.",
    theme: 'Red-White Valkyrie Double Strike',
    tier: 10,
    difficulty: 'hard',
    portraitCardId: 'rg-brunhild',
    personality: makePersonality({
      aggression: 1.3,
      attackThreshold: -0.75,
      subtypeBias: 1,
      preferredSubtypes: ['Valkyrie'],
    }),
    deck: expand([
      ['land-mountain', 12],
      ['land-plains', 12],
      ['rg-brunhild', 3],
      ['rg-valkyrie-captain', 4],
      ['rg-berserker-chieftain', 3],
      ['rg-einherjar-champion', 4],
      ['rg-berserker-duelist', 4],
      ['rg-valkyrie-vanguard', 3],
      ['rg-dawn-valkyrie', 4],
      ['rg-ember-valkyrie', 4],
      ['rg-shieldwall-maiden', 4],
      ['rg-xuchu', 3],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 11 — The Morrigan: B/G sever-control. (Hard · Celtic Fae)
  {
    id: 'the-morrigan',
    name: 'The Morrigan',
    title: 'Black-Wing Omen of the Veil',
    blurb: 'The court does not need to kill what it can make impossible. The Morrigan severs your graveyard, starves the top of her own deck for better answers, and sends ravens through the gaps until inevitability has a name.',
    theme: 'Black-Green Sever Control',
    tier: 11,
    difficulty: 'hard',
    portraitCardId: 'cf-morrigan-black-wing',
    personality: makePersonality({
      aggression: 1.05,
      holdback: 1.2,
      attackThreshold: 0.25,
      blockLifePressure: 1.15,
      mulliganShift: 1,
      removalBias: -0.5,
      subtypeBias: 1.25,
      preferredSubtypes: ['Fae'],
    }),
    deck: expand([
      ['land-swamp', 10],
      ['land-forest', 10],
      ['cf-blackthorn-crossing', 4],
      ['cf-morrigan-black-wing', 3],
      ['cf-bean-sidhe-keening', 3],
      ['cf-raven-torc-envoy', 4],
      ['cf-crowbone-prophet', 3],
      ['cf-bog-lantern-witch', 3],
      ['cf-bog-banshee', 4],
      ['cf-black-dog-of-lane', 3],
      ['cf-hounds-of-annwn', 3],
      ['cf-blackthorn-duelist', 2],
      ['cf-bitter-geas', 4],
      ['cf-gold-ring-bargain', 2],
      ['cf-barrow-whisper', 2],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 12 — Titania: U/G Fae token court. (Hard · Celtic Fae summit)
  {
    id: 'titania',
    name: 'Titania',
    title: 'Queen of the Silver Court',
    blurb: 'Titania never raises her voice; she raises a court. Foresee finds the next answer, untouchable queens hold the line, and every dawn adds another witness until the silver-green tide covers the field.',
    theme: 'Blue-Green Fae Token Court',
    tier: 12,
    difficulty: 'hard',
    portraitCardId: 'cf-titania-silver-court',
    personality: makePersonality({
      aggression: 1.25,
      holdback: 0.9,
      attackThreshold: -0.25,
      blockThreshold: -0.25,
      trickRespect: 0.9,
      subtypeBias: 2,
      preferredSubtypes: ['Fae'],
      mulliganShift: 1,
    }),
    deck: expand([
      ['land-island', 12],
      ['land-forest', 12],
      ['cf-titania-silver-court', 3],
      ['cf-selkie-tide-queen', 4],
      ['cf-silver-branch-oracle', 3],
      ['cf-hollow-hill-gatekeeper', 3],
      ['cf-green-knoll-champion', 3],
      ['cf-thornmaze-patrol', 2],
      ['cf-fae-ring-initiate', 2],
      ['cf-mistwing-pixie', 2],
      ['cf-selkie-runner', 3],
      ['cf-willow-wisp-guide', 1],
      ['cf-fae-court-tokenmaker', 3],
      ['cf-dance-under-mound', 3],
      ['cf-ash-and-mistletoe', 4],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 13 — Morgan: U/B Thorn-Crown Quest control. (Hard · Arthurian Court)
  {
    id: 'morgan',
    name: 'Morgan of the Thorn Crown',
    title: 'Queen of the Woundbound Court',
    blurb: 'Morgan keeps the chapel bell tolling after the kingdom has gone silent. She severs what you meant to reclaim, curses each dawn, and waits behind a crown of answers until your last safe creature is gone.',
    theme: 'Blue-Black Thorn-Crown Quest Control',
    tier: 13,
    difficulty: 'hard',
    portraitCardId: 'ac-morgan-thorn-crown',
    personality: makePersonality({
      aggression: 1.05,
      holdback: 1.15,
      attackThreshold: 0.1,
      blockLifePressure: 1.15,
      mulliganShift: 1,
      removalBias: -0.5,
    }),
    deck: expand([
      ['land-island', 9],
      ['land-swamp', 10],
      ['ld-moonlit-marsh', 4],
      ['ac-morgan-thorn-crown', 4],
      ['ac-black-chapel-curse', 2],
      ['ac-raven-of-camlann', 3],
      ['ac-velvet-court-spy', 4],
      ['ac-merlin-crow-clock', 3],
      ['ac-lakeblade-initiate', 4],
      ['ac-oathbroken-knight', 4],
      ['ac-castle-blackguard', 4],
      ['in-undertow', 2],
      ['in-doom-bolt', 4],
      ['in-reapers-due', 3],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 14 — Artoria: W/U awakened Knight Quest summit. (Hard · Arthurian Court)
  {
    id: 'artoria',
    name: 'Artoria, Once and Future Queen',
    title: 'The Crown That Rises Again',
    blurb: 'Artoria builds a court from every broken oath. Quests call squires to her banner, awakened knights take the field, and disciplined steel closes the distance before hope can find another shape.',
    theme: 'White-Blue Awakened Knight Quests',
    tier: 14,
    difficulty: 'hard',
    portraitCardId: 'ac-artoria-once-future',
    personality: makePersonality({
      aggression: 1.15,
      holdback: 1.0,
      attackThreshold: -0.1,
      blockThreshold: -0.4,
      subtypeBias: 2,
      preferredSubtypes: ['Knight'],
      mulliganShift: 1,
    }),
    deck: expand([
      ['land-plains', 9],
      ['land-island', 8],
      ['ac-avalon-shore', 4],
      ['ac-lowland-fort', 2],
      ['ac-artoria-once-future', 4],
      ['ac-galahad-silver-oath', 4],
      ['ac-lakeblade-initiate', 4],
      ['ac-camelot-banneret', 4],
      ['ac-pennant-carrier', 4],
      ['ac-excalibur-from-lake', 4],
      ['ac-lion-standard', 4],
      ['ac-quest-for-the-grail', 2],
      ['in-undertow', 4],
      ['in-shieldwall', 3],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 15 — Carmilla: B/R dreaded vampire pressure. (Hard · Gothic Monsters)
  {
    id: 'carmilla',
    name: 'Carmilla, Crimson Host',
    title: 'The Feast That Walks',
    blurb: 'Carmilla opens the doors and lets the night rush in. Her dreaded court comes from two directions at once, while every bite leaves her stronger and your defenses thinner.',
    theme: 'Black-Red Dreaded Vampire Pressure',
    tier: 15,
    difficulty: 'hard',
    portraitCardId: 'gm-carmilla-crimson-host',
    personality: makePersonality({
      aggression: 1.35,
      attackThreshold: -0.4,
      blockLifePressure: 1.1,
      subtypeBias: 1.25,
      preferredSubtypes: ['Vampire'],
      removalBias: 0.25,
    }),
    deck: expand([
      ['land-swamp', 10],
      ['land-mountain', 10],
      ['ld-burning-luoyang', 4],
      ['gm-carmilla-crimson-host', 4],
      ['gm-elizabeth-blood-mirror', 4],
      ['gm-ravenloft-heiress', 4],
      ['gm-black-veil-matron', 4],
      ['gm-blood-opera-soloist', 4],
      ['gm-batcloak-cutthroat', 4],
      ['gm-moonlit-werewolf', 4],
      ['gm-manor-thrall', 4],
      ['gm-midnight-bite', 4],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 16 — The Bride: U/B empowered stitchwork control. (Hard · Gothic Monsters summit)
  {
    id: 'the-bride',
    name: 'The Bride, Storm-Crowned',
    title: 'The Vow Beneath the Lightning',
    blurb: 'The Bride does not hurry the ending. She filters every draw, stitches the fallen back into service, and surrounds herself with artifact bodies until the storm has nowhere left to break.',
    theme: 'Blue-Black Empowered Stitchwork Control',
    tier: 16,
    difficulty: 'hard',
    portraitCardId: 'gm-bride-storm-crowned',
    personality: makePersonality({
      aggression: 1.25,
      holdback: 1,
      attackThreshold: -0.25,
      blockLifePressure: 1.15,
      blockThreshold: -0.3,
      trickRespect: 1.1,
      mulliganShift: 1,
      removalBias: -0.75,
      subtypeBias: 1,
      preferredSubtypes: ['Construct'],
    }),
    deck: expand([
      ['land-island', 10],
      ['land-swamp', 10],
      ['ld-moonlit-marsh', 4],
      ['gm-bride-storm-crowned', 4],
      ['so-divination', 4],
      ['gm-stitchwork-guardian', 4],
      ['gm-stormglass-golem', 4],
      ['gm-ravenloft-heiress', 4],
      ['gm-batcloak-cutthroat', 4],
      ['in-doom-bolt', 4],
      ['in-undertow', 4],
      ['gm-stormtower-resurrection', 4],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 17 — Glass-Coffin Queen: W/B Retell bloodoath grind. (Hard · Dark Tales)
  {
    id: 'glass-coffin-queen',
    name: 'Glass-Coffin Queen',
    title: 'The Court Behind the Glass',
    blurb: 'The Queen lets every defeat become another telling. Blood oaths keep her court standing, poison mirrors strip away your best creature, and the coffin closes only after the graveyard is empty.',
    theme: 'White-Black Retell Bloodoath Grind',
    tier: 17,
    difficulty: 'hard',
    portraitCardId: 'dt-glass-coffin-queen',
    personality: makePersonality({
      aggression: 1.35,
      holdback: 0.95,
      attackThreshold: -0.35,
      blockLifePressure: 1.1,
      blockThreshold: -0.3,
      trickRespect: 1.1,
      mulliganShift: 1,
      removalBias: -0.75,
      subtypeBias: 0.75,
      preferredSubtypes: ['Human'],
      lifegainBias: 0.5,
    }),
    deck: expand([
      ['land-plains', 10],
      ['land-swamp', 10],
      ['ld-shadowed-court', 4],
      ['dt-glass-coffin-queen', 4],
      ['dt-poison-mirror-regent', 4],
      ['gm-black-cat-familiar', 4],
      ['gm-chapel-exorcist', 4],
      ['gm-batcloak-cutthroat', 4],
      ['gm-ravenloft-heiress', 4],
      ['in-doom-bolt', 4],
      ['in-reapers-due', 3],
      ['dt-sleeping-curse', 1],
      ['dt-apple-of-endless-sleep', 3],
      ['dt-once-more-with-magic', 1],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 18 — Abyssal Songstress: U/B Skim tempo-control. (Hard · Dark Tales summit)
  {
    id: 'abyssal-songstress',
    name: 'Abyssal Songstress',
    title: 'The Bargain Beneath the Tide',
    blurb: 'The Songstress turns every stumble into a better hand. Her bargains keep the tide of cards rising, while filtered answers and skyborne hunters leave the opponent fighting a story already decided.',
    theme: 'Blue-Black Skim Sea-Bargain Control',
    tier: 18,
    difficulty: 'hard',
    portraitCardId: 'dt-abyssal-songstress',
    personality: makePersonality({
      aggression: 1.35,
      holdback: 0.95,
      attackThreshold: -0.4,
      blockLifePressure: 1.1,
      blockThreshold: -0.3,
      trickRespect: 1.1,
      mulliganShift: 1,
      removalBias: -0.75,
      subtypeBias: 1,
      preferredSubtypes: ['Construct'],
    }),
    deck: expand([
      ['land-island', 8],
      ['land-swamp', 12],
      ['dt-tide-cavern', 4],
      ['dt-abyssal-songstress', 4],
      ['gm-black-cat-familiar', 4],
      ['gm-batcloak-cutthroat', 4],
      ['gm-blood-opera-soloist', 4],
      ['gm-ravenloft-heiress', 4],
      ['gm-black-veil-matron', 4],
      ['gm-stormglass-golem', 4],
      ['in-undertow', 1],
      ['in-grave-chill', 1],
      ['in-doom-bolt', 3],
      ['dt-silver-fishbone', 1],
      ['dt-undersea-bargain', 1],
      ['dt-mirror-apple-curse', 1],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 19 - Queen of the Lanterned Roof: W/U Kitsune Hauntlink tempo-control. (Hard · Yokai Nights summit)
  {
    id: 'queen-of-the-lanterned-roof',
    name: 'Queen of the Lanterned Roof',
    title: 'The Lanterned Roof',
    blurb: 'From the highest roof in the city, the Queen turns every return into a delay. Her Kitsune keep the skyline safe while linked lanterns and careful answers make the next turn belong to her.',
    theme: 'White-Blue Kitsune Hauntlink Tempo-Control',
    tier: 19,
    difficulty: 'hard',
    portraitCardId: 'yn-queen-of-the-lanterned-roof',
    personality: makePersonality({
      aggression: 1.25,
      holdback: 1,
      attackThreshold: -0.2,
      removalBias: -0.5,
      subtypeBias: 1.5,
      preferredSubtypes: ['Kitsune'],
    }),
    deck: expand([
      ['land-plains', 10],
      ['land-island', 10],
      ['ld-misty-palace-terrace', 4],
      ['yn-queen-of-the-lanterned-roof', 4],
      ['yn-lantern-court-regent', 4],
      ['yn-white-lantern-vanguard', 4],
      ['yn-bluewire-illusionist', 4],
      ['yn-moonlit-data-duelist', 4],
      ['yn-hauntlink-signal-lure', 4],
      ['yn-sanctum-of-many-masks', 2],
      ['yn-bastion-lantern', 2],
      ['dt-sea-glass-knife', 4],
      ['yn-signal-bridge', 2],
      ['yn-circuit-foretelling', 2],
    ]),
  },

  // ---------------------------------------------------------------------
  // Rung 20 - Kitsune Neon Tyrant: U/R Hauntlink pressure. (Hard · Yokai Nights summit)
  {
    id: 'kitsune-neon-tyrant',
    name: 'Kitsune Neon Tyrant',
    title: 'The Skyline Belongs to Her',
    blurb: 'The Tyrant does not wait for the city to choose a winner. Warcry runners hit first, linked spirits own the air, and every burn spell turns a narrow lead into a closing siren.',
    theme: 'Blue-Red Kitsune Hauntlink Pressure',
    tier: 20,
    difficulty: 'hard',
    portraitCardId: 'yn-kitsune-neon-tyrant',
    personality: makePersonality({
      aggression: 1.45,
      holdback: 0.75,
      attackThreshold: -0.6,
      removalBias: 0.25,
      subtypeBias: 1.25,
      preferredSubtypes: ['Kitsune'],
    }),
    deck: expand([
      ['land-island', 10],
      ['land-mountain', 10],
      ['ld-red-cliffs-anchorage', 4],
      ['yn-kitsune-neon-tyrant', 4],
      ['yn-redline-queenpin', 4],
      ['yn-redline-kitsune', 4],
      ['yn-magenta-kitsune-runner', 4],
      ['yn-network-sprite', 3],
      ['bk-harpy-skirmisher', 3],
      ['yn-hauntlink-apex', 2],
      ['yn-burning-mask-of-the-void', 2],
      ['yn-ember-link-chain', 2],
      ['in-fire-attack', 4],
      ['in-undertow', 4],
    ]),
  },
];

/** Look up an avatar by id (throws on unknown — callers pass validated ids). */
export function avatarById(id: string): Avatar {
  const a = AVATARS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown avatar id: ${id}`);
  return a;
}

/** The avatar at a 1-based gauntlet rung (1..20). */
export function avatarForRung(rung: number): Avatar {
  const a = AVATARS.find((x) => x.tier === rung);
  if (!a) throw new Error(`No avatar for rung ${rung}`);
  return a;
}
