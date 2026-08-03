import { describe, expect, it } from 'vitest';
import {
  CARD_TRAVEL_MOTION,
  HAUNTLINK_OVERLAP,
  SHARD_HOLD_BUTTON_PROGRESS,
  hauntlinkOverlap,
  targetRingTone,
} from '../../src/ui/duelPresentation';

describe('duel presentation rules', () => {
  it('tucks Hauntlink cards upward with an exposed header on either battlefield row', () => {
    expect(HAUNTLINK_OVERLAP.scale).toBe(0.64);
    expect(hauntlinkOverlap('you')).toEqual({ x: -18, y: -56, scale: 0.64 });
    expect(hauntlinkOverlap('opponent')).toEqual({ x: 18, y: -56, scale: 0.64 });
  });

  it('fans multiple Hauntlinks without changing their under-host direction', () => {
    expect(hauntlinkOverlap('you', 2)).toEqual({ x: 2, y: -68, scale: 0.64 });
    expect(hauntlinkOverlap('opponent', 2)).toEqual({ x: 38, y: -68, scale: 0.64 });
  });

  it('uses red only for legal targets controlled by the opponent', () => {
    expect(targetRingTone('you')).toBe('friendly');
    expect(targetRingTone('opponent')).toBe('hostile');
  });

  it('keeps reduced-motion paths out of the slower full-motion tuning block', () => {
    expect(CARD_TRAVEL_MOTION.drawToHand.duration).toBe(280);
    expect(CARD_TRAVEL_MOTION.playToStation.duration).toBe(420);
    expect(CARD_TRAVEL_MOTION.stationToBattlefield.duration).toBe(420);
  });

  it('keeps hold progress inside the action button instead of using a cursor halo', () => {
    expect(SHARD_HOLD_BUTTON_PROGRESS.inset).toBe(3);
    expect(SHARD_HOLD_BUTTON_PROGRESS.fillAlpha).toBeGreaterThan(0);
  });
});
