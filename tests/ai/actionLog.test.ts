import { describe, expect, it } from 'vitest';
import { compareLogs, jobsFor, playLogged, type GameLog } from '../../scripts/action-log';

// The identical-action-log harness is the proof that a speed change (1.9 lane
// F) or an inert new read (lane A) leaves every decision alone. Its two
// contracts: a seeded game records the same actions every time, and the
// comparer names the first action that differs.
const [job] = jobsFor([{ a: 'starter:starter-crimson@medium', b: 'starter:starter-wild@medium', seeds: 1 }], 7_001);

describe('the action-log harness', () => {
  it('records a seeded game identically on every run', () => {
    const first = playLogged(job, 'medium');
    const second = playLogged(job, 'medium');
    expect(first.actions.length).toBeGreaterThan(20);
    expect(first.winner).not.toBe('unfinished');
    expect(compareLogs([first], [second])).toEqual({ identical: first.actions.length, divergences: [], missing: 0, extra: 0 });
  });

  it('reports the first differing action with its seat, turn and both actions', () => {
    const before = playLogged(job, 'medium');
    const k = 17;
    const after: GameLog = { ...before, actions: before.actions.map((entry, i) =>
      i === k ? [entry[0], entry[1], entry[2], entry[3], { type: 'concede' }] :
        i === k + 3 ? [entry[0], entry[1], entry[2], entry[3], { type: 'passStep' }] : entry) };
    const result = compareLogs([before], [after]);
    expect(result.identical).toBe(k);
    expect(result.divergences).toHaveLength(1);
    expect(result.divergences[0]).toMatchObject({
      decision: k, seat: before.actions[k][0], turn: before.actions[k][1], kind: before.actions[k][3],
      before: before.actions[k][4], after: { type: 'concede' },
    });
  });

  it('reports a game that ends early and a game missing from the second run', () => {
    const before = playLogged(job, 'medium');
    const shorter: GameLog = { ...before, actions: before.actions.slice(0, 30) };
    const result = compareLogs([before, { ...before, index: before.index + 1 }], [shorter]);
    expect(result.divergences[0]).toMatchObject({ decision: 30, after: '(game over)' });
    expect(result.missing).toBe(1);
  });
});
