/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Build identity stamped into the client (src/version.ts): the package version
// and the short commit SHA. Git is present in local dev and CI checkout; a
// non-git context (e.g. a source tarball) falls back to 'dev'.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const gitSha = ((): string => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(gitSha),
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
