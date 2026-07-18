/**
 * Generates real card art for the 83 non-creature SPELL cards (18 instants, 14
 * sorceries, 10 enchantments, 1 artifact, + 9 Ragnarök spells/runes, + 31 Gothic
 * Monsters charms/rituals/enchantments/artifacts) from the prompts in
 * docs/spell-art.md, via the chatgpt-imagegen CLI (backed by the user's ChatGPT
 * subscription — see the `anthropic-skills:chatgpt-imagegen` skill), then
 * post-processes each image to the exact 640×800 PNG deliverable
 * (docs/art-bible/index.md §1) at `public/assets/art/cards/<card-id>.png` — the
 * same directory and dimensions as the creature art, so the manifest and
 * ArtResolver auto-pick these up with no code change. Existing PNGs are skipped,
 * so the run is idempotent and resumable.
 *
 * This mirrors scripts/gen-card-art.ts's hardened machinery exactly (temp-file
 * writes, raw-original reuse, Pillow preflight, 3-consecutive-failure abort,
 * win32 CLI fail-fast) with ONE deliberate difference: spells are effect/moment
 * SCENES, not character portraits, so the SPELL preamble below demands a
 * dramatic magical effect centered in the ART_RECT band — it does NOT carry
 * gen-card-art's "waist-up, face at center" character-composition clause.
 *
 * Each generation prompt is assembled as [SPELL/EFFECT PREAMBLE] + [entry Prompt
 * line] + [NEGATIVES]. Inspect the exact text with --show-prompt.
 *
 * NOTE: not yet wired into package.json — run directly:
 *   npx tsx scripts/gen-spell-art.ts [--only id1,id2] [--limit N]
 *                                    [--dry-run] [--show-prompt] [--force] [--cli <path>]
 *
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
 * larger portrait) and run scripts/smartcrop.py in environment mode to produce
 * the 4:5 / 640×800 deliverable. Environment mode is byte-identical to the old
 * Pillow center cover-crop. Raw uncropped originals are kept in
 * <tmp>/gen-spell-art/ for inspection.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = join(root, 'docs', 'spell-art.md');
const outDir = join(root, 'public', 'assets', 'art', 'cards');
const rawDir = join(tmpdir(), 'gen-spell-art');
const smartcropPath = join(root, 'scripts', 'smartcrop.py');

const OUT_W = 640;
const OUT_H = 800;
/** Nearest larger portrait size the image backend verifiably accepts (2:3). */
const GEN_SIZE = '1024x1536';
/** Per-image budget passed to the CLI (seconds) — detailed splashes can run 2–3 min. */
const GEN_TIMEOUT_S = 300;

/**
 * The 83 spell ids docs/spell-art.md must cover, in the authored order (instants
 * → sorceries → enchantments → the Jade Seal → Ragnarök → Gothic Monsters).
 * Parsing cross-checks against this
 * so a dropped or renamed entry fails loudly instead of silently generating a
 * short batch. Transcribed from src/data/cards/{instants,sorceries,enchantments,
 * artifacts}.ts (the artifact list contributes ONLY the non-creature Seal — the
 * five Construct creatures live in the creature art-bible).
 */
const EXPECTED_IDS = [
  // instants (18)
  'in-fire-attack', 'in-wild-surge', 'in-read-the-ruse', 'in-shieldwall', 'in-valley-mist',
  'in-undertow', 'in-blessed-respite', 'in-grave-chill', 'in-boar-rush', 'in-tidal-slip',
  'in-doom-bolt', 'in-char', 'in-stand-as-one', 'in-sudden-insight', 'in-skysweeper-gale',
  'in-comet-blast', 'in-reapers-due', 'in-dream-fracture',
  // sorceries (14)
  'so-divination', 'so-rampant-growth', 'so-raise-dead', 'so-lava-axe', 'so-muster-militia',
  'so-nurture', 'so-night-extortion', 'so-flame-lash', 'so-dirge-of-loss', 'so-parade-of-heroes',
  'so-strategic-planning', 'so-warcry', 'so-stampede-season', 'so-judgment-of-heaven',
  // enchantments (10)
  'en-vow-of-peace', 'en-wild-blessing', 'en-withering-curse', 'en-clouded-mind', 'en-wings-of-dawn',
  'en-battle-fervor', 'en-call-of-the-wilds', 'en-banner-of-the-hegemon', 'en-peach-garden-oath',
  'en-olympus-ascendant',
  // artifact (1)
  'ar-imperial-jade-seal',
  // Ragnarök expansion (9): 4 spells + the 5-rune Aura cycle (src/data/cards/ragnarok.ts)
  'rg-ragnarok', 'rg-read-the-runes', 'rg-berserkers-fury', 'rg-call-the-einherjar',
  'rg-rune-of-fury', 'rg-rune-of-the-hunt', 'rg-rune-of-hunger', 'rg-rune-of-insight',
  'rg-rune-of-warding',
  // Gothic Monsters expansion (31): 9 charms + 8 rituals + 6 enchantments +
  // 8 non-creature artifacts (src/data/cards/gothic-monsters.ts — the set's
  // artifact CREATURES live in docs/art-bible/gothic-monsters.md)
  'gm-red-moon-rampage', 'gm-silver-knife', 'gm-fogged-window', 'gm-rose-thorn-snare',
  'gm-red-curtain-cut', 'gm-moonlit-prowl', 'gm-thunderclap', 'gm-wolfbane-shot',
  'gm-midnight-bite',
  'gm-dracula-ball-invite', 'gm-stormtower-resurrection', 'gm-graveyard-waltz',
  'gm-black-lace-pact', 'gm-midnight-autopsy', 'gm-candlelit-seance', 'gm-kicked-door',
  'gm-tattered-invitation',
  'gm-nocturne-manor', 'gm-grave-rose-garden', 'gm-cathedral-of-bats', 'gm-wolfsbane-ward',
  'gm-howling-gallery', 'gm-blood-candle',
  'gm-candelabra-of-souls', 'gm-velvet-coffin', 'gm-lightning-rod-spire', 'gm-silvered-rapier',
  'gm-holy-water-vial', 'gm-cellar-door', 'gm-funeral-bell', 'gm-broken-mirror',
] as const;

/**
 * Every prompt is assembled as [SPELL/EFFECT PREAMBLE] + [entry prompt] +
 * [NEGATIVES]. The preamble is carried verbatim on every prompt because a fixed
 * preamble plus tight per-entry descriptors is the main lever for cast coherence
 * in text-to-image generation (same rationale as gen-card-art's PREAMBLE).
 *
 * Composition is load-bearing and DELIBERATELY DIFFERENT from gen-card-art:
 * spells are effect/moment SCENES, not portraits, so the composition clause
 * demands the dramatic magical action sit at the vertical center of the canvas
 * (inside the card window's visible middle band — docs/spell-art.md §2), with
 * the top and bottom of the canvas reserved as atmospheric bleed. It must NOT
 * reintroduce gen-card-art's "waist-up, face at center" character framing — a
 * spell may have no character at all, and when it does the EFFECT is the hero of
 * the frame.
 */
const PREAMBLE =
  // Subject: this is a spell effect scene, not a portrait (load-bearing).
  'A dramatic magic-spell effect illustration: the subject is the spell effect itself — a ' +
  'burst, bolt, aura, ward, curse, gale, resurrection, vision, or radiant blessing — not a ' +
  'character portrait. Any figure present is secondary; the magical effect is the hero of the ' +
  'frame. ' +
  // Composition (measured band — keep the focal action centered vertically).
  'Composition: the dramatic focal action sits at the exact vertical center of the canvas, ' +
  'inside the middle band, with the top and bottom of the image reserved as atmospheric ' +
  'background bleed — energy and effects may streak into the top for drama but the readable ' +
  'core of the effect stays centered. ' +
  // Cel DNA + register + scenic background (mirrors index.md §2).
  'Style: crisp cel-shaded gacha anime splash art — clean confident inked linework with ' +
  'line-weight variation, hard-edged cel shading in two to three tone steps, bright anime ' +
  'specular highlights, saturated readable colors, dramatic cinematic energy. The effect ' +
  'glows and pops off a fully rendered anime key-visual background with real depth, rendered ' +
  'slightly softer and more atmospheric than the focal magic, with a crisp rim of light ' +
  'separating the effect from the scene. The illustration is completely text-free. ';

/**
 * Negative block appended after the entry prompt: the NO-TEXT hard rule (extra
 * strict here — banners, seals, and oath-scrolls in this file invite stamped
 * nameplates and garbled CJK) plus the style/anatomy negatives from index.md §2.
 */
const NEGATIVES =
  ' Strictly no text of any kind anywhere in the image: no words, letters, numbers, ' +
  'nameplates, banner-text, seal-glyphs, captions, titles, logos, watermarks, signatures, or ' +
  'calligraphy panels, absolutely no CJK glyphs — banners, seals, war-standards, oath-scrolls, ' +
  'and sashes render blank or abstract-patterned, never lettered. NOT painterly, NOT ' +
  'soft-focus, NOT 3D render, NOT photorealistic, NOT a rough sketch; no flat color-wash, ' +
  'empty-gradient, or cutout-sticker background; no muddy or desaturated colors, no plastic ' +
  'skin, no same-face, no extra or melted fingers, no broken weapon geometry, no real-person ' +
  'likeness.';

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
  console.error(`gen-spell-art: ${msg}`);
  process.exit(1);
}

// --- spell-art.md parsing --------------------------------------------------------

interface Entry {
  id: string;
  name: string;
  prompt: string;
}

/** (card-id → prompt) pairs from docs/spell-art.md, in file order. */
function parseSpec(): Entry[] {
  const content = readFileSync(specPath, 'utf8');
  const entries: Entry[] = [];
  let open: Entry | null = null;
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^### (.+?) — `([^`]+)`\s*$/);
    if (heading) {
      open = { id: heading[2], name: heading[1], prompt: '' };
      entries.push(open);
      continue;
    }
    const prompt = line.match(/^- \*\*Prompt:\*\* ?(.*)$/);
    if (prompt && open) open.prompt = prompt[1].trim();
  }

  const missing = entries.filter((e) => e.prompt === '');
  if (missing.length > 0) {
    fail(`spell-art.md: entries missing a Prompt field: ${missing.map((e) => e.id).join(', ')}`);
  }

  // Cross-check against the expected ids so a dropped/renamed/reordered entry
  // fails loudly instead of silently generating a short or wrong batch.
  const seen = entries.map((e) => e.id);
  const expected = new Set<string>(EXPECTED_IDS);
  const unexpected = seen.filter((id) => !expected.has(id));
  const absent = EXPECTED_IDS.filter((id) => !seen.includes(id));
  const dupes = seen.filter((id, i) => seen.indexOf(id) !== i);
  if (unexpected.length || absent.length || dupes.length) {
    const parts = [
      absent.length ? `missing: ${absent.join(', ')}` : '',
      unexpected.length ? `unexpected: ${unexpected.join(', ')}` : '',
      dupes.length ? `duplicated: ${[...new Set(dupes)].join(', ')}` : '',
    ].filter(Boolean);
    fail(`spell-art.md roster does not match the ${EXPECTED_IDS.length} expected spell ids — ${parts.join('; ')}`);
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

function generateOne(
  cliArgv: string[],
  entry: Entry,
  force: boolean,
): { ok: boolean; error?: string; reusedRaw?: boolean } {
  const rawPath = join(rawDir, `${entry.id}.raw.png`);
  const outPath = join(outDir, `${entry.id}.png`);
  const tmpPath = `${outPath}.tmp`;
  const prompt = assemblePrompt(entry);

  // A raw original left by a previous run (its post-process failed or the batch
  // was interrupted) makes the paid generation call unnecessary — re-crop it
  // instead. --force always regenerates (that's its purpose: getting a NEW
  // image, not a re-crop of the rejected one).
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
    [smartcropPath, rawPath, tmpPath, String(OUT_W), String(OUT_H), 'environment'],
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

  let entries = parseSpec();

  if (args.only) {
    const known = new Set(entries.map((e) => e.id));
    const unknown = args.only.filter((id) => !known.has(id));
    if (unknown.length > 0) fail(`--only ids not in spell-art.md: ${unknown.join(', ')}`);
    const wanted = new Set(args.only);
    entries = entries.filter((e) => wanted.has(e.id));
  }

  // Prompt-inspection mode: print the exact assembled prompt(s) and exit without
  // generating — review text before a batch burns quota.
  if (args.showPrompt) {
    for (const e of entries) {
      console.log(`--- ${e.id} ---`);
      console.log(assemblePrompt(e));
    }
    console.log(`gen-spell-art: --show-prompt — ${entries.length} prompt(s) shown, nothing generated`);
    return;
  }

  const exists = (e: Entry) => existsSync(join(outDir, `${e.id}.png`));
  const skipped = args.force ? [] : entries.filter(exists);
  let todo = args.force ? entries : entries.filter((e) => !exists(e));
  if (args.limit !== undefined) todo = todo.slice(0, args.limit);

  console.log(
    `gen-spell-art: ${entries.length} spell entr${entries.length === 1 ? 'y' : 'ies'} matched — ` +
      `${todo.length} to generate, ${skipped.length} already on disk`,
  );

  if (args.dryRun) {
    for (const e of entries) {
      const state = !args.force && exists(e) ? 'exists — skip (use --force)' : todo.includes(e) ? 'would generate' : 'beyond --limit';
      console.log(`  ${e.id.padEnd(28)} ${state}`);
    }
    console.log('gen-spell-art: dry run — nothing generated');
    return;
  }
  if (todo.length === 0) {
    console.log('gen-spell-art: nothing to do');
    return;
  }

  mkdirSync(outDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });
  const cliArgv = resolveCli(args.cli);

  // Preflight the post-processor BEFORE burning any generation quota — missing
  // Python image/detection deps would otherwise fail every entry after its paid call.
  const pil = spawnSync(PYTHON, ['-c', 'import PIL'], { encoding: 'utf8' });
  if (pil.status !== 0) fail('Pillow is required for post-processing — `pip install pillow` and rerun');
  const imgutils = spawnSync(PYTHON, ['-c', 'import imgutils; from imgutils.detect import detect_faces'], { encoding: 'utf8' });
  if (imgutils.status !== 0) {
    fail('dghs-imgutils is required for smart crop post-processing — `pip install -r scripts/requirements.txt` and rerun');
  }

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
          'gen-spell-art: 3 consecutive failures — aborting batch to protect quota ' +
            '(the default run resumes where it left off)',
        );
        break;
      }
    }
  }

  const totalMin = ((Date.now() - batchStart) / 60000).toFixed(1);
  console.log(
    `gen-spell-art: ${generated}/${todo.length} generated in ${totalMin} min` +
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
