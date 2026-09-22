import manifest from '../data/art-manifest.json';
import { AVATARS } from '../data/opponents';
import { STARTER_DECKS } from '../data/starterDecks';
import { TUTORIAL_AI_DECK, TUTORIAL_LAND_RESERVE, TUTORIAL_PLAYER_DECK } from '../data/tutorial';
import { CARD_DB } from '../data/catalog';
import { qualityTier } from '../platform/quality';

/**
 * Session-long card-art loading, split out of `PreloadScene` (1.8).
 *
 * The boot loader used to queue all 1,537 card images (216 MiB) before the main
 * menu was allowed to appear: 16 s to a menu that draws no card art at all
 * (measured 2026-09-21, production build, local disk). `ArtLoaderScene` now
 * owns that work instead, loading in batches beside every other scene for the
 * life of the game, and the scenes that DO draw card art wait only for their
 * own cards through `src/ui/artGate.ts`.
 *
 * This module is the Phaser-free half: the ordering rule, the queue/priority
 * state machine, and the module-level API the UI calls. The scene is a thin
 * shell that hands the queue a batch loader and re-emits its callbacks on
 * `game.events`. Everything here is unit-testable without Phaser.
 *
 * The API named in the design (`isLoaded` / `ensure` / `progress` / `request`)
 * is exported as `isArtLoaded` / `ensureArt` / `artProgress` / `requestArt`.
 */

/** Files per loader batch. Batching is what makes the front queue real: a
 *  requested id can only jump ahead of files that have not been handed to
 *  Phaser yet, so the batch size is the worst-case wait before a priority
 *  request goes out. */
export const ART_BATCH_SIZE = 48;

/** Emitted on `game.events` once per settled file, with the art key. */
export const ART_EVENT_FILE = 'art-file';
/** Emitted on `game.events` after every settled file, with `ArtProgress`. */
export const ART_EVENT_PROGRESS = 'art-progress';
/** Emitted on `game.events` exactly once, when the whole manifest is in. */
export const ART_EVENT_COMPLETE = 'art-complete';

export interface ArtProgress {
  loaded: number;
  total: number;
}

/** One queued file: `id` is the manifest art key, `textureKey` what Phaser gets. */
export interface ArtFile {
  id: string;
  textureKey: string;
  url: string;
}

export interface ArtBatchHooks {
  /** Report a settled file (loaded OR failed — a failure still counts). */
  onFile: (id: string) => void;
  /** Report that the whole batch has settled. */
  onDone: () => void;
}

/** What the scene supplies: "load these files, tell me as they settle". */
export interface ArtBatchSink {
  load(files: readonly ArtFile[], hooks: ArtBatchHooks): void;
}

/** Every manifest art key, in manifest order. */
const MANIFEST_KEYS: readonly string[] = manifest.cards;
const HALF_KEYS = new Set<string>((manifest as { half?: string[] }).half ?? []);

/** The art key a card id draws from: `artRef` donors share one file. */
export function artKeyFor(id: string): string {
  return CARD_DB[id]?.artRef ?? id;
}

/** Phaser texture key convention for a manifest-listed real art file. */
export function artTextureKey(key: string): string {
  return `artfile-${key}`;
}

/** True when the half-res 320x400 file for this key is on disk. */
export function hasHalfArt(key: string): boolean {
  return HALF_KEYS.has(key);
}

/**
 * Asset URL for one manifest art key. On the `lite` quality tier the half-res
 * 320x400 set is preferred where it exists (same texture keys, ~4x less VRAM);
 * keys with no half file load full-res. Shared by `ArtResolver.queueRealArt`
 * (the card-proof harness's own preload) and the session loader, so the tier
 * rule lives in exactly one place.
 *
 * `hasHalf` is injectable because the manifest is machine-generated from
 * whatever is on local disk (`scripts/gen-art-manifest.ts`), so its `half`
 * list is empty in a checkout that has never run `npm run gen-art-halfres` —
 * the rule still has to be testable there.
 */
export function artFileUrl(key: string, tier = qualityTier(), hasHalf = hasHalfArt): string {
  const dir = tier === 'lite' && hasHalf(key) ? 'cards-half' : 'cards';
  return `assets/art/${dir}/${key}.webp`;
}

export interface ArtOrderInput {
  /** Every art key the loader may request, in manifest order. */
  manifest: readonly string[];
  /** Card id to art key (`artRef` mapping). */
  artKeyFor: (id: string) => string;
  /** True when the key belongs to a card; false keys (styled lands) go last. */
  isCardKey: (key: string) => boolean;
  /** Priority groups, best-first. Ids not in the manifest are dropped. */
  groups: readonly (readonly string[])[];
}

/**
 * Queue order: the priority groups first (deduplicated, in the order given),
 * then the rest of the manifest in manifest order, then every key that is not
 * a card id — the styled basic-land files (`<land>--<style>`) and anything
 * else a future manifest adds. Nothing a player can reach in the first seconds
 * is behind 1,500 files it does not need.
 */
export function artQueueOrder(input: ArtOrderInput): string[] {
  const known = new Set(input.manifest);
  const seen = new Set<string>();
  const head: string[] = [];
  for (const group of input.groups) {
    for (const id of group) {
      const key = input.artKeyFor(id);
      if (!known.has(key) || seen.has(key)) continue;
      seen.add(key);
      head.push(key);
    }
  }
  const body: string[] = [];
  const tail: string[] = [];
  for (const key of input.manifest) {
    if (seen.has(key)) continue;
    seen.add(key);
    (input.isCardKey(key) ? body : tail).push(key);
  }
  return [...head, ...body, ...tail];
}

/**
 * The shipped order: the tutorial duel's two decks (the very first card art a
 * new player can see, 4 files), the five starter decks, the 26 avatar
 * portraits, then this save's own decks, then the rest.
 */
export function defaultArtOrder(saveDeckCards: readonly string[] = []): string[] {
  const starters = STARTER_DECKS.flatMap((deck) => [
    ...(deck.reserveCards ?? deck.cards),
    ...(deck.landReserve ?? []),
  ]);
  return artQueueOrder({
    manifest: MANIFEST_KEYS,
    artKeyFor,
    isCardKey: (key) => CARD_DB[key] !== undefined,
    groups: [
      [...TUTORIAL_PLAYER_DECK, ...TUTORIAL_AI_DECK, ...TUTORIAL_LAND_RESERVE],
      starters,
      AVATARS.map((avatar) => avatar.portraitCardId),
      saveDeckCards,
    ],
  });
}

interface Waiter {
  need: Set<string>;
  resolve: () => void;
}

export interface ArtQueueOpts {
  /** Art keys in load order (see `defaultArtOrder`). */
  order: readonly string[];
  sink: ArtBatchSink;
  fileUrl?: (key: string) => string;
  artKeyFor?: (id: string) => string;
  batchSize?: number;
  onFile?: (id: string) => void;
  onProgress?: (progress: ArtProgress) => void;
  onComplete?: () => void;
}

/**
 * The batching queue with a front lane. `request(ids)` moves not-yet-loaded
 * ids ahead of everything Phaser has not been handed yet; Phaser's own
 * in-flight list is never reordered (it cannot be), which is exactly why the
 * batches are small.
 */
export class ArtQueue {
  private readonly order: readonly string[];
  private readonly known: Set<string>;
  private readonly sink: ArtBatchSink;
  private readonly fileUrl: (key: string) => string;
  private readonly keyFor: (id: string) => string;
  private readonly batchSize: number;
  private readonly opts: ArtQueueOpts;
  private cursor = 0;
  private front: string[] = [];
  private frontSet = new Set<string>();
  private readonly loadedKeys = new Set<string>();
  private readonly inFlight = new Set<string>();
  private waiters: Waiter[] = [];
  private running = false;
  private finished = false;

  constructor(opts: ArtQueueOpts) {
    this.opts = opts;
    this.order = opts.order;
    this.known = new Set(opts.order);
    this.sink = opts.sink;
    this.fileUrl = opts.fileUrl ?? artFileUrl;
    this.keyFor = opts.artKeyFor ?? artKeyFor;
    this.batchSize = Math.max(1, opts.batchSize ?? ART_BATCH_SIZE);
  }

  /** Begin loading. Safe to call more than once. */
  start(): void {
    this.pump();
  }

  isLoaded(id: string): boolean {
    const key = this.keyFor(id);
    return !this.known.has(key) || this.loadedKeys.has(key);
  }

  progress(): ArtProgress {
    return { loaded: this.loadedKeys.size, total: this.order.length };
  }

  /** Art keys still outstanding among `ids` (`null` = the whole manifest). */
  missing(ids: Iterable<string> | null): string[] {
    if (ids === null) return this.order.filter((key) => !this.loadedKeys.has(key));
    const out: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      const key = this.keyFor(id);
      if (!this.known.has(key) || this.loadedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  }

  /** Move `ids` to the front of the queue. `null` asks for nothing special. */
  request(ids: Iterable<string> | null): void {
    if (ids !== null) {
      const jump: string[] = [];
      for (const id of ids) {
        const key = this.keyFor(id);
        if (!this.known.has(key)) continue;
        if (this.loadedKeys.has(key) || this.inFlight.has(key) || this.frontSet.has(key)) continue;
        this.frontSet.add(key);
        jump.push(key);
      }
      if (jump.length > 0) this.front = [...jump, ...this.front];
    }
    this.pump();
  }

  /**
   * Resolve once every manifest-listed id in `ids` is loaded. Ids with no real
   * art file resolve immediately (they render a generated placeholder), and so
   * does a file the loader failed on — `ensure` can never hang.
   */
  ensure(ids: Iterable<string> | null): Promise<void> {
    const need = this.missing(ids);
    if (need.length === 0) return Promise.resolve();
    this.request(ids);
    return new Promise<void>((resolve) => {
      this.waiters.push({ need: new Set(need), resolve });
    });
  }

  private pump(): void {
    if (this.running) return;
    const batch = this.nextBatch();
    if (batch.length === 0) {
      this.settleWaiters();
      this.finishIfDone();
      return;
    }
    this.running = true;
    for (const key of batch) this.inFlight.add(key);
    this.sink.load(
      batch.map((key) => ({ id: key, textureKey: artTextureKey(key), url: this.fileUrl(key) })),
      {
        onFile: (id) => this.settle(id),
        onDone: () => {
          // A file the loader never reported (a 404 the sink swallowed) still
          // counts, so a gate waiting on it cannot hang.
          for (const key of batch) this.settle(key);
          this.running = false;
          this.pump();
        },
      },
    );
  }

  private nextBatch(): string[] {
    const batch: string[] = [];
    while (batch.length < this.batchSize && this.front.length > 0) {
      const key = this.front.shift()!;
      this.frontSet.delete(key);
      if (this.loadedKeys.has(key) || this.inFlight.has(key)) continue;
      batch.push(key);
    }
    while (batch.length < this.batchSize && this.cursor < this.order.length) {
      const key = this.order[this.cursor++];
      if (this.loadedKeys.has(key) || this.inFlight.has(key) || this.frontSet.has(key)) continue;
      batch.push(key);
    }
    return batch;
  }

  private settle(id: string): void {
    if (this.loadedKeys.has(id)) return;
    this.inFlight.delete(id);
    this.loadedKeys.add(id);
    this.opts.onFile?.(id);
    this.opts.onProgress?.(this.progress());
    this.settleWaiters(id);
  }

  private settleWaiters(loadedKey?: string): void {
    if (this.waiters.length === 0) return;
    let anyDone = false;
    for (const waiter of this.waiters) {
      if (loadedKey !== undefined) waiter.need.delete(loadedKey);
      if (waiter.need.size === 0) anyDone = true;
    }
    if (!anyDone) return;
    const done = this.waiters.filter((w) => w.need.size === 0);
    this.waiters = this.waiters.filter((w) => w.need.size > 0);
    for (const waiter of done) waiter.resolve();
  }

  private finishIfDone(): void {
    if (this.finished) return;
    if (this.loadedKeys.size < this.order.length) return;
    this.finished = true;
    // A queue that completed can have no outstanding waiters left; release any
    // that asked for a key the order does not contain.
    for (const waiter of this.waiters) waiter.resolve();
    this.waiters = [];
    this.opts.onComplete?.();
  }
}

/**
 * The live queue, set by `ArtLoaderScene`. While it is null — the card-proof
 * harness, unit tests, any scene reached before the loader scene exists — the
 * API answers "everything is loaded", so every gate is transparent and
 * `ArtResolver.getArt`'s neutral-texture backstop is the only thing standing
 * between a consumer and a missing file.
 */
let live: ArtQueue | null = null;

export function setArtLoader(queue: ArtQueue | null): void {
  live = queue;
}

export function artLoader(): ArtQueue | null {
  return live;
}

export function isArtLoaded(id: string): boolean {
  return live === null ? true : live.isLoaded(id);
}

export function artProgress(): ArtProgress {
  return live === null ? { loaded: 0, total: 0 } : live.progress();
}

/** Art keys still outstanding among `ids` (`null` = every card in the set). */
export function artMissing(ids: Iterable<string> | null): string[] {
  return live === null ? [] : live.missing(ids);
}

export function requestArt(ids: Iterable<string> | null): void {
  live?.request(ids);
}

export function ensureArt(ids: Iterable<string> | null): Promise<void> {
  return live === null ? Promise.resolve() : live.ensure(ids);
}
