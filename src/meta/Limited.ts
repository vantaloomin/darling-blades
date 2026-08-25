import { ECONOMY } from '../config/rules';
import { DRAFT_PERSONAS, draftPersonaById } from '../data/draftPersonas';
import { createRngState, rngInt, type RngState } from '../engine/rng';
import type { CardDb, CardDef, Color, Rarity } from '../engine/types';
import { def, isType } from '../engine/types';
import { addCard, type AddResult } from './Collection';
import { LIMITED_DECK_SIZE } from './DeckStorage';
import { AI_COLOR_ORDER, BASIC_FOR_COLOR } from './duelSetup';
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
import { isDualLand, LAND_RESERVE_SIZE, MAX_DUAL_LANDS } from './warchest';
import { isLiveCollectible } from '../data/liveness';

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
  /** The player's full ten-card Warchest, including any drafted duals. */
  landReserve?: string[];
  /** Full ten-card Warchests built from each drafted opponent's own pool. */
  opponentLandReserves?: string[][];
  /** Absent/false is the unchanged free draft. */
  premium?: boolean;
  draft?: DraftState;
}

export interface LimitedDuelData {
  difficulty: LimitedDifficulty;
  deckOverride: string[];
  oppDeckOverride: string[];
  seedOverride: number;
  landReserveOverride?: [string[], string[]];
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
  const opponentReserve = run.opponentLandReserves?.[run.matchIndex] ?? run.opponentLandReserves?.[0];
  return {
    difficulty: limitedDifficultyForMatch(run.matchIndex),
    deckOverride: [...run.deck],
    oppDeckOverride: [...(run.opponentDecks[run.matchIndex] ?? run.opponentDecks[0] ?? [])],
    seedOverride: limitedMatchSeed(run),
    ...(run.landReserve && opponentReserve
      ? { landReserveOverride: [[...run.landReserve], [...opponentReserve]] as [string[], string[]] }
      : {}),
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
  const pool = [...run.draft.picks[0]];
  const playerDeck = run.deck.length > 0 ? run.deck : buildLimitedDeck(db, pool);
  const playerDuals = run.landReserve?.filter((id) => db[id] && isDualLand(db[id]));
  const opponentDecks = [1, 2, 3].map((seat) => buildLimitedDeck(db, run.draft!.picks[seat] ?? []));
  const opponentLandReserves = opponentDecks.map((deck, index) =>
    limitedLandReserve(db, deck, run.draft!.picks[index + 1] ?? []),
  );
  return {
    ...run,
    status: 'build',
    pool,
    landReserve: limitedLandReserve(db, playerDeck, pool, run.landReserve ? playerDuals : undefined),
    opponentDecks,
    opponentLandReserves,
  };
}

/**
 * Reserve-native Limited deck: LIMITED_DECK_SIZE spells, no lands. The ten
 * land reserve is granted from the deck's own colours, with drafted duals
 * assigned into it by the build step, so drafting stays about spells while
 * dual picks remain playable.
 *
 * A pool short of that many playable spells is padded with the best remaining
 * pool cards rather than failing the run: a bad draft should be a bad deck,
 * never a stuck one.
 */
export function buildLimitedDeck(db: CardDb, pool: readonly string[]): string[] {
  const colors = chooseDeckColors(db, pool);
  const spells = pool
    .filter((id) => isPlayableSpell(db, id))
    .sort((a, b) => scoreDeckCard(db, b, colors) - scoreDeckCard(db, a, colors) || compareCardNames(db, a, b));

  const deck = spells.slice(0, LIMITED_DECK_SIZE);
  if (deck.length === LIMITED_DECK_SIZE) return deck;

  // Short pool: top up from any remaining playable spell, off-colour included.
  const taken = new Map<string, number>();
  for (const id of deck) taken.set(id, (taken.get(id) ?? 0) + 1);
  for (const id of pool) {
    if (deck.length >= LIMITED_DECK_SIZE) break;
    if (!isPlayableSpell(db, id)) continue;
    const used = taken.get(id) ?? 0;
    const available = pool.filter((p) => p === id).length;
    if (used >= available) continue;
    deck.push(id);
    taken.set(id, used + 1);
  }
  return deck;
}

/**
 * Basics apportioned by the deck's actual PIP DEMAND, with a one-basic floor
 * for every colour the deck plays.
 *
 * The shared `buildAiLandReserve` alternates strictly (`palette[i % n]`), so a
 * deck with twelve red pips and three blue still drew five Mountains and five
 * Islands. Mana is tighter in Limited than anywhere else - ten lands, no
 * shuffling your way out - so the main colour was chronically under-supported.
 *
 * The floor is what keeps a light splash castable: pure largest-remainder
 * rounding can hand a one-pip splash zero sources, which is worse than the
 * alternation it replaces. When there are fewer slots than colours the highest
 * demand wins, because something has to give.
 *
 * Deliberately local to Limited. `buildAiLandReserve` feeds every AI duel and
 * the avatar roster, so changing it there would move balance across the whole
 * game; this changes only the mode the decision was taken for.
 */
export function limitedBasics(db: CardDb, deck: readonly string[], slots: number): string[] {
  if (slots <= 0) return [];
  const demand = new Map<Color, number>();
  for (const id of deck) {
    const card = db[id];
    if (!card) continue;
    for (const [color, pips] of Object.entries(card.cost?.pips ?? {}) as [Color, number][]) {
      if (pips > 0) demand.set(color, (demand.get(color) ?? 0) + pips);
    }
    // A coloured card with no pips (or an odd cost shape) still needs a source.
    for (const color of card.colors ?? []) if (!demand.has(color)) demand.set(color, 0);
  }
  const colors = AI_COLOR_ORDER.filter((color) => demand.has(color));
  if (colors.length === 0) return Array.from({ length: slots }, () => BASIC_FOR_COLOR.W);

  // Fewer slots than colours: highest demand first, one each, and stop.
  if (colors.length >= slots) {
    const ranked = [...colors].sort((a, b) =>
      (demand.get(b) ?? 0) - (demand.get(a) ?? 0) || AI_COLOR_ORDER.indexOf(a) - AI_COLOR_ORDER.indexOf(b));
    return ranked.slice(0, slots).map((color) => BASIC_FOR_COLOR[color]);
  }

  const counts = new Map<Color, number>(colors.map((color) => [color, 1]));
  let remaining = slots - colors.length;
  const total = colors.reduce((sum, color) => sum + (demand.get(color) ?? 0), 0);
  if (total > 0 && remaining > 0) {
    const exact = colors.map((color) => ({ color, value: remaining * (demand.get(color) ?? 0) / total }));
    const floors = exact.map((entry) => ({ ...entry, whole: Math.floor(entry.value) }));
    for (const entry of floors) counts.set(entry.color, (counts.get(entry.color) ?? 0) + entry.whole);
    remaining -= floors.reduce((sum, entry) => sum + entry.whole, 0);
    const byRemainder = [...floors].sort((a, b) =>
      (b.value - b.whole) - (a.value - a.whole) ||
      AI_COLOR_ORDER.indexOf(a.color) - AI_COLOR_ORDER.indexOf(b.color));
    for (let i = 0; i < remaining; i++) {
      const entry = byRemainder[i % byRemainder.length];
      counts.set(entry.color, (counts.get(entry.color) ?? 0) + 1);
    }
  } else {
    // No pips anywhere: spread what is left round-robin over the deck's colours.
    for (let i = 0; i < remaining; i++) {
      const color = colors[i % colors.length];
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  return colors.flatMap((color) => Array.from({ length: counts.get(color) ?? 0 }, () => BASIC_FOR_COLOR[color]));
}

/**
 * The Limited Warchest: selected drafted duals first, then ten lands total
 * with basics apportioned by the spell deck's pip demand. An omitted selection
 * defaults to the first five drafted dual occurrences; an explicit empty
 * selection means the player chose basics only.
 */
export function limitedLandReserve(
  db: CardDb,
  deck: readonly string[],
  pool: readonly string[] = [],
  selectedDuals?: readonly string[],
): string[] {
  const availableDuals = limitedDraftDuals(db, pool);
  const requested = selectedDuals === undefined ? availableDuals.slice(0, MAX_DUAL_LANDS) : selectedDuals;
  const duals = takeDraftedDuals(availableDuals, requested);
  return [...duals, ...limitedBasics(db, deck, LAND_RESERVE_SIZE - duals.length)];
}

/** Return drafted dual occurrences in pool order for the Limited builder. */
export function limitedDraftDuals(db: CardDb, pool: readonly string[]): string[] {
  return pool.filter((id) => {
    const card = db[id];
    return card !== undefined && isLiveCollectible(card) && isDualLand(card);
  });
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
  return isLiveCollectible(d) && !isType(d, 'land') && d.cost !== undefined;
}






function compareCardNames(db: CardDb, a: string, b: string): number {
  const da = def(db, a);
  const dbb = def(db, b);
  return da.name.localeCompare(dbb.name) || a.localeCompare(b);
}

function takeDraftedDuals(available: readonly string[], requested: readonly string[]): string[] {
  const availableCounts = countCards(available);
  const used = new Map<string, number>();
  const result: string[] = [];
  for (const id of requested) {
    if (result.length >= MAX_DUAL_LANDS) break;
    const count = used.get(id) ?? 0;
    if (count >= (availableCounts.get(id) ?? 0)) continue;
    result.push(id);
    used.set(id, count + 1);
  }
  return result;
}
