import { ownedVariants, PLAYSET } from '../meta/Collection';
import type { DraftState, PremiumGrantSummary } from '../meta/Limited';
import type { SaveData } from '../meta/SaveManager';
import { isPlainVariant, PLAIN_VARIANT, variantKey, type CardVariant } from '../meta/variants';
import { CARD_FACE_H } from '../config/cardFaceGeometry';
import { limitedLineGrowth } from './limitedPanePresentation';

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

/**
 * Dev-only accessibility probe fixtures (src/dev/wave3LimitedFixtures.ts):
 * an in-memory save the scene reads instead of the real one, plus the state to
 * open. A scene honours them only under IS_DEV and never persists them.
 */
export interface LimitedHubA11yFixture {
  save: SaveData;
  /** Open with Retire already armed (its consequence line in the pool line's place). */
  armRetire?: boolean;
}

export interface LimitedDraftA11yFixture {
  save: SaveData;
  modal?: 'leave' | 'persona' | 'inspect';
  /** The seat whose persona modal opens (0 is the human). */
  seat?: number;
  /** The pack index the card inspect opens on. */
  inspect?: number;
  /** A pack index selected before any modal opens. */
  select?: number;
  touch?: boolean;
}

export interface LimitedBuilderA11yFixture {
  save: SaveData;
  modal?: 'leave' | 'inspect';
  selectedId?: string;
  poolPage?: number;
  deckPage?: number;
}

/**
 * The draft screen's Your Picks panel ledger, as offsets from the panel top
 * (Phaser-free; the scene draws it). Each line is its release (100%) offset
 * plus the growth of the lines above it at the text size in force, so the
 * release panel is unchanged at 100%: the COLORS label at +49, the pip row
 * centred at +70, MANA CURVE at +91, the axis at +111, the counts at +130, the
 * rule at +153, the list label at +164, and nine thumbs a row from +204 at a
 * 37px by 43px pitch. Until 1.9 these were literals, and at 130% each label
 * sat on the row under it. The thumbs are card faces and never scale; when the
 * labels above grow, the grid takes more, narrower columns (up to eleven) so
 * the 44 picks before the last still end above the release bottom.
 */
export const LIMITED_PICKS_PANEL = {
  x: 848,
  y: 224,
  width: 368,
  height: 404,
  /** The most picks the panel shows: every pick but the last, which ends the draft. */
  maxPicks: 44,
  /** The first thumb's centre, from the panel's left edge (and the last's, from its right). */
  thumbInset: 35,
  releaseColumns: 9,
  releaseColumnPitch: 37,
  releaseRowPitch: 43,
  /** Thumbs never touch: at least this much between rows. */
  minRowGap: 2,
} as const;

export const PICK_THUMB_SCALE = 0.09;

export function limitedPicksLayout(): {
  colorsTop: number;
  pipY: number;
  curveTop: number;
  axisY: number;
  countY: number;
  ruleY: number;
  listTop: number;
  gridTop: number;
  columns: number;
  rows: number;
  columnPitch: number;
  rowPitch: number;
  emptyY: number;
} {
  const g = limitedLineGrowth;
  let grown = g('h2');
  const colorsTop = 49 + grown;
  grown += g('micro');
  const pipY = 70 + grown + g('caption') / 2;
  grown += g('caption');
  const curveTop = 91 + grown;
  grown += g('micro');
  const axisY = 111 + grown + g('micro') / 2;
  grown += g('micro');
  const countY = 130 + grown + g('caption') / 2;
  grown += g('caption');
  const ruleY = 153 + grown;
  const listTop = 164 + grown;
  grown += g('micro');
  const gridTop = 204 + grown;
  const P = LIMITED_PICKS_PANEL;
  const releaseRows = Math.ceil(P.maxPicks / P.releaseColumns);
  // The last row's centre may sit no lower than the release grid's.
  const lastRowY = 204 + (releaseRows - 1) * P.releaseRowPitch;
  const thumbHeight = CARD_FACE_H * PICK_THUMB_SCALE;
  let grid: { columns: number; rows: number; columnPitch: number; rowPitch: number } = { columns: P.releaseColumns, rows: releaseRows, columnPitch: P.releaseColumnPitch, rowPitch: P.releaseRowPitch };
  for (let columns = P.releaseColumns; columns <= P.releaseColumns + 2; columns++) {
    const rows = Math.ceil(P.maxPicks / columns);
    const rowPitch = rows > 1 ? Math.min(P.releaseRowPitch, (lastRowY - gridTop) / (rows - 1)) : P.releaseRowPitch;
    const columnPitch = Math.min(P.releaseColumnPitch, (P.width - 2 * P.thumbInset) / (columns - 1));
    grid = { columns, rows, columnPitch, rowPitch };
    if (rowPitch >= thumbHeight + P.minRowGap) break;
  }
  return { colorsTop, pipY, curveTop, axisY, countY, ruleY, listTop, gridTop, ...grid, emptyY: 285 + grown };
}
