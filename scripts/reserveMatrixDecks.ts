/**
 * Deterministic legal deck fleets for the reserve-format balance matrices.
 *
 * These lists are measurement fixtures, not saved-deck data. Every list is
 * derived from the live catalog and passed through the player-facing
 * validators before it is returned, so a catalog change cannot silently
 * produce an illegal matrix game.
 */
import { CARD_DB } from '../src/data/catalog';
import { STARTER_DECKS, type DeckList } from '../src/data/starterDecks';
import type { CardDb, CardDef, Color } from '../src/engine/types';
import { DARLINGS_DECK_SIZE, hasLandFetchBehavior, isBasicLand, isDualLand } from '../src/meta/warchest';
import { validateDarlingsDeck, validateWarchestDeck } from '../src/meta/darlings';
import { freshSave, type SaveData } from '../src/meta/SaveManager';

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const satisfies readonly Color[];
const DARLING_IDENTITIES: readonly (readonly Color[])[] = [
  ['W'],
  ['U'],
  ['B'],
  ['R'],
  ['G'],
  ['W', 'U'],
];

export interface ReserveMatrixDeck {
  id: string;
  name: string;
  colors: readonly Color[];
  cards: string[];
  landReserve: string[];
  darlingId: string | null;
}

export interface ReserveMatrixFleets {
  warchest: ReserveMatrixDeck[];
  darlings: ReserveMatrixDeck[];
}

/** A synthetic collection that owns a Constructed playset of every catalog card. */
export function buildReserveMatrixFullOwnershipSave(db: CardDb): SaveData {
  const save = freshSave(0);
  for (const id of Object.keys(db)) save.collection[id] = 4;
  return save;
}

function cardManaValue(card: CardDef): number {
  if (!card.cost) return 0;
  return card.cost.generic + Object.values(card.cost.pips).reduce((total, pips) => total + pips, 0);
}

function byCurveThenId(db: CardDb, ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => {
    const curve = cardManaValue(db[a]) - cardManaValue(db[b]);
    return curve || a.localeCompare(b);
  });
}

function isEligibleSpell(card: CardDef | undefined): card is CardDef {
  return Boolean(card && !card.token && !card.types.includes('land') && !hasLandFetchBehavior(card));
}

function colorsOfSource(deck: DeckList, db: CardDb): Color[] {
  const colors = new Set<Color>();
  for (const id of deck.cards) {
    const card = db[id];
    for (const color of card?.colors ?? []) colors.add(color);
    for (const color of card?.manaAbility ?? []) colors.add(color);
  }
  return COLOR_ORDER.filter((color) => colors.has(color));
}

function containsOnlyColors(card: CardDef, colors: readonly Color[]): boolean {
  return card.colors.every((color) => colors.includes(color));
}

function landReserve(colors: readonly Color[], db: CardDb): string[] {
  const duals = Object.values(db)
    .filter((card) =>
      isDualLand(card) &&
      (card.manaAbility?.length ?? 0) === 2 &&
      (card.manaAbility ?? []).every((color) => colors.includes(color)),
    )
    .map((card) => card.id)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 5);
  const basics = COLOR_ORDER.filter((color) => colors.includes(color)).map((color) => {
    const basic = Object.values(db)
      .filter((card) => isBasicLand(card) && card.manaAbility?.length === 1 && card.manaAbility[0] === color)
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!basic) throw new Error(`Reserve matrix has no basic land for ${color}`);
    return basic.id;
  });
  const palette = basics.length > 0 ? basics : ['land-plains'];
  return [...duals, ...Array.from({ length: 10 - duals.length }, (_, i) => palette[i % palette.length])];
}

function fillToPlayset(
  sourceCards: readonly string[],
  colors: readonly Color[],
  db: CardDb,
): string[] {
  const cards: string[] = [];
  const counts = new Map<string, number>();
  const add = (id: string): boolean => {
    if ((counts.get(id) ?? 0) >= 4) return false;
    cards.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    return true;
  };

  for (const id of sourceCards) {
    if (isEligibleSpell(db[id])) add(id);
  }

  const sourceOrder = [...new Set(sourceCards.filter((id) => isEligibleSpell(db[id])))];
  const catalogOrder = byCurveThenId(
    db,
    Object.values(db)
      .filter((card) => isEligibleSpell(card) && containsOnlyColors(card, colors))
      .map((card) => card.id),
  ).filter((id) => !sourceOrder.includes(id));
  // Depth-first: raise every source card to a full playset in source order,
  // so the deck keeps the starter's shape. Only then top off with catalog
  // SINGLETONS in curve-then-id order (singletons spread the fill instead of
  // stacking four copies of the cheapest catalog card).
  for (const id of sourceOrder) {
    while (cards.length < 50 && add(id)) { /* raise to playset */ }
    if (cards.length === 50) break;
  }
  for (const id of catalogOrder) {
    if (cards.length === 50) break;
    add(id);
  }
  if (cards.length < 50) {
    throw new Error(`Reserve matrix could not derive 50 Warchest spells for colors ${colors.join('')}`);
  }
  return cards;
}

function sameColors(a: readonly Color[], b: readonly Color[]): boolean {
  return a.length === b.length && a.every((color, index) => color === b[index]);
}

function selectDarling(colors: readonly Color[], db: CardDb): CardDef {
  const darling = Object.values(db)
    .filter((card) =>
      !card.token &&
      card.types.includes('creature') &&
      (card.supertypes?.includes('legendary') ?? false) &&
      sameColors(COLOR_ORDER.filter((color) => card.colors.includes(color)), colors),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0];
  if (!darling) throw new Error(`Reserve matrix could not find a Darling for colors ${colors.join('')}`);
  return darling;
}

function darlingsDeck(darling: CardDef, db: CardDb): string[] {
  const candidates = byCurveThenId(
    db,
    Object.values(db)
      .filter((card) => card.id !== darling.id && isEligibleSpell(card) && containsOnlyColors(card, darling.colors))
      .map((card) => card.id),
  );
  if (candidates.length < DARLINGS_DECK_SIZE - 1) {
    throw new Error(`Reserve matrix could not derive ${DARLINGS_DECK_SIZE - 1} singleton spells for ${darling.name}`);
  }
  return [darling.id, ...candidates.slice(0, DARLINGS_DECK_SIZE - 1)];
}

function assertLegal(name: string, issues: readonly { message: string }[]): void {
  if (issues.length > 0) {
    throw new Error(`${name} failed reserve validation: ${issues.map((issue) => issue.message).join(' | ')}`);
  }
}

/**
 * Build the compact matrix fields.
 *
 * Warchest uses the five starter decks as source material: retain their legal
 * nonlands, raise each retained card to a full playset in source order
 * (depth-first), and only then top off with catalog singletons in
 * curve-then-id order inside the source colors. Darlings picks the
 * alphabetically first owned legendary creature for W, U, B, R, G, and W/U,
 * then takes the first 79 legal singleton spells in curve-and-id order.
 */
export function buildReserveMatrixFleets(db: CardDb = CARD_DB): ReserveMatrixFleets {
  const save = buildReserveMatrixFullOwnershipSave(db);
  const warchest = STARTER_DECKS.map((source) => {
    const colors = colorsOfSource(source, db);
    const cards = fillToPlayset(source.cards, colors, db);
    const reserve = landReserve(colors, db);
    const name = `${source.name} Warchest`;
    assertLegal(name, validateWarchestDeck(db, save, cards, reserve));
    return {
      id: `${source.id}-warchest`,
      name,
      colors,
      cards,
      landReserve: reserve,
      darlingId: null,
    };
  });

  const darlings = DARLING_IDENTITIES.map((colors) => {
    const darling = selectDarling(colors, db);
    const cards = darlingsDeck(darling, db);
    const reserve = landReserve(darling.colors, db);
    const name = `${darling.name} [${darling.colors.join('') || 'C'}]`;
    assertLegal(name, validateDarlingsDeck(db, save, cards, darling.id, reserve));
    return {
      id: `darlings-${darling.id}`,
      name,
      colors: darling.colors,
      cards,
      landReserve: reserve,
      darlingId: darling.id,
    };
  });

  return { warchest, darlings };
}
