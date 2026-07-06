import { describe, expect, it } from 'vitest';
import { clampDeckPage, deckPageCount, deckPageSlice } from '../../src/ui/deckListPaging';

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
