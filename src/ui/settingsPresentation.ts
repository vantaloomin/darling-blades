import type { ConfirmNoBlockSetting } from '../meta/SaveManager';
import { theme } from './theme';

/**
 * The Settings scene's layout, derived once from the design-system tokens
 * (docs/design-system.md, "Alignment and isolation space") instead of being
 * pinned row by row. Two columns of equal panels; every row inside a column
 * comes from the same rhythm, so the isolation space between a caption and
 * the next control, or between one section and the next, is the same number
 * everywhere.
 *
 * The scene had grown three coordinate systems by 1.8 (a row generator, two
 * hand-pinned constant blocks, and literal numbers), and the crowding the
 * owner flagged on the 1.8 QC day (2026-09-21) was the sum of them: the
 * Privacy heading ran into the caption above it, the Reset block sat on the
 * Gameplay panel's border, and the update control hung outside every panel.
 */

const HIT_HALF = theme.control.minHitHeight / 2; // 22
const HEADING_HALF = theme.type.h2 / 2; // 10
const CAPTION = theme.type.caption; // 14
/** Within one group: between a control's hit box and its neighbour. */
const GAP_WITHIN = theme.space(3); // 12
/** Between distinct groups, on top of the heading that names the next one. */
const GAP_BETWEEN = theme.space(6); // 24
/** A caption's centre sits this far under its row's centre. */
const CAPTION_OFFSET = theme.space(6) + 2; // 26
/** One caption line's box: the caption size plus its line spacing. */
const CAPTION_LINE = CAPTION + 4;

/** The two panels, mirrored: a 40px text inset on both sides of each. */
export const SETTINGS_PANELS = {
  top: 124, // under the 72px title row
  bottom: theme.design.safeBottom, // 684
  inset: theme.space(10), // 40
  left: { x: 70, width: 540 },
  right: { x: 670, width: 540 },
} as const;

export const SETTINGS_GAMEPLAY_PANEL = {
  left: SETTINGS_PANELS.right.x,
  right: SETTINGS_PANELS.right.x + SETTINGS_PANELS.right.width,
} as const;
/** Both columns share one vertical band. */
export const SETTINGS_PANEL_BAND = { top: SETTINGS_PANELS.top, bottom: SETTINGS_PANELS.bottom } as const;
export const SETTINGS_LEFT_PANEL = {
  x: SETTINGS_PANELS.left.x,
  y: SETTINGS_PANELS.top,
  width: SETTINGS_PANELS.left.width,
  height: SETTINGS_PANELS.bottom - SETTINGS_PANELS.top,
} as const;
export const SETTINGS_LEFT_PANEL_BAND = SETTINGS_PANEL_BAND;

/** Text columns: labels at the inset, controls on the column's control axis. */
export const SETTINGS_COLUMNS = {
  left: {
    labelX: SETTINGS_PANELS.left.x + SETTINGS_PANELS.inset, // 110
    /** The toggle axis; the volume stepper and the privacy pair straddle it. */
    controlX: 420,
    controlRight: SETTINGS_PANELS.left.x + SETTINGS_PANELS.left.width - SETTINGS_PANELS.inset, // 570
  },
  right: {
    labelX: SETTINGS_PANELS.right.x + SETTINGS_PANELS.inset, // 710
    /** Every control in this column shares one right edge, the text inset. */
    controlRight: SETTINGS_PANELS.right.x + SETTINGS_PANELS.right.width - SETTINGS_PANELS.inset, // 1170
  },
} as const;

export interface SettingsRowSpec {
  key: string;
  /** The row carries a caption under it. */
  caption?: boolean;
  /** Extra caption lines beyond the first (the Privacy caption wraps to two). */
  captionLines?: number;
}
export interface SettingsSectionSpec {
  key: string;
  title: string;
  rows: readonly SettingsRowSpec[];
}
export interface SettingsRowY {
  /** The row's label and control centre. */
  row: number;
  /** Centre of a one-line caption. */
  note: number;
  /** Top of the caption box, for a wrapped caption drawn with origin (0, 0). */
  noteTop: number;
  /** Lowest design-space y anything in this row reaches. */
  bottom: number;
}
export interface SettingsColumnLayout {
  headings: Readonly<Record<string, number>>;
  rows: Readonly<Record<string, SettingsRowY>>;
  /** Lowest y any content reaches; the panel bottom minus this is the inset. */
  contentBottom: number;
}

/**
 * Lay a column out top to bottom. Every gap is one of the two named gaps, and
 * the next thing's top is always measured from the lowest extent of the thing
 * above it, so a captioned row and a plain row give their neighbours the same
 * isolation space.
 */
export function layoutSettingsColumn(
  sections: readonly SettingsSectionSpec[],
  panelTop: number = SETTINGS_PANELS.top,
): SettingsColumnLayout {
  const headings: Record<string, number> = {};
  const rows: Record<string, SettingsRowY> = {};
  let extent = panelTop;
  for (const section of sections) {
    const headingY = extent + GAP_BETWEEN + HEADING_HALF;
    headings[section.key] = headingY;
    extent = headingY + HEADING_HALF;
    for (const spec of section.rows) {
      const row = extent + GAP_WITHIN + HIT_HALF;
      const note = row + CAPTION_OFFSET;
      const noteTop = note - CAPTION_LINE / 2;
      const lines = spec.caption ? 1 + (spec.captionLines ?? 0) : 0;
      const bottom = Math.max(row + HIT_HALF, lines > 0 ? noteTop + lines * CAPTION_LINE : 0);
      rows[spec.key] = { row, note, noteTop, bottom };
      extent = bottom;
    }
  }
  return { headings, rows, contentBottom: extent };
}

export const SETTINGS_LEFT_SECTIONS: readonly SettingsSectionSpec[] = [
  { key: 'audio', title: 'Audio', rows: [{ key: 'sfx' }, { key: 'volume', caption: true }, { key: 'music' }] },
  {
    key: 'yourTurn',
    title: 'Your turn',
    rows: [
      { key: 'instantCast', caption: true },
      { key: 'landDrop', caption: true },
    ],
  },
  { key: 'privacy', title: 'Privacy', rows: [{ key: 'stats', caption: true, captionLines: 1 }] },
];

export const SETTINGS_RIGHT_SECTIONS: readonly SettingsSectionSpec[] = [
  {
    key: 'gameplay',
    title: 'Gameplay',
    rows: [
      { key: 'animations', caption: true },
      { key: 'renderSize', caption: true },
      { key: 'autoSkip' },
      { key: 'confirmDestructive' },
      { key: 'keywordReminders' },
      { key: 'noBlock' },
    ],
  },
  { key: 'saveData', title: 'Save data', rows: [{ key: 'reset', caption: true }] },
];

export const SETTINGS_LEFT = layoutSettingsColumn(SETTINGS_LEFT_SECTIONS);
export const SETTINGS_RIGHT = layoutSettingsColumn(SETTINGS_RIGHT_SECTIONS);

/** The "Your turn" section by index, for the modules and tests that read it that way. */
export const YOUR_TURN_SECTION = {
  headingY: SETTINGS_LEFT.headings.yourTurn,
  firstRowY: SETTINGS_LEFT.rows.instantCast.row,
  rowPitch: SETTINGS_LEFT.rows.landDrop.row - SETTINGS_LEFT.rows.instantCast.row,
  noteOffset: CAPTION_OFFSET,
  rowCount: 2,
} as const;

/** Y of row `index` in the "Your turn" section, and of its caption. */
export function yourTurnRowY(index: number): { row: number; note: number } {
  const row = YOUR_TURN_SECTION.firstRowY + index * YOUR_TURN_SECTION.rowPitch;
  return { row, note: row + YOUR_TURN_SECTION.noteOffset };
}

/**
 * The Reset save row: the right column's last section, with the warning as
 * its caption. The button is a `md` danger control (it arms to a longer
 * label), right-aligned like every other control in the column.
 */
export const SETTINGS_RESET_BLOCK = {
  labelX: SETTINGS_COLUMNS.right.labelX,
  buttonRight: SETTINGS_COLUMNS.right.controlRight,
  rowY: SETTINGS_RIGHT.rows.reset.row,
  captionY: SETTINGS_RIGHT.rows.reset.note,
  buttonMinWidth: 170,
} as const;

/**
 * The header's right-hand controls, mirroring the back button at the left.
 * "Check for updates" belongs with the version, not with any settings group;
 * it used to hang under the right panel at y 690, outside every panel and
 * past the title-safe frame's 684. "Legal" joins it there for the same reason:
 * the three published pages are about the whole game, not about any one row.
 */
export const SETTINGS_HEADER_ACTION = {
  right: SETTINGS_GAMEPLAY_PANEL.right,
  /** On the shared header line with the back button and the scene title. */
  y: theme.design.headerCenterY,
  /** The status line under it, right-aligned to the same edge. */
  statusY: theme.design.headerCenterY + HIT_HALF + theme.space(2) + CAPTION / 2,
  minWidth: 150,
} as const;

/** The second header control, left of the update check and on its row. */
export const SETTINGS_HEADER_LEGAL = {
  y: SETTINGS_HEADER_ACTION.y,
  minWidth: 96,
} as const;

/**
 * The centred scene title's track. Its rendered width is font-fallback
 * dependent, so the header controls clear a generous allowance rather than a
 * measurement: eight display-size glyphs either side of centre.
 */
export const SETTINGS_TITLE_TRACK = {
  centerX: theme.design.centerX,
  halfWidth: theme.type.display * 4,
} as const;

// ---------------------------------------------------------------------------
// Chip groups in the right column: fixed widths, right-aligned as a group to
// the column's control edge, one gap between siblings.
// ---------------------------------------------------------------------------

export interface SettingsChipLayout {
  value: ConfirmNoBlockSetting;
  label: string;
  minWidth: number;
  x: number;
}
const CHIP_GAP = theme.space(2); // 8

/** Centres for chips of the given widths, right-aligned as a group to `right`. */
export function rightAlignedChipCenters(
  widths: readonly number[],
  right: number = SETTINGS_COLUMNS.right.controlRight,
): number[] {
  const centers: number[] = [];
  let edge = right;
  for (let i = widths.length - 1; i >= 0; i--) {
    centers[i] = edge - widths[i] / 2;
    edge -= widths[i] + CHIP_GAP;
  }
  return centers;
}

export const NO_BLOCK_LABEL_TRACK = { left: SETTINGS_COLUMNS.right.labelX, right: 850 } as const;

const NO_BLOCK_WIDTHS = [80, 120, 70] as const;
const NO_BLOCK_X = rightAlignedChipCenters(NO_BLOCK_WIDTHS);
/** Fixed widths do not change when the selected chip swaps visual variant. */
export const NO_BLOCK_CHIPS: readonly SettingsChipLayout[] = [
  { value: 'always', label: 'Always', minWidth: NO_BLOCK_WIDTHS[0], x: NO_BLOCK_X[0] },
  { value: 'lethal', label: 'Only when lethal', minWidth: NO_BLOCK_WIDTHS[1], x: NO_BLOCK_X[1] },
  { value: 'off', label: 'Off', minWidth: NO_BLOCK_WIDTHS[2], x: NO_BLOCK_X[2] },
] as const;

export function settingsChipBounds(chip: SettingsChipLayout): { left: number; right: number } {
  return { left: chip.x - chip.minWidth / 2, right: chip.x + chip.minWidth / 2 };
}

/** The other two chip groups, same rule. */
export const ANIM_CHIP_WIDTH = 82;
export const ANIM_CHIP_X = rightAlignedChipCenters([ANIM_CHIP_WIDTH, ANIM_CHIP_WIDTH, ANIM_CHIP_WIDTH]);
export const RENDER_CHIP_WIDTH = 84;
export const RENDER_CHIP_X = rightAlignedChipCenters([RENDER_CHIP_WIDTH, RENDER_CHIP_WIDTH, RENDER_CHIP_WIDTH]);
/** A toggle at the 90px hit floor, right-aligned to the control edge. */
export const RIGHT_TOGGLE_X = SETTINGS_COLUMNS.right.controlRight - theme.control.minHitWidth / 2; // 1125

export interface SettingsHeaderCenters {
  legalX: number;
  updateX: number;
}

/**
 * Where the header pair goes once both hit widths are measured: the update
 * check right-aligned to the header edge, "Legal" one isolation gap to its
 * left. Measure-then-place, and the same right-aligned-group rule the chip
 * rows in the right column already use, so the gap between the two hit boxes
 * is the design system's within-group space wherever the labels land.
 */
export function settingsHeaderCenters(
  legalHitWidth: number,
  updateHitWidth: number,
): SettingsHeaderCenters {
  const [legalX, updateX] = rightAlignedChipCenters(
    [legalHitWidth, updateHitWidth],
    SETTINGS_HEADER_ACTION.right,
  );
  return { legalX, updateX };
}

/** The gap the header pair, like every chip group, leaves between hit boxes. */
export const SETTINGS_CONTROL_GAP = CHIP_GAP;
