import { describe, expect, it } from 'vitest';
import { compareDigests, digestOf, jobsFor, playLogged, type GameLog } from '../../scripts/action-log';
import type { GameEvent } from '../../src/engine/events';

// The event digest beside the identical-action-log comparison (1.9 lane A):
// an engine refactor can reorder events without changing a decision, which
// the action comparison cannot see. Its contracts: a seeded game digests the
// same on every run, and the comparer names a game whose event stream differs.
const [job] = jobsFor([{ a: 'starter:starter-crimson@medium', b: 'starter:starter-wild@medium', seeds: 1 }], 7_101);

const stream: GameEvent[] = [
  { e: 'damageMarked', iid: 4, amount: 2 },
  { e: 'lifeChanged', player: 1, delta: -3, now: 17 },
  { e: 'lifeChanged', player: 0, delta: 2, now: 22 },
];

describe('the action-log event digest', () => {
  it('sees two adjacent events swapped, which a count or a set of events would not', () => {
    const swapped = [stream[0], stream[2], stream[1]];
    expect(digestOf(swapped)).not.toBe(digestOf(stream));
  });

  it('sees one field of one event changed', () => {
    const changed: GameEvent[] = [stream[0], { e: 'lifeChanged', player: 1, delta: -3, now: 18 }, stream[2]];
    expect(digestOf(changed)).not.toBe(digestOf(stream));
    expect(digestOf(structuredClone(stream))).toBe(digestOf(stream));
  });

  it('digests a seeded game identically on every run', () => {
    const first = playLogged(job, 'medium');
    const second = playLogged(job, 'medium');
    expect(first.events).toBeGreaterThan(first.actions.length);
    expect(compareDigests([first], [second])).toEqual({ compared: 1, divergences: [] });
  });

  it('names a game whose event stream differs, and skips a file recorded without digests', () => {
    const before = playLogged(job, 'medium');
    const reordered: GameLog = { ...before, eventDigest: before.eventDigest!.split('').reverse().join('') };
    expect(compareDigests([before], [reordered]).divergences).toMatchObject([
      { index: before.index, seed: before.seed, eventsBefore: before.events, eventsAfter: before.events },
    ]);
    const legacy: GameLog = { ...before };
    delete legacy.eventDigest;
    expect(compareDigests([legacy], [reordered])).toEqual({ compared: 0, divergences: [] });
  });
});
