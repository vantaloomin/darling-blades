/**
 * LAN play server (mobile-lan-plan §1.1): statically serves the production
 * build in dist/ on every network interface and prints the join URL as a
 * terminal QR code — scan it with a phone on the same Wi-Fi and play.
 *
 * Builds automatically when dist/ is missing or older than the newest source
 * (src/, public/, index.html, package.json, vite.config.ts). The desktop
 * should keep playing on its usual localhost origin; the phone's save lives
 * on the LAN-IP origin and starts fresh (accepted for Tier 1).
 *
 * First run: allow node.exe through the Windows Defender firewall prompt
 * (Private networks), or the phone will never connect.
 *
 * Usage: npx tsx scripts/serve-lan.ts [--port N] [--no-build] [--no-qr]
 *   --port N     preferred port (default 4173); if busy, the next 10 are tried
 *   --no-build   never build — serve dist/ as-is (fails if missing, warns if stale)
 *   --no-qr      skip the QR code (URL only)
 */
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

function fail(msg: string): never {
  console.error(`serve-lan: ${msg}`);
  process.exit(1);
}

// --- args ---------------------------------------------------------------------

interface Args {
  port: number;
  build: boolean;
  qr: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { port: 4173, build: true, qr: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1 || n > 65535) fail('--port must be 1–65535');
      args.port = n;
    } else if (a === '--no-build') args.build = false;
    else if (a === '--no-qr') args.qr = false;
    else fail(`unknown argument: ${a}`);
  }
  return args;
}

// --- build freshness ------------------------------------------------------------

/** Newest mtime under a path (recursive), skipping node_modules/dist. */
function newestMtime(path: string): number {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) return 0;
  if (st.isFile()) return st.mtimeMs;
  let newest = 0;
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    newest = Math.max(newest, newestMtime(join(path, entry)));
  }
  return newest;
}

/** dist/ is stale when any build input is newer than its index.html. */
function distState(): 'missing' | 'stale' | 'fresh' {
  const indexPath = join(dist, 'index.html');
  if (!existsSync(indexPath)) return 'missing';
  const built = statSync(indexPath).mtimeMs;
  const inputs = ['src', 'public', 'index.html', 'package.json', 'vite.config.ts'];
  const newest = Math.max(...inputs.map((p) => newestMtime(join(root, p))));
  return newest > built ? 'stale' : 'fresh';
}

function ensureBuilt(args: Args): void {
  const state = distState();
  if (state === 'fresh') return;
  if (!args.build) {
    if (state === 'missing') {
      fail('dist/ is missing and --no-build was given — run `npm run build` first');
    }
    console.warn('serve-lan: WARNING — dist/ is older than the sources; serving the stale build (--no-build)');
    return;
  }
  console.log(`serve-lan: dist/ is ${state} — building…`);
  const res = spawnSync('npm run build', { shell: true, stdio: 'inherit', cwd: root });
  if (res.status !== 0) fail('build failed — fix the errors above and rerun');
}

// --- network interfaces ---------------------------------------------------------

/** All non-internal IPv4 addresses, best-for-QR first (private ranges win). */
function lanAddresses(): { ip: string; name: string }[] {
  const rank = (ip: string): number => {
    if (ip.startsWith('192.168.')) return 0;
    if (ip.startsWith('10.')) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
    if (ip.startsWith('169.254.')) return 9; // link-local — last resort
    return 5;
  };
  const out: { ip: string; name: string }[] = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push({ ip: a.address, name });
    }
  }
  return out.sort((a, b) => rank(a.ip) - rank(b.ip));
}

// --- static file server -----------------------------------------------------------

function handler(req: IncomingMessage, res: ServerResponse): void {
  const end = (code: number, body: string): void => {
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') return end(405, 'method not allowed');

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  } catch {
    return end(400, 'bad request');
  }
  // decodeURIComponent happily yields NUL bytes (%00); fs then THROWS on them
  // and an uncaught throw here kills the whole server — one bad request from
  // any LAN device. Reject them explicitly.
  if (pathname.includes('\0')) return end(400, 'bad request');
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Traversal guard: the resolved path must stay inside dist/.
  const filePath = resolve(dist, normalize(pathname).replace(/^([/\\])+/, ''));
  if (filePath !== dist && !filePath.startsWith(dist + sep)) return end(403, 'forbidden');

  const st = statSync(filePath, { throwIfNoEntry: false });
  if (!st || !st.isFile()) return end(404, 'not found');

  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': st.size,
    // index.html must revalidate (it names the hashed bundles); assets may
    // cache briefly — keeps phone reloads fast without going stale for long.
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'max-age=300',
  });
  if (req.method === 'HEAD') return void res.end();
  // TOCTOU/EACCES between statSync and open: without an error handler the
  // stream 'error' event throws and crashes the process — same class as the
  // NUL-byte case, on a network-exposed server.
  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) return end(500, 'read error');
    res.destroy();
  });
  stream.pipe(res);
}

/** Listen on 0.0.0.0, walking up from the preferred port if it's taken. */
function listen(preferred: number, onReady: (port: number) => void): void {
  const tryPort = (port: number, remaining: number): void => {
    const server = createServer(handler);
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && remaining > 0) {
        console.log(`serve-lan: port ${port} is in use — trying ${port + 1}`);
        tryPort(port + 1, remaining - 1);
      } else {
        fail(`could not listen: ${err.message}`);
      }
    });
    server.listen(port, '0.0.0.0', () => onReady(port));
  };
  tryPort(preferred, 10);
}

// --- main ------------------------------------------------------------------------

/**
 * Best-effort half-res refresh: nice-to-have for phone texture memory, but a
 * failure (missing Pillow, one truncated source PNG mid-art-run) must never
 * block serving a perfectly good dist/ — LAN play is orthogonal to art
 * tooling. Standalone `npm run gen-art-halfres` keeps its honest exit code.
 */
function refreshHalfResBestEffort(): void {
  const res = spawnSync('npm run gen-art-halfres', { shell: true, stdio: 'inherit', cwd: root });
  if (res.status !== 0) {
    console.warn('serve-lan: WARNING — half-res refresh failed (see above); serving anyway.');
    console.warn('serve-lan: phones will fall back to full-res art; run `npm run gen-art-halfres` to diagnose.');
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  refreshHalfResBestEffort();
  ensureBuilt(args);

  const nics = lanAddresses();
  if (nics.length === 0) {
    console.warn('serve-lan: WARNING — no LAN interface found; only this machine can connect');
  }

  listen(args.port, (port) => {
    const primary = nics[0];
    console.log('');
    console.log('  Darling Blades — LAN play server');
    console.log(`  serving ${dist}`);
    console.log('');
    console.log(`  Local:   http://localhost:${port}/`);
    for (const { ip, name } of nics) {
      const tag = primary && ip === primary.ip ? '  ← join here' : ` (${name})`;
      console.log(`  Network: http://${ip}:${port}/${tag}`);
    }
    console.log('');
    if (primary) {
      const url = `http://${primary.ip}:${port}/`;
      if (args.qr) {
        console.log('  Scan to join on your phone (same Wi-Fi):');
        console.log('');
        qrcode.generate(url, { small: true });
      }
      console.log(`  ${url}`);
      console.log('');
      console.log('  First run: allow node.exe through the Windows firewall (Private networks).');
    }
    console.log('  Ctrl+C to stop.');
    console.log('');
  });
}

main();
