import { TIER_RANK, variantRank } from '../meta/variants';
import type { FrameStyle, HoloFinish } from '../meta/variants';
import type { AnimationLevel } from '../platform/animPolicy';

/**
 * Pack Runway (Premium UX Wave C): a multi-pack open becomes ONE masked rail
 * of every pull in ascending rarity, moving through a fixed reveal gate
 * right-of-center. The rail moves, the gate does not. Everything measurable
 * about the ride lives here; the scene only renders.
 */

export type RunwayTier = keyof typeof TIER_RANK;

export interface RunwayCardLite {
  tier: RunwayTier;
  frame: FrameStyle;
  holo: HoloFinish;
  fullArt: boolean;
}

/** Reveal gate x: right-of-center so revealed cards read left, arrivals right. */
export const RUNWAY_GATE_X = 800;
/** Card center pitch along the rail. */
export const RUNWAY_PITCH = 190;
export const RUNWAY_CARD_SCALE = 0.6;
export const RUNWAY_CARD_DESIGN_WIDTH = 300;
export const RUNWAY_CARD_DESIGN_HEIGHT = 420;
export const RUNWAY_CARD_Y = 384;
export const RUNWAY_CARD_HALF_HEIGHT = RUNWAY_CARD_DESIGN_HEIGHT * RUNWAY_CARD_SCALE / 2;
export const RUNWAY_VIRTUAL_MARGIN = 280;
export const RUNWAY_MINIMAP = { x: 340, y: 140, width: 600 } as const;
export const RUNWAY_SKIP = { x: 1008, y: 144 } as const;
/** Idle this long after a scrub and the Resume Reveal chip offers the wheel back. */
export const RUNWAY_RESUME_DELAY_MS = 1300;
/** Grouped flip audio: at most one flip sound per this window. */
export const RUNWAY_FLIP_SFX_MIN_GAP_MS = 70;
/** Scrub inertia: capped throw, exponential decay, rest below the floor. */
export const RUNWAY_INERTIA = { maxSpeed: 2400, decayPerSecond: 3.4, restSpeed: 40 } as const;

/**
 * The whole batch in one ascending-rarity ride: tier rank first, then variant
 * rank inside a tier, so a rainbow secret closes its tier run instead of
 * sitting wherever its pack happened to land in the batch (owner finding
 * 2026-08-18 - PackOpener already ordered each pack this way, but the global
 * re-sort dropped the variant key and stable sort kept PACK order in-tier).
 * Stable beyond that, so equal pulls keep their roll order.
 */
export function runwayOrder<T extends RunwayCardLite>(cards: readonly T[]): T[] {
  return [...cards].sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      variantRank({ frame: a.frame, holo: a.holo, fullArt: a.fullArt }) -
        variantRank({ frame: b.frame, holo: b.holo, fullArt: b.fullArt }),
  );
}

/** Rail offset that parks card `index` exactly on the gate. */
export function railOffsetForIndex(index: number): number {
  return RUNWAY_GATE_X - index * RUNWAY_PITCH;
}

/** A card's screen x for the current rail offset. */
export function cardRailX(index: number, offset: number): number {
  return offset + index * RUNWAY_PITCH;
}

/** The highest card index at or left of the gate (-1 = none arrived yet). */
export function indexAtGate(offset: number, total: number): number {
  const raw = Math.floor((RUNWAY_GATE_X - offset) / RUNWAY_PITCH + 1e-6);
  return Math.max(-1, Math.min(total - 1, raw));
}

/** Scrub bounds: card 0 on the gate through the last card on the gate. */
export function clampRailOffset(offset: number, total: number): number {
  const min = railOffsetForIndex(Math.max(0, total - 1));
  const max = railOffsetForIndex(0);
  return Math.max(min, Math.min(max, offset));
}

/**
 * Per-card dwell at the gate. Commons open on an accelerando (each one a
 * touch quicker), then the ride ritardandos into the specials; UR's dwell is
 * the arrival only — the full stop is the scene's spotlight. Reduced motion
 * halves everything.
 */
export function cardDwellMs(
  tier: RunwayTier,
  indexInTierRun: number,
  level: Exclude<AnimationLevel, 'off'>,
): number {
  const full = ((): number => {
    switch (tier) {
      case 'c':
        return Math.max(120, 300 - indexInTierRun * 30);
      case 'r':
        return 320;
      case 'sr':
        return 700;
      case 'ssr':
        return 1000;
      case 'ur':
        return 1200;
    }
  })();
  return level === 'reduced' ? Math.max(80, Math.round(full / 2)) : full;
}

/** One inertia frame: cap the throw, decay it, and rest below the floor. */
export function inertiaStep(velocity: number, dtMs: number): number {
  const capped = Math.max(-RUNWAY_INERTIA.maxSpeed, Math.min(RUNWAY_INERTIA.maxSpeed, velocity));
  const decayed = capped * Math.exp((-RUNWAY_INERTIA.decayPerSecond * Math.min(dtMs, 100)) / 1000);
  return Math.abs(decayed) < RUNWAY_INERTIA.restSpeed ? 0 : decayed;
}

/** Indices worth materializing: on screen plus a margin each side. */
export function virtualRange(
  offset: number,
  total: number,
  margin = RUNWAY_VIRTUAL_MARGIN,
): { first: number; last: number } {
  const first = Math.max(0, Math.ceil((-margin - offset) / RUNWAY_PITCH));
  const last = Math.min(total - 1, Math.floor((1280 + margin - offset) / RUNWAY_PITCH));
  return { first, last };
}

export interface MinimapSegment {
  tier: RunwayTier;
  /** Fractions of the whole ride, 0..1. */
  from: number;
  to: number;
}

/** Contiguous tier runs as ribbon segments (cards must already be in runway order). */
export function minimapSegments(cards: readonly RunwayCardLite[]): MinimapSegment[] {
  if (cards.length === 0) return [];
  const segments: MinimapSegment[] = [];
  let runTier = cards[0].tier;
  let runStart = 0;
  for (let i = 1; i <= cards.length; i++) {
    if (i === cards.length || cards[i].tier !== runTier) {
      segments.push({ tier: runTier, from: runStart / cards.length, to: i / cards.length });
      if (i < cards.length) {
        runTier = cards[i].tier;
        runStart = i;
      }
    }
  }
  return segments;
}

/** Needle position for the minimap, 0..1 over the ride. */
export function gateProgress(revealedMax: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (revealedMax + 1) / total));
}

/** Deterministic per-card flip pitch so rapid runs read as a riffle, not a stuck note. */
export function flipPitchJitter(index: number): number {
  return 0.95 + ((index * 7) % 5) * 0.03;
}
