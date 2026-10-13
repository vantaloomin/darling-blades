import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STORY_CHARACTERS } from '../../src/data/story/characters';
import { STORY_EVENTS, STORY_SCENES, STORY_SPEAKERS } from '../../src/data/story/script';
import type { StoryLine } from '../../src/data/story/types';
import { storySceneById } from '../../src/meta/story/storyEvents';
import { GAP_FLOORS, inactiveGap, isInsideTitleSafe, isRectContained, type Rect } from '../../src/ui/layout';
import { menuLineHeight } from '../../src/ui/mainMenuPresentation';
import {
  backlogEntries,
  backlogPages,
  eventResultPortrait,
  eventSpeaker,
  heroineSpeakerId,
  nextEventStep,
  nextLineIndex,
  portraitArtId,
  removeConfirmLabel,
  removeStepCopy,
  storyArtUrl,
  storyChoicePanelLayout,
  storyChoiceTextWidth,
  storyDialogueLayout,
  storyDialogueLineHeight,
  storyDialogueNameSize,
  storyDialogueTextSize,
  storyDialogueTextWidth,
  storyDialogueTitleMaxWidth,
  storyDialogueTitleSize,
  storyEventArtIds,
  storyLineView,
  storySceneArtIds,
  type HitSize,
} from '../../src/ui/storyDialogue';
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

/**
 * A headless stand-in for measured text: wrapped at a generous 0.6 em per
 * character (wider than the UI face's average), each line a line box plus the
 * leading. Real glyph metrics are the rendered probe's job.
 */
function wrappedHeight(text: string, size: number, width: number, lineHeight: number): number {
  const perLine = Math.max(1, Math.floor(width / (size * 0.6)));
  const lines = text.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil(part.length / perLine)), 0);
  return lines * lineHeight;
}

/** A themed button's hit for a label (minimum width as the player asks, 44 px tall). */
function buttonHit(label: string, minWidth: number): HitSize {
  return { width: Math.max(minWidth, theme.control.minHitWidth, Math.ceil(label.length * theme.type.label * 0.6) + theme.space(8)), height: HIT };
}

const ALL_LINES: readonly StoryLine[] = STORY_SCENES.flatMap((s) => s.lines);
const LONGEST_LINE = ALL_LINES.reduce((a, b) => (b.text.length > a.text.length ? b : a));
const BACK_HIT: Rect = { x: theme.design.safeLeft, y: theme.design.safeTop, width: 120, height: HIT };

describe('Story dialogue: who shows on a line', () => {
  it('maps each heroine to her script speaker, and only her', () => {
    const ids = STORY_CHARACTERS.map((c) => heroineSpeakerId(c));
    expect(ids).toEqual(['guanyu', 'persephone', 'yutu']);
    expect(heroineSpeakerId(null)).toBeNull();
    expect(heroineSpeakerId({ name: 'Sima Yi, the Patient Serpent' })).toBe('simayi');
    expect(heroineSpeakerId({ name: 'Nobody in the script' })).toBeNull();
  });

  it('shows narration with no name and no portrait, and a speaker with her name, expression and side', () => {
    const scene = storySceneById('boss-intro-guanyu')!;
    const views = scene.lines.map((line) => storyLineView(line, 'guanyu'));
    expect(views[0]).toEqual({ name: null, text: scene.lines[0].text, portrait: null });
    expect(views[1].name).toBe('Sima Yi');
    expect(views[1].portrait).toEqual({ speakerId: 'simayi', expression: 'composed', side: 'right' });
    expect(views[2].name).toBe('Guan Yu');
    expect(views[2].portrait).toEqual({ speakerId: 'guanyu', expression: 'fierce', side: 'left' });
    // On someone else's run, Guan Yu is not the heroine and stands on the right.
    expect(storyLineView(scene.lines[2], 'yutu').portrait?.side).toBe('right');
  });

  it('names an art file that exists, full size and half, for every background and portrait the script and events draw', () => {
    const ids = new Set<string>();
    for (const scene of STORY_SCENES) for (const id of storySceneArtIds(scene)) ids.add(id);
    for (const event of STORY_EVENTS) for (const id of storyEventArtIds(event, storySceneById(event.id)!)) ids.add(id);
    // Every speaker's both expressions are reachable (the reacting speakers' second ones through the events).
    for (const speaker of STORY_SPEAKERS.filter((s) => ALL_LINES.some((l) => l.speakerId === s.id))) {
      expect(ids.has(portraitArtId(speaker.id, speaker.expressions[0])), speaker.id).toBe(true);
    }
    for (const id of ids) {
      for (const tier of ['full', 'lite'] as const) {
        const url = storyArtUrl(id, tier);
        expect(existsSync(new URL(`../../public/${url}`, import.meta.url)), url).toBe(true);
      }
    }
    expect(storyArtUrl('bg-crater', 'full')).toBe('assets/art/story/bg-crater.webp');
    expect(storyArtUrl('bg-crater', 'lite')).toBe('assets/art/story-half/bg-crater.webp');
  });

  it('keeps an event speaker beside the choices and switches the reacting speaker to her second expression after her choice only', () => {
    const meng = STORY_EVENTS.find((e) => e.id === 'ev-meng-ford-toll')!;
    const mengScene = storySceneById(meng.id)!;
    expect(eventSpeaker(mengScene, 'guanyu')).toEqual({ speakerId: 'officer', expression: 'smug', side: 'right' });
    expect(eventResultPortrait(meng, mengScene, 0, 'guanyu')?.expression).toBe('smug');
    expect(eventResultPortrait(meng, mengScene, 1, 'guanyu')?.expression).toBe('flustered');

    const stars = STORY_EVENTS.find((e) => e.id === 'ev-reader-of-stars')!;
    expect(eventResultPortrait(stars, storySceneById(stars.id)!, 0, null)).toEqual({ speakerId: 'guan-lu', expression: 'amused', side: 'right' });
    expect(eventResultPortrait(stars, storySceneById(stars.id)!, 1, null)?.expression).toBe('knowing');

    // A narrated event with no reacting speaker shows the still alone.
    const cats = STORY_EVENTS.find((e) => e.id === 'ev-cats-in-the-dark')!;
    expect(eventSpeaker(storySceneById(cats.id)!, null)).toBeNull();
    expect(eventResultPortrait(cats, storySceneById(cats.id)!, 0, null)).toBeNull();

    // Every reacting speaker's second expression is in the event's art.
    for (const event of STORY_EVENTS.filter((e) => e.reactingSpeakerId !== null)) {
      const speaker = STORY_SPEAKERS.find((s) => s.id === event.reactingSpeakerId)!;
      expect(storyEventArtIds(event, storySceneById(event.id)!), event.id).toContain(portraitArtId(speaker.id, speaker.expressions[1]));
    }
  });
});

describe('Story dialogue: reading through a scene', () => {
  it('advances one line per Continue and ends past the last', () => {
    expect(nextLineIndex(0, 3)).toBe(1);
    expect(nextLineIndex(1, 3)).toBe(2);
    expect(nextLineIndex(2, 3)).toBe('done');
    expect(nextLineIndex(0, 1)).toBe('done');
  });

  it('backlogs the lines read so far, in order, never a line not yet shown', () => {
    const lines = storySceneById('open-persephone')!.lines;
    expect(backlogEntries(lines, 0, 'persephone').map((e) => e.text)).toEqual([lines[0].text]);
    const upTo3 = backlogEntries(lines, 3, 'persephone');
    expect(upTo3.map((e) => e.text)).toEqual(lines.slice(0, 4).map((l) => l.text));
    expect(upTo3.map((e) => e.name)).toEqual([null, null, 'Persephone', 'Persephone']);
    expect(backlogEntries(lines, 99, null)).toHaveLength(lines.length);
  });

  it('pages the backlog with every entry once, whole and in order, each page inside the viewport', () => {
    const cases: [number[], number][] = [
      [[40, 60, 80, 40, 120, 30, 30, 30], 200],
      [[300, 20, 20], 200], // an entry taller than the viewport gets a page of its own
      [[50], 50],
      [Array.from({ length: 40 }, (_, i) => 20 + (i * 37) % 90), 360],
    ];
    const gap = 16;
    for (const [heights, viewport] of cases) {
      const pages = backlogPages(heights, viewport, gap);
      expect(pages.flat()).toEqual(heights.map((_, i) => i));
      for (const page of pages) {
        expect(page.length).toBeGreaterThan(0);
        const used = page.reduce((s, i) => s + heights[i], 0) + gap * (page.length - 1);
        if (page.length > 1) expect(used, `${heights} @ ${viewport}`).toBeLessThanOrEqual(viewport);
      }
      // A page never ends early: the next page's first entry would not have fit.
      for (let p = 0; p + 1 < pages.length; p++) {
        const used = pages[p].reduce((s, i) => s + heights[i], 0) + gap * (pages[p].length - 1);
        expect(used + gap + heights[pages[p + 1][0]]).toBeGreaterThan(viewport);
      }
    }
    expect(backlogPages([], 100, 8)).toEqual([[]]);
  });
});

describe('Story dialogue: an event choice, step by step', () => {
  const plain = { available: true as const, pickOptions: null, removeUpTo: 0, removeAtLeast: 0 };

  it('resolves a choice that asks for nothing at once', () => {
    expect(nextEventStep(1, plain)).toEqual({ kind: 'resolve', choiceIndex: 1, pickId: null, removeIds: [] });
  });

  it('asks for the pick, then the removal, then resolves with both', () => {
    const needs = { available: true as const, pickOptions: ['a', 'b', 'c'], removeUpTo: 2, removeAtLeast: 0 };
    const first = nextEventStep(0, needs);
    expect(first).toEqual({ kind: 'pick', choiceIndex: 0, options: ['a', 'b', 'c'] });
    const second = nextEventStep(0, needs, { pickId: 'b' });
    expect(second).toEqual({ kind: 'remove', choiceIndex: 0, upTo: 2, atLeast: 0 });
    // Removing none is an answer, not a question left open.
    expect(nextEventStep(0, needs, { pickId: 'b', removeIds: [] })).toEqual({ kind: 'resolve', choiceIndex: 0, pickId: 'b', removeIds: [] });
    expect(nextEventStep(0, needs, { pickId: 'b', removeIds: ['x', 'y'] })).toEqual({ kind: 'resolve', choiceIndex: 0, pickId: 'b', removeIds: ['x', 'y'] });
  });

  it('words the remove step for each removal the script asks for', () => {
    // "remove a card of your choice" (exactly one) and "remove up to two" (none allowed).
    expect(removeStepCopy(1, 1).note).toBe('Choose one card to remove from your run deck.');
    expect(removeStepCopy(2, 0).note).toBe('Choose up to 2 cards to remove from your run deck, or none.');
    expect(removeStepCopy(3, 1).note).toBe('Choose up to 3 cards to remove from your run deck, at least 1.');
    expect(removeConfirmLabel(0, 1, 1)).toBe('Choose a Card');
    expect(removeConfirmLabel(1, 1, 1)).toBe('Remove 1 Card');
    expect(removeConfirmLabel(0, 2, 0)).toBe('Remove No Cards');
    expect(removeConfirmLabel(2, 2, 0)).toBe('Remove 2 Cards');
  });
});

describe('Story dialogue: the screen', () => {
  const sides = ['left', 'right', null] as const;

  it('holds the longest script line, the name plate, title and controls inside the frame and apart, in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      const textSize = storyDialogueTextSize();
      const longest = wrappedHeight(LONGEST_LINE.text, textSize, storyDialogueTextWidth(), storyDialogueLineHeight());
      const longestTitle = STORY_SCENES.reduce((a, s) => ((s.title?.length ?? 0) > a.length ? s.title! : a), '');
      const titleWidth = Math.min(storyDialogueTitleMaxWidth(BACK_HIT), longestTitle.length * storyDialogueTitleSize() * 0.6);
      const title = { width: titleWidth, height: wrappedHeight(longestTitle, storyDialogueTitleSize(), storyDialogueTitleMaxWidth(BACK_HIT), menuLineHeight(storyDialogueTitleSize())) };
      for (const side of sides) for (const withTitle of [false, true]) for (const extras of [false, true]) {
        const where = `${cell.name}, ${side ?? 'narration'}${withTitle ? ', titled' : ''}${extras ? '' : ', result step'}`;
        const l = storyDialogueLayout({
          side,
          textHeight: longest,
          nameWidth: side === null ? null : 'Gongsun Zan'.length * storyDialogueNameSize() * 0.6,
          continueHit: buttonHit('Continue', 160),
          backlogHit: extras ? buttonHit('Backlog', 120) : null,
          skipHit: extras ? buttonHit('Skip', 120) : null,
          title: withTitle ? title : null,
        });
        expect(isInsideTitleSafe(l.box), where).toBe(true);
        expect(l.text.height, `${where}: room for the longest line`).toBeGreaterThanOrEqual(longest);
        expect(l.text.height, `${where}: room for two lines always`).toBeGreaterThanOrEqual(2 * storyDialogueLineHeight());
        expect(isRectContained(l.text, l.box), where).toBe(true);
        const controls = [['Continue', l.continue], ['Backlog', l.backlog], ['Skip', l.skip]].filter((c): c is [string, Rect] => c[1] !== null);
        expect(controls.length, where).toBe(extras ? 3 : 1);
        for (const [name, r] of controls) {
          expect(isRectContained(r, l.box), `${where}: ${name} inside the box`).toBe(true);
          expect(Math.min(r.width, r.height), `${where}: ${name} is a 44px target`).toBeGreaterThanOrEqual(HIT);
          expect(r.y - bottom(l.text), `${where}: ${name} under the text`).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
        }
        expectApart(controls, GAP_FLOORS.ordinary, where);
        // The back button's band stays clear of the box, the title and the name plate.
        expectApart([['back', BACK_HIT], ['box', l.box]], GAP_FLOORS.ordinary, where);
        if (l.title) {
          expect(isInsideTitleSafe(l.title), where).toBe(true);
          expect(l.title.height).toBeGreaterThanOrEqual(HIT);
          expectApart([['back', BACK_HIT], ['title', l.title], ['box', l.box]], GAP_FLOORS.ordinary, where);
        }
        if (side === null) {
          expect(l.namePlate, where).toBeNull();
          expect(l.portrait, where).toBeNull();
          continue;
        }
        const plate = l.namePlate!;
        expect(isInsideTitleSafe(plate), where).toBe(true);
        expect(plate.height, where).toBeGreaterThanOrEqual(menuLineHeight(storyDialogueNameSize()));
        // The plate sits on the speaker's side and never over the text.
        expect(plate.x + plate.width / 2 < theme.design.safeCenterX, where).toBe(side === 'left');
        expect(bottom(plate), `${where}: plate over the text`).toBeLessThanOrEqual(l.text.y);
        const p = l.portrait!;
        expect(isInsideTitleSafe(p), where).toBe(true);
        expect(p.width / p.height, 'the 2:3 cutout is not stretched').toBeCloseTo(2 / 3, 5);
        expect(side === 'left' ? p.x : right(p), `${where}: against its own edge`).toBe(side === 'left' ? theme.design.safeLeft : theme.design.safeRight);
        expectApart([['back', BACK_HIT], ['portrait', p]], GAP_FLOORS.ordinary, where);
        if (l.title) expect(p.y - bottom(l.title), `${where}: portrait under the title`).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
        // The portrait's bottom stands behind the box (no hard cut at its waist above the box)...
        expect(bottom(p), where).toBeGreaterThanOrEqual(l.box.y);
        // ...and at least half of her shows above it, even for the longest line at the largest text.
        expect(l.box.y - p.y, `${where}: portrait visible above the box`).toBeGreaterThanOrEqual(p.height / 2);
      }
    });
  });

  it('keeps the box one size through a scene: a short line keeps the room the player measured for the tallest', () => {
    forEachA11yCell((cell) => {
      const input = { side: 'left' as const, nameWidth: 80, continueHit: buttonHit('Continue', 160), backlogHit: buttonHit('Backlog', 120), skipHit: buttonHit('Skip', 120), title: null };
      const small = storyDialogueLayout({ ...input, textHeight: 10 });
      const big = storyDialogueLayout({ ...input, textHeight: 5 * storyDialogueLineHeight() });
      expect(small.box.height, cell.name).toBeLessThan(big.box.height);
      expect(bottom(small.box)).toBe(bottom(big.box));
      expect(big.text.height).toBeGreaterThanOrEqual(5 * storyDialogueLineHeight());
    });
  });

  it('fits the choices of every event, with a refusal reason under each, inside the frame and apart, in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      const width = storyChoiceTextWidth();
      const reason = "Your deck can't go below 30 cards.";
      for (const event of STORY_EVENTS) {
        const heights = event.choices.map((c) => wrappedHeight(c.label, theme.type.body, width, menuLineHeight(theme.type.body))
          + theme.space(1) + wrappedHeight(reason, theme.type.label, width, menuLineHeight(theme.type.label)));
        const speaker = eventSpeaker(storySceneById(event.id)!, null);
        const l = storyChoicePanelLayout(speaker?.side ?? null, menuLineHeight(theme.type.label), heights);
        const where = `${cell.name}, ${event.id}`;
        expect(isInsideTitleSafe(l.box), where).toBe(true);
        expect(isRectContained(l.header, l.box), where).toBe(true);
        expectApart([['back', BACK_HIT], ['panel', l.box]], GAP_FLOORS.ordinary, where);
        l.rows.forEach((r, i) => {
          expect(isRectContained(r, l.box), where).toBe(true);
          expect(r.height, `${where}: row ${i} is a 44px target`).toBeGreaterThanOrEqual(HIT);
          expect(r.height - 2 * l.rowInset.y, `${where}: row ${i} holds its label and reason`).toBeGreaterThanOrEqual(heights[i]);
          expect(r.width - 2 * l.rowInset.x, `${where}: row ${i} wraps to the text width`).toBeGreaterThanOrEqual(width);
          expect(r.y - bottom(l.header), where).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
        });
        expectApart(l.rows.map((r, i): [string, Rect] => [`choice ${i}`, r]), GAP_FLOORS.ordinary, where);
        if (l.portrait) expect(l.box.y - l.portrait.y, `${where}: the speaker stays visible`).toBeGreaterThanOrEqual(l.portrait.height / 3);
      }
    });
  });
});
