/**
 * Recovery for a tab whose page is older than the deployed site. Each deploy
 * replaces the whole Pages site, so the hashed scripts an older `index.html`
 * names are gone; loading one fails. One reload fetches the current page.
 *
 * The reload is rate-limited through sessionStorage so a script that is
 * missing for some other reason cannot loop the tab: at most one reload per
 * minute, and none at all when sessionStorage cannot be read or written.
 */

const RELOAD_MARK_KEY = 'darlingblades.staleBuildReload';
const RELOAD_WINDOW_MS = 60_000;

/** Pure half: whether a reload is allowed, given the last mark and the time. */
export function staleBuildReloadAllowed(lastMark: string | null, now: number): boolean {
  if (lastMark === null) return true;
  const last = Number(lastMark);
  return !Number.isFinite(last) || now - last >= RELOAD_WINDOW_MS;
}

/** Reload once to pick up the current build. Returns whether a reload was started. */
export function reloadForNewBuild(): boolean {
  try {
    const now = Date.now();
    if (!staleBuildReloadAllowed(window.sessionStorage.getItem(RELOAD_MARK_KEY), now)) return false;
    window.sessionStorage.setItem(RELOAD_MARK_KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
