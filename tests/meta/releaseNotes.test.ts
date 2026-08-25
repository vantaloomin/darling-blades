import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkReleaseNotes, releaseNotesPath, RELEASE_NOTES_DIR } from '../../scripts/check-release-notes';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function root(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'darling-release-notes-'));
  dirs.push(dir);
  mkdirSync(join(dir, RELEASE_NOTES_DIR), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, RELEASE_NOTES_DIR, name), body, 'utf8');
  }
  return dir;
}

/**
 * release.yml never runs on pull requests, so a missing notes file would only
 * surface when a tag fired and the release was already public. This check is
 * what moves that failure to PR time.
 */
describe('release notes check', () => {
  it('fails when the current version has no notes', () => {
    const issues = checkReleaseNotes('1.7.0', root());
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('No release notes for v1.7.0');
    // The message must say what to write, not merely that something is missing.
    expect(issues[0].message).toContain('docs/release-notes/v1.7.0.md');
  });

  it('passes when notes exist', () => {
    expect(checkReleaseNotes('1.7.0', root({ 'v1.7.0.md': 'A real summary.\n' }))).toEqual([]);
  });

  it('rejects an empty file rather than shipping a blank release body', () => {
    const issues = checkReleaseNotes('1.7.0', root({ 'v1.7.0.md': '   \n' }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('is empty');
  });

  it('enforces the no-em-dash rule, because release notes are player-facing', () => {
    // Standing user direction 2026-07-15. The release page is read by people
    // who are not playing the game yet, so it matters more here than most copy.
    const issues = checkReleaseNotes('1.7.0', root({ 'v1.7.0.md': 'A summary \u2014 with an em-dash.\n' }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('em-dash');
  });

  it('builds the path release.yml looks for', () => {
    // release.yml resolves docs/release-notes/${GITHUB_REF_NAME}.md, and the tag
    // is v-prefixed, so this helper and that workflow must agree exactly.
    // Separator-agnostic: join() yields backslashes on Windows, and existsSync
    // accepts either. What must hold is the directory and the v-prefixed name,
    // because release.yml resolves docs/release-notes/${GITHUB_REF_NAME}.md and
    // the tag carries the v. A cut that tags v1.7.0 while package.json says
    // something else would miss the file, which is why the release checklist
    // bumps all three version surfaces together.
    const path = releaseNotesPath('1.7.0', '.');
    expect(path.endsWith('v1.7.0.md')).toBe(true);
    expect(path.includes('release-notes')).toBe(true);
    expect(RELEASE_NOTES_DIR).toBe('docs/release-notes');
  });

  it('accepts the notes shipped for the current version', () => {
    // Guards the repo itself: whatever package.json says, that file must pass.
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
    expect(checkReleaseNotes(version, '.')).toEqual([]);
  });
});
