import { desktopWindowSize, type RenderK } from './renderScale';

/**
 * Bridge from the render-resolution setting to the actual OS window, for the
 * Tauri desktop build only. A plain browser tab can't resize its own window,
 * so in the browser (LAN play, dev) every function here is a guarded no-op and
 * the render factor keeps its supersampling-only meaning.
 *
 * This is the one spot where the frontend talks to Tauri (see
 * docs/desktop-build.md): the resolution the user picks lives in the webview's
 * localStorage, so only the frontend can drive the resize. The Tauri window
 * API is loaded via a dynamic import so a browser build never pulls it in.
 */

/** True when running inside the Tauri webview (vs a plain browser). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Size the desktop window to the chosen render resolution (1280·k × 720·k
 * logical px, clamped to the screen work area) and re-center it. No-op outside
 * Tauri. Fire-and-forget: any API/permission failure is swallowed so a hiccup
 * can never block boot — the window simply keeps its previous size.
 */
export async function applyDesktopWindowSize(k: RenderK): Promise<void> {
  if (!isTauri()) return;
  try {
    const { width, height } = desktopWindowSize(
      k,
      window.screen?.availWidth ?? 0,
      window.screen?.availHeight ?? 0,
    );
    const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(width, height));
    await win.center();
  } catch {
    // window API unavailable / permission missing — leave the window as-is.
  }
}
