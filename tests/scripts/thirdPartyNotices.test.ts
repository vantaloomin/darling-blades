import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildNotices,
  productionPackageNames,
  readCrateNotices,
  readFontNameTable,
  readFontNotices,
  readNpmNotices,
} from '../../scripts/gen-third-party-notices';

/**
 * The notices file is a redistribution obligation, not a nicety: MIT, Apache
 * 2.0, BSD and the OFL all require the notice to travel with the copy. So what
 * is tested is coverage and provenance, never the file's wording. Every
 * production dependency the lockfile names has to appear with the version that
 * is actually installed, every bundled font has to carry the copyright line
 * that font file itself holds, and every crate the desktop build links has to
 * be listed. The file's own prose is free to change.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOTICES = buildNotices(root);

describe('the third-party notices', () => {
  it('names every production npm package at its installed version', () => {
    const names = productionPackageNames(readFileSync(join(root, 'package-lock.json'), 'utf8'));
    expect(names.length).toBeGreaterThan(0);
    for (const notice of readNpmNotices(root)) {
      expect(names).toContain(notice.name);
      expect(NOTICES, notice.name).toContain(`${notice.name} ${notice.version}`);
      const installed = JSON.parse(
        readFileSync(join(root, 'node_modules', ...notice.name.split('/'), 'package.json'), 'utf8'),
      ) as { version: string };
      expect(notice.version, notice.name).toBe(installed.version);
    }
  });

  it('leaves the dev-only tree out of a file about what ships', () => {
    const names = productionPackageNames(readFileSync(join(root, 'package-lock.json'), 'utf8'));
    for (const devOnly of ['vite', 'vitest', 'typescript', 'eslint']) {
      expect(names, devOnly).not.toContain(devOnly);
      expect(NOTICES, devOnly).not.toContain(`\n${devOnly} `);
    }
  });

  it('carries each package\'s own license text, not just its license id', () => {
    for (const notice of readNpmNotices(root)) {
      if (notice.texts.length === 0) continue;
      // A distinctive line from the real file, so a truncated copy fails.
      const marker = notice.texts[0].text
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 40);
      expect(marker, notice.name).toBeTruthy();
      expect(NOTICES, notice.name).toContain(marker as string);
    }
  });

  it('quotes each bundled font\'s copyright from the font file itself', () => {
    const fonts = readFontNotices(join(root, 'public', 'assets', 'fonts'));
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      const fromFile = readFontNameTable(join(root, 'public', 'assets', 'fonts', font.file));
      expect(fromFile[0], font.file).toBeTruthy();
      expect(NOTICES, font.file).toContain(fromFile[0]);
      expect(NOTICES, font.file).toContain(fromFile[1]);
      expect(font.licenseUrl, font.file).toBeTruthy();
      expect(NOTICES, font.file).toContain(font.licenseUrl as string);
    }
  });

  it('lists every crate the desktop build links, and none of our own', () => {
    const lock = readFileSync(join(root, 'src-tauri', 'Cargo.lock'), 'utf8');
    const crates = readCrateNotices(lock);
    expect(crates.length).toBeGreaterThan(0);
    for (const crate of crates) expect(NOTICES, crate.name).toContain(`${crate.name} ${crate.version}`);
    // The app's own crate has no registry source and is not a third party.
    const local = lock
      .split('[[package]]')
      .slice(1)
      .filter((block) => !/^\s*source\s*=/m.test(block))
      .map((block) => block.match(/^\s*name\s*=\s*"(.*)"/m)?.[1]);
    expect(local.length).toBeGreaterThan(0);
    for (const name of local) expect(crates.map((crate) => crate.name)).not.toContain(name);
  });

  it('is byte-identical on a second run, which is what --check compares', () => {
    expect(buildNotices(root)).toBe(NOTICES);
  });
});
