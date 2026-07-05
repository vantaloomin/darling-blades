import { describe, expect, it } from 'vitest';
import { createRngState, rngInt, rngNext, rngShuffle } from '../../src/engine/rng';

describe('seeded rng', () => {
  it('same seed produces the identical sequence', () => {
    const a = createRngState(12345);
    const b = createRngState(12345);
    for (let i = 0; i < 1000; i++) {
      expect(rngNext(a)).toBe(rngNext(b));
    }
  });

  it('different seeds diverge', () => {
    const a = createRngState(1);
    const b = createRngState(2);
    const seqA = Array.from({ length: 10 }, () => rngNext(a));
    const seqB = Array.from({ length: 10 }, () => rngNext(b));
    expect(seqA).not.toEqual(seqB);
  });

  it('survives structuredClone (plain state, replays identically)', () => {
    const a = createRngState(777);
    rngNext(a); // advance
    const b = structuredClone(a);
    for (let i = 0; i < 100; i++) {
      expect(rngNext(a)).toBe(rngNext(b));
    }
  });

  it('shuffle is deterministic per seed and is a permutation', () => {
    const deck = Array.from({ length: 60 }, (_, i) => i);
    const a = rngShuffle(createRngState(42), [...deck]);
    const b = rngShuffle(createRngState(42), [...deck]);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(deck);
    expect(a).not.toEqual(deck); // 60! odds say never
  });

  it('rngInt stays in range', () => {
    const s = createRngState(9);
    for (let i = 0; i < 1000; i++) {
      const v = rngInt(s, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });
});
