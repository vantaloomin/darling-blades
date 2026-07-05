/**
 * Builds the half-res mobile art set: every public/assets/art/cards/<id>.png
 * gets a 320×400 sibling in public/assets/art/cards-half/<id>.png
 * (mobile-lan-plan §1.6 — the lite quality tier loads these instead of the
 * 640×800 originals, cutting card-art VRAM ~4×).
 *
 * Works over whatever subset of the full art set exists today (the 152-card
 * art run is resumable and may be partial); safely re-runnable after any art
 * drop:
 *   - incremental: an up-to-date half (newer than its source) is skipped
 *   - orphans (halves whose source PNG was removed) are pruned
 *   - writes go via tmp + rename, so an interrupted run never leaves a
 *     truncated PNG that later runs would treat as done
 *
 * Resizing uses Pillow (the same toolchain as scripts/gen-card-art.ts) in a
 * single python process for the whole batch, with the same center cover-crop
 * math the card frame uses — any source aspect still yields exactly 320×400.
 * After a changing run it re-runs gen-art-manifest so the game's manifest
 * lists the new halves.
 *
 * Usage: npx tsx scripts/gen-art-halfres.ts [--force] [--dry-run]
 *   --force    rebuild every half even if up to date
 *   --dry-run  report what would happen, touch nothing
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'public', 'assets', 'art', 'cards');
const outDir = join(root, 'public', 'assets', 'art', 'cards-half');

const OUT_W = 320;
const OUT_H = 400;

const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

/**
 * Batch resizer: reads [[src, dst], …] as JSON on stdin. Center cover-crop to
 * the target aspect, LANCZOS resize, atomic replace. Prints one line per
 * failure and a final "done <n>" so partial batches are diagnosable.
 */
const RESIZE_PY = `
import json, os, sys
from PIL import Image
w, h = int(sys.argv[1]), int(sys.argv[2])
jobs = json.load(sys.stdin)
ok = 0
for src, dst in jobs:
    try:
        im = Image.open(src).convert('RGB')
        scale = max(w / im.width, h / im.height)
        cw, ch = min(im.width, round(w / scale)), min(im.height, round(h / scale))
        left, top = (im.width - cw) // 2, (im.height - ch) // 2
        tmp = dst + '.tmp'
        im.crop((left, top, left + cw, top + ch)).resize((w, h), Image.LANCZOS).save(tmp, 'PNG', optimize=True)
        os.replace(tmp, dst)
        ok += 1
    except Exception as e:
        print(f'FAIL {os.path.basename(src)}: {e}', file=sys.stderr)
print(f'done {ok}')
`;

function fail(msg: string): never {
  console.error(`gen-art-halfres: ${msg}`);
  process.exit(1);
}

function main(): void {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const dryRun = argv.includes('--dry-run');
  const unknown = argv.filter((a) => a !== '--force' && a !== '--dry-run');
  if (unknown.length > 0) fail(`unknown argument(s): ${unknown.join(' ')}`);

  let sources: string[] = [];
  try {
    sources = readdirSync(srcDir)
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .sort();
  } catch {
    // source dir absent — nothing to build, but still prune below
  }
  const sourceSet = new Set(sources);

  mkdirSync(outDir, { recursive: true });

  // Prune: halves whose source is gone, plus stray .tmp from interrupted runs.
  let pruned = 0;
  for (const f of readdirSync(outDir)) {
    const isTmp = f.endsWith('.tmp');
    const isOrphan = f.toLowerCase().endsWith('.png') && !sourceSet.has(f);
    if (!isTmp && !isOrphan) continue;
    if (!dryRun) rmSync(join(outDir, f), { force: true });
    pruned++;
  }

  const stale = (f: string): boolean => {
    const out = join(outDir, f);
    if (!existsSync(out)) return true;
    return statSync(join(srcDir, f)).mtimeMs > statSync(out).mtimeMs;
  };
  const todo = sources.filter((f) => force || stale(f));
  const skipped = sources.length - todo.length;

  console.log(
    `gen-art-halfres: ${sources.length} source(s) — ${todo.length} to build, ` +
      `${skipped} up to date, ${pruned} pruned${dryRun ? ' (dry run)' : ''}`,
  );
  if (dryRun) return;

  let built = 0;
  if (todo.length > 0) {
    const pil = spawnSync(PYTHON, ['-c', 'import PIL'], { encoding: 'utf8' });
    if (pil.status !== 0) fail('Pillow is required — `pip install pillow` and rerun');

    const jobs = todo.map((f) => [join(srcDir, f), join(outDir, f)]);
    const res = spawnSync(PYTHON, ['-c', RESIZE_PY, String(OUT_W), String(OUT_H)], {
      input: JSON.stringify(jobs),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (res.error) fail(`python spawn failed: ${res.error.message}`);
    const errors = (res.stderr ?? '').trim();
    if (errors) console.error(errors);
    const done = /done (\d+)/.exec(res.stdout ?? '');
    built = done ? Number(done[1]) : 0;
    console.log(`gen-art-halfres: built ${built}/${todo.length} at ${OUT_W}×${OUT_H}`);
    if (res.status !== 0 || built !== todo.length) {
      process.exitCode = 1;
    }
  }

  // Keep the manifest in step whenever the half set changed — including
  // prune-only runs, or a stale entry would 404 on the lite tier. (dev/build
  // regenerate it anyway; this covers a dev server that is already up.)
  if (built > 0 || pruned > 0) {
    const manifest = spawnSync('npm run gen-art-manifest', { shell: true, stdio: 'inherit' });
    if (manifest.status !== 0) fail('gen-art-manifest failed — run `npm run gen-art-manifest` manually');
  }
}

main();
