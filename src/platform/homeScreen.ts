/**
 * Home-screen mode (docs/plan-mobile-overhaul.md M9). On iPhone and iPad a
 * game added to the home screen keeps storage of its own, apart from
 * Safari's, so it opens with a fresh save. The first time that happens the
 * main menu says once how to bring the Safari save over (Export a save code
 * there, Import it here). Android's home-screen app shares Chrome's storage,
 * so it is never told.
 *
 * The "already told" mark lives in its own localStorage key, not the save:
 * it belongs to this storage, and an imported save must not carry it over.
 */

export const SAVE_OVER_NOTICE_KEY = 'darlingblades.saveOverNotice';

export interface SaveOverInput {
  /** `navigator.standalone`: true only in an iOS or iPadOS home-screen app. */
  standalone: unknown;
  /** The mark is already in this storage. */
  shown: boolean;
  /** No games played and the tutorial neither done nor skipped. */
  freshSave: boolean;
}

export function saveOverNoticeOwed(input: SaveOverInput): boolean {
  return input.standalone === true && !input.shown && input.freshSave;
}

/** Read the browser's side of `saveOverNoticeOwed`. */
export function readSaveOverNoticeOwed(freshSave: boolean): boolean {
  let shown = true;
  try {
    shown = window.localStorage.getItem(SAVE_OVER_NOTICE_KEY) !== null;
  } catch {
    // Storage blocked: nothing could be imported or remembered anyway.
  }
  return saveOverNoticeOwed({ standalone: (navigator as { standalone?: unknown }).standalone, shown, freshSave });
}

export function markSaveOverNoticeShown(): void {
  try {
    window.localStorage.setItem(SAVE_OVER_NOTICE_KEY, '1');
  } catch {
    // Storage blocked: the message may show again, which is harmless.
  }
}
