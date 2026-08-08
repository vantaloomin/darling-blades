import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef } from '../../src/engine/types';
import {
  validateWarchestDeck,
  darlingsCardError,
  listOwnedLegendaryCreatures,
  normalizeDarlingsFields,
  validateDarlingsDeck,
} from '../../src/meta/darlings';
import { DARLINGS_DECK_SIZE, WARCHEST_DECK_SIZE } from '../../src/meta/warchest';
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

const DARLING = 'darling';
const COLORLESS_DARLING = 'colorless-darling';
const GREEN_CARD = 'green-card';
const OUTSIDE_CARD = 'outside-card';
const BASIC = 'basic';
const DUAL = 'dual';
const OUTSIDE_DUAL = 'outside-dual';
const SINGLE_LAND = 'single-land';
const TOKEN = 'token';
const FETCH_CARD = 'fetch-card';
const COLORLESS_CARD = 'colorless-card';
const PLAIN_CREATURE = 'plain-creature';
const LEGENDARY_ARTIFACT = 'legendary-artifact';
const UNOWNED_DARLING = 'unowned-darling';
const UNIQUE_IDS = Array.from({ length: DARLINGS_DECK_SIZE }, (_, i) => `unique-${i}`);
const GENERATED: Record<string, CardDef> = Object.fromEntries(
  UNIQUE_IDS.map((id) => [id, card(id)]),
);

const DB: CardDb = Object.freeze({
  [DARLING]: card(DARLING, {
    name: 'Verdant Sovereign',
    supertypes: ['legendary'],
    colors: ['G', 'W'],
  }),
  [COLORLESS_DARLING]: card(COLORLESS_DARLING, {
    name: 'The Empty Crown',
    supertypes: ['legendary'],
    colors: [],
  }),
  [GREEN_CARD]: card(GREEN_CARD, { name: 'Grove Sentinel', colors: ['G'] }),
  [OUTSIDE_CARD]: card(OUTSIDE_CARD, { name: 'Moonlit Envoy', colors: ['U'] }),
  [BASIC]: card(BASIC, {
    name: 'Forest',
    types: ['land'],
    supertypes: ['basic'],
    colors: [],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['G'],
  }),
  [DUAL]: card(DUAL, {
    name: 'Grove Crossing',
    types: ['land'],
    colors: [],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['G', 'W'],
  }),
  [OUTSIDE_DUAL]: card(OUTSIDE_DUAL, {
    name: 'Moonlit Crossing',
    types: ['land'],
    colors: [],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['U', 'B'],
  }),
  [SINGLE_LAND]: card(SINGLE_LAND, {
    name: 'Grove Road',
    types: ['land'],
    colors: [],
    cost: undefined,
    attack: undefined,
    defense: undefined,
    manaAbility: ['G'],
  }),
  [TOKEN]: card(TOKEN, {
    name: 'Saproling Token',
    token: true,
    supertypes: ['legendary'],
    colors: ['G'],
  }),
  [FETCH_CARD]: card(FETCH_CARD, {
    name: 'Verdant Compass',
    colors: ['G'],
    abilities: [{ when: 'spell', ops: [{ op: 'fetchLand' }] }],
  }),
  [COLORLESS_CARD]: card(COLORLESS_CARD, {
    name: 'Relic of Quiet Stars',
    types: ['artifact'],
  }),
  [PLAIN_CREATURE]: card(PLAIN_CREATURE, { name: 'Grove Adept', colors: ['G'] }),
  [LEGENDARY_ARTIFACT]: card(LEGENDARY_ARTIFACT, {
    name: 'Crown Relic',
    types: ['artifact'],
    supertypes: ['legendary'],
  }),
  [UNOWNED_DARLING]: card(UNOWNED_DARLING, {
    name: 'Unowned Darling',
    supertypes: ['legendary'],
    colors: ['G', 'W'],
  }),
  ...GENERATED,
});

function saveWith(...ownedIds: string[]): SaveData {
  const save = freshSave(0);
  for (const id of ownedIds) save.collection[id] = 1;
  return save;
}

function reserve(...ids: string[]): string[] {
  return [...ids, ...Array.from({ length: 10 - ids.length }, () => BASIC)];
}

function legalDeck(): string[] {
  return [...UNIQUE_IDS];
}

function legalSave(): SaveData {
  return saveWith(DARLING, ...UNIQUE_IDS);
}

function messages(issues: ReturnType<typeof validateDarlingsDeck>): string[] {
  return issues.map((issue) => issue.message);
}

describe('Darlings format helpers', () => {
  it('accepts a legal 79-card singleton spell deck with a 10-basic Warchest', () => {
    expect(validateDarlingsDeck(DB, legalSave(), legalDeck(), DARLING, reserve())).toEqual([]);
  });

  it('requires exactly 79 spell cards at both boundaries', () => {
    const save = legalSave();
    expect(messages(validateDarlingsDeck(DB, save, legalDeck().slice(0, DARLINGS_DECK_SIZE - 1), DARLING, reserve()))).toContain(
      `Reserve-format decks need exactly ${DARLINGS_DECK_SIZE} cards (currently ${DARLINGS_DECK_SIZE - 1})`,
    );
    expect(
      messages(validateDarlingsDeck(DB, save, [...legalDeck(), GREEN_CARD], DARLING, reserve())),
    ).toContain(`Reserve-format decks need exactly ${DARLINGS_DECK_SIZE} cards (currently ${DARLINGS_DECK_SIZE + 1})`);
  });

  it('rejects a land in the 79-card spell deck', () => {
    const cards = [...legalDeck().slice(0, DARLINGS_DECK_SIZE - 1), BASIC];
    expect(messages(validateDarlingsDeck(DB, legalSave(), cards, DARLING, reserve()))).toContain(
      'Decks in this format hold no lands; build your Warchest instead',
    );
  });

  it('requires a Darling before play', () => {
    expect(messages(validateDarlingsDeck(DB, legalSave(), legalDeck(), null, reserve()))).toEqual([
      'Choose a Darling before playing',
    ]);
  });

  it('requires the selected Darling to be an owned legendary creature', () => {
    const plainDeck = [PLAIN_CREATURE, ...UNIQUE_IDS];
    const plainSave = saveWith(PLAIN_CREATURE, ...UNIQUE_IDS);
    expect(messages(validateDarlingsDeck(DB, plainSave, plainDeck, PLAIN_CREATURE, reserve()))).toContain(
      'Your Darling must be an owned legendary creature',
    );

    const artifactDeck = [LEGENDARY_ARTIFACT, ...UNIQUE_IDS];
    const artifactSave = saveWith(LEGENDARY_ARTIFACT, ...UNIQUE_IDS);
    expect(
      messages(validateDarlingsDeck(DB, artifactSave, artifactDeck, LEGENDARY_ARTIFACT, reserve())),
    ).toContain('Your Darling must be an owned legendary creature');

    const unownedDeck = [UNOWNED_DARLING, ...UNIQUE_IDS];
    expect(
      messages(validateDarlingsDeck(DB, legalSave(), unownedDeck, UNOWNED_DARLING, reserve())),
    ).toContain('Your Darling must be an owned legendary creature');
  });

  it('rejects a token selected as the Darling even when it is legendary and owned', () => {
    const tokenDeck = [TOKEN, ...UNIQUE_IDS];
    const save = saveWith(TOKEN, ...UNIQUE_IDS);
    expect(messages(validateDarlingsDeck(DB, save, tokenDeck, TOKEN, reserve()))).toContain(
      'Your Darling must be an owned legendary creature',
    );
  });

  it('requires the Darling to stay outside the card list', () => {
    const cards = [DARLING, ...UNIQUE_IDS.slice(0, -1)];
    expect(messages(validateDarlingsDeck(DB, legalSave(), cards, DARLING, reserve()))).toContain(
      'Your Darling must stay outside the deck',
    );
  });

  it('rejects a second copy of any card', () => {
    const cards = [...UNIQUE_IDS.slice(0, -1), UNIQUE_IDS[0]];
    expect(messages(validateDarlingsDeck(DB, legalSave(), cards, DARLING, reserve()))).toContain(
      'unique-0 may appear only once in a Darlings deck',
    );
  });

  it('rejects every unowned card copy', () => {
    const cards = [...UNIQUE_IDS.slice(0, -1), GREEN_CARD];
    expect(messages(validateDarlingsDeck(DB, legalSave(), cards, DARLING, reserve()))).toContain(
      'Grove Sentinel is not in your collection',
    );
  });

  it('rejects tokens', () => {
    const cards = [...UNIQUE_IDS.slice(0, -1), TOKEN];
    expect(messages(validateDarlingsDeck(DB, saveWith(DARLING, ...UNIQUE_IDS, TOKEN), cards, DARLING, reserve()))).toContain(
      'Saproling Token is a token',
    );
  });

  it('rejects a token in a Warchest deck', () => {
    const cards = [...legalDeck().slice(0, WARCHEST_DECK_SIZE - 1), TOKEN];
    const save = saveWith(DARLING, ...UNIQUE_IDS, TOKEN);
    expect(messages(validateWarchestDeck(DB, save, cards, reserve()))).toContain(
      'Saproling Token is a token',
    );
  });

  it('rejects cards outside a colored Darling identity', () => {
    const cards = [...UNIQUE_IDS.slice(0, -1), OUTSIDE_CARD];
    const save = saveWith(DARLING, ...UNIQUE_IDS, OUTSIDE_CARD);
    expect(messages(validateDarlingsDeck(DB, save, cards, DARLING, reserve()))).toContain(
      "Moonlit Envoy is outside your Darling's colors",
    );
  });

  it('enforces strict colorless identity for deck cards and reserve lands', () => {
    const cards = [...UNIQUE_IDS];
    const save = saveWith(COLORLESS_DARLING, ...UNIQUE_IDS, OUTSIDE_DUAL);
    expect(messages(validateDarlingsDeck(DB, save, cards, COLORLESS_DARLING, reserve(OUTSIDE_DUAL)))).toContain(
      'Moonlit Crossing is not allowed with a colorless Darling',
    );
    expect(messages(validateDarlingsDeck(DB, save, cards, COLORLESS_DARLING, reserve()))).toEqual([]);
  });

  it('rejects a reserve land outside a colored Darling identity', () => {
    const save = saveWith(DARLING, ...UNIQUE_IDS, OUTSIDE_DUAL);
    expect(
      messages(validateDarlingsDeck(DB, save, legalDeck(), DARLING, reserve(OUTSIDE_DUAL))),
    ).toContain("Moonlit Crossing is outside your Darling's colors");
  });

  it('excludes land-fetch cards from the deck', () => {
    const cards = [...UNIQUE_IDS.slice(0, -1), FETCH_CARD];
    const save = saveWith(DARLING, ...UNIQUE_IDS, FETCH_CARD);
    expect(messages(validateDarlingsDeck(DB, save, cards, DARLING, reserve()))).toContain(
      'Verdant Compass cannot find lands here; your lands live in your Warchest.',
    );
  });

  it('applies the fetch audit to the external Darling too', () => {
    const fetchDarling = card('fetch-darling', {
      name: 'Compass Queen',
      supertypes: ['legendary'],
      colors: ['G'],
      abilities: [{ when: 'spell', ops: [{ op: 'fetchLand' }] }],
    });
    const db = { ...DB, [fetchDarling.id]: fetchDarling };
    const save = saveWith(fetchDarling.id, ...UNIQUE_IDS);
    expect(messages(validateDarlingsDeck(db, save, legalDeck(), fetchDarling.id, reserve()))).toContain(
      'Compass Queen cannot find lands here; your lands live in your Warchest.',
    );
  });

  it('checks one card for inline identity errors', () => {
    expect(darlingsCardError(DB, DARLING, UNIQUE_IDS[0])).toBeNull();
    expect(darlingsCardError(DB, DARLING, BASIC)).toBeNull();
    expect(darlingsCardError(DB, DARLING, OUTSIDE_CARD)).toBe(
      "Moonlit Envoy is outside your Darling's colors",
    );
    expect(darlingsCardError(DB, COLORLESS_DARLING, COLORLESS_CARD)).toBeNull();
    expect(darlingsCardError(DB, null, UNIQUE_IDS[0])).toBe('Choose a Darling before playing');
  });

  it('lists only owned legendary creatures in deterministic name order', () => {
    const save = saveWith(DARLING, COLORLESS_DARLING, LEGENDARY_ARTIFACT, TOKEN, PLAIN_CREATURE);
    expect(listOwnedLegendaryCreatures(DB, save).map((candidate) => candidate.id)).toEqual([
      COLORLESS_DARLING,
      DARLING,
    ]);
  });

  it('normalizes the three format values and reserve fields', () => {
    expect(normalizeDarlingsFields(DB, 'darlings', DARLING, legalDeck(), [BASIC, DUAL, 'missing', GREEN_CARD])).toEqual({
      format: 'darlings',
      darlingId: DARLING,
      landReserve: [BASIC, DUAL, GREEN_CARD],
    });
    expect(
      normalizeDarlingsFields(DB, 'warchest', DARLING, legalDeck(), [BASIC, ...Array.from({ length: 6 }, () => DUAL)]),
    ).toEqual({
      format: 'warchest',
      darlingId: null,
      landReserve: [BASIC, ...Array.from({ length: 6 }, () => DUAL)],
    });
    expect(normalizeDarlingsFields(DB, 'constructed', DARLING, legalDeck(), [DUAL])).toEqual({
      format: 'constructed',
      darlingId: null,
      landReserve: null,
    });
    expect(normalizeDarlingsFields(DB, 'darlings', DARLING, [BASIC], null)).toEqual({
      format: 'darlings',
      darlingId: DARLING,
      landReserve: [],
    });
  });

  it('keeps all player-facing issue messages free of em dashes', () => {
    const issueSets = [
      validateDarlingsDeck(DB, legalSave(), legalDeck(), DARLING, reserve(OUTSIDE_DUAL)),
      validateDarlingsDeck(DB, saveWith(DARLING, ...UNIQUE_IDS, TOKEN), [DARLING, ...UNIQUE_IDS.slice(0, -1), TOKEN], DARLING, reserve()),
      validateDarlingsDeck(DB, legalSave(), legalDeck(), null, reserve()),
    ];
    expect(issueSets.flat().every((issue) => !issue.message.includes('\u2014'))).toBe(true);
  });
});
