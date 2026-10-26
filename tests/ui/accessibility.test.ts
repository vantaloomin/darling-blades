import { afterEach, describe, expect, it } from 'vitest';
import {
  contrastRatio,
  currentAccessibility,
  currentTokens,
  HIGH_CONTRAST_COLORS,
  normalizeAccessibility,
  normalizeTextScale,
  resolveTokens,
  setAccessibility,
  STANDARD_COLORS,
  TEXT_SCALES,
  TYPE_BASE,
  USED_TEXT_PAIRS,
  type Palette,
  type TypeRole,
} from '../../src/ui/accessibility';
import { A11Y_CELLS } from './a11yCells';

afterEach(() => {
  setAccessibility({ textScale: 1, highContrast: false });
});

describe('text scale normalization (the v36 storage rule)', () => {
  it('reads anything that is not a finite number as Standard', () => {
    for (const value of [undefined, null, 'big', '1.3', NaN, Infinity, -Infinity, true, {}]) {
      expect(normalizeTextScale(value), String(value)).toBe(1);
    }
  });

  it('snaps a number to the nearest allowed size, a tie taking the smaller', () => {
    expect(normalizeTextScale(2)).toBe(1.3);
    expect(normalizeTextScale(-1)).toBe(1);
    expect(normalizeTextScale(1.2)).toBe(1.15);
    expect(normalizeTextScale(1.075)).toBe(1);
    expect(normalizeTextScale(1.225)).toBe(1.15);
    for (const scale of TEXT_SCALES) expect(normalizeTextScale(scale)).toBe(scale);
  });

  it('turns on high contrast only for a literal true', () => {
    expect(normalizeAccessibility({ highContrast: 'yes' }).highContrast).toBe(false);
    expect(normalizeAccessibility({ highContrast: 1 }).highContrast).toBe(false);
    expect(normalizeAccessibility({ highContrast: true }).highContrast).toBe(true);
    expect(normalizeAccessibility(undefined)).toEqual({ textScale: 1, highContrast: false });
  });
});

describe('the role policy (Q3)', () => {
  // The approved table: reading roles take the whole step, headings half,
  // display sizes none; whole pixels.
  const APPROVED: Record<TypeRole, [number, number, number]> = {
    displayXL: [64, 64, 64],
    display: [44, 44, 44],
    h1: [28, 30, 32],
    h2: [20, 22, 23],
    body: [16, 18, 21],
    label: [14, 16, 18],
    caption: [12, 14, 16],
    micro: [11, 13, 14],
  };

  it('sizes each role at 100, 115 and 130% as approved', () => {
    for (const [role, sizes] of Object.entries(APPROVED) as [TypeRole, number[]][]) {
      for (const cell of A11Y_CELLS) {
        const index = TEXT_SCALES.indexOf(cell.textScale as (typeof TEXT_SCALES)[number]);
        expect(resolveTokens(cell).type[role], `${role}, ${cell.name}`).toBe(sizes[index]);
      }
    }
  });

  it('never shrinks a role and never lets a heading fall below the reading text it heads', () => {
    for (const cell of A11Y_CELLS) {
      const type = resolveTokens(cell).type;
      for (const role of Object.keys(TYPE_BASE) as TypeRole[]) expect(type[role]).toBeGreaterThanOrEqual(TYPE_BASE[role]);
      expect(type.h2).toBeGreaterThan(type.body);
      expect(type.h1).toBeGreaterThan(type.h2);
    }
  });

  it('the compact ramp (C3) keeps the 11 px floor and the heading order at every text size', () => {
    for (const cell of A11Y_CELLS) {
      const type = resolveTokens(cell).compactType;
      for (const role of Object.keys(TYPE_BASE) as TypeRole[]) expect(type[role], `${role}, ${cell.name}`).toBeGreaterThanOrEqual(11);
      expect(type.h2).toBeGreaterThan(type.body);
      expect(type.h1).toBeGreaterThan(type.h2);
    }
    // At 100% it is the Version C mocks' ramp: titles 20, sheet titles 18, body 14, labels 12, metadata 11.
    expect(resolveTokens({ textScale: 1 }).compactType).toMatchObject({ h1: 20, h2: 18, body: 14, label: 12, caption: 11, micro: 11 });
  });

  it('does not scale by contrast', () => {
    expect(resolveTokens({ textScale: 1.3, highContrast: true }).type).toEqual(resolveTokens({ textScale: 1.3 }).type);
  });
});

describe('contrast over the used text-on-surface pairs', () => {
  it('measures WCAG ratios (anchors)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  const worstPair = (palette: Palette) =>
    Math.min(...USED_TEXT_PAIRS.map(([text, surface]) => contrastRatio(palette[text], palette[surface])));

  it('standard holds 4.5:1 on every used pair', () => {
    for (const [text, surface] of USED_TEXT_PAIRS) {
      expect(contrastRatio(STANDARD_COLORS[text], STANDARD_COLORS[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('high contrast holds 7:1 on every used pair and never lowers a pair below standard', () => {
    for (const [text, surface] of USED_TEXT_PAIRS) {
      const high = contrastRatio(HIGH_CONTRAST_COLORS[text], HIGH_CONTRAST_COLORS[surface]);
      expect(high, `${text} on ${surface}`).toBeGreaterThanOrEqual(7);
      expect(high, `${text} on ${surface}`).toBeGreaterThanOrEqual(contrastRatio(STANDARD_COLORS[text], STANDARD_COLORS[surface]));
    }
    expect(worstPair(HIGH_CONTRAST_COLORS)).toBeGreaterThan(worstPair(STANDARD_COLORS));
  });

  it('high contrast panel strokes clear the 3:1 non-text floor against every chrome surface', () => {
    for (const surface of ['panelFill', 'btnGhostBg', 'rowFill', 'rowFillActive', 'dim'] as const) {
      expect(contrastRatio(HIGH_CONTRAST_COLORS.panelStroke, HIGH_CONTRAST_COLORS[surface]), surface).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('high contrast alpha and outlines (Q4)', () => {
  it('makes panels, the modal dim and chrome opaque, and strengthens the text scrim', () => {
    const standard = resolveTokens({}).alpha;
    const high = resolveTokens({ highContrast: true }).alpha;
    expect(high.panel).toBe(1);
    expect(high.overlayDim).toBe(1);
    expect(high.chrome).toBe(1);
    expect(high.scrim).toBeGreaterThan(standard.scrim);
  });

  it('keeps disabled and inactive dims, so a disabled control never looks live', () => {
    const standard = resolveTokens({}).alpha;
    const high = resolveTokens({ highContrast: true }).alpha;
    expect(high.subtle).toBe(standard.subtle);
    expect(high.ghost).toBe(standard.ghost);
  });

  it('thickens state and focus outlines', () => {
    const standard = resolveTokens({}).outline;
    const high = resolveTokens({ highContrast: true }).outline;
    expect(high.state).toBeGreaterThan(standard.state);
    expect(high.focus).toBeGreaterThan(standard.focus);
  });
});

describe('the resolver and the current setting', () => {
  it('is pure: its answer depends on its argument, not on the setting in force', () => {
    const before = resolveTokens({ textScale: 1.15 });
    setAccessibility({ textScale: 1.3, highContrast: true });
    expect(resolveTokens({ textScale: 1.15 })).toEqual(before);
  });

  it('normalizes what the setter is handed, so raw save values are safe', () => {
    expect(setAccessibility({ textScale: 'big', highContrast: 'true' })).toEqual({ textScale: 1, highContrast: false });
    expect(setAccessibility({ textScale: 1.31, highContrast: true })).toEqual({ textScale: 1.3, highContrast: true });
    expect(currentAccessibility()).toEqual({ textScale: 1.3, highContrast: true });
    expect(currentTokens()).toEqual(resolveTokens({ textScale: 1.3, highContrast: true }));
  });

  it('hands out read-only token groups, so one scene cannot repaint another', () => {
    const tokens = currentTokens();
    expect(() => {
      (tokens.colors as Record<string, string>).muted = '#ffffff';
    }).toThrow();
    expect(() => {
      (tokens.type as Record<string, number>).body = 99;
    }).toThrow();
    expect(() => {
      (TYPE_BASE as Record<string, number>).body = 99;
    }).toThrow();
  });

  it('keeps the resolved tokens while the settings are unchanged, and replaces them on a change', () => {
    setAccessibility({ textScale: 1.15, highContrast: false });
    const before = currentTokens();
    setAccessibility({ textScale: 1.15, highContrast: false });
    expect(currentTokens()).toBe(before);
    setAccessibility({ textScale: 1.15, highContrast: true });
    expect(currentTokens()).not.toBe(before);
    expect(currentTokens().colors.muted).not.toBe(before.colors.muted);
  });
});
