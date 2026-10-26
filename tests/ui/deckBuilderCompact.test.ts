import { describe, expect, it } from 'vitest';
import {
  BUILDER_COMPACT,
  builderFoot,
  builderTopBar,
  cardsColumn,
  curveLayout,
  darlingSplit,
  deckRowDetail,
  decksScreen,
  poolChips,
  poolFilterLayout,
  poolGrid,
  poolHeight,
  poolHitAt,
  poolScrollToShow,
  splitDarlingName,
  stackedRowAt,
  warchestMain,
} from '../../src/ui/deckBuilderCompact';
import { COMPACT, compactShell } from '../../src/ui/compactLayout';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Rect, b: Rect): boolean =>
  a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 && a.x + a.width <= b.x + b.width + 1e-6 && a.y + a.height <= b.y + b.height + 1e-6;
const disjoint = (rects: Rect[], name: string): void => {
  rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => expect(overlap(a, b), `${name}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`).toBe(false)));
};

describe('the compact Deck Builder (mocks D-Cards, D-Cards130, D-Warchest, D-Decks, D-PoolFilters)', () => {
  it('lays the top bar inside the content with nothing overlapping, the field folding at the largest text or beside a long name', () => {
    for (const { name, m } of landscape) {
      for (const largeText of [false, true]) {
        for (const titleW of [140, 420]) {
          const bar = builderTopBar(m.content, titleW, largeText);
          const parts = [bar.back, bar.title, bar.search ?? bar.searchIcon!, bar.filter, bar.tabs];
          parts.forEach((r) => expect(inside(r, m.content), name).toBe(true));
          disjoint(parts, name);
          expect(bar.tabs.x).toBe(compactShell(m.content, { back: true }).column!.x);
          if (largeText || titleW === 420) {
            expect(bar.search, `${name} folds`).toBeNull();
            expect(bar.searchIcon!.width).toBe(COMPACT.touch);
          }
          if (bar.search) expect(bar.search.width).toBeGreaterThanOrEqual(BUILDER_COMPACT.searchMinW);
        }
      }
    }
  });

  it('keeps pool faces at the floor, drops a column at the largest text, and grows the faces when it does', () => {
    for (const { name, m } of landscape) {
      const main = compactShell(m.content).main;
      for (const pane of [main.width, darlingSplit(main, false).pool.width]) {
        const standard = poolGrid(pane, 36, false);
        const large = poolGrid(pane, 36, true);
        expect(standard.cardW, name).toBeGreaterThanOrEqual(BUILDER_COMPACT.minCardW);
        expect(standard.columns * standard.pitchX - BUILDER_COMPACT.gridGap, name).toBeLessThanOrEqual(pane - BUILDER_COMPACT.thumbLane);
        if (standard.columns > 1) {
          expect(large.columns).toBe(standard.columns - 1);
          expect(large.cardW).toBeGreaterThan(standard.cardW);
        }
      }
    }
  });

  it('maps a tap to the card, its fill-to-cap chip only where one is shown, and nothing in a gap or past the last card', () => {
    const grid = poolGrid(500, 36, false);
    const chips = poolChips(grid);
    const count = grid.columns + 1;
    const allX = chips.all.x + chips.all.width / 2;
    expect(poolHitAt(grid, count, grid.cardW / 2, grid.cardH / 2, () => true)).toEqual({ index: 0, part: 'card' });
    expect(poolHitAt(grid, count, grid.pitchX + allX, grid.chipY + 2, () => true)).toEqual({ index: 1, part: 'all' });
    // No chip on that card: the chip line is still the card, the gap under it is nothing.
    expect(poolHitAt(grid, count, grid.pitchX + allX, grid.chipY + 2, () => false)).toEqual({ index: 1, part: 'card' });
    expect(poolHitAt(grid, count, grid.pitchX + allX, grid.pitchY - 2, () => false)).toBeNull();
    // The chip's touch band runs down to the next row.
    expect(poolHitAt(grid, count, allX, grid.pitchY - 2, () => true)).toEqual({ index: 0, part: 'all' });
    expect(poolHitAt(grid, count, grid.cardW + 2, grid.cardH / 2, () => true)).toBeNull();
    expect(poolHitAt(grid, count, grid.pitchX + 2, grid.pitchY + 2, () => true)).toBeNull();
    expect(poolHeight(grid, count)).toBe(2 * grid.pitchY - BUILDER_COMPACT.rowGap);
    expect(poolHeight(grid, 0)).toBe(0);
  });

  it('scrolls the least that shows a card with its chips', () => {
    const grid = poolGrid(500, 36, false);
    const paneH = grid.pitchY * 1.5;
    const row3 = 3 * grid.columns;
    expect(poolScrollToShow(grid, 0, paneH, 0)).toBe(0);
    expect(poolScrollToShow(grid, row3, paneH, 0)).toBe(3 * grid.pitchY + grid.chipY + grid.chipH - paneH);
    expect(poolScrollToShow(grid, 0, paneH, 3 * grid.pitchY)).toBe(0);
    expect(poolScrollToShow(grid, row3, paneH, 3 * grid.pitchY)).toBe(3 * grid.pitchY);
  });

  it('stacks the Cards column top to bottom over the foot, the list giving way but keeping a row', () => {
    for (const { name, m } of landscape) {
      const col = compactShell(m.content, { back: true }).column!;
      for (const [statusH, statsH] of [[0, 90], [40, 110], [400, 400]]) {
        const L = cardsColumn(col, statusH, statsH);
        expect(L.list.height, name).toBeGreaterThanOrEqual(COMPACT.touch);
        expect(inside(L.code, col) && inside(L.save, col), name).toBe(true);
        disjoint([L.code, L.save], name);
        if (statusH < 100) {
          expect(L.list.y + L.list.height).toBeLessThanOrEqual(L.status.y);
          expect(L.stats.y + L.stats.height).toBeLessThanOrEqual(L.code.y);
          disjoint([L.list, ...(statusH ? [L.status] : []), L.stats, L.save], name);
        }
      }
      expect(builderFoot(col).save.x + builderFoot(col).save.width).toBeCloseTo(col.x + col.width);
    }
  });

  it('keeps the curve\'s bars inside its box and clear of the pip counts', () => {
    const rect = { x: 10, y: 20, width: 260, height: 70 };
    const L = curveLayout(rect, 14, 14);
    expect(L.xs).toHaveLength(8);
    expect(L.xs[0] - L.barW / 2).toBeGreaterThanOrEqual(rect.x);
    expect(L.xs[7] + L.barW / 2).toBeLessThan(L.pips.x);
    expect(L.baseY - L.maxBarH - 14).toBeGreaterThanOrEqual(rect.y);
    expect(L.baseY + 14).toBeLessThanOrEqual(rect.y + rect.height);
  });

  it('puts the ten Warchest slots in the main pane, five by two, over the rules', () => {
    for (const { name, m } of landscape) {
      const main = compactShell(m.content).main;
      for (const rulesH of [80, 150]) {
        const L = warchestMain(main, rulesH);
        expect(L.slots).toHaveLength(10);
        L.slots.forEach((slot) => expect(inside(slot, main), name).toBe(true));
        disjoint(L.slots, name);
        expect(L.slots[4].y).toBe(L.slots[0].y);
        expect(L.slots[5].y).toBeGreaterThan(L.slots[0].y);
        expect(L.rules.y).toBeGreaterThanOrEqual(L.slots[9].y + L.slots[9].height);
        expect(L.rules.height, name).toBeGreaterThanOrEqual(Math.min(rulesH, main.height - 2 * COMPACT.touch - 2 * BUILDER_COMPACT.slotGap));
      }
    }
  });

  it('lays Your Decks out inside the content: the face, its actions and the list never collide', () => {
    for (const { name, m } of landscape) {
      for (const largeText of [false, true]) {
        const L = decksScreen(m.content, largeText);
        const all = [L.face, ...L.actions, L.list, L.newDeck, L.use];
        all.forEach((r) => expect(inside(r, m.content), name).toBe(true));
        disjoint(all, name);
        expect(L.face.width / L.face.height).toBeCloseTo(1 / 1.4, 1);
        L.actions.forEach((a) => expect(a.height).toBe(COMPACT.touch));
      }
    }
  });

  it('gives each facet its own full row at the largest text, and pairs them otherwise', () => {
    const col = { x: 0, y: 0, width: 240, height: 300 };
    const standard = poolFilterLayout(col, 50, 48, false);
    const large = poolFilterLayout(col, 50, 60, true);
    disjoint([standard.set, standard.color, standard.type, standard.rarity, standard.sort], 'standard');
    disjoint([large.set, large.color, large.type, large.rarity, large.sort], 'large');
    expect(standard.color.y).toBe(standard.type.y);
    expect(standard.color.width).toBeLessThan(col.width / 2);
    for (const facet of [large.set, large.color, large.type, large.rarity, large.sort]) expect(facet.width).toBe(col.width);
    expect(large.bottom).toBe(large.sort.y + large.sort.height);
    expect(standard.bottom).toBe(standard.sort.y + standard.sort.height);
  });

  it('writes a deck row\'s detail and splits a Darling\'s name from her title', () => {
    expect(deckRowDetail({ types: ['creature'], subtypes: ['Beastkin', 'Bird'], attack: 2, defense: 2 })).toBe('2/2 · Beastkin Bird');
    expect(deckRowDetail({ types: ['creature'], subtypes: [], attack: 1, defense: 3 })).toBe('1/3');
    expect(deckRowDetail({ types: ['charm'], subtypes: [] })).toBe('Charm');
    expect(splitDarlingName('Bastet, Mistress of the Ninth Return')).toEqual({ name: 'Bastet', title: 'Mistress of the Ninth Return' });
    expect(splitDarlingName('Nüwa')).toEqual({ name: 'Nüwa', title: null });
  });

  it('finds the row under a point in a list of uneven rows, and none in the gaps', () => {
    const tops = [0, 50, 130];
    const heights = [44, 74, 44];
    expect(stackedRowAt(tops, heights, 10)).toBe(0);
    expect(stackedRowAt(tops, heights, 46)).toBe(-1);
    expect(stackedRowAt(tops, heights, 123)).toBe(1);
    expect(stackedRowAt(tops, heights, 200)).toBe(-1);
  });
});
