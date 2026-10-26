import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { ACT1 } from '../../src/data/story/act1';
import { missingStoryArt } from '../../scripts/check-story';
import {
  checkStoryContent,
  SHIPPED_STORY_CONTENT,
  validateStoryContent,
} from '../../src/meta/story/storyContent';
import {
  generateStoryMap,
  isDuelNode,
  storyMapNodes,
  validateStoryMap,
  type StoryMap,
} from '../../src/meta/story/storyMap';

const SEEDS = Array.from({ length: 500 }, (_, i) => 1 + i * 7919);

/** Every root-to-leaf path through a map (small maps: at most 3^8 paths). */
function allPaths(map: StoryMap): string[][] {
  const byId = new Map(storyMapNodes(map).map((node) => [node.id, node]));
  const out: string[][] = [];
  const walk = (id: string, path: string[]): void => {
    const node = byId.get(id)!;
    const next = [...path, id];
    if (node.nextNodeIds.length === 0) out.push(next);
    for (const child of node.nextNodeIds) walk(child, next);
  };
  for (const start of map.floors[0]) walk(start.id, []);
  return out;
}

describe('story content', () => {
  it('passes the content validator (cards, colours, reserves, unlock chain, avatars)', () => {
    expect(validateStoryContent(CARD_DB)).toEqual([]);
  });

  it('passes check-story with art on disk: no errors and no warnings', () => {
    const report = checkStoryContent(CARD_DB, { missingArt: (id) => missingStoryArt(id) });
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('reports broken script data as errors, and a fight as strong as an elite', () => {
    const [first, ...scenes] = SHIPPED_STORY_CONTENT.scenes;
    const event = SHIPPED_STORY_CONTENT.events[0];
    const content = {
      ...SHIPPED_STORY_CONTENT,
      acts: [{ ...SHIPPED_STORY_CONTENT.acts[0], fightAvatarIds: ['menghuo', 'gongsunzan', 'no-such-avatar'] }],
      scenes: [
        // Guan Yu's opening, now with an unknown speaker and an empty line, and no longer hers.
        { ...first, characterId: null, lines: [{ speakerId: 'nobody', expression: 'steady', text: 'Hi.' }, { speakerId: null, text: '  ' }] },
        ...scenes,
        { ...scenes[0], id: scenes[0].id },
      ],
      events: [{ ...event, choices: [{ label: 'Take it.', effects: [{ kind: 'add-random', filter: { source: 'pool', subtype: 'No Such Tribe' } }] }, event.choices[1]] }],
    } as typeof SHIPPED_STORY_CONTENT;
    const report = checkStoryContent(CARD_DB, { content, missingArt: (id) => (id === first.backgroundId ? ['story-half'] : []) });
    const has = (pattern: RegExp): boolean => report.errors.some((error) => pattern.test(error));
    expect(has(/unknown avatar no-such-avatar/)).toBe(true);
    // Gongsun Zan is a Medium elite; as a fight she is as strong as the other elites.
    expect(has(/act act1: every elite must be a stronger avatar than every fight/)).toBe(true);
    expect(has(/act act1: the boss must be a stronger avatar than every elite/)).toBe(false);
    expect(has(/unknown speaker nobody/)).toBe(true);
    expect(has(/line 2: empty text/)).toBe(true);
    expect(has(/guan-yu: has 0 opening scenes/)).toBe(true);
    expect(has(new RegExp(`duplicate scene id ${scenes[0].id}`))).toBe(true);
    expect(has(/scene ev-meng-ford-toll: an event scene with no event/)).toBe(true);
    expect(has(/matches no card in guan-yu's pool/)).toBe(true);
    expect(has(new RegExp(`art ${first.backgroundId}: missing from story-half`))).toBe(true);
  });
});

describe('Act 1 map generation', () => {
  it('generates a valid map on 500 seeds', () => {
    for (const seed of SEEDS) {
      const map = generateStoryMap(ACT1, seed);
      expect(validateStoryMap(map, ACT1), `seed ${seed}`).toEqual([]);
    }
  });

  it('follows the floor table: 2-3 nodes a floor, one boss, kinds only from each floor\'s options', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const map = generateStoryMap(ACT1, seed);
      expect(map.floors).toHaveLength(9);
      map.floors.forEach((floor, f) => {
        const allowed = ACT1.mapTemplate.floors[f].kinds;
        if (f === 8) {
          expect(floor.map((node) => node.kind)).toEqual(['boss']);
          expect(floor[0].avatarId).toBe(ACT1.bossAvatarId);
        } else {
          expect(floor.length).toBeGreaterThanOrEqual(2);
          expect(floor.length).toBeLessThanOrEqual(3);
          // A floor with two options shows both, so the player has a real choice.
          expect(new Set(floor.map((node) => node.kind))).toEqual(new Set(allowed));
        }
      });
    }
  });

  it('ends every path at the boss after nine floors, with between four and six duels', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const map = generateStoryMap(ACT1, seed);
      const byId = new Map(storyMapNodes(map).map((node) => [node.id, node]));
      for (const path of allPaths(map)) {
        expect(path).toHaveLength(9);
        expect(path[path.length - 1]).toBe(map.bossId);
        const duels = path.filter((id) => isDuelNode(byId.get(id)!)).length;
        expect(duels).toBeGreaterThanOrEqual(4);
        expect(duels).toBeLessThanOrEqual(6);
      }
    }
  });

  it('reports a boss who is not a stronger avatar than every elite (owner ruling D2)', () => {
    // The Tower's Sima Yi is a Medium brain, like the elites: as Act 1's boss she would not be the hardest fight.
    const content = { ...SHIPPED_STORY_CONTENT, acts: [{ ...SHIPPED_STORY_CONTENT.acts[0], bossAvatarId: 'simayi' }] };
    const report = checkStoryContent(CARD_DB, { content, missingArt: () => [] });
    expect(report.errors).toContain('act act1: the boss must be a stronger avatar than every elite');
  });

  it('puts elites against stronger avatars than ordinary fights', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      for (const node of storyMapNodes(generateStoryMap(ACT1, seed))) {
        if (node.kind === 'fight') expect(ACT1.fightAvatarIds).toContain(node.avatarId);
        if (node.kind === 'elite') expect(ACT1.eliteAvatarIds).toContain(node.avatarId);
        if (!isDuelNode(node)) expect(node.avatarId).toBeNull();
      }
    }
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateStoryMap(ACT1, 4242)).toEqual(generateStoryMap(ACT1, 4242));
    const shapes = new Set(SEEDS.slice(0, 50).map((seed) => JSON.stringify(
      generateStoryMap(ACT1, seed).floors.map((floor) => floor.map((node) => [node.kind, node.nextNodeIds])),
    )));
    expect(shapes.size).toBeGreaterThan(40);
  });

  it('gives every node its own duel seed', () => {
    const map = generateStoryMap(ACT1, 99);
    const seeds = storyMapNodes(map).map((node) => node.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

describe('validateStoryMap', () => {
  function cloneMap(seed: number): StoryMap {
    return structuredClone(generateStoryMap(ACT1, seed));
  }

  it('reports a node no edge reaches', () => {
    const map = cloneMap(5);
    const orphan = map.floors[3][0].id;
    for (const node of map.floors[2]) node.nextNodeIds = node.nextNodeIds.filter((id) => id !== orphan);
    // Keep the floor-2 nodes leading somewhere so only reachability breaks.
    for (const node of map.floors[2]) if (node.nextNodeIds.length === 0) node.nextNodeIds = [map.floors[3][1].id];
    expect(validateStoryMap(map, ACT1)).toContain(`${orphan} is unreachable from floor 1`);
  });

  it('reports a dead end, an edge that skips a floor, an unknown avatar and a missing boss', () => {
    const map = cloneMap(6);
    map.floors[4][0].nextNodeIds = [];
    map.floors[1][0].nextNodeIds.push(map.floors[5][0].id);
    const duel = storyMapNodes(map).find((node) => node.kind === 'fight')!;
    duel.avatarId = 'nobody';
    map.floors[8][0].kind = 'rest';
    const problems = validateStoryMap(map, ACT1);
    expect(problems).toContain(`${map.floors[4][0].id} is a dead end`);
    expect(problems).toContain(`${map.floors[1][0].id} skips to ${map.floors[5][0].id}`);
    expect(problems).toContain(`${duel.id} has unknown avatar nobody`);
    expect(problems).toContain('the last floor is not the boss');
  });
});
