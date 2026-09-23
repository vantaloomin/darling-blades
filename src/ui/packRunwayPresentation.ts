import { TIER_RANK, variantRank } from '../meta/variants';
import type { FrameStyle, HoloFinish } from '../meta/variants';
import type { AnimationLevel } from '../platform/animPolicy';
import { theme } from './theme';

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

// ---------------------------------------------------------------------------
// Single-pack reveal layout
// ---------------------------------------------------------------------------

/**
 * A single pack reveals in two groups: the Common/Rare grid, then the SR+
 * specials, which wait face down one size larger. The July constants stacked
 * two grid rows over a fixed specials row, so on a 9-card pack with 7+ grid
 * cards the specials row covered row two's rules text. This fitter owns the
 * geometry instead: every split of a pack gets rows that never overlap and stay
 * inside the title-safe frame, between the header row and the CTA rail.
 */

/** Base scales; the fitter only ever shrinks them, never grows them. */
export const PACK_REVEAL_GRID_SCALE = 0.46;
export const PACK_REVEAL_SPECIAL_SCALE = 0.54;
/** Inactive space between neighbours in a row; specials' hint rings bleed ~7 px each. */
export const PACK_REVEAL_GRID_GAP = 14;
export const PACK_REVEAL_SPECIAL_GAP = 24;
/** Between two rows of one group, and between the grid and the specials. */
export const PACK_REVEAL_ROW_GAP = 16;
export const PACK_REVEAL_GROUP_GAP = 24;

/** The reveal's CTA rail (Open Another · Shop · Menu) sits on the title-safe footer line. */
export const PACK_BUTTON_Y = theme.design.footerCenterY;
export const PACK_BUTTON_PANEL = { width: 720, height: 72 } as const;

/**
 * Where revealed cards may sit: the title-safe frame, below the header row
 * (back link on the left, Skip on the right) and clear of the CTA rail's panel.
 */
export const PACK_REVEAL_BOUNDS = {
  left: theme.design.safeLeft,
  right: theme.design.safeRight,
  top: theme.design.safeTop + theme.control.minHitHeight + theme.space(2),
  bottom: PACK_BUTTON_Y - PACK_BUTTON_PANEL.height / 2 - theme.space(3),
} as const;

export interface PackRevealSlot {
  x: number;
  y: number;
  scale: number;
}

export interface PackRevealLayout {
  grid: PackRevealSlot[];
  specials: PackRevealSlot[];
}

/** `count` cards in at most `rows` rows, fullest first (9 in 2 = [5, 4]). */
function rowLengths(count: number, rows: number): number[] {
  const perRow = Math.ceil(count / Math.max(1, rows));
  const lengths: number[] = [];
  for (let left = count; left > 0; left -= perRow) lengths.push(Math.min(perRow, left));
  return lengths;
}

interface RevealGroup {
  rows: number[];
  width: number;
  height: number;
  gap: number;
}

/** Largest shrink factor (at most 1) that fits both groups' rows inside the bounds. */
function fitFactor(grid: RevealGroup, specials: RevealGroup): number {
  const width = PACK_REVEAL_BOUNDS.right - PACK_REVEAL_BOUNDS.left;
  const height = PACK_REVEAL_BOUNDS.bottom - PACK_REVEAL_BOUNDS.top;
  let factor = 1;
  for (const group of [grid, specials]) {
    for (const n of group.rows) {
      factor = Math.min(factor, (width - (n - 1) * group.gap) / (n * group.width));
    }
  }
  const rowCount = grid.rows.length + specials.rows.length;
  const fixed =
    Math.max(0, grid.rows.length - 1) * PACK_REVEAL_ROW_GAP +
    Math.max(0, specials.rows.length - 1) * PACK_REVEAL_ROW_GAP +
    (grid.rows.length > 0 && specials.rows.length > 0 ? PACK_REVEAL_GROUP_GAP : 0);
  const stacked = grid.rows.length * grid.height + specials.rows.length * specials.height;
  if (rowCount > 0) factor = Math.min(factor, (height - fixed) / stacked);
  return factor;
}

/**
 * Slots for a single pack's reveal: `gridCount` Common/Rare cards over
 * `specialCount` SR+ cards. Each group may take one or two rows; the split
 * that keeps the cards largest wins (ties go to fewer rows), both groups
 * shrink by the same factor so the specials stay the larger size, and the
 * stack is centred in the bounds with each row centred on the frame.
 */
export function packRevealLayout(gridCount: number, specialCount: number): PackRevealLayout {
  const g = Math.max(0, Math.trunc(gridCount));
  const s = Math.max(0, Math.trunc(specialCount));
  const cardW = RUNWAY_CARD_DESIGN_WIDTH;
  const cardH = RUNWAY_CARD_DESIGN_HEIGHT;
  const group = (count: number, rows: number, scale: number, gap: number): RevealGroup => ({
    rows: count > 0 ? rowLengths(count, rows) : [],
    width: cardW * scale,
    height: cardH * scale,
    gap,
  });
  let best: { grid: RevealGroup; specials: RevealGroup; factor: number } | null = null;
  for (const gridRows of [1, 2]) {
    for (const specialRows of [1, 2]) {
      const grid = group(g, gridRows, PACK_REVEAL_GRID_SCALE, PACK_REVEAL_GRID_GAP);
      const specials = group(s, specialRows, PACK_REVEAL_SPECIAL_SCALE, PACK_REVEAL_SPECIAL_GAP);
      const factor = fitFactor(grid, specials);
      const rows = grid.rows.length + specials.rows.length;
      const bestRows = best ? best.grid.rows.length + best.specials.rows.length : Infinity;
      if (!best || factor > best.factor + 1e-9 || (Math.abs(factor - best.factor) <= 1e-9 && rows < bestRows)) {
        best = { grid, specials, factor };
      }
    }
  }
  const { grid, specials, factor } = best!;
  const centerX = (PACK_REVEAL_BOUNDS.left + PACK_REVEAL_BOUNDS.right) / 2;
  const stackHeight =
    grid.rows.length * grid.height * factor +
    specials.rows.length * specials.height * factor +
    Math.max(0, grid.rows.length - 1) * PACK_REVEAL_ROW_GAP +
    Math.max(0, specials.rows.length - 1) * PACK_REVEAL_ROW_GAP +
    (grid.rows.length > 0 && specials.rows.length > 0 ? PACK_REVEAL_GROUP_GAP : 0);
  let top = PACK_REVEAL_BOUNDS.top + (PACK_REVEAL_BOUNDS.bottom - PACK_REVEAL_BOUNDS.top - stackHeight) / 2;
  const place = (target: RevealGroup, scale: number): PackRevealSlot[] => {
    const slots: PackRevealSlot[] = [];
    const cardWidth = target.width * factor;
    const cardHeight = target.height * factor;
    target.rows.forEach((n, row) => {
      if (row > 0) top += PACK_REVEAL_ROW_GAP;
      const pitch = cardWidth + target.gap;
      const y = top + cardHeight / 2;
      for (let i = 0; i < n; i++) {
        slots.push({ x: centerX - ((n - 1) * pitch) / 2 + i * pitch, y, scale: scale * factor });
      }
      top += cardHeight;
    });
    return slots;
  };
  const gridSlots = place(grid, PACK_REVEAL_GRID_SCALE);
  if (grid.rows.length > 0 && specials.rows.length > 0) top += PACK_REVEAL_GROUP_GAP;
  const specialSlots = place(specials, PACK_REVEAL_SPECIAL_SCALE);
  return { grid: gridSlots, specials: specialSlots };
}
