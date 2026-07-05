/**
 * Seeded PRNG (xoshiro128**). The state is a plain 4-number array stored
 * inside GameState so cloned games replay identically. All functions mutate
 * the passed state in place.
 */

export type RngState = [number, number, number, number];

/** Expand a single 32-bit seed into a full xoshiro state via splitmix32. */
export function createRngState(seed: number): RngState {
  let h = seed >>> 0;
  const next = (): number => {
    h = (h + 0x9e3779b9) >>> 0;
    let z = h;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
  const s: RngState = [next(), next(), next(), next()];
  if (s[0] === 0 && s[1] === 0 && s[2] === 0 && s[3] === 0) s[0] = 1;
  return s;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Next uint32. */
export function rngNext(s: RngState): number {
  const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
  const t = (s[1] << 9) >>> 0;
  s[2] = (s[2] ^ s[0]) >>> 0;
  s[3] = (s[3] ^ s[1]) >>> 0;
  s[1] = (s[1] ^ s[2]) >>> 0;
  s[0] = (s[0] ^ s[3]) >>> 0;
  s[2] = (s[2] ^ t) >>> 0;
  s[3] = rotl(s[3], 11);
  return result;
}

/** Uniform float in [0, 1). */
export function rngFloat(s: RngState): number {
  return rngNext(s) / 4294967296;
}

/** Uniform integer in [0, n). */
export function rngInt(s: RngState, n: number): number {
  return Math.floor(rngFloat(s) * n);
}

/** Fisher–Yates shuffle in place. Returns the same array. */
export function rngShuffle<T>(s: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(s, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
