import type { ConfirmNoBlockSetting } from '../meta/SaveManager';

export interface SettingsChipLayout {
  value: ConfirmNoBlockSetting;
  label: string;
  minWidth: number;
  x: number;
}

export const SETTINGS_GAMEPLAY_PANEL = { left: 670, right: 1210 } as const;
/**
 * The Gameplay (right) column's vertical band. The left column used to share
 * it; since the Privacy section landed there it runs deeper - see
 * `SETTINGS_LEFT_PANEL`. This band still bounds the "Your turn" section, whose
 * rows must not grow past where the Privacy heading now starts.
 */
export const SETTINGS_PANEL_BAND = { top: 124, bottom: 594 } as const;

/**
 * The left (Audio / Your turn / Privacy) column's panel, in design space. It
 * reaches the 684px title-safe bottom, which is what made room for the Privacy
 * section without moving a single Audio or Your turn control.
 */
export const SETTINGS_LEFT_PANEL = { x: 70, y: 124, width: 540, height: 560 } as const;

/** The same band as a top/bottom pair, for the layout assertions. */
export const SETTINGS_LEFT_PANEL_BAND = {
  top: SETTINGS_LEFT_PANEL.y,
  bottom: SETTINGS_LEFT_PANEL.y + SETTINGS_LEFT_PANEL.height,
} as const;

/**
 * The Reset save block, moved from under the Audio panel to under the Gameplay
 * panel when the left column grew (+600 in x, same rows). Its internal geometry
 * is unchanged, so the label, the armed button and the warning caption sit
 * exactly as they did relative to one another.
 */
export const SETTINGS_RESET_BLOCK = {
  labelX: 710,
  buttonX: 960,
  rowY: 620,
  captionY: 650,
  buttonMinWidth: 170,
} as const;

/**
 * The left column's second section, which holds the rows that decide how a
 * turn's actions get committed: Instant cast, and (v34) the land-drop
 * confirmation. The Gameplay column is full at six rows, so new rows of this
 * kind land here, and the section must stay inside the panel band - the last
 * row's caption overflowed it once before (user-reported 2026-07-12).
 */
export const YOUR_TURN_SECTION = {
  headingY: 414,
  firstRowY: 456,
  rowPitch: 64,
  noteOffset: 28,
  rowCount: 2,
} as const;

/** Y of row `index` in the "Your turn" section, and of its caption. */
export function yourTurnRowY(index: number): { row: number; note: number } {
  const row = YOUR_TURN_SECTION.firstRowY + index * YOUR_TURN_SECTION.rowPitch;
  return { row, note: row + YOUR_TURN_SECTION.noteOffset };
}
export const NO_BLOCK_LABEL_TRACK = { left: 710, right: 850 } as const;

/** Fixed widths do not change when the selected chip swaps visual variant. */
export const NO_BLOCK_CHIPS: readonly SettingsChipLayout[] = [
  { value: 'always', label: 'Always', minWidth: 80, x: 900 },
  { value: 'lethal', label: 'Only when lethal', minWidth: 120, x: 1030 },
  { value: 'off', label: 'Off', minWidth: 70, x: 1170 },
] as const;

export function settingsChipBounds(chip: SettingsChipLayout): { left: number; right: number } {
  return { left: chip.x - chip.minWidth / 2, right: chip.x + chip.minWidth / 2 };
}
