/**
 * The full-screen button (docs/plan-mobile-overhaul.md M8): offered on touch
 * screens whose browser allows the Fullscreen API (Android Chrome, iPad
 * Safari). iPhone Safari allows it only for video, so it is never offered
 * there, and a home-screen app already opened full screen has no need of it.
 * Desktop keeps its own window controls and never sees it.
 */

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export interface FullScreenEnv {
  coarsePointer: boolean;
  /** `document.fullscreenEnabled` (or its webkit name). */
  enabled: boolean;
  /** The page runs as a home-screen app opened full screen. */
  launchedFullScreen: boolean;
}

export function fullScreenOfferedFor(env: FullScreenEnv): boolean {
  return env.coarsePointer && env.enabled && !env.launchedFullScreen;
}

/** Whether this page shows the full-screen controls. */
export function fullScreenOffered(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  const media = (query: string): boolean => window.matchMedia?.(query).matches === true;
  return fullScreenOfferedFor({
    coarsePointer: media('(pointer: coarse)'),
    enabled: doc.fullscreenEnabled === true || doc.webkitFullscreenEnabled === true,
    launchedFullScreen: media('(display-mode: fullscreen)'),
  });
}

export function isFullScreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/**
 * Enter or leave full screen. Must run inside a tap (browsers allow it only
 * from a user gesture). On Android it also locks landscape, which the
 * browser allows only while full screen; a refusal changes nothing.
 */
export async function toggleFullScreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  try {
    if (isFullScreen()) {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    const root = document.documentElement as FullscreenElement;
    await (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.());
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation?.lock?.('landscape').catch(() => undefined);
  } catch {
    // Refused (no gesture, or the browser said no): the page stays as it is.
  }
}

/** Call `listener` whenever full screen starts or ends; returns the unsubscribe. */
export function onFullScreenChange(listener: () => void): () => void {
  document.addEventListener('fullscreenchange', listener);
  document.addEventListener('webkitfullscreenchange', listener);
  return () => {
    document.removeEventListener('fullscreenchange', listener);
    document.removeEventListener('webkitfullscreenchange', listener);
  };
}
