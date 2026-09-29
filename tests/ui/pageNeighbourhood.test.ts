import { describe, expect, it } from 'vitest';
import { pageNeighbourhood } from '../../src/meta/collectionFilter';

/**
 * What a paged grid asks card art for (docs/plan-art-streaming.md section 2):
 * the page on show (leased at `visible`) and the pages a turn reaches next
 * (prefetched at `soon`). The Collection binder, the Deck Builder's pool and
 * its Darling picker all page through `pageNeighbourhood`.
 */
describe('pageNeighbourhood: which pages a paged grid asks art for', () => {
  // Eight cards, three to a page: pages [0,1,2] [3,4,5] [6,7].
  const cards = [0, 1, 2, 3, 4, 5, 6, 7];

  it('on the first page asks for the page on show and the next one only', () => {
    expect(pageNeighbourhood(cards, 0, 3)).toEqual({ shown: [0, 1, 2], near: [3, 4, 5] });
  });

  it('in the middle asks for the next page before the previous one (the likelier turn first)', () => {
    expect(pageNeighbourhood(cards, 1, 3)).toEqual({ shown: [3, 4, 5], near: [6, 7, 0, 1, 2] });
  });

  it('on the last, partial page asks for the previous page only', () => {
    expect(pageNeighbourhood(cards, 2, 3)).toEqual({ shown: [6, 7], near: [3, 4, 5] });
  });

  it('asks for nothing beside a grid that fits on one page', () => {
    expect(pageNeighbourhood([0, 1], 0, 3)).toEqual({ shown: [0, 1], near: [] });
    expect(pageNeighbourhood([], 0, 3)).toEqual({ shown: [], near: [] });
  });

  it('clamps a page a filter left behind to the last page, as the grid does', () => {
    expect(pageNeighbourhood(cards, 9, 3)).toEqual({ shown: [6, 7], near: [3, 4, 5] });
    expect(pageNeighbourhood(cards, -1, 3)).toEqual({ shown: [0, 1, 2], near: [3, 4, 5] });
  });
});
