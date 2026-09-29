import { describe, expect, it } from 'vitest';
import { PagedRequests, type PagedStore } from '../../src/art/pagedRequests';
import { flush, loadAll, makeStore, type Harness } from './artStoreFakes';

/**
 * A paged surface's art requests (docs/plan-art-streaming.md section 2, S5a):
 * which page is leased and when, when the page draws (at once, or held until
 * its art is in or a timeout), and when the lease lets go. Run against a real
 * `ArtStore` over the fake source (tests/art/artStoreFakes.ts); the timer is a
 * hand-fired fake.
 */

interface Scheduled {
  fn: () => void;
  ms: number;
  cancelled: boolean;
}

function paged(h: Harness | null, label = 'binder'): { requests: PagedRequests; timers: Scheduled[] } {
  const timers: Scheduled[] = [];
  const requests = new PagedRequests(label, 'primary', {
    store: () => (h === null ? null : (h.store as PagedStore)),
    schedule: (fn, ms) => {
      const timer: Scheduled = { fn, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  });
  return { requests, timers };
}

/** Answer every open read of `keys` and run frames until they are resident. */
async function arrive(h: Harness, keys: string[]): Promise<void> {
  for (const key of keys) h.source.finish(key);
  for (let i = 0; i < 4; i++) await h.tick();
}

const pageLeases = (h: Harness): { label: string; keys: number }[] =>
  h.store.leaseReport().filter((lease) => lease.label.startsWith('page:'));

describe('pagedRequests: what a page leases', () => {
  it('leases nothing for a page whose art is all resident, and draws it at once', async () => {
    const h = makeStore();
    await loadAll(h, ['a', 'b']);
    const { requests } = paged(h);
    const draws: boolean[] = [];

    const held = requests.show(['a', 'b'], [], (afterHold) => draws.push(afterHold), 150);

    expect(held).toBe(false);
    expect(draws).toEqual([false]);
    expect(pageLeases(h)).toEqual([]);
  });

  it('leases the whole page, its resident part too, when any of it is missing', async () => {
    const h = makeStore();
    await loadAll(h, ['a']);
    const { requests } = paged(h);

    requests.show(['a', 'c'], [], () => {}, 150);

    expect(pageLeases(h)).toEqual([{ label: 'page:binder', keys: 2, resident: 1 }]);
    expect(h.store.stats().pinnedBytes).toBeGreaterThan(0);
  });

  it('takes the new page lease before letting go of the old one, so a shared fetch is not cancelled', async () => {
    const h = makeStore();
    const { requests } = paged(h);
    requests.show(['c'], [], () => {}, 150);
    await h.tick();
    expect(h.source.open.map((read) => read.key)).toEqual(['c']);

    requests.show(['c', 'd'], [], () => {}, 150);
    await h.tick();

    // The fetch of c that page one started is still the only one, and still open.
    expect(h.source.reads.filter((read) => read.key === 'c')).toHaveLength(1);
    expect(h.source.open.map((read) => read.key)).toContain('c');
    expect(pageLeases(h)).toEqual([{ label: 'page:binder', keys: 2, resident: 0 }]);
  });
});

describe('pagedRequests: when a page draws', () => {
  it('draws at once with no store, and with no hold, even over missing art', () => {
    const none = paged(null);
    const noStore: boolean[] = [];
    expect(none.requests.show(['c'], [], (afterHold) => noStore.push(afterHold), 150)).toBe(false);
    expect(noStore).toEqual([false]);

    const h = makeStore();
    const { requests } = paged(h);
    const noHold: boolean[] = [];
    expect(requests.show(['c'], [], (afterHold) => noHold.push(afterHold), 0)).toBe(false);
    expect(noHold).toEqual([false]);
  });

  it('holds a page with missing art until the art is in, when that comes before the timeout, and draws it once', async () => {
    const h = makeStore();
    const { requests, timers } = paged(h);
    const draws: boolean[] = [];

    expect(requests.show(['c', 'd'], [], (afterHold) => draws.push(afterHold), 150)).toBe(true);
    expect(timers.map((timer) => timer.ms)).toEqual([150]);
    await h.tick();
    expect(draws).toEqual([]);

    await arrive(h, ['c', 'd']);
    await flush();
    expect(draws).toEqual([true]);

    // The timeout firing late changes nothing.
    timers[0].fn();
    expect(draws).toEqual([true]);
  });

  it('draws a held page at the timeout, over stand-ins, and not again when the art lands', async () => {
    const h = makeStore();
    const { requests, timers } = paged(h);
    const draws: boolean[] = [];
    requests.show(['c'], [], (afterHold) => draws.push(afterHold), 150);
    await h.tick();

    timers[0].fn();
    expect(draws).toEqual([true]);

    await arrive(h, ['c']);
    await flush();
    expect(draws).toEqual([true]);
  });

  it('never draws a held page that a newer page overtook', async () => {
    const h = makeStore();
    await loadAll(h, ['e']);
    const { requests, timers } = paged(h);
    const drawn: string[] = [];
    requests.show(['c'], [], () => drawn.push('one'), 150);
    await h.tick();

    requests.show(['e'], [], () => drawn.push('two'), 150);
    timers[0].fn();
    await h.tick();
    await flush();

    expect(drawn).toEqual(['two']);
  });

  it('never draws a held page after release, and draws nothing shown after release', async () => {
    const h = makeStore();
    const { requests, timers } = paged(h);
    const drawn: string[] = [];
    requests.show(['c'], [], () => drawn.push('held'), 150);
    await h.tick();

    requests.release();
    timers[0].fn();
    await h.tick();
    await flush();
    expect(drawn).toEqual([]);

    expect(requests.show([], [], () => drawn.push('after'), 0)).toBe(false);
    expect(drawn).toEqual([]);
    expect(pageLeases(h)).toEqual([]);
  });
});

describe('pagedRequests: when a page lets go of its art', () => {
  it('releases the page lease once the art is in and the page has drawn', async () => {
    const h = makeStore();
    const { requests } = paged(h);
    requests.show(['c', 'd'], [], () => {}, 150);
    await h.tick();
    expect(requests.holding).toBe(true);

    await arrive(h, ['c', 'd']);
    await flush();

    expect(requests.holding).toBe(false);
    expect(pageLeases(h)).toEqual([]);
    expect(h.store.stats().pinnedBytes).toBe(0);
  });

  it('keeps the lease of a page drawn over stand-ins until its art is in', async () => {
    const h = makeStore();
    const { requests, timers } = paged(h);
    requests.show(['c'], [], () => {}, 150);
    await h.tick();
    timers[0].fn();
    expect(requests.holding).toBe(true);

    await arrive(h, ['c']);
    await flush();
    expect(requests.holding).toBe(false);
    expect(pageLeases(h)).toEqual([]);
  });
});
