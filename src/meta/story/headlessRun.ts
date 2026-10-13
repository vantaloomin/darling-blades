/**
 * One headless Story Mode run (docs/plan-story-mode.md, wave 1): a full Act 1
 * on a seed, every duel an ordinary `Game` between two existing AI brains, and
 * every choice made by a fixed rule so the same seed gives the same summary.
 * It drives StoryProgress exactly as the run shell will, so it doubles as the
 * fixture the wave 3 story matrix grows from. Headless: no Phaser, no clock,
 * no `Math.random` (the caller passes `now`).
 *
 * Choice rules: the first offered boon (trim-two removes the deck's last two
 * cards); the legal next node with the smallest id; the first card of each
 * reward; an event's first available choice, its first offered card and its
 * fewest removals (storyEvents' resolveStoryEventByRule); a shop's first
 * affordable card; a rest removes nothing; the keep takes the first keep option.
 */

import { MediumAI } from '../../ai/MediumAI';
import { buildAI } from '../../ai/personality';
import { CARD_DB } from '../../data/catalog';
import { avatarById } from '../../data/opponents';
import { GUAN_YU_ID } from '../../data/story/characters';
import type { StoryBoonId } from '../../data/story/types';
import { Game } from '../../engine/Game';
import type { CardDb } from '../../engine/types';
import {
  finishReplay,
  recordReplayAction,
  replayDbStamp,
  startReplayDraft,
  type ReplayLog,
} from '../Replay';
import { freshSave, type SaveData } from '../SaveManager';
import {
  abandonRun,
  chooseBoon,
  claimKeep,
  enterNode,
  isAct1Cleared,
  keepOptions,
  legalNextNodes,
  recordFight,
  resolveRest,
  resolveShop,
  shopStock,
  startRun,
  storyBoonOffers,
  storyDuelSetup,
  takeCardReward,
} from './StoryProgress';
import { resolveStoryEventByRule, storyEventFor } from './storyEvents';

export interface HeadlessNodeSummary {
  nodeId: string;
  floor: number;
  kind: string;
  avatarId: string | null;
  /** Duel nodes: the story player's result and the game's last turn number. */
  result?: 'win' | 'loss';
  turns?: number;
  /** Non-duel nodes: what the rule chose. */
  choice?: string;
}

export interface HeadlessRunSummary {
  runId: string;
  seed: number;
  characterId: string;
  boonOffers: StoryBoonId[];
  boonId: StoryBoonId;
  nodes: HeadlessNodeSummary[];
  duelResults: ('win' | 'loss')[];
  fightsPlayed: number;
  counted: boolean;
  cleared: boolean;
  keptCardId: string | null;
  finalDeck: string[];
  finalGold: number;
  unlocked: string[];
}

export interface HeadlessRunOptions {
  seed: number;
  /** The run's start time (only its id uses it). */
  now: number;
  characterId?: string;
  db?: CardDb;
  /** Start from this save (it is mutated); a fresh one when absent. */
  save?: SaveData;
  /** Collect each duel's replay log (mode 'story'). */
  onReplay?: (log: ReplayLog) => void;
  /** Safety valve per duel. */
  maxActions?: number;
}

function playStoryDuel(
  game: Game,
  db: CardDb,
  avatarId: string,
  seed: number,
  maxActions: number,
  onAction?: (p: 0 | 1, action: Parameters<Game['submit']>[1]) => void,
): 0 | 1 {
  const avatar = avatarById(avatarId);
  const ais = [new MediumAI(db), buildAI(avatar.difficulty, db, seed, avatar.personality)];
  for (let i = 0; i < maxActions; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      const winner = game.instanceState.winner;
      if (winner !== 0 && winner !== 1) throw new Error(`story duel (seed ${seed}) ended without a winner`);
      return winner;
    }
    const view = game.viewFor(awaiting.player);
    const legal = game.legalActions(awaiting.player);
    const action = ais[awaiting.player].chooseAction(view, legal);
    game.submit(awaiting.player, action);
    onAction?.(awaiting.player, action);
  }
  throw new Error(`story duel (seed ${seed}) did not finish in ${maxActions} actions`);
}

/** Play one whole Act 1 run headlessly and summarize it. */
export function runHeadlessAct1(options: HeadlessRunOptions): HeadlessRunSummary {
  const db = options.db ?? CARD_DB;
  const save = options.save ?? freshSave(options.now);
  const story = save.story;
  const characterId = options.characterId ?? GUAN_YU_ID;
  const maxActions = options.maxActions ?? 40_000;
  const unlocked: string[] = [];

  const started = startRun(story, characterId, options.seed, options.now);
  if (!started.ok) throw new Error(`startRun: ${started.reason}`);
  const run = started.run;
  const boonOffers = storyBoonOffers(run.seed);
  const boonId = boonOffers[0];
  const boon = chooseBoon(story, db, boonId, boonId === 'trim-two'
    ? { removeCardIds: [run.deck[run.deck.length - 1], run.deck[run.deck.length - 2]] }
    : {});
  if (!boon.ok) throw new Error(`chooseBoon: ${boon.reason}`);

  const nodes: HeadlessNodeSummary[] = [];
  const duelResults: ('win' | 'loss')[] = [];
  let cleared = false;
  let keptCardId: string | null = null;
  let finalRun = run;

  while (story.activeRun) {
    const active = story.activeRun;
    finalRun = active;
    while (active.pendingCardRewards.length > 0) {
      const taken = takeCardReward(story, active.pendingCardRewards[0][0]);
      if (!taken.ok) throw new Error(`takeCardReward: ${taken.reason}`);
    }
    if (isAct1Cleared(active)) {
      const option = keepOptions(active)[0] ?? null;
      if (option) {
        const kept = claimKeep(save, db, option);
        if (!kept.ok) throw new Error(`claimKeep: ${kept.reason}`);
        keptCardId = option;
      }
      cleared = true;
      // Leaving after the clear: the run already counted at its third fight.
      const left = abandonRun(story);
      if (!left.ok) throw new Error(`abandonRun: ${left.reason}`);
      unlocked.push(...left.unlocked);
      break;
    }
    const next = legalNextNodes(story).sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!next) throw new Error(`run ${active.runId} is stuck at ${String(active.nodeId)}`);
    const entered = enterNode(story, next.id);
    if (!entered.ok) throw new Error(`enterNode: ${entered.reason}`);
    const node = entered.node;
    const summary: HeadlessNodeSummary = { nodeId: node.id, floor: node.floor, kind: node.kind, avatarId: node.avatarId };
    nodes.push(summary);

    if (node.kind === 'fight' || node.kind === 'elite' || node.kind === 'boss') {
      const setup = storyDuelSetup(story, db);
      if (!setup.ok) throw new Error(`storyDuelSetup: ${setup.reason}`);
      const { config, avatarId } = setup.setup;
      const game = new Game(config);
      const draft = options.onReplay
        ? startReplayDraft({
            dbStamp: replayDbStamp(db),
            seed: config.seed,
            decks: [config.decks[0] as string[], config.decks[1] as string[]],
            startingHandSize: config.startingHandSize,
            context: {
              mode: 'story',
              difficulty: avatarById(avatarId).difficulty,
              opponentId: avatarId,
              opponentName: avatarById(avatarId).name,
              gauntletRung: null,
              story: {
                runId: active.runId,
                characterId: active.characterId,
                act: active.act,
                nodeId: node.id,
                nodeKind: node.kind,
                endlessLoop: active.endlessLoop,
              },
            },
            format: 'darlings',
            landReserves: [config.landReserves![0] as string[], config.landReserves![1] as string[]],
            darlings: config.darlings,
          })
        : null;
      const winner = playStoryDuel(game, db, avatarId, config.seed, maxActions, draft
        ? (p, action) => recordReplayAction(draft, p, action)
        : undefined);
      const result = winner === 0 ? 'win' : 'loss';
      if (draft && options.onReplay) {
        options.onReplay(finishReplay(draft, result, options.now, game.state.turn));
      }
      summary.result = result;
      summary.turns = game.state.turn;
      duelResults.push(result);
      const recorded = recordFight(story, result);
      if (!recorded.ok) throw new Error(`recordFight: ${recorded.reason}`);
      unlocked.push(...recorded.unlocked);
      continue;
    }

    if (node.kind === 'event') {
      const eventId = storyEventFor(active, node).id;
      const resolved = resolveStoryEventByRule(story, db);
      if (!resolved.ok) throw new Error(`resolveStoryEvent: ${resolved.reason}`);
      summary.choice = `${eventId} choice ${resolved.choiceIndex}`;
    } else if (node.kind === 'shop') {
      const buy = shopStock(active, node, db).find((offer) => offer.price <= active.gold);
      const resolved = resolveShop(story, db, buy ? [buy.cardId] : []);
      if (!resolved.ok) throw new Error(`resolveShop: ${resolved.reason}`);
      summary.choice = buy ? `buy ${buy.cardId}` : 'leave';
    } else {
      const resolved = resolveRest(story, null);
      if (!resolved.ok) throw new Error(`resolveRest: ${resolved.reason}`);
      summary.choice = 'rest';
    }
  }

  return {
    runId: run.runId,
    seed: run.seed,
    characterId,
    boonOffers,
    boonId,
    nodes,
    duelResults,
    fightsPlayed: finalRun.fightsPlayed,
    counted: finalRun.counted,
    cleared,
    keptCardId,
    finalDeck: [...finalRun.deck],
    finalGold: finalRun.gold,
    unlocked,
  };
}
