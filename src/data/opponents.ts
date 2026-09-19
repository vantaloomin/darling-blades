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
 * Gauntlet ordering is by `tier` (1..26 currently landed). Difficulty follows the plan:
 * tiers 1-3 Easy, 4-6 Medium, 7-26 Hard (9-10 are the Ragnarök bosses,
 * 11-12 are the Celtic Fae bosses, 13-14 are the Arthurian Court pair, and
 * 15-16 are the Gothic Monsters pair, 17-18 are the Dark Tales summit pair,
 * and 19-20 are the Yokai Nights summit pair, and 21-22 are the Sands of the
 * Duat summit pair: Anubis at 21, Bastet as the final rung 22 - the owner swapped
 * the order 2026-08-21 so the climb ends on the stronger boss). Rungs 23-24
 * are the Starborne summit pair: Chrome Broodmother at 23, The Violet Signal
 * Queen at 24. Rungs 25-26 are the Drowned Deep summit pair: The Drowned
 * Deacon at 25, The Marsh-Mother as the final rung at 26.
 */
export interface Avatar {
  id: string;
  name: string;
  title: string;
  blurb: string;
  theme: string;
  tier: number; // 1..26 (unique)
  difficulty: Difficulty;
  deck: string[]; // 60 real cardIds — classic; the Tower and Draft still pilot this
  personality: Personality;
  portraitCardId: string;
  /*
   * Reserve-native decks (1.6 migration, scripted first cut 2026-08-08 via
   * scripts/avatarReserveDecks.ts — deterministic, validator-gated; regenerate
   * with `npx tsx scripts/avatarReserveDecks.ts --print`). Hand-tuning against
   * `--avatars-reserve` / `--avatars-darlings` edits these literals in place.
   * Notes from the conversion: Meng Huo's so-rampant-growth ×3 (land-fetch,
   * reserve-illegal) was replaced by the in-theme filler; Artoria's
   * ac-lowland-fort was a reserve-illegal utility tapland until 2026-09-18,
   * when the land-economy conversion made it a Duty artifact and the
   * converter began retaining it as a spell (measured 8 points weaker, so her
   * reserve list is hand-tuned); five avatars carry deterministic catalog stand-in
   * Darlings pending the tuning pass (menghuo, hestia, zhurong,
   * queen-of-the-lanterned-roof, kitsune-neon-tyrant).
   */
  reserveDeck: string[]; // exactly WARCHEST_DECK_SIZE no-land cards
  landReserve: string[]; // exactly 10 lands, ≤5 duals, basics+duals only
  darlingsDeck: string[]; // exactly DARLINGS_DECK_SIZE singletons in the Darling's colors
  darlingId: string; // eligible legendary creature leading darlingsDeck
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
 * Rungs 21-22 - the Sands of the Duat summit pair, measured 2026-08-21 at 40
 * seeds/cell with the full `--avatars` matrix. Initial deck candidates measured
 * Bastet 60/80/65/80/90, avg 75%; Anubis 53/75/45/75/53, avg 60%.
 * Both sat below the R18 neighborhood, so one deck-only tuning pass was
 * allowed. Bastet exchanged four Whisker-Count Scouts for Barge-Pawed
 * Spearwomen and two Blade-Dancers for Bakhet; Anubis traded the Keeper of the
 * Last Mark package for earlier Cut the Wrappings answers and more low-curve
 * Embalmer bodies. A follow-up 60-card legality correction removed two
 * redundant nonland slots from each candidate before the final measurement.
 * Post-swap re-measure 2026-08-21 (Anubis now rung 21, seeds follow the rung): Anubis avg 51.0%, floor 46.0%, band 44.5%.
 * Final valid rows: Bastet 68/83/73/85/78, avg 77.0%; Anubis 35/73/50/78/53, avg
 * 57.5%. Every R21/R22 cell had 40 decided games and zero draws. Final 40-seed
 * win-rate floors are R21 >= 72.0% and R22 >= 52.5%; provisional 6.5pp bands
 * are R21 >= 70.5% and R22 >= 51.0%. R21 clears R20; R22 remains an honest
 * summit inversion below R21 and the R18 neighborhood. The pre-correction
 * exploratory result is retained here as the initial tuning measurement, not
 * as a shipping pin.
 * Full-ladder flags are the pre-existing R13 and R19 inversions plus this R22
 * inversion.
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
 * ===========================================================================
 * 2026-08-09 - THE DATED 1.6 RESERVE BASELINE (Stage 4 re-baseline).
 * ===========================================================================
 * 51,400 games, 126 turn-limit draws (0.2%), 0 engine exceptions, measured
 * after the parameter flip (40 cards / 5-card opener, both reserve formats),
 * priority-window rules revision 2, the reserve-aware mulligan fix, and the
 * quality-led deck rebuilds. Run with three lanes under the owner's 65% CPU
 * cap; see the scripts' headers for the shard math.
 *
 * SCOPE NOTE - SUPERSEDED 2026-08-23. As written on 2026-08-09 this said the
 * W7 classic table above remained "the live authority for the classic ladder
 * and its floors", because "classic has not retired: the Tower still pilots
 * avatar.deck". Classic retired the NEXT DAY (2026-08-10, FEATURES
 * .classicRetired): DuelScene seats avatarReserveSide for every gauntlet duel,
 * so nothing pilots avatar.deck any more. runFloorMatrix and the tier dial
 * rows were both migrated to reserve-native that day; runAvatarMatrix was not,
 * which left the PUBLIC rung-floor gate in tests/ai/winrate.test.ts pricing a
 * dead format until 2026-08-23. It is reserve-native now, and the W7 classic
 * table below is history, not authority. The reserve tables are the only live
 * baseline; avatar.deck survives only as the converter's SOURCE list.
 *
 * AVATAR LADDER - WARCHEST (--avatars-reserve, 200 seeds/cell, avatars vs
 * all 11 shipped player decks): R1-R20 averages 23, 14, 34, 51, 53, 53, 85,
 * 68, 64, 81, 78, 75, 54, 57, 66, 50, 75, 86, 56, 86. Easy 14-34, medium
 * 51-53, hard 50-86 with a 70.1 mean - the tier bands separate cleanly and
 * the hard band is honest variety rather than the 60-point sprawl the
 * scripted first cut produced.
 *
 * AVATAR LADDER - DARLINGS (--avatars-darlings, 200 seeds/cell, avatars vs
 * the five curated shop precons): R1-R20 averages 26, 9, 29, 67, 53, 44, 84,
 * 62, 78, 82, 72, 83, 61, 62, 72, 58, 78, 64, 65, 62. Hard mean 70.2, which
 * lands within a point of the Warchest ladder - the two formats now present
 * comparable difficulty, which was never true before.
 *
 * PLAYER DECKS HEAD TO HEAD (--player-decks, 200 seeds/cell, 11,000 games):
 * Burning Tides 62.6, Questing Table 57.3, Wild Communion 57.0, Midnight
 * Storybook 56.9, Neon Afterimage 54.0, Crimson Muster 53.7, Bloodmoon
 * 50.7, Valhalla's Muster 44.0, Grave Harvest 40.9, Glimmer Bargain 36.5,
 * Shadow Mandate 36.3. A 26.3-point spread, down from 41.3 at the first
 * cut; nothing is broken, and the two floors are soft rather than dead.
 *
 * FLEET BASELINES (re-dating the STALE 1.5.5 numbers below). These measure
 * the FORMAT via deterministic fixtures, not shipped product, and carry no
 * balance claim. Warchest (--warchest, 200 seeds): Burning 72.4, Crimson
 * 58.0, Grave 48.3, Shadow 36.9, Wild 34.5. Darlings (--darlings, 200
 * seeds): Gaia 79.8, Dian Wei 69.3, Ares 55.4, Ghost-Net 37.4, Athena 33.8,
 * Aphrodite 23.3 - the fixture spread stays wide (56pp) because these are
 * greedy cheapest-first fleets, and it is markedly wider than the 26pp
 * spread of the real shipped decks. Read the player-deck table above for
 * anything product-facing.
 *
 * ===========================================================================
 * 2026-08-23 - THE 1.6 RELEASE-CUT PLAYER-DECK BASELINE.
 * ===========================================================================
 * `--player-decks --seeds 200`, 12 decks round-robin, 66 cells, 13,200 games,
 * 4,661s. 13,200 decided, 0 turn-limit draws, 0 engine exceptions. This
 * SUPERSEDES the 2026-08-09 player-deck table above, which predated Duat going
 * live (+245 cards), the card-health triage (#257), the companion flip (+60),
 * and both summit tunes - it was the last stale headline number in the cut.
 *
 *   Pride at the Ninth Gate 65.3 · Neon Afterimage 63.5 · Burning Tides 60.8 ·
 *   Midnight Storybook 57.5 · Questing Table 56.4 · Crimson Muster 52.0 ·
 *   Wild Communion 49.8 · Bloodmoon Masquerade 46.8 · Grave Harvest 42.1 ·
 *   Valhalla's Muster 36.3 · Glimmer Bargain 36.0 · Shadow Mandate 33.4
 *
 * SPREAD 31.9 points, up from 26.3. READ THE DELTAS WITH THIS CAVEAT: the
 * field grew 11 -> 12 decks and the newcomer is the strongest, so every other
 * deck now plays 200 extra games against a 65% opponent. That drags each
 * aggregate down roughly 2-3pp mechanically. Wild Communion's -7.2 is really
 * about -4.5 and Valhalla's -7.7 about -5.5; Neon's +9.5 is real and if
 * anything understated.
 *
 * NOTHING IS BROKEN: the top is 65.3 (not oppressive), the floor is 33.4 (not
 * dead), and 13,200 games produced zero draws and zero engine exceptions.
 * Shipped as the 1.6 cut baseline on that basis. TWO WATCH ITEMS for 1.7,
 * named rather than left to be rediscovered:
 *   1. The NEWEST SET'S PRECON LEADS THE FIELD. Pride at the Ninth Gate at
 *      65.3 is the deck a new player is most likely to buy and the one most
 *      likely to feel unfair across the table. Common for a fresh set, benign
 *      at this magnitude, worth watching if the next set repeats it.
 *   2. NEON AFTERIMAGE MOVED +9.5pp WITH NOBODY TUNING IT, the largest
 *      unexplained mover here. Most plausibly a second-order effect of the
 *      #257 recosts, but that is a HYPOTHESIS, not a measurement - it was not
 *      verified before the cut and should not be cited as if it were.
 * Shadow Mandate (33.4) and Glimmer Bargain (36.0) remain the soft pair the
 * owner ruled playable-not-broken; that ruling was made at a 26.3 spread and
 * was re-surfaced at 31.9 before the cut.
 *
 * NOT MEASURED BY THIS TABLE, and deliberately still open: whether an
 * OPTIMIZING player can craft a degenerate deck from the 1,079-card pool.
 * Only the persona metagame sweep answers that, and it was stopped 3h in
 * (2 of 6 personas, round 0) when it projected ~37h. The mono-goodstuff
 * question the format gate raised (docs/plan-1.6.md) is still open with it.
 *
 * 2026-07-31 - RESERVE FORMAT BASELINES (1.5.5 reveal gate; the two
 * matrices the 1.5.0 release split left TO MEASURE). SUPERSEDED 2026-08-09
 * by the dated table above; retained as history. STALE 2026-08-06:
 * these numbers were measured while the land-count mulligan bands made
 * every AI mulligan exactly twice in reserve formats (fixed in
 * EasyAI/MediumAI with reserve-aware keep rules); re-measure and re-date
 * both matrices before citing them. Fixture fleets from
 * scripts/reserveMatrixDecks.ts (deterministic, validator-gated; they
 * measure the FORMAT, not tuned decks - no product balance claim, and no
 * classic-pool change may be justified by these numbers per
 * docs/plan-battle-box.md).
 *
 * LOSSLESSNESS (the reveal gate's primary result): 0 engine exceptions
 * in every measured configuration - no seed produced a stuck or dead
 * game state. Warchest decided 2,000/2,000 with 0 draws. Darlings under
 * the current command-zone rules decided 2,982/3,000 with 18 turn-limit
 * draws (0.6%, grindy control cells; down from 0.93% at the in-deck
 * shape - guaranteed threat access shortens attrition games) - worth
 * watching at reveal, not an engine fault.
 *
 * Warchest (--warchest, 200 seeds/cell, 2,000 games, neutral hard,
 * starter-derived playset fleet): Crimson 63.9, Burning 60.0, Grave 44.1,
 * Shadow 43.3, Wild 38.8. Aggro-topped 25pp spread, worst cell 78
 * (Burning vs Shadow); coherent field, no degenerate matchup.
 *
 * Darlings (--darlings, 200 seeds/cell, 3,000 games, neutral hard,
 * curve-greedy singleton fleet per color spread, 2026-08-01 UNDER THE
 * COMMAND-ZONE RULES - external Darling, +2 tax per return, 4-pays-2
 * valve): Gaia [G] 79.7, Dian Wei [B] 69.1, Ares [R] 57.7, Ghost-Net
 * Archon [U] 37.2, Athena [W] 34.0, Aphrodite [WU] 21.6; 2,982/3,000
 * decided, 18 turn-limit draws (0.6%), 0 engine exceptions. Guaranteed
 * Darling access widened the fixture spread (Gaia's attrition engine
 * profits most; Athena's defensive fixture collapsed 50.5 -> 34.0 -
 * her greedy list leaned on drawing her early, which the zone now
 * gives every deck). The wide spread is a property of the greedy
 * cheapest-first fixtures, not a roster claim - the curated rival
 * ladder stays unpromised and the shipped precons carry their own
 * measured baseline before any product balance claim.
 * (History, superseded shapes: 80-card IN-DECK Darling measured
 * Gaia 74.4 / Ares 69.1 / Dian Wei 57.0 / Athena 50.5 / Ghost-Net
 * 29.3 / Aphrodite 19.7 with 28 draws at 0.93%; 50-card in-deck
 * measured Ares 76.1 / Gaia 72.1 / Dian Wei 58.2 / Athena 48.0 /
 * Ghost-Net 23.5 / Aphrodite 22.1 with 3,000/3,000 decided.)
 *
 * Darlings PRECONS (--darlings-precons, 200 seeds/cell, 2,000 games,
 * neutral hard, 2026-08-01, the five shipped product decks under the
 * command-zone rules): Queen Below 58.8, Sable Warballad 58.1,
 * Mirror-Blood Rush 46.8, Sunwell Ledger 44.1, Red Cliffs Refrain
 * 42.3. A 16.5pp product spread (vs the fixture fleet's 58pp) with
 * 1,990/2,000 decided, 10 turn-limit draws (0.5%), 0 engine
 * exceptions; worst cell 71 (Sunwell over Red Cliffs). The FREE deck
 * (Red Cliffs Refrain) sitting mildly bottom is deliberate product
 * posture, not an accident - it onboards, the paid decks aspire.
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
    reserveDeck: expand([
      ['bk-bearkin-guardian', 4],
      ['bk-squirrelkin-hoarder', 4],
      ['tk-shu-madai', 4],
      ['tk-shu-jiangwei', 4],
      ['gk-pan', 4],
      ['tk-shu-zhangbao', 2],
      ['tk-shu-huangzhong', 4],
      ['tk-shu-weiyan', 2],
      ['bk-rhinokin-charger', 4],
      ['tk-other-menghuo', 4],
      ['so-rampant-growth', 4],
    ]),
    landReserve: expand([
      ['land-forest', 10],
    ]),
    darlingsDeck: [
      'dd-marsh-grave-risen',
      'cf-cauldron-of-dagda',
      'sd-heart-scale-reliquary',
      'sd-fourth-weighing',
      'yn-thorncode-matriarch',
      'ac-green-knight-challenge',
      'sd-silt-crowned-harvester',
      'yn-jade-kitsune-forager',
      'ac-ashwood-ranger',
      'dt-storybook-of-ashes',
      'tk-shu-guanyinping',
      'cf-thornmaze-patrol',
      'cf-blackthorn-duelist',
      'gm-glasshouse-monster',
      'ac-grail-hermit',
      'dt-wind-painted-scout',
      'gm-stormglass-golem',
      'sd-flood-mark-shaman',
      'dt-chart-the-reef-road',
      'bk-boarkin-rootbreaker',
      'dd-drowned-druid',
      'dd-marsh-wight',
      'dd-the-marsh-remembers',
      'rg-alpha-of-the-hunt',
      'in-skysweeper-gale',
      'yn-rootcode-monk',
      'sd-the-offering-table',
      'in-valley-mist',
      'dt-grandmothers-remedy',
      'rg-yggdrasils-verdict',
      'ac-hunt-the-boar',
      'tk-other-menghuo',
      'bk-rhinokin-charger',
      'tk-shu-weiyan',
      'gk-artemis',
      'tk-shu-huangzhong',
      'bk-bearkin-guardian',
      'bk-squirrelkin-hoarder',
      'tk-shu-madai',
      'gk-pan',
      'tk-shu-jiangwei',
      'tk-shu-zhangbao',
      'sd-flood-fed-colossus',
      'rg-great-stag',
      'gk-demeter',
      'dd-tidepool-wall',
      'sd-deep-flood-behemoth',
      'dt-thorn-castle-warden',
      'sd-floodwall-matriarch',
      'so-rampant-growth',
      'tk-shu-sword-dancer',
      'ac-questing-beast-maiden',
      'rg-jotun-earthshaker',
      'yn-jade-root-yokai',
      'tk-jin-dengai',
      'sd-silt-field-champion',
      'bk-deerkin-grovekeeper',
      'ar-training-dummy',
      'cf-thorn-sprite',
      'bk-sheepkin-dreamherd',
      'bk-turtlekin-bulwark',
      'dt-briar-hedge-matriarch',
      'yn-greenline-bruiser',
      'bk-packmother',
      'cf-mushroom-ring-guard',
      'dd-reef-crab',
      'bk-nekomata-scout',
      'ac-court-archer',
      'cf-heatherblade-scout',
      'gm-grave-gardener',
      'tk-shu-baosanniang',
      'dd-the-reef-that-walks',
      'ar-siege-juggernaut',
      'cf-green-knoll-champion',
      'dd-tidepool-colossus',
      'ac-bramble-chapel',
      'cf-mossy-ring',
      'dt-wolf-path',
      'gm-thorned-cemetery',
    ],
    darlingId: 'gk-gaia',
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
    reserveDeck: expand([
      ['bk-bunny-vanguard', 4],
      ['gk-hestia', 4],
      ['gk-hoplite', 4],
      ['bk-holstaur-milkmaid', 4],
      ['tk-wei-caiwenji', 4],
      ['bk-foxfire-priestess', 4],
      ['gk-apollo', 4],
      ['gk-eos', 4],
      ['tk-wei-pangde', 4],
      ['in-blessed-respite', 4],
    ]),
    landReserve: expand([
      ['land-plains', 10],
    ]),
    darlingsDeck: [
      'bk-foxfire-priestess',
      'sd-crown-bearer-of-the-last-hall',
      'ac-quest-for-the-grail',
      'dd-lamp-oil-saint',
      'in-blessed-respite',
      'yn-lantern-fixer',
      'sd-heart-scale-reliquary',
      'sd-fourth-weighing',
      'ac-round-table-vow',
      'dd-drowned-saint',
      'yn-white-veil-collapse',
      'dt-storybook-of-ashes',
      'sd-white-gate-adjudicator',
      'dd-bell-tower-sentry',
      'dt-honor-blade-captain',
      'gm-stormglass-golem',
      'dd-lamp-lit-vigil',
      'dt-glass-stair-duelist',
      'cf-ogham-fate-stones',
      'dd-the-morning-count',
      'sd-stop-the-procession',
      'dd-drowned-nun',
      'dd-what-the-lamps-saw',
      'sd-the-gate-is-closed',
      'sd-marked-at-the-gate',
      'yn-quiet-the-street',
      'so-judgment-of-heaven',
      'dt-twelve-dancing-heiresses',
      'ar-imperial-jade-seal',
      'dd-rite-of-the-salt-gate',
      'dd-bell-hand',
      'cf-briar-veil-banishing',
      'dt-ball-before-midnight',
      'dt-hearth-blessing',
      'gm-hunters-writ',
      'dt-banished-from-the-ball',
      'bk-bunny-vanguard',
      'gk-hestia',
      'gk-hoplite',
      'tk-wei-caiwenji',
      'gk-eos',
      'bk-holstaur-milkmaid',
      'tk-wei-pangde',
      'gk-apollo',
      'tk-shu-xingcai',
      'yn-white-lantern-vanguard',
      'tk-wei-caoren',
      'gm-silver-bullet-duelist',
      'gm-iron-gate-sentinel',
      'cf-sidhe-silver-lancer',
      'gk-iris',
      'gk-nike',
      'dd-shore-patrol',
      'yn-neon-gate-warden',
      'dd-gate-warden',
      'dt-rose-petal-knight',
      'gm-choir-of-the-dead',
      'ar-training-dummy',
      'dd-bell-ringer-abbess',
      'tk-shu-guanping',
      'ac-keep-watchwoman',
      'bk-mousekin-pantry-guard',
      'tk-shu-guansuo',
      'dd-breakwater-warden',
      'dd-watch-sergeant',
      'ac-novice-squire',
      'cf-cold-moon-archer',
      'cf-sidhe-page',
      'dd-wharf-watch',
      'gm-chapel-guard',
      'rg-einherjar-shieldbearer',
      'sd-whisker-count-scout',
      'tk-other-yuanshao',
      'ac-lance-of-dawn',
      'dd-salt-ward',
      'dd-widows-lantern',
      'dt-gilded-cage',
      'ar-siege-juggernaut',
      'sd-keeper-of-the-salt-room',
    ],
    darlingId: 'gk-athena',
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
    reserveDeck: expand([
      ['bk-wolfkin-raider', 4],
      ['bk-boarkin-rioter', 4],
      ['tk-other-huaxiong', 4],
      ['bk-bearkin-guardian', 4],
      ['tk-wei-xiahouyuan', 4],
      ['tk-shu-baosanniang', 4],
      ['bk-wolfqueen', 4],
      ['bk-rhinokin-charger', 4],
      ['in-boar-rush', 4],
      ['in-wild-surge', 4],
    ]),
    landReserve: expand([
      ['land-mountain', 5],
      ['land-forest', 5],
    ]),
    darlingsDeck: [
      'dd-wreckfire',
      'dd-marsh-grave-risen',
      'in-boar-rush',
      'in-wild-surge',
      'cf-cauldron-of-dagda',
      'sd-heart-scale-reliquary',
      'sd-fourth-weighing',
      'yn-thorncode-matriarch',
      'ac-green-knight-challenge',
      'dd-storm-surge',
      'rg-ragnarok',
      'bk-boarkin-rootbreaker',
      'sd-silt-crowned-harvester',
      'tk-wu-ganning',
      'yn-jade-kitsune-forager',
      'ac-ashwood-ranger',
      'cf-fomorian-raider',
      'dd-breakwater-brute',
      'dt-storybook-of-ashes',
      'ac-castle-under-siege',
      'rg-alpha-of-the-hunt',
      'tk-shu-guanyinping',
      'dd-storm-tide-horror',
      'cf-thornmaze-patrol',
      'dd-salt-fire-witch',
      'cf-blackthorn-duelist',
      'gm-glasshouse-monster',
      'dd-gale-rider',
      'ac-grail-hermit',
      'dt-chart-the-reef-road',
      'dd-marsh-wight',
      'dd-the-marsh-remembers',
      'dd-reach-fire-witch',
      'sd-noon-judgment',
      'in-skysweeper-gale',
      'bk-rhinokin-charger',
      'bk-dragonmaid',
      'bk-harpy-skirmisher',
      'bk-boarkin-rioter',
      'tk-wei-xiahouyuan',
      'bk-wolfkin-raider',
      'bk-bearkin-guardian',
      'tk-other-huaxiong',
      'gm-moonlit-werewolf',
      'sd-flood-fed-colossus',
      'dt-wolf-at-the-door',
      'sd-ashwake-twinblade',
      'rg-great-stag',
      'dd-tidepool-wall',
      'sd-serpent-wake-raider',
      'tk-wei-xiahoudun',
      'tk-shu-weiyan',
      'sd-deep-flood-behemoth',
      'bk-deerkin-grovekeeper',
      'dt-thorn-castle-warden',
      'tk-shu-baosanniang',
      'bk-sheepkin-dreamherd',
      'bk-turtlekin-bulwark',
      'sd-floodwall-matriarch',
      'tk-shu-sword-dancer',
      'bk-packmother',
      'tk-wu-sunce',
      'tk-wu-handang',
      'sd-sun-rope-hauler',
      'tk-other-warband-captain',
      'ac-tournament-favorite',
      'bk-nekomata-scout',
      'bk-squirrelkin-hoarder',
      'yn-redline-kitsune',
      'ar-training-dummy',
      'cf-thorn-sprite',
      'dd-wreck-runner',
      'gm-wolfbitten-hunter',
      'sd-emberwake-runner',
      'ac-bramble-chapel',
      'ac-red-tournament-ground',
      'cf-mossy-ring',
      'dt-desert-rooftop',
      'dt-wolf-path',
    ],
    darlingId: 'bk-wolfqueen',
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
    reserveDeck: expand([
      ['gk-hera', 3],
      ['bk-bunny-vanguard', 4],
      ['gk-nike', 4],
      ['gk-iris', 4],
      ['in-stand-as-one', 2],
      ['gk-thanatos', 3],
      ['gk-apollo', 3],
      ['gk-eos', 2],
      ['bk-mousekin-pantry-guard', 4],
      ['en-vow-of-peace', 4],
      ['so-muster-militia', 4],
      ['so-parade-of-heroes', 3],
    ]),
    landReserve: expand([
      ['ld-shadowed-court', 4],
      ['land-plains', 4],
      ['land-swamp', 2],
    ]),
    darlingsDeck: [
      'sd-two-for-the-ferrywoman',
      'cf-badb-cathas-warning',
      'in-stand-as-one',
      'sd-crown-bearer-of-the-last-hall',
      'ac-quest-for-the-grail',
      'so-parade-of-heroes',
      'sd-copy-kept-in-resin',
      'dd-lamp-oil-saint',
      'gm-nocturne-manor',
      'dd-salt-marsh-horror',
      'sd-fourth-weighing',
      'dd-drowned-saint',
      'yn-white-veil-collapse',
      'en-persephones-return',
      'gm-black-lace-pact',
      'dd-bell-tower-sentry',
      'dt-honor-blade-captain',
      'gm-stormglass-golem',
      'cf-crowbone-prophet',
      'dd-lamp-lit-vigil',
      'dt-sea-witch-contract',
      'in-reapers-due',
      'dd-black-water',
      'gm-midnight-autopsy',
      'yn-lantern-fixer',
      'ac-courtly-betrayal',
      'tk-other-zhangjiao',
      'dt-glass-stair-duelist',
      'sd-the-weight-owed-in-full',
      'gm-stormtower-resurrection',
      'cf-ogham-fate-stones',
      'dt-thirteenth-spindle',
      'sd-stop-the-procession',
      'ac-fallen-banner',
      'so-night-extortion',
      'dd-what-the-lamps-saw',
      'bk-bunny-vanguard',
      'gk-eos',
      'dd-drowned-bride',
      'gk-iris',
      'gk-nike',
      'bk-mousekin-pantry-guard',
      'gk-apollo',
      'gk-nyx',
      'gk-thanatos',
      'gk-hecate',
      'gm-black-veil-matron',
      'gk-hestia',
      'gk-hoplite',
      'gm-silver-bullet-duelist',
      'gm-iron-gate-sentinel',
      'cf-sidhe-silver-lancer',
      'ac-oathbroken-knight',
      'dd-shore-patrol',
      'tk-shu-xingcai',
      'yn-neon-gate-warden',
      'dd-gate-warden',
      'dt-rose-petal-knight',
      'gm-blood-opera-soloist',
      'ar-training-dummy',
      'dd-bell-ringer-abbess',
      'sd-the-heavier-offering',
      'bk-spiderkin-weaver',
      'gm-batcloak-cutthroat',
      'en-vow-of-peace',
      'yn-oni-bounty-agent',
      'ac-keep-watchwoman',
      'bk-batkin-duskwing',
      'dd-breakwater-warden',
      'dd-wharf-rat',
      'tk-other-dongbai',
      'ac-novice-squire',
      'bk-lamia-nightblade',
      'cf-cold-moon-archer',
      'sd-whisker-count-scout',
      'ac-lance-of-dawn',
      'dd-salt-ward',
      'dd-widows-lantern',
      'dt-gilded-cage',
    ],
    darlingId: 'gk-hera',
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
    reserveDeck: expand([
      ['tk-other-zhurong', 4],
      ['tk-wei-xiahoudun', 4],
      ['tk-other-huaxiong', 4],
      ['tk-wei-yuejin', 3],
      ['tk-wu-zhuran', 3],
      ['in-fire-attack', 4],
      ['in-char', 4],
      ['so-flame-lash', 4],
      ['so-lava-axe', 2],
      ['in-comet-blast', 4],
      ['so-warcry', 4],
    ]),
    landReserve: expand([
      ['land-mountain', 10],
    ]),
    darlingsDeck: [
      'in-comet-blast',
      'so-warcry',
      'in-char',
      'dd-wreckfire',
      'in-fire-attack',
      'sd-heart-scale-reliquary',
      'sd-fourth-weighing',
      'so-flame-lash',
      'dd-storm-surge',
      'rg-ragnarok',
      'tk-wu-ganning',
      'cf-fomorian-raider',
      'dd-breakwater-brute',
      'dt-storybook-of-ashes',
      'yn-oni-neon-marshal',
      'dd-salt-fire-witch',
      'dd-gale-rider',
      'gm-stormglass-golem',
      'dt-sandstorm-carpet-rider',
      'cf-ogham-fate-stones',
      'cf-brigid-ember-blessing',
      'dt-ash-maiden',
      'dd-reach-fire-witch',
      'dt-haunted-storybook',
      'rg-twice-chosen-shieldmaiden',
      'dd-breakwater-brawler',
      'ar-imperial-jade-seal',
      'gm-red-moon-rampage',
      'sd-noon-judgment',
      'sd-altar-of-the-fourth-hall',
      'dt-clock-strikes-twelve',
      'cf-dawn-torc',
      'sd-reed-bound-canopic',
      'dd-drowned-forge-fire',
      'tk-wei-xiahoudun',
      'tk-other-zhurong',
      'tk-wei-yuejin',
      'tk-wu-sunce',
      'tk-wu-zhuran',
      'tk-other-huaxiong',
      'sd-ashwake-twinblade',
      'sd-serpent-wake-raider',
      'tk-wu-sunjian',
      'ar-siege-juggernaut',
      'sd-sunfire-warcaller',
      'tk-wu-taishici',
      'bk-dragonmaid',
      'cf-redcap-blood-host',
      'dd-storm-choir',
      'tk-wu-handang',
      'sd-sun-rope-hauler',
      'tk-other-warband-captain',
      'ac-tournament-favorite',
      'dd-false-lamp-bearer',
      'dt-wolf-at-the-door',
      'yn-redline-kitsune',
      'ar-training-dummy',
      'dd-wreck-runner',
      'bk-harpy-skirmisher',
      'sd-emberwake-runner',
      'tk-other-lulingqi',
      'tk-wei-xiahouyuan',
      'tk-wu-sunshangxiang',
      'cf-laughing-pooka',
      'sd-sun-rope-charger',
      'sd-barge-deck-raider',
      'tk-wu-chengpu',
      'ar-bronze-colossus',
      'dd-wrecker',
      'dt-woodcutters-daughter',
      'dd-gale-horror',
      'dd-storm-tide-brute',
      'en-battle-fervor',
      'ac-red-tournament-ground',
      'dt-desert-rooftop',
      'sd-barge-fire-warcaller',
      'sd-twinblade-at-the-prow',
      'gm-moonlit-werewolf',
      'yn-rainflash-duelist',
    ],
    darlingId: 'gk-ares',
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
    reserveDeck: expand([
      ['tk-jin-simayi', 3],
      ['tk-jin-wangyuanji', 3],
      ['tk-jin-zhangchunhua', 3],
      ['tk-jin-jiachong', 4],
      ['bk-lamia-nightblade', 4],
      ['bk-spiderkin-weaver', 4],
      ['tk-wei-chenqun', 4],
      ['tk-jin-zhonghui', 1],
      ['in-doom-bolt', 4],
      ['in-reapers-due', 2],
      ['so-night-extortion', 4],
      ['so-dirge-of-loss', 4],
    ]),
    landReserve: expand([
      ['ld-moonlit-marsh', 4],
      ['land-island', 3],
      ['land-swamp', 3],
    ]),
    darlingsDeck: [
      'in-reapers-due',
      'so-night-extortion',
      'sd-two-for-the-ferrywoman',
      'cf-badb-cathas-warning',
      'in-doom-bolt',
      'sd-copy-kept-in-resin',
      'gm-nocturne-manor',
      'dd-salt-marsh-horror',
      'gm-moon-doll-orchestra',
      'sd-the-last-chart-of-the-duat',
      'tk-wei-caopi',
      'bk-kitsune-dreamweaver',
      'yn-azure-oni-broker',
      'sd-fourth-weighing',
      'cf-hollow-hill-gatekeeper',
      'sd-keeper-of-the-fifth-channel',
      'yn-blue-ghost-broadcaster',
      'tk-shu-yueying',
      'tk-wu-luxun',
      'en-persephones-return',
      'gm-black-lace-pact',
      'dd-drowned-bell-choir',
      'gm-stormglass-golem',
      'dt-sea-witch-contract',
      'ac-queen-regents-command',
      'dd-black-water',
      'gm-midnight-autopsy',
      'dt-briar-rose-lullaby',
      'in-dream-fracture',
      'sd-the-map-argues-back',
      'sd-the-weight-owed-in-full',
      'dt-sleeping-curse',
      'cf-mist-over-tara',
      'dt-thirteenth-spindle',
      'ac-fallen-banner',
      'dd-cold-current',
      'dd-salt-in-the-wound',
      'ar-imperial-jade-seal',
      'ac-sword-test-stone',
      'tk-wei-chenqun',
      'tk-jin-zhonghui',
      'bk-spiderkin-weaver',
      'so-dirge-of-loss',
      'dd-drowned-bride',
      'tk-jin-simashi',
      'tk-jin-jiachong',
      'bk-lamia-nightblade',
      'gm-black-veil-matron',
      'tk-wei-jiaxu',
      'yn-network-sprite',
      'tk-jin-yang-huiyu',
      'dd-drowned-scholar',
      'sd-navigator-of-the-last-channel',
      'ac-oathbroken-knight',
      'dd-thing-in-the-cistern',
      'tk-jin-xinxianying',
      'gk-hermes',
      'gm-blood-opera-soloist',
      'ar-training-dummy',
      'gm-screaming-staircase',
      'sd-chart-keeper-of-the-two-ways',
      'tk-wei-dianwei',
      'sd-the-heavier-offering',
      'gm-batcloak-cutthroat',
      'tk-jin-simazhao',
      'tk-jin-xiahouhui',
      'dd-drowned-lighthouse-keeper',
      'tk-wu-lumeng',
      'bk-batkin-duskwing',
      'bk-kitsune-illusionist',
      'gm-stitched-footman',
      'dd-wharf-rat',
      'tk-other-dongbai',
      'tk-wu-xiaoqiao',
      'ac-bitter-court-rumor',
      'dd-undertow-charm',
      'dt-sea-glass-knife',
      'dt-wicked-step',
      'in-empty-fort-stratagem',
    ],
    darlingId: 'tk-jin-simayi',
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
    reserveDeck: expand([
      ['bk-kitsune-matriarch', 2],
      ['bk-kitsune-illusionist', 4],
      ['bk-kitsune-dreamweaver', 4],
      ['bk-nekomata-scout', 4],
      ['bk-mermaid-chartsinger', 4],
      ['gk-artemis', 4],
      ['tk-wu-luxun', 4],
      ['in-read-the-ruse', 4],
      ['in-dream-fracture', 4],
      ['in-sudden-insight', 2],
      ['in-undertow', 4],
    ]),
    landReserve: expand([
      ['ld-foxglade-springs', 4],
      ['land-island', 3],
      ['land-forest', 3],
    ]),
    darlingsDeck: [
      'bk-kitsune-dreamweaver',
      'in-dream-fracture',
      'tk-wu-luxun',
      'yn-thorncode-matriarch',
      'dd-tide-priestess',
      'yn-jade-kitsune-forager',
      'in-sudden-insight',
      'gm-moon-doll-orchestra',
      'cf-cauldron-of-dagda',
      'sd-the-last-chart-of-the-duat',
      'yn-azure-oni-broker',
      'sd-heart-scale-reliquary',
      'sd-fourth-weighing',
      'cf-hollow-hill-gatekeeper',
      'ac-green-knight-challenge',
      'bk-boarkin-rootbreaker',
      'sd-silt-crowned-harvester',
      'tk-shu-yueying',
      'in-read-the-ruse',
      'ac-ashwood-ranger',
      'gm-glasshouse-monster',
      'dd-drowned-bell-choir',
      'gm-stormglass-golem',
      'sd-flood-mark-shaman',
      'ac-queen-regents-command',
      'dt-chart-the-reef-road',
      'dd-marsh-wight',
      'dt-briar-rose-lullaby',
      'sd-the-map-argues-back',
      'dt-tower-braid-escape',
      'cf-mist-over-tara',
      'dd-drowned-ledger',
      'gm-lightning-rod-spire',
      'ac-lantern-in-fog',
      'cf-glimmerdust-trick',
      'dt-dream-prick',
      'gm-fogged-window',
      'in-skysweeper-gale',
      'gk-artemis',
      'bk-rhinokin-charger',
      'bk-kitsune-illusionist',
      'bk-nekomata-scout',
      'bk-mermaid-chartsinger',
      'sd-flood-fed-colossus',
      'rg-great-stag',
      'gk-hermes',
      'yn-moonlit-data-duelist',
      'tk-wei-chenqun',
      'dd-tidepool-wall',
      'sd-deep-flood-behemoth',
      'in-undertow',
      'bk-deerkin-grovekeeper',
      'dt-thorn-castle-warden',
      'bk-sheepkin-dreamherd',
      'bk-turtlekin-bulwark',
      'sd-floodwall-matriarch',
      'yn-network-sprite',
      'ac-questing-beast-maiden',
      'cf-green-knoll-champion',
      'rg-jotun-earthshaker',
      'yn-jade-root-yokai',
      'bk-packmother',
      'tk-jin-zhonghui',
      'dd-drowned-scholar',
      'tk-jin-dengai',
      'sd-navigator-of-the-last-channel',
      'bk-bearkin-guardian',
      'bk-squirrelkin-hoarder',
      'ar-training-dummy',
      'cf-thorn-sprite',
      'gm-screaming-staircase',
      'tk-wu-daqiao',
      'dt-briar-hedge-matriarch',
      'sd-chart-keeper-of-the-two-ways',
      'yn-greenline-bruiser',
      'tk-wu-lumeng',
      'gk-selene',
      'cf-mushroom-ring-guard',
      'dd-reef-crab',
    ],
    darlingId: 'bk-kitsune-matriarch',
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
    reserveDeck: expand([
      ['tk-wei-caocao', 3],
      ['tk-wei-zhangliao', 4],
      ['tk-wei-dianwei', 4],
      ['tk-wei-xuhuang', 4],
      ['tk-wei-yujin', 4],
      ['tk-wei-wangyi', 4],
      ['tk-wei-caoren', 3],
      ['tk-wei-xunyu', 4],
      ['tk-wei-jiaxu', 3],
      ['en-banner-of-the-hegemon', 4],
      ['in-doom-bolt', 3],
    ]),
    landReserve: expand([
      ['ld-shadowed-court', 4],
      ['land-plains', 3],
      ['land-swamp', 3],
    ]),
    darlingsDeck: [
      'tk-wei-zhangliao',
      'sd-two-for-the-ferrywoman',
      'cf-badb-cathas-warning',
      'sd-crown-bearer-of-the-last-hall',
      'ac-quest-for-the-grail',
      'in-doom-bolt',
      'dd-lamp-oil-saint',
      'gm-nocturne-manor',
      'dd-salt-marsh-horror',
      'sd-fourth-weighing',
      'ac-round-table-vow',
      'dd-drowned-saint',
      'yn-white-veil-collapse',
      'dt-storybook-of-ashes',
      'en-persephones-return',
      'gm-black-lace-pact',
      'dd-bell-tower-sentry',
      'dt-honor-blade-captain',
      'gm-stormglass-golem',
      'cf-crowbone-prophet',
      'dd-lamp-lit-vigil',
      'dt-sea-witch-contract',
      'in-reapers-due',
      'dd-black-water',
      'gm-midnight-autopsy',
      'yn-lantern-fixer',
      'ac-courtly-betrayal',
      'tk-other-zhangjiao',
      'dt-glass-stair-duelist',
      'sd-the-weight-owed-in-full',
      'gm-stormtower-resurrection',
      'dt-thirteenth-spindle',
      'sd-stop-the-procession',
      'ac-fallen-banner',
      'dd-salt-in-the-wound',
      'so-night-extortion',
      'tk-wei-caoren',
      'tk-wei-jiaxu',
      'tk-wei-dianwei',
      'tk-wei-xunyu',
      'dd-drowned-bride',
      'tk-wei-wangyi',
      'tk-wei-yujin',
      'tk-wei-xuhuang',
      'tk-shu-xingcai',
      'gm-black-veil-matron',
      'en-banner-of-the-hegemon',
      'tk-wei-caiwenji',
      'gm-silver-bullet-duelist',
      'gm-iron-gate-sentinel',
      'cf-sidhe-silver-lancer',
      'tk-wei-pangde',
      'ac-oathbroken-knight',
      'dd-shore-patrol',
      'yn-neon-gate-warden',
      'dd-gate-warden',
      'tk-wei-xuchu',
      'dt-rose-petal-knight',
      'ar-training-dummy',
      'gk-hoplite',
      'dd-bell-ringer-abbess',
      'sd-the-heavier-offering',
      'yn-oni-bounty-agent',
      'gk-nyx',
      'ac-keep-watchwoman',
      'tk-other-chengong',
      'tk-shu-fazheng',
      'tk-shu-guansuo',
      'bk-bunny-vanguard',
      'dd-wharf-rat',
      'tk-other-dongbai',
      'ac-novice-squire',
      'bk-mousekin-pantry-guard',
      'sd-whisker-count-scout',
      'ac-lance-of-dawn',
      'dd-salt-ward',
      'dd-widows-lantern',
      'dt-gilded-cage',
      'gm-wolfsbane-ward',
    ],
    darlingId: 'tk-wei-caocao',
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
    /*
     * HAND-TUNED 2026-08-08 (first tuning-loop pass; diverges from the
     * scripted first cut). The cut shipped 15/40 cards at mv≤3, so a 5-card
     * opener averaged 1.9 early-castable spells against a keep rule wanting
     * 2: measured at 12 seeds/cell she mulliganed 80% of games (every other
     * avatar 0-20%), clogged 4.32 turns, ended with 6.57 dead cards, and won
     * 8%. This pass trims the top (thanatos out, jarl/norns to 2, one each
     * off wight/handmaiden) for 8 one-mana on-theme spells, taking mv≤3 to
     * 23/40 (expected 2.9 early spells per opener). Reanimation and grave
     * removal keep the Blue-Black Mill Reanimator identity intact.
     */
    /*
     * HAND-BUILT 2026-08-09 — ARCHETYPE REPAIR, not a curve tune.
     *
     * Hel is the Blue-Black Mill Reanimator, and in Warchest her engine had
     * simply stopped existing: measured graveyard-cast rate 0.00 across every
     * run, and 21-33% no matter what curve or quality pass was applied. The
     * reason is that reanimation only pays when it cheats out something you
     * could not otherwise cast, and her best target was a 4/3 Barrow Wight.
     * She was paying a strategy's full setup cost for none of its reward. The
     * generated builder made this worse, not better: its curve cap (mv5 x4,
     * mv6 x2) deletes exactly the expensive payoffs a reanimator exists to
     * abuse, so the builder is archetype-blind here and Hel is exempt.
     *
     * This build gives the engine real targets. Siege Juggernaut (7/7
     * overrun) and Bronze Colossus (6/6) are colorless artifacts, so they are
     * legal beside her U/B and worth every point of the three mana Call the
     * Einherjar pays to raise one. Self-mill is kept as her identity and is
     * now also her tutor: grinding a Juggernaut into the yard is the setup,
     * not a cost. Opponent-mill was considered and rejected - `raise` reads
     * only the controller's own graveyard (EffectInterpreter case 'raise'),
     * so milling the opponent would fuel nothing and would be a second,
     * half-built win condition competing for the same 40 slots.
     */
    reserveDeck: expand([
      ['in-undertow', 3],
      ['in-grave-chill', 2],
      ['rg-corpse-taker', 4],
      ['rg-mist-seer', 4],
      ['rg-call-the-einherjar', 4],
      ['in-doom-bolt', 4],
      ['rg-norn-seeress', 1],
      ['rg-hels-handmaiden', 4],
      ['rg-plaguebearer-draugr', 2],
      ['rg-barrow-wight', 1],
      ['rg-hel', 3],
      ['ar-siege-juggernaut', 4],
      ['ar-bronze-colossus', 2],
      ['rg-thanatos', 2],
    ]),
    landReserve: expand([
      ['ld-moonlit-marsh', 4],
      ['land-island', 3],
      ['land-swamp', 3],
    ]),
    darlingsDeck: [
      'rg-mist-seer',
      'rg-draugr-jarl',
      'rg-hels-handmaiden',
      'sd-two-for-the-ferrywoman',
      'gm-moon-doll-orchestra',
      'cf-badb-cathas-warning',
      'in-doom-bolt',
      'rg-call-the-einherjar',
      'gm-nocturne-manor',
      'yn-blue-ghost-broadcaster',
      'rg-deaths-herald',
      'yn-azure-oni-broker',
      'sd-fourth-weighing',
      'cf-hollow-hill-gatekeeper',
      'sd-keeper-of-the-fifth-channel',
      'ac-lakeblade-initiate',
      'dt-storybook-of-ashes',
      'ac-queen-regents-command',
      'en-persephones-return',
      'gm-stormglass-golem',
      'in-reapers-due',
      'gm-black-lace-pact',
      'gm-midnight-autopsy',
      'in-dream-fracture',
      'sd-the-map-argues-back',
      'dt-sleeping-curse',
      'sd-the-weight-owed-in-full',
      'cf-mist-over-tara',
      'tk-wu-luxun',
      'sd-wrong-door',
      'dt-thirteenth-spindle',
      'gm-lightning-rod-spire',
      'yn-sever-the-signal',
      'yn-night-market-price',
      'dt-apple-of-endless-sleep',
      'ac-sword-test-stone',
      'ar-imperial-jade-seal',
      'in-grave-chill',
      'sd-hollow-the-chest',
      'rg-barrow-wight',
      'ar-siege-juggernaut',
      'sd-navigator-of-the-last-channel',
      'ac-oathbroken-knight',
      'gm-batcloak-cutthroat',
      'gk-hermes',
      'ar-training-dummy',
      'tk-wei-chenqun',
      'sd-the-heavier-offering',
      'tk-wei-jiaxu',
      'rg-draugr-raider',
      'sd-chart-keeper-of-the-two-ways',
      'tk-other-zuoci',
      'yn-bloodline-tollkeeper',
      'ar-bronze-colossus',
      'rg-mist-wraith',
      'gm-porcelain-governess',
      'tk-other-dongbai',
      'tk-wu-xiaoqiao',
      'cf-black-dog-of-lane',
      'cf-bog-banshee',
      'gm-manor-thrall',
      'tk-wu-daqiao',
      'yn-network-sprite',
      'so-dirge-of-loss',
      'bk-batkin-duskwing',
      'bk-kitsune-illusionist',
      'cf-mistwing-pixie',
      'gm-bat-swarm',
      'gm-black-cat-familiar',
      'gm-blood-drop-initiate',
      'sd-channel-watch-diver',
      'in-undertow',
      'rg-rune-of-hunger',
      'rg-rune-of-insight',
      'cf-bitter-geas',
      'cf-fogbell-chime',
      'en-clouded-mind',
      'rg-corpse-taker',
      'sd-gatekeeper-judge',
    ],
    darlingId: 'rg-hel',
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
    // MEASURED 2026-09-17: owner-ruling surgery R3, hard AI, 200 seeds/cell,
    // reserve-native avatar matrix (the avatar vs the Medium-piloted starter
    // reserve builds); 79% mean, cells 70/88/53/93/93% in Muster/Communion/
    // Tides/Mandate/Harvest order, zero draws.
    // Frozen baseline on the phase C tree (a10327c): 70% mean, cells
    // 59/80/43/87/80%. Before phase C she measured 75% (67/86/45/91/86): the
    // combat model then learned twinBlades on both seats, her opponents
    // stopped blocking her double-strikers with bodies that died without
    // striking, and she fell five points with nothing in her list changed.
    // She has no rung floor (rung 10), so this pass followed the Deacon's and
    // Bastet's: keep only >3pp above baseline with no cell down >6pp; a
    // combination replaces the best single only if it beats it by >3pp.
    // 2026-09-17 owner-ruling surgery R1 REJECTED: -1 each of the six
    // converter singletons that are not bodies for her plan (Queen of the
    // Last Procession, Ragnarok, Quest for the Grail, Round Table Vow, Storm
    // Surge, Iron Gate Sentinel); +3 Valkyrie Vanguard, +3 Xu Chu (her
    // classic's cut cards). Alone: 72% (59/84/50/88/81), +2pp, inside the band.
    // 2026-09-17 owner-ruling surgery R2 REJECTED: -3 Berserker Chieftain
    // (the self-damage attacker); +3 Warband Leader. Alone: 68% (59/77/39/
    // 83/84), -2pp; Tides fell 4.
    // 2026-09-17 owner-ruling surgery R3 KEPT: -4 Ember Valkyrie (a 2/1 the
    // honest blockers eat); +2 Break the Coil, +2 Burn the Rope. She had no
    // spell at all; two and three damage at instant speed clears the blocker
    // or closes the race. Alone: 79% (70/88/53/93/93), +9pp, every cell up.
    // 2026-09-17 owner-ruling surgery R4 REJECTED as superseded: -2 Shieldwall
    // Maiden (4 -> 2), -2 Dawn Valkyrie (4 -> 2); +2 Zhao Yun, +2 Flamecaller
    // Jotun. Alone: 73% (59/80/48/90/88), +3pp at the edge of the band.
    // 2026-09-17 owner-ruling surgery 5 REJECTED: R3+R4 combined, 79%
    // (67/89/57/88/95), +0.2pp over R3 alone, inside the band, so the smaller
    // change stands. Hand-tuned from the 2026-08-21 converter first cut; the
    // classic deck, landReserve (5 Mountain/5 Plains) and Darlings surfaces
    // are unchanged; the reserve divergence is registered in HAND_TUNED_WARCHEST.
    // Measured by the main session; Codex was out of usage credits.
    reserveDeck: expand([
      ['rg-brunhild', 3],
      ['rg-valkyrie-captain', 4],
      ['rg-berserker-chieftain', 3],
      ['rg-einherjar-champion', 4],
      ['rg-berserker-duelist', 4],
      ['rg-dawn-valkyrie', 4],
      ['sd-break-the-coil', 2],
      ['sd-burn-the-rope', 2],
      ['rg-shieldwall-maiden', 4],
      ['tk-other-lubu', 1],
      ['tk-shu-guanyu', 1],
      ['sd-ra-helm-of-the-night-barge', 1],
      ['sd-queen-of-the-last-procession', 1],
      ['ac-quest-for-the-grail', 1],
      ['gm-iron-gate-sentinel', 1],
      ['ac-round-table-vow', 1],
      ['dd-storm-surge', 1],
      ['rg-ragnarok', 1],
      ['cf-sidhe-silver-lancer', 1],
    ]),
    landReserve: expand([
      ['land-mountain', 5],
      ['land-plains', 5],
    ]),
    darlingsDeck: [
      'rg-warband-leader',
      'sd-crown-bearer-of-the-last-hall',
      'ac-quest-for-the-grail',
      'rg-ragnarok',
      'dd-lamp-oil-saint',
      'dd-wreckfire',
      'rg-chooser-of-the-slain',
      'rg-twice-chosen-shieldmaiden',
      'sd-keeper-of-the-salt-room',
      'sd-heart-scale-reliquary',
      'sd-fourth-weighing',
      'ac-round-table-vow',
      'dd-storm-surge',
      'dd-drowned-saint',
      'cf-fomorian-raider',
      'dd-breakwater-brute',
      'yn-white-veil-collapse',
      'dt-storybook-of-ashes',
      'ac-castle-under-siege',
      'dd-storm-tide-horror',
      'yn-oni-neon-marshal',
      'dd-salt-fire-witch',
      'dd-gale-rider',
      'dd-bell-tower-sentry',
      'dt-honor-blade-captain',
      'gm-stormglass-golem',
      'dd-false-beacon',
      'dt-sandstorm-carpet-rider',
      'yn-lantern-fixer',
      'dt-glass-stair-duelist',
      'dd-reach-fire-witch',
      'sd-marked-at-the-gate',
      'so-judgment-of-heaven',
      'dt-twelve-dancing-heiresses',
      'sd-noon-judgment',
      'dt-ball-before-midnight',
      'rg-einherjar-champion',
      'rg-dawn-valkyrie',
      'rg-shieldwall-maiden',
      'rg-ember-valkyrie',
      'ar-siege-juggernaut',
      'rg-einherjar-shieldbearer',
      'rg-berserker-initiate',
      'rg-raiding-shieldmaiden',
      'gm-iron-gate-sentinel',
      'cf-sidhe-silver-lancer',
      'dd-storm-choir',
      'tk-wu-sunce',
      'sd-sun-rope-hauler',
      'rg-valkyrie-scout',
      'ac-tournament-favorite',
      'dd-false-lamp-bearer',
      'dd-shore-patrol',
      'dt-wolf-at-the-door',
      'dd-gate-warden',
      'sd-ashwake-twinblade',
      'yn-redline-kitsune',
      'ar-training-dummy',
      'dd-wreck-runner',
      'bk-harpy-skirmisher',
      'ac-keep-watchwoman',
      'cf-laughing-pooka',
      'tk-wu-handang',
      'rg-muspel-emberkin',
      'bk-bunny-vanguard',
      'ac-novice-squire',
      'cf-cold-moon-archer',
      'cf-redcap-skirmisher',
      'cf-sidhe-page',
      'dd-wharf-watch',
      'gk-hestia',
      'gk-hoplite',
      'bk-mousekin-pantry-guard',
      'sd-whisker-count-scout',
      'ac-lance-of-dawn',
      'dd-salt-ward',
      'dd-widows-lantern',
      'dt-gilded-cage',
      'gm-wolfsbane-ward',
    ],
    darlingId: 'rg-brunhild',
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
    reserveDeck: expand([
      ['cf-morrigan-black-wing', 3],
      ['cf-bean-sidhe-keening', 4],
      ['cf-raven-torc-envoy', 4],
      ['cf-crowbone-prophet', 3],
      ['cf-bog-lantern-witch', 3],
      ['cf-bog-banshee', 4],
      ['cf-black-dog-of-lane', 4],
      ['cf-hounds-of-annwn', 3],
      ['cf-blackthorn-duelist', 2],
      ['cf-bitter-geas', 4],
      ['cf-gold-ring-bargain', 2],
      ['cf-barrow-whisper', 4],
    ]),
    landReserve: expand([
      ['cf-blackthorn-crossing', 4],
      ['land-swamp', 3],
      ['land-forest', 3],
    ]),
    darlingsDeck: [
      'cf-bean-sidhe-keening',
      'cf-blackthorn-duelist',
      'cf-crowbone-prophet',
      'sd-two-for-the-ferrywoman',
      'cf-thornmaze-patrol',
      'cf-barrow-whisper',
      'cf-cauldron-of-dagda',
      'sd-copy-kept-in-resin',
      'gm-nocturne-manor',
      'dd-salt-marsh-horror',
      'cf-moundlight-midwife',
      'cf-otter-familiar',
      'dd-drowned-druid',
      'sd-fourth-weighing',
      'yn-thorncode-matriarch',
      'ac-green-knight-challenge',
      'sd-silt-crowned-harvester',
      'ac-ashwood-ranger',
      'en-persephones-return',
      'gm-black-lace-pact',
      'gm-glasshouse-monster',
      'gm-stormglass-golem',
      'sd-flood-mark-shaman',
      'dt-sea-witch-contract',
      'in-reapers-due',
      'dd-black-water',
      'gm-midnight-autopsy',
      'dt-chart-the-reef-road',
      'sd-the-weight-owed-in-full',
      'dt-sleeping-curse',
      'dt-thirteenth-spindle',
      'ac-fallen-banner',
      'so-night-extortion',
      'cf-night-market-bargain',
      'dt-apple-of-endless-sleep',
      'yn-sever-the-signal',
      'cf-green-knoll-champion',
      'cf-bog-banshee',
      'cf-thorn-sprite',
      'dd-drowned-bride',
      'cf-mushroom-ring-guard',
      'dd-tidepool-wall',
      'cf-black-dog-of-lane',
      'sd-deep-flood-behemoth',
      'gm-black-veil-matron',
      'dt-thorn-castle-warden',
      'dd-jar-witch',
      'cf-heatherblade-scout',
      'sd-floodwall-matriarch',
      'dt-sugar-cottage-witch',
      'rg-jotun-earthshaker',
      'yn-jade-root-yokai',
      'cf-hazelwand-mystic',
      'sd-silt-field-champion',
      'ac-oathbroken-knight',
      'cf-bitter-geas',
      'ar-training-dummy',
      'dt-briar-hedge-matriarch',
      'gk-artemis',
      'yn-greenline-bruiser',
      'dd-reef-crab',
      'dd-wharf-rat',
      'tk-other-dongbai',
      'ac-court-archer',
      'bk-sheepkin-dreamherd',
      'gm-grave-gardener',
      'gm-manor-thrall',
      'cf-ash-and-mistletoe',
      'so-dirge-of-loss',
      'bk-batkin-duskwing',
      'gm-bat-swarm',
      'gm-black-cat-familiar',
      'gm-blood-drop-initiate',
      'bk-nekomata-scout',
      'ac-bitter-court-rumor',
      'dt-wicked-step',
      'yn-dead-channel-ransom',
      'cf-mossy-ring',
      'cf-raven-stone',
    ],
    darlingId: 'cf-morrigan-black-wing',
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
    reserveDeck: expand([
      ['cf-titania-silver-court', 2],
      ['cf-selkie-tide-queen', 4],
      ['cf-silver-branch-oracle', 3],
      ['cf-hollow-hill-gatekeeper', 3],
      ['cf-green-knoll-champion', 3],
      ['cf-fae-ring-initiate', 4],
      ['cf-mistwing-pixie', 4],
      ['cf-selkie-runner', 4],
      ['cf-willow-wisp-guide', 1],
      ['cf-fae-court-tokenmaker', 4],
      ['cf-dance-under-mound', 4],
      ['cf-ash-and-mistletoe', 4],
    ]),
    landReserve: expand([
      ['land-island', 5],
      ['land-forest', 5],
    ]),
    darlingsDeck: [
      'cf-hollow-hill-gatekeeper',
      'cf-silver-branch-oracle',
      'cf-thornmaze-patrol',
      'cf-dance-under-mound',
      'cf-hounds-of-annwn',
      'cf-blackthorn-duelist',
      'cf-willow-wisp-guide',
      'cf-cauldron-of-dagda',
      'yn-blue-ghost-broadcaster',
      'cf-fae-court-tokenmaker',
      'ac-ashwood-ranger',
      'dd-marsh-grave-risen',
      'dd-drowned-bell-choir',
      'cf-moundlight-midwife',
      'dd-marsh-wight',
      'rg-memory-thief',
      'ac-green-knight-challenge',
      'sd-silt-crowned-harvester',
      'cf-mist-over-tara',
      'gm-glasshouse-monster',
      'gm-stormglass-golem',
      'sd-flood-mark-shaman',
      'sd-harvest-line-shaman',
      'ac-queen-regents-command',
      'dt-chart-the-reef-road',
      'dt-briar-rose-lullaby',
      'in-dream-fracture',
      'sd-the-map-argues-back',
      'cf-glimmerdust-trick',
      'dt-tower-braid-escape',
      'dd-drowned-ledger',
      'dd-cold-current',
      'gm-lightning-rod-spire',
      'bk-boarkin-rootbreaker',
      'ac-lantern-in-fog',
      'dt-dream-prick',
      'gm-fogged-window',
      'in-skysweeper-gale',
      'cf-green-knoll-champion',
      'cf-thorn-sprite',
      'yn-network-sprite',
      'cf-mistwing-pixie',
      'sd-flood-fed-colossus',
      'cf-mushroom-ring-guard',
      'dd-the-reef-that-walks',
      'dd-tidepool-wall',
      'sd-deep-flood-behemoth',
      'dt-thorn-castle-warden',
      'cf-ash-and-mistletoe',
      'cf-heatherblade-scout',
      'dd-drowned-lighthouse-keeper',
      'sd-floodwall-matriarch',
      'ac-questing-beast-maiden',
      'rg-jotun-earthshaker',
      'yn-canopy-spirit',
      'yn-jade-root-yokai',
      'cf-hazelwand-mystic',
      'dd-drowned-scholar',
      'sd-navigator-of-the-last-channel',
      'ac-root-chapel-warden',
      'gk-hermes',
      'ar-training-dummy',
      'tk-wei-chenqun',
      'gm-screaming-staircase',
      'dt-briar-hedge-matriarch',
      'gk-artemis',
      'sd-chart-keeper-of-the-two-ways',
      'yn-greenline-bruiser',
      'dd-drowned-choir-singer',
      'dt-briar-sentinel',
      'sd-granary-sentinel',
      'dd-reef-crab',
      'gm-stitched-footman',
      'rg-mist-wraith',
      'tk-wu-xiaoqiao',
      'ac-court-archer',
      'bk-sheepkin-dreamherd',
      'gm-grave-gardener',
      'bk-nekomata-scout',
    ],
    darlingId: 'cf-titania-silver-court',
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
    /*
     * HAND-TUNED 2026-08-08 (tuning-loop pass 2). The first cut measured 32%
     * with no mulligan problem (1.7%), so this is a shape fault rather than
     * Hel's keep-rule fault: 33 of 40 cards sat at mv≤3 but only 2 below
     * mv3, a flat pile of threes topped by four 6-drops. Rung 7 Yohime wins
     * 88% on a textbook 8/8/16/8 curve, so the fix gives Morgan real turn-one
     * and turn-two plays: Thorn Crown to 2 (still her signature), Reaper's
     * Due to 1, one each off the knight and blackguard, for a full Undertow
     * playset plus court and raven cheapies in her Arthurian colors.
     */
    /*
     * HAND-TUNED, RETAINED 2026-08-09. The quality-led builder was re-measured
     * against this list and lost, 46% to 52%, so the hand build stays. (Hel
     * went the other way: the builder beat her hand-tune 33% to 21%, so hers
     * was dropped.) Original pass 2 note: she measured 32% with no mulligan
     * problem, a shape fault of 33 of 40 cards at mv<=3 but only 2 below mv3,
     * so Thorn Crown went to 2 and Reaper's Due to 1 to pay for real turn-one
     * and turn-two plays.
     */
    reserveDeck: expand([
      ['ac-morgan-thorn-crown', 2],
      ['ac-black-chapel-curse', 4],
      ['ac-raven-of-camlann', 4],
      ['ac-velvet-court-spy', 4],
      ['ac-merlin-crow-clock', 3],
      ['ac-lakeblade-initiate', 4],
      ['ac-oathbroken-knight', 3],
      ['ac-castle-blackguard', 3],
      ['ac-lantern-in-fog', 2],
      ['cf-omen-raven', 2],
      ['in-undertow', 4],
      ['in-doom-bolt', 4],
      ['in-reapers-due', 1],
    ]),
    landReserve: expand([
      ['ld-moonlit-marsh', 4],
      ['land-island', 3],
      ['land-swamp', 3],
    ]),
    darlingsDeck: [
      'ac-lakeblade-initiate',
      'ac-merlin-crow-clock',
      'ac-black-chapel-curse',
      'in-reapers-due',
      'ac-velvet-court-spy',
      'sd-two-for-the-ferrywoman',
      'gm-moon-doll-orchestra',
      'in-doom-bolt',
      'ac-lady-of-lilies',
      'sd-copy-kept-in-resin',
      'gm-nocturne-manor',
      'yn-blue-ghost-broadcaster',
      'yn-azure-oni-broker',
      'ac-queen-regents-command',
      'sd-fourth-weighing',
      'cf-hollow-hill-gatekeeper',
      'en-persephones-return',
      'rg-draugr-jarl',
      'gm-stormglass-golem',
      'gm-black-lace-pact',
      'gm-midnight-autopsy',
      'dt-sea-witch-contract',
      'in-dream-fracture',
      'sd-the-map-argues-back',
      'dt-sleeping-curse',
      'sd-the-weight-owed-in-full',
      'cf-mist-over-tara',
      'tk-shu-yueying',
      'tk-wu-luxun',
      'ac-lantern-in-fog',
      'sd-wrong-door',
      'ac-sword-test-stone',
      'ac-fallen-banner',
      'dt-thirteenth-spindle',
      'gm-lightning-rod-spire',
      'yn-night-market-price',
      'ar-imperial-jade-seal',
      'in-grave-chill',
      'sd-hollow-the-chest',
      'ac-oathbroken-knight',
      'ac-castle-blackguard',
      'gm-black-veil-matron',
      'in-undertow',
      'ar-siege-juggernaut',
      'tk-other-zuoci',
      'sd-navigator-of-the-last-channel',
      'gm-batcloak-cutthroat',
      'gk-hermes',
      'gm-blood-opera-soloist',
      'gm-widow-of-the-west-wing',
      'yn-moonlit-data-duelist',
      'ar-training-dummy',
      'tk-wei-chenqun',
      'sd-the-heavier-offering',
      'yn-oni-bounty-agent',
      'tk-wei-jiaxu',
      'gm-blood-drop-initiate',
      'ar-bronze-colossus',
      'tk-other-dongbai',
      'tk-wu-xiaoqiao',
      'cf-black-dog-of-lane',
      'cf-bog-banshee',
      'gm-manor-thrall',
      'tk-wu-daqiao',
      'yn-network-sprite',
      'so-dirge-of-loss',
      'ac-bitter-court-rumor',
      'bk-batkin-duskwing',
      'bk-kitsune-illusionist',
      'cf-mistwing-pixie',
      'gm-bat-swarm',
      'gm-black-cat-familiar',
      'rg-mist-wraith',
      'cf-bitter-geas',
      'cf-fogbell-chime',
      'en-clouded-mind',
      'rg-rune-of-hunger',
      'rg-rune-of-insight',
      'ac-raven-of-camlann',
    ],
    darlingId: 'ac-morgan-thorn-crown',
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
    reserveDeck: expand([
      ['ac-artoria-once-future', 4],
      ['ac-galahad-silver-oath', 4],
      ['ac-lakeblade-initiate', 4],
      ['ac-camelot-banneret', 2],
      ['ac-pennant-carrier', 4],
      ['ac-excalibur-from-lake', 4],
      ['ac-lion-standard', 4],
      ['ac-quest-for-the-grail', 4],
      ['in-undertow', 4],
      ['in-shieldwall', 4],
      ['sd-queen-of-the-last-procession', 1],
      ['gk-aphrodite', 1],
      // 2026-09-18 HAND-TUNED (registered in tests/data/avatarReserveDecks.test.ts).
      // The land-economy conversion made Lowland Fort a legal {2}{W} artifact, so
      // the converter now retains it as a playset over two Quests and these two
      // singletons. Measured at 200 seeds across the 14 player decks: this list
      // 68%, the converter's list 60%, lower in every column. This list stays.
    ]),
    landReserve: expand([
      ['ac-avalon-shore', 4],
      ['land-plains', 3],
      ['land-island', 3],
    ]),
    darlingsDeck: [
      'ac-quest-for-the-grail',
      'ac-camelot-banneret',
      'ac-lakeblade-initiate',
      'sd-crown-bearer-of-the-last-hall',
      'ac-round-table-vow',
      'dd-lamp-oil-saint',
      'ac-riverford-guard',
      'ac-merlin-crow-clock',
      'in-shieldwall',
      'gm-moon-doll-orchestra',
      'sd-the-last-chart-of-the-duat',
      'ac-chapel-questant',
      'sd-keeper-of-the-salt-room',
      'yn-azure-oni-broker',
      'sd-heart-scale-reliquary',
      'sd-fourth-weighing',
      'cf-hollow-hill-gatekeeper',
      'ac-queen-regents-command',
      'dd-drowned-saint',
      'yn-white-veil-collapse',
      'dd-drowned-bell-choir',
      'dt-honor-blade-captain',
      'gm-stormglass-golem',
      'dd-lamp-lit-vigil',
      'dt-briar-rose-lullaby',
      'in-dream-fracture',
      'sd-the-map-argues-back',
      'ac-lantern-in-fog',
      'dt-tower-braid-escape',
      'cf-mist-over-tara',
      'dd-drowned-ledger',
      'sd-stop-the-procession',
      'tk-wu-luxun',
      'dd-cold-current',
      'dd-watch-and-tide',
      'dd-what-the-lamps-saw',
      'gm-lightning-rod-spire',
      'sd-the-book-opens-twice',
      'so-judgment-of-heaven',
      'cf-sidhe-silver-lancer',
      'ac-paired-blade-errant',
      'ac-excalibur-from-lake',
      'dt-rose-petal-knight',
      'ac-pennant-carrier',
      'in-undertow',
      'ar-siege-juggernaut',
      'ac-lion-standard',
      'gm-iron-gate-sentinel',
      'yn-network-sprite',
      'dd-drowned-scholar',
      'sd-navigator-of-the-last-channel',
      'dt-glass-mountain-knight',
      'ac-keep-watchwoman',
      'dd-shore-patrol',
      'tk-shu-xingcai',
      'yn-neon-gate-warden',
      'dd-gate-warden',
      'dd-thing-in-the-cistern',
      'gk-hermes',
      'ar-training-dummy',
      'tk-wei-chenqun',
      'gm-screaming-staircase',
      'dd-bell-ringer-abbess',
      'ac-novice-squire',
      'dd-drowned-lighthouse-keeper',
      'gm-stitched-footman',
      'dd-breakwater-warden',
      'dd-watch-sergeant',
      'bk-bunny-vanguard',
      'tk-wu-xiaoqiao',
      'cf-cold-moon-archer',
      'cf-sidhe-page',
      'dd-wharf-watch',
      'gk-hestia',
      'gk-hoplite',
      'gm-chapel-guard',
      'rg-einherjar-shieldbearer',
      'ac-lance-of-dawn',
      'bk-mousekin-pantry-guard',
    ],
    darlingId: 'ac-artoria-once-future',
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
    reserveDeck: expand([
      ['gm-carmilla-crimson-host', 4],
      ['gm-elizabeth-blood-mirror', 4],
      ['gm-ravenloft-heiress', 4],
      ['gm-black-veil-matron', 4],
      ['gm-blood-opera-soloist', 2],
      ['gm-batcloak-cutthroat', 4],
      ['gm-manor-thrall', 4],
      ['gm-midnight-bite', 4],
      ['tk-other-lubu', 1],
      ['sd-ammit-under-the-scale', 1],
      ['sd-two-for-the-ferrywoman', 1],
      ['cf-badb-cathas-warning', 1],
      ['cf-bean-sidhe-keening', 1],
      ['gm-madame-macabre', 1],
      ['gm-dracula-ball-invite', 1],
      ['dd-storm-surge', 1],
      ['dd-tithe-to-the-deep', 1],
      ['rg-ragnarok', 1],
    ]),
    landReserve: expand([
      ['ld-burning-luoyang', 4],
      ['land-swamp', 3],
      ['land-mountain', 3],
    ]),
    darlingsDeck: [
      'gm-ravenloft-heiress',
      'sd-two-for-the-ferrywoman',
      'gm-nocturne-manor',
      'cf-badb-cathas-warning',
      'gm-midnight-bite',
      'ac-fall-of-camelot',
      'dd-wreckfire',
      'dd-salt-marsh-horror',
      'gm-black-lace-pact',
      'sd-fourth-weighing',
      'gm-stormglass-golem',
      'dd-storm-surge',
      'rg-ragnarok',
      'gm-midnight-autopsy',
      'cf-fomorian-raider',
      'dd-breakwater-brute',
      'gm-stormtower-resurrection',
      'dt-storybook-of-ashes',
      'ac-castle-under-siege',
      'dd-what-the-nets-remember',
      'dd-storm-tide-horror',
      'dd-salt-fire-witch',
      'en-persephones-return',
      'dd-gale-rider',
      'rg-warband-leader',
      'cf-crowbone-prophet',
      'dt-sea-witch-contract',
      'dt-sandstorm-carpet-rider',
      'dd-black-water',
      'ac-courtly-betrayal',
      'tk-other-zhangjiao',
      'cf-ogham-fate-stones',
      'gm-red-moon-rampage',
      'dd-salt-in-the-wound',
      'rg-twice-chosen-shieldmaiden',
      'so-warcry',
      'gm-black-veil-matron',
      'gm-moonlit-werewolf',
      'gm-blood-opera-soloist',
      'gm-batcloak-cutthroat',
      'gm-manor-thrall',
      'dd-drowned-bride',
      'dt-wolf-at-the-door',
      'ar-siege-juggernaut',
      'gm-widow-of-the-west-wing',
      'gm-wolfbitten-hunter',
      'bk-dragonmaid',
      'dd-storm-choir',
      'tk-wu-sunce',
      'sd-sun-rope-hauler',
      'gm-blood-drop-initiate',
      'ac-oathbroken-knight',
      'ac-tournament-favorite',
      'dd-false-lamp-bearer',
      'sd-ashwake-twinblade',
      'yn-redline-kitsune',
      'ar-training-dummy',
      'dd-wreck-runner',
      'bk-harpy-skirmisher',
      'sd-serpent-wake-raider',
      'tk-wei-xiahoudun',
      'tk-wu-sunjian',
      'tk-wei-jiaxu',
      'yn-bloodline-tollkeeper',
      'bk-wolfkin-raider',
      'cf-laughing-pooka',
      'gm-stitched-hound',
      'tk-wu-handang',
      'tk-other-warband-captain',
      'gm-bat-swarm',
      'gm-black-cat-familiar',
      'dd-wharf-rat',
      'tk-other-dongbai',
      'cf-redcap-skirmisher',
      'sd-emberwake-runner',
      'ac-bitter-court-rumor',
      'dt-wicked-step',
      'yn-dead-channel-ransom',
      'ac-court-of-whispers',
    ],
    darlingId: 'gm-carmilla-crimson-host',
  },

  // ---------------------------------------------------------------------
  // Rung 16 — The Bride: U/B empowered stitchwork control. (Hard · Gothic Monsters summit)
  {
    id: 'the-bride',
    name: 'The Storm-Crowned Bride',
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
    // HAND-TUNED 2026-08-23 (rung-16 tuning pass): 54% -> 69%, measured at
    // 200 seeds/cell on the reserve-native avatar matrix. She had fallen BELOW
    // rung 14 on the reserve field - invisible until the avatar matrix stopped
    // pricing classic - and no deck of hers had changed; she lost that ground
    // to the format itself on 2026-08-10.
    //
    // Her converter build failed differently from Anubis's, which is why both
    // are worth keeping on record:
    //   1. THE CURVE CAP WAS BINDING, and it deleted her win condition. Her
    //      classic list runs gm-bride-storm-crowned x4; she is mv6, CURVE_CAP
    //      allows {6:2}, so the reserve build shipped TWO. Restored to 4.
    //   2. A REANIMATOR WITH NOTHING TO REANIMATE. She runs 4x
    //      gm-stormtower-resurrection (raise from your own graveyard) over a
    //      deck whose largest body was that same 2-of legend: five mana to
    //      raise a 3/2. This is the exact archetype-blindness plan-1.6.md
    //      says needs Hel's exemption. Trimmed to 2 and given a real target
    //      (sd-khenut, 6/6 dreaded).
    //   3. NOTHING TO DO ON TURN 2. Her curve was mv1:5 mv3:19 mv4:10 - a
    //      19-card clump at mv3 and a hole at mv2 - against a field whose
    //      aggro column is 28 two-drops. tk-wu-daqiao (1/3 skyborne) fills it
    //      and blocks the 21 skyborne the columns field.
    //   4. SIX SINGLETON SLOTS consolidated into playsets.
    // Cut for cause: gm-stitchwork-guardian x4 and the other bulwark bodies.
    // bulwark CANNOT ATTACK, and seven such cards left her unable to close.
    reserveDeck: expand([
      ['gm-bride-storm-crowned', 4],
      ['so-divination', 2],
      ['tk-wu-daqiao', 4],
      ['gm-stormglass-golem', 4],
      ['gm-ravenloft-heiress', 4],
      ['gm-batcloak-cutthroat', 4],
      ['in-doom-bolt', 4],
      ['in-undertow', 4],
      ['gm-stormtower-resurrection', 2],
      ['gm-black-veil-matron', 4],
      ['sd-khenut-who-pays-before-the-asking', 4],
    ]),
    landReserve: expand([
      ['ld-moonlit-marsh', 4],
      ['land-island', 3],
      ['land-swamp', 3],
    ]),
    darlingsDeck: [
      'gm-moon-doll-orchestra',
      'gm-ravenloft-heiress',
      'gm-stitchwork-guardian',
      'gm-stormglass-golem',
      'gm-stormtower-resurrection',
      'sd-two-for-the-ferrywoman',
      'gm-nocturne-manor',
      'sd-fourth-weighing',
      'cf-badb-cathas-warning',
      'in-doom-bolt',
      'yn-blue-ghost-broadcaster',
      'yn-azure-oni-broker',
      'cf-hollow-hill-gatekeeper',
      'gm-thunder-lab-assistant',
      'gm-black-lace-pact',
      'gm-midnight-autopsy',
      'sd-keeper-of-the-fifth-channel',
      'rg-mist-seer',
      'ac-queen-regents-command',
      'en-persephones-return',
      'rg-draugr-jarl',
      'in-reapers-due',
      'gm-lightning-rod-spire',
      'gm-cathedral-of-bats',
      'in-dream-fracture',
      'sd-the-map-argues-back',
      'dt-sleeping-curse',
      'sd-the-weight-owed-in-full',
      'cf-mist-over-tara',
      'tk-wu-luxun',
      'gm-blood-candle',
      'gm-fogged-window',
      'gm-tattered-invitation',
      'sd-wrong-door',
      'yn-night-market-price',
      'ac-sword-test-stone',
      'ar-imperial-jade-seal',
      'in-grave-chill',
      'sd-hollow-the-chest',
      'gm-batcloak-cutthroat',
      'gm-black-veil-matron',
      'ar-siege-juggernaut',
      'gm-blood-opera-soloist',
      'ar-training-dummy',
      'in-undertow',
      'gm-widow-of-the-west-wing',
      'gm-porcelain-governess',
      'gm-manor-thrall',
      'gm-stitched-footman',
      'sd-navigator-of-the-last-channel',
      'ar-bronze-colossus',
      'gm-blood-drop-initiate',
      'gm-screaming-staircase',
      'ac-oathbroken-knight',
      'gk-hermes',
      'yn-moonlit-data-duelist',
      'tk-wei-chenqun',
      'gm-haunted-doll',
      'tk-wei-jiaxu',
      'sd-barge-oar-fitting',
      'sd-chart-keeper-of-the-two-ways',
      'ar-terracotta-soldier',
      'gm-bat-swarm',
      'gm-black-cat-familiar',
      'tk-other-dongbai',
      'tk-wu-xiaoqiao',
      'cf-black-dog-of-lane',
      'cf-bog-banshee',
      'tk-wu-daqiao',
      'yn-network-sprite',
      'dt-paper-ballerina',
      'gm-silvered-rapier',
      'cf-bitter-geas',
      'cf-fogbell-chime',
      'en-clouded-mind',
      'rg-rune-of-hunger',
      'rg-rune-of-insight',
      'gm-madame-macabre',
      'sd-gatekeeper-judge',
    ],
    darlingId: 'gm-bride-storm-crowned',
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
      ['dt-laced-too-tight', 4],
      ['gm-blood-opera-soloist', 4],
      ['in-doom-bolt', 4],
      ['in-reapers-due', 3],
      ['dt-sleeping-curse', 1],
      ['dt-apple-of-endless-sleep', 3],
      ['dt-once-more-with-magic', 1],
    ]),
    // HAND-TUNED 2026-08-29 (measured boss-tuning pass; R17): baseline was
    // 51% at 200 seeds/cell, cells 35/56/25/92/48% in
    // Muster/Communion/Tides/Mandate/Harvest order. Attempt 1 REJECTED:
    // replacing the four-copy nerfed creature package (gm-ravenloft-heiress
    // in deck, dt-handmaid-who-woke-twice in reserveDeck) with
    // cf-sidhe-silver-lancer in both synchronized lists measured exactly
    // 35/56/25/92/48%, avg 51%, so the draft was reverted.
    // Attempt 2 KEPT as the next base: gm-blood-opera-soloist replaced the
    // same four-copy nerfed creature package in both lists. It measured
    // 38/57/25/90/49%, avg 51%, at 200 seeds/cell. The small gain was real in
    // the displayed cells but remains well below the 70% target.
    //
    // Attempt 3 KEPT as the next base: four dt-laced-too-tight charms replaced
    // low-impact creature slots in both synchronized lists. It measured
    // 46/60/30/88/64%, avg 57%, at 200 seeds/cell. This is a large removal
    // gain, but the rung still needs a further measured lift.
    // Attempt 4 REJECTED: replacing the remaining four-copy
    // dt-glass-coffin-sleeper body with tk-shu-zhaoyun in both synchronized
    // lists measured 40/53/33/84/50%, avg 52%, with one draw at 200
    // seeds/cell. Reverted.
    // Attempt 5 REJECTED: replacing the same sleeper slot with
    // gm-black-veil-matron in both synchronized lists measured
    // 40/50/21/81/55%, avg 49%, at 200 seeds/cell. Reverted.
    // Attempt 6 REJECTED: replacing four dt-once-more-with-magic reserve
    // slots with sb-orbital-cleansing measured 32/41/34/90/59%, avg 51%, at
    // 200 seeds/cell. The one classic singleton remained authored; reverted.
    // Attempt 7 REJECTED: replacing that same four-copy reserve slot with
    // gm-choir-of-the-dead measured 32/48/28/89/54%, avg 50%, at 200
    // seeds/cell. Reverted.
    // Attempt 8 KEPT as the next base: replacing four dt-sugar-cottage-witch
    // slots with gm-chapel-exorcist in reserveDeck (already present in deck)
    // measured 61/68/35/91/71%, avg 65%, at 200 seeds/cell. Sugar remains a
    // legal, castable black creature; this is a curve/impact result, not a
    // castability correction.
    // Attempt 9 REJECTED: replacing four dt-once-more-with-magic reserve slots
    // with sd-the-weight-owed-in-full measured 37/47/33/89/60%, avg 53%, at
    // 200 seeds/cell. The matrix prices reserveDeck; the matching classic
    // slot was not retained after the result, and the draft was reverted.
    // Attempt 10 KEPT as the next base: replacing four dt-once-more-with-magic
    // reserve slots with cf-badb-cathas-warning measured 64/67/41/95/81%,
    // avg 69%, with no draws at 200 seeds/cell. This clears the baseline
    // materially but remains one displayed point below the 70% target.
    // Attempt 11 REJECTED: replacing four dt-glass-coffin-sleeper slots with
    // cf-sidhe-silver-lancer in both synchronized lists measured
    // 63/69/41/94/80%, avg 69%, at 200 seeds/cell. Reverted.
    // Attempt 12 REJECTED: replacing the four-copy cf-sidhe-silver-lancer
    // test slot with yn-night-market-price measured 60/66/36/71/70%, avg
    // 60%, at 200 seeds/cell. Reverted.
    // Attempt 13 KEPT: replacing the remaining four-copy
    // dt-glass-coffin-sleeper slot with gm-black-cat-familiar measured
    // 77/80/56/98/92%, avg 80%, with no draws at 200 seeds/cell. R17 clears
    // the 70% target.
    //
    // The live card audit also falsified the supplied Sugar-Cottage premise:
    // dt-sugar-cottage-witch is a black {2}{B}{B} 3/4 creature, not a green
    // {5}{G} spell, and the three Swamps plus four Shadowed Courts can cast
    // it. It is not a dead card in this reserve. The converter still has a
    // gap worth fixing separately: its target-supply gate rejects dead narrow
    // targets but performs no mana-castability audit, so color/pip legality
    // is not proved by convertAvatarWarchest.
    // FINAL 14-24 MATRIX 2026-08-29 (200 seeds/cell; cells in
    // Muster/Communion/Tides/Mandate/Harvest order; +draws shown):
    // R14 32/81/54/77/66 avg 62; R15 72/84/56/93/94 avg 79;
    // R16 60/73/49/86/91 avg 72; R17 77/80/56/98/92 avg 80;
    // R18 91/83/50/93/97 avg 83; R19 70/75/48/72/73 avg 67;
    // R20 81/70/81/94/96 avg 84; R21 53/79/60/63(199+1d)/51 avg 61;
    // R22 56/85/57/90/88 avg 75; R23 50/82/59/71/77 avg 68;
    // R24 64/87/59/82/94 avg 77. FLAGS none.
    reserveDeck: expand([
      ['dt-glass-coffin-queen', 2],
      ['dt-poison-mirror-regent', 4],
      ['in-doom-bolt', 4],
      ['dt-apple-of-endless-sleep', 4],
      ['cf-badb-cathas-warning', 4],
      ['gm-blood-opera-soloist', 4],
      ['dt-laced-too-tight', 4],
      ['gm-black-cat-familiar', 4],
      ['gm-chapel-exorcist', 4],
      ['dt-bluebeards-last-bride', 1],
      ['dt-goose-girl-of-the-wind-meadow', 1],
      ['dt-poisoned-comb', 4],
    ]),
    landReserve: expand([
      ['ld-shadowed-court', 4],
      ['land-plains', 3],
      ['land-swamp', 3],
    ]),
    darlingsDeck: [
      'gm-ravenloft-heiress',
      'gm-chapel-exorcist',
      'in-reapers-due',
      'dt-sleeping-curse',
      'sd-two-for-the-ferrywoman',
      'gm-silver-bullet-duelist',
      'dt-apple-of-endless-sleep',
      'sd-crown-bearer-of-the-last-hall',
      'ac-quest-for-the-grail',
      'in-doom-bolt',
      'gm-nocturne-manor',
      'dt-storybook-of-ashes',
      'sd-white-gate-adjudicator',
      'sd-fourth-weighing',
      'dt-once-more-with-magic',
      'dt-honor-blade-captain',
      'dt-glass-stair-duelist',
      'dt-sea-witch-contract',
      'yn-white-veil-collapse',
      'dt-eel-twin-of-the-sea-witch',
      'dt-sunrise-over-the-ballroom',
      'dt-haunted-storybook',
      'en-persephones-return',
      'rg-draugr-jarl',
      'gm-stormglass-golem',
      'cf-crowbone-prophet',
      'dt-clockwork-coachwoman',
      'dt-thirteenth-spindle',
      'gm-black-lace-pact',
      'sd-the-weight-owed-in-full',
      'sd-stop-the-procession',
      'dt-ink-contract-clerk',
      'dt-spindle-prick',
      'in-stand-as-one',
      'ac-squire-to-champion',
      'ac-sword-test-stone',
      'gm-batcloak-cutthroat',
      'gm-black-veil-matron',
      'gm-black-cat-familiar',
      'gm-blood-opera-soloist',
      'ar-siege-juggernaut',
      'dt-rose-petal-knight',
      'yn-oni-bounty-agent',
      'cf-sidhe-silver-lancer',
      'yn-white-lantern-vanguard',
      'dt-sugar-cottage-witch',
      'ac-oathbroken-knight',
      'tk-shu-xingcai',
      'dt-glass-mountain-knight',
      'gm-choir-of-the-dead',
      'gm-widow-of-the-west-wing',
      'rg-valkyrie-vanguard',
      'ar-training-dummy',
      'gm-manor-thrall',
      'sd-the-heavier-offering',
      'tk-wei-jiaxu',
      'gk-nyx',
      'gm-iron-gate-sentinel',
      'cf-moorland-guide',
      'gm-blood-drop-initiate',
      'dt-glass-mouse',
      'dt-handmaid-who-woke-twice',
      'yn-neon-gate-warden',
      'bk-bunny-vanguard',
      'tk-other-dongbai',
      'ac-novice-squire',
      'cf-black-dog-of-lane',
      'cf-bog-banshee',
      'cf-cold-moon-archer',
      'cf-sidhe-page',
      'bk-mousekin-pantry-guard',
      'sd-ninth-step-duelist',
      'sd-whisker-count-scout',
      'cf-bitter-geas',
      'rg-rune-of-hunger',
      'gm-madame-macabre',
      'cf-badb-cathas-warning',
      'sd-gatekeeper-judge',
      'sd-copy-kept-in-resin',
    ],
    darlingId: 'dt-glass-coffin-queen',
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
      ['dt-sea-glass-knife', 4],
      ['gm-black-veil-matron', 4],
      ['gm-stormglass-golem', 4],
      ['in-undertow', 1],
      ['in-grave-chill', 1],
      ['in-doom-bolt', 4],
      ['dt-undersea-bargain', 1],
      ['dt-mirror-apple-curse', 1],
    ]),
    // HAND-TUNED 2026-08-30 (measured boss-tuning pass; R18): post-Rage
    // baseline was 79% at 200 seeds/cell, cells 74/84/50/93/97% in
    // Muster/Communion/Tides/Mandate/Harvest order. The Muster collapse was
    // the compelled 4x Lu Bu starter attack pattern; Tides was the standing
    // 50% weakness.
    // Attempt 1 KEPT: replaced four gm-ravenloft-heiress slots with four
    // dt-sea-glass-knife slots in both synchronized deck and reserveDeck
    // lists. The one-blue, zero-generic recall measured 86/90/68/95/99%,
    // avg 88%, with no draws at 200 seeds/cell. Muster rose 74% -> 86%, Tides
    // rose 50% -> 68%, and no cell regressed. This clears the 86% target and
    // preserves the 0.795 floor without moving it.
    // Attempt 2 REJECTED: replacing four gm-batcloak-cutthroat slots with
    // four tk-jin-simashi first-strike-class blockers in both synchronized
    // lists measured 82/89/69/95/97%, avg 86%, with no draws at 200
    // seeds/cell. Muster fell 86% -> 82% and the average fell 88% -> 86%,
    // so the draft was reverted.
    // Attempt 3 REJECTED for legality: the first Doom Bolt deepening draft
    // removed the four-copy reserve Fishbone package while also changing
    // reserve Doom Bolt 3 -> 4, leaving a 37-card reserve. Its matrix output
    // was 89/95/74/96/97%, avg 90%, but it was discarded before acceptance.
    // Attempt 4 KEPT as the final legal base: the classic singleton
    // dt-silver-fishbone became the fourth in-doom-bolt, while reserveDeck
    // moved from Doom Bolt 3 plus Fishbone 4 to Doom Bolt 4 plus Fishbone 3,
    // preserving its 40-card shape. It measured 88/90/68/96/99%, avg 88%,
    // with no draws at 200 seeds/cell. Muster rose 86% -> 88%, Mandate
    // 95% -> 96%, and no cell regressed from the prior valid kept list.
    // Validator follow-through 2026-08-30: the source-list swap changes the
    // deterministic pre-Starborne Darlings builder output, so darlingsDeck
    // below is synchronized to that validator result. This is not a tuning
    // lever.
    reserveDeck: expand([
      ['dt-abyssal-songstress', 4],
      ['gm-black-cat-familiar', 4],
      ['gm-batcloak-cutthroat', 4],
      ['gm-blood-opera-soloist', 4],
      ['dt-sea-glass-knife', 4],
      ['gm-black-veil-matron', 4],
      ['gm-stormglass-golem', 2],
      ['in-undertow', 1],
      ['in-grave-chill', 4],
      ['in-doom-bolt', 4],
      ['dt-silver-fishbone', 3],
      ['dt-undersea-bargain', 1],
      ['dt-mirror-apple-curse', 1],
    ]),
    landReserve: expand([
      ['dt-tide-cavern', 4],
      ['land-island', 2],
      ['land-swamp', 4],
    ]),
    darlingsDeck: [
      'gm-stormglass-golem',
      'sd-two-for-the-ferrywoman',
      'gm-moon-doll-orchestra',
      'sd-fourth-weighing',
      'cf-badb-cathas-warning',
      'gm-madame-macabre',
      'dt-undersea-bargain',
      'in-doom-bolt',
      'gm-nocturne-manor',
      'dt-storybook-of-ashes',
      'gm-stitchwork-guardian',
      'in-grave-chill',
      'dt-mirror-apple-curse',
      'sd-the-last-chart-of-the-duat',
      'dt-clockwork-coachwoman',
      'dt-sea-witch-contract',
      'dt-briar-rose-lullaby',
      'dt-sleeping-curse',
      'dt-tower-braid-escape',
      'dt-thirteenth-spindle',
      'dt-seven-shadow-miners',
      'en-persephones-return',
      'gm-black-lace-pact',
      'dt-apple-of-endless-sleep',
      'in-reapers-due',
      'ac-queen-regents-command',
      'in-dream-fracture',
      'sd-the-map-argues-back',
      'sd-the-weight-owed-in-full',
      'dt-dream-prick',
      'cf-mist-over-tara',
      'tk-wu-luxun',
      'dt-ink-contract-clerk',
      'sd-wrong-door',
      'yn-night-market-price',
      'ar-imperial-jade-seal',
      'ac-sword-test-stone',
      'so-creeping-malaise',
      'gm-black-veil-matron',
      'gm-blood-opera-soloist',
      'gm-batcloak-cutthroat',
      'ar-siege-juggernaut',
      'gm-black-cat-familiar',
      'ar-training-dummy',
      'gm-screaming-staircase',
      'dt-sea-glass-knife',
      'in-undertow',
      'yn-network-sprite',
      'dt-sugar-cottage-witch',
      'gm-stitched-footman',
      'sd-navigator-of-the-last-channel',
      'ar-bronze-colossus',
      'ac-oathbroken-knight',
      'gk-hermes',
      'gm-widow-of-the-west-wing',
      'yn-moonlit-data-duelist',
      'yn-skyline-yokai',
      'gm-porcelain-governess',
      'tk-wei-chenqun',
      'gm-manor-thrall',
      'sd-the-heavier-offering',
      'yn-oni-bounty-agent',
      'tk-wei-jiaxu',
      'sd-barge-oar-fitting',
      'sd-chart-keeper-of-the-two-ways',
      'tk-other-zuoci',
      'gk-nyx',
      'gm-blood-drop-initiate',
      'ar-terracotta-soldier',
      'tk-other-dongbai',
      'yn-azure-oni-broker',
      'gm-haunted-doll',
      'tk-wu-daqiao',
      'tk-wu-xiaoqiao',
      'dt-frog-pond-bride',
      'so-dirge-of-loss',
      'tk-wu-zhugeke',
      'bk-batkin-duskwing',
      'sd-drowned-cartographer',
    ],
    darlingId: 'dt-abyssal-songstress',
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
      ['yn-neon-gate-warden', 2],
      ['dt-sea-glass-knife', 4],
      ['yn-signal-bridge', 2],
      ['yn-circuit-foretelling', 2],
    ]),
    // HAND-TUNED 2026-08-29 (measured boss-tuning pass; R19): baseline was
    // 51% at 200 seeds/cell, cells 47/61/44/56/47% in
    // Muster/Communion/Tides/Mandate/Harvest order. Attempt 1 KEPT:
    // replacing the four-copy yn-bastion-lantern package with
    // yn-neon-gate-warden (two copies in deck, four in reserveDeck) measured
    // 70/75/48/72/73%, avg 67%, with no draws at 200 seeds/cell. The 4/4
    // two-drop and Warding Gaze materially repaired the shallow miss.
    // FINAL 14-24 MATRIX 2026-08-29 (200 seeds/cell; cells in
    // Muster/Communion/Tides/Mandate/Harvest order; +draws shown):
    // R14 32/81/54/77/66 avg 62; R15 72/84/56/93/94 avg 79;
    // R16 60/73/49/86/91 avg 72; R17 77/80/56/98/92 avg 80;
    // R18 91/83/50/93/97 avg 83; R19 70/75/48/72/73 avg 67;
    // R20 81/70/81/94/96 avg 84; R21 53/79/60/63(199+1d)/51 avg 61;
    // R22 56/85/57/90/88 avg 75; R23 50/82/59/71/77 avg 68;
    // R24 64/87/59/82/94 avg 77. FLAGS none.
    // HAND-TUNED 2026-09-19 (reserve list only; classic, lands and Darlings
    // unchanged; registered in tests/data/avatarReserveDecks.test.ts). She had
    // never been tuned. She read 61 on 2026-08-23 and 58.6 on 2026-09-19
    // (40/75/49/59/71), 4.1pp over her own floor, the thinnest untuned boss.
    // THE DEFECT WAS HER CURVE. The converter's cut has no creature below
    // three mana, and her three-drop (Neon-Gate Warden) has Bulwark and cannot
    // attack, so she did nothing on turns one and two while Crimson Muster
    // (40) and Burning Tides (49) ran her over. Four of her forty were Circuit
    // Foretelling, which looks at two cards and replaces nothing.
    // Attempt 1 KEPT, the accepted list: four yn-circuit-foretelling become
    // four yn-lantern-fixer (2/2 Kitsune for two, Foresee 1 on arrival; her
    // three lords make it a 3/3 or better). 53/86/61/82/78, avg 71.7, no draws
    // at 200 seeds/cell; the committed list's own numbers are in
    // tests/ai/winrate.test.ts.
    // The same two-drop, other payers: Signal Bridge out 70.6, Sanctum of Many
    // Masks out 68.1; bk-kitsune-illusionist for Foretelling 69.3. LOAD-BEARING,
    // do not cut: dt-sea-glass-knife out 60.0, yn-neon-gate-warden out 56.1.
    // THE CONVERTER-DEFECT THEORY WAS TESTED AND DID NOT HOLD. The converter
    // had halved her own legend and her Moonlit Data Duelists (4 -> 2 each)
    // and doubled four cheap packages. Restoring both read 63.9 on the five
    // starters (+5.3), but on the independent 14-deck reserve matrix the three
    // lists read baseline 62.5, authored cards restored 63.5, this list 74.2.
    // +1.0 is noise: the restoration was fitting the starter columns. A dropped
    // namesake is a suspect, not a defect.
    // SECOND LEVERS MEASURED ON THE STARTERS ONLY AND NOT TAKEN, because none
    // has a 14-deck confirmation and the line above is why that matters: this
    // list plus the authored legend and Duelists 77.5, plus four
    // yn-echo-fox-informant for Signal Bridge 76.1, plus four
    // bk-kitsune-illusionist 76.4.
    reserveDeck: expand([
      ['yn-queen-of-the-lanterned-roof', 2],
      ['yn-lantern-court-regent', 4],
      ['yn-white-lantern-vanguard', 4],
      ['yn-bluewire-illusionist', 4],
      ['yn-moonlit-data-duelist', 2],
      ['yn-hauntlink-signal-lure', 4],
      ['yn-sanctum-of-many-masks', 4],
      ['yn-neon-gate-warden', 4],
      ['dt-sea-glass-knife', 4],
      ['yn-signal-bridge', 4],
      ['yn-lantern-fixer', 4],
    ]),
    landReserve: expand([
      ['ld-misty-palace-terrace', 4],
      ['land-plains', 3],
      ['land-island', 3],
    ]),
    darlingsDeck: [
      'yn-hauntlink-signal-lure',
      'yn-sanctum-of-many-masks',
      'yn-azure-oni-broker',
      'sd-crown-bearer-of-the-last-hall',
      'ac-quest-for-the-grail',
      'dd-lamp-oil-saint',
      'yn-bluewire-illusionist',
      'yn-oni-precinct-captain',
      'yn-circuit-foretelling',
      'gm-moon-doll-orchestra',
      'sd-the-last-chart-of-the-duat',
      'bk-kitsune-dreamweaver',
      'sd-heart-scale-reliquary',
      'sd-fourth-weighing',
      'ac-round-table-vow',
      'dd-drowned-saint',
      'yn-signal-bridge',
      'yn-white-veil-collapse',
      'sd-white-gate-adjudicator',
      'dd-drowned-bell-choir',
      'dt-honor-blade-captain',
      'gm-stormglass-golem',
      'dd-lamp-lit-vigil',
      'ac-queen-regents-command',
      'dt-briar-rose-lullaby',
      'in-dream-fracture',
      'sd-the-map-argues-back',
      'dt-tower-braid-escape',
      'cf-mist-over-tara',
      'dd-drowned-ledger',
      'sd-stop-the-procession',
      'tk-wu-luxun',
      'dd-watch-and-tide',
      'dd-what-the-lamps-saw',
      'gm-lightning-rod-spire',
      'sd-the-book-opens-twice',
      'sd-the-gate-is-closed',
      'sd-marked-at-the-gate',
      'so-judgment-of-heaven',
      'yn-neon-gate-warden',
      'yn-moonlit-data-duelist',
      'yn-white-lantern-vanguard',
      'dt-sea-glass-knife',
      'gk-hermes',
      'gm-silver-bullet-duelist',
      'gm-iron-gate-sentinel',
      'yn-network-sprite',
      'cf-sidhe-silver-lancer',
      'dd-drowned-scholar',
      'sd-navigator-of-the-last-channel',
      'yn-silver-moon-duelist',
      'dd-shore-patrol',
      'tk-shu-xingcai',
      'dd-gate-warden',
      'dd-thing-in-the-cistern',
      'ar-training-dummy',
      'tk-wei-chenqun',
      'gm-screaming-staircase',
      'sd-chart-keeper-of-the-two-ways',
      'dd-bell-ringer-abbess',
      'gk-hestia',
      'gk-hoplite',
      'dd-drowned-lighthouse-keeper',
      'gk-eos',
      'tk-other-zuoci',
      'ac-keep-watchwoman',
      'bk-kitsune-illusionist',
      'gm-stitched-footman',
      'gk-iris',
      'gk-nike',
      'dd-breakwater-warden',
      'dd-watch-sergeant',
      'bk-bunny-vanguard',
      'tk-wu-xiaoqiao',
      'ac-novice-squire',
      'cf-cold-moon-archer',
      'cf-sidhe-page',
      'dd-wharf-watch',
      'bk-mousekin-pantry-guard',
    ],
    darlingId: 'gk-aphrodite',
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
    // HAND-TUNED 2026-09-19 (reserve list only; classic, lands and Darlings
    // unchanged; registered in tests/data/avatarReserveDecks.test.ts). She had
    // never been tuned: this was the converter's first cut, and it read 87 on
    // 2026-08-23, 84 after AI phase C and 81.6 on 2026-09-19 (74/70/82/91/92,
    // reproduced exactly before anything changed), 1.1pp over her own floor.
    // THE DEFECT was the converter's, the same shape that once hobbled The
    // Bride: it DROPPED all four yn-redline-queenpin her authored list runs
    // (5/4 Warcry, 4 damage on arrival) and DOUBLED her Hauntlink package to
    // eight three-mana copies instead.
    // MEASURED, not guessed (500 of her games, a read-only wrapper on her
    // brain): once a Hauntlink card is on the battlefield the policy uses it
    // (Burning Mask linked 0.82 times per cast, Ember-Link Chain 1.21), so the
    // brains are not the problem. The list is: each Mask and Chain she saw was
    // cast only about half the time (52% and 51%), the rest stranded in hand,
    // because eight is more than her curve can spend. And yn-hauntlink-apex
    // was cast in 7% of games (13% when seen): under rules rev 4 a link is an
    // ability paid AFTER the card is cast, so Apex is eight mana in a ten-land
    // format. That is a CARD finding for the owner, not fixed here; her two
    // Apex stay because they are her authored identity.
    // Attempt 1 KEPT, the accepted list: two yn-burning-mask-of-the-void and
    // two yn-ember-link-chain become four yn-redline-queenpin, which restores
    // the authored 4/2/2 proportions. Appended-order run 82/81/90/95/97, avg
    // 89.0, no draws at 200 seeds/cell; the committed list's own numbers are
    // in tests/ai/winrate.test.ts.
    // Same lever, other payers: four Chain out 89.5; four Mask out 88.8; two
    // Apex plus the two singletons out 85.5 (Lu Bu and the Glass Runner earn
    // their slots); four in-undertow out 79.5 and four yn-network-sprite out
    // 82.4 (both load-bearing). Not Queenpin: two Apex to two
    // yn-moonlit-data-duelist 89.2; four Chain to four sd-burn-the-rope 87.4.
    // CONFIRMED on the independent 14-deck reserve matrix before anything was
    // stacked: baseline 86.8, this list 92.3, Chain out 92.5, Apex out 90.4.
    // The lever is smooth, for a later owner call on her strength: two
    // Queenpin (one Mask, one Chain out) read 86.9, her 2026-08-23 strength;
    // three read 88.7; four read 89.0.
    reserveDeck: expand([
      ['yn-kitsune-neon-tyrant', 4],
      ['yn-redline-queenpin', 4],
      ['yn-redline-kitsune', 4],
      ['yn-magenta-kitsune-runner', 4],
      ['yn-network-sprite', 4],
      ['bk-harpy-skirmisher', 4],
      ['yn-hauntlink-apex', 2],
      ['yn-burning-mask-of-the-void', 2],
      ['yn-ember-link-chain', 2],
      ['in-fire-attack', 4],
      ['in-undertow', 4],
      ['dt-midnight-glass-runner', 1],
      ['tk-other-lubu', 1],
    ]),
    landReserve: expand([
      ['ld-red-cliffs-anchorage', 4],
      ['land-island', 3],
      ['land-mountain', 3],
    ]),
    darlingsDeck: [
      'yn-burning-mask-of-the-void',
      'yn-hauntlink-apex',
      'yn-ember-link-chain',
      'sd-the-last-chart-of-the-duat',
      'sd-heart-scale-reliquary',
      'yn-blue-ghost-broadcaster',
      'sd-fourth-weighing',
      'sd-keeper-of-the-fifth-channel',
      'dd-wreckfire',
      'dd-storm-tide-horror',
      'in-fire-attack',
      'gm-moon-doll-orchestra',
      'dd-drowned-bell-choir',
      'bk-kitsune-dreamweaver',
      'sd-deep-channel-cartographer',
      'yn-azure-oni-broker',
      'rg-memory-thief',
      'dd-storm-surge',
      'rg-ragnarok',
      'sd-barge-fire-brazier',
      'sd-sand-through-the-grate',
      'cf-fomorian-raider',
      'sd-the-map-argues-back',
      'sd-hena-who-rows-against-the-hour',
      'sd-the-book-opens-twice',
      'sd-wrong-door',
      'gm-stormglass-golem',
      'dt-briar-rose-lullaby',
      'in-dream-fracture',
      'dt-tower-braid-escape',
      'sd-run-the-deck',
      'tk-shu-yueying',
      'tk-wu-luxun',
      'sd-altar-of-the-fourth-hall',
      'rg-twice-chosen-shieldmaiden',
      'so-warcry',
      'dd-breakwater-brawler',
      'yn-network-sprite',
      'yn-redline-kitsune',
      'bk-harpy-skirmisher',
      'yn-magenta-kitsune-runner',
      'bk-dragonmaid',
      'sd-barge-fire-warcaller',
      'sd-navigator-of-the-last-channel',
      'sd-sun-rope-hauler',
      'yn-moonlit-data-duelist',
      'sd-ashwake-twinblade',
      'in-undertow',
      'ar-siege-juggernaut',
      'sd-emberwake-runner',
      'sd-chart-keeper-of-the-two-ways',
      'sd-serpent-wake-raider',
      'dd-drowned-lighthouse-keeper',
      'cf-redcap-blood-host',
      'dd-storm-choir',
      'sd-sunfire-warcaller',
      'tk-wu-sunce',
      'dd-drowned-scholar',
      'gm-moonlit-werewolf',
      'yn-rainflash-duelist',
      'sd-twinblade-at-the-prow',
      'ac-tournament-favorite',
      'dd-false-lamp-bearer',
      'dt-wolf-at-the-door',
      'gk-hermes',
      'ar-training-dummy',
      'dd-wreck-runner',
      'tk-wei-chenqun',
      'gm-screaming-staircase',
      'tk-wei-xiahoudun',
      'tk-wu-sunjian',
      'bk-kitsune-illusionist',
      'bk-wolfkin-raider',
      'cf-laughing-pooka',
      'gm-stitched-footman',
      'rg-mist-wraith',
      'tk-wu-handang',
      'bk-mermaid-chartsinger',
      'sd-channel-watch-diver',
    ],
    darlingId: 'sd-barge-sail-ascendant',
  },

  // ---------------------------------------------------------------------
  // Rung 21 - Anubis, Who Holds the Scale: W/B Judgment control. (Hard · Sands of the Duat)
  {
    id: 'anubis-who-holds-the-scale',
    name: 'Anubis, Who Holds the Scale',
    title: 'The Verdict Is Already Weighed',
    blurb: 'The scale is honest and nothing else in the hall is. She severs what the grave would return, pays Rites with what she has already weighed, and Preserves her best verdicts.',
    theme: 'White-Black Judgment Control (Sever, Rite, Preserve)',
    tier: 21,
    difficulty: 'hard',
    portraitCardId: 'sd-anubis-who-holds-the-scale',
    personality: makePersonality({
      aggression: 0.9,
      holdback: 1.2,
      attackThreshold: 0.2,
      removalBias: 0.8,
      subtypeBias: 0.5,
      preferredSubtypes: ['God', 'Keeper'],
    }),
    deck: expand([
      ['land-plains', 10],
      ['land-swamp', 10],
      ['sd-land-the-weighing-hall', 4],
      ['sd-anubis-who-holds-the-scale', 2],
      ['sd-keeper-of-the-salt-room', 2],
      ['sd-twice-wrapped-champion', 2],
      ['sd-copy-kept-in-resin', 4],
      ['sd-resin-handed-embalmer', 2],
      ['sd-keeper-of-the-sealed-jar', 2],
      ['sd-canopic-grave-warden', 2],
      ['sd-claw-handed-embalmer', 2],
      ['sd-one-clean-cut', 4],
      ['sd-cut-the-wrappings', 4],
      ['sd-strike-the-lintel', 2],
      ['sd-the-gate-is-closed', 2],
      ['sd-the-heavier-offering', 2],
      ['sd-priestess-of-the-emptied-jar', 2],
      ['sd-give-it-the-better-one', 2],
    ]),
    // HAND-TUNED 2026-08-23 (rung-21 tuning pass): 33% -> 57%, measured at
    // 200 seeds/cell on the reserve-native avatar matrix. Cells 44/81/57/55/46.
    //
    // WHY THE CONVERTER BUILD FAILED, in the order the evidence landed:
    //   1. FOUR DEAD CARDS. It retained sd-strike-the-lintel x4 because the
    //      card is an "eligible spell", but that charm targets
    //      artifactOrEnchantment and the five starter reserve columns hold
    //      ZERO artifacts and ZERO enchantments. She played 36 cards against
    //      40. Swapping those four for real removal: 33% -> 41%.
    //   2. LOW-IMPACT BODIES AT THE SAME COST. sd-canopic-grave-warden is a
    //      3/3 for {3}B where sd-devourers-retainer is a 5/5 for {3}B. 41 ->
    //      48%.
    //   3. NO ANSWER TO deathblade. Grave Harvest fields 13 deathblade
    //      creatures, which blank big bodies (a 1/3 eats a 7/6); that cell sat
    //      at 15%. firstBlade beats deathblade, so cf-sidhe-silver-lancer went
    //      in: cell 15% -> 38%.
    //   4. THE TAPLAND TAX, and the largest single lever. FOUR of her ten
    //      lands are sd-land-the-weighing-hall, which is entersTapped, while
    //      Crimson Muster's ten are all basics - she is structurally a tempo
    //      behind her worst matchup and landReserve is pinned to the converter,
    //      so she cannot buy it back. The answer is a cheaper curve, not more
    //      threats: two weak mv4 3/3s became two {0}B in-grave-chill. +4pp,
    //      and the worst cell went 30% -> 44%.
    //
    // TWO CARDS THAT LOOK CUTTABLE AND ARE NOT, both proved by measurement:
    //   sd-priestess-of-the-emptied-jar x4 - a 1/2 that leaves a scarab token,
    //     so it is two chump bodies against Shadow Mandate's creeping-malaise
    //     and deathblade creatures. Cutting it crashed that cell 70% -> 39%.
    //   sd-cut-the-wrappings x4 - removal is NOT fungible here: every Shadow
    //     Mandate creature has 3+ toughness, so -3/-3 kills what -2/-2 cannot.
    //     She needs both kinds and runs both.
    //
    // MEASURED AND REJECTED (kept so they are not retried): loading the curve
    // with mv6-7 top end (35% - it is a 10-land format); so-creeping-malaise
    // x4, the pool's only mass effect (29% - symmetric, and her own board is
    // the smaller one); cutting removal for a second first-striker (52%); and
    // an aggression-ward personality shift (57%, i.e. no change, so her shared
    // personality was left alone rather than moved for nothing).
    //
    // The {4:10, 5:4} curve CAP was never binding here (she used 2 and 2);
    // the defect is the RETENTION rule, which has no notion of whether a
    // retained card has legal targets in the format it is being built for.
    reserveDeck: expand([
      ['sd-anubis-who-holds-the-scale', 2],
      ['cf-sidhe-silver-lancer', 4],
      ['in-grave-chill', 2],
      ['sd-devourers-retainer', 4],
      ['sd-one-clean-cut', 4],
      ['sd-cut-the-wrappings', 4],
      ['in-reapers-due', 4],
      ['sd-the-gate-is-closed', 2],
      ['sd-the-heavier-offering', 4],
      ['sd-gatekeeper-judge', 2],
      ['sd-priestess-of-the-emptied-jar', 4],
      ['cf-moorland-guide', 2],
      ['cf-cold-moon-archer', 2],
    ]),
    landReserve: expand([
      ['sd-land-the-weighing-hall', 4],
      ['land-plains', 3],
      ['land-swamp', 3],
    ]),
    darlingsDeck: [
      'sd-copy-kept-in-resin',
      'sd-two-for-the-ferrywoman',
      'sd-crown-bearer-of-the-last-hall',
      'sd-gatekeeper-judge',
      'sd-white-gate-adjudicator',
      'sd-the-gate-is-closed',
      'sd-white-crown-marshal',
      'sd-fourth-weighing',
      'ac-quest-for-the-grail',
      'sd-one-clean-cut',
      'sd-natron-censer-bearer',
      'gm-silver-bullet-duelist',
      'sd-cut-the-wrappings',
      'sd-strike-the-lintel',
      'dt-storybook-of-ashes',
      'sd-the-weight-owed-in-full',
      'yn-white-veil-collapse',
      'sd-silence-after-the-verdict',
      'sd-stop-the-procession',
      'en-persephones-return',
      'rg-draugr-jarl',
      'dt-honor-blade-captain',
      'gm-stormglass-golem',
      'cf-crowbone-prophet',
      'in-reapers-due',
      'gm-black-lace-pact',
      'gm-midnight-autopsy',
      'sd-the-long-drying',
      'yn-lantern-fixer',
      'tk-other-zhangjiao',
      'dt-glass-stair-duelist',
      'dt-sleeping-curse',
      'sd-marked-at-the-gate',
      'dt-thirteenth-spindle',
      'yn-sever-the-signal',
      'in-stand-as-one',
      'sd-the-heavier-offering',
      'gm-black-veil-matron',
      'sd-warden-of-the-kept',
      'sd-hall-usher-captain',
      'sd-natron-claw-keeper',
      'cf-sidhe-silver-lancer',
      'yn-white-lantern-vanguard',
      'sd-standard-bearer',
      'sd-pridewall-runner',
      'sd-lion-gate-sentry',
      'sd-white-crown-sentinel',
      'ac-oathbroken-knight',
      'gm-batcloak-cutthroat',
      'tk-shu-xingcai',
      'sd-ninth-step-duelist',
      'sd-whisker-count-scout',
      'ar-training-dummy',
      'sd-collar-bound-warden',
      'sd-alabaster-usher',
      'sd-claw-thread-lancer',
      'yn-oni-bounty-agent',
      'sd-paw-toll-taker',
      'sd-sand-pawed-guard',
      'gk-nyx',
      'gm-iron-gate-sentinel',
      'cf-moorland-guide',
      'bk-bunny-vanguard',
      'tk-other-dongbai',
      'ac-novice-squire',
      'cf-black-dog-of-lane',
      'cf-bog-banshee',
      'cf-cold-moon-archer',
      'cf-sidhe-page',
      'gk-hestia',
      'gk-hoplite',
      'gm-chapel-guard',
      'bk-mousekin-pantry-guard',
      'cf-bitter-geas',
      'rg-rune-of-hunger',
      'sd-keeper-of-the-salt-room',
      'sd-warden-of-the-heavy-jar',
      'sd-canopic-grave-warden',
      'sd-heart-scale-reliquary',
    ],
    darlingId: 'sd-anubis-who-holds-the-scale',
  },

  // ---------------------------------------------------------------------
  // Rung 22 - Bastet, Mistress of the Ninth Return: R/W Bastet twinBlades pressure. (Hard · Sands of the Duat summit)
  {
    id: 'bastet-mistress-of-the-ninth-return',
    name: 'Bastet, Mistress of the Ninth Return',
    title: 'The Ninth Return Knows Your Name',
    blurb: 'She has died eight times, and she attacks like someone who knows what the ninth return costs. Bastet runners hit first; twinBlades and the anthem stack turn every opening into two.',
    theme: 'Red-White Bastet twinBlades Pressure',
    tier: 22,
    difficulty: 'hard',
    portraitCardId: 'sd-bastet-mistress-of-the-ninth-return',
    personality: makePersonality({
      aggression: 1.4,
      holdback: 0.75,
      attackThreshold: -0.5,
      removalBias: 0,
      subtypeBias: 1.5,
      preferredSubtypes: ['Bastet'],
    }),
    deck: expand([
      ['land-plains', 10],
      ['land-mountain', 10],
      ['sd-land-noon-barge-landing', 4],
      ['sd-barge-pawed-spearwoman', 4],
      ['sd-lion-gate-sentry', 4],
      ['sd-claw-thread-lancer', 4],
      ['sd-pridewall-runner', 4],
      ['sd-dune-pawed-outrider', 4],
      ['sd-bakhet-gate-warden-of-the-lower-city', 2],
      ['sd-standard-bearer', 4],
      ['sd-war-priestess', 2],
      ['sd-bastet-gate-chorus', 2],
      ['sd-bastet-mistress-of-the-ninth-return', 2],
      ['sd-twinblade-at-the-prow', 2],
      ['sd-claw-prow-signaler', 2],
    ]),
    // MEASURED 2026-09-16: owner-ruling B1+B5, hard AI, 200 seeds/cell,
    // reserve-native avatar matrix; 73.60% mean (736/1000 decided, 0 draws).
    // Cells in Muster/Communion/Tides/Mandate/Harvest order:
    // 53.50/85.00/61.00/84.00/84.50%.
    // Pre-phase-C history: 69% mean; cells 52/80/55/84/73% (rounded).
    // Frozen phase-C baseline on 331f17c: 62.40% mean (624/1000 decided,
    // 0 draws); cells 44.50/77.50/45.50/73.50/71.00%.
    // Phase C removed the defenders' twinBlades blind spot, so the unchanged
    // reserve lost strength that had depended on opponents misplaying combat.
    // Same 1,000 seeded games per variant; means average the five cell rates,
    // excluding draws within each cell. Keep only >3pp above baseline, with no
    // baseline cell down >6pp; a combination must beat the best single by >3pp.
    // Every trial was restored before the next; only this final list is adopted.
    // 2026-09-16 owner-ruling surgery B1 KEPT in the final combination: -4
    // Claw-Prow Signaler; +2 Burn the Rope, +2 Break the Coil. This replaces
    // the converter-doubled 1/1 with instant removal and reach.
    // Alone: 69.80% mean (698/1000 decided, 0 draws), +7.40pp from baseline;
    // worst baseline cell decline 0.00pp.
    // Cells: 50.50/80.50/56.50/79.50/82.00%.
    // 2026-09-16 owner-ruling surgery B2 REJECTED: -4 Claw-Thread Lancer;
    // +2 Blade-Dancer, +2 Ashwake Twinblade (ten twinBlades copies retained).
    // Alone: 64.88% mean (648/999 decided, 1 draw), +2.48pp from baseline;
    // worst baseline cell decline 5.00pp. The average gain is inside the 3pp
    // band; the cell-drop limit passes. Mandate is 164/199 decided.
    // Cells: 39.50/79.00/51.00/82.41/72.50%.
    // 2026-09-16 owner-ruling surgery B3 REJECTED: -4 Lion-Gate Sentry;
    // +2 Nefru, Keeper of the White Gate, +2 Tiaa, Who Holds the Lintel.
    // Alone: 63.90% mean (639/1000 decided, 0 draws), +1.50pp from baseline;
    // worst baseline cell decline 2.00pp. The gain is inside the 3pp band.
    // Cells: 43.00/77.00/53.00/77.50/69.00%.
    // 2026-09-16 owner-ruling surgery B4 REJECTED: -4 Dune-Pawed Outrider;
    // +2 Merya, Red-Gate Spearwoman, +2 Sun-Rope Hauler.
    // Alone: 57.20% mean (572/1000 decided, 0 draws), -5.20pp from baseline;
    // worst baseline cell decline 7.00pp. Both selection limits fail.
    // Cells: 38.00/70.50/42.50/69.50/65.50%.
    // 2026-09-16 owner-ruling surgery B5 KEPT in the final combination: -2
    // Bakhet, Gate-Warden of the Lower City (4 -> 2); +2 Kesi of the Paired Knives.
    // Alone: 65.80% mean (658/1000 decided, 0 draws), +3.40pp from baseline;
    // worst baseline cell decline 0.00pp.
    // Cells: 46.50/80.00/49.50/79.00/74.00%.
    // 2026-09-16 owner-ruling surgery 6 KEPT: B1+B5 combined.
    // Combined: 73.60% mean (736/1000 decided, 0 draws), +11.20pp from
    // baseline; worst baseline cell decline 0.00pp; +3.80pp over best single B1.
    // Cells: 53.50/85.00/61.00/84.00/84.50%.
    // Highest measured qualifying combination. Only B1 and B5 qualified as
    // singles, so there was no qualifying third or fourth surgery to combine.
    // Hand-tuned from the 2026-08-21 converter list. Classic deck, landReserve,
    // personality and Darlings surfaces stay unchanged; the reserve divergence
    // is registered in HAND_TUNED_WARCHEST.
    reserveDeck: expand([
      ['sd-barge-pawed-spearwoman', 4],
      ['sd-lion-gate-sentry', 4],
      ['sd-claw-thread-lancer', 4],
      ['sd-pridewall-runner', 4],
      ['sd-dune-pawed-outrider', 4],
      ['sd-bakhet-gate-warden-of-the-lower-city', 2],
      ['sd-kesi-of-the-paired-knives', 2],
      ['sd-standard-bearer', 4],
      ['sd-war-priestess', 2],
      ['sd-bastet-gate-chorus', 2],
      ['sd-bastet-mistress-of-the-ninth-return', 2],
      ['sd-twinblade-at-the-prow', 2],
      ['sd-burn-the-rope', 2],
      ['sd-break-the-coil', 2],
    ]),
    landReserve: expand([
      ['sd-land-noon-barge-landing', 4],
      ['land-plains', 3],
      ['land-mountain', 3],
    ]),
    darlingsDeck: [
      'sd-crown-bearer-of-the-last-hall',
      'sd-keeper-of-the-salt-room',
      'sd-heart-scale-reliquary',
      'sd-fourth-weighing',
      'ac-quest-for-the-grail',
      'dd-lamp-oil-saint',
      'sd-lintel-paw-warden',
      'dd-wreckfire',
      'sd-white-gate-adjudicator',
      'dt-glass-stair-duelist',
      'dd-storm-surge',
      'rg-ragnarok',
      'dd-drowned-saint',
      'sd-barge-fire-brazier',
      'tk-wu-ganning',
      'cf-fomorian-raider',
      'dd-breakwater-brute',
      'yn-white-veil-collapse',
      'sd-natron-crowned-canopic',
      'dt-storybook-of-ashes',
      'ac-castle-under-siege',
      'sd-stop-the-procession',
      'sd-natron-censer-bearer',
      'sd-whisker-watch-archer',
      'dd-salt-fire-witch',
      'dd-gale-rider',
      'dd-bell-tower-sentry',
      'dt-honor-blade-captain',
      'gm-stormglass-golem',
      'sd-marked-at-the-gate',
      'sd-noon-judgment',
      'sd-run-the-deck',
      'dd-reach-fire-witch',
      'sd-the-hall-clears',
      'dt-twelve-dancing-heiresses',
      'sd-salt-and-linen',
      'sd-twinblade-at-the-prow',
      'sd-barge-fire-warcaller',
      'sd-ashwake-twinblade',
      'sd-serpent-wake-raider',
      'sd-standard-bearer',
      'gm-silver-bullet-duelist',
      'sd-barge-pawed-spearwoman',
      'sd-pridewall-runner',
      'sd-sunfire-warcaller',
      'sd-dune-pawed-outrider',
      'sd-lion-gate-sentry',
      'tk-shu-xingcai',
      'sd-sun-rope-hauler',
      'yn-redline-kitsune',
      'sd-claw-thread-lancer',
      'tk-wei-xiahoudun',
      'sd-emberwake-runner',
      'gm-iron-gate-sentinel',
      'cf-sidhe-silver-lancer',
      'dd-storm-choir',
      'tk-wu-sunce',
      'tk-wu-handang',
      'tk-other-warband-captain',
      'sd-sun-rope-charger',
      'ac-tournament-favorite',
      'dd-gate-warden',
      'sd-whisker-count-scout',
      'ar-training-dummy',
      'dd-wreck-runner',
      'bk-harpy-skirmisher',
      'gk-hoplite',
      'tk-other-lulingqi',
      'dd-bell-ringer-abbess',
      'sd-alabaster-usher',
      'sd-sand-pawed-guard',
      'ac-keep-watchwoman',
      'cf-laughing-pooka',
      'bk-bunny-vanguard',
      'bk-mousekin-pantry-guard',
      'ac-lance-of-dawn',
      'dd-salt-ward',
      'dd-widows-lantern',
      'dt-gilded-cage',
    ],
    darlingId: 'sd-bastet-mistress-of-the-ninth-return',
  },

  // ---------------------------------------------------------------------
  // Rung 23 - Chrome Broodmother, The Hull Keeps Its Own Crew: R/G Mark Swarm.
  {
    id: 'chrome-broodmother',
    name: 'Chrome Broodmother',
    title: 'The Hull Keeps Its Own Crew',
    blurb: 'She seeds the board before you notice, marks her favorite, and lets Propagate do the counting. By the time the swarm turns sideways it is already too wide to block.',
    theme: 'Red-Green Mark Swarm (Propagate, Overrun)',
    tier: 23,
    difficulty: 'hard',
    portraitCardId: 'sb-rootlight-broodmother',
    personality: makePersonality({
      aggression: 1.2,
      holdback: 0.7,
      attackThreshold: 0.3,
      removalBias: 0.5,
      subtypeBias: 0.5,
      preferredSubtypes: ['Matriarch', 'Brood', 'Starship'],
    }),
    deck: expand([
      ['land-forest', 10],
      ['land-mountain', 10],
      ['sb-radiant-comet-lane', 4],
      ['sb-mycelial-star-gardener', 4],
      ['cf-heatherblade-scout', 4],
      ['sb-ion-storm-brawler', 2],
      ['sb-burning-hull-runner', 2],
      ['sb-lance-of-two-suns', 2],
      ['sb-ion-storm-brawler', 2],
      ['sb-chrome-sunbreaker', 4],
      ['sb-comet-kick-marauder', 2],
      ['sb-orbitroot-matriarch', 2],
      ['sb-rootlight-broodmother', 2],
      ['sb-emerald-bloom-mother', 2],
      ['sb-brood-communion', 2],
      ['sb-red-solar-lash', 2],
      ['sb-starfall-barrage', 2],
      ['sb-redline-supernova', 2],
    ]),
    // HAND-TUNED 2026-08-29 (measured boss-tuning pass; R23): baseline was
    // 44% at 200 seeds/cell, cells 15/56/31/65/54% in
    // Muster/Communion/Tides/Mandate/Harvest order. Attempt 1 KEPT as the
    // next base: replacing four sb-cometroot-grafter with four
    // sb-chrome-meteorist measured 19/60/31/61/57%, avg 46%, no draws.
    // Attempt 2 KEPT: replacing the synchronized sb-echo-burst package with
    // sb-starfall-barrage measured 40/68/40/67/52%, avg 53%, no draws.
    // Attempt 3 REJECTED: replacing the four-copy sb-rootlight-broodmother
    // plus sb-emerald-bloom-mother top-end package with four sb-starfire-lancer
    // measured 39/66/35/64/62%, avg 53%; it was reverted.
    // Attempt 4 KEPT: after reverting Attempt 3, replacing four
    // sb-flarewing-raider with four cross-set cf-heatherblade-scout measured
    // 42/69/42/67/51%, avg 54%, no draws.
    // Attempt 5 KEPT: replacing the synchronized sb-overcharge-the-hull
    // package with sb-redline-supernova measured 46/75/51/59/61%, avg 58%,
    // with 198 decided games plus 2 draws in Mandate.
    // Attempt 6 REJECTED for shape: replacing four sb-chrome-meteorist with
    // four sb-ion-storm-brawler plus two sb-burning-hull-runner accidentally
    // overfilled both lists. Its raw matrix was 49/75/42/61/63%, avg 58%, no
    // draws, but the classic deck was 62 cards and reserveDeck 42, so it was
    // not a legal draft.
    // Attempt 7 REJECTED as an inherited-invalid draft: replacing four
    // sb-living-hull-seedling with four sb-chrome-sunbreaker measured
    // 54/80/47/66/69%, avg 63%, no draws, but retained Attempt 6's bad shape.
    // Attempt 8 REJECTED as an inherited-invalid draft: replacing two
    // sb-root-of-light with two sb-red-solar-lash measured 54/79/53/70/75%,
    // avg 66%, no draws, but retained Attempt 6's bad shape.
    // Attempt 9 KEPT after correcting that package to the legal four-slot
    // replacement (two additional sb-ion-storm-brawler plus two
    // sb-burning-hull-runner). The valid 60-card/40-card lists measured
    // 50/82/59/71/77%, avg 68%, with no draws at 200 seeds/cell. This is the
    // accepted final R23 deck. Every attempt above used one deck/reserve
    // package lever; darlings and landReserve were not changed.
    // FINAL 14-24 MATRIX 2026-08-29 (200 seeds/cell; cells in
    // Muster/Communion/Tides/Mandate/Harvest order; +draws shown):
    // R14 32/81/54/77/66 avg 62; R15 72/84/56/93/94 avg 79;
    // R16 60/73/49/86/91 avg 72; R17 77/80/56/98/92 avg 80;
    // R18 91/83/50/93/97 avg 83; R19 70/75/48/72/73 avg 67;
    // R20 81/70/81/94/96 avg 84; R21 53/79/60/63(199+1d)/51 avg 61;
    // R22 56/85/57/90/88 avg 75; R23 50/82/59/71/77 avg 68;
    // R24 64/87/59/82/94 avg 77. FLAGS none.
    //
    // RE-TUNED 2026-09-19 (reserve list only; classic, lands and Darlings
    // unchanged). The AI modernization took her from 68 to 60
    // (42/85/55/59/63, re-measured and reproduced exactly on 2026-09-19),
    // 1.5pp above her own floor. The defect was structural and the honest
    // combat models exposed it: she fielded no Skyborne and no Warding Gaze,
    // so she could not block a flier at all, and Crimson Muster fields twelve.
    // Attempt 1 KEPT, the accepted list: two sb-burning-hull-runner and two
    // sb-comet-kick-marauder become four ac-ashwood-ranger (3/3 Warding Gaze,
    // "When this arrives, Mark this", so it blocks fliers AND is a Marked body
    // for Ion-Storm Brawler and Propagate). THIS LIST AS COMMITTED measures
    // 63/82/64/70/84, avg 72.1, no draws at 200 seeds/cell; Muster 42 -> 63.
    // The same forty cards with the Rangers appended last read 62/86/63/65/88,
    // avg 72.6: list order feeds the seeded shuffle, so that is a second
    // sample of one deck, and the two agree. Every comparison below is against
    // the appended-order runs.
    // Same single lever, other payers or other bodies, all below it:
    // Bloom Mother + Marauder out 72.4; four dd-shallows-hunter 65.8; Lash to
    // four 64.7; four ac-court-archer for the Heatherblade Scouts 63.5;
    // Supernova out for the Rangers 64.0 (the sweeper still earns its slots).
    // REJECTED, and worth knowing: four gm-red-roof-village (Festival Rocket)
    // 56.8 and two sb-overcanopy (Overcanopy Trellis) 59.8. In AI hands the
    // repeatable two-damage Duty is too slow and the repeatable Mark source is
    // not an engine on its own.
    // A SECOND LEVER WAS MEASURED AND NOT TAKEN: two sb-lance-of-two-suns to
    // two more sb-red-solar-lash read 77.5 on the five starters (+4.9), but on
    // the independent 14-deck reserve matrix the three lists read baseline
    // 61.2, this list 74.8, this list plus Lash 75.6. +0.8 is noise, so the
    // second lever was fitting the five starter columns, not the field.
    reserveDeck: expand([
      ['sb-mycelial-star-gardener', 4],
      ['cf-heatherblade-scout', 4],
      ['sb-ion-storm-brawler', 2],
      ['ac-ashwood-ranger', 4],
      ['sb-chrome-sunbreaker', 4],
      ['sb-lance-of-two-suns', 2],
      ['sb-ion-storm-brawler', 2],
      ['sb-orbitroot-matriarch', 2],
      ['sb-rootlight-broodmother', 2],
      ['sb-emerald-bloom-mother', 2],
      ['sb-brood-communion', 2],
      ['sb-red-solar-lash', 2],
      ['sb-starfall-barrage', 4],
      ['sb-redline-supernova', 4],
    ]),
    landReserve: expand([
      ['sb-radiant-comet-lane', 4],
      ['land-forest', 3],
      ['land-mountain', 3],
    ]),
    darlingsDeck: [
      'sb-mycelial-star-gardener',
      'cf-heatherblade-scout',
      'sb-ion-storm-brawler',
      'sb-burning-hull-runner',
      'sb-lance-of-two-suns',
      'sb-chrome-sunbreaker',
      'sb-comet-kick-marauder',
      'sb-rootlight-broodmother',
      'sb-emerald-bloom-mother',
      'sb-brood-communion',
      'sb-red-solar-lash',
      'sb-starfall-barrage',
      'sb-redline-supernova',
      'ac-quest-marker',
      'ac-rallying-horn',
      'ac-tilting-lance',
      'ar-training-dummy',
      'bk-nekomata-scout',
      'cf-apple-of-emain',
      'cf-cold-iron-nail',
      'cf-dawn-torc',
      'cf-fae-spark',
      'cf-ogham-fate-stones',
      'cf-silver-thread',
      'cf-thorn-sprite',
      'cf-thornsnare',
      'dd-coral-graft',
      'dd-salt-fire-lesser',
      'dd-wreck-runner',
      'dt-apple-basket',
      'dt-bookmark-charm',
      'dt-brass-lamp-charm',
      'dt-jade-dragon-scale',
      'dt-plaid-arrow',
      'dt-ragged-ballgown',
      'dt-rose-vine-snare',
      'dt-satin-slipper',
      'en-battle-fervor',
      'gm-cellar-door',
      'gm-red-curtain-cut',
      'in-boar-rush',
      'in-comet-blast',
      'in-fire-attack',
      'in-valley-mist',
      'in-wild-surge',
      'rg-berserkers-fury',
      'rg-rune-of-fury',
      'sb-blue-echo-array',
      'sb-hullwake-overdrive',
      'sb-null-orbit-array',
      'sb-redline-salvage',
      'sb-sky-map',
      'sd-barge-fire-brazier',
      'sd-burn-the-rope',
      'sd-empty-heart-jar',
      'sd-lapis-funerary-mask',
      'sd-light-the-wake',
      'sd-reed-bound-canopic',
      'sd-resin-archive',
      'sd-root-through-the-ruin',
      'sd-tomb-seal',
      'so-ember-squall',
      'so-warcry',
      'tk-wu-handang',
      'yn-ember-mask',
      'yn-ghostwood-growth',
      'yn-riot-lantern',
      'yn-rootwall-charm',
      'ac-castle-under-siege',
      'ac-court-archer',
      'ac-moonlit-joust',
      'ac-woodland-errand',
      'ac-bramble-chapel',
      'ac-red-tournament-ground',
      'cf-mossy-ring',
      'dt-desert-rooftop',
      'dt-wolf-path',
      'gm-thorned-cemetery',
      'sb-ember-lane',
    ],
    darlingId: 'sb-orbitroot-matriarch',
  },

  // ---------------------------------------------------------------------
  // Rung 24 - The Violet Signal Queen, Every Answer Arrives Early: U/B Signal Control.
  {
    id: 'the-violet-signal-queen',
    name: 'The Violet Signal Queen',
    title: 'Every Answer Arrives Early',
    blurb: 'She reads three turns ahead and files the future under handled. Counters for the spell, severance for the grave, and a court of untouchable threats for everything that survives the paperwork.',
    theme: 'Blue-Black Signal Control (Foresee, Sever, Cancel)',
    tier: 24,
    difficulty: 'hard',
    portraitCardId: 'sb-astral-reef-singer',
    personality: makePersonality({
      aggression: 0.7,
      holdback: 1.3,
      attackThreshold: 0.15,
      removalBias: 1.0,
      subtypeBias: 0.4,
      preferredSubtypes: ['Singer', 'Navigator'],
    }),
    deck: expand([
      ['land-island', 12],
      ['land-swamp', 12],
      ['sb-star-reader', 4],
      ['sb-velvet-void-cartographer', 4],
      ['sb-severance-priestess', 2],
      ['sb-darkmatter-harvester', 2],
      ['sb-void-halo-assassin', 2],
      ['sb-violet-maw', 2],
      ['sb-voidcurrent-conjurer', 2],
      ['dt-poison-mirror-regent', 2],
      ['sb-astral-reef-singer', 2],
      ['sb-abyssal-iris-regent', 2],
      ['sb-signal-drown', 2],
      ['sb-collapse-the-lane', 2],
      ['sb-marrow-eviction', 2],
      ['sb-void-lament', 2],
      ['sb-corpse-lantern', 2],
      ['sb-deep-space-severance', 2],
    ]),
    reserveDeck: expand([
      ['sb-star-reader', 4],
      ['sb-velvet-void-cartographer', 4],
      ['sb-severance-priestess', 2],
      ['sb-darkmatter-harvester', 2],
      ['sb-void-halo-assassin', 4],
      ['sb-violet-maw', 2],
      ['sb-voidcurrent-conjurer', 2],
      ['dt-poison-mirror-regent', 2],
      ['sb-astral-reef-singer', 2],
      ['sb-abyssal-iris-regent', 2],
      ['sb-signal-drown', 2],
      ['sb-collapse-the-lane', 2],
      ['sb-marrow-eviction', 2],
      ['sb-void-lament', 2],
      ['sb-corpse-lantern', 4],
      ['sb-deep-space-severance', 2],
    ]),
    landReserve: expand([
      ['land-island', 5],
      ['land-swamp', 5],
    ]),
    // MEASURED 2026-08-29 (hard AI, 200 seeds/cell, reserve-native avatar
    // matrix vs the five starters): 80% average; cells 77/90/62/78/95% in
    // Muster/Communion/Tides/Mandate/Harvest order. Every cell had 200
    // decided games and zero draws. FLAGS none.
    // Generated 2026-08-29 by `npx tsx scripts/avatarReserveDecks.ts --print`.
    // The classic deck, reserveDeck, and landReserve above are the locked
    // contract lists; only this converter-owned surface is generated.
    darlingsDeck: [
      'sb-star-reader',
      'sb-velvet-void-cartographer',
      'sb-severance-priestess',
      'sb-darkmatter-harvester',
      'sb-void-halo-assassin',
      'sb-violet-maw',
      'sb-voidcurrent-conjurer',
      'dt-poison-mirror-regent',
      'sb-astral-reef-singer',
      'sb-abyssal-iris-regent',
      'sb-signal-drown',
      'sb-collapse-the-lane',
      'sb-marrow-eviction',
      'sb-void-lament',
      'sb-corpse-lantern',
      'sb-deep-space-severance',
      'ac-bitter-court-rumor',
      'ac-courtly-betrayal',
      'ac-grail-glimpse',
      'ac-lantern-in-fog',
      'ac-mirror-of-avalon',
      'ac-quest-marker',
      'ac-wounded-oath',
      'ar-training-dummy',
      'cf-barrow-whisper',
      'cf-bitter-geas',
      'cf-cold-iron-nail',
      'cf-dawn-torc',
      'cf-fogbell-chime',
      'cf-glimmerdust-trick',
      'cf-lake-mirror-vow',
      'cf-ogham-fate-stones',
      'cf-salt-the-barrow',
      'cf-silver-thread',
      'dd-cellar-jar',
      'dd-current-reader',
      'dd-fog-bank',
      'dd-salt-in-the-eyes',
      'dd-tide-glass',
      'dd-tithe-of-the-wharf',
      'dd-undertow-charm',
      'dd-wharf-rat',
      'dt-bookmark-charm',
      'dt-brass-lamp-charm',
      'dt-briar-rose-lullaby',
      'dt-cursed-ball-invite',
      'dt-cursed-rose',
      'dt-dream-prick',
      'dt-ink-black-carriage',
      'dt-laced-too-tight',
      'dt-lullaby-refrain',
      'dt-ragged-ballgown',
      'dt-satin-slipper',
      'dt-sea-glass-knife',
      'dt-silver-fishbone',
      'dt-singing-shell',
      'dt-tower-braid-escape',
      'dt-wicked-step',
      'en-clouded-mind',
      'gm-cellar-door',
      'gm-fogged-window',
      'gm-funeral-bell',
      'in-empty-fort-stratagem',
      'in-grave-chill',
      'in-undertow',
      'rg-rune-of-hunger',
      'rg-rune-of-insight',
      'sb-blue-echo-array',
      'sb-null-orbit-array',
      'sb-signal-inversion',
      'ac-court-of-whispers',
      'ac-mirror-lake',
      'cf-mist-road',
      'cf-raven-stone',
      'dt-midnight-road',
      'dt-sea-cave',
      'dt-winter-bridge',
      'gm-lab-annex',
      'sb-deepfield-lands',
    ],
    darlingId: 'sd-sitra-ferrywoman-of-two-rivers',
  },

  // ---------------------------------------------------------------------
  // Rung 25 - The Drowned Deacon, The Bell Beneath the Harbour: U/B Whispers Control.
  {
    id: 'the-drowned-deacon',
    name: 'The Drowned Deacon',
    title: 'The Bell Beneath the Harbour',
    blurb: 'She mills her own library on a schedule and calls it housekeeping. Every card she loses is one she meant to cast from the grave, and the counters are held for the one spell you needed to resolve.',
    theme: 'Blue-Black Whispers Control (Grind, Cancel, Tithe)',
    tier: 25,
    difficulty: 'hard',
    portraitCardId: 'dd-drowned-deacon',
    personality: makePersonality({
      aggression: 0.7,
      holdback: 1.3,
      attackThreshold: 0.15,
      removalBias: 1.0,
      subtypeBias: 0.4,
      preferredSubtypes: ['Deep One', 'Horror'],
    }),
    deck: expand([
      ['land-island', 12],
      ['land-swamp', 12],
      ['dd-tide-clerk', 3],
      ['dd-current-caller', 2],
      ['dd-tide-reader', 2],
      ['dd-harbour-looter', 2],
      ['dd-drowned-bell-choir', 2],
      ['dd-drowned-lighthouse-keeper', 2],
      ['dd-drowned-deacon', 3],
      ['dd-deep-one-hierophant', 2],
      ['dd-drowned-bride', 2],
      ['dd-father-dagon', 1],
      ['dd-cold-current', 2],
      ['dd-still-water', 2],
      ['dd-the-price', 2],
      ['dd-undertow', 2],
      ['dd-memory-of-the-drowned', 2],
      ['dd-tide-that-turns', 2],
      ['dd-drowned-bell', 2],
      ['dd-tide-that-remembers', 1],
    ]),
    // MEASURED 2026-09-16: owner-ruling D1+D2+D5, hard AI, 200 seeds/cell,
    // reserve-native avatar matrix; 66.40% mean (664/1000 decided, 0 draws).
    // Cells in Muster/Communion/Tides/Mandate/Harvest order:
    // 39.00/71.50/64.50/82.50/74.50%.
    // Frozen V0 baseline under the adopted 0.2 Tithe policy: 35.90% mean
    // (359/1000 decided, 0 draws); cells 21.00/26.00/43.00/55.00/34.50%.
    // Same 1,000 seeded games per variant; means average the five cell rates,
    // excluding draws within each cell. Keep only >3pp above baseline, with no
    // baseline cell down >6pp; a combination must beat the best single by >3pp.
    // 2026-09-16 owner-ruling surgery 1 KEPT in the final combination: -4
    // Drowned Bell; +2 Drowned Bride, +2 Deep One Scout.
    // Alone: 51.00% mean (510/1000 decided, 0 draws), +15.10pp from baseline;
    // worst baseline cell decline 0.00pp.
    // Cells: 27.00/53.00/46.00/65.00/64.00%.
    // 2026-09-16 owner-ruling surgery 2 KEPT in the final combination: -2 Cold
    // Current (4 -> 2); +2 Thing in the Cistern.
    // Alone: 50.67% mean (506/999 decided, 1 draw), +14.77pp from baseline;
    // worst baseline cell decline 0.00pp.
    // Cells: 36.00/43.00/57.50/73.37/43.50%.
    // 2026-09-16 owner-ruling surgery 3 REJECTED as superseded: -2 Tide Reader;
    // +2 Cold Water Horror.
    // Alone: 40.00% mean (400/1000 decided, 0 draws), +4.10pp from baseline;
    // worst baseline cell decline 0.00pp.
    // Cells: 25.50/30.00/48.50/56.00/40.00%.
    // 2026-09-16 owner-ruling surgery 4 REJECTED: -2 Memory of the Drowned; +2
    // Black Water.
    // Alone: 36.30% mean (363/1000 decided, 0 draws), +0.40pp from baseline;
    // worst baseline cell decline 5.50pp.
    // The average gain is inside the 3pp band; the cell-drop limit passes.
    // Cells: 26.50/30.50/37.50/52.50/34.50%.
    // 2026-09-16 owner-ruling surgery 5 KEPT in the final combination: -1 Tide
    // That Turns, -1 Current Caller (3 -> 2); +1 Mother Hydra, +1 Deep One
    // Hierophant (2 -> 3).
    // Alone: 44.70% mean (447/1000 decided, 0 draws), +8.80pp from baseline;
    // worst baseline cell decline 0.00pp.
    // Cells: 25.50/40.00/43.50/63.50/51.00%.
    // 2026-09-16 owner-ruling surgery 6 REJECTED as superseded: D1+D2 combined.
    // Combined: 64.20% mean (642/1000 decided, 0 draws), +28.30pp from
    // baseline; worst baseline cell decline 0.00pp.
    // +13.20pp over the best single.
    // Cells: 38.50/65.00/66.50/81.50/69.50%.
    // 2026-09-16 owner-ruling surgery 7 KEPT: D1+D2+D5 combined.
    // Combined: 66.40% mean (664/1000 decided, 0 draws), +30.50pp from
    // baseline; worst baseline cell decline 0.00pp.
    // +15.40pp over the best single.
    // Highest measured qualifying combination: +2.20pp over the pair is
    // inside the 3pp band. Selection follows the explicit combination-vs-
    // best-single rule, not a claim of separation from the pair.
    // Cells: 39.00/71.50/64.50/82.50/74.50%.
    // Hand-tuned from the 2026-09-15 deterministic converter first cut. Classic
    // deck, landReserve (5 Island/5 Swamp), and Darlings surfaces remain
    // unchanged; the reserve divergence is registered in HAND_TUNED_WARCHEST.
    reserveDeck: expand([
      ['dd-tide-clerk', 4],
      ['dd-current-caller', 2],
      ['dd-tide-reader', 2],
      ['dd-harbour-looter', 2],
      ['dd-drowned-bell-choir', 2],
      ['dd-drowned-lighthouse-keeper', 2],
      ['dd-drowned-deacon', 3],
      ['dd-deep-one-hierophant', 3],
      ['dd-father-dagon', 1],
      ['dd-cold-current', 2],
      ['dd-thing-in-the-cistern', 2],
      ['dd-still-water', 2],
      ['dd-the-price', 4],
      ['dd-undertow', 2],
      ['dd-memory-of-the-drowned', 2],
      ['dd-mother-hydra', 1],
      ['dd-drowned-bride', 2],
      ['dd-deep-one-scout', 2],
    ]),
    landReserve: expand([
      ['land-island', 5],
      ['land-swamp', 5],
    ]),
    darlingsDeck: [
      'dd-tide-clerk',
      'dd-current-caller',
      'dd-tide-reader',
      'dd-harbour-looter',
      'dd-drowned-bell-choir',
      'dd-drowned-lighthouse-keeper',
      'dd-drowned-deacon',
      'dd-deep-one-hierophant',
      'dd-drowned-bride',
      'dd-cold-current',
      'dd-still-water',
      'dd-the-price',
      'dd-undertow',
      'dd-memory-of-the-drowned',
      'dd-tide-that-turns',
      'dd-drowned-bell',
      'dd-tide-that-remembers',
      'ac-bitter-court-rumor',
      'ac-courtly-betrayal',
      'ac-grail-glimpse',
      'ac-lantern-in-fog',
      'ac-mirror-of-avalon',
      'ac-quest-marker',
      'ac-wounded-oath',
      'ar-training-dummy',
      'cf-barrow-whisper',
      'cf-bitter-geas',
      'cf-cold-iron-nail',
      'cf-dawn-torc',
      'cf-fogbell-chime',
      'cf-glimmerdust-trick',
      'cf-lake-mirror-vow',
      'cf-ogham-fate-stones',
      'cf-salt-the-barrow',
      'cf-silver-thread',
      'dd-cellar-jar',
      'dd-current-reader',
      'dd-fog-bank',
      'dd-salt-in-the-eyes',
      'dd-tide-glass',
      'dd-tithe-of-the-wharf',
      'dd-undertow-charm',
      'dd-wharf-rat',
      'dt-bookmark-charm',
      'dt-brass-lamp-charm',
      'dt-briar-rose-lullaby',
      'dt-cursed-ball-invite',
      'dt-cursed-rose',
      'dt-dream-prick',
      'dt-ink-black-carriage',
      'dt-laced-too-tight',
      'dt-lullaby-refrain',
      'dt-ragged-ballgown',
      'dt-satin-slipper',
      'dt-sea-glass-knife',
      'dt-silver-fishbone',
      'dt-singing-shell',
      'dt-tower-braid-escape',
      'dt-wicked-step',
      'en-clouded-mind',
      'gm-cellar-door',
      'gm-fogged-window',
      'gm-funeral-bell',
      'in-empty-fort-stratagem',
      'in-grave-chill',
      'in-undertow',
      'rg-rune-of-hunger',
      'rg-rune-of-insight',
      'sb-blue-echo-array',
      'sb-null-orbit-array',
      'ac-court-of-whispers',
      'ac-mirror-lake',
      'cf-mist-road',
      'cf-raven-stone',
      'dt-midnight-road',
      'dt-sea-cave',
      'dt-winter-bridge',
      'gm-lab-annex',
      'sb-deepfield-lands',
    ],
    darlingId: 'dd-father-dagon',
  },

  // ---------------------------------------------------------------------
  // Rung 26 - The Marsh-Mother, Everything Planted Here Comes Up: B/G Tithe Garden.
  {
    id: 'the-marsh-mother',
    name: 'The Marsh-Mother',
    title: 'Everything Planted Here Comes Up',
    blurb: 'She plants Kelp Shades in the spring and Horrors in the autumn, and the Tithe is how she harvests. Two tokens go under for every Horror that comes up, and the last one is bigger than the marsh.',
    theme: 'Black-Green Tithe Garden (Kelp Shade tokens, Tithe, Overrun)',
    tier: 26,
    difficulty: 'hard',
    portraitCardId: 'dd-marsh-mother-horror',
    personality: makePersonality({
      aggression: 1.2,
      holdback: 0.8,
      attackThreshold: 0.3,
      removalBias: 0.6,
      subtypeBias: 0.6,
      preferredSubtypes: ['Horror', 'Plant', 'Deep One'],
    }),
    deck: expand([
      ['land-swamp', 12],
      ['land-forest', 12],
      ['dd-kelp-shade', 3],
      ['dd-kelp-shade-warden', 2],
      ['dd-marsh-wight-lesser', 2],
      ['dd-horror-in-the-crib', 2],
      ['dd-deep-one-bride', 2],
      ['dd-something-under-the-wharf', 2],
      ['dd-reef-horror', 2],
      ['dd-deep-spawn-tender', 1],
      ['dd-coral-mother', 1],
      ['dd-marsh-mother-horror', 3],
      ['dd-salt-marsh-horror', 1],
      ['dd-the-reef-that-walks', 1],
      ['dd-horror-garden', 2],
      ['dd-net-full-of-stars', 2],
      ['dd-kelp-shade-swarm', 2],
      ['dd-reef-bloom', 2],
      ['dd-tithe-to-the-deep', 2],
      ['dd-the-price', 2],
      ['dd-salt-marsh-bargain', 2],
    ]),
    // MEASURED 2026-09-16: frozen V0 KEPT, hard AI, 200 seeds/cell,
    // reserve-native avatar matrix; 74.80% mean (748/1000 decided, 0 draws).
    // Cells in Muster/Communion/Tides/Mandate/Harvest order:
    // 63.50/76.50/66.00/81.50/86.50%.
    // This is the frozen "before" and the final retained list: no authored
    // surgery qualified. Same 1,000 seeded games per variant; means average
    // the five cell rates, excluding draws within each cell. Keep only >3pp
    // above baseline, with no baseline cell down >6pp; a combination must
    // beat the best single by >3pp. Existing rows kept their order; new IDs
    // were appended in authored order. Every trial was restored before the next.
    // 2026-09-16 owner-ruling surgery 1 REJECTED: -4 Reef Bloom, -1
    // Coral-Mother; +2 Marsh-Mother (1 -> 3), +2 Horror in the Well,
    // +1 Marsh Horror.
    // Alone: 67.30% mean (673/1000 decided, 0 draws), -7.50pp from baseline;
    // worst baseline cell decline 12.50pp. Both keep conditions fail.
    // Cells: 58.00/66.00/53.50/74.00/85.00%.
    // 2026-09-16 owner-ruling surgery 2 REJECTED: -2 Salt-Marsh Bargain
    // (4 -> 2); +1 The Reef That Walks, +1 Tidepool Colossus.
    // Alone: 72.80% mean (728/1000 decided, 0 draws), -2.00pp from baseline;
    // worst baseline cell decline 4.00pp. The average fails the >3pp rule;
    // the cell-drop limit passes.
    // Cells: 63.50/77.50/62.50/78.00/82.50%.
    // 2026-09-16 owner-ruling surgery 3 REJECTED: -1 Kelp-Tender
    // (dd-kelp-shade, 3 -> 2), -1 Reed-Wight (dd-marsh-wight-lesser, 2 -> 1);
    // +2 Marsh Brute.
    // Alone: 73.90% mean (739/1000 decided, 0 draws), -0.90pp from baseline;
    // worst baseline cell decline 4.00pp. The average fails the >3pp rule;
    // the cell-drop limit passes.
    // Cells: 63.00/81.00/62.00/78.50/85.00%.
    // 2026-09-16 owner-ruling surgery 4 REJECTED: -2 Net Full of Stars
    // (4 -> 2); +2 Deep One Hierophant.
    // Alone: 73.98% mean (739/999 decided, 1 draw), -0.82pp from baseline;
    // worst baseline cell decline 7.50pp. Both keep conditions fail.
    // Cells: 67.00/79.50/58.50/79.40/85.50%; the draw was in Mandate.
    // 2026-09-16 owner-ruling surgery 5 NOT RUN: 5 Swamp/5 Forest ->
    // 4 Swamp/6 Forest was conditional on M1 or M2 being kept; neither was.
    // No combinations measured: zero singles qualified. No hand-tuned
    // exception earned; reserveDeck and landReserve stay converter-owned.
    // Historical MEASURED 2026-09-15, same harness, before AI phases A and B:
    // 77% (cells 66/78/65/84/91%); 77.9% after phase A, 74.8% after phase B
    // (the Tithe fodder rule; rates 0.5, 1.0 and unlock-only all read 75.4).
    // Generated 2026-09-15 by `npx tsx scripts/avatarReserveDecks.ts --print`.
    reserveDeck: expand([
      ['dd-kelp-shade', 3],
      ['dd-kelp-shade-warden', 2],
      ['dd-marsh-wight-lesser', 2],
      ['dd-horror-in-the-crib', 4],
      ['dd-deep-one-bride', 2],
      ['dd-something-under-the-wharf', 1],
      ['dd-reef-horror', 2],
      ['dd-coral-mother', 1],
      ['dd-marsh-mother-horror', 1],
      ['dd-net-full-of-stars', 4],
      ['dd-kelp-shade-swarm', 2],
      ['dd-reef-bloom', 4],
      ['dd-tithe-to-the-deep', 4],
      ['dd-the-price', 4],
      ['dd-salt-marsh-bargain', 4],
    ]),
    landReserve: expand([
      ['land-swamp', 5],
      ['land-forest', 5],
    ]),
    darlingsDeck: [
      'dd-kelp-shade',
      'dd-kelp-shade-warden',
      'dd-marsh-wight-lesser',
      'dd-horror-in-the-crib',
      'dd-deep-one-bride',
      'dd-something-under-the-wharf',
      'dd-reef-horror',
      'dd-deep-spawn-tender',
      'dd-coral-mother',
      'dd-salt-marsh-horror',
      'dd-the-reef-that-walks',
      'dd-horror-garden',
      'dd-net-full-of-stars',
      'dd-kelp-shade-swarm',
      'dd-reef-bloom',
      'dd-tithe-to-the-deep',
      'dd-the-price',
      'dd-salt-marsh-bargain',
      'ac-bitter-court-rumor',
      'ac-courtly-betrayal',
      'ac-quest-marker',
      'ac-wounded-oath',
      'ar-training-dummy',
      'bk-nekomata-scout',
      'cf-apple-of-emain',
      'cf-barrow-whisper',
      'cf-bitter-geas',
      'cf-cold-iron-nail',
      'cf-dawn-torc',
      'cf-ogham-fate-stones',
      'cf-salt-the-barrow',
      'cf-silver-thread',
      'cf-thorn-sprite',
      'cf-thornsnare',
      'dd-cellar-jar',
      'dd-coral-graft',
      'dd-salt-in-the-eyes',
      'dd-tithe-of-the-wharf',
      'dd-wharf-rat',
      'dt-apple-basket',
      'dt-bookmark-charm',
      'dt-brass-lamp-charm',
      'dt-cursed-ball-invite',
      'dt-cursed-rose',
      'dt-ink-black-carriage',
      'dt-jade-dragon-scale',
      'dt-laced-too-tight',
      'dt-plaid-arrow',
      'dt-ragged-ballgown',
      'dt-rose-vine-snare',
      'dt-satin-slipper',
      'dt-silver-fishbone',
      'dt-wicked-step',
      'gm-cellar-door',
      'gm-funeral-bell',
      'in-grave-chill',
      'in-valley-mist',
      'in-wild-surge',
      'rg-rune-of-hunger',
      'sb-blue-echo-array',
      'sb-null-orbit-array',
      'sb-sky-map',
      'sd-empty-heart-jar',
      'sd-hollow-the-chest',
      'sd-lapis-funerary-mask',
      'sd-pay-before-the-asking',
      'sd-reed-bound-canopic',
      'sd-resin-archive',
      'sd-root-through-the-ruin',
      'sd-second-wrapping',
      'sd-the-debt-is-called',
      'sd-tomb-seal',
      'ac-bramble-chapel',
      'ac-court-of-whispers',
      'cf-mossy-ring',
      'cf-raven-stone',
      'dt-midnight-road',
      'dt-wolf-path',
      'gm-thorned-cemetery',
    ],
    darlingId: 'dd-marsh-mother-horror',
  },
];

/** Look up an avatar by id (throws on unknown — callers pass validated ids). */
export function avatarById(id: string): Avatar {
  const a = AVATARS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown avatar id: ${id}`);
  return a;
}

/** The avatar at a 1-based gauntlet rung (1..26 currently landed). */
export function avatarForRung(rung: number): Avatar {
  const a = AVATARS.find((x) => x.tier === rung);
  if (!a) throw new Error(`No avatar for rung ${rung}`);
  return a;
}
