/* global process, console */
// Copies what the teaser composition uses into trailer/teaser/assets/ (gitignored):
// card and scene art and fonts from public/, and the showcase footage that
// scripts/showcase-capture.mjs recorded into showcase/. Several clips (from
// --ranges) are joined, in order, into one footage.mp4.
//
//   node trailer/teaser/prepare.mjs [--footage showcase/hel-vs-marsh.mp4[,more.mp4]]
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const assets = join(here, 'assets');
const i = process.argv.indexOf('--footage');
const footage = (i >= 0 ? process.argv[i + 1] : 'showcase/hel-vs-marsh.mp4').split(',').map((f) => resolve(root, f));

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
const missing = footage.find((f) => !existsSync(f));
if (missing) {
  console.error(`No footage at ${missing}. Record it first:\n  npx tsx scripts/showcase-match.ts ... --name hel-vs-marsh\n  node scripts/showcase-capture.mjs --name hel-vs-marsh`);
  process.exit(1);
}
const target = join(assets, 'footage.mp4');
if (footage.length === 1) {
  copyFileSync(footage[0], target);
} else {
  const run = (tool, args) => {
    const result = spawnSync(tool, args, { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`${tool} failed: ${result.stderr}`);
    return result.stdout;
  };
  let at = 0;
  for (const clip of footage) {
    console.log(`${at.toFixed(2)}s  ${clip}`);
    at += Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip]));
  }
  const list = join(assets, 'footage.txt');
  writeFileSync(list, footage.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  // The clips share one encoding (showcase-capture.mjs), so they join without re-encoding.
  run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', target]);
  rmSync(list);
}
console.log(`Copied ${copies.length} art files and the footage into ${assets}`);
