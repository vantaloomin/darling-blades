import { describe, expect, it } from 'vitest';
import { FEATURES } from '../../src/config/features';
import { BOOSTER_SKUS, packPriceForSku } from '../../src/meta/boosterSkus';

describe('booster pricing by release order', () => {
  it.each([false, true])('charges the newest three live expansions a premium with duatLive=%s', (duatLive) => {
    const previous = FEATURES.duatLive;
    FEATURES.duatLive = duatLive;
    try {
      const premium = BOOSTER_SKUS.filter(({ sku }) => packPriceForSku(sku) === 525);
      expect(new Set(premium.map(({ sku }) => sku))).toEqual(
        new Set(['starborne', 'drowned-deep', 'first-dawn']),
      );
      for (const row of BOOSTER_SKUS.filter((entry) => !premium.includes(entry))) {
        expect(packPriceForSku(row.sku), row.sku).toBe(450);
      }
    } finally {
      FEATURES.duatLive = previous;
    }
  });

  it('demotes the oldest premium expansion when a newer SKU is appended', () => {
    const releaseOrder = ['base', 'older', 'third-newest', 'second-newest', 'newest'].map((sku) => ({ sku }));
    expect(packPriceForSku('third-newest', releaseOrder)).toBe(525);
    const nextRelease = [...releaseOrder, { sku: 'future-expansion' }];
    expect(packPriceForSku('third-newest', nextRelease)).toBe(450);
    for (const sku of ['second-newest', 'newest', 'future-expansion']) {
      expect(packPriceForSku(sku, nextRelease), sku).toBe(525);
    }
    expect(packPriceForSku('older', nextRelease)).toBe(450);
    expect(packPriceForSku('base', nextRelease)).toBe(450);
  });

  it('excludes hidden SKUs and Base before allocating premium slots', () => {
    // Put both exclusions at the newest end so counting either would displace
    // a purchasable expansion. Unhiding the new set must then demote one.
    const releaseOrder = ['oldest-live', 'middle-live', 'newest-live', 'sands-of-the-duat', 'base'].map((sku) => ({ sku }));
    const previous = FEATURES.duatLive;
    FEATURES.duatLive = false;
    try {
      for (const sku of ['oldest-live', 'middle-live', 'newest-live']) {
        expect(packPriceForSku(sku, releaseOrder), sku).toBe(525);
      }
      expect(packPriceForSku('sands-of-the-duat', releaseOrder)).toBe(450);
      expect(packPriceForSku('base', releaseOrder)).toBe(450);
      FEATURES.duatLive = true;
      expect(packPriceForSku('oldest-live', releaseOrder)).toBe(450);
      expect(packPriceForSku('sands-of-the-duat', releaseOrder)).toBe(525);
    } finally {
      FEATURES.duatLive = previous;
    }
  });
});
