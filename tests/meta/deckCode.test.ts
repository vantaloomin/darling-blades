import { describe, expect, it } from 'vitest';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { DARLINGS_PRECONS } from '../../src/data/darlingsPrecons';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { decodeDeck, deckCodeErrorMessage, encodeDeck } from '../../src/meta/DeckCode';
import { validateDarlingsDeck, validateWarchestDeck } from '../../src/meta/darlings';
import { saveDeck, validateDeck } from '../../src/meta/DeckStorage';
import { grantDeckCards } from '../../src/meta/Economy';
import { freshSave, type SaveData, type SavedDeck } from '../../src/meta/SaveManager';
import {
  deckBaseline,
  deckCodeDeckFor,
  importedWorkingState,
  isDeckBuilderDirty,
  planDeckCodeImport,
  restoreDeckBaseline,
  type DeckCodeImportTarget,
} from '../../src/ui/deckBuilderHelpers';

const CARD_IDS = Object.keys(CARD_DB);
const LIST_ONLY = { format: null, darlingId: null, landReserve: null } as const;

describe('deck codes', () => {
  it('round-trips a deck exactly', () => {
    const deck = STARTER_DECKS[0].cards;
    const code = encodeDeck({ cards: deck });
    const decoded = decodeDeck(code, CARD_IDS);

    expect(code.startsWith('DBD3-')).toBe(true);
    expect(code.length).toBeLessThan(100);
    expect(decoded).toEqual({ ok: true, cards: deck, ...LIST_ONLY });
  });

  it('preserves non-consecutive repeated cards', () => {
    const cards = ['land-plains', 'tk-shu-liubei', 'land-plains', 'tk-shu-liubei'];

    expect(decodeDeck(encodeDeck({ cards }), CARD_IDS)).toEqual({ ok: true, cards, ...LIST_ONLY });
  });

  it('accepts pasted whitespace around a valid code', () => {
    const code = encodeDeck({ cards: ['land-plains', 'land-island'] });

    expect(decodeDeck(`  ${code.slice(0, 12)}\n${code.slice(12)}  `, CARD_IDS)).toEqual({
      ok: true,
      cards: ['land-plains', 'land-island'],
      ...LIST_ONLY,
    });
  });

  it('has a collision-free hash table for the released catalog', () => {
    // Every collectible id, one at a time: a hash collision decodes as some
    // OTHER card, which a single-card round trip catches immediately.
    for (const card of ALL_CARDS) {
      if (card.token) continue;
      expect(decodeDeck(encodeDeck({ cards: [card.id] }), CARD_IDS), card.id).toEqual({
        ok: true,
        cards: [card.id],
        ...LIST_ONLY,
      });
    }
  });

  it('rejects malformed codes with user-facing errors', () => {
    expect(decodeDeck('')).toEqual({ ok: false, error: 'empty' });
    expect(decodeDeck('not-a-code')).toEqual({ ok: false, error: 'bad-prefix' });
    expect(decodeDeck('DBD2-!')).toEqual({ ok: false, error: 'bad-encoding' });
    expect(decodeDeck('DBD3-!')).toEqual({ ok: false, error: 'bad-encoding' });
    expect(decodeDeck(encodeDeck({ cards: ['land-plains'] }))).toEqual({ ok: false, error: 'unknown-card' });
    expect(decodeDeck('DBD1-e30')).toEqual({ ok: false, error: 'bad-payload' });
    expect(() => encodeDeck({ cards: ['bad card id'] })).toThrow(/Invalid card id/);
    expect(() => encodeDeck({ cards: [], format: 'darlings', darlingId: 'bad card id' })).toThrow(/Invalid card id/);
    expect(deckCodeErrorMessage('bad-prefix')).toContain('Darling Blades');
  });

  it('rejects a DBD3 header that names no known format, sets unknown flags, or runs short', () => {
    // Base64url of the bytes [3, 0]: format byte 3 does not exist.
    expect(decodeDeck('DBD3-AwA', CARD_IDS)).toEqual({ ok: false, error: 'bad-payload' });
    // [0, 4]: flag bit 2 means nothing.
    expect(decodeDeck('DBD3-AAQ', CARD_IDS)).toEqual({ ok: false, error: 'bad-payload' });
    // [1, 1]: a Darling flag on a Standard code.
    expect(decodeDeck('DBD3-AQE', CARD_IDS)).toEqual({ ok: false, error: 'bad-payload' });
    // [0, 2]: a Warchest on a code with no format.
    expect(decodeDeck('DBD3-AAI', CARD_IDS)).toEqual({ ok: false, error: 'bad-payload' });
    // [2, 1]: a Darling flag and no Darling bytes.
    expect(decodeDeck('DBD3-AgE', CARD_IDS)).toEqual({ ok: false, error: 'bad-payload' });
    // [1, 2, 1]: one Warchest run promised, none present.
    expect(decodeDeck('DBD3-AQIB', CARD_IDS)).toEqual({ ok: false, error: 'bad-payload' });
    // A single byte is shorter than the header.
    expect(decodeDeck('DBD3-AA', CARD_IDS)).toEqual({ ok: false, error: 'bad-payload' });
  });

  it('decoded imports validate through constructed deck ownership rules', () => {
    const save = freshSave(0);
    const deck = STARTER_DECKS[0].cards;
    const decoded = decodeDeck(encodeDeck({ cards: deck }), CARD_IDS);
    if (!decoded.ok) throw new Error(decoded.error);

    expect(validateDeck(CARD_DB, save, decoded.cards).some((issue) => issue.kind === 'error')).toBe(true);

    grantDeckCards(save, CARD_DB, deck);
    expect(validateDeck(CARD_DB, save, decoded.cards).filter((issue) => issue.kind === 'error')).toHaveLength(0);
  });
});

/**
 * Golden fixtures: codes as each shipped build wrote them. Share codes are a
 * compatibility surface, so these literals never change; a new shape gets a
 * new prefix and new fixtures beside the old ones.
 */
describe('deck code golden fixtures', () => {
  it('keeps importing legacy DBD1 codes', () => {
    const legacyCode = 'DBD1-W1sibGFuZC1wbGFpbnMiLDJdLCJ0ay1zaHUtbGl1YmVpIl0';

    expect(decodeDeck(legacyCode)).toEqual({
      ok: true,
      cards: ['land-plains', 'land-plains', 'tk-shu-liubei'],
      ...LIST_ONLY,
    });
  });

  it('keeps importing DBD2 codes (written until 1.9) as card lists only', () => {
    expect(decodeDeck('DBD2-awtJAkBUnAE', CARD_IDS)).toEqual({
      ok: true,
      cards: ['land-plains', 'land-plains', 'tk-shu-liubei'],
      ...LIST_ONLY,
    });
    expect(decodeDeck('DBD2-eoiQAWsLSQF6iJAB', CARD_IDS)).toEqual({
      ok: true,
      cards: ['land-island', 'land-plains', 'land-island'],
      ...LIST_ONLY,
    });
  });

  it('reads a DBD3 card list with no format', () => {
    expect(decodeDeck('DBD3-AABrC0kCQFScAQ', CARD_IDS)).toEqual({
      ok: true,
      cards: ['land-plains', 'land-plains', 'tk-shu-liubei'],
      ...LIST_ONLY,
    });
  });

  it('reads a DBD3 Standard code with its Warchest', () => {
    expect(decodeDeck('DBD3-AQICawtJAtHujQHNf_ICQFScAQ', CARD_IDS)).toEqual({
      ok: true,
      cards: ['gk-nike', 'gk-nike', 'tk-shu-liubei'],
      format: 'warchest',
      darlingId: null,
      landReserve: ['land-plains', 'land-plains', 'land-mountain'],
    });
  });

  it('reads a DBD3 Darlings code with her Darling and the Warchest', () => {
    expect(decodeDeck('DBD3-AgNAVJwCawtJAdAEDgGzZZQBzX_yAQ', CARD_IDS)).toEqual({
      ok: true,
      cards: ['tk-shu-guanyu', 'gk-nike'],
      format: 'darlings',
      darlingId: 'tk-shu-liubei',
      landReserve: ['land-plains', 'land-forest'],
    });
  });
});

/**
 * A deck exported from the builder and imported into another deck comes back
 * whole: list, Warchest and Darling, accepted by the same validators the
 * builder judges its open deck with.
 */
describe('deck codes through the builder', () => {
  const OFFERED = { offered: ['warchest', 'darlings'] as const, classicRetired: true };

  function ownedEverything(): SaveData {
    const save = freshSave(0);
    for (const id of CARD_IDS) save.collection[id] = 4;
    return save;
  }

  function builderValidate(save: SaveData) {
    return (target: DeckCodeImportTarget, cards: readonly string[]) =>
      target.format === 'darlings'
        ? validateDarlingsDeck(CARD_DB, save, cards, target.darlingId, target.landReserve)
        : validateWarchestDeck(CARD_DB, save, cards, target.landReserve);
  }

  /** A fresh Standard deck, the shape New Deck makes. */
  const EMPTY_STANDARD = { format: 'warchest' as const, darlingId: null, landReserve: [], hasSavedRecord: true };

  it('a Standard deck survives export and import with its Warchest', () => {
    const starter = STARTER_DECKS[0];
    const deck = { format: 'warchest' as const, darlingId: null, cards: starter.reserveCards!, landReserve: starter.landReserve! };
    const save = ownedEverything();
    expect(validateWarchestDeck(CARD_DB, save, deck.cards, deck.landReserve)).toEqual([]);

    const decoded = decodeDeck(encodeDeck(deckCodeDeckFor(deck)), CARD_IDS);
    if (!decoded.ok) throw new Error(decoded.error);
    const plan = planDeckCodeImport(decoded, EMPTY_STANDARD, OFFERED, builderValidate(save));

    expect(plan).toEqual({
      ok: true,
      cards: deck.cards,
      target: { format: 'warchest', darlingId: null, landReserve: deck.landReserve },
    });
  });

  it('a Darlings deck survives export and import with her Darling and the Warchest, into a Standard deck', () => {
    const precon = DARLINGS_PRECONS[0];
    const deck = { format: 'darlings' as const, darlingId: precon.darlingId, cards: precon.cards, landReserve: precon.landReserve };
    const save = ownedEverything();
    expect(validateDarlingsDeck(CARD_DB, save, deck.cards, deck.darlingId, deck.landReserve)).toEqual([]);

    const decoded = decodeDeck(encodeDeck(deckCodeDeckFor(deck)), CARD_IDS);
    if (!decoded.ok) throw new Error(decoded.error);
    const plan = planDeckCodeImport(decoded, EMPTY_STANDARD, OFFERED, builderValidate(save));

    expect(plan).toEqual({
      ok: true,
      cards: deck.cards,
      target: { format: 'darlings', darlingId: precon.darlingId, landReserve: deck.landReserve },
    });
  });

  it('rejects a full code whose Darling the importer does not own', () => {
    const precon = DARLINGS_PRECONS[0];
    const save = ownedEverything();
    save.collection[precon.darlingId] = 0;
    const decoded = decodeDeck(
      encodeDeck(deckCodeDeckFor({ format: 'darlings', darlingId: precon.darlingId, cards: precon.cards, landReserve: precon.landReserve })),
      CARD_IDS,
    );
    if (!decoded.ok) throw new Error(decoded.error);

    expect(planDeckCodeImport(decoded, EMPTY_STANDARD, OFFERED, builderValidate(save)).ok).toBe(false);
  });

  it('keeps an old list-only code to the open deck: its format, Darling and Warchest stay', () => {
    const precon = DARLINGS_PRECONS[0];
    const save = ownedEverything();
    const open = { format: 'darlings' as const, darlingId: precon.darlingId, landReserve: precon.landReserve, hasSavedRecord: true };
    // What a DBD1 or DBD2 code decodes to: a list, and nothing else.
    const listOnly = { cards: [...precon.cards], ...LIST_ONLY };

    expect(planDeckCodeImport(listOnly, open, OFFERED, builderValidate(save))).toEqual({
      ok: true,
      cards: precon.cards,
      target: { format: 'darlings', darlingId: precon.darlingId, landReserve: precon.landReserve },
    });
  });

  it('asks a deck with no saved record to save before taking another format', () => {
    const precon = DARLINGS_PRECONS[0];
    const decoded = decodeDeck(
      encodeDeck(deckCodeDeckFor({ format: 'darlings', darlingId: precon.darlingId, cards: precon.cards, landReserve: precon.landReserve })),
      CARD_IDS,
    );
    if (!decoded.ok) throw new Error(decoded.error);
    const draft = { ...EMPTY_STANDARD, hasSavedRecord: false };

    expect(planDeckCodeImport(decoded, draft, OFFERED, builderValidate(ownedEverything())).ok).toBe(false);
  });

  it('refuses a format this build does not offer', () => {
    const starter = STARTER_DECKS[0];
    const decoded = decodeDeck(
      encodeDeck(deckCodeDeckFor({ format: 'warchest', darlingId: null, cards: starter.reserveCards!, landReserve: starter.landReserve! })),
      CARD_IDS,
    );
    if (!decoded.ok) throw new Error(decoded.error);
    const constructedOnly = { offered: ['constructed'] as const, classicRetired: false };
    const open = { format: 'constructed' as const, darlingId: null, landReserve: [], hasSavedRecord: true };

    expect(planDeckCodeImport(decoded, open, constructedOnly, builderValidate(ownedEverything())).ok).toBe(false);
  });

  /**
   * An import is working state until Save Deck. The whole save is flushed on a
   * tab switch or a land-style change, so anything an unsaved import wrote on
   * the saved record would be persisted half-done.
   */
  describe('an unsaved import and the saved record', () => {
    function savedDeck(over: Partial<SavedDeck>): SavedDeck {
      return {
        id: 'deck-1',
        name: 'Mine',
        cards: [],
        heroCardId: null,
        landStyle: null,
        format: 'warchest',
        darlingId: null,
        landReserve: [],
        ...over,
        // One Auto pin per card, the shape a saved deck always has.
        variantPins: (over.cards ?? []).map(() => null),
      };
    }

    function deepFreeze<T>(value: T): T {
      if (value && typeof value === 'object') {
        for (const inner of Object.values(value)) deepFreeze(inner);
        Object.freeze(value);
      }
      return value;
    }

    function importInto(save: SaveData, record: SavedDeck, code: string) {
      const decoded = decodeDeck(code, CARD_IDS);
      if (!decoded.ok) throw new Error(decoded.error);
      const plan = planDeckCodeImport(
        decoded,
        { format: record.format!, darlingId: record.darlingId ?? null, landReserve: record.landReserve ?? [], hasSavedRecord: true },
        OFFERED,
        builderValidate(save),
      );
      if (!plan.ok) throw new Error(plan.reason);
      return importedWorkingState(plan);
    }

    const precon = DARLINGS_PRECONS[0];
    const starter = STARTER_DECKS[0];
    const DARLINGS_CODE = encodeDeck(
      deckCodeDeckFor({ format: 'darlings', darlingId: precon.darlingId, cards: precon.cards, landReserve: precon.landReserve }),
    );
    const STANDARD_CODE = encodeDeck(
      deckCodeDeckFor({ format: 'warchest', darlingId: null, cards: starter.reserveCards!, landReserve: starter.landReserve! }),
    );

    it('leaves a Standard record untouched when it takes a Darlings code, and a restore drops the import', () => {
      const save = ownedEverything();
      const record = savedDeck({ cards: [...starter.reserveCards!], landReserve: [...starter.landReserve!] });
      const before = structuredClone(record);
      const baseline = deckBaseline(record);

      // Frozen: an import that wrote any part of itself onto the record throws here.
      const working = importInto(save, deepFreeze(structuredClone(record)), DARLINGS_CODE);
      expect(working).toMatchObject({ format: 'darlings', darlingId: precon.darlingId, landReserve: precon.landReserve });
      // Unsaved, so every path that would drop it asks first.
      expect(isDeckBuilderDirty({ ...working, heroCardId: record.heroCardId }, baseline)).toBe(true);

      save.decks = [record];
      expect(restoreDeckBaseline(save.decks, baseline, record.id)).toBe(true);
      expect(save.decks[0]).toEqual(before);
    });

    it("keeps a Darlings record's Darling until Save Deck writes the Standard import", () => {
      const save = ownedEverything();
      const record = savedDeck({
        format: 'darlings',
        darlingId: precon.darlingId,
        cards: [...precon.cards],
        landReserve: [...precon.landReserve],
      });
      save.decks = [record];
      const before = structuredClone(record);

      const working = importInto(save, record, STANDARD_CODE);
      expect(working).toMatchObject({ format: 'warchest', darlingId: null });
      // Anything flushed now writes the record as it was last saved.
      expect(save.decks[0]).toEqual(before);

      saveDeck(save, { id: record.id, name: record.name, ...working });
      expect(save.decks[0]).toMatchObject({
        format: 'warchest',
        darlingId: null,
        cards: starter.reserveCards,
        landReserve: starter.landReserve,
      });
      expect(isDeckBuilderDirty({ ...working, heroCardId: null }, deckBaseline(save.decks[0]))).toBe(false);
    });
  });
});
