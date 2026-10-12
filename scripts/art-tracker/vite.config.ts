// Builds the art tracker's card preview bundle: scripts/art-tracker/dist/dbcard.js
// (Phaser plus the game's CardView, CardFrameFactory and ManaSymbols, as one IIFE).
// Run through `npm run art-tracker:build`.
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [{
    // Draft cards print the rules text from tracker.json, not the generated text.
    name: 'rules-text-shim',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === './rulesText' && importer?.replace(/\\/g, '/').endsWith('/src/ui/CardView.ts')) return resolve(__dirname, 'rulesTextShim.ts');
      return null;
    },
  }],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    lib: { entry: resolve(__dirname, 'entry.ts'), formats: ['iife'], name: 'DBCardBundle', fileName: () => 'dbcard.js' },
    minify: true,
  },
});
