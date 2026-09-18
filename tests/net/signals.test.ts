import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import {
  buildDuelDigest,
  buildSessionCards,
  SIGNAL_FIELDS,
  tallyCardsPlayed,
} from '../../src/meta/playSignals';
import { Services } from '../../src/meta/services';
import { STATS_NOTICE_VERSION } from '../../src/meta/statsNotice';
import {
  resetSignalsLaunchStateForTest,
  SESSION_CARD_ROW_CAP,
  signals,
  signalsLaunchStateForTest,
  type DuelFinishedInput,
} from '../../src/net/signals';
import {
  DRY_RUN_PREFIX,
  resetKeepaliveProbeForTest,
  setSignalsTestEndpoint,
  SIGNALS_ENDPOINT,
} from '../../src/net/signalsClient';

/**
 * The client's whole job is what it does NOT do, so every test here runs with a
 * spy where the network is and counts calls. Vitest always runs with
 * `import.meta.env.DEV` true, so the suite installs the test endpoint override
 * (the only thing that lifts the dev-build suppressor) whenever it wants to
 * exercise the real send path.
 */
const TEST_ENDPOINT = 'https://signals.test/v1/signals';

let fetchSpy: MockInstance;
let beaconSpy: MockInstance;

/** Every card id the tally would accept: no basic land, no token. */
function reportableCardIds(): string[] {
  return Object.keys(CARD_DB).filter((id) => {
    const card = CARD_DB[id];
    return card !== undefined && card.token !== true && !(card.supertypes?.includes('basic') ?? false);
  });
}

/** Reportable cards from the starter list: no basic land, no token. */
const PLAYED: string[] = STARTER_DECKS[0].cards.filter((id) => {
  const card = CARD_DB[id];
  return card !== undefined && card.token !== true && !(card.supertypes?.includes('basic') ?? false);
});

/** The deck and result a duel digest is built from; one real starter list. */
const DECK = {
  cards: STARTER_DECKS[0].cards,
  landReserve: null,
  darlingId: null,
  savedFormat: 'warchest' as const,
};

function duelInput(over: Partial<DuelFinishedInput> = {}): DuelFinishedInput {
  return {
    deck: DECK,
    limited: false,
    gauntlet: false,
    opponentId: AVATARS[0].id,
    difficulty: 'medium',
    winner: 0,
    reason: 'life',
    turns: 9,
    mulligans: 1,
    save: Services.save.data,
    ...over,
  };
}

/** Bodies the spy saw, in order, parsed. */
function bodies(): unknown[] {
  return fetchSpy.mock.calls.map((call) => JSON.parse((call[1] as RequestInit).body as string));
}

function rawBodies(): string[] {
  return fetchSpy.mock.calls.map((call) => (call[1] as RequestInit).body as string);
}

function urls(): string[] {
  return fetchSpy.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  resetSignalsLaunchStateForTest();
  resetKeepaliveProbeForTest();
  setSignalsTestEndpoint(TEST_ENDPOINT);
  fetchSpy = vi.fn(() => Promise.resolve({ ok: true, status: 204 })) as unknown as MockInstance;
  beaconSpy = vi.fn(() => true) as unknown as MockInstance;
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('navigator', { sendBeacon: beaconSpy });
  const settings = Services.save.data.settings;
  settings.shareAnonStats = true;
  settings.statsNoticeVersion = STATS_NOTICE_VERSION;
});

afterEach(() => {
  setSignalsTestEndpoint(null);
  resetSignalsLaunchStateForTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('the closed gate sends nothing at all', () => {
  const closers: [string, () => void][] = [
    ['the toggle off', (): void => void (Services.save.data.settings.shareAnonStats = false)],
    [
      'a notice the player has not seen',
      (): void => void (Services.save.data.settings.statsNoticeVersion = STATS_NOTICE_VERSION - 1),
    ],
    [
      'Do Not Track',
      (): void => {
        vi.stubGlobal('navigator', { sendBeacon: beaconSpy, doNotTrack: '1' });
      },
    ],
    [
      'Global Privacy Control',
      (): void => {
        vi.stubGlobal('navigator', { sendBeacon: beaconSpy, globalPrivacyControl: true });
      },
    ],
    [
      '?telemetry=off',
      (): void => {
        vi.stubGlobal('window', { location: { search: '?telemetry=off' } });
      },
    ],
  ];

  for (const [name, close] of closers) {
    it(`${name}: zero calls across start, a duel, cards and session end`, () => {
      close();
      signals.start();
      signals.cardsPlayed([PLAYED[0]]);
      signals.duelFinished(duelInput());
      signals.cardsPlayed([PLAYED[1]]);
      signals.sessionEnding();
      expect(fetchSpy).toHaveBeenCalledTimes(0);
      expect(beaconSpy).toHaveBeenCalledTimes(0);
      // Nor did anything accumulate in memory that a later toggle-on could send.
      expect(signalsLaunchStateForTest().tally).toEqual({});
      expect(signalsLaunchStateForTest().duels).toBe(0);
    });
  }

  it('the toggle flipped off mid-session stops the very next send', () => {
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    Services.save.data.settings.shareAnonStats = false;
    signals.duelFinished(duelInput());
    signals.cardsPlayed(['x']);
    signals.sessionEnding();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still only the heartbeat
    expect(beaconSpy).toHaveBeenCalledTimes(0);
  });

  it('the toggle flipped back on sends again, with no restart', () => {
    Services.save.data.settings.shareAnonStats = false;
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    Services.save.data.settings.shareAnonStats = true;
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------

describe('the heartbeat', () => {
  it('goes out at most once per launch, however many callers ask', () => {
    signals.start();
    signals.noticeAcknowledged();
    signals.start();
    signals.noticeAcknowledged();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(urls()[0]).toBe(`${TEST_ENDPOINT}?e=heartbeat`);
  });

  it('a start() the gate refused does not consume the launch heartbeat', () => {
    // The consent flow: boot is blocked by the pending notice, the UI stamps
    // the version, and noticeAcknowledged() then sends the heartbeat that boot
    // could not. Policy section 8: nothing before the notice, everything after.
    Services.save.data.settings.statsNoticeVersion = STATS_NOTICE_VERSION - 1;
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    Services.save.data.settings.statsNoticeVersion = STATS_NOTICE_VERSION;
    signals.noticeAcknowledged();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    signals.noticeAcknowledged();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('carries exactly the allowlist, in allowlist order, and nothing more', () => {
    signals.start();
    const payload = bodies()[0] as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual([...SIGNAL_FIELDS.heartbeat]);
    // No envelope of any kind: no type discriminator, no schema version, no
    // session id, no sequence number, no timestamp.
    for (const forbidden of ['type', 'v', 'ts', 'timestamp', 'session', 'sessionId', 'seq', 'id']) {
      expect(payload).not.toHaveProperty(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------

describe('the request itself', () => {
  it('carries no credentials, no Authorization and no cookie', () => {
    signals.start();
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('omit');
    expect(init.mode).toBe('cors');
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers)).toEqual(['content-type']);
    expect(headers['content-type']).toBe('application/json');
    for (const key of Object.keys(headers)) {
      expect(key.toLowerCase()).not.toBe('authorization');
      expect(key.toLowerCase()).not.toBe('cookie');
    }
  });

  it('posts to the documented endpoint when no test override is installed', () => {
    // The constant is in the privacy policy too, so it is pinned here.
    expect(SIGNALS_ENDPOINT).toBe('https://db-signals.loominvanta.workers.dev/v1/signals');
  });

  it('is byte-identical to the pure builder output — the client adds nothing', () => {
    const input = duelInput();
    signals.duelFinished(input);
    const expected = JSON.stringify(
      buildDuelDigest(
        {
          format: 'warchest',
          opponentId: AVATARS[0].id,
          difficulty: 'medium',
          result: 'win',
          turns: 9,
          mulligans: 1,
        },
        { cards: DECK.cards, landReserve: null, darlingId: null, db: CARD_DB },
        Services.save.data,
      ),
    );
    expect(rawBodies()[0]).toBe(expected);
  });

  it('the session batch is byte-identical to buildSessionCards', () => {
    const played = [PLAYED[0], PLAYED[0], PLAYED[1]];
    signals.duelFinished(duelInput());
    signals.cardsPlayed(played);
    signals.sessionEnding();
    const expected = JSON.stringify(buildSessionCards(tallyCardsPlayed({}, played, CARD_DB), 1));
    expect(rawBodies()[1]).toBe(expected);
    expect(urls()[1]).toBe(`${TEST_ENDPOINT}?e=cards`);
  });
});

// ---------------------------------------------------------------------------

describe('failures never reach the game', () => {
  it('a rejected fetch is swallowed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    expect(() => signals.start()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('a 429 is ignored, never read and never retried', () => {
    const spy = vi.fn(() => Promise.resolve({ ok: false, status: 429 }));
    vi.stubGlobal('fetch', spy);
    expect(() => signals.start()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    signals.start();
    expect(spy).toHaveBeenCalledTimes(1); // the launch heartbeat was spent, not retried
  });

  it('a fetch that throws synchronously is swallowed', () => {
    vi.stubGlobal('fetch', () => {
      throw new TypeError('blocked by extension');
    });
    expect(() => signals.start()).not.toThrow();
    expect(() => signals.duelFinished(duelInput())).not.toThrow();
  });

  it('a missing fetch and a missing sendBeacon are both survivable', () => {
    vi.stubGlobal('fetch', undefined);
    vi.stubGlobal('navigator', {});
    expect(() => signals.start()).not.toThrow();
    signals.duelFinished(duelInput());
    signals.cardsPlayed([PLAYED[0]]);
    expect(() => signals.sessionEnding()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('session end', () => {
  it('sends once even if pagehide and visibilitychange both fire', () => {
    signals.duelFinished(duelInput());
    signals.cardsPlayed([PLAYED[0]]);
    const before = fetchSpy.mock.calls.length;
    signals.sessionEnding();
    signals.sessionEnding();
    signals.sessionEnding();
    expect(fetchSpy.mock.calls.length - before).toBe(1);
  });

  it('sends nothing when no card was played', () => {
    signals.duelFinished(duelInput());
    const before = fetchSpy.mock.calls.length;
    signals.sessionEnding();
    expect(fetchSpy.mock.calls.length - before).toBe(0);
    expect(beaconSpy).toHaveBeenCalledTimes(0);
  });

  it('never builds a batch the endpoint would reject for size', () => {
    // The Worker rejects an over-cap batch with a 400 rather than truncating
    // it, so a long session must lose its tail instead of its whole batch.
    const many = reportableCardIds().slice(0, SESSION_CARD_ROW_CAP + 40);
    expect(many.length).toBeGreaterThan(SESSION_CARD_ROW_CAP);
    for (const cardId of many) signals.cardsPlayed([cardId]);
    expect(Object.keys(signalsLaunchStateForTest().tally).length).toBe(SESSION_CARD_ROW_CAP);
    signals.duelFinished(duelInput());
    signals.sessionEnding();
    const rows = JSON.parse(rawBodies()[1]) as unknown[];
    expect(rows.length).toBe(SESSION_CARD_ROW_CAP);
  });

  it('keeps counting a card already in a full tally', () => {
    const many = reportableCardIds().slice(0, SESSION_CARD_ROW_CAP);
    for (const cardId of many) signals.cardsPlayed([cardId]);
    const first = many[0];
    signals.cardsPlayed([first, first, first]);
    expect(signalsLaunchStateForTest().tally[first]).toBe(4);
    expect(Object.keys(signalsLaunchStateForTest().tally).length).toBe(SESSION_CARD_ROW_CAP);
  });

  it('leaves the tally and the duel counter empty', () => {
    signals.duelFinished(duelInput());
    signals.cardsPlayed([PLAYED[0]]);
    expect(Object.keys(signalsLaunchStateForTest().tally).length).toBeGreaterThan(0);
    expect(signalsLaunchStateForTest().duels).toBe(1);
    signals.sessionEnding();
    expect(signalsLaunchStateForTest().tally).toEqual({});
    expect(signalsLaunchStateForTest().duels).toBe(0);
  });

  it('falls back to sendBeacon only when fetch keepalive is unavailable', () => {
    class NoKeepaliveRequest {}
    vi.stubGlobal('Request', NoKeepaliveRequest);
    resetKeepaliveProbeForTest();
    signals.duelFinished(duelInput());
    signals.cardsPlayed([PLAYED[0]]);
    const fetchCalls = fetchSpy.mock.calls.length;
    signals.sessionEnding();
    expect(beaconSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls.length).toBe(fetchCalls); // the duel digest still went by fetch
    expect(String(beaconSpy.mock.calls[0][0])).toBe(`${TEST_ENDPOINT}?e=cards`);
  });
});

// ---------------------------------------------------------------------------

describe('the duel digest vocabulary', () => {
  it('maps all three saved deck-format spellings', () => {
    const cases: [DuelFinishedInput['deck']['savedFormat'], string][] = [
      ['constructed', 'warchest'],
      ['warchest', 'warchest'],
      ['darlings', 'darlings'],
      [null, 'warchest'],
    ];
    for (const [savedFormat, expected] of cases) {
      resetSignalsLaunchStateForTest();
      fetchSpy.mockClear();
      signals.duelFinished(duelInput({ deck: { ...DECK, savedFormat } }));
      expect((bodies()[0] as { format: string }).format).toBe(expected);
    }
  });

  it('a gauntlet rung and a Limited match name their own format', () => {
    signals.duelFinished(duelInput({ gauntlet: true }));
    expect((bodies()[0] as { format: string }).format).toBe('gauntlet');
    fetchSpy.mockClear();
    signals.duelFinished(duelInput({ limited: true, deck: { ...DECK, savedFormat: null } }));
    expect((bodies()[0] as { format: string }).format).toBe('limited');
  });

  it('classifies every engine reason, and only a human concede as concede', () => {
    // src/engine/phases.ts endGame(): the reason vocabulary is exactly these four.
    const cases: [DuelFinishedInput['winner'], string, string][] = [
      [0, 'life', 'win'],
      [0, 'deck', 'win'],
      [0, 'concede', 'win'], // the AI conceded; the human won
      [1, 'life', 'loss'],
      [1, 'deck', 'loss'],
      [1, 'concede', 'concede'], // the human conceded
      ['draw', 'turnLimit', 'draw'],
      ['draw', 'life', 'draw'],
      [null, 'life', 'draw'], // never observed; malformed reads as a draw
    ];
    for (const [winner, reason, expected] of cases) {
      resetSignalsLaunchStateForTest();
      fetchSpy.mockClear();
      signals.duelFinished(duelInput({ winner, reason }));
      expect((bodies()[0] as { result: string }).result).toBe(expected);
    }
  });

  it('counts a duel only when its digest actually went out', () => {
    Services.save.data.settings.shareAnonStats = false;
    signals.duelFinished(duelInput());
    expect(signalsLaunchStateForTest().duels).toBe(0);
    Services.save.data.settings.shareAnonStats = true;
    signals.duelFinished(duelInput());
    expect(signalsLaunchStateForTest().duels).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('the dev build', () => {
  it('logs the exact payload it would have sent and sends nothing', () => {
    setSignalsTestEndpoint(null); // IS_DEV is true under Vitest, so the gate now says devBuild
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(beaconSpy).toHaveBeenCalledTimes(0);
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0][0]).toBe(DRY_RUN_PREFIX);
    expect(debug.mock.calls[0][1]).toBe('heartbeat');
    const logged = JSON.parse(debug.mock.calls[0][2] as string) as Record<string, unknown>;
    expect(Object.keys(logged)).toEqual([...SIGNAL_FIELDS.heartbeat]);
  });

  it('logs nothing at all when a real suppressor is also on', () => {
    setSignalsTestEndpoint(null);
    Services.save.data.settings.shareAnonStats = false;
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    signals.start();
    signals.duelFinished(duelInput());
    signals.cardsPlayed([PLAYED[0]]);
    signals.sessionEnding();
    expect(debug).toHaveBeenCalledTimes(0);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});
