import { describe, expect, it } from 'vitest';
import { duelRecapLayout } from '../../src/ui/duelRecapPresentation';
import { modalShellLayout } from '../../src/ui/layout';
import { forEachA11yCell } from './a11yCells';

describe('Duel recap reading budget', () => {
  it('preserves standard grid density and reports names that cannot clear the next portrait', () => {
    const bounds = modalShellLayout({ width: 820, height: 640 }).contentBounds;
    const layout = duelRecapLayout(bounds, 28, 26, 1);
    expect([layout.rows, layout.columns, layout.pageCount]).toEqual([5, 6, 1]);
    expect(layout.pitch).toBeCloseTo(70.4);
    expect(layout.slot(0).y).toBeCloseTo(241.2);
    expect(layout.labelWidth).toBeCloseTo(124 + 2 / 3);
    expect(layout.namesClearPortraits).toBe(false);
    expect(layout.labelClearance).toBeCloseTo(11.4);
  });

  it('keeps every enlarged name clear of portraits, paging controls and result buttons', () => {
    forEachA11yCell(cell => {
      const shell = modalShellLayout({ width: 820, height: 640 });
      for (const height of [26, 42, 70]) {
        const layout = duelRecapLayout(shell.contentBounds, 28, height, cell.textScale);
        if (cell.textScale === 1) continue;
        const indices: number[] = [];
        for (let page = 0; page < layout.pageCount; page++) {
          const sheet = duelRecapLayout(shell.contentBounds, 28, height, cell.textScale, page);
          expect(sheet.namesClearPortraits).toBe(true);
          for (let i = 0; i < sheet.visibleCount; i++) {
            const slot = sheet.slot(i);
            expect(slot.y - sheet.portraitHeight / 2).toBeGreaterThanOrEqual(sheet.gridTop);
            expect(slot.labelY + height).toBeLessThanOrEqual(sheet.gridBottom);
            expect(slot.x - sheet.labelWidth / 2).toBeGreaterThanOrEqual(shell.contentBounds.x);
            expect(slot.x + sheet.labelWidth / 2).toBeLessThanOrEqual(shell.contentBounds.x + shell.contentBounds.width);
            indices.push(sheet.start + i);
          }
          expect(sheet.gridBottom).toBeLessThan(sheet.pagerY - 22);
          expect(sheet.pagerY + 22).toBeLessThan(shell.footerTrack.y);
        }
        expect(indices).toEqual(Array.from({ length: 28 }, (_, index) => index));
      }
    });
  });
});
