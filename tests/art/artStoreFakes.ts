import { ArtStore, type ArtFileTier, type ArtImage, type ArtStoreOptions, type ArtTextureSink } from '../../src/art/artStore';

/**
 * Hand-driven fakes for the art store: a source whose reads settle only when a
 * test says so, a texture sink that records what it was given, a decoder that
 * sizes each image by the file tier it came from, and a clock the test moves.
 * Nothing here imports Phaser; the store is the Phaser-free half by design.
 */

export const FULL_BYTES = 640 * 800 * 4;
export const HALF_BYTES = 320 * 400 * 4;

export class FakeImage implements ArtImage {
  closed = false;
  constructor(
    readonly width: number,
    readonly height: number,
    readonly key: string,
  ) {}
  close(): void {
    this.closed = true;
  }
}

interface Read {
  key: string;
  tier: ArtFileTier;
  signal?: AbortSignal;
  resolve: () => void;
  reject: (reason: string) => void;
  settled: boolean;
}

const blobInfo = new WeakMap<Blob, { key: string; tier: ArtFileTier }>();

export class FakeSource {
  reads: Read[] = [];
  /** Settle every read at once with success. */
  auto = false;
  /** Keep going after an abort, as a source that ignores its signal would. */
  ignoreSignal = false;

  read(key: string, tier: ArtFileTier, signal?: AbortSignal): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const read: Read = {
        key,
        tier,
        signal,
        settled: false,
        resolve: () => {
          if (read.settled) return;
          read.settled = true;
          const blob = new Blob([key]);
          blobInfo.set(blob, { key, tier });
          resolve(blob);
        },
        reject: (reason: string) => {
          if (read.settled) return;
          read.settled = true;
          reject(Object.assign(new Error(`read ${key} ${reason}`), { reason }));
        },
      };
      this.reads.push(read);
      if (!this.ignoreSignal) signal?.addEventListener('abort', () => read.reject('aborted'));
      if (this.auto) read.resolve();
    });
  }

  /** Keys asked for, in order. */
  get keys(): string[] {
    return this.reads.map((read) => read.key);
  }

  /** Reads not settled yet. */
  get open(): Read[] {
    return this.reads.filter((read) => !read.settled);
  }

  /** Settle the oldest open read of `key`. */
  finish(key: string): void {
    const read = this.open.find((r) => r.key === key);
    if (read === undefined) throw new Error(`no open read for ${key}`);
    read.resolve();
  }

  fail(key: string, reason = 'transient'): void {
    const read = this.open.find((r) => r.key === key);
    if (read === undefined) throw new Error(`no open read for ${key}`);
    read.reject(reason);
  }
}

export class FakeSink implements ArtTextureSink {
  readonly textures = new Map<string, FakeImage>();
  readonly added: string[] = [];
  readonly removed: string[] = [];
  keepsSource = false;
  drawn = new Set<string>();

  exists(textureKey: string): boolean {
    return this.textures.has(textureKey);
  }

  add(textureKey: string, image: ArtImage): boolean {
    if (this.textures.has(textureKey)) return false;
    this.textures.set(textureKey, image as FakeImage);
    this.added.push(textureKey);
    return true;
  }

  remove(textureKey: string): void {
    this.textures.delete(textureKey);
    this.removed.push(textureKey);
  }

  inUse(textureKeys: readonly string[]): ReadonlySet<string> {
    return new Set(textureKeys.filter((key) => this.drawn.has(key)));
  }
}

export async function fakeDecode(blob: Blob): Promise<ArtImage> {
  const info = blobInfo.get(blob);
  if (info === undefined) throw new Error('not a fake blob');
  return info.tier === 'full' ? new FakeImage(640, 800, info.key) : new FakeImage(320, 400, info.key);
}

/** Let every pending promise continuation run. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export interface Harness {
  store: ArtStore;
  source: FakeSource;
  sink: FakeSink;
  clock: { t: number };
  decoded: FakeImage[];
  warnings: string[];
  /** flush, then one frame. */
  tick(): Promise<void>;
}

export function makeStore(overrides: Partial<ArtStoreOptions> = {}, keys = ['a', 'b', 'c', 'd', 'e', 'f']): Harness {
  const source = new FakeSource();
  const sink = new FakeSink();
  const clock = { t: 1000 };
  const decoded: FakeImage[] = [];
  const warnings: string[] = [];
  const store = new ArtStore({
    manifest: keys,
    hasHalf: () => true,
    keyFor: (id) => (id === 'donor' ? 'a' : id),
    quality: 'full',
    source,
    sink,
    budgetBytes: 100 * FULL_BYTES,
    maxInFlight: 6,
    decode: async (blob) => {
      const image = (await fakeDecode(blob)) as FakeImage;
      decoded.push(image);
      return image;
    },
    now: () => clock.t,
    onWarn: (message) => warnings.push(message),
    ...overrides,
  });
  return {
    store,
    source,
    sink,
    clock,
    decoded,
    warnings,
    tick: async () => {
      await flush();
      store.frame();
      await flush();
    },
  };
}

/** Load `ids` to residency with an auto-answering source, then leave the source manual again. */
export async function loadAll(h: Harness, ids: string[]): Promise<void> {
  const cancel = h.store.prefetch(ids, { priority: 'now' });
  for (const id of ids) {
    const open = h.source.open.find((read) => read.key === id);
    open?.resolve();
  }
  for (let i = 0; i < 10 && (h.store.stats().uploadsPending > 0 || h.store.stats().inFlight > 0 || i === 0); i++) {
    await h.tick();
  }
  cancel();
}
