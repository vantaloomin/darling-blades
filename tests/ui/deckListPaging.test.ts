import { describe, expect, it } from 'vitest';
import { clampDeckPage, deckListLayout, deckPageCount, deckPageSlice } from '../../src/ui/deckListPaging';
import { menuLineHeight } from '../../src/ui/mainMenuPresentation';
import { wave2BFixtureSave, WAVE_2B_FIXTURE_IDS } from '../../src/dev/deckCollectionFixtures';
import { deckPaneHeaderLayout, deckPaneSummaryLayout } from '../../src/ui/deckPanePresentation';
import { setAccessibility } from '../../src/ui/accessibility';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';

/**
 * The desktop deck list used to hard-clip rows past a fixed y, silently
 * dropping entries in a long singleton-heavy 60-card deck. Paging replaces the
 * clip; these specs pin the invariant that EVERY row is reachable across pages.
 */
describe('deck-list paging', () => {
  it('covers every entry across pages with none dropped or duplicated', () => {
    for (const total of [0, 1, 13, 14, 15, 40, 60]) {
      for (const perPage of [6, 14]) {
        const entries = Array.from({ length: total }, (_, i) => i);
        const pages = deckPageCount(total, perPage);
        const seen: number[] = [];
        for (let p = 0; p < pages; p++) seen.push(...deckPageSlice(entries, p, perPage));
        expect(seen).toEqual(entries); // in order, complete, no repeats
      }
    }
  });

  it('always reports at least one page, even when empty', () => {
    expect(deckPageCount(0, 14)).toBe(1);
    expect(deckPageCount(14, 14)).toBe(1);
    expect(deckPageCount(15, 14)).toBe(2);
  });

  it('clamps a stale page index into range', () => {
    expect(clampDeckPage(-3, 40, 14)).toBe(0);
    expect(clampDeckPage(99, 40, 14)).toBe(2); // 40/14 → 3 pages → max index 2
    expect(clampDeckPage(1, 40, 14)).toBe(1);
    expect(clampDeckPage(5, 0, 14)).toBe(0); // empty deck pins to page 0
  });

  it('an out-of-range page still yields in-range rows (slice clamps first)', () => {
    const entries = Array.from({ length: 20 }, (_, i) => i);
    expect(deckPageSlice(entries, 99, 14)).toEqual([14, 15, 16, 17, 18, 19]);
  });
});

describe('measured deck-list paging', () => {
  it('keeps every wrapped row whole, reachable and separate from its neighbours and pager in every accessibility cell', () => {
    forEachA11yCell(() => {
      const heights = [1, 3, 2, 1, 2, 3, 1, 1, 2, 3, 2, 1]
        .map((lines) => lines * menuLineHeight(theme.type.caption) + theme.space(2));
      const tracks = { top: 160, bottom: 440, pagerY: 418 };
      const layout = deckListLayout(heights, tracks);
      expect(layout.pages.flatMap((page) => page.map((row) => row.index)))
        .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(layout.pages.length).toBeGreaterThan(1);
      for (const page of layout.pages) {
        for (let i = 0; i < page.length; i++) {
          const row = page[i];
          expect(row.height).toBeGreaterThanOrEqual(heights[row.index]);
          expect(page.length).toBeLessThanOrEqual(6);
          expect(row.y - row.height / 2).toBeGreaterThanOrEqual(tracks.top);
          expect(row.y + row.height / 2).toBeLessThanOrEqual(tracks.pagerY - theme.control.minHitHeight / 2 - theme.space(2));
          if (i > 0) expect(row.y - row.height / 2)
            .toBeGreaterThanOrEqual(page[i - 1].y + page[i - 1].height / 2 + theme.space(1));
        }
      }
    });
  });

  it('lets a short list use the full track without reserving a hidden pager', () => {
    const layout = deckListLayout([60, 60], { top: 100, bottom: 224, pagerY: 200 });
    expect(layout.paged).toBe(false);
    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0][1].y + layout.pages[0][1].height / 2).toBe(224);
  });

  it('keeps the empty deck on an empty first page', () => {
    expect(deckListLayout([], { top: 100, bottom: 224, pagerY: 200 }).pages).toEqual([[]]);
  });

  it('requires enough space for a complete row instead of silently clipping its name', () => {
    expect(() => deckListLayout([90, 44], { top: 100, bottom: 210, pagerY: 188 })).toThrow(RangeError);
  });
});

// Rendered fixture measurements (Inter/Cinzel, 2026-10-02): every desktop
// name at 100% is 15px high; at 130% a single-line name is 20px. Touch names
// at 100% occupy at most 30px, also the minus control's drawn height.
describe('deck-list release density', () => {
  it.each([
    { textScale: 1, touch: false, titleHeight: 38, summaryHeight: 35, textHeight: 15, pitch: 28, preferred: 6 },
    { textScale: 1.3, touch: false, titleHeight: 50, summaryHeight: 46, textHeight: 20, pitch: 28, preferred: 6 },
    { textScale: 1, touch: true, titleHeight: 38, summaryHeight: 35, textHeight: 30, pitch: 44, preferred: 5 },
  ])('fills the Darlings fixture page with measured rows at $textScale, touch $touch', (cell) => {
    try {
      setAccessibility({ textScale: cell.textScale, highContrast: false });
      const deck = wave2BFixtureSave().decks.find(d => d.id === WAVE_2B_FIXTURE_IDS.darlings)!;
      const header = deckPaneHeaderLayout(cell.titleHeight);
      const summary = deckPaneSummaryLayout({ summaryHeight: cell.summaryHeight });
      const tracks = { top: header.contentTop + 8, bottom: summary.listBottom, pagerY: summary.pagerY,
        rowPitch: cell.pitch, preferredRows: cell.preferred };
      const layout = deckListLayout(deck.cards.map(() => cell.textHeight), tracks);
      // The release profile's count is a required density floor, not an
      // incidental snapshot. Larger text may reduce it only when it cannot fit.
      const capacity = Math.min(cell.preferred,
        1 + Math.floor((tracks.bottom - tracks.top - cell.textHeight) / cell.pitch));
      expect(layout.pages[0]).toHaveLength(cell.textScale === 1 ? cell.preferred : capacity);
      for (let i = 1; i < layout.pages[0].length; i++) {
        expect(layout.pages[0][i].y - layout.pages[0][i - 1].y).toBe(cell.pitch);
      }
      expect(layout.pages.flatMap(page => page.map(row => deck.cards[row.index]))).toEqual(deck.cards);
    } finally { setAccessibility({ textScale: 1, highContrast: false }); }
  });
});

describe('measured rows and independent input bands', () => {
  it.each([28, 44])('keeps differently wrapped rows and their inflated %ipx inputs disjoint', (pitch) => {
    const heights = [40, 15, 60, 20, 40, 30, 15];
    const layout = deckListLayout(heights, { top: 100, bottom: 400, pagerY: 430, rowPitch: pitch });
    for (const page of layout.pages) for (let i = 1; i < page.length; i++) {
      const before = page[i - 1], next = page[i];
      expect(next.y - Math.max(pitch, next.height) / 2)
        .toBeGreaterThanOrEqual(before.y + Math.max(pitch, before.height) / 2);
      expect(next.y - next.height / 2 - (before.y + before.height / 2)).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps an overlapping input column above the pager without charging other columns for that band', () => {
    const heights = Array<number>(10).fill(20);
    const tracks = { top: 100, bottom: 260, pagerY: 280, rowPitch: 44, preferredRows: 5 };
    const layout = deckListLayout(heights, { ...tracks, inputBottoms: heights.map(() => 245) });
    for (const page of layout.pages) for (const row of page) expect(row.y + 22).toBeLessThanOrEqual(245);
    const beside = deckListLayout(heights, tracks);
    expect(beside.pages[0].length).toBeGreaterThan(layout.pages[0].length);
  });
});
