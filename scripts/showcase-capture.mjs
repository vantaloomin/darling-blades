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
//   --realtime        record the live screencast instead of stepping frames
//                     (frame rate follows the machine; ffmpeg holds each frame
//                     for its real duration)

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
      console.log(`Recording frame by frame at ${fps} fps...`);
      const maxFrames = Math.round((maxMs / 1000) * fps);
      let holdFrames = Math.round((holdMs / 1000) * fps);
      const wallStart = Date.now();
      for (let i = 0; i < maxFrames; i++) {
        const { result } = await cdp.send('Runtime.evaluate', { expression: 'window.__showcaseStepper.step(1)', returnByValue: true }, sessionId);
        s = result.value;
        const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true }, sessionId);
        const file = join(frameDir, `${String(frames.length).padStart(6, '0')}.jpg`);
        writeFileSync(file, Buffer.from(shot.data, 'base64'));
        frames.push({ file, t: i / fps });
        if (i % (fps * 10) === 0 && i > 0) {
          console.log(`  ${i / fps}s of footage (${((Date.now() - wallStart) / 1000).toFixed(0)}s wall)`);
        }
        if ((s === 'done' || s === 'failed') && holdFrames-- <= 0) break;
      }
    }
    if (s === 'failed') console.error('The duel stopped early (replay failed); keeping what was recorded');
  } finally {
    cdp.close();
    browser.kill();
  }
  if (frames.length < 2) throw new Error('No frames were recorded');
  // Hold each frame for its real duration, then resample to a constant rate.
  const list = frames.map((f, i) => {
    const next = frames[i + 1]?.t ?? f.t + 1 / fps;
    return `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(next - f.t, 0.001).toFixed(4)}`;
  });
  list.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  const listFile = join(frameDir, 'frames.txt');
  writeFileSync(listFile, list.join('\n'));
  mkdirSync(resolve(out, '..'), { recursive: true });
  const seconds = frames[frames.length - 1].t - frames[0].t;
  console.log(`${frames.length} frames over ${seconds.toFixed(1)}s (${(frames.length / seconds).toFixed(1)} fps captured); encoding ${out}`);
  await runFfmpeg([
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-movflags', '+faststart', out,
  ]);
  rmSync(frameDir, { recursive: true, force: true });
  rmSync(profile, { recursive: true, force: true });
  console.log(`Wrote ${out}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
