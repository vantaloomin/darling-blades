/**
 * Deterministic scripted first-cut reserve decks for the avatar roster.
 *
 * Warchest conversion keeps every legal nonland from the classic list in its
 * existing order, then raises retained ids toward the normal playset ceiling
 * in first-occurrence order. If that is still short, it adds catalog
 * singletons inside the avatar's printed colors: creatures sharing any subtype
 * already present in the source deck come first, then every other candidate;
 * both catalog groups are ordered by mana value and then card id.
 *
 * The land reserve keeps printed duals first (subject to the dual and playset
 * caps), then apportions the remaining slots over printed basics with largest-
 * remainder rounding. Printed nonbasic non-duals are ignored. A source with no
 * printed basics uses Plains, matching buildAiLandReserve's edge fallback.
 *
 * Darlings uses the avatar portrait when it is an exact-color legendary
 * creature, otherwise the first exact-color legendary creature in source-deck
 * order, otherwise the name-then-id selectDarling catalog rule. Its spell list
 * keeps each distinct eligible in-color source spell once (except the Darling)
 * and fills with in-color catalog singletons in curve-then-id order.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/config/rules';
import { CARD_DB } from '../src/data/catalog';
import { AVATARS, type Avatar } from '../src/data/opponents';
import type { CardDb, CardDef, Color } from '../src/engine/types';
import { validateDarlingsDeck, validateWarchestDeck } from '../src/meta/darlings';
import {
  DARLINGS_DECK_SIZE,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS,
  WARCHEST_DECK_SIZE,
  hasLandFetchBehavior,
  isBasicLand,
  isDualLand,
} from '../src/meta/warchest';
import { buildReserveMatrixFullOwnershipSave } from './reserveMatrixDecks';

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const satisfies readonly Color[];
const PLAINS_ID = 'land-plains';

export interface AvatarDarlingsConversion {
  darlingsDeck: string[];
  darlingId: string;
  sourceCardCount: number;
  catalogFillCount: number;
}

export interface AvatarReserveConversion extends AvatarDarlingsConversion {
  avatarId: string;
  colors: Color[];
  reserveDeck: string[];
  landReserve: string[];
  warchestAdditions: string[];
}

function cardManaValue(card: CardDef): number {
  if (!card.cost) return 0;
  return card.cost.generic + Object.values(card.cost.pips).reduce((total, pips) => total + pips, 0);
}

function byCurveThenId(db: CardDb, cards: readonly CardDef[]): CardDef[] {
  return [...cards].sort((a, b) => cardManaValue(a) - cardManaValue(b) || a.id.localeCompare(b.id));
}

function orderedColors(colors: readonly Color[]): Color[] {
  return COLOR_ORDER.filter((color) => colors.includes(color));
}

function sameColors(a: readonly Color[], b: readonly Color[]): boolean {
  const orderedA = orderedColors(a);
  const orderedB = orderedColors(b);
  return orderedA.length === orderedB.length && orderedA.every((color, index) => color === orderedB[index]);
}

function containsOnlyColors(card: CardDef, colors: readonly Color[]): boolean {
  return card.colors.every((color) => colors.includes(color));
}

function isEligibleSpell(card: CardDef | undefined): card is CardDef {
  return Boolean(card && !card.token && !card.types.includes('land') && !hasLandFetchBehavior(card));
}

function isLegendaryCreature(card: CardDef | undefined): card is CardDef {
  return Boolean(
    card &&
    !card.token &&
    card.types.includes('creature') &&
    (card.supertypes?.includes('legendary') ?? false) &&
    !hasLandFetchBehavior(card),
  );
}

/** Avatar colors are the WUBRG-ordered union printed by the source lands. */
export function avatarPrintedColors(avatar: Avatar, db: CardDb = CARD_DB): Color[] {
  const colors = new Set<Color>();
  for (const id of avatar.deck) {
    const card = db[id];
    if (!card?.types.includes('land')) continue;
    for (const color of card.manaAbility ?? []) colors.add(color);
  }
  return COLOR_ORDER.filter((color) => colors.has(color));
}

/** Convert one classic avatar list to the scripted 40-card Warchest first cut. */
export function convertAvatarWarchest(avatar: Avatar, db: CardDb = CARD_DB): string[] {
  const colors = avatarPrintedColors(avatar, db);
  const cards: string[] = [];
  const counts = new Map<string, number>();
  const add = (id: string): boolean => {
    if ((counts.get(id) ?? 0) >= RULES.maxCopies) return false;
    cards.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    return true;
  };

  for (const id of avatar.deck) {
    if (isEligibleSpell(db[id])) add(id);
  }
  if (cards.length > WARCHEST_DECK_SIZE) {
    throw new Error(`${avatar.name} retained ${cards.length} Warchest spells, over the ${WARCHEST_DECK_SIZE}-card target`);
  }

  const sourceOrder = [...new Set(cards)];
  for (const id of sourceOrder) {
    while (cards.length < WARCHEST_DECK_SIZE && add(id)) { /* raise retained id to its playset */ }
    if (cards.length === WARCHEST_DECK_SIZE) return cards;
  }

  const sourceSubtypes = new Set(
    sourceOrder.flatMap((id) => db[id]?.types.includes('creature') ? db[id].subtypes : []),
  );
  const catalog = byCurveThenId(
    db,
    Object.values(db).filter((card) =>
      isEligibleSpell(card) &&
      containsOnlyColors(card, colors) &&
      !sourceOrder.includes(card.id),
    ),
  );
  const sharesSourceSubtype = (card: CardDef): boolean =>
    card.types.includes('creature') && card.subtypes.some((subtype) => sourceSubtypes.has(subtype));
  const catalogOrder = [
    ...catalog.filter(sharesSourceSubtype),
    ...catalog.filter((card) => !sharesSourceSubtype(card)),
  ];
  for (const card of catalogOrder) {
    if (cards.length === WARCHEST_DECK_SIZE) break;
    add(card.id); // Catalog fill is singleton-first, matching reserveMatrixDecks.
  }
  if (cards.length !== WARCHEST_DECK_SIZE) {
    throw new Error(`${avatar.name} stopped at ${cards.length}/${WARCHEST_DECK_SIZE} Warchest spells`);
  }
  return cards;
}

interface LandCount {
  id: string;
  count: number;
  firstIndex: number;
}

function printedLandCounts(avatar: Avatar, db: CardDb): LandCount[] {
  const counts = new Map<string, LandCount>();
  avatar.deck.forEach((id, index) => {
    const card = db[id];
    if (!card?.types.includes('land')) return;
    const current = counts.get(id);
    if (current) current.count++;
    else counts.set(id, { id, count: 1, firstIndex: index });
  });
  return [...counts.values()].sort((a, b) => a.firstIndex - b.firstIndex);
}

/** Build the avatar's designed ten-land reserve from its printed land mix. */
export function deriveLandReserve(avatar: Avatar, db: CardDb = CARD_DB): string[] {
  const printed = printedLandCounts(avatar, db);
  const reserve: string[] = [];
  for (const entry of printed) {
    const card = db[entry.id];
    if (!card || !isDualLand(card)) continue;
    const copies = Math.min(
      entry.count,
      RULES.maxCopies,
      MAX_DUAL_LANDS - reserve.length,
      LAND_RESERVE_SIZE - reserve.length,
    );
    for (let i = 0; i < copies; i++) reserve.push(entry.id);
    if (reserve.length === MAX_DUAL_LANDS || reserve.length === LAND_RESERVE_SIZE) break;
  }

  const basicCounts = printed.filter((entry) => isBasicLand(db[entry.id]));
  const slots = LAND_RESERVE_SIZE - reserve.length;
  if (slots <= 0) return reserve;
  if (basicCounts.length === 0) {
    return [...reserve, ...Array.from({ length: slots }, () => PLAINS_ID)];
  }

  const basicTotal = basicCounts.reduce((total, entry) => total + entry.count, 0);
  const allocations = basicCounts.map((entry) => {
    const exact = slots * entry.count / basicTotal;
    return { ...entry, copies: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  const unallocated = slots - allocations.reduce((total, entry) => total + entry.copies, 0);
  const remainderOrder = [...allocations].sort((a, b) =>
    b.remainder - a.remainder || a.firstIndex - b.firstIndex || a.id.localeCompare(b.id),
  );
  for (let i = 0; i < unallocated; i++) remainderOrder[i].copies++;
  for (const entry of allocations.sort((a, b) => a.firstIndex - b.firstIndex)) {
    for (let i = 0; i < entry.copies; i++) reserve.push(entry.id);
  }
  return reserve;
}

function chooseDarling(avatar: Avatar, colors: readonly Color[], db: CardDb): CardDef {
  const portrait = db[avatar.portraitCardId];
  if (isLegendaryCreature(portrait) && sameColors(portrait.colors, colors)) return portrait;

  const sourceIds = [...new Set(avatar.deck)];
  const sourceDarling = sourceIds
    .map((id) => db[id])
    .find((card) => isLegendaryCreature(card) && sameColors(card.colors, colors));
  if (sourceDarling) return sourceDarling;

  const catalogDarling = Object.values(db)
    .filter((card) => isLegendaryCreature(card) && sameColors(card.colors, colors))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0];
  if (!catalogDarling) throw new Error(`${avatar.name} has no eligible Darling for colors ${colors.join('') || 'C'}`);
  return catalogDarling;
}

/** Convert one avatar to a 79-singleton spell list plus an external Darling. */
export function convertAvatarDarlings(
  avatar: Avatar,
  db: CardDb = CARD_DB,
): AvatarDarlingsConversion {
  const colors = avatarPrintedColors(avatar, db);
  const darling = chooseDarling(avatar, colors, db);
  const sourceCards = [...new Set(avatar.deck)].filter((id) => {
    const card = db[id];
    return id !== darling.id && isEligibleSpell(card) && containsOnlyColors(card, darling.colors);
  });
  const sourceSet = new Set(sourceCards);
  const catalog = byCurveThenId(
    db,
    Object.values(db).filter((card) =>
      card.id !== darling.id &&
      isEligibleSpell(card) &&
      containsOnlyColors(card, darling.colors) &&
      !sourceSet.has(card.id),
    ),
  ).map((card) => card.id);
  const darlingsDeck = [...sourceCards, ...catalog].slice(0, DARLINGS_DECK_SIZE);
  if (darlingsDeck.length !== DARLINGS_DECK_SIZE) {
    throw new Error(`${avatar.name} stopped at ${darlingsDeck.length}/${DARLINGS_DECK_SIZE} Darlings spells`);
  }
  return {
    darlingsDeck,
    darlingId: darling.id,
    sourceCardCount: sourceCards.length,
    catalogFillCount: DARLINGS_DECK_SIZE - sourceCards.length,
  };
}

function assertLegal(name: string, issues: readonly { message: string }[]): void {
  if (issues.length > 0) {
    throw new Error(`${name} failed reserve validation: ${issues.map((issue) => issue.message).join(' | ')}`);
  }
}

/** Build and validator-gate every new field for one avatar. */
export function convertAvatarReserveDecks(
  avatar: Avatar,
  db: CardDb = CARD_DB,
): AvatarReserveConversion {
  const reserveDeck = convertAvatarWarchest(avatar, db);
  const landReserve = deriveLandReserve(avatar, db);
  const darlings = convertAvatarDarlings(avatar, db);
  const save = buildReserveMatrixFullOwnershipSave(db);
  assertLegal(`${avatar.name} Warchest`, validateWarchestDeck(db, save, reserveDeck, landReserve));
  assertLegal(
    `${avatar.name} Darlings`,
    validateDarlingsDeck(db, save, darlings.darlingsDeck, darlings.darlingId, landReserve),
  );
  const retainedCounts = new Map<string, number>();
  for (const id of avatar.deck) {
    if (isEligibleSpell(db[id])) retainedCounts.set(id, (retainedCounts.get(id) ?? 0) + 1);
  }
  const warchestAdditions: string[] = [];
  for (const id of reserveDeck) {
    const retained = retainedCounts.get(id) ?? 0;
    if (retained > 0) retainedCounts.set(id, retained - 1);
    else warchestAdditions.push(id);
  }
  return {
    avatarId: avatar.id,
    colors: avatarPrintedColors(avatar, db),
    reserveDeck,
    landReserve,
    ...darlings,
    warchestAdditions,
  };
}

function quoted(id: string): string {
  return `'${id}'`;
}

function expandBlock(field: string, cards: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [
    `    ${field}: expand([`,
    ...[...counts].map(([id, count]) => `      [${quoted(id)}, ${count}],`),
    '    ]),',
  ];
}

/** Render paste-ready literal fields plus review counts for all 20 avatars. */
export function printAvatarReserveDecks(
  avatars: readonly Avatar[] = AVATARS,
  db: CardDb = CARD_DB,
): string {
  const conversions = avatars.map((avatar) => ({ avatar, converted: convertAvatarReserveDecks(avatar, db) }));
  const lines: string[] = [];
  for (const { avatar, converted } of conversions) {
    lines.push(`// ${avatar.id}: ${converted.colors.join('') || 'C'}; Darlings catalog fill ${converted.catalogFillCount}`);
    lines.push(...expandBlock('reserveDeck', converted.reserveDeck));
    lines.push(...expandBlock('landReserve', converted.landReserve));
    lines.push('    darlingsDeck: [');
    for (const id of converted.darlingsDeck) lines.push(`      ${quoted(id)},`);
    lines.push('    ],');
    lines.push(`    darlingId: ${quoted(converted.darlingId)},`);
    lines.push('');
  }
  lines.push('REVIEW SUMMARY');
  for (const { avatar, converted } of conversions) {
    const additions = converted.warchestAdditions.reduce((counts, id) => {
      counts.set(id, (counts.get(id) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
    lines.push(
      `${avatar.id}: Warchest additions ${[...additions].map(([id, count]) => `${id} x${count}`).join(', ') || 'none'}; ` +
      `Darling ${converted.darlingId}; Darlings source ${converted.sourceCardCount}, catalog fill ${converted.catalogFillCount}`,
    );
  }
  return lines.join('\n');
}

function main(): void {
  if (!process.argv.slice(2).includes('--print')) {
    console.error('Usage: npx tsx scripts/avatarReserveDecks.ts --print');
    process.exitCode = 1;
    return;
  }
  console.log(printAvatarReserveDecks());
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url)).toLowerCase()) main();
