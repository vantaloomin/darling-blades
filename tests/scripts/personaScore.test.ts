import { describe, expect, it } from 'vitest';
import { rateCard } from '../../scripts/personas/score';
import type { AbilityDef, CardDef, EffectOp } from '../../src/engine/types';

function card(id: string, when: AbilityDef['when'], condition: AbilityDef['condition'], op: EffectOp): CardDef {
  return {
    id,
    name: id,
    types: ['artifact'],
    subtypes: [],
    cost: { generic: 1, pips: {} },
    colors: [],
    abilities: [{ when, condition, ops: [op] }],
    rarity: 'c',
  };
}

describe('persona score Starborne costing riders', () => {
  it('keeps one-shot Propagate at 0.70 and applies §4i dawn expectations to repeatable Propagate', () => {
    const oneShot = card('one-shot', 'arrives', undefined, { op: 'propagate' });
    const repeatable = card('repeatable', 'dawn', undefined, { op: 'propagate' });

    expect(rateCard(oneShot)).toBeCloseTo(0.35 + 0.7);
    expect(rateCard(repeatable)).toBeCloseTo(0.35 + 1.65 * 3);
  });

  it('applies the provisional threshold and conditional-dawn discounts', () => {
    const threshold = card(
      'threshold',
      'arrives',
      { kind: 'markedThreshold', n: 5, subject: 'permanents' },
      { op: 'draw', n: 1 },
    );
    const conditionalDawn = card('conditional-dawn', 'dawn', 'controlMarked', { op: 'draw', n: 1 });

    expect(rateCard(threshold)).toBeCloseTo(0.35 + 1.35 * 0.5);
    expect(rateCard(conditionalDawn)).toBeCloseTo(0.35 + 1.35 * 3 * 0.75);
  });

  it('prices the marked-opponent boost through its conservative provisional scope entry', () => {
    const markedDebuff = card('marked-debuff', 'spell', undefined, {
      op: 'boost',
      p: -2,
      t: -2,
      scope: 'theirMarked',
    });

    expect(rateCard(markedDebuff)).toBeCloseTo(0.35 + 0.9 * 0.65);
  });
});
