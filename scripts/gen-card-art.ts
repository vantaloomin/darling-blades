/**
 * Generates real card art from the art-bible prompts via the chatgpt-imagegen
 * CLI (backed by the user's ChatGPT subscription — see the
 * `anthropic-skills:chatgpt-imagegen` skill), then post-processes each image to
 * the exact 640×800 PNG deliverable (docs/art-bible/index.md §1) at
 * `public/assets/art/cards/<card-id>.png`. Existing PNGs are skipped, so the
 * run is idempotent and resumable. After a generating batch it re-runs
 * `npm run gen-art-manifest` so the game picks the files up.
 *
 * Each generation prompt is assembled as [COMPOSITION+STYLE PREAMBLE] +
 * [entry Prompt line] + [NEGATIVES]; the style contract lives in
 * docs/art-bible/index.md §2 and the preamble/negatives below mirror it
 * (see the PREAMBLE comment). Inspect the exact text with --show-prompt.
 *
 * Usage:
 *   npm run gen-card-art -- [--faction <stem>] [--only id1,id2] [--limit N]
 *                           [--dry-run] [--show-prompt] [--force] [--cli <path>]
 *
 *   --faction greek   only entries from docs/art-bible/greek.md
 *   --only a,b        only these card ids
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
 * the crop math the card frame itself uses (docs/art-pipeline.md). Raw
 * uncropped originals are kept in <tmp>/gen-card-art/ for inspection.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bibleDir = join(root, 'docs', 'art-bible');
const outDir = join(root, 'public', 'assets', 'art', 'cards');
const rawDir = join(tmpdir(), 'gen-card-art');

/** Faction files in index order (docs/art-bible/index.md §10). */
const FACTIONS = [
  'tk-wei',
  'tk-wu',
  'tk-shu',
  'tk-jin',
  'tk-other',
  'greek',
  'beastkin',
  'constructs-and-tokens',
  'ragnarok',
] as const;

const OUT_W = 640;
const OUT_H = 800;
/** Nearest larger portrait size the image backend verifiably accepts (2:3). */
const GEN_SIZE = '1024x1536';
/** Per-image budget passed to the CLI (seconds) — detailed splashes can run 2–3 min. */
const GEN_TIMEOUT_S = 300;

/**
 * Every prompt is assembled as [COMPOSITION+STYLE PREAMBLE] + [entry prompt] +
 * [NEGATIVES]. The binding style contract lives in docs/art-bible/index.md §2
 * (the 2026-07-02 cel-gacha pivot: crisp cel-shaded figure over a fully
 * rendered scenic background); the preamble below mirrors it and must be kept
 * in sync — it is carried verbatim on every prompt because a fixed preamble
 * plus tight per-entry descriptors is the main lever for cast coherence in
 * text-to-image generation.
 *
 * The composition sentence is load-bearing and measured: pilot calibration
 * (greek batch, 2026-07-02) showed that without it the model paints
 * full-figure scenes with the face in the top ~20% of the canvas — above the
 * card window's visible band (docs/art-bible/index.md §3), i.e. the frame
 * decapitates the character. A soft "keep detail in the middle band" hint was
 * NOT enough; the prefix must demand waist-up framing and explicitly reserve
 * the top of the canvas as background. Face at vertical center of the
 * deliverable ≈ eye line y 340–400, inside the bible's face zone (200–560).
 *
 * Recalibrated for the cel-gacha pivot (same day): under the new style,
 * SEATED/ENTHRONED poses rendered more body and pushed eyes to y≈140–175
 * (above the window) while standing poses landed y≈260–340. Top-quarter →
 * top-THIRD headroom plus an explicit seated-pose clause fixed the seated
 * cases without disturbing the standing ones.
 *
 * Lighting is deliberately NOT keyed here: the bible's default (warm
 * upper-left key, cool fill) is overridden per entry, and every entry prompt
 * names its own key + rim (the holo shaders depend on per-card lighting), so
 * the preamble only demands the universal rim-light separation.
 */
const PREAMBLE =
  // Composition (measured, keep verbatim — see above).
  'Composition: waist-up portrait framing (even for seated or enthroned poses), the face ' +
  'at the exact vertical center of the canvas with generous headroom — the entire top ' +
  'third of the image is background only, above her head. ' +
  // Cel DNA + register + scenic background (mirrors index.md §2).
  'Style: crisp cel-shaded gacha anime splash art — clean confident inked linework with ' +
  'line-weight variation, hard-edged cel shading in two to three tone steps, bright anime ' +
  'specular highlights, saturated readable colors, a conventionally beautiful anime face ' +
  'with large expressive eyes and cel-rendered skin. She reads as powerful, confident, and ' +
  'battle-ready — heroic, never coy. The background is a fully rendered anime key-visual ' +
  'environment with real depth and story, slightly softer and more atmospheric than the ' +
  'figure, with a crisp rim light separating her from it. The illustration is completely ' +
  'text-free. ';

/**
 * Negative block appended after the entry prompt: the NO-TEXT hard rule plus
 * the anatomy/style negatives from index.md §2. Backends habitually stamp
 * gacha nameplates and garbled CJK title-text onto Three Kingdoms art, so the
 * no-text guard rides on EVERY prompt (negative here, positive cue above).
 */
const NEGATIVES =
  ' Strictly no text of any kind anywhere in the image: no words, letters, numbers, ' +
  'nameplates, captions, titles, logos, watermarks, signatures, or calligraphy panels, ' +
  'no CJK glyphs — banners, seals, and sashes render blank or patterned, never lettered. ' +
  'NOT painterly, NOT soft-focus, NOT 3D render, NOT photorealistic, NOT a rough sketch; ' +
  'no flat color-wash, empty-gradient, or cutout-sticker background; no muddy or ' +
  'desaturated colors, no plastic skin, no same-face, no extra or melted fingers, ' +
  'no broken weapon geometry, no real-person likeness.';

// The entry Prompt line ends unpunctuated ("… 640×800 portrait"), so close the
// sentence before the negatives block.
const assemblePrompt = (entry: Entry): string => PREAMBLE + entry.prompt + '.' + NEGATIVES;

const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

// --- arg parsing ---------------------------------------------------------------

interface Args {
  faction?: string;
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
    if (a === '--faction') args.faction = next(a);
    else if (a === '--only') args.only = next(a).split(',').map((s) => s.trim()).filter(Boolean);
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
  if (args.faction && !(FACTIONS as readonly string[]).includes(args.faction)) {
    fail(`unknown faction "${args.faction}" — expected one of: ${FACTIONS.join(', ')}`);
  }
  return args;
}

function fail(msg: string): never {
  console.error(`gen-card-art: ${msg}`);
  process.exit(1);
}

// --- art-bible parsing -----------------------------------------------------------

interface Entry {
  id: string;
  name: string;
  faction: string;
  prompt: string;
}

/** (card-id → prompt) pairs from one faction file, in file order. */
function parseFaction(faction: string): Entry[] {
  const content = readFileSync(join(bibleDir, `${faction}.md`), 'utf8');
  const entries: Entry[] = [];
  let open: Entry | null = null;
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^### (.+?) — `([^`]+)`\s*$/);
    if (heading) {
      open = { id: heading[2], name: heading[1], faction, prompt: '' };
      entries.push(open);
      continue;
    }
    const prompt = line.match(/^- \*\*Prompt:\*\* ?(.*)$/);
    if (prompt && open) open.prompt = prompt[1].trim();
  }
  const missing = entries.filter((e) => e.prompt === '');
  if (missing.length > 0) {
    fail(`${faction}.md: entries missing a Prompt field: ${missing.map((e) => e.id).join(', ')}`);
  }
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

  const factions = args.faction ? [args.faction] : [...FACTIONS];
  let entries = factions.flatMap(parseFaction);

  if (args.only) {
    const known = new Set(entries.map((e) => e.id));
    const unknown = args.only.filter((id) => !known.has(id));
    if (unknown.length > 0) fail(`--only ids not in the selected faction file(s): ${unknown.join(', ')}`);
    const wanted = new Set(args.only);
    entries = entries.filter((e) => wanted.has(e.id));
  }

  // Prompt-inspection mode: print the exact assembled prompt(s) and exit
  // without generating — review text before a batch burns quota.
  if (args.showPrompt) {
    for (const e of entries) {
      console.log(`--- ${e.id} (${e.faction}) ---`);
      console.log(assemblePrompt(e));
    }
    console.log(`gen-card-art: --show-prompt — ${entries.length} prompt(s) shown, nothing generated`);
    return;
  }

  const exists = (e: Entry) => existsSync(join(outDir, `${e.id}.png`));
  const skipped = args.force ? [] : entries.filter(exists);
  let todo = args.force ? entries : entries.filter((e) => !exists(e));
  if (args.limit !== undefined) todo = todo.slice(0, args.limit);

  console.log(
    `gen-card-art: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} matched ` +
      `(${factions.length} faction file${factions.length === 1 ? '' : 's'}) — ` +
      `${todo.length} to generate, ${skipped.length} already on disk`,
  );

  if (args.dryRun) {
    for (const e of entries) {
      const state = !args.force && exists(e) ? 'exists — skip (use --force)' : todo.includes(e) ? 'would generate' : 'beyond --limit';
      console.log(`  ${e.id.padEnd(28)} ${e.faction.padEnd(24)} ${state}`);
    }
    console.log('gen-card-art: dry run — nothing generated');
    return;
  }
  if (todo.length === 0) {
    console.log('gen-card-art: nothing to do');
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
          'gen-card-art: 3 consecutive failures — aborting batch to protect quota ' +
            '(the default run resumes where it left off)',
        );
        break;
      }
    }
  }

  const totalMin = ((Date.now() - batchStart) / 60000).toFixed(1);
  console.log(
    `gen-card-art: ${generated}/${todo.length} generated in ${totalMin} min` +
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
