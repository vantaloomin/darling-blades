import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { Services } from '../../src/meta/services';
import { STATS_NOTICE_VERSION } from '../../src/meta/statsNotice';
import { resetSignalsLaunchStateForTest, signals } from '../../src/net/signals';
import { setSignalsTestEndpoint } from '../../src/net/signalsClient';
import {
  createStatsNoticeController,
  toggleShareAnonStats,
  type StatsNoticeController,
} from '../../src/ui/statsPrivacyPresentation';

/**
 * The privacy surfaces against the real transport: what the Settings toggle and
 * the first-run notice dialog actually do to the wire.
 *
 * The scenes themselves import Phaser, so what is exercised here is the pure
 * pieces they call (`toggleShareAnonStats`, `createStatsNoticeController`)
 * wired to the same save and the same facade the scenes wire them to. The
 * assertion is always a fetch count: the transport's promise is silence, so
 * silence is what gets counted.
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

/** The dialog's controller, wired exactly as MainMenuScene wires it. */
function openTheNoticeAsTheSceneDoes(): StatsNoticeController {
  return createStatsNoticeController(
    {
      settings: Services.save.data.settings,
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

describe('the first-run notice and the stamp', () => {
  it('sends nothing at all until the notice has been shown', () => {
    Services.save.data.settings.statsNoticeVersion = 0;
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('sends nothing for as long as the dialog is on screen', () => {
    Services.save.data.settings.statsNoticeVersion = 0;
    signals.start();
    const notice = openTheNoticeAsTheSceneDoes();
    // The player reads it, flips the toggle about, and reads it some more.
    notice.toggle();
    notice.toggle();
    expect(notice.stamped()).toBe(false);
    expect(Services.save.data.settings.statsNoticeVersion).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('sends the launch heartbeat the moment Continue stamps', () => {
    Services.save.data.settings.statsNoticeVersion = 0;
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(0);

    openTheNoticeAsTheSceneDoes().dismiss();
    expect(Services.save.data.settings.statsNoticeVersion).toBe(STATS_NOTICE_VERSION);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('nothing is sent when the dialog is torn down without Continue', () => {
    Services.save.data.settings.statsNoticeVersion = 0;
    signals.start();
    const notice = openTheNoticeAsTheSceneDoes();
    // The scene was left with the dialog up: no Continue, no stamp.
    expect(notice.stamped()).toBe(false);
    expect(Services.save.data.settings.statsNoticeVersion).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('still stamps and acknowledges for a player who has sharing off, and still sends nothing', () => {
    // Being told is not the same as opting in. The stamp records that the
    // player was told; the gate is what refuses.
    Services.save.data.settings.statsNoticeVersion = 0;
    Services.save.data.settings.shareAnonStats = false;
    openTheNoticeAsTheSceneDoes().dismiss();
    expect(Services.save.data.settings.statsNoticeVersion).toBe(STATS_NOTICE_VERSION);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('turning the toggle OFF in the dialog silences the very next gated send', () => {
    Services.save.data.settings.statsNoticeVersion = 0;
    const notice = openTheNoticeAsTheSceneDoes();
    expect(notice.toggle()).toBe(false);
    expect(Services.save.data.settings.shareAnonStats).toBe(false);
    notice.dismiss();
    // Stamped and acknowledged, and the acknowledgement's own heartbeat went
    // nowhere, because the gate reads the save the player just wrote.
    expect(Services.save.data.settings.statsNoticeVersion).toBe(STATS_NOTICE_VERSION);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    signals.start();
    signals.cardsPlayed(PLAYED.slice(0, 3));
    signals.sessionEnding();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('a save already at the current notice version never opens the dialog at all', () => {
    // The scene asks `statsNoticeOwed` first; this is the transport half of
    // that: nothing is owed, nothing is stamped again, and the heartbeat goes.
    expect(Services.save.data.settings.statsNoticeVersion).toBe(STATS_NOTICE_VERSION);
    signals.start();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('a notice version bump re-arms the gate for a save stamped at the old one', () => {
    Services.save.data.settings.statsNoticeVersion = STATS_NOTICE_VERSION;
    const bumped = STATS_NOTICE_VERSION + 1;
    const notice = createStatsNoticeController(
      {
        settings: Services.save.data.settings,
        setNoticeVersion: (version) => {
          Services.save.data.settings.statsNoticeVersion = version;
        },
        touch: () => Services.save.touch(),
        acknowledge: () => signals.noticeAcknowledged(),
      },
      bumped,
    );
    // The dialog shows that player's SAVED choice, whatever it was.
    Services.save.data.settings.shareAnonStats = false;
    expect(notice.sharing()).toBe(false);
    notice.dismiss();
    expect(Services.save.data.settings.statsNoticeVersion).toBe(bumped);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});
