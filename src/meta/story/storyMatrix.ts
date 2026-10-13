/**
 * The story matrix (docs/plan-story-mode.md, wave 3 measurement):
 * `npx tsx scripts/balance-matrix.ts --story --seeds <N>` plays N seeded
 * headless Act 1 runs per character (headlessRun.ts, its fixed choice rules)
 * and folds them into a per-character report. Pure and headless: the play
 * half calls runHeadlessAct1; the fold and the table are plain functions of
 * the run results, so a test can feed them hand-made runs.
 *
 * Seeds are 1..N for every character, with one fixed `now` (it only names the
 * run), so the same flags print the same table. A run that throws is an
 * "impossible seed"; one whose duel hits headlessRun's action cap is reported
 * as hung (an infinite loop inside a single engine call would still hang the
 * process; nothing in-process can catch that).
 */

import { CARD_DB } from '../../data/catalog';
import { STORY_CHARACTERS } from '../../data/story/characters';
import type { CardDb } from '../../engine/types';
import { freshSave } from '../SaveManager';
import { runHeadlessAct1, type HeadlessNodeSummary } from './headlessRun';

/** The `now` every matrix run starts at (the 2026-10-12/13 measurements used it too). */
export const STORY_MATRIX_NOW = 1_700_000_000_000;

export const STORY_MATRIX_DUEL_KINDS = ['fight', 'elite', 'boss'] as const;
export type StoryMatrixDuelKind = (typeof STORY_MATRIX_DUEL_KINDS)[number];

/** What the fold reads from one run: a headless summary's parts, or the error it threw. */
export type StoryMatrixRun =
  | {
      characterId: string;
      seed: number;
      cleared: boolean;
      nodes: readonly Pick<HeadlessNodeSummary, 'floor' | 'kind' | 'result' | 'turns' | 'endReason'>[];
    }
  | { characterId: string; seed: number; error: { kind: 'threw' | 'hung'; message: string } };

export interface StoryDuelTally {
  wins: number;
  losses: number;
}

export interface StoryCharacterReport {
  characterId: string;
  /** Every run attempted, impossible seeds included. */
  runs: number;
  /** Runs that finished (did not throw or hang). */
  finished: number;
  clears: number;
  /** reachedFloor[f - 1]: finished runs that entered a node on floor f. */
  reachedFloor: number[];
  /** lostOnFloor[f - 1]: finished runs that lost their duel on floor f (a clear loses nowhere). */
  lostOnFloor: number[];
  duels: StoryDuelTally;
  byKind: Record<StoryMatrixDuelKind, StoryDuelTally>;
  /** Mean of each duel's last game turn (both players' turns count), over every duel played (null with none). */
  meanTurns: number | null;
  /** How the heroine's duels were lost. */
  lossesBy: { life: number; deck: number; other: number };
  impossible: { seed: number; kind: 'threw' | 'hung'; message: string }[];
}

function emptyReport(characterId: string, floors: number): StoryCharacterReport {
  return {
    characterId,
    runs: 0,
    finished: 0,
    clears: 0,
    reachedFloor: Array.from({ length: floors }, () => 0),
    lostOnFloor: Array.from({ length: floors }, () => 0),
    duels: { wins: 0, losses: 0 },
    byKind: { fight: { wins: 0, losses: 0 }, elite: { wins: 0, losses: 0 }, boss: { wins: 0, losses: 0 } },
    meanTurns: null,
    lossesBy: { life: 0, deck: 0, other: 0 },
    impossible: [],
  };
}

function isDuelKind(kind: string): kind is StoryMatrixDuelKind {
  return (STORY_MATRIX_DUEL_KINDS as readonly string[]).includes(kind);
}

/**
 * Fold run results into one report per character, in the order characters
 * first appear in `runs`. `floors` is the act's floor count.
 */
export function foldStoryMatrix(runs: readonly StoryMatrixRun[], floors: number): StoryCharacterReport[] {
  const reports = new Map<string, StoryCharacterReport>();
  const turnSums = new Map<string, { total: number; duels: number }>();
  for (const run of runs) {
    let report = reports.get(run.characterId);
    if (!report) {
      report = emptyReport(run.characterId, floors);
      reports.set(run.characterId, report);
      turnSums.set(run.characterId, { total: 0, duels: 0 });
    }
    report.runs++;
    if ('error' in run) {
      report.impossible.push({ seed: run.seed, kind: run.error.kind, message: run.error.message });
      continue;
    }
    report.finished++;
    if (run.cleared) report.clears++;
    const turns = turnSums.get(run.characterId)!;
    const floorsReached = new Set<number>();
    for (const node of run.nodes) {
      if (node.floor >= 1 && node.floor <= floors) floorsReached.add(node.floor);
      if (!isDuelKind(node.kind) || node.result === undefined) continue;
      const won = node.result === 'win';
      const tally = report.byKind[node.kind];
      if (won) {
        tally.wins++;
        report.duels.wins++;
      } else {
        tally.losses++;
        report.duels.losses++;
        if (node.endReason === 'life') report.lossesBy.life++;
        else if (node.endReason === 'deck') report.lossesBy.deck++;
        else report.lossesBy.other++;
        if (node.floor >= 1 && node.floor <= floors) report.lostOnFloor[node.floor - 1]++;
      }
      if (node.turns !== undefined) {
        turns.total += node.turns;
        turns.duels++;
      }
    }
    for (const floor of floorsReached) report.reachedFloor[floor - 1]++;
  }
  for (const [id, report] of reports) {
    const turns = turnSums.get(id)!;
    report.meanTurns = turns.duels > 0 ? turns.total / turns.duels : null;
  }
  return [...reports.values()];
}

/** Play one seeded Act 1 run for a character and reduce it to what the fold reads. */
export function playStoryMatrixRun(characterId: string, seed: number, db: CardDb = CARD_DB): StoryMatrixRun {
  const save = freshSave(STORY_MATRIX_NOW);
  // Every heroine is playable in the matrix; unlocks are not what it measures.
  save.story.unlockedCharacterIds = STORY_CHARACTERS.map((character) => character.id);
  try {
    const summary = runHeadlessAct1({ seed, now: STORY_MATRIX_NOW, characterId, db, save });
    return { characterId, seed, cleared: summary.cleared, nodes: summary.nodes };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { characterId, seed, error: { kind: /did not finish in/.test(message) ? 'hung' : 'threw', message } };
  }
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${((100 * part) / whole).toFixed(1)}%` : '-';
}

function wl(tally: StoryDuelTally): string {
  return `${tally.wins}-${tally.losses} (${pct(tally.wins, tally.wins + tally.losses)})`;
}

/** The plain-text table the CLI prints. */
export function renderStoryMatrix(reports: readonly StoryCharacterReport[], seeds: number): string {
  const lines: string[] = [];
  lines.push(`STORY MATRIX - Act 1, seeds 1..${seeds} per character, headless fixed-choice runs (MediumAI heroine vs each avatar's own brain)`);
  lines.push('');
  const header = ['character', 'runs', 'clears', 'duels W-L', 'fight W-L', 'elite W-L', 'boss W-L (when reached)', 'mean game turns', 'losses life/deck/other', 'impossible'];
  const rows = reports.map((r) => [
    r.characterId,
    String(r.runs),
    `${r.clears} (${pct(r.clears, r.runs)})`,
    wl(r.duels),
    wl(r.byKind.fight),
    wl(r.byKind.elite),
    wl(r.byKind.boss),
    r.meanTurns === null ? '-' : r.meanTurns.toFixed(1),
    `${r.lossesBy.life}/${r.lossesBy.deck}/${r.lossesBy.other}`,
    String(r.impossible.length),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const fmt = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  lines.push(fmt(header));
  lines.push(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) lines.push(fmt(row));
  lines.push('');
  const floors = reports[0]?.reachedFloor.length ?? 0;
  lines.push(`Survival by floor (finished runs that reached floor f; lost on f in brackets):`);
  const floorHeader = ['character', ...Array.from({ length: floors }, (_, i) => `f${i + 1}`)];
  const floorRows = reports.map((r) => [r.characterId, ...r.reachedFloor.map((n, i) => `${n}${r.lostOnFloor[i] ? ` [${r.lostOnFloor[i]}]` : ''}`)]);
  const fw = floorHeader.map((h, i) => Math.max(h.length, ...floorRows.map((row) => row[i].length)));
  const ffmt = (cells: string[]): string => cells.map((c, i) => c.padEnd(fw[i])).join('  ').trimEnd();
  lines.push(ffmt(floorHeader));
  for (const row of floorRows) lines.push(ffmt(row));
  const impossible = reports.flatMap((r) => r.impossible.map((x) => `  ! ${r.characterId} seed ${x.seed} ${x.kind}: ${x.message}`));
  lines.push('');
  if (impossible.length === 0) lines.push('IMPOSSIBLE SEEDS: none.');
  else {
    lines.push('IMPOSSIBLE SEEDS:');
    lines.push(...impossible);
  }
  return lines.join('\n');
}
