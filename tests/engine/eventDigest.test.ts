import { describe, expect, it } from 'vitest';
import { compareDigests, jobsFor, playLogged, type GameLog } from '../../scripts/action-log';

// The event digest beside the identical-action-log comparison (1.9 lane A):
// an engine refactor can reorder events without changing a decision, which
// the action comparison cannot see. Its contracts: a seeded game digests the
// same on every run, and the comparer names a game whose event stream differs.
const [job] = jobsFor([{ a: 'starter:starter-crimson@medium', b: 'starter:starter-wild@medium', seeds: 1 }], 7_101);

describe('the action-log event digest', () => {
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
