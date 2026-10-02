import type { ArtLease, ArtStore } from './artStore';

type PackStore = Pick<ArtStore, 'lease' | 'unsettled'>;

/**
 * A pack batch keeps its first pack at now and its later packs at soon.
 * Before a pack reveals, promote its lease without dropping a shared fetch.
 * The runway may interleave packs by rarity, so callers name the originating
 * packs of the cards they are about to flip, not a sequential pack counter.
 */
export class PackRequests {
  private readonly packs: string[][];
  private readonly leases: ArtLease[];
  private readonly promoted = new Set<number>([0]);
  private generation = 0;
  private released = false;

  constructor(private readonly store: PackStore, packs: readonly Iterable<string>[]) {
    this.packs = packs.map((ids) => [...ids]);
    this.leases = this.packs.map((ids, index) =>
      store.lease(`pack:${index}`, ids, { priority: index === 0 ? 'now' : 'soon' }),
    );
  }

  /** A settled failure is ready as in the ordinary art gate: waits never hang. */
  isReady(index: number): boolean {
    return this.store.unsettled(this.packs[index] ?? []).length === 0;
  }

  /**
   * Reveal synchronously if ready, otherwise once the requested packs settle.
   * A newer reveal (scrubbing or Skip) supersedes a waiting one. Pins remain
   * until release, including revealed cards that the runway can revisit.
   */
  reveal(indices: Iterable<number>, draw: () => void): boolean {
    if (this.released) return false;
    const generation = ++this.generation;
    const wanted = [...new Set(indices)].filter((index) => this.packs[index] !== undefined);
    for (const index of wanted) {
      // A context restore can remove a formerly ready texture. A fresh
      // lease supplies a fresh ready promise in that case as well.
      if (this.promoted.has(index) && this.isReady(index)) continue;
      const previous = this.leases[index];
      this.leases[index] = this.store.lease(`pack:${index}`, this.packs[index], { priority: 'now' });
      this.promoted.add(index);
      previous.release();
    }
    if (wanted.every((index) => this.isReady(index))) {
      draw();
      return false;
    }
    void Promise.all(wanted.map((index) => this.leases[index].ready)).then(() => {
      if (!this.released && generation === this.generation) draw();
    });
    return true;
  }

  /** Stop a pending flip when the player starts another gesture. */
  cancelReveal(): void {
    this.generation++;
  }

  /** Scene shutdown cancels every wait and lets go of the entire batch. */
  release(): void {
    if (this.released) return;
    this.released = true;
    this.cancelReveal();
    for (const lease of this.leases) lease.release();
  }
}
