/** Every ruleset constant lives here — the engine reads only from this file. */

export const RULES = {
  startingLife: 20,
  deckSize: 60,
  maxCopies: 4, // basics unlimited
  startingHandSize: 7,
  maxHandSize: 7,
  maxCreatures: 8, // battlefield cap per player
  maxNoncreaturePermanents: 4, // noncreature-nonland cap per player
  maxBlockersPerAttacker: 3,
  turnLimit: 100, // game is a draw at turn 100 (anti-stall)
} as const;

export const ECONOMY = {
  startingGold: 250, // granted with the starter deck — one booster to crack
  packPrice: 250,
  packSize: 15, // every slot rolls tier + frame + holo independently (DROPS)
  winGold: { easy: 50, medium: 100, hard: 200 } as const,
  lossGold: 20,
  firstWinOfDayBonus: 100,
  preconPrice: 500,
  // Auto-melt value of a PLAIN duplicate past the per-variant playset (a 5th
  // `white|none` copy). At full completion the expected plain-dupe refund is
  // ≈214g per 250g pack (15 · P(plain)=0.30 · E[dupeGold|tier]=47.5) — bounded
  // below the pack price, so no infinite-gold loop; endgame packs get cheap
  // deliberately. Special variants never auto-melt; the player sells their
  // beyond-4-per-variant excess by hand (Collection `shardExcess`).
  dupeGold: { c: 5, r: 20, sr: 100, ssr: 300, ur: 1000 } as const,
  // Manual shard/sell (CollectionScene): a copy past the per-variant playset
  // shards for dupeGold[tier] × shardFrameMult[frame] × shardHoloMult[holo].
  // Plain (white|none) = ×1 (matches the auto-melt refund); specials pay more,
  // scaling with pull-rarity. Only the common blue/red frames realistically
  // stack past 4 — rarer frames/holos effectively never do.
  shardFrameMult: { white: 1, blue: 1.5, red: 2, gold: 4, rainbow: 8, black: 15 } as const,
  shardHoloMult: { none: 1, shiny: 1.5, rainbow: 2, pearlescent: 3, fractal: 6, void: 12 } as const,
  // Avatar Gauntlet: gold per rung cleared (index 0 = rung 1), plus a bonus for
  // a full 8-rung clear. Full run = 50+70+…+190 (=960) + 250 = 1210g ≈ 4.8 packs,
  // ~40% over practice-grinding — the price of run-risk (a loss resets the run).
  gauntletRungGold: [50, 70, 90, 110, 130, 150, 170, 190] as const,
  gauntletCompletionBonus: 250,
} as const;

/**
 * Multi-axis booster drop tables. Each of a pack's `ECONOMY.packSize` slots
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
