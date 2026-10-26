/**
 * The identical-action-log harness: proves an AI change leaves decisions alone.
 *
 * `record` plays a seeded set of games (Warchest by default; Darlings and
 * classic per pair or with `--format`) and writes every action each seat
 * submitted, in order, one JSON line per game. `compare` reads two such
 * files and reports, per game, the first decision where they differ (seed,
 * turn, step, awaiting kind, both actions). Record once before a change and
 * once after it; zero divergences on a broad set is the proof that a speed
 * change (or a new read that should be inert on today's cards) changed no
 * decision.
 *
 *   npx tsx scripts/action-log.ts record --preset broad --out before.jsonl
 *   npx tsx scripts/action-log.ts record --preset broad --out after.jsonl
 *   npx tsx scripts/action-log.ts compare before.jsonl after.jsonl
 *
 * Each game also carries a digest of its whole event stream (every event the
 * engine emitted, in order, hashed as it was emitted). `compare` reports the
 * games whose digests differ beside the action divergences: an engine
 * refactor that reorders events without changing any decision (combat's
 * damage moved onto a shared path, lane A) is invisible to the actions and
 * visible to the digest. Files recorded before the digest existed compare
 * actions only.
 *
 * Any deck pair, any brain:
 *
 *   npx tsx scripts/action-log.ts record \
 *     --pair persona:scripts/personas/decks/2026-08-31-metagame-weenie-all.json,starter:starter-crimson \
 *     --pair starter:starter-wild@medium,avatar:the-marsh-mother \
 *     --pair darlings:darlings-hel,avatar:hel,darlings \
 *     --seeds 10 --difficulty hard --out run.jsonl
 *
 * A pair is `<side>,<side>[,<format>]`; the format (warchest | darlings |
 * classic) defaults to `--format`, which defaults to warchest. A side is
 * `<deck>[@<brain>]`:
 *   deck   starter:<id> | theme:<id>       a granted deck: its reserve build
 *                                          (Warchest, Darlings with no Darling)
 *                                          or its 60-card list (classic)
 *          avatar:<id>                     a gauntlet avatar: reserveDeck,
 *                                          darlingsDeck with her Darling, or
 *                                          the classic deck
 *          darlings:<precon id>            a Darlings precon (Darlings only)
 *          persona:<path to craft json>    a crafted persona deck (not classic)
 *          greedy:<persona>[:<seed>]       the persona's greedy build over the
 *                                          whole live pool (the deck a sweep's
 *                                          round 0 measures first; seed 13003;
 *                                          not classic)
 *   brain  easy | medium | hard            that brain, neutral personality
 *          avatar                          the avatar's own difficulty and
 *                                          personality (avatar decks only)
 * With no `@`, avatar decks play their own brain and every other deck plays
 * `--difficulty` (default hard).
 *
 * Presets: `weenie` (the greedy weenie build, the go-wide workload, and the
 * greedy midrange build, its baseline, each against all 14 prefabs, Hard on
 * both seats) and `broad` (the weenie preset, the crafted weenie against the
 * crafted midrange, every starter against four summit bosses, the starters in
 * a round robin, Medium and Easy games, since the combat planner is shared
 * by every brain, and Darlings and classic pairs last, so the Warchest games
 * before them keep their seeds). `--list` prints a preset's pairs.
 *
 * Game i of a pair uses seed `--base-seed + pairIndex * 1000 + i`, and the
 * seats alternate (even i: the first side is P0). A brain gets the same AI
 * seed the persona measurer gives it. Games run in `--workers` child
 * processes (default 4, at most 6); the output is ordered by pair and game,
 * so the file is byte-identical at any worker count. `--timing` adds a
 * side file (`<out>.timing.json`, never compared): each game's brain time and
 * whole-game wall clock, and brain time by decision kind and by board width.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { buildAI, DEFAULT_PERSONALITY, type Personality } from '../src/ai/personality';
import type { AIPlayer } from '../src/ai/AIPlayer';
import { CARD_DB } from '../src/data/catalog';
import { DARLINGS_PRECONS } from '../src/data/darlingsPrecons';
import { AVATARS } from '../src/data/opponents';
import { buildGreedyDeck, cardsForPool } from './personas/craft';
import { personaTemplate } from './personas/templates';
import { STARTER_DECKS, THEME_DECKS } from '../src/data/starterDecks';
import { Game } from '../src/engine/Game';
import type { Action } from '../src/engine/actions';
import type { GameEvent } from '../src/engine/events';
import type { PlayerId } from '../src/engine/types';
import type { Difficulty } from '../src/meta/Economy';

const SELF = fileURLToPath(import.meta.url);
const MAX_WORKERS = 6;
export const MAX_DECISIONS = 40_000;

// ---------------------------------------------------------------------------
// Sides

export type HarnessFormat = 'warchest' | 'darlings' | 'classic';
const FORMATS: readonly HarnessFormat[] = ['warchest', 'darlings', 'classic'];

export interface ResolvedSide {
  spec: string;
  deck: string[];
  /** Empty in classic, where the lands are in the deck. */
  landReserve: string[];
  /** The command-zone Darling (Darlings only; null when the deck has none). */
  darlingId: string | null;
  difficulty: Difficulty;
  personality: Personality;
}

const greedyBuilds = new Map<string, { deck: string[]; landReserve: string[] }>();

export function resolveSide(spec: string, defaultDifficulty: Difficulty, format: HarnessFormat): ResolvedSide {
  const [deckRef, brain] = spec.split('@');
  const colon = deckRef.indexOf(':');
  if (colon < 0) throw new Error(`Side "${spec}" needs a kind: starter:, theme:, avatar:, darlings:, persona: or greedy:`);
  const kind = deckRef.slice(0, colon);
  const id = deckRef.slice(colon + 1);
  let deck: string[];
  let landReserve: string[];
  let darlingId: string | null = null;
  let own: { difficulty: Difficulty; personality: Personality } | undefined;
  const noClassic = (): void => {
    if (format === 'classic') throw new Error(`Side "${spec}": ${kind} decks have no classic list`);
  };
  if (kind === 'starter' || kind === 'theme') {
    const list = (kind === 'starter' ? STARTER_DECKS : THEME_DECKS).find((d) => d.id === id);
    if (!list) throw new Error(`Unknown ${kind} deck ${id}`);
    if (format === 'classic') {
      deck = [...list.cards];
      landReserve = [];
    } else {
      if (!list.reserveCards || !list.landReserve) throw new Error(`${kind} deck ${id} has no reserve build`);
      deck = [...list.reserveCards];
      landReserve = [...list.landReserve];
    }
  } else if (kind === 'avatar') {
    const avatar = AVATARS.find((a) => a.id === id);
    if (!avatar) throw new Error(`Unknown avatar ${id}`);
    deck = [...(format === 'classic' ? avatar.deck : format === 'darlings' ? avatar.darlingsDeck : avatar.reserveDeck)];
    landReserve = format === 'classic' ? [] : [...avatar.landReserve];
    if (format === 'darlings') darlingId = avatar.darlingId;
    own = { difficulty: avatar.difficulty, personality: avatar.personality };
  } else if (kind === 'darlings') {
    const precon = DARLINGS_PRECONS.find((d) => d.id === id);
    if (!precon) throw new Error(`Unknown Darlings precon ${id}`);
    if (format !== 'darlings') throw new Error(`Side "${spec}": a Darlings precon plays only the darlings format`);
    deck = [...precon.cards];
    landReserve = [...precon.landReserve];
    darlingId = precon.darlingId;
  } else if (kind === 'persona') {
    noClassic();
    const raw = JSON.parse(readFileSync(resolve(id), 'utf8')) as { deck?: string[]; landReserve?: string[] };
    if (!raw.deck || !raw.landReserve) throw new Error(`Persona file ${id} has no deck and landReserve`);
    deck = [...raw.deck];
    landReserve = [...raw.landReserve];
  } else if (kind === 'greedy') {
    noClassic();
    const [persona, seedText] = id.split(':');
    let build = greedyBuilds.get(id);
    if (!build) {
      build = buildGreedyDeck(personaTemplate(persona), cardsForPool('all'), Number(seedText ?? 13_003));
      greedyBuilds.set(id, build);
    }
    deck = [...build.deck];
    landReserve = [...build.landReserve];
  } else {
    throw new Error(`Unknown deck kind "${kind}" in side "${spec}"`);
  }
  for (const card of [...deck, ...landReserve, ...(darlingId ? [darlingId] : [])]) {
    if (!CARD_DB[card]) throw new Error(`Side "${spec}" names unknown card ${card}`);
  }
  let difficulty: Difficulty;
  let personality: Personality = DEFAULT_PERSONALITY;
  if (brain === undefined) {
    if (own) ({ difficulty, personality } = own);
    else difficulty = defaultDifficulty;
  } else if (brain === 'avatar') {
    if (!own) throw new Error(`Side "${spec}": @avatar needs an avatar deck`);
    ({ difficulty, personality } = own);
  } else if (brain === 'easy' || brain === 'medium' || brain === 'hard') {
    difficulty = brain;
  } else {
    throw new Error(`Side "${spec}": unknown brain "${brain}"`);
  }
  return { spec, deck, landReserve, darlingId, difficulty, personality };
}

// ---------------------------------------------------------------------------
// Presets

const WEENIE_DECK = 'greedy:weenie';
const MIDRANGE_DECK = 'greedy:midrange';
const CRAFTED_WEENIE = 'persona:scripts/personas/decks/2026-08-31-metagame-weenie-all.json';
const CRAFTED_MIDRANGE = 'persona:scripts/personas/decks/2026-08-31-metagame-midrange-all.json';
const SUMMIT_BOSSES = ['bastet-mistress-of-the-ninth-return', 'chrome-broodmother', 'the-drowned-deacon', 'the-marsh-mother'];
/** Easy and Medium rungs (their own brains and personalities). */
const LOWER_BOSSES = ['menghuo', 'lupa', 'hera', 'zhurong', 'simayi'];

export interface PairSpec {
  a: string;
  b: string;
  seeds: number;
  /** Warchest when absent. */
  format?: HarnessFormat;
}

function presetPairs(name: string, seeds: number | undefined): PairSpec[] {
  const prefabs = [...STARTER_DECKS.map((d) => `starter:${d.id}`), ...THEME_DECKS.map((d) => `theme:${d.id}`)];
  const starters = STARTER_DECKS.map((d) => `starter:${d.id}`);
  // The sweep's round-0 shape: the persona's greedy build against every
  // prefab, Hard on both seats. Weenie is the go-wide workload and midrange
  // the baseline it is measured against.
  const weenie: PairSpec[] = [
    ...prefabs.map((b) => ({ a: WEENIE_DECK, b, seeds: seeds ?? 4 })),
    ...prefabs.map((b) => ({ a: MIDRANGE_DECK, b, seeds: seeds ?? 4 })),
  ];
  if (name === 'weenie') return weenie;
  if (name === 'broad') {
    const out = [...weenie, { a: CRAFTED_WEENIE, b: CRAFTED_MIDRANGE, seeds: seeds ?? 6 }];
    for (const starter of starters) {
      for (const boss of SUMMIT_BOSSES) out.push({ a: starter, b: `avatar:${boss}`, seeds: seeds ?? 2 });
    }
    for (let i = 0; i < starters.length; i++) {
      for (let j = i + 1; j < starters.length; j++) out.push({ a: starters[i], b: starters[j], seeds: seeds ?? 2 });
    }
    // combatPlans and value are shared with Medium and Easy: the lower rungs'
    // own brains and personalities, and both brains on the starters.
    for (const [i, boss] of LOWER_BOSSES.entries()) {
      out.push({ a: `${starters[i % starters.length]}@medium`, b: `avatar:${boss}`, seeds: seeds ?? 2 });
    }
    out.push({ a: WEENIE_DECK + '@medium', b: 'starter:starter-wild@medium', seeds: seeds ?? 4 });
    out.push({ a: WEENIE_DECK + '@easy', b: 'starter:starter-crimson@medium', seeds: seeds ?? 4 });
    // The other two formats, appended so every Warchest game above keeps its
    // index and seed. Darlings: two precons, a Medium precon pair, and a summit
    // avatar with her own Darling. Classic: the 60-card lists.
    out.push(
      { a: 'darlings:darlings-zhou-yu', b: 'darlings:darlings-hel', seeds: seeds ?? 4, format: 'darlings' },
      { a: 'darlings:darlings-elizabeth@medium', b: 'darlings:darlings-warrior-ballad@medium', seeds: seeds ?? 2, format: 'darlings' },
      { a: 'avatar:the-marsh-mother', b: 'darlings:darlings-aine', seeds: seeds ?? 2, format: 'darlings' },
      { a: 'starter:starter-crimson', b: 'starter:starter-wild', seeds: seeds ?? 4, format: 'classic' },
      { a: 'starter:starter-tides', b: 'avatar:the-drowned-deacon', seeds: seeds ?? 2, format: 'classic' },
    );
    return out;
  }
  throw new Error(`Unknown preset ${name} (weenie | broad)`);
}

// ---------------------------------------------------------------------------
// Playing and logging one game

export interface GameJob {
  index: number;
  pairIndex: number;
  gameIndex: number;
  seed: number;
  aIsP0: boolean;
  a: string;
  b: string;
  format: HarnessFormat;
}

/** One submitted action: [seat, turn, step, awaiting kind, action]. */
export type LoggedAction = [PlayerId, number, string, string, Action];

export interface GameLog {
  index: number;
  seed: number;
  p0: string;
  p1: string;
  /** Present only when not Warchest, so Warchest logs read as before. */
  format?: HarnessFormat;
  winner: 0 | 1 | 'draw' | 'unfinished';
  turns: number;
  hash: string;
  /** A hash of every event the game emitted, in emission order, and how many
   * there were. Absent in files recorded before the digest existed. */
  eventDigest?: string;
  events?: number;
  actions: LoggedAction[];
}

export interface DecisionTiming {
  seat: PlayerId;
  difficulty: Difficulty;
  kind: string;
  creatures: number;
  ms: number;
  /** The whole game's wall clock, engine included; the last entry of a game. */
  wholeGame?: true;
}

/**
 * The event digest: every event, in order, as its JSON, one per line, hashed.
 * Fed one event at a time as the engine emits it (playLogged), or all at once
 * (digestOf); both hash the same bytes. Event variants, including
 * `tokenRefused`, need no discriminator case because their full JSON is hashed.
 */
export class EventDigest {
  private readonly hash = createHash('sha256');
  count = 0;

  add(e: Readonly<GameEvent>): void {
    this.hash.update(JSON.stringify(e));
    this.hash.update('\n');
    this.count++;
  }

  value(): string {
    return this.hash.digest('hex').slice(0, 16);
  }
}

/** The digest of a whole event stream: its order and every field count. */
export function digestOf(events: readonly Readonly<GameEvent>[]): string {
  const digest = new EventDigest();
  for (const e of events) digest.add(e);
  return digest.value();
}

/** Play one seeded game and log every action each seat submitted. */
export function playLogged(job: GameJob, difficulty: Difficulty, timing?: DecisionTiming[]): GameLog {
  const sa = resolveSide(job.a, difficulty, job.format);
  const sb = resolveSide(job.b, difficulty, job.format);
  const [s0, s1] = job.aIsP0 ? [sa, sb] : [sb, sa];
  // The persona measurer's AI seeds (only Easy reads them).
  const ais: AIPlayer[] = [
    buildAI(s0.difficulty, CARD_DB, job.seed * 7 + 1, s0.personality),
    buildAI(s1.difficulty, CARD_DB, job.seed * 13 + 5, s1.personality),
  ];
  const decks: [string[], string[]] = [[...s0.deck], [...s1.deck]];
  // The event digest reads each event as it is emitted (a later mutation of a
  // permanent it carries cannot leak in). Clones the AI simulates on carry no
  // observer, so only the real game's stream is hashed.
  const digest = new EventDigest();
  const eventObserver = (e: Readonly<GameEvent>): void => digest.add(e);
  // Classic is the engine's default constructor; the reserve formats pass
  // their reserves (and Darlings its command-zone pair) as the matrices do.
  const game = job.format === 'classic'
    ? new Game({ decks, seed: job.seed, db: CARD_DB, eventObserver })
    : new Game({
      decks,
      seed: job.seed,
      db: CARD_DB,
      eventObserver,
      format: job.format,
      landReserves: [[...s0.landReserve], [...s1.landReserve]],
      ...(job.format === 'darlings' ? { darlings: [s0.darlingId, s1.darlingId] as [string | null, string | null] } : {}),
    });
  const gameStart = timing ? performance.now() : 0;
  const actions: LoggedAction[] = [];
  let winner: GameLog['winner'] = 'unfinished';
  for (let i = 0; i < MAX_DECISIONS; i++) {
    const a = game.awaiting;
    if (a.kind === 'gameOver') {
      winner = game.instanceState.winner ?? 'draw';
      break;
    }
    const seat = a.player;
    const view = game.viewFor(seat);
    const legal = game.legalActions(seat);
    const start = timing ? performance.now() : 0;
    const action = ais[seat].chooseAction(view, legal);
    if (timing) {
      const creatures = view.battlefield.filter((p) => CARD_DB[p.cardId]?.types.includes('creature')).length;
      timing.push({ seat, difficulty: seat === 0 ? s0.difficulty : s1.difficulty, kind: a.kind, creatures, ms: performance.now() - start });
    }
    actions.push([seat, game.state.turn, game.state.step, a.kind, action]);
    game.submit(seat, action);
  }
  if (timing) {
    timing.push({ seat: 0, difficulty: s0.difficulty, kind: '(whole game)', creatures: 0, ms: performance.now() - gameStart, wholeGame: true });
  }
  const body = JSON.stringify(actions);
  return {
    index: job.index,
    seed: job.seed,
    p0: s0.spec + '@' + s0.difficulty,
    p1: s1.spec + '@' + s1.difficulty,
    ...(job.format === 'warchest' ? {} : { format: job.format }),
    winner,
    turns: game.state.turn,
    hash: createHash('sha256').update(body).digest('hex').slice(0, 16),
    eventDigest: digest.value(),
    events: digest.count,
    actions,
  };
}

export function jobsFor(pairs: PairSpec[], baseSeed: number): GameJob[] {
  const jobs: GameJob[] = [];
  pairs.forEach((pair, pairIndex) => {
    for (let gameIndex = 0; gameIndex < pair.seeds; gameIndex++) {
      jobs.push({
        index: jobs.length,
        pairIndex,
        gameIndex,
        seed: baseSeed + pairIndex * 1000 + gameIndex,
        aIsP0: gameIndex % 2 === 0,
        a: pair.a,
        b: pair.b,
        format: pair.format ?? 'warchest',
      });
    }
  });
  return jobs;
}

// ---------------------------------------------------------------------------
// Timing summary

interface TimingSummary {
  games: number;
  /** Time inside the brains' chooseAction, summed over every game. */
  totalMs: number;
  /** Whole-game wall clock (engine included), summed over every game. */
  wallMs: number;
  perGameMs: { index: number; p0: string; p1: string; ms: number; wallMs: number; decisions: number }[];
  byKind: Record<string, { n: number; ms: number; max: number }>;
  byWidth: Record<string, { n: number; ms: number; max: number }>;
}

function summarise(logs: GameLog[], timings: DecisionTiming[][]): TimingSummary {
  const byKind: TimingSummary['byKind'] = {};
  const byWidth: TimingSummary['byWidth'] = {};
  const add = (bucket: TimingSummary['byKind'], key: string, ms: number): void => {
    const row = (bucket[key] ??= { n: 0, ms: 0, max: 0 });
    row.n++;
    row.ms += ms;
    row.max = Math.max(row.max, ms);
  };
  const perGameMs = logs.map((log, i) => {
    let ms = 0;
    let wallMs = 0;
    let decisions = 0;
    for (const t of timings[i]) {
      if (t.wholeGame) {
        wallMs = t.ms;
        continue;
      }
      decisions++;
      ms += t.ms;
      add(byKind, `${t.difficulty}:${t.kind}`, t.ms);
      const band = t.creatures < 6 ? '0-5' : t.creatures < 11 ? '6-10' : t.creatures < 16 ? '11-15' : t.creatures < 21 ? '16-20' : '21+';
      add(byWidth, `${t.difficulty}:${band}`, t.ms);
    }
    return { index: log.index, p0: log.p0, p1: log.p1, ms, wallMs, decisions };
  });
  return {
    games: logs.length,
    totalMs: perGameMs.reduce((s, g) => s + g.ms, 0),
    wallMs: perGameMs.reduce((s, g) => s + g.wallMs, 0),
    perGameMs, byKind, byWidth,
  };
}

// ---------------------------------------------------------------------------
// Compare

export interface Divergence {
  index: number;
  seed: number;
  p0: string;
  p1: string;
  /** Position in the game's action list of the first action that differs. */
  decision: number;
  turn: number | null;
  step: string | null;
  kind: string | null;
  seat: PlayerId | null;
  before: unknown;
  after: unknown;
}

export interface CompareResult {
  /** Actions that matched, counted up to each game's first divergence. */
  identical: number;
  divergences: Divergence[];
  /** Games in `before` with no counterpart in `after`, and the reverse. */
  missing: number;
  extra: number;
}

export function readLogs(path: string): GameLog[] {
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as GameLog);
}

/** Compare two recordings game by game; report each game's first differing
 * action. Games are matched by index and must be the same seeded game. */
export function compareLogs(before: readonly GameLog[], after: readonly GameLog[]): CompareResult {
  const afterByIndex = new Map(after.map((log) => [log.index, log]));
  const beforeIndices = new Set(before.map((log) => log.index));
  const divergences: Divergence[] = [];
  let identical = 0;
  let missing = 0;
  for (const b of before) {
    const a = afterByIndex.get(b.index);
    if (!a) {
      missing++;
      continue;
    }
    if (a.seed !== b.seed || a.p0 !== b.p0 || a.p1 !== b.p1 || (a.format ?? 'warchest') !== (b.format ?? 'warchest')) {
      throw new Error(`Game ${b.index} is a different game in the two files (seed, sides or format differ)`);
    }
    const n = Math.max(a.actions.length, b.actions.length);
    for (let d = 0; d < n; d++) {
      const x = b.actions[d];
      const y = a.actions[d];
      if (JSON.stringify(x) === JSON.stringify(y)) {
        identical++;
        continue;
      }
      const ref = x ?? y;
      divergences.push({
        index: b.index, seed: b.seed, p0: b.p0, p1: b.p1, decision: d,
        turn: ref?.[1] ?? null, step: ref?.[2] ?? null, kind: ref?.[3] ?? null, seat: ref?.[0] ?? null,
        before: x ? x[4] : '(game over)', after: y ? y[4] : '(game over)',
      });
      break;
    }
  }
  const extra = after.filter((log) => !beforeIndices.has(log.index)).length;
  return { identical, divergences, missing, extra };
}

export interface DigestDivergence {
  index: number;
  seed: number;
  p0: string;
  p1: string;
  /** Event counts before and after: equal counts mean a reorder or a changed event. */
  eventsBefore: number;
  eventsAfter: number;
}

/** The games, present in both files with a digest in both, whose event
 * streams differ. Games recorded without a digest are skipped. */
export function compareDigests(before: readonly GameLog[], after: readonly GameLog[]): { compared: number; divergences: DigestDivergence[] } {
  const afterByIndex = new Map(after.map((log) => [log.index, log]));
  const divergences: DigestDivergence[] = [];
  let compared = 0;
  for (const b of before) {
    const a = afterByIndex.get(b.index);
    if (!a || b.eventDigest === undefined || a.eventDigest === undefined) continue;
    compared++;
    if (a.eventDigest !== b.eventDigest) {
      divergences.push({ index: b.index, seed: b.seed, p0: b.p0, p1: b.p1, eventsBefore: b.events ?? 0, eventsAfter: a.events ?? 0 });
    }
  }
  return { compared, divergences };
}

function compare(beforePath: string, afterPath: string): number {
  const before = readLogs(beforePath);
  const after = readLogs(afterPath);
  const { identical, divergences, missing, extra } = compareLogs(before, after);
  console.log(`games: ${before.length} before, ${after.length} after, ${missing} missing from after, ${extra} only in after`);
  console.log(`actions compared identical: ${identical}`);
  console.log(`games that diverge: ${divergences.length}`);
  for (const d of divergences.slice(0, 20)) {
    console.log(`  game ${d.index} seed ${d.seed} (${d.p0} vs ${d.p1}): decision ${d.decision}, turn ${d.turn} ${d.step} ${d.kind}, seat P${d.seat}`);
    console.log(`    before: ${JSON.stringify(d.before)}`);
    console.log(`    after:  ${JSON.stringify(d.after)}`);
  }
  if (divergences.length > 20) console.log(`  ... ${divergences.length - 20} more`);
  const digests = compareDigests(before, after);
  console.log(`event digests compared: ${digests.compared}; games whose event stream differs: ${digests.divergences.length}`);
  for (const d of digests.divergences.slice(0, 20)) {
    console.log(`  game ${d.index} seed ${d.seed} (${d.p0} vs ${d.p1}): ${d.eventsBefore} events before, ${d.eventsAfter} after`);
  }
  if (digests.divergences.length > 20) console.log(`  ... ${digests.divergences.length - 20} more`);
  return divergences.length === 0 && digests.divergences.length === 0 && missing === 0 && extra === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// CLI

function parseArgs(argv: string[]): { cmd: string; positional: string[]; opts: Map<string, string[]> } {
  const [cmd, ...rest] = argv;
  const positional: string[] = [];
  const opts = new Map<string, string[]>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      const value = next === undefined || next.startsWith('--') ? 'true' : (i++, next);
      opts.set(key, [...(opts.get(key) ?? []), value]);
    } else positional.push(arg);
  }
  return { cmd: cmd ?? 'help', positional, opts };
}

function one(opts: Map<string, string[]>, key: string): string | undefined {
  const values = opts.get(key);
  return values?.[values.length - 1];
}

function pairsFrom(opts: Map<string, string[]>): PairSpec[] {
  const seedsOpt = one(opts, 'seeds');
  const seeds = seedsOpt === undefined ? undefined : Number(seedsOpt);
  if (seeds !== undefined && !(Number.isInteger(seeds) && seeds > 0)) throw new Error('--seeds must be a positive integer');
  const preset = one(opts, 'preset');
  const asFormat = (text: string, where: string): HarnessFormat => {
    if (!(FORMATS as readonly string[]).includes(text)) throw new Error(`${where}: format must be ${FORMATS.join(', ')} (got ${text})`);
    return text as HarnessFormat;
  };
  // --format is the format of every pair that does not name its own.
  const format = asFormat(one(opts, 'format') ?? 'warchest', '--format');
  const explicit = (opts.get('pair') ?? []).map((p) => {
    const [a, b, pairFormat, extra] = p.split(',');
    if (!a || !b || extra) throw new Error(`--pair wants two sides and an optional format, separated by commas: ${p}`);
    return { a, b, seeds: seeds ?? 10, format: pairFormat ? asFormat(pairFormat, `--pair ${p}`) : format };
  });
  const pairs = [...(preset ? presetPairs(preset, seeds).map((p) => ({ ...p, format: p.format ?? format })) : []), ...explicit];
  if (pairs.length === 0) throw new Error('record needs --preset or at least one --pair');
  return pairs;
}

async function runShards(argv: string[], workers: number, out: string, timing: boolean): Promise<void> {
  const parts = Array.from({ length: workers }, (_, k) => `${out}.part${k}`);
  await Promise.all(parts.map((part, k) => new Promise<void>((done, fail) => {
    const child = spawn(process.execPath, ['--import', 'tsx', SELF, ...argv, '--shard', `${k}/${workers}`, '--part', part], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`shard ${k} exited ${code}`))));
  })));
  const logs: GameLog[] = [];
  const timings: DecisionTiming[][] = [];
  for (const part of parts) {
    const raw = JSON.parse(readFileSync(part, 'utf8')) as { logs: GameLog[]; timings: DecisionTiming[][] };
    logs.push(...raw.logs);
    timings.push(...raw.timings);
    rmSync(part);
  }
  const order = logs.map((_, i) => i).sort((x, y) => logs[x].index - logs[y].index);
  finish(out, order.map((i) => logs[i]), timing ? order.map((i) => timings[i]) : undefined);
}

function finish(out: string, logs: GameLog[], timings: DecisionTiming[][] | undefined): void {
  writeFileSync(out, logs.map((log) => JSON.stringify(log)).join('\n') + '\n');
  const decisions = logs.reduce((s, log) => s + log.actions.length, 0);
  const unfinished = logs.filter((log) => log.winner === 'unfinished').length;
  console.log(`wrote ${out}: ${logs.length} games, ${decisions} actions, ${unfinished} unfinished`);
  if (timings) {
    const summary = summarise(logs, timings);
    writeFileSync(`${out}.timing.json`, JSON.stringify(summary, null, 1));
    console.log(`brain time: ${(summary.totalMs / 1000).toFixed(1)} s, game wall time ${(summary.wallMs / 1000).toFixed(1)} s, over ${summary.games} games`);
  }
}

async function main(): Promise<void> {
  const { cmd, positional, opts } = parseArgs(process.argv.slice(2));
  if (cmd === 'compare') {
    if (positional.length !== 2) throw new Error('compare <before.jsonl> <after.jsonl>');
    process.exitCode = compare(positional[0], positional[1]);
    return;
  }
  if (cmd !== 'record') {
    console.log('usage: record (--preset weenie|broad | --pair a,b[,format] ...) --out <file> [--seeds n] ' +
      '[--format warchest|darlings|classic] [--difficulty easy|medium|hard] [--base-seed n] [--workers n] [--timing] [--list]\n' +
      '       compare <before.jsonl> <after.jsonl>');
    return;
  }
  const difficulty = (one(opts, 'difficulty') ?? 'hard') as Difficulty;
  if (!['easy', 'medium', 'hard'].includes(difficulty)) throw new Error('--difficulty must be easy, medium or hard');
  const baseSeed = Number(one(opts, 'base-seed') ?? 19_001);
  const pairs = pairsFrom(opts);
  const jobs = jobsFor(pairs, baseSeed);
  if (opts.has('list')) {
    for (const [i, p] of pairs.entries()) console.log(`${i}: ${p.a} vs ${p.b} x${p.seeds} (${p.format ?? 'warchest'})`);
    console.log(`${jobs.length} games`);
    return;
  }
  // Validate every side up front, in the parent, so a bad spec fails fast.
  for (const p of pairs) {
    resolveSide(p.a, difficulty, p.format ?? 'warchest');
    resolveSide(p.b, difficulty, p.format ?? 'warchest');
  }
  const timing = opts.has('timing');
  const shard = one(opts, 'shard');
  if (shard) {
    const [k, n] = shard.split('/').map(Number);
    const mine = jobs.filter((job) => job.index % n === k);
    const logs: GameLog[] = [];
    const timings: DecisionTiming[][] = [];
    for (const job of mine) {
      const t: DecisionTiming[] = [];
      logs.push(playLogged(job, difficulty, timing ? t : undefined));
      timings.push(t);
    }
    writeFileSync(one(opts, 'part')!, JSON.stringify({ logs, timings: timing ? timings : [] }));
    return;
  }
  const out = one(opts, 'out');
  if (!out) throw new Error('record needs --out <file>');
  const workers = Math.min(MAX_WORKERS, Math.max(0, Number(one(opts, 'workers') ?? 4)));
  if (workers === 0) {
    // In-process: the shape to run under node --cpu-prof.
    const logs: GameLog[] = [];
    const timings: DecisionTiming[][] = [];
    for (const job of jobs) {
      const t: DecisionTiming[] = [];
      logs.push(playLogged(job, difficulty, timing ? t : undefined));
      timings.push(t);
    }
    finish(out, logs, timing ? timings : undefined);
    return;
  }
  if (existsSync(out)) rmSync(out);
  const argv = process.argv.slice(2).filter((_, i, all) => {
    const prev = all[i - 1];
    return all[i] !== '--out' && prev !== '--out' && all[i] !== '--workers' && prev !== '--workers';
  });
  await runShards(argv, Math.min(workers, jobs.length), out, timing);
}

// Run the CLI only when invoked directly, so lane A's tests and tools can
// import the recorder and the comparer.
if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === SELF.toLowerCase()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
