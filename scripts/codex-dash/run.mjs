/* global process, console, setInterval */
// Codex stream dashboard: scans the codex-inline runtime state, serves a live
// page, and narrates status changes through a headless Claude Sonnet call.
//
//   npm run codex-dash              (serves http://localhost:5179/)
//   CODEX_DASH_NO_AI=1 ...          (skip the Sonnet narrator, mechanical feed)
//
// State root: every workspace the Codex companion has run in gets a dir under
// %USERPROFILE%/.claude/plugins/data/codex-inline/state/<name>-<hash>/ with a
// state.json registry and jobs/<task-id>.log files. This tool is read-only
// over that tree. Cache (status.json / feed.json) lives in .cache/ here,
// which is gitignored.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.cache');
const STATE_ROOT = process.env.CODEX_DASH_STATE_ROOT
  ?? join(homedir(), '.claude', 'plugins', 'data', 'codex-inline', 'state');
// Art-generation lanes (image-gen runners) have no registry, but their wave
// dirs are self-describing: prompts jsonl = expected, raw/*.png = done,
// newest mtime = liveness. Point this at the vault to surface them.
const ART_ROOT = process.env.CODEX_DASH_ART_ROOT
  ?? 'Z:/Coding Projects/WaifuTCG-Art-Pilots';
const PORT = Number(process.env.CODEX_DASH_PORT ?? 5179);
const POLL_MS = 15_000;
const NARRATE = process.env.CODEX_DASH_NO_AI !== '1';
const NARRATOR_MODEL = process.env.CODEX_DASH_MODEL ?? 'claude-sonnet-5';

mkdirSync(CACHE, { recursive: true });

function readJsonSafe(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function readLog(path, n) {
  try {
    const text = readFileSync(path, 'utf8');
    return {
      tail: text.split(/\r?\n/).filter(Boolean).slice(-n),
      finished: text.includes('Final output'),
      failed: /task failed|fatal/i.test(text),
    };
  } catch { return { tail: [], finished: false, failed: false }; }
}

/** Art lanes: one card per wave dir that contains a raw/ subdir. */
export function collectArtLanes() {
  const tasks = [];
  if (!existsSync(ART_ROOT)) return tasks;
  for (const dir of readdirSync(ART_ROOT)) {
    const rawDir = join(ART_ROOT, dir, 'raw');
    if (!existsSync(rawDir)) continue;
    let pngs = [];
    try {
      pngs = readdirSync(rawDir).filter((f) => f.endsWith('.png'))
        .map((f) => ({ f, m: statSync(join(rawDir, f)).mtime }))
        .sort((a, b) => a.m - b.m);
    } catch { continue; }
    // Expected count: the summary json's `expected` beats counting jsonl lines
    // (fix rounds append rows without growing the wave).
    let expected = null;
    for (const f of readdirSync(join(ART_ROOT, dir))) {
      if (f.endsWith('summary.json')) {
        expected = readJsonSafe(join(ART_ROOT, dir, f))?.expected ?? expected;
      } else if (expected === null && f.endsWith('prompts.jsonl')) {
        try {
          expected = readFileSync(join(ART_ROOT, dir, f), 'utf8').split(/\r?\n/).filter(Boolean).length;
        } catch { /* leave null */ }
      }
    }
    const newest = pngs.at(-1)?.m ?? statSync(join(ART_ROOT, dir)).mtime;
    const silentMin = (Date.now() - newest.getTime()) / 60_000;
    const done = expected !== null && pngs.length >= expected;
    tasks.push({
      id: `art:${dir}`,
      workspace: 'art-vault',
      title: dir.replace(/-/g, ' '),
      kind: 'art-lane',
      status: done ? 'completed' : silentMin > 24 * 60 ? 'archived' : silentMin > 10 ? 'unknown' : 'running',
      phase: done ? 'done' : `generating ${pngs.length}/${expected ?? '?'}`,
      summary: `${pngs.length}${expected ? ` of ${expected}` : ''} raws on disk`,
      pid: null,
      model: 'chatgpt-imagegen',
      createdAt: pngs[0]?.m.toISOString() ?? null,
      logMtime: newest.toISOString(),
      logBytes: pngs.length,
      // 10 min without a new file mid-run is a stall at ~2-3 min/card.
      stalled: !done && silentMin > 10 && silentMin <= 24 * 60,
      tail: pngs.slice(-6).map((p) => `${p.m.toISOString().slice(11, 19)}  ${p.f}`),
    });
  }
  return tasks;
}

/** One pass over every workspace's registry + job logs. */
export function collect() {
  const tasks = [];
  if (!existsSync(STATE_ROOT)) return { generated: new Date().toISOString(), stateRoot: STATE_ROOT, tasks };
  for (const ws of readdirSync(STATE_ROOT)) {
    const state = readJsonSafe(join(STATE_ROOT, ws, 'state.json'));
    const jobsDir = join(STATE_ROOT, ws, 'jobs');
    // The raw state.json shape is { version, config, jobs: [...] } — distinct
    // from the companion CLI's status output (running/latestFinished/recent).
    const registry = state?.jobs ?? [];
    if (existsSync(jobsDir)) {
      for (const f of readdirSync(jobsDir).filter((f) => f.endsWith('.log'))) {
        const id = f.slice(0, -4);
        const logPath = join(jobsDir, f);
        const mtime = statSync(logPath).mtime;
        const reg = registry.find((j) => j.id === id);
        const { tail, finished, failed } = readLog(logPath, 12);
        const silentMin = (Date.now() - mtime.getTime()) / 60_000;
        // Unregistered, long-quiet, unfinished logs are history whose registry
        // entry was clobbered (last-writer-wins state.json) — not live stalls.
        // Covers both registry-less history AND zombie registry entries left
        // "running" forever by dead pids (the 1.3-era wedge signature).
        const archived = !finished && silentMin > 24 * 60;
        tasks.push({
          id,
          workspace: ws.replace(/-[0-9a-f]{16}$/, ''),
          title: reg?.title ?? 'Codex task',
          kind: reg?.kindLabel ?? reg?.kind ?? 'task',
          // archived outranks the registry: a dead pid leaves status "running"
          // in state.json forever, and a day-silent log is the ground truth.
          status: finished ? (reg?.status ?? 'completed')
            : archived ? 'archived'
            : (reg?.status ?? (failed ? 'failed' : 'unknown')),
          phase: finished ? (reg?.phase ?? 'done') : archived ? 'unknown-end' : (reg?.phase ?? 'running'),
          summary: reg?.summary ?? null,
          pid: reg?.pid ?? null,
          model: reg?.request?.model ?? null,
          createdAt: reg?.createdAt ?? null,
          logMtime: mtime.toISOString(),
          logBytes: statSync(logPath).size,
          stalled: !finished && !archived && (reg?.status === 'running' || !reg) && silentMin > 15,
          tail,
        });
      }
    }
  }
  tasks.push(...collectArtLanes());
  tasks.sort((a, b) => (b.logMtime > a.logMtime ? 1 : -1));
  return { generated: new Date().toISOString(), stateRoot: STATE_ROOT, tasks };
}

/** Ask headless Claude (Sonnet) for a one-or-two sentence human update. */
function narrate(task, changeKind) {
  return new Promise((resolve) => {
    const prompt = [
      `You narrate a developer dashboard of coding and art-generation agent tasks. In one or two plain sentences,`,
      `present tense, describe this update for a human skimming a feed. No preamble, no markdown,`,
      `no em-dashes (house voice).`,
      `Task "${task.title}" (${task.kind}) in workspace "${task.workspace}", model ${task.model ?? 'unknown'}.`,
      `Change: ${changeKind}. Status: ${task.status}/${task.phase}.`,
      task.summary ? `Registry summary: ${task.summary}` : '',
      `Recent log lines:\n${task.tail.slice(-6).join('\n')}`,
    ].filter(Boolean).join('\n');
    // Windows: `claude` is a .cmd shim, so spawn through a shell; the prompt
    // travels via stdin to dodge shell quoting entirely.
    const child = spawn('claude -p --model ' + NARRATOR_MODEL, { shell: true, timeout: 60_000 });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve(code === 0 ? out.trim() || null : null));
    child.on('error', () => resolve(null));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function mechanicalLine(task, changeKind) {
  return `${task.title} [${task.workspace}] ${changeKind}: ${task.status}/${task.phase}` +
    (task.stalled ? ' (log silent 15+ min, possible wedge)' : '');
}

const seen = new Map(); // id -> { status, logBytes, stalled }
let firstPass = true;
let refreshing = false;
async function refresh() {
  if (refreshing) return; // narrator calls can outlive the poll interval
  refreshing = true;
  try { await refreshInner(); } finally { refreshing = false; firstPass = false; }
}
async function refreshInner() {
  const status = collect();
  writeFileSync(join(CACHE, 'status.json'), JSON.stringify(status, null, 1));
  const feedPath = join(CACHE, 'feed.json');
  const feed = readJsonSafe(feedPath) ?? [];
  for (const task of status.tasks) {
    const prev = seen.get(task.id);
    let changeKind = null;
    if (!prev) changeKind = 'discovered';
    else if (prev.status !== task.status) changeKind = `status ${prev.status} -> ${task.status}`;
    else if (!prev.stalled && task.stalled) changeKind = 'went quiet (possible stall)';
    else if (prev.logBytes !== task.logBytes && task.status === 'running') changeKind = 'progress';
    seen.set(task.id, { status: task.status, logBytes: task.logBytes, stalled: task.stalled });
    // Progress ticks are frequent; only narrate meaningful transitions. On the
    // first pass, history is baselined silently — only tasks with log activity
    // in the last hour earn a discovery entry (a cold start must not queue
    // dozens of narrator calls).
    if (!changeKind || changeKind === 'progress') continue;
    if (firstPass && (Date.now() - new Date(task.logMtime).getTime()) > 60 * 60_000) continue;
    const text = (NARRATE ? await narrate(task, changeKind) : null) ?? mechanicalLine(task, changeKind);
    feed.unshift({ ts: new Date().toISOString(), taskId: task.id, title: task.title, text });
  }
  writeFileSync(feedPath, JSON.stringify(feed.slice(0, 200), null, 1));
}

const MIME = { '.html': 'text/html', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = req.url === '/' ? '/dashboard.html' : req.url.split('?')[0];
  const file = path === '/dashboard.html' ? join(HERE, 'dashboard.html') : join(CACHE, path.slice(1));
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[path.slice(path.lastIndexOf('.'))] ?? 'text/plain' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

server.listen(PORT, () => console.log(`codex-dash on http://localhost:${PORT}/ (state: ${STATE_ROOT})`));
await refresh();
setInterval(refresh, POLL_MS);
