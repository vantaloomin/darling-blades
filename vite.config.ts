/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
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
