import { describe, expect, it } from 'vitest';
import { FULL_BYTES, makeStore } from './artStoreFakes';

/**
 * A Tower rung's restart (docs/plan-art-streaming.md section 9): `DuelScene`
 * leases its set at `create` and releases it at SHUTDOWN. This is the store
 * half of the carry-over argument: a release followed by the next rung's
 * lease with no eviction pass between them keeps what the two rungs share and
 * fetches only what the next rung adds. The budget is one texture, as in the
 * `?artBudget=8` stress run.
 *
 * The scene-manager half (the old scene's stop and the new scene's start run
 * in one `SceneManager.processQueue`, before `ArtLoaderScene.update` calls the
 * store's `frame()`, its only eviction pass) is verified by reading the Phaser
 * 3.90 source (`ScenePlugin.restart`, `SceneManager.update` and
 * `processQueue`), not by a test: tests never import Phaser.
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

});
