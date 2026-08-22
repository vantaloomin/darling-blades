import { describe, expect, it } from 'vitest';
import { DROPS, ECONOMY } from '../../src/config/rules';
import { YOKAI_NIGHTS, YOKAI_SPEC_ROWS } from '../../src/data/cards/yokai-nights';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { THEME_DECKS } from '../../src/data/starterDecks';
import type { CardDef } from '../../src/engine/types';
import { validateHauntlinkDef } from '../../src/engine/types';
import { createRngState } from '../../src/engine/rng';
import { applyFilters, defaultFilterState } from '../../src/meta/collectionFilter';
import { grantDeckCards } from '../../src/meta/Economy';
import { packPool, openPack } from '../../src/meta/PackOpener';
import { validateDeck } from '../../src/meta/DeckStorage';
import { freshSave } from '../../src/meta/SaveManager';
import { ACHIEVEMENTS, evaluateAchievements } from '../../src/meta/Achievements';

const YOKAI_SET = 'yokai-nights' as unknown as CardDef['set'];
const RARITY_COUNTS = { c: 60, r: 36, sr: 11, ssr: 8, ur: 5 } as const;
const YOKAI_SPECIES = new Set(['Kitsune', 'Oni', 'Yokai', 'Tanuki', 'Kappa', 'Dryad', 'Spirit']);
const YOKAI_ACHIEVEMENTS = [
  'theme-yokai-nights-first-contact',
  'theme-yokai-nights-30',
  'theme-yokai-nights-60',
  'theme-yokai-nights-complete',
  'theme-yokai-nights-hauntlink',
  'theme-yokai-nights-ur',
  'theme-yokai-nights-rainbow',
  'theme-yokai-nights-perfect-possession',
] as const;

describe('Yokai Nights data integrity', () => {
  it('keeps every Hauntlink rider in parity with its Linked spec clause', () => {
    const keywordByName = {
      Skyborne: 'skyborne',
      'Warding Gaze': 'wardingGaze',
      'First Blade': 'firstBlade',
      'Twin Blades': 'twinBlades',
      Warcry: 'warcry',
      Overrun: 'overrun',
      Sentinel: 'sentinel',
      Bulwark: 'bulwark',
      Deathblade: 'deathblade',
      'Blood Oath': 'bloodoath',
      Untouchable: 'untouchable',
      Dreaded: 'dreaded',
    } as const;
    for (const row of YOKAI_SPEC_ROWS.filter((entry) => entry.mechanics.includes('Hauntlink'))) {
      const linked = row.mechanics.match(/Linked: The linked creature gets (.+?)(?:\.|$)/i)?.[1];
      expect(linked, `${row.id} needs a Linked clause`).toBeDefined();
      const expected = linked!
        .replace(/^\+\d+\/\+\d+,?\s*/, '')
        .replace(/^and /i, '')
        .replace(/\s+and\s+/g, ', ')
        .split(',')
        .map((part) => keywordByName[part.trim() as keyof typeof keywordByName])
        .filter((keyword) => keyword !== undefined)
        .sort();
      expect(YOKAI_NIGHTS.find((card) => card.id === row.id)?.hauntlink?.linked.grantKeywords?.slice().sort(), row.id)
        .toEqual(expected);
    }
  });

  it('contains the approved 120-card rarity mix and namespace', () => {
    expect(YOKAI_NIGHTS).toHaveLength(120);
    expect(Object.fromEntries(Object.keys(RARITY_COUNTS).map((rarity) => [
      rarity,
      YOKAI_NIGHTS.filter((card) => card.rarity === rarity).length,
    ]))).toEqual(RARITY_COUNTS);
    for (const card of YOKAI_NIGHTS) {
      expect(card.id.startsWith('yn-'), `${card.id} should use yn-`).toBe(true);
      expect(card.set).toBe(YOKAI_SET);
      expect(CARD_DB[card.id].set).toBe(YOKAI_SET);
    }
  });

  it('keeps cleaned species taxonomy, creature subtypes, and Hauntlinks legal', () => {
    const hauntlinks = YOKAI_NIGHTS.filter((card) => card.hauntlink);
    expect(hauntlinks).toHaveLength(13);
    for (const card of YOKAI_NIGHTS) {
      if (card.types.includes('creature')) expect(card.subtypes.length, card.id).toBeGreaterThan(0);
      if (card.subtypes.includes('Human')) {
        expect(card.subtypes.filter((subtype) => YOKAI_SPECIES.has(subtype)), card.id).toEqual([]);
      }
      if (card.hauntlink) expect(validateHauntlinkDef(card), card.id).toEqual([]);
    }
  });

  it('has the five approved ally dual lands and no set-unique tokens', () => {
    expect(YOKAI_NIGHTS.filter((card) => card.types.includes('land')).map((card) => card.id)).toEqual([
      'yn-lantern-canal-junction',
      'yn-midnight-data-market',
      'yn-burning-toll-bridge',
      'yn-overgrown-speedway',
      'yn-rooftop-shrine-garden',
    ]);
    expect(YOKAI_NIGHTS.filter((card) => card.token)).toEqual([]);
    expect(YOKAI_NIGHTS.flatMap((card) => card.abilities ?? [])
      .flatMap((ability) => ability.ops ?? [])
      .filter((op) => op.op === 'createToken')).toEqual([]);
  });

  it('keeps every rarity tier self-contained in the 525g booster', () => {
    expect(ECONOMY.yokaiNightsPackPrice).toBe(525);
    for (const tier of Object.keys(RARITY_COUNTS) as Array<keyof typeof RARITY_COUNTS>) {
      const pool = packPool(CARD_DB, tier, YOKAI_SET);
      expect(pool.length, `${tier} pool`).toBeGreaterThan(0);
      expect(pool.every((id) => id.startsWith('yn-'))).toBe(true);
    }
    const save = freshSave(0);
    const result = openPack(save, CARD_DB, createRngState(20_260_729), YOKAI_SET);
    expect(result.cards).toHaveLength(ECONOMY.boosterPackSize);
    expect(result.cards.every((card) => CARD_DB[card.cardId].set === YOKAI_SET)).toBe(true);
    for (const axis of [DROPS.tier, DROPS.frame, DROPS.holo, DROPS.fullArt]) {
      expect(axis.reduce((sum, [, weight]) => sum + weight, 0)).toBeCloseTo(100, 9);
    }
  });

  it('round-trips the collection filter and the Neon Afterimage precon', () => {
    const filtered = applyFilters(ALL_CARDS, { ...defaultFilterState(), set: 'yokai-nights' }, freshSave(0));
    expect(filtered.map((card) => card.id).sort()).toEqual(YOKAI_NIGHTS.map((card) => card.id).sort());

    const deck = THEME_DECKS.find((entry) => entry.id === 'theme-yokai-nights');
    expect(deck).toBeDefined();
    expect(deck?.name).toBe('Neon Afterimage');
    expect(deck?.cards).toHaveLength(60);
    expect(deck?.cards.filter((id) => CARD_DB[id].types.includes('land'))).toHaveLength(24);
    const save = freshSave(0);
    grantDeckCards(save, CARD_DB, deck!.cards);
    expect(validateDeck(CARD_DB, save, deck!.cards).filter((issue) => issue.kind === 'error')).toHaveLength(0);
  });

  it('registers the eight schema-free Yokai Nights achievements', () => {
    const defs = ACHIEVEMENTS.filter((def) => YOKAI_ACHIEVEMENTS.includes(def.id as typeof YOKAI_ACHIEVEMENTS[number]));
    expect(defs.map((def) => def.id)).toEqual([...YOKAI_ACHIEVEMENTS]);
    const statuses = evaluateAchievements(freshSave(0), CARD_DB);
    expect(statuses.filter((status) => status.def.id.startsWith('theme-yokai-nights-'))).toHaveLength(8);
  });
});
