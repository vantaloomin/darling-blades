/**
 * Re-crops retained raw art into a staging directory and emits a review sheet.
 *
 * Default mode processes character-card raws only. Environment raws can be
 * included with --all, but environment mode is intentionally the old center
 * crop and should be byte-identical to the shipped crop.
 *
 * Usage:
 *   npx tsx scripts/recrop-art.ts [--only id1,id2] [--limit N] [--dry-run]
 *                                 [--force] [--all] [--out <dir>] [--apply]
 *                                 [--sheet-only]
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARD_DB } from '../src/data/catalog';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const smartcropPath = join(root, 'scripts', 'smartcrop.py');
const shippedCardsDir = join(root, 'public', 'assets', 'art', 'cards');
const blockedOutRoot = join(root, 'public', 'assets', 'art');
const defaultOutDir = join(root, '.artcrop-staging');

const OUT_W = 640;
const OUT_H = 800;
const CARD_W = 300;
const CARD_H = 420;
const CARD_ART_W = 264;
const CARD_ART_H = 192;
const BOARD_TILE_W = 132;
const BOARD_TILE_H = 146;
const BOARD_FRAME_MARGIN = 4;
const BOARD_ART_W = BOARD_TILE_W - BOARD_FRAME_MARGIN * 2;
const BOARD_ART_H = BOARD_TILE_H - BOARD_FRAME_MARGIN * 2;
const BOARD_CROP_BIAS = 0.3;
const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

type Mode = 'character' | 'environment';
type Source = 'face' | 'head' | 'person' | 'center';

interface Args {
  only?: string[];
  limit?: number;
  dryRun: boolean;
  force: boolean;
  all: boolean;
  outDir: string;
  apply: boolean;
  sheetOnly: boolean;
}

interface RawJob {
  id: string;
  rawPath: string;
  mode: Mode;
  group: string;
}

interface CropResult {
  source: Source;
  bbox: [number, number, number, number] | null;
  crop: [number, number, number, number];
  W: number;
  H: number;
}

interface ReviewRow {
  job: RawJob;
  oldPath: string;
  newPath: string;
  result: CropResult;
}

interface StagedResult {
  id: string;
  group: string;
  mode: Mode;
  source: Source;
  bbox: [number, number, number, number] | null;
  crop: [number, number, number, number];
  rawPath: string;
}

function fail(msg: string): never {
  console.error(`recrop-art: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    force: false,
    all: false,
    outDir: defaultOutDir,
    apply: false,
    sheetOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (flag: string): string => {
      const v = argv[++i];
      if (v === undefined) fail(`${flag} requires a value`);
      return v;
    };
    if (a === '--only') args.only = next(a).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--limit') {
      const n = Number(next(a));
      if (!Number.isInteger(n) || n <= 0) fail('--limit must be a positive integer');
      args.limit = n;
    } else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--all') args.all = true;
    else if (a === '--out') {
      const out = next(a);
      args.outDir = isAbsolute(out) ? resolve(out) : resolve(root, out);
    } else if (a === '--apply') args.apply = true;
    else if (a === '--sheet-only') args.sheetOnly = true;
    else fail(`unknown argument: ${a}`);
  }
  return args;
}

function isSameOrInside(child: string, parent: string): boolean {
  const c = normalize(resolve(child));
  const p = normalize(resolve(parent));
  return c === p || c.startsWith(p.endsWith(sep) ? p : `${p}${sep}`);
}

function assertSafeOutDir(outDir: string): void {
  if (isSameOrInside(outDir, blockedOutRoot)) {
    fail('--out must not be inside public/assets/art; staging must stay separate from shipped art');
  }
}

function enumerateRaws(includeEnvironment: boolean): RawJob[] {
  const dirs: { dir: string; mode: Mode; group: string }[] = [
    { dir: join(tmpdir(), 'gen-card-art'), mode: 'character', group: 'cards' },
    { dir: join(tmpdir(), 'gen-land-art'), mode: 'environment', group: 'lands' },
    { dir: join(tmpdir(), 'gen-spell-art'), mode: 'environment', group: 'spells' },
  ];
  const jobs: RawJob[] = [];
  for (const spec of dirs) {
    if (!includeEnvironment && spec.mode === 'environment') continue;
    let files: string[];
    try {
      files = readdirSync(spec.dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.raw.png')) continue;
      jobs.push({
        id: f.slice(0, -'.raw.png'.length),
        rawPath: join(spec.dir, f),
        mode: spec.mode,
        group: spec.group,
      });
    }
  }
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const job of jobs) {
    if (seen.has(job.id)) dupes.push(job.id);
    seen.add(job.id);
  }
  if (dupes.length > 0) fail(`duplicate raw ids found: ${[...new Set(dupes)].join(', ')}`);
  return jobs.sort((a, b) => a.id.localeCompare(b.id));
}

function filterJobs(jobs: RawJob[], args: Args): RawJob[] {
  let selected = jobs;
  if (args.only) {
    const known = new Set(jobs.map((j) => j.id));
    const unknown = args.only.filter((id) => !known.has(id));
    if (unknown.length > 0) fail(`--only ids not found in selected raw set: ${unknown.join(', ')}`);
    const wanted = new Set(args.only);
    selected = selected.filter((j) => wanted.has(j.id));
  }
  if (args.limit !== undefined) selected = selected.slice(0, args.limit);
  return selected;
}

function isNumberArray(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function parseCropResult(stdout: string): CropResult {
  const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) fail('smartcrop produced no JSON output');
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    fail(`smartcrop produced invalid JSON: ${line}`);
  }
  if (!raw || typeof raw !== 'object') fail('smartcrop JSON was not an object');
  const obj = raw as Record<string, unknown>;
  if (obj.source !== 'face' && obj.source !== 'head' && obj.source !== 'person' && obj.source !== 'center') {
    fail(`smartcrop returned unknown source: ${String(obj.source)}`);
  }
  if (!isNumberArray(obj.crop, 4)) fail('smartcrop returned an invalid crop box');
  if (obj.bbox !== null && !isNumberArray(obj.bbox, 4)) fail('smartcrop returned an invalid bbox');
  if (obj.W !== OUT_W || obj.H !== OUT_H) fail(`smartcrop returned ${String(obj.W)}x${String(obj.H)}, expected ${OUT_W}x${OUT_H}`);
  return {
    source: obj.source,
    bbox: obj.bbox === null ? null : (obj.bbox as [number, number, number, number]),
    crop: obj.crop as [number, number, number, number],
    W: OUT_W,
    H: OUT_H,
  };
}

function runSmartcrop(job: RawJob, dstPath: string): CropResult {
  const tmpPath = `${dstPath}.tmp`;
  rmSync(tmpPath, { force: true });
  const res = spawnSync(
    PYTHON,
    [smartcropPath, job.rawPath, tmpPath, String(OUT_W), String(OUT_H), job.mode],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (res.error) {
    rmSync(tmpPath, { force: true });
    fail(`smartcrop spawn failed for ${job.id}: ${res.error.message}`);
  }
  if (res.status !== 0) {
    rmSync(tmpPath, { force: true });
    const err = (res.stderr ?? '').trim().split(/\r?\n/).slice(-4).join(' | ');
    fail(`smartcrop failed for ${job.id}: ${err || `(exit ${res.status ?? 'unknown'})`}`);
  }
  const result = parseCropResult(res.stdout ?? '');
  renameSync(tmpPath, dstPath);
  return result;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });
}

function fileHref(path: string): string {
  return pathToFileURL(path).href;
}

function fmtTuple(v: [number, number, number, number] | null): string {
  return v ? `[${v.join(', ')}]` : 'null';
}

function sourceRank(source: Source): number {
  if (source === 'center') return 0;
  if (source === 'person') return 1;
  if (source === 'head') return 2;
  return 3;
}

function isMode(value: unknown): value is Mode {
  return value === 'character' || value === 'environment';
}

function isSource(value: unknown): value is Source {
  return value === 'face' || value === 'head' || value === 'person' || value === 'center';
}

function readResults(outDir: string): ReviewRow[] {
  const resultsPath = join(outDir, 'results.json');
  if (!existsSync(resultsPath)) fail(`--sheet-only requires an existing results file: ${resultsPath}`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resultsPath, 'utf8'));
  } catch {
    fail(`could not read valid JSON from ${resultsPath}`);
  }
  if (!Array.isArray(raw)) fail(`results file must contain an array: ${resultsPath}`);

  return raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object') fail(`results[${index}] must be an object`);
    const result = entry as Record<string, unknown>;
    if (typeof result.id !== 'string' || typeof result.group !== 'string' || typeof result.rawPath !== 'string') {
      fail(`results[${index}] has invalid card metadata`);
    }
    if (!isMode(result.mode) || !isSource(result.source)) fail(`results[${index}] has invalid mode or source`);
    if (result.bbox !== null && !isNumberArray(result.bbox, 4)) fail(`results[${index}] has an invalid bbox`);
    if (!isNumberArray(result.crop, 4)) fail(`results[${index}] has an invalid crop`);
    const job: RawJob = {
      id: result.id,
      group: result.group,
      mode: result.mode,
      rawPath: result.rawPath,
    };
    return {
      job,
      oldPath: join(shippedCardsDir, `${job.id}.png`),
      newPath: join(outDir, 'cards', `${job.id}.png`),
      result: {
        source: result.source,
        bbox: result.bbox === null ? null : (result.bbox as [number, number, number, number]),
        crop: result.crop as [number, number, number, number],
        W: OUT_W,
        H: OUT_H,
      },
    };
  });
}

function writeResults(rows: ReviewRow[], outDir: string): string {
  const results: StagedResult[] = rows.map((row) => ({
    id: row.job.id,
    group: row.job.group,
    mode: row.job.mode,
    source: row.result.source,
    bbox: row.result.bbox,
    crop: row.result.crop,
    rawPath: row.job.rawPath,
  }));
  const resultsPath = join(outDir, 'results.json');
  writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  return resultsPath;
}

function artWindowStyle(windowW: number, windowH: number, verticalBias: number): string {
  const scale = Math.max(windowW / OUT_W, windowH / OUT_H);
  const cropW = windowW / scale;
  const cropH = windowH / scale;
  const left = (OUT_W - cropW) / 2;
  const top = (OUT_H - cropH) * verticalBias;
  return [
    `--window-w:${windowW}px`,
    `--window-h:${windowH}px`,
    `--image-w:${OUT_W * scale}px`,
    `--image-h:${OUT_H * scale}px`,
    `--image-x:${-left * scale}px`,
    `--image-y:${-top * scale}px`,
  ].join(';');
}

function cardLabel(id: string): { name: string; type: string } {
  const card = CARD_DB[id];
  return {
    name: card?.name ?? id,
    type: card ? card.types.join(' · ') : id,
  };
}

function renderArt(path: string, alt: string, exists: boolean): string {
  return exists
    ? `<img src="${escapeHtml(fileHref(path))}" alt="${escapeHtml(alt)}">`
    : '<div class="missing-art">missing shipped PNG</div>';
}

function renderInGameContext(path: string, status: string, row: ReviewRow, exists: boolean): string {
  const label = cardLabel(row.job.id);
  const alt = `${status} in-game crop for ${row.job.id}`;
  const art = renderArt(path, alt, exists);
  const fullSize = renderArt(path, `${status} full-size art for ${row.job.id}`, exists);
  return `
    <div class="in-game-context">
      <div class="mock-pair">
        <section class="card-mock" aria-label="${escapeHtml(status)} CardView mock for ${escapeHtml(row.job.id)}">
          <div class="card-name">${escapeHtml(label.name)}</div>
          <div class="art-window card-art-window" style="${artWindowStyle(CARD_ART_W, CARD_ART_H, 0.5)}">${art}</div>
          <div class="card-type">${escapeHtml(label.type)}</div>
          <div class="card-textbox"><span>Card text context</span></div>
          <div class="card-footer">${escapeHtml(row.job.id)}</div>
        </section>
        <section class="tile-context" aria-label="${escapeHtml(status)} BoardCardView mock for ${escapeHtml(row.job.id)}">
          <div class="tile-caption">BoardCardView</div>
          <div class="board-tile">
            <div class="art-window board-art-window" style="${artWindowStyle(BOARD_ART_W, BOARD_ART_H, BOARD_CROP_BIAS)}">${art}</div>
          </div>
        </section>
      </div>
      <div class="full-size">
        <div class="full-size-label">Full-size source</div>
        ${fullSize}
      </div>
    </div>`;
}

function detectionBreakdown(rows: ReviewRow[]): Record<Source, number> {
  const counts: Record<Source, number> = { face: 0, head: 0, person: 0, center: 0 };
  for (const row of rows) counts[row.result.source]++;
  return counts;
}

function writeReview(rows: ReviewRow[], outDir: string): string {
  const sorted = [...rows].sort((a, b) => {
    const bySource = sourceRank(a.result.source) - sourceRank(b.result.source);
    return bySource || a.job.id.localeCompare(b.job.id);
  });
  const counts = detectionBreakdown(rows);
  const total = rows.length;
  const body = sorted.map((row) => {
    const oldExists = existsSync(row.oldPath);
    return `
      <tr class="source-${row.result.source}">
        <td class="meta">
          <div class="id">${escapeHtml(row.job.id)}</div>
          <div>${escapeHtml(row.job.group)} / ${row.job.mode}</div>
          <div class="pill">${row.result.source}</div>
          <div>bbox ${escapeHtml(fmtTuple(row.result.bbox))}</div>
          <div>crop ${escapeHtml(fmtTuple(row.result.crop))}</div>
        </td>
        <td>${renderInGameContext(row.oldPath, 'Shipped', row, oldExists)}</td>
        <td>${renderInGameContext(row.newPath, 'Staged', row, true)}</td>
      </tr>`;
  }).join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Darling Blades Art Smart-Crop Review</title>
  <style>
    body { margin: 24px; background: #17171d; color: #ece8df; font-family: system-ui, sans-serif; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .summary { margin: 0 0 20px; color: #c7c0b2; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-top: 1px solid #33323a; padding: 12px; vertical-align: top; }
    th { position: sticky; top: 0; background: #202029; text-align: left; z-index: 1; }
    .meta { width: 280px; color: #c7c0b2; font-size: 13px; line-height: 1.45; }
    .id { color: #fff; font-weight: 700; font-size: 16px; margin-bottom: 6px; }
    .pill { display: inline-block; margin: 8px 0; padding: 3px 8px; border-radius: 999px; background: #4b5363; color: #fff; }
    .source-center .pill { background: #9a4c4c; }
    .source-person .pill { background: #8a6a28; }
    .source-head .pill { background: #3f6f96; }
    .source-face .pill { background: #4e7d4b; }
    .in-game-context { min-width: 452px; }
    .mock-pair { display: flex; align-items: flex-start; gap: 14px; }
    .card-mock { box-sizing: border-box; width: ${CARD_W}px; height: ${CARD_H}px; padding: 12px 15px; overflow: hidden; border: 3px solid #d6b762; border-radius: 16px; background: linear-gradient(145deg, #4a3b27, #18131e 14%, #292031 88%, #705a2e); box-shadow: 0 5px 15px #0008, inset 0 0 0 1px #fff3; }
    .card-name { height: 30px; display: flex; align-items: center; padding: 0 8px; overflow: hidden; border: 1px solid #bca260; border-radius: 5px 5px 0 0; background: linear-gradient(90deg, #f1e2b5, #bda66d); color: #211916; font-family: Georgia, serif; font-size: 14px; font-weight: 700; white-space: nowrap; text-overflow: ellipsis; }
    .art-window { position: relative; width: var(--window-w); height: var(--window-h); overflow: hidden; background: #0d0d12; }
    .art-window > img { position: absolute; left: var(--image-x); top: var(--image-y); width: var(--image-w); height: var(--image-h); max-width: none; object-fit: fill; }
    .card-art-window { box-shadow: inset 0 0 0 1px #06050a; }
    .card-type { height: 22px; display: flex; align-items: center; padding: 0 7px; overflow: hidden; border: 1px solid #bca260; background: #e9d9a9; color: #2a2018; font-size: 10px; font-weight: 700; white-space: nowrap; text-overflow: ellipsis; }
    .card-textbox { box-sizing: border-box; height: 113px; margin-top: 8px; padding: 9px; border: 1px solid #bca260; border-radius: 3px; background: #eadcb6; color: #786a4e; font-size: 10px; }
    .card-textbox span { opacity: 0.6; }
    .card-footer { padding-top: 5px; color: #eadcb6; font-size: 9px; text-align: right; }
    .tile-context { width: ${BOARD_TILE_W}px; }
    .tile-caption { margin: 4px 0 6px; color: #c7c0b2; font-size: 10px; text-align: center; white-space: nowrap; }
    .board-tile { box-sizing: border-box; width: ${BOARD_TILE_W}px; height: ${BOARD_TILE_H}px; padding: 2px; border: 2px solid #a98dce; border-radius: 6px; background: #0d0b16; box-shadow: 0 3px 8px #0008; }
    .board-art-window { box-shadow: inset 0 0 0 1px #1a1526; }
    .full-size { width: 160px; margin-top: 12px; color: #c7c0b2; font-size: 12px; }
    .full-size-label { margin-bottom: 5px; }
    .full-size img { width: 160px; height: 200px; margin-top: 8px; object-fit: contain; background: #0d0d12; }
    .missing-art { display: grid; width: 100%; height: 100%; place-items: center; background: #2a1720; color: #ffb4b4; font-size: 10px; text-align: center; }
  </style>
</head>
<body>
  <h1>Darling Blades Art Smart-Crop Review</h1>
  <p class="summary">Total ${total}; face ${counts.face}, head ${counts.head}, person ${counts.person}, center ${counts.center}. Center fallbacks are listed first.</p>
  <table>
    <thead><tr><th>Card</th><th>Shipped → in-game</th><th>Staged Smart Crop → in-game</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
  const reviewPath = join(outDir, 'review.html');
  writeFileSync(reviewPath, html, 'utf8');
  return reviewPath;
}

function applyStaged(rows: ReviewRow[]): void {
  mkdirSync(shippedCardsDir, { recursive: true });
  for (const row of rows) {
    const dst = join(shippedCardsDir, `${row.job.id}.png`);
    const tmp = `${dst}.tmp`;
    copyFileSync(row.newPath, tmp);
    renameSync(tmp, dst);
  }
  // shell:true — spawning npm.cmd directly without a shell throws on
  // Node ≥ 20.12 (CVE-2024-27980 hardening); same form as the gen-*art drivers.
  const halfres = spawnSync('npm run gen-art-halfres', { shell: true, stdio: 'inherit' });
  if (halfres.status !== 0) fail('gen-art-halfres failed after --apply');
  const manifest = spawnSync('npm run gen-art-manifest', { shell: true, stdio: 'inherit' });
  if (manifest.status !== 0) fail('gen-art-manifest failed after --apply');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  assertSafeOutDir(args.outDir);
  if (args.sheetOnly) {
    if (args.apply) fail('--sheet-only cannot be combined with --apply');
    const rows = readResults(args.outDir);
    const reviewPath = writeReview(rows, args.outDir);
    const counts = detectionBreakdown(rows);
    console.log(
      `recrop-art: rebuilt review for ${rows.length} staged crop(s); ` +
        `face=${counts.face}, head=${counts.head}, person=${counts.person}, center=${counts.center}; ` +
        `review=${reviewPath}`,
    );
    return;
  }
  const jobs = filterJobs(enumerateRaws(args.all), args);
  console.log(
    `recrop-art: ${jobs.length} raw(s) selected` +
      `${args.all ? ' (characters + environments)' : ' (characters only)'}` +
      ` -> ${args.outDir}`,
  );
  if (args.dryRun) {
    for (const job of jobs) console.log(`  ${job.id.padEnd(30)} ${job.mode.padEnd(11)} ${job.rawPath}`);
    console.log('recrop-art: dry run - nothing written');
    return;
  }
  if (jobs.length === 0) {
    console.log('recrop-art: nothing to do');
    return;
  }

  const cardsOutDir = join(args.outDir, 'cards');
  mkdirSync(cardsOutDir, { recursive: true });
  if (args.force) {
    for (const f of readdirSync(cardsOutDir)) {
      if (f.endsWith('.tmp')) rmSync(join(cardsOutDir, f), { force: true });
    }
  }

  const rows: ReviewRow[] = [];
  const started = Date.now();
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const newPath = join(cardsOutDir, `${job.id}.png`);
    process.stdout.write(`[${i + 1}/${jobs.length}] ${job.id} ... `);
    const result = runSmartcrop(job, newPath);
    rows.push({
      job,
      oldPath: join(shippedCardsDir, `${job.id}.png`),
      newPath,
      result,
    });
    console.log(result.source);
  }

  const resultsPath = writeResults(rows, args.outDir);
  const reviewPath = writeReview(rows, args.outDir);
  const counts = detectionBreakdown(rows);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
      `recrop-art: staged ${rows.length}/${jobs.length} in ${secs}s; ` +
      `face=${counts.face}, head=${counts.head}, person=${counts.person}, center=${counts.center}; ` +
      `results=${resultsPath}; review=${reviewPath}`,
  );

  if (args.apply) {
    applyStaged(rows);
    console.log(`recrop-art: applied ${rows.length} staged crop(s) to shipped art`);
  }
}

main();
