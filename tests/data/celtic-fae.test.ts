import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { CELTIC_FAE } from '../../src/data/cards/celtic-fae';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import type { Keyword } from '../../src/engine/types';
import { applyFilters, defaultFilterState } from '../../src/meta/collectionFilter';
import { packPool } from '../../src/meta/PackOpener';
import { freshSave } from '../../src/meta/SaveManager';

const RARITY_COUNTS = { c: 41, r: 24, sr: 7, ssr: 5, ur: 4 } as const;
const KEYWORDS = new Set<Keyword>([
  'skyborne',
  'wardingGaze',
  'firstBlade',
  'twinBlades',
  'warcry',
  'overrun',
  'sentinel',
  'bulwark',
  'deathblade',
  'bloodoath',
  'untouchable',
]);
const OPS = new Set([
  'damage',
  'gainLife',
  'loseLife',
  'draw',
  'discardRandom',
  'destroy',
  'sever',
  'severGrave',
  'severTop',
  'recall',
  'cancel',
  'boost',
  'addCounters',
  'tap',
  'fetchLand',
  'createToken',
  'massDestroy',
  'preventCombat',
  'reclaim',
  'grind',
  'raise',
  'foresee',
]);

function cfDeck(ids: readonly string[]): string[] {
  return ids.flatMap((id) => Array.from({ length: 4 }, () => id));
}

const CONTROL_DECK = cfDeck([
  'cf-moonlit-barrow',
  'cf-blackthorn-crossing',
  'cf-mist-road',
  'cf-mossy-ring',
  'cf-raven-stone',
  'cf-fae-ring-initiate',
  'cf-mistwing-pixie',
  'cf-selkie-runner',
  'cf-omen-raven',
  'cf-bog-banshee',
  'cf-bean-sidhe-keening',
  'cf-hollow-hill-gatekeeper',
  'cf-raven-torc-envoy',
  'cf-heatherblade-scout',
  'cf-bog-lantern-witch',
]);

const COURT_DECK = cfDeck([
  'cf-moonlit-barrow',
  'cf-blackthorn-crossing',
  'cf-mist-road',
  'cf-mossy-ring',
  'cf-raven-stone',
  'cf-fae-ring-initiate',
  'cf-mistwing-pixie',
  'cf-selkie-runner',
  'cf-hollow-hill-gatekeeper',
  'cf-silver-branch-oracle',
  'cf-omen-raven',
  'cf-bog-banshee',
  'cf-bean-sidhe-keening',
  'cf-thornmaze-patrol',
  'cf-hounds-of-annwn',
]);

describe('Celtic Fae data integrity', () => {
  it('contains the complete 81-card booster set with the target rarity histogram', () => {
    expect(CELTIC_FAE).toHaveLength(81);
    const actual = Object.fromEntries(
      Object.keys(RARITY_COUNTS).map((rarity) => [
        rarity,
        CELTIC_FAE.filter((card) => card.rarity === rarity).length,
      ]),
    );
    expect(actual).toEqual(RARITY_COUNTS);
  });

  it('uses the cf- namespace and is catalog-stamped as celtic-fae', () => {
    for (const card of CELTIC_FAE) {
      expect(card.id.startsWith('cf-'), card.id + ' must use cf-').toBe(true);
      expect(CARD_DB[card.id].set, card.id + ' must be set:celtic-fae').toBe('celtic-fae');
    }
  });

  it('uses only supported keywords, legal typed effects, and non-targeting triggers', () => {
    for (const card of CELTIC_FAE) {
      for (const keyword of card.keywords ?? []) {
        expect(KEYWORDS.has(keyword), card.id + ' keyword ' + keyword).toBe(true);
      }
      for (const ability of card.abilities ?? []) {
        if (ability.when !== 'spell') {
          expect(ability.targets, card.id + ' ' + ability.when + ' trigger must not target').toBeUndefined();
        }
        for (const op of ability.ops ?? []) {
          expect(OPS.has(op.op), card.id + ' has an unsupported operation ' + op.op).toBe(true);
        }
      }
    }
  });

  it('gives every creature a court subtype and gives the Fae anthem a real cohort', () => {
    const creatures = CELTIC_FAE.filter((card) => card.types.includes('creature'));
    expect(creatures).not.toHaveLength(0);
    for (const card of creatures) {
      expect(card.subtypes.length, card.id + ' needs a flavor subtype').toBeGreaterThan(0);
      expect(card.subtypes, card.id + ' should belong to the fae court').toContain('Fae');
    }
  });

  it('has the three rare duals and three common mono lands, all entering tapped', () => {
    const lands = CELTIC_FAE.filter((card) => card.types.includes('land'));
    expect(lands).toHaveLength(6);
    expect(lands.every((card) => card.entersTapped)).toBe(true);
    expect(Object.fromEntries(lands.map((card) => [card.id, card.manaAbility]))).toEqual({
      'cf-moonlit-barrow': ['U', 'B'],
      'cf-sunwell-grove': ['G', 'W'],
      'cf-blackthorn-crossing': ['B', 'G'],
      'cf-mist-road': ['U'],
      'cf-mossy-ring': ['G'],
      'cf-raven-stone': ['B'],
    });
  });
});

describe('Celtic Fae set plumbing', () => {
  it('has a self-contained cf-only pack pool in every rarity tier', () => {
    for (const tier of ['c', 'r', 'sr', 'ssr', 'ur'] as const) {
      const pool = packPool(CARD_DB, tier, 'celtic-fae');
      expect(pool.length, 'celtic-fae ' + tier + ' pool').toBeGreaterThan(0);
      expect(pool.every((id) => id.startsWith('cf-')), tier + ' pack pool must be cf-only').toBe(true);
    }
  });

  it('round-trips the collection set facet', () => {
    const filtered = applyFilters(
      ALL_CARDS,
      { ...defaultFilterState(), set: 'celtic-fae' },
      freshSave(0),
    );
    expect(filtered.map((card) => card.id).sort()).toEqual(CELTIC_FAE.map((card) => card.id).sort());
  });
});

describe('Celtic Fae AI smoke duel', () => {
  it('finishes a seeded 60-card court duel without stalling', () => {
    expect(CONTROL_DECK).toHaveLength(60);
    expect(COURT_DECK).toHaveLength(60);
    const game = new Game({ decks: [CONTROL_DECK, COURT_DECK], seed: 20_260_710, db: CARD_DB });
    const ais = [new EasyAI(CARD_DB, 1), new EasyAI(CARD_DB, 2)];

    for (let actions = 0; actions < 20_000; actions++) {
      if (game.awaiting.kind === 'gameOver') {
        expect(game.state.winner).not.toBeNull();
        expect(game.state.turn).toBeLessThanOrEqual(100);
        return;
      }
      const player = game.awaiting.player;
      game.submit(player, ais[player].chooseAction(game.viewFor(player), game.legalActions(player)));
    }
    throw new Error('Celtic Fae AI smoke duel did not terminate within 20,000 actions');
  });
});
