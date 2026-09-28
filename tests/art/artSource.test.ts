import { describe, expect, it } from 'vitest';
import {
  ArtSourceError,
  WHOLE_PACKS_HELD,
  createArtSource,
  createLooseSource,
  createPackSource,
  keysFingerprint,
  type ArtSource,
  type ArtSourceFailure,
  type PackIndex,
} from '../../src/art/artSource';

/**
 * The art source's response ladder (docs/plan-art-streaming.md section 5):
 * what the store gets back from each kind of answer a host can give to a range
 * read of a pack, and from the loose files. The host is a scripted fake
 * `fetch` over real `Response` objects, so status, headers and body behave as
 * a browser's would.
 */

/** A small fake webp file: `RIFF`, a size, `WEBP`, then `n` bytes of `fill`. */
function webp(n: number, fill: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + n);
  out.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(out.buffer).setUint32(4, 4 + n, true);
  out.set([0x57, 0x45, 0x42, 0x50], 8);
  out.fill(fill, 12);
  return out;
}

const concat = (parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const blobBytes = async (b: Blob): Promise<number[]> => [...new Uint8Array(await b.arrayBuffer())];

/**
 * Two full packs (`a` holds keys a1 a2 a3, `b` holds b1) and a half pack for
 * a1 only, so a2's half entry is null.
 */
const FILES = {
  a1: webp(20, 1),
  a2: webp(33, 2),
  a3: webp(7, 3),
  b1: webp(15, 4),
  a1h: webp(5, 9),
};
const KEYS = ['a1', 'a2', 'a3', 'b1'];
const PACKS: Record<string, Uint8Array<ArrayBuffer>> = {
  'full-a.0000000001.bin': concat([FILES.a1, FILES.a2, FILES.a3]),
  'full-b.0000000002.bin': concat([FILES.b1]),
  'half-a.0000000003.bin': concat([FILES.a1h]),
};
const INDEX: PackIndex = {
  version: 1,
  keys: keysFingerprint(KEYS),
  tiers: {
    full: {
      packs: ['full-a.0000000001.bin', 'full-b.0000000002.bin'],
      sizes: [PACKS['full-a.0000000001.bin'].length, PACKS['full-b.0000000002.bin'].length],
      at: [
        [0, 0, FILES.a1.length],
        [0, FILES.a1.length, FILES.a2.length],
        [0, FILES.a1.length + FILES.a2.length, FILES.a3.length],
        [1, 0, FILES.b1.length],
      ],
    },
    half: {
      packs: ['half-a.0000000003.bin'],
      sizes: [PACKS['half-a.0000000003.bin'].length],
      at: [[0, 0, FILES.a1h.length], null, null, null],
    },
  },
};

const LOOSE: Record<string, Uint8Array<ArrayBuffer>> = {
  'assets/art/cards/a1.webp': FILES.a1,
  'assets/art/cards/a2.webp': FILES.a2,
  'assets/art/cards/b1.webp': FILES.b1,
  'assets/art/cards-half/a1.webp': FILES.a1h,
};

interface Call {
  url: string;
  range: string | null;
}

type Answer = (call: Call, pack: Uint8Array<ArrayBuffer> | undefined) => Response | Promise<Response>;

/** A correct range-serving host: the default answer for a pack URL. */
const serveRange: Answer = ({ range }, pack) => {
  if (!pack) return new Response(null, { status: 404 });
  if (!range) return new Response(pack, { status: 200 });
  const [start, end] = range.replace('bytes=', '').split('-').map(Number);
  return new Response(pack.slice(start, end + 1), {
    status: 206,
    headers: { 'Content-Range': `bytes ${start}-${end}/${pack.length}` },
  });
};

/** A host that ignores Range and always sends the whole pack. */
const ignoreRange: Answer = (_call, pack) =>
  pack ? new Response(pack, { status: 200 }) : new Response(null, { status: 404 });

/** A fake host. `answer` handles pack URLs; loose URLs are served from LOOSE. */
function host(answer: Answer = serveRange, packs = PACKS) {
  const calls: Call[] = [];
  const fetch = async (input: string, init?: RequestInit): Promise<Response> => {
    const range = (init?.headers as Record<string, string> | undefined)?.Range ?? null;
    const call = { url: input, range };
    calls.push(call);
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (input.startsWith('assets/art/packs/')) {
      return answer(call, packs[input.slice('assets/art/packs/'.length)]);
    }
    const file = LOOSE[input];
    return file ? new Response(file, { status: 200 }) : new Response(null, { status: 404 });
  };
  const log = { warnings: [] as string[], errors: [] as string[] };
  const logger = { warn: (m: string) => void log.warnings.push(m), error: (m: string) => void log.errors.push(m) };
  const packCalls = (): Call[] => calls.filter((c) => c.url.startsWith('assets/art/packs/'));
  return { fetch, calls, packCalls, log, logger };
}

function packSource(h: ReturnType<typeof host>, index = INDEX): ArtSource {
  const loose = createLooseSource({ fetch: h.fetch, hasHalf: (k) => k === 'a1', log: h.logger });
  return createPackSource({ index, keys: KEYS, loose, fetch: h.fetch, log: h.logger });
}

async function failureOf(p: Promise<unknown>): Promise<ArtSourceFailure> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(ArtSourceError);
    return (err as ArtSourceError).reason;
  }
  throw new Error('expected the read to reject');
}

describe('pack source: a host that serves ranges', () => {
  it('reads each card with one range request for exactly its bytes', async () => {
    const h = host();
    const src = packSource(h);
    expect(await blobBytes(await src.read('a2', 'full'))).toEqual([...FILES.a2]);
    const start = FILES.a1.length;
    expect(h.calls).toEqual([
      { url: 'assets/art/packs/full-a.0000000001.bin', range: `bytes=${start}-${start + FILES.a2.length - 1}` },
    ]);
    const blob = await src.read('b1', 'full');
    expect(blob.type).toBe('image/webp');
    expect(await blobBytes(blob)).toEqual([...FILES.b1]);
  });

  it('sends the first read of a pack alone and lets the rest follow its answer', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const h = host(async (call, pack) => {
      await gate;
      return serveRange(call, pack);
    });
    const src = packSource(h);
    const reads = ['a1', 'a2', 'a3'].map((k) => src.read(k, 'full'));
    await new Promise((r) => setTimeout(r, 5));
    expect(h.packCalls()).toHaveLength(1);
    release();
    const blobs = await Promise.all(reads);
    expect(await Promise.all(blobs.map(blobBytes))).toEqual([[...FILES.a1], [...FILES.a2], [...FILES.a3]]);
    // Once ranges are known to work, reads go out on their own.
    expect(h.packCalls()).toHaveLength(3);
  });

  it('answers a half read with the full file when the key has no half entry', async () => {
    const h = host();
    const src = packSource(h);
    expect(await blobBytes(await src.read('a2', 'half'))).toEqual([...FILES.a2]);
    expect(await blobBytes(await src.read('a1', 'half'))).toEqual([...FILES.a1h]);
  });

  it('reads the full packs for the half tier when no half tier was built', async () => {
    const h = host();
    const src = packSource(h, { ...INDEX, tiers: { full: INDEX.tiers.full } });
    expect(await blobBytes(await src.read('a1', 'half'))).toEqual([...FILES.a1]);
  });
});

describe('pack source: a 200 instead of a 206', () => {
  it('downloads each pack once, slices every card from it, and warns once', async () => {
    const h = host(ignoreRange);
    const src = packSource(h);
    const blobs = await Promise.all(['a1', 'a2', 'a3'].map((k) => src.read(k, 'full')));
    expect(await Promise.all(blobs.map(blobBytes))).toEqual([[...FILES.a1], [...FILES.a2], [...FILES.a3]]);
    expect(await blobBytes(await src.read('a2', 'full'))).toEqual([...FILES.a2]);
    expect(h.packCalls()).toHaveLength(1);
    expect(h.log.warnings).toHaveLength(1);
  });

  it(`holds at most ${WHOLE_PACKS_HELD} whole packs, dropping the least recently used`, async () => {
    const h = host(ignoreRange);
    const src = packSource(h);
    await src.read('a1', 'full'); // full-a
    await src.read('b1', 'full'); // full-b
    await src.read('a1', 'half'); // half-a: full-a is now the oldest and is dropped
    expect(h.packCalls()).toHaveLength(3);
    await src.read('b1', 'full'); // still held
    expect(h.packCalls()).toHaveLength(3);
    await src.read('a2', 'full'); // full-a again
    expect(h.packCalls()).toHaveLength(4);
  });
});

describe('pack source: a host that compressed the pack', () => {
  it('treats a Content-Encoding on a 206 as whole-pack mode, fetching the pack without Range', async () => {
    const h = host((call, pack) => {
      if (call.range) {
        return new Response(new Uint8Array([0x1f, 0x8b, 0, 1, 2]), {
          status: 206,
          headers: { 'Content-Encoding': 'gzip', 'Content-Range': 'bytes 0-4/99' },
        });
      }
      // fetch decompresses a full body transparently; the header stays.
      return new Response(pack, { status: 200, headers: { 'Content-Encoding': 'gzip' } });
    });
    const src = packSource(h);
    expect(await blobBytes(await src.read('a3', 'full'))).toEqual([...FILES.a3]);
    expect(h.packCalls().map((c) => c.range === null)).toEqual([false, true]);
    expect(h.log.warnings).toHaveLength(1);
  });

});

describe('pack source: a 206 whose body fails to read', () => {
  it('reports an unencoded one as transient and keeps reading the pack by range', async () => {
    // With no Content-Encoding the body can only have stopped because the link
    // dropped, so a 35 MiB whole-pack download is the wrong answer.
    let first = true;
    const h = host((call, pack) => {
      if (first && call.range) {
        first = false;
        const broken = new ReadableStream<Uint8Array>({
          start: (c) => c.error(new TypeError('network error')),
        });
        return new Response(broken, { status: 206, headers: { 'Content-Range': 'bytes 0-1/2' } });
      }
      return serveRange(call, pack);
    });
    const src = packSource(h);
    expect(await failureOf(src.read('a1', 'full'))).toBe('transient');
    expect(await blobBytes(await src.read('a1', 'full'))).toEqual([...FILES.a1]);
    expect(h.packCalls().map((c) => c.range !== null)).toEqual([true, true]);
  });

  it('treats an encoded one as whole-pack mode, not a transient failure', async () => {
    const h = host((call, pack) => {
      if (call.range) {
        const broken = new ReadableStream<Uint8Array>({
          start: (c) => c.error(new TypeError('Failed to decode the content')),
        });
        return new Response(broken, {
          status: 206,
          headers: { 'Content-Range': 'bytes 0-1/2', 'Content-Encoding': 'br' },
        });
      }
      return new Response(pack, { status: 200 });
    });
    const src = packSource(h);
    expect(await blobBytes(await src.read('a1', 'full'))).toEqual([...FILES.a1]);
    expect(h.packCalls().map((c) => c.range === null)).toEqual([false, true]);
  });
});

describe('pack source: the index and the pack disagree', () => {
  const shifted = (): PackIndex => ({
    ...INDEX,
    tiers: {
      ...INDEX.tiers,
      full: { ...INDEX.tiers.full!, at: [[0, 1, FILES.a1.length], ...INDEX.tiers.full!.at.slice(1)] },
    },
  });

  it('fails a key whose bytes are not a webp file, logs one error, and never asks again', async () => {
    const h = host();
    const src = packSource(h, shifted());
    expect(await failureOf(src.read('a1', 'full'))).toBe('failed');
    expect(await failureOf(src.read('a1', 'full'))).toBe('failed');
    expect(h.packCalls()).toHaveLength(1);
    expect(h.log.errors).toHaveLength(1);
    // The pack's other keys still read.
    expect(await blobBytes(await src.read('a2', 'full'))).toEqual([...FILES.a2]);
  });

  it('fails a key when the 206 body is the wrong length', async () => {
    const h = host((call, pack) => {
      const res = serveRange(call, pack) as Response;
      return new Response(new Uint8Array([...FILES.a1, 0]), { status: 206, headers: res.headers });
    });
    expect(await failureOf(packSource(h).read('a1', 'full'))).toBe('failed');
  });

  it('fails a key on a 416', async () => {
    const h = host(() => new Response(null, { status: 416 }));
    expect(await failureOf(packSource(h).read('a1', 'full'))).toBe('failed');
  });

  it('reads loose files when a whole pack is not the length the index says', async () => {
    const h = host(ignoreRange, { ...PACKS, 'full-a.0000000001.bin': concat([FILES.a1, FILES.a2]) });
    const src = packSource(h);
    expect(await blobBytes(await src.read('a1', 'full'))).toEqual([...FILES.a1]);
    expect(h.calls.at(-1)?.url).toBe('assets/art/cards/a1.webp');
    expect(h.log.errors).toHaveLength(1);
  });
});

describe('pack source: a 404 on the pack', () => {
  it('falls back to the loose file for that pack', async () => {
    const h = host(serveRange, {});
    const src = packSource(h);
    expect(await blobBytes(await src.read('a2', 'full'))).toEqual([...FILES.a2]);
    expect(await blobBytes(await src.read('a1', 'half'))).toEqual([...FILES.a1h]);
    await src.read('a1', 'full');
    // Each pack was asked once; after that its keys go straight to the loose files.
    expect(h.packCalls().map((c) => c.url)).toEqual([
      'assets/art/packs/full-a.0000000001.bin',
      'assets/art/packs/half-a.0000000003.bin',
    ]);
  });

  it('fails the key when the loose file is gone too', async () => {
    const h = host(serveRange, {});
    expect(await failureOf(packSource(h).read('a3', 'full'))).toBe('failed');
  });
});

describe('pack source: transient failures', () => {
  it('reports a network error as transient and leaves the pack readable', async () => {
    let failNext = true;
    const h = host((call, pack) => {
      if (failNext) {
        failNext = false;
        throw new TypeError('Failed to fetch');
      }
      return serveRange(call, pack);
    });
    const src = packSource(h);
    expect(await failureOf(src.read('a1', 'full'))).toBe('transient');
    expect(await blobBytes(await src.read('a1', 'full'))).toEqual([...FILES.a1]);
  });

  it('fails the reads waiting on a deciding read that failed transiently, without re-asking', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const h = host(async () => {
      await gate;
      throw new TypeError('Failed to fetch');
    });
    const src = packSource(h);
    const reads = ['a1', 'a2', 'a3'].map((k) => failureOf(src.read(k, 'full')));
    await new Promise((r) => setTimeout(r, 5));
    release();
    expect(await Promise.all(reads)).toEqual(['transient', 'transient', 'transient']);
    // One request went out; the waiters did not each re-decide on a stalled link.
    expect(h.packCalls()).toHaveLength(1);
  });

  it('hands the decision to a waiting read when the deciding read is cancelled', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const h = host(async (call, pack) => {
      await gate;
      return serveRange(call, pack);
    });
    // The fake host above ignores the signal once the request is sent; this
    // wrapper rejects on abort, as a browser does.
    const fetch = (url: string, init?: RequestInit): Promise<Response> =>
      new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        h.fetch(url, init).then(resolve, reject);
      });
    const src = createPackSource({ index: INDEX, keys: KEYS, fetch, log: h.logger });
    const ctl = new AbortController();
    const first = failureOf(src.read('a1', 'full', ctl.signal));
    const second = src.read('a2', 'full');
    const third = src.read('a3', 'full');
    await new Promise((r) => setTimeout(r, 5));
    expect(h.packCalls()).toHaveLength(1);
    ctl.abort();
    expect(await first).toBe('aborted');
    await new Promise((r) => setTimeout(r, 5));
    // The second read now decides alone; the third still waits for it.
    expect(h.packCalls()).toHaveLength(2);
    release();
    expect(await blobBytes(await second)).toEqual([...FILES.a2]);
    expect(await blobBytes(await third)).toEqual([...FILES.a3]);
    const at = (k: 'a1' | 'a2' | 'a3', from: number): string => `bytes=${from}-${from + FILES[k].length - 1}`;
    expect(h.packCalls().map((c) => c.range)).toEqual([
      at('a1', 0),
      at('a2', FILES.a1.length),
      at('a3', FILES.a1.length + FILES.a2.length),
    ]);
  });

  it('reports a 5xx as transient', async () => {
    const h = host(() => new Response(null, { status: 503 }));
    expect(await failureOf(packSource(h).read('a1', 'full'))).toBe('transient');
  });

  it('reports a request that outlives the timeout as transient', async () => {
    const h = host();
    const hang = (_url: string, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      );
    const src = createPackSource({ index: INDEX, keys: KEYS, fetch: hang, timeoutMs: 10, log: h.logger });
    expect(await failureOf(src.read('a1', 'full'))).toBe('transient');
  });

  /** A whole-pack answer whose body arrives in chunks `gapMs` apart, or stops after `stallAfter` chunks. */
  const trickle = (gapMs: number, stallAfter = Infinity) => (_url: string, init?: RequestInit): Promise<Response> => {
    const pack = PACKS['full-a.0000000001.bin'];
    const n = 24;
    const step = Math.ceil(pack.length / n);
    const pieces = Array.from({ length: n }, (_, i) => pack.slice(i * step, i === n - 1 ? pack.length : (i + 1) * step));
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        // As a browser does, the request's abort errors the body mid-read.
        init?.signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
      },
      async pull(c) {
        if (sent >= stallAfter) return new Promise<void>(() => {});
        await new Promise((r) => setTimeout(r, gapMs));
        if (sent === pieces.length) return c.close();
        c.enqueue(pieces[sent++]);
      },
    });
    return Promise.resolve(new Response(body, { status: 200 }));
  };

  it('lets a slow body finish as long as it keeps arriving', async () => {
    const src = createPackSource({ index: INDEX, keys: KEYS, fetch: trickle(25), timeoutMs: 250, log: host().logger });
    // 25 gaps of 25 ms: about 2.5 times the 250 ms limit in total, never idle
    // for more than a tenth of it.
    expect(await blobBytes(await src.read('a3', 'full'))).toEqual([...FILES.a3]);
  });

  it('reports a body that stops arriving as transient', async () => {
    const src = createPackSource({ index: INDEX, keys: KEYS, fetch: trickle(1, 2), timeoutMs: 30, log: host().logger });
    expect(await failureOf(src.read('a3', 'full'))).toBe('transient');
  });

  it("reports the caller's own cancel as aborted", async () => {
    const h = host();
    const ctl = new AbortController();
    ctl.abort();
    expect(await failureOf(packSource(h).read('a1', 'full', ctl.signal))).toBe('aborted');
  });
});

describe('loose source', () => {
  it('reads the half folder only for keys that have a half file', async () => {
    const h = host();
    const src = createLooseSource({ fetch: h.fetch, hasHalf: (k) => k === 'a1', log: h.logger });
    expect(await blobBytes(await src.read('a1', 'half'))).toEqual([...FILES.a1h]);
    expect(await blobBytes(await src.read('a2', 'half'))).toEqual([...FILES.a2]);
    expect(h.calls.map((c) => c.url)).toEqual(['assets/art/cards-half/a1.webp', 'assets/art/cards/a2.webp']);
  });

  it('fails a 404 for the session, and retries a 5xx or a network error', async () => {
    const h = host();
    const src = createLooseSource({ fetch: h.fetch, hasHalf: () => false, log: h.logger });
    expect(await failureOf(src.read('zz', 'full'))).toBe('failed');
    expect(await failureOf(src.read('zz', 'full'))).toBe('failed');
    expect(h.calls).toHaveLength(1);
    const flaky = createLooseSource({ fetch: async () => new Response(null, { status: 500 }), hasHalf: () => false });
    expect(await failureOf(flaky.read('a1', 'full'))).toBe('transient');
    const offline = createLooseSource({
      fetch: async () => {
        throw new TypeError('net::ERR_CONNECTION_REFUSED');
      },
      hasHalf: () => false,
    });
    expect(await failureOf(offline.read('a1', 'full'))).toBe('transient');
  });
});

describe("choosing the build's source", () => {
  it('uses the packs only for a packs build whose index matches the manifest', () => {
    const h = host();
    const base = { keys: KEYS, fetch: h.fetch, log: h.logger };
    expect(createArtSource({ ...base, kind: 'packs', index: INDEX }).kind).toBe('packs');
    expect(createArtSource({ ...base, kind: 'loose', index: INDEX }).kind).toBe('loose');
    expect(createArtSource({ ...base, kind: 'packs', index: null }).kind).toBe('loose');
    expect(h.log.errors).toHaveLength(0);
    const stale = createArtSource({ ...base, kind: 'packs', index: { ...INDEX, keys: keysFingerprint(['a1']) } });
    expect(stale.kind).toBe('loose');
    expect(h.log.errors).toHaveLength(1);
  });

  it('is loose in dev and tests (the __ART_SOURCE__ define)', () => {
    expect(createArtSource({ keys: KEYS }).kind).toBe('loose');
  });
});
