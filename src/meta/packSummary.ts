import type { CardDb, CardDef, Rarity } from '../engine/types';
import { ownedCount } from './Collection';
import { packPool } from './PackOpener';
import type { SaveData } from './SaveManager';

const TIERS: readonly Rarity[] = ['c', 'r', 'sr', 'ssr', 'ur'];

export interface PackPoolSummary {
  /** Distinct booster-eligible cards this SKU can pull. */
  poolSize: number;
  /** How many of those the player owns at least one copy of. */
  ownedDistinct: number;
}

/**
 * The shop's pool-first odds disclosure: slot odds are identical across every
 * booster (one global DROPS table), so the decision variable between packs is
 * the PULL POOL. `set` undefined = the Core pack, which pulls from every set.
 */
export function packPoolSummary(save: SaveData, db: CardDb, set?: CardDef['set']): PackPoolSummary {
  const ids = TIERS.flatMap((tier) => packPool(db, tier, set));
  const ownedDistinct = ids.filter((id) => ownedCount(save, id) > 0).length;
  return { poolSize: ids.length, ownedDistinct };
}
