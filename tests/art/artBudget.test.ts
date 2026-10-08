import { describe, expect, it } from 'vitest';
import { ResidencyBook, artStoreConfig, deviceMemoryScale } from '../../src/art/artBudget';

/**
 * The art budgets and the eviction rule (docs/plan-art-streaming.md,
 * section 3; owner rulings 2026-09-28, questions 2, 7 and 8).
 */

const MIB = 1024 * 1024;

describe('artStoreConfig: budgets', () => {
  it('scales the phone budget by device memory: half at 2 GB, base at 4 GB, 1.5x at 8 GB, base when absent', () => {
    const at = (deviceMemoryGb?: number) => artStoreConfig({ quality: 'lite', deviceMemoryGb });
    expect([at(2).artBudgetBytes, at(2).thumbBudgetBytes]).toEqual([80 * MIB, 24 * MIB]);
    expect([at(4).artBudgetBytes, at(4).thumbBudgetBytes]).toEqual([160 * MIB, 48 * MIB]);
    expect([at(8).artBudgetBytes, at(8).thumbBudgetBytes]).toEqual([240 * MIB, 72 * MIB]);
    expect([at(undefined).artBudgetBytes, at(undefined).thumbBudgetBytes]).toEqual([160 * MIB, 48 * MIB]);
  });

  it('halves below 2 GB too, and never scales the desktop tier', () => {
    expect(deviceMemoryScale('lite', 1)).toBe(0.5);
    expect(deviceMemoryScale('lite', 16)).toBe(1.5);
    for (const gb of [1, 2, 4, 8, undefined]) {
      const config = artStoreConfig({ quality: 'full', deviceMemoryGb: gb });
      expect([config.artBudgetBytes, config.thumbBudgetBytes]).toEqual([640 * MIB, 192 * MIB]);
    }
  });

  it('turns eviction off only for ?artEvict=off', () => {
    expect(artStoreConfig({ quality: 'full' }).evict).toBe(true);
    expect(artStoreConfig({ quality: 'full', search: '?artEvict=off' }).evict).toBe(false);
    expect(artStoreConfig({ quality: 'lite', search: '?quality=lite&artEvict=off' }).evict).toBe(false);
    expect(artStoreConfig({ quality: 'full', search: '?artEvict=on' }).evict).toBe(true);
  });

  it('lets ?artBudget=<MiB> replace the art budget and shrink the thumb budget with it', () => {
    const config = artStoreConfig({ quality: 'full', search: '?artBudget=8', deviceMemoryGb: 8 });
    expect(config.artBudgetBytes).toBe(8 * MIB);
    expect(config.thumbBudgetBytes).toBeLessThan(8 * MIB);
    expect(artStoreConfig({ quality: 'full', search: '?artBudget=nonsense' }).artBudgetBytes).toBe(640 * MIB);
    const lite = artStoreConfig({ quality: 'lite', search: '?artBudget=8', deviceMemoryGb: 2 });
    expect(lite.artBudgetBytes).toBe(8 * MIB);
    expect(lite.thumbBudgetBytes).toBeLessThan(8 * MIB);
  });

  it('opens a wider window on the desktop app than on the web', () => {
    expect(artStoreConfig({ quality: 'full', desktopApp: true }).maxInFlight).toBeGreaterThan(
      artStoreConfig({ quality: 'full' }).maxInFlight,
    );
  });
});

describe('ResidencyBook: the eviction plan', () => {
  it('plans nothing within the budget', () => {
    const book = new ResidencyBook();
    book.setResident('a', 50, 0);
    book.setResident('b', 50, 1);
    expect(book.planEviction(10, 100)).toEqual([]);
  });

  it('takes the least recently used unpinned keys down to the low-water mark', () => {
    const book = new ResidencyBook();
    for (const [i, key] of ['a', 'b', 'c', 'd', 'e'].entries()) book.setResident(key, 30, i);
    book.pin('b', 10);
    book.touch('a', 11);
    // 150 against 100: low water 85 needs 65 out; b is pinned, a was just used.
    expect(book.planEviction(20, 100)).toEqual(['c', 'd', 'e']);
  });

  it('spares keys inside the grace window up to 125%, then takes them only back to the budget', () => {
    const book = new ResidencyBook();
    for (const [i, key] of ['a', 'b', 'c', 'd'].entries()) {
      book.setResident(key, 30, i);
      book.pin(key, i);
    }
    book.unpin('a', 1000);
    book.unpin('b', 1000);
    book.pin('c', 1000);
    book.unpin('c', 1000);
    book.unpin('c', 1000);
    // 120 against 100 (120%): the grace holds.
    expect(book.planEviction(1500, 100)).toEqual([]);
    // 120 against 90 (133%): grace keys go, least recent first, until within 90.
    expect(book.planEviction(1500, 90)).toEqual(['a']);
    // Out of the window, the ordinary rule: down to 85.
    expect(book.planEviction(3100, 100)).toEqual(['a', 'b']);
    expect(book.nextGraceExpiry(1500)).toBe(3000);
  });

  it('decides on the grace keys against what is left once the others have gone', () => {
    const book = new ResidencyBook();
    book.setResident('x', 15, 0);
    for (const [i, key] of ['g1', 'g2'].entries()) {
      book.setResident(key, i === 0 ? 45 : 10, 1);
      book.pin(key, 1);
      book.unpin(key, 1000);
    }
    // 70 against 50 is over the 62.5 ceiling, but after x goes 55 is not.
    expect(book.planEviction(1500, 50)).toEqual(['x']);
  });
});
