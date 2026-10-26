/**
 * Brain ladder: Duel any Deck's three AI levels (Hard, Expert, Master) head
 * to head. Each level must beat the one below it, both seats, over the same
 * seeds, at 55% or better (the ship margin set before measuring, 2026-10-16).
 *
 * The field is the five starter Standard decks (the balance matrix's
 * reserve-native builds). Every game puts the two brains on one deck pair and
 * the next game swaps the decks, so a stronger deck never stands in for a
 * stronger brain; seats alternate too. Pure engine + ai + data; no Phaser.
 *
 * USAGE: npx tsx scripts/brain-ladder.ts --a expert --b hard --seeds 200
 *   --a / --b      the brains (hard | expert | master); A's win rate is reported
 *   --seeds <n>    games per deck pair (even; default 40)
 *   --pairs <n>    only the first n deck pairs of the 15 (for quick reads)
 *   --shard i/n    play only pairs with index % n === i (for parallel runs)
 *   --seed-base <n> first game seed (default 900000; change it to confirm a pick on fresh games)
 *   --json <path>  also write the totals as JSON
 *   --b-opts <json> the same for B
 *   --a-opts <json> try search options for A instead of its level ("ownDeck": true gives it its list)
 */

import { writeFileSync } from 'node:fs';
import type { AIPlayer } from '../src/ai/AIPlayer';
import { HardAI, type HardSearchOptions } from '../src/ai/HardAI';
import { buildLadderAI, type LadderLevel } from '../src/ai/ladder';
import { DEFAULT_PERSONALITY } from '../src/ai/personality';
import { CARD_DB } from '../src/data/catalog';
import { Game } from '../src/engine/Game';
import { WARCHEST_HAND_SIZE } from '../src/meta/warchest';
import { buildReserveMatrixFleets, type ReserveMatrixDeck } from './reserveMatrixDecks';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const LEVELS: readonly LadderLevel[] = ['hard', 'expert', 'master'];
const level = (raw: string | undefined, fallback: LadderLevel): LadderLevel => {
  const value = (raw ?? fallback) as LadderLevel;
  if (!LEVELS.includes(value)) throw new Error(`unknown brain ${raw}`);
  return value;
};
const brainA = level(flag('a'), 'expert');
const brainB = level(flag('b'), 'hard');
const seeds = Number(flag('seeds') ?? 40);
const aOptsRaw = flag('a-opts');
const aOpts = aOptsRaw ? JSON.parse(aOptsRaw) as Omit<HardSearchOptions, 'ownDeck'> & { ownDeck?: boolean } : null;
const bOptsRaw = flag('b-opts');
const bOpts = bOptsRaw ? JSON.parse(bOptsRaw) as Omit<HardSearchOptions, 'ownDeck'> & { ownDeck?: boolean } : null;
const [shardIndex, shardCount] = (flag('shard') ?? '0/1').split('/').map(Number);

/** A brain that times its own decisions, for the think-time read. */
class Timed implements AIPlayer {
  constructor(private readonly inner: AIPlayer, private readonly clock: { ms: number; calls: number; max: number }) {}
  chooseAction(...a: Parameters<AIPlayer['chooseAction']>): ReturnType<AIPlayer['chooseAction']> {
    const t = performance.now();
    const out = this.inner.chooseAction(...a);
    const dt = performance.now() - t;
    this.clock.ms += dt;
    this.clock.calls++;
    this.clock.max = Math.max(this.clock.max, dt);
    return out;
  }
}

function play(seed: number, seats: [ReserveMatrixDeck, ReserveMatrixDeck], ais: [AIPlayer, AIPlayer]): 0 | 1 | 'draw' {
  const game = new Game({
    decks: [seats[0].cards, seats[1].cards],
    landReserves: [seats[0].landReserve, seats[1].landReserve],
    seed,
    db: CARD_DB,
    format: 'warchest',
    startingHandSize: WARCHEST_HAND_SIZE,
  });
  for (let i = 0; i < 80_000; i++) {
    const a = game.awaiting;
    if (a.kind === 'gameOver') return game.instanceState.winner!;
    const action = ais[a.player].chooseAction(game.viewFor(a.player), game.legalActions(a.player));
    game.submit(a.player, action);
  }
  throw new Error(`ladder game ${seed} did not terminate`);
}

const decks = buildReserveMatrixFleets().warchest;
const pairs: [number, number][] = [];
for (let i = 0; i < decks.length; i++) for (let j = i; j < decks.length; j++) pairs.push([i, j]);
const chosen = pairs.slice(0, Number(flag('pairs') ?? pairs.length))
  .map((pair, index) => ({ pair, index }))
  .filter(({ index }) => index % shardCount === shardIndex);

const clocks = { a: { ms: 0, calls: 0, max: 0 }, b: { ms: 0, calls: 0, max: 0 } };
let aWins = 0;
let bWins = 0;
let draws = 0;
const started = Date.now();
for (const { pair: [i, j], index } of chosen) {
  let cellA = 0;
  let cellB = 0;
  for (let g = 0; g < seeds; g++) {
    const seed = Number(flag('seed-base') ?? 900_000) + index * 10_000 + g;
    // Game g: A on deck i when g % 4 < 2; A in seat 0 on even games.
    const aDeck = decks[g % 4 < 2 ? i : j];
    const bDeck = decks[g % 4 < 2 ? j : i];
    const aSeat = g % 2 === 0 ? 0 : 1;
    const a = new Timed(aOpts
      ? new HardAI(CARD_DB, DEFAULT_PERSONALITY, { ...aOpts, ownDeck: aOpts.ownDeck ? aDeck.cards : undefined })
      : buildLadderAI(brainA, CARD_DB, aDeck.cards), clocks.a);
    const b = new Timed(bOpts
      ? new HardAI(CARD_DB, DEFAULT_PERSONALITY, { ...bOpts, ownDeck: bOpts.ownDeck ? bDeck.cards : undefined })
      : buildLadderAI(brainB, CARD_DB, bDeck.cards), clocks.b);
    const seats = (aSeat === 0 ? [aDeck, bDeck] : [bDeck, aDeck]) as [ReserveMatrixDeck, ReserveMatrixDeck];
    const ais = (aSeat === 0 ? [a, b] : [b, a]) as [AIPlayer, AIPlayer];
    const winner = play(seed, seats, ais);
    if (winner === 'draw') draws++;
    else if (winner === aSeat) { aWins++; cellA++; }
    else { bWins++; cellB++; }
  }
  console.log(`${decks[i].name} / ${decks[j].name}: ${brainA} ${cellA}-${cellB} ${brainB}`);
}
const decided = aWins + bWins;
const rate = decided ? aWins / decided : 0;
const half = decided ? 1.96 * Math.sqrt(rate * (1 - rate) / decided) : 0;
const think = (c: { ms: number; calls: number; max: number }): string =>
  `${(c.ms / Math.max(1, c.calls)).toFixed(1)} ms mean, ${c.max.toFixed(0)} ms max over ${c.calls} decisions`;
console.log(`\n${brainA} vs ${brainB}: ${aWins}-${bWins} (${draws} draws), ${(rate * 100).toFixed(1)}% ± ${(half * 100).toFixed(1)}`);
console.log(`${brainA} think: ${think(clocks.a)}`);
console.log(`${brainB} think: ${think(clocks.b)}`);
console.log(`wall: ${((Date.now() - started) / 1000).toFixed(0)} s`);
const out = flag('json');
if (out) writeFileSync(out, JSON.stringify({ brainA, brainB, seeds, shard: `${shardIndex}/${shardCount}`, aWins, bWins, draws, rate, clocks }, null, 2));
