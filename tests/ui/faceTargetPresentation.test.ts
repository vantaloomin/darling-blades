import { describe, expect, it } from 'vitest';
import {
  FACE_TARGET_DEPTH,
  faceTargetSeatStates,
  faceTargetSurfaceState,
} from '../../src/ui/faceTargetPresentation';

describe('face target presentation', () => {
  it('raises an armed portrait above interactive board surfaces', () => {
    expect(faceTargetSurfaceState(true)).toEqual({
      targetEnabled: true,
      depth: FACE_TARGET_DEPTH.armed,
    });
    expect(FACE_TARGET_DEPTH.armed).toBeGreaterThan(40);
  });

  it('restores ordinary portrait priority when targeting disarms', () => {
    expect(faceTargetSurfaceState(false)).toEqual({
      targetEnabled: false,
      depth: FACE_TARGET_DEPTH.resting,
    });
  });

  it('arms either seat independently so self-targeting stays available', () => {
    expect(faceTargetSeatStates({ you: true, opponent: false })).toEqual({
      you: { targetEnabled: true, depth: FACE_TARGET_DEPTH.armed },
      opponent: { targetEnabled: false, depth: FACE_TARGET_DEPTH.resting },
    });
    expect(faceTargetSeatStates({ you: false, opponent: true })).toEqual({
      you: { targetEnabled: false, depth: FACE_TARGET_DEPTH.resting },
      opponent: { targetEnabled: true, depth: FACE_TARGET_DEPTH.armed },
    });
  });
});
