import type { CardDef } from '../engine/types';

/** The frame's legendary crown: every legendary card except a crownless one (a Sworn Champion). */
export function showsLegendaryCrown(card: Pick<CardDef, 'supertypes' | 'crownless'>): boolean {
  return (card.supertypes?.includes('legendary') ?? false) && card.crownless !== true;
}
