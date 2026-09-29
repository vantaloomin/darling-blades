import { ResidencyBook } from '../art/artBudget';

/**
 * The thumbnail cache's residency (1.9 lane D, S4; docs/plan-art-streaming.md
 * section 3, "CardThumbCache"): which baked thumbs are resident, how big, how
 * recently used, and which Images hold them. A thumb held by a live Image is
 * pinned and never evicted; an unheld one is evicted least recently used first
 * once the thumbs are over their budget, down to 85% of it, sparing any thumb
 * released in the last two seconds unless the thumbs are over 125% of the
 * budget (the same rule as card art, `ResidencyBook`). Evicting a thumb
 * removes its texture; `ensureCardThumb` bakes it again when it is next shown.
 *
 * Phaser-free and clock-free so the rule is tested headless:
 * `src/ui/CardThumbCache.ts` binds it to the TextureManager, to each thumb
 * Image's DESTROY and to a once-per-frame pass outside any scene's create or
 * render. Only built while card art streams through the art store: with the
 * 1.8 queue the thumbs stay unbounded, as they always were.
 */

export interface ThumbBookOptions {
  /** The thumb budget in bytes (`artStoreConfig(...).thumbBudgetBytes`). */
  budgetBytes: number;
  /** Milliseconds. */
  now: () => number;
  /** Remove the thumb's texture (and whatever the cache keeps for it). */
  remove: (key: string) => void;
  /**
   * The safety scan: of these candidate keys, the ones some live object still
   * draws although no Image holds them. They are kept, and counted as missed.
   */
  inUse?: (keys: readonly string[]) => ReadonlySet<string>;
}

export interface ThumbBookStats {
  /** Resident thumb bytes (width x height x 4). */
  residentBytes: number;
  /** The part of `residentBytes` some Image holds. */
  pinnedBytes: number;
  budget: number;
  resident: number;
  evictions: number;
  /** Eviction candidates the safety scan found still drawn. */
  missedHolds: number;
}

export class ThumbBook {
  private readonly book = new ResidencyBook();
  private readonly opts: ThumbBookOptions;
  private dirty = false;
  private evictions = 0;
  private readonly missed = new Set<string>();

  constructor(opts: ThumbBookOptions) {
    this.opts = opts;
  }

  has(key: string): boolean {
    return this.book.has(key);
  }

  /** A thumb was baked (or re-baked) at `bytes`; counts as a use. */
  baked(key: string, bytes: number): void {
    this.book.setResident(key, bytes, this.opts.now());
    this.dirty = true;
  }

  /** A draw counts as a use for the LRU order. */
  touch(key: string): void {
    this.book.touch(key, this.opts.now());
  }

  /**
   * An Image shows `key`: pin it until the returned release runs (on the
   * Image's DESTROY). The release is safe to call any number of times.
   */
  hold(key: string): () => void {
    this.book.pin(key, this.opts.now());
    this.missed.delete(key);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.book.unpin(key, this.opts.now());
      this.dirty = true;
    };
  }

  /** The thumb's texture went away without the book evicting it (a manual removal). */
  forget(key: string): void {
    this.book.drop(key);
  }

  /** True when something since the last pass could make one worth running. */
  get wantsPass(): boolean {
    return this.dirty;
  }

  /**
   * One eviction pass: remove unheld thumbs down to the low-water mark, in
   * LRU order, keeping any the safety scan finds drawn. Returns the keys
   * removed. Call it only where no scene is mid-build or mid-render.
   */
  evict(): string[] {
    this.dirty = false;
    const now = this.opts.now();
    const budget = this.opts.budgetBytes;
    if (this.book.residentBytes <= budget) return [];
    let skip: ReadonlySet<string> = new Set();
    const planned = this.book.planEviction(now, budget);
    if (planned.length > 0 && this.opts.inUse !== undefined) {
      const drawn = this.opts.inUse(this.book.candidates(now).map((candidate) => candidate.key));
      if (drawn.size > 0) {
        for (const key of drawn) this.missed.add(key);
        skip = drawn;
      }
    }
    const out = skip.size > 0 ? this.book.planEviction(now, budget, skip) : planned;
    for (const key of out) {
      this.book.drop(key);
      this.evictions++;
      this.opts.remove(key);
    }
    // A grace window may still hold back thumbs over the budget: look again
    // on a later pass.
    if (this.book.residentBytes > budget && this.book.nextGraceExpiry(now) !== null) this.dirty = true;
    return out;
  }

  /** Every resident thumb key. */
  keys(): string[] {
    return this.book.keys();
  }

  /** True while some Image holds `key`. */
  isHeld(key: string): boolean {
    return this.book.isPinned(key);
  }

  stats(): ThumbBookStats {
    return {
      residentBytes: this.book.residentBytes,
      pinnedBytes: this.book.pinnedBytes,
      budget: this.opts.budgetBytes,
      resident: this.book.count,
      evictions: this.evictions,
      missedHolds: this.missed.size,
    };
  }
}
