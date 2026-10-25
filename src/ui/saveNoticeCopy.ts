import type { ToastNotice } from './toastQueue';

/**
 * Copy for what the save layer reports at boot and while playing
 * (src/meta/SaveManager.ts `SaveLoadStatus` and `onWriteFailure`).
 */

/**
 * The main menu's first message after an unreadable save was set aside and a
 * fresh one started (the menu's arrival chain puts it first).
 */
export function unreadableSaveCopy(): { title: string; body: string; actionLabel: string } {
  return {
    title: 'Save could not be read',
    body: 'The save on this device could not be read, so a new one was started. A copy of the old one was kept on this device.',
    actionLabel: 'Continue',
  };
}

/** The once-per-launch notice when the browser refuses to store the save. */
export function saveWriteFailedNotice(): ToastNotice {
  return {
    title: 'Progress is not being saved',
    body: 'This browser refused to store your progress. Go to Profile and Export save to keep a copy.',
    action: { scene: 'Profile' },
    fitBody: true,
    neverCollapse: true,
  };
}

/** The stop screen when the stored save is newer than the build that loaded. */
export function newerSaveCopy(desktop: boolean): { title: string; body: string; actionLabel: string } {
  return {
    title: 'Newer save found',
    body: desktop
      ? 'The save on this device was made by a newer version of Darling Blades. Nothing has been changed. Install the latest version of the app to keep playing.'
      : 'The save on this device was made by a newer version of Darling Blades than the one that just loaded. Nothing has been changed. Reload to get the newer version.',
    actionLabel: 'Reload',
  };
}
