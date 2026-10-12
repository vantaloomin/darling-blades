import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { ACT1 } from '../../src/data/story/act1';
import { runHeadlessAct1 } from '../../src/meta/story/headlessRun';
import { generateStoryMap } from '../../src/meta/story/storyMap';
import { isReplayLog, replayGame, type ReplayLog } from '../../src/meta/Replay';

const NOW = 1_700_000_000_000;
/** Measured 2026-10-12 (30-card starter): seed 9 clears Act 1 with the fixed choice rules, so the keep path runs too. */
const SEED = 9;

describe('headless Story Mode Act 1 run (Guan Yu)', () => {
  it('gives an identical summary for the same seed, and a different run for another seed', () => {
    const first = runHeadlessAct1({ seed: SEED, now: NOW });
    const second = runHeadlessAct1({ seed: SEED, now: NOW });
    expect(second).toEqual(first);
    expect(runHeadlessAct1({ seed: SEED + 1, now: NOW }).nodes).not.toEqual(first.nodes);
  });

  it('walks a legal path through the seed\'s own map and keeps its books straight', () => {
    for (const seed of [SEED, 11, 12]) {
      const summary = runHeadlessAct1({ seed, now: NOW });
      const map = generateStoryMap(ACT1, summary.seed);
      summary.nodes.forEach((visited, i) => {
        const node = map.floors[i].find((n) => n.id === visited.nodeId);
        expect(node, `seed ${seed} step ${i}`).toBeDefined();
        if (i > 0) expect(map.floors[i - 1].find((n) => n.id === summary.nodes[i - 1].nodeId)!.nextNodeIds).toContain(visited.nodeId);
        expect(visited.avatarId).toBe(node!.avatarId);
      });
      expect(summary.fightsPlayed).toBe(summary.duelResults.length);
      expect(summary.counted).toBe(summary.fightsPlayed >= 3);
      const lost = summary.duelResults.includes('loss');
      expect(summary.cleared).toBe(!lost);
      if (lost) expect(summary.duelResults.indexOf('loss')).toBe(summary.duelResults.length - 1);
      if (summary.cleared) {
        expect(summary.nodes.at(-1)).toMatchObject({ kind: 'boss', avatarId: 'simayi', result: 'win' });
        expect(summary.unlocked).toEqual(['persephone']);
        expect(summary.finalDeck).toContain(summary.keptCardId);
      } else {
        expect(summary.keptCardId).toBeNull();
      }
    }
  });

  it('records each duel as a story replay that replays to the same result', () => {
    const logs: ReplayLog[] = [];
    const summary = runHeadlessAct1({ seed: SEED, now: NOW, onReplay: (log) => logs.push(log) });
    expect(logs).toHaveLength(summary.duelResults.length);
    logs.forEach((log, i) => {
      expect(isReplayLog(JSON.parse(JSON.stringify(log)))).toBe(true);
      expect(log.context.mode).toBe('story');
      expect(log.context.story).toMatchObject({ runId: summary.runId, characterId: 'guan-yu', act: 1 });
      expect(log.context.story?.nodeId).toBe(summary.nodes.filter((n) => n.result)[i].nodeId);
      expect(log.result).toBe(summary.duelResults[i]);
      const { game } = replayGame(log, CARD_DB);
      expect(game.instanceState.winner).toBe(log.result === 'win' ? 0 : 1);
    });
  });

  it('keeps story labels to story logs: a story log needs them and no other mode carries them', () => {
    const logs: ReplayLog[] = [];
    runHeadlessAct1({ seed: SEED, now: NOW, onReplay: (log) => logs.push(log) });
    const log = JSON.parse(JSON.stringify(logs[0])) as ReplayLog;
    const { story, ...withoutStory } = log.context;
    expect(isReplayLog({ ...log, context: withoutStory })).toBe(false);
    expect(isReplayLog({ ...log, context: { ...log.context, mode: 'practice' } })).toBe(false);
    expect(isReplayLog({ ...log, context: { ...withoutStory, mode: 'practice' } })).toBe(true);
    expect(isReplayLog({ ...log, context: { ...log.context, story: { ...story, nodeKind: 'shop' } } })).toBe(false);
  });
});
