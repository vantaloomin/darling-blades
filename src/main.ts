import { FEATURES } from './config/features';
import {
  claimBrowserTabSession,
  removeTabGuard,
  showTabGuard,
  type TabSession,
} from './platform/tabGuard';
import { reloadForNewBuild } from './platform/staleBuild';

async function bootIfExclusive(): Promise<boolean> {
  const session = await claimBrowserTabSession();
  if (!session.acquired) {
    showTabGuard(bootIfExclusive);
    return false;
  }

  removeTabGuard();
  startGame(session);
  return true;
}

function startGame(session: TabSession): void {
  // Release synchronously on navigation so a reload can reacquire instead of
  // briefly seeing its previous document's session lock.
  window.addEventListener('pagehide', () => session.release(), { once: true });
  // A page restored from the back/forward cache has given its session up at
  // pagehide, and another tab may have played since, so its in-memory save is
  // stale. Reload: the save was written at pagehide, and the reload claims the
  // session again (or shows the guard if another tab holds it).
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
  // Core Set II and Story Mode are live on the dev server only until the 2.0
  // cut. Set before the game modules load, so nothing builds a card pool
  // without the set.
  if (import.meta.env.DEV) {
    FEATURES.coreSet2Live = true;
    FEATURES.storyLive = true;
  }
  void import('./gameBoot').then(({ bootGame }) => bootGame(), (error: unknown) => {
    // Usually the game chunk is gone because this page predates the last
    // deploy. Anything else, or a second failure inside a minute, surfaces as
    // it did before.
    if (!reloadForNewBuild()) throw error;
  });
}

// Vite reports a dynamic import whose preloaded dependencies failed to load
// here. Same cause as above, same cure.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewBuild()) event.preventDefault();
});

void bootIfExclusive();
