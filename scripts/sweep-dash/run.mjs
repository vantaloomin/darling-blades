/* global process, console */
// Metagame sweep dashboard: serves a live page over the --status-file JSON
// that `craft.ts --metagame --status-file <path>` overwrites per crafted
// persona. Read-only over that file; no state of its own.
//
//   npm run sweep-dash                        (http://localhost:5185/)
//   SWEEP_STATUS_FILE=path npm run sweep-dash (non-default status location)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const STATUS_FILE = process.env.SWEEP_STATUS_FILE
  ?? join(ROOT, 'balance', 'metagame-sweep-status.json');
const PORT = Number(process.env.SWEEP_DASH_PORT ?? 5185);

const server = createServer((req, res) => {
  if (req.url === '/status.json') {
    let body = '{"state":"waiting"}';
    try { body = readFileSync(STATUS_FILE, 'utf8'); } catch { /* no run yet */ }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(readFileSync(join(HERE, 'dashboard.html'), 'utf8'));
});

server.listen(PORT, () => {
  console.log(`sweep-dash: http://localhost:${PORT}/ (status file: ${STATUS_FILE})`);
});
