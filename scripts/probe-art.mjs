/* global process, console, fetch, WebSocket, setTimeout, clearTimeout, Buffer, URL, URLSearchParams, AbortSignal */
// The art-streaming probe (docs/plan-art-streaming.md section 6; 1.9 lane D,
// S3, S5a). Serves a production build with `vite preview`, drives headless
// Edge over CDP with a fresh profile, runs a scripted tour, and at each stop
// records what the game's read-only `window.__art` hook reports beside what
// Windows reports for Edge's GPU and renderer processes.
//
// The tour: the menu; the Collection (its
// first spread, timed until every pocket shows real art, gate 2; five spreads;
// a filter change; a zoom); the Deck Builder (three pool pages, the deck list,
// the Darling picker); Shop previews; three packs; Limited draft and builder;
// the Profile picker; the hall; Play, Practice and Tower; a duel with a zoom,
// paged graveyard and forced WebGL context loss; then Collection again.
// After the first menu stop the save is seeded with four copies of every collectible card (a fresh save owns
// none, and the binder and the pool show owned cards) and the page reloads.
//
//   node scripts/probe-art.mjs --dist <built dist> [options]
//
//   --dist <dir>       a production build to serve (default: dist). It must
//                      hold both art tiers (cards/ and cards-half/) and the
//                      packs: run gen-art-halfres, gen-art-manifest and
//                      pack-art first, as `npm run build` does.
//   --build            run `vite build --outDir <dist>` first
//   --stream on|off|default  the ?artStream switch. `default` leaves it out
//                      of the URL, so FEATURES.artStream decides. When the
//                      option is omitted the probe passes `on`.
//   --tier full|lite   the quality tier; lite also emulates a phone (844x390,
//                      DPR 3, touch) (default full, 1920x1080)
//   --budget <MiB>     ?artBudget, e.g. 8 for the eviction stress run
//   --evict off        ?artEvict=off
//   --opponent <id>    override the current Tower roster opponent
//   --port <n>         the preview port (default 4391; never 5173)
//   --out <dir>        where probe.json and the screenshots go (default: a
//                      fresh folder under the OS temp dir)
//   --label <text>     a name for this run in the output
//
// Windows only for the memory columns (Get-Process and the `GPU Process
// Memory` counters); elsewhere they read null. The whole Edge and vite
// process trees are killed on exit.
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectionGate, longTaskGate, memoryGate, normalizeStop, summarizeTimings } from './art-probe-metrics.mjs';
import { discoverAttachedApp, readProcessMemory } from './art-probe-processes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

function parseArgs(argv) {
  const opts = { dist: 'dist', build: false, stream: 'on', tier: 'full', budget: null, evict: null, opponent: null, port: 4391, out: null, label: 'run',
    timing: false, net: null, cpu: 1, repeat: 3, baseline: null, attach: null, appPid: null, url: null, checkPacks: null, showcase: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => { const value = argv[++i]; if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`); return value; };
    if (flag === '--dist') opts.dist = next();
    else if (flag === '--build') opts.build = true;
    else if (flag === '--stream') opts.stream = next();
    else if (flag === '--tier') opts.tier = next();
    else if (flag === '--budget') opts.budget = Number(next());
    else if (flag === '--evict') opts.evict = next();
    else if (flag === '--opponent') opts.opponent = next();
    else if (flag === '--port') opts.port = Number(next());
    else if (flag === '--out') opts.out = next();
    else if (flag === '--label') opts.label = next();
    else if (flag === '--timing') opts.timing = true;
    else if (flag === '--net') opts.net = Number(next());
    else if (flag === '--cpu') opts.cpu = Number(next());
    else if (flag === '--repeat') opts.repeat = Number(next());
    else if (flag === '--baseline') opts.baseline = next();
    else if (flag === '--attach') opts.attach = Number(next());
    else if (flag === '--app-pid') opts.appPid = Number(next());
    else if (flag === '--url') opts.url = next();
    else if (flag === '--check-packs') opts.checkPacks = next();
    else if (flag === '--showcase') opts.showcase = true;
    else if (flag === '--help') opts.help = true;
    else throw new Error(`unknown option ${flag}`);
  }
  if (opts.port === 5173) throw new Error('5173 is the dev save\'s origin; pick another port');
  if (!['on', 'off', 'default'].includes(opts.stream) || !['full', 'lite'].includes(opts.tier)) throw new Error('invalid stream or tier');
  for (const key of ['port', 'cpu', 'repeat', 'net', 'budget', 'attach', 'appPid']) {
    if (opts[key] !== null && (!Number.isFinite(opts[key]) || opts[key] <= 0)) throw new Error(`invalid ${key}`);
  }
  if (!Number.isInteger(opts.repeat) || opts.cpu < 1) throw new Error('repeat must be an integer; cpu must be at least 1');
  if (opts.attach !== null) {
    if (!argv.includes('--repeat')) opts.repeat = 1;
    if (opts.repeat !== 1 || opts.timing || opts.build || opts.url) throw new Error('attach requires one tour of an already-running app, without --timing/--build/--url');
  }
  if (opts.evict !== null && opts.evict !== 'off') throw new Error('--evict accepts off');
  if (opts.showcase && (!opts.url || opts.attach !== null || opts.timing)) throw new Error('--showcase requires --url pointing at a dev server, without attach/timing');
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log('probe-art: --dist DIR [--build] --stream on|off|default --tier full|lite --budget MiB --evict off\n' +
    '--timing --net Mbps (40ms RTT) --cpu RATE --repeat N (default 3; attach 1)\n' +
    '--baseline OFF.json --attach CDP_PORT [--app-pid PID] --url BASE_URL [--showcase] --check-packs BASE_URL\n' +
    '--out DIR --label NAME --port PORT --opponent ID. See docs/plan-art-streaming.md section 6.');
  process.exit(0);
}
const throttle = { downloadMbps: opts.net, latencyMs: opts.net === null ? 0 : 40, cpuRate: opts.cpu };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mib = (bytes) => (bytes === null || bytes === undefined ? null : Math.round((bytes / 1048576) * 10) / 10);
const outDir = resolve(opts.out ?? mkdtempSync(join(tmpdir(), 'probe-art-')));
mkdirSync(outDir, { recursive: true });
/** The Edge profile, vite's cache and the preview config: removed on exit. */
const scratch = mkdtempSync(join(outDir, 'tmp-'));
const dist = resolve(ROOT, opts.dist);
const children = [];
const ownedPids = new Set();

function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/F', '/T'], { stdio: 'ignore', windowsHide: true });
    else process.kill(pid, 'SIGKILL');
  } catch {
    // Some Windows executors deny taskkill's process-tree enumeration while
    // permitting termination of a child we own. CDP's recorded child PIDs
    // are also visited by cleanup.
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}

function cleanup() {
  const pids = [...new Set([...ownedPids, ...children.map((child) => child.pid)].filter(Boolean))];
  for (const child of children.splice(0)) killTree(child.pid);
  for (const pid of pids) killTree(pid);
  const alive = (pid) => {
    try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
  };
  // Termination can return before Windows has finished closing the process.
  const deadline = Date.now() + 3000;
  const pause = new Int32Array(new SharedArrayBuffer(4));
  let remaining = pids.filter(alive);
  while (remaining.length > 0 && Date.now() < deadline) {
    Atomics.wait(pause, 0, 0, 50);
    remaining = pids.filter(alive);
  }
  for (const pid of pids) if (!remaining.includes(pid)) ownedPids.delete(pid);
  return { tracked: pids, remaining };
}
process.on('exit', cleanup);
// Setup can fail before the tour's try/catch (for example, Edge cannot start
// its GPU process). Keep that failure and cleanup reviewable as well.
process.once('uncaughtException', (error) => {
  const cleaned = cleanup();
  const result = { label: opts.label, tier: opts.tier, stream: opts.stream, budgetMiB: opts.budget,
    failure: String(error?.stack ?? error), stage: 'startup', gatesPassed: false, stops: [], cleanup: cleaned };
  writeFileSync(join(outDir, `${opts.label}.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.error(result.failure);
  console.error(`[${opts.label}] startup failed; owned processes remaining=${cleaned.remaining.length}`);
  process.exit(1);
});
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
// A hard stop, so a stuck tour never leaves Edge and vite running.
setTimeout(() => {
  console.error('probe-art: gave up after 30 minutes');
  process.exit(2);
}, 30 * 60_000).unref();

// Gate 7's transport check is separate from the rendered tour on the live site.
if (opts.checkPacks !== null) {
  const index = JSON.parse(readFileSync(join(ROOT, 'src/data/art-packs.json'), 'utf8'));
  const names = [...new Set(Object.values(index.tiers).flatMap(tier => tier.packs))];
  if (names.length === 0) throw new Error('no staged packs to check');
  const packs = [];
  for (const name of names) {
    const packUrl = new URL(`assets/art/packs/${name}`, opts.checkPacks.endsWith('/') ? opts.checkPacks : `${opts.checkPacks}/`).href;
    try {
      const response = await fetch(packUrl, { headers: { Range: 'bytes=0-99', 'Accept-Encoding': 'gzip, br' }, signal: AbortSignal.timeout(30000) });
      const encoding = response.headers.get('content-encoding');
      const range = response.headers.get('content-range');
      await response.body?.cancel();
      packs.push({ name, url: packUrl, status: response.status, encoding, range,
        pass: response.status === 206 && encoding === null && /^bytes 0-99\//.test(range ?? '') });
    } catch (error) { packs.push({ name, url: packUrl, pass: false, error: String(error) }); }
  }
  const result = { gate7: { status: packs.every(pack => pack.pass) ? 'PASS' : 'FAIL', packs } };
  writeFileSync(join(outDir, `${opts.label}.json`), JSON.stringify(result, null, 2));
  console.log(`[${opts.label}] pack transport ${result.gate7.status}: ${packs.filter(pack => pack.pass).length}/${packs.length}; live gate 3 is still required`);
  process.exit(result.gate7.status === 'PASS' ? 0 : 1);
}

// Repeats run serially in separate processes, each with its own fresh profile.
if (opts.repeat > 1) {
  const omitValues = new Set(['--repeat', '--out', '--label', '--baseline']);
  const forwarded = [];
  const input = process.argv.slice(2);
  for (let i = 0; i < input.length; i++) {
    if (omitValues.has(input[i])) { i++; continue; }
    if (input[i] !== '--build') forwarded.push(input[i]);
  }
  const runs = [];
  const baseline = opts.baseline ? JSON.parse(readFileSync(resolve(opts.baseline), 'utf8')) : null;
  for (let i = 0; i < opts.repeat; i++) {
    const label = `${opts.label}-${String(i + 1).padStart(2, '0')}`;
    const runDir = join(outDir, label);
    const resultPath = join(runDir, `${label}.json`);
    if (existsSync(resultPath)) rmSync(resultPath);
    const args = [fileURLToPath(import.meta.url), ...forwarded, '--repeat', '1', '--out', runDir, '--label', label];
    if (opts.build && i === 0) args.push('--build');
    if (opts.baseline) args.push('--baseline', baseline.runs?.[i]?.resultPath ?? resolve(opts.baseline));
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit', windowsHide: true });
    children.push(child);
    const ended = await new Promise((res, rej) => { child.once('exit', (code, signal) => res({ code, signal })); child.once('error', rej); });
    children.splice(children.indexOf(child), 1);
    const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : { failure: 'child produced no result', gatesPassed: false };
    // A complete failing gate still has useful timings. A signal or absent
    // result is an incomplete attempt, never a sample to trim from the median.
    if (ended.signal !== null || ended.code === null) result.failure = `child interrupted: ${ended.signal ?? 'no exit code'}`;
    runs.push({ ...result, resultPath, exitCode: ended.code, signal: ended.signal,
      gatesPassed: ended.code === 0 && result.gatesPassed === true });
  }
  const result = { label: opts.label, tier: opts.tier, stream: opts.stream, throttle, repeat: opts.repeat,
    timing: summarizeTimings(runs, opts.repeat), runs, gatesPassed: runs.every(run => run.gatesPassed === true) };
  writeFileSync(join(outDir, `${opts.label}.json`), JSON.stringify(result, null, 2));
  console.log(`[${opts.label}] ${opts.repeat} independent runs: ${result.gatesPassed ? 'PASS' : 'FAIL'}; timing medians=${JSON.stringify(result.timing)}`);
  process.exit(result.gatesPassed ? 0 : 1);
}

// ── The build and the server ───────────────────────────────────────────────

const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
let APP = opts.url;
if (opts.build) {
  // --emptyOutDir deletes the folder first: only ever one inside the repo or the temp dir.
  const inside = (parent) => {
    const rel = relative(resolve(parent), dist);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
  };
  if (!inside(ROOT) && !inside(tmpdir())) throw new Error(`--build refuses to empty ${dist}: pick a --dist inside the repo or the temp dir`);
  // The repo config normally invokes Git for its stamp. Keep this probe's
  // builds Git-free; all other plugins and build settings remain the same.
  let config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
  config = config.replace(/import \{ execSync \} from 'node:child_process';\r?\n/, '')
    .replace(/const gitSha = \(\(\): string => \{[\s\S]*?\}\)\(\);/, "const gitSha = 'dev';")
    .replace("from 'vite'", `from '${ROOT.replaceAll('\\', '/')}/node_modules/vite/dist/node/index.js'`)
    .replaceAll("from './scripts/", `from '${ROOT.replaceAll('\\', '/')}/scripts/`)
    .replace("new URL('./package.json', import.meta.url)", JSON.stringify(join(ROOT, 'package.json')));
  if (/execSync|git rev-parse/.test(config.replaceAll('// git rev-parse', ''))) throw new Error('build config still contains a Git invocation');
  const buildConfig = join(scratch, 'vite.build.config.ts');
  writeFileSync(buildConfig, config);
  execFileSync(process.execPath, [viteBin, 'build', '--outDir', dist, '--emptyOutDir', '--config', buildConfig, '--configLoader', 'runner'], { cwd: ROOT, stdio: 'inherit', windowsHide: true });
}
if (opts.attach === null && opts.url === null) {
if (!existsSync(join(dist, 'index.html'))) throw new Error(`no build at ${dist} (pass --build or --dist)`);
if (!existsSync(join(dist, 'assets', 'art', 'cards-half'))) console.warn(`warning: ${dist} has no cards-half/: the half tier is missing`);

// A throwaway config so vite never writes its cache into the shared
// node_modules (the worktree junction trap) and never takes 5173.
const configPath = join(scratch, 'vite.preview.config.mjs');
writeFileSync(
  configPath,
  `export default ${JSON.stringify({
    root: ROOT,
    cacheDir: join(scratch, 'vite-cache'),
    logLevel: 'warn',
    build: { outDir: dist },
    preview: { host: '127.0.0.1', port: opts.port, strictPort: true },
  })};\n`,
);
APP = `http://127.0.0.1:${opts.port}/`;
// Something already answering on the port (another worktree's probe) would be
// measured in place of this build: vite's strictPort exits, and the poll below
// would find the other server.
try {
  await fetch(APP);
  throw new Error(`port ${opts.port} is already serving; pick another --port`);
} catch (error) {
  if (String(error?.message ?? '').startsWith('port ')) throw error;
}
const vite = spawn(process.execPath, [viteBin, 'preview', '--config', configPath, '--configLoader', 'runner'], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
children.push(vite);
for (let i = 0; ; i++) {
  try {
    if ((await fetch(APP)).ok) break;
  } catch {
    // not up yet
  }
  if (i > 100) throw new Error('vite preview did not start');
  await sleep(200);
}
}

// ── Edge over CDP ──────────────────────────────────────────────────────────

const lite = opts.tier === 'lite';
const [W, H] = lite ? [844, 390] : [1920, 1080];
const profile = join(scratch, 'edge-profile');
if (opts.attach === null) {
const edgeLog = openSync(join(outDir, `${opts.label}-edge.log`), 'w');
const edge = spawn(
  EDGE,
  [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`, '--no-first-run', '--no-default-browser-check',
    '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', 'about:blank',
  ],
  { stdio: ['ignore', edgeLog, edgeLog], windowsHide: true },
);
closeSync(edgeLog);
children.push(edge);
}

/** The port Edge picked (port 0), from its profile: never someone else's browser. */
let cdpPort = opts.attach;
async function cdpJson(path) {
  for (let i = 0; i < 100; i++) {
    try {
      if (!(cdpPort > 0)) cdpPort = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0]);
      return await (await fetch(`http://127.0.0.1:${cdpPort}${path}`)).json();
    } catch {
      await sleep(200);
    }
  }
  throw new Error('no CDP endpoint');
}
const version = await cdpJson('/json/version');
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map();
const log = { errors: [], warnings: [], networkFailures: [], packReads: 0, looseFull: 0, looseHalf: 0 };
const heldRequests = [];
let holdArt = false;
ws.onmessage = (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    log.errors.push(`${d.text} ${d.exception?.description ?? ''}`.trim());
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (m.params.type === 'error') log.errors.push(text);
    if (m.params.type === 'warning') log.warnings.push(text);
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    log.errors.push(m.params.entry.text);
  }
  if (m.method === 'Network.requestWillBeSent') {
    const url = m.params.request.url;
    if (url.includes('/art/packs/')) log.packReads++;
    else if (url.includes('/art/cards-half/')) log.looseHalf++;
    else if (url.includes('/art/cards/')) log.looseFull++;
  }
  if (m.method === 'Network.loadingFailed') log.networkFailures.push({ ...m.params, sessionId: m.sessionId });
  if (m.method === 'Fetch.requestPaused') {
    if (holdArt) heldRequests.push({ requestId: m.params.requestId, sessionId: m.sessionId });
    else void send('Fetch.continueRequest', { requestId: m.params.requestId }, m.sessionId).catch(() => {});
  }
};
/** One CDP command; rejects after 30 s rather than hanging the tour. */
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      rej(new Error(`CDP ${method} timed out`));
    }, 30_000);
    pending.set(id, (m) => {
      clearTimeout(timer);
      if (m.error) rej(new Error(`CDP ${method}: ${m.error.message}`));
      else res(m);
    });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
let sessionId;
let attachedApp = null;
let originalSave = null;
if (opts.attach !== null) {
  attachedApp = discoverAttachedApp((await send('SystemInfo.getProcessInfo')).result.processInfo, opts.appPid);
  let games = [];
  for (let attempt = 0; attempt < 120 && games.length === 0; attempt++) {
    const targets = (await send('Target.getTargets')).result.targetInfos.filter(target => target.type === 'page');
    for (const target of targets) {
      const candidate = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).result.sessionId;
      const checked = await send('Runtime.evaluate', { expression: '!!(window.__TAURI_INTERNALS__ && window.__game)', returnByValue: true }, candidate);
      if (checked.result.result.value === true) games.push({ targetId: target.targetId, sessionId: candidate, url: target.url });
      else await send('Target.detachFromTarget', { sessionId: candidate });
    }
    if (games.length === 0) await sleep(250);
  }
  if (games.length !== 1) throw new Error(`attach needs exactly one existing Tauri game target; found ${games.length}`);
  ({ sessionId } = games[0]);
  APP = games[0].url;
} else {
  const targetId = (await send('Target.createTarget', { url: 'about:blank' })).result.targetId;
  sessionId = (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
}
const S = (method, params) => send(method, params, sessionId);
const injectedScripts = [];
async function inject(source) {
  const response = await S('Page.addScriptToEvaluateOnNewDocument', { source });
  injectedScripts.push(response.result.identifier);
}
await S('Runtime.enable');
await S('Log.enable');
await S('Page.enable');
await S('Page.bringToFront');
await S('Network.enable');
await S('Network.emulateNetworkConditions', { offline: false, latency: throttle.latencyMs,
  downloadThroughput: opts.net === null ? -1 : opts.net * 1_000_000 / 8,
  uploadThroughput: opts.net === null ? -1 : opts.net * 1_000_000 / 8 });
await S('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: lite ? 3 : 1, mobile: lite });
if (lite) {
  await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}
// Long tasks over 50 ms, counted in the page from the first script on.
await inject(`window.__longTasks = null; try { if (PerformanceObserver.supportedEntryTypes.includes('longtask')) { window.__longTasks = []; new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.duration > 50) window.__longTasks.push(e.duration); }).observe({ type: 'longtask', buffered: true }); } } catch { window.__longTasks = null; }`);

async function pauseCardRequests() {
  holdArt = true;
  await S('Fetch.enable', { patterns: ['*/assets/art/cards/*', '*/assets/art/cards-half/*', '*/assets/art/packs/*']
    .map(urlPattern => ({ urlPattern, requestStage: 'Request' })) });
}
async function releaseCardRequests() {
  holdArt = false;
  for (const request of heldRequests.splice(0)) {
    await send('Fetch.continueRequest', { requestId: request.requestId }, request.sessionId).catch(() => {});
  }
  await S('Fetch.disable');
}

async function page(expression) {
  const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) {
    const d = r.result.exceptionDetails;
    throw new Error(`page threw: ${d.text} ${d.exception?.description ?? ''}`);
  }
  return r.result?.result?.value;
}

async function until(what, test, timeoutMs = 240_000, everyMs = 100) {
  const start = Date.now();
  for (;;) {
    const value = await page(test);
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await sleep(everyMs);
  }
}

// ── Stops ──────────────────────────────────────────────────────────────────

const params = new URLSearchParams({ quality: opts.tier });
if (opts.stream !== 'default') params.set('artStream', opts.stream);
if (opts.budget !== null) params.set('artBudget', String(opts.budget));
if (opts.evict !== null) params.set('artEvict', opts.evict);
const destination = new URL(APP);
for (const [key, value] of params) destination.searchParams.set(key, value);
if (opts.stream === 'default') destination.searchParams.delete('artStream');
if (opts.budget === null) destination.searchParams.delete('artBudget');
if (opts.evict === null) destination.searchParams.delete('artEvict');
const url = destination.href;

/** The scene is up and no art gate is covering it. */
const sceneBuilt = (key) => `(() => {
  const g = window.__game; if (!g || !g.scene.isActive(${JSON.stringify(key)})) return false;
  const s = g.scene.getScene(${JSON.stringify(key)});
  const texts = []; const walk = (o) => { if (o.type === 'Text') texts.push(o.text); if (Array.isArray(o.list)) o.list.forEach(walk); };
  s.children.list.forEach(walk);
  return s.children.list.length > 3 && !texts.some((t) => /Unsheathing/.test(t));
})()`;

/**
 * Nothing queued, in flight or waiting to upload for 500 ms (gate 3's
 * "idle"). The 1.8 queue must finish its manifest, then stay idle for 500 ms.
 */
async function storeIdle() {
  const mode = await page('window.__art ? window.__art.mode : null');
  if (mode !== 'store') {
    await until('the legacy art queue to finish', '(() => { const s = window.__art?.stats(); return s && s.loaded === s.total; })()');
    await sleep(500);
    return;
  }
  let quietSince = null;
  const start = Date.now();
  for (;;) {
    const s = await page('window.__art.stats()');
    const quiet = s.queued === 0 && s.inFlight === 0 && s.uploadsPending === 0;
    if (!quiet) quietSince = null;
    else if (quietSince === null) quietSince = Date.now();
    else if (Date.now() - quietSince >= 500) return;
    if (Date.now() - start > 240_000) throw new Error('the store never went idle');
    await sleep(50);
  }
}

async function processMemory() {
  const processes = (await send('SystemInfo.getProcessInfo')).result?.processInfo ?? [];
  if (attachedApp === null) {
    for (const entry of processes) if (Number.isInteger(Number(entry.id))) ownedPids.add(Number(entry.id));
  }
  return readProcessMemory(processes, attachedApp);
}

/**
 * Click the first Text in `sceneKey` whose text matches `pattern`, with a real
 * mouse event at its centre (design space is 1280x720 across the canvas).
 * False when there is no such text.
 */
async function clickText(sceneKey, pattern) {
  const at = await page(`(() => {
    const g = window.__game; const s = g.scene.getScene(${JSON.stringify(sceneKey)}); let hit = null;
    const walk = (o) => { if (hit) return; if (o.type === 'Text' && o.visible && new RegExp(${JSON.stringify(pattern)}).test(o.text)) { hit = o; return; } if (Array.isArray(o.list)) o.list.forEach(walk); };
    s.children.list.forEach(walk);
    if (!hit) return null;
    const b = hit.getBounds(); const r = g.canvas.getBoundingClientRect();
    return { x: r.left + (b.centerX * r.width) / 1280, y: r.top + (b.centerY * r.height) / 720 };
  })()`);
  if (at === null) return false;
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await S('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    await sleep(60);
  }
  return true;
}

const stops = [];
const gateFailures = [];
let errorsSeen = 0;
let warningsSeen = 0;
let longTasksSeen = 0;
let carriedTasks = [];
async function carryLongTasks() {
  const tasks = await page('window.__longTasks ?? null');
  carriedTasks = carriedTasks !== null && tasks !== null ? [...carriedTasks, ...tasks.slice(longTasksSeen)] : null;
  longTasksSeen = 0;
}

async function record(name) {
  const art = await page(`(() => {
    const a = window.__art; if (!a) return null;
    return { mode: a.mode, source: a.source, stats: a.stats(), standIns: a.standIns(), missing: a.missingTextures(), leases: a.leases(), warnings: a.warnings() };
  })()`);
  const scenes = await page('window.__game.scene.getScenes(true).map((s) => s.sys.settings.key)');
  const dimensions = await page('(() => { const g = window.__game; return { width: g.canvas.width, height: g.canvas.height, k: g.canvas.width / 1280, viewportWidth: innerWidth, viewportHeight: innerHeight }; })()');
  const longTasks = await page('window.__longTasks ?? null');
  const memory = await processMemory();
  const shot = await S('Page.captureScreenshot', { format: 'png' });
  const shotName = `${opts.label}-${name}.png`;
  writeFileSync(join(outDir, shotName), Buffer.from(shot.result.data, 'base64'));
  const stop = normalizeStop({
    stop: name,
    scenes,
    dimensions,
    ...memory,
    art,
    consoleErrors: log.errors.slice(errorsSeen),
    consoleWarnings: log.warnings.slice(warningsSeen),
    longTasks: longTasks !== null && carriedTasks !== null ? [...carriedTasks, ...longTasks.slice(longTasksSeen)] : null,
    requests: { packReads: log.packReads, looseFull: log.looseFull, looseHalf: log.looseHalf },
    screenshot: shotName,
  });
  errorsSeen = log.errors.length;
  warningsSeen = log.warnings.length;
  longTasksSeen = longTasks?.length ?? 0;
  carriedTasks = [];
  stops.push(stop);
  const s = art?.stats ?? {};
  const counts = { standIns: art?.standIns.count ?? -1, missingTextures: art?.missing.count ?? -1,
    consoleErrors: stop.consoleErrors.length, missedLeases: s.missedLeases ?? 0,
    thumbMissedHolds: s.thumbMissedHolds ?? 0, orphans: s.orphans ?? 0 };
  for (const [gate, count] of Object.entries(counts)) if (count !== 0) gateFailures.push({ stop: name, gate, count });
  const expectedMode = opts.stream === 'off' ? 'queue' : 'store';
  if (art?.mode !== expectedMode) gateFailures.push({ stop: name, gate: 'loaderMode', expected: expectedMode, actual: art?.mode });
  if (opts.evict === 'off' && art?.mode === 'store' && ((s.evictions ?? 0) !== 0 || (s.thumbEvictions ?? 0) !== 0)) gateFailures.push({ stop: name, gate: 'evictionDisabled', source: s.evictions, thumbs: s.thumbEvictions });
  if (dimensions.k !== (lite ? 1 : 2)) gateFailures.push({ stop: name, gate: 'renderScale', actual: dimensions.k });
  if (dimensions.viewportWidth !== W || dimensions.viewportHeight !== H) gateFailures.push({ stop: name, gate: 'viewport', actual: dimensions });
  console.log(
    `[${opts.label}] ${name.padEnd(8)} mode=${art?.mode ?? 'none'} resident=${s.resident ?? s.loaded ?? '-'} ` +
      `residentMiB=${mib(s.residentBytes) ?? '-'} pinnedMiB=${mib(s.pinnedBytes) ?? '-'} managerMiB=${mib(s.managerBytes)} ` +
      `evictions=${s.evictions ?? '-'} missedLeases=${s.missedLeases ?? '-'} orphans=${s.orphans ?? '-'} restores=${s.restores ?? '-'} ` +
      `standIns=${art?.standIns.count} missing=${art?.missing.count} errors=${stop.consoleErrors.length} longTasks=${stop.longTasks} longTaskTotalMs=${stop.longTaskTotalMs} render=${dimensions.width}x${dimensions.height} k=${dimensions.k} ` +
      `gpuPrivate=${memory.gpuPrivateMiB} dedicated=${memory.gpuDedicatedMiB} shared=${memory.gpuSharedMiB} renderer=${memory.rendererPrivateMiB} ` +
      `packs=${log.packReads} loose=${log.looseFull}/${log.looseHalf}\n` +
      `           thumbs: baked=${s.thumbBaked ?? '-'} resident=${s.thumbResident ?? '-'} residentMiB=${mib(s.thumbResidentBytes) ?? '-'} ` +
      `pinnedMiB=${mib(s.thumbPinnedBytes) ?? '-'} budgetMiB=${mib(s.thumbBudget) ?? '-'} provisional=${s.thumbProvisional ?? '-'} ` +
      `provisionalResident=${s.thumbProvisionalResident ?? '-'} evictions=${s.thumbEvictions ?? '-'} missedHolds=${s.thumbMissedHolds ?? '-'}`,
  );
}

/** The save key, and the seed: four copies of every collectible card. */
const SAVE_KEY = 'darlingblades.save.v1';

/**
 * Give the save four copies of every collectible card, then reload. The ids
 * come from the game itself (the Collection's own pool with the Owned filter
 * off, read without starting the scene). The seeded save is written by a
 * script that runs before the game on the next document: the game flushes
 * its in-memory save on `pagehide`, which would overwrite a write made now.
 */
async function seedSave(reload = true) {
  const seeded = await page(`(() => {
    const col = window.__game.scene.getScene('Collection');
    const saved = col.state;
    col.state = { ...saved, ownedOnly: false, search: '' };
    const ids = col.currentPool().map((d) => d.id);
    col.state = saved;
    // A fresh save may not be on disk yet: the game's own pagehide handler flushes it.
    window.dispatchEvent(new Event('pagehide'));
    const raw = localStorage.getItem(${JSON.stringify(SAVE_KEY)});
    if (!raw) return null;
    const save = JSON.parse(raw);
    for (const id of ids) save.collection[id] = 4;
    save.gold = 100000;
    save.tutorialDone = true;
    save.darlingsTutorialSeen = true;
    save.settings.animations = 'reduced';
    const cards = new Map(col.cards.map((card) => [card.id, card]));
    const starter = window.__game.scene.getScene('Shop').deckSections()[0].skus[0].deck;
    const spells = (starter.reserveCards ?? starter.cards).filter((id) => !cards.get(id)?.types.includes('land'));
    const lands = starter.landReserve ?? starter.cards.filter((id) => cards.get(id)?.types.includes('land')).slice(0, 10);
    const deck = { id: 'probe-warchest', name: 'Probe Warchest', cards: spells, format: 'warchest',
      landReserve: lands, darlingId: null, heroCardId: null, landStyle: null,
      variantPins: spells.map(() => null), cardBack: null, playmat: null };
    save.decks = [deck];
    save.activeDeckId = deck.id;
    save.starterChosen = starter.id;
    save.limited.activeRun = null;
    save.gauntlet.run = { rung: 1, startedAt: 0, seed: 1906001, rosterDay: 0, rosterSeed: 1906002 };
    return { cards: ids.length, json: JSON.stringify(save) };
  })()`);
  if (!seeded) throw new Error('no save in localStorage to seed');
  await inject(`try { if (!sessionStorage.getItem('probeSeeded')) { localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(seeded.json)}); sessionStorage.setItem('probeSeeded', '1'); } } catch {}`);
  if (!reload) return seeded.cards;
  await carryLongTasks();
  await S('Page.reload', { ignoreCache: false });
  await until('the main menu after the seed', `(() => { const g = window.__game; return !!(g && g.scene.isActive('MainMenu')); })()`);
  // The reload started a fresh long-task list.
  longTasksSeen = 0;
  return seeded.cards;
}

/**
 * Run `action` (an expression in the page) and time, from the page's own
 * clock, the Collection's spread: `built` is the first frame the binder has
 * drawn (its pager exists), `placed` the first frame the new spread is in the
 * pockets (with how many of its thumbs were baked over a stand-in), and `real`
 * the first frame its pockets are all filled with thumbs baked over real art
 * (none provisional) and no turn is moving. Frames are counted from the action.
 */
async function timeSpread(action) {
  await page(`(() => {
    const g = window.__game; const t0 = performance.now();
    const out = { built: null, builtFrame: null, placed: null, placedFrame: null, provisionalAtPlace: null, real: null, realFrame: null, frames: 0, thumbs: 0, expected: null };
    window.__spreadTiming = out;
    // The spread on show before the action: a held swap keeps it up while it waits.
    const before = g.scene.getScene('Collection').pageContainer ?? null;
    const thumbsOf = (s) => (s.pageContainer ? s.pageContainer.list.filter((o) => o.type === 'Image' && /^card-thumb-/.test(o.texture?.key ?? '')) : []);
    const tick = () => {
      out.frames++;
      const s = g.scene.getScene('Collection');
      if (g.scene.isActive('Collection') && s.pageControl) {
        if (out.built === null) { out.built = performance.now() - t0; out.builtFrame = out.frames; }
        if (out.expected === null) { const pool = s.currentPool(); out.expected = Math.max(0, Math.min(12, pool.length - s.page * 12)); }
        const thumbs = thumbsOf(s); out.thumbs = thumbs.length;
        const provisional = window.__art.provisionalThumbs().count;
        if (out.placed === null && s.pageContainer !== before && thumbs.length === out.expected) { out.placed = performance.now() - t0; out.placedFrame = out.frames; out.provisionalAtPlace = provisional; }
        if (thumbs.length === out.expected && !s.turning && provisional === 0) {
          out.real = performance.now() - t0; out.realFrame = out.frames; return;
        }
      }
      if (performance.now() - t0 < 60000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    ${action};
    return true;
  })()`);
  await until('the spread to show real art', '!!(window.__spreadTiming && window.__spreadTiming.real !== null)', 65_000, 25);
  const timing = await page('window.__spreadTiming');
  timings.push({ at: stops.length, ...timing });
  const ms = (v) => (v === null ? '-' : `${Math.round(v)} ms`);
  console.log(
    `[${opts.label}] spread: built ${ms(timing.built)} (frame ${timing.builtFrame}), placed ${ms(timing.placed)} (frame ${timing.placedFrame}, ` +
      `${timing.provisionalAtPlace} provisional), real ${ms(timing.real)} (frame ${timing.realFrame}), ${timing.thumbs} thumbs`,
  );
  return timing;
}
const timings = [];

/** Call a method on a running scene from the page (the probe's stand-in for a click). */
const onScene = (key, body) => `(() => { const s = window.__game.scene.getScene(${JSON.stringify(key)}); ${body}; return true; })()`;

/** Emit the existing mouse activation handler; all fixtures remain inside this CDP profile. */
async function tapText(sceneKey, text, owner = 's.children', fixedRandom = null) {
  return page(onScene(sceneKey, `
    let target = null;
    const walk = (object) => {
      if (!object.active || object.visible === false || target) return;
      if (object.type === 'Text' && object.text === ${JSON.stringify(text)}) {
        const hit = object.input?.enabled ? object : object.parentContainer?.list.find((child) => child.type === 'Zone' && child.input?.enabled);
        if (hit) target = hit;
      }
      if (Array.isArray(object.list)) object.list.forEach(walk);
    };
    (${owner}).list.forEach(walk);
    if (!target) return false;
    const random = Math.random;
    try {
      if (${fixedRandom !== null}) Math.random = () => ${fixedRandom};
      target.emit('pointerup', { wasTouch: false, button: 0, rightButtonReleased: () => false });
    } finally { Math.random = random; }
  `));
}

async function stopAt(name) {
  await storeIdle();
  await record(name);
}

const tourEvidence = {};
let collectionTiming = null;

/** The profile's first game navigation: its fixture is made without a browser. */
async function coldCollection() {
  const seed = JSON.parse(execFileSync(process.execPath, [join(ROOT, 'node_modules/tsx/dist/cli.mjs'), join(ROOT, 'scripts/art-probe-save.ts')],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1048576 }));
  await inject(`localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(seed))});`);
  await S('Network.clearBrowserCache');
  longTasksSeen = 0;
  await inject(`(() => {
    const out = { navigationToBinderMs: null, navigationToLoadingGoneMs: null, navigationToRealMs: null,
      enterToBinderMs: null, enterToRealMs: null, binderFrame: null, expectedPockets: 12, actualPockets: 0,
      navigationTimeOrigin: performance.timeOrigin, enterAtMs: null };
    window.__collectionTiming = out;
    const boot = () => {
      const g = window.__game;
      if (!g || !g.scene.isActive('MainMenu')) { requestAnimationFrame(boot); return; }
      const col = g.scene.getScene('Collection');
      let firstFrame = null;
      col.events.once('create', () => { firstFrame = g.loop.frame; });
      const sample = () => {
        if (!g.scene.isActive('Collection') || !col.pageControl) return;
        const now = performance.now();
        if (out.navigationToBinderMs === null) {
          out.navigationToBinderMs = now; out.enterToBinderMs = now - out.enterAtMs;
          out.binderFrame = g.loop.frame - firstFrame + 1;
        }
        let loading = false;
        const walk = (o) => { if (!o.active || o.visible === false) return;
          if (o.type === 'Text' && /Unsheathing/.test(o.text)) loading = true;
          if (Array.isArray(o.list)) o.list.forEach(walk); };
        g.scene.getScenes(true).forEach(scene => scene.children.list.forEach(walk));
        if (!loading && out.navigationToLoadingGoneMs === null) out.navigationToLoadingGoneMs = now;
        const thumbs = col.pageContainer?.list.filter(o => o.active && o.visible !== false && o.type === 'Image' && /^card-thumb-/.test(o.texture?.key ?? '')) ?? [];
        out.actualPockets = thumbs.length;
        const art = window.__art;
        if (thumbs.length === 12 && !col.turning && art && art.provisionalThumbs().count === 0 && art.standIns().count === 0 && art.missingTextures().count === 0) {
          out.navigationToRealMs = now; out.enterToRealMs = now - out.enterAtMs;
          if (out.navigationToLoadingGoneMs !== null) { out.done = true; g.events.off('postrender', sample); }
        }
      };
      g.events.on('postrender', sample);
      out.enterAtMs = performance.now();
      g.scene.getScene('MainMenu').scene.start('Collection');
    };
    requestAnimationFrame(boot);
  })();`);
  await S('Page.navigate', { url });
  await until('twelve real pockets on the cold first spread', 'window.__collectionTiming?.done === true');
  collectionTiming = await page('window.__collectionTiming');
  tourEvidence.coldNavigation = { freshProfile: true, firstGameNavigation: true, offlineSaveFixture: true,
    clock: 'performance.now since navigation timeOrigin', throttle };
  await stopAt('collection');
  console.log(`[${opts.label}] cold Collection ${JSON.stringify(collectionTiming)}`);
}

/** Exercise the app's real secondary-window handler while card IO is paused. */
async function desktopPrivacyDuringLoad(opponentId, gauntletRung) {
  const beforeTargets = new Set((await send('Target.getTargets')).result.targetInfos.map(target => target.targetId));
  await pauseCardRequests();
  await carryLongTasks();
  await S('Page.reload', { ignoreCache: true });
  longTasksSeen = 0;
  await until('the desktop menu after a cold store restart', "window.__game?.scene.isActive('MainMenu')");
  await page(onScene('MainMenu', `s.scene.start('Duel', ${JSON.stringify({ opponentId, gauntletRung })})`));
  const pendingDuel = `(() => {
    const g = window.__game; if (!g?.scene.isActive('Duel')) return null;
    const texts = []; const walk = o => { if (!o.active || o.visible === false) return;
      if (o.type === 'Text') texts.push(o.text); if (Array.isArray(o.list)) o.list.forEach(walk); };
    g.scene.getScene('Duel').children.list.forEach(walk);
    const stats = window.__art?.stats();
    return texts.some(text => /Unsheathing/.test(text)) && stats?.inFlight > 0 ? { gateVisible: true, inFlight: stats.inFlight, mode: window.__art.mode } : null;
  })()`;
  await until('a live duel art gate before opening privacy', pendingDuel, 30000);
  const opened = await S('Runtime.evaluate', { expression: `(() => {
    const evidence = ${pendingDuel}; if (!evidence) throw new Error('duel gate disappeared before opening privacy');
    window.open('./privacy.html', '_blank', 'noopener,noreferrer'); return evidence;
  })()`, returnByValue: true, userGesture: true });
  if (opened.result.exceptionDetails) throw new Error('privacy window did not open during the duel gate');
  tourEvidence.desktopPrivacy = { ...opened.result.result.value, heldRequests: heldRequests.length, newWindow: false, loaded: false, duelRecovered: false };
  // Let native art IO overlap popup initialization once opening during the
  // pending gate is proven. Whether #432 actually recurs is observational.
  await releaseCardRequests();
  let privacyTarget;
  for (let attempt = 0; attempt < 100; attempt++) {
    privacyTarget = (await send('Target.getTargets')).result.targetInfos.find(target => !beforeTargets.has(target.targetId) && /\/privacy\.html(?:[?#]|$)/.test(target.url));
    if (privacyTarget) break;
    await sleep(100);
  }
  if (!privacyTarget) throw new Error('no new privacy WebView target appeared');
  const privacySession = (await send('Target.attachToTarget', { targetId: privacyTarget.targetId, flatten: true })).result.sessionId;
  tourEvidence.desktopPrivacy.newWindow = true;
  await send('Runtime.enable', {}, privacySession);
  await send('Log.enable', {}, privacySession);
  for (let attempt = 0; attempt < 100; attempt++) {
    const loaded = await send('Runtime.evaluate', { expression: `(() => {
      const expected = new URL('./privacy.html', ${JSON.stringify(APP)});
      return document.readyState === 'complete' && location.origin === expected.origin && location.pathname === expected.pathname
        && document.title === 'Darling Blades Privacy Policy' && document.querySelector('h1')?.textContent.trim() === 'Darling Blades Privacy Policy'
        ? { url: location.href, title: document.title } : null;
    })()`, returnByValue: true }, privacySession);
    if (loaded.result.result.value) { tourEvidence.desktopPrivacy.loaded = true; tourEvidence.desktopPrivacy.document = loaded.result.result.value; break; }
    await sleep(100);
  }
  if (!tourEvidence.desktopPrivacy.loaded) throw new Error('privacy WebView content did not load');
  await S('Page.bringToFront');
  await until('the duel gate to recover after opening privacy', sceneBuilt('Duel'));
  tourEvidence.desktopPrivacy.duelRecovered = true;
  // The app intercepts page-window navigation to its own root, closes it,
  // and focuses main. This follows the privacy page's return path.
  await send('Page.navigate', { url: new URL('./', APP).href }, privacySession).catch(() => {});
  for (let attempt = 0; attempt < 100; attempt++) {
    const remains = (await send('Target.getTargets')).result.targetInfos.some(target => target.targetId === privacyTarget.targetId);
    if (!remains) { tourEvidence.desktopPrivacy.closed = true; break; }
    await sleep(100);
  }
  if (!tourEvidence.desktopPrivacy.closed) throw new Error('privacy window did not close through its return path');
  await S('Page.bringToFront');
}

let failure = null;
try {
  if (opts.timing) await coldCollection();
  else {
  if (attachedApp !== null) originalSave = await page(`localStorage.getItem(${JSON.stringify(SAVE_KEY)})`);
  await pauseCardRequests();
  await S('Page.navigate', { url });
  await until('the main menu', `(() => { const g = window.__game; return !!(g && g.scene.isActive('MainMenu')); })()`);
  // B must precede the first card upload, including the legacy warm queue.
  // Boot backdrops/fonts are ready; card requests are held until B is sampled.
  await sleep(500);
  const baselineStats = await page('window.__art.stats()');
  if ((baselineStats.resident ?? baselineStats.loaded) !== 0) throw new Error('menu B already contains card art');
  tourEvidence.menuBeforeCardArt = true;
  tourEvidence.device = await page('({ deviceMemoryGb: navigator.deviceMemory ?? null, userAgent: navigator.userAgent })');
  await record('menu');

  await releaseCardRequests();

  const owned = await seedSave();
  console.log(`[${opts.label}] seeded the save with ${owned} cards, reloaded`);
  await storeIdle();
  await record('menu-seeded');

  // The Collection: its first spread, timed (gate 2), then four turns.
  await timeSpread(`g.scene.getScene('MainMenu').scene.start('Collection')`);
  await storeIdle();
  await record('collection');
  for (let turn = 2; turn <= 5; turn++) {
    await timeSpread(`g.scene.getScene('Collection').turnPage(1)`);
    await stopAt(`col-spread${turn}`);
  }
  // A filter change to cards the tour has not shown (lands), by the chips' own
  // path: state, page 0, render.
  await timeSpread(`(() => { const s = g.scene.getScene('Collection'); s.state.type = 'land'; s.page = 0; s.renderPage(); })()`);
  await storeIdle();
  await record('col-filter');
  // A zoom: the inspect overlay's live card.
  await page(onScene('Collection', 's.showInspect(s.currentPool()[0])'));
  await sleep(300);
  await storeIdle();
  await record('col-zoom');
  await page(onScene('Collection', 's.closeInspect()'));

  // The Deck Builder: three pool pages, the deck list, the Darling picker.
  await page(onScene('Collection', "s.scene.start('DeckBuilder')"));
  await until('the deck builder', sceneBuilt('DeckBuilder'));
  await storeIdle();
  await record('decks');
  for (let turn = 2; turn <= 3; turn++) {
    await page(onScene('DeckBuilder', 's.turnPage(1)'));
    await sleep(100);
    await stopAt(`decks-page${turn}`);
  }
  await page(onScene('DeckBuilder', 'for (const d of s.pool().slice(0, 10)) s.addCard(d.id)'));
  await sleep(100);
  await storeIdle();
  await record('deck-list');
  await page(onScene('DeckBuilder', 's.showDarlingPicker()'));
  await sleep(200);
  await storeIdle();
  await record('darlings');

  await page(onScene('DeckBuilder', "s.scene.start('Shop')"));
  await until('the shop', sceneBuilt('Shop'));
  await storeIdle();
  await record('shop');
  await page(onScene('Shop', `
    s.setTab('decks');
    const skus = s.deckSections().flatMap((section) => section.skus);
    s.showDeckPreview(skus[skus.length - 1]);
    s.closeOverlay();
  `));
  await stopAt('shop-cancel');
  await page(onScene('Shop', 's.showDeckPreview(s.deckSections()[0].skus[0])'));
  await until('the deck preview', `(() => { const s = window.__game.scene.getScene('Shop'); return s.overlay?.container.active && s.previewEntries.length > 0; })()`);
  await stopAt('shop-preview');
  await page(onScene('Shop', 's.showCardInspect(0)'));
  await until('the shop inspect', "!!window.__game.scene.getScene('Shop').inspect?.container.active");
  await stopAt('shop-inspect');
  await page(onScene('Shop', 's.closeOverlay(); s.showDeckPreview(s.deckSections()[0].skus[0])'));
  await stopAt('shop-reopened');
  await page(onScene('Shop', "s.closeOverlay(); s.showOddsModal('base', { poolSize: 1, ownedDistinct: 0 })"));
  await stopAt('shop-odds');
  await page(onScene('Shop', `s.closeOverlay(); s.setTab('boosters'); s.qty = 3;
    const now = Date.now; try { Date.now = () => 1906003;
      s.buyPacks(s.boosterStripTiles.find(tile => tile.sku === 'base').price, undefined, 'base');
    } finally { Date.now = now; }`));
  await until('the three-pack runway', "!!window.__game.scene.getScene('PackOpening').runway?.root.active");
  tourEvidence.packBatch = await page(`(() => {
    const s = window.__game.scene.getScene('PackOpening'); const rw = s.runway;
    rw.autoTween?.remove(); rw.autoTween = null; rw.mode = 'scrub'; s.packArt?.cancelReveal();
    window.__probePackBatch = rw.batch;
    return { packs: rw.batch.length, cards: rw.cards.length, cardIds: rw.cards.map(card => card.cardId) };
  })()`);
  if (tourEvidence.packBatch.packs < 3) throw new Error('pack fixture did not open three packs');
  for (let index = 0; index < tourEvidence.packBatch.cards; index++) {
    await page(onScene('PackOpening', `
      const rw = s.runway;
      const pitch = (rw.maxOffset - rw.minOffset) / (rw.cards.length + 1);
      s.runwayApplyOffset(rw.maxOffset - (${index} + 2) * pitch);
    `));
    await until(`pack card ${index + 1} to flip`, `window.__game.scene.getScene('PackOpening').runway.revealedMax >= ${index}`);
    if ((index + 1) % 15 === 0 || index === tourEvidence.packBatch.cards - 1) await stopAt(`packs-flipped-${index + 1}`);
  }
  tourEvidence.packBatch.revealed = await page("window.__game.scene.getScene('PackOpening').runway.revealedMax + 1");
  await page(onScene('PackOpening', 's.runwaySkip()'));
  await stopAt('packs-summary');
  await page(onScene('PackOpening', "s.scene.start('Shop')"));
  await until('Shop after the pack batch', sceneBuilt('Shop'));
  await page(onScene('Shop', "s.scene.start('PackOpening', { batch: window.__probePackBatch })"));
  await until('the re-entered pack runway', "!!window.__game.scene.getScene('PackOpening').runway?.root.active");
  await page(onScene('PackOpening', 's.runwaySkip()'));
  await stopAt('packs-reentered');

  await page(onScene('PackOpening', "s.scene.start('Limited')"));
  await until('Limited', sceneBuilt('Limited'));
  if (!(await tapText('Limited', 'Free Draft', 's.children', 0.1906004))) throw new Error('Free Draft button missing');
  await until('the draft pick', sceneBuilt('LimitedDraft'));
  tourEvidence.draftPackIds = await page("window.__game.scene.getScene('Shop').saveData.limited.activeRun.draft.currentPacks[0].slice()");
  await stopAt('limited-draft');
  const oldPick = await page("window.__game.scene.getScene('Shop').saveData.limited.activeRun.draft.pickIndex");
  await page(onScene('LimitedDraft', `
    const run = window.__game.scene.getScene('Shop').saveData.limited.activeRun;
    window.__probeOldPackCell = s.packCells[0];
    s.selectCard(0, run.draft.currentPacks[0][0]); s.confirmPick(run);
  `));
  await until('the next draft pick', `(() => {
    const s = window.__game.scene.getScene('LimitedDraft');
    const run = window.__game.scene.getScene('Shop').saveData.limited.activeRun;
    return s.sys.isActive() && s.packCells.length > 0 && s.packCells[0] !== window.__probeOldPackCell && run.draft.pickIndex > ${oldPick};
  })()`);
  await until('the rebuilt draft', sceneBuilt('LimitedDraft'));
  await stopAt('limited-picked');
  tourEvidence.draftPicks = await page("window.__game.scene.getScene('Shop').saveData.limited.activeRun.draft.picks[0].length");
  await page(onScene('LimitedDraft', `
    const save = window.__game.scene.getScene('Shop').saveData;
    const run = save.limited.activeRun;
    const cards = window.__game.scene.getScene('Collection').cards;
    const pool = cards.filter((card) => !card.token && !card.types.includes('land') && save.collection[card.id] > 0).slice(0, 45).map((card) => card.id);
    run.status = 'build'; run.pool = pool; run.deck = pool.slice(0, 25);
    run.landReserve = [...save.decks[0].landReserve];
    s.scene.start('LimitedDeckBuilder');
  `));
  await until('the Limited deck builder', sceneBuilt('LimitedDeckBuilder'));
  await stopAt('limited-builder');
  await page(onScene('LimitedDeckBuilder', 's.poolPage=1; s.deckPage=1; s.draw(window.__game.scene.getScene("Shop").saveData.limited.activeRun)'));
  await stopAt('limited-page2');
  await page(onScene('LimitedDeckBuilder', "s.showCardInspect(window.__game.scene.getScene('Shop').saveData.limited.activeRun.pool[0])"));
  await stopAt('limited-inspect');
  await page(onScene('LimitedDeckBuilder', "s.closeCardInspect(); s.scene.start('Profile')"));
  await until('Profile', sceneBuilt('Profile'));
  await page(onScene('Profile', "s.openSaveCardPicker(() => 'probe'); s.pickerShell?.close()"));
  await stopAt('profile-cancel');
  await page(onScene('Profile', "s.openSaveCardPicker(() => 'probe')"));
  await until('the Profile picker', "!!window.__game.scene.getScene('Profile').pickerSearch");
  await stopAt('profile-picker');
  for (let turn = 2; turn <= 3; turn++) {
    if (!(await tapText('Profile', '›', 's.pickerShell.container'))) throw new Error('Profile picker next page missing');
    await stopAt(`profile-page${turn}`);
  }
  await page(onScene('Profile', "s.pickerShell.close(); s.openSaveCardPicker(() => 'probe')"));
  await stopAt('profile-reopened');
  await page(onScene('Profile', "s.pickerShell.close(); s.scene.start('Achievements', { view: 'hall' })"));
  await until('the Achievements hall', sceneBuilt('Achievements'));
  await stopAt('achievements');
  await page(onScene('Achievements', "s.scene.start('Play')"));
  await until('Play', sceneBuilt('Play'));
  await stopAt('play');
  await page(onScene('Play', 's.showDeckSelect()'));
  await stopAt('play-decks');
  await page(onScene('Play', "s.scene.start('PracticePicker')"));
  await until('Practice', sceneBuilt('PracticePicker'));
  await stopAt('practice');
  await page(onScene('PracticePicker', 's.selectedAvatarId = s.tileNodes[0].id; s.refreshSelection()'));
  await stopAt('practice-selected');
  await page(onScene('PracticePicker', "s.scene.start('Gauntlet')"));
  await until('the Gauntlet', sceneBuilt('Gauntlet'));
  await stopAt('gauntlet');
  tourEvidence.towerOpponent = await page("window.__game.scene.getScene('Gauntlet').avatarForFloor(window.__game.scene.getScene('Gauntlet').currentRung).id");
  if (attachedApp !== null) {
    if (opts.opponent !== null) tourEvidence.towerOpponent = opts.opponent;
    const rung = await page("window.__game.scene.getScene('Gauntlet').currentRung");
    await desktopPrivacyDuringLoad(tourEvidence.towerOpponent, rung);
  } else if (opts.opponent !== null) {
    tourEvidence.towerOpponent = opts.opponent;
    await page(onScene('Gauntlet', `s.scene.start('Duel', { opponentId: ${JSON.stringify(opts.opponent)}, gauntletRung: s.currentRung })`));
  } else await page(onScene('Gauntlet', 's.startFight(s.avatarForFloor(s.currentRung), s.currentRung)'));
  await until('the duel', sceneBuilt('Duel'));
  tourEvidence.duelSeed = await page("window.__game.scene.getScene('Duel').replayDraft.seed");
  // The versus bumper and the coin flip play first; the stop is the opening
  // hand (the mulligan), where the duel's card faces are on screen.
  // Call the coin (its dialog may ignore input while it animates in), then
  // wait for the opening hand's card faces.
  const hasFace = `(() => {
    const duel = window.__game.scene.getScene('Duel'); let found = false;
    const walk = (o) => { if (found) return; if (o.card && 'awaitingArt' in o) { found = true; return; } if (Array.isArray(o.list)) o.list.forEach(walk); };
    duel.children.list.forEach(walk); return found;
  })()`;
  let faced = false;
  for (let i = 0; i < 60 && !faced; i++) {
    faced = await page(hasFace);
    if (!faced && i % 3 === 0) await clickText('Duel', '^Heads$');
    // A won toss asks the player to choose: play first.
    if (!faced) await clickText('Duel', '^Play First$');
    if (!faced) await sleep(500);
  }
  if (!faced) throw new Error('no card face appeared in the duel within 30 s');
  await storeIdle();
  await record('duel');

  const zoomed = await page(`(() => {
    const duel = window.__game.scene.getScene('Duel');
    let view = null; const walk = (o) => { if (view) return; if (o.card && 'awaitingArt' in o) { view = o; return; } if (Array.isArray(o.list)) o.list.forEach(walk); };
    duel.children.list.forEach(walk);
    if (!view || !duel.zoom) return null;
    duel.zoom.showSticky(view.card, 640);
    return view.card.id;
  })()`);
  await sleep(300);
  await storeIdle();
  await record(`zoom`);
  if (zoomed === null) throw new Error('no card to zoom in the duel');
  await page(`(() => { const d = window.__game.scene.getScene('Duel'); d.zoom?.dismissSticky(); return true; })()`);

  // Keep the real opening hand before opening the public-zone browser. The
  // fixture repeats only cards already in this duel's lease; it changes this
  // disposable profile's in-memory duel, never the user's save or production.
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await page("window.__game.scene.getScene('Duel').canOpenZoneModal()")) break;
    await tapText('Duel', 'Keep');
    await sleep(100);
  }
  await until('a human decision for the zone browser', "window.__game.scene.getScene('Duel').canOpenZoneModal()", 20_000);
  tourEvidence.zoneEntries = await page(`(() => {
    const d = window.__game.scene.getScene('Duel');
    const player = d.duel.state.players[0];
    const cards = [...player.deck, ...player.hand];
    if (cards.length === 0) throw new Error('no duel cards for the zone fixture');
    player.graveyard = Array.from({ length: 72 }, (_, index) => cards[index % cards.length]);
    d.sync(); d.showZoneModal(0, 'graveyard');
    return player.graveyard.length;
  })()`);
  await until('the large zone modal', "!!window.__game.scene.getScene('Duel').zoneModal?.container.active");
  await stopAt('duel-zone');
  await page(onScene('Duel', 's.zoneModal.showPage(1)'));
  await stopAt('duel-zone-page2');
  await page(onScene('Duel', 's.zoneModal.close()'));
  await until('the zone modal to reopen', "window.__game.scene.getScene('Duel').canOpenZoneModal()", 20_000);
  await page(onScene('Duel', "s.showZoneModal(0, 'graveyard')"));
  await stopAt('duel-zone-reopened');
  await page(onScene('Duel', 's.zoneModal.close()'));

  const restoresBefore = (await page('window.__art ? window.__art.stats().restores ?? 0 : 0')) ?? 0;
  const lost = await page(`(() => {
    const g = window.__game; const gl = g.renderer.gl; if (!gl) return 'canvas';
    const ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return 'no extension';
    window.__contextProof = { lost: 0, restored: 0, frameBefore: g.loop.frame };
    g.canvas.addEventListener('webglcontextlost', () => { window.__contextProof.lost++; }, { once: true });
    g.canvas.addEventListener('webglcontextrestored', () => { window.__contextProof.restored++; window.__contextProof.frameAtRestore = g.loop.frame; }, { once: true });
    window.__loseContext = ext; ext.loseContext(); return 'lost';
  })()`);
  if (lost === 'lost') {
    await until('the context lost event', 'window.__contextProof.lost === 1', 20000);
    await page('(() => { window.__loseContext.restoreContext(); return true; })()');
    if ((await page('window.__art ? window.__art.mode : null')) === 'store') {
      await until('the store to handle the restore', `window.__art.stats().restores > ${restoresBefore}`, 20_000);
    }
    await until('a restored context and a running game loop', `(() => {
      const g = window.__game, p = window.__contextProof;
      return p.restored === 1 && !g.renderer.gl.isContextLost() && g.loop.frame > p.frameAtRestore + 2 && g.scene.isActive('Duel');
    })()`, 20000);
  } else {
    throw new Error(`gate 8 could not force context loss: ${lost}`);
  }
  await storeIdle();
  await record('restored');
  tourEvidence.context = await page('({ ...window.__contextProof, frameAfter: window.__game.loop.frame, duelActive: window.__game.scene.isActive("Duel"), contextLost: window.__game.renderer.gl.isContextLost() })');

  // Back to the Collection, as gate 1's tour ends.
  await timeSpread(`g.scene.getScene('Duel').scene.start('Collection')`);
  await storeIdle();
  await record('collection-again');
  if (opts.showcase) {
    await page(onScene('Collection', "s.scene.start('Showcase')"));
    await until('the dev Showcase', sceneBuilt('Showcase'));
    await stopAt('showcase');
    for (let pick = 0; pick < 2; pick++) {
      await page(onScene('Showcase', 's.pickIdx = (s.pickIdx + 1) % s.picks.length; s.apply()'));
      await stopAt(`showcase-pick${pick + 2}`);
    }
    await page(onScene('Showcase', "s.scene.start('Collection')"));
    await until('Collection after Showcase', sceneBuilt('Collection'));
    await stopAt('collection-after-showcase');
  }
  }
} catch (error) {
  failure = String(error?.stack ?? error);
  console.error(failure);
  try {
    await record('failed');
  } catch {
    // the page may be gone
  }
}

if (attachedApp === null) {
  try {
    const processInfo = (await send('SystemInfo.getProcessInfo')).result?.processInfo ?? [];
    for (const entry of processInfo) if (Number.isInteger(Number(entry.id))) ownedPids.add(Number(entry.id));
  } catch { /* Previously tracked PIDs still belong to this run. */ }
  await send('Browser.close').catch(() => {});
} else {
  try {
    await releaseCardRequests();
    for (const identifier of injectedScripts.splice(0)) await S('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    const restoreSource = originalSave === null
      ? `localStorage.removeItem(${JSON.stringify(SAVE_KEY)});`
      : `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(originalSave)});`;
    const restore = await S('Page.addScriptToEvaluateOnNewDocument', { source: `${restoreSource} sessionStorage.removeItem('probeSeeded'); window.__probeSaveRestored = true;` });
    await S('Page.reload', { ignoreCache: false });
    await until('the desktop save to be restored before detach', 'window.__probeSaveRestored === true', 30000);
    await S('Page.removeScriptToEvaluateOnNewDocument', { identifier: restore.result.identifier });
    await S('Emulation.setCPUThrottlingRate', { rate: 1 });
    await S('Emulation.clearDeviceMetricsOverride');
    await S('Emulation.setTouchEmulationEnabled', { enabled: false });
    await S('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await send('Target.detachFromTarget', { sessionId });
  } catch (error) { gateFailures.push({ stop: 'detach', gate: 'desktopCleanup', error: String(error) }); }
}
ws.close();
await sleep(500);
const cleaned = cleanup();
if (cleaned.remaining.length > 0) gateFailures.push({ stop: 'cleanup', gate: 'ownedProcessesStillRunning', pids: cleaned.remaining });
const result = { label: opts.label, url, tier: opts.tier, stream: opts.stream, budgetMiB: opts.budget,
  evict: opts.evict ?? 'on', throttle, target: attachedApp === null ? 'web' : 'desktop',
  source: stops[0]?.art?.source ?? null,
  // The legacy queue always fetches loose art, even in the packs build.
  observedRequestSource: { packReads: log.packReads, looseFull: log.looseFull, looseHalf: log.looseHalf },
  mode: stops[0]?.art?.mode ?? null, failure, gateFailures,
  cleanup: { ...cleaned, attachedAppLeftForLauncher: attachedApp?.pid ?? null },
  tourEvidence, tourFixture: opts.timing ? null : { version: 's6-v1', opponentId: tourEvidence.towerOpponent,
    packCardIds: tourEvidence.packBatch?.cardIds, draftPackIds: tourEvidence.draftPackIds, duelSeed: tourEvidence.duelSeed },
  networkFailures: log.networkFailures, collectionTiming, spreadTimings: timings, stops };
result.gate1 = memoryGate(result);
result.gate2 = collectionGate(result);
result.gate3 = { status: failure === null && gateFailures.length === 0 ? 'PASS' : 'FAIL', failures: gateFailures };
const stress = { budgetApplied: stops.every(stop => stop.art?.stats?.budget === 8 * 1048576),
  sourceEvictions: Math.max(0, ...stops.map(stop => stop.art?.stats?.evictions ?? 0)),
  thumbEvictions: Math.max(0, ...stops.map(stop => stop.art?.stats?.thumbEvictions ?? 0)) };
result.gate4 = { status: opts.budget !== 8 || result.mode !== 'store' || opts.evict === 'off' ? 'UNMEASURED'
  : result.gate3.status === 'PASS' && stress.budgetApplied && stress.sourceEvictions > 0 && stress.thumbEvictions > 0 ? 'PASS' : 'FAIL', evidence: stress };
result.gate5 = longTaskGate(result, opts.baseline ? JSON.parse(readFileSync(resolve(opts.baseline), 'utf8')) : null);
const privacy = tourEvidence.desktopPrivacy;
result.gate6 = { status: attachedApp === null ? 'UNMEASURED'
  : result.gate3.status === 'PASS' && privacy?.newWindow && privacy.loaded && privacy.closed && privacy.duelRecovered && privacy.gateVisible && privacy.inFlight > 0 && privacy.heldRequests > 0 && result.source === 'loose' && log.packReads === 0 && log.looseFull + log.looseHalf > 0 ? 'PASS' : 'FAIL',
  app: attachedApp, privacy: privacy ?? null };
const context = tourEvidence.context;
result.gate8 = { status: opts.timing ? 'UNMEASURED'
  : result.gate3.status === 'PASS' && context?.lost === 1 && context.restored === 1 && context.duelActive && !context.contextLost && context.frameAfter > context.frameAtRestore ? 'PASS' : 'FAIL', evidence: context ?? null };
// An off run supplies the before measurements; exceeding streaming's memory
// or latency limits must not prevent it from supplying a valid baseline.
const required = ['gate3'];
if (opts.timing) { if (result.mode === 'store') required.push('gate2'); }
else { required.push('gate8'); if (result.mode === 'store' && opts.evict !== 'off') required.push('gate1'); }
if (opts.budget === 8 && result.mode === 'store' && opts.evict !== 'off') required.push('gate4');
if (opts.baseline) required.push('gate5');
if (attachedApp !== null) required.push('gate6');
result.requiredGates = required;
result.gatesPassed = failure === null && required.every(gate => result[gate].status === 'PASS');
writeFileSync(join(outDir, `${opts.label}.json`), `${JSON.stringify(result, null, 2)}\n`);
console.log(`[${opts.label}] wrote ${join(outDir, `${opts.label}.json`)}; gate1=${result.gate1.status} gate3=${result.gate3.status} gate2=${result.gate2.status} gate5=${result.gate5.status} gate6=${result.gate6.status} gate8=${result.gate8.status}; gates=${result.gatesPassed ? 'PASS' : 'FAIL'}; owned processes remaining=${cleaned.remaining.length}`);
try {
  rmSync(scratch, { recursive: true, force: true });
} catch {
  // Edge may still hold a lock on its profile
}
process.exit(result.gatesPassed ? 0 : 1);
