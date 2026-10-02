import { afterEach, describe, expect, it } from 'vitest';
import { setAccessibility } from '../../src/ui/accessibility';
import {
  collectionActionLayout,
  collectionBinderLayout,
  collectionFilterLayout,
  collectionHeaderLayout,
  collectionInspectColumns,
  collectionProbabilityLayout,
  collectionVariantLayout,
} from '../../src/ui/collectionPresentation';
import { isInsideTitleSafe, isRectContained, type Rect } from '../../src/ui/layout';
import { menuLineHeight } from '../../src/ui/mainMenuPresentation';
import { theme } from '../../src/ui/theme';
import { A11Y_CELLS } from './a11yCells';

afterEach(() => setAccessibility({ textScale: 1, highContrast: false }));

const intersects = (a: Rect, b: Rect): boolean => a.x < b.x + b.width && b.x < a.x + a.width
  && a.y < b.y + b.height && b.y < a.y + a.height;

describe.each(A11Y_CELLS)('Collection layout at $name', (cell) => {
  it('keeps the search, statistics, filters, and binder in separate bands', () => {
    setAccessibility(cell);
    const label = menuLineHeight(theme.type.label), caption = menuLineHeight(theme.type.caption);
    const header = collectionHeaderLayout(label, caption);
    const search = { x: header.search.x, y: header.search.y - theme.control.minHitHeight / 2,
      width: header.search.width, height: theme.control.minHitHeight };
    expect(isInsideTitleSafe(search)).toBe(true);
    expect(header.filterTop - (header.completionY + caption)).toBeGreaterThanOrEqual(theme.space(3));
    expect(header.filterTop - (search.y + search.height)).toBeGreaterThanOrEqual(theme.space(3));
    // Measured-width inputs include compact controls and the longest selected names.
    for (const widths of [[160, 120, 160, 150, 260, 170], [286, 246, 250, 264, 340, 192]]) {
      const filters = collectionFilterLayout(widths, header.filterTop);
      for (const control of filters.controls) expect(isInsideTitleSafe(control)).toBe(true);
      for (let index = 1; index < filters.controls.length; index++) {
        const a = filters.controls[index - 1], b = filters.controls[index];
        expect(intersects(a, b)).toBe(false);
        if (a.y === b.y) expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(theme.space(2));
        else expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(theme.space(2));
      }
      const binder = collectionBinderLayout(filters.bottom + theme.space(3), caption);
      for (const page of binder.pages) {
        expect(isInsideTitleSafe(page)).toBe(true);
        expect(page.y - filters.bottom).toBeGreaterThanOrEqual(theme.space(3));
        expect(binder.pagerY - theme.control.minHitHeight / 2 - (page.y + page.height))
          .toBeGreaterThanOrEqual(theme.space(3));
      }
    }
  });

  it('keeps every face and its full-size badge band within its binder page', () => {
    setAccessibility(cell);
    const badgeHeight = menuLineHeight(theme.type.caption);
    for (const top of [220, 260, 310]) {
      const binder = collectionBinderLayout(top, badgeHeight);
      expect(binder.scale).toBeGreaterThan(0);
      for (const [pageIndex, columns] of binder.columns.entries()) {
        const page = binder.pages[pageIndex];
        for (const x of columns) {
          let previousBottom = page.y;
          for (const y of binder.rowYs) {
            const face = { x: x - binder.faceWidth / 2, y: y - binder.faceHeight / 2,
              width: binder.faceWidth, height: binder.faceHeight };
            const badges = { x: x - binder.badgeWidth / 2, y: y + binder.labelOffset - badgeHeight / 2,
              width: binder.badgeWidth, height: badgeHeight };
            expect(isRectContained(face, page)).toBe(true);
            expect(isRectContained(badges, page)).toBe(true);
            expect(face.y).toBeGreaterThanOrEqual(previousBottom);
            expect(badges.y - (face.y + face.height)).toBeGreaterThanOrEqual(theme.space(2));
            previousBottom = badges.y + badges.height;
          }
        }
      }
    }
  });

  it('sizes the odds plate from all wrapped lines above the panel inset', () => {
    setAccessibility(cell);
    const heights = [menuLineHeight(theme.type.micro), menuLineHeight(theme.type.label),
      3 * menuLineHeight(theme.type.micro)];
    const layout = collectionProbabilityLayout(heights);
    expect(isInsideTitleSafe(layout.box)).toBe(true);
    heights.forEach((height, index) => {
      expect(layout.ys[index]).toBeGreaterThanOrEqual(layout.box.y + theme.space(2));
      expect(layout.ys[index] + height).toBeLessThanOrEqual(layout.box.y + layout.box.height - theme.space(2));
      if (index > 0) expect(layout.ys[index] - layout.ys[index - 1] - heights[index - 1])
        .toBeGreaterThanOrEqual(theme.space(1));
    });
  });

  it('paginates all finishes without crossing wrapped actions or the pager', () => {
    setAccessibility(cell);
    const columns = collectionInspectColumns();
    const line = menuLineHeight(theme.type.label);
    const heading = menuLineHeight(theme.type.h2);
    const actionHeights = [Math.max(theme.control.minHitHeight, line * 2 + theme.space(4)),
      Math.max(theme.control.minHitHeight, line * 2 + theme.space(4))];
    const actions = collectionActionLayout(actionHeights);
    actions.ys.forEach((y, index) => {
      const rect = { x: columns.detailsX, y: y - actionHeights[index] / 2,
        width: columns.detailsWidth, height: actionHeights[index] };
      expect(isInsideTitleSafe(rect)).toBe(true);
      if (index > 0) expect(rect.y - (actions.ys[index - 1] + actionHeights[index - 1] / 2))
        .toBeGreaterThanOrEqual(theme.space(3));
    });
    for (const count of [1, 7, 72]) {
      const top = columns.nameTop + heading + theme.space(3) + 2 * menuLineHeight(theme.type.caption);
      const variants = collectionVariantLayout(top, actions.listBottom,
        line * 2 + theme.space(1) + menuLineHeight(theme.type.caption), count);
      const pagerTop = variants.pagerY - theme.control.minHitHeight / 2;
      expect(variants.pageSize).toBeGreaterThan(0);
      expect(variants.pageSize * variants.pageCount).toBeGreaterThanOrEqual(count);
      expect(variants.pageSize * (variants.pageCount - 1)).toBeLessThan(count);
      for (const [index, y] of variants.rowYs.entries()) {
        expect(y - variants.rowHeight / 2).toBeGreaterThanOrEqual(top);
        expect(y + variants.rowHeight / 2 + theme.space(2)).toBeLessThanOrEqual(pagerTop);
        if (index > 0) expect(y - variants.rowYs[index - 1] - variants.rowHeight).toBeGreaterThanOrEqual(theme.space(2));
      }
      expect(variants.pagerY + theme.control.minHitHeight / 2 + theme.space(3))
        .toBeLessThanOrEqual(actions.ys[0] - actionHeights[0] / 2);
    }
  });
});
