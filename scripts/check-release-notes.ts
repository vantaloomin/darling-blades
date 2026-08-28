/**
 * Release-notes anti-rot check.
 *
 * `release.yml` builds its GitHub Release body with `generate_release_notes:
 * true`, which lists the PRs between two tags. That is a changelog, not a
 * summary: v1.6.2, v1.6.3 and v1.6.4 all shipped with nothing but a list of PR
 * titles. A curated file gives the release page a human opening paragraph, and
 * the generated PR list still follows it.
 *
 * This checker exists so a missing file fails at PR TIME rather than at tag
 * time. A tag-triggered workflow is the worst place to discover a mistake:
 * `release.yml` never runs on pull requests, so nothing else would catch it
 * until the release was already public.
 *
 * It checks the version in package.json, which between cuts is the version
 * already released, so it stays green until someone bumps without writing
 * notes - exactly the moment we want it to fail.
 *
 * Usage:
 *   npx tsx scripts/check-release-notes.ts
 *   npx tsx scripts/check-release-notes.ts --version 1.7.0
 *   npx tsx scripts/check-release-notes.ts --version v1.7.0
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface ReleaseNotesIssue {
  kind: 'error';
  message: string;
}

export const RELEASE_NOTES_DIR = 'docs/release-notes';

function bareVersion(version: string): string {
  return version.startsWith('v') ? version.slice(1) : version;
}

export function releaseNotesPath(version: string, root = '.'): string {
  return join(root, RELEASE_NOTES_DIR, `v${bareVersion(version)}.md`);
}

/**
 * Release notes are PLAYER-FACING COPY, so the standing no-em-dash rule applies
 * (user direction 2026-07-15, codified in design-system.md). Catching it here
 * matters more than in most copy: the release page is read by people who are
 * not playing the game yet.
 */
export function checkReleaseNotes(version: string, root = '.'): ReleaseNotesIssue[] {
  const issues: ReleaseNotesIssue[] = [];
  const normalizedVersion = bareVersion(version);
  const path = releaseNotesPath(normalizedVersion, root);
  if (!existsSync(path)) {
    issues.push({
      kind: 'error',
      message:
        `No release notes for v${normalizedVersion}. Write ${RELEASE_NOTES_DIR}/v${normalizedVersion}.md ` +
        '(a short player-facing summary; the generated PR list follows it automatically).',
    });
    return issues;
  }
  const body = readFileSync(path, 'utf8');
  if (body.trim().length === 0) {
    issues.push({ kind: 'error', message: `${path} is empty.` });
    return issues;
  }
  if (body.includes('\u2014')) {
    issues.push({
      kind: 'error',
      message: `${path} contains an em-dash. Release notes are player-facing copy; use a comma, a colon, or a full stop.`,
    });
  }
  return issues;
}

function readVersion(root: string): string {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version as string;
}

export function runCli(argv: readonly string[], log: (line: string) => void = console.log): number {
  const root = resolve('.');
  const flagIndex = argv.indexOf('--version');
  const version = flagIndex >= 0 ? argv[flagIndex + 1] : readVersion(root);
  if (!version) {
    log('check-release-notes: --version needs a value');
    return 1;
  }
  const issues = checkReleaseNotes(version, root);
  for (const issue of issues) log(`error  ${issue.message}`);
  log(`check-release-notes: v${bareVersion(version)}, ${issues.length} issue(s)`);
  return issues.length > 0 ? 1 : 0;
}

// Importable for tests; runs only when invoked as the entry script.
if (process.argv[1]?.endsWith('check-release-notes.ts')) {
  process.exitCode = runCli(process.argv.slice(2));
}
