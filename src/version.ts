import { isTauri } from './platform/desktopWindow';

/**
 * Build-stamped version identity + an on-demand update check.
 *
 * `APP_VERSION` / `GIT_SHA` are injected at build time by vite.config.ts
 * (`define`): the package.json version and the first seven characters of the
 * built commit (`'dev'` when git is unavailable). No network call happens at
 * import or boot: `checkForUpdate()` runs only when the player presses the
 * Settings button, so the game stays fully offline-first.
 *
 * What counts as an update depends on where the game runs, because the two
 * builds are updated in different ways:
 *
 * - **Web:** a reload loads whatever GitHub Pages is serving now, so the check
 *   asks the site itself. Every build writes its own stamp to `version.json`
 *   beside `index.html` (vite.config.ts), and an update is claimed only when
 *   the stamp being served differs from this build's. (The check used to
 *   compare against `main`'s HEAD, which announced "reload to get it" for the
 *   quarter hour between a merge and its deploy, when a reload changed nothing.)
 * - **Desktop:** a reload changes nothing; a new version has to be downloaded
 *   and installed. So the check compares `APP_VERSION` with GitHub's latest
 *   published release and says to download it.
 * - **Dev server:** nothing is deployed, so it still compares with `main`, for
 *   the developer's benefit.
 *
 * Every request gives up after `UPDATE_CHECK_TIMEOUT_MS`, so the Settings line
 * never sits on "Checking…".
 */

export const APP_VERSION: string = __APP_VERSION__;
export const GIT_SHA: string = __GIT_SHA__;

/** Corner/Settings label, e.g. `v0.1.0 · a1b2c3d` (or `· dev`). */
export const VERSION_LABEL = `v${APP_VERSION} · ${GIT_SHA}`;

/** Public repo the deployed Pages build tracks (main auto-deploys). */
const REPO = 'vantaloomin/darling-blades';

/** The stamp every build writes beside index.html (see vite.config.ts). */
export const BUILD_STAMP_FILE = 'version.json';

/** How long the check waits for an answer before it says it could not check. */
export const UPDATE_CHECK_TIMEOUT_MS = 8000;

export interface UpdateStatus {
  state: 'current' | 'available' | 'error';
  message: string;
  latestSha?: string;
  latestVersion?: string;
}

/** Where the running build came from, which decides what "an update" means. */
export type UpdateChannel = 'web' | 'desktop' | 'dev';

/** The shape of `version.json`. */
export interface BuildStamp {
  version: string;
  sha: string;
}

/**
 * Whether two commit stamps name the same commit, whatever length each was
 * abbreviated to. `git rev-parse --short` grows past seven characters once a
 * clone holds more than 16,384 objects, and GitHub reports all forty, so an
 * exact comparison would call one commit two. Seven characters is the shortest
 * stamp accepted, so an empty or truncated stamp never matches anything.
 */
export function sameCommit(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x.length < 7 || y.length < 7) return false;
  return x.startsWith(y) || y.startsWith(x);
}

/**
 * Compare two dotted versions (`1.8.0`, `v1.10.2`) numerically, part by part.
 * A leading `v` and any pre-release or build suffix are ignored. Negative when
 * `a` is older, positive when newer, 0 when equal, and null when either is not
 * a version at all.
 */
export function compareVersions(a: string, b: string): number | null {
  const parse = (value: string): number[] | null => {
    const core = /^v?(\d+(?:\.\d+)*)/.exec(value.trim());
    return core ? core[1].split('.').map((part) => Number(part)) : null;
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** The desktop answer: is GitHub's latest published release newer than this build? */
export function desktopUpdateStatus(currentVersion: string, latestTag: string): UpdateStatus {
  const order = compareVersions(latestTag, currentVersion);
  if (order === null) return { state: 'error', message: "Couldn't read the latest version" };
  const latestVersion = latestTag.trim().replace(/^v/, '');
  if (order <= 0) return { state: 'current', message: 'Up to date', latestVersion };
  return {
    state: 'available',
    latestVersion,
    message: `Version ${latestVersion} is out: download it from GitHub`,
  };
}

/** The web answer: is the site now serving a different build than this one? */
export function webUpdateStatus(currentSha: string, served: Partial<BuildStamp> | null): UpdateStatus {
  const servedSha = typeof served?.sha === 'string' ? served.sha.trim() : '';
  if (servedSha.length < 7) return { state: 'error', message: "Couldn't read the latest version" };
  if (sameCommit(servedSha, currentSha)) return { state: 'current', message: 'Up to date' };
  return { state: 'available', latestSha: servedSha.slice(0, 7), message: 'Update available: reload to get it' };
}

/** The dev-server answer, against `main`, which is all a dev build can compare with. */
export function devUpdateStatus(currentSha: string, mainSha: string): UpdateStatus {
  const latest = mainSha.trim().slice(0, 7);
  if (latest.length < 7) return { state: 'error', message: "Couldn't read the latest version" };
  if (sameCommit(mainSha, currentSha)) return { state: 'current', message: 'Dev build · at latest main' };
  return { state: 'current', latestSha: latest, message: `Dev build · latest main is ${latest}` };
}

/** Which check this build runs. */
export function updateChannel(): UpdateChannel {
  if (isTauri()) return 'desktop';
  return import.meta.env.DEV ? 'dev' : 'web';
}

/** The request ran out of time: the network never answered. */
class NoAnswer extends Error {}
/** The server answered, but not with a 2xx. */
class HttpFailure extends Error {}

/**
 * `fetch` + JSON that gives up after `ms`, so a request the network never
 * answers rejects instead of leaving the caller waiting forever.
 */
async function fetchJson(url: string, init: RequestInit, ms: number): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new HttpFailure(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } catch (error) {
    throw timedOut ? new NoAnswer('timed out') : error;
  } finally {
    clearTimeout(timer);
  }
}

const GITHUB_JSON: RequestInit = { headers: { Accept: 'application/vnd.github+json' } };

/**
 * Run this build's update check. On-demand only (the Settings button). Every
 * failure, including no answer within the timeout, becomes an `error` status
 * rather than a throw. GitHub's public API sends permissive CORS headers, so a
 * plain fetch works from the Tauri webview as well as a browser.
 */
export async function checkForUpdate(
  channel: UpdateChannel = updateChannel(),
  timeoutMs: number = UPDATE_CHECK_TIMEOUT_MS,
): Promise<UpdateStatus> {
  try {
    if (channel === 'desktop') {
      const release = (await fetchJson(
        `https://api.github.com/repos/${REPO}/releases/latest`,
        GITHUB_JSON,
        timeoutMs,
      )) as { tag_name?: unknown } | null;
      return desktopUpdateStatus(APP_VERSION, typeof release?.tag_name === 'string' ? release.tag_name : '');
    }
    if (channel === 'web') {
      // Same origin, and never from the HTTP cache: the question is what a
      // reload would load right now.
      const served = (await fetchJson(`./${BUILD_STAMP_FILE}`, { cache: 'no-store' }, timeoutMs)) as
        | Partial<BuildStamp>
        | null;
      return webUpdateStatus(GIT_SHA, served);
    }
    const commit = (await fetchJson(
      `https://api.github.com/repos/${REPO}/commits/main`,
      GITHUB_JSON,
      timeoutMs,
    )) as { sha?: unknown } | null;
    return devUpdateStatus(GIT_SHA, typeof commit?.sha === 'string' ? commit.sha : '');
  } catch (error) {
    if (error instanceof NoAnswer) return { state: 'error', message: "Couldn't check (no answer)" };
    if (error instanceof HttpFailure) return { state: 'error', message: "Couldn't check right now" };
    if (error instanceof SyntaxError) return { state: 'error', message: "Couldn't read the latest version" };
    return { state: 'error', message: "Couldn't check (offline?)" };
  }
}
