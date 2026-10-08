import { CARD_FACE_H } from '../config/cardFaceGeometry';
import { currentAccessibility } from './accessibility';
import { theme } from './theme';

/** Release sizes between ramp roles retain their original offset at 100%. */
export function duelPanelType() {
  return {
    history: theme.type.caption + 1,
    coach: theme.type.label + 1,
    coachInfo: theme.type.h2 + 2,
    dutyTitle: theme.type.h1 - 2,
    dutyBody: theme.type.body + 2,
    deadline: theme.type.micro - 1,
  };
}

/** Preserve the standard plate treatment; high contrast is always opaque. */
export const duelPanelAlpha = (standard: number): number => currentAccessibility().highContrast ? 1 : standard;

/** Rows keep the release top, 104px height and three-row capacity while they fit. */
export function dutyPanelPages(heights: readonly number[], titleHeight: number, hintHeight: number) {
  const hintY = Math.max(180, 130 + titleHeight / 2 + 8 + hintHeight / 2);
  const top = Math.max(210, hintY + hintHeight / 2 + 12);
  const bottom = 566;
  const pages: { index: number; top: number; height: number }[][] = [[]];
  let y = top;
  heights.forEach((height, index) => {
    const rowHeight = Math.max(104, height + 28);
    let page = pages[pages.length - 1];
    if (page.length && (page.length >= 3 || y + rowHeight > bottom)) {
      page = []; pages.push(page); y = top;
    }
    page.push({ index, top: y, height: rowHeight });
    y += rowHeight + 8;
  });
  return { pages, top, hintY, bottom };
}

/** The card grid is fixed-size; only measured chrome consumes extra rows. */
export function zonePanelLayout(expanded: boolean, titleHeight: number, subtitleHeight: number,
  badgeHeight: number, deadlineHeight: number, actionHeight: number, actionWidth = 0) {
  const thumbHalfHeight = CARD_FACE_H * 0.24 / 2;
  // CardThumbCache bleeds eight card-local pixels above and below the face.
  // Include that drawn Image envelope in header clearance, without changing
  // the release action offsets or row pitch when there is no subtitle.
  const thumbOuterHalfHeight = thumbHalfHeight + 8 * 0.24;
  const releaseFirstY = expanded ? 195 : 176;
  const headerGap = 4;
  // Fit the release title and subtitle above the fixed grid, preserving all
  // four compact rows. Larger measured text consumes extra space below it.
  const titleY = subtitleHeight > 0
    ? Math.min(86, releaseFirstY - thumbOuterHalfHeight - headerGap - 18 - headerGap - 34 / 2)
    : 86;
  const subtitleY = subtitleHeight > 0
    ? Math.max(Math.min(122, releaseFirstY - thumbOuterHalfHeight - headerGap - 18 / 2),
      titleY + titleHeight / 2 + headerGap + subtitleHeight / 2)
    : Math.max(122, 86 + titleHeight / 2 + 8 + subtitleHeight / 2);
  const headerGrowth = Math.max(0, titleHeight - 34) + Math.max(0, subtitleHeight - 18);
  const actionGap = Math.max(46, actionHeight + 16);
  const deadlineOffset = expanded ? Math.max(68, thumbHalfHeight + 4 + deadlineHeight / 2) : 0;
  const actionOffset = expanded
    ? Math.max(110, deadlineOffset + deadlineHeight / 2 + 12 + actionHeight / 2)
    : Math.max(52, thumbHalfHeight + 6 + actionHeight / 2);
  // Normal actions had a 52px centre offset. Preserve it when their 28px plate fits.
  const normalActionOffset = actionHeight <= 28 ? 52 : actionOffset;
  const columnGap = Math.max(expanded ? 200 : 128, actionWidth + 12);
  const columns = Math.max(1, Math.min(expanded ? 4 : 6, Math.floor(840 / columnGap)));
  const firstY = Math.max(releaseFirstY + headerGrowth, badgeHeight / 2 + 90,
    subtitleHeight > 0 ? subtitleY + subtitleHeight / 2 + headerGap + thumbOuterHalfHeight : 0);
  const lastOffset = expanded ? actionOffset + actionGap + actionHeight / 2 : normalActionOffset + actionHeight / 2;
  const pitch = (expanded ? 235 : 120) + Math.max(0, lastOffset - (expanded ? 170 : 66));
  const rows = Math.max(1, Math.min(expanded ? 2 : 4, Math.floor((604 - firstY - lastOffset) / pitch) + 1));
  return { columns, rows, pageSize: columns * rows, columnGap, firstY, pitch, titleY, subtitleY,
    deadlineOffset, actionOffset: expanded ? actionOffset : normalActionOffset, actionGap };
}

/** The rendered probe supplies actual title, subtitle, thumb and badge bands. */
export function zonePanelHeaderFindings(title: { y: number; height: number }, subtitle: { y: number; height: number },
  grid: readonly { y: number; height: number }[]): ('title' | 'grid')[] {
  const findings: ('title' | 'grid')[] = [];
  if (subtitle.y - (title.y + title.height) < 4 - 1e-3) findings.push('title');
  if (grid.some(item => item.y - (subtitle.y + subtitle.height) < 4 - 1e-3)) findings.push('grid');
  return findings;
}

/** Content-grown coaching card, keeping the release single-line centre/anchors. */
export function coachInfoLayout(bodyHeight: number, lineHeight: number, hintHeight: number) {
  const naturalHeight = 130 + Math.max(0, bodyHeight - lineHeight) + Math.max(0, hintHeight - 16);
  const height = Math.min(630, naturalHeight);
  const top = 365 - height / 2;
  const bodyTop = top + 48 - lineHeight / 2;
  const hintY = top + height - 28;
  const available = hintY - hintHeight / 2 - 16 - bodyTop;
  const bodyViewportHeight = Math.min(bodyHeight, Math.max(lineHeight, Math.floor(available / lineHeight) * lineHeight));
  return { top, height, bodyTop, hintY, bodyViewportHeight };
}

/** A whole visible history entry is retained or put on the following page. */
export function historyPanelPages(heights: readonly number[], top = 106, bottom = 660) {
  const pages: { index: number; y: number }[][] = [[]];
  let y = top;
  heights.forEach((height, index) => {
    let page = pages[pages.length - 1];
    if (page.length && y + height > bottom) { page = []; pages.push(page); y = top; }
    page.push({ index, y });
    y += height + 6;
  });
  return pages;
}

/** The stack keeps the release card pitch; finite pages keep deep stacks in frame. */
export function stackPanelPage(count: number, requested: number, centerX: number, cardWidth: number, gap: number) {
  const width = Math.max(cardWidth, Math.min(centerX - 64, 1216 - centerX) * 2 - 56);
  const capacity = Math.max(1, Math.floor((width + gap) / (cardWidth + gap)));
  const pageCount = Math.max(1, Math.ceil(count / capacity));
  const page = Math.max(0, Math.min(pageCount - 1, requested));
  const start = page * capacity;
  const visible = Math.min(capacity, count - start);
  return { page, pageCount, capacity, start, count: visible, width: visible * cardWidth + Math.max(0, visible - 1) * gap };
}
