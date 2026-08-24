import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef } from '../../src/engine/types';
import { saveDeck, switchDeckFormat, validateDeck } from '../../src/meta/DeckStorage';
import { WARCHEST_DECK_SIZE } from '../../src/meta/warchest';
import {
  deckHealth,
  deckRepairNoticeFingerprint,
  deckRepairNoticeState,
  flaggedDecks,
  CLASSIC_RETIRED_ISSUE,
  convertUnmodifiedStarter,
} from '../../src/meta/deckRepair';
import { freshSave, type SavedDeck } from '../../src/meta/SaveManager';

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    types: ['artifact'],
    subtypes: [],
    colors: [],
    cost: { generic: 1, pips: {} },
    rarity: 'c',
    ...over,
  };
}

const BASIC = 'basic';
const SPELL_IDS = Array.from({ length: 25 }, (_, index) => `spell-${index + 1}`);
const SPELL = SPELL_IDS[0];
const DB: CardDb = {
  [BASIC]: card(BASIC, {
    types: ['land'],
    supertypes: ['basic'],
    cost: undefined,
    manaAbility: ['G'],
  }),
  ...Object.fromEntries(SPELL_IDS.map((id) => [id, card(id)])),
};

function ownSpells(save: ReturnType<typeof freshSave>): void {
  for (const id of SPELL_IDS) save.collection[id] = 4;
}

function warchestCards(): string[] {
  return SPELL_IDS.flatMap((id) => [id, id]);
}

function deck(id: string, cards: string[], over: Partial<SavedDeck> = {}): SavedDeck {
  return {
    id,
    name: id,
    cards,
    heroCardId: null,
    landStyle: null,
    format: 'constructed',
    darlingId: null,
    landReserve: null,
    variantPins: cards.map(() => null),
    ...over,
  };
}

describe('deck repair health', () => {
  it('reports unknown constructed card ids instead of throwing', () => {
    const save = freshSave(0);
    const issues = validateDeck(DB, save, [...Array.from({ length: 59 }, () => BASIC), 'missing-card']);

    expect(issues).toContainEqual({ kind: 'error', message: 'That card is not available: missing-card' });
  });

  it('dispatches each deck by its own format and never reinterprets its size', () => {
    const save = freshSave(0);
    save.collection[SPELL] = 50;

    const classic = deck('classic', Array.from({ length: 60 }, () => BASIC));
    const warchest = deck('warchest', Array.from({ length: 60 }, () => SPELL), {
      format: 'warchest',
      landReserve: Array.from({ length: 10 }, () => BASIC),
    });
    const darlings = deck('darlings', Array.from({ length: 79 }, () => SPELL), {
      format: 'darlings',
      darlingId: null,
      landReserve: Array.from({ length: 10 }, () => BASIC),
    });

    expect(deckHealth(DB, save, classic, false).blocked).toBe(false);
    expect(deckHealth(DB, save, warchest, false).issues[0]?.message).toContain(`exactly ${WARCHEST_DECK_SIZE} cards`);
    expect(deckHealth(DB, save, darlings, false).issues.some((issue) => issue.message === 'Choose a Darling before playing')).toBe(true);
  });

  it.each([
    ['constructed', 'Deck has 0/60 cards'],
    ['warchest', `Reserve-format decks need exactly ${WARCHEST_DECK_SIZE} cards (currently 0)`],
    ['darlings', 'Reserve-format decks need exactly 79 cards (currently 0)'],
  ] as const)('prices a newly created empty %s deck at that format size', (format, sizeIssue) => {
    const save = freshSave(0);
    save.decks = [];
    saveDeck(save, {
      id: 'new-deck',
      name: 'New Deck',
      cards: [],
      format,
      darlingId: null,
      landReserve: format === 'constructed' ? null : [],
    });

    const created = save.decks[0];
    expect(created?.format).toBe(format);
    expect(deckHealth(DB, save, created, false).issues).toContainEqual({ kind: 'error', message: sizeIssue });
  });

  it('reports Warchest oversize and land issues after a constructed format switch', () => {
    const save = freshSave(0);
    const constructed = deck('constructed', Array.from({ length: 60 }, () => BASIC));

    const reserve = switchDeckFormat(constructed, 'warchest');
    const messages = deckHealth(DB, save, constructed, false).issues.map((issue) => issue.message);

    expect(reserve).toEqual([]);
    expect(constructed.landReserve).toEqual([]);
    expect(messages).toContain(`Reserve-format decks need exactly ${WARCHEST_DECK_SIZE} cards (currently 60)`);
    expect(messages).toContain('Decks in this format hold no lands; build your Warchest instead');
  });

  it('reports constructed undersize after a Warchest format switch', () => {
    const save = freshSave(0);
    ownSpells(save);
    const warchest = deck('warchest', warchestCards(), {
      format: 'warchest',
      landReserve: Array.from({ length: 10 }, () => BASIC),
    });

    const reserve = switchDeckFormat(warchest, 'constructed');

    expect(reserve).toEqual([]);
    expect(warchest.landReserve).toBeNull();
    expect(deckHealth(DB, save, warchest, false).issues).toContainEqual({
      kind: 'error',
      message: 'Deck has 50/60 cards',
    });
  });

  it('reports singleton and Darling issues after a Darlings format switch', () => {
    const save = freshSave(0);
    ownSpells(save);
    const warchest = deck('warchest', warchestCards(), {
      format: 'warchest',
      darlingId: null,
      landReserve: Array.from({ length: 10 }, () => BASIC),
    });

    switchDeckFormat(warchest, 'darlings');
    const messages = deckHealth(DB, save, warchest, false).issues.map((issue) => issue.message);

    expect(messages).toContain(`${SPELL} may appear only once in a Darlings deck`);
    expect(messages).toContain('Choose a Darling before playing');
  });

  it('summarizes only blocked decks in save order', () => {
    const save = freshSave(0);
    save.decks = [
      deck('legal-with-warning', Array.from({ length: 60 }, () => BASIC)),
      deck('short', [BASIC]),
      deck('unknown', [...Array.from({ length: 59 }, () => BASIC), 'missing-card']),
    ];

    expect(flaggedDecks(DB, save, false).map((summary) => ({
      id: summary.deckId,
      firstIssue: summary.firstIssue,
    }))).toEqual([
      { id: 'short', firstIssue: 'Deck has 1/60 cards' },
      { id: 'unknown', firstIssue: 'That card is not available: missing-card' },
    ]);
  });

  it('blocks every constructed deck once classic retires, however legal its 60 cards are', () => {
    const save = freshSave(0);
    save.collection[SPELL] = 50;
    const legal = deck('legal', Array.from({ length: 60 }, () => BASIC));
    const warchest = deck('warchest', Array.from({ length: WARCHEST_DECK_SIZE }, () => SPELL), {
      format: 'warchest',
      landReserve: Array.from({ length: 10 }, () => BASIC),
    });
    save.decks = [legal, warchest];

    const health = deckHealth(DB, save, legal, true);
    expect(health.blocked).toBe(true);
    expect(health.issues).toEqual([{ kind: 'error', message: CLASSIC_RETIRED_ISSUE }]);
    // Retirement touches constructed only: a Warchest deck is still judged on
    // its own rules and never picks up the retirement issue.
    const migrated = deckHealth(DB, save, warchest, true).issues.map((issue) => issue.message);
    expect(migrated).not.toContain(CLASSIC_RETIRED_ISSUE);
    expect(
      flaggedDecks(DB, save, true).find((summary) => summary.deckId === 'legal')?.firstIssue,
    ).toBe(CLASSIC_RETIRED_ISSUE);
  });

  it('states the retirement issue without an em-dash, per the player-copy rule', () => {
    expect(CLASSIC_RETIRED_ISSUE).not.toContain('—');
  });

  it('acknowledges a stable sorted id set, forgets repaired ids, and detects new ids', () => {
    const initial = [{ deckId: 'z' }, { deckId: 'a' }, { deckId: 'a' }];
    const fingerprint = deckRepairNoticeFingerprint(initial);
    expect(fingerprint).toBe('["a","z"]');
    expect(deckRepairNoticeState([{ deckId: 'a' }], fingerprint)).toEqual({
      acknowledgedFingerprint: '["a"]',
      needsNotice: false,
    });
    expect(deckRepairNoticeState([{ deckId: 'a' }, { deckId: 'new' }], fingerprint)).toEqual({
      acknowledgedFingerprint: '["a"]',
      needsNotice: true,
    });
  });
});

describe('classic-retirement starter conversion (2026-08-09)', () => {
  const shipped = [{
    id: 'starter-x',
    cards: ['a', 'a', 'b'],
    reserveCards: ['a', 'a', 'c'],
    landReserve: Array.from({ length: 10 }, () => 'land-plains'),
  }];
  const savedDeck = (over: Partial<SavedDeck> = {}): SavedDeck => ({
    id: 'starter-x',
    name: 'Starter X',
    cards: ['a', 'a', 'b'],
    heroCardId: null,
    landStyle: null,
    format: 'constructed',
    darlingId: null,
    landReserve: null,
    variantPins: [null, null, null],
    ...over,
  });

  it('converts an untouched starter to its reserve build', () => {
    const deck = savedDeck();
    expect(convertUnmodifiedStarter(deck, shipped)).toBe(true);
    expect(deck.format).toBe('warchest');
    expect(deck.cards).toEqual(['a', 'a', 'c']);
    expect(deck.landReserve).toHaveLength(10);
    // Pins are index-aligned, so a resized list must not keep stale ones.
    expect(deck.variantPins).toEqual([null, null, null]);
  });

  it('leaves an edited starter alone so it routes to fix-it', () => {
    const deck = savedDeck({ cards: ['a', 'b', 'b'] });
    expect(convertUnmodifiedStarter(deck, shipped)).toBe(false);
    expect(deck.format).toBe('constructed');
    expect(deck.cards).toEqual(['a', 'b', 'b']);
  });

  it('ignores decks with no shipped reserve build and non-classic decks', () => {
    expect(convertUnmodifiedStarter(savedDeck({ id: 'custom' }), shipped)).toBe(false);
    expect(convertUnmodifiedStarter(savedDeck({ format: 'darlings' }), shipped)).toBe(false);
  });
});
