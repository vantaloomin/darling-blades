/**
 * Scans public/assets/art/cards for <cardId>.png drops and writes
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
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .map((f) => f.replace(/\.png$/i, ''))
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
