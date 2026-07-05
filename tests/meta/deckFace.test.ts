import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { isType, type CardDb, type CardDef } from '../../src/engine/types';
import { faceCardFor } from '../../src/meta/deckFace';

// ---------------------------------------------------------------------------
// Fixtures — tiny synthetic pools for the tiebreak/fallback cases
// ---------------------------------------------------------------------------

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    types: ['creature'],
    subtypes: [],
    colors: ['G'],
    rarity: 'c',
    cost: { generic: 1, pips: { G: 1 } },
    power: 2,
    toughness: 2,
    ...over,
  };
}

function dbOf(...cards: CardDef[]): CardDb {
  return Object.fromEntries(cards.map((c) => [c.id, c]));
}

function deckOf(...entries: [string, number][]): string[] {
  const out: string[] = [];
  for (const [id, n] of entries) for (let i = 0; i < n; i++) out.push(id);
  return out;
}

// ---------------------------------------------------------------------------
// Real data — every starter deck has a legendary-creature face card
// ---------------------------------------------------------------------------

describe('faceCardFor on starter decks', () => {
  for (const deck of STARTER_DECKS) {
    it(`${deck.name} yields a legendary creature from the deck`, () => {
      const face = faceCardFor(deck.cards, CARD_DB);
      expect(face).not.toBeNull();
      expect(deck.cards).toContain(face!);
      const d = CARD_DB[face!];
      expect(d).toBeDefined();
      expect(isType(d, 'creature')).toBe(true);
      expect(d.supertypes ?? []).toContain('legendary');
    });
  }

  it('is deterministic across repeated calls and copied inputs', () => {
    for (const deck of STARTER_DECKS) {
      const first = faceCardFor(deck.cards, CARD_DB);
      expect(faceCardFor(deck.cards, CARD_DB)).toBe(first);
      expect(faceCardFor([...deck.cards], CARD_DB)).toBe(first);
    }
  });
});

// ---------------------------------------------------------------------------
// Synthetic pools — ordering, fallback, robustness
// ---------------------------------------------------------------------------

describe('faceCardFor ordering and fallback', () => {
  it('copy count beats rarity', () => {
    const db = dbOf(
      card('common-hero', { supertypes: ['legendary'], rarity: 'c' }),
      card('ur-hero', { supertypes: ['legendary'], rarity: 'ur' }),
    );
    const deck = deckOf(['common-hero', 4], ['ur-hero', 2]);
    expect(faceCardFor(deck, db)).toBe('common-hero');
  });

  it('rarity breaks copy-count ties', () => {
    const db = dbOf(
      card('r-hero', { supertypes: ['legendary'], rarity: 'r' }),
      card('ssr-hero', { supertypes: ['legendary'], rarity: 'ssr' }),
    );
    const deck = deckOf(['r-hero', 3], ['ssr-hero', 3]);
    expect(faceCardFor(deck, db)).toBe('ssr-hero');
  });

  it('mana value breaks rarity ties (generic + colored pips)', () => {
    const db = dbOf(
      card('cheap', { supertypes: ['legendary'], cost: { generic: 1, pips: { G: 1 } } }), // mv 2
      card('big', { supertypes: ['legendary'], cost: { generic: 4, pips: { G: 2 } } }), // mv 6
    );
    const deck = deckOf(['cheap', 2], ['big', 2]);
    expect(faceCardFor(deck, db)).toBe('big');
  });

  it('name asc breaks full ties deterministically', () => {
    const db = dbOf(
      card('z-id', { name: 'Alpha', supertypes: ['legendary'] }),
      card('a-id', { name: 'Beta', supertypes: ['legendary'] }),
    );
    const deck = deckOf(['z-id', 2], ['a-id', 2]);
    expect(faceCardFor(deck, db)).toBe('z-id'); // 'Alpha' < 'Beta' despite id order
  });

  it('falls back to non-legendary creatures when the deck has no legendaries', () => {
    const db = dbOf(
      card('grunt', { rarity: 'c' }),
      card('champion', { rarity: 'sr' }),
      // legendary NON-creature must not be picked over plain creatures
      card('relic', { types: ['enchantment'], supertypes: ['legendary'], rarity: 'ur' }),
    );
    const deck = deckOf(['grunt', 4], ['champion', 4], ['relic', 4]);
    expect(faceCardFor(deck, db)).toBe('champion');
  });

  it('a single legendary copy still beats a 4-of plain creature', () => {
    const db = dbOf(
      card('grunt', { rarity: 'ur' }),
      card('hero', { supertypes: ['legendary'], rarity: 'c' }),
    );
    const deck = deckOf(['grunt', 4], ['hero', 1]);
    expect(faceCardFor(deck, db)).toBe('hero');
  });

  it('skips unknown ids without throwing', () => {
    const db = dbOf(card('hero', { supertypes: ['legendary'] }));
    expect(faceCardFor(['ghost', 'ghost', 'hero', 'ghost'], db)).toBe('hero');
    expect(faceCardFor(['ghost', 'phantom'], db)).toBeNull();
  });

  it('returns null for an empty deck or a deck with no creatures', () => {
    const db = dbOf(
      card('hero', { supertypes: ['legendary'] }),
      card('bolt', { types: ['instant'], cost: { generic: 0, pips: { R: 1 } }, colors: ['R'] }),
      card('field', { types: ['land'], cost: undefined, colors: [] }),
    );
    expect(faceCardFor([], db)).toBeNull();
    expect(faceCardFor(deckOf(['bolt', 4], ['field', 20]), db)).toBeNull();
  });
});
