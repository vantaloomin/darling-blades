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

function roundToSignificantFigures(value: number, digits: number): number {
  const magnitude = 10 ** (digits - 1 - Math.floor(Math.log10(value)));
  return Math.round(value * magnitude) / magnitude;
}

/** Formats a probability as a player-facing one-in-N pull odds string. */
export function formatOdds(probability: number): string {
  const oneIn = 1 / probability;
  const rounded = roundToSignificantFigures(oneIn, 3);

  if (oneIn >= 1_000_000) return `1:${(rounded / 1_000_000).toFixed(2)}M`;
  if (oneIn < 100) return `1:${Number(rounded.toFixed(1))}`;
  return `1:${rounded.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
