import { describe, expect, it } from 'vitest';
import { coachInfoLayout, dutyPanelPages, historyPanelPages, stackPanelPage, zonePanelHeaderFindings, zonePanelLayout } from '../../src/ui/duelPanelPresentation';
import { CARD_FACE_H } from '../../src/config/cardFaceGeometry';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';

describe('Duel panel reading tracks', () => {
  it('separates the zone subtitle from the title by at least four pixels in every cell', () => {
    forEachA11yCell(({ name }) => {
      for (const expanded of [false, true]) {
        const titleHeight = theme.type.h1 + 6, subtitleHeight = theme.type.label + 4;
        const layout = zonePanelLayout(expanded, titleHeight, subtitleHeight, 18, 28, 28);
        expect(layout.subtitleY - subtitleHeight / 2 - (layout.titleY + titleHeight / 2), name)
          .toBeGreaterThanOrEqual(4 - 1e-6);
      }
    });
  });

  it('separates the zone subtitle from first-row thumbs and their top badges in every cell', () => {
    forEachA11yCell(({ name }) => {
      for (const expanded of [false, true]) {
        for (const subtitleLines of [1, 2, 4]) {
          const subtitleHeight = (theme.type.label + 4) * subtitleLines;
          const layout = zonePanelLayout(expanded, theme.type.h1 + 6, subtitleHeight, 18, 28, 28);
          // Actual Image bounds include CardThumbCache's eight-pixel bleed.
          const thumbTop = layout.firstY - (CARD_FACE_H + 16) * 0.24 / 2;
          const badgeTop = layout.firstY - CARD_FACE_H * 0.24 / 2 + 2;
          expect(Math.min(thumbTop, badgeTop) - (layout.subtitleY + subtitleHeight / 2), name)
            .toBeGreaterThanOrEqual(4 - 1e-6);
        }
      }
    });
  });

  it('keeps six columns and four compact rows with a subtitle at standard text', () => {
    forEachA11yCell(({ textScale }) => {
      if (textScale !== 1) return;
      const layout = zonePanelLayout(false, theme.type.h1 + 6, theme.type.label + 4, 18, 28, 28);
      expect(layout.columns).toBe(6);
      expect(layout.rows).toBe(4);
    });
  });

  it('reports subtitle clearance failures against rendered titles, image thumbs and raised badges', () => {
    const title = { y: 20, height: 30 }, subtitle = { y: 54, height: 18 };
    const thumb = { y: 76, height: 100 };
    expect(zonePanelHeaderFindings(title, subtitle, [thumb])).toEqual([]);
    expect(zonePanelHeaderFindings(title, { ...subtitle, y: 53 }, [thumb])).toEqual(['title']);
    expect(zonePanelHeaderFindings(title, subtitle, [{ ...thumb, y: 75 }])).toEqual(['grid']);
    expect(zonePanelHeaderFindings(title, subtitle, [thumb, { y: 70, height: 20 }])).toEqual(['grid']);
  });

  it('keeps ordinary zone capacity and anchors while measured action growth remains above the pager', () => {
    forEachA11yCell(() => {
      for (const expanded of [false, true]) {
        const baseline = zonePanelLayout(expanded, 34, 18, 18, 28, 28);
        expect({ rows: baseline.rows, columns: baseline.columns, pitch: baseline.pitch, top: baseline.firstY })
          .toEqual(expanded ? { rows: 2, columns: 4, pitch: 235, top: 195 } : { rows: 4, columns: 6, pitch: 120, top: 176 });
        for (const height of [28, 44, 60]) {
          const layout = zonePanelLayout(expanded, 34, 18, 18, 28, height, 110);
          const lastAction = layout.firstY + (layout.rows - 1) * layout.pitch + layout.actionOffset
            + (expanded ? layout.actionGap : 0) + height / 2;
          expect(lastAction).toBeLessThanOrEqual(604);
          expect(layout.columns * layout.columnGap).toBeLessThanOrEqual(840);
          if (expanded) expect(layout.actionGap).toBeGreaterThanOrEqual(height + 16);
        }
      }
    });
  });

  it('keeps each whole Duty readable and puts overflow options on reachable pages', () => {
    forEachA11yCell(() => {
      const heights = [40, 70, 150, 250, 90];
      const layout = dutyPanelPages(heights, theme.type.h1 * 2, theme.type.body + 4);
      expect(layout.pages.flat().map(row => row.index)).toEqual([0, 1, 2, 3, 4]);
      for (const rows of layout.pages) for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        expect(row.height).toBeGreaterThanOrEqual(heights[row.index] + 28);
        expect(row.top).toBeGreaterThanOrEqual(layout.hintY + (theme.type.body + 4) / 2 + 12);
        expect(row.top + row.height).toBeLessThanOrEqual(layout.bottom);
        if (i) expect(row.top).toBeGreaterThanOrEqual(rows[i - 1].top + rows[i - 1].height + 8);
      }
      const release = dutyPanelPages([40, 60, 76], 32, 20);
      expect(release.pages.map(rows => rows.length)).toEqual([3]);
      expect(release.pages[0].map(row => row.top)).toEqual([210, 322, 434]);
    });
  });

  it('keeps the coach footer outside the reading viewport at every text size', () => {
    forEachA11yCell(() => {
      for (const lines of [1, 4, 12, 40]) {
        const line = theme.type.h2 + 6;
        const hint = theme.type.label + 2;
        const layout = coachInfoLayout(line * lines, line, hint);
        expect(layout.top).toBeGreaterThanOrEqual(theme.design.safeTop);
        expect(layout.top + layout.height).toBeLessThanOrEqual(theme.design.safeBottom);
        expect(layout.bodyTop + layout.bodyViewportHeight + 16).toBeLessThanOrEqual(layout.hintY - hint / 2);
        expect(layout.bodyViewportHeight % line).toBe(0);
      }
    });
  });

  it('preserves complete history entries and their release gap across pages', () => {
    forEachA11yCell(() => {
      const heights = Array.from({ length: 14 }, (_, index) => (index % 3 + 1) * (theme.type.caption + 4));
      const pages = historyPanelPages(heights, 106, 620);
      expect(pages.flat().map(row => row.index)).toEqual(Array.from({ length: 14 }, (_, index) => index));
      for (const page of pages) for (let i = 0; i < page.length; i++) {
        const row = page[i];
        expect(row.y).toBeGreaterThanOrEqual(106);
        expect(row.y + heights[row.index]).toBeLessThanOrEqual(620);
        if (i) expect(row.y - page[i - 1].y - heights[page[i - 1].index]).toBe(6);
      }
    });
  });

  it('keeps deep stack pages inside the frame without shrinking cards or losing stack order', () => {
    forEachA11yCell(() => {
      for (const count of [1, 6, 12, 40]) {
        const indices: number[] = [];
        const first = stackPanelPage(count, 0, 400, 96, 8);
        for (let page = 0; page < first.pageCount; page++) {
          const layout = stackPanelPage(count, page, 400, 96, 8);
          expect(400 - layout.width / 2 - 28).toBeGreaterThanOrEqual(64);
          expect(400 + layout.width / 2 + 28).toBeLessThanOrEqual(1216);
          expect(layout.width).toBe(layout.count * 96 + (layout.count - 1) * 8);
          indices.push(...Array.from({ length: layout.count }, (_, index) => layout.start + index));
        }
        expect(indices).toEqual(Array.from({ length: count }, (_, index) => index));
        expect(stackPanelPage(count, Number.MAX_SAFE_INTEGER, 400, 96, 8).page).toBe(first.pageCount - 1);
      }
    });
  });
});
