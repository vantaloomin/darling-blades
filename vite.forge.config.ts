import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/**
 * The Forge (docs/forge.md): the card designer served at /forge/, a second Vite
 * page beside the game. It has its own config so none of the settings below can
 * reach the game bundle, and `npm run build` runs it as a separate step after
 * the game's `vite build` (scripts/build-forge.ts, which also skips it for the
 * desktop bundle).
 *
 * The root is the repository, so the page lives at /forge/ in dev exactly as it
 * does in production, and every `../` the page uses to reach a game file (art,
 * fonts, favicons) resolves the same way in both.
 */
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const forgePage = fileURLToPath(new URL('./forge/index.html', import.meta.url));
const fxSupportPath = fileURLToPath(new URL('./src/ui/fx/FXSupport.ts', import.meta.url)).replaceAll('\\', '/');
const fxSupportStub = fileURLToPath(new URL('./src/forge/fxSupportStub.ts', import.meta.url)).replaceAll('\\', '/');

/** `npm run forge` opens at the site root; send it to the page. */
const forgeRootRedirect = (): Plugin => ({
  name: 'forge-root-redirect',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url === '/' || request.url === '/forge') {
        response.statusCode = 302;
        response.setHeader('Location', '/forge/');
        response.end();
        return;
      }
      next();
    });
  },
});

export default defineConfig(({ command }) => ({
  root: repoRoot,
  base: './',
  // Dev serves public/ at the root, where production has the game's own copy.
  // The build must NOT copy it: public/ is hundreds of megabytes of art that the
  // game build already deploys, and dist/forge/ holds only the page.
  publicDir: command === 'build' ? false : 'public',
  // The storage wall. The Forge shares the game's origin, so the game save's
  // localStorage keys are within its reach; the bundle must never touch
  // storage. The build replaces every bare `localStorage` with `undefined`
  // (the card-proof recipe, which also neuters Phaser's storage probe).
  // Vite 8's dev env client assigns top-level defines onto window, and
  // assigning window.localStorage throws because that property is read-only,
  // so dev applies the define only while pre-bundling Phaser instead.
  define: command === 'build' ? { localStorage: 'undefined' } : {},
  // Its own pre-bundle cache: the Phaser pre-bundle below differs from the
  // game's (no storage), and a shared cache would thrash a game dev server
  // running at the same time.
  cacheDir: 'node_modules/.vite-forge',
  optimizeDeps: {
    entries: ['forge/index.html'],
    rolldownOptions: {
      transform: {
        define: { localStorage: 'undefined' },
      },
    },
  },
  plugins: [forgeRootRedirect()],
  resolve: {
    // The real FXSupport reads the player's animation setting from the save.
    alias: [
      { find: './FXSupport', replacement: fxSupportStub },
      { find: './fx/FXSupport', replacement: fxSupportStub },
      { find: fxSupportPath, replacement: fxSupportStub },
    ],
  },
  server: {
    port: 5176,
    strictPort: true,
  },
  preview: {
    port: 5176,
    strictPort: true,
  },
  build: {
    // The page is emitted at <outDir>/forge/index.html (its path under the
    // root) and its JS/CSS under forge/assets/, so everything lands in
    // dist/forge/. dist/ itself belongs to the game build, which runs first and
    // empties it; scripts/build-forge.ts clears dist/forge/ before this runs.
    outDir: 'dist',
    assetsDir: 'forge/assets',
    emptyOutDir: false,
    rollupOptions: {
      input: { forge: forgePage },
    },
    chunkSizeWarningLimit: 2000,
  },
}));
