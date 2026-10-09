/**
 * The version of the "anonymous stats" notice a player has been shown.
 *
 * `SaveData.settings.statsNoticeVersion` holds the last notice version a
 * profile saw: `0` for every save, fresh or migrated, until the notice has
 * been shown (owner ruling 2026-09-17: show it to all players unless we can
 * verify they have seen it). The client shows the notice when the saved value
 * is BELOW this constant, then stamps it, and sends nothing before that.
 *
 * BUMP THIS whenever the set of fields the game sends changes. The privacy
 * policy (section 8) and the terms (section 12) promise that a change to what
 * is sent is announced the next time the game opens, so a one-shot boolean
 * would break that promise at the first allowlist edit (owner ruling
 * 2026-09-10). `tests/meta/playSignals.test.ts` pins the allowlist against
 * this number, so an allowlist edit without a bump fails the suite.
 *
 * This is a leaf module with no imports on purpose: `SaveManager` needs the
 * constant for a fresh save and `playSignals` imports `SaveManager`, so
 * defining it beside the allowlist itself would be an import cycle.
 * `playSignals` re-exports it, which is where callers should read it from.
 */
export const STATS_NOTICE_VERSION = 1;

/** A saved notice version, or 0 for anything that is not a non-negative integer. */
export function normalizeStatsNoticeVersion(raw: unknown): number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

/**
 * Start the sharing choice at Off when the browser asks not to be tracked.
 *
 * A fresh save defaults `shareAnonStats` to on, and `src/meta` cannot read the
 * browser, so the default is decided before Do Not Track or Global Privacy
 * Control is ever looked at. The gate still refused every send on such a
 * browser, but the toggle said On, which reads as opted in. The boot layer
 * (gameBoot.ts) reads the signal and hands it here, so a player whose browser
 * opts out starts opted out too.
 *
 * Only a save that has never been told (`statsNoticeVersion` 0) is changed:
 * that is the save still holding the untouched default. A player who has seen
 * the notice has made their choice, and it stands. Returns whether the
 * setting changed, so the caller knows to persist it.
 */
export function applyBrowserOptOutDefault(
  settings: { shareAnonStats: boolean; statsNoticeVersion: unknown },
  browserOptsOut: boolean,
): boolean {
  if (!browserOptsOut) return false;
  if (normalizeStatsNoticeVersion(settings.statsNoticeVersion) !== 0) return false;
  if (settings.shareAnonStats !== true) return false;
  settings.shareAnonStats = false;
  return true;
}
