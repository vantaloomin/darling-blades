import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { validateActivatedDef, validateTriggerTargetsDef } from '../../src/engine/types';
import type { CardDef, TargetSpec, TriggerWhen } from '../../src/engine/types';

const creature: CardDef = {
  id: 'target-contract', name: 'Target contract', types: ['creature'],
  subtypes: [], colors: [], rarity: 'c', attack: 2, defense: 2,
};
const yours: TargetSpec = { what: 'yourCreature' };

describe('deferred trigger target contract', () => {
  it('every collectible uses target shapes the engine can resolve', () => {
    const errors = ALL_CARDS.filter((card) => !card.token).flatMap((card) =>
      validateTriggerTargetsDef(card).map((error) => `${card.id}: ${error}`));
    expect(errors).toEqual([]);
  });

  it.each<TriggerWhen>(['arrives', 'dies', 'attacks', 'dawn', 'provoked', 'allyDies', 'allyAttacks', 'youGainLife', 'youCastCharm', 'sunset'])(
    '%s refuses multiple or fanned targets but accepts one shared target', (when) => {
      const withTargets = (targets: TargetSpec[]): CardDef => ({
        ...creature,
        abilities: [{ when, targets, ops: [{ op: 'damage', n: 1, to: 'target' }, { op: 'addCounters', n: 1, to: 'target' }] }],
      });
      for (const targets of [[yours, yours], [{ ...yours, upTo: 2 as const }], [{ ...yours, exactly: 2 as const }]]) {
        expect(validateTriggerTargetsDef(withTargets(targets))).not.toEqual([]);
      }
      expect(validateTriggerTargetsDef(withTargets([yours]))).toEqual([]);
      expect(validateTriggerTargetsDef(withTargets([]))).toEqual([]);
    },
  );

  it('spells and Duties can bind two targets before resolution', () => {
    const targets: TargetSpec[] = [yours, yours];
    const ops = [{ op: 'moveMark' as const }];
    const card: CardDef = {
      ...creature,
      abilities: [{ when: 'spell', targets, ops }],
      activated: { cost: { tap: true }, targets, ops },
    };
    expect(validateTriggerTargetsDef(card)).toEqual([]);
    expect(validateActivatedDef(card)).toEqual([]);
  });
});
