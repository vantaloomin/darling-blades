import { FEATURES } from '../config/features';
import type { CardDef } from '../engine/types';

/** The expansion key is stamped by catalog.ts without widening engine types. */
export const DUAT_SET = 'sands-of-the-duat' as const;

/**
 * Shared live-pool predicate. Preview and engine callers may still use every
 * CardDef in CARD_DB; only player-facing acquisition, completion, and deck
 * derivation surfaces consult this gate.
 */
export function isLiveCollectible(card: CardDef): boolean {
  if (card.token || card.supertypes?.includes('basic')) return false;
  return String(card.set) !== DUAT_SET || FEATURES.duatLive;
}
