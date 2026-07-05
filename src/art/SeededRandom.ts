/**
 * Art-side deterministic RNG: FNV-1a hash of the card id seeds a mulberry32
 * stream. Every visual decision for a card's placeholder draws from this, so
 * a given card looks identical every session and on every machine.
 */
export class SeededRandom {
  private s: number;

  constructor(key: string) {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    this.s = h >>> 0;
  }

  /** float in [0,1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let z = this.s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}
