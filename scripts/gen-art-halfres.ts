/**
 * Builds the half-res mobile art set: every public/assets/art/cards/<id>.webp
 * gets a q85 320×400 sibling in public/assets/art/cards-half/<id>.webp
 * (mobile-lan-plan §1.6 — the lite quality tier loads these instead of the
 * 640×800 originals, cutting card-art VRAM ~4×).
 *
 * Works over whatever subset of the full art set exists today (the 152-card
 * art run is resumable and may be partial); safely re-runnable after any art
 * drop:
 *   - incremental: an up-to-date half (newer than its source) is skipped
 *   - orphans (halves whose source WebP was removed) are pruned
 *   - writes go via tmp + rename, so an interrupted run never leaves a
 *     truncated WebP that later runs would treat as done
 *
 * Resizing uses Pillow (the same toolchain as scripts/gen-card-art.ts) in a
 * single python process for the whole batch, with the same center cover-crop
 * math the card frame uses — any source aspect still yields exactly 320×400.
 * After a changing run it re-runs gen-art-manifest so the game's manifest
 * lists the new halves.
 *
 * The Pages deploy (.github/workflows/deploy.yml) runs this on every build,
 * because the half set is derived and gitignored: phones on the live site load
 * it. A CI checkout has no halves, so it builds the whole set, and passes
 * --jobs to use the runner's cores.
 *
 * Usage: npx tsx scripts/gen-art-halfres.ts [--force] [--dry-run] [--jobs N]
 *   --force    rebuild every half even if up to date
 *   --dry-run  report what would happen, touch nothing
 *   --jobs N   resize N files at a time (default 1; Pillow releases the GIL
 *              while it decodes, resamples and encodes, so threads scale).
 *              Mind the machine's CPU budget before raising it locally.
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
const QUALITY = 85;

const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

/**
 * Batch resizer: reads [[src, dst], …] as JSON on stdin. Center cover-crop to
 * the target aspect, LANCZOS resize, atomic replace. Prints one line per
 * failure and a final "done <n>" so partial batches are diagnosable.
 */
const RESIZE_PY = `
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
w, h, q, workers = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
jobs = json.load(sys.stdin)
def one(job):
    src, dst = job
    try:
        im = Image.open(src).convert('RGB')
        scale = max(w / im.width, h / im.height)
        cw, ch = min(im.width, round(w / scale)), min(im.height, round(h / scale))
        left, top = (im.width - cw) // 2, (im.height - ch) // 2
        tmp = dst + '.tmp'
        im.crop((left, top, left + cw, top + ch)).resize((w, h), Image.LANCZOS).save(tmp, 'WEBP', quality=q, method=6)
        os.replace(tmp, dst)
        return True
    except Exception as e:
        print(f'FAIL {os.path.basename(src)}: {e}', file=sys.stderr)
        return False
with ThreadPoolExecutor(max_workers=workers) as pool:
    ok = sum(1 for built in pool.map(one, jobs) if built)
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
  const jobsAt = argv.indexOf('--jobs');
  const jobsArg = jobsAt >= 0 ? argv[jobsAt + 1] : undefined;
  if (jobsAt >= 0 && (jobsArg === undefined || !/^[1-9]\d*$/.test(jobsArg))) {
    fail('--jobs needs a whole number of at least 1');
  }
  const workers = jobsArg === undefined ? 1 : Number(jobsArg);
  const unknown = argv.filter(
    (a, i) => a !== '--force' && a !== '--dry-run' && a !== '--jobs' && (jobsAt < 0 || i !== jobsAt + 1),
  );
  if (unknown.length > 0) fail(`unknown argument(s): ${unknown.join(' ')}`);

  let sources: string[] = [];
  try {
    sources = readdirSync(srcDir)
      .filter((f) => f.toLowerCase().endsWith('.webp'))
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
    const isOrphan =
      (f.toLowerCase().endsWith('.webp') || f.toLowerCase().endsWith('.png')) && !sourceSet.has(f);
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
    const res = spawnSync(PYTHON, ['-c', RESIZE_PY, String(OUT_W), String(OUT_H), String(QUALITY), String(workers)], {
      input: JSON.stringify(jobs),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (res.error) fail(`python spawn failed: ${res.error.message}`);
    const errors = (res.stderr ?? '').trim();
    if (errors) console.error(errors);
    const done = /done (\d+)/.exec(res.stdout ?? '');
    built = done ? Number(done[1]) : 0;
    console.log(
      `gen-art-halfres: built ${built}/${todo.length} at ${OUT_W}×${OUT_H}, q${QUALITY}` +
        (workers > 1 ? `, ${workers} at a time` : ''),
    );
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
