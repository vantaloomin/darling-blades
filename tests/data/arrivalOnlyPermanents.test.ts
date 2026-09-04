import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import type { CardDef } from '../../src/engine/types';

/**
 * Owner rule 2026-09-04: a non-creature permanent must do something after it
 * arrives. A one-time effect belongs on a Ritual or Charm; an Artifact or
 * Enchantment whose only text is an arrival trigger is a spell that leaves a
 * blank object behind (Chrome Medallion shipped that way in 1.7.0).
 *
 * "Ongoing" means any of: a trigger other than arrival, a mana ability,
 * Quest chapters, an attachment (Hauntlink), or a static keyword.
 */
function isNonCreaturePermanent(card: CardDef): boolean {
  if (card.token) return false;
  const types = card.types;
  if (types.includes('creature') || types.includes('land')) return false;
  return types.includes('artifact') || types.includes('enchantment');
}

function hasOngoingText(card: CardDef): boolean {
  if (card.manaAbility?.length) return true;
  if (card.chapters?.length) return true;
  if (card.hauntlink) return true;
  if (card.keywords?.length) return true;
  return (card.abilities ?? []).some((ability) => ability.when !== 'arrives');
}

describe('non-creature permanents carry ongoing text', () => {
  it('flags no Artifact or Enchantment whose only text is an arrival trigger', () => {
    const arrivalOnly = ALL_CARDS.filter((card) => isNonCreaturePermanent(card) && !hasOngoingText(card)).map((card) => card.id);
    expect(arrivalOnly, 'one-time effects belong on Rituals or Charms').toEqual([]);
  });

  it('keeps the 2026-09-04 Starborne fixes in their approved shapes', () => {
    const byId = new Map(ALL_CARDS.map((card) => [card.id, card]));
    expect(byId.get('sb-chrome-medallion')).toMatchObject({
      types: ['artifact'],
      rarity: 'c',
      abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
    });
    expect(byId.get('sb-redline-salvage')).toMatchObject({
      types: ['ritual'],
      rarity: 'c',
      cost: { generic: 0, pips: { R: 1 } },
      skim: { cost: { generic: 1, pips: {} } },
      abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'addCounters', n: 1, to: 'target' }] }],
    });
  });
});
