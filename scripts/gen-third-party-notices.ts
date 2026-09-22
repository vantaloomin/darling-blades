/**
 * Builds `public/THIRD_PARTY_NOTICES.txt`, the file `docs/legal/notices.md`
 * links to.
 *
 * Both builds redistribute other people's work: the web bundle carries the npm
 * production dependencies and the two OFL fonts, and the NSIS installer carries
 * compiled Rust crates on top of that. MIT, Apache 2.0, BSD and the OFL all
 * require their notice to travel with the copy, so the file is generated from
 * what the build actually ships and written into `public/`, which is what both
 * builds copy.
 *
 * Three sources, all offline and all committed, so every machine builds the
 * same bytes:
 *
 * 1. **npm.** `package-lock.json` names the production tree (`dev` is false);
 *    each package's own `node_modules/<name>/package.json` supplies the version
 *    and license id, and its LICENSE file supplies the text. A production
 *    package missing from `node_modules` is an error, never a silent omission.
 * 2. **Fonts.** `public/assets/fonts/*.woff2`, read for their own `name` table:
 *    the copyright line (name id 0) and the license URL (name id 14) come from
 *    the font file itself, never from anywhere else. The full OFL 1.1 text is
 *    inlined when `docs/legal/OFL-1.1.txt` exists; until it does, the file
 *    prints the URL each font names for it.
 * 3. **Rust.** `src-tauri/Cargo.lock` names every crate the desktop build
 *    links. Without `cargo about` installed there is no offline source for each
 *    crate's license text, so the section lists crate and version and says
 *    where the text lives. Nothing is guessed.
 *
 * Usage:
 *   npx tsx scripts/gen-third-party-notices.ts          write the file
 *   npx tsx scripts/gen-third-party-notices.ts --check  exit 1 if it is stale
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The file name `docs/legal/notices.md` links to, and the pages sit beside. */
export const NOTICES_FILE = 'THIRD_PARTY_NOTICES.txt';
const TARGET = join(root, 'public', NOTICES_FILE);
const FONT_DIR = join(root, 'public', 'assets', 'fonts');
/** Drop this file in and the OFL text is inlined instead of linked. */
const OFL_TEXT = join(root, 'docs', 'legal', 'OFL-1.1.txt');

const RULE = '='.repeat(74);
const THIN = '-'.repeat(74);

function normalise(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

// ---------------------------------------------------------------------------
// npm production dependencies
// ---------------------------------------------------------------------------

export interface NpmNotice {
  name: string;
  version: string;
  license: string;
  homepage: string | null;
  /** Every license file the package ships, by file name, in a stable order. */
  texts: readonly { file: string; text: string }[];
}

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([._-].*)?(\.md|\.txt)?$/i;

/** The production tree, as the lockfile records it: everything not marked `dev`. */
export function productionPackageNames(lockfile: string): string[] {
  const lock = JSON.parse(lockfile) as {
    packages?: Record<string, { dev?: boolean; devOptional?: boolean }>;
  };
  const names: string[] = [];
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    if (path === '' || entry.dev === true || entry.devOptional === true) continue;
    const at = path.lastIndexOf('node_modules/');
    if (at < 0) continue;
    names.push(path.slice(at + 'node_modules/'.length));
  }
  return [...new Set(names)].sort();
}

export function readNpmNotices(projectRoot: string = root): NpmNotice[] {
  const names = productionPackageNames(readFileSync(join(projectRoot, 'package-lock.json'), 'utf8'));
  return names.map((name) => {
    const dir = join(projectRoot, 'node_modules', ...name.split('/'));
    if (!existsSync(join(dir, 'package.json'))) {
      throw new Error(
        `gen-third-party-notices: ${name} is a production dependency but is not installed; run \`npm ci\``,
      );
    }
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      version?: string;
      license?: string;
      homepage?: string;
      repository?: { url?: string } | string;
    };
    const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    const texts = readdirSync(dir)
      .filter((file) => LICENSE_FILE.test(file))
      .sort()
      .map((file) => ({ file, text: normalise(readFileSync(join(dir, file), 'utf8')) }));
    return {
      name,
      version: pkg.version ?? 'unknown',
      license: pkg.license ?? 'see the license text below',
      homepage: pkg.homepage ?? repository ?? null,
      texts,
    };
  });
}

// ---------------------------------------------------------------------------
// The bundled fonts, read from their own name tables
// ---------------------------------------------------------------------------

/** WOFF2's known-table list, in the spec's order; index 63 means a custom tag. */
const WOFF2_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca',
  'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
];

function readBase128(buf: Buffer, cursor: { offset: number }): number {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[cursor.offset++];
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error('gen-third-party-notices: malformed UIntBase128 in a woff2 table directory');
}

/**
 * The `name` table's strings, by name id, straight out of a woff2 file.
 *
 * The fonts are the only record of their own copyright that ships with the
 * game, so the notices quote them rather than a value typed in beside them: a
 * font swapped for a different cut updates this file on the next build.
 */
export function readFontNameTable(file: string): Record<number, string> {
  const buf = readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`gen-third-party-notices: ${file} is not woff2`);
  const numTables = buf.readUInt16BE(12);
  const cursor = { offset: 48 };
  const directory: { tag: string; length: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[cursor.offset++];
    const index = flags & 0x3f;
    let tag: string;
    if (index === 0x3f) {
      tag = buf.toString('latin1', cursor.offset, cursor.offset + 4);
      cursor.offset += 4;
    } else {
      tag = WOFF2_TAGS[index];
    }
    const transform = (flags >> 6) & 0x3;
    const originalLength = readBase128(buf, cursor);
    // glyf and loca are transformed at version 0; everything else at non-zero.
    const transformed = tag === 'glyf' || tag === 'loca' ? transform === 0 : transform !== 0;
    directory.push({ tag, length: transformed ? readBase128(buf, cursor) : originalLength });
  }
  const tables = brotliDecompressSync(buf.subarray(cursor.offset));
  let offset = 0;
  let name: Buffer | null = null;
  for (const entry of directory) {
    if (entry.tag === 'name') {
      name = tables.subarray(offset, offset + entry.length);
      break;
    }
    offset += entry.length;
  }
  if (!name) throw new Error(`gen-third-party-notices: ${file} carries no name table`);

  const count = name.readUInt16BE(2);
  const stringOffset = name.readUInt16BE(4);
  const strings: Record<number, string> = {};
  for (let i = 0; i < count; i++) {
    const record = 6 + i * 12;
    const platform = name.readUInt16BE(record);
    const encoding = name.readUInt16BE(record + 2);
    const nameId = name.readUInt16BE(record + 6);
    const length = name.readUInt16BE(record + 8);
    const at = stringOffset + name.readUInt16BE(record + 10);
    const raw = Buffer.from(name.subarray(at, at + length));
    const decoded =
      platform === 3 && (encoding === 0 || encoding === 1)
        ? raw.swap16().toString('utf16le')
        : raw.toString('latin1');
    if (strings[nameId] === undefined) strings[nameId] = decoded;
  }
  return strings;
}

export interface FontNotice {
  file: string;
  family: string;
  version: string | null;
  copyright: string | null;
  licenseUrl: string | null;
}

export function readFontNotices(dir: string = FONT_DIR): FontNotice[] {
  return readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith('.woff2'))
    .sort()
    .map((file) => {
      const names = readFontNameTable(join(dir, file));
      return {
        file,
        family: names[1] ?? file,
        version: names[5] ?? null,
        copyright: names[0] ?? null,
        licenseUrl: names[14] ?? null,
      };
    });
}

// ---------------------------------------------------------------------------
// The desktop app's Rust crates
// ---------------------------------------------------------------------------

export interface CrateNotice {
  name: string;
  version: string;
}

/**
 * Every crate the desktop build links, from the committed lockfile. Entries
 * with no `source` are this repo's own crate, not a third party.
 */
export function readCrateNotices(lockfile: string): CrateNotice[] {
  const crates: CrateNotice[] = [];
  for (const block of lockfile.split('[[package]]').slice(1)) {
    if (!/^\s*source\s*=/m.test(block)) continue;
    const name = block.match(/^\s*name\s*=\s*"(.*)"/m)?.[1];
    const version = block.match(/^\s*version\s*=\s*"(.*)"/m)?.[1];
    if (name && version) crates.push({ name, version });
  }
  return crates.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

export interface NoticesInput {
  npm: readonly NpmNotice[];
  fonts: readonly FontNotice[];
  crates: readonly CrateNotice[];
  /** The OFL 1.1 text, when a copy is committed; otherwise the fonts' URLs stand in. */
  oflText: string | null;
}

export function renderNotices(input: NoticesInput): string {
  const out: string[] = [];
  out.push(RULE, 'Darling Blades: third-party notices', RULE, '');
  out.push(
    'Darling Blades ships other people\'s work, and their licenses ask that these',
    'notices travel with it. This file is generated by',
    'scripts/gen-third-party-notices.ts from package-lock.json, the installed',
    'packages, the bundled font files and src-tauri/Cargo.lock. Do not edit it by',
    'hand.',
    '',
  );

  out.push(RULE, '1. Open-source packages (web and desktop)', RULE, '');
  for (const pkg of input.npm) {
    out.push(THIN, `${pkg.name} ${pkg.version}`, `License: ${pkg.license}`);
    if (pkg.homepage) out.push(`Home: ${pkg.homepage}`);
    out.push(THIN, '');
    if (pkg.texts.length === 0) {
      out.push(`(This package ships no license file; its license id is ${pkg.license}.)`, '');
      continue;
    }
    for (const text of pkg.texts) {
      if (pkg.texts.length > 1) out.push(`--- ${text.file} ---`, '');
      out.push(text.text, '');
    }
  }

  out.push(RULE, '2. Bundled fonts', RULE, '');
  out.push(
    'The fonts below are redistributed inside the game under the SIL Open Font',
    'License, Version 1.1. Each copyright line and license URL is read from the',
    'font file\'s own name table.',
    '',
  );
  for (const font of input.fonts) {
    out.push(THIN, `${font.family} (${font.file})`);
    if (font.version) out.push(`Version: ${font.version}`);
    if (font.copyright) out.push(`Copyright: ${font.copyright}`);
    if (font.licenseUrl) out.push(`License: SIL Open Font License 1.1, ${font.licenseUrl}`);
    out.push(THIN, '');
  }
  if (input.oflText) out.push(input.oflText, '');
  else {
    out.push(
      'The full text of the SIL Open Font License 1.1 is published at the address',
      'each font names above. It is not reproduced here: no copy of it ships in',
      'this repository yet. Committing one as docs/legal/OFL-1.1.txt inlines it',
      'in this section on the next build.',
      '',
    );
  }

  out.push(RULE, '3. Rust crates (desktop app only)', RULE, '');
  out.push(
    'The desktop installer redistributes the compiled crates below, as recorded in',
    'src-tauri/Cargo.lock. Their license texts are not reproduced here: `cargo',
    'about` is not part of this build, and each crate\'s full license text ships',
    'in its own registry source, under',
    '~/.cargo/registry/src/index.crates.io-*/<crate>-<version>/.',
    '',
  );
  for (const crate of input.crates) out.push(`  ${crate.name} ${crate.version}`);
  out.push('');
  out.push(RULE, `${input.crates.length} crate(s) listed.`, RULE, '');
  return out.join('\n');
}

export function buildNotices(projectRoot: string = root): string {
  return renderNotices({
    npm: readNpmNotices(projectRoot),
    fonts: readFontNotices(join(projectRoot, 'public', 'assets', 'fonts')),
    crates: readCrateNotices(readFileSync(join(projectRoot, 'src-tauri', 'Cargo.lock'), 'utf8')),
    oflText: existsSync(OFL_TEXT) ? normalise(readFileSync(OFL_TEXT, 'utf8')) : null,
  });
}

function main(argv: string[]): number {
  const text = buildNotices();
  if (argv.includes('--check')) {
    const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
    if (current !== text) {
      console.error(
        'gen-third-party-notices --check: public/THIRD_PARTY_NOTICES.txt is stale; run `npm run gen-third-party-notices`',
      );
      return 1;
    }
    console.log('gen-third-party-notices --check: public/THIRD_PARTY_NOTICES.txt matches the build inputs');
    return 0;
  }
  writeFileSync(TARGET, text);
  console.log(`gen-third-party-notices: wrote public/THIRD_PARTY_NOTICES.txt (${text.length} bytes)`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
