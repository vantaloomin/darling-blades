import { describe, expect, it } from 'vitest';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { CARD_DB } from '../../src/data/catalog';
import { decodeDeck, deckCodeErrorMessage, encodeDeck } from '../../src/meta/DeckCode';
import { validateDeck } from '../../src/meta/DeckStorage';
import { grantDeckCards } from '../../src/meta/Economy';
import { freshSave } from '../../src/meta/SaveManager';

const CARD_IDS = Object.keys(CARD_DB);

describe('deck codes', () => {
  it('round-trips a deck exactly', () => {
    const deck = STARTER_DECKS[0].cards;
    const code = encodeDeck(deck);
    const decoded = decodeDeck(code, CARD_IDS);

    expect(code.startsWith('DBD2-')).toBe(true);
    expect(code.length).toBeLessThan(100);
    expect(decoded).toEqual({ ok: true, cards: deck });
  });

  it('preserves non-consecutive repeated cards', () => {
    const cards = ['land-plains', 'tk-shu-liubei', 'land-plains', 'tk-shu-liubei'];

    expect(decodeDeck(encodeDeck(cards), CARD_IDS)).toEqual({ ok: true, cards });
  });

  it('accepts pasted whitespace around a valid code', () => {
    const code = encodeDeck(['land-plains', 'land-island']);

    expect(decodeDeck(`  ${code.slice(0, 12)}\n${code.slice(12)}  `, CARD_IDS)).toEqual({
      ok: true,
      cards: ['land-plains', 'land-island'],
    });
  });

  it('has a collision-free hash table for the released catalog', () => {
    const cards = Object.keys(CARD_DB);

    expect(decodeDeck(encodeDeck([cards[0]]), cards)).toEqual({ ok: true, cards: [cards[0]] });
  });

  it('keeps importing legacy DBD1 codes', () => {
    const legacyCode = 'DBD1-W1sibGFuZC1wbGFpbnMiLDJdLCJ0ay1zaHUtbGl1YmVpIl0';

    expect(decodeDeck(legacyCode)).toEqual({
      ok: true,
      cards: ['land-plains', 'land-plains', 'tk-shu-liubei'],
    });
  });

  it('rejects malformed codes with user-facing errors', () => {
    expect(decodeDeck('')).toEqual({ ok: false, error: 'empty' });
    expect(decodeDeck('not-a-code')).toEqual({ ok: false, error: 'bad-prefix' });
    expect(decodeDeck('DBD2-!')).toEqual({ ok: false, error: 'bad-encoding' });
    expect(decodeDeck(encodeDeck(['land-plains']))).toEqual({ ok: false, error: 'unknown-card' });
    expect(decodeDeck('DBD1-e30')).toEqual({ ok: false, error: 'bad-payload' });
    expect(() => encodeDeck(['bad card id'])).toThrow(/Invalid card id/);
    expect(deckCodeErrorMessage('bad-prefix')).toContain('Darling Blades');
  });

  it('decoded imports validate through constructed deck ownership rules', () => {
    const save = freshSave(0);
    const deck = STARTER_DECKS[0].cards;
    const decoded = decodeDeck(encodeDeck(deck), CARD_IDS);
    if (!decoded.ok) throw new Error(decoded.error);

    expect(validateDeck(CARD_DB, save, decoded.cards).some((issue) => issue.kind === 'error')).toBe(true);

    grantDeckCards(save, CARD_DB, deck);
    expect(validateDeck(CARD_DB, save, decoded.cards).filter((issue) => issue.kind === 'error')).toHaveLength(0);
  });
});
