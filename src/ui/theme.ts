/**
 * Shared visual tokens. This module intentionally has no Phaser import so
 * headless tests and non-rendering code can inspect the design system safely.
 *
 * `type`, `colors`, `graphics`, `alpha` and `outline` are live: each read goes
 * through the accessibility resolver (`./accessibility`) and answers for the
 * text size and contrast in force, so a read inside a function (at scene
 * build) follows a settings change. A read at module scope, or a group object
 * kept in a module-level constant, is frozen at import: don't add one.
 * `typeBase` is the unscaled ramp for card-internal geometry. `rarity` and
 * everything else here are fixed.
 */

import { currentTokens, TYPE_BASE } from './accessibility';

export { colorInt } from './accessibility';

const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;
const TITLE_SAFE_MARGIN = 0.05;

const control = {
  heightSm: 30,
  heightMd: 40,
  minHitWidth: 90,
  minHitHeight: 44,
  borderWidth: 1,
} as const;

const titleSafe = {
  left: DESIGN_WIDTH * TITLE_SAFE_MARGIN,
  right: DESIGN_WIDTH - DESIGN_WIDTH * TITLE_SAFE_MARGIN,
  top: DESIGN_HEIGHT * TITLE_SAFE_MARGIN,
  bottom: DESIGN_HEIGHT - DESIGN_HEIGHT * TITLE_SAFE_MARGIN,
} as const;

const safeWidth = titleSafe.right - titleSafe.left;
const safeHeight = titleSafe.bottom - titleSafe.top;
const safeCenterX = titleSafe.left + safeWidth / 2;
const safeCenterY = titleSafe.top + safeHeight / 2;

const design = {
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  centerX: DESIGN_WIDTH / 2,
  centerY: DESIGN_HEIGHT / 2,
  titleSafe,
  safeLeft: titleSafe.left,
  safeRight: titleSafe.right,
  safeTop: titleSafe.top,
  safeBottom: titleSafe.bottom,
  safeWidth,
  safeHeight,
  safeCenterX,
  safeCenterY,
  headerCenterY: titleSafe.top + control.minHitHeight / 2,
  footerCenterY: titleSafe.bottom - control.minHitHeight / 2,
} as const;

export const theme = {
  get colors() {
    return currentTokens().colors;
  },
  get graphics() {
    return currentTokens().graphics;
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
  /** The 100% ramp. Card faces and other card-internal geometry read this; chrome reads `type`. */
  typeBase: TYPE_BASE,
  /** Chrome type sizes at the text size in force (the role policy in `./accessibility`). */
  get type() {
    return currentTokens().type;
  },
  /** The compact profile's chrome sizes at the text size in force; only migrated compact scenes read it (plan-mobile-overhaul C3). */
  get compactType() {
    return currentTokens().compactType;
  },
  weight: {
    w600: '600',
    w700: '700',
  },
  design,
  space: (units: number): number => units * 4,
  control,
  radius: {
    panel: 8,
    control: 6,
  },
  motion: {
    fast: 100,
    base: 180,
    slow: 220,
    easeOut: 'Cubic.easeOut',
  },
  get alpha() {
    return currentTokens().alpha;
  },
  /** Board state and focus outline widths (3px, 5px in high contrast). */
  get outline() {
    return currentTokens().outline;
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
    popover: 95,
  },
} as const;

/** Canonical rarity text ramp; retained under its existing consumer-facing name. */
export const TIER_TEXT_COLOR = theme.rarity;

export type Theme = typeof theme;
