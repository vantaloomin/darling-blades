import {
  claimBrowserTabSession,
  removeTabGuard,
  showTabGuard,
  type TabSession,
} from './platform/tabGuard';

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
  void import('./gameBoot').then(({ bootGame }) => bootGame());
}

void bootIfExclusive();
