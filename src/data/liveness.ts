import { FEATURES } from '../config/features';
import type { CardDef } from '../engine/types';
import { DARK_TALES_COMPANION } from './cards/dark-tales-companion';

/** Expansion keys shared by catalog and live-pool consumers. */
export const DUAT_SET = 'sands-of-the-duat' as const;
export const STARBORNE_SET = 'starborne' as const;
export const DROWNED_DEEP_SET = 'drowned-deep' as const;
export const FIRST_DAWN_SET = 'first-dawn' as const;
const DT_COMPANION_IDS: ReadonlySet<string> = new Set(DARK_TALES_COMPANION.map((card) => card.id));

/**
 * Shared live-pool predicate. Preview and engine callers may still use every
 * CardDef in CARD_DB; only player-facing acquisition, completion, and deck
 * derivation surfaces consult this gate.
 */
export function isLiveCollectible(card: CardDef): boolean {
  if (card.token || card.supertypes?.includes('basic')) return false;
  if (DT_COMPANION_IDS.has(card.id)) return FEATURES.dtCompanionLive;
  return card.set !== DUAT_SET || FEATURES.duatLive;
}

/**
 * Every runtime flag `isLiveCollectible` reads, folded into one value. A cache
 * of anything built from the live pool is valid only while this is unchanged:
 * FEATURES is mutable (dev cheats and tests flip it). A flag added to the gate
 * above must be added here too.
 */
export function livenessStamp(): string {
  return `${FEATURES.duatLive ? 1 : 0}${FEATURES.dtCompanionLive ? 1 : 0}`;
}

/**
 * Set-level twin of the card gate, for surfaces that list sets rather than
 * cards (binder/deck-builder set filters, shop strip). An unreleased set must
 * not appear as an empty filter option before its flip.
 */
export function isLiveSet(id: string): boolean {
  return id !== DUAT_SET || FEATURES.duatLive;
}
