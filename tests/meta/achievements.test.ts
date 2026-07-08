import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef } from '../../src/engine/types';
import {
  claimAchievement,
  claimAllAchievements,
  evaluateAchievements,
  syncAchievements,
} from '../../src/meta/Achievements';
import { freshSave } from '../../src/meta/SaveManager';
import { variantKey } from '../../src/meta/variants';

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    types: ['creature'],
    subtypes: [],
    colors: ['G'],
    rarity: 'c',
    cost: { generic: 1, pips: { G: 1 } },
    attack: 1,
    defense: 1,
    ...over,
  };
}

const DB: CardDb = Object.freeze({
  green_a: card('green_a', { colors: ['G'] }),
  green_b: card('green_b', { colors: ['G'], rarity: 'r' }),
  white_a: card('white_a', { colors: ['W'] }),
  blue_a: card('blue_a', { colors: ['U'] }),
  black_a: card('black_a', { colors: ['B'] }),
  red_a: card('red_a', { colors: ['R'] }),
  multicolor: card('multicolor', { colors: ['W', 'U'], rarity: 'sr' }),
  relic: card('relic', {
    types: ['artifact'],
    colors: [],
    cost: { generic: 2, pips: {} },
    attack: undefined,
    defense: undefined,
  }),
  forest: card('forest', {
    types: ['land'],
    supertypes: ['basic'],
    colors: [],
    cost: undefined,
    attack: undefined,
    defense: undefined,
  }),
  token: card('token', { token: true }),
});

const LEADER_DB: CardDb = Object.freeze({
  ...DB,
  'tk-wei-caocao': card('tk-wei-caocao', { colors: ['B', 'R'], rarity: 'ur' }),
  'tk-shu-liubei': card('tk-shu-liubei', { colors: ['G', 'W'], rarity: 'ur' }),
  'tk-wu-sunquan': card('tk-wu-sunquan', { colors: ['U', 'R'], rarity: 'ur' }),
});

function status(id: string, save = freshSave(0)) {
  return evaluateAchievements(save, DB).find((entry) => entry.def.id === id)!;
}

describe('achievements', () => {
  it('syncs newly satisfied collection achievements without duplicating ids', () => {
    const save = freshSave(0);
    save.collection = { green_a: 1, green_b: 1, white_a: 1, blue_a: 1 };

    expect(status('collection-50', save)).toMatchObject({
      current: 4,
      target: 4,
      unlocked: true,
      claimed: false,
    });
    expect(syncAchievements(save, DB)).toContain('collection-50');
    expect(syncAchievements(save, DB)).toEqual([]);
    expect(save.achievements.unlocked.filter((id) => id === 'collection-50')).toHaveLength(1);
  });

  it('tracks color-completion and variant chase achievements from durable collection data', () => {
    const save = freshSave(0);
    save.collection = { green_a: 1, green_b: 1, black_a: 2 };
    save.collectionVariants.black_a = {
      [variantKey({ frame: 'black', holo: 'none' })]: 1,
      [variantKey({ frame: 'white', holo: 'void' })]: 1,
    };

    const newly = syncAchievements(save, DB);

    expect(newly).toEqual(expect.arrayContaining(['complete-green', 'variant-black-frame', 'variant-void-holo']));
    expect(status('complete-green', save)).toMatchObject({ current: 2, target: 2, unlocked: true });
    expect(status('variant-first-special', save)).toMatchObject({ current: 1, target: 1, unlocked: true });
  });

  it('tracks RoTK leader themed tiers including rainbow borders', () => {
    const save = freshSave(0);
    save.collection = {
      'tk-wei-caocao': 1,
      'tk-shu-liubei': 1,
      'tk-wu-sunquan': 1,
    };
    save.collectionVariants = {
      'tk-wei-caocao': { [variantKey({ frame: 'white', holo: 'none' })]: 1 },
      'tk-shu-liubei': { [variantKey({ frame: 'white', holo: 'none' })]: 1 },
      'tk-wu-sunquan': { [variantKey({ frame: 'white', holo: 'none' })]: 1 },
    };

    expect(evaluateAchievements(save, LEADER_DB).find((entry) => entry.def.id === 'theme-rotk-three-lords')).toMatchObject({
      current: 3,
      target: 3,
      unlocked: true,
    });
    expect(evaluateAchievements(save, LEADER_DB).find((entry) => entry.def.id === 'theme-rotk-three-lords-rainbow')).toMatchObject({
      current: 0,
      target: 3,
      unlocked: false,
    });

    save.collectionVariants = {
      'tk-wei-caocao': { [variantKey({ frame: 'rainbow', holo: 'none' })]: 1 },
      'tk-shu-liubei': { [variantKey({ frame: 'rainbow', holo: 'none' })]: 1 },
      'tk-wu-sunquan': { [variantKey({ frame: 'rainbow', holo: 'none' })]: 1 },
    };

    const newly = syncAchievements(save, LEADER_DB);
    expect(newly).toEqual(
      expect.arrayContaining([
        'theme-rotk-three-lords',
        'theme-rotk-three-lords-special',
        'theme-rotk-three-lords-rainbow',
      ]),
    );
  });

  it('tracks mono-color and dual-color tower clear achievements from gauntlet history', () => {
    const save = freshSave(0);
    save.gauntlet.clearStyles.monoColor = 1;

    expect(syncAchievements(save, DB)).toContain('gauntlet-clear-mono');
    expect(status('gauntlet-clear-mono', save)).toMatchObject({ current: 1, target: 1, unlocked: true });
    expect(status('gauntlet-clear-dual', save)).toMatchObject({ current: 0, target: 1, unlocked: false });
  });

  it('claims rewards once and refuses locked or unknown achievements', () => {
    const save = freshSave(0);
    save.stats.wins = 1;
    syncAchievements(save, DB);

    const first = claimAchievement(save, 'first-win');
    expect(first).toEqual({ ok: true, gold: 75 });
    expect(save.gold).toBe(75);
    expect(claimAchievement(save, 'first-win')).toEqual({ ok: false, gold: 0, reason: 'claimed' });
    expect(claimAchievement(save, 'packs-10')).toEqual({ ok: false, gold: 0, reason: 'locked' });
    expect(claimAchievement(save, 'missing')).toEqual({ ok: false, gold: 0, reason: 'unknown' });
  });

  it('claimAll claims every unclaimed unlocked reward and leaves claimed rewards alone', () => {
    const save = freshSave(0);
    save.stats.wins = 10;
    save.stats.byDifficulty.hard.w = 1;
    syncAchievements(save, DB);
    claimAchievement(save, 'first-win');
    const before = save.gold;

    const result = claimAllAchievements(save);

    expect(result.ids).toEqual(expect.arrayContaining(['ten-wins', 'hard-win']));
    expect(result.ids).not.toContain('first-win');
    expect(save.gold).toBe(before + result.gold);
    expect(claimAllAchievements(save)).toEqual({ ids: [], gold: 0 });
  });
});
