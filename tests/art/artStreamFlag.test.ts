import { describe, expect, it } from 'vitest';
import { artStreamEnabled } from '../../src/config/features';

/**
 * The art-streaming switch (1.9 lane D, S3): the feature flag decides, and the
 * `?artStream=on|off` URL switch overrides it for one page load, so the store
 * can be exercised before the flag flips and switched off after it does.
 */
describe('artStreamEnabled', () => {
  it('follows the flag when the URL says nothing about it', () => {
    expect(artStreamEnabled('', false)).toBe(false);
    expect(artStreamEnabled('', true)).toBe(true);
    expect(artStreamEnabled('?quality=lite&artBudget=8', false)).toBe(false);
  });

  it('turns streaming on with ?artStream=on while the flag is off', () => {
    expect(artStreamEnabled('?artStream=on', false)).toBe(true);
    expect(artStreamEnabled('?quality=lite&artStream=on&artBudget=8', false)).toBe(true);
  });

  it('turns streaming off with ?artStream=off while the flag is on', () => {
    expect(artStreamEnabled('?artStream=off', true)).toBe(false);
  });

  it('ignores any other value and keeps the flag', () => {
    expect(artStreamEnabled('?artStream=1', false)).toBe(false);
    expect(artStreamEnabled('?artStream=yes', true)).toBe(true);
  });
});
