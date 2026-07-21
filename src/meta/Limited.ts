import { ECONOMY } from '../config/rules';
import { DRAFT_PERSONAS, draftPersonaById } from '../data/draftPersonas';
import { createRngState, rngInt, type RngState } from '../engine/rng';
import type { CardDb, CardDef, Color, Rarity } from '../engine/types';
import { def, isType } from '../engine/types';
import { addCard, isBasic, type AddResult } from './Collection';
import { LIMITED_DECK_SIZE, validateLimitedDeck } from './DeckStorage';
import {
  assignDraftPersonas,
  DEFAULT_PICKER,
  pickNoise,
  scoreBasePick,
  scorePick,
  type PickerProfile,
} from './draftPicker';
import { packPool } from './PackOpener';
import type { SaveData } from './SaveManager';
import { PLAIN_VARIANT, rollFrame, rollHolo, rollTier, TIER_RANK, type CardVariant } from './variants';

export type LimitedMode = 'draft';
export type LimitedRunStatus = 'draft' | 'build' | 'matches';
export type LimitedDeckStyle = 'mono' | 'dual' | 'other';
export type LimitedDifficulty = 'easy' | 'medium' | 'hard';

export const LIMITED_MATCHES = 3;
export const DRAFT_SEATS = 8;
export const DRAFT_PACKS = 3;

const COLOR_ORDER: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
const DRAFT_PACK_DIRECTIONS: readonly ('left' | 'right')[] = ['left', 'right', 'left'];
const LIMITED_TIER_FALLBACK: Record<Rarity, Rarity | null> = {
  ur: 'ssr',
  ssr: 'sr',
  sr: 'r',
  r: 'c',
  c: null,
};

export interface DraftState {
  seed: number;
  personaIds: string[];
  packIndex: number;
  pickIndex: number;
  packs: string[][][];
  currentPacks: string[][];
  picks: string[][];
  /** Premium-only variants aligned slot-for-slot with `packs`. */
  packVariants?: CardVariant[][][];
  /** Premium-only variants aligned slot-for-slot with `currentPacks`. */
  currentPackVariants?: CardVariant[][];
  /** Premium-only variants aligned with the human's `picks[0]` row. */
  pickVariants?: CardVariant[];
  completed: boolean;
}

export interface LimitedRun {
  id: string;
  mode: LimitedMode;
  seed: number;
  startedAt: number;
  status: LimitedRunStatus;
  pool: string[];
  deck: string[];
  wins: number;
  losses: number;
  matchIndex: number;
  opponentSeeds: number[];
  opponentDecks: string[][];
  /** Absent/false is the unchanged free draft. */
  premium?: boolean;
  draft?: DraftState;
}

export interface LimitedDuelData {
  difficulty: LimitedDifficulty;
  deckOverride: string[];
  oppDeckOverride: string[];
  seedOverride: number;
  limited: { runId: string; mode: LimitedMode; matchIndex: number; opponentPersonaId?: string };
}

export interface LimitedHistoryEntry {
  id: string;
  /** Legacy sealed entries remain inert so loading and re-saving old blobs is lossless. */
  mode: LimitedMode | 'sealed';
  seed: number;
  wins: number;
  losses: number;
  deckStyle: LimitedDeckStyle;
  completedAt: number;
  rewardGold: number;
  premium?: boolean;
}

export interface LimitedState {
  activeRun: LimitedRun | null;
  history: LimitedHistoryEntry[];
  /** Legacy sealed record retained only when an old save already contains it. */
  bestSealedWins?: number;
  bestDraftWins: number;
  /**
   * Familiarity: how many drafts the player has COMPLETED (all 45 picks) with
   * each persona seated at the table. Drives the progressive identity reveal —
   * retiring mid-draft teaches nothing, so knowledge can't be farmed by
   * start-retire loops.
   */
  personaSeen: Record<string, number>;
}

export function freshLimitedState(): LimitedState {
  return { activeRun: null, history: [], bestDraftWins: 0, personaSeen: {} };
}

/**
 * Reveal tiers (user-directed 2026-07-14): what the player knows about a
 * persona, by completed drafts together — the CURRENT run counts as one, so
 * a first meeting already shows tier 1.
 *   1 name + portrait · 2 + color preference · 3 + theme (title) · 4 full profile
 */
export type PersonaRevealTier = 1 | 2 | 3 | 4;

export function personaRevealTier(state: Pick<LimitedState, 'personaSeen'>, personaId: string): PersonaRevealTier {
  const seen = state.personaSeen?.[personaId] ?? 0;
  return Math.max(1, Math.min(4, seen + 1)) as PersonaRevealTier;
}

/** Count a completed draft for every persona seated in the run (idempotence is the caller's job — call exactly once, when the draft completes). */
export function recordDraftEncounters(state: Pick<LimitedState, 'personaSeen'>, run: LimitedRun): void {
  if (!run.draft) return;
  for (const id of run.draft.personaIds) {
    if (!id) continue;
    state.personaSeen[id] = (state.personaSeen[id] ?? 0) + 1;
  }
}

export function clampLimitedSeed(seed: number): number {
  const n = Math.trunc(Number.isFinite(seed) ? seed : 1) & 0x7fffffff;
  return n === 0 ? 1 : n;
}

export function limitedDifficultyForMatch(matchIndex: number): LimitedDifficulty {
  return matchIndex <= 0 ? 'easy' : matchIndex === 1 ? 'medium' : 'hard';
}

export function limitedMatchSeed(run: Pick<LimitedRun, 'seed' | 'matchIndex' | 'opponentSeeds'>): number {
  const salt = run.opponentSeeds[run.matchIndex] ?? (0x51f15e + run.matchIndex * 0x10001);
  return clampLimitedSeed((run.seed ^ salt ^ Math.imul(run.matchIndex + 1, 0x9e3779b9)) >>> 0);
}

export function limitedDuelData(run: LimitedRun): LimitedDuelData {
  return {
    difficulty: limitedDifficultyForMatch(run.matchIndex),
    deckOverride: [...run.deck],
    oppDeckOverride: [...(run.opponentDecks[run.matchIndex] ?? run.opponentDecks[0] ?? [])],
    seedOverride: limitedMatchSeed(run),
    limited: {
      runId: run.id,
      mode: run.mode,
      matchIndex: run.matchIndex,
      opponentPersonaId: run.draft?.personaIds[run.matchIndex + 1],
    },
  };
}

export function currentDraftPack(state: DraftState): string[] {
  return state.currentPacks[0] ?? [];
}

export function draftDirection(packIndex: number): 'left' | 'right' {
  return DRAFT_PACK_DIRECTIONS[packIndex] ?? 'left';
}

export function rollLimitedPack(
  db: CardDb,
  seed: number,
  set?: CardDef['set'],
): string[] {
  return rollLimitedPackWithRng(db, createRngState(clampLimitedSeed(seed)), set);
}

export function startDraftRun(
  db: CardDb,
  seed: number,
  now: number,
  options: { premium?: boolean } = {},
): LimitedRun {
  const runSeed = clampLimitedSeed(seed);
  return {
    id: limitedRunId(runSeed, now),
    mode: 'draft',
    seed: runSeed,
    startedAt: now,
    status: 'draft',
    pool: [],
    deck: [],
    wins: 0,
    losses: 0,
    matchIndex: 0,
    opponentSeeds: [0, 1, 2].map((i) => clampLimitedSeed((runSeed ^ Math.imul(i + 11, 0x27d4eb2d)) >>> 0)),
    opponentDecks: [],
    ...(options.premium ? { premium: true } : {}),
    draft: startBotDraft(db, runSeed, options),
  };
}

export function startBotDraft(db: CardDb, seed: number, options: { premium?: boolean } = {}): DraftState {
  const runSeed = clampLimitedSeed(seed);
  const rng = createRngState(runSeed);
  const packs: string[][][] = [];
  const packVariants: CardVariant[][][] = [];
  for (let pack = 0; pack < DRAFT_PACKS; pack++) {
    const round: string[][] = [];
    const roundVariants: CardVariant[][] = [];
    for (let seat = 0; seat < DRAFT_SEATS; seat++) {
      if (options.premium) {
        const rolled = rollPremiumLimitedPackWithRng(db, rng);
        round.push(rolled.cards);
        roundVariants.push(rolled.variants);
      } else {
        round.push(rollLimitedPackWithRng(db, rng));
      }
    }
    packs.push(round);
    if (options.premium) packVariants.push(roundVariants);
  }
  return {
    seed: runSeed,
    personaIds: assignDraftPersonas(
      runSeed,
      DRAFT_PERSONAS.map((persona) => persona.id),
    ),
    packIndex: 0,
    pickIndex: 0,
    packs,
    currentPacks: packs[0].map((pack) => [...pack]),
    picks: Array.from({ length: DRAFT_SEATS }, () => []),
    ...(options.premium
      ? {
          packVariants,
          currentPackVariants: packVariants[0].map((variants) => variants.map(copyVariant)),
          pickVariants: [],
        }
      : {}),
    completed: false,
  };
}

export function pickDraftCard(db: CardDb, state: DraftState, cardId: string, cardIndex?: number): DraftState {
  if (state.completed) return state;
  const playerPack = state.currentPacks[0] ?? [];
  if (!playerPack.includes(cardId)) throw new Error(`Draft pack does not contain ${cardId}`);

  const picks = state.picks.map((seat) => [...seat]);
  const currentPacks = state.currentPacks.map((pack) => [...pack]);
  const currentPackVariants = state.currentPackVariants?.map((variants) => variants.map(copyVariant));
  const pickedVariant = removeDraftSlot(currentPacks[0], currentPackVariants?.[0], cardId, cardIndex);
  const pickVariants = state.pickVariants?.map(copyVariant);
  picks[0].push(cardId);
  if (pickVariants && pickedVariant) pickVariants.push(pickedVariant);

  for (let seat = 1; seat < DRAFT_SEATS; seat++) {
    const pack = currentPacks[seat];
    if (pack.length === 0) continue;
    const profile = draftPersonaById(state.personaIds[seat] ?? '')?.picker ?? DEFAULT_PICKER;
    const chosen = chooseBotDraftPick(db, pack, picks[seat], profile, (cardId) =>
      pickNoise(state.seed, seat, state.packIndex, state.pickIndex, cardId),
    );
    removeDraftSlot(pack, currentPackVariants?.[seat], chosen);
    picks[seat].push(chosen);
  }

  const nextPickIndex = state.pickIndex + 1;
  if (nextPickIndex >= ECONOMY.limitedPackSize) {
    const nextPackIndex = state.packIndex + 1;
    if (nextPackIndex >= DRAFT_PACKS) {
      return {
        ...state,
        picks,
        currentPacks: Array.from({ length: DRAFT_SEATS }, () => []),
        ...(currentPackVariants
          ? { currentPackVariants: Array.from({ length: DRAFT_SEATS }, () => [] as CardVariant[]), pickVariants }
          : {}),
        completed: true,
      };
    }
    return {
      ...state,
      packIndex: nextPackIndex,
      pickIndex: 0,
      picks,
      currentPacks: state.packs[nextPackIndex].map((pack) => [...pack]),
      ...(currentPackVariants
        ? {
            currentPackVariants: state.packVariants![nextPackIndex].map((variants) => variants.map(copyVariant)),
            pickVariants,
          }
        : {}),
    };
  }

  return {
    ...state,
    pickIndex: nextPickIndex,
    picks,
    currentPacks: passDraftPacks(currentPacks, draftDirection(state.packIndex)),
    ...(currentPackVariants
      ? {
          currentPackVariants: passDraftPacks(currentPackVariants, draftDirection(state.packIndex)),
          pickVariants,
        }
      : {}),
  };
}

/** Grant the 45 human-picked premium cards exactly while the draft->build once-guard is open. */
export function grantPremiumDraftPool(save: SaveData, db: CardDb, run: LimitedRun): AddResult[] {
  if (!run.premium || run.status !== 'draft' || !run.draft?.completed) return [];
  return run.draft.picks[0].map((id, index) =>
    addCard(save, db, id, run.draft!.pickVariants?.[index] ?? PLAIN_VARIANT),
  );
}

export function completeDraftRun(db: CardDb, run: LimitedRun): LimitedRun {
  if (!run.draft?.completed) return run;
  const opponentDecks = [1, 2, 3].map((seat) => buildLimitedDeck(db, run.draft!.picks[seat] ?? []));
  return {
    ...run,
    status: 'build',
    pool: [...run.draft.picks[0]],
    opponentDecks,
  };
}

export function buildLimitedDeck(db: CardDb, pool: readonly string[]): string[] {
  const colors = chooseDeckColors(db, pool);
  const nonbasicLands = pool
    .filter((id) => isPlayableNonbasicLand(db, id) && landFitsColors(def(db, id), colors))
    .sort((a, b) => scoreLand(db, b, colors) - scoreLand(db, a, colors) || compareCardNames(db, a, b));
  const spells = pool
    .filter((id) => isPlayableSpell(db, id))
    .sort((a, b) => scoreDeckCard(db, b, colors) - scoreDeckCard(db, a, colors) || compareCardNames(db, a, b));

  const spellSlots = 23;
  const selectedSpells = spells.slice(0, spellSlots);
  const landSlots = LIMITED_DECK_SIZE - selectedSpells.length;
  const selectedNonbasics = nonbasicLands.slice(0, Math.min(4, landSlots));
  const basics = buildBasicLandBase(db, selectedSpells, colors, landSlots - selectedNonbasics.length);
  const deck = [...selectedSpells, ...selectedNonbasics, ...basics];

  const errors = validateLimitedDeck(db, pool, deck).filter((issue) => issue.kind === 'error');
  if (errors.length === 0) return deck;

  const fallbackColors: readonly Color[] = colors.length > 0 ? colors : ['G'];
  const fallbackSpells = spells.slice(0, Math.min(spells.length, spellSlots));
  return [
    ...fallbackSpells,
    ...buildBasicLandBase(db, fallbackSpells, fallbackColors, LIMITED_DECK_SIZE - fallbackSpells.length),
  ];
}

export function countCards(cards: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

function limitedRunId(seed: number, now: number): string {
  return `limited-draft-${seed}-${Math.trunc(now)}`;
}

function rollLimitedPackWithRng(db: CardDb, rng: RngState, set?: CardDef['set']): string[] {
  const cards: string[] = [];
  for (let i = 0; i < ECONOMY.limitedPackSize; i++) {
    let tier = rollTier(rng);
    let pool = packPool(db, tier, set);
    while (pool.length === 0) {
      const down = LIMITED_TIER_FALLBACK[tier];
      if (down === null) throw new Error('limited booster pool is empty at every tier');
      tier = down;
      pool = packPool(db, tier, set);
    }
    cards.push(pool[rngInt(rng, pool.length)]);
  }
  return cards.sort((a, b) => TIER_RANK[def(db, a).rarity] - TIER_RANK[def(db, b).rarity] || compareCardNames(db, a, b));
}

function rollPremiumLimitedPackWithRng(
  db: CardDb,
  rng: RngState,
  set?: CardDef['set'],
): { cards: string[]; variants: CardVariant[] } {
  const slots: { cardId: string; variant: CardVariant }[] = [];
  for (let i = 0; i < ECONOMY.limitedPackSize; i++) {
    let tier = rollTier(rng);
    let pool = packPool(db, tier, set);
    while (pool.length === 0) {
      const down = LIMITED_TIER_FALLBACK[tier];
      if (down === null) throw new Error('limited booster pool is empty at every tier');
      tier = down;
      pool = packPool(db, tier, set);
    }
    const cardId = pool[rngInt(rng, pool.length)];
    slots.push({
      cardId,
      variant: { frame: rollFrame(rng), holo: rollHolo(rng), fullArt: false },
    });
  }
  slots.sort(
    (a, b) =>
      TIER_RANK[def(db, a.cardId).rarity] - TIER_RANK[def(db, b.cardId).rarity] ||
      compareCardNames(db, a.cardId, b.cardId),
  );
  return { cards: slots.map((slot) => slot.cardId), variants: slots.map((slot) => slot.variant) };
}

function chooseBotDraftPick(
  db: CardDb,
  pack: readonly string[],
  picks: readonly string[],
  profile: PickerProfile,
  noiseForCard: (cardId: string) => number,
): string {
  return [...pack].sort(
    (a, b) =>
      scorePick(db, b, picks, profile, noiseForCard(b)) -
        scorePick(db, a, picks, profile, noiseForCard(a)) || compareCardNames(db, a, b),
  )[0];
}

function passDraftPacks<T>(packs: T[][], direction: 'left' | 'right'): T[][] {
  const out = Array.from({ length: DRAFT_SEATS }, () => [] as T[]);
  for (let seat = 0; seat < DRAFT_SEATS; seat++) {
    const target = direction === 'left' ? (seat + 1) % DRAFT_SEATS : (seat + DRAFT_SEATS - 1) % DRAFT_SEATS;
    out[target] = packs[seat];
  }
  return out;
}

function removeDraftSlot(
  cards: string[],
  variants: CardVariant[] | undefined,
  cardId: string,
  requestedIndex?: number,
): CardVariant | undefined {
  const i = requestedIndex !== undefined && cards[requestedIndex] === cardId ? requestedIndex : cards.indexOf(cardId);
  if (i < 0) throw new Error(`Missing card ${cardId}`);
  cards.splice(i, 1);
  return variants?.splice(i, 1)[0];
}

function copyVariant(variant: CardVariant): CardVariant {
  return { frame: variant.frame, holo: variant.holo, fullArt: variant.fullArt };
}

function scoreDeckCard(db: CardDb, id: string, colors: readonly Color[]): number {
  const d = def(db, id);
  let score = scoreBasePick(d, DEFAULT_PICKER);
  if (d.colors.length > 0) {
    const onColor = d.colors.every((c) => colors.includes(c));
    const overlap = d.colors.some((c) => colors.includes(c));
    score += onColor ? 7 : overlap ? 1 : -12;
  }
  return score;
}

function scoreLand(db: CardDb, id: string, colors: readonly Color[]): number {
  const d = def(db, id);
  const mana = d.manaAbility ?? [];
  return mana.filter((c) => colors.includes(c)).length * 3 - (d.entersTapped ? 0.5 : 0);
}

function chooseDeckColors(db: CardDb, pool: readonly string[]): Color[] {
  const scores = new Map<Color, number>();
  for (const color of COLOR_ORDER) scores.set(color, 0);
  for (const id of pool) {
    const d = def(db, id);
    if (d.token || isType(d, 'land')) continue;
    for (const color of d.colors) scores.set(color, (scores.get(color) ?? 0) + Math.max(1, scoreBasePick(d, DEFAULT_PICKER)));
  }
  const ranked = COLOR_ORDER.filter((c) => (scores.get(c) ?? 0) > 0).sort(
    (a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b),
  );
  return ranked.slice(0, Math.min(2, Math.max(1, ranked.length)));
}

function isPlayableSpell(db: CardDb, id: string): boolean {
  const d = def(db, id);
  return !d.token && !isType(d, 'land') && d.cost !== undefined;
}

function isPlayableNonbasicLand(db: CardDb, id: string): boolean {
  const d = def(db, id);
  return !d.token && isType(d, 'land') && !isBasic(db, id);
}

function landFitsColors(d: CardDef, colors: readonly Color[]): boolean {
  return (d.manaAbility ?? []).some((color) => colors.includes(color));
}

function buildBasicLandBase(db: CardDb, spells: readonly string[], colors: readonly Color[], slots: number): string[] {
  if (slots <= 0) return [];
  const demand = new Map<Color, number>();
  for (const color of colors) demand.set(color, 0);
  for (const id of spells) {
    const cost = def(db, id).cost;
    for (const color of colors) demand.set(color, (demand.get(color) ?? 0) + (cost?.pips[color] ?? 0));
  }
  const activeColors: readonly Color[] = colors.length > 0 ? colors : ['G'];
  if ([...demand.values()].every((n) => n <= 0)) {
    for (const color of activeColors) demand.set(color, 1);
  }
  const basicsByColor = basicLandIdsByColor(db);
  const counts = new Map<Color, number>();
  const totalDemand = activeColors.reduce((sum, color) => sum + Math.max(1, demand.get(color) ?? 0), 0);
  const basics: string[] = [];
  for (let i = 0; i < slots; i++) {
    const color =
      activeColors
      .filter((c) => basicsByColor.get(c))
      .sort((a, b) => {
        const targetA = (slots * Math.max(1, demand.get(a) ?? 0)) / totalDemand;
        const targetB = (slots * Math.max(1, demand.get(b) ?? 0)) / totalDemand;
        return targetB - (counts.get(b) ?? 0) - (targetA - (counts.get(a) ?? 0));
      })[0] ?? activeColors[0];
    const chosen = basicsByColor.get(color) ?? firstBasicLandId(db);
    basics.push(chosen);
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return basics;
}

function basicLandIdsByColor(db: CardDb): Map<Color, string> {
  const basics = new Map<Color, string>();
  for (const d of Object.values(db)) {
    if (!isBasic(db, d.id)) continue;
    for (const color of d.manaAbility ?? []) {
      if (!basics.has(color)) basics.set(color, d.id);
    }
  }
  return basics;
}

function firstBasicLandId(db: CardDb): string {
  const basic = Object.values(db).find((d) => isBasic(db, d.id));
  if (!basic) throw new Error('No basic lands in card database');
  return basic.id;
}

function compareCardNames(db: CardDb, a: string, b: string): number {
  const da = def(db, a);
  const dbb = def(db, b);
  return da.name.localeCompare(dbb.name) || a.localeCompare(b);
}
