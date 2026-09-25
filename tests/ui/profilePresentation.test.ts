import { describe, expect, it } from 'vitest';
import {
  COMPACT_TOUCH_GAP_RANGE,
  GAP_FLOORS,
  anchoredControlBounds,
  inactiveGap,
  inflateHitRect,
  isInsideTitleSafe,
  isRectContained,
  measureControlCluster,
  modalShellLayout,
  type Rect,
} from '../../src/ui/layout';
import {
  PROFILE_CONFIRM_MODAL,
  PROFILE_EXPORT_MODAL,
  PROFILE_GAPS,
  PROFILE_HEADER,
  PROFILE_HEADER_BAND_BOTTOM,
  PROFILE_IMPORT_MODAL,
  PROFILE_PANELS,
  PROFILE_PANEL_BOTTOM_INSET,
  PROFILE_RECORD,
  PROFILE_REPLAYS,
  PROFILE_REPLAY_ROW,
  PROFILE_SAVE_ACTIONS,
  PROFILE_SAVE_CARD_PICKER,
  PROFILE_SHOWCASE,
  PROFILE_STAT_ROWS,
  PROFILE_STAT_ROW_CAPACITY,
  PROFILE_TAB_STRIP,
  PROFILE_WIDE_MODAL,
  packCentered,
  packLeft,
  packRight,
  profileConfirmFooterXs,
  profileConfirmLayout,
  profileExportFooterXs,
  profileExportLayout,
  profileImportFooterXs,
  profileImportLayout,
  profilePickerLayout,
  profileReplayCell,
  profileReplayNameWidth,
  profileSaveActionCenters,
  profileStatNoteTop,
  profileStatRowY,
  profileWatchX,
  textBlockHeight,
} from '../../src/ui/profilePresentation';
import { RARITY_ORDER } from '../../src/meta/collectionFilter';
import { theme } from '../../src/ui/theme';

const HIT = theme.control.minHitHeight;
const FRAME = theme.design.titleSafe;

/** A box of `width` x `height` centred on (cx, cy). */
function box(cx: number, cy: number, width: number, height: number): Rect {
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}
const bottom = (r: Rect): number => r.y + r.height;
const right = (r: Rect): number => r.x + r.width;
/** A themed button's hit box, from its centre and visual size. */
function hitBox(cx: number, cy: number, visualWidth: number, visualHeight: number = theme.control.heightMd): Rect {
  return inflateHitRect(box(cx, cy, visualWidth, visualHeight), theme.control.minHitWidth, HIT);
}
/** Every pair in `rects` keeps at least `gap` of clear space. */
function expectPairwiseGap(rects: readonly [string, Rect][], gap: number): void {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const measured = inactiveGap(rects[i][1], rects[j][1]);
      expect(measured.gap, `${rects[i][0]} / ${rects[j][0]}`).toBeGreaterThanOrEqual(gap);
    }
  }
}
/** Items listed top to bottom never overlap and keep at least `gap` between neighbours. */
function expectStacked(items: readonly [string, Rect][], gap: number): void {
  for (let i = 1; i < items.length; i++) {
    expect(items[i][1].y - bottom(items[i - 1][1]), `${items[i - 1][0]} -> ${items[i][0]}`).toBeGreaterThanOrEqual(gap);
  }
}

// ---------------------------------------------------------------------------
// The main screen
// ---------------------------------------------------------------------------

const backLink = anchoredControlBounds('top-left', 0, 0).hit;
const titleTrack = box(PROFILE_HEADER.titleX, PROFILE_HEADER.y, 2 * PROFILE_HEADER.titleHalfWidth, theme.type.display);
const recordLine = box(PROFILE_RECORD.x, PROFILE_RECORD.y, 2 * PROFILE_RECORD.halfWidth, theme.type.h1);
const rateLine = box(PROFILE_RECORD.x, PROFILE_RECORD.rateY, 2 * PROFILE_RECORD.halfWidth, theme.type.body);
const seals: [string, Rect][] = PROFILE_SHOWCASE.xs.map((x, i) => [
  `seal ${i}`,
  box(x, PROFILE_SHOWCASE.sealY, PROFILE_SHOWCASE.tilted.width, PROFILE_SHOWCASE.tilted.height),
]);
function saveActions(exportWidth: number, importWidth: number): [string, Rect][] {
  const { exportX, importX } = profileSaveActionCenters(exportWidth, importWidth);
  return [
    ['export', box(exportX, PROFILE_SAVE_ACTIONS.y, exportWidth, HIT)],
    ['import', box(importX, PROFILE_SAVE_ACTIONS.y, importWidth, HIT)],
  ];
}

describe('the Profile header', () => {
  it('puts the title on the back link\'s line, inside the frame and clear of the link', () => {
    expect(PROFILE_HEADER.y).toBe(backLink.y + backLink.height / 2);
    expect(isInsideTitleSafe(titleTrack)).toBe(true);
    expect(inactiveGap(backLink, titleTrack).gap).toBeGreaterThanOrEqual(PROFILE_GAPS.between);
  });

  it('starts the record row a within-group gap under the header track', () => {
    const headerBottom = backLink.y + backLink.height;
    const rowTops = [recordLine.y, ...saveActions(PROFILE_SAVE_ACTIONS.minWidth, PROFILE_SAVE_ACTIONS.minWidth).map(([, r]) => r.y)];
    for (const top of rowTops) expect(top).toBeGreaterThanOrEqual(headerBottom + PROFILE_GAPS.within);
    const labelTop = PROFILE_SHOWCASE.labelY - theme.type.micro / 2;
    expect(labelTop, 'the Showcase label sits under the back link, not inside its hit box').toBeGreaterThanOrEqual(
      headerBottom + PROFILE_GAPS.within,
    );
  });

  it('keeps the showcase, the record and the save actions apart on the record row', () => {
    const band: [string, Rect][] = [
      ...seals,
      ['record', recordLine],
      ['rate', rateLine],
      ...saveActions(PROFILE_SAVE_ACTIONS.minWidth, PROFILE_SAVE_ACTIONS.minWidth),
    ];
    for (const [what, r] of band) expect(isInsideTitleSafe(r), what).toBe(true);
    for (const [what, seal] of seals) {
      expect(recordLine.x - right(seal), what).toBeGreaterThanOrEqual(PROFILE_GAPS.group);
      expect(rateLine.x - right(seal), what).toBeGreaterThanOrEqual(PROFILE_GAPS.group);
    }
    expectPairwiseGap(seals, PROFILE_GAPS.datum);
  });

  it('stacks the Showcase label over its seals, and each seal\'s two lines inside its inner stroke', () => {
    const labelBottom = PROFILE_SHOWCASE.labelY + theme.type.micro / 2;
    expect(PROFILE_SHOWCASE.sealY - PROFILE_SHOWCASE.tilted.height / 2).toBeGreaterThanOrEqual(labelBottom + PROFILE_GAPS.datum);
    expect(seals[0][1].x).toBeGreaterThanOrEqual(FRAME.left);

    const innerHalfH = PROFILE_SHOWCASE.sealHeight / 2 - PROFILE_SHOWCASE.innerInset;
    const innerWidth = PROFILE_SHOWCASE.sealWidth - 2 * PROFILE_SHOWCASE.innerInset;
    const title = [PROFILE_SHOWCASE.titleY - theme.type.caption / 2, PROFILE_SHOWCASE.titleY + theme.type.caption / 2];
    const claimed = [PROFILE_SHOWCASE.claimedY - theme.type.micro / 2, PROFILE_SHOWCASE.claimedY + theme.type.micro / 2];
    expect(title[0]).toBeGreaterThanOrEqual(-innerHalfH);
    expect(claimed[1]).toBeLessThanOrEqual(innerHalfH);
    expect(claimed[0] - title[1]).toBeGreaterThanOrEqual(PROFILE_GAPS.datum);
    expect(PROFILE_SHOWCASE.titleMaxWidth).toBeLessThan(innerWidth);
  });

  /**
   * Both labels are font-dependent, so the pair is placed from measured
   * widths; the rule must hold for any plausible pair, not just this machine's.
   * The labels measure about 80px in Inter; 200 is more than twice that.
   */
  it('right-aligns the save actions to the frame for any measured width, clear of the record', () => {
    for (let exportWidth = PROFILE_SAVE_ACTIONS.minWidth; exportWidth <= 200; exportWidth += 4) {
      for (let importWidth = PROFILE_SAVE_ACTIONS.minWidth; importWidth <= 200; importWidth += 4) {
        const [[, exp], [, imp]] = saveActions(exportWidth, importWidth);
        const at = `${exportWidth}/${importWidth}`;
        expect(right(imp), at).toBe(FRAME.right);
        expect(imp.x - right(exp), at).toBeGreaterThanOrEqual(GAP_FLOORS.compactTouch);
        expect(exp.x - right(recordLine), at).toBeGreaterThanOrEqual(PROFILE_GAPS.group);
      }
    }
  });

  it('hangs the import notice under the save actions, right-aligned, above the panels', () => {
    const actionsBottom = PROFILE_SAVE_ACTIONS.y + HIT / 2;
    const noticeTop = PROFILE_SAVE_ACTIONS.noticeY - theme.type.label / 2;
    const noticeBottom = PROFILE_SAVE_ACTIONS.noticeY + theme.type.label / 2;
    expect(PROFILE_SAVE_ACTIONS.right).toBe(FRAME.right);
    expect(noticeTop).toBeGreaterThanOrEqual(actionsBottom + PROFILE_GAPS.datum);
    expect(noticeBottom).toBeLessThanOrEqual(PROFILE_HEADER_BAND_BOTTOM);
  });
});

describe('the Profile panels', () => {
  const P = PROFILE_PANELS;
  const leftPanel: Rect = { x: P.left.x, y: P.top, width: P.left.width, height: P.bottom - P.top };
  const rightPanel: Rect = { x: P.right.x, y: P.top, width: P.right.width, height: P.bottom - P.top };

  it('span the frame edge to edge, one region gap apart, from under the header band to the frame bottom', () => {
    expect(leftPanel.x).toBe(FRAME.left);
    expect(right(rightPanel)).toBe(FRAME.right);
    expect(rightPanel.x - right(leftPanel)).toBe(P.gap);
    expect(P.gap).toBeGreaterThanOrEqual(PROFILE_GAPS.between);
    expect(P.top).toBeGreaterThanOrEqual(PROFILE_HEADER_BAND_BOTTOM + PROFILE_GAPS.between);
    expect(isInsideTitleSafe(leftPanel)).toBe(true);
    expect(isInsideTitleSafe(rightPanel)).toBe(true);
  });

  it('share a head line and mirrored insets: the tab strip on the left, the Replays heading on the right', () => {
    expect(PROFILE_TAB_STRIP.y).toBe(PROFILE_REPLAYS.headingY);
    expect(PROFILE_REPLAYS.headingX - rightPanel.x).toBe(P.inset);
    expect(PROFILE_TAB_STRIP.xs[0] - PROFILE_TAB_STRIP.width / 2 - leftPanel.x).toBe(P.inset);
    const headingTop = PROFILE_REPLAYS.headingY - theme.type.h2 / 2;
    expect(headingTop - P.top).toBeGreaterThanOrEqual(PROFILE_GAPS.between);
    const tabVisualTop = PROFILE_TAB_STRIP.y - theme.control.heightSm / 2;
    expect(tabVisualTop - P.top).toBeGreaterThanOrEqual(PROFILE_GAPS.group);
  });

  it('lays the tab strip over exactly the stat-row column, with touch isolation between tabs', () => {
    const tabs = PROFILE_TAB_STRIP.xs.map((x) => box(x, PROFILE_TAB_STRIP.y, PROFILE_TAB_STRIP.width, theme.control.heightSm));
    expect(tabs[0].x).toBe(PROFILE_STAT_ROWS.x);
    expect(right(tabs[tabs.length - 1])).toBe(PROFILE_STAT_ROWS.x + PROFILE_STAT_ROWS.width);
    const cluster = measureControlCluster(
      tabs.map((visual, i) => ({ id: `tab ${i}`, visual })),
      'compactTouch',
    );
    expect(cluster.meetsFloor).toBe(true);
    for (let i = 1; i < cluster.controls.length; i++) {
      const gap = cluster.controls[i].hit.x - right(cluster.controls[i - 1].hit);
      expect(gap).toBeGreaterThanOrEqual(COMPACT_TOUCH_GAP_RANGE.min);
      expect(gap).toBeLessThanOrEqual(COMPACT_TOUCH_GAP_RANGE.max);
    }
  });

  it('fits the longest tab\'s rows and note inside the left panel, rows closer to each other than to the tabs', () => {
    // Draft draws eight rows; Collection draws one per rarity plus three.
    const longest = Math.max(8, RARITY_ORDER.length + 3);
    expect(PROFILE_STAT_ROW_CAPACITY).toBeGreaterThanOrEqual(longest);

    const rows = Array.from({ length: longest }, (_, i) =>
      box(PROFILE_STAT_ROWS.x + PROFILE_STAT_ROWS.width / 2, profileStatRowY(i), PROFILE_STAT_ROWS.width, PROFILE_STAT_ROWS.height),
    );
    const tabHitBottom = PROFILE_TAB_STRIP.y + HIT / 2;
    const tabGap = rows[0].y - tabHitBottom;
    expect(tabGap).toBeGreaterThanOrEqual(PROFILE_GAPS.within);
    for (let i = 1; i < rows.length; i++) {
      const gap = rows[i].y - bottom(rows[i - 1]);
      expect(gap).toBeGreaterThanOrEqual(PROFILE_GAPS.list);
      expect(gap).toBeLessThan(tabGap);
    }
    for (let n = 1; n <= longest; n++) {
      const noteTop = profileStatNoteTop(n);
      expect(noteTop - bottom(rows[n - 1]), `note under ${n} rows`).toBeGreaterThanOrEqual(PROFILE_GAPS.within);
      expect(noteTop + textBlockHeight(theme.type.micro, 1), `note under ${n} rows`).toBeLessThanOrEqual(
        P.bottom - PROFILE_PANEL_BOTTOM_INSET,
      );
    }
    for (const row of rows) expect(isRectContained(row, leftPanel)).toBe(true);
    expect(PROFILE_STAT_ROWS.textLeft - PROFILE_STAT_ROWS.x).toBe(PROFILE_STAT_ROWS.x + PROFILE_STAT_ROWS.width - PROFILE_STAT_ROWS.textRight);
  });
});

describe('the replay grid', () => {
  const P = PROFILE_PANELS;
  const content: Rect = {
    x: P.right.x + P.inset,
    y: PROFILE_REPLAYS.top,
    width: P.right.width - 2 * P.inset,
    height: P.bottom - PROFILE_PANEL_BOTTOM_INSET - PROFILE_REPLAYS.top,
  };
  const cells = Array.from({ length: PROFILE_REPLAYS.capacity }, (_, i) => profileReplayCell(i));

  it('holds every replay inside the panel\'s content box, one gutter both ways, clear of the heading', () => {
    for (const cell of cells) expect(isRectContained(cell, content)).toBe(true);
    expectPairwiseGap(cells.map((c, i) => [`cell ${i}`, c]), PROFILE_REPLAYS.gutter);
    const down = cells[1].y - bottom(cells[0]);
    const across = cells[PROFILE_REPLAYS.rows].x - right(cells[0]);
    expect(down).toBe(across);
    expect(cells[0].y - (PROFILE_REPLAYS.headingY + theme.type.h2 / 2)).toBeGreaterThanOrEqual(PROFILE_GAPS.within);
    expect(cells[0].x).toBe(PROFILE_REPLAYS.headingX);
  });

  it('reads newest first down the left column, then the right', () => {
    expect(cells[1].x).toBe(cells[0].x);
    expect(cells[1].y).toBeGreaterThan(cells[0].y);
    expect(cells[PROFILE_REPLAYS.rows].y).toBe(cells[0].y);
    expect(cells[PROFILE_REPLAYS.rows].x).toBeGreaterThan(cells[0].x);
  });

  it('keeps the Watch button padded inside its cell, and the name, meta and note lines apart', () => {
    const R = PROFILE_REPLAY_ROW;
    const w = PROFILE_REPLAYS.cellWidth;
    const h = PROFILE_REPLAYS.cellHeight;
    for (let watchWidth = R.watchMinWidth; watchWidth <= 120; watchWidth += 6) {
      const visual = box(profileWatchX(watchWidth), R.titleY, watchWidth, R.watchHeight);
      const hit = inflateHitRect(visual, theme.control.minHitWidth, HIT);
      expect(right(visual), `${watchWidth}`).toBe(w - R.padX);
      expect(visual.y).toBeGreaterThanOrEqual(R.padY);
      expect(isRectContained(hit, { x: 0, y: 0, width: w, height: h }), `${watchWidth}`).toBe(true);
      expect(visual.x - (R.textX + profileReplayNameWidth(watchWidth)), `${watchWidth}`).toBeGreaterThanOrEqual(PROFILE_GAPS.list);
    }
    expect(R.textX + profileReplayNameWidth(0)).toBe(w - R.padX);

    const lines: [string, Rect][] = [
      ['name / Watch track', box(0, R.titleY, 1, R.watchHeight)],
      ['meta', box(0, R.metaY, 1, theme.type.caption)],
      ['older-version note', box(0, R.noteY, 1, theme.type.micro)],
    ];
    expect(lines[0][1].y).toBeGreaterThanOrEqual(R.padY);
    expectStacked(lines, PROFILE_GAPS.datum);
    expect(h - bottom(lines[2][1])).toBeGreaterThanOrEqual(R.padY);
  });

  it('keeps every Watch hit box isolated from its neighbours', () => {
    const R = PROFILE_REPLAY_ROW;
    const hits: [string, Rect][] = cells.map((cell, i) => [
      `watch ${i}`,
      hitBox(cell.x + profileWatchX(R.watchMinWidth), cell.y + R.titleY, R.watchMinWidth, R.watchHeight),
    ]);
    expectPairwiseGap(hits, GAP_FLOORS.ordinary);
  });
});

// ---------------------------------------------------------------------------
// The dialogs
// ---------------------------------------------------------------------------

const wide = modalShellLayout(PROFILE_WIDE_MODAL);
const confirm = modalShellLayout(PROFILE_CONFIRM_MODAL);
const contentBottom = (t: typeof wide): number => bottom(t.contentBounds);
function titleBox(t: typeof wide, y: number): Rect {
  return box(t.titleTrack.x + t.titleTrack.width / 2, y, 1, theme.type.h1);
}
function expectFooterCluster(t: typeof wide, controls: { width: number; destructive?: boolean }[], xs: number[]): void {
  const visuals = controls.map((c, i) => box(xs[i], t.footerTrack.y + t.footerTrack.height / 2, c.width, theme.control.heightMd));
  const cluster = measureControlCluster(
    visuals.map((visual, i) => ({ id: `footer ${i}`, visual, destructive: controls[i].destructive })),
  );
  expect(cluster.meetsFloor).toBe(true);
  for (const c of cluster.controls) expect(isRectContained(c.hit, t.footerTrack), c.id).toBe(true);
  const span = [cluster.controls[0].hit.x, right(cluster.controls[cluster.controls.length - 1].hit)];
  expect((span[0] + span[1]) / 2).toBeCloseTo(t.footerTrack.x + t.footerTrack.width / 2, 6);
}

describe('the Profile dialogs', () => {
  it('fit inside the title-safe frame with their reserved tracks intact', () => {
    for (const layout of [wide, confirm]) {
      expect(layout.fits).toBe(true);
      expect(layout.tracksInsideTitleSafe).toBe(true);
      expect(isInsideTitleSafe(layout.panel)).toBe(true);
    }
  });

  it('Export: card path, code path and privacy line stack inside the content area, footer in its track', () => {
    const L = profileExportLayout(wide);
    const M = PROFILE_EXPORT_MODAL;
    const label = theme.type.label;
    expect(isRectContained(titleBox(wide, L.titleY), wide.titleTrack)).toBe(true);
    const items: [string, Rect][] = [
      ['card copy', box(L.x, L.cardCopyY, M.copyWrap, label)],
      ['card button', hitBox(L.x, L.cardButtonY, M.cardButtonMinWidth)],
      ['code field', box(L.x, L.inputY, M.input.width, M.input.height)],
      ['status', box(L.x, L.statusY, M.copyWrap, label)],
      ['privacy', box(L.x, L.privacyY, M.copyWrap, label)],
    ];
    for (const [what, r] of items) expect(isRectContained(r, wide.contentBounds), what).toBe(true);
    expectStacked(items, PROFILE_GAPS.within);
    for (let include = M.includeMinWidth; include <= 260; include += 10) {
      for (let copy = M.copyMinWidth; copy <= 180; copy += 10) {
        expectFooterCluster(wide, [{ width: include }, { width: copy }], profileExportFooterXs(wide, include, copy));
      }
    }
  });

  it('Import: field, status and preview stack inside the content area; Replace save keeps its destructive distance', () => {
    const L = profileImportLayout(wide);
    const M = PROFILE_IMPORT_MODAL;
    const preview: Rect = {
      x: L.previewX,
      y: L.previewTop,
      width: M.input.width,
      height: textBlockHeight(theme.type.caption, M.previewLines, M.previewLineSpacing),
    };
    const field = box(L.x, L.inputY, M.input.width, M.input.height);
    expect(isRectContained(titleBox(wide, L.titleY), wide.titleTrack)).toBe(true);
    const items: [string, Rect][] = [
      ['code field', field],
      ['status', box(L.x, L.statusY, M.input.width, theme.type.label)],
      ['preview', preview],
    ];
    for (const [what, r] of items) expect(isRectContained(r, wide.contentBounds), what).toBe(true);
    expectStacked(items, PROFILE_GAPS.within);
    expect(preview.x, 'the preview shares the field\'s left edge').toBe(field.x);
    for (const extra of [0, 20, 40]) {
      const widths = [M.previewMinWidth + extra, M.cardMinWidth + extra, M.replaceMinWidth + extra];
      expectFooterCluster(
        wide,
        [{ width: widths[0] }, { width: widths[1] }, { width: widths[2], destructive: true }],
        profileImportFooterXs(wide, widths[0], widths[1], widths[2]),
      );
    }
  });

  it('Replace-save confirmation: the question sits inside its own panel, clear of the close button', () => {
    const L = profileConfirmLayout(confirm);
    const M = PROFILE_CONFIRM_MODAL;
    const message = box(L.messageX, L.messageY, M.messageWrap, textBlockHeight(theme.type.body, 2, M.messageLineSpacing));
    expect(isRectContained(message, confirm.contentBounds)).toBe(true);
    expect(isRectContained(message, confirm.panel)).toBe(true);
    expect(inactiveGap(message, confirm.closeTrack).gap).toBeGreaterThan(0);
    for (const extra of [0, 30, 60]) {
      const widths = [M.cancelMinWidth + extra, M.confirmMinWidth + extra];
      expectFooterCluster(
        confirm,
        [{ width: widths[0] }, { width: widths[1], destructive: true }],
        profileConfirmFooterXs(confirm, widths[0], widths[1]),
      );
    }
  });

  it('save-card picker: the search\'s focus ring clears the cards, and the grid keeps touch isolation inside the content area', () => {
    const card = { width: 300, height: 420 }; // CardView's CARD_W x CARD_H
    const L = profilePickerLayout(wide, card);
    const p = PROFILE_SAVE_CARD_PICKER;
    expect(isRectContained(titleBox(wide, L.titleY), wide.titleTrack)).toBe(true);
    const subtitle = box(L.x, L.subtitleY, 1, theme.type.label);
    const searchWithRing = box(L.x, L.searchY, p.searchWidth + 2 * p.searchRing, p.searchHeight + 2 * p.searchRing);
    const thumbs: [string, Rect][] = [];
    L.rowYs.forEach((y, r) => L.columnXs.forEach((x, c) => thumbs.push([`thumb ${r},${c}`, box(x, y, L.thumbWidth, L.thumbHeight)])));

    expect(subtitle.y).toBeGreaterThanOrEqual(L.titleY + theme.type.h1 / 2 + PROFILE_GAPS.datum);
    expect(searchWithRing.y - bottom(subtitle)).toBeGreaterThanOrEqual(0);
    expect(Math.min(...thumbs.map(([, r]) => r.y)) - bottom(searchWithRing)).toBeGreaterThanOrEqual(PROFILE_GAPS.list);
    for (const [what, r] of thumbs) expect(isRectContained(r, wide.contentBounds), what).toBe(true);
    expect(Math.max(...thumbs.map(([, r]) => bottom(r)))).toBeLessThanOrEqual(contentBottom(wide));
    expectPairwiseGap(thumbs, GAP_FLOORS.compactTouch);
    const gridLeft = Math.min(...thumbs.map(([, r]) => r.x));
    const gridRight = Math.max(...thumbs.map(([, r]) => right(r)));
    expect((gridLeft + gridRight) / 2).toBeCloseTo(L.x, 6);
    expect(L.thumbScale).toBeLessThanOrEqual(p.maxThumbScale);
    expect(L.emptyY).toBeGreaterThan(L.gridTop);
    expect(L.emptyY).toBeLessThan(L.gridBottom);
  });
});

describe('packing a row of measured controls', () => {
  const widths = [10, 20, 30];
  const edges = (xs: number[]): [number, number][] => xs.map((x, i) => [x - widths[i] / 2, x + widths[i] / 2]);

  it('keeps the requested gap after each box and lands the group where asked', () => {
    for (const xs of [packLeft(widths, 100, [4, 8]), packRight(widths, 100, [4, 8]), packCentered(widths, 100, [4, 8])]) {
      const e = edges(xs);
      expect(e[1][0] - e[0][1]).toBe(4);
      expect(e[2][0] - e[1][1]).toBe(8);
    }
    expect(edges(packLeft(widths, 100, 5))[0][0]).toBe(100);
    expect(edges(packRight(widths, 100, 5))[2][1]).toBe(100);
    const centred = edges(packCentered(widths, 100, 5));
    expect((centred[0][0] + centred[2][1]) / 2).toBe(100);
  });
});
