/* global process, console, fetch, WebSocket, setTimeout, Buffer */
// Record a showcase duel (scripts/showcase-match.ts) to an MP4 for trailers.
//
// Drives headless Chrome or Edge over CDP: opens the dev server's
// `?showcase=<name>` page at 1920x1080 and, once the duel is on screen, stops
// the game's own loop and steps it one fixed frame at a time
// (window.__showcaseStepper), screenshotting each frame. Game time only moves
// when a frame is taken, so the video is a smooth 60 fps however slowly the
// machine draws (a cloud box with no GPU draws about 5 fps live). It stops a
// beat after the duel reports it is done (window.__showcase), and ffmpeg
// encodes the frames as H.264. The game's audio is synthesized live and is
// not recorded; a trailer lays its own music and sound over the footage.
//
//   npm run dev                                    (in another shell)
//   node scripts/showcase-capture.mjs --name hel-vs-marsh [options]
//
//   --name <name>     the showcase log, showcase/<name>.json (required)
//   --url <origin>    the dev server (default http://localhost:5173)
//   --speed <n>       the showcase speed, as ?speed= (default 1)
//   --scale <k>       render scale 1 | 1.5 | 2 (default 1.5)
//   --fps <n>         output frame rate (default 60)
//   --hold <s>        seconds to keep recording after the duel ends (default 3)
//   --max <s>         stop after this many seconds whatever happens (default 900)
//   --out <file>      the MP4 (default showcase/<name>.mp4)
//   --browser <path>  Chrome or Edge (default: $CHROME, then the usual paths)
//   --headed          show the browser window instead of running headless
//   --ranges a-b,...  film only these spans (seconds of footage, e.g. 12-18,40-47),
//                     one MP4 each (showcase/<name>-<a>-<b>.mp4); the game
//                     fast-forwards between them without drawing
//   --preview [s]     no video: one small still every s seconds (default 2) and
//                     contact sheets in showcase/<name>-preview/, to pick ranges
//   --realtime        record the live screencast instead of stepping frames
//                     (frame rate follows the machine; ffmpeg holds each frame
//                     for its real duration)
//
// Drawing is the slow part on a machine with no GPU (a cloud box draws about
// one 1080p frame a second late in a busy game), so there the usual flow is
// --preview, then --ranges for the shots a trailer uses.

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

function parseArgs(argv) {
  const opts = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) opts.set(key, 'true');
    else opts.set(key, argv[++i]);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const name = opts.get('name');
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('Usage: node scripts/showcase-capture.mjs --name <showcase name> [--speed 1] [--scale 1.5] [--out file.mp4]');
  process.exit(1);
}
const origin = opts.get('url') ?? 'http://localhost:5173';
const speed = Number(opts.get('speed') ?? 1);
const scale = Number(opts.get('scale') ?? 1.5);
const fps = Number(opts.get('fps') ?? 60);
const holdMs = Number(opts.get('hold') ?? 3) * 1000;
const maxMs = Number(opts.get('max') ?? 900) * 1000;
const out = resolve(opts.get('out') ?? join('showcase', `${name}.mp4`));
const previewEvery = opts.has('preview') ? Number(opts.get('preview') === 'true' ? 2 : opts.get('preview')) : null;
const ranges = (opts.get('ranges') ?? '').split(',').filter(Boolean).map((r) => {
  const [a, b] = r.split('-').map(Number);
  if (!(a >= 0 && b > a)) throw new Error(`Bad range "${r}"; use start-end in seconds, e.g. 12-18`);
  return { a, b, out: resolve(join('showcase', `${name}-${a}-${b}.mp4`)), frames: [] };
});
const width = Math.round(1280 * scale);
const height = Math.round(720 * scale);

function findBrowser() {
  const candidates = [
    opts.get('browser'),
    process.env.CHROME,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('No Chrome or Edge found; pass --browser <path> or set CHROME');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDebugger(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(100);
  }
  throw new Error('The browser never opened its debugging port');
}

/** A minimal CDP client: one browser socket, flattened sessions. */
function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (msg) => {
    const data = JSON.parse(typeof msg.data === 'string' ? msg.data : Buffer.from(msg.data).toString());
    if (data.id && pending.has(data.id)) {
      const { resolve: ok, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else ok(data.result);
    } else if (data.method) {
      for (const listener of listeners) listener(data);
    }
  });
  return {
    open: new Promise((ok, reject) => {
      ws.addEventListener('open', ok);
      ws.addEventListener('error', reject);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((ok, reject) => pending.set(id, { resolve: ok, reject }));
    },
    on(listener) {
      listeners.push(listener);
    },
    close() {
      ws.close();
    },
  };
}

function runFfmpeg(args) {
  return new Promise((ok, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
    ff.on('error', reject);
    ff.on('exit', (code) => (code === 0 ? ok() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
}

/** Hold each frame for its real duration, then resample to a constant rate. */
async function encode(frames, file) {
  const list = frames.map((f, i) => {
    const next = frames[i + 1]?.t ?? f.t + 1 / fps;
    return `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(next - f.t, 0.001).toFixed(4)}`;
  });
  list.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  const listFile = `${frames[0].file}.txt`;
  writeFileSync(listFile, list.join('\n'));
  mkdirSync(resolve(file, '..'), { recursive: true });
  const seconds = frames[frames.length - 1].t - frames[0].t;
  console.log(`${frames.length} frames over ${seconds.toFixed(1)}s; encoding ${file}`);
  await runFfmpeg([
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-movflags', '+faststart', file,
  ]);
  console.log(`Wrote ${file}`);
}

/** Keep the preview stills, and tile them into contact sheets of 40 seconds each. */
async function writePreview(stills) {
  const dir = resolve(join('showcase', `${name}-preview`));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const still of stills) copyFileSync(still.file, join(dir, basename(still.file)));
  const perSheet = 20;
  for (let i = 0; i < stills.length; i += perSheet) {
    const sheet = stills.slice(i, i + perSheet);
    const list = join(dir, 'sheet.txt');
    writeFileSync(list, sheet.map((f) => `file '${join(dir, basename(f.file)).replace(/\\/g, '/')}'`).join('\n'));
    const file = join(dir, `sheet-${String(Math.round(sheet[0].t)).padStart(4, '0')}s.jpg`);
    await runFfmpeg(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', 'tile=5x4:padding=6:color=black', '-frames:v', '1', '-q:v', '3', file]);
    rmSync(list);
    console.log(`${basename(file)}: ${sheet[0].t}s to ${sheet[sheet.length - 1].t}s, left to right, top to bottom`);
  }
  console.log(`Wrote ${stills.length} stills and contact sheets to ${dir}`);
}

async function main() {
  const port = 9333 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'showcase-profile-'));
  const frameDir = mkdtempSync(join(tmpdir(), 'showcase-frames-'));
  const browser = spawn(findBrowser(), [
    ...(opts.get('headed') ? [] : ['--headless=new']),
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    // Chrome refuses to sandbox as root (a Linux container); never needed otherwise.
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ], { stdio: 'ignore' });
  const cdp = cdpClient(await waitForDebugger(port));
  await cdp.open;
  const frames = [];
  let sessionId;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    cdp.on((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Page.screencastFrame') {
        const file = join(frameDir, `${String(frames.length).padStart(6, '0')}.jpg`);
        writeFileSync(file, Buffer.from(msg.params.data, 'base64'));
        frames.push({ file, t: msg.params.metadata.timestamp });
        void cdp.send('Page.screencastFrameAck', { sessionId: msg.params.sessionId }, sessionId);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        console.error('[page]', msg.params.args.map((a) => a.description ?? a.value).join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[page]', msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text);
      }
    });
    const url = `${origin}/?showcase=${name}&speed=${speed}&scale=${scale}`;
    console.log(`Opening ${url}`);
    await cdp.send('Page.navigate', { url }, sessionId);
    // Record from the moment the duel starts, not through the boot screens.
    const state = async () => {
      const { result } = await cdp.send('Runtime.evaluate', { expression: 'window.__showcase?.state ?? "booting"', returnByValue: true }, sessionId);
      return result.value;
    };
    const bootDeadline = Date.now() + 120_000;
    let s = await state();
    while (s === 'booting' || s === 'loading') {
      if (Date.now() > bootDeadline) throw new Error('The showcase never started (is `npm run dev` running?)');
      await sleep(200);
      s = await state();
    }
    if (s === 'failed') throw new Error('The showcase failed to load; see the dev console');
    while (s === 'starting') {
      if (Date.now() > bootDeadline) throw new Error('The duel never finished loading its art');
      await sleep(50);
      s = await state();
    }
    if (opts.get('realtime')) {
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: width, maxHeight: height, everyNthFrame: 1 }, sessionId);
      console.log('Recording in real time...');
      const started = Date.now();
      while (Date.now() - started < maxMs) {
        s = await state();
        if (s === 'done' || s === 'failed') break;
        await sleep(500);
      }
      await sleep(holdMs);
      await cdp.send('Page.stopScreencast', {}, sessionId);
    } else {
      await cdp.send('Runtime.evaluate', { expression: `window.__showcaseStepper.begin(${fps})` }, sessionId);
      const evalState = async (expression) =>
        (await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)).result.value;
      const shoot = async (quality, scaleDown = 1) => {
        const shot = await cdp.send('Page.captureScreenshot', {
          format: 'jpeg', quality, optimizeForSpeed: true,
          ...(scaleDown === 1 ? {} : { clip: { x: 0, y: 0, width, height, scale: scaleDown } }),
        }, sessionId);
        return Buffer.from(shot.data, 'base64');
      };
      // What to film: every frame (the default), the --ranges, or a still every few seconds.
      const spans = previewEvery ? [] : ranges.length > 0 ? ranges : [{ a: 0, b: Infinity, out, frames }];
      const maxFrames = Math.round((maxMs / 1000) * fps);
      let holdFrames = Math.round((holdMs / 1000) * fps);
      const wallStart = Date.now();
      let lastLog = 0;
      let i = 0;
      while (i < maxFrames) {
        const t = i / fps;
        let advanced = 0;
        const span = spans.find((r) => t >= r.a && t < r.b);
        if (previewEvery && i % Math.round(previewEvery * fps) === 0) {
          s = await evalState('window.__showcaseStepper.step(1)');
          const file = join(frameDir, `t${String(Math.round(t)).padStart(4, '0')}.jpg`);
          writeFileSync(file, await shoot(70, 0.4));
          frames.push({ file, t });
          advanced = 1;
        } else if (span) {
          s = await evalState('window.__showcaseStepper.step(1)');
          const file = join(frameDir, `${String(i).padStart(6, '0')}.jpg`);
          writeFileSync(file, await shoot(92));
          span.frames.push({ file, t });
          advanced = 1;
        } else {
          // Fast-forward, without drawing, to the next frame that is filmed.
          const nextT = previewEvery
            ? (Math.floor(t / previewEvery) + 1) * previewEvery
            : Math.min(...spans.filter((r) => r.a > t).map((r) => r.a));
          if (!Number.isFinite(nextT)) break;
          const n = Math.max(1, Math.round(nextT * fps) - i);
          s = await evalState(`window.__showcaseStepper.skip(${n})`);
          advanced = n;
        }
        if (t - lastLog >= 10) {
          lastLog = t;
          console.log(`  ${Math.round(t)}s of game time (${((Date.now() - wallStart) / 1000).toFixed(0)}s wall)`);
        }
        i += advanced;
        // Keep filming for --hold seconds of game time after the duel ends.
        if (s === 'done' || s === 'failed') {
          holdFrames -= advanced;
          if (holdFrames <= 0) break;
        }
      }
      if (previewEvery) await writePreview(frames);
    }
    if (s === 'failed') console.error('The duel stopped early (replay failed); keeping what was recorded');
  } finally {
    cdp.close();
    browser.kill();
  }
  const outputs = previewEvery ? [] : ranges.length > 0 && !opts.get('realtime') ? ranges : [{ out, frames }];
  for (const target of outputs) {
    if (target.frames.length < 2) {
      console.error(`No frames recorded for ${target.out} (did the duel end first?)`);
      continue;
    }
    await encode(target.frames, target.out);
  }
  rmSync(frameDir, { recursive: true, force: true });
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
