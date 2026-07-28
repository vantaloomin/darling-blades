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

  it('keeps variant thumbnails distinct from the plain bake', () => {
    const plain = cardThumbKey('dt-wayfinder-oar');
    const red = cardThumbKey('dt-wayfinder-oar', undefined, 'red|none|standard');
    expect(red).not.toBe(plain);
    expect(red).toBe('card-thumb-dt-wayfinder-oar--v-red|none|standard');
  });
});
