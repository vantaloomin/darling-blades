/**
 * Scans public/assets/art/cards for <cardId>.webp drops and writes
 * src/data/art-manifest.json. Cards absent from the manifest get procedural
 * placeholder art; listed cards load the real file. Also lists the half-res
 * 320×400 variants in public/assets/art/cards-half (built by
 * scripts/gen-art-halfres.ts) so the lite quality tier knows which halves it
 * may request without 404s, and the scene/menu art in public/assets/art/scenes
 * (stage backdrops, card-back, pack-art — written by scripts/gen-scene-art.ts)
 * so PreloadScene knows which `scene-<key>` textures it may load without 404s.
 * The `scenes` key is additive: ArtResolver reads only `.cards`/`.half`, so
 * the change is backward-compatible. Run via `npm run gen-art-manifest`
 * (hooked into dev/build).
 *
 * A checkout without cards-half/ (every fresh clone: the half set is derived
 * and gitignored) writes `half: []` and the lite tier falls back to full-res.
 * That is right for a local build and wrong for the Pages deploy, where phones
 * load the half set, so the deploy passes `--require-half`: the run fails if
 * any card art file lacks its half-res sibling.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artDir = join(root, 'public', 'assets', 'art', 'cards');
const halfDir = join(root, 'public', 'assets', 'art', 'cards-half');
const sceneDir = join(root, 'public', 'assets', 'art', 'scenes');
const outFile = join(root, 'src', 'data', 'art-manifest.json');

const scan = (dir: string): string[] => {
  try {
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.webp'))
      .map((f) => f.replace(/\.webp$/i, ''))
      .sort();
  } catch {
    // dir absent — empty list is fine
    return [];
  }
};

const cards = scan(artDir);
const half = scan(halfDir);
const scenes = scan(sceneDir);

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify({ cards, half, scenes }, null, 2) + '\n');
console.log(
  `art-manifest: ${cards.length} real card art file(s), ${half.length} half-res variant(s), ${scenes.length} scene art file(s)`,
);

if (process.argv.includes('--require-half')) {
  const halves = new Set(half);
  const missing = cards.filter((key) => !halves.has(key));
  if (missing.length > 0) {
    const shown = missing.slice(0, 10).join(', ');
    console.error(
      `art-manifest: ${missing.length} card art file(s) have no half-res variant ` +
        `(run gen-art-halfres first): ${shown}${missing.length > 10 ? ', …' : ''}`,
    );
    process.exit(1);
  }
}
