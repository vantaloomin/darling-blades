import { DROPS, ECONOMY } from '../config/rules';
import { rngFloat, type RngState } from '../engine/rng';
import type { Rarity } from '../engine/types';

/**
 * Card variants — the collectible axes a booster slot rolls on top of the
 * card itself. Pure and headless: plain data + seeded rolls, no Phaser.
 *
 * A variant is a (frame, holo) pair. `white|none` is the PLAIN variant every
 * pre-v4 save's copies migrate to; anything else is "special" and is always
 * kept by the collection (see `src/meta/Collection.ts` melt rule).
 */

export type FrameStyle = 'white' | 'blue' | 'red' | 'gold' | 'rainbow' | 'black';
export type HoloFinish = 'none' | 'shiny' | 'rainbow' | 'pearlescent' | 'fractal' | 'void';

export interface CardVariant {
  frame: FrameStyle;
  holo: HoloFinish;
}

export const PLAIN_VARIANT: CardVariant = { frame: 'white', holo: 'none' };

/** Canonical storage key for a variant: `${frame}|${holo}`. */
export function variantKey(v: CardVariant): string {
  return `${v.frame}|${v.holo}`;
}

export function parseVariantKey(key: string): CardVariant {
  const [frame, holo] = key.split('|');
  return { frame: frame as FrameStyle, holo: holo as HoloFinish };
}

export function isPlainVariant(v: CardVariant): boolean {
  return v.frame === PLAIN_VARIANT.frame && v.holo === PLAIN_VARIANT.holo;
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
 * Specialness ranking, higher = more special. The frame is the primary axis
 * (drop-rarity order white → black), the holo finish breaks ties (none →
 * void). So any black-frame variant outranks any rainbow-frame one, and
 * `white|void` outranks `white|fractal`. `variantRank(PLAIN_VARIANT)` is 0.
 * Used for "best owned variant" (Collection) and within-tier reveal order.
 */
export function variantRank(v: CardVariant): number {
  return FRAME_RANK[v.frame] * 8 + HOLO_RANK[v.holo];
}

/**
 * Gold paid for manually sharding one copy of a `(tier, variant)`: the plain
 * dupe value scaled up by the variant's frame + holo rarity (see ECONOMY).
 * A plain copy shards for exactly `dupeGold[tier]`; specials pay more.
 */
export function shardValue(tier: Rarity, v: CardVariant): number {
  return Math.round(ECONOMY.dupeGold[tier] * ECONOMY.shardFrameMult[v.frame] * ECONOMY.shardHoloMult[v.holo]);
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
