/**
 * The Forge's page colours and type sizes, read from the game's own theme so
 * the two can't drift apart (owner, 2026-10-09: the Forge must feel like it
 * belongs to Darling Blades). `style.css` keeps the same values as fallbacks
 * for the moment before this runs; a test holds the two equal.
 */
import { STANDARD_COLORS, TYPE_BASE } from '../ui/accessibility';

export const FORGE_THEME_VARS: Readonly<Record<string, string>> = Object.freeze({
  '--gold': STANDARD_COLORS.gold,
  '--gold-hover': STANDARD_COLORS.goldHover,
  '--on-gold': STANDARD_COLORS.onGold,
  '--heading': STANDARD_COLORS.heading,
  '--body': STANDARD_COLORS.body,
  '--muted': STANDARD_COLORS.muted,
  '--success': STANDARD_COLORS.success,
  '--danger': STANDARD_COLORS.danger,
  '--panel': STANDARD_COLORS.panelFill,
  '--stroke': STANDARD_COLORS.panelStroke,
  '--ghost': STANDARD_COLORS.btnGhostBg,
  '--emphasis': STANDARD_COLORS.btnEmphasisBg,
  '--row': STANDARD_COLORS.rowFill,
  '--dim': STANDARD_COLORS.dim,
  '--fs-xs': `${TYPE_BASE.micro}px`,
  '--fs-sm': `${TYPE_BASE.caption}px`,
  '--fs-md': `${TYPE_BASE.label}px`,
  '--fs-lg': `${TYPE_BASE.body}px`,
  '--fs-xl': `${TYPE_BASE.h2}px`,
  '--fs-2xl': `${TYPE_BASE.h1}px`,
});

export function applyGameTheme(root: HTMLElement): void {
  for (const [name, value] of Object.entries(FORGE_THEME_VARS)) root.style.setProperty(name, value);
}
