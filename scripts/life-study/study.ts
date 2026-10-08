/**
 * The starting-life study (2.0 plan, lane D, D1): the same Warchest field
 * played at several starting life totals, game for game on the same seeds,
 * Hard on both seats. It measures only; it changes nothing in the game.
 *
 * USAGE
 *   npx tsx scripts/life-study/study.ts --crafts <dir> --out <file.jsonl>
 *     [--lives 20,25,30] [--seeds 24] [--shard 0 --shards 1]
 *     [--workers 4] [--budget-minutes 330] [--pairs 0-9]
 *
 *   --crafts   a sweep directory's crafts/ (the round-0 craft-*-r0.json files),
 *              checked out from the `sweep-data` branch.
 *   --seeds    games per pair per life arm (seats alternate, so keep it even).
 *   --shard/--shards  this job's slice: game slots whose index mod shards is
 *              the shard. A slot is one (pair, game) played at every life,
 *              so a shard always holds whole paired triples.
 *   --budget-minutes  stop dispatching new slots after this long; slots
 *              already started finish, so the output stays paired.
 *   --pairs    optional inclusive pair-index range, for a quick probe.
 *
 * Writes one JSON record per game (see StudyGameRecord), sorted, plus a
 * `<out>.meta.json` with the field and the run's settings. The summary is
 * scripts/life-study/summarize.ts.
 */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import { fieldPairs, gameSeed, loadField } from './field';
import type { StudyGameJob, StudyGameRecord } from './game';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const craftsDir = arg('crafts');
const out = arg('out');
if (!craftsDir || !out) {
  console.error('usage: study.ts --crafts <dir> --out <file.jsonl> [--lives 20,25,30] [--seeds n] ...');
  process.exit(2);
}
const lives = (arg('lives') ?? '20,25,30').split(',').map(Number);
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

function jobsFor(slot: Slot): StudyGameJob[] {
  const [r, c] = pairs[slot.pair];
  return lives.map((life) => ({
    life,
    pair: slot.pair,
    game: slot.game,
    gameSeed: gameSeed(slot.pair, slot.game),
    rowIsP0: slot.game % 2 === 0,
    rowDeck: field[r].deck,
    colDeck: field[c].deck,
    rowReserve: field[r].landReserve,
    colReserve: field[c].landReserve,
  }));
}

const started = performance.now();
const records: StudyGameRecord[] = [];
const queue: StudyGameJob[] = [];
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
  `life study: ${field.length} decks, ${pairs.length} pairs, lives ${lives.join('/')}, ` +
    `${seeds} seeds; shard ${shard}/${shards} holds ${slots.length} slots ` +
    `(${slots.length * lives.length} games) on ${workers} workers`,
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
    w.on('message', (msg: { ok: true; record: StudyGameRecord } | { ok: false; error: string }) => {
      active--;
      if (msg.ok) records.push(msg.record);
      else failed = msg.error;
      const now = performance.now();
      if (now - lastReport > 60_000) {
        lastReport = now;
        const min = (now - started) / 60_000;
        console.error(
          `  ${records.length}/${slots.length * lives.length} games, ${min.toFixed(1)} min, ` +
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

// Keep only complete triples, so a budget stop never leaves an arm short.
const bySlot = new Map<string, StudyGameRecord[]>();
for (const rec of records) {
  const key = `${rec.pair}:${rec.game}`;
  bySlot.set(key, [...(bySlot.get(key) ?? []), rec]);
}
const complete = [...bySlot.values()]
  .filter((group) => group.length === lives.length)
  .flat()
  .sort((a, b) => a.pair - b.pair || a.game - b.game || a.life - b.life);

writeFileSync(out, complete.map((r) => JSON.stringify(r)).join('\n') + '\n');
const minutes = (performance.now() - started) / 60_000;
writeFileSync(
  `${out}.meta.json`,
  JSON.stringify(
    {
      lives,
      seeds,
      shard,
      shards,
      workers,
      slotsPlanned: slots.length,
      slotsComplete: complete.length / lives.length,
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
  `done: ${complete.length} games (${complete.length / lives.length} slots of ${slots.length})` +
    `${stoppedEarly ? ', STOPPED AT BUDGET' : ''} in ${minutes.toFixed(1)} min`,
);
