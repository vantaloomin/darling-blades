import { describe, expect, it } from 'vitest';
import { STORY_CHARACTERS, GUAN_YU_ID, PERSEPHONE_ID } from '../../src/data/story/characters';
import { STORY_ACTS, STORY_BOONS } from '../../src/data/story/act1';
import { storyUnlockProgress } from '../../src/meta/story/storyFlow';
import { freshStoryState, runMap } from '../../src/meta/story/storyState';
import { compactHitProblems, type CompactControl } from '../../src/ui/compactLayout';
import { GAP_FLOORS, inactiveGap, isInsideTitleSafe, isRectContained, SCENE_TITLE, type Rect } from '../../src/ui/layout';
import { menuLineHeight } from '../../src/ui/mainMenuPresentation';
import {
  cardSize,
  storyCaptionBand,
  storyCardGridLayout,
  storyCardRowScale,
  storyChoiceRow,
  storyContentBottom,
  storyContentTop,
  storyFooterRow,
  storyMapLayout,
  storyMapPanelLayout,
  storySelectLayout,
} from '../../src/ui/storyLayout';
import {
  abandonNote,
  colourWords,
  deckEntries,
  NODE_KIND_LABEL,
  nodeActionLabel,
  nodeSummary,
  recordLine,
  shopCartState,
  shortName,
  togglePick,
  unlockLines,
} from '../../src/ui/storyPresentation';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';

const HIT = theme.control.minHitHeight;
const bottom = (r: Rect): number => r.y + r.height;
const right = (r: Rect): number => r.x + r.width;

function expectApart(rects: readonly [string, Rect][], gap: number, where: string): void {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const g = inactiveGap(rects[i][1], rects[j][1]);
      expect(!g.intersects && g.gap >= gap, `${where}: ${rects[i][0]} and ${rects[j][0]} are ${g.gap}px apart`).toBe(true);
    }
  }
}

/** The subtitle's bottom at the size in force, wrapped to `lines` lines (a measured stand-in). */
function subtitleBottom(lines = 2): number {
  return SCENE_TITLE.subtitleTop + lines * menuLineHeight(theme.type.body);
}

/** A footer button's hit rect for a visual width. */
const footerHit = (width: number): number => Math.max(width, theme.control.minHitWidth);

describe('Story screens: layout rules in every accessibility cell', () => {
  it('keeps the three heroine tiles inside the frame, apart, with the measured text below the portrait and above the footer', () => {
    forEachA11yCell((cell) => {
      const top = storyContentTop(subtitleBottom());
      // The tallest block a tile holds: a two-line name, colours, a three-line condition and the progress line.
      const gap = theme.space(2);
      const text = 2 * menuLineHeight(theme.type.h2) + menuLineHeight(theme.type.label) + 3 * menuLineHeight(theme.type.caption)
        + menuLineHeight(theme.type.label) + 3 * gap;
      const l = storySelectLayout(top, text, STORY_CHARACTERS.length);
      const footer = storyFooterRow([footerHit(380)]);
      for (let i = 0; i < l.tiles.length; i++) {
        expect(isInsideTitleSafe(l.tiles[i]), cell.name).toBe(true);
        expect(isRectContained(l.portraits[i], l.tiles[i]), cell.name).toBe(true);
        expect(isRectContained(l.texts[i], l.tiles[i]), cell.name).toBe(true);
        expect(l.texts[i].height, `${cell.name}: text block room`).toBeGreaterThanOrEqual(text);
        expect(l.texts[i].y - bottom(l.portraits[i])).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
        expect(l.portraits[i].height, `${cell.name}: the portrait keeps a readable size`).toBeGreaterThanOrEqual(80);
      }
      expectApart(l.tiles.map((t, i) => [`tile ${i}`, t]), GAP_FLOORS.ordinary, cell.name);
      expectApart([...l.tiles.map((t, i): [string, Rect] => [`tile ${i}`, t]), ['start', footer.rects[0]]], GAP_FLOORS.ordinary, cell.name);
      expect(isInsideTitleSafe(footer.rects[0])).toBe(true);
    });
  });

  it('fits a row of offered cards and their caption band between the content top and the footer, apart', () => {
    forEachA11yCell((cell) => {
      for (const count of [1, 2, 3]) for (const lines of [1, 2]) {
        const top = storyContentTop(subtitleBottom()) + HIT + theme.space(3);
        const band = storyCaptionBand(lines);
        const scale = storyCardRowScale(count, top, band);
        const size = cardSize(scale);
        const items = storyChoiceRow(count, size.width, size.height + band, top);
        for (const item of items) {
          expect(isInsideTitleSafe(item), `${cell.name}, ${count} cards`).toBe(true);
          expect(item.y).toBeGreaterThanOrEqual(top);
          expect(bottom(item)).toBeLessThanOrEqual(storyContentBottom() + 0.001);
          expect(Math.min(size.width, size.height), 'a card is a 44px target').toBeGreaterThanOrEqual(HIT);
        }
        expectApart(items.map((r, i) => [`card ${i}`, r]), GAP_FLOORS.ordinary, `${cell.name}, ${count} cards`);
        const footer = storyFooterRow([footerHit(240), footerHit(240)]);
        expectApart([...items.map((r, i): [string, Rect] => [`card ${i}`, r]), ...footer.rects.map((r, i): [string, Rect] => [`button ${i}`, r])], GAP_FLOORS.ordinary, cell.name);
      }
    });
  });

  it('pages the run deck grid with every card and caption inside its area, apart, above the pager', () => {
    forEachA11yCell((cell) => {
      const screenTop = storyContentTop(subtitleBottom());
      const areas: [string, Rect][] = [
        ['screen', { x: theme.design.safeLeft, y: screenTop, width: theme.design.safeWidth, height: storyContentBottom() - screenTop }],
        ['modal', { x: 120, y: 160, width: 1040, height: 440 }],
      ];
      for (const [name, area] of areas) for (const count of [1, 15, 30, 61]) {
        const l = storyCardGridLayout(area, count);
        expect(l.pageSize, `${cell.name} ${name}: at least one card a page`).toBeGreaterThanOrEqual(1);
        expect(l.pages * l.pageSize).toBeGreaterThanOrEqual(count);
        const onPage = Math.min(count, l.pageSize);
        const rects: [string, Rect][] = [];
        for (let i = 0; i < onPage; i++) {
          const card = l.cell(i);
          const caption = l.caption(i);
          expect(isRectContained(card, area), `${cell.name} ${name} card ${i}`).toBe(true);
          expect(isRectContained(caption, area), `${cell.name} ${name} caption ${i}`).toBe(true);
          expect(caption.height).toBeGreaterThanOrEqual(menuLineHeight(theme.type.caption));
          expect(caption.y).toBeGreaterThanOrEqual(bottom(card));
          rects.push([`card ${i}`, { ...card, height: bottom(caption) - card.y }]);
          expect(l.pagerY - HIT / 2 - bottom(caption), `${cell.name} ${name}: pager band clear`).toBeGreaterThanOrEqual(0);
        }
        expectApart(rects, GAP_FLOORS.ordinary, `${cell.name} ${name} ${count}`);
      }
    });
  });

  it('puts every node of every generated Act 1 map on screen, inside the frame, apart, and clear of the run panel (200 seeds)', () => {
    const act = STORY_ACTS[0];
    const maps = Array.from({ length: 200 }, (_, i) => runMap({ seed: i + 1, act: act.act }));
    forEachA11yCell((cell) => {
      const top = storyContentTop(subtitleBottom(1));
      for (let seed = 1; seed <= 200; seed++) {
        const map = maps[seed - 1];
        const geo = storyMapLayout(map.floors, top);
        expect(isInsideTitleSafe(geo.panel), cell.name).toBe(true);
        const nodes: [string, Rect][] = [];
        const controls: CompactControl[] = [];
        for (const node of map.floors.flat()) {
          const rect = geo.nodes.get(node.id)!;
          expect(rect, `${node.id} placed`).toBeDefined();
          expect(isRectContained(rect, geo.area), `${cell.name} seed ${seed}: ${node.id} inside the map`).toBe(true);
          expect(isInsideTitleSafe(rect)).toBe(true);
          // The caption under a node ("Next", the boss's name) and the "You" over it stay in the map.
          const caption = menuLineHeight(theme.type.caption) + theme.space(1);
          expect(rect.y - caption).toBeGreaterThanOrEqual(geo.area.y);
          expect(bottom(rect) + caption).toBeLessThanOrEqual(bottom(geo.area));
          nodes.push([node.id, rect]);
          controls.push({ visual: rect, hit: rect });
        }
        expectApart(nodes, GAP_FLOORS.ordinary, `${cell.name} seed ${seed}`);
        expect(compactHitProblems(controls, { x: 0, y: 0, width: theme.design.width, height: theme.design.height })).toEqual([]);
        for (const [, rect] of nodes) expect(right(rect) + GAP_FLOORS.ordinary).toBeLessThanOrEqual(geo.panel.x);
        // A node's caption below and the "You" above the node under it never meet.
        for (const floor of map.floors) for (let i = 1; i < floor.length; i++) {
          const above = geo.nodes.get(floor[i - 1].id)!;
          const below = geo.nodes.get(floor[i].id)!;
          expect(below.y - bottom(above), `${cell.name}: room for two captions between rows`).toBeGreaterThanOrEqual(2 * (menuLineHeight(theme.type.caption) + theme.space(1)));
        }
      }
    });
  }, 60_000);

  it('stacks the run panel in reading order with room for its text, every action a 44px target, Abandon a destructive gap from the main action', () => {
    forEachA11yCell((cell) => {
      const top = storyContentTop(subtitleBottom(1));
      const geo = storyMapLayout(runMap({ seed: 1, act: 1 }).floors, top);
      const l = storyMapPanelLayout(geo.panel);
      const button = (y: number): Rect => ({ x: geo.panel.x + l.inset, y: y - HIT / 2, width: l.buttonWidth, height: HIT });
      const stack: [string, Rect][] = [
        ['info', l.info], ['view deck', button(l.viewDeckY)], ['detail', l.detail], ['main action', button(l.primaryY)],
        ['note', l.note], ['abandon', button(l.abandonY)],
      ];
      for (const [name, rect] of stack) {
        expect(isRectContained(rect, geo.panel), `${cell.name}: ${name} inside the panel`).toBe(true);
        expect(isInsideTitleSafe(rect)).toBe(true);
      }
      for (let i = 1; i < stack.length; i++) expect(stack[i][1].y - bottom(stack[i - 1][1]), `${cell.name}: ${stack[i][0]} below ${stack[i - 1][0]}`).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
      expect(button(l.abandonY).y - bottom(button(l.primaryY))).toBeGreaterThanOrEqual(GAP_FLOORS.destructive);
      // The info block: the Darling thumb beside the name and four label lines.
      const infoText = menuLineHeight(theme.type.h2) + 4 * menuLineHeight(theme.type.label) + 4 * theme.space(1);
      expect(l.info.height, cell.name).toBeGreaterThanOrEqual(Math.max(cardSize(0.25).height, infoText));
      expect(l.detail.height).toBeGreaterThanOrEqual(menuLineHeight(theme.type.label) + 2 * menuLineHeight(theme.type.caption));
      expect(l.note.height).toBeGreaterThanOrEqual(2 * menuLineHeight(theme.type.caption));
    });
  });
});

describe('Story screens: copy and view state', () => {
  it('names colours and the short name from the character data', () => {
    const guanYu = STORY_CHARACTERS.find((c) => c.id === GUAN_YU_ID)!;
    expect(colourWords(guanYu.colors)).toBe('White and Red');
    expect(shortName(guanYu)).toBe('Guan Yu');
    expect(colourWords(['G'])).toBe('Green');
  });

  it("shows a locked heroine's progress from her predecessor's counted runs, and nothing for an open one", () => {
    const persephone = STORY_CHARACTERS.find((c) => c.id === PERSEPHONE_ID)!;
    const story = freshStoryState();
    story.countedRuns[GUAN_YU_ID] = 2;
    const locked = unlockLines(storyUnlockProgress(story, persephone));
    expect(locked.progress).toBe('2 of 3 runs');
    expect(locked.condition).toContain('Guan Yu');
    story.unlockedCharacterIds.push(PERSEPHONE_ID);
    expect(unlockLines(storyUnlockProgress(story, persephone))).toEqual({ condition: '', progress: '' });
  });

  it("says whether an abandon still counts, by the run's fights (R9)", () => {
    expect(abandonNote({ fightsPlayed: 2 }, true)).toContain('2 of 3');
    expect(abandonNote({ fightsPlayed: 2 }, true)).not.toBe(abandonNote({ fightsPlayed: 3 }, true));
    expect(abandonNote({ fightsPlayed: 3 }, true)).toBe(abandonNote({ fightsPlayed: 7 }, true));
  });

  it('lets the shop cart add only what the gold left covers, and always lets a carted card back out', () => {
    const stock = [{ cardId: 'a', price: 50 }, { cardId: 'b', price: 30 }, { cardId: 'c', price: 80 }];
    const empty = shopCartState(70, stock, []);
    expect([...empty.addable].sort()).toEqual(['a', 'b']);
    const one = shopCartState(70, stock, ['a']);
    expect(one.spent).toBe(50);
    expect(one.left).toBe(20);
    expect([...one.addable].sort()).toEqual(['a']);
  });

  it('cycles a deck pick through the copies the deck holds, and a new card on a full pick drops the oldest', () => {
    const deck = ['x', 'x', 'y'];
    let picked = togglePick([], 'x', 2, deck);
    expect(picked).toEqual(['x']);
    picked = togglePick(picked, 'x', 2, deck);
    expect(picked).toEqual(['x', 'x']);
    picked = togglePick(picked, 'x', 2, deck);
    expect(picked).toEqual([]);
    expect(togglePick(['y'], 'y', 2, deck)).toEqual([]); // one copy: a second tap clears it
    expect(togglePick(['x', 'y'], 'z', 2, [...deck, 'z'])).toEqual(['y', 'z']);
    expect(togglePick(['x'], 'y', 1, deck)).toEqual(['y']);
  });

  it('folds a run deck into one entry per card with its copies, keeping every card', () => {
    const deck = ['a', 'b', 'a', 'c', 'a'];
    const entries = deckEntries(deck);
    expect(entries.find((e) => e.id === 'a')?.count).toBe(3);
    expect(entries.reduce((sum, e) => sum + e.count, 0)).toBe(deck.length);
  });

  it('writes no em-dash in any player copy the screens show', () => {
    const kinds = Object.keys(NODE_KIND_LABEL) as (keyof typeof NODE_KIND_LABEL)[];
    const story = freshStoryState();
    const copy = [
      recordLine(1, 2),
      ...kinds.flatMap((k) => [NODE_KIND_LABEL[k], nodeSummary(k), nodeActionLabel(k)]),
      ...[0, 2, 3].flatMap((n) => [abandonNote({ fightsPlayed: n }, true), abandonNote({ fightsPlayed: n }, false)]),
      ...STORY_CHARACTERS.flatMap((c) => Object.values(unlockLines(storyUnlockProgress(story, c)))),
      ...STORY_BOONS.flatMap((b) => [b.name, b.text]),
    ];
    for (const line of copy) expect(line, line).not.toMatch(/[—–]/);
  });
});
