/**
 * Build-stamped version identity + an on-demand GitHub update check.
 *
 * `APP_VERSION` / `GIT_SHA` are injected at build time by vite.config.ts
 * (`define`): the package.json version and `git rev-parse --short HEAD`
 * (`'dev'` when git is unavailable). No network call happens at import or boot —
 * `checkForUpdate()` runs only when the player presses the Settings button, so
 * the game stays fully offline-first.
 */

export const APP_VERSION: string = __APP_VERSION__;
export const GIT_SHA: string = __GIT_SHA__;

/** Corner/Settings label, e.g. `v0.1.0 · a1b2c3d` (or `· dev`). */
export const VERSION_LABEL = `v${APP_VERSION} · ${GIT_SHA}`;

/** Public repo the deployed Pages build tracks (main auto-deploys). */
const REPO = 'vantaloomin/darling-blades';

export interface UpdateStatus {
  state: 'current' | 'available' | 'error';
  message: string;
  latestSha?: string;
}

/**
 * Compare the built commit to the latest `main` commit on GitHub. On-demand
 * only (Settings button); degrades gracefully offline / rate-limited. GitHub's
 * public commits API sends permissive CORS headers, so a plain browser fetch
 * works from both the Pages build and the Tauri webview.
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return { state: 'error', message: "Couldn't check right now" };
    const data = (await res.json()) as { sha?: string };
    const latest = (data.sha ?? '').slice(0, 7);
    if (!latest) return { state: 'error', message: "Couldn't read the latest version" };
    if (GIT_SHA === 'dev') return { state: 'current', message: `Dev build · latest main is ${latest}` };
    if (latest === GIT_SHA) return { state: 'current', message: 'Up to date' };
    return { state: 'available', latestSha: latest, message: 'Update available: reload to get it' };
  } catch {
    return { state: 'error', message: "Couldn't check (offline?)" };
  }
}
