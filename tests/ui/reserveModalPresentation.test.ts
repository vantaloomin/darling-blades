import { describe, expect, it } from 'vitest';
import { groupReserveSlots, landFanSlots } from '../../src/ui/reserveModalPresentation';

describe('landFanSlots', () => {
  it('arcs up-right of the pile with the middle card highest', () => {
    const three = landFanSlots(3, 170, 500);
    expect(three.map((s) => s.x)).toEqual([196, 292, 388]);
    expect(three[1].y).toBeLessThan(three[0].y);
    expect(three[0].y).toBe(three[2].y);
    const two = landFanSlots(2, 170, 500);
    expect(two[0].y).toBe(two[1].y);
    expect(landFanSlots(1, 170, 500)).toEqual([{ x: 196, y: 382 }]);
  });
});

describe('groupReserveSlots', () => {
  it('groups identical kinds with counts, keeping reserve order', () => {
    const groups = groupReserveSlots(
      ['ld-dual', 'ld-dual', 'land-island', 'ld-dual', 'land-mountain', 'land-island'],
      () => false,
    );
    expect(groups).toEqual([
      { cardId: 'ld-dual', count: 3 },
      { cardId: 'land-island', count: 2 },
      { cardId: 'land-mountain', count: 1 },
    ]);
  });

  it('records the first playable slot per kind', () => {
    const groups = groupReserveSlots(
      ['land-plains', 'land-plains', 'land-swamp'],
      (index) => index >= 1,
    );
    expect(groups).toEqual([
      { cardId: 'land-plains', count: 2, playableIndex: 1 },
      { cardId: 'land-swamp', count: 1, playableIndex: 2 },
    ]);
  });

  it('omits playableIndex when no slot of the kind is playable', () => {
    const groups = groupReserveSlots(['land-forest'], () => false);
    expect(groups).toEqual([{ cardId: 'land-forest', count: 1 }]);
  });

  it('keeps a ten-of-one-kind reserve to a single tile', () => {
    const groups = groupReserveSlots(Array(10).fill('land-plains'), (index) => index === 0);
    expect(groups).toEqual([{ cardId: 'land-plains', count: 10, playableIndex: 0 }]);
  });

  it('returns nothing for an empty reserve', () => {
    expect(groupReserveSlots([], () => true)).toEqual([]);
  });
});
