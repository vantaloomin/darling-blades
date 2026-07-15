import { createRngState, rngShuffle } from '../engine/rng';
import type { CardDb, CardDef, Color, Keyword } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import { TIER_RANK } from './variants';

const COLOR_ORDER: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
// Mirrors Limited.ts's DRAFT_SEATS — importing it would create a real cycle
// (Limited imports this module). A cross-module test pins the two in agreement
// (tests/meta/draftPersonas.test.ts, seat-assignment spec).
const DRAFT_SEATS = 8;
const CHAOS_SCORE_SCALE = 100;

/**
 * Tunable draft heuristics. DEFAULT_PICKER reproduces Limited.ts's original
 * scoreDraftCard/scoreBaseCard arithmetic exactly; persona hooks are neutral at
 * those defaults so roster edits cannot change the textbook drafter by accident.
 */
export interface PickerProfile {
  rarityWeight: number;
  colorLoyalty: number;
  commitAfter: number;
  forcedColors?: Color[];
  creatureWeight: number;
  spellWeight: number;
  permanentWeight: number;
  removalWeight: number;
  cardAdvWeight: number;
  curveWeight: number;
  bigStuffBias: number;
  cheapBias: number;
  statBias: number;
  keywordWeight: number;
  keywordPrefs?: Keyword[];
  subtypeWeight: number;
  subtypePrefs?: string[];
  legendWeight: number;
  tokenWeight: number;
  lifeGainWeight: number;
  graveyardWeight: number;
  chaos: number;
}

export const DEFAULT_PICKER: Readonly<PickerProfile> = Object.freeze({
  rarityWeight: 4,
  colorLoyalty: 1,
  commitAfter: 5,
  creatureWeight: 5,
  spellWeight: 4,
  permanentWeight: 2,
  removalWeight: 5,
  cardAdvWeight: 3,
  curveWeight: 1,
  bigStuffBias: 0,
  cheapBias: 0,
  statBias: 0,
  keywordWeight: 1.5,
  subtypeWeight: 0,
  legendWeight: 0,
  tokenWeight: 0,
  lifeGainWeight: 0,
  graveyardWeight: 0,
  chaos: 0,
});

/** Merge partial draft preferences over the lockstep-neutral profile. */
export function makePicker(overrides: Partial<PickerProfile> = {}): PickerProfile {
  return { ...DEFAULT_PICKER, ...overrides };
}

/** Score one candidate without consuming or sharing RNG state. */
export function scorePick(
  db: CardDb,
  cardId: string,
  picks: readonly string[],
  profile: PickerProfile,
  noise01: number,
): number {
  const d = def(db, cardId);
  let score = scoreBasePick(d, profile);
  const committed = profile.forcedColors?.length ? profile.forcedColors : committedColors(db, picks);

  if (picks.length >= profile.commitAfter && d.colors.length > 0) {
    const overlap = d.colors.filter((color) => committed.includes(color)).length;
    if (overlap === d.colors.length) score += 5 * profile.colorLoyalty;
    else if (overlap > 0) score += profile.colorLoyalty;
    else score -= 7 * profile.colorLoyalty;
  }
  if (isType(d, 'land') && !d.supertypes?.includes('basic')) {
    const mana = d.manaAbility ?? [];
    score += (mana.some((color) => committed.includes(color)) ? 4 : 1) * profile.colorLoyalty;
  }

  const chaos = Math.max(0, Math.min(1, profile.chaos));
  // Original scores are roughly 0-40. At chaos=1 the 0-100 noise term fully
  // replaces card evaluation, so deterministic noise can overturn any normal gap.
  return score * (1 - chaos) + clampNoise(noise01) * CHAOS_SCORE_SCALE * chaos;
}

/** Pure stable hash for a seat/card decision, mapped to [0, 1). */
export function pickNoise(seed: number, seat: number, packIndex: number, pickIndex: number, cardId: string): number {
  let h = 0x811c9dc5;
  const mixInt = (value: number): void => {
    h ^= value >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  mixInt(seed);
  mixInt(seat);
  mixInt(packIndex);
  mixInt(pickIndex);
  for (let i = 0; i < cardId.length; i++) mixInt(cardId.charCodeAt(i));
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Seat the human at 0 and seven distinct seeded personas at seats 1-7. */
export function assignDraftPersonas(seed: number, rosterIds: readonly string[]): string[] {
  const uniqueIds = [...new Set(rosterIds)];
  if (uniqueIds.length < DRAFT_SEATS - 1) throw new Error('Draft persona roster needs at least 7 unique ids');
  const shuffled = rngShuffle(createRngState(seed >>> 0), uniqueIds);
  return ['', ...shuffled.slice(0, DRAFT_SEATS - 1)];
}

/** Base card quality before pick-history color commitment and chaos. */
export function scoreBasePick(d: CardDef, profile: PickerProfile): number {
  let score = TIER_RANK[d.rarity] * profile.rarityWeight;
  const mv = manaValue(d.cost);
  const ops = d.abilities?.flatMap((ability) => ability.ops ?? []) ?? [];

  if (isType(d, 'creature')) {
    const attackWeight = 1.2 + profile.statBias * 0.8;
    const defenseWeight = 0.8 - profile.statBias * 0.8;
    score += profile.creatureWeight + (d.attack ?? 0) * attackWeight + (d.defense ?? 0) * defenseWeight;
    const keywords = d.keywords ?? [];
    const preferredKeywords = profile.keywordPrefs?.length
      ? keywords.filter((keyword) => profile.keywordPrefs!.includes(keyword)).length
      : keywords.length;
    score += keywords.length * 1.5 + preferredKeywords * (profile.keywordWeight - 1.5);
  } else if (isType(d, 'charm') || isType(d, 'ritual')) {
    score += profile.spellWeight;
  } else if (isType(d, 'enchantment') || isType(d, 'artifact')) {
    score += profile.permanentWeight;
  }

  if (ops.some((op) => op.op === 'destroy' || op.op === 'damage' || op.op === 'cancel')) {
    score += profile.removalWeight;
  }
  if (ops.some((op) => op.op === 'draw' || op.op === 'raise' || op.op === 'reclaim')) {
    score += profile.cardAdvWeight;
  }
  score += ops.reduce((sum, op) => sum + (op.op === 'createToken' ? op.count : 0), 0) * profile.tokenWeight;
  score += ops.filter((op) => op.op === 'gainLife').length * profile.lifeGainWeight;
  score += ops.filter((op) => op.op === 'raise' || op.op === 'grind' || op.op === 'reclaim').length * profile.graveyardWeight;

  const preferredSubtypes = profile.subtypePrefs?.length
    ? d.subtypes.filter((subtype) => profile.subtypePrefs!.includes(subtype)).length
    : d.subtypes.length;
  score += preferredSubtypes * profile.subtypeWeight;
  if (d.supertypes?.includes('legendary')) score += profile.legendWeight;
  if (mv >= 2 && mv <= 4) score += 2 * profile.curveWeight;
  if (mv >= 7) score -= 3 * profile.curveWeight;
  if (!isType(d, 'land')) {
    score += Math.max(0, mv - 5) * profile.bigStuffBias;
    score += Math.max(0, 4 - mv) * profile.cheapBias;
  }
  return score;
}

function committedColors(db: CardDb, picks: readonly string[]): Color[] {
  if (picks.length === 0) return [];
  const scores = new Map<Color, number>();
  for (const color of COLOR_ORDER) scores.set(color, 0);
  for (const id of picks) {
    const d = def(db, id);
    if (d.token || isType(d, 'land')) continue;
    for (const color of d.colors) scores.set(color, (scores.get(color) ?? 0) + 1 + TIER_RANK[d.rarity]);
  }
  return COLOR_ORDER.filter((color) => (scores.get(color) ?? 0) > 0)
    .sort(
      (a, b) =>
        (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b),
    )
    .slice(0, 2);
}

function clampNoise(noise01: number): number {
  if (!Number.isFinite(noise01)) return 0;
  return Math.max(0, Math.min(1 - Number.EPSILON, noise01));
}
