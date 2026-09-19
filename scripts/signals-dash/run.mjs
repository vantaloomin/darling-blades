/* global process, console */
// Signals dashboard: serves a page over the k-anonymised day files that
// `scripts/signals-rollup/run.ts` writes. Read-only over that folder, no state
// of its own, no dependencies and no build step, the same shape as sweep-dash.
//
//   npm run signals-dash                             (http://localhost:5186/)
//   SIGNALS_ROLLUP_DIR=path npm run signals-dash
//   node scripts/signals-dash/run.mjs --dir balance/my-rollups
//
// Pass --dir by calling node directly, or use SIGNALS_ROLLUP_DIR: npm claims
// unknown flags as its own config and PowerShell eats `--`, so a flag sent
// through `npm run` arrives stripped (playbook section 11).
//
// The folder it reads is the rollup output: rollups/YYYY/MM/DD.json plus
// index.json. Everything in those files is already above the k = 10 floor, so
// the page may add published numbers together freely. It never fetches anything
// from the internet: no CDN, no font, no analytics. It is a developer tool for
// reading our own totals, and it would be absurd for it to phone anywhere.
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

/** `--dir <folder>`, else SIGNALS_ROLLUP_DIR, else the published folder, else the local one. */
function resolveDir(argv) {
  const flag = argv.indexOf('--dir');
  if (flag >= 0 && argv[flag + 1]) return resolve(argv[flag + 1]);
  if (process.env.SIGNALS_ROLLUP_DIR) return resolve(process.env.SIGNALS_ROLLUP_DIR);
  const published = join(ROOT, 'signals-data', 'rollups');
  if (existsSync(published)) return published;
  return join(ROOT, 'balance', 'signals-rollups');
}

const DIR = resolveDir(process.argv.slice(2));
const PORT = Number(process.env.SIGNALS_DASH_PORT ?? 5186);
/** A dev tool reading years of dailies has no use for more than this at once. */
const MAX_DAYS = 400;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function listDir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** Every day file present, newest last. The index is a convenience, not the truth. */
function dayFiles(dir) {
  const out = [];
  for (const year of listDir(dir)) {
    if (!/^\d{4}$/.test(year)) continue;
    for (const month of listDir(join(dir, year))) {
      if (!/^\d{2}$/.test(month)) continue;
      for (const file of listDir(join(dir, year, month))) {
        const match = /^(\d{2})\.json$/.exec(file);
        if (match) out.push({ day: `${year}-${month}-${match[1]}`, file: join(dir, year, month, file) });
      }
    }
  }
  out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return out;
}

function readAll() {
  const files = dayFiles(DIR).slice(-MAX_DAYS);
  const days = [];
  for (const { day, file } of files) {
    const json = readJson(file);
    if (json && json.day === day) days.push(json);
  }
  const index = readJson(join(DIR, 'index.json'));
  return { dir: DIR, k: index?.k ?? days[0]?.k ?? 10, days };
}

const server = createServer((req, res) => {
  if (req.url === '/data.json') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(readAll()));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(readFileSync(join(HERE, 'dashboard.html'), 'utf8'));
});

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  server.listen(PORT, () => {
    console.log(`signals-dash: http://localhost:${PORT}/ (rollups: ${DIR})`);
  });
}
