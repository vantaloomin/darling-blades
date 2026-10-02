import { describe, expect, it } from 'vitest';
import { bindArtLease } from '../../src/art/artLifetime';
import { flush, FULL_BYTES, makeStore } from './artStoreFakes';

function owner() {
  const listeners = new Set<() => void>();
  return {
    listeners,
    onGone(fn: () => void): () => void {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    destroy(): void { for (const fn of [...listeners]) fn(); },
  };
}

describe('art lifetime', () => {
  it('keeps a modal face pinned until destruction, then permits eviction', async () => {
    const h = makeStore({ budgetBytes: FULL_BYTES / 2 });
    h.source.auto = true;
    const modal = owner();
    bindArtLease(h.store.lease('modal', ['a'], { priority: 'now' }), modal.onGone);
    for (let i = 0; i < 4; i++) await h.tick();
    expect(h.store.isResident('a')).toBe(true);
    expect(h.sink.removed).toEqual([]);
    modal.destroy();
    await h.tick();
    expect(h.store.stats().pinnedBytes).toBe(0);
    expect(h.store.isResident('a')).toBe(false);
  });

  it('closing a loading modal settles ready and a reopened modal can load the same key', async () => {
    const h = makeStore({ maxInFlight: 1 });
    const modal = owner();
    const first = bindArtLease(h.store.lease('first', ['a', 'b']), modal.onGone);
    let settled = false;
    void first.ready.then(() => { settled = true; });
    modal.destroy();
    await flush();
    expect(settled).toBe(true);
    const reopened = owner();
    const second = bindArtLease(h.store.lease('second', ['a']), reopened.onGone);
    await h.tick();
    h.source.finish('a');
    for (let i = 0; i < 4; i++) await h.tick();
    await second.ready;
    expect(h.store.isResident('a')).toBe(true);
    expect(h.source.keys).not.toContain('b');
    reopened.destroy();
    expect(h.store.leaseReport()).toEqual([]);
  });

  it('an early release removes the owner listener and cannot acquire more art', async () => {
    const h = makeStore();
    const modal = owner();
    const lease = bindArtLease(h.store.lease('transient gate', ['a']), modal.onGone);
    lease.release();
    lease.add(['b']);
    modal.destroy();
    await h.tick();
    expect(modal.listeners.size).toBe(0);
    expect(h.store.leaseReport()).toEqual([]);
    expect(h.source.keys).not.toContain('b');
  });
});
