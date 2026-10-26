/** Worker thread for the Mandate lab: plays one job per message, posts the record back. */
import { parentPort } from 'node:worker_threads';
import { playLabGame, type LabGameJob } from './game';

if (parentPort) {
  const port = parentPort;
  port.on('message', (job: LabGameJob) => {
    try {
      port.postMessage({ ok: true, record: playLabGame(job) });
    } catch (error) {
      port.postMessage({
        ok: false,
        error: `${job.arm}, pair ${job.pair}, game ${job.game}: ${error instanceof Error ? error.stack : String(error)}`,
      });
    }
  });
}
