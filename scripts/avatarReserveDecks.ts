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
import { isLiveCollectible } from '../src/data/liveness';
import { AVATARS, type Avatar } from '../src/data/opponents';
import { STARTER_DECKS } from '../src/data/starterDecks';
import type { CardDb, CardDef, Color, TargetSpec } from '../src/engine/types';
import { validateDarlingsDeck, validateWarchestDeck } from '../src/meta/darlings';
import {
  DARLINGS_DECK_SIZE,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS,
  WARCHEST_DECK_SIZE,
  isBasicLand,
  isDualLand,
} from '../src/meta/warchest';
import { buildReserveMatrixFullOwnershipSave } from './reserveMatrixDecks';
// qualityScore lives with the Darlings builder (no cycle: that module does not
// import this one). Both fills rank by the same notion of designed power.
import { qualityScore } from './darlingsDeckBuilder';

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
  return Boolean(card && isLiveCollectible(card) && !card.types.includes('land'));
}

/**
 * Target predicates that a creature-shaped format can genuinely fail to
 * satisfy. `creature`, `any`, `yourCreature`, `yourGraveCreature` and `spell`
 * are effectively always live here; artifacts and enchantments are not.
 */
const NARROW_TARGETS: Record<TargetSpec['what'], boolean> = {
  creature: false,
  player: false,
  any: false,
  spell: false,
  yourCreature: false,
  yourGraveCreature: false,
  artifact: true,
  enchantment: true,
  artifactOrEnchantment: true,
};

function narrowTargetsOf(card: CardDef): TargetSpec['what'][] {
  return (card.abilities ?? []).flatMap((ability) =>
    (ability.targets ?? []).map((target) => target.what),
  ).filter((what) => NARROW_TARGETS[what]);
}

/** Which narrow predicates a single card can satisfy as a permanent on board. */
function suppliedTargets(card: CardDef | undefined): string[] {
  if (!card) return [];
  const supplied: string[] = [];
  if (card.types.includes('artifact')) supplied.push('artifact', 'artifactOrEnchantment');
  if (card.types.includes('enchantment')) supplied.push('enchantment', 'artifactOrEnchantment');
  return supplied;
}

/**
 * What the FORMAT can put on the board: the five starter reserve builds this
 * avatar is measured against, plus the avatar's own source list.
 *
 * Retention eligibility used to ask only "is this a legal nonland?", never
 * "can this card's target ever exist?". That shipped `sd-strike-the-lintel` x4
 * - which targets artifactOrEnchantment - into Anubis against five starter
 * columns holding ZERO artifacts and ZERO enchantments: four cards blank in
 * 100% of her games, and a 33% win rate that took a hand-tune to repair. The
 * fault was never specific to her; it can hit ANY avatar whose classic list
 * carried narrow removal.
 */
function formatTargetSupply(source: readonly string[], db: CardDb): ReadonlySet<string> {
  const supply = new Set<string>();
  for (const deck of STARTER_DECKS) {
    for (const id of deck.reserveCards ?? []) for (const what of suppliedTargets(db[id])) supply.add(what);
  }
  for (const id of source) for (const what of suppliedTargets(db[id])) supply.add(what);
  return supply;
}

/**
 * A card is DEAD when it has narrow target specs and none of those target
 * categories is supplied by this format. Mixed narrow-plus-broad multi-ability
 * cards remain an open authoring question: a broad target never rescues an
 * otherwise unsupplied narrow target under this contract.
 */
export function hasNoLegalTargets(
  card: CardDef | undefined,
  supply: ReadonlySet<string>,
): boolean {
  if (!card) return false;
  const narrow = narrowTargetsOf(card);
  if (narrow.length === 0) return false;
  return !narrow.some((what) => supply.has(what));
}

function isLegendaryCreature(card: CardDef | undefined): card is CardDef {
  return Boolean(
    card &&
    isLiveCollectible(card) &&
    card.types.includes('creature') &&
    (card.supertypes?.includes('legendary') ?? false),
  );
}

/** Avatar colors are the WUBRG-ordered union printed by the source lands. */
/**
 * Any classic 60-card list this converter can make reserve-native. Avatars
 * satisfy it structurally; starters map their `cards` onto `deck`.
 */
export interface ConvertibleDeck {
  id: string;
  name: string;
  deck: readonly string[];
  /** Avatars keep their portrait card in the Warchest list; starters have none. */
  portraitCardId?: string;
}

export function avatarPrintedColors(avatar: ConvertibleDeck, db: CardDb = CARD_DB): Color[] {
  const colors = new Set<Color>();
  for (const id of avatar.deck) {
    const card = db[id];
    if (!card?.types.includes('land')) continue;
    for (const color of card.manaAbility ?? []) colors.add(color);
  }
  return COLOR_ORDER.filter((color) => colors.has(color));
}

/** Convert one classic avatar list to the scripted 40-card Warchest first cut. */
export function convertAvatarWarchest(avatar: ConvertibleDeck, db: CardDb = CARD_DB): string[] {
  const colors = avatarPrintedColors(avatar, db);
  const cards: string[] = [];
  const counts = new Map<string, number>();
  const add = (id: string): boolean => {
    if ((counts.get(id) ?? 0) >= RULES.maxCopies) return false;
    cards.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    return true;
  };

  /*
   * CURVE BUDGET (added 2026-08-09). Retaining every nonland from a classic
   * list keeps a top-heavy deck top-heavy, and reserve formats punish that
   * hard: Valhalla's Muster measured 26.4% head-to-head while mulliganing
   * 79.3% of its games, and Hel needed the same fix by hand. A classic deck
   * spends ~24 slots on lands it no longer needs, so it can afford to be
   * choosy. Expensive copies past the budget are dropped and the freed slots
   * go to cheap spells, exactly the hand-tuning that lifted Hel and Morgan.
   */
  const CURVE_CAP: Record<number, number> = { 1: 99, 2: 99, 3: 99, 4: 10, 5: 4, 6: 2 };
  const curveKey = (mv: number): number => Math.min(Math.max(mv, 1), 6);
  const curveUsed: Record<number, number> = {};
  const withinCurve = (id: string): boolean => {
    const key = curveKey(cardManaValue(db[id]));
    return (curveUsed[key] ?? 0) < CURVE_CAP[key];
  };
  const addCurved = (id: string): boolean => {
    if (!withinCurve(id)) return false;
    if (!add(id)) return false;
    const key = curveKey(cardManaValue(db[id]));
    curveUsed[key] = (curveUsed[key] ?? 0) + 1;
    return true;
  };

  // Retention is gated on the card having a target that can EXIST here, not
  // merely on it being a legal nonland. See formatTargetSupply for the defect
  // this closes. The freed slots refill through the normal playset-and-catalog
  // path below, so a dropped dead card becomes a real card rather than a hole.
  const targetSupply = formatTargetSupply(avatar.deck, db);
  for (const id of avatar.deck) {
    if (!isEligibleSpell(db[id])) continue;
    if (hasNoLegalTargets(db[id], targetSupply)) continue;
    addCurved(id);
  }
  if (cards.length > WARCHEST_DECK_SIZE) {
    throw new Error(`${avatar.name} retained ${cards.length} Warchest spells, over the ${WARCHEST_DECK_SIZE}-card target`);
  }

  // Raise retained ids to playsets cheapest-first, so the freed expensive
  // slots refill at the bottom of the curve rather than the top.
  const sourceOrder = [...new Set(cards)].sort(
    (a, b) => cardManaValue(db[a]) - cardManaValue(db[b]) || a.localeCompare(b),
  );
  for (const id of sourceOrder) {
    while (cards.length < WARCHEST_DECK_SIZE && addCurved(id)) { /* raise to playset */ }
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
      !hasNoLegalTargets(card, targetSupply) &&
      !sourceOrder.includes(card.id),
    ),
  );
  const sharesSourceSubtype = (card: CardDef): boolean =>
    card.types.includes('creature') && card.subtypes.some((subtype) => sourceSubtypes.has(subtype));
  /*
   * QUALITY-LED FILL (2026-08-09). Curve-then-id order took whatever was
   * cheapest alphabetically, and a subtype match jumped the queue regardless
   * of strength. The same quality-over-theme correction that lifted the
   * Darlings hard band from 61% to 70% applies here: rank by designed power
   * (rate per mana, keywords, effects, rarity), let a shared subtype nudge
   * ties, and let the curve budget above decide what fits.
   */
  const catalogOrder = [...catalog].sort((a, b) => {
    const scoreA = qualityScore(a) + (sharesSourceSubtype(a) ? 1.0 : 0);
    const scoreB = qualityScore(b) + (sharesSourceSubtype(b) ? 1.0 : 0);
    return scoreB - scoreA || cardManaValue(a) - cardManaValue(b) || a.id.localeCompare(b.id);
  });
  // Catalog fill is singleton-first, matching reserveMatrixDecks, and is
  // curve-bounded too: a tribal five-drop must not jump the queue ahead of a
  // two-drop just because it shares a subtype, which is how Valhalla's Muster
  // ended up with seven cheap cards out of forty.
  for (const card of catalogOrder) {
    if (cards.length === WARCHEST_DECK_SIZE) break;
    addCurved(card.id);
  }
  // Last resort so the deck always reaches its size, even in a colour whose
  // cheap catalog is thin. Only reached if the curve budget cannot be met.
  for (const card of catalogOrder) {
    if (cards.length === WARCHEST_DECK_SIZE) break;
    add(card.id);
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

function printedLandCounts(avatar: ConvertibleDeck, db: CardDb): LandCount[] {
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
export function deriveLandReserve(avatar: ConvertibleDeck, db: CardDb = CARD_DB): string[] {
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

function chooseDarling(avatar: ConvertibleDeck, colors: readonly Color[], db: CardDb): CardDef {
  const portrait = avatar.portraitCardId ? db[avatar.portraitCardId] : undefined;
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
  avatar: ConvertibleDeck,
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
  avatar: ConvertibleDeck,
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
