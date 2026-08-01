import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef } from '../../src/engine/types';
import { freshSave, type SavedDeck } from '../../src/meta/SaveManager';
import {
  buildAiLandReserve,
  firstDuelLaunchIssue,
  practiceDuelLaunchData,
  resolveDuelDifficulty,
} from '../../src/meta/duelSetup';

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
    const spellIds = Array.from({ length: 13 }, (_, index) => `spell-${index}`);
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
    const cards = spellIds.flatMap((id, index) => Array.from({ length: index === 12 ? 2 : 4 }, () => id));
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
    expect(firstDuelLaunchIssue(db, save, deck({ cards: [...cards.slice(0, 49), basic] }))).toContain('hold no lands');
    expect(firstDuelLaunchIssue(db, save, deck())).toBeNull();
  });
});
