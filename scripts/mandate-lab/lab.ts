/**
 * The rate lab (2.0 plan: the Mandate's rates, B5; the life rates, D3): the
 * Warchest field with lab cards added (scripts/mandate-lab/cards.ts), every
 * arm of one arm set played game for game on the same seeds, at each
 * starting life asked for, Hard on both seats. It measures only; it changes
 * nothing in the game.
 *
 * USAGE
 *   npx tsx scripts/mandate-lab/lab.ts --crafts <dir> --out <file.jsonl>
 *     [--arms mandate] [--life 25] [--seeds 24] [--shard 0 --shards 1]
 *     [--workers 4] [--budget-minutes 330] [--pairs 0-9]
 *
 *   --crafts   a sweep directory's crafts/ (the round-0 craft-*-r0.json files),
 *              checked out from the `sweep-data` branch.
 *   --arms     the arm set (cards.ts ARM_SETS): mandate or life.
 *   --life     the starting life, or a comma list (20,25): every slot is
 *              played in every arm at every life.
 *   --seeds    games per pair per arm (seats alternate, so keep it even).
 *   --shard/--shards  this job's slice: game slots whose index mod shards is
 *              the shard. A slot is one (pair, game) played in every arm and life,
 *              so a shard always holds whole paired sets.
 *   --budget-minutes  stop dispatching new slots after this long; slots
 *              already started finish, so the output stays paired.
 *   --pairs    optional inclusive pair-index range, for a quick probe.
 *
 * Writes one JSON record per game (see LabGameRecord), sorted, plus a
 * `<out>.meta.json` with the field and the run's settings. The summary is
 * scripts/mandate-lab/summarize.ts.
 */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import { fieldPairs, gameSeed, loadField } from './field';
import { ARM_SETS, armNames, type ArmSetName } from './cards';
import type { LabGameJob, LabGameRecord } from './game';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const craftsDir = arg('crafts');
const out = arg('out');
if (!craftsDir || !out) {
  console.error('usage: lab.ts --crafts <dir> --out <file.jsonl> [--arms mandate] [--life 25] [--seeds n] ...');
  process.exit(2);
}
const armSet = (arg('arms') ?? 'mandate') as ArmSetName;
if (!(armSet in ARM_SETS)) {
  console.error(`--arms must be one of ${Object.keys(ARM_SETS).join(', ')}`);
  process.exit(2);
}
const ARM_NAMES = armNames(armSet);
const lives = (arg('life') ?? '25').split(',').map(Number);
const perSlot = ARM_NAMES.length * lives.length;
const seeds = Number(arg('seeds') ?? '24');
const shard = Number(arg('shard') ?? '0');
const shards = Number(arg('shards') ?? '1');
const workers = Number(arg('workers') ?? '4');
const budgetMs = Number(arg('budget-minutes') ?? '330') * 60_000;
const pairRange = arg('pairs')?.split('-').map(Number);

const field = loadField(craftsDir);
const pairs = fieldPairs(field.length);

// Slots in (pair, game) order; this shard takes every shards-th slot, so
// each shard samples every pair evenly.
interface Slot { pair: number; game: number }
const slots: Slot[] = [];
let slotIndex = 0;
for (const [p] of pairs.entries()) {
  for (let g = 0; g < seeds; g++, slotIndex++) {
    if (pairRange && (p < pairRange[0] || p > pairRange[1])) continue;
    if (slotIndex % shards === shard) slots.push({ pair: p, game: g });
  }
}

function jobsFor(slot: Slot): LabGameJob[] {
  const [r, c] = pairs[slot.pair];
  return lives.flatMap((life) => ARM_NAMES.map((arm) => ({
    arm,
    life,
    pair: slot.pair,
    game: slot.game,
    gameSeed: gameSeed(slot.pair, slot.game),
    rowIsP0: slot.game % 2 === 0,
    rowDeck: field[r].deck,
    colDeck: field[c].deck,
    rowReserve: field[r].landReserve,
    colReserve: field[c].landReserve,
  })));
}

const started = performance.now();
const records: LabGameRecord[] = [];
const queue: LabGameJob[] = [];
let nextSlot = 0;
let failed: string | null = null;
let stoppedEarly = false;

function refill(): void {
  while (queue.length === 0 && nextSlot < slots.length) {
    if (performance.now() - started > budgetMs) {
      stoppedEarly = true;
      nextSlot = slots.length;
      return;
    }
    queue.push(...jobsFor(slots[nextSlot++]));
  }
}

console.error(
  `rate lab (${armSet}): ${field.length} decks, ${pairs.length} pairs, ${ARM_NAMES.length} arms at ${lives.join('/')} life, ` +
    `${seeds} seeds; shard ${shard}/${shards} holds ${slots.length} slots ` +
    `(${slots.length * perSlot} games) on ${workers} workers`,
);

await new Promise<void>((resolveAll, rejectAll) => {
  let active = 0;
  let lastReport = performance.now();
  const pool: Worker[] = [];
  const finish = (): void => {
    for (const w of pool) void w.terminate();
    if (failed) rejectAll(new Error(failed));
    else resolveAll();
  };
  const feed = (w: Worker): void => {
    refill();
    const job = failed ? undefined : queue.shift();
    if (!job) {
      if (active === 0) finish();
      return;
    }
    active++;
    w.postMessage(job);
  };
  for (let i = 0; i < Math.max(1, workers); i++) {
    const w = new Worker(new URL('./worker-bootstrap.mjs', import.meta.url));
    pool.push(w);
    w.on('message', (msg: { ok: true; record: LabGameRecord } | { ok: false; error: string }) => {
      active--;
      if (msg.ok) records.push(msg.record);
      else failed = msg.error;
      const now = performance.now();
      if (now - lastReport > 60_000) {
        lastReport = now;
        const min = (now - started) / 60_000;
        console.error(
          `  ${records.length}/${slots.length * perSlot} games, ${min.toFixed(1)} min, ` +
            `${(records.length / min).toFixed(1)} games/min`,
        );
      }
      feed(w);
    });
    w.on('error', (e) => {
      failed = `worker error: ${e instanceof Error ? e.stack : String(e)}`;
      active = 0;
      finish();
    });
  }
  for (const w of pool) feed(w);
});

// Keep only complete sets, so a budget stop never leaves an arm short.
const bySlot = new Map<string, LabGameRecord[]>();
for (const rec of records) {
  const key = `${rec.pair}:${rec.game}`;
  bySlot.set(key, [...(bySlot.get(key) ?? []), rec]);
}
const complete = [...bySlot.values()]
  .filter((group) => group.length === perSlot)
  .flat()
  .sort((a, b) => a.pair - b.pair || a.game - b.game || a.life - b.life || ARM_NAMES.indexOf(a.arm) - ARM_NAMES.indexOf(b.arm));

writeFileSync(out, complete.map((r) => JSON.stringify(r)).join('\n') + '\n');
const minutes = (performance.now() - started) / 60_000;
writeFileSync(
  `${out}.meta.json`,
  JSON.stringify(
    {
      armSet,
      lives,
      arms: ARM_SETS[armSet],
      seeds,
      shard,
      shards,
      workers,
      slotsPlanned: slots.length,
      slotsComplete: complete.length / perSlot,
      stoppedEarly,
      minutes: Number(minutes.toFixed(2)),
      field: field.map((d) => ({ id: d.id, name: d.name, kind: d.kind })),
      pairs,
    },
    null,
    2,
  ),
);
console.error(
  `done: ${complete.length} games (${complete.length / perSlot} slots of ${slots.length})` +
    `${stoppedEarly ? ', STOPPED AT BUDGET' : ''} in ${minutes.toFixed(1)} min`,
);
