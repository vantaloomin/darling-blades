/**
 * Generates the scene/menu art program from the docs/scene-art.md prompts via
 * the chatgpt-imagegen CLI (backed by the user's ChatGPT subscription — see
 * the `anthropic-skills:chatgpt-imagegen` skill), then post-processes each
 * image to its per-asset deliverable resolution (docs/scene-art.md §2 —
 * 1280×720 for stage backdrops, 640×800 for card-back/pack-art) at
 * `public/assets/art/scenes/<asset-key>.png`. Existing PNGs are skipped, so
 * the run is idempotent and resumable.
 *
 * Sibling of scripts/gen-card-art.ts, same architecture: each prompt is
 * assembled as [COMPOSITION+STYLE PREAMBLE] + [entry Prompt line] +
 * [NEGATIVES]. The scene contract lives in docs/scene-art.md §1 and the
 * preamble/negatives below mirror it — environment-first (wide establishing
 * composition, no focal character) instead of the card driver's waist-up
 * portrait prefix. Inspect the exact text with --show-prompt.
 *
 * Unlike the card driver there is NO manifest step afterward: the scenes
 * manifest / loader wiring is a later integration task (docs/scene-art.md §3);
 * until it lands, generated files are inert — nothing requests them.
 *
 * Usage:
 *   npx tsx scripts/gen-scene-art.ts [--only key1,key2] [--limit N]
 *                                    [--dry-run] [--show-prompt] [--force]
 *                                    [--cli <path>]
 *
 *   --only a,b        only these asset keys
 *   --limit N         generate at most N images this run (skips don't count)
 *   --dry-run         list what would generate, touch nothing
 *   --show-prompt     print the fully assembled prompt (preamble + entry +
 *                     negatives) for every matched entry, touch nothing
 *   --force           regenerate keys whose PNG already exists
 *   --cli <path>      path to the chatgpt-imagegen python script (otherwise
 *                     $CHATGPT_IMAGEGEN_CLI, then a search of the local
 *                     skills-plugin install, then `chatgpt-imagegen` on PATH)
 *
 * The backend only supports a few sizes; we generate at the nearest larger
 * supported size in the asset's orientation — 1536×1024 for landscape stages,
 * 1024×1536 for the two portrait assets (both verified sizes per the skill
 * docs) — and center cover-crop to the exact deliverable with Pillow, the
 * same crop math the card pipeline uses. Raw uncropped originals are kept in
 * <tmp>/gen-scene-art/ for inspection and are reused on rerun (a leftover raw
 * is re-cropped instead of paying for a new generation; --force always
 * regenerates).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docPath = join(root, 'docs', 'scene-art.md');
const outDir = join(root, 'public', 'assets', 'art', 'scenes');
const rawDir = join(tmpdir(), 'gen-scene-art');

/** Verified generation sizes (chatgpt-imagegen skill docs). */
const GEN_LANDSCAPE = '1536x1024';
const GEN_PORTRAIT = '1024x1536';
/** Per-image budget passed to the CLI (seconds) — detailed environments can run 2–3 min. */
const GEN_TIMEOUT_S = 300;

/**
 * Every prompt is assembled as [COMPOSITION+STYLE PREAMBLE] + [entry prompt] +
 * [NEGATIVES]. The binding contract is docs/scene-art.md §1: same cel-gacha
 * idiom as the cards but ENVIRONMENT-FIRST — these are stages, not character
 * splashes, deliberately desaturated so saturated cards and UI pop on top.
 *
 * Two preambles, keyed by the entry's deliverable orientation:
 *
 * - Landscape (the stage backdrops) demands a wide establishing composition
 *   with no focal character and interest kept off-center — the card driver's
 *   waist-up portrait prefix would be exactly wrong here, so it is replaced,
 *   not reused.
 * - Portrait (card-back, pack-art) is ornamental/product art: flat frontal
 *   graphic design, centered and symmetric, edge-to-edge — not a scene.
 *
 * The NO-TEXT negatives are carried VERBATIM from scripts/gen-card-art.ts
 * (the backends' nameplate/CJK habit doesn't care what kind of image it is);
 * the anatomy negatives are replaced with environment-appropriate ones.
 */
const STAGE_PREAMBLE =
  // Composition: environment-first — a stage that sits behind game UI.
  'Composition: wide establishing shot of an empty environment — a stage, not a ' +
  'character splash. No focal character, no people, no faces; at most tiny distant ' +
  'silhouettes where the scene calls for them. Visual interest lives at the edges and ' +
  'in atmosphere; the frame reads as scenery composed to sit behind game UI, with broad ' +
  'calm fields of value and no strong focal object at the center. ' +
  // Style: cel-gacha environment idiom, desaturated (mirrors scene-art.md §1).
  'Style: crisp cel-shaded gacha anime environment art in the painted anime key-visual ' +
  'idiom — clean inked environmental linework, hard-edged rendering in two to three ' +
  'tone steps, deliberately desaturated atmospheric color with deep moody values and ' +
  'subtle depth haze, so saturated card art and UI read on top. The illustration is ' +
  'completely text-free. ';

const ORNAMENT_PREAMBLE =
  'Composition: a flat frontal graphic design filling the full portrait canvas — an ' +
  'ornamental trading-card-game object, not a scene and not a character. Centered, ' +
  'symmetric, edge-to-edge layout. ' +
  'Style: crisp cel-shaded gacha anime production art — clean inked ornamental ' +
  'linework, hard-edged rendering in two to three tone steps, controlled saturation on ' +
  'a dark royal-violet base with gold accents. The design is completely text-free. ';

/**
 * Negative block appended after the entry prompt. The first three lines are
 * the NO-TEXT hard rule, verbatim from gen-card-art.ts; the rest swaps the
 * card driver's anatomy negatives for environment ones.
 */
const NEGATIVES =
  ' Strictly no text of any kind anywhere in the image: no words, letters, numbers, ' +
  'nameplates, captions, titles, logos, watermarks, signatures, or calligraphy panels, ' +
  'no CJK glyphs — banners, seals, and sashes render blank or patterned, never lettered. ' +
  'No characters, no faces, no portrait framing, no figure larger than a distant ' +
  'silhouette. NOT photorealistic, NOT a 3D render, NOT a rough sketch; no oversaturated ' +
  'colors, no large bright white fields, no lens flare, no vignette borders, no ' +
  'watermark corners.';

// The entry Prompt line ends unpunctuated ("… 1280×720 stage backdrop"), so
// close the sentence before the negatives block.
const assemblePrompt = (entry: Entry): string =>
  (entry.w > entry.h ? STAGE_PREAMBLE : ORNAMENT_PREAMBLE) + entry.prompt + '.' + NEGATIVES;

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
  console.error(`gen-scene-art: ${msg}`);
  process.exit(1);
}

// --- scene-art.md parsing --------------------------------------------------------

interface Entry {
  key: string; // asset key = output filename stem
  name: string;
  prompt: string;
  w: number; // deliverable width (px)
  h: number; // deliverable height (px)
}

/**
 * Asset entries from docs/scene-art.md, in file order: `### Name — \`key\``
 * headings plus the Prompt and Deliverable fields. Fenced code blocks are
 * skipped so documentation examples can never masquerade as entries.
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
      open = { key: heading[2], name: heading[1], prompt: '', w: 0, h: 0 };
      entries.push(open);
      continue;
    }
    if (!open) continue;
    const prompt = line.match(/^- \*\*Prompt:\*\* ?(.*)$/);
    if (prompt) {
      open.prompt = prompt[1].trim();
      continue;
    }
    const deliverable = line.match(/^- \*\*Deliverable:\*\* ?(.*)$/);
    if (deliverable) {
      const dims = deliverable[1].match(/(\d+)\s*[×x]\s*(\d+)/);
      if (dims) {
        open.w = Number(dims[1]);
        open.h = Number(dims[2]);
      }
    }
  }

  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const e of entries) {
    if (seen.has(e.key)) dupes.push(e.key);
    seen.add(e.key);
  }
  if (dupes.length > 0) fail(`scene-art.md: duplicate asset keys: ${dupes.join(', ')}`);
  const noPrompt = entries.filter((e) => e.prompt === '');
  if (noPrompt.length > 0) {
    fail(`scene-art.md: entries missing a Prompt field: ${noPrompt.map((e) => e.key).join(', ')}`);
  }
  const noDims = entries.filter((e) => e.w <= 0 || e.h <= 0);
  if (noDims.length > 0) {
    fail(
      `scene-art.md: entries missing WxH in their Deliverable field: ${noDims.map((e) => e.key).join(', ')}`,
    );
  }
  if (entries.length === 0) fail('scene-art.md: no asset entries found');
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

/** Center cover-crop to the target aspect (same math as the card pipeline) and resize. */
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
  const rawPath = join(rawDir, `${entry.key}.raw.png`);
  const outPath = join(outDir, `${entry.key}.png`);
  const tmpPath = `${outPath}.tmp`;
  const prompt = assemblePrompt(entry);
  const genSize = entry.w > entry.h ? GEN_LANDSCAPE : GEN_PORTRAIT;

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
        genSize,
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
  // <key>.png that skip-existing would forever treat as done (the future
  // scenes manifest will trust file presence, exactly like the card one).
  const post = spawnSync(
    PYTHON,
    ['-c', POSTPROCESS_PY, rawPath, tmpPath, String(entry.w), String(entry.h)],
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
    const known = new Set(entries.map((e) => e.key));
    const unknown = args.only.filter((key) => !known.has(key));
    if (unknown.length > 0) fail(`--only keys not in docs/scene-art.md: ${unknown.join(', ')}`);
    const wanted = new Set(args.only);
    entries = entries.filter((e) => wanted.has(e.key));
  }

  // Prompt-inspection mode: print the exact assembled prompt(s) and exit
  // without generating — review text before a batch burns quota.
  if (args.showPrompt) {
    for (const e of entries) {
      console.log(`--- ${e.key} (${e.w}×${e.h}) ---`);
      console.log(assemblePrompt(e));
    }
    console.log(`gen-scene-art: --show-prompt — ${entries.length} prompt(s) shown, nothing generated`);
    return;
  }

  const exists = (e: Entry): boolean => existsSync(join(outDir, `${e.key}.png`));
  const skipped = args.force ? [] : entries.filter(exists);
  let todo = args.force ? entries : entries.filter((e) => !exists(e));
  if (args.limit !== undefined) todo = todo.slice(0, args.limit);

  console.log(
    `gen-scene-art: ${entries.length} asset${entries.length === 1 ? '' : 's'} matched — ` +
      `${todo.length} to generate, ${skipped.length} already on disk`,
  );

  if (args.dryRun) {
    for (const e of entries) {
      const state = !args.force && exists(e) ? 'exists — skip (use --force)' : todo.includes(e) ? 'would generate' : 'beyond --limit';
      console.log(`  ${e.key.padEnd(20)} ${`${e.w}×${e.h}`.padEnd(10)} ${state}`);
    }
    console.log('gen-scene-art: dry run — nothing generated');
    return;
  }
  if (todo.length === 0) {
    console.log('gen-scene-art: nothing to do');
    return;
  }

  mkdirSync(outDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });
  const cliArgv = resolveCli(args.cli);

  // Preflight the post-processor BEFORE burning any generation quota — a
  // missing Pillow would otherwise fail every entry after its paid call.
  const pil = spawnSync(PYTHON, ['-c', 'import PIL'], { encoding: 'utf8' });
  if (pil.status !== 0) fail('Pillow is required for post-processing — `pip install pillow` and rerun');

  const failures: { key: string; error: string }[] = [];
  let generated = 0;
  let consecutiveFailures = 0;
  const batchStart = Date.now();
  for (let i = 0; i < todo.length; i++) {
    const entry = todo[i];
    const t0 = Date.now();
    process.stdout.write(`[${i + 1}/${todo.length}] ${entry.key} … `);
    const res = generateOne(cliArgv, entry, args.force);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (res.ok) {
      generated++;
      consecutiveFailures = 0;
      console.log(`ok in ${secs}s${res.reusedRaw ? ' (re-cropped existing raw — no quota spent)' : ''}`);
    } else {
      failures.push({ key: entry.key, error: res.error ?? 'unknown error' });
      consecutiveFailures++;
      console.log(`FAILED after ${secs}s — ${res.error}`);
      if (consecutiveFailures >= 3) {
        console.error(
          'gen-scene-art: 3 consecutive failures — aborting batch to protect quota ' +
            '(the default run resumes where it left off)',
        );
        break;
      }
    }
  }

  const totalMin = ((Date.now() - batchStart) / 60000).toFixed(1);
  console.log(
    `gen-scene-art: ${generated}/${todo.length} generated in ${totalMin} min` +
      (failures.length > 0 ? `, ${failures.length} failed` : '') +
      ` (raw originals in ${rawDir})`,
  );
  for (const f of failures) console.error(`  FAIL ${f.key}: ${f.error}`);

  if (generated > 0) {
    console.log(
      'gen-scene-art: note — no manifest step; loader/manifest wiring is the later ' +
        'integration task (docs/scene-art.md §3), so new files are inert until it lands.',
    );
  }
  if (failures.length > 0) process.exitCode = 1;
}

main();
