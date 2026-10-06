import { describe, expect, it } from 'vitest';
import type { Rarity } from '../../src/engine/types';
import { TIER_LABEL } from '../../src/meta/variants';
import {
  FACE_DOWN_GLOW,
  FACE_DOWN_TAB,
  faceDownTabRect,
  MINIMAP_CUES,
  minimapLabelSlots,
  minimapSegmentSpan,
  NEW_MARKER,
  newMarkerGlyph,
  newMarkerGlyphPoints,
  type NewMarkerGlyph,
} from '../../src/ui/packCuePresentation';
import {
  minimapSegments,
  PACK_REVEAL_BOUNDS,
  packRevealLayout,
  RUNWAY_CARD_DESIGN_HEIGHT,
  RUNWAY_MINIMAP,
  runwayOrder,
} from '../../src/ui/packRunwayPresentation';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';
import { deltaE2000, deltaE2000Lab, rgbToLab, toRgb, VISION_KINDS } from './colourVision';

/**
 * Monochromacy (Chromium's achromatopsia emulation, the simulation the wave 5
 * QC captures failed under): only lightness survives, so two colours differ by
 * their CIE L* alone.
 */
function monochromeDeltaE(first: string | number, second: string | number): number {
  const lightness = (c: string | number): readonly [number, number, number] => [rgbToLab(toRgb(c))[0], 0, 0];
  return deltaE2000Lab(lightness(first), lightness(second));
}

/** The smallest CIEDE2000 across normal vision, the three dichromacies and monochromacy. */
function worstDeltaE(first: string | number, second: string | number): number {
  return Math.min(...VISION_KINDS.map((kind) => deltaE2000(first, second, kind)), monochromeDeltaE(first, second));
}

/** The board gate's bar: 10 CIEDE2000 under every simulation tells two colours apart. */
const COLOUR_ALONE = 10;

interface PackCue {
  name: string;
  colour: string | number;
  /** What the cue shows besides its colour: a tier abbreviation or a glyph outline. */
  nonColour: string;
}

const glyphOutline = (glyph: NewMarkerGlyph): string => `${glyph}:${newMarkerGlyphPoints(glyph, 0, 0, 1).length} vertices`;

/** Each surface's cues that share the screen, read from the live palette. */
function surfaces(): Record<string, PackCue[]> {
  const specials: Rarity[] = ['sr', 'ssr', 'ur'];
  const tiers: Rarity[] = ['c', 'r', 'sr', 'ssr', 'ur'];
  return {
    'face-down glow': specials.map((tier) => ({ name: tier, colour: FACE_DOWN_GLOW[tier as 'sr'], nonColour: TIER_LABEL[tier] })),
    'minimap segment': tiers.map((tier) => ({ name: tier, colour: theme.rarity[tier], nonColour: TIER_LABEL[tier] })),
    'corner marker': [
      { name: 'new card', colour: theme.colors.success, nonColour: glyphOutline(newMarkerGlyph({ isNew: true, isNewVariant: false })!) },
      { name: 'new variant', colour: theme.rarity.ssr, nonColour: glyphOutline(newMarkerGlyph({ isNew: false, isNewVariant: true })!) },
    ],
  };
}

describe('pack opening cue distinctness', () => {
  it('tells apart every pair of cues on one surface, by a non-colour channel or by 10+ CIEDE2000 under every simulation, in both palettes', () => {
    forEachA11yCell((cell) => {
      for (const [surface, cues] of Object.entries(surfaces())) {
        for (let i = 0; i < cues.length; i++) {
          for (let j = i + 1; j < cues.length; j++) {
            const [a, b] = [cues[i], cues[j]];
            const apart = a.nonColour !== b.nonColour || worstDeltaE(a.colour, b.colour) >= COLOUR_ALONE;
            expect(apart, `${cell.name}: ${surface} ${a.name} / ${b.name}`).toBe(true);
          }
        }
      }
    });
  });

  it('needs the non-colour channel on every surface: each has a pair that colour alone does not separate', () => {
    // What the wave 5 QC saw in Chromium's emulation, measured on the swatches:
    // the SSR and UR glows, the R and SR segments and the two markers all
    // collapse under monochromacy.
    for (const [surface, cues] of Object.entries(surfaces())) {
      const worst = Math.min(...cues.flatMap((a, i) => cues.slice(i + 1).map((b) => worstDeltaE(a.colour, b.colour))));
      expect(worst, surface).toBeLessThan(COLOUR_ALONE);
    }
    expect(monochromeDeltaE(FACE_DOWN_GLOW.ssr, FACE_DOWN_GLOW.ur)).toBeLessThan(COLOUR_ALONE);
    expect(monochromeDeltaE(theme.rarity.r, theme.rarity.sr)).toBeLessThan(COLOUR_ALONE);
    expect(monochromeDeltaE(theme.colors.success, theme.rarity.ssr)).toBeLessThan(COLOUR_ALONE);
  });
});

describe('the face-down tier tab', () => {
  const labelWidth = (tier: Rarity): number => TIER_LABEL[tier].length * theme.type.caption * 0.75;

  it('sits centred on the card top edge, at least as wide as its label and padding', () => {
    const rect = faceDownTabRect(640, 400, 0.5, 40);
    expect(rect.x + rect.width / 2).toBe(640);
    expect(rect.y + rect.height / 2).toBe(400 - (RUNWAY_CARD_DESIGN_HEIGHT * 0.5) / 2);
    expect(rect.width).toBe(40 + 2 * FACE_DOWN_TAB.padX);
    expect(faceDownTabRect(640, 400, 0.5, 4).width).toBe(FACE_DOWN_TAB.minWidth);
  });

  it('grows with the caption and keeps clear of the row above and inside the reveal bounds, for every pack split, in every accessibility cell', () => {
    const heights: number[] = [];
    forEachA11yCell((cell) => {
      for (let specials = 1; specials <= 9; specials++) {
        const layout = packRevealLayout(9 - specials, specials);
        const rows = [...layout.grid, ...layout.specials];
        layout.specials.forEach((slot) => {
          const tab = faceDownTabRect(slot.x, slot.y, slot.scale, labelWidth('ssr'));
          const above = rows
            .filter((other) => other.y < slot.y)
            .map((other) => other.y + (RUNWAY_CARD_DESIGN_HEIGHT * other.scale) / 2);
          const ceiling = above.length > 0 ? Math.max(...above) : PACK_REVEAL_BOUNDS.top;
          expect(tab.y, `${cell.name}: ${specials} specials, tab above the row over it`).toBeGreaterThanOrEqual(ceiling);
          expect(tab.y + tab.height).toBeLessThanOrEqual(PACK_REVEAL_BOUNDS.bottom);
          expect(tab.x).toBeGreaterThanOrEqual(PACK_REVEAL_BOUNDS.left);
          expect(tab.x + tab.width).toBeLessThanOrEqual(PACK_REVEAL_BOUNDS.right);
        });
      }
      heights.push(faceDownTabRect(0, 0, 0.5, 20).height);
    });
    expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights));
  });
});

describe('the minimap tier labels', () => {
  type Tier = Rarity;
  const ride = (counts: Partial<Record<Tier, number>>): { tier: Tier; frame: 'white'; holo: 'none'; fullArt: false }[] =>
    runwayOrder((['c', 'r', 'sr', 'ssr', 'ur'] as Tier[]).flatMap((tier) =>
      Array.from({ length: counts[tier] ?? 0 }, () => ({ tier, frame: 'white' as const, holo: 'none' as const, fullArt: false as const }))));
  const { x, width } = RUNWAY_MINIMAP;
  const widthsFor = (segments: ReturnType<typeof minimapSegments>): number[] =>
    segments.map((seg) => TIER_LABEL[seg.tier].length * theme.type.caption * 0.75);

  it('centres each label on its run when there is room', () => {
    const segments = minimapSegments(ride({ c: 45, r: 45 }));
    const slots = minimapLabelSlots(segments, [10, 10], x, width)!;
    expect(slots.map((s) => s.text)).toEqual(['C', 'R']);
    expect(slots[0].x + 5).toBeCloseTo(x + width / 4);
    expect(slots[1].x + 5).toBeCloseTo(x + (3 * width) / 4);
  });

  it('keeps a lone UR its label at the ribbon end and pushes its neighbours aside in order, in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      // The Shop's largest bulk buy, as the probe opens it: 90 cards, one UR last.
      const segments = minimapSegments(ride({ c: 50, r: 20, sr: 11, ssr: 8, ur: 1 }));
      const slots = minimapLabelSlots(segments, widthsFor(segments), x, width)!;
      expect(slots.map((s) => s.text), cell.name).toEqual(['C', 'R', 'SR', 'SSR', 'UR']);
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].x - (slots[i - 1].x + slots[i - 1].width), `${cell.name}: ${slots[i].text}`).toBeGreaterThanOrEqual(MINIMAP_CUES.labelGap - 1e-6);
      }
      expect(slots[0].x).toBeGreaterThanOrEqual(x);
      expect(slots[slots.length - 1].x + slots[slots.length - 1].width).toBeCloseTo(x + width);
    });
  });

  it('crowds tiny runs at both ends without overlap, and gives up (null) only when the labels cannot fit side by side', () => {
    const segments = minimapSegments(ride({ c: 1, r: 1, sr: 200, ssr: 1, ur: 1 }));
    const slots = minimapLabelSlots(segments, [12, 12, 20, 30, 20], x, width)!;
    expect(slots[0].x).toBe(x);
    for (let i = 1; i < slots.length; i++) expect(slots[i].x).toBeGreaterThanOrEqual(slots[i - 1].x + slots[i - 1].width + MINIMAP_CUES.labelGap - 1e-6);
    expect(slots[4].x + slots[4].width).toBeLessThanOrEqual(x + width + 1e-6);
    expect(minimapLabelSlots(segments, [150, 150, 150, 150, 150], x, width)).toBeNull();
    expect(minimapLabelSlots([], [], x, width)).toEqual([]);
  });

  it('parts neighbouring runs with a gap but keeps the last run flush with the ribbon end', () => {
    const segments = minimapSegments(ride({ r: 1, sr: 1 }));
    const first = minimapSegmentSpan(segments[0], false, x, width);
    const last = minimapSegmentSpan(segments[1], true, x, width);
    expect(last.x - (first.x + first.width)).toBe(MINIMAP_CUES.segmentGap);
    expect(last.x + last.width).toBe(x + width);
  });
});

describe('the new card / new variant corner marker', () => {
  it('shows the star for a new card (also when it is a new variant), the diamond for a new variant only, and nothing otherwise', () => {
    expect(newMarkerGlyph({ isNew: true, isNewVariant: false })).toBe('star');
    expect(newMarkerGlyph({ isNew: true, isNewVariant: true })).toBe('star');
    expect(newMarkerGlyph({ isNew: false, isNewVariant: true })).toBe('diamond');
    expect(newMarkerGlyph({ isNew: false, isNewVariant: false })).toBeNull();
  });

  it('draws each glyph inside the disc, clear of its stroke, reaching most of the way out', () => {
    for (const glyph of ['star', 'diamond'] as const) {
      const points = newMarkerGlyphPoints(glyph, NEW_MARKER.x, NEW_MARKER.y, NEW_MARKER.glyphRadius);
      const reach = points.map((p) => Math.hypot(p.x - NEW_MARKER.x, p.y - NEW_MARKER.y));
      expect(Math.max(...reach), glyph).toBeLessThanOrEqual(NEW_MARKER.radius - NEW_MARKER.stroke);
      expect(Math.max(...reach), glyph).toBeGreaterThanOrEqual(NEW_MARKER.radius * 0.6);
    }
  });
});
