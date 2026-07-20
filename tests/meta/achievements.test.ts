import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
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

const GREEK_COURT = [
  'gk-athena',
  'gk-ares',
  'gk-zeus',
  'gk-hera',
  'gk-aphrodite',
  'gk-persephone',
  'gk-hades',
  'gk-poseidon',
  'gk-gaia',
] as const;

const BEAST_COUNCIL = ['bk-packmother', 'bk-kitsune-matriarch', 'bk-wolfqueen'] as const;

const RAGNAROK_COURT = [
  'rg-hel',
  'rg-freya',
  'rg-fenrir',
  'rg-brunhild',
  'rg-norns',
  'rg-angrboda',
  'rg-skadi',
  'rg-idun',
] as const;

const CELTIC_FAE_IDS = Object.values(CARD_DB)
  .filter((entry) => entry.set === 'celtic-fae')
  .map((entry) => entry.id);
const CELTIC_FAE_SOVEREIGNS = [
  'cf-morrigan-black-wing',
  'cf-titania-silver-court',
  'cf-aine-sunlit-bargain',
  'cf-nimue-before-the-lake',
] as const;
const CELTIC_FAE_SSR_COURT = [
  'cf-badb-cathas-warning',
  'cf-selkie-tide-queen',
  'cf-balor-evil-eye',
  'cf-wild-hunt-matriarch',
  'cf-cauldron-of-dagda',
] as const;
const CELTIC_FAE_SELKIES = ['cf-selkie-tide-queen', 'cf-moon-pool-selkie', 'cf-selkie-runner'] as const;
const CELTIC_FAE_RAVENS = ['cf-raven-torc-envoy', 'cf-omen-raven'] as const;
const CELTIC_FAE_REDCAPS = ['cf-redcap-blood-host', 'cf-redcap-skirmisher'] as const;

const CELTIC_FAE_GOALS = [
  { id: 'theme-celtic-fae-25', ids: CELTIC_FAE_IDS.slice(0, Math.ceil(CELTIC_FAE_IDS.length * 0.25)) },
  { id: 'theme-celtic-fae-50', ids: CELTIC_FAE_IDS.slice(0, Math.ceil(CELTIC_FAE_IDS.length * 0.5)) },
  { id: 'theme-celtic-fae-complete', ids: CELTIC_FAE_IDS },
  { id: 'theme-celtic-fae-court-sovereigns', ids: CELTIC_FAE_SOVEREIGNS },
  { id: 'theme-celtic-fae-ssr-court', ids: CELTIC_FAE_SSR_COURT },
  { id: 'theme-celtic-fae-selkies', ids: CELTIC_FAE_SELKIES },
  { id: 'theme-celtic-fae-ravens', ids: CELTIC_FAE_RAVENS },
  { id: 'theme-celtic-fae-redcaps', ids: CELTIC_FAE_REDCAPS },
] as const;

const GOTHIC_MONSTERS_IDS = Object.values(CARD_DB)
  .filter((entry) => entry.set === 'gothic-monsters')
  .map((entry) => entry.id);
const GOTHIC_MONSTERS_HEADLINERS = [
  'gm-carmilla-crimson-host',
  'gm-bride-storm-crowned',
  'gm-luna-wolf-matriarch',
  'gm-lenore-velvet-saint',
] as const;
const GOTHIC_MONSTERS_DREADED = GOTHIC_MONSTERS_IDS.filter((id) => CARD_DB[id].keywords?.includes('dreaded'));
const GOTHIC_MONSTERS_EMPOWERED = GOTHIC_MONSTERS_IDS.filter((id) => CARD_DB[id].empower !== undefined);
const GOTHIC_MONSTERS_VAMPIRES = GOTHIC_MONSTERS_IDS.filter((id) => CARD_DB[id].subtypes.includes('Vampire'));
const GOTHIC_MONSTERS_GOALS = [
  { id: 'theme-gothic-monsters-25', ids: GOTHIC_MONSTERS_IDS.slice(0, Math.ceil(GOTHIC_MONSTERS_IDS.length * 0.25)) },
  { id: 'theme-gothic-monsters-50', ids: GOTHIC_MONSTERS_IDS.slice(0, Math.ceil(GOTHIC_MONSTERS_IDS.length * 0.5)) },
  { id: 'theme-gothic-monsters-complete', ids: GOTHIC_MONSTERS_IDS },
  { id: 'theme-gothic-monsters-headliners', ids: GOTHIC_MONSTERS_HEADLINERS },
  { id: 'theme-gothic-monsters-dreaded', ids: GOTHIC_MONSTERS_DREADED },
  { id: 'theme-gothic-monsters-empowered', ids: GOTHIC_MONSTERS_EMPOWERED },
  { id: 'theme-gothic-monsters-vampires', ids: GOTHIC_MONSTERS_VAMPIRES },
] as const;

const THEME_DB: CardDb = Object.freeze({
  ...DB,
  ...Object.fromEntries(GREEK_COURT.map((id) => [id, card(id, { subtypes: ['Olympian', 'God'], rarity: 'ur' })])),
  ...Object.fromEntries(BEAST_COUNCIL.map((id) => [id, card(id, { subtypes: ['Beastkin'], rarity: 'ssr' })])),
  'rg-hel': card('rg-hel', { set: 'ragnarok', subtypes: ['Aesir', 'God'], rarity: 'ur' }),
  'rg-freya': card('rg-freya', { set: 'ragnarok', subtypes: ['Vanir', 'God'], rarity: 'ur' }),
  'rg-fenrir': card('rg-fenrir', { set: 'ragnarok', subtypes: ['Wolf', 'Jotun'], rarity: 'ur' }),
  'rg-brunhild': card('rg-brunhild', { set: 'ragnarok', subtypes: ['Valkyrie', 'Shieldmaiden'], rarity: 'ssr' }),
  'rg-norns': card('rg-norns', { set: 'ragnarok', subtypes: ['Norn'], rarity: 'ssr' }),
  'rg-angrboda': card('rg-angrboda', { set: 'ragnarok', subtypes: ['Jotun'], rarity: 'ssr' }),
  'rg-skadi': card('rg-skadi', { set: 'ragnarok', subtypes: ['Jotun', 'Warrior'], rarity: 'ssr' }),
  'rg-idun': card('rg-idun', { set: 'ragnarok', subtypes: ['Vanir'], rarity: 'sr' }),
  'rg-valkyrie-captain': card('rg-valkyrie-captain', { set: 'ragnarok', subtypes: ['Valkyrie'], rarity: 'sr' }),
  'rg-draugr-jarl': card('rg-draugr-jarl', { set: 'ragnarok', subtypes: ['Draugr'], rarity: 'sr' }),
  'rg-hels-handmaiden': card('rg-hels-handmaiden', { set: 'ragnarok', subtypes: ['Draugr'], rarity: 'r' }),
  'rg-jotun-earthshaker': card('rg-jotun-earthshaker', { set: 'ragnarok', subtypes: ['Jotun'], rarity: 'sr' }),
});

function status(id: string, save = freshSave(0), db = DB) {
  return evaluateAchievements(save, db).find((entry) => entry.def.id === id)!;
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
      [variantKey({ frame: 'black', holo: 'none', fullArt: false })]: 1,
      [variantKey({ frame: 'white', holo: 'void', fullArt: false })]: 1,
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
      'tk-wei-caocao': { [variantKey({ frame: 'white', holo: 'none', fullArt: false })]: 1 },
      'tk-shu-liubei': { [variantKey({ frame: 'white', holo: 'none', fullArt: false })]: 1 },
      'tk-wu-sunquan': { [variantKey({ frame: 'white', holo: 'none', fullArt: false })]: 1 },
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
      'tk-wei-caocao': { [variantKey({ frame: 'rainbow', holo: 'none', fullArt: false })]: 1 },
      'tk-shu-liubei': { [variantKey({ frame: 'rainbow', holo: 'none', fullArt: false })]: 1 },
      'tk-wu-sunquan': { [variantKey({ frame: 'rainbow', holo: 'none', fullArt: false })]: 1 },
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

  it('tracks Greek and Beastkin archetype tiers including rainbow borders', () => {
    const save = freshSave(0);
    save.collection = Object.fromEntries([...GREEK_COURT, ...BEAST_COUNCIL].map((id) => [id, 1]));
    save.collectionVariants = Object.fromEntries(
      [...GREEK_COURT, ...BEAST_COUNCIL].map((id) => [id, { [variantKey({ frame: 'white', holo: 'none', fullArt: false })]: 1 }]),
    );

    expect(status('theme-greek-olympian-court', save, THEME_DB)).toMatchObject({
      current: GREEK_COURT.length,
      target: GREEK_COURT.length,
      unlocked: true,
    });
    expect(status('theme-beastkin-pack-council', save, THEME_DB)).toMatchObject({
      current: BEAST_COUNCIL.length,
      target: BEAST_COUNCIL.length,
      unlocked: true,
    });
    expect(status('theme-greek-olympian-court-rainbow', save, THEME_DB)).toMatchObject({
      current: 0,
      target: GREEK_COURT.length,
      unlocked: false,
    });

    save.collectionVariants = Object.fromEntries(
      [...GREEK_COURT, ...BEAST_COUNCIL].map((id) => [id, { [variantKey({ frame: 'rainbow', holo: 'none', fullArt: false })]: 1 }]),
    );

    const newly = syncAchievements(save, THEME_DB);
    expect(newly).toEqual(
      expect.arrayContaining([
        'theme-greek-olympian-court-special',
        'theme-greek-olympian-court-rainbow',
        'theme-beastkin-pack-council-special',
        'theme-beastkin-pack-council-rainbow',
      ]),
    );
  });

  it('scales Ragnarök achievements by set size and tracks its sub-archetypes', () => {
    const save = freshSave(0);
    const ragnarokIds = Object.values(THEME_DB)
      .filter((entry) => entry.set === 'ragnarok')
      .map((entry) => entry.id);
    save.collection = Object.fromEntries(ragnarokIds.slice(0, Math.ceil(ragnarokIds.length * 0.5)).map((id) => [id, 1]));

    expect(status('theme-ragnarok-25', save, THEME_DB)).toMatchObject({ target: 3, unlocked: true });
    expect(status('theme-ragnarok-50', save, THEME_DB)).toMatchObject({ target: 6, unlocked: true });
    expect(status('theme-ragnarok-complete', save, THEME_DB)).toMatchObject({ target: 12, unlocked: false });

    save.collection = Object.fromEntries(ragnarokIds.map((id) => [id, 1]));
    const statuses = evaluateAchievements(save, THEME_DB);
    const unlocked = statuses.filter((entry) => entry.unlocked).map((entry) => entry.def.id);

    expect(unlocked).toEqual(
      expect.arrayContaining([
        'theme-ragnarok-complete',
        'theme-ragnarok-twilight-court',
        'theme-ragnarok-valkyries',
        'theme-ragnarok-draugr',
        'theme-ragnarok-jotun-wolves',
      ]),
    );
  });

  it('tracks Ragnarök headline special and rainbow tiers', () => {
    const save = freshSave(0);
    save.collection = Object.fromEntries(RAGNAROK_COURT.map((id) => [id, 1]));
    save.collectionVariants = Object.fromEntries(
      RAGNAROK_COURT.map((id) => [id, { [variantKey({ frame: 'gold', holo: 'none', fullArt: false })]: 1 }]),
    );

    expect(status('theme-ragnarok-twilight-court-special', save, THEME_DB)).toMatchObject({
      current: RAGNAROK_COURT.length,
      target: RAGNAROK_COURT.length,
      unlocked: true,
    });
    expect(status('theme-ragnarok-twilight-court-rainbow', save, THEME_DB)).toMatchObject({
      current: 0,
      target: RAGNAROK_COURT.length,
      unlocked: false,
    });

    save.collectionVariants = Object.fromEntries(
      RAGNAROK_COURT.map((id) => [id, { [variantKey({ frame: 'rainbow', holo: 'none', fullArt: false })]: 1 }]),
    );

    expect(syncAchievements(save, THEME_DB)).toContain('theme-ragnarok-twilight-court-rainbow');
  });

  it('uses the 81-card Celtic Fae pool and its intended court sub-archetype ids', () => {
    expect(CELTIC_FAE_IDS).toHaveLength(81);
    expect(CELTIC_FAE_IDS.filter((id) => CARD_DB[id].rarity === 'ssr')).toEqual(CELTIC_FAE_SSR_COURT);
    expect(CELTIC_FAE_IDS.filter((id) => CARD_DB[id].subtypes.includes('Selkie'))).toEqual(CELTIC_FAE_SELKIES);
    expect(CELTIC_FAE_IDS.filter((id) => CARD_DB[id].subtypes.includes('Raven'))).toEqual(CELTIC_FAE_RAVENS);
    expect(CELTIC_FAE_IDS.filter((id) => CARD_DB[id].subtypes.includes('Redcap'))).toEqual(CELTIC_FAE_REDCAPS);
  });

  for (const { id, ids } of CELTIC_FAE_GOALS) {
    it(`unlocks ${id} with exactly its qualifying Celtic Fae collection and locks one card short`, () => {
      const complete = freshSave(0);
      complete.collection = Object.fromEntries(ids.map((cardId) => [cardId, 1]));

      expect(status(id, complete, CARD_DB)).toMatchObject({
        current: ids.length,
        target: ids.length,
        unlocked: true,
      });
      expect(syncAchievements(complete, CARD_DB)).toContain(id);

      const oneShort = freshSave(0);
      oneShort.collection = Object.fromEntries(ids.slice(0, -1).map((cardId) => [cardId, 1]));

      expect(status(id, oneShort, CARD_DB)).toMatchObject({
        current: ids.length - 1,
        target: ids.length,
        unlocked: false,
      });
    });
  }

  it('keeps Celtic Fae achievement claims idempotent', () => {
    const save = freshSave(0);
    save.collection = Object.fromEntries(CELTIC_FAE_SOVEREIGNS.map((id) => [id, 1]));
    syncAchievements(save, CARD_DB);

    expect(claimAchievement(save, 'theme-celtic-fae-court-sovereigns')).toEqual({ ok: true, gold: 600 });
    expect(claimAchievement(save, 'theme-celtic-fae-court-sovereigns')).toEqual({
      ok: false,
      gold: 0,
      reason: 'claimed',
    });
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

describe('arthurian court achievements (1.2)', () => {
  it('tracks the Round Table and Crown Jewels named sets against the live catalog', () => {
    const save = freshSave(0);
    expect(status('theme-arthurian-round-table', save, CARD_DB)).toMatchObject({
      current: 0,
      target: 5,
      unlocked: false,
    });
    for (const id of [
      'ac-artoria-once-future',
      'ac-lancelot-moonlit-shame',
      'ac-gawain-noonblade',
      'ac-percival-clear-heart',
      'ac-galahad-silver-oath',
    ]) {
      save.collection[id] = 1;
    }
    expect(status('theme-arthurian-round-table', save, CARD_DB)).toMatchObject({ current: 5, unlocked: true });
    expect(status('theme-arthurian-crown-jewels', save, CARD_DB)).toMatchObject({ current: 1, target: 4 });
  });

  it('scopes the Quest and Champion Awakening cuts to the real set contents', () => {
    const save = freshSave(0);
    // Seven Quests and five awakening carriers ship in the set; the targets
    // derive from the catalog, so a future set change moves them honestly.
    expect(status('theme-arthurian-quests', save, CARD_DB).target).toBe(7);
    expect(status('theme-arthurian-champions', save, CARD_DB).target).toBe(5);
    expect(status('theme-arthurian-complete', save, CARD_DB).target).toBe(81);
  });
});

describe('gothic monsters achievements (1.3)', () => {
  it('uses the 81-card Gothic Monsters pool and the intended sub-archetypes', () => {
    expect(GOTHIC_MONSTERS_IDS).toHaveLength(81);
    expect(GOTHIC_MONSTERS_HEADLINERS.every((id) => CARD_DB[id]?.rarity === 'ur')).toBe(true);
    expect(GOTHIC_MONSTERS_DREADED).toHaveLength(10);
    expect(GOTHIC_MONSTERS_EMPOWERED).toHaveLength(20);
    expect(GOTHIC_MONSTERS_VAMPIRES).toHaveLength(10);
  });

  for (const { id, ids } of GOTHIC_MONSTERS_GOALS) {
    it(`unlocks ${id} with exactly its qualifying Gothic Monsters collection and locks one card short`, () => {
      const complete = freshSave(0);
      complete.collection = Object.fromEntries(ids.map((cardId) => [cardId, 1]));

      expect(status(id, complete, CARD_DB)).toMatchObject({
        current: ids.length,
        target: ids.length,
        unlocked: true,
      });
      expect(syncAchievements(complete, CARD_DB)).toContain(id);

      const oneShort = freshSave(0);
      oneShort.collection = Object.fromEntries(ids.slice(0, -1).map((cardId) => [cardId, 1]));

      expect(status(id, oneShort, CARD_DB)).toMatchObject({
        current: ids.length - 1,
        target: ids.length,
        unlocked: false,
      });
    });
  }

  it('tracks special variants for all four Gothic Monsters headliners', () => {
    const save = freshSave(0);
    save.collection = Object.fromEntries(GOTHIC_MONSTERS_HEADLINERS.map((id) => [id, 1]));
    save.collectionVariants = Object.fromEntries(
      GOTHIC_MONSTERS_HEADLINERS.map((id) => [id, { [variantKey({ frame: 'gold', holo: 'none', fullArt: false })]: 1 }]),
    );

    expect(status('theme-gothic-monsters-headliners-special', save, CARD_DB)).toMatchObject({
      current: 4,
      target: 4,
      unlocked: true,
    });
    expect(syncAchievements(save, CARD_DB)).toContain('theme-gothic-monsters-headliners-special');
  });
});

describe('limited run-history achievements (1.2)', () => {
  function draftEntry(over: Partial<import('../../src/meta/Limited').LimitedHistoryEntry> = {}) {
    return {
      id: `run-${Math.abs(over.seed ?? 1)}`,
      mode: 'draft' as const,
      seed: over.seed ?? 1,
      wins: 2,
      losses: 1,
      deckStyle: 'dual' as const,
      completedAt: 1000,
      rewardGold: 100,
      ...over,
    };
  }

  it('draft-first-run and draft-five-runs count completed draft runs only', () => {
    const save = freshSave(0);
    expect(status('draft-first-run', save)).toMatchObject({ current: 0, unlocked: false });

    save.limited.history = [
      draftEntry({ seed: 1 }),
      { ...draftEntry({ seed: 2 }), mode: 'sealed' as const },
    ];
    expect(status('draft-first-run', save)).toMatchObject({ current: 1, target: 1, unlocked: true });
    expect(status('draft-five-runs', save)).toMatchObject({ current: 1, target: 5, unlocked: false });

    save.limited.history = [1, 2, 3, 4, 5].map((seed) => draftEntry({ seed }));
    expect(status('draft-five-runs', save)).toMatchObject({ current: 5, unlocked: true });
  });

  it('draft-clean-sweep reads the durable bestDraftWins record (FIFO-immune)', () => {
    const save = freshSave(0);
    save.limited.bestDraftWins = 2;
    expect(status('draft-clean-sweep', save)).toMatchObject({ current: 2, target: 3, unlocked: false });
    save.limited.bestDraftWins = 3;
    expect(status('draft-clean-sweep', save)).toMatchObject({ unlocked: true });
  });

  it('draft-premium-run requires a completed premium entry, and unlocks latch past the FIFO', () => {
    const save = freshSave(0);
    save.limited.history = [draftEntry({ seed: 1 })];
    expect(status('draft-premium-run', save)).toMatchObject({ current: 0, unlocked: false });

    save.limited.history = [draftEntry({ seed: 2, premium: true })];
    expect(status('draft-premium-run', save)).toMatchObject({ current: 1, unlocked: true });
    expect(syncAchievements(save, DB)).toContain('draft-premium-run');

    // The run rolls off the 20-entry FIFO; the latched unlock survives.
    save.limited.history = [];
    expect(status('draft-premium-run', save)).toMatchObject({ current: 0, unlocked: true });
  });
});
