/**
 * Builds the art-run tracker for one set into scripts/art-tracker/dist/:
 * index.html (the page), dbcard.js (the game's card renderer) and tracker.json
 * (the set's settings). Publish index.html as an Artifact with the other two as
 * supporting files; scripts/art-tracker/README.md has the whole procedure.
 *
 *   npx tsx scripts/art-tracker/build.ts core-set-2
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const here = resolve(import.meta.dirname);
const set = process.argv[2];
const setFile = resolve(here, 'sets', `${set}.json`);
if (!set || !existsSync(setFile)) {
  console.error(`usage: npx tsx scripts/art-tracker/build.ts <set>  (a file in scripts/art-tracker/sets/)`);
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(setFile, 'utf8')) as { title: string; draftsFile?: string };
execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--config', resolve(here, 'vite.config.ts'), '--logLevel', 'warn'], { stdio: 'inherit' });

// Draft cards (not yet in src/data) carry their printed faces in a separate file.
const drafts = cfg.draftsFile ? JSON.parse(readFileSync(resolve(here, 'sets', cfg.draftsFile), 'utf8')) as unknown : {};
const out = resolve(here, 'dist');
writeFileSync(resolve(out, 'tracker.json'), JSON.stringify({ ...cfg, draftsFile: undefined, drafts }, null, 2));
copyFileSync(resolve(here, 'page.html'), resolve(out, 'index.html'));
console.log(`Built ${cfg.title} tracker in ${out}`);
