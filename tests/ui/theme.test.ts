import { afterEach, describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance, setAccessibility } from '../../src/ui/accessibility';
import { colorInt, theme } from '../../src/ui/theme';

/**
 * Golden compatibility fixture: the live token groups exactly as
 * `src/ui/theme.ts` exposed them on release/1.9 before the
 * accessibility resolver. At Standard text and contrast off, the resolver
 * must hand every consumer these values; the one approved difference is
 * `colors.muted` (plan Q6), checked by its own rule below.
 */
const RELEASE_1_9_TYPE = {
  displayXL: 64,
  display: 44,
  h1: 28,
  h2: 20,
  body: 16,
  label: 14,
  caption: 12,
  micro: 11,
};
const RELEASE_1_9_COLORS = {
  gold: '#ffd88a',
  goldHover: '#ffd700',
  onGold: '#1a1426',
  heading: '#f0e6ff',
  body: '#c9bde0',
  muted: '#8f83a8',
  success: '#9be6a8',
  danger: '#f0b0a0',
  dangerArmed: '#f08a8a',
  dangerBg: '#3a1f28',
  panelFill: '#161226',
  panelStroke: '#4a3f6e',
  btnPrimaryBg: '#ffd88a',
  btnEmphasisBg: '#2c2344',
  btnGhostBg: '#241d3a',
  rowFill: '#211a34',
  rowFillActive: '#2c2344',
  dim: '#0a0812',
};
const RELEASE_1_9_GRAPHICS = {
  panelFill: 0x161226,
  panelStroke: 0x4a3f6e,
  dangerBg: 0x3a1f28,
  rowFill: 0x211a34,
  rowFillActive: 0x2c2344,
  dim: 0x0a0812,
};
const RELEASE_1_9_ALPHA = {
  overlayDim: 0.92,
  panel: 0.9,
  chrome: 0.85,
  subtle: 0.5,
  ghost: 0.32,
};

function hueDegrees(color: string): number {
  const n = colorInt(color);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

afterEach(() => {
  setAccessibility({ textScale: 1, highContrast: false });
});

describe('theme tokens', () => {
  it('parses a hex colour into its Graphics integer', () => {
    expect(colorInt('#ffd88a')).toBe(0xffd88a);
  });

  it('keeps the design frame, control heights, and depth ordering coherent', () => {
    expect(theme.design.centerX * 2).toBe(theme.design.width);
    expect(theme.design.centerY * 2).toBe(theme.design.height);
    expect(theme.control.heightSm).toBeLessThanOrEqual(theme.control.minHitHeight);
    expect(theme.control.heightMd).toBeLessThanOrEqual(theme.control.minHitHeight);
    expect(theme.depth.floats).toBeLessThan(theme.depth.popover);
    expect(theme.depth.popover).toBeLessThan(theme.depth.overlay);
    expect(theme.depth.overlay).toBeLessThan(theme.depth.modal);
    expect(theme.depth.modal).toBeLessThan(theme.depth.inspect);
    expect(theme.depth.inspect).toBeLessThan(theme.depth.results);
  });
});

describe('theme defaults stay compatible with release/1.9 (golden)', () => {
  it('serves the release/1.9 type ramp at Standard text size, and keeps it as typeBase', () => {
    expect({ ...theme.type }).toEqual(RELEASE_1_9_TYPE);
    expect({ ...theme.typeBase }).toEqual(RELEASE_1_9_TYPE);
  });

  it('serves the release/1.9 colours with contrast off, except the approved muted change', () => {
    const { muted, ...rest } = theme.colors;
    const { muted: oldMuted, ...oldRest } = RELEASE_1_9_COLORS;
    expect(rest).toEqual(oldRest);
    expect(muted).not.toBe(oldMuted);
  });

  it('serves the release/1.9 Graphics numbers and alpha values with contrast off', () => {
    expect({ ...theme.graphics }).toEqual(RELEASE_1_9_GRAPHICS);
    for (const [key, value] of Object.entries(RELEASE_1_9_ALPHA)) {
      expect(theme.alpha[key as keyof typeof RELEASE_1_9_ALPHA], key).toBe(value);
    }
  });
});

describe('the standard muted (Q6)', () => {
  const mutedSurfaces = ['panelFill', 'btnGhostBg', 'rowFill', 'rowFillActive', 'dim'] as const;

  it('clears 4.5:1 on every surface it is drawn on, where the old value missed', () => {
    const worstOld = Math.min(...mutedSurfaces.map((s) => contrastRatio(RELEASE_1_9_COLORS.muted, theme.colors[s])));
    const worstNew = Math.min(...mutedSurfaces.map((s) => contrastRatio(theme.colors.muted, theme.colors[s])));
    expect(worstOld).toBeLessThan(4.5);
    expect(worstNew).toBeGreaterThanOrEqual(4.5);
  });

  it('moves lighter within its own hue, so it still reads as the same dim caption colour', () => {
    expect(relativeLuminance(theme.colors.muted)).toBeGreaterThan(relativeLuminance(RELEASE_1_9_COLORS.muted));
    expect(Math.abs(hueDegrees(theme.colors.muted) - hueDegrees(RELEASE_1_9_COLORS.muted))).toBeLessThan(3);
  });
});

describe('theme token groups are live reads', () => {
  it('a read after a settings change answers for the new settings, with no re-import', () => {
    setAccessibility({ textScale: 1.3, highContrast: true });
    expect(theme.type.body).toBe(21);
    expect(theme.typeBase.body).toBe(16);
    expect(theme.alpha.panel).toBe(1);
    expect(theme.colors.muted).not.toBe(RELEASE_1_9_COLORS.muted);

    setAccessibility({ textScale: 1, highContrast: false });
    expect(theme.type.body).toBe(16);
    expect(theme.alpha.panel).toBe(0.9);
  });

  it('derives the Graphics numbers from the palette in force, in both contrast modes', () => {
    for (const highContrast of [false, true]) {
      setAccessibility({ highContrast });
      for (const [key, value] of Object.entries(theme.graphics)) {
        expect(value, `${key} highContrast=${highContrast}`).toBe(colorInt(theme.colors[key as keyof typeof theme.graphics]));
      }
    }
  });

  it('high contrast brightens the panel stroke and leaves the rarity palette alone', () => {
    const rarity = { ...theme.rarity };
    const standardStroke = relativeLuminance(theme.colors.panelStroke);
    setAccessibility({ highContrast: true });
    expect(relativeLuminance(theme.colors.panelStroke)).toBeGreaterThan(standardStroke);
    expect(theme.rarity).toEqual(rarity);
  });
});
