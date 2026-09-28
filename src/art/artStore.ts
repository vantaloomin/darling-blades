import {
  ART_FAILURE_BACKOFF_MS,
  ART_GRACE_CEILING,
  ART_IMMEDIATE_RESENDS,
  ART_LOW_WATER,
  ART_RELEASE_GRACE_MS,
  ART_RETRY_DELAY_MS,
  ART_UPLOAD_UNITS_PER_FRAME,
  ART_WINDOW_WEB,
  ResidencyBook,
  textureBytes,
  type ArtQuality,
} from './artBudget';
import { artHalfTextureKey, artTextureKey } from './artLoader';

/**
 * The art store (1.9 lane D, S1): card art loads when something asks for it
 * and is unloaded when it falls out of the budget. Design:
 * docs/plan-art-streaming.md, sections 1 and 3.
 *
 * Callers take **leases** on the ids they draw; a lease pins its textures, so
 * nothing a live game object uses is evicted. Requests run at four priorities
 * inside a small in-flight window, a request nobody holds any more is dropped
 * (and its fetch aborted while the body is still on its way), and after
 * arrivals and releases an LRU pass evicts unpinned textures down to 85% of
 * the budget, sparing anything released in the last two seconds.
 *
 * Phaser-free and clock-free: the bytes come from an injected source (S2's
 * `src/art/artSource.ts`), the textures go to an injected sink (S3's Phaser
 * shell over the TextureManager), and time is an injected clock. The shell
 * calls `frame()` from the loader scene's update: uploads and eviction happen
 * only there, never inside another scene's create or render.
 */

export type ArtPriority = 'now' | 'visible' | 'soon' | 'idle';
/** `primary` is the tier the game draws (full on desktop, half on `lite`); `half` is the 320x400 file. */
export type ArtTier = 'primary' | 'half';
/** Which file of a key: the 640x800 original or the 320x400 copy. */
export type ArtFileTier = 'full' | 'half';

/**
 * Where the bytes come from. S2's `ArtSource` satisfies this shape; the store
 * reads a rejection's `reason`: `'failed'` is final for the session,
 * `'aborted'` is the store's own cancel, anything else is transient.
 */
export interface ArtSourceLike {
  read(key: string, tier: ArtFileTier, signal?: AbortSignal): Promise<Blob>;
}

/** A decoded image: `ImageBitmap` in the browser, a fake in tests. */
export interface ArtImage {
  readonly width: number;
  readonly height: number;
  close(): void;
}

/** Where textures go. S3 implements it over Phaser's TextureManager. */
export interface ArtTextureSink {
  /** True when a texture with this key is already in the manager. */
  exists(textureKey: string): boolean;
  /**
   * Upload `image` as `textureKey`. Under WebGL the shell also sets the GL
   * wrapper's `pixels` to null (see the design, "The decoded copy"). Returns
   * false when the manager refused it.
   */
  add(textureKey: string, image: ArtImage): boolean;
  remove(textureKey: string): void;
  /**
   * True under the canvas renderer, where the image itself is what gets
   * drawn: the store keeps it open and closes it on eviction. Under WebGL the
   * store closes each image right after upload.
   */
  readonly keepsSource: boolean;
  /**
   * The safety scan: of these candidate texture keys, the ones some visible
   * game object still draws. The store never removes those and counts each as
   * a missed lease.
   */
  inUse?(textureKeys: readonly string[]): ReadonlySet<string>;
}

export interface ArtLease {
  /**
   * Resolves when every id given to `lease()` is resident or has failed, or
   * when the lease is released. Never rejects, never hangs. Ids added later
   * with `add` are pinned and requested but do not hold it back.
   */
  readonly ready: Promise<void>;
  /** Widen the lease (a new binder spread). A no-op once released. */
  add(ids: Iterable<string>): void;
  /** Unpin; queued requests nobody else holds are dropped. Safe to call twice. */
  release(): void;
}

export interface ArtRequestOptions {
  priority?: ArtPriority;
  tier?: ArtTier;
}

export interface ArtStoreStats {
  /** Resident card-art texture bytes (width x height x 4). */
  residentBytes: number;
  /** The part of `residentBytes` some lease pins. */
  pinnedBytes: number;
  budget: number;
  /** Resident textures. */
  resident: number;
  /** Keys waiting for the window, including those waiting for the deferred second pass. */
  queued: number;
  /** Keys being fetched or decoded. */
  inFlight: number;
  /** Decoded images waiting for their upload frame. */
  uploadsPending: number;
  evictions: number;
  /** Keys that settled as failed (both passes, or a final failure). */
  failures: number;
  /** Arrivals dropped because the texture already existed. */
  duplicatesDropped: number;
  /** Eviction candidates the shell's safety scan found still drawn. */
  missedLeases: number;
  /** Context restores handled. */
  restores: number;
}

export interface ArtStoreOptions {
  /** Every manifest art key. Ids whose key is not listed are resident by definition. */
  manifest: readonly string[];
  /** True when a 320x400 file exists for the key. */
  hasHalf: (key: string) => boolean;
  /** Card id to art key (`artKeyFor`); art keys map to themselves. */
  keyFor: (id: string) => string;
  quality: ArtQuality;
  source: ArtSourceLike;
  sink: ArtTextureSink;
  /** Card-art budget in bytes (`artStoreConfig`). */
  budgetBytes: number;
  /** False under `?artEvict=off`. Default true. */
  evict?: boolean;
  maxInFlight?: number;
  uploadUnitsPerFrame?: number;
  /** Default `createImageBitmap`. */
  decode?: (blob: Blob) => Promise<ArtImage>;
  /** Milliseconds; default `performance.now`. */
  now?: () => number;
  /** A texture was added (the shell re-emits the old per-file event). */
  onResident?: (textureKey: string) => void;
  /** Dev warnings: pins alone over the budget, a missed lease. */
  onWarn?: (message: string) => void;
}

const PRIORITIES: readonly ArtPriority[] = ['now', 'visible', 'soon', 'idle'];
const RANK: Record<ArtPriority, number> = { now: 0, visible: 1, soon: 2, idle: 3 };
/** Within a level: `now` and `idle` first in first out, `visible` and `soon` newest first. */
const NEWEST_FIRST: Record<ArtPriority, boolean> = { now: false, visible: true, soon: true, idle: false };

interface Holder {
  priority: ArtPriority;
  /** The request call that made this hold; newer calls have larger numbers. */
  batch: number;
  /** Position inside that call, so one call's ids load in the order given. */
  index: number;
}

interface Job {
  /** Start order: a deferred retry waits for every job started before its failure. */
  seq: number;
  phase: 'fetching' | 'decoding' | 'uploading';
  controller: AbortController;
  dead: boolean;
}

interface Slot {
  key: string;
  textureKey: string;
  file: ArtFileTier;
  /** Leases and prefetches that want this slot loaded, by holder id. */
  holders: Map<number, Holder>;
  /** Leases waiting on this slot for `ready`. */
  waiters: Set<LeaseImpl>;
  /** Leases pinning this slot. */
  pinnedBy: Set<LeaseImpl>;
  job: Job | null;
  /** 1 for the first pass, 2 for the deferred second pass. */
  pass: 1 | 2;
  /**
   * Waiting for the second pass: not before `at` + 1 s, and not while any job
   * started before the failure (stamp `after` or lower) is still in flight.
   */
  deferred: { at: number; after: number } | null;
  failed: { at: number; final: boolean } | null;
  /** The open image under a sink that keeps its source. */
  kept: ArtImage | null;
}

class LeaseImpl implements ArtLease {
  readonly ready: Promise<void>;
  readonly slots = new Set<Slot>();
  readonly pending = new Set<Slot>();
  released = false;
  private resolve!: () => void;
  private settled = false;

  constructor(
    readonly id: number,
    readonly label: string,
    readonly priority: ArtPriority,
    readonly tier: ArtTier,
    private readonly store: ArtStore,
  ) {
    this.ready = new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  add(ids: Iterable<string>): void {
    if (this.released) return;
    this.store.widenLease(this, ids, false);
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    this.store.releaseLease(this);
    this.settle();
  }

  slotSettled(slot: Slot): void {
    this.pending.delete(slot);
    if (this.pending.size === 0) this.settle();
  }

  settle(): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve();
  }
}

function failureReason(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'reason' in error) {
    const reason = (error as { reason: unknown }).reason;
    return typeof reason === 'string' ? reason : undefined;
  }
  return undefined;
}

function defaultDecode(blob: Blob): Promise<ArtImage> {
  return createImageBitmap(blob);
}

function defaultNow(): number {
  return performance.now();
}

export class ArtStore {
  private readonly opts: ArtStoreOptions;
  private readonly known: Set<string>;
  private readonly slots = new Map<string, Slot>();
  private readonly book = new ResidencyBook();
  private readonly leases = new Set<LeaseImpl>();
  private readonly uploads: { slot: Slot; job: Job; image: ArtImage }[] = [];
  private readonly now: () => number;
  private readonly decode: (blob: Blob) => Promise<ArtImage>;
  private readonly maxInFlight: number;
  private readonly uploadUnits: number;
  private budget: number;
  private evict: boolean;
  private nextHolder = 1;
  private nextBatch = 1;
  /** Jobs fetching or decoding: the in-flight window. */
  private readonly active = new Set<Job>();
  private nextJob = 1;
  /** Texture keys that are settled: resident, or failed and not asked for again since. */
  private readonly settled = new Set<string>();
  private settledPrimary = 0;
  /** Keys the safety scan already reported, so one miss warns once. */
  private readonly missed = new Set<string>();
  private dirty = false;
  private recheckAt: number | null = null;
  private pinsOverBudgetWarned = false;
  private disposed = false;
  private counters = { evictions: 0, failures: 0, duplicatesDropped: 0, missedLeases: 0, restores: 0 };

  constructor(opts: ArtStoreOptions) {
    this.opts = opts;
    this.known = new Set(opts.manifest);
    this.now = opts.now ?? defaultNow;
    this.decode = opts.decode ?? defaultDecode;
    this.maxInFlight = Math.max(1, opts.maxInFlight ?? ART_WINDOW_WEB);
    this.uploadUnits = Math.max(2, opts.uploadUnitsPerFrame ?? ART_UPLOAD_UNITS_PER_FRAME);
    this.budget = opts.budgetBytes;
    this.evict = opts.evict ?? true;
  }

  // ---------------------------------------------------------------- the API

  /**
   * Pin `ids` for as long as the lease lives, and load what is missing.
   * `ready` covers these ids only: `add()` pins and requests more but never
   * extends it.
   */
  lease(label: string, ids: Iterable<string>, options: ArtRequestOptions = {}): ArtLease {
    const lease = new LeaseImpl(
      this.nextHolder++,
      label,
      options.priority ?? 'visible',
      options.tier ?? 'primary',
      this,
    );
    if (this.disposed) {
      lease.release();
      return lease;
    }
    this.leases.add(lease);
    this.widenLease(lease, ids, true);
    if (lease.pending.size === 0) lease.settle();
    return lease;
  }

  /** Load `ids` without pinning them. Returns a cancel, safe to call at any time. */
  prefetch(ids: Iterable<string>, options: ArtRequestOptions = {}): () => void {
    if (this.disposed) return () => {};
    const holder = this.nextHolder++;
    const priority = options.priority ?? 'idle';
    const batch = this.nextBatch++;
    const held: Slot[] = [];
    const now = this.now();
    let index = 0;
    for (const slot of this.slotsFor(ids, options.tier ?? 'primary')) {
      if (this.book.has(slot.textureKey)) {
        this.book.touch(slot.textureKey, now);
        continue;
      }
      if (this.isSettledFailure(slot, now)) continue;
      slot.holders.set(holder, { priority, batch, index: index++ });
      held.push(slot);
    }
    this.pump();
    let cancelled = false;
    return () => {
      if (cancelled) return;
      cancelled = true;
      for (const slot of held) this.dropHolder(slot, holder);
      this.pump();
    };
  }

  /** True when the id's texture for `tier` can be drawn now. */
  isResident(id: string, tier: ArtTier = 'primary'): boolean {
    const slot = this.slotFor(id, tier);
    return slot === null || this.book.has(slot.textureKey);
  }

  /** The texture key `id` draws from on `tier`, or null when it has no art file. */
  textureKeyFor(id: string, tier: ArtTier = 'primary'): string | null {
    return this.slotFor(id, tier)?.textureKey ?? null;
  }

  /** A draw counts as a use for the LRU order. */
  touch(ids: Iterable<string>, tier: ArtTier = 'primary'): void {
    const now = this.now();
    for (const slot of this.slotsFor(ids, tier)) this.book.touch(slot.textureKey, now);
  }

  /** Art keys among `ids` whose `tier` texture is not resident (`null` = the whole manifest). */
  missing(ids: Iterable<string> | null, tier: ArtTier = 'primary'): string[] {
    const source = ids ?? this.opts.manifest;
    return this.slotsFor(source, tier)
      .filter((slot) => !this.book.has(slot.textureKey))
      .map((slot) => slot.key);
  }

  /**
   * True when nothing more will come for the id on `tier` unless it is asked
   * for again: resident, no art file, or failed (and not asked for since).
   * The old API's "loaded" meant this, so a gate never waits on a file the
   * loader gave up on. `isResident` is the drawability answer.
   */
  isSettled(id: string, tier: ArtTier = 'primary'): boolean {
    const slot = this.slotFor(id, tier);
    return slot === null || this.settled.has(slot.textureKey);
  }

  /** Art keys among `ids` that are not settled on `tier` (`null` = the whole manifest). */
  unsettled(ids: Iterable<string> | null, tier: ArtTier = 'primary'): string[] {
    const source = ids ?? this.opts.manifest;
    return this.slotsFor(source, tier)
      .filter((slot) => !this.settled.has(slot.textureKey))
      .map((slot) => slot.key);
  }

  /** Settled primary keys against the manifest (the old loading-line numbers). */
  progress(): { loaded: number; total: number } {
    return { loaded: this.settledPrimary, total: this.opts.manifest.length };
  }

  /** Forward a dev warning (the old-API wrappers use it). */
  warn(message: string): void {
    this.opts.onWarn?.(message);
  }

  /**
   * One file's bytes through the same source (the save-card export decodes
   * its own copy, since nothing reads pixels back from a texture). Null when
   * the id has no art file or the read failed.
   */
  async fetchBlob(id: string, tier: ArtTier = 'primary'): Promise<Blob | null> {
    const slot = this.slotFor(id, tier);
    if (slot === null) return null;
    try {
      return await this.readWithResends(slot, new AbortController().signal);
    } catch {
      return null;
    }
  }

  stats(): ArtStoreStats {
    let queued = 0;
    for (const slot of this.slots.values()) if (slot.job === null && slot.holders.size > 0) queued++;
    return {
      residentBytes: this.book.residentBytes,
      pinnedBytes: this.book.pinnedBytes,
      budget: this.budget,
      resident: this.book.count,
      queued,
      inFlight: this.active.size,
      uploadsPending: this.uploads.length,
      ...this.counters,
    };
  }

  /** Each live lease's label and how many textures it pins (the stress run's diagnostics). */
  leaseReport(): { label: string; keys: number; resident: number }[] {
    return [...this.leases].map((lease) => ({
      label: lease.label,
      keys: lease.slots.size,
      resident: [...lease.slots].filter((slot) => this.book.has(slot.textureKey)).length,
    }));
  }

  /**
   * The shell calls this once per frame from the loader scene's update:
   * start what the window allows, upload at most the per-frame cap of decoded
   * images, then run at most one eviction pass.
   */
  frame(): void {
    if (this.disposed) return;
    this.pump();
    this.uploadSome();
    this.maybeEvict();
  }

  /**
   * The WebGL context was restored (`Phaser.Renderer.Events.RESTORE_WEBGL`):
   * every art texture came back blank, so all of them are removed, and the
   * pinned set is asked for again at `now`. Holders of a removed texture are
   * put back on the stand-in by the shell's removal belt.
   */
  contextRestored(): void {
    if (this.disposed) return;
    this.counters.restores++;
    for (const textureKey of this.book.keys()) this.removeResident(textureKey);
    const batch = this.nextBatch++;
    let index = 0;
    for (const slot of this.slots.values()) {
      if (slot.pinnedBy.size === 0 || slot.failed?.final) continue;
      if (slot.failed !== null) {
        slot.failed = null;
        this.markSettled(slot.textureKey, false);
      }
      for (const lease of slot.pinnedBy) {
        slot.holders.set(lease.id, { priority: 'now', batch, index: index++ });
      }
      if (slot.deferred !== null) {
        slot.deferred = null;
        slot.pass = 1;
      }
    }
    this.pump();
  }

  /**
   * A texture was removed by someone other than the store (the manager's
   * REMOVE event, forwarded by the shell). The books follow, and a pinned key
   * is asked for again at its leases' priority. The store's own removals come
   * back through here too and are ignored.
   */
  textureRemoved(textureKey: string): void {
    if (this.disposed || !this.book.has(textureKey)) return;
    this.removeResident(textureKey, false);
    const slot = this.slots.get(textureKey);
    if (slot !== undefined && slot.pinnedBy.size > 0 && slot.job === null) {
      const batch = this.nextBatch++;
      for (const lease of slot.pinnedBy) {
        slot.holders.set(lease.id, { priority: lease.priority, batch, index: 0 });
      }
      this.pump();
    }
  }

  /** Stop everything: abort fetches, close images, settle every lease. Textures are left to the manager. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const slot of this.slots.values()) {
      if (slot.job !== null) {
        slot.job.dead = true;
        slot.job.controller.abort();
        slot.job = null;
      }
      slot.kept?.close();
      slot.kept = null;
      slot.holders.clear();
    }
    for (const upload of this.uploads) upload.image.close();
    this.uploads.length = 0;
    for (const lease of this.leases) lease.settle();
    this.leases.clear();
    this.active.clear();
  }

  // ------------------------------------------------------- leases (internal)

  /** @internal Called by a lease. */
  widenLease(lease: LeaseImpl, ids: Iterable<string>, initial: boolean): void {
    const batch = this.nextBatch++;
    const now = this.now();
    let index = 0;
    for (const slot of this.slotsFor(ids, lease.tier)) {
      if (lease.slots.has(slot)) continue;
      lease.slots.add(slot);
      slot.pinnedBy.add(lease);
      this.book.pin(slot.textureKey, now);
      this.missed.delete(slot.textureKey);
      if (this.book.has(slot.textureKey)) continue;
      if (this.isSettledFailure(slot, now)) continue;
      slot.holders.set(lease.id, { priority: lease.priority, batch, index: index++ });
      if (initial) {
        lease.pending.add(slot);
        slot.waiters.add(lease);
      }
    }
    this.checkPinsOverBudget();
    this.pump();
  }

  /** @internal Called by a lease. */
  releaseLease(lease: LeaseImpl): void {
    this.leases.delete(lease);
    const now = this.now();
    for (const slot of lease.slots) {
      slot.pinnedBy.delete(lease);
      slot.waiters.delete(lease);
      this.book.unpin(slot.textureKey, now);
      this.dropHolder(slot, lease.id);
    }
    lease.pending.clear();
    this.dirty = true;
    this.checkPinsOverBudget();
    this.pump();
  }

  // ------------------------------------------------------ slots and requests

  private slotFor(id: string, tier: ArtTier): Slot | null {
    const key = this.opts.keyFor(id);
    if (!this.known.has(key)) return null;
    const half = this.opts.hasHalf(key);
    let textureKey: string;
    let file: ArtFileTier;
    if (this.opts.quality === 'lite') {
      // The primary tier IS the half file on lite, so both tiers share one texture.
      textureKey = artTextureKey(key);
      file = half ? 'half' : 'full';
    } else if (tier === 'half' && half) {
      textureKey = artHalfTextureKey(key);
      file = 'half';
    } else {
      // Desktop primary, or a half request for a key with no half file: the full texture.
      textureKey = artTextureKey(key);
      file = 'full';
    }
    let slot = this.slots.get(textureKey);
    if (slot === undefined) {
      slot = {
        key,
        textureKey,
        file,
        holders: new Map(),
        waiters: new Set(),
        pinnedBy: new Set(),
        job: null,
        pass: 1,
        deferred: null,
        failed: null,
        kept: null,
      };
      this.slots.set(textureKey, slot);
    }
    return slot;
  }

  /** Distinct slots for `ids`, in the order given. */
  private slotsFor(ids: Iterable<string>, tier: ArtTier): Slot[] {
    const seen = new Set<Slot>();
    const out: Slot[] = [];
    for (const id of ids) {
      const slot = this.slotFor(id, tier);
      if (slot === null || seen.has(slot)) continue;
      seen.add(slot);
      out.push(slot);
    }
    return out;
  }

  /**
   * A key that failed recently answers "settled" without a new request. After
   * the backoff (and never for a final failure) a new request starts afresh.
   */
  private isSettledFailure(slot: Slot, now: number): boolean {
    if (slot.failed === null) return false;
    if (!slot.failed.final && now - slot.failed.at >= ART_FAILURE_BACKOFF_MS) {
      slot.failed = null;
      slot.pass = 1;
      this.markSettled(slot.textureKey, this.book.has(slot.textureKey));
      return false;
    }
    return true;
  }

  private dropHolder(slot: Slot, holder: number): void {
    if (!slot.holders.delete(holder) || slot.holders.size > 0) return;
    // Nobody wants it any more: drop the queued request, abort a fetch whose
    // body has not arrived. A body already decoding lands unpinned.
    slot.deferred = null;
    slot.pass = 1;
    const job = slot.job;
    if (job !== null && job.phase === 'fetching') {
      job.dead = true;
      job.controller.abort();
      slot.job = null;
      this.active.delete(job);
    }
  }

  /** The start stamp of the oldest job in flight, or Infinity with the window empty. */
  private oldestActiveJob(): number {
    let oldest = Infinity;
    for (const job of this.active) if (job.seq < oldest) oldest = job.seq;
    return oldest;
  }

  /**
   * The best queued slot, or null. A deferred slot is eligible once a second
   * has passed since its failure and every job that was already in flight
   * then has finished (#432: a burst of failures is not re-sent into the same
   * burst), however busy the window has stayed since.
   */
  private pick(now: number, oldestActive: number): Slot | null {
    let best: Slot | null = null;
    let bestRank = Infinity;
    let bestBatch = 0;
    let bestIndex = 0;
    for (const slot of this.slots.values()) {
      if (slot.job !== null || slot.holders.size === 0) continue;
      if (slot.deferred !== null) {
        if (oldestActive <= slot.deferred.after || now - slot.deferred.at < ART_RETRY_DELAY_MS) continue;
      }
      let rank = Infinity;
      for (const holder of slot.holders.values()) rank = Math.min(rank, RANK[holder.priority]);
      const newest = NEWEST_FIRST[PRIORITIES[rank]];
      let batch = newest ? -Infinity : Infinity;
      let index = Infinity;
      for (const holder of slot.holders.values()) {
        if (RANK[holder.priority] !== rank) continue;
        if (newest ? holder.batch > batch : holder.batch < batch) {
          batch = holder.batch;
          index = holder.index;
        } else if (holder.batch === batch && holder.index < index) {
          index = holder.index;
        }
      }
      const better =
        best === null ||
        rank < bestRank ||
        (rank === bestRank &&
          (batch !== bestBatch ? (newest ? batch > bestBatch : batch < bestBatch) : index < bestIndex));
      if (better) {
        best = slot;
        bestRank = rank;
        bestBatch = batch;
        bestIndex = index;
      }
    }
    return best;
  }

  /** Fill the in-flight window. */
  private pump(): void {
    if (this.disposed) return;
    const now = this.now();
    while (this.active.size < this.maxInFlight) {
      const slot = this.pick(now, this.oldestActiveJob());
      if (slot === null) return;
      if (slot.deferred !== null) {
        slot.deferred = null;
        slot.pass = 2;
      }
      void this.run(slot);
    }
  }

  private async run(slot: Slot): Promise<void> {
    const job: Job = { seq: this.nextJob++, phase: 'fetching', controller: new AbortController(), dead: false };
    slot.job = job;
    this.active.add(job);
    let blob: Blob;
    try {
      blob = await this.readWithResends(slot, job.controller.signal);
    } catch (error) {
      if (job.dead) return;
      this.finishJob(slot, job);
      this.failed(slot, failureReason(error) === 'failed');
      return;
    }
    if (job.dead) return; // cancelled while the source ignored the signal
    job.phase = 'decoding';
    let image: ArtImage;
    try {
      image = await this.decode(blob);
    } catch {
      if (job.dead) return;
      this.finishJob(slot, job);
      this.failed(slot, false);
      return;
    }
    if (job.dead) {
      image.close();
      return;
    }
    this.active.delete(job);
    job.phase = 'uploading';
    this.uploads.push({ slot, job, image });
    this.pump();
  }

  private finishJob(slot: Slot, job: Job): void {
    if (slot.job === job) slot.job = null;
    this.active.delete(job);
  }

  /** One read, re-sent at once up to twice while the failure is transient. */
  private async readWithResends(slot: Slot, signal: AbortSignal): Promise<Blob> {
    let lastError: unknown;
    for (let send = 0; send <= ART_IMMEDIATE_RESENDS; send++) {
      if (signal.aborted) throw lastError ?? new Error('aborted');
      try {
        return await this.opts.source.read(slot.key, slot.file, signal);
      } catch (error) {
        lastError = error;
        const reason = failureReason(error);
        if (reason === 'failed' || reason === 'aborted' || signal.aborted) throw error;
      }
    }
    throw lastError;
  }

  /** A pass failed: defer to the second pass, or settle the key as failed. */
  private failed(slot: Slot, final: boolean): void {
    const now = this.now();
    if (!final && slot.holders.size === 0) {
      // Nobody wants it any more: forget the attempt rather than record a failure.
      slot.pass = 1;
      slot.deferred = null;
      this.pump();
      return;
    }
    if (!final && slot.pass === 1) {
      // Every job started so far (this one included) must finish first.
      slot.deferred = { at: now, after: this.nextJob - 1 };
      this.pump();
      return;
    }
    slot.failed = { at: now, final };
    this.markSettled(slot.textureKey, true);
    slot.pass = 1;
    slot.deferred = null;
    slot.holders.clear();
    this.counters.failures++;
    this.settleWaiters(slot);
    this.pump();
  }

  private settleWaiters(slot: Slot): void {
    const waiters = [...slot.waiters];
    slot.waiters.clear();
    for (const lease of waiters) lease.slotSettled(slot);
  }

  // ---------------------------------------------------- uploads and eviction

  private uploadSome(): void {
    let units = this.uploadUnits;
    while (this.uploads.length > 0) {
      const next = this.uploads[0];
      const cost = next.slot.file === 'full' ? 2 : 1;
      if (cost > units) break;
      this.uploads.shift();
      units -= cost;
      this.upload(next.slot, next.job, next.image);
    }
  }

  /**
   * Hand a decoded image to the sink and settle its slot. The slot keeps its
   * job until the books are done: the sink's add (Phaser's ADD event) and
   * `onResident` can run code that takes or releases a lease on this very key
   * (a view redrawn by the arrival holds it again), and a pump reached from
   * there must not find an idle slot with holders and fetch it a second time.
   * `onResident` goes out last, once the key is resident, settled and unqueued.
   */
  private upload(slot: Slot, job: Job, image: ArtImage): void {
    const now = this.now();
    const bytes = textureBytes(image.width, image.height);
    const sink = this.opts.sink;
    let added = false;
    if (sink.exists(slot.textureKey)) {
      // An arrival that raced another request for the same key: the texture
      // is there already. Adding would be refused with a null texture, so
      // drop this copy and keep the books in step with the manager.
      image.close();
      this.counters.duplicatesDropped++;
      if (!this.book.has(slot.textureKey)) this.book.setResident(slot.textureKey, bytes, now);
    } else if (sink.add(slot.textureKey, image)) {
      slot.kept?.close();
      slot.kept = null;
      if (sink.keepsSource) slot.kept = image;
      else image.close();
      this.book.setResident(slot.textureKey, bytes, now);
      added = true;
    } else {
      // The manager refused it: deterministic, so no retry this session.
      image.close();
      if (slot.job === job) slot.job = null;
      this.failed(slot, true);
      return;
    }
    this.markSettled(slot.textureKey, true);
    slot.holders.clear();
    slot.failed = null;
    slot.pass = 1;
    this.dirty = true;
    if (slot.job === job) slot.job = null;
    this.settleWaiters(slot);
    this.checkPinsOverBudget();
    if (added) this.opts.onResident?.(slot.textureKey);
  }

  private maybeEvict(): void {
    if (!this.evict) return;
    const now = this.now();
    const due = this.dirty || (this.recheckAt !== null && now >= this.recheckAt);
    if (!due) return;
    this.dirty = false;
    this.recheckAt = null;
    if (this.book.residentBytes <= this.budget) return;
    const candidates = this.book.candidates(now).map((candidate) => candidate.key);
    const inUse = this.opts.sink.inUse?.(candidates) ?? new Set<string>();
    for (const key of inUse) {
      if (this.missed.has(key)) continue;
      this.missed.add(key);
      this.counters.missedLeases++;
      this.opts.onWarn?.(`artStore: ${key} is drawn with no lease; kept`);
    }
    const plan = this.book.planEviction(now, this.budget, inUse, {
      lowWater: ART_LOW_WATER,
      graceMs: ART_RELEASE_GRACE_MS,
      graceCeiling: ART_GRACE_CEILING,
    });
    for (const textureKey of plan) {
      // A removal re-runs the removal belt, which can lease a key later in
      // this plan (a view falling back from the full texture to the half one).
      // Re-check each key at the moment it would go.
      if (this.book.isPinned(textureKey) || !this.book.has(textureKey)) continue;
      this.removeResident(textureKey);
      this.counters.evictions++;
    }
    if (this.book.residentBytes > this.budget) this.recheckAt = this.book.nextGraceExpiry(now);
  }

  /** Forget a resident texture and (by default) remove it from the manager. */
  private removeResident(textureKey: string, removeFromSink = true): void {
    this.book.drop(textureKey);
    this.missed.delete(textureKey);
    this.markSettled(textureKey, this.slots.get(textureKey)?.failed != null);
    if (removeFromSink) this.opts.sink.remove(textureKey);
    const slot = this.slots.get(textureKey);
    if (slot?.kept) {
      slot.kept.close();
      slot.kept = null;
    }
  }

  private markSettled(textureKey: string, on: boolean): void {
    if (on === this.settled.has(textureKey)) return;
    const primary = textureKey.startsWith('artfile-') ? 1 : 0;
    if (on) {
      this.settled.add(textureKey);
      this.settledPrimary += primary;
    } else {
      this.settled.delete(textureKey);
      this.settledPrimary -= primary;
    }
  }

  private checkPinsOverBudget(): void {
    const over = this.book.pinnedBytes > this.budget;
    if (over && !this.pinsOverBudgetWarned) {
      this.opts.onWarn?.(
        `artStore: pinned art (${this.book.pinnedBytes} bytes) is over the budget (${this.budget}); pins win`,
      );
    }
    this.pinsOverBudgetWarned = over;
  }
}
