import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AVATARS } from '../../src/data/opponents';
import { STARTER_DECKS, THEME_DECKS } from '../../src/data/starterDecks';
import { DARLINGS_PRECONS } from '../../src/data/darlingsPrecons';
import { DRAFT_PERSONAS } from '../../src/data/draftPersonas';
import { ACHIEVEMENTS } from '../../src/meta/Achievements';
import { grantedDeckBuild } from '../../src/meta/Economy';
import { freshLimitedState } from '../../src/meta/Limited';
import type { SaveData } from '../../src/meta/SaveManager';
import {
  averageManaValue,
  buildDuelDigest,
  buildHeartbeat,
  buildSessionCards,
  cappedInt,
  cardCountBucket,
  collectionBucket,
  countBucket,
  curveBucket,
  deckArchetypeOf,
  deckColoursOf,
  GAUNTLET_RUNG_CAP,
  MULLIGAN_CAP,
  normalizeLang,
  renderScaleBucket,
  safeBuildStamp,
  SIGNAL_FIELDS,
  SIGNAL_SETTINGS_FIELDS,
  streakBucket,
  tallyCardsPlayed,
  tenthsBucket,
  turnsBucket,
  type CardTally,
  type DuelDeckInput,
  type DuelResultInput,
  type SignalEnv,
} from '../../src/meta/playSignals';
import { ACCOUNT_VALUES, RAW, SENTINEL, TINY_DB, richSave, signedInSave } from './playSignals.fixtures';

/**
 * These tests ARE the wave. playSignals is the only module whose output leaves
 * the device, so the assertions below are the privacy posture written down:
 * the key set equals the allowlist in both directions, nothing a player typed
 * survives, no raw count survives, and signing in changes nothing.
 */

const ENV: SignalEnv = {
  appVersion: '1.8.0',
  buildSha: 'a1b2c3d',
  platform: 'desktop',
  formFactor: 'tablet',
  lang: 'en-GB',
  reducedMotion: true,
};

const DECK: DuelDeckInput = {
  cards: ['fx-white-two', 'fx-blue-three'],
  landReserve: null,
  darlingId: null,
  db: TINY_DB,
};

const RESULT: DuelResultInput = {
  format: 'gauntlet',
  opponentId: AVATARS[0].id,
  difficulty: 'hard',
  result: 'win',
  turns: RAW.turns,
  mulligans: RAW.mulligans,
};

/** Every key name in a payload, however deeply nested. */
function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) allKeys(entry, out);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out.push(key);
      allKeys(child, out);
    }
  }
  return out;
}

function allPayloads(save: SaveData, tally: CardTally = { 'fx-black-five': 5 }): string {
  return JSON.stringify([
    buildHeartbeat(save, ENV),
    buildDuelDigest(RESULT, DECK, save),
    buildSessionCards(tally),
  ]);
}

// ---------------------------------------------------------------------------
// The allowlist is the contract
// ---------------------------------------------------------------------------

describe('playSignals allowlist', () => {
  it('the heartbeat key set EQUALS the allowlist, in both directions', () => {
    const payload = buildHeartbeat(richSave(), ENV);
    expect(Object.keys(payload).sort()).toEqual([...SIGNAL_FIELDS.heartbeat].sort());
    expect([...SIGNAL_FIELDS.heartbeat].sort()).toEqual(Object.keys(payload).sort());
  });

  it('the nested settings key set EQUALS the settings allowlist, in both directions', () => {
    const payload = buildHeartbeat(richSave(), ENV);
    expect(Object.keys(payload.settings).sort()).toEqual([...SIGNAL_SETTINGS_FIELDS].sort());
    expect([...SIGNAL_SETTINGS_FIELDS].sort()).toEqual(Object.keys(payload.settings).sort());
  });

  it('the duel key set EQUALS the allowlist, in both directions', () => {
    const payload = buildDuelDigest(RESULT, DECK, richSave());
    expect(Object.keys(payload).sort()).toEqual([...SIGNAL_FIELDS.duel].sort());
    expect([...SIGNAL_FIELDS.duel].sort()).toEqual(Object.keys(payload).sort());
  });

  it('every session card row key set EQUALS the allowlist, in both directions', () => {
    const rows = buildSessionCards({ 'fx-white-two': 1, 'fx-blue-three': 9 });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...SIGNAL_FIELDS.cards].sort());
      expect([...SIGNAL_FIELDS.cards].sort()).toEqual(Object.keys(row).sort());
    }
  });

  it('the allowlist is frozen, so nothing can widen it at runtime', () => {
    expect(Object.isFrozen(SIGNAL_FIELDS)).toBe(true);
    expect(Object.isFrozen(SIGNAL_FIELDS.heartbeat)).toBe(true);
    expect(Object.isFrozen(SIGNAL_FIELDS.duel)).toBe(true);
    expect(Object.isFrozen(SIGNAL_FIELDS.cards)).toBe(true);
    expect(Object.isFrozen(SIGNAL_SETTINGS_FIELDS)).toBe(true);
    expect(() => {
      (SIGNAL_FIELDS.duel as unknown as string[]).push('email');
    }).toThrow();
    expect(SIGNAL_FIELDS.duel).toHaveLength(10);
  });

  it('a stray key on a builder input cannot reach the payload', () => {
    const save = richSave();
    const dirty = { ...RESULT, deckName: SENTINEL, ip: '203.0.113.7' } as DuelResultInput;
    expect(Object.keys(buildDuelDigest(dirty, DECK, save))).toEqual([...SIGNAL_FIELDS.duel]);
    expect(JSON.stringify(buildDuelDigest(dirty, DECK, save))).not.toContain('203.0.113.7');
  });
});

// ---------------------------------------------------------------------------
// 100% allowlist coverage: every field set and read
// ---------------------------------------------------------------------------

describe('playSignals allowlist coverage', () => {
  function coverageSave(): SaveData {
    const save = richSave();
    save.achievements.unlocked = ACHIEVEMENTS.map((def) => def.id);
    save.gauntlet.bestRung = 7;
    return save;
  }

  it('every allowlisted heartbeat field is set by the input and read from the payload', () => {
    const expected = {
      appVersion: '1.8.0',
      buildSha: 'a1b2c3d',
      platform: 'desktop',
      formFactor: 'tablet',
      lang: 'en',
      settings: { animations: 'reduced', reducedMotion: true, renderScale: '1080p' },
      streakBucket: '30+',
      achievementsBucket: '1.0',
      winsBucket: '250+',
      packsBucket: '250+',
      collectionBucket: '1-24',
      tutorialDone: true,
      gauntletBestRung: 7,
    };
    // The expectation map itself is gated on the allowlist, so adding a field
    // without adding a test for it fails here rather than shipping untested.
    expect(Object.keys(expected).sort()).toEqual([...SIGNAL_FIELDS.heartbeat].sort());
    expect(Object.keys(expected.settings).sort()).toEqual([...SIGNAL_SETTINGS_FIELDS].sort());
    expect(buildHeartbeat(coverageSave(), ENV)).toEqual(expected);
  });

  it('every allowlisted duel field is set by the input and read from the payload', () => {
    const expected = {
      format: 'gauntlet',
      deckColours: 'WU',
      deckArchetype: 'custom',
      curveBucket: '2.5-2.9',
      deckSource: 'custom',
      opponentId: AVATARS[0].id,
      difficulty: 'hard',
      turnsBucket: '31+',
      result: 'win',
      mulligans: MULLIGAN_CAP,
    };
    expect(Object.keys(expected).sort()).toEqual([...SIGNAL_FIELDS.duel].sort());
    expect(buildDuelDigest(RESULT, DECK, coverageSave())).toEqual(expected);
  });

  it('every allowlisted session card field is set by the input and read from the payload', () => {
    const expected = { cardId: 'fx-black-five', countBucket: '4-7' };
    expect(Object.keys(expected).sort()).toEqual([...SIGNAL_FIELDS.cards].sort());
    expect(buildSessionCards({ 'fx-black-five': 5 })).toEqual([expected]);
  });
});

// ---------------------------------------------------------------------------
// Nothing a player typed survives
// ---------------------------------------------------------------------------

describe('playSignals carries nothing the player typed', () => {
  it('a sentinel deck name appears nowhere in any of the three events', () => {
    const save = richSave();
    expect(JSON.stringify(save)).toContain(SENTINEL); // the fixture really carries it
    expect(allPayloads(save)).not.toContain(SENTINEL);
  });

  it('a sentinel on every player-typeable string still appears nowhere', () => {
    const save = richSave();
    save.decks = save.decks.map((deck) => ({ ...deck, name: SENTINEL, id: `${deck.id}` }));
    save.deckRepairNoticeAck = JSON.stringify([SENTINEL]);
    expect(allPayloads(save)).not.toContain(SENTINEL);
  });

  it('the prohibition list never appears as a key name on any event', () => {
    const prohibited = new Set([
      'deckName',
      'name',
      'saveCode',
      'save',
      'replay',
      'replays',
      'ip',
      'ipAddress',
      'geo',
      'country',
      'region',
      'userAgent',
      'ua',
      'screen',
      'screenWidth',
      'screenHeight',
      'width',
      'height',
      'accountId',
      'account',
      'email',
      'jwt',
      'token',
      'deviceId',
      'installId',
      'userId',
      'id',
      'sessionId',
      'timestamp',
      'ts',
      'time',
      'sentAt',
      'createdAt',
      'day',
      'date',
    ]);
    const save = richSave();
    const keys = [
      ...allKeys(buildHeartbeat(save, ENV)),
      ...allKeys(buildDuelDigest(RESULT, DECK, save)),
      ...allKeys(buildSessionCards({ 'fx-white-two': 2 })),
    ];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(prohibited.has(key)).toBe(false);
  });

  it('no payload carries a timestamp: the server stamps the hour, the client sends none', () => {
    const save = richSave();
    const serialised = allPayloads(save);
    expect(serialised).not.toContain(String(save.createdAt));
    expect(serialised).not.toContain(save.daily.day);
    expect(serialised).not.toMatch(/\d{13}/); // no epoch-millisecond value anywhere
  });
});

// ---------------------------------------------------------------------------
// No raw counts escape
// ---------------------------------------------------------------------------

describe('playSignals emits buckets, never raw counts', () => {
  it("a rich fixture's distinctive raw numbers appear nowhere in the payloads", () => {
    const serialised = allPayloads(richSave());
    for (const raw of Object.values(RAW)) expect(serialised).not.toContain(String(raw));
  });

  it('streakBucket lands on both sides of every boundary', () => {
    const cases: [number, string][] = [
      [-5, '0'], [0, '0'], [1, '1'], [2, '2'], [3, '3'],
      [4, '4-6'], [6, '4-6'], [7, '7-13'], [13, '7-13'],
      [14, '14-29'], [29, '14-29'], [30, '30+'], [1e9, '30+'],
    ];
    for (const [value, label] of cases) expect(streakBucket(value)).toBe(label);
  });

  it('countBucket (wins and packs) lands on both sides of every boundary', () => {
    const cases: [number, string][] = [
      [-1, '0'], [0, '0'], [1, '1-4'], [4, '1-4'], [5, '5-9'], [9, '5-9'],
      [10, '10-24'], [24, '10-24'], [25, '25-49'], [49, '25-49'],
      [50, '50-99'], [99, '50-99'], [100, '100-249'], [249, '100-249'],
      [250, '250+'], [RAW.wins, '250+'],
    ];
    for (const [value, label] of cases) expect(countBucket(value)).toBe(label);
  });

  it('collectionBucket lands on both sides of every boundary', () => {
    const cases: [number, string][] = [
      [-3, '0'], [0, '0'], [1, '1-24'], [24, '1-24'], [25, '25-99'], [99, '25-99'],
      [100, '100-249'], [249, '100-249'], [250, '250-499'], [499, '250-499'],
      [500, '500-999'], [999, '500-999'], [1000, '1000+'], [1e6, '1000+'],
    ];
    for (const [value, label] of cases) expect(collectionBucket(value)).toBe(label);
  });

  it('tenthsBucket (achievement share) lands on both sides of every boundary', () => {
    expect(tenthsBucket(-1)).toBe('0.0');
    expect(tenthsBucket(0)).toBe('0.0');
    expect(tenthsBucket(0.0999)).toBe('0.0');
    for (let tenth = 1; tenth <= 9; tenth++) {
      expect(tenthsBucket(tenth / 10)).toBe(`0.${tenth}`);
      expect(tenthsBucket(tenth / 10 + 0.0999)).toBe(`0.${tenth}`);
      expect(tenthsBucket(tenth / 10 - 0.0001)).toBe(`0.${tenth - 1}`);
    }
    expect(tenthsBucket(0.9999)).toBe('0.9');
    expect(tenthsBucket(1)).toBe('1.0');
    expect(tenthsBucket(42)).toBe('1.0');
  });

  it('turnsBucket lands on both sides of every boundary', () => {
    const cases: [number, string][] = [
      [-1, '1-5'], [0, '1-5'], [1, '1-5'], [5, '1-5'], [6, '6-10'], [10, '6-10'],
      [11, '11-15'], [15, '11-15'], [16, '16-20'], [20, '16-20'],
      [21, '21-30'], [30, '21-30'], [31, '31+'], [1e5, '31+'],
    ];
    for (const [value, label] of cases) expect(turnsBucket(value)).toBe(label);
  });

  it('curveBucket lands on both sides of every boundary', () => {
    const cases: [number, string][] = [
      [-4, '<2.0'], [0, '<2.0'], [1.99, '<2.0'], [2, '2.0-2.4'], [2.49, '2.0-2.4'],
      [2.5, '2.5-2.9'], [2.99, '2.5-2.9'], [3, '3.0-3.4'], [3.49, '3.0-3.4'],
      [3.5, '3.5-3.9'], [3.99, '3.5-3.9'], [4, '4.0+'], [99, '4.0+'],
    ];
    for (const [value, label] of cases) expect(curveBucket(value)).toBe(label);
  });

  it('cardCountBucket lands on both sides of every boundary', () => {
    const cases: [number, string][] = [
      [0, '1'], [1, '1'], [2, '2-3'], [3, '2-3'], [4, '4-7'], [7, '4-7'], [8, '8+'], [500, '8+'],
    ];
    for (const [value, label] of cases) expect(cardCountBucket(value)).toBe(label);
  });

  it('every bucketing function is total: NaN, Infinity, absent and fractional all land', () => {
    const odd: unknown[] = [NaN, Infinity, -Infinity, undefined, null, '17', {}, [], 0.5, -0.5, 1e308];
    const buckets = [streakBucket, countBucket, collectionBucket, turnsBucket, curveBucket, cardCountBucket, tenthsBucket];
    for (const bucket of buckets) {
      for (const value of odd) {
        const label = bucket(value);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    }
    expect(renderScaleBucket(3)).toBe('other');
    expect(renderScaleBucket(undefined)).toBe('other');
    expect(renderScaleBucket(1)).toBe('720p');
    expect(renderScaleBucket(1.5)).toBe('1080p');
    expect(renderScaleBucket(2)).toBe('1440p');
  });

  it('cappedInt clamps rather than reporting the raw number', () => {
    expect(cappedInt(RAW.mulligans, MULLIGAN_CAP)).toBe(MULLIGAN_CAP);
    expect(cappedInt(-9, MULLIGAN_CAP)).toBe(0);
    expect(cappedInt(2.9, MULLIGAN_CAP)).toBe(2);
    expect(cappedInt(NaN, MULLIGAN_CAP)).toBe(0);
    expect(cappedInt(undefined, GAUNTLET_RUNG_CAP)).toBe(0);
    expect(cappedInt(RAW.bestRung, GAUNTLET_RUNG_CAP)).toBe(GAUNTLET_RUNG_CAP);
  });

  it('the gauntlet rung cap is a real small int taken from our own roster', () => {
    expect(GAUNTLET_RUNG_CAP).toBeGreaterThan(0);
    expect(GAUNTLET_RUNG_CAP).toBeLessThanOrEqual(64);
    expect(Number.isInteger(GAUNTLET_RUNG_CAP)).toBe(true);
  });

  it('the collection bucket counts distinct cards owned, never the copies held', () => {
    const save = richSave();
    save.collection = Object.fromEntries(
      Array.from({ length: 300 }, (_, index) => [`fx-card-${index}`, RAW.collectionCopies]),
    );
    expect(buildHeartbeat(save, ENV).collectionBucket).toBe('250-499');
    save.collection = { a: 0, b: 0 };
    expect(buildHeartbeat(save, ENV).collectionBucket).toBe('0');
  });

  it('the achievement share counts only ids we still define', () => {
    const save = richSave();
    save.achievements.unlocked = ['ach-that-no-longer-exists', 'another-ghost'];
    expect(buildHeartbeat(save, ENV).achievementsBucket).toBe('0.0');
    const half = Math.floor(ACHIEVEMENTS.length / 2);
    save.achievements.unlocked = ACHIEVEMENTS.slice(0, half).map((def) => def.id);
    expect(buildHeartbeat(save, ENV).achievementsBucket).toBe(tenthsBucket(half / ACHIEVEMENTS.length));
  });
});

// ---------------------------------------------------------------------------
// Cards live apart from decks and duels
// ---------------------------------------------------------------------------

describe('playSignals keeps cards unjoinable', () => {
  const knownIds = ['fx-white-two', 'fx-blue-three', 'fx-black-five', 'fx-green-four'];

  it('the duel digest carries no card id at all', () => {
    const deck: DuelDeckInput = { cards: knownIds, landReserve: ['land-plains'], darlingId: 'fx-red-one', db: TINY_DB };
    const serialised = JSON.stringify(buildDuelDigest(RESULT, deck, richSave()));
    for (const id of [...knownIds, 'land-plains', 'fx-red-one']) expect(serialised).not.toContain(id);
  });

  it('session card rows carry no deck reference, no duel reference, no order and no time', () => {
    const deck: DuelDeckInput = { cards: knownIds, landReserve: null, darlingId: null, db: TINY_DB };
    const digest = buildDuelDigest(RESULT, deck, richSave());
    const rows = buildSessionCards({ 'fx-black-five': 2, 'fx-white-two': 1 });
    const serialised = JSON.stringify(rows);
    expect(serialised).not.toContain(digest.deckArchetype);
    expect(serialised).not.toContain(digest.opponentId);
    expect(serialised).not.toContain('deck');
    expect(serialised).not.toContain('duel');
    expect(serialised).not.toContain('order');
    expect(serialised).not.toContain('index');
    expect(allKeys(rows).sort()).toEqual(['cardId', 'cardId', 'countBucket', 'countBucket']);
  });

  it('rows are sorted by card id, so the batch never encodes the order of play', () => {
    let tally: CardTally = {};
    tally = tallyCardsPlayed(tally, ['fx-green-four', 'fx-black-five', 'fx-white-two'], TINY_DB);
    tally = tallyCardsPlayed(tally, ['fx-white-two', 'fx-blue-three'], TINY_DB);
    const forwards = buildSessionCards(tally).map((row) => row.cardId);

    let reversed: CardTally = {};
    reversed = tallyCardsPlayed(reversed, ['fx-blue-third-missing', 'fx-blue-three'], TINY_DB);
    reversed = tallyCardsPlayed(reversed, ['fx-white-two', 'fx-white-two', 'fx-black-five', 'fx-green-four'], TINY_DB);
    const backwards = buildSessionCards(reversed).map((row) => row.cardId);

    expect(forwards).toEqual([...forwards].sort());
    expect(backwards).toEqual(forwards);
  });

  it('tokens, basic lands and unknown ids never enter the tally', () => {
    const tally = tallyCardsPlayed({}, ['fx-token-bear', 'land-plains', 'land-island', 'no-such-card', 'fx-red-one'], TINY_DB);
    expect(Object.keys(tally)).toEqual(['fx-red-one']);
    expect(buildSessionCards(tally)).toEqual([{ cardId: 'fx-red-one', countBucket: '1' }]);
  });

  it('a basic land that somehow reached a tally is still dropped at build time', () => {
    expect(buildSessionCards({ 'land-plains': 12, 'fx-red-one': 1 })).toEqual([
      { cardId: 'fx-red-one', countBucket: '1' },
    ]);
  });

  it('tallyCardsPlayed is a pure reducer: the input tally is never mutated', () => {
    const before: CardTally = { 'fx-red-one': 1 };
    const after = tallyCardsPlayed(before, ['fx-red-one', 'fx-blue-three'], TINY_DB);
    expect(before).toEqual({ 'fx-red-one': 1 });
    expect(after).toEqual({ 'fx-red-one': 2, 'fx-blue-three': 1 });
  });
});

// ---------------------------------------------------------------------------
// Deck identity: ours, never the player's
// ---------------------------------------------------------------------------

describe('playSignals deck identity', () => {
  it('an unmodified precon reports the precon id and deckSource precon', () => {
    const list = STARTER_DECKS[0];
    const deck: DuelDeckInput = { cards: list.cards, landReserve: null, darlingId: null, db: TINY_DB };
    expect(deckArchetypeOf(deck)).toBe(list.id);
    const digest = buildDuelDigest({ ...RESULT, format: 'constructed' }, deck, richSave());
    expect(digest.deckArchetype).toBe(list.id);
    expect(digest.deckSource).toBe('precon');
  });

  it('the reserve-native build of a theme precon matches too', () => {
    const list = THEME_DECKS.find((entry) => entry.reserveCards && entry.landReserve);
    expect(list).toBeDefined();
    const deck: DuelDeckInput = {
      cards: list!.reserveCards!,
      landReserve: list!.landReserve!,
      darlingId: null,
      db: TINY_DB,
    };
    expect(deckArchetypeOf(deck)).toBe(list!.id);
  });

  it('a Darlings precon matches on its cards, its reserve and its Darling', () => {
    const precon = DARLINGS_PRECONS[0];
    const deck: DuelDeckInput = {
      cards: precon.cards,
      landReserve: precon.landReserve,
      darlingId: precon.darlingId,
      db: TINY_DB,
    };
    expect(deckArchetypeOf(deck)).toBe(precon.id);
    const digest = buildDuelDigest({ ...RESULT, format: 'darlings' }, deck, richSave());
    expect(digest.deckArchetype).toBe(precon.id);
    expect(digest.deckSource).toBe('precon');
  });

  it('every shape grantedDeckBuild actually hands a player is recognised as a precon', () => {
    const products = [...STARTER_DECKS, ...THEME_DECKS];
    for (const list of products) {
      for (const classicRetired of [true, false]) {
        const build = grantedDeckBuild(list, classicRetired);
        expect(
          deckArchetypeOf({ cards: build.cards, landReserve: build.landReserve, darlingId: build.darlingId, db: TINY_DB }),
        ).toBe(list.id);
      }
    }
    for (const precon of DARLINGS_PRECONS) {
      const build = grantedDeckBuild(precon);
      expect(
        deckArchetypeOf({ cards: build.cards, landReserve: build.landReserve, darlingId: build.darlingId, db: TINY_DB }),
      ).toBe(precon.id);
    }
  });

  it('one swapped card makes a precon custom', () => {
    const list = STARTER_DECKS[0];
    const edited = [...list.cards.slice(1), 'fx-red-one'];
    const deck: DuelDeckInput = { cards: edited, landReserve: null, darlingId: null, db: TINY_DB };
    expect(deckArchetypeOf(deck)).toBe('custom');
    expect(buildDuelDigest(RESULT, deck, richSave()).deckSource).toBe('custom');
  });

  it('a Limited duel with a live draft run reports drafted and never a precon id', () => {
    const save = richSave();
    save.limited = { ...freshLimitedState(), premiumWeek: { week: 0, entries: 0 } };
    const list = STARTER_DECKS[0];
    const deck: DuelDeckInput = { cards: list.cards, landReserve: null, darlingId: null, db: TINY_DB };

    const withoutRun = buildDuelDigest({ ...RESULT, format: 'limited' }, deck, save);
    expect(withoutRun.deckSource).toBe('precon');

    save.limited.activeRun = { mode: 'draft' } as unknown as typeof save.limited.activeRun;
    const withRun = buildDuelDigest({ ...RESULT, format: 'limited' }, deck, save);
    expect(withRun.deckSource).toBe('drafted');
    expect(withRun.deckArchetype).toBe('custom');
  });

  it('colour identity is WUBRG-ordered, ignores lands, and counts the Darling', () => {
    expect(deckColoursOf({ cards: ['fx-green-four', 'fx-white-two'], landReserve: null, darlingId: null, db: TINY_DB })).toBe('WG');
    expect(deckColoursOf({ cards: ['fx-black-five', 'fx-red-one', 'fx-blue-three'], landReserve: null, darlingId: null, db: TINY_DB })).toBe('UBR');
    expect(deckColoursOf({ cards: ['land-plains', 'fx-dual-land'], landReserve: null, darlingId: null, db: TINY_DB })).toBe('C');
    expect(deckColoursOf({ cards: ['fx-colourless-six'], landReserve: null, darlingId: 'fx-red-one', db: TINY_DB })).toBe('R');
  });

  it('the curve is the mean mana value of nonland cards, and an empty deck is defined', () => {
    expect(averageManaValue({ cards: ['fx-white-two', 'fx-blue-three'], landReserve: null, darlingId: null, db: TINY_DB })).toBeCloseTo(2.5, 10);
    expect(averageManaValue({ cards: ['land-plains', 'land-island'], landReserve: null, darlingId: null, db: TINY_DB })).toBe(0);
    expect(averageManaValue({ cards: [], landReserve: null, darlingId: null, db: TINY_DB })).toBe(0);
    expect(curveBucket(averageManaValue({ cards: [], landReserve: null, darlingId: null, db: TINY_DB }))).toBe('<2.0');
  });

  it('an opponent id that is not one of ours is replaced, and our own survive', () => {
    const save = richSave();
    const rogue = buildDuelDigest({ ...RESULT, opponentId: SENTINEL }, DECK, save);
    expect(rogue.opponentId).toBe('unknown');
    expect(buildDuelDigest({ ...RESULT, opponentId: AVATARS[0].id }, DECK, save).opponentId).toBe(AVATARS[0].id);
    const persona = DRAFT_PERSONAS[0].id;
    expect(buildDuelDigest({ ...RESULT, opponentId: persona }, DECK, save).opponentId).toBe(persona);
  });

  it('out-of-vocabulary enums fall back rather than forwarding the value', () => {
    const save = richSave();
    const dirty = {
      ...RESULT,
      format: SENTINEL as unknown as DuelResultInput['format'],
      difficulty: SENTINEL as unknown as DuelResultInput['difficulty'],
      result: SENTINEL as unknown as DuelResultInput['result'],
    };
    const digest = buildDuelDigest(dirty, DECK, save);
    expect(digest.format).toBe('constructed');
    expect(digest.difficulty).toBe('medium');
    expect(digest.result).toBe('draw');
    expect(JSON.stringify(digest)).not.toContain(SENTINEL);
  });

  it('the language tag keeps only the primary subtag', () => {
    expect(normalizeLang('en-GB')).toBe('en');
    expect(normalizeLang('pt_BR')).toBe('pt');
    expect(normalizeLang('EN')).toBe('en');
    expect(normalizeLang('en-Latn-GB-oxendict')).toBe('en');
    expect(normalizeLang('')).toBe('xx');
    expect(normalizeLang(undefined)).toBe('xx');
    expect(normalizeLang('zxx-something')).toBe('xx');
    expect(normalizeLang(SENTINEL)).toBe('xx');
  });

  it('build stamps are narrowed to a safe charset and a bounded length', () => {
    expect(safeBuildStamp('1.8.0-rc.1')).toBe('1.8.0-rc.1');
    expect(safeBuildStamp('a1b2c3d')).toBe('a1b2c3d');
    expect(safeBuildStamp('dev build (local) <user>')).toBe('devbuildlocaluser');
    expect(safeBuildStamp('x'.repeat(500))).toHaveLength(40);
    expect(safeBuildStamp(undefined)).toBe('');
  });

  it('an out-of-vocabulary platform, form factor or animation tier falls back', () => {
    const save = richSave();
    const dirty = {
      ...ENV,
      platform: SENTINEL as unknown as SignalEnv['platform'],
      formFactor: SENTINEL as unknown as SignalEnv['formFactor'],
    };
    save.settings.animations = SENTINEL as unknown as SaveData['settings']['animations'];
    const payload = buildHeartbeat(save, dirty);
    expect(payload.platform).toBe('web');
    expect(payload.formFactor).toBe('desktop');
    expect(payload.settings.animations).toBe('full');
    expect(JSON.stringify(payload)).not.toContain(SENTINEL);
  });
});

// ---------------------------------------------------------------------------
// Signing in changes nothing, and the output is deterministic
// ---------------------------------------------------------------------------

describe('playSignals unlinkability and determinism', () => {
  it('signed-in and signed-out inputs produce BYTE-IDENTICAL output', () => {
    const out = richSave();
    const inn = signedInSave();
    expect(JSON.stringify(inn)).toContain(ACCOUNT_VALUES.email); // the fixture really is signed in
    expect(allPayloads(inn)).toBe(allPayloads(out));
  });

  it('no account id, email, token or device id appears in any payload', () => {
    const serialised = allPayloads(signedInSave());
    for (const value of Object.values(ACCOUNT_VALUES)) expect(serialised).not.toContain(value);
  });

  it('the same inputs give byte-identical JSON across repeated calls', () => {
    const save = richSave();
    const once = allPayloads(save);
    for (let attempt = 0; attempt < 5; attempt++) expect(allPayloads(save)).toBe(once);
  });

  it('key order is stable and equals the allowlist order', () => {
    const save = richSave();
    expect(Object.keys(buildHeartbeat(save, ENV))).toEqual([...SIGNAL_FIELDS.heartbeat]);
    expect(Object.keys(buildHeartbeat(save, ENV).settings)).toEqual([...SIGNAL_SETTINGS_FIELDS]);
    expect(Object.keys(buildDuelDigest(RESULT, DECK, save))).toEqual([...SIGNAL_FIELDS.duel]);
    expect(Object.keys(buildSessionCards({ 'fx-red-one': 1 })[0])).toEqual([...SIGNAL_FIELDS.cards]);
  });

  it('a save built at a different moment produces the same payloads', () => {
    const early = richSave();
    const late = richSave();
    late.createdAt = early.createdAt + 86_400_000;
    late.daily.day = '2099-12-31';
    late.stats.lastWinDay = '2099-12-31';
    expect(allPayloads(late)).toBe(allPayloads(early));
  });
});

// ---------------------------------------------------------------------------
// Purity guard
// ---------------------------------------------------------------------------

describe('playSignals purity guard', () => {
  const source = readFileSync(fileURLToPath(new URL('../../src/meta/playSignals.ts', import.meta.url)), 'utf8');

  it('imports nothing from scenes, ui, net, platform, version or Phaser', () => {
    const forbidden = [
      /from\s+'phaser'/,
      /from\s+"[^"]*phaser/,
      /from\s+'[^']*\/scenes\//,
      /from\s+'[^']*\/ui\//,
      /from\s+'[^']*\/net\//,
      /from\s+'[^']*\/platform\//,
      /from\s+'[^']*\/version'/,
      /from\s+'[^']*\/audio\//,
      /from\s+'[^']*\/art\//,
    ];
    for (const pattern of forbidden) expect(source).not.toMatch(pattern);
  });

  it('names no browser API, no clock and no randomness', () => {
    const forbidden = [
      /\bfetch\b/,
      /\bnavigator\b/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bindexedDB\b/,
      /\bsendBeacon\b/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
      /\bDate\.now\b/,
      /\bnew Date\b/,
      /\bMath\.random\b/,
      /\bperformance\.now\b/,
    ];
    for (const pattern of forbidden) expect(source).not.toMatch(pattern);
  });

  it('contains no network transport of any kind', () => {
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/\bimport\s*\(/);
  });
});
