import { describe, expect, it } from 'vitest';
import type { ArtLease } from '../../src/art/artStore';
import { FakeSink, FULL_BYTES, HALF_BYTES, flush, loadAll, makeStore, type Harness } from './artStoreFakes';

/**
 * The art store (docs/plan-art-streaming.md, sections 1 and 3): leases pin,
 * requests run by priority inside a window and can be cancelled, eviction is
 * least recently used down to the low-water mark with a release grace, and a
 * context restore asks for the pinned set again. The source, the texture sink
 * and the clock are fakes the test drives (tests/art/artStoreFakes.ts).
 */

const T = (key: string): string => `artfile-${key}`;

describe('artStore: pinning', () => {
  it('never evicts a pinned texture, even with pins alone over the budget', async () => {
    const h = makeStore({ budgetBytes: FULL_BYTES });
    h.source.auto = true;
    const lease = h.store.lease('duel', ['a', 'b', 'c'], { priority: 'now' });
    for (let i = 0; i < 3; i++) await h.tick();
    await lease.ready;

    for (let i = 0; i < 5; i++) {
      h.clock.t += 5000;
      await h.tick();
    }
    expect(h.sink.removed).toEqual([]);
    expect(['a', 'b', 'c'].every((id) => h.store.isResident(id))).toBe(true);
    expect(h.store.stats().pinnedBytes).toBe(3 * FULL_BYTES);
    expect(h.warnings.some((w) => w.includes('over the budget'))).toBe(true);

    // Released and out of the grace window, the same textures do go.
    lease.release();
    h.clock.t += 5000;
    await h.tick();
    expect(h.sink.removed.length).toBeGreaterThan(0);
  });

  it('keeps a texture drawn by an object the safety scan finds, and counts that missed lease once', async () => {
    const h = makeStore({ budgetBytes: FULL_BYTES });
    // Something draws a with no lease; a is also the least recently used.
    h.sink.drawn.add(T('a'));
    await loadAll(h, ['a', 'b', 'c']);
    h.clock.t += 5000;
    await h.tick();
    // More passes over the same unleased key.
    h.clock.t += 10;
    await loadAll(h, ['d']);
    h.clock.t += 10;
    await loadAll(h, ['e']);

    expect(h.sink.removed.length).toBeGreaterThan(0);
    expect(h.sink.removed).not.toContain(T('a'));
    expect(h.store.isResident('a')).toBe(true);
    expect(h.store.stats().missedLeases).toBe(1);
    expect(h.warnings.filter((w) => w.includes('no lease'))).toHaveLength(1);
  });

  it('does not evict a key the removal belt leases while an eviction pass is under way', async () => {
    // Budget one texture: a pass over three unpinned keys plans all three.
    const h = makeStore({ budgetBytes: FULL_BYTES });
    const remove = h.sink.remove.bind(h.sink);
    let belt: ReturnType<typeof h.store.lease> | null = null;
    h.sink.remove = (textureKey: string) => {
      remove(textureKey);
      // A view drawing a falls back to c and holds it, inside the removal.
      if (textureKey === T('a')) belt = h.store.lease('belt', ['c']);
    };
    await loadAll(h, ['a', 'b', 'c']);

    expect(belt).not.toBeNull();
    expect(h.sink.removed).toEqual([T('a'), T('b')]);
    expect(h.store.isResident('c')).toBe(true);
    expect(h.sink.textures.has(T('c'))).toBe(true);
    expect(h.store.stats().pinnedBytes).toBe(FULL_BYTES);
  });
});

describe('artStore: eviction', () => {
  it('evicts least recently used first, down to 85% of the budget', async () => {
    // Budget: three full textures. Four resident is over it; 85% is 2.55
    // textures, so two go.
    const h = makeStore({ budgetBytes: 3 * FULL_BYTES });
    await loadAll(h, ['a']);
    h.clock.t += 10;
    await loadAll(h, ['b']);
    h.clock.t += 10;
    await loadAll(h, ['c']);
    h.clock.t += 10;
    h.store.touch(['a']); // a is now more recent than b and c
    h.clock.t += 10;
    await loadAll(h, ['d']);

    expect(h.sink.removed).toEqual([T('b'), T('c')]);
    expect(h.store.isResident('a')).toBe(true);
    expect(h.store.isResident('d')).toBe(true);
    expect(h.store.stats().residentBytes).toBeLessThanOrEqual(0.85 * 3 * FULL_BYTES);
    expect(h.store.stats().evictions).toBe(2);
  });

  it('a lease released inside the grace window and taken again keeps its texture', async () => {
    // Budget 2.5 textures; three resident is 120%, under the 125% ceiling.
    const h = makeStore({ budgetBytes: 2.5 * FULL_BYTES });
    h.source.auto = true;
    const gauntlet = h.store.lease('gauntlet', ['a'], { priority: 'now' });
    const other = h.store.lease('other', ['b', 'c'], { priority: 'now' });
    await h.tick();
    await gauntlet.ready;
    await other.ready;
    const readsBefore = h.source.reads.length;

    gauntlet.release();
    h.clock.t += 1500;
    await h.tick();
    const duel = h.store.lease('duel', ['a'], { priority: 'now' });
    await duel.ready;
    h.clock.t += 5000;
    await h.tick();

    expect(h.sink.removed).toEqual([]);
    expect(h.source.reads.length).toBe(readsBefore);
  });

  it('evicts a released texture once its grace window has passed', async () => {
    const h = makeStore({ budgetBytes: 2.5 * FULL_BYTES });
    h.source.auto = true;
    const gauntlet = h.store.lease('gauntlet', ['a'], { priority: 'now' });
    const other = h.store.lease('other', ['b', 'c'], { priority: 'now' });
    await h.tick();
    await gauntlet.ready;
    gauntlet.release();
    h.clock.t += 1500;
    await h.tick();
    expect(h.sink.removed).toEqual([]);

    h.clock.t += 600;
    await h.tick();
    expect(h.sink.removed).toEqual([T('a')]);
    other.release();
  });

  it('does not let the grace hold residency over 125% of the budget', async () => {
    // Budget 2 textures; three resident is 150%.
    const h = makeStore({ budgetBytes: 2 * FULL_BYTES });
    h.source.auto = true;
    const released = h.store.lease('released', ['a'], { priority: 'now' });
    const held = h.store.lease('held', ['b', 'c'], { priority: 'now' });
    await h.tick();
    await released.ready;
    released.release();
    h.clock.t += 100;
    await h.tick();

    expect(h.sink.removed).toEqual([T('a')]);
    held.release();
  });

  it('never evicts under artEvict=off, however far over the budget', async () => {
    const h = makeStore({ budgetBytes: 1, evict: false });
    await loadAll(h, ['a', 'b', 'c', 'd', 'e', 'f']);
    for (let i = 0; i < 5; i++) {
      h.clock.t += 5000;
      await h.tick();
    }

    expect(h.sink.removed).toEqual([]);
    expect(h.store.stats().resident).toBe(6);
    expect(h.store.stats().evictions).toBe(0);
  });
});

describe('artStore: requests, priorities and cancellation', () => {
  it('serves now first in order, then the newest visible request first', async () => {
    const h = makeStore({ maxInFlight: 1 });
    h.store.prefetch(['f'], { priority: 'idle' }); // takes the window
    h.store.prefetch(['a'], { priority: 'idle' });
    h.store.prefetch(['b', 'c'], { priority: 'visible' });
    h.store.prefetch(['d', 'e'], { priority: 'visible' });
    h.store.lease('gate', ['a'], { priority: 'now' });

    for (const key of ['f', 'a', 'd', 'e', 'b', 'c']) {
      expect(h.source.open.map((read) => read.key)).toEqual([key]);
      h.source.finish(key);
      await h.tick();
    }
  });

  it('never adds a texture for a request cancelled while queued', async () => {
    const h = makeStore({ maxInFlight: 1 });
    h.store.prefetch(['a'], { priority: 'now' });
    const cancel = h.store.prefetch(['b'], { priority: 'now' });
    cancel();
    h.source.finish('a');
    await h.tick();
    await h.tick();

    expect(h.source.keys).toEqual(['a']);
    expect(h.sink.added).toEqual([T('a')]);
    expect(h.store.isResident('b')).toBe(false);
  });

  it('aborts a fetch in flight whose key nobody wants, and never adds it even if the body still comes', async () => {
    const h = makeStore();
    h.source.ignoreSignal = true;
    const lease = h.store.lease('page', ['a'], { priority: 'visible' });
    const signal = h.source.reads[0].signal!;
    lease.release();
    expect(signal.aborted).toBe(true);
    await lease.ready; // a released lease is settled

    h.source.finish('a');
    await h.tick();
    await h.tick();
    expect(h.sink.added).toEqual([]);
    expect(h.store.isResident('a')).toBe(false);
    expect(h.store.stats().inFlight).toBe(0);
  });

  it('lands a body that had already arrived, unpinned', async () => {
    const h = makeStore({ budgetBytes: FULL_BYTES / 2 });
    const lease = h.store.lease('page', ['a'], { priority: 'visible' });
    h.source.finish('a');
    await Promise.resolve(); // the body is in; the decode has not finished
    await Promise.resolve();
    lease.release();
    await h.tick();

    expect(h.sink.added).toEqual([T('a')]);
    h.clock.t += 5000;
    await h.tick();
    expect(h.sink.removed).toEqual([T('a')]);
  });

  // Mutation: retain-unwanted-decode-failure; omit pruning when a released decode fails.
  it('forgets request state when decoding repeatedly fails after its last owner leaves', async () => {
    let failDecode!: () => void;
    const h = makeStore({ decode: () => new Promise((_resolve, reject) => {
      failDecode = () => reject(new Error('invalid image'));
    }) }, ['a']);
    for (let cycle = 0; cycle < 12; cycle++) {
      const lease = h.store.lease('closing view', ['a']);
      h.source.finish('a');
      await flush();
      lease.release();
      await lease.ready;
      failDecode();
      await h.tick();
      expect(h.store.stats()).toMatchObject({ inFlight: 0, queued: 0, uploadsPending: 0, resident: 0, failures: 0 });
      expect((h.store as unknown as { slots: Map<string, unknown> }).slots.size).toBe(0);
    }
    expect(h.sink.textures.size).toBe(0);
  });

  it('shares one fetch between leases and keeps it while any of them wants it', async () => {
    const h = makeStore();
    const one = h.store.lease('one', ['a']);
    const two = h.store.lease('two', ['donor']); // donor draws a's file
    one.release();
    expect(h.source.reads[0].signal!.aborted).toBe(false);
    h.source.finish('a');
    await h.tick();
    await two.ready;
    expect(h.source.keys).toEqual(['a']);
    expect(h.store.isResident('donor')).toBe(true);
  });

  it('treats an id with no art file as resident and never asks for it', async () => {
    const h = makeStore();
    const lease = h.store.lease('placeholder', ['procedural-only']);
    await lease.ready;
    expect(h.store.isResident('procedural-only')).toBe(true);
    expect(h.source.reads).toEqual([]);
  });
});

describe('artStore: arrivals and uploads', () => {
  it('drops a raced duplicate arrival and closes its bitmap', async () => {
    const h = makeStore();
    const lease = h.store.lease('page', ['a']);
    // Another path put the texture in first.
    h.sink.textures.set(T('a'), h.decoded[0] ?? ({} as never));
    h.source.finish('a');
    await h.tick();
    await lease.ready;

    expect(h.sink.added).toEqual([]);
    expect(h.decoded).toHaveLength(1);
    expect(h.decoded[0].closed).toBe(true);
    expect(h.store.isResident('a')).toBe(true);
    expect(h.store.stats().residentBytes).toBe(FULL_BYTES);
    expect(h.store.stats().duplicatesDropped).toBe(1);
  });

  it('closes each decoded bitmap right after upload under WebGL', async () => {
    const h = makeStore();
    await loadAll(h, ['a', 'b']);
    expect(h.decoded.map((image) => image.closed)).toEqual([true, true]);
  });

  it('keeps the bitmap open under the canvas renderer and closes it on eviction', async () => {
    const h = makeStore({ budgetBytes: 1.5 * FULL_BYTES });
    h.sink.keepsSource = true;
    await loadAll(h, ['a']);
    expect(h.decoded[0].closed).toBe(false);
    h.clock.t += 10;
    await loadAll(h, ['b']);
    h.clock.t += 5000;
    await h.tick();

    expect(h.sink.removed).toEqual([T('a')]);
    expect(h.decoded[0].closed).toBe(true);
    expect(h.decoded[1].closed).toBe(false);
  });

  it('uploads at most four full files per frame', async () => {
    const h = makeStore();
    h.source.auto = true;
    h.store.prefetch(['a', 'b', 'c', 'd', 'e', 'f'], { priority: 'now' });
    await flush();
    h.store.frame();
    expect(h.sink.added).toHaveLength(4);
    h.store.frame();
    expect(h.sink.added).toHaveLength(6);
  });

  // Mutation: decode-without-backpressure; remove uploads.length from the pump window.
  it('holds later reads until a frame consumes the bounded decoded-image queue', async () => {
    const h = makeStore({ maxInFlight: 2 });
    h.source.auto = true;
    const lease = h.store.lease('page', ['a', 'b', 'c', 'd']);
    await flush();
    await flush();
    expect(h.store.stats()).toMatchObject({ inFlight: 0, uploadsPending: 2, queued: 2, resident: 0 });
    expect(h.decoded.filter((image) => !image.closed)).toHaveLength(2);

    // Consuming the first pair opens the window for the remaining pair.
    await h.tick();
    expect(h.store.stats()).toMatchObject({ inFlight: 0, uploadsPending: 2, queued: 0, resident: 2 });
    expect(h.decoded.filter((image) => !image.closed)).toHaveLength(2);
    await h.tick();
    await lease.ready;
    expect(h.store.stats()).toMatchObject({ inFlight: 0, uploadsPending: 0, queued: 0, resident: 4 });
    expect(h.decoded.every((image) => image.closed)).toBe(true);
    lease.release();
  });

  it('holds the half texture beside the full one on desktop, and one texture on lite', async () => {
    const desk = makeStore();
    desk.source.auto = true;
    desk.store.lease('thumb', ['a'], { tier: 'half' });
    desk.store.lease('zoom', ['a'], { tier: 'primary' });
    await desk.tick();
    expect(desk.source.reads.map((r) => `${r.key}:${r.tier}`).sort()).toEqual(['a:full', 'a:half']);
    expect(desk.sink.added.sort()).toEqual(['artfile-a', 'arthalf-a']);
    expect(desk.store.stats().residentBytes).toBe(FULL_BYTES + HALF_BYTES);

    const lite = makeStore({ quality: 'lite' });
    lite.source.auto = true;
    lite.store.lease('thumb', ['a'], { tier: 'half' });
    lite.store.lease('card', ['a'], { tier: 'primary' });
    await lite.tick();
    expect(lite.source.reads.map((r) => `${r.key}:${r.tier}`)).toEqual(['a:half']);
    expect(lite.sink.added).toEqual(['artfile-a']);
  });
});

describe('artStore: failures and the retry', () => {
  it('re-sends a transient failure twice at once, then once more after the window drains and a second', async () => {
    const h = makeStore();
    const lease = h.store.lease('duel', ['a'], { priority: 'now' });
    for (let i = 0; i < 3; i++) {
      h.source.fail('a');
      await flush();
    }
    expect(h.source.keys).toEqual(['a', 'a', 'a']);

    h.clock.t += 500;
    await h.tick();
    expect(h.source.open).toHaveLength(0); // not before the second has passed

    h.clock.t += 600;
    await h.tick();
    expect(h.source.open).toHaveLength(1);
    h.source.finish('a');
    await h.tick();
    await lease.ready;
    expect(h.store.isResident('a')).toBe(true);
    expect(h.store.stats().failures).toBe(0);
  });

  it('settles a key that fails both passes, and asks again only after 30 seconds', async () => {
    const h = makeStore();
    const lease = h.store.lease('duel', ['a'], { priority: 'now' });
    for (let i = 0; i < 3; i++) {
      h.source.fail('a');
      await flush();
    }
    h.clock.t += 1100;
    await h.tick();
    for (let i = 0; i < 3; i++) {
      h.source.fail('a');
      await flush();
    }
    await lease.ready; // never hangs
    expect(h.store.isResident('a')).toBe(false);
    expect(h.store.stats().failures).toBe(1);
    lease.release(); // Dropping ownership must retain the failed key's backoff.

    const soon = h.store.lease('again', ['a']);
    await soon.ready;
    expect(h.source.reads).toHaveLength(6);
    soon.release();

    h.clock.t += 30_000;
    h.store.lease('later', ['a']);
    expect(h.source.reads).toHaveLength(7);
  });

  it('retries a failed key within about a second while the window never empties', async () => {
    const keys = ['a', ...Array.from({ length: 30 }, (_, i) => `k${i}`)];
    const h = makeStore({ maxInFlight: 2 }, keys);
    h.store.prefetch(keys.slice(1), { priority: 'idle' });
    const lease = h.store.lease('duel', ['a'], { priority: 'now' });
    h.source.finish('k0'); // frees a slot: a goes out
    await h.tick();
    for (let i = 0; i < 3; i++) {
      h.source.fail('a');
      await flush();
    }
    const failedAt = h.clock.t;
    let retriedAt: number | null = null;
    for (let step = 0; step < 150 && retriedAt === null; step++) {
      h.clock.t += 100;
      const oldest = h.source.open[0];
      oldest.resolve();
      await h.tick();
      if (h.source.open.some((read) => read.key === 'a')) retriedAt = h.clock.t;
    }

    expect(retriedAt).not.toBeNull();
    expect(retriedAt! - failedAt).toBeLessThanOrEqual(1300);
    h.source.finish('a');
    await h.tick();
    await lease.ready;
    expect(h.store.isResident('a')).toBe(true);
  });

  it('does not retry a final failure', async () => {
    const h = makeStore();
    const lease = h.store.lease('duel', ['a'], { priority: 'now' });
    h.source.fail('a', 'failed');
    await lease.ready;
    lease.release(); // A final failure remains final even after every lease leaves.
    h.clock.t += 60_000;
    await h.tick();
    h.store.lease('later', ['a']);
    expect(h.source.reads).toHaveLength(1);
  });
});

describe('artStore: settled versus resident', () => {
  it('counts a key that failed for good as settled but not resident', async () => {
    const h = makeStore();
    const lease = h.store.lease('gate', ['a', 'b'], { priority: 'now' });
    h.source.fail('a', 'failed');
    await flush();

    expect(h.store.isResident('a')).toBe(false);
    expect(h.store.isSettled('a')).toBe(true);
    expect(h.store.isSettled('b')).toBe(false);
    expect(h.store.unsettled(['a', 'b'])).toEqual(['b']);
    expect(h.store.progress().loaded).toBe(1);

    h.source.finish('b');
    await h.tick();
    await lease.ready;
    expect(h.store.progress()).toEqual({ loaded: 2, total: 6 });
    expect(h.store.isSettled('procedural-only')).toBe(true);
  });

  it('stops counting a failed key as settled once it is asked for again after the backoff', async () => {
    const h = makeStore();
    h.store.lease('gate', ['a'], { priority: 'now' });
    for (let i = 0; i < 3; i++) {
      h.source.fail('a');
      await flush();
    }
    h.clock.t += 1100;
    await h.tick();
    for (let i = 0; i < 3; i++) {
      h.source.fail('a');
      await flush();
    }
    expect(h.store.isSettled('a')).toBe(true);

    h.clock.t += 30_000;
    h.store.lease('later', ['a']);
    expect(h.store.isSettled('a')).toBe(false);
    h.source.finish('a');
    await h.tick();
    expect(h.store.isSettled('a') && h.store.isResident('a')).toBe(true);
  });
});

describe('artStore: context restore', () => {
  it('removes every art texture and asks for exactly the pinned set again, at now', async () => {
    const h = makeStore({ maxInFlight: 1 });
    h.source.auto = true;
    const duel = h.store.lease('duel', ['a', 'b'], { priority: 'soon' });
    for (let i = 0; i < 4; i++) await h.tick();
    await duel.ready;
    await loadAll(h, ['c']); // resident, unpinned
    h.source.auto = false;
    const before = h.source.reads.length;

    h.store.prefetch(['e'], { priority: 'idle' }); // takes the window
    h.store.prefetch(['d'], { priority: 'visible' }); // queued behind it

    h.store.contextRestored();
    expect(h.sink.removed.sort()).toEqual([T('a'), T('b'), T('c')]);

    const asked: string[] = [];
    for (let i = 0; i < 4; i++) {
      const read = h.source.open[0];
      asked.push(read.key);
      read.resolve();
      await h.tick();
    }
    // e was already in flight; then the pinned pair at now, ahead of the
    // visible d; c (unpinned) is not asked for again.
    expect(h.source.keys.slice(before)).toEqual(['e', 'a', 'b', 'd']);
    expect(asked).toEqual(['e', 'a', 'b', 'd']);
    for (let i = 0; i < 2; i++) await h.tick();
    expect(h.store.isResident('a') && h.store.isResident('b')).toBe(true);
    expect(h.store.isResident('c')).toBe(false);
    expect(h.store.stats().restores).toBe(1);
  });
});

describe('artStore: removals, restores, widening and disposal', () => {
  it('asks again for a pinned key removed by someone else, at its lease priority', async () => {
    const h = makeStore({ maxInFlight: 1 });
    h.source.auto = true;
    const duel = h.store.lease('duel', ['a'], { priority: 'soon' });
    await h.tick();
    await duel.ready;
    h.source.auto = false;
    h.store.prefetch(['e'], { priority: 'idle' }); // takes the window
    h.store.prefetch(['d'], { priority: 'visible' });
    const before = h.source.reads.length;

    h.sink.textures.delete(T('a'));
    h.store.textureRemoved(T('a'));
    expect(h.store.isResident('a')).toBe(false);
    for (let i = 0; i < 3; i++) {
      h.source.open[0].resolve();
      await h.tick();
    }
    // e was in flight; the visible d beats the soon a.
    expect(h.source.keys.slice(before - 1)).toEqual(['e', 'd', 'a']);
  });

  it('forgets an unpinned key removed by someone else without asking for it again', async () => {
    const h = makeStore();
    await loadAll(h, ['a']);
    const before = h.source.reads.length;
    h.sink.textures.delete(T('a'));
    h.store.textureRemoved(T('a'));
    await h.tick();

    expect(h.store.isResident('a')).toBe(false);
    expect(h.store.stats().residentBytes).toBe(0);
    expect(h.source.reads.length).toBe(before);
  });

  it('ignores the removal notice for its own evictions', async () => {
    const h = makeStore({ budgetBytes: FULL_BYTES });
    const remove = h.sink.remove.bind(h.sink);
    h.sink.remove = (textureKey: string) => {
      remove(textureKey);
      h.store.textureRemoved(textureKey); // the manager's REMOVE, forwarded
    };
    const lease = h.store.lease('held', ['c']);
    h.source.finish('c');
    await h.tick();
    await loadAll(h, ['a', 'b']);
    const before = h.source.reads.length;
    await h.tick();

    expect(h.store.stats().evictions).toBe(2);
    expect(h.source.reads.length).toBe(before);
    lease.release();
  });

  it('keeps a pinned fetch already in flight through a context restore instead of sending it twice', async () => {
    const h = makeStore();
    const lease = h.store.lease('duel', ['a'], { priority: 'visible' });
    h.store.contextRestored();
    expect(h.source.keys).toEqual(['a']);
    h.source.finish('a');
    await h.tick();
    await lease.ready;
    expect(h.store.isResident('a')).toBe(true);
  });

  it('pins and requests ids added to a lease without holding its ready back', async () => {
    const h = makeStore({ budgetBytes: FULL_BYTES / 2 });
    const lease = h.store.lease('binder', ['a']);
    lease.add(['b']);
    expect(h.source.keys).toEqual(['a', 'b']);
    h.source.finish('a');
    await h.tick();
    await lease.ready; // b is still out

    h.source.finish('b');
    await h.tick();
    h.clock.t += 5000;
    await h.tick();
    expect(h.sink.removed).toEqual([]);
    expect(h.store.stats().pinnedBytes).toBe(2 * FULL_BYTES);
  });

  // Mutation: dispose-with-live-leases; settle leases without releasing their ownership.
  it('on dispose aborts fetches, closes decoded images and settles every lease', async () => {
    const h = makeStore();
    const one = h.store.lease('one', ['a']);
    const two = h.store.lease('two', ['b']);
    h.source.finish('b');
    await flush(); // b decoded, waiting for its upload frame
    expect(h.store.stats().uploadsPending).toBe(1);
    const signal = h.source.reads[0].signal!;

    h.store.dispose();
    await one.ready;
    await two.ready;
    expect(signal.aborted).toBe(true);
    expect(h.decoded[0].closed).toBe(true);
    expect((one as unknown as { slots: Set<unknown> }).slots.size).toBe(0);
    expect((two as unknown as { slots: Set<unknown> }).slots.size).toBe(0);
    one.add(['c']); // A retained lease cannot add new work to a disposed store.
    expect(h.store.stats().queued).toBe(0);
    h.store.frame();
    expect(h.sink.added).toEqual([]);
  });
});

describe('artStore: accounting', () => {
  // Mutations: retain-evicted-slot; retain-released-lease-slots; allocate-slots-for-queries.
  it('returns ownership and request bookkeeping to empty after repeated load and eviction of the same keys', async () => {
    const h = makeStore({ budgetBytes: 1 }, ['a', 'b']);
    const internal = h.store as unknown as {
      slots: Map<string, unknown>; leases: Set<unknown>; active: Set<unknown>; uploads: unknown[];
      settled: Set<string>; missed: Set<string>;
    };
    for (let cycle = 0; cycle < 12; cycle++) {
      const key = cycle % 2 === 0 ? 'a' : 'b';
      const lease = h.store.lease('temporary view', [key]);
      h.source.finish(key);
      await h.tick();
      await lease.ready;
      lease.release();
      expect((lease as unknown as { slots: Set<unknown> }).slots.size).toBe(0);
      await h.tick();
      expect(h.store.stats()).toMatchObject({ residentBytes: 0, pinnedBytes: 0, resident: 0, queued: 0, inFlight: 0, uploadsPending: 0 });
      expect(h.store.isResident(key)).toBe(false);
      expect(h.store.isSettled(key)).toBe(false);
      h.store.textureKeyFor(key);
      h.store.touch(['a', 'b']);
      expect(h.store.missing(null)).toHaveLength(2);
      expect(h.store.unsettled(null)).toHaveLength(2);
      expect(h.store.leaseReport()).toEqual([]);
      expect(internal.slots.size).toBe(0);
      expect(internal.leases.size).toBe(0);
      expect(internal.active.size).toBe(0);
      expect(internal.uploads.length).toBe(0);
      expect(internal.settled.size).toBe(0);
      expect(internal.missed.size).toBe(0);
      expect(h.decoded.every((image) => image.closed)).toBe(true);
    }
  });

  it('reports resident, pinned, queued and in-flight work', async () => {
    const h = makeStore({ maxInFlight: 1, budgetBytes: 7 * FULL_BYTES });
    await loadAll(h, ['a']);
    const lease = h.store.lease('page', ['b', 'c']);

    const stats = h.store.stats();
    expect(stats.residentBytes).toBe(FULL_BYTES);
    expect(stats.pinnedBytes).toBe(0);
    expect(stats.inFlight).toBe(1);
    expect(stats.queued).toBe(1);

    h.source.finish('b');
    await h.tick();
    expect(h.store.stats().pinnedBytes).toBe(FULL_BYTES);
    lease.release();
    expect(h.store.stats().pinnedBytes).toBe(0);
  });
});

describe('artStore: leases taken while an arrival is announced', () => {
  /**
   * The sink's add (Phaser fires its ADD event inside `addImage`) and
   * `onResident` both run code that can hold the arriving key again: a view
   * redrawn by the arrival releases its old hold and takes a new one. That
   * must not fetch the key a second time.
   */
  async function settle(h: Harness): Promise<void> {
    for (let i = 0; i < 10; i++) {
      for (const read of h.source.open) read.resolve();
      await h.tick();
    }
  }

  it('fetches once when a view releases and re-holds the key from onResident, beside a scene lease', async () => {
    let hold: ArtLease | null = null;
    const h: Harness = makeStore({
      onResident: () => {
        hold?.release();
        hold = h.store.lease('holdArt', ['a'], { priority: 'visible' });
      },
    });
    const scene = h.store.lease('scene', ['a'], { priority: 'now' });
    hold = h.store.lease('holdArt', ['a'], { priority: 'visible' });
    await settle(h);
    expect(h.source.keys).toEqual(['a']);
    expect(h.store.isResident('a')).toBe(true);
    scene.release();
  });

  it('fetches once when a prefetched key is leased from onResident', async () => {
    const h: Harness = makeStore({
      onResident: () => {
        h.store.lease('late', ['a'], { priority: 'visible' });
      },
    });
    h.store.prefetch(['a'], { priority: 'now' });
    await settle(h);
    expect(h.source.keys).toEqual(['a']);
  });

  it('fetches once when the key is leased from inside the sink add, and that lease settles', async () => {
    const sink = new FakeSink();
    let late: ArtLease | null = null;
    const h: Harness = makeStore({ sink });
    const add = sink.add.bind(sink);
    sink.add = (textureKey, image) => {
      const ok = add(textureKey, image);
      late = h.store.lease('late', ['a'], { priority: 'visible' });
      return ok;
    };
    h.store.prefetch(['a'], { priority: 'now' });
    await settle(h);
    expect(h.source.keys).toEqual(['a']);
    await expect(Promise.race([late!.ready.then(() => 'ready'), flush().then(() => 'hung')])).resolves.toBe('ready');
  });
});
