/**
 * The sweep levers' acceptance gate, side by side (docs/plan-sweep-speed.md,
 * docs/metagame-sweep.md "Racing and screening the swaps").
 *
 *   npx tsx scripts/personas/compare-crafts.ts <craft.json> <craft.json> [<craft.json> [<craft.json>]]
 *
 * Takes two to four fanned-out craft files (craft-<persona>-r<n>.json) of the
 * same persona and round: the unraced craft first, then the raced (and
 * screened) arms. It prints the accepted swaps iteration by iteration, the
 * final decks (as the cards each arm holds that the first does not), the final
 * scores, and each arm's game accounting, and says whether each arm is the
 * first arm exactly once the lever keys (config.race, config.screen,
 * hillClimb.lever) are stripped.
 */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AcceptedSwap, HillClimbLog, MeasuredRecord } from './craft';
import { leverAccounting } from './lever';

/** The parts of a craft file the comparison reads. */
export interface ComparedCraft {
  personaId?: string;
  round?: number;
  config?: Record<string, unknown>;
  deck: string[];
  measured: MeasuredRecord;
  hillClimb: HillClimbLog;
}

export interface CraftArm {
  label: string;
  craft: ComparedCraft;
}

export interface ArmAccounting {
  proposed: number;
  screenedOut: number;
  racedOut: number;
  measuredInFull: number;
  accepted: number;
  hardGames: number;
  screenGames: number;
  unracedHardGames: number;
}

/** The craft with the lever keys removed, as the unraced craft would have written it. */
export function stripLevers(craft: ComparedCraft): ComparedCraft {
  const copy = JSON.parse(JSON.stringify(craft)) as ComparedCraft;
  if (copy.config) {
    delete copy.config.race;
    delete copy.config.screen;
  }
  delete copy.hillClimb.lever;
  return copy;
}

/**
 * Games an arm played. An unraced arm measured the greedy build and every
 * proposed swap in full; a levered arm journals its own counts.
 */
export function armAccounting(craft: ComparedCraft): ArmAccounting {
  if (craft.hillClimb.lever) return leverAccounting(craft.hillClimb.lever);
  const proposed = craft.hillClimb.acceptedSwaps.length + craft.hillClimb.rejectedSwaps;
  const hardGames = craft.measured.games * (1 + proposed);
  return {
    proposed,
    screenedOut: 0,
    racedOut: 0,
    measuredInFull: proposed,
    accepted: craft.hillClimb.acceptedSwaps.length,
    hardGames,
    screenGames: 0,
    unracedHardGames: hardGames,
  };
}

const counts = (deck: readonly string[]): Map<string, number> => {
  const out = new Map<string, number>();
  for (const id of deck) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
};

/** Cards (with multiplicity) in `deck` beyond those in `base`, sorted. */
export function deckSurplus(deck: readonly string[], base: readonly string[]): string[] {
  const baseCounts = counts(base);
  const surplus: string[] = [];
  for (const [id, count] of [...counts(deck)].sort(([a], [b]) => a.localeCompare(b))) {
    const extra = count - (baseCounts.get(id) ?? 0);
    for (let i = 0; i < extra; i++) surplus.push(id);
  }
  return surplus;
}

const pct = (score: number): string => `${(score * 100).toFixed(1)}%`;
const n = (value: number): string => value.toLocaleString('en-US');

export function compareCrafts(arms: readonly CraftArm[]): string[] {
  if (arms.length < 2 || arms.length > 4) throw new Error('Compare two to four crafts');
  const [first] = arms;
  for (const arm of arms.slice(1)) {
    if (arm.craft.personaId !== first.craft.personaId || arm.craft.round !== first.craft.round) {
      throw new Error(
        `${arm.label} is ${arm.craft.personaId} round ${arm.craft.round}; ` +
        `${first.label} is ${first.craft.personaId} round ${first.craft.round}`,
      );
    }
  }
  const lines: string[] = [];
  const labels = arms.map((arm) => arm.label);
  lines.push(`Persona ${first.craft.personaId}, round ${first.craft.round}; arms: ${labels.join(' | ')}`);

  lines.push('', 'Accepted swaps (iteration: out -> in, score after):');
  const byIteration = arms.map((arm) =>
    new Map(arm.craft.hillClimb.acceptedSwaps.map((swap: AcceptedSwap) => [swap.iteration, swap])));
  const iterations = [...new Set(byIteration.flatMap((map) => [...map.keys()]))].sort((a, b) => a - b);
  for (const iteration of iterations) {
    const cells = byIteration.map((map) => {
      const swap = map.get(iteration);
      return swap ? `${swap.out} -> ${swap.in} (${pct(swap.nextScore)})` : '-';
    });
    lines.push(`  ${String(iteration).padStart(3)}: ${cells.join(' | ')}`);
  }
  if (iterations.length === 0) lines.push('  none in any arm');

  lines.push('', 'Final decks, against the first arm:');
  for (const arm of arms.slice(1)) {
    const gained = deckSurplus(arm.craft.deck, first.craft.deck);
    const lost = deckSurplus(first.craft.deck, arm.craft.deck);
    lines.push(gained.length === 0 && lost.length === 0
      ? `  ${arm.label}: the same 40 cards`
      : `  ${arm.label}: +${gained.join(', +')}; -${lost.join(', -')}`);
  }

  lines.push('', 'Final scores:');
  for (const arm of arms) {
    const measured = arm.craft.measured;
    lines.push(`  ${arm.label}: ${pct(measured.score)} (${measured.rowWins}/${measured.rowWins + measured.losses} decided, ` +
      `${measured.draws} draws, ${n(measured.games)} games); accepted ${arm.craft.hillClimb.acceptedSwaps.length}`);
  }

  lines.push('', 'Games played:');
  for (const arm of arms) {
    const a = armAccounting(arm.craft);
    lines.push(`  ${arm.label}: ${a.proposed} proposed; ${a.screenedOut} screened out, ${a.racedOut} raced out, ` +
      `${a.measuredInFull} in full, ${a.accepted} accepted; ${n(a.hardGames)} Hard ` +
      `(${a.unracedHardGames === 0 ? '0.0' : ((a.hardGames / a.unracedHardGames) * 100).toFixed(1)}% of unraced) + ` +
      `${n(a.screenGames)} Medium`);
  }

  lines.push('', 'Identical to the first arm once the lever keys are stripped:');
  const reference = JSON.stringify(stripLevers(first.craft));
  for (const arm of arms.slice(1)) {
    lines.push(`  ${arm.label}: ${JSON.stringify(stripLevers(arm.craft)) === reference ? 'yes' : 'no'}`);
  }
  return lines;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url)).toLowerCase()) {
  try {
    const paths = process.argv.slice(2);
    const arms = paths.map((path) => ({
      label: basename(resolve(path, '..')) + '/' + basename(path),
      craft: JSON.parse(readFileSync(path, 'utf8')) as ComparedCraft,
    }));
    for (const line of compareCrafts(arms)) console.log(line);
  } catch (caught) {
    console.error(caught instanceof Error ? caught.message : String(caught));
    console.error('Usage: npx tsx scripts/personas/compare-crafts.ts <unraced craft.json> <raced craft.json> [up to two more]');
    process.exitCode = 1;
  }
}
