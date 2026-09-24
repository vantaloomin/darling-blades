/**
 * The page's connection policy, per build target.
 *
 * index.html carries one `connect-src` Content-Security-Policy naming the two
 * hosts the game contacts, which is what the privacy page tells players. The
 * desktop build loads that same index.html inside WebView2, where a meta policy
 * is enforced exactly as it is in a browser, and Tauri's own window calls
 * (`src/platform/desktopWindow.ts`) travel over `ipc:` and `http://ipc.localhost`.
 * Measured 2026-09-19 on a release build: with the web policy unchanged, every
 * IPC call is refused, logs two errors, and Tauri falls back to its slower
 * postMessage channel.
 *
 * So the desktop build, and only the desktop build, gains the two IPC sources.
 * They are not network hosts: the webview intercepts them and nothing leaves
 * the machine. The web build's policy keeps naming exactly two hosts.
 *
 * `tauri.conf.json` keeps `csp: null` on purpose. A policy set there is ADDED to
 * the meta policy, never substituted for it, so it could not have fixed this,
 * and Tauri rewrites script and style sources with nonces when one is set,
 * which needs the same Phaser probe the web policy is still waiting on.
 */

export const TAURI_IPC_SOURCES = ['ipc:', 'http://ipc.localhost'] as const;

const POLICY_TAG = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/;

/** The `content` of the page's policy tag, or null when the page has none. */
export function connectionPolicyOf(html: string): string | null {
  return POLICY_TAG.exec(html)?.[2] ?? null;
}

/**
 * Returns the html unchanged for a web build. For a desktop build, adds the IPC
 * sources to `connect-src`, once, and throws if the tag or the directive is
 * missing: a desktop build that silently ships the web policy is the bug this
 * file exists to prevent.
 */
export function cspForTarget(html: string, desktop: boolean): string {
  if (!desktop) return html;
  const match = POLICY_TAG.exec(html);
  if (!match) throw new Error('cspForTarget: index.html has no Content-Security-Policy meta tag');
  const directives = match[2].split(';').map((part) => part.trim()).filter(Boolean);
  const at = directives.findIndex((part) => part.split(/\s+/)[0] === 'connect-src');
  if (at < 0) throw new Error('cspForTarget: the policy has no connect-src directive');
  const sources = directives[at].split(/\s+/);
  for (const source of TAURI_IPC_SOURCES) if (!sources.includes(source)) sources.push(source);
  directives[at] = sources.join(' ');
  return html.replace(POLICY_TAG, `$1${directives.join('; ')}$3`);
}

/** The Tauri CLI sets this for `beforeBuildCommand` and `beforeDevCommand`. */
export function isDesktopBuild(env: Record<string, string | undefined>): boolean {
  return typeof env.TAURI_ENV_PLATFORM === 'string' && env.TAURI_ENV_PLATFORM.length > 0;
}
