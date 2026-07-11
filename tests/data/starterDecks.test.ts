import { describe, expect, it } from 'vitest';
import { STARTER_DECKS, THEME_DECKS } from '../../src/data/starterDecks';
import { CARD_DB } from '../../src/data/catalog';
import { MediumAI } from '../../src/ai/MediumAI';
import { Game } from '../../src/engine/Game';
import type { Color } from '../../src/engine/types';
import { RULES } from '../../src/config/rules';
import { validateDeck } from '../../src/meta/DeckStorage';
import { grantDeckCards } from '../../src/meta/Economy';
import { freshSave } from '../../src/meta/SaveManager';

/**
 * SUITE — Starter precon legality + termination smoke (mirrors the avatar
 * idiom in tests/data/opponents.test.ts).
 *
 * Every starter must be a legal 60-card two-color list built from real ids,
 * and each new precon must play a full MediumAI-vs-MediumAI game to
 * completion against Crimson Muster.
 */

const LANDS_PER_DECK = 24;
const ORIGINAL_IDS = ['starter-crimson', 'starter-wild'];

describe('starter roster shape', () => {
  it('has exactly 5 starters with unique ids, keeping the original two', () => {
    expect(STARTER_DECKS).toHaveLength(5);
    expect(new Set(STARTER_DECKS.map((d) => d.id)).size).toBe(5);
    for (const id of ORIGINAL_IDS) {
      expect(STARTER_DECKS.some((d) => d.id === id), `${id} missing`).toBe(true);
    }
  });

  it('covers all five colors across the roster via land production', () => {
    const produced = new Set<Color>();
    for (const deck of STARTER_DECKS) {
      for (const id of deck.cards) {
        const d = CARD_DB[id];
        if (d?.types.includes('land')) for (const c of d.manaAbility ?? []) produced.add(c);
      }
    }
    expect([...produced].sort()).toEqual(['B', 'G', 'R', 'U', 'W']);
  });
});

describe.each(STARTER_DECKS.map((d) => [d.name, d] as const))('starter deck legality — %s', (_name, deck) => {
  const counts = new Map<string, number>();
  for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);

  it('is exactly 60 cards', () => {
    expect(deck.cards).toHaveLength(RULES.deckSize);
  });

  it(`has exactly ${LANDS_PER_DECK} lands`, () => {
    const lands = deck.cards.filter((id) => CARD_DB[id]?.types.includes('land'));
    expect(lands).toHaveLength(LANDS_PER_DECK);
  });

  it('has ≤4 copies of every non-basic (basics unlimited)', () => {
    for (const [id, n] of counts) {
      const basic = CARD_DB[id]?.supertypes?.includes('basic');
      if (!basic) expect(n, `${id} x${n}`).toBeLessThanOrEqual(RULES.maxCopies);
    }
  });

  it('contains only real, non-token cards', () => {
    for (const id of counts.keys()) {
      const d = CARD_DB[id];
      expect(d, `unknown id ${id}`).toBeDefined();
      expect(d.token, `${id} is a token`).toBeFalsy();
    }
  });

  it('has every colored pip coverable by its lands', () => {
    const landColors = new Set<Color>();
    for (const id of counts.keys()) {
      const d = CARD_DB[id];
      if (d.types.includes('land')) for (const c of d.manaAbility ?? []) landColors.add(c);
    }
    const needed = new Set<Color>();
    for (const id of counts.keys()) {
      const cost = CARD_DB[id]?.cost;
      if (!cost) continue;
      for (const c of Object.keys(cost.pips ?? {}) as Color[]) {
        if ((cost.pips[c] ?? 0) > 0) needed.add(c);
      }
    }
    for (const c of needed) {
      expect(landColors.has(c), `pip ${c} uncoverable (lands: ${[...landColors].join('')})`).toBe(true);
    }
  });

  it('keeps legendaries at 2-3 copies (legend-rule friendly)', () => {
    for (const [id, n] of counts) {
      if (CARD_DB[id]?.supertypes?.includes('legendary')) {
        expect(n, `${id} x${n}`).toBeGreaterThanOrEqual(2);
        expect(n, `${id} x${n}`).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe.each(THEME_DECKS.map((d) => [d.name, d] as const))('theme deck legality — %s', (_name, deck) => {
  const counts = new Map<string, number>();
  for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);

  it('is exactly 60 cards', () => {
    expect(deck.cards).toHaveLength(RULES.deckSize);
  });

  it(`has exactly ${LANDS_PER_DECK} lands`, () => {
    const lands = deck.cards.filter((id) => CARD_DB[id]?.types.includes('land'));
    expect(lands).toHaveLength(LANDS_PER_DECK);
  });

  it('has ≤4 copies of every non-basic (basics unlimited)', () => {
    for (const [id, n] of counts) {
      const basic = CARD_DB[id]?.supertypes?.includes('basic');
      if (!basic) expect(n, `${id} x${n}`).toBeLessThanOrEqual(RULES.maxCopies);
    }
  });

  it('contains only real, non-token cards', () => {
    for (const id of counts.keys()) {
      const d = CARD_DB[id];
      expect(d, `unknown id ${id}`).toBeDefined();
      expect(d.token, `${id} is a token`).toBeFalsy();
    }
  });

  it('has every colored pip coverable by its lands', () => {
    const landColors = new Set<Color>();
    for (const id of counts.keys()) {
      const d = CARD_DB[id];
      if (d.types.includes('land')) for (const c of d.manaAbility ?? []) landColors.add(c);
    }
    const needed = new Set<Color>();
    for (const id of counts.keys()) {
      const cost = CARD_DB[id]?.cost;
      if (!cost) continue;
      for (const c of Object.keys(cost.pips ?? {}) as Color[]) {
        if ((cost.pips[c] ?? 0) > 0) needed.add(c);
      }
    }
    for (const c of needed) {
      expect(landColors.has(c), `pip ${c} uncoverable (lands: ${[...landColors].join('')})`).toBe(true);
    }
  });

  it('keeps legendaries at 2-3 copies (legend-rule friendly)', () => {
    for (const [id, n] of counts) {
      if (CARD_DB[id]?.supertypes?.includes('legendary')) {
        expect(n, `${id} x${n}`).toBeGreaterThanOrEqual(2);
        expect(n, `${id} x${n}`).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('Glimmer Bargain composition', () => {
  const deck = THEME_DECKS.find((d) => d.id === 'theme-celtic-fae')!;
  const allowedColors = new Set<Color>(['U', 'B', 'G']);

  it('is a legal 60-card U/B/G Celtic Fae list plus matching basics', () => {
    expect(deck).toMatchObject({ id: 'theme-celtic-fae', name: 'Glimmer Bargain' });
    expect(deck.cards).toHaveLength(RULES.deckSize);

    for (const id of deck.cards) {
      const card = CARD_DB[id];
      expect(card, `${id} must exist`).toBeDefined();
      if (card.supertypes?.includes('basic')) {
        expect(['land-island', 'land-swamp', 'land-forest']).toContain(id);
      } else {
        expect(id.startsWith('cf-'), `${id} must be a Celtic Fae card`).toBe(true);
        expect(card.set, `${id} must be Celtic Fae`).toBe('celtic-fae');
        expect(card.colors.every((color) => allowedColors.has(color)), `${id} color identity`).toBe(true);
      }
    }

    const save = freshSave(0);
    grantDeckCards(save, CARD_DB, deck.cards);
    expect(validateDeck(CARD_DB, save, deck.cards).filter((issue) => issue.kind === 'error')).toHaveLength(0);
  });
});

describe('theme deck termination smoke (vs Crimson Muster)', () => {
  const crimson = STARTER_DECKS.find((d) => d.id === 'starter-crimson')!;
  for (const deck of THEME_DECKS) {
    it(`${deck.name} plays a game to completion`, () => {
      const seed = 11;
      const decks: [string[], string[]] = [deck.cards, crimson.cards];
      const game = new Game({ decks, seed, db: CARD_DB });
      const ais = [new MediumAI(CARD_DB), new MediumAI(CARD_DB)];
      let terminated = false;
      for (let i = 0; i < 40000; i++) {
        const a = game.awaiting;
        if (a.kind === 'gameOver') {
          terminated = true;
          break;
        }
        const p = a.player;
        game.submit(p, ais[p].chooseAction(game.viewFor(p), game.legalActions(p)));
      }
      expect(terminated, `${deck.name} seed ${seed} did not terminate`).toBe(true);
    }, 60_000);
  }
});

describe('new starter termination smoke (1 seed each, vs Crimson Muster)', () => {
  const crimson = STARTER_DECKS.find((d) => d.id === 'starter-crimson')!;
  const newDecks = STARTER_DECKS.filter((d) => !ORIGINAL_IDS.includes(d.id));

  for (const deck of newDecks) {
    it(`${deck.name} plays a game to completion`, () => {
      const seed = 11;
      const decks: [string[], string[]] = [deck.cards, crimson.cards];
      const game = new Game({ decks, seed, db: CARD_DB });
      const ais = [new MediumAI(CARD_DB), new MediumAI(CARD_DB)];
      let terminated = false;
      for (let i = 0; i < 40000; i++) {
        const a = game.awaiting;
        if (a.kind === 'gameOver') {
          terminated = true;
          break;
        }
        const p = a.player;
        game.submit(p, ais[p].chooseAction(game.viewFor(p), game.legalActions(p)));
      }
      expect(terminated, `${deck.name} seed ${seed} did not terminate`).toBe(true);
      // turn cap is a legal draw outcome, but flag persistent stalling
      expect(game.state.winner === 0 || game.state.winner === 1 || game.state.winner === 'draw').toBe(true);
    }, 60_000);
  }
});
