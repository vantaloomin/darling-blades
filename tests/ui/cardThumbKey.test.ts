import { describe, expect, it } from 'vitest';
import { cardThumbKey } from '../../src/ui/cardThumbKey';

describe('CardThumbCache style keys', () => {
  it('keeps dark-tales thumbnails distinct from default and other styles', () => {
    const keys = [
      cardThumbKey('land-plains'),
      cardThumbKey('land-plains', 'base'),
      cardThumbKey('land-plains', 'ragnarok'),
      cardThumbKey('land-plains', 'celtic-fae'),
      cardThumbKey('land-plains', 'dark-tales'),
    ];

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.at(-1)).toBe('card-thumb-land-plains--dark-tales');
  });
});
