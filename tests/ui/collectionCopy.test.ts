import { describe, expect, it } from 'vitest';
import { clearedPinSummaryCopy } from '../../src/ui/collectionCopy';

describe('collection shard result copy', () => {
  it('uses singular copy for one cleared pinned look', () => {
    expect(clearedPinSummaryCopy({ deckName: 'Midnight Storybook', countCleared: 1 })).toBe(
      'Cleared 1 pinned look in Midnight Storybook.',
    );
  });

  it('uses plural copy for multiple cleared pinned looks', () => {
    expect(clearedPinSummaryCopy({ deckName: 'Midnight Storybook', countCleared: 2 })).toBe(
      'Cleared 2 pinned looks in Midnight Storybook.',
    );
  });
});
