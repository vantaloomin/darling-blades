/**
 * Story Mode content check (docs/plan-story-mode.md "Tooling and invariants"):
 * a thin CLI over src/meta/story/storyContent.ts. Checks the characters
 * (starter decks, land reserves, reward pools: real, story-legal cards from
 * Core Set I or II), the acts and elite intros (every avatar resolves, Tower
 * or Story-only, and every elite is stronger than every fight), the script
 * (unique ids, every event has its scene, every speaker and expression
 * exists, every heroine has her own scenes, no empty text or em-dash), every
 * event filter matches a card for every heroine, and every background and
 * portrait exists as art in story/ and story-half/.
 * Exits 1 on any error; warnings alone pass. Run via `npm run check-story`.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_DB } from '../src/data/catalog';
import { checkStoryContent, STORY_ART_DIRS } from '../src/meta/story/storyContent';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The art directories (of STORY_ART_DIRS) a story art id has no `.webp` in. */
export function missingStoryArt(artId: string, repoRoot = root): string[] {
  return STORY_ART_DIRS.filter((dir) => !existsSync(join(repoRoot, dir, `${artId}.webp`)));
}

function main(): void {
  const report = checkStoryContent(CARD_DB, { missingArt: (id) => missingStoryArt(id) });
  for (const warning of report.warnings) console.log(`warn ${warning}`);
  for (const error of report.errors) console.error(`FAIL ${error}`);
  const { characters, scenes, lines, events, speakers, artIds } = report.counts;
  const checked = `${characters} characters, ${scenes} scenes (${lines} lines), ${events} events, ${speakers} speakers, ${artIds} art ids x ${STORY_ART_DIRS.length} sizes`;
  console.log(`\ncheck-story: ${checked}; ${report.errors.length} error(s), ${report.warnings.length} warning(s)`);
  if (report.errors.length > 0) process.exit(1);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main();
