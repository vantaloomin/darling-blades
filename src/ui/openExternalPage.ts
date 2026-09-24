import { isTauri } from '../platform/desktopWindow';

/**
 * Open one of the game's own published pages beside the running game.
 *
 * Every caller passes a RELATIVE href, so the page resolves under the Pages
 * site's project path and inside the packaged desktop bundle alike, where it
 * works with no network at all.
 *
 * - **Web:** a new tab, with `OPENED_BY_GAME` added to the address. The page
 *   (scripts/gen-legal-pages.ts) reads it and turns its "Back to the game" link
 *   into a way back to THIS tab. Without it the link loads `./`, which starts a
 *   second copy of the game in the new tab, where the one-tab guard stops it.
 * - **Desktop:** the same `window.open`, which the Tauri shell answers by
 *   opening the page in a window of its own, offline (src-tauri/src/lib.rs;
 *   without that handler WebView2 cancels every popup silently). The shell also
 *   closes that window when its "Back to the game" link is followed, so the page
 *   needs no marker there.
 *
 * The guard is the point of this helper. A webview that refuses to open a
 * second window must leave the game exactly as it was: no navigation away from
 * a live session, and no throw escaping into a tap handler. The panel or
 * dialog that offered the link keeps its own text as the disclosure either way,
 * which is why a silent failure is the right behaviour here and not a toast.
 */
export function openExternalPage(href: string): void {
  try {
    if (typeof window === 'undefined' || typeof window.open !== 'function') return;
    window.open(isTauri() ? href : markOpenedByGame(href), '_blank', 'noopener,noreferrer');
  } catch {
    /* no second window available: the surface that offered the link stands alone */
  }
}

/**
 * The query parameter a page opened by the game carries. The legal pages'
 * script reads exactly this pair, so both sides import it from here.
 */
export const OPENED_BY_GAME = { name: 'from', value: 'game' } as const;

/** `href` with the opened-by-the-game marker in its query, any fragment kept last. */
export function markOpenedByGame(href: string): string {
  const hashAt = href.indexOf('#');
  const base = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : href.slice(hashAt);
  const pair = `${OPENED_BY_GAME.name}=${OPENED_BY_GAME.value}`;
  if (new RegExp(`[?&]${pair}(&|$)`).test(base)) return href;
  return `${base}${base.includes('?') ? '&' : '?'}${pair}${hash}`;
}
