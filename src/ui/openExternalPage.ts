/**
 * Open one of the game's own published pages beside the running game.
 *
 * Every caller passes a RELATIVE href, so the page resolves under the Pages
 * site's project path and inside the packaged desktop bundle alike, where it
 * works with no network at all.
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
    window.open(href, '_blank', 'noopener,noreferrer');
  } catch {
    /* no second window available: the surface that offered the link stands alone */
  }
}
