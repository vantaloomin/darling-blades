import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { DARLINGS_PRECONS } from '../../src/data/darlingsPrecons';
import { AVATARS } from '../../src/data/opponents';
import { encodeDeck } from '../../src/meta/DeckCode';
import { deckCodeOpponent, deckCodeSeatIssue, savedDeckDuelCode } from '../../src/meta/deckCodeDuel';
import type { SavedDeck } from '../../src/meta/SaveManager';

const IDS = Object.keys(CARD_DB);
const ALL_LIVE = (): boolean => true;
const avatar = AVATARS[0];
const precon = DARLINGS_PRECONS[0];

describe('deckCodeOpponent', () => {
  it('fields a Standard code as its own deck and Warchest, owned or not', () => {
    const code = encodeDeck({ cards: avatar.reserveDeck, format: 'warchest', landReserve: avatar.landReserve });
    expect(deckCodeOpponent(code, CARD_DB, IDS)).toEqual({
      ok: true,
      deck: { format: 'warchest', cards: avatar.reserveDeck, landReserve: avatar.landReserve, darlingId: null },
    });
  });

  it('fields a Darlings code with its Darling', () => {
    const code = encodeDeck({ cards: precon.cards, format: 'darlings', darlingId: precon.darlingId, landReserve: precon.landReserve });
    const result = deckCodeOpponent(code, CARD_DB, IDS, ALL_LIVE);
    expect(result.ok && result.deck.darlingId).toBe(precon.darlingId);
  });

  it('plays a pre-1.9 40-spell list as Standard with a Warchest built from its colors', () => {
    const result = deckCodeOpponent(encodeDeck({ cards: avatar.reserveDeck }), CARD_DB, IDS, ALL_LIVE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deck.format).toBe('warchest');
      expect(result.deck.landReserve).toHaveLength(10);
    }
  });

  it('refuses a retired Constructed list, a damaged code and an illegal deck with a reason', () => {
    const constructed = [...avatar.reserveDeck, ...Array.from({ length: 20 }, () => 'land-plains')];
    expect(deckCodeOpponent(encodeDeck({ cards: constructed }), CARD_DB, IDS, ALL_LIVE))
      .toMatchObject({ ok: false, message: expect.stringContaining('Constructed') });
    expect(deckCodeOpponent('DBD3-%%%', CARD_DB, IDS, ALL_LIVE)).toMatchObject({ ok: false });
    const short = encodeDeck({ cards: avatar.reserveDeck.slice(1), format: 'warchest', landReserve: avatar.landReserve });
    expect(deckCodeOpponent(short, CARD_DB, IDS, ALL_LIVE))
      .toMatchObject({ ok: false, message: expect.stringContaining('cannot be played') });
  });

  it('refuses a code naming a card that is not released', () => {
    const code = encodeDeck({ cards: avatar.reserveDeck, format: 'warchest', landReserve: avatar.landReserve });
    const unreleased = avatar.reserveDeck[0];
    expect(deckCodeOpponent(code, CARD_DB, IDS, (id) => id !== unreleased))
      .toMatchObject({ ok: false, message: expect.stringContaining('not released') });
  });
});

describe('deckCodeSeatIssue', () => {
  const standard = { format: 'warchest', cards: [], landReserve: [], darlingId: null } as const;
  const mine = (format: SavedDeck['format']): SavedDeck => ({ format } as SavedDeck);

  it('meets a code only with a deck of the same format', () => {
    expect(deckCodeSeatIssue({ ...standard, cards: [], landReserve: [] }, mine('warchest'))).toBeNull();
    expect(deckCodeSeatIssue({ ...standard, cards: [], landReserve: [] }, mine('darlings'))).toContain('Standard');
    expect(deckCodeSeatIssue({ ...standard, cards: [], landReserve: [], format: 'darlings' }, mine('warchest'))).toContain('Darlings');
    expect(deckCodeSeatIssue({ ...standard, cards: [], landReserve: [] }, null)).not.toBeNull();
  });
});

describe('savedDeckDuelCode', () => {
  it('fields one of the player\'s own decks exactly as saved, and has no code for a Constructed deck', () => {
    const code = savedDeckDuelCode({ cards: precon.cards, format: 'darlings', darlingId: precon.darlingId, landReserve: precon.landReserve });
    expect(code && deckCodeOpponent(code, CARD_DB, IDS, ALL_LIVE)).toEqual({
      ok: true,
      deck: { format: 'darlings', cards: precon.cards, landReserve: precon.landReserve, darlingId: precon.darlingId },
    });
    expect(savedDeckDuelCode({ cards: avatar.reserveDeck, format: 'constructed' })).toBeNull();
  });
});
