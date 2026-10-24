/**
 * Ask the browser to keep this site's storage, so the save is not cleared
 * when the device runs short of space or, on Safari, after a stretch of days
 * without a visit. Chrome and Safari decide without asking the player.
 * Firefox shows a permission prompt instead, so it is skipped there: Firefox
 * only clears storage under real space pressure, and a prompt on first launch
 * is a worse trade than that risk. The desktop app keeps its own storage and
 * needs none of this.
 *
 * Best effort: any missing API, refusal or error is ignored.
 */
export function requestPersistentStorage(opts: { desktop: boolean }): void {
  if (opts.desktop) return;
  try {
    if (typeof navigator === 'undefined' || /firefox\//i.test(navigator.userAgent)) return;
    const storage = navigator.storage;
    if (!storage || typeof storage.persist !== 'function' || typeof storage.persisted !== 'function') return;
    void storage.persisted().then((already) => (already ? true : storage.persist())).catch(() => undefined);
  } catch {
    // Not available here; the save still works without it.
  }
}
