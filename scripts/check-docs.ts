/**
 * Anti-rot mtime warner. Scans README.md + docs/**\/*.md for the
 * `<!-- source-of-truth: ... · last-verified: YYYY-MM-DD -->` header and flags
 * docs whose source-of-truth paths (files, directories, or `*` globs) changed
 * after the last-verified date (treated as end-of-day local time). Exits 0 by
 * default (it warns); `--strict` exits 1 if any doc is stale. Run via
 * `npm run check-docs`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');

// --- doc discovery -----------------------------------------------------------

function listMarkdown(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(p));
    else if (entry.name.toLowerCase().endsWith('.md')) out.push(p);
  }
  return out.sort();
}

const docs = [join(root, 'README.md'), ...listMarkdown(join(root, 'docs'))];

// --- header parsing ----------------------------------------------------------

interface Header {
  sources: string[];
  lastVerified?: string; // YYYY-MM-DD
}

function parseHeader(content: string): Header | null {
  const comment = content.match(/^\s*<!--([\s\S]*?)-->/);
  if (!comment) return null;
  // Source list is a single line of comma-separated paths, ended by `·` or EOL.
  const src = comment[1].match(/source-of-truth:\s*([^·\r\n]+)/);
  if (!src) return null;
  const sources = src[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const lv = comment[1].match(/last-verified:\s*(\d{4}-\d{2}-\d{2})/);
  return { sources, lastVerified: lv?.[1] };
}

// --- mtime resolution --------------------------------------------------------

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist']);

interface Newest {
  mtime: number;
  file: string; // the concrete file carrying that mtime
}

function newestInDir(dir: string): Newest | null {
  let best: Newest | null = null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    const candidate = entry.isDirectory()
      ? newestInDir(p)
      : { mtime: statSync(p).mtimeMs, file: p };
    if (candidate && (!best || candidate.mtime > best.mtime)) best = candidate;
  }
  return best;
}

/** Resolve a source-of-truth path (file, directory, or `*` glob) to its newest mtime. */
function resolveNewest(source: string): Newest | null {
  const abs = join(root, source);
  if (source.includes('*')) {
    // Only `*` in the final segment is supported (e.g. src/data/cards/*.ts).
    const dir = dirname(abs);
    const pattern = new RegExp(
      '^' + abs.slice(dir.length + 1).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    let best: Newest | null = null;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !pattern.test(entry.name)) continue;
      const p = join(dir, entry.name);
      const mtime = statSync(p).mtimeMs;
      if (!best || mtime > best.mtime) best = { mtime, file: p };
    }
    return best;
  }
  const st = statSync(abs, { throwIfNoEntry: false });
  if (!st) return null;
  return st.isDirectory() ? newestInDir(abs) : { mtime: st.mtimeMs, file: abs };
}

// --- report ------------------------------------------------------------------

function endOfDay(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function fmt(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

let staleDocs = 0;
let warnings = 0;

for (const doc of docs) {
  const rel = relative(root, doc).replace(/\\/g, '/');
  const header = parseHeader(readFileSync(doc, 'utf8'));

  if (!header) {
    console.log(`warn   ${rel} — no source-of-truth header`);
    warnings++;
    continue;
  }
  if (!header.lastVerified) {
    console.log(`note   ${rel} — header has no last-verified date (staleness not checked)`);
    continue;
  }

  const verifiedUntil = endOfDay(header.lastVerified);
  const staleLines: string[] = [];
  for (const source of header.sources) {
    const newest = resolveNewest(source);
    if (!newest) {
      staleLines.push(`  warn ${source} — path not found`);
      warnings++;
    } else if (newest.mtime > verifiedUntil) {
      const via = relative(root, newest.file).replace(/\\/g, '/');
      const detail = via === source ? '' : ` (via ${via})`;
      staleLines.push(`  - ${source} changed ${fmt(newest.mtime)}${detail}`);
    }
  }

  const hasStale = staleLines.some((l) => l.startsWith('  - '));
  if (hasStale) staleDocs++;
  const status = hasStale ? 'STALE ' : 'ok    ';
  console.log(`${status} ${rel} (last-verified ${header.lastVerified})`);
  for (const line of staleLines) console.log(line);
}

console.log(
  `\ncheck-docs: ${docs.length} doc(s), ${staleDocs} stale, ${warnings} warning(s)` +
    (staleDocs > 0 ? ' — re-verify the doc(s) and bump last-verified' : ''),
);
if (strict && staleDocs > 0) process.exit(1);
