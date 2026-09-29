import { describe, expect, it } from 'vitest';
import { FULL_BYTES, makeStore } from './artStoreFakes';

/**
 * A Tower rung's restart (docs/plan-art-streaming.md section 9): `DuelScene`
 * leases its set at `create` and releases it at SHUTDOWN, and
 * `scene.restart` runs the old scene's shutdown and the new scene's create in
 * one scene-manager step, before the loader scene's update calls `frame()`,
 * the store's only eviction pass. So the store sees a release and the next
 * rung's lease with no pass between them. The budget here is one texture, as
 * in the `?artBudget=8` stress run: three textures resident is 300% of it,
 * over the 125% ceiling, where the release grace holds released art only down
 * to the budget. So what keeps the shared art is the order alone.
 */

const T = (key: string): string => `artfile-${key}`;

describe('art store: a Tower rung restart', () => {
  it('keeps the art two rungs share and fetches only what the next rung adds', async () => {
    const h = makeStore({ budgetBytes: FULL_BYTES });
    h.source.auto = true;
    const rung1 = h.store.lease('scene:Duel', ['a', 'b', 'c'], { priority: 'now' });
    await h.tick();
    await rung1.ready;
    const readsBefore = h.source.reads.length;

    // One scene-manager step: the old duel shuts down, the next one is created.
    rung1.release();
    const rung2 = h.store.lease('scene:Duel', ['b', 'c', 'd'], { priority: 'now' });
    await h.tick();
    await rung2.ready;
    for (let i = 0; i < 3; i++) {
      h.clock.t += 5000;
      await h.tick();
    }

    expect(h.source.keys.slice(readsBefore)).toEqual(['d']);
    expect(h.sink.removed).toEqual([T('a')]);
    expect(['b', 'c', 'd'].every((id) => h.store.isResident(id))).toBe(true);
  });

  it('with an eviction pass between the release and the next lease, the shared art would be dropped and fetched again', async () => {
    const h = makeStore({ budgetBytes: FULL_BYTES });
    h.source.auto = true;
    const rung1 = h.store.lease('scene:Duel', ['a', 'b', 'c'], { priority: 'now' });
    await h.tick();
    await rung1.ready;
    const readsBefore = h.source.reads.length;

    rung1.release();
    await h.tick();
    const rung2 = h.store.lease('scene:Duel', ['b', 'c', 'd'], { priority: 'now' });
    await h.tick();
    await rung2.ready;

    expect(h.source.keys.slice(readsBefore)).toContain('b');
  });
});
