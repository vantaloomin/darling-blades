import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import type { CardDb, CardDef } from '../../src/engine/types';
import {
  auditLandFetchCards,
  WARCHEST_DECK_SIZE,
  findLandFetchCards,
  hasLandFetchBehavior,
  isDualLand,
  isUtilityTapland,
  landFetchExclusionError,
  reserveColorIdentity,
  validateWarchestDeckShape,
  validateLandReserve,
} from '../../src/meta/warchest';
import type { LandReserveValidationOptions } from '../../src/meta/warchest';
import { validateWarchestDeck } from '../../src/meta/darlings';
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
const DUAL_THREE = 'dual-three';
const DUAL_FOUR = 'dual-four';
const DUAL_FIVE = 'dual-five';
const SINGLE_LAND = 'single-land';
const WHITE_BASIC = 'white-basic';
const BLUE_BASIC = 'blue-basic';
const SPELL = 'spell';
const GREEN_SPELL = 'green-spell';
const WHITE_SPELL = 'white-spell';
const BLUE_COST_SPELL = 'blue-cost-spell';
const FETCH = 'fetch';
const EMPOWER_FETCH = 'empower-fetch';
const CHAPTERS_FETCH = 'chapters-fetch';
const RETELL_FETCH = 'retell-fetch';
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
  [DUAL_THREE]: card(DUAL_THREE, {
    name: 'Third Crossing',
    types: ['land'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['B', 'R'],
  }),
  [DUAL_FOUR]: card(DUAL_FOUR, {
    name: 'Fourth Crossing',
    types: ['land'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['R', 'U'],
  }),
  [DUAL_FIVE]: card(DUAL_FIVE, {
    name: 'Fifth Crossing',
    types: ['land'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['W', 'B'],
  }),
  [SINGLE_LAND]: card(SINGLE_LAND, {
    name: 'Grove Road',
    types: ['land'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['G'],
  }),
  [WHITE_BASIC]: card(WHITE_BASIC, {
    name: 'Plains',
    types: ['land'],
    supertypes: ['basic'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['W'],
  }),
  [BLUE_BASIC]: card(BLUE_BASIC, {
    name: 'Island',
    types: ['land'],
    supertypes: ['basic'],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['U'],
  }),
  [SPELL]: card(SPELL, { name: 'Ordinary Spell' }),
  [GREEN_SPELL]: card(GREEN_SPELL, {
    name: 'Grove Adept',
    colors: ['G'],
    cost: { generic: 0, pips: { G: 1 } },
  }),
  [WHITE_SPELL]: card(WHITE_SPELL, {
    name: 'Dawn Adept',
    colors: ['W'],
    cost: { generic: 0, pips: { W: 1 } },
  }),
  [BLUE_COST_SPELL]: card(BLUE_COST_SPELL, {
    name: 'Mist Adept',
    // Deliberately differs from the cost to prove the tuning rule reads pips.
    colors: ['G'],
    cost: { generic: 0, pips: { U: 1 } },
  }),
  [FETCH]: card(FETCH, {
    name: 'Verdant Compass',
    abilities: [{ when: 'spell', ops: [{ op: 'fetchLand' }] }],
  }),
  [EMPOWER_FETCH]: card(EMPOWER_FETCH, {
    name: 'Empowered Compass',
    empower: { cost: { generic: 1, pips: {} }, ops: [{ op: 'fetchLand' }] },
  }),
  [CHAPTERS_FETCH]: card(CHAPTERS_FETCH, {
    name: 'Chapter Compass',
    chapters: [[{ op: 'fetchLand' }]],
  }),
  [RETELL_FETCH]: card(RETELL_FETCH, {
    name: 'Retold Compass',
    retell: { cost: { generic: 1, pips: {} }, ops: [{ op: 'fetchLand' }] },
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
  // Exactly WARCHEST_DECK_SIZE cards from 4-of playsets plus a remainder.
  const fullPlaysets = Math.floor(WARCHEST_DECK_SIZE / 4);
  const remainder = WARCHEST_DECK_SIZE - fullPlaysets * 4;
  return [
    ...Array.from({ length: fullPlaysets }, (_, index) =>
      Array.from({ length: 4 }, () => SPELL_IDS[index]),
    ).flat(),
    ...Array.from({ length: remainder }, () => SPELL_IDS[fullPlaysets]),
  ];
}

function messages(issues: ReturnType<typeof validateWarchestDeck>): string[] {
  return issues.map((issue) => issue.message);
}

describe('Warchest shared validators', () => {
  it('derives the current retired utility tapland set from land shape', () => {
    const retiredIds = Object.values(CARD_DB)
      .filter(isUtilityTapland)
      .map((card) => card.id)
      .sort();
    expect(retiredIds).toEqual([
      'ac-bramble-chapel',
      'ac-court-of-whispers',
      'ac-lowland-fort',
      'ac-mirror-lake',
      'ac-red-tournament-ground',
      'cf-mist-road',
      'cf-mossy-ring',
      'cf-raven-stone',
      'dt-desert-rooftop',
      'dt-hearth-cinders',
      'dt-midnight-road',
      'dt-palace-steps',
      'dt-riverbend-trail',
      'dt-sea-cave',
      'dt-winter-bridge',
      'dt-wolf-path',
      'gm-chapel-yard',
      'gm-lab-annex',
      'gm-moor-path',
      'gm-red-roof-village',
      'gm-thorned-cemetery',
    ]);
  });

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
      'Warchest Reserves need exactly 10 lands (currently 9)',
    );
    expect(
      validateLandReserve(DB, save, [...basicReserve(), BASIC]).map((i) => i.message),
    ).toContain('Warchest Reserves need exactly 10 lands (currently 11)');
  });

  it('rejects more than five dual lands', () => {
    const reserve = dualReserve(DUAL, DUAL, DUAL, DUAL, DUAL, DUAL);
    expect(validateLandReserve(DB, saveWith(DUAL), reserve).map((i) => i.message)).toContain(
      'Warchest Reserves may contain at most 5 dual lands (currently 6)',
    );
  });

  it('allows exactly five distinct dual lands at the reserve cap', () => {
    const ids = [DUAL, TRIPLE, DUAL_THREE, DUAL_FOUR, DUAL_FIVE];
    expect(validateLandReserve(DB, saveWith(...ids), dualReserve(...ids))).toEqual([]);
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
      'Grove Crossing: 1 in Warchest Reserves but only 0 owned',
    );
  });

  it('enforces per-dual playsets and owned copies once per card id', () => {
    const oneOwned = saveWith(DUAL);
    const ownershipIssues = validateLandReserve(DB, oneOwned, dualReserve(DUAL, DUAL, DUAL, DUAL, DUAL));
    expect(ownershipIssues.map((issue) => issue.message)).toEqual([
      'Grove Crossing: 5 copies in Warchest Reserves (max 4)',
      'Grove Crossing: 5 in Warchest Reserves but only 1 owned',
    ]);

    const fiveOwned = saveWith(DUAL);
    fiveOwned.collection[DUAL] = 5;
    const playsetIssues = validateLandReserve(DB, fiveOwned, dualReserve(DUAL, DUAL, DUAL, DUAL, DUAL));
    expect(playsetIssues.map((issue) => issue.message)).toEqual([
      'Grove Crossing: 5 copies in Warchest Reserves (max 4)',
    ]);
    expect(validateLandReserve(DB, saveWith(), basicReserve())).toEqual([]);
  });

  it('enforces an explicit reserve color cap and accepts a deck inside the cap', () => {
    const twoColorReserve = [
      ...Array.from({ length: 5 }, () => BASIC),
      ...Array.from({ length: 5 }, () => WHITE_BASIC),
    ];
    expect(reserveColorIdentity(DB, twoColorReserve)).toEqual(['W', 'G']);
    expect(validateLandReserve(DB, saveWith(), twoColorReserve, {
      maxReserveColors: 2,
      deck: [GREEN_SPELL, WHITE_SPELL],
    })).toEqual([]);

    const threeColorReserve = [
      ...Array.from({ length: 4 }, () => BASIC),
      ...Array.from({ length: 3 }, () => WHITE_BASIC),
      ...Array.from({ length: 3 }, () => BLUE_BASIC),
    ];
    expect(validateLandReserve(DB, saveWith(), threeColorReserve, {
      maxReserveColors: 2,
      deck: [GREEN_SPELL, WHITE_SPELL],
    }).map((issue) => issue.message)).toContain(
      'Warchest Reserves may contain at most 2 colors (currently 3)',
    );
  });

  it('requires every deck cost color to appear in a capped reserve', () => {
    const twoColorReserve = [
      ...Array.from({ length: 5 }, () => BASIC),
      ...Array.from({ length: 5 }, () => WHITE_BASIC),
    ];
    expect(validateLandReserve(DB, saveWith(), twoColorReserve, {
      maxReserveColors: 2,
      deck: [GREEN_SPELL, BLUE_COST_SPELL, BLUE_COST_SPELL],
    }).map((issue) => issue.message)).toEqual([
      'Mist Adept has cost colors absent from its Warchest Reserves: U',
    ]);
  });

  it('preserves uncapped behavior when tuning options are absent', () => {
    const threeColorReserve = [
      ...Array.from({ length: 4 }, () => BASIC),
      ...Array.from({ length: 3 }, () => WHITE_BASIC),
      ...Array.from({ length: 3 }, () => BLUE_BASIC),
    ];
    const baseline = validateLandReserve(DB, saveWith(), threeColorReserve);
    expect(baseline).toEqual([]);
    expect(validateLandReserve(DB, saveWith(), threeColorReserve, {})).toEqual(baseline);

    const malformed = { maxReserveColors: 2 } as unknown as LandReserveValidationOptions;
    expect(validateLandReserve(DB, saveWith(), basicReserve(), malformed).map((issue) => issue.message)).toContain(
      'Capped Warchest validation requires the deck cards',
    );
  });

  it('shares the WARCHEST_DECK_SIZE no-land shape', () => {
    expect(validateWarchestDeckShape(DB, legalDeck())).toEqual([]);
    expect(validateWarchestDeckShape(DB, legalDeck().slice(0, WARCHEST_DECK_SIZE - 1)).map((i) => i.message)).toContain(
      `Reserve-format decks need exactly ${WARCHEST_DECK_SIZE} cards (currently ${WARCHEST_DECK_SIZE - 1})`,
    );
    expect(validateWarchestDeckShape(DB, [...legalDeck(), SPELL]).map((i) => i.message)).toContain(
      `Reserve-format decks need exactly ${WARCHEST_DECK_SIZE} cards (currently ${WARCHEST_DECK_SIZE + 1})`,
    );
    expect(
      validateWarchestDeckShape(DB, [...legalDeck().slice(0, WARCHEST_DECK_SIZE - 1), BASIC]).map((i) => i.message),
    ).toContain('Decks in this format hold no lands; build your Warchest instead');
  });

  it('enforces Constructed playset limits and ownership in Warchest decks', () => {
    const legalSave = saveWith(...SPELL_IDS);
    for (const id of SPELL_IDS) legalSave.collection[id] = 4;
    expect(validateWarchestDeck(DB, legalSave, legalDeck(), basicReserve())).toEqual([]);

    const overCopies = [
      ...Array.from({ length: 5 }, () => SPELL_IDS[0]),
      ...legalDeck().slice(5),
    ];
    expect(messages(validateWarchestDeck(DB, saveWith(...SPELL_IDS), overCopies, basicReserve()))).toContain(
      'spell-0: 5 copies (max 4)',
    );

    const unowned = legalDeck();
    expect(messages(validateWarchestDeck(DB, saveWith(...SPELL_IDS.slice(1)), unowned, basicReserve()))).toContain(
      'spell-0: 4 in deck but only 0 owned',
    );
  });

  it('parameterizes Warchest deck size and capped reserve validation only when requested', () => {
    const legalSave = saveWith(...SPELL_IDS);
    for (const id of SPELL_IDS) legalSave.collection[id] = 4;
    const twoColorReserve = [
      ...Array.from({ length: 5 }, () => BASIC),
      ...Array.from({ length: 5 }, () => WHITE_BASIC),
    ];
    expect(validateWarchestDeck(
      DB,
      legalSave,
      legalDeck().slice(0, 40),
      twoColorReserve,
      { deckSize: 40, maxReserveColors: 2 },
    )).toEqual([]);

    const baseline = validateWarchestDeck(DB, legalSave, legalDeck(), basicReserve());
    expect(validateWarchestDeck(DB, legalSave, legalDeck(), basicReserve(), {})).toEqual(baseline);
  });

  it('excludes land-fetch cards with a direct builder message', () => {
    const cards = [...legalDeck().slice(0, 49), FETCH];
    expect(messages(validateWarchestDeck(DB, saveWith(...SPELL_IDS, FETCH), cards, basicReserve()))).toContain(
      'Verdant Compass cannot find lands here; your lands live in your Warchest.',
    );
    expect(landFetchExclusionError(DB, FETCH)).toBe(
      'Verdant Compass cannot find lands here; your lands live in your Warchest.',
    );
    expect(landFetchExclusionError(DB, SPELL)).toBeNull();
  });

  it('audits all effect-bearing card fields and returns deterministic ids', () => {
    expect(hasLandFetchBehavior(DB[FETCH])).toBe(true);
    expect(hasLandFetchBehavior(DB[EMPOWER_FETCH])).toBe(true);
    expect(hasLandFetchBehavior(DB[SPELL])).toBe(false);
    expect(findLandFetchCards(DB)).toEqual([CHAPTERS_FETCH, EMPOWER_FETCH, FETCH, RETELL_FETCH]);
  });

  it('detects land fetches in chapters and retell ops', () => {
    expect(hasLandFetchBehavior(DB[CHAPTERS_FETCH])).toBe(true);
    expect(hasLandFetchBehavior(DB[RETELL_FETCH])).toBe(true);
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
