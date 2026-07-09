/**
 * Shared visual tokens. This module intentionally has no Phaser import so
 * headless tests and non-rendering code can inspect the design system safely.
 */

const colors = {
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
} as const;

/** Convert a CSS/Text colour token to Phaser Graphics' numeric form. */
export function colorInt(color: string): number {
  return Number.parseInt(color.slice(1), 16);
}

export const theme = {
  colors,
  graphics: {
    panelFill: 0x161226,
    panelStroke: 0x4a3f6e,
    dangerBg: 0x3a1f28,
    rowFill: 0x211a34,
    rowFillActive: 0x2c2344,
    dim: 0x0a0812,
  },
  rarity: {
    c: '#9aa0ab',
    r: '#dfe6f2',
    sr: '#ffe08a',
    ssr: '#d9a8ff',
    ur: '#ff9a8a',
  },
  fonts: {
    display: 'Cinzel, Georgia, serif',
    ui: 'Inter, Arial, sans-serif',
  },
  type: {
    displayXL: 64,
    display: 44,
    h1: 28,
    h2: 20,
    body: 16,
    label: 14,
    caption: 12,
    micro: 11,
  },
  weight: {
    w600: '600',
    w700: '700',
  },
  space: (units: number): number => units * 4,
  radius: {
    panel: 8,
    control: 6,
  },
  alpha: {
    overlayDim: 0.92,
    panel: 0.9,
    chrome: 0.85,
    subtle: 0.5,
    ghost: 0.32,
  },
  depth: {
    tiles: 5,
    hand: 10,
    handHover: 40,
    arrows: 50,
    stackReadout: 55,
    hud: 56,
    hudLabel: 57,
    combatFx: 60,
    history: 70,
    toast: 80,
    banner: 85,
    reveal: 86,
    floats: 90,
    overlay: 100,
    modal: 105,
    inspect: 110,
    results: 120,
  },
} as const;

/** Canonical rarity text ramp; retained under its existing consumer-facing name. */
export const TIER_TEXT_COLOR = theme.rarity;

export type Theme = typeof theme;
