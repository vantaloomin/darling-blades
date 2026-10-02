import { describe, expect, it } from 'vitest';
import { PackRequests } from '../../src/art/packRequests';
import { FULL_BYTES, flush, makeStore, type Harness } from './artStoreFakes';

async function arrive(h: Harness, key: string): Promise<void> {
  h.source.finish(key);
  for (let frame = 0; frame < 4; frame++) await h.tick();
}

describe('packRequests', () => {
  it('loads the first pack ahead of visible work, and later packs behind it', async () => {
    const h = makeStore({ maxInFlight: 1 });
    const unblock = h.store.prefetch(['f'], { priority: 'now' });
    const packs = new PackRequests(h.store, [['a'], ['b'], ['c']]);
    const visible = h.store.lease('other-visible-surface', ['d'], { priority: 'visible' });

    await arrive(h, 'f');
    expect(h.source.open.map((read) => read.key)).toEqual(['a']);
    await arrive(h, 'a');
    expect(h.source.open.map((read) => read.key)).toEqual(['d']);

    packs.release();
    visible.release();
    unblock();
  });

  it('reveals the first pack as soon as it is ready without waiting for later packs', async () => {
    const h = makeStore();
    const packs = new PackRequests(h.store, [['a', 'b'], ['c'], ['d']]);
    const reveals: string[] = [];
    expect(packs.reveal([0], () => reveals.push('first'))).toBe(true);
    await arrive(h, 'a');
    expect(reveals).toEqual([]);
    await arrive(h, 'b');
    expect(reveals).toEqual(['first']);
    expect(h.source.open.map((read) => read.key)).toEqual(expect.arrayContaining(['c', 'd']));
    expect(packs.reveal([0], () => reveals.push('again'))).toBe(false);
    expect(reveals).toEqual(['first', 'again']);
    packs.release();
  });

  it('promotes the pack about to flip ahead of the other later packs and gates its whole pack', async () => {
    const h = makeStore({ maxInFlight: 1 });
    const packs = new PackRequests(h.store, [['a'], ['b', 'c'], ['d']]);
    const reveals: string[] = [];
    packs.reveal([1], () => reveals.push('second'));
    const visible = h.store.lease('other-visible-surface', ['e'], { priority: 'visible' });

    await arrive(h, 'a');
    expect(h.source.open.map((read) => read.key)).toEqual(['b']);
    await arrive(h, 'b');
    expect(reveals).toEqual([]);
    await arrive(h, 'c');
    expect(reveals).toEqual(['second']);
    expect(h.store.isResident('d')).toBe(false);
    packs.release();
    visible.release();
  });

  it('keeps an in-flight later pack alive when promoting it for a reveal', async () => {
    const h = makeStore();
    const packs = new PackRequests(h.store, [['a'], ['b']]);
    const original = h.source.open.find((read) => read.key === 'b')!;
    packs.reveal([1], () => {});
    await h.tick();

    expect(original.signal?.aborted).toBe(false);
    expect(h.source.reads.filter((read) => read.key === 'b')).toHaveLength(1);
    packs.release();
  });

  it('pins both revealed and upcoming packs until the scene releases the batch', async () => {
    const h = makeStore({ budgetBytes: FULL_BYTES });
    const packs = new PackRequests(h.store, [['a'], ['b'], ['c']]);
    await arrive(h, 'a');
    await arrive(h, 'b');
    await arrive(h, 'c');
    h.clock.t += 3000;
    await h.tick();

    expect(['a', 'b', 'c'].every((id) => h.store.isResident(id))).toBe(true);
    packs.release();
    await h.tick();
    expect(h.store.stats().pinnedBytes).toBe(0);
    expect(h.store.stats().residentBytes).toBeLessThanOrEqual(FULL_BYTES);
  });

  it('lets a skip supersede a waiting flip without drawing the obsolete reveal', async () => {
    const h = makeStore();
    const packs = new PackRequests(h.store, [['a'], ['b'], ['c']]);
    const reveals: string[] = [];
    packs.reveal([1], () => reveals.push('flip'));
    packs.reveal([2], () => reveals.push('summary'));
    await arrive(h, 'b');
    expect(reveals).toEqual([]);
    await arrive(h, 'c');
    expect(reveals).toEqual(['summary']);
    packs.release();
  });

  it('cancels a waiting reveal on a new gesture, even if that gesture reveals nothing', async () => {
    const h = makeStore();
    const packs = new PackRequests(h.store, [['a'], ['b']]);
    let drawn = false;
    packs.reveal([1], () => { drawn = true; });
    packs.cancelReveal();
    await arrive(h, 'b');
    expect(drawn).toBe(false);
    packs.release();
  });

  it('releases queued and in-flight work on leave and never draws into the old scene', async () => {
    const h = makeStore({ maxInFlight: 1 });
    const packs = new PackRequests(h.store, [['a'], ['b'], ['c']]);
    const reveals: string[] = [];
    packs.reveal([0, 1, 2], () => reveals.push('old'));
    packs.release();
    packs.release();
    await h.tick();
    await flush();

    expect(reveals).toEqual([]);
    expect(h.source.open).toEqual([]);
    expect(h.store.stats().queued).toBe(0);
    expect(h.store.leaseReport()).toEqual([]);
    expect(packs.reveal([0], () => reveals.push('after-leave'))).toBe(false);
    expect(reveals).toEqual([]);

    const reentered = new PackRequests(h.store, [['d']]);
    reentered.reveal([0], () => reveals.push('new'));
    await arrive(h, 'd');
    expect(reveals).toEqual(['new']);
    reentered.release();
  });
});
