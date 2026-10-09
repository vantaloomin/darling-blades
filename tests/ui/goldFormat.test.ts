import { describe, expect, it } from 'vitest';
import { formatCount, formatGold, goldPrice, splitGoldLabel } from '../../src/ui/goldFormat';

describe('gold formatting', () => {
  it('groups thousands, so a big wallet reads at a glance', () => {
    expect(formatCount(9999999)).toBe('9,999,999');
    expect(formatCount(15775)).toBe('15,775');
    expect(formatCount(750)).toBe('750');
    expect(formatGold(1250)).toBe('1,250 gold');
  });

  it('splits a price label around the coin, keeping each side of the text', () => {
    expect(splitGoldLabel(`Buy ×5 · ${goldPrice(2625)}`)).toEqual({ head: 'Buy ×5 ·', tail: '2,625' });
    expect(splitGoldLabel(goldPrice(500))).toEqual({ head: '', tail: '500' });
    expect(splitGoldLabel('Claim Free ✦')).toBeNull();
  });
});
