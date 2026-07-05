import { describe, expect, it } from 'vitest';
import { isType } from '../../src/engine/types';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { ATTACK_FX_MAP, attackFxFor, type AttackArchetype } from '../../src/data/attackFx';

const ARCHETYPES: readonly AttackArchetype[] = [
  'slash',
  'cleave',
  'pierce',
  'arcane',
  'fire',
  'frost',
  'shadow',
  'venom',
  'claw',
  'radiance',
  'aerial',
  'impact',
];

const creatures = ALL_CARDS.filter((c) => isType(c, 'creature'));

describe('attackFxFor', () => {
  it('returns one of the 12 archetypes for every creature in the catalog', () => {
    for (const card of creatures) {
      const spec = attackFxFor(card);
      expect(
        ARCHETYPES.includes(spec.archetype),
        `${card.id} archetype ${spec.archetype} is not a known archetype`,
      ).toBe(true);
      expect(typeof spec.heavy, `${card.id} heavy flag`).toBe('boolean');
    }
  });

  it('resolves mapped creatures to their exact map entry', () => {
    for (const [id, spec] of Object.entries(ATTACK_FX_MAP)) {
      expect(attackFxFor(CARD_DB[id])).toEqual(spec);
    }
  });
});

describe('ATTACK_FX_MAP integrity', () => {
  it('every key is a real catalog card that is a creature', () => {
    for (const id of Object.keys(ATTACK_FX_MAP)) {
      const card = CARD_DB[id];
      expect(card, `ATTACK_FX_MAP key ${id} is not in the catalog`).toBeDefined();
      expect(isType(card, 'creature'), `ATTACK_FX_MAP key ${id} is not a creature`).toBe(true);
    }
  });

  it('every entry uses a known archetype', () => {
    for (const [id, spec] of Object.entries(ATTACK_FX_MAP)) {
      expect(
        ARCHETYPES.includes(spec.archetype),
        `${id} archetype ${spec.archetype} is not a known archetype`,
      ).toBe(true);
    }
  });

  it('covers every creature in the catalog', () => {
    const missing = creatures.filter((c) => !(c.id in ATTACK_FX_MAP)).map((c) => c.id);
    expect(
      missing.length,
      `ATTACK_FX_MAP is missing ${missing.length} creature(s): ${missing.join(', ')}`,
    ).toBe(0);
  });
});
