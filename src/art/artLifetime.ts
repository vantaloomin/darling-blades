import type { ArtLease } from './artStore';

/** Bind a lease to its owner's lifetime, and detach even on an early release. */
export function bindArtLease(lease: ArtLease, onGone: (release: () => void) => () => void): ArtLease {
  let released = false;
  let stopWatching = (): void => {};
  const release = (): void => {
    if (released) return;
    released = true;
    stopWatching();
    lease.release();
  };
  stopWatching = onGone(release);
  if (released) stopWatching();
  return { ready: lease.ready, add: (ids) => { if (!released) lease.add(ids); }, release };
}
