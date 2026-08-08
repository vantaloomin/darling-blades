import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef } from '../../src/engine/types';
import { freshSave, type SavedDeck } from '../../src/meta/SaveManager';
import {
  buildAiLandReserve,
  firstDuelLaunchIssue,
  practiceAiReserveSide,
  practiceDuelLaunchData,
  resolveDuelDifficulty,
  resolveDuelStartingHandSize,
} from '../../src/meta/duelSetup';
import { WARCHEST_DECK_SIZE, WARCHEST_HAND_SIZE } from '../../src/meta/warchest';

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

describe('duel setup', () => {
  it('keeps the selected practice opponent when choosing a difficulty', () => {
    expect(practiceDuelLaunchData('artoria', 'medium')).toEqual({
      opponentId: 'artoria',
      difficulty: 'medium',
    });
  });

  it('lets an explicit practice difficulty override the avatar tower tier', () => {
    expect(resolveDuelDifficulty(undefined, 'medium', 'hard')).toBe('medium');
  });

  it('preserves replay authority and gauntlet avatar fallback', () => {
    expect(resolveDuelDifficulty('easy', 'medium', 'hard')).toBe('easy');
    expect(resolveDuelDifficulty(undefined, undefined, 'hard')).toBe('hard');
    expect(resolveDuelDifficulty(undefined, undefined, undefined)).toBe('easy');
  });

  it('builds a deterministic ten-land AI reserve within the dual cap', () => {
    const db = {
      whiteSpell: { colors: ['W'] },
      blueSpell: { colors: ['U'] },
    } as unknown as CardDb;

    const first = buildAiLandReserve(['blueSpell', 'whiteSpell'], db);
    const second = buildAiLandReserve(['blueSpell', 'whiteSpell'], db);

    expect(first).toHaveLength(10);
    expect(first).toEqual(second);
    expect(first.every((cardId) => cardId.startsWith('land-'))).toBe(true);
    expect(first.filter((cardId) => cardId.includes('dual')).length).toBeLessThanOrEqual(5);
  });

  it('refuses incomplete reserve launches and accepts a valid reserve deck', () => {
    // Enough distinct ids to reach WARCHEST_DECK_SIZE at 4-of playsets.
    const spellIds = Array.from({ length: Math.ceil(WARCHEST_DECK_SIZE / 4) }, (_, index) => `spell-${index}`);
    const basic = 'basic';
    const db = Object.fromEntries([
      ...spellIds.map((id) => [id, card(id)]),
      [basic, card(basic, {
        name: 'Forest',
        types: ['land'],
        supertypes: ['basic'],
        cost: undefined,
        manaAbility: ['G'],
      })],
    ]) as CardDb;
    const save = freshSave(0);
    for (const id of spellIds) save.collection[id] = 4;
    const remainder = WARCHEST_DECK_SIZE - (spellIds.length - 1) * 4;
    const cards = spellIds.flatMap((id, index) =>
      Array.from({ length: index === spellIds.length - 1 ? remainder : 4 }, () => id),
    );
    const reserve = Array.from({ length: 10 }, () => basic);
    const deck = (over: Partial<SavedDeck> = {}): SavedDeck => ({
      id: 'box',
      name: 'Box',
      cards,
      heroCardId: null,
      landStyle: null,
      format: 'warchest',
      landReserve: reserve,
      ...over,
    });

    expect(firstDuelLaunchIssue(db, save, deck({ landReserve: [] }))).toContain('exactly 10 lands');
    expect(
      firstDuelLaunchIssue(db, save, deck({ cards: [...cards.slice(0, WARCHEST_DECK_SIZE - 1), basic] })),
    ).toContain('hold no lands');
    expect(firstDuelLaunchIssue(db, save, deck())).toBeNull();
  });

  it('deals the ratified 5-card Warchest opener; classic and Darlings keep their defaults', () => {
    // Live duels: both reserve formats deal 5; classic defaults (engine deals 7).
    expect(resolveDuelStartingHandSize('warchest', null)).toBe(WARCHEST_HAND_SIZE);
    expect(resolveDuelStartingHandSize('darlings', null)).toBe(WARCHEST_HAND_SIZE);
    expect(resolveDuelStartingHandSize(undefined, null)).toBeUndefined();
    // Replays always defer to the recorded value; an absent field means the
    // log predates the flip and must reconstruct its original 7-card deal.
    expect(resolveDuelStartingHandSize('warchest', {})).toBeUndefined();
    expect(resolveDuelStartingHandSize('warchest', { startingHandSize: 7 })).toBe(7);
    expect(resolveDuelStartingHandSize(undefined, { startingHandSize: 5 })).toBe(5);
  });
});

describe('practice AI reserve side (stage 3: the mirror dies)', () => {
  const avatar = {
    reserveDeck: ['w1', 'w2'],
    landReserve: ['land-plains'],
    darlingsDeck: ['d1', 'd2'],
    darlingId: 'darling-x',
  };
  const playerDeck = ['p1', 'p2'];

  it('fields the avatar warchest deck with its designed reserve and no darling', () => {
    expect(practiceAiReserveSide(avatar, 'warchest', playerDeck, null, {} as CardDb)).toEqual({
      deck: ['w1', 'w2'],
      reserve: ['land-plains'],
      darlingId: null,
    });
  });

  it('fields the avatar darlings variant led by its own darling', () => {
    expect(practiceAiReserveSide(avatar, 'darlings', playerDeck, 'my-darling', {} as CardDb)).toEqual({
      deck: ['d1', 'd2'],
      reserve: ['land-plains'],
      darlingId: 'darling-x',
    });
  });

  it('keeps the old mirror only when no avatar is supplied', () => {
    const db = {
      p1: { id: 'p1', name: 'p1', types: ['creature'], subtypes: [], colors: ['G'], rarity: 'c' },
    } as unknown as CardDb;
    const side = practiceAiReserveSide(null, 'darlings', playerDeck, 'my-darling', db);
    expect(side.deck).toEqual(playerDeck);
    expect(side.reserve).toHaveLength(10);
    expect(side.darlingId).toBe('my-darling');
  });
});
