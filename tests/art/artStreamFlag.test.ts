import { describe, expect, it } from 'vitest';
import { artStreamEnabled } from '../../src/config/features';

/**
 * The art-streaming switch (1.9 lane D): ordinary page loads use the store;
 * the `?artStream=on|off` URL switch overrides the release flag for one page
 * load. The no-eviction fallback does not switch back to the old loader.
 */
describe('artStreamEnabled', () => {
  it('streams by default when the URL has no artStream override', () => {
    expect(artStreamEnabled('')).toBe(true);
    expect(artStreamEnabled('?quality=lite&artBudget=8')).toBe(true);
    expect(artStreamEnabled('?artEvict=off')).toBe(true);
  });

  it('follows the flag when the URL says nothing about it', () => {
    expect(artStreamEnabled('', false)).toBe(false);
    expect(artStreamEnabled('', true)).toBe(true);
    expect(artStreamEnabled('?quality=lite&artBudget=8', false)).toBe(false);
  });

  it('turns streaming on with ?artStream=on while the flag is off', () => {
    expect(artStreamEnabled('?artStream=on', false)).toBe(true);
    expect(artStreamEnabled('?quality=lite&artStream=on&artBudget=8', false)).toBe(true);
    expect(artStreamEnabled('?artStream=on')).toBe(true);
  });

  it('restores the old loader with ?artStream=off, including under the shipped default', () => {
    expect(artStreamEnabled('?artStream=off', true)).toBe(false);
    expect(artStreamEnabled('?artStream=off')).toBe(false);
    expect(artStreamEnabled('?quality=lite&artStream=off&artEvict=off')).toBe(false);
  });

  it('ignores any other value and keeps the flag', () => {
    expect(artStreamEnabled('?artStream=1', false)).toBe(false);
    expect(artStreamEnabled('?artStream=yes', true)).toBe(true);
    expect(artStreamEnabled('?artStream=')).toBe(true);
    expect(artStreamEnabled('?artStream=false')).toBe(true);
  });
});
