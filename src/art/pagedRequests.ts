import type { ArtLease, ArtStore, ArtTier } from './artStore';

/**
 * The art requests of one paged surface (1.9 lane D, S5a;
 * docs/plan-art-streaming.md section 2): a binder, a pool grid, a picker.
 * Phaser-free, so the rule is tested headless against a real `ArtStore`;
 * `PagedArt` in `src/ui/artGate.ts` binds it to a scene's lifetime and the
 * browser's timer.
 *
 * Each `show` names what the page on screen still needs (for thumbnails,
 * `thumbArtWanted`: a page baked on an earlier visit asks for nothing) and
 * what a turn would need next. When any of the page is missing it leases all
 * of it at `visible`, so the resident part is not evicted while the rest
 * loads; it prefetches the next pages at `soon` without a pin; and it lets go
 * of the previous page's requests, after taking the new ones, so art both
 * pages share is never unheld in between.
 *
 * The page lease lasts until its art is in and the page has drawn, then it is
 * released: a thumb is a snapshot, so a baked page pins no sources ("sources
 * are not pinned once baked", section 2). A page that drew over stand-ins
 * keeps its lease until the art is in; each thumb re-bakes in place as its
 * art lands (the thumbnail cache's own request), before the lease lets go.
 */

/** What the core needs of the store. */
export type PagedStore = Pick<ArtStore, 'lease' | 'prefetch' | 'missing'>;

export interface PagedRequestsHost {
  /** The live store, or null while art streams through the 1.8 queue. */
  store(): PagedStore | null;
  /** Run `fn` after `ms` milliseconds; returns a cancel. */
  schedule(fn: () => void, ms: number): () => void;
}

const NO_CANCEL = (): void => {};

export class PagedRequests {
  private lease: ArtLease | null = null;
  private cancelSoon: () => void = NO_CANCEL;
  private cancelHold: () => void = NO_CANCEL;
  /** Bumped by every `show` and by `release`: a held draw from an older page never runs. */
  private generation = 0;
  private released = false;

  constructor(
    private readonly label: string,
    private readonly tier: ArtTier,
    private readonly host: PagedRequestsHost,
  ) {}

  /** The page lease still held (the probe and the tests read it). */
  get holding(): boolean {
    return this.lease !== null;
  }

  /**
   * Ask for a new page and, when `draw` is given, draw it. The draw runs at
   * once when nothing in `shown` is missing, with no store, or when `holdMs`
   * is 0 (over stand-ins, which fill in); otherwise when the art is in or
   * after `holdMs`, whichever comes first, unless a newer `show` or `release`
   * overtook it. It runs at most once, and is told whether it waited. Returns
   * true when the draw is being held. After `release` nothing is asked for
   * and nothing is drawn.
   */
  show(
    shown: Iterable<string>,
    soon: Iterable<string> = [],
    draw?: (afterHold: boolean) => void,
    holdMs = 0,
  ): boolean {
    if (this.released) return false;
    const generation = ++this.generation;
    this.cancelHold();
    this.cancelHold = NO_CANCEL;
    const previousLease = this.lease;
    const previousSoon = this.cancelSoon;
    this.lease = null;
    this.cancelSoon = NO_CANCEL;
    const store = this.host.store();
    let lease: ArtLease | null = null;
    if (store !== null) {
      const ids = [...shown];
      if (store.missing(ids, this.tier).length > 0) {
        lease = store.lease(`page:${this.label}`, ids, { priority: 'visible', tier: this.tier });
        this.lease = lease;
      }
      this.cancelSoon = store.prefetch(soon, { priority: 'soon', tier: this.tier });
    }
    previousLease?.release();
    previousSoon();

    let drawn = draw === undefined;
    let ready = lease === null;
    const current = (): boolean => generation === this.generation && !this.released;
    // Once the art is in and the page has drawn, the sources need no pin.
    const letGo = (): void => {
      if (!drawn || !ready || lease === null || this.lease !== lease) return;
      this.lease = null;
      lease.release();
    };
    const run = (afterHold: boolean): void => {
      if (drawn) return;
      drawn = true;
      this.cancelHold();
      this.cancelHold = NO_CANCEL;
      draw?.(afterHold);
      letGo();
    };

    if (lease === null || holdMs <= 0) run(false);
    else this.cancelHold = this.host.schedule(() => {
      if (current()) run(true);
    }, holdMs);
    if (lease !== null) {
      void lease.ready.then(() => {
        if (!current()) return;
        ready = true;
        run(true);
        letGo();
      });
    }
    return !drawn;
  }

  /** End every request and any held draw. Safe to call twice. */
  release(): void {
    if (this.released) return;
    this.released = true;
    this.generation++;
    this.cancelHold();
    this.cancelHold = NO_CANCEL;
    this.lease?.release();
    this.lease = null;
    this.cancelSoon();
    this.cancelSoon = NO_CANCEL;
  }
}
