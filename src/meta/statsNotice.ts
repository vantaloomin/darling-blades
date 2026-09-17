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
