/** Every ruleset constant lives here — the engine reads only from this file. */

export const RULES = {
  startingLife: 20,
  deckSize: 60,
  maxCopies: 4, // basics unlimited
  startingHandSize: 7,
  maxHandSize: 7,
  // London-mulligan cap: a player may mulligan at most this many times before
  // they must keep (or concede). Bounds the "bottom N cards" pick to N-1 ≤ this,
  // so it can never exceed the 7-card hand — the source of the old soft-lock.
  maxMulligans: 3,
  maxCreatures: 8, // battlefield cap per player
  maxNoncreaturePermanents: 4, // noncreature-nonland cap per player
  maxBlockersPerAttacker: 3,
  turnLimit: 100, // game is a draw at turn 100 (anti-stall)
} as const;

export const ECONOMY = {
  startingGold: 250, // granted with the starter deck — one booster to crack
  packPrice: 450,
  ragnarokPackPrice: 525, // expansion booster — only pulls set:'ragnarok' cards (denser 69-card chase)
  celticFaePackPrice: 525, // expansion booster — only pulls set:'celtic-fae' cards (80-card chase density)
  arthurianCourtPackPrice: 525, // expansion booster — only pulls set:'arthurian-court' cards (80-card chase density)
  boosterPackSize: 9, // collection boosters: every slot rolls tier + frame + holo independently (DROPS)
  limitedPackSize: 15, // Limited packs stay MTG-sized for Sealed/Draft pool depth.
  winGold: { easy: 50, medium: 100, hard: 200 } as const,
  lossGold: 20,
  // Practice loss gold requires a real game: engine turns are per-player
  // (state.turn increments each player-turn), so 6 = each side took 3 turns.
  // Kills the concede-replay 20g farm (user-reported 2026-07-12). Practice
  // only — a gauntlet loss already costs the run.
  minTurnsForLossGold: 6,
  firstWinOfDayBonus: 100,
  dailyQuestCount: 3,
  dailyRerollsPerDay: 3,
  dailyQuestGold: 50,
  // Win-streak bonus paid automatically on the first win of each calendar day.
  // Day 7+ uses the pack-price-sized cap rather than resetting the visible
  // consecutive-day count.
  dailyStreakGold: [25, 40, 55, 70, 85, 100, 125] as const,
  preconPrice: 500,
  // The four starter precons you did NOT pick for free are buyable in the shop's
  // Decks tab (the free-chosen one reads "Owned"). Cheaper than a theme deck —
  // they're the intro lists, a soft catch-up sink rather than a chase product.
  starterDeckPrice: 350,
  // Auto-melt value of a PLAIN duplicate past the per-variant playset (a 5th
  // `white|none` copy). At full completion the expected plain-dupe refund is
  // ≈68g per 450g pack (9 · P(plain)=0.30 · E[dupeGold|tier]=25) — bounded
  // below the pack price, so no infinite-gold loop; endgame packs get cheap
  // deliberately. Special variants never auto-melt; the player sells their
  // beyond-4-per-variant excess by hand (Collection `shardExcess`).
  dupeGold: { c: 5, r: 10, sr: 50, ssr: 150, ur: 500 } as const,
  // Manual shard/sell (CollectionScene): a copy past the per-variant playset
  // shards for dupeGold[tier] × shardFrameMult[frame] × shardHoloMult[holo].
  // Plain (white|none) = ×1 (matches the auto-melt refund); specials pay more,
  // scaling with pull-rarity. Only the common blue/red frames realistically
  // stack past 4 — rarer frames/holos effectively never do.
  shardFrameMult: { white: 1, blue: 1.5, red: 2, gold: 4, rainbow: 8, black: 15 } as const,
  shardHoloMult: { none: 1, shiny: 1.5, rainbow: 2, pearlescent: 3, fractal: 6, void: 12 } as const,
  // Avatar Gauntlet: gold per rung cleared (index 0 = rung 1), plus a bonus for
  // a full 14-rung clear. Full run = 50+70+…+270 (=1920) + 290 + 310 + 250 = 2770g ≈ 11.1 packs,
  // ~40% over practice-grinding — the price of run-risk (a loss resets the run).
  // Rungs 9-10 (210/230) are the Ragnarök bosses; 11-12 (250/270) are the
  // Celtic Fae bosses (The Morrigan, Titania); 13-14 (290/310) are the
  // Arthurian Court summit bosses (Morgan, Artoria).
  gauntletRungGold: [50, 70, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290, 310] as const,
  gauntletCompletionBonus: 250,
  // Free Limited runs are free-entry with ephemeral cards and pay the record
  // payout below. Premium Draft pays to keep its picks; the entry fee already
  // buys the 45 kept cards, so Premium pays no run-end gold.
  premiumDraftEntry: 1000,
  premiumWeeklyCap: 2, // Premium Draft entries per UTC seven-day week.
  limitedRunGold: [40, 100, 180, 300] as const,
  // One plain missing unique costs six times the ordinary dupe refund. This
  // keeps crafting a catch-up sink rather than a craft-then-shard faucet.
  craftCostMult: 6,
} as const;

/*
 * Economy baseline (comments only; constants above are unchanged).
 * Source: balance/econ-baseline-2026-07-15.report.json.
 * Sample: 10 personas x 8 seeds x 60 days, baseline 2026-07-15, pre-tuning.
 * Day-60 aggregate values are seed means; first Premium is the median first
 * day across the eight seed snapshots and is shown only where derivable.
 *
 * Persona              Collection  Packs/day  Premium runs  Quest claim  First Premium
 * New Casual              57.41%       0.56          0          43.33%          -
 * Daily Grinder            80.05%       1.59          0          69.86%          -
 * Gauntlet Climber         77.15%       1.41          0          68.33%          -
 * Limited Fan              96.81%       0.06      35.38          70.07%          3
 * Collector                 71.49%       1.04          0          65.97%          -
 * Theme Deck Buyer          80.27%       0.91          0          60.07%          -
 * Hardcore Optimizer        89.72%       2.41          0          80.83%          -
 * Low Skill Casual          52.47%       0.47          0          40.83%          -
 * High Skill Veteran        85.10%       1.93          0          78.19%          -
 * Completionist             91.44%       2.29          0          88.54%          -
 *
 * Post-tuning baseline 2026-07-16 (same 10 personas x 8 seeds x 60 days,
 * daily snapshots) after the 1.1 tuning pass: premiumWeeklyCap 2, premium
 * run-end gold 0, crafting at craftCostMult 6. The weekly cap binds Limited
 * Fan to 18 premium runs (was 35.38) with collection held by crafting; the
 * craft sink lifts the pack-route completion asymptote (Hardcore Optimizer
 * 89.72% -> 96.63%; finalist sweep at 75d/6 seeds measured completion day 68
 * median). Casuals and packs/day are deliberately untouched.
 *
 * Persona              Collection  Packs/day  Premium runs  Quest claim  Crafted  First Premium
 * New Casual              57.41%       0.56          0          43.33%       0          -
 * Daily Grinder            80.05%       1.59          0          69.86%       0          -
 * Gauntlet Climber         77.15%       1.41          0          68.33%       0          -
 * Limited Fan              97.28%       0.39      18.00          69.93%    37.1          3
 * Collector                 71.49%       1.04          0          65.97%       0          -
 * Theme Deck Buyer          80.27%       0.91          0          60.07%       0          -
 * Hardcore Optimizer        96.63%       1.88          0          80.83%    39.1          -
 * Low Skill Casual          52.47%       0.47          0          40.83%       0          -
 * High Skill Veteran        90.08%       1.87          0          78.19%    19.6          -
 * Completionist             99.43%       1.76          0          88.54%    49.4          -
 *
 * Post-Arthurian-Court baseline 2026-07-16 (same 10 personas x 8 seeds x
 * 60 days; balance/econ-baseline-2026-07-16-post-ac.report.json) after the
 * 1.2 set landed: 429 collectible cards (+80, a 23% larger pool), the
 * 525g arthurian-court booster SKU, rungs 13-14 (full clear 2,770g), and
 * the two AC card-buff rounds. Every persona's 60-day completion drops
 * 5-11pp - the mechanically expected effect of a bigger chase, not an
 * economy change (all four Layer-1 EV gates stay green; verdict label
 * unchanged at 'uneven' on the same quest-claim-spread bullet, which
 * remains its own backlog item). Casuals hold the ~50% target (44.7 /
 * 50.6%). Watch item for a future tuning pass: Hardcore Optimizer 88.3%
 * at day 60 extrapolates full completion slightly past the 50-75-day
 * window that was calibrated against the 349-card pool; whether that
 * window is per-set-era or perpetual is an open design question.
 *
 * Persona              Collection  Packs/day  Premium runs  Quest claim  Crafted
 * New Casual              50.55%       0.56          0          43.33%       0
 * Daily Grinder           73.40%       1.55          0          69.86%       0
 * Gauntlet Climber        70.16%       1.40          0          68.33%       0
 * Limited Fan             92.86%       0.55      18.00          71.74%    29.0
 * Collector               62.41%       1.04          0          65.97%       0
 * Theme Deck Buyer        74.68%       0.92          0          60.07%       0
 * Hardcore Optimizer      88.32%       2.37          0          80.83%    19.1
 * Low Skill Casual        44.67%       0.45          0          40.83%       0
 * High Skill Veteran      79.87%       1.96          0          78.19%       0
 * Completionist           95.19%       2.09          0          89.10%    43.5
 */

/**
 * Multi-axis booster drop tables. Each of a pack's `ECONOMY.boosterPackSize` slots
 * rolls all three axes independently: rarity tier, frame style, holo finish.
 * Weights are percentages — every table sums to exactly 100 — consumed by the
 * cumulative-weight walks in `src/meta/variants.ts` (`rngFloat(rng) * 100`).
 *
 * God-roll arithmetic (asserted in tests/meta/variants.test.ts):
 * P(ur ∧ black ∧ void) = 0.01 · 0.0045 · 0.0045 ≈ 2.03e-7 ≈ 1 in 4.94M
 * (the "1 in 5,000,000" chase card).
 */
export const DROPS = {
  tier: [
    ['c', 50],
    ['r', 30],
    ['sr', 14],
    ['ssr', 5],
    ['ur', 1],
  ],
  frame: [
    ['white', 50],
    ['blue', 30],
    ['red', 15],
    ['gold', 3.55],
    ['rainbow', 1],
    ['black', 0.45],
  ],
  holo: [
    ['none', 60],
    ['shiny', 20],
    ['rainbow', 10],
    ['pearlescent', 8],
    ['fractal', 1.55],
    ['void', 0.45],
  ],
} as const;
