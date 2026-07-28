import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import type { CardDb, CardDef } from '../../src/engine/types';
import {
  auditLandFetchCards,
  BATTLE_BOX_DECK_SIZE,
  findLandFetchCards,
  hasLandFetchBehavior,
  isDualLand,
  landFetchExclusionError,
  validateBattleBoxDeckShape,
  validateLandReserve,
} from '../../src/meta/battleBox';
import { validateBattleBoxDeck } from '../../src/meta/darlings';
import { freshSave, type SaveData } from '../../src/meta/SaveManager';

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    types: ['creature'],
    subtypes: [],
    colors: [],
    cost: { generic: 1, pips: {} },
    attack: 2,
    defense: 2,
    rarity: 'c',
    ...over,
  };
}

const BASIC = 'basic';
const DUAL = 'dual';
const TRIPLE = 'triple';
const SINGLE_LAND = 'single-land';
const SPELL = 'spell';
const FETCH = 'fetch';
const EMPOWER_FETCH = 'empower-fetch';
const SPELL_IDS = Array.from({ length: 13 }, (_, i) => `spell-${i}`);
const GENERATED: Record<string, CardDef> = Object.fromEntries(
  SPELL_IDS.map((id) => [id, card(id)]),
);

const DB: CardDb = Object.freeze({
  [BASIC]: card(BASIC, {
    name: 'Forest',
    types: ['land'],
    supertypes: ['basic'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['G'],
  }),
  [DUAL]: card(DUAL, {
    name: 'Grove Crossing',
    types: ['land'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['G', 'W'],
  }),
  [TRIPLE]: card(TRIPLE, {
    name: 'Three-Way Crossing',
    types: ['land'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['W', 'U', 'B'],
  }),
  [SINGLE_LAND]: card(SINGLE_LAND, {
    name: 'Grove Road',
    types: ['land'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['G'],
  }),
  [SPELL]: card(SPELL, { name: 'Ordinary Spell' }),
  [FETCH]: card(FETCH, {
    name: 'Verdant Compass',
    abilities: [{ when: 'spell', ops: [{ op: 'fetchLand' }] }],
  }),
  [EMPOWER_FETCH]: card(EMPOWER_FETCH, {
    name: 'Empowered Compass',
    empower: { cost: { generic: 1, pips: {} }, ops: [{ op: 'fetchLand' }] },
  }),
  ...GENERATED,
});

function saveWith(...ownedIds: string[]): SaveData {
  const save = freshSave(0);
  for (const id of ownedIds) save.collection[id] = 1;
  return save;
}

function basicReserve(): string[] {
  return Array.from({ length: 10 }, () => BASIC);
}

function dualReserve(...ids: string[]): string[] {
  return [...ids, ...Array.from({ length: 10 - ids.length }, () => BASIC)];
}

function legalDeck(): string[] {
  return [
    ...Array.from({ length: 4 }, () => SPELL_IDS[0]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[1]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[2]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[3]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[4]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[5]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[6]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[7]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[8]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[9]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[10]),
    ...Array.from({ length: 4 }, () => SPELL_IDS[11]),
    SPELL_IDS[12],
    SPELL_IDS[12],
  ];
}

function messages(issues: ReturnType<typeof validateBattleBoxDeck>): string[] {
  return issues.map((issue) => issue.message);
}

describe('Battle Box shared validators', () => {
  it('classifies duals from their mana ability shape, including three-color lands', () => {
    expect(isDualLand(DB[DUAL])).toBe(true);
    expect(isDualLand(DB[TRIPLE])).toBe(true);
    expect(isDualLand(DB[BASIC])).toBe(false);
    expect(isDualLand(DB[SINGLE_LAND])).toBe(false);
    expect(isDualLand(DB[SPELL])).toBe(false);
  });

  it('requires exactly 10 reserve lands at both boundaries', () => {
    const save = saveWith(DUAL);
    expect(validateLandReserve(DB, save, basicReserve().slice(0, 9)).map((i) => i.message)).toContain(
      'Land reserves need exactly 10 lands (currently 9)',
    );
    expect(
      validateLandReserve(DB, save, [...basicReserve(), BASIC]).map((i) => i.message),
    ).toContain('Land reserves need exactly 10 lands (currently 11)');
  });

  it('rejects more than five dual lands', () => {
    const reserve = dualReserve(DUAL, DUAL, DUAL, DUAL, DUAL, DUAL);
    expect(validateLandReserve(DB, saveWith(DUAL), reserve).map((i) => i.message)).toContain(
      'Land reserves may contain at most 5 dual lands (currently 6)',
    );
  });

  it('allows basics and rejects non-basic, non-dual lands and non-lands', () => {
    expect(validateLandReserve(DB, saveWith(DUAL), basicReserve())).toEqual([]);
    expect(validateLandReserve(DB, saveWith(), dualReserve(SINGLE_LAND)).map((i) => i.message)).toContain(
      'Grove Road is not a basic land or dual land',
    );
    expect(validateLandReserve(DB, saveWith(), dualReserve(SPELL)).map((i) => i.message)).toContain(
      'Ordinary Spell is not a basic land or dual land',
    );
  });

  it('requires ownership for duals but not basics', () => {
    expect(validateLandReserve(DB, saveWith(), basicReserve())).toEqual([]);
    expect(validateLandReserve(DB, saveWith(), dualReserve(DUAL)).map((i) => i.message)).toContain(
      'Grove Crossing is not in your collection',
    );
  });

  it('shares the 50-card no-land shape', () => {
    expect(validateBattleBoxDeckShape(DB, legalDeck())).toEqual([]);
    expect(validateBattleBoxDeckShape(DB, legalDeck().slice(0, BATTLE_BOX_DECK_SIZE - 1)).map((i) => i.message)).toContain(
      'Reserve-format decks need exactly 50 cards (currently 49)',
    );
    expect(validateBattleBoxDeckShape(DB, [...legalDeck(), SPELL]).map((i) => i.message)).toContain(
      'Reserve-format decks need exactly 50 cards (currently 51)',
    );
    expect(validateBattleBoxDeckShape(DB, [...legalDeck().slice(0, 49), BASIC]).map((i) => i.message)).toContain(
      'Decks in this format hold no lands; build your land reserve instead',
    );
  });

  it('enforces Constructed playset limits and ownership in Battle Box decks', () => {
    const legalSave = saveWith(...SPELL_IDS);
    for (const id of SPELL_IDS) legalSave.collection[id] = 4;
    expect(validateBattleBoxDeck(DB, legalSave, legalDeck(), basicReserve())).toEqual([]);

    const overCopies = [
      ...Array.from({ length: 5 }, () => SPELL_IDS[0]),
      ...legalDeck().slice(5),
    ];
    expect(messages(validateBattleBoxDeck(DB, saveWith(...SPELL_IDS), overCopies, basicReserve()))).toContain(
      'spell-0: 5 copies (max 4)',
    );

    const unowned = legalDeck();
    expect(messages(validateBattleBoxDeck(DB, saveWith(...SPELL_IDS.slice(1)), unowned, basicReserve()))).toContain(
      'spell-0: 4 in deck but only 0 owned',
    );
  });

  it('excludes land-fetch cards with a direct builder message', () => {
    const cards = [...legalDeck().slice(0, 49), FETCH];
    expect(messages(validateBattleBoxDeck(DB, saveWith(...SPELL_IDS, FETCH), cards, basicReserve()))).toContain(
      'Verdant Compass cannot find lands here; your lands live in your reserve.',
    );
    expect(landFetchExclusionError(DB, FETCH)).toBe(
      'Verdant Compass cannot find lands here; your lands live in your reserve.',
    );
    expect(landFetchExclusionError(DB, SPELL)).toBeNull();
  });

  it('audits all effect-bearing card fields and returns deterministic ids', () => {
    expect(hasLandFetchBehavior(DB[FETCH])).toBe(true);
    expect(hasLandFetchBehavior(DB[EMPOWER_FETCH])).toBe(true);
    expect(hasLandFetchBehavior(DB[SPELL])).toBe(false);
    expect(findLandFetchCards(DB)).toEqual([EMPOWER_FETCH, FETCH]);
  });

  it('reports every real land-fetching card in the current pool', () => {
    const expected = [
      'ac-woodland-errand',
      'bk-deerkin-grovekeeper',
      'dt-forked-road-choice',
      'dt-ocean-wayfinder',
      'dt-verdant-heart-voyage',
      'gk-demeter',
      'rg-verdant-seidr',
      'rg-worldroot-tender',
      'so-rampant-growth',
      'tk-jin-dengai',
    ];
    expect(auditLandFetchCards(CARD_DB)).toEqual(expected);
  });

  it('keeps audit issue strings free of em dashes', () => {
    expect(landFetchExclusionError(CARD_DB, 'so-rampant-growth')).not.toContain('\u2014');
  });
});
