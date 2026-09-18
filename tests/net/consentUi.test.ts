import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { Services } from '../../src/meta/services';
import { STATS_NOTICE_VERSION } from '../../src/meta/statsNotice';
import { resetSignalsLaunchStateForTest, signals } from '../../src/net/signals';
import { setSignalsTestEndpoint } from '../../src/net/signalsClient';
import { stampStatsNotice, toggleShareAnonStats } from '../../src/ui/statsPrivacyPresentation';

/**
 * The consent UI against the real transport: what the Settings toggle and the
 * one-time notice actually do to the wire.
 *
 * The scenes themselves import Phaser, so what is exercised here is the pure
 * pieces they call (`toggleShareAnonStats`, `stampStatsNotice`) wired to the
 * same save and the same facade the scenes wire them to. The assertion is
 * always a fetch count: the transport's promise is silence, so silence is what
 * gets counted.
 */

const TEST_ENDPOINT = 'https://signals.test/v1/signals';

/** Reportable cards from a real starter list: no basic land, no token. */
const PLAYED: string[] = STARTER_DECKS[0].cards.filter((id) => {
  const card = CARD_DB[id];
  return card !== undefined && card.token !== true && !(card.supertypes?.includes('basic') ?? false);
});

let fetchSpy: MockInstance;

beforeEach(() => {
  resetSignalsLaunchStateForTest();
  setSignalsTestEndpoint(TEST_ENDPOINT);
  fetchSpy = vi.fn(() => Promise.resolve({ ok: true, status: 204 })) as unknown as MockInstance;
  vi.stubGlobal('fetch', fetchSpy);
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

/** The scene's three effects, wired exactly as MainMenuScene wires them. */
function stampAsTheSceneDoes(): void {
  stampStatsNotice(
    {
      setNoticeVersion: (version) => {
        Services.save.data.settings.statsNoticeVersion = version;
      },
      touch: () => Services.save.touch(),
      acknowledge: () => signals.noticeAcknowledged(),
    },
    STATS_NOTICE_VERSION,
  );
}

describe('the Settings toggle', () => {
  it('writes the save, and the very next gated send obeys it', () => {
    toggleShareAnonStats(Services.save.data.settings);
    expect(Services.save.data.settings.shareAnonStats).toBe(false);
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(0);

    // Back on, and the next send goes. No restart: the gate re-reads the save.
    toggleShareAnonStats(Services.save.data.settings);
    expect(Services.save.data.settings.shareAnonStats).toBe(true);
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('stops a batch that this launch had already gathered', () => {
    signals.start();
    signals.cardsPlayed(PLAYED.slice(0, 3));
    expect(fetchSpy).toHaveBeenCalledTimes(1); // the heartbeat, nothing else yet

    toggleShareAnonStats(Services.save.data.settings);
    signals.sessionEnding();
    // The card batch was ready to leave and does not, because the gate is
    // evaluated at send time rather than when the tally was built.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('the one-time notice and the stamp', () => {
  it('sends nothing at all until the notice has been shown', () => {
    Services.save.data.settings.statsNoticeVersion = 0;
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('sends the launch heartbeat the moment the stamp lands', () => {
    Services.save.data.settings.statsNoticeVersion = 0;
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(0);

    stampAsTheSceneDoes();
    expect(Services.save.data.settings.statsNoticeVersion).toBe(STATS_NOTICE_VERSION);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('nothing is sent when the notice never rendered, because nothing stamped it', () => {
    Services.save.data.settings.statsNoticeVersion = 0;
    signals.start();
    // The scene was left before the rail built the card: no onShown, no stamp.
    expect(Services.save.data.settings.statsNoticeVersion).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('still stamps and acknowledges for a player who has sharing off, and still sends nothing', () => {
    // Being told is not the same as opting in. The stamp records that the
    // player was told; the gate is what refuses.
    Services.save.data.settings.statsNoticeVersion = 0;
    Services.save.data.settings.shareAnonStats = false;
    stampAsTheSceneDoes();
    expect(Services.save.data.settings.statsNoticeVersion).toBe(STATS_NOTICE_VERSION);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});
