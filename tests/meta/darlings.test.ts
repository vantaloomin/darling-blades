import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef } from '../../src/engine/types';
import {
  darlingsCardError,
  listOwnedLegendaryCreatures,
  normalizeDarlingsFields,
  validateDarlingsDeck,
} from '../../src/meta/darlings';
import { freshSave, type SaveData } from '../../src/meta/SaveManager';

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    types: ['creature'],
    subtypes: [],
    colors: ['G', 'W'],
    cost: { generic: 1, pips: { G: 1 } },
    attack: 2,
    defense: 2,
    rarity: 'c',
    ...over,
  };
}

const DARLING = 'darling';
const COLORLESS_DARLING = 'colorless-darling';
const GREEN_CARD = 'green-card';
const COLORLESS_CARD = 'colorless-card';
const OUTSIDE_CARD = 'outside-card';
const NON_BASIC_LAND = 'non-basic-land';
const BASIC = 'basic';
const TOKEN = 'token';
const PLAIN_CREATURE = 'plain-creature';
const LEGENDARY_ARTIFACT = 'legendary-artifact';
const UNOWNED_DARLING = 'unowned-darling';

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
  [COLORLESS_CARD]: card(COLORLESS_CARD, {
    name: 'Relic of Quiet Stars',
    types: ['artifact'],
    colors: [],
    cost: { generic: 2, pips: {} },
    attack: undefined,
    defense: undefined,
  }),
  [OUTSIDE_CARD]: card(OUTSIDE_CARD, { name: 'Moonlit Envoy', colors: ['U'] }),
  [NON_BASIC_LAND]: card(NON_BASIC_LAND, {
    name: 'Temple of Echoes',
    types: ['land'],
    colors: [],
    cost: undefined,
    attack: undefined,
    defense: undefined,
  }),
  [BASIC]: card(BASIC, {
    name: 'Forest',
    types: ['land'],
    supertypes: ['basic'],
    colors: [],
    cost: undefined,
    attack: undefined,
    defense: undefined,
  }),
  [TOKEN]: card(TOKEN, { name: 'Saproling Token', token: true, colors: ['G'] }),
  [PLAIN_CREATURE]: card(PLAIN_CREATURE, { name: 'Grove Adept', colors: ['G'] }),
  [LEGENDARY_ARTIFACT]: card(LEGENDARY_ARTIFACT, {
    name: 'Crown Relic',
    types: ['artifact'],
    supertypes: ['legendary'],
    colors: [],
    cost: { generic: 3, pips: {} },
    attack: undefined,
    defense: undefined,
  }),
  [UNOWNED_DARLING]: card(UNOWNED_DARLING, {
    name: 'Unowned Darling',
    supertypes: ['legendary'],
    colors: ['G', 'W'],
  }),
});

function saveWith(...ownedIds: string[]): SaveData {
  const save = freshSave(0);
  for (const id of ownedIds) save.collection[id] = 1;
  return save;
}

function deckWith(nonBasicIds: readonly string[], basicCount = 60 - nonBasicIds.length): string[] {
  return [...nonBasicIds, ...Array.from({ length: basicCount }, () => BASIC)];
}

function legalDeck(): string[] {
  return deckWith([DARLING, GREEN_CARD, COLORLESS_CARD]);
}

function legalSave(): SaveData {
  return saveWith(DARLING, GREEN_CARD, COLORLESS_CARD);
}

function messages(issues: ReturnType<typeof validateDarlingsDeck>): string[] {
  return issues.map((issue) => issue.message);
}

describe('Darlings format helpers', () => {
  it('accepts a legal 60-card deck with one copy of each non-basic', () => {
    expect(validateDarlingsDeck(DB, legalSave(), legalDeck(), DARLING)).toEqual([]);
  });

  it('requires exactly 60 cards at both boundaries', () => {
    const save = legalSave();
    expect(messages(validateDarlingsDeck(DB, save, deckWith([DARLING], 58), DARLING))).toContain(
      'Darlings decks need exactly 60 cards (currently 59)',
    );
    expect(messages(validateDarlingsDeck(DB, save, deckWith([DARLING], 60), DARLING))).toContain(
      'Darlings decks need exactly 60 cards (currently 61)',
    );
  });

  it('requires a Darling before play', () => {
    expect(messages(validateDarlingsDeck(DB, legalSave(), legalDeck(), null))).toEqual([
      'Choose a Darling before playing',
    ]);
  });

  it('requires the selected Darling to be an owned legendary creature', () => {
    const plainCreatureDeck = deckWith([PLAIN_CREATURE, GREEN_CARD, COLORLESS_CARD]);
    const plainCreatureSave = saveWith(PLAIN_CREATURE, GREEN_CARD, COLORLESS_CARD);
    expect(messages(validateDarlingsDeck(DB, plainCreatureSave, plainCreatureDeck, PLAIN_CREATURE))).toContain(
      'Your Darling must be an owned legendary creature',
    );

    const artifactDeck = deckWith([LEGENDARY_ARTIFACT, COLORLESS_CARD]);
    const artifactSave = saveWith(LEGENDARY_ARTIFACT, COLORLESS_CARD);
    expect(messages(validateDarlingsDeck(DB, artifactSave, artifactDeck, LEGENDARY_ARTIFACT))).toContain(
      'Your Darling must be an owned legendary creature',
    );

    const unownedDeck = deckWith([UNOWNED_DARLING, GREEN_CARD, COLORLESS_CARD]);
    expect(messages(validateDarlingsDeck(DB, legalSave(), unownedDeck, UNOWNED_DARLING))).toContain(
      'Your Darling must be an owned legendary creature',
    );
  });

  it('requires the Darling to be present in the card list', () => {
    const cards = legalDeck().filter((id) => id !== DARLING);
    cards.push(BASIC);
    expect(messages(validateDarlingsDeck(DB, legalSave(), cards, DARLING))).toContain(
      'Your Darling must be in the deck',
    );
  });

  it('allows unlimited basic lands without ownership', () => {
    expect(validateDarlingsDeck(DB, saveWith(DARLING), deckWith([DARLING], 59), DARLING)).toEqual([]);
  });

  it('rejects a second copy of any non-basic card', () => {
    const cards = deckWith([DARLING, GREEN_CARD, GREEN_CARD]);
    const save = saveWith(DARLING, GREEN_CARD);
    save.collection[GREEN_CARD] = 2;
    expect(messages(validateDarlingsDeck(DB, save, cards, DARLING))).toContain(
      'Grove Sentinel may appear only once in a Darlings deck',
    );
  });

  it('rejects every unowned non-basic card copy', () => {
    const cards = deckWith([DARLING, GREEN_CARD]);
    expect(messages(validateDarlingsDeck(DB, saveWith(DARLING), cards, DARLING))).toContain(
      'Grove Sentinel is not in your collection',
    );
  });

  it('rejects tokens', () => {
    const cards = deckWith([DARLING, TOKEN]);
    const save = saveWith(DARLING, TOKEN);
    expect(messages(validateDarlingsDeck(DB, save, cards, DARLING))).toContain('Saproling Token is a token');
  });

  it('rejects a card outside a colored Darling identity', () => {
    const cards = deckWith([DARLING, OUTSIDE_CARD]);
    const save = saveWith(DARLING, OUTSIDE_CARD);
    expect(messages(validateDarlingsDeck(DB, save, cards, DARLING))).toContain(
      "Moonlit Envoy is outside your Darling's colors",
    );
  });

  it('enforces strict colorless identity for colored cards', () => {
    const cards = deckWith([COLORLESS_DARLING, OUTSIDE_CARD]);
    const save = saveWith(COLORLESS_DARLING, OUTSIDE_CARD);
    expect(messages(validateDarlingsDeck(DB, save, cards, COLORLESS_DARLING))).toContain(
      "Moonlit Envoy is outside your Darling's colors",
    );
  });

  it('allows colorless non-land cards with a colorless Darling', () => {
    const cards = deckWith([COLORLESS_DARLING, COLORLESS_CARD]);
    expect(validateDarlingsDeck(DB, saveWith(COLORLESS_DARLING, COLORLESS_CARD), cards, COLORLESS_DARLING)).toEqual(
      [],
    );
  });

  it('rejects non-basic lands with a colorless Darling', () => {
    const cards = deckWith([COLORLESS_DARLING, NON_BASIC_LAND]);
    const save = saveWith(COLORLESS_DARLING, NON_BASIC_LAND);
    expect(messages(validateDarlingsDeck(DB, save, cards, COLORLESS_DARLING))).toContain(
      'Temple of Echoes is not allowed with a colorless Darling',
    );
  });

  it('checks one card for inline identity errors', () => {
    expect(darlingsCardError(DB, DARLING, GREEN_CARD)).toBeNull();
    expect(darlingsCardError(DB, DARLING, BASIC)).toBeNull();
    expect(darlingsCardError(DB, DARLING, OUTSIDE_CARD)).toBe(
      "Moonlit Envoy is outside your Darling's colors",
    );
    expect(darlingsCardError(DB, COLORLESS_DARLING, COLORLESS_CARD)).toBeNull();
    expect(darlingsCardError(DB, null, GREEN_CARD)).toBe('Choose a Darling before playing');
  });

  it('lists only owned legendary creatures in deterministic name order', () => {
    const save = saveWith(DARLING, COLORLESS_DARLING, LEGENDARY_ARTIFACT, TOKEN, PLAIN_CREATURE);
    expect(listOwnedLegendaryCreatures(DB, save).map((candidate) => candidate.id)).toEqual([
      COLORLESS_DARLING,
      DARLING,
    ]);
  });

  it('normalizes format and Darling fields without using hero-card data', () => {
    expect(normalizeDarlingsFields('darlings', DARLING, [DARLING, BASIC])).toEqual({
      format: 'darlings',
      darlingId: DARLING,
    });
    expect(normalizeDarlingsFields('darlings', DARLING, [BASIC])).toEqual({
      format: 'darlings',
      darlingId: null,
    });
    expect(normalizeDarlingsFields('surprise-format', DARLING, [DARLING])).toEqual({
      format: 'constructed',
      darlingId: null,
    });
    expect(normalizeDarlingsFields('constructed', DARLING, [DARLING])).toEqual({
      format: 'constructed',
      darlingId: null,
    });
  });

  it('keeps all player-facing issue messages free of em dashes', () => {
    const issueSets = [
      validateDarlingsDeck(DB, legalSave(), deckWith([DARLING, OUTSIDE_CARD]), DARLING),
      validateDarlingsDeck(DB, saveWith(DARLING, TOKEN), deckWith([DARLING, TOKEN]), DARLING),
      validateDarlingsDeck(DB, legalSave(), legalDeck(), null),
    ];
    expect(issueSets.flat().every((issue) => !issue.message.includes('\u2014'))).toBe(true);
  });
});
