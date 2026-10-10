/**
 * Summarise the rate lab's shards (scripts/mandate-lab/lab.ts): the
 * Mandate set into the rates lane B5 enters in the scorer and the AI; any
 * other set into each arm's value in mana at each starting life.
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
import { ARMS, armNames, type ArmName, type ArmSetName } from './cards';
import type { LabGameRecord } from './game';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: summarize.ts <dir> [--out report.md]');
  process.exit(2);
}
const outIdx = process.argv.indexOf('--out');
const out = outIdx >= 0 ? process.argv[outIdx + 1] : 'report.md';

const records: LabGameRecord[] = [];
interface Meta {
  field: { id: string; name: string }[];
  pairs: [number, number][];
  armSet?: ArmSetName;
  lives?: number[];
  /** Runs before arm sets existed: one life, the Mandate set. */
  life?: number;
  minutes: number;
  stoppedEarly: boolean;
}
const metas: Meta[] = [];
for (const f of readdirSync(dir).sort()) {
  if (f.endsWith('.jsonl')) {
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) if (line.trim()) records.push(JSON.parse(line));
  } else if (f.endsWith('.meta.json')) metas.push(JSON.parse(readFileSync(join(dir, f), 'utf8')));
}
if (records.length === 0) throw new Error(`no records in ${dir}`);
const { field, pairs } = metas[0];
const armSet: ArmSetName = metas[0].armSet ?? 'mandate';
const lives = metas[0].lives ?? [metas[0].life ?? 25];
const ARM_NAMES = armNames(armSet);
const stoppedEarly = metas.some((m) => m.stoppedEarly);
const minutes = Math.max(...metas.map((m) => m.minutes));

const score = (r: LabGameRecord): number => (r.w === 0 ? 1 : r.w === 2 ? 0.5 : 0);
type Slot = Partial<Record<ArmName, LabGameRecord>>;
/** One life's paired slots, complete in every arm. Old records carry no life. */
function slotsAt(life: number): Slot[] {
  const bySlot = new Map<string, Slot>();
  for (const r of records) {
    if ((r.life ?? lives[0]) !== life) continue;
    const key = `${r.pair}:${r.game}`;
    const slot = bySlot.get(key) ?? {};
    slot[r.arm] = r;
    bySlot.set(key, slot);
  }
  return [...bySlot.values()].filter((s) => ARM_NAMES.every((a) => s[a]));
}

interface Est { mean: number; se: number; n: number }
function est(xs: number[]): Est {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  return { mean, se: sd / Math.sqrt(n), n };
}
const lift = (slots: Slot[], a: ArmName, b: ArmName): Est => est(slots.map((s) => score(s[a]!) - score(s[b]!)));
const winRate = (slots: Slot[], a: ArmName): Est => est(slots.map((s) => score(s[a]!)));
const ratio = (num: number, den: number): number => (den === 0 ? 0 : num / den);
const pts = (e: Est): string => `${(e.mean * 100).toFixed(2)} ± ${(e.se * 100).toFixed(2)} pts`;
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

function mandateReport(): { report: object; lines: string[] } {
  const life = lives[0];
  const slots = slotsAt(life);
  const sumOf = (arm: ArmName, f: (r: LabGameRecord) => number): number => slots.reduce((t, s) => t + f(s[arm]!), 0);

  const mana = lift(slots, 'mana', 'base');
  const claimLift = lift(slots, 'claim', 'base');
  const contestedLift = lift(slots, 'contested', 'contestedBase');
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

  const report = {
    life,
    slots: slots.length,
    stoppedEarly,
    minutes,
    baseWinRate: winRate(slots, 'base'),
    mana,
    claim: { lift: claimLift, mana: inMana(claimLift) },
    contested: { lift: contestedLift, mana: inMana(contestedLift) },
    hold,
    medianTurnsMean: turns.mean,
    swornField,
    sworn,
  };
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
  return { report, lines };
}

/**
 * Any set but the Mandate's: at each life, a mana's lift and every other
 * arm's lift over base in those mana, so a card is priced against the same
 * mana at each life. With several lives, the scale is each arm's value in
 * mana at a life over its value at the first life asked for.
 */
function armReport(): { report: object; lines: string[] } {
  const subjects = ARM_NAMES.filter((a) => a !== 'base' && a !== 'mana');
  const atLife = lives.map((life) => {
    const slots = slotsAt(life);
    const mana = lift(slots, 'mana', 'base');
    return {
      life,
      slots: slots.length,
      baseWinRate: winRate(slots, 'base'),
      meanTurns: est(slots.map((s) => s.base!.turns)).mean,
      mana,
      arms: Object.fromEntries(subjects.map((a) => {
        const vs = ARMS[a].vs ?? 'base';
        const l = lift(slots, a, vs);
        // What the row did with its lab cards a game (older runs recorded none).
        const perGame = (f: (r: LabGameRecord) => number | undefined): number => ratio(slots.reduce((t, s) => t + (f(s[a]!) ?? 0), 0), slots.length);
        const use = {
          entered: perGame((r) => r.labEntered?.[0]),
          enteredMarks: perGame((r) => r.labEnteredMarks?.[0]),
          activations: perGame((r) => r.labActivations?.[0]),
          marksSpent: perGame((r) => r.labMarksSpent?.[0]),
        };
        return [a, { vs, lift: l, mana: ratio(l.mean, mana.mean), use }];
      })) as Record<string, { vs: ArmName; lift: Est; mana: number; use: Record<string, number> }>,
    };
  });
  const first = atLife[0];
  const report = { armSet, lives, stoppedEarly, minutes, atLife };
  const lines = [
    `# Rate lab, ${armSet} set, at ${lives.join(' and ')} life`,
    '',
    `Each slot played in all ${ARM_NAMES.length} arms at every life, Hard on both seats.${stoppedEarly ? ' **Some shards stopped at their time budget.**' : ''}`,
    '',
    '| Life | Arm | Read against | Slots | Mean turns | Paired lift | In mana | Lab cards in play a game | Marks they arrived with | Activations a game |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...atLife.flatMap((a) => [
      `| ${a.life} | mana (the unit) | base | ${a.slots} | ${a.meanTurns.toFixed(1)} | ${pts(a.mana)} | 1 | | | |`,
      ...subjects.map((s) => {
        const r = a.arms[s];
        return `| ${a.life} | ${s} | ${r.vs} | ${a.slots} | ${a.meanTurns.toFixed(1)} | ${pts(r.lift)} | ${r.mana.toFixed(2)} | ${r.use.entered.toFixed(2)} | ${r.use.enteredMarks.toFixed(2)} | ${r.use.activations.toFixed(2)} |`;
      }),
    ]),
    '',
    ...(lives.length > 1
      ? [
          `Scale against ${first.life} life (value in mana at that life over value at ${first.life}):`,
          '',
          `| Life | ${subjects.join(' | ')} |`,
          `| --- | ${subjects.map(() => '---').join(' | ')} |`,
          ...atLife.map((a) => `| ${a.life} | ${subjects.map((s) => ratio(a.arms[s].mana, first.arms[s].mana).toFixed(2)).join(' | ')} |`),
          '',
        ]
      : []),
  ];
  return { report, lines };
}

const { report, lines } = armSet === 'mandate' ? mandateReport() : armReport();
writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify(report, null, 2));
writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
