/**
 * Profile's compact (phone) composition, Phaser-free (mocks M-Profile,
 * M-ExportSave, M-SaveCard, M-ImportSave, M-ConfirmReplace;
 * docs/plan-mobile-overhaul.md, mobile wave 2).
 *
 * The main pane splits in two: the record and the showcase on the left, the
 * stat tabs and their rows in the centre. The command column lists the
 * replays, scrolling, with Import save and Export save at its foot. The save
 * dialogs keep that frame: a sheet over the main pane for the code or the art
 * grid, and the column for what acts on it. Coordinates are compact design px
 * inside the content box.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';

export const PROFILE_COMPACT = {
  /** The record's column: a share of the main pane, inside a floor and ceiling. */
  recordShare: 0.34,
  recordMin: 136,
  recordMax: 170,
  /** Between the record's column and the stats. */
  paneGap: 10,
  /** A stat row (not a control, so under the touch floor) and the gap between two. */
  statRowH: 36,
  statRowGap: 6,
  /** Between the tab bar and the first row. */
  tabsGap: 12,
  /** Inside a stat row, either side. */
  statInset: 12,
  /** Between a value and its win rate. */
  rateGap: 18,
  /** A showcase seal's padding above and below its two lines, and the gap between seals. */
  sealPadY: 6,
  sealGap: 10,
  /** The seals' small tilt, as on the desktop's plaques. */
  sealAngle: -1.5,
  /** Under the heading, before the replay list. */
  headingGap: 6,
  /** A replay card's padding, its portrait and the gap between two cards. */
  replayPad: 6,
  portrait: 34,
  replayGap: 8,
  /** The list's scroll thumb lane, right of the cards. */
  thumbLane: 7,
  /** Inside the save dialogs' column plate. */
  sidePad: 14,
  /** The save card art grid: columns at the mocks' width, and the label under a thumb. */
  gridColumns: 5,
  gridGap: 10,
} as const;

export interface CompactProfileLayout {
  shell: CompactShell;
  /** The record, the win rate and the showcase. */
  record: Rect;
  /** The stat tabs' bar, or both bars when there are two. */
  tabs: Rect;
  /** Where the active tab's rows and note scroll. */
  rows: Rect;
  /** The column's top, where "Replays" sits. */
  replaysTop: number;
  /** The column between the heading and the foot (the caller places the list under its heading). */
  replays: Rect;
  /** The foot: Import save left, Export save (the primary) right; stacked when the pair does not fit. */
  importSave: Rect;
  exportSave: Rect;
}

/**
 * The shell, the two main-pane columns and the column's foot. `footNeeds` are
 * the two foot buttons' measured widths; when they cannot share a row,
 * Import save goes above Export save.
 */
export function compactProfileLayout(
  content: Rect,
  footNeeds: { importSave: number; exportSave: number },
  /** The stat tabs' rows: two (two tabs each) when the four labels cannot share one bar (Largest text on the smallest phone). */
  tabRows: 1 | 2 = 1,
): CompactProfileLayout {
  const P = PROFILE_COMPACT;
  const { touch, gap } = COMPACT;
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  const recordW = Math.round(Math.min(P.recordMax, Math.max(P.recordMin, main.width * P.recordShare)));
  const record = { x: main.x, y: main.y, width: recordW, height: main.height };
  const statsX = main.x + recordW + P.paneGap;
  const statsW = Math.max(0, main.x + main.width - statsX);
  const tabs = { x: statsX, y: main.y, width: statsW, height: touch * tabRows + gap * (tabRows - 1) };
  const rowsY = tabs.y + tabs.height + P.tabsGap;
  const rows = { x: statsX, y: rowsY, width: statsW, height: Math.max(0, main.y + main.height - rowsY) };
  const footY = column.y + column.height - touch;
  let importSave: Rect;
  let exportSave: Rect;
  if (footNeeds.importSave + gap + footNeeds.exportSave <= column.width) {
    // The spare width split between the two, so neither reads as cramped.
    const importW = Math.round(footNeeds.importSave + (column.width - gap - footNeeds.importSave - footNeeds.exportSave) / 2);
    importSave = { x: column.x, y: footY, width: importW, height: touch };
    exportSave = { x: column.x + importW + gap, y: footY, width: column.width - importW - gap, height: touch };
  } else {
    exportSave = { x: column.x, y: footY, width: column.width, height: touch };
    importSave = { x: column.x, y: footY - gap - touch, width: column.width, height: touch };
  }
  const footTop = Math.min(importSave.y, exportSave.y);
  return {
    shell,
    record,
    tabs,
    rows,
    replaysTop: column.y,
    replays: { x: column.x, y: column.y, width: column.width, height: Math.max(0, footTop - gap - column.y) },
    importSave,
    exportSave,
  };
}

/**
 * A stat row's two right-hand columns: the win rate right-aligned at the row's
 * inset and the value right-aligned before it, so the rates line up down the
 * tab whatever the values' widths. Returns the right edges, and the room left
 * for the label.
 */
export function profileStatColumns(row: Rect, rateWidth: number, valueWidth: number): { rateRight: number; valueRight: number; labelWidth: number } {
  const P = PROFILE_COMPACT;
  const rateRight = row.x + row.width - P.statInset;
  const valueRight = rateWidth > 0 ? rateRight - rateWidth - P.rateGap : rateRight;
  return { rateRight, valueRight, labelWidth: Math.max(0, valueRight - valueWidth - P.rateGap - (row.x + P.statInset)) };
}

export interface CompactSaveDialogLayout {
  /** The sheet over the main pane and the top bar: the code box, the preview, or the art grid. */
  sheet: Rect;
  /** The column's plate above the primary. */
  side: Rect;
  /** The column's foot: Copy, Replace save, Download save card. */
  primary: Rect;
}

/**
 * The save dialogs' frame (M-ExportSave, M-ImportSave, M-SaveCard): the sheet
 * runs from the content's top, over the top bar, and the column keeps its
 * width with the action at its foot.
 */
export function compactSaveDialogLayout(content: Rect): CompactSaveDialogLayout {
  const { touch, gap } = COMPACT;
  const columnW = compactShell(content, { back: false }).column?.width ?? 0;
  const sheet = { x: content.x, y: content.y, width: Math.max(0, content.width - columnW - gap), height: content.height };
  const columnX = sheet.x + sheet.width + gap;
  const primary = { x: columnX, y: content.y + content.height - touch, width: columnW, height: touch };
  const side = { x: columnX, y: content.y, width: columnW, height: Math.max(0, primary.y - gap - content.y) };
  return { sheet, side, primary };
}

/** The save card art grid: the thumb width for `columns` across `width`. */
export function profileArtGrid(width: number, columns: number = PROFILE_COMPACT.gridColumns): { thumbW: number; pitchX: number } {
  const gap = PROFILE_COMPACT.gridGap;
  const thumbW = Math.max(0, (width - gap * (columns - 1)) / columns);
  return { thumbW, pitchX: thumbW + gap };
}
