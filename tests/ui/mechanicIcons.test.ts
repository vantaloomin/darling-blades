import { describe, expect, it } from 'vitest';
import { MECHANIC_ICON_KEY } from '../../src/ui/KeywordIcons';

describe('mechanic icons', () => {
  it('provides the open-eye Awakening glyph through the shared icon bake', () => {
    expect(MECHANIC_ICON_KEY.awakening).toBe('mechanic-awakening');
  });
});
