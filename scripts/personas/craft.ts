import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAI } from '../../src/ai/personality';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { isLiveCollectible } from '../../src/data/liveness';
import { STARTER_DECKS, THEME_DECKS, type DeckList } from '../../src/data/starterDecks';
import { createRngState, rngInt, rngNext, type RngState } from '../../src/engine/rng';
import { manaValue, type CardDef, type Color } from '../../src/engine/types';
import { runCell, type CellResult } from '../balance-matrix';
import { runParallelGames, type MeasureGameJob } from './measure-worker';
import { cardRoles, curveBand, rateCard, scoreCard, type PersonaDeckState } from './score';
import {
  PERSONA_TEMPLATES,
  type CurveBand,
  type DeckRole,
  type PersonaTemplate,
  type SpellRole,
  personaTemplate,
} from './templates';

const DEFAULT_SEEDS = 150;
const DEFAULT_ITERATIONS = 80;
const DEFAULT_SEED = 13_003;
const DEFAULT_METAGAME_ROUNDS = 4;
const DEFAULT_MEASURE_WORKERS = Math.max(1, cpus().length - 2);
const BASIC_BY_COLOR: Readonly<Record<Color, string>> = {
  W: 'land-plains',
  U: 'land-island',
  B: 'land-swamp',
  R: 'land-mountain',
  G: 'land-forest',
};
const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;

export const CLI_HELP = `Persona deck-crafting harness

Single-round mode (the v1 default):
  --persona <id> | --all     Craft against --field prefabs|starters
  --pool <id>                Card pool (default: all)
  --seeds <n>                Games per matchup (default: 150)
  --iterations <n>           Hill-climb swaps (default: 80)
  --seed <n>                 Deterministic craft seed (default: 13003)
  --workers <n>              Games per measure worker count (default: SWEEP_WORKERS or CPUs-2)
  --no-memo                  Disable the deterministic measurement cache
  --out <dir>                Artifact directory
  --check <artifact.json>    Remeasure a retained v1 artifact for drift

Metagame loop mode (informational, deterministic):
  --metagame --all | --personas <id,id,...>
  --rounds <n>               Maximum best-response rounds (default: 4)
  --status-file <path>       Write live metagame progress JSON (sweep dashboards)

Artifacts are checkpointed at every round boundary (after the seed pass and
after each best-response round) to the same paths the final write uses, so a
run killed mid-flight keeps every completed round. A partial artifact reports
stoppedReason 'in-progress' with converged false; a finished run overwrites its
own checkpoints and leaves none behind.

Policy: first craft is round 0 against the static field. Each later round
crafts every persona simultaneously against that static field plus the other
personas' prior retained decks. Stop when all decks are unchanged, report a
repeated non-stable deck as OSCILLATION, or report MAX-ROUNDS. Scores are not
averaged. Each artifact retains every round's seed, template, field decks,
measurements, and hill-climb log.`;

export type FieldId = 'prefabs' | 'starters';
export type MeasuredFieldId = FieldId | 'personas';

export interface QuotaShortfall {
  role: SpellRole;
  missing: number;
  reason: string;
}

export interface AssignedCard {
  cardId: string;
  role: SpellRole;
}

export interface GreedyBuild {
  deck: string[];
  assigned: AssignedCard[];
  selectedColors: Color[];
  quotaShortfalls: QuotaShortfall[];
}

export interface DeckCountSnapshot {
  total: number;
  lands: number;
  nonlands: number;
  uniqueCards: number;
  maxNonbasicCopies: number;
  roles: Record<DeckRole, number>;
  curve: Record<CurveBand, number>;
}

export interface MatchupRecord extends CellResult {
  referenceId: string;
  referenceName: string;
}

export interface MeasuredRecord {
  field: MeasuredFieldId;
  seeds: number;
  matchups: MatchupRecord[];
  rowWins: number;
  losses: number;
  draws: number;
  games: number;
  score: number;
}

export interface AcceptedSwap {
  iteration: number;
  out: string;
  in: string;
  role: SpellRole;
  priorScore: number;
  nextScore: number;
  scoreDelta: number;
}

export interface HillClimbLog {
  initialList: string[];
  initialScore: number;
  acceptedSwaps: AcceptedSwap[];
  rejectedSwaps: number;
  unproposedIterations: number;
}

export interface HillClimbResult {
  build: GreedyBuild;
  initialMeasurement: MeasuredRecord;
  finalMeasurement: MeasuredRecord;
  log: HillClimbLog;
  greedyBeatsFinal: boolean;
  nonMonotonicClimb: boolean;
}

export interface FieldCompositionEntry {
  kind: 'static' | 'persona';
  id: string;
  name: string;
  personaId?: string;
  deck: string[];
}

export interface MetagameRound {
  round: number;
  seed: number;
  measurementSeed: number;
  templateVersion: string;
  fieldComposition: FieldCompositionEntry[];
  deck: string[];
  counts: Record<string, number>;
  selectedColors: Color[];
  measured: MeasuredRecord;
  hillClimb: HillClimbLog;
  quotaShortfalls: QuotaShortfall[];
  honesty: {
    greedyBeatsFinal: boolean;
    nonMonotonicClimb: boolean;
  };
}

export type MetagameStopReason =
  | 'stable-decks'
  | 'oscillation'
  | 'max-rounds'
  /**
   * Checkpoint only. A run still in flight reports this so a partial
   * artifact can never be mistaken for a finished measurement - `converged`
   * is false and `completedRounds` says how far it actually got.
   */
  | 'in-progress';

export interface MetagameOscillation {
  personaId: string;
  firstRound: number;
  repeatRound: number;
  period: number;
}

export interface MetagameSummary {
  policy: 'stable-decks-or-oscillation-or-max-rounds';
  maxRounds: number;
  completedRounds: number;
  baseField: FieldId;
  converged: boolean;
  stoppedReason: MetagameStopReason;
  oscillatingPersonas: string[];
  oscillations: MetagameOscillation[];
}

export interface ProposedSwap {
  build: GreedyBuild;
  out: string;
  in: string;
  role: SpellRole;
}

export interface PersonaArtifact {
  schemaVersion: 1;
  mode?: 'single-round' | 'metagame-loop';
  persona: { id: string; name: string };
  pool: string;
  field: MeasuredFieldId;
  seed: number;
  seeds: number;
  iterations: number;
  templateVersion: string;
  selectedColors: Color[];
  referenceField: { id: string; name: string }[];
  deck: string[];
  counts: Record<string, number>;
  measured: MeasuredRecord;
  hillClimb: HillClimbLog;
  quotaShortfalls: QuotaShortfall[];
  honesty: {
    greedyBeatsFinal: boolean;
    nonMonotonicClimb: boolean;
    oscillating?: boolean;
  };
  metagame?: {
    summary: MetagameSummary;
    rounds: MetagameRound[];
  };
}

export interface MeasureOptions {
  field: MeasuredFieldId;
  seeds: number;
  seed: number;
  personaId: string;
  fieldComposition?: readonly FieldCompositionEntry[];
  workers?: number;
  memoize?: boolean;
}

export type MeasureFunction = (deck: readonly string[], options: MeasureOptions) => MeasuredRecord;

export interface MetagameOptions {
  poolId: string;
  pool: readonly CardDef[];
  field: FieldId;
  seeds: number;
  iterations: number;
  seed: number;
  maxRounds: number;
  personaIds: readonly string[];
  measure?: MeasureFunction;
  propose?: HillClimbOptions['propose'];
  /**
   * Optional per-craft progress hook (sweep dashboards). Called immediately
   * BEFORE each persona's hill-climb starts: once per persona in the round-0
   * seed pass and once per persona per best-response round. Pure observer -
   * it must not touch the options or decks, and determinism is unaffected.
   */
  onProgress?: (event: MetagameProgressEvent) => void;
  /**
   * Optional checkpoint hook. Called AFTER the round-0 seed pass and after each
   * completed best-response round, with the same artifacts a finished run would
   * return for the rounds crafted so far.
   *
   * This exists because a passive multi-day sweep is a run nobody is watching:
   * without it, artifacts are written only when the whole loop finishes, so a
   * crash at hour 80 of a 3-day run loses everything. Pure observer - it must
   * not touch the options or decks, and determinism is unaffected.
   */
  onCheckpoint?: (artifacts: PersonaArtifact[], summary: MetagameSummary) => void;
}

export interface MetagameProgressEvent {
  phase: 'seed' | 'round';
  round: number;
  maxRounds: number;
  personaId: string;
  personaName: string;
  personaIndex: number;
  personaCount: number;
}

export interface MetagameResult {
  artifacts: PersonaArtifact[];
  summary: MetagameSummary;
}

export interface MeasureCacheStats {
  calls: number;
  hits: number;
  misses: number;
  entries: number;
  simulatedGames: number;
}

const measuredCache = new Map<string, MeasuredRecord>();
let measureStats = { calls: 0, hits: 0, misses: 0, simulatedGames: 0 };

export function defaultMeasureWorkers(): number {
  return DEFAULT_MEASURE_WORKERS;
}

export function resolveMeasureWorkers(requested?: number): number {
  const envValue = process.env.SWEEP_WORKERS;
  const value = requested ?? (envValue === undefined ? DEFAULT_MEASURE_WORKERS : Number(envValue));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`workers must be a positive integer (got ${value})`);
  }
  return value;
}

export function resetMeasureCache(): void {
  measuredCache.clear();
  measureStats = { calls: 0, hits: 0, misses: 0, simulatedGames: 0 };
}

export function getMeasureCacheStats(): MeasureCacheStats {
  return { ...measureStats, entries: measuredCache.size };
}

const emptyRoles = (): Record<DeckRole, number> => ({
  threats: 0,
  removal: 0,
  interaction: 0,
  draw: 0,
  finishers: 0,
  lands: 0,
});

const emptyCurve = (): Record<CurveBand, number> => ({ early: 0, mid: 0, late: 0 });

const cardCounts = (deck: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
};

const isBasic = (card: CardDef): boolean => card.supertypes?.includes('basic') ?? false;

function cardAllowedByColors(card: CardDef, colors: readonly Color[]): boolean {
  return card.colors.every((color) => colors.includes(color));
}

export function cardsForPool(pool: string): CardDef[] {
  const knownSets = new Set(ALL_CARDS.map((card) => card.set).filter((set): set is NonNullable<CardDef['set']> => Boolean(set)));
  if (pool !== 'all' && !knownSets.has(pool as NonNullable<CardDef['set']>)) {
    throw new Error(`Unknown pool: ${pool}. Expected all or one of ${[...knownSets].sort().join(', ')}`);
  }
  return ALL_CARDS.filter((card) =>
    !card.token && (isBasic(card) || (isLiveCollectible(card) && (pool === 'all' || card.set === pool))),
  );
}

function chooseBestTwoColors(pool: readonly CardDef[]): Color[] {
  let best: { colors: Color[]; score: number } | undefined;
  for (let a = 0; a < COLORS.length; a++) {
    for (let b = a + 1; b < COLORS.length; b++) {
      const colors: Color[] = [COLORS[a], COLORS[b]];
      const ranked = pool
        .filter((card) => !card.types.includes('land') && cardAllowedByColors(card, colors))
        .map((card) => rateCard(card))
        .sort((x, y) => y - x)
        .slice(0, 40);
      const score = ranked.reduce((sum, value) => sum + value, 0);
      if (!best || score > best.score || (score === best.score && colors.join('') < best.colors.join(''))) {
        best = { colors, score };
      }
    }
  }
  return best?.colors ?? ['W', 'U'];
}

function stateFor(template: PersonaTemplate, assigned: readonly AssignedCard[], selectedColors: readonly Color[]): PersonaDeckState {
  const roleCounts = emptyRoles();
  const curveCounts = emptyCurve();
  for (const entry of assigned) {
    roleCounts[entry.role]++;
    curveCounts[curveBand(CARD_DB[entry.cardId])]++;
  }
  roleCounts.lands = template.quotas.lands;
  return { cards: assigned.map((entry) => entry.cardId), roleCounts, curveCounts, selectedColors };
}

function rankedCandidate(
  candidates: readonly CardDef[],
  template: PersonaTemplate,
  state: PersonaDeckState,
  role: SpellRole,
  tieRanks: ReadonlyMap<string, number>,
): CardDef | undefined {
  return [...candidates].sort((a, b) => {
    const aScore = scoreCard(a, template, state).total + (cardRoles(a).includes(role) ? 2 : 0);
    const bScore = scoreCard(b, template, state).total + (cardRoles(b).includes(role) ? 2 : 0);
    return bScore - aScore || (tieRanks.get(a.id) ?? 0) - (tieRanks.get(b.id) ?? 0) || a.id.localeCompare(b.id);
  })[0];
}

function allocateBasics(spells: readonly string[], colors: readonly Color[], landCount: number): string[] {
  const demand = new Map<Color, number>(colors.map((color) => [color, 0]));
  for (const id of spells) {
    for (const [color, pips] of Object.entries(CARD_DB[id].cost?.pips ?? {}) as [Color, number][]) {
      if (demand.has(color)) demand.set(color, (demand.get(color) ?? 0) + pips);
    }
  }
  const totalDemand = [...demand.values()].reduce((sum, value) => sum + value, 0);
  const exact = colors.map((color) => ({
    color,
    value: totalDemand === 0 ? landCount / colors.length : landCount * (demand.get(color) ?? 0) / totalDemand,
  }));
  const allocations = exact.map(({ color, value }) => ({ color, count: Math.floor(value), fraction: value - Math.floor(value) }));
  const remaining = landCount - allocations.reduce((sum, entry) => sum + entry.count, 0);
  allocations.sort((a, b) => b.fraction - a.fraction || a.color.localeCompare(b.color));
  for (let i = 0; i < remaining; i++) allocations[i % allocations.length].count++;
  allocations.sort((a, b) => colors.indexOf(a.color) - colors.indexOf(b.color));
  return allocations.flatMap(({ color, count }) => Array<string>(count).fill(BASIC_BY_COLOR[color]));
}

function quotaShortfallsFor(assigned: readonly AssignedCard[]): QuotaShortfall[] {
  const missing = new Map<SpellRole, number>();
  for (const entry of assigned) {
    if (!cardRoles(CARD_DB[entry.cardId]).includes(entry.role)) {
      missing.set(entry.role, (missing.get(entry.role) ?? 0) + 1);
    }
  }
  return [...missing].map(([role, count]) => ({
    role,
    missing: count,
    reason: `The selected pool could not fill ${count} ${role} slot${count === 1 ? '' : 's'} with on-role cards`,
  }));
}

export function buildGreedyDeck(template: PersonaTemplate, pool: readonly CardDef[], seed: number): GreedyBuild {
  const rng = createRngState(seed);
  const selectedColors = template.colorPolicy === 'best-two' ? chooseBestTwoColors(pool) : [...template.colorIdentity];
  const candidates = pool
    .filter((card) => !card.types.includes('land') && !card.token && cardAllowedByColors(card, selectedColors))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (candidates.length === 0) throw new Error(`Pool has no nonland cards for ${template.id}`);

  const tieRanks = new Map<string, number>();
  for (const card of candidates) tieRanks.set(card.id, rngNext(rng));
  const counts = new Map<string, number>();
  const assigned: AssignedCard[] = [];
  const roleOrder: readonly SpellRole[] = ['finishers', 'draw', 'removal', 'interaction', 'threats'];

  for (const role of roleOrder) {
    for (let slot = 0; slot < template.quotas[role]; slot++) {
      const state = stateFor(template, assigned, selectedColors);
      const legal = candidates.filter((card) =>
        (counts.get(card.id) ?? 0) < 4 &&
        manaValue(card.cost) <= template.curve.maxManaValue &&
        cardRoles(card).includes(role));
      let chosen = rankedCandidate(legal, template, state, role, tieRanks);
      if (!chosen) {
        const fallback = candidates.filter((card) => (counts.get(card.id) ?? 0) < 4);
        chosen = rankedCandidate(fallback, template, state, role, tieRanks);
      }
      if (!chosen) throw new Error(`Pool cannot supply ${60 - assigned.length} remaining deck slots for ${template.id}`);
      assigned.push({ cardId: chosen.id, role });
      counts.set(chosen.id, (counts.get(chosen.id) ?? 0) + 1);
    }
  }

  const spells = assigned.map((entry) => entry.cardId);
  const lands = allocateBasics(spells, selectedColors, template.quotas.lands);
  const quotaShortfalls = quotaShortfallsFor(assigned);
  const build = { deck: [...spells, ...lands], assigned, selectedColors, quotaShortfalls };
  assertCraftedDeckLegal(build.deck);
  return build;
}

export function assertCraftedDeckLegal(deck: readonly string[]): void {
  if (deck.length !== 60) throw new Error(`Crafted deck has ${deck.length}/60 cards`);
  for (const [id, count] of cardCounts(deck)) {
    const card = CARD_DB[id];
    if (!card) throw new Error(`Crafted deck contains unknown card: ${id}`);
    if (card.token) throw new Error(`Crafted deck contains token: ${id}`);
    if (!isBasic(card) && count > 4) throw new Error(`Crafted deck has ${count} copies of ${id}`);
  }
}

export function snapshotDeckCounts(build: GreedyBuild): DeckCountSnapshot {
  const counts = cardCounts(build.deck);
  const roles = emptyRoles();
  const curve = emptyCurve();
  for (const entry of build.assigned) {
    roles[entry.role]++;
    curve[curveBand(CARD_DB[entry.cardId])]++;
  }
  const lands = build.deck.filter((id) => CARD_DB[id].types.includes('land')).length;
  roles.lands = lands;
  return {
    total: build.deck.length,
    lands,
    nonlands: build.deck.length - lands,
    uniqueCards: counts.size,
    maxNonbasicCopies: Math.max(...[...counts].filter(([id]) => !isBasic(CARD_DB[id])).map(([, count]) => count), 0),
    roles,
    curve,
  };
}

function referenceDecks(field: FieldId): readonly DeckList[] {
  return field === 'prefabs' ? [...STARTER_DECKS, ...THEME_DECKS] : STARTER_DECKS;
}

function referenceComposition(field: FieldId): FieldCompositionEntry[] {
  return referenceDecks(field).map((reference) => ({
    kind: 'static',
    id: reference.id,
    name: reference.name,
    deck: [...reference.cards],
  }));
}

function stableHash(text: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function measureDeckAgainstField(
  deck: readonly string[],
  options: MeasureOptions,
  fieldComposition: readonly FieldCompositionEntry[],
): MeasuredRecord {
  assertCraftedDeckLegal(deck);
  const workers = resolveMeasureWorkers(options.workers);
  measureStats.calls++;
  const cacheKey = JSON.stringify({
    deck: [...deck],
    field: options.field,
    seeds: options.seeds,
    seed: options.seed,
    personaId: options.personaId,
    fieldComposition: fieldComposition.map((reference) => ({
      kind: reference.kind,
      id: reference.id,
      name: reference.name,
      personaId: reference.personaId ?? null,
      deck: [...reference.deck],
    })),
  });
  if (options.memoize !== false) {
    const cached = measuredCache.get(cacheKey);
    if (cached) {
      measureStats.hits++;
      return cached;
    }
  }
  measureStats.misses++;
  const compositionStamp = options.field === 'personas'
    ? `|${fieldComposition.map((reference) => `${reference.id}:${reference.deck.join(',')}`).join('|')}`
    : '';
  const base = (stableHash(`${options.seed}|${options.personaId}|${options.field}${compositionStamp}`) % 20_000) + 60_000;
  if (workers === 1) {
    measureStats.simulatedGames += fieldComposition.length * options.seeds;
    const matchups = fieldComposition.map((reference, index) => {
      const cell = runCell(
        {
          rowAI: (aiSeed) => buildAI('hard', CARD_DB, aiSeed),
          colAI: (aiSeed) => buildAI('hard', CARD_DB, aiSeed),
          decks: () => [[...deck], [...reference.deck]],
        },
        options.seeds,
        base + index,
      );
      return { referenceId: reference.id, referenceName: reference.name, ...cell };
    });
    const result = summarizeMeasurement(options, matchups);
    if (options.memoize !== false) measuredCache.set(cacheKey, result);
    return result;
  }

  const jobs: MeasureGameJob[] = [];
  for (const [matchupIndex, reference] of fieldComposition.entries()) {
    for (let gameIndex = 0; gameIndex < options.seeds; gameIndex++) {
      const gameSeed = (base + matchupIndex) * 100_000 + gameIndex;
      jobs.push({
        resultIndex: jobs.length,
        matchupIndex,
        gameIndex,
        gameSeed,
        rowIsP0: gameIndex % 2 === 0,
        rowDeck: [...deck],
        colDeck: [...reference.deck],
      });
    }
  }
  measureStats.simulatedGames += jobs.length;
  const resultCodes = runParallelGames(jobs, workers);
  const orderedJobs = jobs
    .map((job, resultIndex) => ({ ...job, resultCode: resultCodes[resultIndex] }))
    .sort((a, b) => a.matchupIndex - b.matchupIndex || a.gameSeed - b.gameSeed || a.gameIndex - b.gameIndex);
  const totals = fieldComposition.map(() => ({ rowWins: 0, colWins: 0, draws: 0 }));
  for (const job of orderedJobs) {
    if (job.resultCode === 2) totals[job.matchupIndex].draws++;
    else if ((job.resultCode === 0) === job.rowIsP0) totals[job.matchupIndex].rowWins++;
    else totals[job.matchupIndex].colWins++;
  }
  const matchups = fieldComposition.map((reference, index) => {
    const total = totals[index];
    const decided = total.rowWins + total.colWins;
    return {
      referenceId: reference.id,
      referenceName: reference.name,
      ...total,
      games: options.seeds,
      rate: decided === 0 ? 0 : total.rowWins / decided,
    };
  });
  const result = summarizeMeasurement(options, matchups);
  if (options.memoize !== false) measuredCache.set(cacheKey, result);
  return result;
}

function summarizeMeasurement(options: MeasureOptions, matchups: MatchupRecord[]): MeasuredRecord {
  const rowWins = matchups.reduce((sum, cell) => sum + cell.rowWins, 0);
  const losses = matchups.reduce((sum, cell) => sum + cell.colWins, 0);
  const draws = matchups.reduce((sum, cell) => sum + cell.draws, 0);
  const games = matchups.reduce((sum, cell) => sum + cell.games, 0);
  const decided = rowWins + losses;
  return {
    field: options.field,
    seeds: options.seeds,
    matchups,
    rowWins,
    losses,
    draws,
    games,
    score: decided === 0 ? 0 : rowWins / decided,
  };
}

export const measureDeck: MeasureFunction = (deck, options) => {
  if (options.field === 'personas') {
    throw new Error('measureDeck requires a static prefabs or starters field');
  }
  return measureDeckAgainstField(deck, options, referenceComposition(options.field));
};

export function proposeQuotaLegalSwap(
  current: GreedyBuild,
  pool: readonly CardDef[],
  template: PersonaTemplate,
  rng: RngState,
): ProposedSwap | null {
  if (current.assigned.length === 0) return null;
  const counts = cardCounts(current.deck);
  for (let attempt = 0; attempt < current.assigned.length * 3; attempt++) {
    const index = rngInt(rng, current.assigned.length);
    const outgoing = current.assigned[index];
    const candidates = pool.filter((card) =>
      !card.types.includes('land') &&
      !card.token &&
      card.id !== outgoing.cardId &&
      cardAllowedByColors(card, current.selectedColors) &&
      manaValue(card.cost) <= template.curve.maxManaValue &&
      cardRoles(card).includes(outgoing.role) &&
      (counts.get(card.id) ?? 0) < 4);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => a.id.localeCompare(b.id));
    const incoming = candidates[rngInt(rng, candidates.length)];
    const assigned = current.assigned.map((entry, entryIndex) =>
      entryIndex === index ? { cardId: incoming.id, role: outgoing.role } : { ...entry });
    const spells = assigned.map((entry) => entry.cardId);
    const lands = allocateBasics(spells, current.selectedColors, template.quotas.lands);
    const deck = [...spells, ...lands];
    return {
      build: { ...current, assigned, deck, quotaShortfalls: quotaShortfallsFor(assigned) },
      out: outgoing.cardId,
      in: incoming.id,
      role: outgoing.role,
    };
  }
  return null;
}

export interface HillClimbOptions {
  initial: GreedyBuild;
  pool: readonly CardDef[];
  template: PersonaTemplate;
  iterations: number;
  seed: number;
  measure: (deck: readonly string[]) => MeasuredRecord;
  propose?: (
    current: GreedyBuild,
    pool: readonly CardDef[],
    template: PersonaTemplate,
    rng: RngState,
    iteration: number,
  ) => ProposedSwap | null;
}

export function runHillClimb(options: HillClimbOptions): HillClimbResult {
  const rng = createRngState(options.seed ^ 0x5ca1ab1e);
  const initialMeasurement = options.measure(options.initial.deck);
  let retained = options.initial;
  let retainedMeasurement = initialMeasurement;
  const acceptedSwaps: AcceptedSwap[] = [];
  let rejectedSwaps = 0;
  let unproposedIterations = 0;
  const proposer = options.propose ?? ((current, pool, template, state) => proposeQuotaLegalSwap(current, pool, template, state));

  for (let iteration = 1; iteration <= options.iterations; iteration++) {
    const proposal = proposer(retained, options.pool, options.template, rng, iteration);
    if (!proposal) {
      unproposedIterations++;
      continue;
    }
    assertCraftedDeckLegal(proposal.build.deck);
    const candidateMeasurement = options.measure(proposal.build.deck);
    if (candidateMeasurement.score > retainedMeasurement.score) {
      const priorScore = retainedMeasurement.score;
      retained = proposal.build;
      retainedMeasurement = candidateMeasurement;
      acceptedSwaps.push({
        iteration,
        out: proposal.out,
        in: proposal.in,
        role: proposal.role,
        priorScore,
        nextScore: candidateMeasurement.score,
        scoreDelta: candidateMeasurement.score - priorScore,
      });
    } else {
      rejectedSwaps++;
    }
  }

  return {
    build: retained,
    initialMeasurement,
    finalMeasurement: retainedMeasurement,
    log: {
      initialList: [...options.initial.deck],
      initialScore: initialMeasurement.score,
      acceptedSwaps,
      rejectedSwaps,
      unproposedIterations,
    },
    greedyBeatsFinal: initialMeasurement.score > retainedMeasurement.score,
    nonMonotonicClimb: acceptedSwaps.some((swap) => swap.scoreDelta <= 0),
  };
}

const countRecord = (deck: readonly string[]): Record<string, number> =>
  Object.fromEntries([...cardCounts(deck)].sort(([a], [b]) => a.localeCompare(b)));

const deckSignature = (deck: readonly string[]): string => deck.join(',');

function personaFieldComposition(
  templates: readonly PersonaTemplate[],
  retained: ReadonlyMap<string, MetagameRound>,
  baseField: FieldId,
): FieldCompositionEntry[] {
  return [
    ...referenceComposition(baseField),
    ...templates
      .filter((template) => retained.has(template.id))
      .map((template) => {
        const round = retained.get(template.id)!;
        return {
          kind: 'persona' as const,
          id: `persona-${template.id}`,
          name: template.name,
          personaId: template.id,
          deck: [...round.deck],
        };
      }),
  ];
}

function craftMetagameRound(
  template: PersonaTemplate,
  round: number,
  fieldComposition: readonly FieldCompositionEntry[],
  options: MetagameOptions,
): MetagameRound {
  const craftSeed = round === 0
    ? options.seed
    : stableHash(`${options.seed}|metagame|${template.id}|round|${round}`);
  const measuredField: MeasuredFieldId = round === 0 ? options.field : 'personas';
  const measureOptions = {
    field: measuredField,
    seeds: options.seeds,
    seed: options.seed,
    personaId: template.id,
    fieldComposition,
  };
  const measure = (deck: readonly string[]): MeasuredRecord => options.measure
    ? options.measure(deck, measureOptions)
    : measureDeckAgainstField(deck, measureOptions, fieldComposition);
  const initial = buildGreedyDeck(template, options.pool, craftSeed);
  const result = runHillClimb({
    initial,
    pool: options.pool,
    template,
    iterations: options.iterations,
    seed: craftSeed,
    measure,
    propose: options.propose,
  });
  return {
    round,
    seed: craftSeed,
    measurementSeed: options.seed,
    templateVersion: template.version,
    fieldComposition: fieldComposition.map((entry) => ({ ...entry, deck: [...entry.deck] })),
    deck: [...result.build.deck],
    counts: countRecord(result.build.deck),
    selectedColors: [...result.build.selectedColors],
    measured: result.finalMeasurement,
    hillClimb: result.log,
    quotaShortfalls: result.build.quotaShortfalls,
    honesty: {
      greedyBeatsFinal: result.greedyBeatsFinal,
      nonMonotonicClimb: result.nonMonotonicClimb,
    },
  };
}

/**
 * Build one artifact per persona from the rounds crafted so far.
 *
 * Shared by the final return and by every checkpoint on purpose: a checkpoint
 * is then the SAME artifact shape a completed run produces, so a crashed
 * sweep's output is readable directly rather than needing conversion. The only
 * thing distinguishing a partial artifact is its summary, which carries
 * `stoppedReason: 'in-progress'` and `converged: false`.
 */
function buildMetagameArtifacts(
  templates: readonly PersonaTemplate[],
  history: ReadonlyMap<string, MetagameRound[]>,
  summary: MetagameSummary,
  staticComposition: readonly FieldCompositionEntry[],
  options: MetagameOptions,
): PersonaArtifact[] {
  return templates.map((template) => {
    const rounds = history.get(template.id)!;
    const finalRound = rounds[rounds.length - 1];
    return {
      schemaVersion: 1 as const,
      mode: 'metagame-loop' as const,
      persona: { id: template.id, name: template.name },
      pool: options.poolId,
      field: finalRound.measured.field,
      seed: options.seed,
      seeds: options.seeds,
      iterations: options.iterations,
      templateVersion: template.version,
      selectedColors: [...finalRound.selectedColors],
      referenceField: staticComposition.map((entry) => ({ id: entry.id, name: entry.name })),
      deck: [...finalRound.deck],
      counts: { ...finalRound.counts },
      measured: finalRound.measured,
      hillClimb: finalRound.hillClimb,
      quotaShortfalls: [...finalRound.quotaShortfalls],
      honesty: {
        greedyBeatsFinal: finalRound.honesty.greedyBeatsFinal,
        nonMonotonicClimb: finalRound.honesty.nonMonotonicClimb,
        oscillating: summary.oscillatingPersonas.includes(template.id),
      },
      metagame: { summary, rounds },
    } satisfies PersonaArtifact;
  });
}

/**
 * 1.4 Pillar 2 policy: round 0 is the byte-identical v1 static-field craft,
 * followed by up to maxRounds simultaneous best responses. Stop on an all-deck
 * stability round, stop and report a repeated non-stable deck as oscillation
 * with its first-ever and most-recent occurrence, or report max-rounds without
 * convergence. Persona scores are never averaged.
 */
export function runMetagameLoop(options: MetagameOptions): MetagameResult {
  if (options.maxRounds < 1 || !Number.isInteger(options.maxRounds)) {
    throw new Error(`maxRounds must be a positive integer (got ${options.maxRounds})`);
  }
  const ids = [...options.personaIds];
  if (new Set(ids).size !== ids.length) throw new Error('Metagame personas must be unique');
  if (ids.length < 2) throw new Error('Metagame loop requires at least two personas');
  const idSet = new Set(ids);
  const templates = PERSONA_TEMPLATES.filter((template) => idSet.has(template.id));
  if (templates.length !== ids.length) {
    const unknown = ids.find((id) => !templates.some((template) => template.id === id));
    throw new Error(`Unknown persona: ${unknown}`);
  }

  const history = new Map<string, MetagameRound[]>();
  const retained = new Map<string, MetagameRound>();
  const seen = new Map<string, Map<string, { firstRound: number; lastRound: number }>>();
  const staticComposition = referenceComposition(options.field);
  /**
   * Emit the rounds crafted so far as artifacts. Cheap next to a round of
   * hill-climbing, so it runs unconditionally at every round boundary rather
   * than on a timer - the recovery granularity is then exactly one round.
   */
  const emitCheckpoint = (roundsDone: number): void => {
    if (!options.onCheckpoint) return;
    const partial: MetagameSummary = {
      policy: 'stable-decks-or-oscillation-or-max-rounds',
      maxRounds: options.maxRounds,
      completedRounds: roundsDone,
      baseField: options.field,
      converged: false,
      stoppedReason: 'in-progress',
      oscillatingPersonas: [],
      oscillations: [],
    };
    options.onCheckpoint(
      buildMetagameArtifacts(templates, history, partial, staticComposition, options),
      partial,
    );
  };
  for (const [index, template] of templates.entries()) {
    options.onProgress?.({
      phase: 'seed', round: 0, maxRounds: options.maxRounds,
      personaId: template.id, personaName: template.name,
      personaIndex: index, personaCount: templates.length,
    });
    const round = craftMetagameRound(template, 0, staticComposition, options);
    history.set(template.id, [round]);
    retained.set(template.id, round);
    seen.set(template.id, new Map([[deckSignature(round.deck), { firstRound: 0, lastRound: 0 }]]));
  }

  emitCheckpoint(0);

  let completedRounds = 0;
  let summary: MetagameSummary | undefined;
  for (let roundNumber = 1; roundNumber <= options.maxRounds; roundNumber++) {
    const previous = new Map(retained);
    const next = new Map<string, MetagameRound>();
    for (const [index, template] of templates.entries()) {
      options.onProgress?.({
        phase: 'round', round: roundNumber, maxRounds: options.maxRounds,
        personaId: template.id, personaName: template.name,
        personaIndex: index, personaCount: templates.length,
      });
      const fieldComposition = personaFieldComposition(templates, previous, options.field)
        .filter((entry) => entry.personaId !== template.id);
      next.set(template.id, craftMetagameRound(template, roundNumber, fieldComposition, options));
    }
    completedRounds = roundNumber;

    const stable = templates.every((template) =>
      deckSignature(next.get(template.id)!.deck) === deckSignature(previous.get(template.id)!.deck));
    const oscillations: MetagameOscillation[] = [];
    if (!stable) {
      for (const template of templates) {
        const current = next.get(template.id)!;
        const currentSignature = deckSignature(current.deck);
        const previousSignature = deckSignature(previous.get(template.id)!.deck);
        const occurrence = seen.get(template.id)!.get(currentSignature);
        if (occurrence !== undefined && currentSignature !== previousSignature) {
          oscillations.push({
            personaId: template.id,
            firstRound: occurrence.firstRound,
            repeatRound: roundNumber,
            period: roundNumber - occurrence.lastRound,
          });
        }
      }
    }

    for (const template of templates) {
      const current = next.get(template.id)!;
      history.get(template.id)!.push(current);
      retained.set(template.id, current);
      const signature = deckSignature(current.deck);
      const occurrence = seen.get(template.id)!.get(signature);
      if (occurrence) occurrence.lastRound = roundNumber;
      else seen.get(template.id)!.set(signature, { firstRound: roundNumber, lastRound: roundNumber });
    }

    emitCheckpoint(roundNumber);

    if (stable) {
      summary = {
        policy: 'stable-decks-or-oscillation-or-max-rounds',
        maxRounds: options.maxRounds,
        completedRounds,
        baseField: options.field,
        converged: true,
        stoppedReason: 'stable-decks',
        oscillatingPersonas: [],
        oscillations: [],
      };
      break;
    }
    if (oscillations.length > 0) {
      summary = {
        policy: 'stable-decks-or-oscillation-or-max-rounds',
        maxRounds: options.maxRounds,
        completedRounds,
        baseField: options.field,
        converged: false,
        stoppedReason: 'oscillation',
        oscillatingPersonas: oscillations.map((finding) => finding.personaId),
        oscillations,
      };
      break;
    }
  }

  if (!summary) {
    summary = {
      policy: 'stable-decks-or-oscillation-or-max-rounds',
      maxRounds: options.maxRounds,
      completedRounds,
      baseField: options.field,
      converged: false,
      stoppedReason: 'max-rounds',
      oscillatingPersonas: [],
      oscillations: [],
    };
  }

  return {
    artifacts: buildMetagameArtifacts(templates, history, summary, staticComposition, options),
    summary,
  };
}

export function makeArtifact(
  template: PersonaTemplate,
  pool: string,
  options: MeasureOptions & { iterations: number },
  result: HillClimbResult,
): PersonaArtifact {
  if (options.field === 'personas') throw new Error('makeArtifact requires a static prefabs or starters field');
  return {
    schemaVersion: 1,
    mode: 'single-round',
    persona: { id: template.id, name: template.name },
    pool,
    field: options.field,
    seed: options.seed,
    seeds: options.seeds,
    iterations: options.iterations,
    templateVersion: template.version,
    selectedColors: [...result.build.selectedColors],
    referenceField: referenceDecks(options.field).map((deck) => ({ id: deck.id, name: deck.name })),
    deck: [...result.build.deck],
    counts: countRecord(result.build.deck),
    measured: result.finalMeasurement,
    hillClimb: result.log,
    quotaShortfalls: result.build.quotaShortfalls,
    honesty: {
      greedyBeatsFinal: result.greedyBeatsFinal,
      nonMonotonicClimb: result.nonMonotonicClimb,
    },
  };
}

function parsePositiveInteger(value: string | undefined, flag: string, fallback: number, allowZero = false): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < (allowZero ? 0 : 1)) {
    throw new Error(`${flag} must be ${allowZero ? 'a non-negative' : 'a positive'} integer (got ${value})`);
  }
  return parsed;
}

function parsePersonaIds(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') throw new Error('--personas must include at least one known persona');
  const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error('--personas must include unique persona ids');
  }
  for (const id of ids) personaTemplate(id);
  return ids;
}

function pct(measurement: MeasuredRecord): string {
  const decided = measurement.rowWins + measurement.losses;
  return `${(measurement.score * 100).toFixed(1)}% (${measurement.rowWins}/${decided} decided, ${measurement.draws} draws)`;
}

export interface CliDependencies {
  measure?: MeasureFunction;
  log?: (message: string) => void;
  error?: (message: string) => void;
  today?: () => string;
}

function readArtifact(path: string): PersonaArtifact {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<PersonaArtifact>;
  if (parsed.schemaVersion !== 1 || !parsed.persona?.id || !Array.isArray(parsed.deck)) {
    throw new Error(`Invalid persona artifact: ${path}`);
  }
  assertCraftedDeckLegal(parsed.deck);
  return parsed as PersonaArtifact;
}

export function runCli(argv: readonly string[], dependencies: CliDependencies = {}): number {
  const log = dependencies.log ?? console.log;
  const error = dependencies.error ?? console.error;
  const measure = dependencies.measure ?? measureDeck;
    const opt = (name: string): string | undefined => {
      const index = argv.indexOf(`--${name}`);
      return index >= 0 ? argv[index + 1] : undefined;
  };
  const has = (name: string): boolean => argv.includes(`--${name}`);

  try {
    if (has('help')) {
      log(CLI_HELP);
      return 0;
    }

    const requestedWorkers = opt('workers');
    const workers = requestedWorkers === undefined
      ? resolveMeasureWorkers()
      : parsePositiveInteger(requestedWorkers, '--workers', defaultMeasureWorkers());
    const memoize = !has('no-memo');
    const runtimeMeasure: MeasureFunction = (deck, options) => {
      const configured = { ...options, workers, memoize };
      if (dependencies.measure) return measure(deck, configured);
      if (configured.field === 'personas') {
        if (!configured.fieldComposition) throw new Error('Persona measurement requires a field composition');
        return measureDeckAgainstField(deck, configured, configured.fieldComposition);
      }
      return measureDeck(deck, configured);
    };

    const checkPath = opt('check');
    if (checkPath) {
      const artifact = readArtifact(checkPath);
      const seeds = parsePositiveInteger(opt('seeds'), '--seeds', artifact.seeds);
      const requestedField = opt('field');
      let checked: MeasuredRecord;
      if (artifact.mode === 'metagame-loop') {
        if (requestedField !== undefined && requestedField !== 'personas') {
          throw new Error(`--field must be personas for a metagame artifact (got ${requestedField})`);
        }
        const finalRound = artifact.metagame?.rounds[artifact.metagame.rounds.length - 1];
        if (!finalRound) throw new Error(`Invalid metagame artifact: ${checkPath}`);
        checked = runtimeMeasure(artifact.deck, {
            field: 'personas',
            seeds,
            seed: artifact.seed,
            personaId: artifact.persona.id,
            fieldComposition: finalRound.fieldComposition,
          });
      } else {
        const field = (requestedField ?? artifact.field) as FieldId;
        if (field !== 'prefabs' && field !== 'starters') {
          throw new Error(`--field must be prefabs or starters (got ${field})`);
        }
        checked = runtimeMeasure(artifact.deck, {
          field,
          seeds,
          seed: artifact.seed,
          personaId: artifact.persona.id,
        });
      }
      log(`Checked ${basename(checkPath)} (${artifact.persona.id})`);
      log(`Retained: ${pct(artifact.measured)}`);
      log(`Current: ${pct(checked)}`);
      log(`Drift: ${((checked.score - artifact.measured.score) * 100).toFixed(1)} percentage points`);
      return 0;
    }

    const personaId = opt('persona');
    const personaList = opt('personas');
    const metagame = has('metagame');
    let selectedPersonaIds: string[] | undefined;
    if (metagame) {
      const selectionCount = (has('all') ? 1 : 0) + (personaList !== undefined ? 1 : 0) + (personaId ? 1 : 0);
      if (selectionCount !== 1) {
        throw new Error('Choose exactly one of --personas <id,id,...> or --all for --metagame');
      }
      const selected = has('all')
        ? PERSONA_TEMPLATES.map((template) => template.id)
        : personaList !== undefined
          ? parsePersonaIds(personaList)
          : [personaTemplate(personaId!).id];
      selectedPersonaIds = selected;
      if (selected.length < 2) throw new Error('Metagame loop requires at least two personas');
    } else if ((personaId ? 1 : 0) + (has('all') ? 1 : 0) !== 1) {
      throw new Error('Choose exactly one of --persona <id> or --all');
    }
    const poolId = opt('pool') ?? 'all';
    const pool = cardsForPool(poolId);
    const field = (opt('field') ?? 'prefabs') as FieldId;
    if (field !== 'prefabs' && field !== 'starters') throw new Error(`--field must be prefabs or starters (got ${field})`);
    const seeds = parsePositiveInteger(opt('seeds'), '--seeds', DEFAULT_SEEDS);
    const iterations = parsePositiveInteger(opt('iterations'), '--iterations', DEFAULT_ITERATIONS, true);
    const seed = parsePositiveInteger(opt('seed'), '--seed', DEFAULT_SEED, true);
    const outDir = resolve(opt('out') ?? 'scripts/personas/decks');
    mkdirSync(outDir, { recursive: true });

    if (metagame) {
      const maxRounds = parsePositiveInteger(opt('rounds'), '--rounds', DEFAULT_METAGAME_ROUNDS);
      // Live progress for the sweep dashboard: one JSON overwrite per crafted
      // persona (coarse on purpose - the hill-climb itself stays silent). The
      // wall-clock stamps live only here in the CLI shell, never in the loop.
      const statusPath = opt('status-file');
      const sweepStartedAt = new Date().toISOString();
      const writeStatus = (payload: Record<string, unknown>): void => {
        if (!statusPath) return;
        writeFileSync(statusPath, `${JSON.stringify({
          startedAt: sweepStartedAt,
          updatedAt: new Date().toISOString(),
          seeds,
          iterations,
          maxRounds,
          personaCount: selectedPersonaIds!.length,
          outDir,
          ...payload,
        }, null, 2)}
`, 'utf8');
      };
      writeStatus({ state: 'starting' });
      // Checkpoint writes. The loop stays pure - it hands us artifacts, the CLI
      // shell owns the filesystem - and the paths are the SAME ones the final
      // write uses, so a completed run simply overwrites its own checkpoints
      // and leaves no partial files behind. A run killed mid-flight leaves the
      // last completed round on disk, flagged `stoppedReason: 'in-progress'`.
      const today = dependencies.today?.() ?? new Date().toISOString().slice(0, 10);
      const artifactPathFor = (personaId: string): string =>
        join(outDir, `${today}-metagame-${personaId}-${poolId}.json`);
      const writeCheckpoint = (
        artifacts: PersonaArtifact[],
        partial: MetagameSummary,
      ): void => {
        for (const artifact of artifacts) {
          writeFileSync(
            artifactPathFor(artifact.persona.id),
            `${JSON.stringify(artifact, null, 2)}
`,
            'utf8',
          );
        }
        log(`Checkpoint: ${artifacts.length} artifact(s) after round ${partial.completedRounds}`);
      };
      const result = runMetagameLoop({
        poolId,
        pool,
        field,
        seeds,
        iterations,
        seed,
        maxRounds,
        personaIds: selectedPersonaIds!,
        measure: runtimeMeasure,
        onProgress: (event) => writeStatus({ state: 'running', ...event }),
        onCheckpoint: writeCheckpoint,
      });
      writeStatus({
        state: 'done',
        summary: result.summary,
        artifacts: result.artifacts.map((artifact) => ({
          personaId: artifact.persona.id,
          personaName: artifact.persona.name,
          measuredScore: artifact.measured.score,
          rounds: artifact.metagame!.rounds.length,
        })),
      });
      for (const artifact of result.artifacts) {
        const artifactPath = artifactPathFor(artifact.persona.id);
        writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
        log(`Metagame ${artifact.persona.name} (${artifact.persona.id})`);
        log(`Final: ${pct(artifact.measured)} after ${artifact.metagame!.rounds.length} recorded rounds`);
        log(`Artifact: ${artifactPath}`);
      }
      log(`Convergence: ${result.summary.stoppedReason}; ${result.summary.completedRounds}/${result.summary.maxRounds} loop rounds`);
      if (result.summary.oscillatingPersonas.length > 0) {
        log(`Finding: oscillating personas: ${result.summary.oscillatingPersonas.join(', ')}`);
      } else if (!result.summary.converged) {
        log('Finding: loop reached max-rounds without convergence');
      }
      return 0;
    }

    const templates = has('all') ? PERSONA_TEMPLATES : [personaTemplate(personaId!)];

    for (const template of templates) {
      const initial = buildGreedyDeck(template, pool, seed);
      const measureOptions = { field, seeds, seed, personaId: template.id };
      const result = runHillClimb({
        initial,
        pool,
        template,
        iterations,
        seed,
        measure: (deck) => runtimeMeasure(deck, measureOptions),
      });
      const artifact = makeArtifact(template, poolId, { ...measureOptions, iterations }, result);
      const today = dependencies.today?.() ?? new Date().toISOString().slice(0, 10);
      const artifactPath = join(outDir, `${today}-${template.id}-${poolId}.json`);
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

      const counts = snapshotDeckCounts(result.build);
      log(`Crafted ${template.name} (${template.id})`);
      log(`Pool: ${poolId} | Colors: ${result.build.selectedColors.join('/')} | ${counts.total} cards | ${counts.lands} lands`);
      log(`Greedy: ${pct(result.initialMeasurement)} vs ${field} at ${seeds} seeds per matchup`);
      log(`Final: ${pct(result.finalMeasurement)} vs ${field} at ${seeds} seeds per matchup`);
      log(`Accepted swaps: ${result.log.acceptedSwaps.length}; rejected: ${result.log.rejectedSwaps}; no proposal: ${result.log.unproposedIterations}`);
      if (result.build.quotaShortfalls.length === 0) log('Quota shortfalls: none');
      else {
        log('Quota shortfalls:');
        for (const shortfall of result.build.quotaShortfalls) log(`  ${shortfall.role}: ${shortfall.missing}. ${shortfall.reason}`);
      }
      log(`Honesty: greedy beats final: ${result.greedyBeatsFinal ? 'YES' : 'no'}; non-monotonic accepted steps: ${result.nonMonotonicClimb ? 'YES' : 'no'}`);
      log(`Artifact: ${artifactPath}`);
    }
    return 0;
  } catch (caught) {
    error(caught instanceof Error ? caught.message : String(caught));
    return 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url)).toLowerCase()) {
  process.exitCode = runCli(process.argv.slice(2));
}
