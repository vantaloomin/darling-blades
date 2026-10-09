import { currentAccessibility } from './accessibility';
import { triggerSelectedMark, type TriggerSelectedMarkInput } from './controlStyle';
import { GAUNTLET_TOWER_VIEWPORT, modalShellLayout, type Rect } from './layout';
import { menuLineHeight } from './mainMenuPresentation';
import { theme } from './theme';

/** Measured text stacks: callers pass rendered heights, never estimate glyph widths. */
export function playTextStack(heights: readonly number[], top = 0, gap = theme.space(3)) {
  let bottom = top;
  const ys = heights.map((height) => { const y = bottom; bottom += height + gap; return y; });
  return { ys, bottom: heights.length ? bottom - gap : top };
}

export function playMenuLayout() {
  const firstY = 270;
  const pitch = theme.control.minHitHeight + theme.space(3);
  return { actionYs: [0, 1, 2].map((i) => firstY + pitch * i),
    notice: { x: theme.design.safeLeft, y: firstY + 2 * pitch + theme.control.minHitHeight / 2 + theme.space(3),
      width: theme.design.safeWidth, height: theme.control.minHitHeight * 2 + theme.space(3) },
    plate: { x: theme.design.centerX - 320, y: 530, width: 640, height: theme.design.safeBottom - 530 } };
}

/** Shared row tracks subtract the measured right-hand metadata before capping names. */
export function playDeckRowColumns(row: Pick<Rect, 'x' | 'width'>, stateWidth: number, countWidth: number, reservedWidth: number) {
  const stateRight = row.x + row.width - theme.space(4);
  const countRight = stateRight - stateWidth - theme.space(3);
  return { nameX: row.x + theme.space(4), nameWidth: row.width - reservedWidth - theme.space(12), stateRight, countRight,
    countLeft: countRight - countWidth };
}

/** Two-line deck rows grow with the reading roles; pagination owns overflow. */
export function playDeckPickerLayout(count: number, nameHeight = menuLineHeight(theme.type.label), badgeHeight = menuLineHeight(theme.type.micro)) {
  const gap = theme.space(3);
  const rowHeight = Math.max(theme.control.minHitHeight, nameHeight + theme.space(1) + badgeHeight + theme.space(4));
  const rowPitch = rowHeight + gap;
  const titleHeight = Math.max(theme.control.minHitHeight, menuLineHeight(theme.type.h1));
  const overhead = theme.space(12) + theme.space(8) + titleHeight + theme.control.minHitHeight;
  const pagerHeight = theme.control.minHitHeight + gap;
  const available = theme.design.safeHeight - overhead;
  const unpaged = count * rowPitch - (count ? gap : 0);
  const paged = unpaged > available;
  const pageSize = Math.max(1, Math.floor((available - (paged ? pagerHeight : 0) + gap) / rowPitch));
  const rows = Math.min(count, pageSize);
  const listHeight = Math.max(rowHeight, rows * rowPitch - (rows ? gap : 0));
  const height = overhead + listHeight + (paged ? pagerHeight : 0);
  const tracks = modalShellLayout({ width: 820, height, titleTrackHeight: titleHeight });
  return { width: 820, height, titleTrackHeight: titleHeight, tracks, pageSize, rowHeight, rowPitch,
    rowYs: Array.from({ length: rows }, (_, i) => tracks.contentBounds.y + rowHeight / 2 + i * rowPitch),
    pagerY: tracks.contentBounds.y + listHeight + gap + theme.control.minHitHeight / 2 };
}

export function practicePickerLayout(nameHeight = menuLineHeight(theme.type.caption)) {
  const rows = 2;
  const columnTop = 130;
  const columnHeight = 396;
  const rowGap = theme.space(3.5);
  const rowHeight = (columnHeight - rowGap) / rows;
  const nameBand = Math.max(menuLineHeight(theme.type.caption) + theme.space(4), nameHeight + theme.space(2));
  const selectionY = columnTop + columnHeight + theme.space(4) + menuLineHeight(theme.type.h2) / 2;
  return { rows, columnTop, columnHeight, rowGap, rowHeight, nameBand,
    portraitWidth: 190, portraitHeight: rowHeight - nameBand - theme.space(2.5),
    selectionY,
    // The page arrows: in the edge columns on the selection line, under the
    // neighbour peeks rather than drawn over them (owner, 2026-10-08).
    arrowY: selectionY,
    difficultyY: theme.design.footerCenterY - theme.control.minHitHeight - theme.space(2),
    noticeY: theme.design.footerCenterY,
    viewport: { x: theme.design.safeLeft, y: columnTop - theme.space(1), width: theme.design.safeWidth, height: columnHeight + theme.space(2) } };
}

export function gauntletPresentation(railHeadingHeight = 2 * menuLineHeight(theme.type.caption)) {
  const railHeadingTop = 116;
  const towerTop = railHeadingTop + railHeadingHeight + theme.space(2);
  const tower = { ...GAUNTLET_TOWER_VIEWPORT, y: towerTop, height: GAUNTLET_TOWER_VIEWPORT.y + GAUNTLET_TOWER_VIEWPORT.height - towerTop };
  // The detail panel spans the rail's whole column, heading included: its top
  // on the heading's top and its bottom on the tower's, so the two columns
  // agree at both ends (they were 45px apart at the top until 2026-10-08).
  const detailPanel: Rect = { x: theme.design.safeLeft, y: railHeadingTop,
    width: tower.x - theme.space(3) - theme.design.safeLeft, height: tower.y + tower.height - railHeadingTop };
  // The portrait card and the text column sit centred as one group, with
  // equal margins to the panel's edges: the text ran to 8px from the right
  // edge while the portrait had 66px on its left.
  const portraitWidth = 268;
  const textWidth = 300;
  const groupGap = theme.space(10);
  const groupLeft = detailPanel.x + (detailPanel.width - (portraitWidth + groupGap + textWidth)) / 2;
  const textX = groupLeft + portraitWidth + groupGap;
  const detailViewport: Rect = { x: textX, y: 132, width: textWidth, height: 324 };
  const fightY = detailViewport.y + detailViewport.height + theme.space(3) + theme.control.minHitHeight / 2;
  const abandonY = fightY + theme.control.minHitHeight + theme.space(6);
  const warningY = abandonY + theme.control.minHitHeight / 2 + theme.space(2);
  return { tower, railHeadingTop, detailPanel, textX, textWidth, detailViewport, fightY, abandonY, warningY,
    portraitX: groupLeft + portraitWidth / 2, portraitY: 300, themeTop: 484, themeWidth: portraitWidth };
}

/** Separate selection affordance for rows and portrait tiles. */
export function menuSelectionMark(input: TriggerSelectedMarkInput, borderWidth: number = theme.control.borderWidth): Rect {
  const mark = triggerSelectedMark(input);
  return { ...mark, y: mark.y - borderWidth / 2 - theme.space(0.5) };
}

/** Enlarged detail names may occupy three lines; titles retain the shared two-line rule. */
export function gauntletNameLineLimit(): 2 | 3 {
  return currentAccessibility().textScale > 1 ? 3 : 2;
}

export interface GauntletDetailMeasure {
  name: number; title: number; rung: number; blurb: number; reward: number;
  lineHeight: number; linePitch: number;
}

/** Detail reading order, measured independently of the portrait and actions. */
export function gauntletDetailLayout(measured: GauntletDetailMeasure) {
  const area = gauntletPresentation().detailViewport;
  const gap = theme.space(3);
  const header = playTextStack([measured.name, measured.title, measured.rung], area.y);
  const blurbY = header.bottom + gap;
  const available = area.y + area.height - measured.reward - gap - blurbY;
  const spacing = measured.linePitch - measured.lineHeight;
  const wholeLines = Math.max(1, Math.floor((available + spacing) / measured.linePitch));
  const blurbHeight = Math.min(measured.blurb, wholeLines * measured.linePitch - spacing);
  return { nameY: header.ys[0], titleY: header.ys[1], rungY: header.ys[2],
    blurb: { ...area, y: blurbY, height: blurbHeight }, rewardY: blurbY + blurbHeight + gap };
}
