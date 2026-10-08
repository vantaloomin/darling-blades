import { ECONOMY } from '../config/rules';
import { isLiveSet } from '../data/liveness';
import { SET_TITLES, type SetId } from '../data/setTitles';

export type BoosterSku = SetId;

/** Shop release order, oldest first. Append new expansions here. */
export const BOOSTER_SKUS: ReadonlyArray<{ label: string; textureKey: string; sku: BoosterSku }> = [
  { label: SET_TITLES.base, textureKey: 'packart', sku: 'base' },
  { label: SET_TITLES.ragnarok, textureKey: 'packart-ragnarok', sku: 'ragnarok' },
  { label: SET_TITLES['celtic-fae'], textureKey: 'packart-celtic-fae', sku: 'celtic-fae' },
  { label: SET_TITLES['arthurian-court'], textureKey: 'packart-arthurian-court', sku: 'arthurian-court' },
  { label: SET_TITLES['gothic-monsters'], textureKey: 'packart-gothic-monsters', sku: 'gothic-monsters' },
  { label: SET_TITLES['dark-tales'], textureKey: 'packart-dark-tales', sku: 'dark-tales' },
  { label: SET_TITLES['yokai-nights'], textureKey: 'packart-yokai-nights', sku: 'yokai-nights' },
  { label: SET_TITLES['sands-of-the-duat'], textureKey: 'packart-sands-of-the-duat', sku: 'sands-of-the-duat' },
  { label: SET_TITLES.starborne, textureKey: 'packart-starborne', sku: 'starborne' },
  { label: SET_TITLES['drowned-deep'], textureKey: 'packart-drowned-deep', sku: 'drowned-deep' },
  { label: SET_TITLES['first-dawn'], textureKey: 'packart-first-dawn', sku: 'first-dawn' },
];

/**
 * Only the newest purchasable expansions take premium slots. Base and hidden
 * SKUs never do; liveness is read on each call so a feature flip takes effect.
 * The list argument lets future release orders be exercised without changing the shipped catalog.
 */
export function packPriceForSku(
  sku: string,
  releaseOrder: readonly { sku: string }[] = BOOSTER_SKUS,
  isLive: (sku: string) => boolean = isLiveSet,
): number {
  const premium = releaseOrder
    .filter((entry) => entry.sku !== 'base' && isLive(entry.sku))
    .slice(-ECONOMY.premiumSetCount);
  return premium.some((entry) => entry.sku === sku) ? ECONOMY.premiumPackPrice : ECONOMY.packPrice;
}
