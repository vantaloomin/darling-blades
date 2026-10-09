import { describe, expect, it } from 'vitest';
import { formatCount, formatGold, goldPrice } from '../../src/ui/goldFormat';
import { splitIconLabel } from '../../src/ui/iconLabel';

describe('gold formatting', () => {
  it('groups thousands, so a big wallet reads at a glance', () => {
    expect(formatCount(9999999)).toBe('9,999,999');
    expect(formatCount(15775)).toBe('15,775');
    expect(formatCount(750)).toBe('750');
    expect(formatGold(1250)).toBe('1,250 gold');
  });

  it('splits a label around its icon, keeping each side of the text', () => {
    expect(splitIconLabel(`Buy ×5 · ${goldPrice(2625)}`)).toEqual({ head: 'Buy ×5 ·', icon: 'gold', tail: '2,625' });
    expect(splitIconLabel(goldPrice(500))).toEqual({ head: '', icon: 'gold', tail: '500' });
    expect(splitIconLabel('{gear} Settings')).toEqual({ head: '', icon: 'gear', tail: 'Settings' });
    // Braces that name no icon stay text.
    expect(splitIconLabel('Claim Free ✦')).toBeNull();
    expect(splitIconLabel('{seed} 42')).toBeNull();
  });
});
