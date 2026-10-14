import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STORY_ACTS } from '../../src/data/story/act1';
import { storyAvatarById } from '../../src/data/story/opponents';
import { storyMapNodes } from '../../src/meta/story/storyMap';
import { runMap } from '../../src/meta/story/storyState';
import { bossPortraitArtId, reachableNodeIds, stopFace, trailDots } from '../../src/ui/storyMapStops';
import { storyArtUrl } from '../../src/ui/storyDialogue';

describe('Story map stops', () => {
  it('finds every act boss a dialogue portrait that ships, in full and half size', () => {
    for (const act of STORY_ACTS) {
      const id = bossPortraitArtId(storyAvatarById(act.bossAvatarId).name);
      expect(id, `act ${act.act} boss`).not.toBeNull();
      for (const tier of ['full', 'lite'] as const) expect(existsSync(`public/${storyArtUrl(id!, tier)}`), `${id} ${tier}`).toBe(true);
    }
  });

  it('greys exactly the stops the run can no longer reach, and every stop at the start reaches the boss', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const nodes = storyMapNodes(runMap({ seed, act: 1 }));
      const boss = nodes.find((n) => n.kind === 'boss')!;
      expect(reachableNodeIds(nodes, null).size).toBe(nodes.length);
      const first = nodes.find((n) => n.floor === 1)!;
      const ahead = reachableNodeIds(nodes, first.id);
      expect(ahead.has(boss.id)).toBe(true);
      expect(ahead.has(first.id)).toBe(false);
      // Nothing on the first floor is ahead of a first-floor stop.
      for (const n of nodes.filter((m) => m.floor === 1)) expect(stopFace(n.id, new Set([first.id]), ahead)).toBe(n.id === first.id ? 'pressed' : 'locked');
      for (const id of first.nextNodeIds) expect(stopFace(id, new Set([first.id]), ahead)).toBe('live');
    }
  });

  it('keeps a trail clear of both medallions', () => {
    const dots = trailDots({ x: 0, y: 0 }, 28, { x: 100, y: 0 }, 40, 9, 5);
    expect(dots[0].x).toBeCloseTo(33);
    expect(dots[dots.length - 1].x).toBeCloseTo(55);
    expect(trailDots({ x: 0, y: 0 }, 28, { x: 60, y: 0 }, 40, 9)).toEqual([]);
  });
});
