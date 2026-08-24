import { describe, expect, it } from 'vitest';
import {
  carryCastEligible,
  carryDropAccepted,
  carryTiltDeg,
  stepCarryFollow,
  type CarryFollowPose,
} from '../../src/ui/castIntentPresentation';

const REST: CarryFollowPose = { x: 0, y: 0, vx: 0, vy: 0 };

describe('stepCarryFollow', () => {
  it('moves toward the target without overshooting it', () => {
    let pose = REST;
    let previousGap = 100;
    for (let i = 0; i < 60; i++) {
      pose = stepCarryFollow(pose, { x: 100, y: 0 }, 16.7, 'full');
      const gap = 100 - pose.x;
      expect(gap).toBeGreaterThanOrEqual(-0.001);
      expect(gap).toBeLessThanOrEqual(previousGap + 0.001);
      previousGap = gap;
    }
    expect(pose.x).toBeCloseTo(100, 1);
  });

  it('settles onto a stationary target', () => {
    let pose: CarryFollowPose = { x: 300, y: 200, vx: -50, vy: 80 };
    for (let i = 0; i < 120; i++) pose = stepCarryFollow(pose, { x: 40, y: 60 }, 16.7, 'full');
    expect(pose.x).toBeCloseTo(40, 3);
    expect(pose.y).toBeCloseTo(60, 3);
    expect(pose.vx).toBeCloseTo(0, 3);
    expect(pose.vy).toBeCloseTo(0, 3);
  });

  it('lags the cursor on the first frame instead of teleporting', () => {
    const pose = stepCarryFollow(REST, { x: 200, y: 0 }, 16.7, 'full');
    expect(pose.x).toBeGreaterThan(0);
    expect(pose.x).toBeLessThan(60);
  });

  it('is framerate-independent to within a hair', () => {
    let fine = REST;
    for (let i = 0; i < 8; i++) fine = stepCarryFollow(fine, { x: 100, y: 0 }, 8, 'full');
    const coarse = stepCarryFollow(REST, { x: 100, y: 0 }, 64, 'full');
    expect(Math.abs(fine.x - coarse.x)).toBeLessThan(1);
  });

  it('snaps to the cursor under reduced motion and off', () => {
    for (const level of ['reduced', 'off'] as const) {
      const pose = stepCarryFollow({ x: 5, y: 5, vx: 40, vy: 40 }, { x: 320, y: 180 }, 16.7, level);
      expect(pose).toEqual({ x: 320, y: 180, vx: 0, vy: 0 });
    }
  });
});

describe('carryTiltDeg', () => {
  it('leans with horizontal velocity and caps at the limit', () => {
    expect(carryTiltDeg(400, 'full')).toBeCloseTo(4.8, 5);
    expect(carryTiltDeg(-400, 'full')).toBeCloseTo(-4.8, 5);
    expect(carryTiltDeg(5000, 'full')).toBe(10);
    expect(carryTiltDeg(-5000, 'full')).toBe(-10);
  });

  it('stays flat outside full motion', () => {
    expect(carryTiltDeg(4000, 'reduced')).toBe(0);
    expect(carryTiltDeg(4000, 'off')).toBe(0);
  });
});

describe('carryCastEligible', () => {
  it('carries only untargeted, non-touch, non-instant casts', () => {
    expect(carryCastEligible({ targeted: false, touch: false, instantCast: false })).toBe(true);
    expect(carryCastEligible({ targeted: true, touch: false, instantCast: false })).toBe(false);
    expect(carryCastEligible({ targeted: false, touch: true, instantCast: false })).toBe(false);
    expect(carryCastEligible({ targeted: false, touch: false, instantCast: true })).toBe(false);
  });
});

describe('carryDropAccepted', () => {
  it('drops above the hand band and cancels inside it', () => {
    expect(carryDropAccepted(400, 620)).toBe(true);
    expect(carryDropAccepted(619.9, 620)).toBe(true);
    expect(carryDropAccepted(620, 620)).toBe(false);
    expect(carryDropAccepted(700, 620)).toBe(false);
  });
});
