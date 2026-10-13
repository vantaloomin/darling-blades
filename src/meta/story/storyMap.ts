/**
 * Seeded Story Mode act maps (docs/plan-story-mode.md, wave 1). A map is never
 * saved: it regenerates from the run seed and the act template, so the same
 * seed gives the same map, the way `gauntletSeed.ts` derives each Tower rung.
 * Pure and headless: no Phaser, no `Math.random`, no clock.
 */

import { createRngState, rngInt, rngShuffle, type RngState } from '../../engine/rng';
import type { CardDb } from '../../engine/types';
import { storyAvatarIds } from '../../data/story/opponents';
import { STORY_DUEL_KINDS, type StoryAct, type StoryNodeKind } from '../../data/story/types';
import { clampSeed, rungSeed } from '../gauntletSeed';

export interface StoryNode {
  /** Stable within a map: `a<act>-f<floor>-n<index>`. Saved in an active run. */
  id: string;
  floor: number;
  /** 0-based position on its floor (left to right). */
  index: number;
  kind: StoryNodeKind;
  /** Nodes on the next floor this node leads to (empty only on the boss). */
  nextNodeIds: string[];
  /** The avatar fought here (fight, elite, boss); null otherwise. */
  avatarId: string | null;
  /** This node's own derived seed: its duel seed and its offers derive from it. */
  seed: number;
}

export interface StoryMap {
  act: number;
  templateId: string;
  seed: number;
  /** Floor by floor, left to right. */
  floors: StoryNode[][];
  bossId: string;
}

/** Salts that keep each derived stream apart (any distinct constants work). */
const MAP_SALT = 0x5100;
const NODE_SALT = 0x5200;

/** The seed one act's map derives from a run seed. */
export function actMapSeed(runSeed: number, act: number): number {
  return clampSeed(rungSeed(runSeed, MAP_SALT + act));
}

export function storyNodeId(act: number, floor: number, index: number): string {
  return `a${act}-f${floor}-n${index}`;
}

/** Generate an act's map from a run seed. Same (act, seed) gives the same map. */
export function generateStoryMap(act: StoryAct, runSeed: number): StoryMap {
  const seed = actMapSeed(runSeed, act.act);
  const rng = createRngState(seed);
  const template = act.mapTemplate;
  const lastFloor = template.floors[template.floors.length - 1];

  const floors: StoryNode[][] = template.floors.map((floorTemplate) => {
    const isBossFloor = floorTemplate.kinds.includes('boss');
    const width = isBossFloor
      ? 1
      : template.minWidth + rngInt(rng, template.maxWidth - template.minWidth + 1);
    const kinds = floorKinds(rng, floorTemplate.kinds, width);
    return kinds.map((kind, index) => ({
      id: storyNodeId(act.act, floorTemplate.floor, index),
      floor: floorTemplate.floor,
      index,
      kind,
      nextNodeIds: [],
      avatarId: null,
      seed: clampSeed(rungSeed(seed, NODE_SALT + floorTemplate.floor * 16 + index)),
    }));
  });

  for (let f = 0; f < floors.length - 1; f++) connectFloors(rng, floors[f], floors[f + 1]);

  for (const node of floors.flat()) node.avatarId = avatarFor(act, node);

  return {
    act: act.act,
    templateId: template.id,
    seed,
    floors,
    bossId: storyNodeId(act.act, lastFloor.floor, 0),
  };
}

/**
 * The kinds on one floor. When a floor offers two kinds and has room, both
 * appear, so the player always has a real choice; the rest are drawn freely.
 */
function floorKinds(rng: RngState, options: readonly StoryNodeKind[], width: number): StoryNodeKind[] {
  const kinds: StoryNodeKind[] = [];
  const shuffled = rngShuffle(rng, [...options]);
  for (let i = 0; i < width; i++) {
    kinds.push(i < shuffled.length ? shuffled[i] : options[rngInt(rng, options.length)]);
  }
  return rngShuffle(rng, kinds);
}

/**
 * Edges from one floor to the next. Each node gets the node at its relative
 * position, every next-floor node without a parent takes the nearest one, and
 * a seeded extra edge to a neighbour adds branching. Edges never cross more
 * than one column, so the map reads left to right.
 */
function connectFloors(rng: RngState, from: StoryNode[], to: StoryNode[]): void {
  const link = (a: StoryNode, b: StoryNode): void => {
    if (!a.nextNodeIds.includes(b.id)) a.nextNodeIds.push(b.id);
  };
  const position = (i: number, count: number, targetCount: number): number =>
    count === 1 ? 0 : Math.round((i * (targetCount - 1)) / (count - 1));

  from.forEach((node, i) => link(node, to[position(i, from.length, to.length)]));
  to.forEach((target, j) => {
    if (from.some((node) => node.nextNodeIds.includes(target.id))) return;
    link(from[position(j, to.length, from.length)], target);
  });
  from.forEach((node, i) => {
    if (to.length < 2 || rngInt(rng, 2) === 0) return;
    const base = position(i, from.length, to.length);
    const step = rngInt(rng, 2) === 0 ? -1 : 1;
    const neighbour = base + step >= 0 && base + step < to.length ? base + step : base - step;
    if (neighbour >= 0 && neighbour < to.length) link(node, to[neighbour]);
  });
  for (const node of from) node.nextNodeIds.sort();
}

function avatarFor(act: StoryAct, node: StoryNode): string | null {
  if (node.kind === 'boss') return act.bossAvatarId;
  const pool = node.kind === 'fight' ? act.fightAvatarIds : node.kind === 'elite' ? act.eliteAvatarIds : null;
  if (!pool || pool.length === 0) return null;
  return pool[rngInt(createRngState(node.seed), pool.length)];
}

export function storyMapNodes(map: StoryMap): StoryNode[] {
  return map.floors.flat();
}

export function storyNodeById(map: StoryMap, id: string): StoryNode | undefined {
  for (const floor of map.floors) {
    const node = floor.find((n) => n.id === id);
    if (node) return node;
  }
  return undefined;
}

export function isDuelNode(node: Pick<StoryNode, 'kind'>): boolean {
  return STORY_DUEL_KINDS.includes(node.kind);
}

/**
 * Every property a playable map needs. Returns human-readable problems; an
 * empty list means the map is valid. Checks: the floor table matches the
 * template, widths, unique ids, edges only to the next floor, every node
 * reachable from floor 1, every node leads on (every path ends at the boss),
 * and every avatar id exists.
 */
export function validateStoryMap(map: StoryMap, act: StoryAct): string[] {
  const problems: string[] = [];
  const template = act.mapTemplate;
  const avatarIds = new Set(storyAvatarIds());
  if (map.floors.length !== template.floors.length) {
    problems.push(`map has ${map.floors.length} floors, template ${template.floors.length}`);
    return problems;
  }
  const ids = new Set<string>();
  const floorOf = new Map<string, number>();
  map.floors.forEach((floor, f) => {
    const floorTemplate = template.floors[f];
    const isBossFloor = floorTemplate.kinds.includes('boss');
    if (isBossFloor ? floor.length !== 1 : floor.length < template.minWidth || floor.length > template.maxWidth) {
      problems.push(`floor ${floorTemplate.floor} has ${floor.length} nodes`);
    }
    for (const node of floor) {
      if (ids.has(node.id)) problems.push(`duplicate node id ${node.id}`);
      ids.add(node.id);
      floorOf.set(node.id, f);
      if (node.floor !== floorTemplate.floor) problems.push(`${node.id} is stamped floor ${node.floor}`);
      if (!floorTemplate.kinds.includes(node.kind)) problems.push(`${node.id} is a ${node.kind}, not allowed on floor ${node.floor}`);
      if (isDuelNode(node)) {
        if (!node.avatarId || !avatarIds.has(node.avatarId)) problems.push(`${node.id} has unknown avatar ${String(node.avatarId)}`);
      } else if (node.avatarId !== null) {
        problems.push(`${node.id} is a ${node.kind} with an avatar`);
      }
    }
  });
  for (const [f, floor] of map.floors.entries()) {
    for (const node of floor) {
      const last = f === map.floors.length - 1;
      if (last && node.nextNodeIds.length > 0) problems.push(`${node.id} (boss floor) leads on`);
      if (!last && node.nextNodeIds.length === 0) problems.push(`${node.id} is a dead end`);
      for (const next of node.nextNodeIds) {
        if (!ids.has(next)) problems.push(`${node.id} links to missing node ${next}`);
        else if (floorOf.get(next) !== f + 1) problems.push(`${node.id} skips to ${next}`);
      }
    }
  }
  const reachable = new Set(map.floors[0].map((node) => node.id));
  for (const floor of map.floors) {
    for (const node of floor) {
      if (!reachable.has(node.id)) problems.push(`${node.id} is unreachable from floor 1`);
      else for (const next of node.nextNodeIds) reachable.add(next);
    }
  }
  const boss = map.floors[map.floors.length - 1][0];
  if (!boss || boss.id !== map.bossId || boss.kind !== 'boss') problems.push('the last floor is not the boss');
  return problems;
}

/** Card ids a story list may hold: real, non-land, non-token cards. */
export function isStoryDeckCard(db: CardDb, id: string): boolean {
  const card = db[id];
  return !!card && !card.token && !card.types.includes('land');
}
