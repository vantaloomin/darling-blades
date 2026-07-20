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
 * Gauntlet ordering is by `tier` (1..16, unique). Difficulty follows the plan:
 * tiers 1-3 Easy, 4-6 Medium, 7-16 Hard (9-10 are the Ragnarök bosses,
 * 11-12 are the Celtic Fae bosses, 13-14 are the Arthurian Court pair, and
 * 15-16 are the Gothic Monsters summit pair).
 */
export interface Avatar {
  id: string;
  name: string;
  title: string;
  blurb: string;
  theme: string;
  tier: number; // 1..16 (unique)
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
      ['gm-black-veil-matron', 4],
      ['gm-batcloak-cutthroat', 4],
      ['in-doom-bolt', 4],
      ['in-undertow', 4],
      ['gm-stormtower-resurrection', 4],
    ]),
  },
];

/** Look up an avatar by id (throws on unknown — callers pass validated ids). */
export function avatarById(id: string): Avatar {
  const a = AVATARS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown avatar id: ${id}`);
  return a;
}

/** The avatar at a 1-based gauntlet rung (1..16). */
export function avatarForRung(rung: number): Avatar {
  const a = AVATARS.find((x) => x.tier === rung);
  if (!a) throw new Error(`No avatar for rung ${rung}`);
  return a;
}
