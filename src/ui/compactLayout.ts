/**
 * Phaser-free geometry for the compact (phone) profile's shared primitives
 * (docs/plan-mobile-overhaul.md C6; mobile wave 1). Every scene that moves to
 * the compact profile composes from these, so the Version C mocks' shell, row
 * pitch and touch floor hold on every phone instead of being re-derived per
 * scene.
 *
 * Coordinates are compact design px: one per CSS px on a phone, inside the
 * content box `resolveScreenMetrics` returns (src/platform/screenMetrics.ts).
 * The numbers are the mocks' contract (VERSION-C.md in the mock bundle and the
 * generator's `shell`, `topBar`, `listRow`, `segmented`, `toggleRow`, `dialog`
 * and `sheet`).
 *
 * Every function returns visual rects and hit rects; `compactHitProblems`
 * checks a set of hit rects against the 44 px floor and the 8 px spacing rule.
 */

import { inactiveGap, inflateHitRect, type Rect } from './layout';

export const COMPACT = {
  /** The touch floor: every control's hit area is at least this square. */
  touch: 44,
  /** The minimum clear space between two controls' hit areas, unless they touch by design. */
  gap: 8,
  /** The command column's width on every screen. */
  columnW: 230,
  /** The top bar's height (back chevron, title, right slot). */
  topBarH: 44,
  /** List rows sit on this pitch, their hit areas touching (M27). */
  rowPitch: 48,
  /** A dialog's default size, centred on the design space. */
  dialogW: 440,
  dialogH: 220,
  dialogPad: { x: 22, y: 20 },
  /** A sheet's header: title and close button, inset from the sheet's edge. */
  sheetHeaderInset: 8,
  /** The track of an On/Off switch. */
  switchTrack: { width: 52, height: 32 },
} as const;

/** A control's drawn rect and the (never smaller) rect that takes taps. */
export interface CompactControl {
  visual: Rect;
  hit: Rect;
}

const control = (visual: Rect): CompactControl => ({
  visual,
  hit: inflateHitRect(visual, COMPACT.touch, COMPACT.touch),
});

// ------------------------------------------------------------------ the shell

export interface CompactShellOptions {
  /** Show the back chevron (every screen but the main menu). */
  back?: boolean;
  /** Screens that drop the column (ceremony screens, M24). */
  noColumn?: boolean;
  /** The command column's width; the default is the mocks' 230. */
  columnW?: number;
}

export interface CompactShell {
  /** The back chevron, top-left, when there is one. */
  back: CompactControl | null;
  /** Where the title (and its optional subtitle) starts and how wide it may run. */
  title: Rect;
  /** The top bar's right slot (currency, icon chips), right-aligned. */
  right: Rect;
  /** The content pane: grids, detail, art. */
  main: Rect;
  /** The command column, or null on a screen without one. */
  column: Rect | null;
  /** The primary action: the bottom of the column, under the right thumb. */
  primary: CompactControl | null;
}

/**
 * The Version C screen shell: a top bar, the main pane on the left, and the
 * command column on the right with its primary action at the bottom.
 */
export function compactShell(content: Rect, opts: CompactShellOptions = {}): CompactShell {
  const { touch, gap, topBarH } = COMPACT;
  const back = opts.back ?? true;
  const columnW = Math.min(opts.columnW ?? COMPACT.columnW, content.width);
  const top = content.y + topBarH + gap;
  const bottom = content.y + content.height;
  const titleX = back ? content.x + touch + 12 : content.x;
  const column = opts.noColumn
    ? null
    : { x: content.x + content.width - columnW, y: top, width: columnW, height: Math.max(0, bottom - top) };
  const mainRight = column ? column.x - gap : content.x + content.width;
  const rightW = Math.min(columnW, content.width / 2);
  return {
    back: back ? control({ x: content.x, y: content.y, width: touch, height: touch }) : null,
    title: { x: titleX, y: content.y, width: Math.max(0, content.x + content.width - rightW - gap - titleX), height: topBarH },
    right: { x: content.x + content.width - rightW, y: content.y, width: rightW, height: topBarH },
    main: { x: content.x, y: top, width: Math.max(0, mainRight - content.x), height: Math.max(0, bottom - top) },
    column,
    primary: column ? control({ x: column.x, y: bottom - touch, width: column.width, height: touch }) : null,
  };
}

// ------------------------------------------------------------------ lists

/** A list row's height: 44 at least, taller when its text grows (130% text). */
export function compactRowHeight(hasSubtitle: boolean, textScale = 1): number {
  const textBlock = hasSubtitle ? 40 : 30;
  return Math.max(COMPACT.touch, Math.ceil(textBlock * textScale) + 8);
}

export interface CompactListLayout {
  /** The rows that fit, top to bottom; each hit area spans its full pitch. */
  rows: CompactControl[];
  /** Rows that did not fit. When above 0, the last visible row is the "N more" row. */
  more: number;
}

/**
 * Rows down a pane on a fixed pitch with touching hit areas (M27). A list
 * longer than the pane shows fewer rows plus an "N more" row in the last slot
 * rather than a sliver, so the cue is never a cut-off control.
 */
export function compactList(pane: Rect, total: number, rowH: number = COMPACT.touch): CompactListLayout {
  const pitch = rowH + (COMPACT.rowPitch - COMPACT.touch);
  const count = Math.max(0, Math.floor(total));
  const fit = pane.height >= rowH ? 1 + Math.floor((pane.height - rowH) / pitch) : 0;
  const shown = count <= fit ? count : fit;
  const rows: CompactControl[] = [];
  for (let i = 0; i < shown; i++) {
    const visual = { x: pane.x, y: pane.y + i * pitch, width: pane.width, height: rowH };
    rows.push({ visual, hit: { x: pane.x, y: visual.y - (pitch - rowH) / 2, width: pane.width, height: pitch } });
  }
  // The last slot becomes "N more", so it hides one more row than the overflow.
  const more = count > fit && fit > 0 ? count - (fit - 1) : count > fit ? count : 0;
  return { rows, more };
}

// ------------------------------------------------------------------ grids

export interface CompactGridOptions {
  /** The narrowest a card may be drawn; columns drop before cards shrink below it. */
  minCardW: number;
  /** Card height over width (the 300x420 face is 1.4). */
  aspect?: number;
  gap?: number;
  /** Fewer columns at larger text (VERSION-C: grids drop a column). */
  dropColumns?: number;
}

export interface CompactGridLayout {
  columns: number;
  cardW: number;
  cardH: number;
  /** Rows wholly visible in the pane; the next one is the partly cut scroll cue. */
  visibleRows: number;
  /** The rect of the card at (row, column), in pane coordinates offset to the pane. */
  cell(row: number, column: number): Rect;
}

/** A vertical card grid sized from the pane's width; it scrolls down, never sideways. */
export function compactGrid(pane: Rect, opts: CompactGridOptions): CompactGridLayout {
  const gap = opts.gap ?? COMPACT.gap;
  const aspect = opts.aspect ?? 1.4;
  const fit = Math.floor((pane.width + gap) / (opts.minCardW + gap));
  const columns = Math.max(1, fit - Math.max(0, opts.dropColumns ?? 0));
  const cardW = Math.floor((pane.width - gap * (columns - 1)) / columns);
  const cardH = Math.round(cardW * aspect);
  const visibleRows = Math.max(0, Math.floor((pane.height + gap) / (cardH + gap)));
  return {
    columns,
    cardW,
    cardH,
    visibleRows,
    cell: (row, column) => ({ x: pane.x + column * (cardW + gap), y: pane.y + row * (cardH + gap), width: cardW, height: cardH }),
  };
}

// ------------------------------------------------------------------ tabs and switches

/** A segmented control's tabs: equal widths inside a 44 tall bar with 3 px of inset. */
export function compactSegmented(bar: Rect, count: number): CompactControl[] {
  const n = Math.max(0, Math.floor(count));
  if (!n) return [];
  const inset = 3;
  const inner = bar.width - inset * 2 - inset * (n - 1);
  const w = inner / n;
  return Array.from({ length: n }, (_, i) => {
    const visual = { x: bar.x + inset + i * (w + inset), y: bar.y + inset, width: w, height: bar.height - inset * 2 };
    // Tabs touch by design: each one takes the bar's full height and its share of the width.
    const hit = { x: bar.x + i * (bar.width / n), y: bar.y, width: bar.width / n, height: Math.max(bar.height, COMPACT.touch) };
    return { visual, hit };
  });
}

/**
 * The On/Off switch track in a settings row. The row itself is a list row
 * (compactList), whose hit area already spans its pitch, so the whole row
 * toggles and only the track's place is new.
 */
export function compactSwitchTrack(row: Rect): Rect {
  const { width, height } = COMPACT.switchTrack;
  return { x: row.x + row.width - width, y: row.y + (row.height - height) / 2, width, height };
}

// ------------------------------------------------------------------ dialogs and sheets

export interface CompactDialogLayout {
  frame: Rect;
  title: Rect;
  body: Rect;
  /** Left to right: cancel first, the primary (or danger) action last (M18). */
  buttons: CompactControl[];
}

/** A centred dialog for confirms and notices. Buttons share the bottom row equally. */
export function compactDialog(
  design: { width: number; height: number },
  buttonCount: number,
  size: { width?: number; height?: number } = {},
): CompactDialogLayout {
  const { touch, dialogPad } = COMPACT;
  const w = Math.min(size.width ?? COMPACT.dialogW, design.width - 2 * COMPACT.gap);
  const h = Math.min(size.height ?? COMPACT.dialogH, design.height - 2 * COMPACT.gap);
  const frame = { x: Math.round((design.width - w) / 2), y: Math.max(COMPACT.gap, Math.round((design.height - h) / 2) - 8), width: w, height: h };
  const innerX = frame.x + dialogPad.x;
  const innerW = w - dialogPad.x * 2;
  const buttonsY = frame.y + h - dialogPad.y - touch;
  const n = Math.max(0, Math.floor(buttonCount));
  const bw = n ? (innerW - 10 * (n - 1)) / n : 0;
  const buttons = Array.from({ length: n }, (_, i) => control({ x: innerX + i * (bw + 10), y: buttonsY, width: bw, height: touch }));
  const title = { x: innerX, y: frame.y + dialogPad.y, width: innerW, height: 26 };
  const bodyY = title.y + title.height + 10;
  return { frame, title, body: { x: innerX, y: bodyY, width: innerW, height: Math.max(0, buttonsY - 10 - bodyY) }, buttons };
}

export interface CompactSheetLayout {
  title: Rect;
  close: CompactControl | null;
  body: Rect;
}

/** A sheet over the centre and left (zone viewers, detail): header, close, body. */
export function compactSheet(frame: Rect, close = true): CompactSheetLayout {
  const { touch, sheetHeaderInset } = COMPACT;
  const closeRect = { x: frame.x + frame.width - touch - sheetHeaderInset, y: frame.y + sheetHeaderInset, width: touch, height: touch };
  const bodyY = frame.y + sheetHeaderInset + touch + 8;
  return {
    title: { x: frame.x + 16, y: frame.y + sheetHeaderInset, width: frame.width - 32 - (close ? touch + sheetHeaderInset : 0), height: touch },
    close: close ? control(closeRect) : null,
    body: { x: frame.x + 12, y: bodyY, width: frame.width - 24, height: Math.max(0, frame.y + frame.height - 12 - bodyY) },
  };
}

// ------------------------------------------------------------------ the checks

export interface CompactHitProblem {
  kind: 'small' | 'outside' | 'crowded';
  index: number;
  other?: number;
}

/**
 * What breaks the touch contract in a set of controls: a hit area under 44 px,
 * one outside the content box, or two hit areas closer than 8 px without
 * touching. Touching (gap 0) is allowed: rows and tabs are built that way.
 */
export function compactHitProblems(controls: readonly CompactControl[], content: Rect): CompactHitProblem[] {
  const eps = 1e-6;
  const out: CompactHitProblem[] = [];
  controls.forEach((c, i) => {
    if (c.hit.width < COMPACT.touch - eps || c.hit.height < COMPACT.touch - eps) out.push({ kind: 'small', index: i });
    const v = c.visual;
    if (v.x < content.x - eps || v.y < content.y - eps || v.x + v.width > content.x + content.width + eps || v.y + v.height > content.y + content.height + eps) {
      out.push({ kind: 'outside', index: i });
    }
    for (let j = i + 1; j < controls.length; j++) {
      const g = inactiveGap(c.hit, controls[j].hit);
      if (g.intersects || (g.gap > eps && g.gap < COMPACT.gap - eps)) out.push({ kind: 'crowded', index: i, other: j });
    }
  });
  return out;
}
