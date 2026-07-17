import { DROPS, ECONOMY } from '../config/rules';
import { rngFloat, type RngState } from '../engine/rng';
import type { Rarity } from '../engine/types';

/**
 * Card variants — the collectible axes a booster slot rolls on top of the
 * card itself. Pure and headless: plain data + seeded rolls, no Phaser.
 *
 * A variant is a (frame, holo, full-art) tuple. `white|none|standard` is the
 * PLAIN variant every pre-v4 save's copies migrate to; anything else is
 * "special" and is always kept by the collection (see the melt rule there).
 */

export type FrameStyle = 'white' | 'blue' | 'red' | 'gold' | 'rainbow' | 'black';
export type HoloFinish = 'none' | 'shiny' | 'rainbow' | 'pearlescent' | 'fractal' | 'void';

export interface CardVariant {
  frame: FrameStyle;
  holo: HoloFinish;
  fullArt: boolean;
}

export const PLAIN_VARIANT: CardVariant = { frame: 'white', holo: 'none', fullArt: false };

/** Canonical storage key: `${frame}|${holo}|${standardOrFullArt}`. */
export function variantKey(v: CardVariant): string {
  return `${v.frame}|${v.holo}|${v.fullArt ? 'full-art' : 'standard'}`;
}

export function parseVariantKey(key: string): CardVariant {
  const [frame, holo, treatment] = key.split('|');
  return {
    frame: frame as FrameStyle,
    holo: holo as HoloFinish,
    fullArt: treatment === 'full-art',
  };
}

export function isPlainVariant(v: CardVariant): boolean {
  return v.frame === PLAIN_VARIANT.frame && v.holo === PLAIN_VARIANT.holo && !v.fullArt;
}

/** Rarity-tier rank, higher = better (ur best). Best-first sort: ur < ssr < sr < r < c. */
export const TIER_RANK: Record<Rarity, number> = { c: 0, r: 1, sr: 2, ssr: 3, ur: 4 };

/** Display labels for the tiers (C / R / SR / SSR / UR). */
export const TIER_LABEL: Record<Rarity, string> = {
  c: 'C',
  r: 'R',
  sr: 'SR',
  ssr: 'SSR',
  ur: 'UR',
};

const FRAME_RANK: Record<FrameStyle, number> = {
  white: 0,
  blue: 1,
  red: 2,
  gold: 3,
  rainbow: 4,
  black: 5,
};

const HOLO_RANK: Record<HoloFinish, number> = {
  none: 0,
  shiny: 1,
  rainbow: 2,
  pearlescent: 3,
  fractal: 4,
  void: 5,
};

/**
 * Specialness ranking, higher = more special. Full Art is the primary band,
 * above every non-full-art treatment (including black frame). Within a band,
 * frame is primary and holo breaks ties. `variantRank(PLAIN_VARIANT)` is 0.
 */
export function variantRank(v: CardVariant): number {
  return (v.fullArt ? 64 : 0) + FRAME_RANK[v.frame] * 8 + HOLO_RANK[v.holo];
}

/**
 * Gold paid for manually sharding one copy of a `(tier, variant)`: the plain
 * dupe value scaled by the variant's frame, holo, and Full Art multipliers.
 * A plain copy shards for exactly `dupeGold[tier]`; specials pay more.
 */
export function shardValue(tier: Rarity, v: CardVariant): number {
  return Math.round(
    ECONOMY.dupeGold[tier] *
      ECONOMY.shardFrameMult[v.frame] *
      ECONOMY.shardHoloMult[v.holo] *
      (v.fullArt ? ECONOMY.shardFullArtMult : 1),
  );
}

/**
 * Cumulative-weight walk over a DROPS table: one `rngFloat(rng) * 100` roll,
 * walked against the running weight sum (each table sums to exactly 100).
 */
function walk<T extends string>(rng: RngState, table: readonly (readonly [T, number])[]): T {
  const roll = rngFloat(rng) * 100;
  let acc = 0;
  for (const [value, weight] of table) {
    acc += weight;
    if (roll < acc) return value;
  }
  return table[table.length - 1][0]; // fp-dust guard; unreachable in practice
}

export function rollTier(rng: RngState): Rarity {
  return walk(rng, DROPS.tier);
}

export function rollFrame(rng: RngState): FrameStyle {
  return walk(rng, DROPS.frame);
}

export function rollHolo(rng: RngState): HoloFinish {
  return walk(rng, DROPS.holo);
}

export function rollFullArt(rng: RngState): boolean {
  return walk(rng, DROPS.fullArt) === 'full-art';
}
