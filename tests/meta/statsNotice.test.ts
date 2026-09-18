import { describe, expect, it } from 'vitest';
import { SIGNAL_FIELDS, SIGNAL_SETTINGS_FIELDS, STATS_NOTICE_VERSION } from '../../src/meta/playSignals';
import { freshSave, SaveManager } from '../../src/meta/SaveManager';
import { normalizeStatsNoticeVersion, STATS_NOTICE_VERSION as LEAF_VERSION } from '../../src/meta/statsNotice';

/**
 * The allowlist as it stood at each notice version. The privacy policy
 * (section 8) promises that a change to what the game sends is announced the
 * next time the game opens, and the notice re-arms only when
 * STATS_NOTICE_VERSION is bumped. So: change SIGNAL_FIELDS, and this test
 * fails until you bump the constant AND add the new snapshot under the new
 * number. Never edit an old entry.
 */
const ALLOWLIST_AT_NOTICE_VERSION: Record<number, string> = {
  1: JSON.stringify({
    heartbeat: [
      'appVersion', 'buildSha', 'platform', 'formFactor', 'lang', 'settings', 'streakBucket',
      'achievementsBucket', 'winsBucket', 'lossesBucket', 'packsBucket', 'collectionBucket',
      'tutorialDone', 'gauntletBestRung',
    ],
    duel: [
      'format', 'deckColours', 'deckArchetype', 'curveBucket', 'deckSource', 'opponentId',
      'difficulty', 'turnsBucket', 'result', 'mulligans',
    ],
    cards: ['cardId', 'countBucket', 'duelsBucket'],
    settings: ['animations', 'reducedMotion', 'renderScale'],
  }),
};

describe('stats notice version', () => {
  it('the allowlist matches the snapshot recorded for the current notice version', () => {
    const current = JSON.stringify({ ...SIGNAL_FIELDS, settings: SIGNAL_SETTINGS_FIELDS });
    expect(
      ALLOWLIST_AT_NOTICE_VERSION[STATS_NOTICE_VERSION],
      'the fields sent changed: bump STATS_NOTICE_VERSION and record the new allowlist under it',
    ).toBe(current);
  });

  it('every earlier notice version keeps its own snapshot, and versions are contiguous from 1', () => {
    const versions = Object.keys(ALLOWLIST_AT_NOTICE_VERSION).map(Number).sort((a, b) => a - b);
    expect(versions).toEqual(Array.from({ length: STATS_NOTICE_VERSION }, (_, index) => index + 1));
  });

  it('playSignals re-exports the same constant the save layer uses', () => {
    expect(STATS_NOTICE_VERSION).toBe(LEAF_VERSION);
    expect(Number.isInteger(STATS_NOTICE_VERSION) && STATS_NOTICE_VERSION >= 1).toBe(true);
  });

  it('every save is owed the notice until it is stamped: fresh and migrated alike', () => {
    expect(freshSave(1).settings.statsNoticeVersion).toBe(0);
    expect(freshSave(1).settings.statsNoticeVersion).toBeLessThan(STATS_NOTICE_VERSION);
    const old = structuredClone(freshSave(1)) as unknown as Record<string, unknown> & { settings: Record<string, unknown> };
    old.version = 34;
    delete old.settings.shareAnonStats;
    delete old.settings.statsNoticeVersion;
    const migrated = Object.create(SaveManager.prototype).migrate(old, 1);
    expect(migrated.settings.statsNoticeVersion).toBe(0);
    expect(migrated.settings.statsNoticeVersion).toBeLessThan(STATS_NOTICE_VERSION);
  });

  it('reads anything that is not a non-negative integer as not yet notified', () => {
    for (const garbage of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '1', true, null, undefined, {}, []]) {
      expect(normalizeStatsNoticeVersion(garbage)).toBe(0);
    }
    expect(normalizeStatsNoticeVersion(0)).toBe(0);
    expect(normalizeStatsNoticeVersion(1)).toBe(1);
  });

  it('a stamped save stays stamped across a reload', () => {
    const stamped = structuredClone(freshSave(1));
    stamped.settings.statsNoticeVersion = STATS_NOTICE_VERSION;
    const reloaded = Object.create(SaveManager.prototype).migrate(
      stamped as unknown as Record<string, unknown>, 1,
    );
    expect(reloaded.settings.statsNoticeVersion).toBe(STATS_NOTICE_VERSION);
  });

  it('keeps a stamp from a NEWER build, so a downgrade never re-shows an older notice', () => {
    const current = structuredClone(freshSave(1));
    current.settings.statsNoticeVersion = STATS_NOTICE_VERSION + 3;
    const reloaded = Object.create(SaveManager.prototype).migrate(
      current as unknown as Record<string, unknown>, 1,
    );
    expect(reloaded.settings.statsNoticeVersion).toBe(STATS_NOTICE_VERSION + 3);
  });

  it('a garbage stamp on a current save reads as 0 and an opt-out beside it survives', () => {
    const current = structuredClone(freshSave(1)) as unknown as Record<string, unknown> & { settings: Record<string, unknown> };
    current.settings.statsNoticeVersion = 'seen';
    current.settings.shareAnonStats = false;
    const reloaded = Object.create(SaveManager.prototype).migrate(current, 1);
    expect(reloaded.settings.statsNoticeVersion).toBe(0);
    expect(reloaded.settings.shareAnonStats).toBe(false);
  });
});
