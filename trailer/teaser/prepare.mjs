/* global process, console */
// Copies what the teaser composition uses into trailer/teaser/assets/ (gitignored):
// card and scene art and fonts from public/, and the showcase footage that
// scripts/showcase-capture.mjs recorded into showcase/.
//
//   node trailer/teaser/prepare.mjs [--footage showcase/hel-vs-marsh.mp4]
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const assets = join(here, 'assets');
const i = process.argv.indexOf('--footage');
const footage = resolve(root, i >= 0 ? process.argv[i + 1] : 'showcase/hel-vs-marsh.mp4');

const CARDS = [
  'gk-zeus',
  'tk-shu-guanyu',
  'rg-hel',
  'ac-artoria-once-future',
  'yn-kitsune-neon-tyrant',
  'sd-bastet-mistress-of-the-ninth-return',
  'cf-titania-silver-court',
  'sb-eclipse-red-queen',
];

const copies = [
  ...CARDS.map((id) => [`public/assets/art/cards/${id}.webp`, `cards/${id}.webp`]),
  ['public/assets/art/scenes/scene-mainmenu.webp', 'scenes/scene-mainmenu.webp'],
  ['public/assets/art/scenes/card-back.webp', 'scenes/card-back.webp'],
  ['public/assets/fonts/cinzel-latin-var.woff2', 'fonts/cinzel-latin-var.woff2'],
  ['public/assets/fonts/inter-latin-var.woff2', 'fonts/inter-latin-var.woff2'],
];
for (const [from, to] of copies) {
  mkdirSync(dirname(join(assets, to)), { recursive: true });
  copyFileSync(join(root, from), join(assets, to));
}
if (!existsSync(footage)) {
  console.error(`No footage at ${footage}. Record it first:\n  npx tsx scripts/showcase-match.ts ... --name hel-vs-marsh\n  node scripts/showcase-capture.mjs --name hel-vs-marsh`);
  process.exit(1);
}
copyFileSync(footage, join(assets, 'footage.mp4'));
console.log(`Copied ${copies.length} art files and the footage into ${assets}`);
