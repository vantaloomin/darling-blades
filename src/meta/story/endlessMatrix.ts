/**
 * The endless matrix (owner rulings E1 to E6, 2026-10-16):
 * `npx tsx scripts/balance-matrix.ts --story --endless <act1|menu> --seeds <N>`
 * plays N seeded headless endless runs per heroine (headlessRun.ts, its fixed
 * choice rules) and reports how deep they go: loops cleared per run, the
 * share reaching loops 3, 6 and 10, and duel W-L per loop and node kind.
 * `act1` runs play Act 1 first and only runs that clear it reach endless;
 * `menu` runs start at loop 1 with the menu head start (E3). Pure and
 * headless like storyMatrix.ts: the fold and table are plain functions of the
 * run results. Not a gate.
 */

import { CARD_DB } from '../../data/catalog';
import { STORY_CHARACTERS } from '../../data/story/characters';
import type { CardDb } from '../../engine/types';
import { freshSave } from '../SaveManager';
import { runHeadlessAct1, type HeadlessNodeSummary } from './headlessRun';
import { STORY_MATRIX_NOW, type StoryDuelTally } from './storyMatrix';

export type EndlessStart = 'act1' | 'menu';

/** Default cap on loops a matrix run plays (a run that clears it stops there). */
export const ENDLESS_MATRIX_MAX_LOOPS = 15;

export type EndlessMatrixRun =
  | {
      characterId: string;
      seed: number;
      reachedEndless: boolean;
      loopsCleared: number;
      nodes: readonly Pick<HeadlessNodeSummary, 'loop' | 'kind' | 'result'>[];
    }
  | { characterId: string; seed: number; error: string };

export interface EndlessLoopRow {
  loop: number;
  /** Runs that entered this loop. */
  entered: number;
  /** Runs that beat this loop's claimant. */
  cleared: number;
  fight: StoryDuelTally;
  elite: StoryDuelTally;
  claimant: StoryDuelTally;
}

export interface EndlessCharacterReport {
  characterId: string;
  runs: number;
  /** Runs that reached loop 1 (all finished menu runs; Act 1 clears for act1 runs). */
  reachedEndless: number;
  /** loopsCleared per run that reached endless, ascending. */
  depths: number[];
  loops: EndlessLoopRow[];
  impossible: { seed: number; message: string }[];
}

function tally(): StoryDuelTally {
  return { wins: 0, losses: 0 };
}

/** Fold run results into one report per heroine, in first-seen order. */
export function foldEndlessMatrix(runs: readonly EndlessMatrixRun[]): EndlessCharacterReport[] {
  const reports = new Map<string, EndlessCharacterReport>();
  for (const run of runs) {
    let report = reports.get(run.characterId);
    if (!report) {
      report = { characterId: run.characterId, runs: 0, reachedEndless: 0, depths: [], loops: [], impossible: [] };
      reports.set(run.characterId, report);
    }
    report.runs++;
    if ('error' in run) {
      report.impossible.push({ seed: run.seed, message: run.error });
      continue;
    }
    if (!run.reachedEndless) continue;
    report.reachedEndless++;
    report.depths.push(run.loopsCleared);
    const entered = new Set<number>();
    for (const node of run.nodes) {
      if (node.loop < 1) continue;
      while (report.loops.length < node.loop) {
        report.loops.push({ loop: report.loops.length + 1, entered: 0, cleared: 0, fight: tally(), elite: tally(), claimant: tally() });
      }
      const row = report.loops[node.loop - 1];
      if (!entered.has(node.loop)) {
        entered.add(node.loop);
        row.entered++;
      }
      if (node.result === undefined) continue;
      const cell = node.kind === 'boss' ? row.claimant : node.kind === 'elite' ? row.elite : node.kind === 'fight' ? row.fight : null;
      if (!cell) continue;
      if (node.result === 'win') cell.wins++;
      else cell.losses++;
      if (node.kind === 'boss' && node.result === 'win') row.cleared++;
    }
  }
  for (const report of reports.values()) report.depths.sort((a, b) => a - b);
  return [...reports.values()];
}

/** Play one seeded endless run for a heroine and reduce it to what the fold reads. */
export function playEndlessMatrixRun(
  characterId: string,
  seed: number,
  start: EndlessStart,
  maxLoops = ENDLESS_MATRIX_MAX_LOOPS,
  db: CardDb = CARD_DB,
): EndlessMatrixRun {
  const save = freshSave(STORY_MATRIX_NOW);
  save.story.unlockedCharacterIds = STORY_CHARACTERS.map((character) => character.id);
  try {
    const summary = runHeadlessAct1({ seed, now: STORY_MATRIX_NOW, characterId, db, save, endless: { start, maxLoops } });
    return {
      characterId,
      seed,
      reachedEndless: summary.reachedEndless,
      loopsCleared: summary.loopsCleared,
      nodes: summary.nodes.map((node) => ({ loop: node.loop, kind: node.kind, result: node.result })),
    };
  } catch (error) {
    return { characterId, seed, error: error instanceof Error ? error.message : String(error) };
  }
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${((100 * part) / whole).toFixed(1)}%` : '-';
}

function wl(t: StoryDuelTally): string {
  const n = t.wins + t.losses;
  return n === 0 ? '-' : `${t.wins}-${t.losses} (${pct(t.wins, n)})`;
}

function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function table(header: string[], rows: string[][]): string[] {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const fmt = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [fmt(header), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(fmt)];
}

/** The plain-text report the CLI prints. */
export function renderEndlessMatrix(reports: readonly EndlessCharacterReport[], seeds: number, start: EndlessStart, maxLoops: number): string {
  const lines: string[] = [];
  lines.push(`ENDLESS MATRIX - start ${start}, seeds 1..${seeds} per character, at most ${maxLoops} loops, headless fixed-choice runs`);
  lines.push('');
  const atLeast = (r: EndlessCharacterReport, n: number): string => {
    const count = r.depths.filter((d) => d >= n).length;
    return `${count} (${pct(count, r.depths.length)})`;
  };
  lines.push(...table(
    ['character', 'runs', 'reached endless', 'median loops', 'mean loops', 'loop 3+', 'loop 6+', 'loop 10+', 'impossible'],
    reports.map((r) => {
      const mean = r.depths.length > 0 ? r.depths.reduce((a, b) => a + b, 0) / r.depths.length : null;
      const med = median(r.depths);
      return [
        r.characterId,
        String(r.runs),
        String(r.reachedEndless),
        med === null ? '-' : String(med),
        mean === null ? '-' : mean.toFixed(2),
        atLeast(r, 3),
        atLeast(r, 6),
        atLeast(r, 10),
        String(r.impossible.length),
      ];
    }),
  ));
  for (const r of reports) {
    lines.push('');
    lines.push(`${r.characterId} by loop (loops cleared counts claimants beaten):`);
    lines.push(...table(
      ['loop', 'entered', 'cleared', 'fight W-L', 'elite W-L', 'claimant W-L'],
      r.loops.map((row) => [String(row.loop), String(row.entered), String(row.cleared), wl(row.fight), wl(row.elite), wl(row.claimant)]),
    ));
  }
  const impossible = reports.flatMap((r) => r.impossible.map((x) => `  ! ${r.characterId} seed ${x.seed}: ${x.message}`));
  lines.push('');
  lines.push(impossible.length === 0 ? 'IMPOSSIBLE SEEDS: none.' : ['IMPOSSIBLE SEEDS:', ...impossible].join('\n'));
  return lines.join('\n');
}
