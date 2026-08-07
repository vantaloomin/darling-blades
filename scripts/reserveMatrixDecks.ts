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
import {
  DARLINGS_DECK_SIZE,
  WARCHEST_DECK_SIZE,
  hasLandFetchBehavior,
  isBasicLand,
  isDualLand,
} from '../src/meta/warchest';
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

export interface WarchestTrimmedCards {
  deckId: string;
  deckName: string;
  removed: { cardId: string; cardName: string; count: number }[];
}

export interface WarchestTuningExclusion {
  deckId: string;
  deckName: string;
  colors: readonly Color[];
  reason: string;
}

export interface WarchestTuningField {
  decks: ReserveMatrixDeck[];
  trimmed: WarchestTrimmedCards[];
  excluded: WarchestTuningExclusion[];
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

export function buildLandReserve(colors: readonly Color[], db: CardDb = CARD_DB): string[] {
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

function costColors(card: CardDef): Color[] {
  return COLOR_ORDER.filter((color) => (card.cost?.pips[color] ?? 0) > 0);
}

function colorCombinations(size: number): Color[][] {
  const out: Color[][] = [];
  const visit = (start: number, chosen: Color[]): void => {
    if (chosen.length === size) {
      out.push(chosen.slice());
      return;
    }
    for (let i = start; i < COLOR_ORDER.length; i++) {
      chosen.push(COLOR_ORDER[i]);
      visit(i + 1, chosen);
      chosen.pop();
    }
  };
  visit(0, []);
  return out;
}

function rosterFrequencies(decks: readonly ReserveMatrixDeck[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const deck of decks) {
    for (const id of deck.cards) frequencies.set(id, (frequencies.get(id) ?? 0) + 1);
  }
  return frequencies;
}

function probeCandidates(
  colors: readonly Color[],
  frequencies: ReadonlyMap<string, number>,
  db: CardDb,
): string[] {
  return [...frequencies.keys()]
    .filter((id) => {
      const card = db[id];
      const identity = card ? costColors(card) : [];
      return isEligibleSpell(card) && identity.length > 0 && identity.every((color) => colors.includes(color));
    })
    .sort((a, b) =>
      (frequencies.get(b) ?? 0) - (frequencies.get(a) ?? 0) ||
      cardManaValue(db[a]) - cardManaValue(db[b]) ||
      a.localeCompare(b),
    );
}

function chooseProbeColors(
  colorCount: number,
  deckSize: number,
  frequencies: ReadonlyMap<string, number>,
  db: CardDb,
): Color[] {
  const choices = colorCombinations(colorCount)
    .map((colors) => {
      const candidates = probeCandidates(colors, frequencies, db);
      const coversEveryColor = colors.every((color) =>
        candidates.some((id) => costColors(db[id]).includes(color)),
      );
      const score = candidates.reduce((total, id) => total + (frequencies.get(id) ?? 0), 0);
      return { colors, candidates, coversEveryColor, score };
    })
    .filter((choice) => choice.coversEveryColor && choice.candidates.length * 4 >= deckSize)
    .sort((a, b) => b.score - a.score || a.colors.join('').localeCompare(b.colors.join('')));
  const best = choices[0];
  if (!best) {
    throw new Error(`Reserve matrix could not derive a ${colorCount}-color ${deckSize}-card probe`);
  }
  return best.colors;
}

/**
 * Build one color-count goodstuff probe from cards already played by the five
 * Warchest matrix decks. The identity is the WUBRG-ordered color combination
 * with the largest total source-roster frequency (lexical identity breaks
 * ties). Filling cycles its color buckets in WUBRG order; each bucket greedily
 * takes the most-played compatible card, then lower mana value, then card id,
 * with the normal four-copy ceiling.
 */
export function buildWarchestColorProbe(
  colorCount: 1 | 2 | 3 | 5,
  deckSize: number,
  sourceDecks: readonly ReserveMatrixDeck[],
  db: CardDb = CARD_DB,
): ReserveMatrixDeck {
  const frequencies = rosterFrequencies(sourceDecks);
  const colors = chooseProbeColors(colorCount, deckSize, frequencies, db);
  const candidates = probeCandidates(colors, frequencies, db);
  const byColor = new Map<Color, string[]>();
  for (const color of colors) {
    byColor.set(color, candidates.filter((id) => costColors(db[id]).includes(color)));
  }

  const cards: string[] = [];
  const counts = new Map<string, number>();
  while (cards.length < deckSize) {
    let progressed = false;
    for (const color of colors) {
      if (cards.length === deckSize) break;
      const id = byColor.get(color)?.find((candidate) => (counts.get(candidate) ?? 0) < 4);
      if (!id) continue;
      cards.push(id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      progressed = true;
    }
    if (!progressed) break;
  }
  for (const id of candidates) {
    while (cards.length < deckSize && (counts.get(id) ?? 0) < 4) {
      cards.push(id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  if (cards.length !== deckSize) {
    throw new Error(`Reserve matrix probe [${colors.join('')}] stopped at ${cards.length}/${deckSize} cards`);
  }

  return {
    id: `warchest-probe-${colorCount}c-${colors.join('').toLowerCase()}-${deckSize}`,
    name: `${colorCount}-color goodstuff [${colors.join('')}]`,
    colors,
    cards,
    landReserve: buildLandReserve(colors, db),
    darlingId: null,
  };
}

/**
 * Deterministically shorten one baseline list without changing its unique-card
 * set or color identity. Each removal pass considers only duplicated ids and
 * removes one copy from highest mana value downward; ties prefer the current
 * larger playset, then card id. Because no id is reduced below one copy, every
 * original curve point and colored spell represented in the 50-card list is
 * still represented in the 40-card list.
 */
export function trimWarchestDeck(
  deck: ReserveMatrixDeck,
  targetSize: number,
  db: CardDb = CARD_DB,
): { deck: ReserveMatrixDeck; trimmed: WarchestTrimmedCards } {
  if (!Number.isInteger(targetSize) || targetSize <= 0 || targetSize > deck.cards.length) {
    throw new Error(`Cannot trim ${deck.name} from ${deck.cards.length} to ${targetSize} cards`);
  }
  const cards = deck.cards.slice();
  const removed = new Map<string, number>();
  while (cards.length > targetSize) {
    const counts = new Map<string, number>();
    for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    const candidate = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort(([a, aCount], [b, bCount]) =>
        cardManaValue(db[b]) - cardManaValue(db[a]) ||
        bCount - aCount ||
        a.localeCompare(b),
      )[0]?.[0];
    if (!candidate) {
      throw new Error(`${deck.name} has no duplicate left while trimming to ${targetSize}`);
    }
    cards.splice(cards.lastIndexOf(candidate), 1);
    removed.set(candidate, (removed.get(candidate) ?? 0) + 1);
  }
  return {
    deck: { ...deck, cards },
    trimmed: {
      deckId: deck.id,
      deckName: deck.name,
      removed: [...removed.entries()]
        .map(([cardId, count]) => ({ cardId, cardName: db[cardId]?.name ?? cardId, count }))
        .sort((a, b) => a.cardId.localeCompare(b.cardId)),
    },
  };
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
  if (candidates.length < DARLINGS_DECK_SIZE) {
    throw new Error(`Reserve matrix could not derive ${DARLINGS_DECK_SIZE} singleton spells for ${darling.name}`);
  }
  return candidates.slice(0, DARLINGS_DECK_SIZE);
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
    const reserve = buildLandReserve(colors, db);
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
    const reserve = buildLandReserve(darling.colors, db);
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

/**
 * Build one validator-gated tuning field. The four probes are first authored as
 * canonical 50-card lists from the same source roster; 40-card configs pass
 * both roster and probes through the identical duplicate-only trim rule. A
 * capped-incompatible deck is returned as an explicit exclusion, while every
 * other validation issue fails loudly.
 */
export function buildWarchestTuningField(
  deckSize: 40 | 50,
  maxReserveColors?: number,
  db: CardDb = CARD_DB,
): WarchestTuningField {
  const save = buildReserveMatrixFullOwnershipSave(db);
  const roster = buildReserveMatrixFleets(db).warchest;
  const probes = ([1, 2, 3, 5] as const).map((colorCount) =>
    buildWarchestColorProbe(colorCount, WARCHEST_DECK_SIZE, roster, db),
  );
  const trimmed: WarchestTrimmedCards[] = [];
  const candidates = [...roster, ...probes].map((deck) => {
    if (deckSize === WARCHEST_DECK_SIZE) return deck;
    const result = trimWarchestDeck(deck, deckSize, db);
    trimmed.push(result.trimmed);
    return result.deck;
  });

  const decks: ReserveMatrixDeck[] = [];
  const excluded: WarchestTuningExclusion[] = [];
  for (const deck of candidates) {
    const issues = validateWarchestDeck(db, save, deck.cards, deck.landReserve, {
      deckSize,
      ...(maxReserveColors === undefined ? {} : { maxReserveColors }),
    });
    if (maxReserveColors !== undefined && deck.colors.length > maxReserveColors) {
      if (issues.length === 0) {
        throw new Error(`${deck.name} exceeded cap ${maxReserveColors} without a validator issue`);
      }
      excluded.push({
        deckId: deck.id,
        deckName: deck.name,
        colors: deck.colors,
        reason: issues.map((issue) => issue.message).join(' | '),
      });
      continue;
    }
    assertLegal(deck.name, issues);
    decks.push(deck);
  }
  return { decks, trimmed, excluded };
}
