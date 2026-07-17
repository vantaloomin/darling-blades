import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { ARTHURIAN_COURT } from '../../src/data/cards/arthurian-court';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import type { Keyword } from '../../src/engine/types';
import { applyFilters, defaultFilterState } from '../../src/meta/collectionFilter';
import { packPool } from '../../src/meta/PackOpener';
import { freshSave } from '../../src/meta/SaveManager';

const RARITY_COUNTS = { c: 40, r: 24, sr: 7, ssr: 5, ur: 4 } as const;
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
  'foresee',
  'awaken',
  'raise',
]);

function acDeck(ids: readonly string[]): string[] {
  return ids.flatMap((id) => Array.from({ length: 4 }, () => id));
}

const DAWN_DECK = acDeck([
  'ac-lowland-fort',
  'ac-mirror-lake',
  'ac-red-tournament-ground',
  'ac-holy-well',
  'ac-avalon-shore',
  'ac-artoria-once-future',
  'ac-lancelot-moonlit-shame',
  'ac-gawain-noonblade',
  'ac-camelot-banneret',
  'ac-lakeblade-initiate',
  'ac-torchbearer-knight',
  'ac-quest-for-the-grail',
  'ac-round-table-vow',
  'ac-moonlit-joust',
  'ac-shieldwall-call',
]);

const LAKE_DECK = acDeck([
  'ac-lowland-fort',
  'ac-mirror-lake',
  'ac-red-tournament-ground',
  'ac-holy-well',
  'ac-avalon-shore',
  'ac-guinevere-court-sun',
  'ac-merlin-crow-clock',
  'ac-tournament-favorite',
  'ac-novice-squire',
  'ac-chapel-questant',
  'ac-sword-test-stone',
  'ac-squire-to-champion',
  'ac-knights-breakfast',
  'ac-secret-of-avalon',
  'ac-grail-procession',
]);

describe('Arthurian Court data integrity', () => {
  it('contains the complete 80-card booster set with the target rarity histogram', () => {
    expect(ARTHURIAN_COURT).toHaveLength(80);
    const actual = Object.fromEntries(
      Object.keys(RARITY_COUNTS).map((rarity) => [
        rarity,
        ARTHURIAN_COURT.filter((card) => card.rarity === rarity).length,
      ]),
    );
    expect(actual).toEqual(RARITY_COUNTS);
  });

  it('uses the ac- namespace and is catalog-stamped as arthurian-court', () => {
    for (const card of ARTHURIAN_COURT) {
      expect(card.id.startsWith('ac-'), card.id + ' must use ac-').toBe(true);
      expect(CARD_DB[card.id].set, card.id + ' must be set:arthurian-court').toBe('arthurian-court');
    }
  });

  it('uses only supported keywords, legal typed effects, and trigger-safe chapters', () => {
    for (const card of ARTHURIAN_COURT) {
      for (const keyword of card.keywords ?? []) {
        expect(KEYWORDS.has(keyword), card.id + ' keyword ' + keyword).toBe(true);
      }
      for (const ability of card.abilities ?? []) {
        if (ability.when !== 'spell') {
          expect(ability.targets, card.id + ' ' + ability.when + ' trigger must not target').toBeUndefined();
        }
        expect(ability.condition === undefined || ability.condition === 'questActive').toBe(true);
        if (ability.static) {
          expect(ability.static.condition === undefined || ability.static.condition === 'questActive').toBe(true);
        }
        for (const op of ability.ops ?? []) {
          expect(OPS.has(op.op), card.id + ' has an unsupported operation ' + op.op).toBe(true);
        }
      }
      if (card.chapters) {
        expect(card.subtypes, card.id + ' chapters need Quest subtype').toContain('Quest');
        expect(card.chapters.length, card.id + ' chapter count').toBeGreaterThanOrEqual(2);
        expect(card.chapters.length, card.id + ' chapter count').toBeLessThanOrEqual(3);
        for (const chapter of card.chapters) {
          for (const op of chapter) {
            expect(OPS.has(op.op), card.id + ' chapter has an unsupported operation ' + op.op).toBe(true);
          }
        }
      }
    }
  });

  it('keeps every knightly creature in the Knight cohort and exposes awakening blocks', () => {
    const knightIds = [
      'ac-artoria-once-future',
      'ac-lancelot-moonlit-shame',
      'ac-gawain-noonblade',
      'ac-percival-clear-heart',
      'ac-galahad-silver-oath',
      'ac-mordred-bastard-star',
      'ac-camelot-banneret',
      'ac-lakeblade-initiate',
      'ac-ashwood-ranger',
      'ac-tournament-favorite',
      'ac-oathbroken-knight',
      'ac-torchbearer-knight',
      'ac-errant-duelist',
      'ac-root-chapel-warden',
      'ac-pennant-carrier',
    ];
    for (const id of knightIds) expect(CARD_DB[id].subtypes, id + ' needs Knight subtype').toContain('Knight');
    expect(CARD_DB['ac-artoria-once-future'].awakening).toBeDefined();
    expect(CARD_DB['ac-lancelot-moonlit-shame'].awakening).toBeDefined();
    expect(CARD_DB['ac-camelot-banneret'].awakening).toBeDefined();
    expect(CARD_DB['ac-lakeblade-initiate'].awakening).toBeDefined();
    expect(CARD_DB['ac-errant-duelist'].awakening).toBeDefined();
  });

  it('has the two specified duals and five common mono taplands', () => {
    const lands = ARTHURIAN_COURT.filter((card) => card.types.includes('land'));
    expect(lands).toHaveLength(7);
    expect(lands.every((card) => card.entersTapped)).toBe(true);
    expect(Object.fromEntries(lands.map((card) => [card.id, card.manaAbility]))).toEqual({
      'ac-holy-well': ['W', 'G'],
      'ac-avalon-shore': ['U', 'W'],
      'ac-bramble-chapel': ['G'],
      'ac-lowland-fort': ['W'],
      'ac-red-tournament-ground': ['R'],
      'ac-court-of-whispers': ['B'],
      'ac-mirror-lake': ['U'],
    });
    expect(lands.filter((card) => card.rarity === 'c' && (card.manaAbility?.length ?? 0) === 1)).toHaveLength(5);
  });
});

describe('Arthurian Court set plumbing', () => {
  it('has a self-contained ac-only pack pool in every rarity tier', () => {
    for (const tier of ['c', 'r', 'sr', 'ssr', 'ur'] as const) {
      const pool = packPool(CARD_DB, tier, 'arthurian-court');
      expect(pool.length, 'arthurian-court ' + tier + ' pool').toBeGreaterThan(0);
      expect(pool.every((id) => id.startsWith('ac-')), tier + ' pack pool must be ac-only').toBe(true);
    }
  });

  it('round-trips the collection set facet', () => {
    const filtered = applyFilters(
      ALL_CARDS,
      { ...defaultFilterState(), set: 'arthurian-court' },
      freshSave(0),
    );
    expect(filtered.map((card) => card.id).sort()).toEqual(ARTHURIAN_COURT.map((card) => card.id).sort());
  });
});

describe('Arthurian Court AI smoke duel', () => {
  it('finishes a seeded 60-card AC duel without stalling', () => {
    expect(DAWN_DECK).toHaveLength(60);
    expect(LAKE_DECK).toHaveLength(60);
    const game = new Game({ decks: [DAWN_DECK, LAKE_DECK], seed: 20_260_716, db: CARD_DB });
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
    throw new Error('Arthurian Court AI smoke duel did not terminate within 20,000 actions');
  });
});
