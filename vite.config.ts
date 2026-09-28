/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { cspForTarget, isDesktopBuild } from './scripts/cspForTarget';
import { copyPacksInto } from './scripts/pack-art';

// Build identity stamped into the client (src/version.ts): the package version
// and the commit SHA's first seven characters. Always seven, never `--short`:
// git lengthens a short SHA once a clone passes 16,384 objects, so a local
// full clone and CI's shallow checkout would stamp the same commit two ways.
// Git is present in local dev and CI checkout; a non-git context (e.g. a
// source tarball) falls back to 'dev'.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const gitSha = ((): string => {
  try {
    const full = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return /^[0-9a-f]{40}$/i.test(full) ? full.slice(0, 7).toLowerCase() : 'dev';
  } catch {
    return 'dev';
  }
})();

/**
 * Card-art packs (docs/plan-art-streaming.md section 5). A web production
 * build reads card art from the packs `scripts/pack-art.ts` staged (npm run
 * build runs it), so this copies them into `dist/assets/art/packs/` and sets
 * `__ART_SOURCE__` to 'packs'. The loose files in `dist/assets/art/cards/`
 * and `cards-half/` stay beside them through 1.9 (the Forge, older tabs, the
 * 404 fallback).
 *
 * The desktop build gets neither: Tauri's asset protocol ignores `Range` and
 * would send a whole pack for every card (docs/desktop-build.md), so the app
 * keeps reading loose files. A plain `vite build` with no index (pack-art
 * never ran) copies nothing and the source falls back to loose files.
 */
function artPacks(): Plugin {
  const desktop = isDesktopBuild(process.env);
  let outDir = 'dist';
  return {
    name: 'art-packs',
    apply: 'build',
    config: () => ({ define: { __ART_SOURCE__: JSON.stringify(desktop ? 'loose' : 'packs') } }),
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (desktop) return;
      const copied = copyPacksInto(outDir);
      if (copied === null) {
        this.warn('no art pack index (src/data/art-packs.json); this build reads loose card art');
        return;
      }
      const mib = (copied.bytes / 1024 / 1024).toFixed(1);
      this.info(`copied ${copied.files} art pack(s), ${mib} MiB, into ${join(outDir, 'assets', 'art', 'packs')}`);
    },
  };
}

export default defineConfig({
  plugins: [
    {
      // The desktop build gains Tauri's IPC sources in the page's connection
      // policy; the web build is returned untouched. See scripts/cspForTarget.ts.
      name: 'csp-for-target',
      transformIndexHtml: (html: string): string => cspForTarget(html, isDesktopBuild(process.env)),
    },
    {
      // `version.json` beside index.html: the stamp of the build being served,
      // which the web update check reads (src/version.ts) so it only claims an
      // update that a reload would actually deliver. Build only; the dev server
      // compares with main instead.
      name: 'build-stamp',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: `${JSON.stringify({ version: pkg.version, sha: gitSha })}\n`,
        });
      },
    },
    artPacks(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(gitSha),
    // Where card-art bytes come from (src/art/artSource.ts): loose files for
    // the dev server and tests; the art-packs plugin (above) makes it 'packs'
    // for a web production build.
    __ART_SOURCE__: JSON.stringify('loose'),
  },
  // Relative base so the built app works both when served (LAN/web) and when
  // loaded from Tauri's custom protocol in the desktop bundle.
  base: './',
  // Tauri desktop wrapper (src-tauri/): keep Vite's output visible while the
  // Rust side compiles.
  clearScreen: false,
  server: {
    // 5173 is the preferred port because the browser save is PER-ORIGIN: the
    // long-lived dev save lives on localhost:5173. strictPort was flipped off
    // 2026-08-01 (user call) so a squatted 5173 walks forward to 5174+ instead
    // of erroring - vite prints the chosen port; a non-5173 port starts a
    // FRESH save (re-seed via the ?cards=/?gold= URL cheats or a save code).
    // Caveat: `tauri dev` still expects exactly 5173 (devUrl match) - keep
    // 5173 free when running the desktop shell.
    port: 5173,
    strictPort: false,
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
