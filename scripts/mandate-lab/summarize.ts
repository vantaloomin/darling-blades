/**
 * Summarise the Mandate lab's shards (scripts/mandate-lab/lab.ts) into the
 * rates lane B5 enters in the scorer and the AI.
 *
 * USAGE
 *   npx tsx scripts/mandate-lab/summarize.ts <dir of shard-*.jsonl> [--out report.md]
 *
 * Every arm is played on the same (pair, game) slots, so arms are compared
 * game for game: the paired difference of the row's score (win 1, draw 1/2,
 * loss 0), with its standard error. A mana is the `mana` arm's lift over
 * `base` (the same body one cheaper), and each card's value is quoted in
 * those mana too.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARM_NAMES, type ArmName } from './cards';
import type { LabGameRecord } from './game';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: summarize.ts <dir> [--out report.md]');
  process.exit(2);
}
const outIdx = process.argv.indexOf('--out');
const out = outIdx >= 0 ? process.argv[outIdx + 1] : 'report.md';

const records: LabGameRecord[] = [];
const metas: { field: { id: string; name: string }[]; pairs: [number, number][]; life: number; minutes: number; stoppedEarly: boolean }[] = [];
for (const f of readdirSync(dir).sort()) {
  if (f.endsWith('.jsonl')) {
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) if (line.trim()) records.push(JSON.parse(line));
  } else if (f.endsWith('.meta.json')) metas.push(JSON.parse(readFileSync(join(dir, f), 'utf8')));
}
if (records.length === 0) throw new Error(`no records in ${dir}`);
const { field, pairs, life } = metas[0];

const score = (r: LabGameRecord): number => (r.w === 0 ? 1 : r.w === 2 ? 0.5 : 0);
const bySlot = new Map<string, Partial<Record<ArmName, LabGameRecord>>>();
for (const r of records) {
  const key = `${r.pair}:${r.game}`;
  const slot = bySlot.get(key) ?? {};
  slot[r.arm] = r;
  bySlot.set(key, slot);
}
const slots = [...bySlot.values()].filter((s) => ARM_NAMES.every((a) => s[a]));

interface Est { mean: number; se: number; n: number }
function est(xs: number[]): Est {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  return { mean, se: sd / Math.sqrt(n), n };
}
const lift = (a: ArmName, b: ArmName): Est => est(slots.map((s) => score(s[a]!) - score(s[b]!)));
const winRate = (a: ArmName): Est => est(slots.map((s) => score(s[a]!)));
const ratio = (num: number, den: number): number => (den === 0 ? 0 : num / den);
const sumOf = (arm: ArmName, f: (r: LabGameRecord) => number): number => slots.reduce((t, s) => t + f(s[arm]!), 0);

const mana = lift('mana', 'base');
const claimLift = lift('claim', 'base');
const contestedLift = lift('contested', 'contestedBase');
const inMana = (e: Est): number => ratio(e.mean, mana.mean);

// Holding: the subject's share of its own dawns, overall and after its first claim.
const holdOf = (arm: ArmName, side: 0 | 1) => ({
  holdShare: ratio(sumOf(arm, (r) => r.holdDawns[side]), sumOf(arm, (r) => r.dawns[side])),
  holdAfterClaim: ratio(sumOf(arm, (r) => r.holdDawns[side]), sumOf(arm, (r) => r.dawnsSinceClaim[side])),
  claimedIn: ratio(sumOf(arm, (r) => (r.firstHold[side] === null ? 0 : 1)), slots.length),
  claimsPerGame: ratio(sumOf(arm, (r) => r.claims[side]), slots.length),
  stealsPerGame: ratio(sumOf(arm, (r) => r.steals[side]), slots.length),
});
const hold = {
  claim: holdOf('claim', 0),
  contested: holdOf('contested', 0),
  contestedOpponent: holdOf('contested', 1),
};

// Sworn: the share of a deck's dawns with a legendary creature in play, from
// the base arm (both seats), per field deck and over the field.
const sworn = field.map((d, i) => {
  let dawns = 0;
  let legend = 0;
  for (const s of slots) {
    const r = s.base!;
    const [row, col] = pairs[r.pair];
    if (row === i) { dawns += r.dawns[0]; legend += r.legendDawns[0]; }
    if (col === i) { dawns += r.dawns[1]; legend += r.legendDawns[1]; }
  }
  return { id: d.id, name: d.name, rate: ratio(legend, dawns) };
});
const swornField = ratio(
  slots.reduce((t, s) => t + s.base!.legendDawns[0] + s.base!.legendDawns[1], 0),
  slots.reduce((t, s) => t + s.base!.dawns[0] + s.base!.dawns[1], 0),
);
const turns = est(slots.map((s) => s.base!.turns));

const pts = (e: Est): string => `${(e.mean * 100).toFixed(2)} ± ${(e.se * 100).toFixed(2)} pts`;
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const report = {
  life,
  slots: slots.length,
  stoppedEarly: metas.some((m) => m.stoppedEarly),
  minutes: Math.max(...metas.map((m) => m.minutes)),
  baseWinRate: winRate('base'),
  mana,
  claim: { lift: claimLift, mana: inMana(claimLift) },
  contested: { lift: contestedLift, mana: inMana(contestedLift) },
  hold,
  medianTurnsMean: turns.mean,
  swornField,
  sworn,
};
writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify(report, null, 2));

const lines = [
  `# Mandate lab (2.0 B5) at ${life} life`,
  '',
  `${slots.length} slots, each played in all ${ARM_NAMES.length} arms (${slots.length * ARM_NAMES.length} games), Hard on both seats.${report.stoppedEarly ? ' **Some shards stopped at their time budget.**' : ''}`,
  '',
  '## Value',
  '',
  '| Reading | Paired lift | In mana |',
  '| --- | --- | --- |',
  `| One mana (3/3 for 2 over 3/3 for 3) | ${pts(mana)} | 1 |`,
  `| Claim on arrival, opponent never claims | ${pts(claimLift)} | ${inMana(claimLift).toFixed(2)} |`,
  `| Claim on arrival, opponent claims too | ${pts(contestedLift)} | ${inMana(contestedLift).toFixed(2)} |`,
  '',
  '## Holding it',
  '',
  '| Arm | Claimed in | Hold share of all dawns | Hold share after first claim | Claims a game | Steals a game |',
  '| --- | --- | --- | --- | --- | --- |',
  ...(['claim', 'contested', 'contestedOpponent'] as const).map((k) => {
    const h = hold[k];
    return `| ${k} | ${pct(h.claimedIn)} | ${pct(h.holdShare)} | ${pct(h.holdAfterClaim)} | ${h.claimsPerGame.toFixed(2)} | ${h.stealsPerGame.toFixed(2)} |`;
  }),
  '',
  '## Sworn: dawns with a legendary creature in play (base arm)',
  '',
  `Over the field: ${pct(swornField)}.`,
  '',
  '| Deck | Rate |',
  '| --- | --- |',
  ...[...sworn].sort((a, b) => b.rate - a.rate).map((d) => `| ${d.name} | ${pct(d.rate)} |`),
  '',
];
writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
