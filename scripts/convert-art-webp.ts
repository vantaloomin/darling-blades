/**
 * Converts shipped runtime art from PNG to WebP in place.
 *
 * Pillow is already the art pipeline's image dependency. Each output is
 * written through a temporary file and sources are removed only after every
 * requested conversion succeeds. Generators import convertPngToWebp() for
 * their temporary smart-crop output, so new art is WebP at the shipped
 * boundary too.
 *
 * Usage: npm run convert-art-webp -- [--quality 90] [--force] [--dry-run]
 *                              [--keep-png]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artRoot = join(root, 'public', 'assets', 'art');
const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
export const DEFAULT_WEBP_QUALITY = 90;

const ENCODE_PY = `
import os, sys
from PIL import Image
src, dst, quality = sys.argv[1], sys.argv[2], int(sys.argv[3])
with Image.open(src) as opened:
    has_alpha = opened.mode in ("RGBA", "LA", "PA") or "transparency" in opened.info
    image = opened.convert("RGBA" if has_alpha else "RGB")
    tmp = dst + ".tmp"
    image.save(tmp, "WEBP", quality=quality, method=6)
    os.replace(tmp, dst)
`;

function fail(message: string): never {
  throw new Error(`convert-art-webp: ${message}`);
}

function assertQuality(quality: number): void {
  if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
    fail('--quality must be an integer from 0 to 100');
  }
}

/** Encode one PNG to WebP atomically. Used by the art generators as well. */
export function convertPngToWebp(source: string, destination: string, quality = DEFAULT_WEBP_QUALITY): void {
  assertQuality(quality);
  const result = spawnSync(PYTHON, ['-c', ENCODE_PY, source, destination, String(quality)], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (result.error) fail(`Pillow spawn failed: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr ?? '').trim().split(/\r?\n/).slice(-2).join(' | ');
    fail(`could not encode ${basename(source)}: ${detail || `Pillow exited ${result.status}`}`);
  }
  if (!existsSync(destination)) fail(`encoder reported success but wrote no file: ${destination}`);
}

function listPngs(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listPngs(path);
    return entry.isFile() && extname(entry.name).toLowerCase() === '.png' ? [path] : [];
  });
}

interface Args {
  quality: number;
  force: boolean;
  dryRun: boolean;
  keepPng: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { quality: DEFAULT_WEBP_QUALITY, force: false, dryRun: false, keepPng: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--quality') {
      const value = argv[++i];
      if (value === undefined) fail('--quality requires a value');
      args.quality = Number(value);
    } else if (arg === '--force') args.force = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--keep-png') args.keepPng = true;
    else fail(`unknown argument: ${arg}`);
  }
  assertQuality(args.quality);
  return args;
}

function destinationFor(source: string): string {
  return `${source.slice(0, -extname(source).length)}.webp`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sources = listPngs(artRoot).sort();
  const todo = args.force
    ? sources
    : sources.filter((source) => {
        const destination = destinationFor(source);
        return !existsSync(destination) || statSync(source).mtimeMs > statSync(destination).mtimeMs;
      });

  console.log(
    `convert-art-webp: ${sources.length} PNG source(s), ${todo.length} to encode at q${args.quality}` +
      `${args.dryRun ? ' (dry run)' : ''}`,
  );
  if (args.dryRun) return;

  const failures: string[] = [];
  for (const source of todo) {
    try {
      convertPngToWebp(source, destinationFor(source), args.quality);
    } catch (error) {
      failures.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    fail(`${failures.length} conversion(s) failed; PNG sources were preserved`);
  }

  let removed = 0;
  if (!args.keepPng) {
    for (const source of sources) {
      if (!existsSync(destinationFor(source))) fail(`refusing to remove ${source}: WebP output is missing`);
      rmSync(source);
      removed++;
    }
  }
  console.log(
    `convert-art-webp: encoded ${todo.length}, ${args.keepPng ? 'kept' : `removed ${removed}`} PNG source(s)`,
  );
}

if (basename(process.argv[1] ?? '') === 'convert-art-webp.ts') main();
