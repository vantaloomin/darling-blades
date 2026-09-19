import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { connectionPolicyOf, cspForTarget, isDesktopBuild, TAURI_IPC_SOURCES } from '../../scripts/cspForTarget';

const INDEX_HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const WEB_POLICY = "connect-src 'self' https://api.github.com https://db-signals.loominvanta.workers.dev";

describe('the connection policy per build target', () => {
  it('ships the web build naming exactly the two hosts the privacy page names', () => {
    expect(connectionPolicyOf(INDEX_HTML)).toBe(WEB_POLICY);
    expect(cspForTarget(INDEX_HTML, false)).toBe(INDEX_HTML);
  });

  it('adds the two Tauri IPC sources to the desktop build and nothing else', () => {
    const desktop = cspForTarget(INDEX_HTML, true);
    expect(connectionPolicyOf(desktop)).toBe(`${WEB_POLICY} ipc: http://ipc.localhost`);
    // Every byte outside the policy tag is untouched.
    expect(desktop.replace(` ${TAURI_IPC_SOURCES.join(' ')}`, '')).toBe(INDEX_HTML);
  });

  it('is idempotent', () => {
    const once = cspForTarget(INDEX_HTML, true);
    expect(cspForTarget(once, true)).toBe(once);
  });

  it('leaves other directives alone and keeps their order', () => {
    const html = '<meta http-equiv="Content-Security-Policy" content="img-src \'self\' data:; connect-src \'self\'; font-src \'self\'">';
    expect(connectionPolicyOf(cspForTarget(html, true))).toBe(
      "img-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; font-src 'self'",
    );
  });

  it('refuses to build a desktop page that has no policy to extend', () => {
    expect(() => cspForTarget('<html></html>', true)).toThrow('no Content-Security-Policy');
    expect(() => cspForTarget('<meta http-equiv="Content-Security-Policy" content="img-src \'self\'">', true))
      .toThrow('no connect-src');
  });

  it('reads the desktop target from the variable the Tauri CLI sets', () => {
    expect(isDesktopBuild({ TAURI_ENV_PLATFORM: 'windows' })).toBe(true);
    expect(isDesktopBuild({ TAURI_ENV_PLATFORM: '' })).toBe(false);
    expect(isDesktopBuild({})).toBe(false);
  });

  it('leaves the Tauri config without a policy of its own, for the reason the helper states', () => {
    const conf = JSON.parse(readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8')) as {
      app: { security: { csp: unknown } };
    };
    expect(conf.app.security.csp).toBeNull();
  });
});
