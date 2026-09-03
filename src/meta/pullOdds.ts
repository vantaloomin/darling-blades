import { DROPS } from '../config/rules';
import type { Rarity } from '../engine/types';
import type { FrameStyle, HoloFinish } from './variants';

/** Weight of one outcome as a fraction of its table's total weight. */
function weightOdds(table: readonly (readonly [string, number])[], value: string): number {
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  const weight = table.find(([key]) => key === value)?.[1];
  if (weight === undefined) throw new Error(`Unknown drop-table value: ${value}`);
  return weight / total;
}

/**
 * Probability of an exact booster-slot pull. Tier, frame, holo, and Full Art
 * are independent rolls, so their runtime-derived table probabilities multiply.
 */
export function variantOdds(tier: Rarity, frame: FrameStyle, holo: HoloFinish, fullArt: boolean): number {
  return (
    weightOdds(DROPS.tier, tier) *
    weightOdds(DROPS.frame, frame) *
    weightOdds(DROPS.holo, holo) *
    weightOdds(DROPS.fullArt, fullArt ? 'full-art' : 'standard')
  );
}

/**
 * Finish-only pull odds (frame x holo x full-art), excluding the tier roll:
 * "how rare is THIS treatment of a card you already pulled" — the Collection
 * inspect panel's per-variant disclosure.
 */
export function finishOdds(frame: FrameStyle, holo: HoloFinish, fullArt: boolean): number {
  return (
    weightOdds(DROPS.frame, frame) *
    weightOdds(DROPS.holo, holo) *
    weightOdds(DROPS.fullArt, fullArt ? 'full-art' : 'standard')
  );
}

function roundToSignificantFigures(value: number, digits: number): number {
  const magnitude = 10 ** (digits - 1 - Math.floor(Math.log10(value)));
  return Math.round(value * magnitude) / magnitude;
}

/**
 * The exact-odds headline: the reciprocal itself, not a rounded magnitude.
 *
 * `formatOdds` keeps three significant figures, which reads as "1:1980.00M" for
 * the UR black void Full Art roll. Those trailing zeros claimed a precision the
 * rounding had already discarded, and inverting the percentage printed beside it
 * gave a different number again (user report 2026-09-03). The plate prints the
 * whole number instead. Reciprocals under 100 keep one decimal, where the
 * fraction is a real part of the answer: a plain common is 1 in 6.7, not 1 in 7.
 */
export function formatExactOdds(probability: number): string {
  const oneIn = 1 / probability;
  const value = oneIn < 100 ? Number(oneIn.toFixed(1)) : Math.round(oneIn);
  return `1 in ${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
}

/** Formats a probability as a player-facing one-in-N pull odds string. */
export function formatOdds(probability: number): string {
  const oneIn = 1 / probability;
  const rounded = roundToSignificantFigures(oneIn, 3);

  if (oneIn >= 1_000_000) return `1:${(rounded / 1_000_000).toFixed(2)}M`;
  if (oneIn < 100) return `1:${Number(rounded.toFixed(1))}`;
  return `1:${rounded.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
