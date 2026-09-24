import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILD_STAMP_FILE,
  checkForUpdate,
  compareVersions,
  desktopUpdateStatus,
  devUpdateStatus,
  sameCommit,
  webUpdateStatus,
} from '../src/version';

/**
 * The Settings update check. What it may claim depends on how the running
 * build gets updated: the web build by a reload (so only a build the site is
 * already serving counts), the desktop build by a download (so a reload is
 * never the advice). Plus the two robustness rules: a commit is the same commit
 * however it was abbreviated, and no request can leave the check hanging.
 */

const FULL = '8f59fbf2c4e1a7b3d6e9f0a1b2c3d4e5f6a7b8c9';
const OTHER = '0ec04161aa2233445566778899aabbccddeeff00';

describe('a commit stamp', () => {
  it('matches the same commit at any abbreviation length', () => {
    expect(sameCommit(FULL.slice(0, 7), FULL)).toBe(true);
    expect(sameCommit(FULL.slice(0, 8), FULL.slice(0, 7))).toBe(true);
    expect(sameCommit(FULL.toUpperCase(), FULL.slice(0, 9))).toBe(true);
  });

  it('never matches a different commit, a placeholder, or a truncated stamp', () => {
    expect(sameCommit(FULL.slice(0, 7), OTHER)).toBe(false);
    expect(sameCommit('dev', FULL)).toBe(false);
    expect(sameCommit('', FULL)).toBe(false);
    expect(sameCommit(FULL.slice(0, 6), FULL)).toBe(false);
  });
});

describe('version order', () => {
  it('compares numerically, part by part, ignoring a v prefix and a suffix', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.8.0', '1.8.0')).toBe(0);
    expect(compareVersions('1.8', '1.8.0')).toBe(0);
    expect(compareVersions('1.8.0-rc.1', '1.8.1')).toBeLessThan(0);
  });

  it('refuses something that is not a version', () => {
    expect(compareVersions('latest', '1.8.0')).toBeNull();
    expect(compareVersions('', '1.8.0')).toBeNull();
  });
});

describe('the desktop answer', () => {
  it('says to download a newer release, never to reload', () => {
    const status = desktopUpdateStatus('1.8.0', 'v1.8.1');
    expect(status.state).toBe('available');
    expect(status.latestVersion).toBe('1.8.1');
    expect(status.message).toMatch(/download/i);
    expect(status.message).not.toMatch(/reload/i);
  });

  it('is up to date at, or ahead of, the latest release', () => {
    expect(desktopUpdateStatus('1.8.0', 'v1.8.0').state).toBe('current');
    // A local build cut before its release is tagged.
    expect(desktopUpdateStatus('1.9.0', 'v1.8.2').state).toBe('current');
  });

  it('reports a release tag it cannot read as an error, not as an update', () => {
    expect(desktopUpdateStatus('1.8.0', '').state).toBe('error');
  });
});

describe('the web answer', () => {
  it('claims an update only when the site serves a different build', () => {
    expect(webUpdateStatus(FULL.slice(0, 7), { version: '1.8.0', sha: FULL.slice(0, 7) }).state).toBe('current');
    const status = webUpdateStatus(FULL.slice(0, 7), { version: '1.8.0', sha: OTHER.slice(0, 7) });
    expect(status.state).toBe('available');
    expect(status.message).toMatch(/reload/i);
  });

  it('treats the same commit stamped at two lengths as the same build', () => {
    expect(webUpdateStatus(FULL.slice(0, 8), { sha: FULL.slice(0, 7) }).state).toBe('current');
  });

  it('never claims an update from a missing or malformed stamp', () => {
    expect(webUpdateStatus(FULL.slice(0, 7), null).state).toBe('error');
    expect(webUpdateStatus(FULL.slice(0, 7), {}).state).toBe('error');
    expect(webUpdateStatus(FULL.slice(0, 7), { sha: 'dev' }).state).toBe('error');
  });
});

describe('the dev-server answer', () => {
  it('only ever reports, since there is nothing to reload into', () => {
    expect(devUpdateStatus(FULL.slice(0, 7), FULL).state).toBe('current');
    expect(devUpdateStatus(FULL.slice(0, 7), OTHER).state).toBe('current');
  });
});

describe('the check itself', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A fetch the network never answers; it gives up only when aborted. */
  function silentFetch(): ReturnType<typeof vi.fn> {
    return vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
  }

  it('gives up on a request that is never answered, on every channel', async () => {
    for (const channel of ['web', 'desktop', 'dev'] as const) {
      vi.stubGlobal('fetch', silentFetch());
      const status = await checkForUpdate(channel, 20);
      expect(status.state, channel).toBe('error');
    }
  });

  it('asks GitHub for the latest release on the desktop, and the site for its stamp on the web', async () => {
    const answers = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
      new Response(JSON.stringify(url.includes('releases') ? { tag_name: 'v99.0.0' } : { sha: OTHER.slice(0, 7) }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', answers);

    const desktop = await checkForUpdate('desktop', 1000);
    expect(String(answers.mock.calls[0][0])).toContain('/releases/latest');
    expect(desktop.state).toBe('available');

    const web = await checkForUpdate('web', 1000);
    const [url, init] = answers.mock.calls[1];
    expect(url).toBe(`./${BUILD_STAMP_FILE}`);
    expect(init?.cache).toBe('no-store');
    expect(web.state).toBe('available');
  });

  it('turns a failed answer into an error rather than a throw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    expect((await checkForUpdate('web', 1000)).state).toBe('error');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })));
    expect((await checkForUpdate('desktop', 1000)).state).toBe('error');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect((await checkForUpdate('dev', 1000)).state).toBe('error');
  });
});
