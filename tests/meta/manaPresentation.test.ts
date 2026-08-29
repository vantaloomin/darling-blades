import { describe, expect, it } from 'vitest';
import { segmentManaText } from '../../src/ui/ManaText';

describe('colorless mana presentation seam', () => {
  it('uses the existing pip-C texture for a colorless mana token', () => {
    expect(segmentManaText('{C}')).toEqual([
      { kind: 'pipRun', value: '{C}', pips: [{ texture: 'pip-C' }] },
    ]);
  });
});
