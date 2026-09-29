/* global process, console, fetch, WebSocket, setTimeout, clearTimeout, Buffer, URLSearchParams */
// The art-streaming probe (docs/plan-art-streaming.md section 6; 1.9 lane D,
// S3, S5a). Serves a production build with `vite preview`, drives headless
// Edge over CDP with a fresh profile, runs a scripted tour, and at each stop
// records what the game's read-only `window.__art` hook reports beside what
// Windows reports for Edge's GPU and renderer processes.
//
// The tour (gate 1's, as far as S5a reaches): the menu; the Collection (its
// first spread, timed until every pocket shows real art, gate 2; five spreads;
// a filter change; a zoom); the Deck Builder (three pool pages, the deck list,
// the Darling picker); the Shop; a Tower duel with a zoom and a forced WebGL
// context loss; then the Collection again. After the first menu stop the save
// is seeded with two copies of every collectible card (a fresh save owns
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
//   --opponent <id>    the Tower opponent (default menghuo)
//   --port <n>         the preview port (default 4391; never 5173)
//   --out <dir>        where probe.json and the screenshots go (default: a
//                      fresh folder under the OS temp dir)
//   --label <text>     a name for this run in the output
//
// Windows only for the memory columns (Get-Process and the `GPU Process
// Memory` counters); elsewhere they read null. The whole Edge and vite
// process trees are killed on exit.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

function parseArgs(argv) {
  const opts = { dist: 'dist', build: false, stream: 'on', tier: 'full', budget: null, evict: null, opponent: 'menghuo', port: 4391, out: null, label: 'run' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i];
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
    else throw new Error(`unknown option ${flag}`);
  }
  if (opts.port === 5173) throw new Error('5173 is the dev save\'s origin; pick another port');
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mib = (bytes) => (bytes === null || bytes === undefined ? null : Math.round((bytes / 1048576) * 10) / 10);
const outDir = resolve(opts.out ?? mkdtempSync(join(tmpdir(), 'probe-art-')));
mkdirSync(outDir, { recursive: true });
/** The Edge profile, vite's cache and the preview config: removed on exit. */
const scratch = mkdtempSync(join(outDir, 'tmp-'));
const dist = resolve(ROOT, opts.dist);
const children = [];

function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/F', '/T'], { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch {
    // already gone
  }
}

function cleanup() {
  for (const child of children.splice(0)) killTree(child.pid);
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
// A hard stop, so a stuck tour never leaves Edge and vite running.
setTimeout(() => {
  console.error('probe-art: gave up after 12 minutes');
  process.exit(2);
}, 12 * 60_000).unref();

// ── The build and the server ───────────────────────────────────────────────

const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
if (opts.build) {
  // --emptyOutDir deletes the folder first: only ever one inside the repo or the temp dir.
  const inside = (parent) => {
    const rel = relative(resolve(parent), dist);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
  };
  if (!inside(ROOT) && !inside(tmpdir())) throw new Error(`--build refuses to empty ${dist}: pick a --dist inside the repo or the temp dir`);
  execFileSync(process.execPath, [viteBin, 'build', '--outDir', dist, '--emptyOutDir'], { cwd: ROOT, stdio: 'inherit' });
}
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
const APP = `http://127.0.0.1:${opts.port}/`;
// Something already answering on the port (another worktree's probe) would be
// measured in place of this build: vite's strictPort exits, and the poll below
// would find the other server.
try {
  await fetch(APP);
  throw new Error(`port ${opts.port} is already serving; pick another --port`);
} catch (error) {
  if (String(error?.message ?? '').startsWith('port ')) throw error;
}
const vite = spawn(process.execPath, [viteBin, 'preview', '--config', configPath], { cwd: ROOT, stdio: 'ignore' });
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

// ── Edge over CDP ──────────────────────────────────────────────────────────

const lite = opts.tier === 'lite';
const [W, H] = lite ? [844, 390] : [1920, 1080];
const profile = join(scratch, 'edge-profile');
const edge = spawn(
  EDGE,
  [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`, '--no-first-run', '--no-default-browser-check',
    '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', 'about:blank',
  ],
  { stdio: 'ignore' },
);
children.push(edge);

/** The port Edge picked (port 0), from its profile: never someone else's browser. */
let cdpPort = null;
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
const log = { errors: [], warnings: [], packReads: 0, looseFull: 0, looseHalf: 0 };
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
  if (m.method === 'Network.requestWillBeSent') {
    const url = m.params.request.url;
    if (url.includes('/art/packs/')) log.packReads++;
    else if (url.includes('/art/cards-half/')) log.looseHalf++;
    else if (url.includes('/art/cards/')) log.looseFull++;
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
      res(m);
    });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (method, params) => send(method, params, sessionId);
await S('Runtime.enable');
await S('Page.enable');
await S('Page.bringToFront');
await S('Network.enable');
if (lite) {
  await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 3, mobile: true });
  await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}
// Long tasks over 50 ms, counted in the page from the first script on.
await S('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__longTasks = []; try { new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch {}`,
});

async function page(expression) {
  const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) {
    const d = r.result.exceptionDetails;
    throw new Error(`page threw: ${d.text} ${d.exception?.description ?? ''}`);
  }
  return r.result?.result?.value;
}

async function until(what, test, timeoutMs = 90_000, everyMs = 100) {
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
const url = `${APP}?${params}`;

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
 * "idle"). The 1.8 queue has no such state; there the stop waits 1.5 s.
 */
async function storeIdle() {
  const mode = await page('window.__art ? window.__art.mode : null');
  if (mode !== 'store') {
    await sleep(1500);
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
    if (Date.now() - start > 90_000) throw new Error('the store never went idle');
    await sleep(50);
  }
}

async function processMemory() {
  const info = await send('SystemInfo.getProcessInfo');
  const processes = info.result?.processInfo ?? [];
  const gpu = processes.find((p) => p.type === 'GPU' || p.type === 'gpu-process');
  const renderers = processes.filter((p) => p.type === 'renderer');
  if (process.platform !== 'win32' || gpu === undefined) return { gpuPrivateMiB: null, gpuDedicatedMiB: null, gpuSharedMiB: null, rendererPrivateMiB: null };
  const ids = [gpu.id, ...renderers.map((p) => p.id)];
  const ps = [
    `Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { 'P ' + $_.Id + ' ' + $_.PrivateMemorySize64 }`,
    `try { (Get-Counter -Counter '\\GPU Process Memory(pid_${gpu.id}_*)\\Dedicated Usage','\\GPU Process Memory(pid_${gpu.id}_*)\\Shared Usage' -ErrorAction Stop).CounterSamples | ForEach-Object { 'C ' + $_.Path + ' ' + $_.CookedValue } } catch { 'C none 0' }`,
  ].join('; ');
  const text = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
  const privateBy = new Map();
  let dedicated = 0;
  let shared = 0;
  for (const line of text.split(/\r?\n/)) {
    const p = /^P (\d+) (\d+)/.exec(line);
    if (p) privateBy.set(Number(p[1]), Number(p[2]));
    const c = /^C (.+) ([\d.]+)$/.exec(line);
    if (c && /dedicated usage/i.test(c[1])) dedicated += Number(c[2]);
    if (c && /shared usage/i.test(c[1])) shared += Number(c[2]);
  }
  const rendererPrivate = Math.max(0, ...renderers.map((p) => privateBy.get(p.id) ?? 0));
  return {
    gpuPrivateMiB: mib(privateBy.get(gpu.id) ?? null),
    gpuDedicatedMiB: mib(dedicated),
    gpuSharedMiB: mib(shared),
    rendererPrivateMiB: mib(rendererPrivate),
  };
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
let errorsSeen = 0;
let warningsSeen = 0;
let longTasksSeen = 0;

async function record(name) {
  const art = await page(`(() => {
    const a = window.__art; if (!a) return null;
    return { mode: a.mode, stats: a.stats(), standIns: a.standIns(), missing: a.missingTextures(), leases: a.leases(), warnings: a.warnings() };
  })()`);
  const scenes = await page('window.__game.scene.getScenes(true).map((s) => s.sys.settings.key)');
  const longTasks = (await page('window.__longTasks || []')) ?? [];
  const memory = await processMemory();
  const shot = await S('Page.captureScreenshot', { format: 'png' });
  const shotName = `${opts.label}-${name}.png`;
  writeFileSync(join(outDir, shotName), Buffer.from(shot.result.data, 'base64'));
  const stop = {
    stop: name,
    scenes,
    ...memory,
    art,
    consoleErrors: log.errors.slice(errorsSeen),
    consoleWarnings: log.warnings.slice(warningsSeen),
    longTasks: longTasks.slice(longTasksSeen),
    requests: { packReads: log.packReads, looseFull: log.looseFull, looseHalf: log.looseHalf },
    screenshot: shotName,
  };
  errorsSeen = log.errors.length;
  warningsSeen = log.warnings.length;
  longTasksSeen = longTasks.length;
  stops.push(stop);
  const s = art?.stats ?? {};
  console.log(
    `[${opts.label}] ${name.padEnd(8)} mode=${art?.mode ?? 'none'} resident=${s.resident ?? s.loaded ?? '-'} ` +
      `residentMiB=${mib(s.residentBytes) ?? '-'} pinnedMiB=${mib(s.pinnedBytes) ?? '-'} managerMiB=${mib(s.managerBytes)} ` +
      `evictions=${s.evictions ?? '-'} missedLeases=${s.missedLeases ?? '-'} orphans=${s.orphans ?? '-'} restores=${s.restores ?? '-'} ` +
      `standIns=${art?.standIns.count} missing=${art?.missing.count} errors=${stop.consoleErrors.length} longTasks=${stop.longTasks.length} ` +
      `gpuPrivate=${memory.gpuPrivateMiB} dedicated=${memory.gpuDedicatedMiB} shared=${memory.gpuSharedMiB} renderer=${memory.rendererPrivateMiB} ` +
      `packs=${log.packReads} loose=${log.looseFull}/${log.looseHalf}\n` +
      `           thumbs: baked=${s.thumbBaked ?? '-'} resident=${s.thumbResident ?? '-'} residentMiB=${mib(s.thumbResidentBytes) ?? '-'} ` +
      `pinnedMiB=${mib(s.thumbPinnedBytes) ?? '-'} budgetMiB=${mib(s.thumbBudget) ?? '-'} provisional=${s.thumbProvisional ?? '-'} ` +
      `provisionalResident=${s.thumbProvisionalResident ?? '-'} evictions=${s.thumbEvictions ?? '-'} missedHolds=${s.thumbMissedHolds ?? '-'}`,
  );
}

/** The save key, and the seed: two copies of every collectible card. */
const SAVE_KEY = 'darlingblades.save.v1';

/**
 * Give the save two copies of every collectible card, then reload. The ids
 * come from the game itself (the Collection's own pool with the Owned filter
 * off, read without starting the scene). The seeded save is written by a
 * script that runs before the game on the next document: the game flushes
 * its in-memory save on `pagehide`, which would overwrite a write made now.
 */
async function seedSave() {
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
    for (const id of ids) save.collection[id] = 2;
    return { cards: ids.length, json: JSON.stringify(save) };
  })()`);
  if (!seeded) throw new Error('no save in localStorage to seed');
  await S('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { if (!sessionStorage.getItem('probeSeeded')) { localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(seeded.json)}); sessionStorage.setItem('probeSeeded', '1'); } } catch {}`,
  });
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

let failure = null;
try {
  await S('Page.navigate', { url });
  await until('the main menu', `(() => { const g = window.__game; return !!(g && g.scene.isActive('MainMenu')); })()`);
  await storeIdle();
  await record('menu');

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
  }
  await storeIdle();
  await record('col-spread5');
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
  }
  await storeIdle();
  await record('decks-page3');
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

  await page(onScene('Shop', `s.scene.start('Duel', { opponentId: ${JSON.stringify(opts.opponent)}, gauntletRung: 1 })`));
  await until('the duel', sceneBuilt('Duel'));
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
  if (!faced) console.warn('warning: no card face appeared in the duel within 30 s');
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
  if (zoomed === null) console.warn('warning: no card to zoom in the duel');
  await page(`(() => { const d = window.__game.scene.getScene('Duel'); d.zoom?.dismissSticky(); return true; })()`);

  const restoresBefore = (await page('window.__art ? window.__art.stats().restores ?? 0 : 0')) ?? 0;
  const lost = await page(`(() => {
    const gl = window.__game.renderer.gl; if (!gl) return 'canvas';
    const ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return 'no extension';
    window.__loseContext = ext; ext.loseContext(); return 'lost';
  })()`);
  if (lost === 'lost') {
    await sleep(500);
    await page('(() => { window.__loseContext.restoreContext(); return true; })()');
    if ((await page('window.__art ? window.__art.mode : null')) === 'store') {
      await until('the store to handle the restore', `window.__art.stats().restores > ${restoresBefore}`, 20_000);
    } else {
      await sleep(1000);
    }
  } else {
    console.warn(`warning: no context loss (${lost})`);
  }
  await storeIdle();
  await record('restored');

  // Back to the Collection, as gate 1's tour ends.
  await timeSpread(`g.scene.getScene('Duel').scene.start('Collection')`);
  await storeIdle();
  await record('collection-again');
} catch (error) {
  failure = String(error?.stack ?? error);
  console.error(failure);
  try {
    await record('failed');
  } catch {
    // the page may be gone
  }
}

const result = { label: opts.label, url, tier: opts.tier, stream: opts.stream, budgetMiB: opts.budget, failure, spreadTimings: timings, stops };
writeFileSync(join(outDir, `${opts.label}.json`), `${JSON.stringify(result, null, 2)}\n`);
console.log(`[${opts.label}] wrote ${join(outDir, `${opts.label}.json`)}`);

await send('Browser.close').catch(() => {});
ws.close();
await sleep(500);
cleanup();
try {
  rmSync(scratch, { recursive: true, force: true });
} catch {
  // Edge may still hold a lock on its profile
}
process.exit(failure === null ? 0 : 1);
