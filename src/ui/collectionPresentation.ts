import type { CardDef } from '../engine/types';
import type { CollectionFilterState } from '../meta/collectionFilter';
import type { SaveData } from '../meta/SaveManager';
import { type Rect } from './layout';
import { menuLineHeight } from './mainMenuPresentation';
import { theme } from './theme';

export type CollectionFilterName = 'set' | 'color' | 'type' | 'rarity' | 'sort';

/** Scene data only; the dev scene clones this save and never flushes it. */
export interface CollectionA11yFixture {
  save?: SaveData;
  cards?: readonly CardDef[];
  gold?: number;
  filter?: Partial<CollectionFilterState>;
  inspectCardId?: string;
  openFilter?: CollectionFilterName;
  variantPage?: number;
  compareVariantIndex?: number;
  clearedDisplayPin?: boolean;
}

export function collectionHeaderLayout(counterHeight: number, completionHeight: number) {
  const gap = theme.space(2);
  const top = theme.design.headerCenterY + theme.control.minHitHeight / 2 + theme.space(3);
  const height = Math.max(theme.control.minHitHeight, counterHeight + gap + completionHeight);
  return {
    search: { x: theme.design.safeLeft, y: top + height / 2, width: 430 },
    counterY: top, completionY: top + counterHeight + gap,
    filterTop: top + height + theme.space(3),
  };
}

/** Measured controls wrap as a group without shrinking their labels or hit areas. */
export function collectionFilterLayout(widths: readonly number[], top: number) {
  const gap = theme.space(2);
  const height = theme.control.minHitHeight;
  let x = theme.design.safeLeft, y = top;
  const controls = widths.map((width): Rect => {
    if (x > theme.design.safeLeft && x + width > theme.design.safeRight) {
      x = theme.design.safeLeft; y += height + gap;
    }
    const rect = { x, y, width, height };
    x += width + gap;
    return rect;
  });
  return { controls, bottom: y + height };
}

/** The specialist card faces yield space to live-size chrome above and below. */
export function collectionBinderLayout(top: number, badgeHeight = menuLineHeight(theme.type.caption)) {
  const bottom = theme.design.footerCenterY - theme.control.minHitHeight / 2 - theme.space(3);
  const pageGap = theme.space(5);
  const pageWidth = (theme.design.safeWidth - pageGap) / 2;
  const pitch = (bottom - top) / 2;
  const faceHeight = Math.min(197.4, pitch - badgeHeight - theme.space(6));
  const scale = faceHeight / 420;
  const faceWidth = 300 * scale;
  const rowYs = [top + theme.space(2) + faceHeight / 2, top + pitch + theme.space(2) + faceHeight / 2];
  const pages = [theme.design.safeLeft, theme.design.safeLeft + pageWidth + pageGap]
    .map((x): Rect => ({ x, y: top, width: pageWidth, height: bottom - top }));
  const columns = pages.map((page) => Array.from({ length: 3 }, (_, i) => page.x + pageWidth * (i + 0.5) / 3));
  return { pages, columns, rowYs, faceWidth, faceHeight, scale, badgeHeight,
    badgeWidth: pageWidth / 3 - theme.space(4),
    labelOffset: faceHeight / 2 + theme.space(2) + badgeHeight / 2,
    pagerY: theme.design.footerCenterY, bottom };
}

export function collectionInspectColumns() {
  const inset = theme.space(6);
  const left = theme.design.safeLeft + inset;
  const right = theme.design.safeRight - inset;
  const detailsX = theme.design.centerX + theme.space(4);
  return { width: theme.design.safeWidth, height: theme.design.safeHeight,
    left, right, detailsX, detailsWidth: right - detailsX,
    nameTop: theme.design.headerCenterY + theme.control.minHitHeight / 2 + theme.space(3),
    nameWidth: detailsX - left - theme.space(6),
    cardX: left + 350, cardWidth: 340,
    glossary: { x: left, width: 174 },
    bottom: theme.design.safeBottom - theme.space(3) };
}

/** Content-sized odds plate, with room reserved for every wrapped source line. */
export function collectionProbabilityLayout(heights: readonly number[]) {
  const columns = collectionInspectColumns();
  const gap = theme.space(1), pad = theme.space(2);
  const height = heights.reduce((total, value) => total + value, 0) + gap * Math.max(0, heights.length - 1) + pad * 2;
  const y = columns.bottom - height;
  let cursor = y + pad;
  const ys = heights.map((value) => { const next = cursor; cursor += value + gap; return next; });
  return { box: { x: columns.left, y, width: columns.nameWidth, height }, ys };
}

/** Variant rows and their pin targets share a height; pagination owns overflow. */
export function collectionVariantLayout(top: number, bottom: number, nameHeight: number, count: number) {
  const gap = theme.space(2);
  const rowHeight = Math.max(theme.control.minHitHeight, nameHeight + theme.space(4));
  const pagerHeight = theme.control.minHitHeight;
  const available = bottom - top - pagerHeight - gap;
  const pageSize = Math.max(1, Math.floor((available + gap) / (rowHeight + gap)));
  const visibleRows = Math.min(count, pageSize);
  const rowYs = Array.from({ length: visibleRows }, (_, i) => top + rowHeight / 2 + i * (rowHeight + gap));
  return { rowHeight, pageSize, rowYs, pageCount: Math.max(1, Math.ceil(count / pageSize)),
    pagerY: bottom - pagerHeight / 2 };
}

/** Actions grow upwards from the panel inset, preserving a separate list band. */
export function collectionActionLayout(heights: readonly number[]) {
  let cursor = collectionInspectColumns().bottom;
  const ys = [...heights].reverse().map((height) => {
    const y = cursor - height / 2; cursor -= height + theme.space(3); return y;
  }).reverse();
  return { ys, listBottom: cursor };
}
