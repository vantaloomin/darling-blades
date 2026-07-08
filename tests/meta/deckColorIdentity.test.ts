import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef } from '../../src/engine/types';
import { deckColorIdentity, deckColorStyle } from '../../src/meta/deckColorIdentity';

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    types: ['creature'],
    subtypes: [],
    colors: ['G'],
    rarity: 'c',
    cost: { generic: 1, pips: { G: 1 } },
    attack: 1,
    defense: 1,
    ...over,
  };
}

const DB: CardDb = Object.freeze({
  green: card('green', { colors: ['G'] }),
  white: card('white', { colors: ['W'] }),
  azorius: card('azorius', { colors: ['W', 'U'] }),
  relic: card('relic', {
    types: ['artifact'],
    colors: [],
    cost: { generic: 2, pips: {} },
    attack: undefined,
    defense: undefined,
  }),
  dual_land: card('dual_land', {
    types: ['land'],
    colors: [],
    cost: undefined,
    manaAbility: ['G', 'W'],
    attack: undefined,
    defense: undefined,
  }),
});

describe('deck color identity', () => {
  it('classifies nonland card colors and ignores mana-fixing lands', () => {
    expect(deckColorIdentity(['green', 'dual_land', 'relic'], DB)).toEqual(['G']);
    expect(deckColorStyle(['green', 'dual_land', 'relic'], DB)).toBe('mono');
  });

  it('classifies exactly two nonland colors as dual-color', () => {
    expect(deckColorIdentity(['green', 'white', 'dual_land'], DB)).toEqual(['W', 'G']);
    expect(deckColorStyle(['green', 'white', 'dual_land'], DB)).toBe('dual');
  });

  it('treats colorless-only or three-color decks as other', () => {
    expect(deckColorStyle(['relic', 'dual_land'], DB)).toBe('other');
    expect(deckColorStyle(['green', 'azorius'], DB)).toBe('other');
  });
});
