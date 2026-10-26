import { describe, expect, it } from 'vitest';
import { fullScreenOfferedFor } from '../../src/platform/fullscreen';

describe('fullScreenOfferedFor (M8)', () => {
  it('is offered on a touch screen whose browser allows full screen', () => {
    expect(fullScreenOfferedFor({ coarsePointer: true, enabled: true, launchedFullScreen: false })).toBe(true);
  });

  it('is not offered on iPhone Safari, on desktop, or in a home-screen app already full screen', () => {
    expect(fullScreenOfferedFor({ coarsePointer: true, enabled: false, launchedFullScreen: false })).toBe(false);
    expect(fullScreenOfferedFor({ coarsePointer: false, enabled: true, launchedFullScreen: false })).toBe(false);
    expect(fullScreenOfferedFor({ coarsePointer: true, enabled: true, launchedFullScreen: true })).toBe(false);
  });
});
