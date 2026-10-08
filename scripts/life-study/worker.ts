/** Worker thread for the life study: plays one job per message, posts the record back. */
import { parentPort } from 'node:worker_threads';
import { playStudyGame, type StudyGameJob } from './game';

if (parentPort) {
  const port = parentPort;
  port.on('message', (job: StudyGameJob) => {
    try {
      port.postMessage({ ok: true, record: playStudyGame(job) });
    } catch (error) {
      port.postMessage({
        ok: false,
        error: `${job.life} life, pair ${job.pair}, game ${job.game}: ${error instanceof Error ? error.stack : String(error)}`,
      });
    }
  });
}
