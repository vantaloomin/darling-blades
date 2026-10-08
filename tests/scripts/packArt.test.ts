import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createPackSource, type PackIndex } from '../../src/art/artSource';
import {
  buildPacks,
  copyPacksInto,
  packNames,
  PACKS_URL_DIR,
  stagePacks,
  type BuiltPack,
  type PackInput,
} from '../../scripts/pack-art';

/**
 * The pack builder (scripts/pack-art.ts): every card's bytes come back out of
 * its pack unchanged, through the offset index and through the runtime
 * source's range reads; the output is a function of the input files alone;
 * and the build step copies exactly the packs the index names. The fixture is
 * a handful of fake webp files written to a temp folder: two sets, a styled
 * land that belongs to no set, and one key with no half-resolution file.
 */

const scratch = mkdtempSync(join(tmpdir(), 'pack-art-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function webp(n: number, seed: number): Buffer {
  const out = Buffer.alloc(12 + n);
  out.write('RIFF', 0, 'latin1');
  out.writeUInt32LE(4 + n, 4);
  out.write('WEBP', 8, 'latin1');
  for (let i = 0; i < n; i++) out[12 + i] = (seed * 31 + i * 7) & 0xff;
  return out;
}

/** Manifest order, which is what the index's `at` lists follow. */
const KEYS = ['alpha-knight', 'alpha-squire', 'beta-witch', 'plains--dawn', 'zeta-alpha-token'];
const GROUP: Record<string, string> = {
  'alpha-knight': 'alpha',
  'alpha-squire': 'alpha',
  'beta-witch': 'beta',
  'plains--dawn': 'misc',
  // Sorts last in the manifest but lives in the alpha pack, as tokens do.
  'zeta-alpha-token': 'alpha',
};
const NO_HALF = 'beta-witch';

function fixture(name: string): PackInput & { full: Record<string, Buffer>; half: Record<string, Buffer> } {
  const fullDir = join(scratch, name, 'cards');
  const halfDir = join(scratch, name, 'cards-half');
  mkdirSync(fullDir, { recursive: true });
  mkdirSync(halfDir, { recursive: true });
  const full: Record<string, Buffer> = {};
  const half: Record<string, Buffer> = {};
  KEYS.forEach((key, i) => {
    full[key] = webp(40 + i * 13, i + 1);
    writeFileSync(join(fullDir, `${key}.webp`), full[key]);
    if (key === NO_HALF) return;
    half[key] = webp(10 + i * 3, i + 50);
    writeFileSync(join(halfDir, `${key}.webp`), half[key]);
  });
  return {
    keys: KEYS,
    halfKeys: new Set(Object.keys(half)),
    fullDir,
    halfDir,
    groupOf: (key) => GROUP[key],
    full,
    half,
  };
}

function build(input: PackInput): { index: PackIndex; packs: Map<string, BuiltPack> } {
  const packs = new Map<string, BuiltPack>();
  const index = buildPacks(input, (pack) => packs.set(pack.name, pack));
  return { index, packs };
}

describe('pack-art', () => {
  it('stores every file byte-for-byte at the offset the index gives, one pack per group per tier', () => {
    const input = fixture('integrity');
    const { index, packs } = build(input);
    for (const [tier, files] of [['full', input.full], ['half', input.half]] as const) {
      const tierIndex = index.tiers[tier]!;
      expect(tierIndex.packs.map((name) => packs.get(name)!.group).sort()).toEqual(
        tier === 'full' ? ['alpha', 'beta', 'misc'] : ['alpha', 'misc'],
      );
      KEYS.forEach((key, i) => {
        const entry = tierIndex.at[i];
        if (!files[key]) {
          expect(entry).toBeNull();
          return;
        }
        const [p, offset, length] = entry!;
        const pack = packs.get(tierIndex.packs[p])!;
        expect(pack.group).toBe(GROUP[key]);
        expect(pack.data.subarray(offset, offset + length).equals(files[key])).toBe(true);
      });
      tierIndex.packs.forEach((name, p) => {
        // The name carries the tier, the group and a content hash; `.webp` keeps hosts from gzipping it.
        expect(name).toMatch(new RegExp(`^${tier}-${packs.get(name)!.group}\\.[0-9a-f]{10}\\.webp$`));
        expect(tierIndex.sizes[p]).toBe(packs.get(name)!.data.length);
      });
    }
  });

  it('gives the same bytes, names and index for the same files', () => {
    const a = build(fixture('run-a'));
    const b = build(fixture('run-b'));
    expect(b.index).toEqual(a.index);
    expect([...b.packs.keys()]).toEqual([...a.packs.keys()]);
    for (const [name, pack] of a.packs) expect(b.packs.get(name)!.data.equals(pack.data)).toBe(true);
  });

  it('changes only the pack whose files changed', () => {
    const a = build(fixture('edit-a'));
    const edited = fixture('edit-b');
    writeFileSync(join(edited.fullDir, 'beta-witch.webp'), webp(99, 7));
    const b = build(edited);
    const changed = [...b.packs.keys()].filter((name) => !a.packs.has(name));
    expect(changed.map((name) => b.packs.get(name)!.group)).toEqual(['beta']);
  });

  it('refuses a file that is not a webp, naming it', () => {
    const input = fixture('bad-magic');
    writeFileSync(join(input.halfDir, 'alpha-squire.webp'), Buffer.from('<!doctype html>not an image'));
    expect(() => build(input)).toThrow(/half\/alpha-squire\.webp/);
  });

  it('writes no half tier when there are no half files', () => {
    const input = fixture('no-half');
    const { index } = build({ ...input, halfKeys: new Set() });
    expect(index.tiers.half).toBeUndefined();
    // The full tier is untouched: every manifest key still has its entry.
    expect(index.tiers.full!.at.every((entry) => entry !== null)).toBe(true);
  });

  it('round-trips through the runtime source: every key and tier reads back its own file', async () => {
    const input = fixture('round-trip');
    const { index, packs } = build(input);
    const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const pack = packs.get(url.slice(`${PACKS_URL_DIR}/`.length));
      const range = (init?.headers as Record<string, string>).Range;
      const [start, end] = range.replace('bytes=', '').split('-').map(Number);
      return new Response(new Uint8Array(pack!.data.subarray(start, end + 1)), {
        status: 206,
        headers: { 'Content-Range': `bytes ${start}-${end}/${pack!.data.length}` },
      });
    };
    const source = createPackSource({ index, keys: KEYS, fetch, log: { warn: () => {}, error: () => {} } });
    for (const key of KEYS) {
      const full = Buffer.from(await (await source.read(key, 'full')).arrayBuffer());
      expect(full.equals(input.full[key])).toBe(true);
      const half = Buffer.from(await (await source.read(key, 'half')).arrayBuffer());
      expect(half.equals(input.half[key] ?? input.full[key])).toBe(true);
    }
  });

  it('stages packs: keeps an already-staged pack, deletes stale packs, leaves other files alone', () => {
    const input = fixture('stage');
    const stagingDir = join(scratch, 'stage', 'staging');
    const indexFile = join(scratch, 'stage', 'data', 'art-packs.json');
    const { index } = build(input);
    const kept = index.tiers.full!.packs[0];
    const keptSize = index.tiers.full!.sizes[0];
    mkdirSync(stagingDir, { recursive: true });
    // Same name, same length, different bytes: only a skipped write leaves these zeros in place.
    writeFileSync(join(stagingDir, kept), Buffer.alloc(keptSize));
    writeFileSync(join(stagingDir, 'full-alpha.0000000000.webp'), 'a pack from an older build');
    writeFileSync(join(stagingDir, 'full-alpha.0000000001.bin'), 'a pack named before 1.9.1');
    writeFileSync(join(stagingDir, 'README.txt'), 'not a pack');

    const staged = stagePacks(input, { stagingDir, indexFile });
    expect(staged.reused).toBe(1);
    expect(readFileSync(join(stagingDir, kept)).equals(Buffer.alloc(keptSize))).toBe(true);
    expect(readdirSync(stagingDir).sort()).toEqual([...packNames(staged.index), 'README.txt'].sort());
    expect(JSON.parse(readFileSync(indexFile, 'utf8'))).toEqual(staged.index);
    expect(staged.indexChanged).toBe(true);
    expect(stagePacks(input, { stagingDir, indexFile }).indexChanged).toBe(false);
  });

  it('names a missing file and the step that makes it', () => {
    const input = fixture('missing');
    rmSync(join(input.halfDir, 'alpha-knight.webp'));
    expect(() => build(input)).toThrow('pack-art: half/alpha-knight.webp is missing (run gen-art-halfres?)');
  });

  it('copies exactly the packs the index names into the build, and fails on a missing one', () => {
    const input = fixture('copy');
    const staging = join(scratch, 'copy', 'staging');
    mkdirSync(staging, { recursive: true });
    const { index, packs } = build(input);
    for (const [name, pack] of packs) writeFileSync(join(staging, name), pack.data);
    writeFileSync(join(staging, 'full-alpha.0000000000.bin'), 'a stale pack from an older build');
    const indexFile = join(scratch, 'copy', 'art-packs.json');
    writeFileSync(indexFile, JSON.stringify(index));
    const dist = join(scratch, 'copy', 'dist');

    const copied = copyPacksInto(dist, { indexFile, stagingDir: staging });
    const out = join(dist, PACKS_URL_DIR);
    expect(readdirSync(out).sort()).toEqual([...packs.keys()].sort());
    for (const [name, pack] of packs) expect(readFileSync(join(out, name)).equals(pack.data)).toBe(true);
    expect(copied).toEqual({ files: packs.size, bytes: [...packs.values()].reduce((n, p) => n + p.data.length, 0) });

    rmSync(join(staging, index.tiers.full!.packs[0]));
    expect(() => copyPacksInto(join(scratch, 'copy', 'dist2'), { indexFile, stagingDir: staging })).toThrow(/missing/);
    expect(copyPacksInto(dist, { indexFile: join(scratch, 'copy', 'absent.json'), stagingDir: staging })).toBeNull();
  });
});
