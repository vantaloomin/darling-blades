/**
 * Showcase matches: find a good-looking seeded AI-vs-AI game and save it as a
 * replay the dev server plays back full screen, for trailer footage.
 *
 * The engine is seeded and deterministic, so a showcase is just a replay log:
 * the same decks, seed and recorded actions give the same game every time,
 * and every take of a shot is identical. This plays `--seeds` games of one
 * pairing, scores each for how well it shows the game off, and writes the
 * best one (or `--seed`'s game) to `showcase/<name>.json` at the repo root.
 * That folder is gitignored: a log stops replaying once any card definition
 * changes (the replay db stamp), so logs are regenerated, never committed.
 *
 *   npx tsx scripts/showcase-match.ts --a darlings:darlings-hel \
 *     --b avatar:the-marsh-mother --format darlings --seeds 40 --name hel-vs-marsh
 *
 * Then, with `npm run dev` running, open
 *   http://localhost:5173/?showcase=hel-vs-marsh
 * and the duel plays itself with no replay chrome. `&speed=2` halves the
 * pause between actions; `&scale=1.5` renders at 1920x1080 (the default),
 * `&scale=2` at 2560x1440. `scripts/showcase-capture.mjs` records it to video.
 *
 * Sides use scripts/action-log.ts's grammar (`starter:`, `theme:`, `avatar:`,
 * `darlings:`, `persona:`, `greedy:`, with an optional `@easy|medium|hard`).
 * Seat 0 (`--a`) is the side the camera follows: its hand is face up.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAI } from '../src/ai/personality';
import { CARD_DB } from '../src/data/catalog';
import { DARLINGS_PRECONS } from '../src/data/darlingsPrecons';
import { AVATARS } from '../src/data/opponents';
import { STARTER_DECKS, THEME_DECKS } from '../src/data/starterDecks';
import { Game } from '../src/engine/Game';
import type { GameEvent } from '../src/engine/events';
import type { PlayerId } from '../src/engine/types';
import { resolveDuelStartingHandSize } from '../src/meta/duelSetup';
import { finishReplay, recordReplayAction, replayDbStamp, startReplayDraft, type ReplayLog } from '../src/meta/Replay';
import { MAX_DECISIONS, resolveSide, type HarnessFormat } from './action-log';

const RARE_WEIGHT: Record<string, number> = { c: 0, r: 0, sr: 1, ssr: 2, ur: 3 };

export interface ShowcaseScore {
  seed: number;
  winner: PlayerId | 'draw' | 'unfinished';
  turns: number;
  score: number;
  /** Seat 0's life at the end and the lowest it fell to (a comeback reads well). */
  finalLife: number;
  lowestLife: number;
  bigCasts: number;
  darlingCasts: number;
  deaths: number;
}

/**
 * How well a game shows the game off. Seat 0 must win (the trailer's hero),
 * in a game long enough to build a board and short enough to watch; the rest
 * rewards high-rarity casts, Darlings, trades in combat and a close finish.
 */
export function scoreShowcase(
  seed: number,
  winner: ShowcaseScore['winner'],
  turns: number,
  events: readonly GameEvent[],
  darlingIds: ReadonlySet<string> = new Set(),
): ShowcaseScore {
  let life = Number.NaN;
  let lowest = Number.POSITIVE_INFINITY;
  let bigCasts = 0;
  let darlingCasts = 0;
  let deaths = 0;
  for (const e of events) {
    if (e.e === 'lifeChanged' && e.player === 0) {
      life = e.now;
      lowest = Math.min(lowest, e.now);
    } else if (e.e === 'spellCast') {
      bigCasts += RARE_WEIGHT[CARD_DB[e.cardId]?.rarity ?? 'c'] ?? 0;
      if (darlingIds.has(e.cardId)) darlingCasts++;
    } else if (e.e === 'died') {
      deaths++;
    }
  }
  const finalLife = Number.isNaN(life) ? 0 : life;
  const lowestLife = Number.isFinite(lowest) ? lowest : finalLife;
  let score = winner === 0 ? 100 : 0;
  // Twelve to twenty-four turns (both seats' turns count, so six to twelve
  // each): a board gets built, and the clip stays watchable.
  score -= Math.max(0, 12 - turns) * 8 + Math.max(0, turns - 24) * 6;
  score += Math.min(bigCasts, 12) * 3 + Math.min(darlingCasts, 3) * 6 + Math.min(deaths, 12);
  // A close game: seat 0 fell low at some point but still won.
  if (winner === 0) score += Math.max(0, 12 - lowestLife);
  return { seed, winner, turns, score, finalLife, lowestLife, bigCasts, darlingCasts, deaths };
}

export interface ShowcaseOptions {
  a: string;
  b: string;
  format: HarnessFormat;
  seed: number;
}

/**
 * The Game a showcase log plays in, built as DuelScene builds a replay's:
 * the coin flip and play/draw choice included, and the format's opening hand.
 * (Replay.replayGame builds without the play/draw choice, so it cannot check
 * a log the duel screen will play; `checkShowcase` below does.)
 */
function showcaseGame(log: Pick<ReplayLog, 'decks' | 'seed' | 'format' | 'landReserves' | 'darlings' | 'startingHandSize'>, eventObserver?: (e: Readonly<GameEvent>) => void): Game {
  return new Game({
    decks: [log.decks[0].slice(), log.decks[1].slice()],
    seed: log.seed,
    db: CARD_DB,
    ...(eventObserver ? { eventObserver } : {}),
    ...(log.startingHandSize === undefined ? {} : { startingHandSize: log.startingHandSize }),
    ...(log.format && log.landReserves ? { format: log.format, landReserves: [log.landReserves[0].slice(), log.landReserves[1].slice()] } : {}),
    ...(log.format === 'darlings' && log.darlings ? { darlings: [log.darlings[0], log.darlings[1]] as [string | null, string | null] } : {}),
    playDrawChoice: true,
  });
}

/** Replay a showcase log the way the duel screen will; throws on any illegal step. */
export function checkShowcase(log: ReplayLog): void {
  const game = showcaseGame(log);
  for (const step of log.actions) game.submit(step.p, step.a);
  if (game.awaiting.kind !== 'gameOver') throw new Error('The showcase log ends before the game does');
}

/** Play one seeded AI-vs-AI game, recording it as a replay log. */
export function playShowcase(opts: ShowcaseOptions): { log: ReplayLog; score: ShowcaseScore } {
  const s0 = resolveSide(opts.a, 'hard', opts.format);
  const s1 = resolveSide(opts.b, 'hard', opts.format);
  const ais = [
    buildAI(s0.difficulty, CARD_DB, opts.seed * 7 + 1, s0.personality),
    buildAI(s1.difficulty, CARD_DB, opts.seed * 13 + 5, s1.personality),
  ];
  const decks: [string[], string[]] = [[...s0.deck], [...s1.deck]];
  const landReserves: [string[], string[]] = [[...s0.landReserve], [...s1.landReserve]];
  const darlings: [string | null, string | null] = [s0.darlingId, s1.darlingId];
  const reserve = opts.format !== 'classic';
  const format = reserve ? (opts.format as 'warchest' | 'darlings') : undefined;
  const startingHandSize = resolveDuelStartingHandSize(format, null);
  const events: GameEvent[] = [];
  const game = showcaseGame(
    { decks, seed: opts.seed, format, landReserves: reserve ? landReserves : undefined, darlings: opts.format === 'darlings' ? darlings : undefined, startingHandSize },
    (e) => events.push(structuredClone(e) as GameEvent),
  );
  const avatarId = (spec: string): string | null => {
    const ref = spec.split('@')[0];
    return ref.startsWith('avatar:') ? ref.slice('avatar:'.length) : null;
  };
  const opponentId = avatarId(opts.b);
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(CARD_DB),
    seed: opts.seed,
    decks,
    ...(startingHandSize === undefined ? {} : { startingHandSize }),
    context: {
      mode: 'practice',
      difficulty: s1.difficulty,
      opponentId,
      opponentName: AVATARS.find((av) => av.id === opponentId)?.name ?? 'Showcase',
      gauntletRung: null,
    },
    ...(reserve ? { format: opts.format, landReserves } : {}),
    ...(opts.format === 'darlings' ? { darlings } : {}),
  });
  let winner: ShowcaseScore['winner'] = 'unfinished';
  for (let i = 0; i < MAX_DECISIONS; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      winner = game.instanceState.winner ?? 'draw';
      break;
    }
    const seat = awaiting.player;
    const action = ais[seat].chooseAction(game.viewFor(seat), game.legalActions(seat));
    game.submit(seat, action);
    recordReplayAction(draft, seat, action);
  }
  const log = finishReplay(draft, winner === 0 ? 'win' : 'loss', Date.now(), game.state.turn);
  return { log, score: scoreShowcase(opts.seed, winner, game.state.turn, events, new Set(darlings.filter((d): d is string => d !== null))) };
}

/** What the duel screen calls seat 0's deck: the precon's, deck's or avatar's own name. */
export function showcaseDeckName(spec: string): string {
  const ref = spec.split('@')[0];
  const id = ref.slice(ref.indexOf(':') + 1);
  const named = [...DARLINGS_PRECONS, ...STARTER_DECKS, ...THEME_DECKS, ...AVATARS].find((d) => d.id === id);
  return named?.name ?? 'Showcase';
}

function arg(argv: string[], key: string): string | undefined {
  const i = argv.indexOf(key);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(): void {
  const argv = process.argv.slice(2);
  const a = arg(argv, '--a');
  const b = arg(argv, '--b');
  const name = arg(argv, '--name');
  if (!a || !b || !name || !/^[a-z0-9-]+$/.test(name)) {
    console.error('Usage: showcase-match.ts --a <side> --b <side> --name <kebab-name> [--format warchest|darlings|classic] [--seeds 40 | --seed N] [--base-seed 1] [--deck-name "..."]');
    process.exitCode = 1;
    return;
  }
  const format = (arg(argv, '--format') ?? 'warchest') as HarnessFormat;
  const fixed = arg(argv, '--seed');
  const baseSeed = Number(arg(argv, '--base-seed') ?? 1);
  const seeds = fixed !== undefined ? [Number(fixed)] : Array.from({ length: Number(arg(argv, '--seeds') ?? 40) }, (_, i) => baseSeed + i);
  let best: { log: ReplayLog; score: ShowcaseScore } | null = null;
  for (const seed of seeds) {
    const run = playShowcase({ a, b, format, seed });
    const s = run.score;
    console.log(`seed ${seed}: winner ${s.winner}, ${s.turns} turns, score ${s.score} (life ${s.finalLife}, low ${s.lowestLife}, rare casts ${s.bigCasts}, darling casts ${s.darlingCasts}, deaths ${s.deaths})`);
    if (!best || s.score > best.score.score) best = run;
  }
  if (!best) return;
  // The viewer replays through the same path; prove the log is clean first.
  checkShowcase(best.log);
  const dir = resolve('showcase');
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, `${name}.json`);
  writeFileSync(out, JSON.stringify({ ...best.log, showcase: { deckName: arg(argv, '--deck-name') ?? showcaseDeckName(a) } }));
  console.log(`\nBest: seed ${best.score.seed} (score ${best.score.score}, ${best.score.turns} turns, ${best.log.actions.length} actions) -> ${out}`);
  console.log(`Play it: npm run dev, then open http://localhost:5173/?showcase=${name}`);
}

main();
