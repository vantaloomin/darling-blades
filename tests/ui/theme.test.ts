import { describe, expect, it } from 'vitest';
import { colorInt, theme } from '../../src/ui/theme';

describe('theme tokens', () => {
  it('exports the complete Wave 0 palette and numeric Graphics counterparts', () => {
    expect(theme.colors).toMatchObject({
      gold: '#ffd88a', goldHover: '#ffd700', onGold: '#1a1426',
      heading: '#f0e6ff', body: '#c9bde0', muted: '#8f83a8',
      success: '#9be6a8', danger: '#f0b0a0', dangerArmed: '#f08a8a', dangerBg: '#3a1f28',
      panelFill: '#161226', panelStroke: '#4a3f6e', btnPrimaryBg: '#ffd88a',
      btnEmphasisBg: '#2c2344', btnGhostBg: '#241d3a', rowFill: '#211a34',
      rowFillActive: '#2c2344', dim: '#0a0812',
    });
    expect(theme.graphics).toEqual({
      panelFill: colorInt(theme.colors.panelFill),
      panelStroke: colorInt(theme.colors.panelStroke),
      dangerBg: colorInt(theme.colors.dangerBg),
      rowFill: colorInt(theme.colors.rowFill),
      rowFillActive: colorInt(theme.colors.rowFillActive),
      dim: colorInt(theme.colors.dim),
    });
    expect(colorInt(theme.colors.gold)).toBe(0xffd88a);
  });

  it('keeps the prescribed type, layout, interaction, motion, and depth systems complete', () => {
    expect(theme.type).toEqual({ displayXL: 64, display: 44, h1: 28, h2: 20, body: 16, label: 14, caption: 12, micro: 11 });
    expect(theme.fonts).toEqual({ display: 'Cinzel, Georgia, serif', ui: 'Inter, Arial, sans-serif' });
    expect(theme.weight).toEqual({ w600: '600', w700: '700' });
    expect(theme.design).toEqual({
      width: 1280,
      height: 720,
      centerX: 640,
      centerY: 360,
      titleSafe: { left: 64, right: 1216, top: 36, bottom: 684 },
      safeLeft: 64,
      safeRight: 1216,
      safeTop: 36,
      safeBottom: 684,
      safeWidth: 1152,
      safeHeight: 648,
      safeCenterX: 640,
      safeCenterY: 360,
      headerCenterY: 58,
      footerCenterY: 662,
    });
    expect(theme.space(6)).toBe(24);
    expect(theme.control).toEqual({ heightSm: 30, heightMd: 40, minHitWidth: 90, minHitHeight: 44, borderWidth: 1 });
    expect(theme.radius).toEqual({ panel: 8, control: 6 });
    expect(theme.motion).toEqual({ fast: 100, base: 180, slow: 220, easeOut: 'Cubic.easeOut' });
    expect(theme.alpha).toEqual({ overlayDim: 0.92, panel: 0.9, chrome: 0.85, subtle: 0.5, ghost: 0.32 });
    expect(theme.rarity).toEqual({ c: '#9aa0ab', r: '#dfe6f2', sr: '#ffe08a', ssr: '#d9a8ff', ur: '#ff9a8a' });
    expect(theme.depth).toEqual({ tiles: 5, hand: 10, handHover: 40, arrows: 50, stackReadout: 55, hud: 56, hudLabel: 57, combatFx: 60, history: 70, toast: 80, banner: 85, reveal: 86, floats: 90, popover: 95, overlay: 100, modal: 105, inspect: 110, results: 120 });
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
