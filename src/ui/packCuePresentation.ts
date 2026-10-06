import type { Rarity } from '../engine/types';
import { TIER_LABEL } from '../meta/variants';
import { RUNWAY_CARD_DESIGN_HEIGHT, type MinimapSegment } from './packRunwayPresentation';
import { theme } from './theme';

/**
 * Pack Opening's rarity cues as data (accessibility wave 5 QC, gate 2): the
 * face-down SR/SSR/UR glow, the runway minimap's tier segments and a revealed
 * card's corner marker each carried their meaning in colour alone. Under
 * Chromium's protanopia and deuteranopia emulation the SR and UR glows matched;
 * under achromatopsia the minimap's R, SR and SSR segments, all three glows and
 * the two corner markers did (plan-accessibility-i18n.md, "Wave 5 QC"). The
 * cue policy asks for a non-colour channel on each, and this module names it:
 * - a face-down special wears its tier abbreviation on a tab over its top edge
 *   (the glow already tells the tier, so the tab adds no spoiler);
 * - each minimap segment is labelled with its tier under the ribbon, and the
 *   segments are parted by a gap, so neighbouring runs stay two runs;
 * - a new card's marker is a five-point star and a new variant's a diamond.
 * Phaser-free: the scene draws what these rules return.
 */

// ---------------------------------------------------------------------------
// Face-down tier tab
// ---------------------------------------------------------------------------

/** The face-down hint glow per tier (gold, violet, crimson), as released. */
export const FACE_DOWN_GLOW = { sr: 0xffcc33, ssr: 0xb266ff, ur: 0xff5566 } as const;

/** The tab's padding around its caption-sized abbreviation, in design pixels. */
export const FACE_DOWN_TAB = { padX: theme.space(2), padY: 2, minWidth: 34 } as const;

/** The line box the tab reserves per pixel of font size: Inter's, measured in Phaser at 1.28 em (accessibilityLayout.test.ts). */
export const TAB_LINE_HEIGHT = 1.28;

export interface CueRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The tab's plate for a face-down card at (`cardX`, `cardY`) drawn at
 * `cardScale`: centred on the card's top edge, as tall as one caption line plus
 * its padding (from the live caption size, so it grows with the text size) and
 * as wide as the measured label plus padding, never narrower than `minWidth`.
 */
export function faceDownTabRect(
  cardX: number,
  cardY: number,
  cardScale: number,
  labelWidth: number,
  fontSize: number = theme.type.caption,
): CueRect {
  const height = Math.ceil(fontSize * TAB_LINE_HEIGHT) + 2 * FACE_DOWN_TAB.padY;
  const width = Math.max(FACE_DOWN_TAB.minWidth, Math.ceil(labelWidth) + 2 * FACE_DOWN_TAB.padX);
  const top = cardY - (RUNWAY_CARD_DESIGN_HEIGHT * cardScale) / 2;
  return { x: cardX - width / 2, y: top - height / 2, width, height };
}

// ---------------------------------------------------------------------------
// Minimap tier labels
// ---------------------------------------------------------------------------

/** The gap that parts two neighbouring segments in the ribbon, and the labels' row. */
export const MINIMAP_CUES = { segmentGap: 2, labelGap: theme.space(1), labelRowOffset: 6 } as const;

/** Where a segment's fill is drawn: its span less the parting gap on its right (the last run keeps its edge). */
export function minimapSegmentSpan(
  segment: MinimapSegment,
  last: boolean,
  x: number,
  width: number,
): { x: number; width: number } {
  const from = x + segment.from * width;
  const full = (segment.to - segment.from) * width;
  return { x: from, width: Math.max(1, full - (last ? 0 : MINIMAP_CUES.segmentGap)) };
}

export interface MinimapLabelSlot {
  tier: Rarity;
  text: string;
  /** Left edge and width of the label, in design pixels. */
  x: number;
  width: number;
}

/**
 * One tier label per segment, under the ribbon: each centred on its segment
 * where it can be, kept in ride order, never overlapping its neighbour (at
 * least `labelGap` apart) and never past the ribbon's ends. A run too short
 * for its label (a lone UR in ninety cards is under 7 px) pushes its label
 * aside rather than losing it, and its neighbours give way in order. Returns
 * null when the labels cannot all fit side by side in the ribbon's width.
 */
export function minimapLabelSlots(
  segments: readonly MinimapSegment[],
  labelWidths: readonly number[],
  x: number,
  width: number,
  gap: number = MINIMAP_CUES.labelGap,
): MinimapLabelSlot[] | null {
  if (segments.length === 0) return [];
  const widths = segments.map((_, i) => Math.ceil(labelWidths[i] ?? 0));
  const needed = widths.reduce((sum, w) => sum + w, 0) + gap * (segments.length - 1);
  if (needed > width + 1e-6) return null;
  const right = x + width;
  const lefts = segments.map((seg, i) => {
    const centre = x + ((seg.from + seg.to) / 2) * width;
    return Math.max(x, Math.min(right - widths[i], centre - widths[i] / 2));
  });
  // Push right past each left neighbour, then pull back inside the right end.
  for (let i = 1; i < lefts.length; i++) lefts[i] = Math.max(lefts[i], lefts[i - 1] + widths[i - 1] + gap);
  const last = lefts.length - 1;
  lefts[last] = Math.min(lefts[last], right - widths[last]);
  for (let i = last - 1; i >= 0; i--) lefts[i] = Math.min(lefts[i], lefts[i + 1] - gap - widths[i]);
  return segments.map((seg, i) => ({ tier: seg.tier, text: TIER_LABEL[seg.tier], x: lefts[i], width: widths[i] }));
}

// ---------------------------------------------------------------------------
// New card / new variant corner marker
// ---------------------------------------------------------------------------

export type NewMarkerGlyph = 'star' | 'diamond';

/** A new card shows the star; a card already owned in a new treatment shows the diamond. */
export function newMarkerGlyph(card: { isNew: boolean; isNewVariant: boolean }): NewMarkerGlyph | null {
  if (card.isNew) return 'star';
  if (card.isNewVariant) return 'diamond';
  return null;
}

/** The marker's disc (card-local design pixels, as released) and its glyph's size inside it. */
export const NEW_MARKER = { x: 124, y: -176, radius: 13, stroke: 1.5, glyphRadius: 8.5 } as const;

/**
 * The glyph's outline as a closed polygon around (`cx`, `cy`), filling a
 * circle of `radius`: a five-point star (point up, inner radius 0.45) or a
 * diamond (point up, 0.78 as wide as tall), so the two differ in outline and
 * point count, not only in ink.
 */
export function newMarkerGlyphPoints(
  glyph: NewMarkerGlyph,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number }[] {
  if (glyph === 'diamond') {
    const half = radius * 0.78;
    return [
      { x: cx, y: cy - radius },
      { x: cx + half, y: cy },
      { x: cx, y: cy + radius },
      { x: cx - half, y: cy },
    ];
  }
  const inner = radius * 0.45;
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? radius : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}
