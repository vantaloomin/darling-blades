import { GAP_FLOORS, type Rect } from './layout';
import { theme } from './theme';

/**
 * The Profile scene's layout, derived from the design-system tokens and the
 * title-safe frame (docs/design-system.md, "Alignment and isolation space")
 * the way `settingsPresentation.ts` derives Settings. Nothing in
 * `ProfileScene.ts` carries a coordinate of its own.
 *
 * Until 1.8.1 the scene was about thirty literal positions, and the 1.8 QC day
 * (2026-09-22) flagged it as the one screen still off the shared rhythm. The
 * literals had drifted into real collisions: the stat tabs sat 22px left of
 * the rows they switch, the third showcase seal ran into the win record once
 * a player passed a hundred wins, the "Showcase" label sat inside the back
 * button's hit box, a long opponent name wrapped onto the line under it, the
 * Watch button's hit box poked out of its row, the save-card search field
 * covered the top of the first row of cards, and the Replace-save
 * confirmation drew its question above its own panel.
 *
 * Conventions, the same as Settings:
 * - A line of text is its font size tall, centred on its y.
 * - A control is its hit box: 44 tall (`theme.control.minHitHeight`).
 * - The next thing's top is measured from the lowest extent of the thing
 *   above it, plus one of the named gaps below.
 */

// ---------------------------------------------------------------------------
// The rhythm
// ---------------------------------------------------------------------------

const HIT_HEIGHT = theme.control.minHitHeight; // 44
const HIT_HALF = HIT_HEIGHT / 2; // 22
/** Within one datum: a label and the thing it names, lines of one block. */
const GAP_DATUM = theme.space(1); // 4
/** Between the rows of one list or grid: one gutter for the whole screen. */
const GAP_LIST = theme.space(2); // 8
/** Within one related group. */
const GAP_WITHIN = theme.space(3); // 12
/** Between distinct groups, and the minimum a horizontal group boundary keeps. */
const GAP_GROUP = theme.space(4); // 16
/** Between regions: the header band and the panels, a panel's edge and its first heading. */
const GAP_BETWEEN = theme.space(6); // 24
/** A panel's side inset; rows, headings and the tab strip all start here. */
const PANEL_INSET = theme.space(8); // 32
/** Text inside a row box sits this far in from the box's side. */
const TEXT_INSET = theme.space(3); // 12

/** The named gaps, exported for the rule tests. */
export const PROFILE_GAPS = {
  datum: GAP_DATUM,
  list: GAP_LIST,
  within: GAP_WITHIN,
  group: GAP_GROUP,
  between: GAP_BETWEEN,
} as const;

/** Box height of `lines` lines of `fontSize` text with `lineSpacing` between them. */
export function textBlockHeight(fontSize: number, lines: number, lineSpacing = 0): number {
  // Phaser's line box for Inter is about 1.25 x the font size; the rule tests
  // hold wrapped blocks to this, so it errs on the tall side.
  return lines * Math.ceil(fontSize * 1.25) + Math.max(0, lines - 1) * lineSpacing;
}

// ---------------------------------------------------------------------------
// Rows of controls: measure-then-place
// ---------------------------------------------------------------------------

function gapAt(gaps: number | readonly number[], index: number): number {
  return typeof gaps === 'number' ? gaps : gaps[index];
}

/** Centres for boxes laid left to right from `left`, `gaps[i]` after box i. */
export function packLeft(widths: readonly number[], left: number, gaps: number | readonly number[]): number[] {
  const centers: number[] = [];
  let edge = left;
  widths.forEach((width, i) => {
    centers.push(edge + width / 2);
    edge += width + (i < widths.length - 1 ? gapAt(gaps, i) : 0);
  });
  return centers;
}

/** Total span of a packed row. */
export function packedWidth(widths: readonly number[], gaps: number | readonly number[]): number {
  return widths.reduce((sum, width, i) => sum + width + (i > 0 ? gapAt(gaps, i - 1) : 0), 0);
}

/** Centres for a packed row whose right edge sits on `right`. */
export function packRight(widths: readonly number[], right: number, gaps: number | readonly number[]): number[] {
  return packLeft(widths, right - packedWidth(widths, gaps), gaps);
}

/** Centres for a packed row centred on `centerX`. */
export function packCentered(widths: readonly number[], centerX: number, gaps: number | readonly number[]): number[] {
  return packLeft(widths, centerX - packedWidth(widths, gaps) / 2, gaps);
}

// ---------------------------------------------------------------------------
// Header: the back link and the title share the frame's header line
// ---------------------------------------------------------------------------

export const PROFILE_HEADER = {
  y: theme.design.headerCenterY, // 58, the back button's row
  titleX: theme.design.centerX,
  /**
   * The title's width is font-fallback dependent, so neighbours clear an
   * allowance rather than a measurement: six display-size glyphs either side.
   */
  titleHalfWidth: theme.type.display * 3,
  bottom: theme.design.safeTop + HIT_HEIGHT, // 80
} as const;

// ---------------------------------------------------------------------------
// Record row: the win record in the centre, the save actions at the right
// edge, the trophy showcase at the left edge
// ---------------------------------------------------------------------------

const RECORD_TOP = PROFILE_HEADER.bottom + GAP_WITHIN; // 92
const RECORD_Y = RECORD_TOP + HIT_HALF; // 114

export const PROFILE_RECORD = {
  x: theme.design.centerX,
  top: RECORD_TOP,
  /** The W / L line; the save actions share it. */
  y: RECORD_Y,
  /** The win-rate line under it. */
  rateY: RECORD_Y + theme.type.h1 / 2 + GAP_WITHIN + theme.type.body / 2, // 148
  /**
   * Allowance for the centred record lines: eight h1-size glyphs either side,
   * which holds four-digit win and loss counts and a three-digit duel count.
   */
  halfWidth: theme.type.h1 * 4, // 112
} as const;

/**
 * Export and Import, right-aligned to the frame (and so to the right panel's
 * edge) on the record line. The import notice ("Save imported") is their
 * status line, right-aligned under them the way Settings hangs its update
 * status under its header control.
 */
export const PROFILE_SAVE_ACTIONS = {
  right: theme.design.safeRight,
  y: RECORD_Y,
  minWidth: 160,
  gap: GAP_WITHIN,
  noticeY: RECORD_Y + HIT_HALF + theme.space(2) + theme.type.label / 2, // 151
} as const;

/** Where the pair goes once both hit widths are measured. */
export function profileSaveActionCenters(
  exportHitWidth: number,
  importHitWidth: number,
): { exportX: number; importX: number } {
  const [exportX, importX] = packRight(
    [exportHitWidth, importHitWidth],
    PROFILE_SAVE_ACTIONS.right,
    PROFILE_SAVE_ACTIONS.gap,
  );
  return { exportX, importX };
}

/** The axis-aligned box a `width` x `height` plate covers once tilted by `angleDeg`. */
export function rotatedSize(width: number, height: number, angleDeg: number): { width: number; height: number } {
  const radians = (Math.abs(angleDeg) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { width: width * cos + height * sin, height: width * sin + height * cos };
}

const SEAL_HEIGHT = 48;
/** The plate width the showcase was drawn at before 1.8.1; the derived width never exceeds it. */
const SEAL_MAX_WIDTH = 148;
const SEAL_ANGLE = -3;
const SEAL_COUNT = 3;
const SHOWCASE_LEFT = theme.design.safeLeft;
/** The seals end a group gap short of the record's allowance. */
const SHOWCASE_LIMIT = PROFILE_RECORD.x - PROFILE_RECORD.halfWidth - GAP_GROUP;

function sealRow(width: number): { xs: number[]; right: number; tilted: { width: number; height: number } } {
  const tilted = rotatedSize(width, SEAL_HEIGHT, SEAL_ANGLE);
  const first = SHOWCASE_LEFT + Math.ceil(tilted.width / 2);
  const pitch = width + GAP_WITHIN;
  const xs = Array.from({ length: SEAL_COUNT }, (_, i) => first + i * pitch);
  return { xs, right: xs[SEAL_COUNT - 1] + tilted.width / 2, tilted };
}

/** The widest plate (up to the old 148) whose row of three still clears the record. */
function fitSealWidth(): number {
  let width = SEAL_MAX_WIDTH;
  while (width > 0 && sealRow(width).right > SHOWCASE_LIMIT) width -= 1;
  return width;
}

const SEAL_WIDTH = fitSealWidth();
const SEAL_ROW = sealRow(SEAL_WIDTH);
const SHOWCASE_LABEL_Y = RECORD_TOP + theme.type.micro / 2;
const SEAL_Y = RECORD_TOP + theme.type.micro + GAP_DATUM + Math.ceil(SEAL_ROW.tilted.height / 2);
/** The seal's two lines (title, CLAIMED) as one block centred on the plate. */
const SEAL_LINES = theme.type.caption + theme.space(2) + theme.type.micro;

/**
 * Trophy Hall showcase: up to three claimed achievements as tilted plaques
 * under a "Showcase" label, from the frame's left edge. The plate width is
 * derived so the row of three ends a group gap short of the record, whatever
 * the pin count (the geometry never jumps between one pin and three).
 */
export const PROFILE_SHOWCASE = {
  maxPins: SEAL_COUNT,
  left: SHOWCASE_LEFT,
  labelY: SHOWCASE_LABEL_Y,
  sealY: SEAL_Y,
  sealWidth: SEAL_WIDTH,
  sealHeight: SEAL_HEIGHT,
  angle: SEAL_ANGLE,
  xs: SEAL_ROW.xs,
  /** The tilted plate's axis-aligned box, for the rule tests. */
  tilted: SEAL_ROW.tilted,
  /** The inner gold stroke's inset from the plate edge. */
  innerInset: GAP_DATUM,
  /** Plate-local centres of the title and CLAIMED lines. */
  titleY: -SEAL_LINES / 2 + theme.type.caption / 2,
  claimedY: SEAL_LINES / 2 - theme.type.micro / 2,
  titleMaxWidth: SEAL_WIDTH - 2 * theme.space(2),
  bottom: SEAL_Y + SEAL_ROW.tilted.height / 2,
} as const;

/** The lowest thing in the header band; the panels start a region gap under it. */
export const PROFILE_HEADER_BAND_BOTTOM = Math.max(
  PROFILE_RECORD.rateY + theme.type.body / 2,
  PROFILE_SAVE_ACTIONS.noticeY + theme.type.label / 2,
  PROFILE_SHOWCASE.bottom,
);

// ---------------------------------------------------------------------------
// The two panels
// ---------------------------------------------------------------------------

/** Left-panel stat tabs (1.6.3). */
export type ProfileStatTab = 'practice' | 'gauntlet' | 'draft' | 'collection';
export const PROFILE_STAT_TABS: readonly { key: ProfileStatTab; label: string }[] = [
  { key: 'practice', label: 'Practice' },
  { key: 'gauntlet', label: 'Gauntlet' },
  { key: 'draft', label: 'Draft' },
  { key: 'collection', label: 'Collection' },
];
const TAB_WIDTH = 100;
const TAB_STRIP_WIDTH = packedWidth(PROFILE_STAT_TABS.map(() => TAB_WIDTH), GAP_WITHIN); // 436

const PANEL_TOP = Math.ceil(PROFILE_HEADER_BAND_BOTTOM) + GAP_BETWEEN;
const LEFT_PANEL_WIDTH = TAB_STRIP_WIDTH + 2 * PANEL_INSET;
const RIGHT_PANEL_X = theme.design.safeLeft + LEFT_PANEL_WIDTH + GAP_BETWEEN;

/**
 * Two panels spanning the frame edge to edge, from under the header band to
 * the frame's bottom. The left one is as wide as the tab strip plus its
 * insets; the right one (Replays) takes the rest.
 */
export const PROFILE_PANELS = {
  top: PANEL_TOP,
  bottom: theme.design.safeBottom,
  inset: PANEL_INSET,
  gap: GAP_BETWEEN,
  left: { x: theme.design.safeLeft, width: LEFT_PANEL_WIDTH },
  right: { x: RIGHT_PANEL_X, width: theme.design.safeRight - RIGHT_PANEL_X },
  /** The panels' head line: the tab strip on the left, the Replays heading on the right. */
  headY: PANEL_TOP + GAP_BETWEEN + theme.type.h2 / 2,
} as const;

/** Content keeps at least this much clear of a panel's bottom edge. */
export const PROFILE_PANEL_BOTTOM_INSET = GAP_GROUP;

const LEFT_CONTENT_X = PROFILE_PANELS.left.x + PANEL_INSET;
const RIGHT_CONTENT_X = PROFILE_PANELS.right.x + PANEL_INSET;
const RIGHT_CONTENT_WIDTH = PROFILE_PANELS.right.width - 2 * PANEL_INSET;

/** The tab strip spans exactly the stat-row column under it. */
export const PROFILE_TAB_STRIP = {
  y: PROFILE_PANELS.headY,
  width: TAB_WIDTH,
  gap: GAP_WITHIN,
  xs: packLeft(PROFILE_STAT_TABS.map(() => TAB_WIDTH), LEFT_CONTENT_X, GAP_WITHIN),
} as const;

const STAT_ROW_HEIGHT = 30;
const STAT_ROW_PITCH = STAT_ROW_HEIGHT + GAP_LIST;
const STAT_ROWS_TOP = PROFILE_PANELS.headY + HIT_HALF + GAP_WITHIN;
const STAT_NOTE_LINE = textBlockHeight(theme.type.micro, 1);

/** The stat table under the tabs; every tab shares this rhythm. */
export const PROFILE_STAT_ROWS = {
  x: LEFT_CONTENT_X,
  width: TAB_STRIP_WIDTH,
  height: STAT_ROW_HEIGHT,
  gap: GAP_LIST,
  top: STAT_ROWS_TOP,
  textLeft: LEFT_CONTENT_X + TEXT_INSET,
  textRight: LEFT_CONTENT_X + TAB_STRIP_WIDTH - TEXT_INSET,
  noteWrap: TAB_STRIP_WIDTH - 2 * TEXT_INSET,
  noteLineSpacing: 2,
} as const;

/** Centre y of stat row `index`. */
export function profileStatRowY(index: number): number {
  return STAT_ROWS_TOP + index * STAT_ROW_PITCH + STAT_ROW_HEIGHT / 2;
}

/** Top of the note under `rowsAbove` rows (drawn with origin (0, 0), so a wrap grows downward). */
export function profileStatNoteTop(rowsAbove: number): number {
  if (rowsAbove <= 0) return STAT_ROWS_TOP;
  return STAT_ROWS_TOP + rowsAbove * STAT_ROW_PITCH - GAP_LIST + GAP_WITHIN;
}

/** How many rows fit above a one-line note inside the left panel's bottom inset. */
export const PROFILE_STAT_ROW_CAPACITY = (() => {
  let rows = 0;
  while (profileStatNoteTop(rows + 1) + STAT_NOTE_LINE <= PROFILE_PANELS.bottom - PROFILE_PANEL_BOTTOM_INSET) rows += 1;
  return rows;
})();

// ---------------------------------------------------------------------------
// Replays: a two-column grid of cells, read down the first column first
// ---------------------------------------------------------------------------

const REPLAY_COLUMNS = 2;
const REPLAY_ROWS = 5;
const REPLAY_PAD_X = TEXT_INSET;
const REPLAY_PAD_Y = GAP_LIST;
const WATCH_MIN_WIDTH = 78;
const WATCH_HEIGHT = theme.control.heightSm; // the Watch button's visual; its track is line 1
const REPLAY_TITLE_Y = REPLAY_PAD_Y + WATCH_HEIGHT / 2;
const REPLAY_META_Y = REPLAY_PAD_Y + WATCH_HEIGHT + GAP_DATUM + theme.type.caption / 2;
const REPLAY_NOTE_Y = REPLAY_META_Y + theme.type.caption / 2 + GAP_DATUM + theme.type.micro / 2;
const REPLAY_CELL_HEIGHT = REPLAY_NOTE_Y + theme.type.micro / 2 + REPLAY_PAD_Y;
const REPLAY_CELL_WIDTH = (RIGHT_CONTENT_WIDTH - (REPLAY_COLUMNS - 1) * GAP_LIST) / REPLAY_COLUMNS;
const REPLAYS_TOP = PROFILE_PANELS.headY + theme.type.h2 / 2 + GAP_WITHIN;

export const PROFILE_REPLAYS = {
  headingX: RIGHT_CONTENT_X,
  headingY: PROFILE_PANELS.headY,
  left: RIGHT_CONTENT_X,
  top: REPLAYS_TOP,
  width: RIGHT_CONTENT_WIDTH,
  columns: REPLAY_COLUMNS,
  rows: REPLAY_ROWS,
  capacity: REPLAY_COLUMNS * REPLAY_ROWS,
  gutter: GAP_LIST,
  cellWidth: REPLAY_CELL_WIDTH,
  cellHeight: REPLAY_CELL_HEIGHT,
  /** The empty state sits where the first replay's name would. */
  emptyY: REPLAYS_TOP + REPLAY_TITLE_Y,
  emptyWrap: RIGHT_CONTENT_WIDTH,
} as const;

/** The cell for replay `index`: column-major, so the newest five read down the left column. */
export function profileReplayCell(index: number): Rect {
  const column = Math.floor(index / REPLAY_ROWS);
  const row = index % REPLAY_ROWS;
  return {
    x: RIGHT_CONTENT_X + column * (REPLAY_CELL_WIDTH + GAP_LIST),
    y: REPLAYS_TOP + row * (REPLAY_CELL_HEIGHT + GAP_LIST),
    width: REPLAY_CELL_WIDTH,
    height: REPLAY_CELL_HEIGHT,
  };
}

/**
 * Inside a cell (cell-local offsets). Line 1 is the Watch button's track, so
 * the button keeps its padding from the cell's edge and the opponent's name
 * shares its centre line; the mode/result line and, for a replay recorded on
 * an older version, its note stack under it. A replayable cell has a Watch
 * button and no note; an unplayable one has the note and no button, and both
 * keep the same line positions.
 */
export const PROFILE_REPLAY_ROW = {
  textX: REPLAY_PAD_X,
  titleY: REPLAY_TITLE_Y,
  metaY: REPLAY_META_Y,
  noteY: REPLAY_NOTE_Y,
  padX: REPLAY_PAD_X,
  padY: REPLAY_PAD_Y,
  textWidth: REPLAY_CELL_WIDTH - 2 * REPLAY_PAD_X,
  watchMinWidth: WATCH_MIN_WIDTH,
  watchHeight: WATCH_HEIGHT,
} as const;

/** Cell-local centre x of a Watch button of the measured visual width: right-aligned to the text inset. */
export function profileWatchX(watchVisualWidth: number): number {
  return REPLAY_CELL_WIDTH - REPLAY_PAD_X - watchVisualWidth / 2;
}

/** How wide the opponent's name may run before it is ellipsized (0 = no Watch button in the cell). */
export function profileReplayNameWidth(watchVisualWidth: number): number {
  if (watchVisualWidth <= 0) return PROFILE_REPLAY_ROW.textWidth;
  return PROFILE_REPLAY_ROW.textWidth - watchVisualWidth - GAP_LIST;
}

// ---------------------------------------------------------------------------
// Modals: every position comes from the shell's reserved tracks
// (modalShell -> layout.ts modalShellLayout), so the scene passes
// `shell.tracks` and the rule tests pass `modalShellLayout(...)`.
// ---------------------------------------------------------------------------

export interface ProfileModalTracks {
  titleTrack: Rect;
  contentBounds: Rect;
  footerTrack: Rect;
  closeTrack: Rect;
}

const midX = (r: Rect): number => r.x + r.width / 2;
const midY = (r: Rect): number => r.y + r.height / 2;

/**
 * Export, Import, the save-card picker and its art wait share one footprint
 * (so the picker covers the export dialog exactly): the frame less a spacing
 * step at the sides and a hair at the top and bottom.
 */
export const PROFILE_WIDE_MODAL = {
  width: theme.design.safeWidth - theme.space(8), // 1120
  height: theme.design.safeHeight - theme.space(2), // 640
} as const;

/** The Replace-save confirmation. */
export const PROFILE_CONFIRM_MODAL = {
  width: 820,
  height: 300,
  messageWrap: 650,
  messageLineSpacing: 5,
  cancelMinWidth: 120,
  confirmMinWidth: 170,
} as const;

export const PROFILE_EXPORT_MODAL = {
  copyWrap: 900,
  cardButtonMinWidth: 220,
  input: { width: 930, height: 200 },
  includeMinWidth: 210,
  copyMinWidth: 120,
} as const;

export interface ProfileExportLayout {
  x: number;
  titleY: number;
  /** The save-card sentence, and its button under it. */
  cardCopyY: number;
  cardButtonY: number;
  /** The code field's centre. */
  inputY: number;
  statusY: number;
  privacyY: number;
  footerY: number;
}

/** Card path (sentence, button), then code path (field, status), then the privacy line. */
export function profileExportLayout(t: ProfileModalTracks): ProfileExportLayout {
  const top = t.contentBounds.y;
  const label = theme.type.label;
  const cardCopyY = top + label / 2;
  const cardButtonY = cardCopyY + label / 2 + GAP_WITHIN + HIT_HALF;
  const inputTop = cardButtonY + HIT_HALF + GAP_BETWEEN;
  const statusY = inputTop + PROFILE_EXPORT_MODAL.input.height + GAP_WITHIN + label / 2;
  return {
    x: midX(t.contentBounds),
    titleY: midY(t.titleTrack),
    cardCopyY,
    cardButtonY,
    inputY: inputTop + PROFILE_EXPORT_MODAL.input.height / 2,
    statusY,
    privacyY: statusY + label / 2 + GAP_BETWEEN + label / 2,
    footerY: midY(t.footerTrack),
  };
}

/** Include-replays toggle and Copy, centred as one cluster in the footer track. */
export function profileExportFooterXs(t: ProfileModalTracks, includeHitWidth: number, copyHitWidth: number): number[] {
  return packCentered([includeHitWidth, copyHitWidth], midX(t.footerTrack), GAP_WITHIN);
}

export const PROFILE_IMPORT_MODAL = {
  input: { width: 930, height: 220 },
  previewLines: 7,
  previewLineSpacing: 3,
  previewMinWidth: 170,
  cardMinWidth: 190,
  replaceMinWidth: 180,
} as const;

export interface ProfileImportLayout {
  x: number;
  titleY: number;
  inputY: number;
  statusY: number;
  /** The decoded-save preview: top-left, aligned to the code field's left edge. */
  previewX: number;
  previewTop: number;
  footerY: number;
}

export function profileImportLayout(t: ProfileModalTracks): ProfileImportLayout {
  const top = t.contentBounds.y;
  const x = midX(t.contentBounds);
  const input = PROFILE_IMPORT_MODAL.input;
  const statusY = top + input.height + GAP_WITHIN + theme.type.label / 2;
  return {
    x,
    titleY: midY(t.titleTrack),
    inputY: top + input.height / 2,
    statusY,
    previewX: x - input.width / 2,
    previewTop: statusY + theme.type.label / 2 + GAP_WITHIN,
    footerY: midY(t.footerTrack),
  };
}

/**
 * Preview save and From save card, then Replace save: the destructive action
 * keeps the design system's 24px destructive separation from the routine pair.
 */
export function profileImportFooterXs(
  t: ProfileModalTracks,
  previewHitWidth: number,
  cardHitWidth: number,
  replaceHitWidth: number,
): number[] {
  return packCentered(
    [previewHitWidth, cardHitWidth, replaceHitWidth],
    midX(t.footerTrack),
    [GAP_WITHIN, GAP_FLOORS.destructive],
  );
}

export interface ProfileConfirmLayout {
  messageX: number;
  messageY: number;
  footerY: number;
}

/**
 * The question sits in the content area (clear of the close button's track),
 * the answers in the footer track. Before 1.8.1 the question was drawn at a
 * literal y above the panel, over the dim.
 */
export function profileConfirmLayout(t: ProfileModalTracks): ProfileConfirmLayout {
  return { messageX: midX(t.contentBounds), messageY: midY(t.contentBounds), footerY: midY(t.footerTrack) };
}

/** Cancel, then Replace save, a destructive gap apart. */
export function profileConfirmFooterXs(t: ProfileModalTracks, cancelHitWidth: number, confirmHitWidth: number): number[] {
  return packCentered([cancelHitWidth, confirmHitWidth], midX(t.footerTrack), GAP_FLOORS.destructive);
}

export const PROFILE_SAVE_CARD_PICKER = {
  columns: 8,
  rows: 3,
  /** Every thumb is a tap target (tap downloads), so the grid keeps compact-touch isolation. */
  gutter: GAP_FLOORS.compactTouch,
  searchWidth: 360,
  /**
   * The search field's CSS box (SearchInput.ts): a 14px line, 6px padding and
   * a 1px border top and bottom. Its focus ring (3px outline, 3px offset)
   * reaches 6px past that and must not cover the first row of cards.
   */
  searchHeight: Math.ceil(theme.type.label * 1.25) + 2 * 6 + 2 * 1,
  searchRing: 3 + 3,
  /** The thumb scale the picker was drawn at before 1.8.1; the derived scale never exceeds it. */
  maxThumbScale: 0.34,
  /**
   * A baked thumb is the card plus an 8px bleed top and bottom (card units),
   * which is part of the Image and so of its hit area (CardThumbCache.ts).
   */
  thumbBleed: 8,
} as const;

export interface ProfilePickerLayout {
  x: number;
  titleY: number;
  subtitleY: number;
  searchY: number;
  /** The grid band: from under the search's focus ring to the content bottom. */
  gridTop: number;
  gridBottom: number;
  thumbScale: number;
  thumbWidth: number;
  thumbHeight: number;
  /** Thumb centres, left to right and top to bottom. */
  columnXs: number[];
  rowYs: number[];
  emptyY: number;
  footerY: number;
}

/**
 * The picker, top to bottom: title (the close button's line), the sentence
 * that explains it, the search field, three rows of eight thumbs, the pager
 * in the footer track. Three rows at the old 0.34 scale need more height than
 * the content area has once the search clears the grid, so the scale is the
 * largest (to two places, capped at 0.34) at which the grid fits.
 *
 * `card` is the unscaled card size (CardView's CARD_W x CARD_H).
 */
export function profilePickerLayout(
  t: ProfileModalTracks,
  card: { width: number; height: number },
): ProfilePickerLayout {
  const p = PROFILE_SAVE_CARD_PICKER;
  const x = midX(t.contentBounds);
  const titleY = midY(t.titleTrack);
  const subtitleY = titleY + theme.type.h1 / 2 + GAP_DATUM + theme.type.label / 2;
  const searchY = subtitleY + theme.type.label / 2 + GAP_LIST + p.searchHeight / 2;
  const gridTop = searchY + p.searchHeight / 2 + p.searchRing + GAP_LIST;
  const gridBottom = t.contentBounds.y + t.contentBounds.height;
  const bledHeight = card.height + 2 * p.thumbBleed;
  const byHeight = (gridBottom - gridTop - (p.rows - 1) * p.gutter) / (p.rows * bledHeight);
  const byWidth = (t.contentBounds.width - (p.columns - 1) * p.gutter) / (p.columns * card.width);
  const thumbScale = Math.min(p.maxThumbScale, Math.floor(Math.min(byHeight, byWidth) * 100) / 100);
  const thumbWidth = card.width * thumbScale;
  const thumbHeight = bledHeight * thumbScale;
  const columnXs = packCentered(Array.from({ length: p.columns }, () => thumbWidth), x, p.gutter);
  const rowYs = Array.from({ length: p.rows }, (_, i) => gridTop + thumbHeight / 2 + i * (thumbHeight + p.gutter));
  return {
    x,
    titleY,
    subtitleY,
    searchY,
    gridTop,
    gridBottom,
    thumbScale,
    thumbWidth,
    thumbHeight,
    columnXs,
    rowYs,
    emptyY: (gridTop + gridBottom) / 2,
    footerY: midY(t.footerTrack),
  };
}
