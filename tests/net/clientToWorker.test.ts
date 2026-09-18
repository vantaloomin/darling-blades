import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { Services } from '../../src/meta/services';
import { STATS_NOTICE_VERSION } from '../../src/meta/statsNotice';
import {
  resetSignalsLaunchStateForTest,
  SESSION_CARD_ROW_CAP,
  signals,
  type DuelFinishedInput,
} from '../../src/net/signals';
import { resetKeepaliveProbeForTest, setSignalsTestEndpoint, SIGNALS_ENDPOINT } from '../../src/net/signalsClient';
import type { DataPoint, Env, KvLike } from '../../worker/src/index';
import worker, { resetSaltCacheForTests } from '../../worker/src/index';

/**
 * The two halves of the transport, run against each other.
 *
 * The client and the Worker were built by separate agents in separate
 * worktrees and agreed their wire format by message. Each is held to the pure
 * builders by its own suite, but neither suite ever pointed the REAL client at
 * the REAL handler. This file does: the client's `fetch` is replaced by a shim
 * that turns exactly what the client passed into a `Request` and hands it to
 * the Worker's own `fetch`. If the URL, the query, the content type, the body
 * shape or the batch size drift on either side, this is what goes red.
 *
 * Nothing here touches the network. The Worker's bindings are in-memory fakes.
 */

const ORIGIN = 'https://vantaloomin.github.io';

class FakeKv implements KvLike {
  readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

class FakeSink {
  readonly points: DataPoint[] = [];
  writeDataPoint(point: DataPoint): void {
    this.points.push(JSON.parse(JSON.stringify(point)) as DataPoint);
  }
}

let sink: FakeSink;
let env: Env;
let responses: Array<Promise<Response>>;
let requests: Array<{ url: string; contentType: string | null; credentials: unknown; body: string }>;

/** Everything the client dispatched, settled, as status codes. */
async function statuses(): Promise<number[]> {
  return Promise.all(responses.map(async (pending) => (await pending).status));
}

function reportableCardIds(): string[] {
  return Object.keys(CARD_DB)
    .filter((id) => {
      const card = CARD_DB[id];
      return card.token !== true && !(card.supertypes?.includes('basic') ?? false);
    })
    .sort();
}

function duelInput(over: Partial<DuelFinishedInput> = {}): DuelFinishedInput {
  return {
    deck: { cards: STARTER_DECKS[0].cards, landReserve: null, darlingId: null, savedFormat: 'warchest' },
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

beforeEach(() => {
  resetSignalsLaunchStateForTest();
  resetKeepaliveProbeForTest();
  resetSaltCacheForTests();
  // The REAL endpoint constant, installed as the override only because that is
  // what lifts the dev-build suppressor under Vitest. The URL the Worker sees is
  // therefore exactly the production one.
  setSignalsTestEndpoint(SIGNALS_ENDPOINT);
  sink = new FakeSink();
  env = {
    SIGNALS: sink,
    SALT_KV: new FakeKv(),
    SIGNALS_RATE_LIMIT: { limit: async () => ({ success: true }) },
    SALT_SECRET: 'a-test-secret-that-is-not-the-real-one',
    BUILD_LABEL: 't2',
  };
  responses = [];
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit & { body: string }) => {
      const headers = new Headers(init.headers);
      requests.push({
        url,
        contentType: headers.get('content-type'),
        credentials: init.credentials,
        body: init.body,
      });
      // What a browser adds on the way out, and nothing the client chose.
      headers.set('origin', ORIGIN);
      headers.set('cf-connecting-ip', '203.0.113.9');
      headers.set('user-agent', 'Mozilla/5.0 Chrome/141.0.0.0');
      const pending = worker.fetch(new Request(url, { method: init.method, headers, body: init.body }), env);
      responses.push(pending);
      return pending;
    }),
  );
  vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => true) });
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

describe('the real client against the real Worker', () => {
  it('a whole session is accepted: heartbeat, duel digest and the card batch all answer 204', async () => {
    const played = reportableCardIds().slice(0, 7);
    signals.start();
    signals.cardsPlayed(played);
    signals.cardsPlayed(played.slice(0, 2));
    signals.duelFinished(duelInput());
    signals.sessionEnding();

    expect(await statuses()).toEqual([204, 204, 204]);
    expect(requests.map((request) => new URL(request.url).search)).toEqual(['?e=heartbeat', '?e=duel', '?e=cards']);
    for (const request of requests) {
      expect(new URL(request.url).pathname).toBe('/v1/signals');
      expect(request.contentType).toBe('application/json');
      expect(request.credentials).toBe('omit');
    }

    const kinds = sink.points.map((point) => point.blobs?.[0]);
    expect(kinds.filter((kind) => kind === 'heartbeat')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'duel')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'card')).toHaveLength(played.length);
  });

  it('what the Worker stores for the cards carries no install hash, and the duel row carries no card', async () => {
    const played = reportableCardIds().slice(0, 5);
    signals.start();
    signals.cardsPlayed(played);
    signals.duelFinished(duelInput());
    signals.sessionEnding();
    await statuses();

    const cardRows = sink.points.filter((point) => point.blobs?.[0] === 'card');
    const duelRow = sink.points.find((point) => point.blobs?.[0] === 'duel');
    const hash = duelRow?.blobs?.[2];
    expect(typeof hash === 'string' && hash.length > 0).toBe(true);
    for (const row of cardRows) {
      expect(row.blobs?.[2]).toBe('');
      expect(JSON.stringify(row)).not.toContain(hash as string);
    }
    for (const id of played) expect(JSON.stringify(duelRow)).not.toContain(id);
  });

  it('a session that plays more distinct cards than the cap still sends a batch the Worker accepts', async () => {
    const many = reportableCardIds().slice(0, SESSION_CARD_ROW_CAP + 25);
    signals.start();
    signals.cardsPlayed(many);
    signals.duelFinished(duelInput());
    signals.sessionEnding();

    expect(await statuses()).toEqual([204, 204, 204]);
    expect(sink.points.filter((point) => point.blobs?.[0] === 'card')).toHaveLength(SESSION_CARD_ROW_CAP);
  });

  it('every result and format the client can report is one the Worker accepts', async () => {
    const cases: Array<Partial<DuelFinishedInput>> = [
      { winner: 0, reason: 'life' },
      { winner: 1, reason: 'life' },
      { winner: 1, reason: 'concede' },
      { winner: 0, reason: 'concede' },
      { winner: 'draw', reason: 'turnLimit' },
      { gauntlet: true },
      { limited: true },
      { deck: { cards: STARTER_DECKS[0].cards, landReserve: null, darlingId: null, savedFormat: 'constructed' } },
      { deck: { cards: STARTER_DECKS[0].cards, landReserve: null, darlingId: null, savedFormat: 'darlings' } },
      { opponentId: null },
    ];
    for (const over of cases) signals.duelFinished(duelInput(over));

    expect(await statuses()).toEqual(cases.map(() => 204));
    const results = sink.points.map((point) => point.blobs?.[11]);
    expect(new Set(results)).toEqual(new Set(['win', 'loss', 'concede', 'draw']));
  });

  it('with the toggle off the Worker is never reached at all', async () => {
    Services.save.data.settings.shareAnonStats = false;
    signals.start();
    signals.cardsPlayed(reportableCardIds().slice(0, 3));
    signals.duelFinished(duelInput());
    signals.sessionEnding();

    expect(requests).toHaveLength(0);
    expect(sink.points).toHaveLength(0);
  });

  it('a save that has not seen the current notice reaches the Worker only after the stamp', async () => {
    Services.save.data.settings.statsNoticeVersion = 0;
    signals.start();
    expect(requests).toHaveLength(0);

    Services.save.data.settings.statsNoticeVersion = STATS_NOTICE_VERSION;
    signals.noticeAcknowledged();
    expect(await statuses()).toEqual([204]);
    expect(sink.points.map((point) => point.blobs?.[0])).toEqual(['heartbeat']);
  });
});
