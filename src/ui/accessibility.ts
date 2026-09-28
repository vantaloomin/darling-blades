/**
 * The accessibility resolver (1.9 lane C, C2): the player's text size and
 * contrast settings in, the semantic tokens `theme` exposes out.
 *
 * Phaser-free and browser-free. `resolveTokens` is a pure function of its
 * argument; the only state here is the current setting, which the boot path
 * and Settings set through `setAccessibility` and `theme.ts` reads live, so a
 * token read inside a function picks up a change on the next scene build.
 *
 * Specialist palettes (card art, card frames, mana pips, rarity materials)
 * are not here and never change with these settings.
 */

import { normalizeHighContrast, normalizeTextScale, type TextScale } from '../meta/accessibilitySettings';

// ---------------------------------------------------------------------------
// Text size
// ---------------------------------------------------------------------------

// The allowed sizes (Standard, Large, Largest; plan Q2) and the snapping rule
// live with the save, so a stored value and the resolver can never disagree.
export { DEFAULT_TEXT_SCALE, TEXT_SCALES, normalizeTextScale, type TextScale } from '../meta/accessibilitySettings';

/** The base type ramp (100%). Card-internal geometry reads these, never the scaled roles. */
export const TYPE_BASE = Object.freeze({
  displayXL: 64,
  display: 44,
  h1: 28,
  h2: 20,
  body: 16,
  label: 14,
  caption: 12,
  micro: 11,
} as const);

export type TypeRole = keyof typeof TYPE_BASE;
export type TypeRamp = Readonly<Record<TypeRole, number>>;

/**
 * How much of the text-size step a role takes (plan Q3): reading roles take
 * all of it, headings half, display sizes none (they are already large, and a
 * scaled marquee eats the title-safe frame).
 */
export type RoleScaling = 'full' | 'half' | 'none';

export const TYPE_ROLE_SCALING: Readonly<Record<TypeRole, RoleScaling>> = {
  displayXL: 'none',
  display: 'none',
  h1: 'half',
  h2: 'half',
  body: 'full',
  label: 'full',
  caption: 'full',
  micro: 'full',
};

const SCALING_SHARE: Readonly<Record<RoleScaling, number>> = { full: 1, half: 0.5, none: 0 };

/**
 * One role's size at a text scale, rounded to whole pixels. The step is
 * worked in whole percent so 20px at a half step of 115% is exactly 21.5 and
 * rounds up to 22, not down on float noise.
 */
export function scaledTypeSize(role: TypeRole, textScale: number): number {
  const stepPercent = Math.round(normalizeTextScale(textScale) * 100) - 100;
  const percent = 100 + stepPercent * SCALING_SHARE[TYPE_ROLE_SCALING[role]];
  return Math.round((TYPE_BASE[role] * percent) / 100);
}

export function resolveType(textScale: number): TypeRamp {
  const ramp = {} as Record<TypeRole, number>;
  for (const role of Object.keys(TYPE_BASE) as TypeRole[]) ramp[role] = scaledTypeSize(role, textScale);
  return Object.freeze(ramp);
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export type ColorToken =
  | 'gold'
  | 'goldHover'
  | 'onGold'
  | 'heading'
  | 'body'
  | 'muted'
  | 'success'
  | 'danger'
  | 'dangerArmed'
  | 'dangerBg'
  | 'panelFill'
  | 'panelStroke'
  | 'btnPrimaryBg'
  | 'btnEmphasisBg'
  | 'btnGhostBg'
  | 'rowFill'
  | 'rowFillActive'
  | 'dim';

export type Palette = Readonly<Record<ColorToken, string>>;

/**
 * The standard chrome palette. Every value is the 1.8.5 palette except
 * `muted`: `#8f83a8` measured 4.18:1 on `rowFillActive` / `btnEmphasisBg`,
 * under the 4.5:1 floor for its 12px captions (plan Q6, approved
 * 2026-09-28). `#9589ac` is the lightest step of the same hue (HSL 261 deg,
 * saturation 0.17) that clears 4.5:1 on every surface it is drawn on:
 * panelFill 5.62, btnGhostBg 4.92, rowFill 5.11, rowFillActive 4.51, dim 6.11.
 */
export const STANDARD_COLORS: Palette = Object.freeze({
  gold: '#ffd88a',
  goldHover: '#ffd700',
  onGold: '#1a1426',
  heading: '#f0e6ff',
  body: '#c9bde0',
  muted: '#9589ac',
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
});

/**
 * High contrast (plan Q4): chrome text at 7:1 over the used pairs, with the
 * surfaces unchanged so selected and unselected rows keep their difference.
 * Only the tokens that miss move, each within its own hue:
 * - `muted` `#b7b0c7`: 7.02:1 on its worst surface (rowFillActive);
 * - `dangerArmed` `#f29d9d`: 7.05:1 on rowFillActive (6.08 before);
 * - `panelStroke` `#7768a8`: 3.03:1 or better against every chrome surface
 *   (the non-text 3:1 floor; 1.56 to 2.11 before), so panel edges read.
 */
export const HIGH_CONTRAST_COLORS: Palette = Object.freeze({
  ...STANDARD_COLORS,
  muted: '#b7b0c7',
  dangerArmed: '#f29d9d',
  panelStroke: '#7768a8',
});

/**
 * Every text-on-surface pair the chrome draws (plan: the contrast table's
 * seven text tokens on its five surfaces, plus `onGold` on `btnPrimaryBg` and
 * `danger` on `dangerBg`). Standard holds 4.5:1 and high contrast 7:1 over
 * this set. Pairs never drawn are not in it (`gold` on `btnPrimaryBg` is the
 * same hex by design). A new pairing joins the set in the PR that draws it.
 */
export const USED_TEXT_PAIRS: readonly (readonly [text: ColorToken, surface: ColorToken])[] = (() => {
  const texts: ColorToken[] = ['heading', 'body', 'muted', 'gold', 'success', 'danger', 'dangerArmed'];
  const surfaces: ColorToken[] = ['panelFill', 'btnGhostBg', 'btnEmphasisBg', 'rowFill', 'rowFillActive', 'dim'];
  const pairs: (readonly [ColorToken, ColorToken])[] = [];
  for (const text of texts) for (const surface of surfaces) pairs.push([text, surface]);
  pairs.push(['onGold', 'btnPrimaryBg'], ['danger', 'dangerBg']);
  return Object.freeze(pairs);
})();

/** Convert a CSS/Text colour token to Phaser Graphics' numeric form. */
export function colorInt(color: string): number {
  return Number.parseInt(color.slice(1), 16);
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2 relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(color: string): number {
  const n = colorInt(color);
  return 0.2126 * channelLuminance((n >> 16) & 255) + 0.7152 * channelLuminance((n >> 8) & 255) + 0.0722 * channelLuminance(n & 255);
}

/** WCAG 2 contrast ratio between two `#rrggbb` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type GraphicsToken = 'panelFill' | 'panelStroke' | 'dangerBg' | 'rowFill' | 'rowFillActive' | 'dim';
export type GraphicsPalette = Readonly<Record<GraphicsToken, number>>;

/** The numeric Graphics colours, always derived from the active palette. */
export function resolveGraphics(colors: Palette): GraphicsPalette {
  return Object.freeze({
    panelFill: colorInt(colors.panelFill),
    panelStroke: colorInt(colors.panelStroke),
    dangerBg: colorInt(colors.dangerBg),
    rowFill: colorInt(colors.rowFill),
    rowFillActive: colorInt(colors.rowFillActive),
    dim: colorInt(colors.dim),
  });
}

// ---------------------------------------------------------------------------
// Alpha and outlines
// ---------------------------------------------------------------------------

export type AlphaToken = 'overlayDim' | 'panel' | 'chrome' | 'subtle' | 'ghost' | 'scrim';
export type AlphaSet = Readonly<Record<AlphaToken, number>>;

/**
 * `scrim` is new in 1.9: the backplate under operational text drawn over art
 * (the board tile's name scrim, 0.62 today as a literal in BoardCardView).
 * `subtle` and `ghost` mean "disabled" and "inactive", so they stay put in
 * high contrast: raising them would make a disabled control look live.
 */
export const STANDARD_ALPHA: AlphaSet = Object.freeze({
  overlayDim: 0.92,
  panel: 0.9,
  chrome: 0.85,
  subtle: 0.5,
  ghost: 0.32,
  scrim: 0.62,
});

/**
 * High contrast: panels, the modal dim and chrome go opaque so scene art
 * cannot lower contrast. Where a control uses `chrome` as the idle half of an
 * idle-versus-hover pair (a stroke's alpha), the pair then differs by colour
 * alone (the gold hover stroke); C3 and the scene passes confirm each such
 * control still reads.
 */
export const HIGH_CONTRAST_ALPHA: AlphaSet = Object.freeze({
  ...STANDARD_ALPHA,
  overlayDim: 1,
  panel: 1,
  chrome: 1,
  scrim: 0.85,
});

export type OutlineToken = 'state' | 'focus';
export type OutlineSet = Readonly<Record<OutlineToken, number>>;

/**
 * Stroke widths for board state highlights and the keyboard focus cue (new in
 * 1.9; today's tile highlight is a 3px literal in BoardCardView). High
 * contrast thickens both to 5px (plan Q4).
 */
export const STANDARD_OUTLINE: OutlineSet = Object.freeze({ state: 3, focus: 3 });
export const HIGH_CONTRAST_OUTLINE: OutlineSet = Object.freeze({ state: 5, focus: 5 });

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

/** The two persisted settings (`SaveData.settings`, v36), after normalization. */
export interface AccessibilitySettings {
  readonly textScale: TextScale;
  readonly highContrast: boolean;
}

/** What callers may hand in: raw save values, possibly absent or garbage. */
export interface AccessibilityInput {
  readonly textScale?: unknown;
  readonly highContrast?: unknown;
}

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = Object.freeze({ textScale: 1, highContrast: false });

/** The save's normalization rule for both fields: `highContrast` is `=== true`. */
export function normalizeAccessibility(input: AccessibilityInput | null | undefined): AccessibilitySettings {
  return Object.freeze({
    textScale: normalizeTextScale(input?.textScale),
    highContrast: normalizeHighContrast(input?.highContrast),
  });
}

export interface ResolvedTokens {
  readonly type: TypeRamp;
  readonly colors: Palette;
  readonly graphics: GraphicsPalette;
  readonly alpha: AlphaSet;
  readonly outline: OutlineSet;
}

/** Pure: the settings in, every live token group out. */
export function resolveTokens(input: AccessibilityInput | null | undefined): ResolvedTokens {
  const settings = normalizeAccessibility(input);
  const colors = settings.highContrast ? HIGH_CONTRAST_COLORS : STANDARD_COLORS;
  return Object.freeze({
    type: resolveType(settings.textScale),
    colors,
    graphics: resolveGraphics(colors),
    alpha: settings.highContrast ? HIGH_CONTRAST_ALPHA : STANDARD_ALPHA,
    outline: settings.highContrast ? HIGH_CONTRAST_OUTLINE : STANDARD_OUTLINE,
  });
}

// ---------------------------------------------------------------------------
// The current setting (the only state in this module)
// ---------------------------------------------------------------------------

let currentSettings: AccessibilitySettings = DEFAULT_ACCESSIBILITY;
let currentResolved: ResolvedTokens = resolveTokens(DEFAULT_ACCESSIBILITY);

/**
 * Apply the player's settings. Boot calls it with the loaded save's values
 * before the first scene builds; Settings calls it on a change and then
 * rebuilds its scene. Raw save values are fine: they are normalized here.
 * Returns the normalized settings now in force.
 */
export function setAccessibility(input: AccessibilityInput | null | undefined): AccessibilitySettings {
  const next = normalizeAccessibility(input);
  if (next.textScale !== currentSettings.textScale || next.highContrast !== currentSettings.highContrast) {
    currentSettings = next;
    currentResolved = resolveTokens(next);
  }
  return currentSettings;
}

/** The settings in force. */
export function currentAccessibility(): AccessibilitySettings {
  return currentSettings;
}

/** The tokens for the settings in force (what `theme`'s live groups read). */
export function currentTokens(): ResolvedTokens {
  return currentResolved;
}
