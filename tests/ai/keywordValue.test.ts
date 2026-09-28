import { describe, expect, it } from 'vitest';
import { cardValue, permValue } from '../../src/ai/value';
import type { CardDb, CardDef, Keyword } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * The AI prices a combat keyword by what the creature carrying it hits for
 * (docs/plan-1.8.5.md lane 4): evasion on a 5-attack body is worth more than
 * on a 1-attack body, Deathblade matters most on a small body, and Bulwark
 * costs more the harder the creature could have attacked.
 */
function body(attack: number, defense: number, keywords: Keyword[] = [], awakening?: CardDef['awakening']): CardDef {
  return {
    id: 'body', name: 'Body', types: ['creature'], subtypes: [], cost: { generic: 3, pips: {} }, colors: [],
    attack, defense, keywords, awakening, rarity: 'c',
  };
}

/** What the AI adds to a hand card for printing `keyword` on an attack/defense body. */
function keywordShare(keyword: Keyword, attack: number, defense: number): number {
  const withKeyword: CardDb = { body: body(attack, defense, [keyword]) };
  const without: CardDb = { body: body(attack, defense) };
  return cardValue(withKeyword, 'body') - cardValue(without, 'body');
}

describe('AI keyword valuation scales with attack', () => {
  it('values an attack-scaling keyword higher on a creature that hits harder', () => {
    for (const keyword of ['skyborne', 'twinBlades', 'firstBlade', 'bloodoath', 'warcry'] as const) {
      expect(keywordShare(keyword, 5, 5), keyword).toBeGreaterThan(keywordShare(keyword, 1, 5));
    }
  });

  it('values Deathblade more on a small creature than on a big one', () => {
    const small = keywordShare('deathblade', 1, 1);
    const big = keywordShare('deathblade', 5, 5);
    expect(big).toBeGreaterThan(0);
    expect(small).toBeGreaterThan(big);
  });

  it('charges Bulwark more on a creature that could have attacked harder', () => {
    const weak = keywordShare('bulwark', 1, 5);
    const strong = keywordShare('bulwark', 5, 5);
    expect(weak).toBeLessThan(0);
    expect(strong).toBeLessThan(weak);
  });

  it('re-values a creature on the battlefield on its effective attack', () => {
    // flyer and bear are both 2/2 for two mana; only Skyborne separates them.
    const share = (pump: number): number => {
      const mods = pump ? [{ p: pump, t: 0, keywords: [] }] : [];
      const battlefield = makeTestState({ battlefield: [
        { iid: 1, cardId: 'flyer', controller: 0, untilEotMods: mods },
        { iid: 2, cardId: 'bear', controller: 0, untilEotMods: mods },
      ] }).battlefield;
      return permValue(battlefield, TEST_DB, 1) - permValue(battlefield, TEST_DB, 2);
    };
    expect(share(3)).toBeGreaterThan(share(0));
  });

  it('values an awakening keyword at the attack the rider leaves the creature with', () => {
    const riderShare = (p: number): number =>
      cardValue({ body: body(2, 2, [], { p, keywords: ['skyborne'] }) }, 'body') -
      cardValue({ body: body(2, 2, [], { p }) }, 'body');
    expect(riderShare(3)).toBeGreaterThan(riderShare(0));
  });
});
