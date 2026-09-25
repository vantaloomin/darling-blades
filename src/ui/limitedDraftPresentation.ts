import { ownedVariants, PLAYSET, type AddResult } from '../meta/Collection';
import type { DraftState } from '../meta/Limited';
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

/**
 * What a Premium draft's grant did, read from the add results it returned:
 * every pick is added through the collection's add rule, and a result with
 * `dupeGold` above zero is a plain copy past the plain playset that melted.
 */
export interface PremiumGrantSummary {
  /** Picks granted: the whole Premium pool. */
  drafted: number;
  /** Copies the collection kept. */
  added: number;
  /** Plain copies past the playset, converted to gold instead. */
  converted: number;
  /** The gold those conversions paid. */
  gold: number;
}

export function premiumGrantSummary(results: readonly Pick<AddResult, 'dupeGold'>[]): PremiumGrantSummary {
  let converted = 0;
  let gold = 0;
  for (const result of results) {
    if (result.dupeGold <= 0) continue;
    converted++;
    gold += result.dupeGold;
  }
  return { drafted: results.length, added: results.length - converted, converted, gold };
}

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
 * What the Limited deck builder is opened with. The grant's result exists only
 * at the moment the draft completes (the run does not store it), so the screen
 * that completes the draft hands it over; a later visit arrives without it.
 */
export interface LimitedBuilderEntry {
  premiumGrant?: PremiumGrantSummary;
}
