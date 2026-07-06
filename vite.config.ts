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
  // Rust side compiles, and pin the dev port so `tauri dev`'s devUrl matches.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
