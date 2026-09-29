import { ownedVariants, PLAYSET } from '../meta/Collection';
import type { DraftState, PremiumGrantSummary } from '../meta/Limited';
import type { SaveData } from '../meta/SaveManager';
import { isPlainVariant, PLAIN_VARIANT, variantKey, type CardVariant } from '../meta/variants';

/**
 * Phaser-free copy for the Limited draft screen.
 *
 * A Premium draft grants every pick to the collection when the draft ends, in
 * pick order, through the ordinary add path: a PLAIN copy past the plain
 * playset melts to gold, and a special print (any other frame, holo or Full
 * Art) is always kept. The inspector's ownership line has to count what that
 * rule counts. Until 1.8.1 (2026-09-25) it read the aggregate across every
 * treatment, so four foils read as "4/4 plain" and warned that a plain pick
 * would melt when it would not.
 */

/** The player's picks so far this draft, and their treatments (index-aligned). */
export type DraftPicks = Pick<DraftState, 'pickVariants'> & { picks: readonly string[] };

/** Plain copies of a card waiting in this draft's picks, granted when it ends. */
export function plainCopiesDrafted(drafted: DraftPicks, cardId: string): number {
  let count = 0;
  drafted.picks.forEach((id, index) => {
    if (id === cardId && isPlainVariant(drafted.pickVariants?.[index] ?? PLAIN_VARIANT)) count++;
  });
  return count;
}

/**
 * What the Premium inspector says about the copy on offer: the plain copies
 * owned and already drafted, and whether this copy melts. The melt is named
 * only once it is one copy away, so the line stays short while it cannot
 * happen.
 */
export function premiumOwnershipLine(
  save: SaveData,
  cardId: string,
  offered: CardVariant | undefined,
  drafted: DraftPicks,
): string {
  const owned = ownedVariants(save, cardId)[variantKey(PLAIN_VARIANT)] ?? 0;
  const pending = plainCopiesDrafted(drafted, cardId);
  const held = owned + pending;
  const base = `You own ${owned}/${PLAYSET} plain${pending > 0 ? `, ${pending} more drafted` : ''}`;
  if (held < PLAYSET - 1) return base;
  if (offered && !isPlainVariant(offered)) return `${base}. Special prints never melt.`;
  if (held >= PLAYSET) return `${base}. This plain copy melts to gold when the draft ends.`;
  return `${base}. Plain copies past ${PLAYSET} melt to gold.`;
}

// The grant summary moved to meta (the grant stores it on the save, plan 1.9
// I7); re-exported here for the draft and deck builder screens.
export { premiumGrantSummary, type PremiumGrantSummary } from '../meta/Limited';

/**
 * The Limited deck builder's note after a Premium draft, in the owner's words
 * (approved 2026-09-25). It replaced "Your 45 drafted cards were added to your
 * collection", which was not true once a plain copy had melted.
 */
export function premiumGrantNote(summary: PremiumGrantSummary): string {
  const { drafted, added, converted, gold } = summary;
  const lead = `You drafted ${drafted} ${drafted === 1 ? 'card' : 'cards'}.`;
  if (converted === 0) {
    return added === 1
      ? `${lead} 1 has been added to your collection.`
      : `${lead} All ${added} have been added to your collection.`;
  }
  const kept = added === 0
    ? 'None have been added to your collection'
    : `${added} ${added === 1 ? 'has' : 'have'} been added to your collection`;
  const melted = converted === 1
    ? '1 was a duplicate that was converted'
    : `${converted} were duplicates that were converted`;
  return `${lead} ${kept}, and ${melted} to ${gold.toLocaleString('en-US')} gold.`;
}

/**
 * What the Limited deck builder is opened with. The screen that completes the
 * draft hands the grant over; a later visit (or one after a reload) reads the
 * copy the grant stored on the save, through `storedPremiumGrant`.
 */
export interface LimitedBuilderEntry {
  premiumGrant?: PremiumGrantSummary;
}
