/**
 * Card-art packs for the web build (1.9 lane D, S2; docs/plan-art-streaming.md
 * section 5). Concatenates the loose `.webp` card files into one pack per set
 * per tier, names each pack by its content hash, and writes the offset index
 * the game bundles (`src/data/art-packs.json`, gitignored like the manifest).
 *
 *   public/assets/art/cards/<key>.webp       -> .art-packs/full-<set>.<hash>.bin
 *   public/assets/art/cards-half/<key>.webp  -> .art-packs/half-<set>.<hash>.bin
 *
 * Why: itch.io caps an HTML5 game at 1,000 files (the art alone is 3,074) and
 * 200 MB a file, and the same packs serve Pages. The `.bin` extension is not
 * on itch's pre-gzip list, so byte ranges stay byte ranges. The vite plugin
 * `art-packs` (vite.config.ts) copies the packs the index names into
 * `dist/assets/art/packs/` for web builds; the desktop build keeps loose files
 * only (Tauri ignores Range, docs/desktop-build.md).
 *
 * Runs after gen-art-halfres and gen-art-manifest (it reads the manifest, so
 * the index's positional `at` lists line up with `manifest.cards`). The output
 * is deterministic: the same files give the same bytes, names and index.
 * A pack already in the staging folder under its hashed name is not rewritten,
 * and staged packs the index no longer names are deleted.
 *
 * Usage: npx tsx scripts/pack-art.ts [--require-half]
 *   --require-half  fail when any card has no half-resolution file (the deploy)
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWebp, keysFingerprint, PACK_INDEX_VERSION, type ArtFileTier, type PackIndex, type PackTierIndex } from '../src/art/artSource';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const PACK_STAGING_DIR = join(root, '.art-packs');
export const PACK_INDEX_FILE = join(root, 'src', 'data', 'art-packs.json');
/** Where the packs live in a built site, relative to its root (the source's `base`). */
export const PACKS_URL_DIR = 'assets/art/packs';
/** itch.io refuses files over 200 MB; stay clear of it. */
export const MAX_PACK_BYTES = 190_000_000;
/** The pack for keys that are not a card of a set: styled lands, non-card keys. */
export const MISC_GROUP = 'misc';

export interface PackInput {
  /** The manifest's `cards`, in manifest order: the order `at` is parallel to. */
  keys: readonly string[];
  /** Keys that have a half file (the manifest's `half`). Empty: no half tier. */
  halfKeys: ReadonlySet<string>;
  fullDir: string;
  halfDir: string;
  /** The pack group of a key: its card's set, or `misc`. */
  groupOf: (key: string) => string;
}

export interface BuiltPack {
  name: string;
  tier: ArtFileTier;
  group: string;
  data: Buffer;
  keys: number;
}

/** First 10 hex digits of the SHA-256 of the pack's bytes. */
export function packHash(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 10);
}

/** Groups become file names, so they stay plain. */
const GROUP_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Plain code-unit order: the same on every machine and locale. */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Build every pack and the index. `emit` receives each pack as it is made, so
 * the caller can write it without holding a whole tier in memory. Throws on a
 * duplicate key, a group name that is not a plain slug, an entry that is not
 * a webp file, or a pack over `MAX_PACK_BYTES`.
 */
export function buildPacks(input: PackInput, emit: (pack: BuiltPack) => void): PackIndex {
  if (new Set(input.keys).size !== input.keys.length) throw new Error('pack-art: the manifest lists a key twice');
  const position = new Map<string, number>();
  input.keys.forEach((key, i) => position.set(key, i));

  const tiers: PackIndex['tiers'] = {};
  const plan: [ArtFileTier, string, (key: string) => boolean][] = [['full', input.fullDir, () => true]];
  if (input.halfKeys.size > 0) plan.push(['half', input.halfDir, (key) => input.halfKeys.has(key)]);

  for (const [tier, dir, has] of plan) {
    const groups = new Map<string, string[]>();
    for (const key of input.keys) {
      if (!has(key)) continue;
      const group = input.groupOf(key);
      if (!GROUP_NAME.test(group)) throw new Error(`pack-art: group "${group}" (key ${key}) is not a plain slug`);
      const list = groups.get(group) ?? [];
      list.push(key);
      groups.set(group, list);
    }
    const index: PackTierIndex = { packs: [], sizes: [], at: input.keys.map(() => null) };
    for (const group of [...groups.keys()].sort(byCodeUnit)) {
      const members = groups.get(group)!.slice().sort(byCodeUnit);
      const parts: Buffer[] = [];
      const packNo = index.packs.length;
      let offset = 0;
      for (const key of members) {
        const file = join(dir, `${key}.webp`);
        if (!existsSync(file)) {
          throw new Error(`pack-art: ${tier}/${key}.webp is missing${tier === 'half' ? ' (run gen-art-halfres?)' : ''}`);
        }
        const bytes = readFileSync(file);
        if (!isWebp(bytes)) throw new Error(`pack-art: ${tier}/${key}.webp does not start RIFF....WEBP`);
        index.at[position.get(key)!] = [packNo, offset, bytes.length];
        parts.push(bytes);
        offset += bytes.length;
      }
      if (offset > MAX_PACK_BYTES) {
        throw new Error(`pack-art: ${tier}-${group} is ${offset} bytes, over the ${MAX_PACK_BYTES}-byte cap`);
      }
      const data = Buffer.concat(parts, offset);
      const name = `${tier}-${group}.${packHash(data)}.bin`;
      index.packs.push(name);
      index.sizes.push(offset);
      emit({ name, tier, group, data, keys: members.length });
    }
    tiers[tier] = index;
  }
  return { version: PACK_INDEX_VERSION, keys: keysFingerprint(input.keys), tiers };
}

/** Every pack file an index names. */
export function packNames(index: PackIndex): string[] {
  return Object.values(index.tiers).flatMap((tier) => tier?.packs ?? []);
}

/**
 * The build half (the `art-packs` vite plugin): copy the packs the index names
 * from the staging folder into `<distDir>/assets/art/packs/`. Returns the
 * copied names and total bytes, or null when no index was built (a plain
 * `vite build`; the game then reads loose files). Throws when the index names
 * a pack the staging folder lacks or holds at the wrong size.
 */
export function copyPacksInto(
  distDir: string,
  opts: { indexFile?: string; stagingDir?: string } = {},
): { files: number; bytes: number } | null {
  const indexFile = opts.indexFile ?? PACK_INDEX_FILE;
  const stagingDir = opts.stagingDir ?? PACK_STAGING_DIR;
  if (!existsSync(indexFile)) return null;
  const index = JSON.parse(readFileSync(indexFile, 'utf8')) as PackIndex;
  const outDir = join(distDir, PACKS_URL_DIR);
  mkdirSync(outDir, { recursive: true });
  let bytes = 0;
  const sizeOf = new Map<string, number>();
  for (const tier of Object.values(index.tiers)) {
    tier?.packs.forEach((name, i) => sizeOf.set(name, tier.sizes[i]));
  }
  for (const [name, size] of sizeOf) {
    const from = join(stagingDir, name);
    const st = statSync(from, { throwIfNoEntry: false });
    if (!st || st.size !== size) {
      throw new Error(`art-packs: ${name} is missing from ${stagingDir} or the wrong size; run \`npx tsx scripts/pack-art.ts\``);
    }
    copyFileSync(from, join(outDir, name));
    bytes += size;
  }
  return { files: sizeOf.size, bytes };
}

export interface StagedPack {
  name: string;
  tier: ArtFileTier;
  size: number;
  keys: number;
}

/**
 * Build the packs into `stagingDir` and write the index to `indexFile`. A pack
 * already staged under its name at the same length is not rewritten (the name
 * carries the content hash); any other `.bin` in the folder is a pack no build
 * names any more and is deleted; other files are left alone. The index is
 * written only when its text changed, so the dev server does not reload for
 * nothing.
 */
export function stagePacks(
  input: PackInput,
  out: { stagingDir: string; indexFile: string },
): { index: PackIndex; written: StagedPack[]; reused: number; indexChanged: boolean } {
  mkdirSync(out.stagingDir, { recursive: true });
  const written: StagedPack[] = [];
  let reused = 0;
  const index = buildPacks(input, (pack) => {
    const file = join(out.stagingDir, pack.name);
    if (statSync(file, { throwIfNoEntry: false })?.size === pack.data.length) reused++;
    else writeFileSync(file, pack.data);
    written.push({ name: pack.name, tier: pack.tier, size: pack.data.length, keys: pack.keys });
  });
  const keep = new Set(packNames(index));
  for (const file of readdirSync(out.stagingDir)) {
    if (file.endsWith('.bin') && !keep.has(file)) rmSync(join(out.stagingDir, file));
  }
  const json = `${JSON.stringify(index)}
`;
  const previous = existsSync(out.indexFile) ? readFileSync(out.indexFile, 'utf8') : '';
  if (previous !== json) {
    mkdirSync(dirname(out.indexFile), { recursive: true });
    writeFileSync(out.indexFile, json);
  }
  return { index, written, reused, indexChanged: previous !== json };
}

const mib = (n: number): string => `${(n / 1024 / 1024).toFixed(1)} MiB`;

async function main(argv: string[]): Promise<number> {
  const manifestFile = join(root, 'src', 'data', 'art-manifest.json');
  if (!existsSync(manifestFile)) {
    console.error('pack-art: src/data/art-manifest.json is missing; run `npm run gen-art-manifest` first');
    return 1;
  }
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as { cards: string[]; half?: string[] };
  const halfKeys = new Set(manifest.half ?? []);
  if (argv.includes('--require-half')) {
    const missing = manifest.cards.filter((key) => !halfKeys.has(key));
    if (missing.length > 0) {
      console.error(`pack-art: ${missing.length} card art file(s) have no half-resolution file: ${missing.slice(0, 10).join(', ')}`);
      return 1;
    }
  }
  // Loaded here, not at the top, so vite.config.ts can import copyPacksInto
  // without evaluating the card database.
  const { CARD_DB } = await import('../src/data/catalog');
  const groupOf = (key: string): string => {
    const card = CARD_DB[key];
    return card ? (card.set ?? 'base') : MISC_GROUP;
  };

  const { index, written, reused, indexChanged } = stagePacks(
    {
      keys: manifest.cards,
      halfKeys,
      fullDir: join(root, 'public', 'assets', 'art', 'cards'),
      halfDir: join(root, 'public', 'assets', 'art', 'cards-half'),
      groupOf,
    },
    { stagingDir: PACK_STAGING_DIR, indexFile: PACK_INDEX_FILE },
  );
  const indexBytes = `${JSON.stringify(index)}
`.length;

  for (const tier of ['full', 'half'] as const) {
    const packs = written.filter((p) => p.tier === tier);
    if (packs.length === 0) {
      console.log(`pack-art: ${tier}: not built (no files)`);
      continue;
    }
    const total = packs.reduce((n, p) => n + p.size, 0);
    const largest = packs.reduce((a, b) => (b.size > a.size ? b : a));
    console.log(
      `pack-art: ${tier}: ${packs.length} pack(s), ${packs.reduce((n, p) => n + p.keys, 0)} file(s), ` +
        `${mib(total)}; largest ${largest.name} at ${mib(largest.size)}`,
    );
  }
  console.log(
    `pack-art: ${written.length - reused} written, ${reused} already staged in ${resolve(PACK_STAGING_DIR)}; ` +
      `index ${indexChanged ? 'written' : 'unchanged'} (${(indexBytes / 1024).toFixed(1)} KiB)`,
  );
  return 0;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === fileURLToPath(import.meta.url).toLowerCase()) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
