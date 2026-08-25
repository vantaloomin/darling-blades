import { Worker, parentPort } from 'node:worker_threads';
import { buildAI } from '../../src/ai/personality';
import { CARD_DB } from '../../src/data/catalog';
import { playOut } from '../balance-matrix';

export interface MeasureGameJob {
  resultIndex: number;
  matchupIndex: number;
  gameIndex: number;
  gameSeed: number;
  rowIsP0: boolean;
  rowDeck: readonly string[];
  colDeck: readonly string[];
  /** Ten-land reserves, same row/column order as the decks. */
  rowReserve: readonly string[];
  colReserve: readonly string[];
}

interface WorkerBatchMessage {
  type: 'batch';
  jobs: readonly MeasureGameJob[];
  resultBuffer: SharedArrayBuffer;
  controlBuffer: SharedArrayBuffer;
}

const DRAW_RESULT = 2;

function resultCode(winner: 0 | 1 | 'draw'): number {
  return winner === 'draw' ? DRAW_RESULT : winner;
}

function runBatch(message: WorkerBatchMessage): void {
  const results = new Int32Array(message.resultBuffer);
  const control = new Int32Array(message.controlBuffer);
  for (const job of message.jobs) {
    try {
      const row = buildAI('hard', CARD_DB, job.gameSeed * 7 + 1);
      const col = buildAI('hard', CARD_DB, job.gameSeed * 13 + 5);
      // Warchest, explicitly. playOut falls back to the CLASSIC constructor when
      // format and landReserves are both omitted, which is how this harness
      // measured a retired format until 2026-08-25 - so both are always passed.
      const winner = playOut(
        job.gameSeed,
        job.rowIsP0 ? row : col,
        job.rowIsP0 ? col : row,
        job.rowIsP0
          ? [[...job.rowDeck], [...job.colDeck]]
          : [[...job.colDeck], [...job.rowDeck]],
        'warchest',
        job.rowIsP0
          ? [[...job.rowReserve], [...job.colReserve]]
          : [[...job.colReserve], [...job.rowReserve]],
      );
      results[job.resultIndex] = resultCode(winner);
    } catch {
      // The main thread cannot receive an ordinary message while it is
      // synchronously waiting on the shared counter. Preserve the failure in
      // shared state so it can fail the measurement instead of hanging.
      Atomics.store(control, 1, 1);
      results[job.resultIndex] = -1;
    }
    Atomics.add(control, 0, 1);
    Atomics.notify(control, 0);
  }
}

if (parentPort) {
  parentPort.on('message', (message: WorkerBatchMessage) => {
    if (message.type === 'batch') runBatch(message);
  });
}

interface WorkerSlot {
  worker: Worker;
  activeControl?: SharedArrayBuffer;
}

const workerSlots: WorkerSlot[] = [];

function ensureWorkers(count: number): WorkerSlot[] {
  while (workerSlots.length < count) {
    const workerOptions = {
      type: 'module' as const,
    } as ConstructorParameters<typeof Worker>[1];
    const slot: WorkerSlot = {
      worker: new Worker(new URL('./measure-worker-bootstrap.mjs', import.meta.url), workerOptions),
    };
    slot.worker.unref();
    slot.worker.on('error', () => {
      if (slot.activeControl) {
        const control = new Int32Array(slot.activeControl);
        Atomics.store(control, 1, 1);
        Atomics.notify(control, 0);
      }
    });
    workerSlots.push(slot);
  }
  return workerSlots.slice(0, count);
}

export function runParallelGames(jobs: readonly MeasureGameJob[], workerCount: number): number[] {
  if (jobs.length === 0) return [];
  const slots = ensureWorkers(Math.min(workerCount, jobs.length));
  const resultBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * jobs.length);
  const controlBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
  const control = new Int32Array(controlBuffer);
  const results = new Int32Array(resultBuffer);

  for (const [slotIndex, slot] of slots.entries()) {
    const start = Math.floor((jobs.length * slotIndex) / slots.length);
    const end = Math.floor((jobs.length * (slotIndex + 1)) / slots.length);
    if (start === end) continue;
    slot.activeControl = controlBuffer;
    slot.worker.postMessage({
      type: 'batch',
      jobs: jobs.slice(start, end),
      resultBuffer,
      controlBuffer,
    } satisfies WorkerBatchMessage);
  }

  while (Atomics.load(control, 0) < jobs.length) {
    if (Atomics.load(control, 1) !== 0) {
      throw new Error('A persona measurement worker failed while simulating a game');
    }
    const completed = Atomics.load(control, 0);
    Atomics.wait(control, 0, completed, 1_000);
  }
  for (const slot of slots) slot.activeControl = undefined;
  if (Atomics.load(control, 1) !== 0 || [...results].some((result) => result < 0)) {
    throw new Error('A persona measurement worker failed while simulating a game');
  }
  return [...results];
}
