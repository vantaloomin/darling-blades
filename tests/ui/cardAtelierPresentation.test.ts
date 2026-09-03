import { describe, expect, it } from 'vitest';
import { DROPS } from '../../src/config/rules';
import { variantOdds } from '../../src/meta/pullOdds';
import {
  cardAtelierProbabilityPlate,
  cardAtelierTiltPose,
  cardAtelierWipeDuration,
  cardAtelierWipeFromPointer,
  cardAtelierWipeProgress,
  formatCardAtelierPercent,
} from '../../src/ui/cardAtelierPresentation';

describe('card Atelier presentation', () => {
  it('gives a full-motion mouse pointer a bounded perspective pose', () => {
    const pose = cardAtelierTiltPose({ x: 0.75, y: -0.5, inside: true }, 'full', false);
    expect(pose.angleDeg).toBeCloseTo(1.8);
    expect(pose.scaleX).toBeGreaterThanOrEqual(0.982);
    expect(pose.scaleY).toBeGreaterThanOrEqual(0.986);
    expect(pose.lightOffsetX).toBe(13.5);
    expect(pose.lightOffsetY).toBe(-6);
  });

  it.each([
    ['reduced motion', 'reduced' as const, false],
    ['animations off', 'off' as const, false],
    ['touch', 'full' as const, true],
  ])('keeps the card front-on for %s', (_name, animations, touch) => {
    expect(cardAtelierTiltPose({ x: 1, y: 1, inside: true }, animations, touch)).toEqual({
      angleDeg: 0,
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
      lightOffsetX: 0,
      lightOffsetY: 0,
    });
  });

  it('maps and clamps the compare wipe across the card face', () => {
    expect(cardAtelierWipeFromPointer(-2)).toBe(0);
    expect(cardAtelierWipeFromPointer(-1)).toBe(0);
    expect(cardAtelierWipeFromPointer(0)).toBe(0.5);
    expect(cardAtelierWipeFromPointer(1)).toBe(1);
    expect(cardAtelierWipeFromPointer(2)).toBe(1);
  });

  it('uses the shared cubic ease-out and makes reduced/off reveals immediate', () => {
    expect(cardAtelierWipeProgress(0, 0.5, 0, 180)).toBe(0);
    expect(cardAtelierWipeProgress(0, 0.5, 90, 180)).toBeCloseTo(0.4375);
    expect(cardAtelierWipeProgress(0, 0.5, 180, 180)).toBe(0.5);
    expect(cardAtelierWipeDuration('full')).toBe(180);
    expect(cardAtelierWipeDuration('reduced')).toBe(0);
    expect(cardAtelierWipeDuration('off')).toBe(0);
  });

  it('derives the plate from the live DROPS tables and the canonical odds helper', () => {
    const variant = { frame: 'black', holo: 'void', fullArt: true } as const;
    const plate = cardAtelierProbabilityPlate('ur', variant);
    const product = plate.axes.reduce((value, axis) => value * axis.probability, 1);
    expect(plate.probability).toBe(variantOdds('ur', 'black', 'void', true));
    expect(product).toBeCloseTo(plate.probability, 15);
    expect(plate.axes[0].probability).toBe(
      DROPS.tier.find(([tier]) => tier === 'ur')![1] /
        DROPS.tier.reduce((sum, [, weight]) => sum + weight, 0),
    );
    expect(plate.axisText).toContain('UR');
    expect(plate.axisText).toContain('Full Art');
  });

  it('prints the headline odds exactly and marks only the rounded percentage', () => {
    const plate = cardAtelierProbabilityPlate('ur', { frame: 'black', holo: 'void', fullArt: true });
    expect(plate.oddsText).toBe('1 in 1,975,308,642');
    // The percentage is rounded to the formatter's decimal cap, so it says so.
    expect(plate.percentText).toBe('~0.00000005%');
    // The four table rates are exact at the printed precision: no tilde on them.
    expect(plate.axisText).toBe('UR 1% × Black frame 0.45% × Void holo 0.45% × Full Art 0.25%');
    expect(plate.axisText).not.toContain('~');
  });

  it('leaves an exactly representable percentage unmarked', () => {
    const plate = cardAtelierProbabilityPlate('ur', { frame: 'white', holo: 'none', fullArt: true });
    expect(plate.percentText).toBe('0.00075%');
    expect(plate.oddsText).toBe('1 in 133,333');
    expect(formatCardAtelierPercent(0.01)).toBe('1%');
    expect(formatCardAtelierPercent(0.0045)).toBe('0.45%');
    // A common plate rounds 14.9625% to two decimals, so it is marked.
    expect(cardAtelierProbabilityPlate('c', { frame: 'white', holo: 'none', fullArt: false }).percentText).toBe('~14.96%');
  });

  it('keeps tiny probabilities readable without rounding them to zero', () => {
    expect(formatCardAtelierPercent(0)).toBe('0%');
    expect(formatCardAtelierPercent(0.5)).toBe('50%');
    expect(formatCardAtelierPercent(2.5e-9)).toBe('0.00000025%');
  });
});
