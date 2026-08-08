import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef } from '../../src/engine/types';
import { validateDeck } from '../../src/meta/DeckStorage';
import {
  deckHealth,
  deckRepairNoticeFingerprint,
  deckRepairNoticeState,
  flaggedDecks,
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
const SPELL = 'spell';
const DB: CardDb = {
  [BASIC]: card(BASIC, {
    types: ['land'],
    supertypes: ['basic'],
    cost: undefined,
    manaAbility: ['G'],
  }),
  [SPELL]: card(SPELL),
};

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

    expect(deckHealth(DB, save, classic).blocked).toBe(false);
    expect(deckHealth(DB, save, warchest).issues[0]?.message).toContain('exactly 50 cards');
    expect(deckHealth(DB, save, darlings).issues.some((issue) => issue.message === 'Choose a Darling before playing')).toBe(true);
  });

  it('summarizes only blocked decks in save order', () => {
    const save = freshSave(0);
    save.decks = [
      deck('legal-with-warning', Array.from({ length: 60 }, () => BASIC)),
      deck('short', [BASIC]),
      deck('unknown', [...Array.from({ length: 59 }, () => BASIC), 'missing-card']),
    ];

    expect(flaggedDecks(DB, save).map((summary) => ({
      id: summary.deckId,
      firstIssue: summary.firstIssue,
    }))).toEqual([
      { id: 'short', firstIssue: 'Deck has 1/60 cards' },
      { id: 'unknown', firstIssue: 'That card is not available: missing-card' },
    ]);
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
