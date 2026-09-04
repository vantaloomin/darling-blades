import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { manaValue, type CardDef, type EffectOp } from '../../src/engine/types';

/**
 * The mirror image of the Empower ceiling: a FLOOR on extra-land ramp.
 *
 * In this format the land reserve guarantees a land for every drop and lands
 * cost zero deck slots, so an extra land drop is never the conditional half
 * that Explore is in MTG - it is Rampant Growth every time, and Rampant Growth
 * costs two mana. Four one-mana copies in an opening hand put six lands on
 * the board on turn 2 (owner catch, 2026-09-04, after 1.7 shipped).
 *
 * The power formula cannot police this on its own: one mana step (0.82) is
 * narrower than its outlier band (1.5), so a {G} single-op ritual reads
 * "slightly off" when it is format-warping. Hence a hard rule rather than a
 * rate. Adding a name to the allowlist is a ruling, not a slip.
 */
const RAMP_FLOOR = 2;

/** Cards knowingly printed under the floor. Empty on purpose. */
const BELOW_FLOOR_BY_RULING: string[] = [];

function grantsExtraLandDrop(card: CardDef): boolean {
  const ops: EffectOp[] = [
    ...(card.abilities ?? []).flatMap((a) => a.ops ?? []),
    ...(card.empower?.ops ?? []),
    ...(card.retell?.ops ?? []),
    ...(card.chapters ?? []).flat(),
  ];
  return ops.some((op) => op.op === 'extraLandDrop');
}

describe('extra-land ramp floor', () => {
  const rampCards = (Object.values(CARD_DB) as CardDef[]).filter(
    (d) => !d.token && d.cost !== undefined && grantsExtraLandDrop(d),
  );

  it('finds the ramp cards it is guarding', () => {
    expect(rampCards.length).toBeGreaterThan(20);
  });

  it('prints no extra-land-drop card below the floor', () => {
    const below = rampCards
      .filter((d) => manaValue(d.cost!) < RAMP_FLOOR)
      .map((d) => d.name)
      .sort();
    expect(below).toEqual([...BELOW_FLOOR_BY_RULING].sort());
  });
});
