/**
 * Who is waiting for which card-art texture (1.8.1).
 *
 * Card art streams in behind the running scenes (`src/art/artLoader.ts`), and
 * `ArtResolver.getArt` hands a neutral stand-in to anything drawn before its
 * file lands. Without a way back, that stand-in was permanent: a CardView, a
 * board tile or a baked thumbnail kept it for the rest of the session. This
 * book is the way back. A view that drew the stand-in registers here under the
 * texture key it wanted; when that texture is added, every waiter for it runs
 * once and is forgotten.
 *
 * Phaser-free so the rule is tested headless. `src/art/artWatch.ts` binds it
 * to the TextureManager's add event and to the lifetimes of the views and
 * scenes that wait.
 */

export type ArtArrivalCallback = () => void;

export class ArtArrivals {
  private readonly waiting = new Map<string, Set<ArtArrivalCallback>>();

  /**
   * Run `onArrive` once, the next time `textureKey` arrives. Returns a cancel
   * that is safe to call at any time, any number of times, including after
   * the callback has run. Registering the same function twice makes two
   * independent waits.
   */
  watch(textureKey: string, onArrive: ArtArrivalCallback): () => void {
    let waiters = this.waiting.get(textureKey);
    if (waiters === undefined) {
      waiters = new Set();
      this.waiting.set(textureKey, waiters);
    }
    // A fresh wrapper per wait: cancelling one wait never cancels another,
    // even for the same function.
    const entry: ArtArrivalCallback = () => onArrive();
    waiters.add(entry);
    return () => {
      const current = this.waiting.get(textureKey);
      if (current === undefined) return;
      current.delete(entry);
      if (current.size === 0) this.waiting.delete(textureKey);
    };
  }

  /**
   * `textureKey` is now in the texture manager: run every wait on it, once.
   * The waits are forgotten before any of them runs, so a callback that
   * registers a new wait for the same key is kept for the next arrival rather
   * than run in this one. A callback that throws is reported and skipped: this
   * runs inside the loader's own file handling, where an escaping error would
   * stall the art queue for the rest of the session.
   */
  arrived(textureKey: string): void {
    const waiters = this.waiting.get(textureKey);
    if (waiters === undefined) return;
    this.waiting.delete(textureKey);
    for (const entry of waiters) {
      try {
        entry();
      } catch (error) {
        console.error(`ArtArrivals: a redraw for ${textureKey} failed`, error);
      }
    }
  }

  /** How many waits are outstanding, across every key. */
  get size(): number {
    let total = 0;
    for (const waiters of this.waiting.values()) total += waiters.size;
    return total;
  }
}
