import { DROPS } from '../config/rules';
import type { Rarity } from '../engine/types';
import { formatExactOdds, variantOdds } from '../meta/pullOdds';
import { TIER_LABEL, type CardVariant } from '../meta/variants';
import type { AnimationLevel } from '../platform/animPolicy';
import { theme } from './theme';

export interface CardAtelierPointer {
  /** Card-relative position, where each face edge is -1 or 1. */
  x: number;
  y: number;
  inside: boolean;
}

export interface CardAtelierTiltPose {
  angleDeg: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  lightOffsetX: number;
  lightOffsetY: number;
}

export interface CardAtelierProbabilityAxis {
  label: string;
  probability: number;
  percentText: string;
}

export interface CardAtelierProbabilityPlate {
  probability: number;
  oddsText: string;
  percentText: string;
  axes: readonly CardAtelierProbabilityAxis[];
  axisText: string;
}

const NEUTRAL_TILT: CardAtelierTiltPose = {
  angleDeg: 0,
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
  lightOffsetX: 0,
  lightOffsetY: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Subtle perspective cue for the live CardView. Reduced motion, animations
 * off, touch, and pointers outside the card all keep the readable face flat.
 */
export function cardAtelierTiltPose(
  pointer: CardAtelierPointer,
  animations: AnimationLevel,
  touch: boolean,
): CardAtelierTiltPose {
  if (animations !== 'full' || touch || !pointer.inside) return NEUTRAL_TILT;
  const x = clamp(pointer.x, -1, 1);
  const y = clamp(pointer.y, -1, 1);
  return {
    angleDeg: x * 2.4,
    scaleX: 1 - Math.abs(x) * 0.018,
    scaleY: 1 - Math.abs(y) * 0.014,
    offsetX: x * 4,
    offsetY: y * 3,
    lightOffsetX: x * 18,
    lightOffsetY: y * 12,
  };
}

/** Horizontal card position to left-side comparison coverage. */
export function cardAtelierWipeFromPointer(normalizedX: number): number {
  return clamp((normalizedX + 1) / 2, 0, 1);
}

/** Cubic ease-out progression shared by every programmatic compare reveal. */
export function cardAtelierWipeProgress(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0) return clamp(to, 0, 1);
  const t = clamp(elapsedMs / durationMs, 0, 1);
  const eased = 1 - (1 - t) ** 3;
  return clamp(from + (to - from) * eased, 0, 1);
}

/** Reduced and off switch the comparison state instantly, without a moving mask. */
export function cardAtelierWipeDuration(animations: AnimationLevel): number {
  return animations === 'full' ? theme.motion.base : 0;
}

function tableProbability(
  table: readonly (readonly [string, number])[],
  value: string,
): number {
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  const weight = table.find(([candidate]) => candidate === value)?.[1];
  if (weight === undefined) throw new Error(`Unknown drop-table value: ${value}`);
  return weight / total;
}

function trimFixed(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/u, '');
}

/** Player-facing percentage with enough precision to keep chase pulls honest. */
export function formatCardAtelierPercent(probability: number): string {
  const percent = Math.max(0, probability) * 100;
  if (percent === 0) return '0%';
  let text: string;
  if (percent >= 1) {
    text = trimFixed(percent, 2);
  } else {
    const leadingZeros = Math.max(0, Math.ceil(-Math.log10(percent)));
    text = trimFixed(percent, Math.min(8, leadingZeros + 3));
  }
  // Two decimals above 1%, and an 8-decimal cap below it, both drop digits the
  // probability actually carries: the rarest plate prints 0.00000005% for a true
  // 0.000000050625%. Say so with a tilde instead of asserting the rounded value.
  // The tolerance absorbs binary-float noise so exact table rates (1%, 0.45%)
  // stay unmarked.
  const approximate = Math.abs(Number(text) - percent) > percent * 1e-12;
  return `${approximate ? '~' : ''}${text}%`;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Exact rarity + treatment probability for one booster slot. All four axis
 * values are looked up from DROPS at call time; no economy number is repeated.
 */
export function cardAtelierProbabilityPlate(
  tier: Rarity,
  variant: CardVariant,
): CardAtelierProbabilityPlate {
  const treatment = variant.fullArt ? 'full-art' : 'standard';
  const axes: readonly CardAtelierProbabilityAxis[] = [
    {
      label: TIER_LABEL[tier],
      probability: tableProbability(DROPS.tier, tier),
      percentText: formatCardAtelierPercent(tableProbability(DROPS.tier, tier)),
    },
    {
      label: `${titleCase(variant.frame)} frame`,
      probability: tableProbability(DROPS.frame, variant.frame),
      percentText: formatCardAtelierPercent(tableProbability(DROPS.frame, variant.frame)),
    },
    {
      label: variant.holo === 'none' ? 'No holo' : `${titleCase(variant.holo)} holo`,
      probability: tableProbability(DROPS.holo, variant.holo),
      percentText: formatCardAtelierPercent(tableProbability(DROPS.holo, variant.holo)),
    },
    {
      label: variant.fullArt ? 'Full Art' : 'Standard art',
      probability: tableProbability(DROPS.fullArt, treatment),
      percentText: formatCardAtelierPercent(tableProbability(DROPS.fullArt, treatment)),
    },
  ];
  const probability = variantOdds(tier, variant.frame, variant.holo, variant.fullArt);
  return {
    probability,
    oddsText: formatExactOdds(probability),
    percentText: formatCardAtelierPercent(probability),
    axes,
    axisText: axes.map((axis) => `${axis.label} ${axis.percentText}`).join(' × '),
  };
}
