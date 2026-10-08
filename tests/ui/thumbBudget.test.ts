import { describe, expect, it } from 'vitest';
import { artStoreConfig } from '../../src/art/artBudget';
import { ThumbBook } from '../../src/ui/thumbBudget';

/**
 * The thumbnail cache's budget (1.9 lane D, S4; docs/plan-art-streaming.md
 * section 3, "CardThumbCache"): a thumb an Image shows is never evicted;
 * unheld thumbs go least recently used first once the thumbs are over their
 * budget, down to 85% of it; a thumb released in the last two seconds is
 * spared unless the thumbs are over 125% of the budget; and a thumb the
 * safety scan finds drawn without a hold is kept. `src/ui/CardThumbCache.ts`
 * binds this to Phaser; here it runs over a hand-moved clock.
 */

const THUMB = 100;

function book(
  budgetThumbs: number,
  drawn: string[] = [],
  evict?: boolean,
): { book: ThumbBook; clock: { t: number }; removed: string[] } {
  const clock = { t: 10_000 };
  const removed: string[] = [];
  const thumbs = new ThumbBook({
    budgetBytes: budgetThumbs * THUMB,
    evict,
    now: () => clock.t,
    remove: (key) => removed.push(key),
    inUse: (keys) => new Set(keys.filter((key) => drawn.includes(key))),
  });
  return { book: thumbs, clock, removed };
}

/** Bake `keys` in order, one clock tick apart, so the first is least recently used. */
function bakeAll(b: ThumbBook, clock: { t: number }, keys: string[]): void {
  for (const key of keys) {
    clock.t += 10;
    b.baked(key, THUMB);
  }
}

describe('the thumb budget', () => {
  it('keeps every thumb while the thumbs are within the budget', () => {
    const { book: b, clock, removed } = book(4);
    bakeAll(b, clock, ['a', 'b', 'c', 'd']);

    expect(b.evict()).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('keeps released and newly baked thumbs over budget without scheduling eviction under artEvict=off', () => {
    const config = artStoreConfig({ quality: 'full', search: '?artEvict=off' });
    const { book: b, clock, removed } = book(1, [], config.evict);
    bakeAll(b, clock, ['a', 'b', 'c']);
    const release = b.hold('a');
    release();
    clock.t += 5_000;

    expect(b.wantsPass).toBe(false);
    expect(b.evict()).toEqual([]);
    bakeAll(b, clock, ['d']);
    expect(b.wantsPass).toBe(false);
    expect(b.evict()).toEqual([]);
    expect(removed).toEqual([]);
    for (const key of ['a', 'b', 'c', 'd']) expect(b.has(key)).toBe(true);
  });

  it('evicts unheld thumbs least recently used first, down to the low-water mark', () => {
    const { book: b, clock, removed } = book(10);
    bakeAll(b, clock, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
    clock.t += 10;
    b.touch('a');

    // 12 thumbs against 10: down to 8.5, so four go, oldest use first; 'a' was used last.
    expect(b.evict()).toEqual(['b', 'c', 'd', 'e']);
    expect(removed).toEqual(['b', 'c', 'd', 'e']);
    expect(b.has('b')).toBe(false);
    expect(b.has('a')).toBe(true);
  });

  it('never evicts a thumb an Image holds, even over the budget', () => {
    const { book: b, clock, removed } = book(1);
    bakeAll(b, clock, ['a', 'b', 'c']);
    for (const key of ['a', 'b', 'c']) b.hold(key);

    expect(b.evict()).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('holds a thumb until the last Image showing it is gone, however often each lets go', () => {
    const { book: b, clock } = book(1);
    bakeAll(b, clock, ['a', 'b']);
    b.hold('b');
    const first = b.hold('a');
    const second = b.hold('a');

    first();
    first();
    clock.t += 5_000;
    expect(b.evict()).toEqual([]);

    second();
    clock.t += 5_000;
    expect(b.evict()).toEqual(['a']);
  });

  it('spares a thumb released moments ago unless the thumbs are far over the budget', () => {
    const keys = ['a', 'b', 'c', 'd', 'e'];
    const { book: b, clock } = book(4);
    const releases = keys.map((key) => b.hold(key));
    bakeAll(b, clock, keys);
    clock.t += 10;
    for (const release of releases) release();

    // Five against four is over the budget but not over 125% of it, and all
    // five were released just now: every one is in its grace.
    clock.t += 100;
    expect(b.evict()).toEqual([]);
    expect(b.wantsPass).toBe(true);

    // Once the grace has run out they go, oldest first, down to the low-water mark.
    clock.t += 2_500;
    expect(b.evict()).toEqual(['a', 'b']);
  });

  it('lets a pass evict inside the grace once the thumbs are over 125% of the budget', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
    const { book: b, clock } = book(4);
    const releases = keys.map((key) => b.hold(key));
    bakeAll(b, clock, keys);
    clock.t += 10;
    for (const release of releases) release();

    clock.t += 100;
    // Six against four is 150%: grace thumbs go, but only back down to the budget.
    expect(b.evict()).toEqual(['a', 'b']);
  });

  it('keeps a thumb the safety scan finds drawn without a hold, and counts it', () => {
    const { book: b, clock, removed } = book(1, ['a']);
    bakeAll(b, clock, ['a', 'b', 'c']);

    expect(b.evict()).toEqual(['b', 'c']);
    expect(removed).not.toContain('a');
    expect(b.stats().missedHolds).toBe(1);
  });

  it('bakes an evicted thumb back into the budget when it is shown again', () => {
    const { book: b, clock } = book(1);
    bakeAll(b, clock, ['a', 'b']);
    b.evict();
    expect(b.has('a')).toBe(false);

    b.baked('a', THUMB);
    b.hold('a');
    expect(b.has('a')).toBe(true);
    expect(b.stats().pinnedBytes).toBe(THUMB);
  });
});
