/**
 * Builds the Forge (docs/forge.md) into dist/forge/, the last step of
 * `npm run build`, after the game's own `vite build` has emptied and filled
 * dist/. Run standalone with `npm run forge:build`.
 *
 * The desktop bundle does not carry the Forge: Tauri runs `npm run build` as its
 * beforeBuildCommand with TAURI_ENV_PLATFORM set and ships dist/ as the app, so
 * that build stops here with dist/ holding the game alone.
 */
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { isDesktopBuild } from './cspForTarget';

const configFile = fileURLToPath(new URL('../vite.forge.config.ts', import.meta.url));
const forgeOut = fileURLToPath(new URL('../dist/forge', import.meta.url));

if (isDesktopBuild(process.env)) {
  console.log('forge: skipped (desktop build; the Forge is web-only)');
} else {
  // The forge build writes into the game's dist/ without emptying it, so clear
  // its own folder here: a standalone rebuild must not leave stale chunks.
  rmSync(forgeOut, { recursive: true, force: true });
  await build({ configFile, mode: 'production' });
}
