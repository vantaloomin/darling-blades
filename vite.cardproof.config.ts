import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const fxSupportPath = fileURLToPath(new URL('./src/ui/fx/FXSupport.ts', import.meta.url)).replaceAll('\\', '/');
const fxSupportStub = fileURLToPath(new URL('./src/dev/cardproof/fxSupportStub.ts', import.meta.url)).replaceAll('\\', '/');

const rootProofPage = (): Plugin => ({
  name: 'cardproof-root-page',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === '/') request.url = '/cardproof.html';
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === '/') request.url = '/cardproof.html';
      next();
    });
  },
});

export default defineConfig({
  base: './',
  // Phaser's device feature probe otherwise calls localStorage.getItem while
  // booting. The proof bundle must not touch browser storage at all.
  define: {
    localStorage: 'undefined',
  },
  plugins: [rootProofPage()],
  resolve: {
    alias: [
      { find: './FXSupport', replacement: fxSupportStub },
      { find: './fx/FXSupport', replacement: fxSupportStub },
      { find: fxSupportPath, replacement: fxSupportStub },
    ],
  },
  server: {
    port: 5175,
    strictPort: true,
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
  build: {
    outDir: 'cardproof-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./cardproof.html', import.meta.url)),
        cardproof: fileURLToPath(new URL('./cardproof.html', import.meta.url)),
      },
    },
    chunkSizeWarningLimit: 2000,
  },
});
