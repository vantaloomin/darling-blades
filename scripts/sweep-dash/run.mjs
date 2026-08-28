/* global process, console */
// Metagame sweep dashboard: serves a live page over the --status-file JSON
// that `craft.ts --metagame --status-file <path>` overwrites per crafted
// persona. Read-only over that file; no state of its own.
//
//   npm run sweep-dash                        (http://localhost:5185/)
//   SWEEP_STATUS_FILE=path npm run sweep-dash (non-default status location)
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const STATUS_FILE = process.env.SWEEP_STATUS_FILE
  ?? join(ROOT, 'balance', 'metagame-sweep-status.json');
const PORT = Number(process.env.SWEEP_DASH_PORT ?? 5185);

export function selectCurrentArtifactFiles(candidates, runStartedAtMs = undefined) {
  const dated = candidates.filter((candidate) => /^\d{4}-\d{2}-\d{2}$/.test(candidate.datePrefix));
  if (dated.length === 0) return [];
  const newestDate = dated.reduce((latest, candidate) =>
    candidate.datePrefix > latest ? candidate.datePrefix : latest, dated[0].datePrefix);
  let current = dated.filter((candidate) => candidate.datePrefix === newestDate);
  if (Number.isFinite(runStartedAtMs)) {
    current = current.filter((candidate) => candidate.mtimeMs >= runStartedAtMs);
  }
  const newestByPersona = new Map();
  for (const candidate of current) {
    const prior = newestByPersona.get(candidate.personaId);
    if (!prior || candidate.mtimeMs > prior.mtimeMs ||
      (candidate.mtimeMs === prior.mtimeMs && candidate.file.localeCompare(prior.file) > 0)) {
      newestByPersona.set(candidate.personaId, candidate);
    }
  }
  return [...newestByPersona.values()].sort((a, b) => a.personaId.localeCompare(b.personaId));
}

/**
 * Compact per-round summaries from the checkpoint artifacts.
 *
 * The artifacts are the ONLY record of a round's results while a sweep is still
 * running - the status file carries progress, not outcomes - so this is what
 * makes finished rounds browsable mid-run. Summarised server-side on purpose:
 * a full artifact carries every hill-climb step and every field deck, which is
 * megabytes the page has no use for.
 */
function readArtifactSummaries() {
  let outDir;
  let status;
  try {
    status = JSON.parse(readFileSync(STATUS_FILE, 'utf8'));
    outDir = status.outDir;
  } catch { return []; }
  if (!outDir) return [];
  let files;
  try { files = readdirSync(outDir).filter((f) => f.includes('-metagame-') && f.endsWith('.json')); }
  catch { return []; }
  const candidates = [];
  for (const file of files) {
    let artifact;
    try { artifact = JSON.parse(readFileSync(join(outDir, file), 'utf8')); } catch { continue; }
    if (!artifact?.persona?.id || !Array.isArray(artifact?.metagame?.rounds)) continue;
    let mtimeMs;
    try { mtimeMs = statSync(join(outDir, file)).mtimeMs; } catch { continue; }
    candidates.push({
      file,
      datePrefix: file.slice(0, 10),
      mtimeMs,
      personaId: artifact.persona.id,
      artifact,
    });
  }
  const startedAtMs = typeof status.startedAt === 'string' ? Date.parse(status.startedAt) : undefined;
  const selected = selectCurrentArtifactFiles(candidates, startedAtMs);
  const out = selected.map(({ artifact, datePrefix, mtimeMs }) => ({
      runDate: datePrefix,
      artifactMtimeMs: mtimeMs,
      personaId: artifact.persona.id,
      personaName: artifact.persona.name,
      stoppedReason: artifact.metagame.summary?.stoppedReason,
      rounds: artifact.metagame.rounds.map((round) => ({
        round: round.round,
        score: round.measured?.score,
        rowWins: round.measured?.rowWins,
        losses: round.measured?.losses,
        draws: round.measured?.draws,
        games: round.measured?.games,
        acceptedSwaps: round.hillClimb?.acceptedSwaps?.length ?? 0,
        rejectedSwaps: round.hillClimb?.rejectedSwaps ?? 0,
        initialScore: round.hillClimb?.initialScore,
        colors: round.selectedColors ?? [],
        counts: round.counts ?? {},
        landReserve: round.landReserve ?? [],
        matchups: (round.measured?.matchups ?? []).map((m) => ({
          name: m.referenceName, rate: m.rate, rowWins: m.rowWins, colWins: m.colWins, draws: m.draws,
        })),
      })),
    }));
  out.sort((a, b) => a.personaId.localeCompare(b.personaId));
  return out;
}

const server = createServer((req, res) => {
  if (req.url === '/artifacts.json') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(readArtifactSummaries()));
    return;
  }
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

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  server.listen(PORT, () => {
    console.log(`sweep-dash: http://localhost:${PORT}/ (status file: ${STATUS_FILE})`);
  });
}
