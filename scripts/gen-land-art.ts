/**
 * Generates real land-card art from the docs/land-art.md prompts via the
 * chatgpt-imagegen CLI (backed by the user's ChatGPT subscription — see the
 * `anthropic-skills:chatgpt-imagegen` skill), then post-processes each image to
 * the exact 640×800 PNG deliverable (docs/land-art.md §1) at
 * `public/assets/art/cards/<land-id>.png` — the SAME directory and dimensions
 * as the creature card faces, so `scripts/gen-art-manifest.ts` + `ArtResolver`
 * pick the files up automatically. Existing PNGs are skipped, so the run is
 * idempotent and resumable. After a generating batch it re-runs
 * `npm run gen-art-manifest` so the game picks the files up.
 *
 * Sibling of scripts/gen-card-art.ts, same hardened architecture: each prompt
 * is assembled as [LANDSCAPE PREAMBLE] + [entry Prompt line] + [NEGATIVES].
 * But lands are TERRAIN, not characters — the preamble is ENVIRONMENT-FIRST
 * (mirroring scripts/gen-scene-art.ts): it demands wide landscape scenery with
 * the key terrain in the central band and NO character/people/figures. The
 * card driver's "waist-up, face at center" composition prefix would be exactly
 * wrong here, so it is replaced, not reused. Inspect the exact text with
 * --show-prompt.
 *
 * Usage:
 *   npx tsx scripts/gen-land-art.ts [--only id1,id2] [--limit N]
 *                                   [--dry-run] [--show-prompt] [--force]
 *                                   [--cli <path>]
 *
 *   --only a,b        only these land ids
 *   --limit N         generate at most N images this run (skips don't count)
 *   --dry-run         list what would generate, touch nothing
 *   --show-prompt     print the fully assembled prompt (preamble + entry +
 *                     negatives) for every matched entry, touch nothing
 *   --force           regenerate ids whose PNG already exists
 *   --cli <path>      path to the chatgpt-imagegen python script (otherwise
 *                     $CHATGPT_IMAGEGEN_CLI, then a search of the local
 *                     skills-plugin install, then `chatgpt-imagegen` on PATH)
 *
 * The backend only supports a few sizes; we generate at 1024×1536 (nearest
 * larger portrait) and center cover-crop to 4:5 / 640×800 with Pillow, exactly
 * the crop math the card frame itself uses (docs/art-pipeline.md), so the land's
 * iconic terrain composed in the central vertical band survives the crop into
 * CardView's ART_RECT window. Raw uncropped originals are kept in
 * <tmp>/gen-land-art/ for inspection and reused on rerun.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docPath = join(root, 'docs', 'land-art.md');
const outDir = join(root, 'public', 'assets', 'art', 'cards');
const rawDir = join(tmpdir(), 'gen-land-art');

const OUT_W = 640;
const OUT_H = 800;
/** Nearest larger portrait size the image backend verifiably accepts (2:3). */
const GEN_SIZE = '1024x1536';
/** Per-image budget passed to the CLI (seconds) — detailed environments can run 2–3 min. */
const GEN_TIMEOUT_S = 300;

/**
 * Every prompt is assembled as [LANDSCAPE PREAMBLE] + [entry prompt] +
 * [NEGATIVES]. The binding contract is docs/land-art.md §1: the same cel-gacha
 * house style as the cards (docs/art-bible/index.md §2) but ENVIRONMENT-FIRST —
 * lands are terrain, not character splashes. This preamble mirrors
 * scripts/gen-scene-art.ts's stage prefix (wide scenery, no focal character),
 * NOT gen-card-art.ts's "waist-up, face at the vertical center" prefix, which
 * would decapitate a landscape by demanding a figure that isn't there.
 *
 * The central-band clause is load-bearing and shares the card driver's cause:
 * CardView cover-crops the 640×800 source into a 264×192 window showing only
 * the middle 58.2 % vertical band (docs/art-bible/index.md §3), so the land's
 * iconic terrain element must sit in that central band or the card window crops
 * the readable subject away. Same safe-zone discipline as creatures — just
 * scenery instead of a figure.
 */
const PREAMBLE =
  // Composition: environment-first, iconic terrain in the central band (measured — see above).
  'Composition: a wide fully-rendered landscape filling the entire frame with scenery — ' +
  'terrain, not a character splash. NO character, no people, no figures, no faces, no ' +
  'portrait framing; at most a tiny distant unreadable silhouette where the scene calls ' +
  'for one. Place the iconic terrain element and the horizon in the central vertical band ' +
  'of the image (the middle band is the only part the card window shows), with coherent ' +
  'sky above and foreground below. ' +
  // Cel DNA + scenic environment register (mirrors land-art.md §1 / art-bible §2).
  'Style: crisp cel-shaded gacha anime landscape art — clean confident inked environmental ' +
  'linework with line-weight variation, hard-edged cel shading in two to three tone steps, ' +
  'bright anime specular highlights on water, stone and foliage, saturated but atmospheric ' +
  'color with real depth and story, in the painted anime key-visual idiom. The illustration ' +
  'is completely text-free. ';

/**
 * Negative block appended after the entry prompt. The first three lines are the
 * NO-TEXT hard rule, carried VERBATIM from scripts/gen-card-art.ts (the
 * backends' nameplate/CJK habit doesn't care that this is a landscape); the
 * rest swaps the card driver's anatomy negatives for a no-people guard plus
 * environment/style-breaker negatives.
 */
const NEGATIVES =
  ' Strictly no text of any kind anywhere in the image: no words, letters, numbers, ' +
  'nameplates, captions, titles, logos, watermarks, signatures, or calligraphy panels, ' +
  'no CJK glyphs — banners, sails, seals, and sashes render blank or patterned, never lettered. ' +
  'No characters, no people, no faces, no portrait framing, no figure larger than a distant ' +
  'silhouette. NOT painterly, NOT soft-focus, NOT 3D render, NOT photorealistic, NOT a rough ' +
  'sketch; no flat color-wash, empty-gradient, or cutout-sticker look; no muddy or ' +
  'desaturated palette, no lens flare, no vignette borders, no watermark corners.';

// The entry Prompt line ends unpunctuated ("… 640×800 portrait"), so close the
// sentence before the negatives block.
const assemblePrompt = (entry: Entry): string => PREAMBLE + entry.prompt + '.' + NEGATIVES;

const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

// --- arg parsing ---------------------------------------------------------------

interface Args {
  only?: string[];
  limit?: number;
  dryRun: boolean;
  showPrompt: boolean;
  force: boolean;
  cli?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, showPrompt: false, force: false };
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
    else if (a === '--show-prompt') args.showPrompt = true;
    else if (a === '--force') args.force = true;
    else if (a === '--cli') args.cli = next(a);
    else fail(`unknown argument: ${a}`);
  }
  return args;
}

function fail(msg: string): never {
  console.error(`gen-land-art: ${msg}`);
  process.exit(1);
}

// --- land-art.md parsing ---------------------------------------------------------

interface Entry {
  id: string; // land id = output filename stem
  name: string;
  prompt: string;
}

/**
 * (land-id → prompt) pairs from docs/land-art.md, in file order: `### Name — `id``
 * headings plus the Prompt field. Fenced code blocks are skipped so
 * documentation examples can never masquerade as entries.
 */
function parseDoc(): Entry[] {
  const content = readFileSync(docPath, 'utf8');
  const entries: Entry[] = [];
  let open: Entry | null = null;
  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = line.match(/^### (.+?) — `([^`]+)`\s*$/);
    if (heading) {
      open = { id: heading[2], name: heading[1], prompt: '' };
      entries.push(open);
      continue;
    }
    const prompt = line.match(/^- \*\*Prompt:\*\* ?(.*)$/);
    if (prompt && open) open.prompt = prompt[1].trim();
  }

  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const e of entries) {
    if (seen.has(e.id)) dupes.push(e.id);
    seen.add(e.id);
  }
  if (dupes.length > 0) fail(`land-art.md: duplicate land ids: ${dupes.join(', ')}`);
  const missing = entries.filter((e) => e.prompt === '');
  if (missing.length > 0) {
    fail(`land-art.md: entries missing a Prompt field: ${missing.map((e) => e.id).join(', ')}`);
  }
  if (entries.length === 0) fail('land-art.md: no land entries found');
  return entries;
}

// --- imagegen CLI resolution -------------------------------------------------------

/** Search the local Claude skills-plugin install for the bundled CLI script. */
function findSkillCli(): string | undefined {
  const appData = process.env.APPDATA;
  if (!appData) return undefined;
  const base = join(appData, 'Claude', 'local-agent-mode-sessions', 'skills-plugin');
  try {
    for (const a of readdirSync(base)) {
      for (const b of readdirSync(join(base, a))) {
        const candidate = join(base, a, b, 'skills', 'chatgpt-imagegen', 'chatgpt-imagegen');
        if (existsSync(candidate)) return candidate;
      }
    }
  } catch {
    // no local skills install — fall through
  }
  return undefined;
}

/** argv prefix that invokes the imagegen CLI (it's a #!python script, so run it via python). */
function resolveCli(explicit?: string): string[] {
  const path = explicit ?? process.env.CHATGPT_IMAGEGEN_CLI ?? findSkillCli();
  if (path) {
    if (!existsSync(path)) fail(`imagegen CLI not found at ${path}`);
    return [PYTHON, path];
  }
  // Last resort: a PATH install (e.g. a wrapper the user set up themselves).
  // Shell-less spawnSync only resolves .exe on Windows — a .cmd/.bat wrapper
  // would ENOENT on every entry, so fail fast with instructions instead.
  if (process.platform === 'win32') {
    fail('no imagegen CLI found — pass --cli <path> or set CHATGPT_IMAGEGEN_CLI');
  }
  return ['chatgpt-imagegen'];
}

// --- generation ----------------------------------------------------------------

/** Cover-crop to 4:5 (center vertical band — same math as the card frame) and resize. */
const POSTPROCESS_PY = `
import sys
from PIL import Image
src, dst, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert('RGB')
scale = max(w / im.width, h / im.height)
cw, ch = min(im.width, round(w / scale)), min(im.height, round(h / scale))
left, top = (im.width - cw) // 2, (im.height - ch) // 2
im.crop((left, top, left + cw, top + ch)).resize((w, h), Image.LANCZOS).save(dst, 'PNG')
`;

function generateOne(
  cliArgv: string[],
  entry: Entry,
  force: boolean,
): { ok: boolean; error?: string; reusedRaw?: boolean } {
  const rawPath = join(rawDir, `${entry.id}.raw.png`);
  const outPath = join(outDir, `${entry.id}.png`);
  const tmpPath = `${outPath}.tmp`;
  const prompt = assemblePrompt(entry);

  // A raw original left by a previous run (its post-process failed or the
  // batch was interrupted) makes the paid generation call unnecessary —
  // re-crop it instead. --force always regenerates (that's its purpose:
  // getting a NEW image, not a re-crop of the rejected one).
  const reusedRaw = !force && existsSync(rawPath);
  if (!reusedRaw) {
    const gen = spawnSync(
      cliArgv[0],
      [
        ...cliArgv.slice(1),
        prompt,
        '-o',
        rawPath,
        '--size',
        GEN_SIZE,
        '--timeout',
        String(GEN_TIMEOUT_S),
        '--quiet',
        '--no-progress',
      ],
      { encoding: 'utf8', timeout: (GEN_TIMEOUT_S + 60) * 1000 },
    );
    if (gen.error) return { ok: false, error: `spawn failed: ${gen.error.message}` };
    if (gen.status !== 0) {
      const tail = (gen.stderr ?? '').trim().split('\n').slice(-3).join(' | ');
      return { ok: false, error: `imagegen exited ${gen.status}: ${tail || '(no stderr)'}` };
    }
    if (!existsSync(rawPath)) return { ok: false, error: 'imagegen reported success but wrote no file' };
  }

  // Write via temp + rename: an interrupted write must never leave a truncated
  // <id>.png that skip-existing would forever treat as done (the manifest and
  // resolver trust file presence).
  const post = spawnSync(
    PYTHON,
    ['-c', POSTPROCESS_PY, rawPath, tmpPath, String(OUT_W), String(OUT_H)],
    { encoding: 'utf8' },
  );
  if (post.status !== 0) {
    rmSync(tmpPath, { force: true });
    return { ok: false, error: `post-process failed: ${(post.stderr ?? '').trim().split('\n').pop()}` };
  }
  renameSync(tmpPath, outPath);
  return { ok: true, reusedRaw };
}

// --- main ------------------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  let entries = parseDoc();

  if (args.only) {
    const known = new Set(entries.map((e) => e.id));
    const unknown = args.only.filter((id) => !known.has(id));
    if (unknown.length > 0) fail(`--only ids not in docs/land-art.md: ${unknown.join(', ')}`);
    const wanted = new Set(args.only);
    entries = entries.filter((e) => wanted.has(e.id));
  }

  // Prompt-inspection mode: print the exact assembled prompt(s) and exit
  // without generating — review text before a batch burns quota.
  if (args.showPrompt) {
    for (const e of entries) {
      console.log(`--- ${e.id} ---`);
      console.log(assemblePrompt(e));
    }
    console.log(`gen-land-art: --show-prompt — ${entries.length} prompt(s) shown, nothing generated`);
    return;
  }

  const exists = (e: Entry): boolean => existsSync(join(outDir, `${e.id}.png`));
  const skipped = args.force ? [] : entries.filter(exists);
  let todo = args.force ? entries : entries.filter((e) => !exists(e));
  if (args.limit !== undefined) todo = todo.slice(0, args.limit);

  console.log(
    `gen-land-art: ${entries.length} land${entries.length === 1 ? '' : 's'} matched — ` +
      `${todo.length} to generate, ${skipped.length} already on disk`,
  );

  if (args.dryRun) {
    for (const e of entries) {
      const state = !args.force && exists(e) ? 'exists — skip (use --force)' : todo.includes(e) ? 'would generate' : 'beyond --limit';
      console.log(`  ${e.id.padEnd(26)} ${state}`);
    }
    console.log('gen-land-art: dry run — nothing generated');
    return;
  }
  if (todo.length === 0) {
    console.log('gen-land-art: nothing to do');
    return;
  }

  mkdirSync(outDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });
  const cliArgv = resolveCli(args.cli);

  // Preflight the post-processor BEFORE burning any generation quota — a
  // missing Pillow would otherwise fail every entry after its paid call.
  const pil = spawnSync(PYTHON, ['-c', 'import PIL'], { encoding: 'utf8' });
  if (pil.status !== 0) fail('Pillow is required for post-processing — `pip install pillow` and rerun');

  const failures: { id: string; error: string }[] = [];
  let generated = 0;
  let consecutiveFailures = 0;
  const batchStart = Date.now();
  for (let i = 0; i < todo.length; i++) {
    const entry = todo[i];
    const t0 = Date.now();
    process.stdout.write(`[${i + 1}/${todo.length}] ${entry.id} … `);
    const res = generateOne(cliArgv, entry, args.force);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (res.ok) {
      generated++;
      consecutiveFailures = 0;
      console.log(`ok in ${secs}s${res.reusedRaw ? ' (re-cropped existing raw — no quota spent)' : ''}`);
    } else {
      failures.push({ id: entry.id, error: res.error ?? 'unknown error' });
      consecutiveFailures++;
      console.log(`FAILED after ${secs}s — ${res.error}`);
      if (consecutiveFailures >= 3) {
        console.error(
          'gen-land-art: 3 consecutive failures — aborting batch to protect quota ' +
            '(the default run resumes where it left off)',
        );
        break;
      }
    }
  }

  const totalMin = ((Date.now() - batchStart) / 60000).toFixed(1);
  console.log(
    `gen-land-art: ${generated}/${todo.length} generated in ${totalMin} min` +
      (failures.length > 0 ? `, ${failures.length} failed` : '') +
      ` (raw originals in ${rawDir})`,
  );
  for (const f of failures) console.error(`  FAIL ${f.id}: ${f.error}`);

  if (generated > 0) {
    const manifest = spawnSync('npm run gen-art-manifest', { shell: true, stdio: 'inherit' });
    if (manifest.status !== 0) fail('gen-art-manifest failed — run `npm run gen-art-manifest` manually');
  }
  if (failures.length > 0) process.exitCode = 1;
}

main();
