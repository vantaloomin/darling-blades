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
  boosterPackSize: 9, // collection boosters: every slot rolls tier + frame + holo independently (DROPS)
  limitedPackSize: 15, // Limited packs stay MTG-sized for Sealed/Draft pool depth.
  winGold: { easy: 50, medium: 100, hard: 200 } as const,
  lossGold: 20,
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
  // a full 10-rung clear. Full run = 50+70+…+230 (=1400) + 250 = 1650g ≈ 6.6 packs,
  // ~40% over practice-grinding — the price of run-risk (a loss resets the run).
  // Rungs 9-10 (210/230) are the Ragnarök expansion bosses (Hel, Brunhild).
  gauntletRungGold: [50, 70, 90, 110, 130, 150, 170, 190, 210, 230] as const,
  gauntletCompletionBonus: 250,
  // Limited runs are free-entry and cards are ephemeral, so the run-end payout
  // is intentionally modest: enough to make 3 matches feel worthwhile without
  // outpacing constructed practice or tower risk/reward.
  limitedRunGold: [40, 100, 180, 300] as const,
} as const;

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
