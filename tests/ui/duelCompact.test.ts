import { describe, expect, it } from 'vitest';
import {
  castLeavesLine,
  DUEL_PHONE,
  duelPhoneLayout,
  duelPhoneReadback,
  focusCard,
  handList,
  handRowLook,
  lifePlate,
  medallionRows,
  phoneActionLabel,
  plainHistoryLine,
  sideBoard,
  turnLineLabel,
  undoToastDetail,
} from '../../src/ui/duelCompact';
import { COMPACT } from '../../src/ui/compactLayout';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Rect, b: Rect): boolean =>
  a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 && a.x + a.width <= b.x + b.width + 1e-6 && a.y + a.height <= b.y + b.height + 1e-6;
const disjoint = (rects: Rect[], name: string): void => {
  rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => expect(overlap(a, b), `${name}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`).toBe(false)));
};
/** A medallion's footprint: its disc plus the P/T pill hanging below it. */
const medallionBox = (x: number, y: number, d: number): Rect => ({ x: x - d / 2, y: y - d / 2, width: d, height: d + DUEL_PHONE.pillDrop });

const island: Rect = { x: 67, y: 8, width: 718, height: 356 };

describe('the phone Duel (mocks T-03a, T-03b, T-10, T-13a)', () => {
  it('matches the mocks\' column widths on the island phone', () => {
    const L = duelPhoneLayout(island);
    expect(L.left).toMatchObject({ x: 67, width: 96 });
    expect(L.main).toMatchObject({ x: 171, width: 376 });
    expect(L.column).toMatchObject({ x: 555, width: 230 });
  });

  it('keeps every region inside the content, apart, and at touch size, on every landscape screen and text size', () => {
    for (const { name, m } of landscape) {
      for (const largeText of [false, true]) {
        const L = duelPhoneLayout(m.content, { largeText });
        const tag = `${name}${largeText ? ' 130%' : ''}`;
        const regions = [L.oppPortrait, L.oppBlock, L.history, L.menu, L.myBlock, L.myPortrait, L.oppHalf, L.line, L.myHalf, L.hand, L.endTurn, L.primary];
        for (const r of regions) expect(inside(r, m.content), `${tag}: ${JSON.stringify(r)}`).toBe(true);
        disjoint([L.oppPortrait, L.oppBlock, L.history, L.myBlock, L.myPortrait], `${tag} left`);
        disjoint([L.history, L.menu], `${tag} buttons`);
        disjoint([L.oppHalf, L.line, L.myHalf], `${tag} board`);
        disjoint([L.hand, L.endTurn, L.primary], `${tag} column`);
        disjoint([L.left, L.main, L.column], `${tag} panes`);
        for (const r of [L.history, L.menu, L.endTurn, L.primary]) expect(r.height, tag).toBeGreaterThanOrEqual(COMPACT.touch);
        expect(L.oppPortrait.height, tag).toBeGreaterThan(0);
      }
    }
  });

  it('splits a crowded side into a front row taking the larger half', () => {
    expect(medallionRows(3, 5)).toEqual([3, 0]);
    expect(medallionRows(5, 5)).toEqual([5, 0]);
    expect(medallionRows(9, 5)).toEqual([5, 4]);
    expect(medallionRows(8, 5)).toEqual([4, 4]);
  });

  it('fits any board inside its half with no medallion touching another or the strip', () => {
    for (const { name, m } of landscape) {
      const L = duelPhoneLayout(m.content);
      for (const [side, half] of [['opp', L.oppHalf], ['mine', L.myHalf]] as const) {
        for (const creatures of [0, 1, 4, 5, 9, 12]) {
          for (const others of [0, 3, 8]) {
            const b = sideBoard(half, side, creatures, others);
            const tag = `${name} ${side} ${creatures}+${others}`;
            expect(b.d, tag).toBeGreaterThanOrEqual(DUEL_PHONE.medallionMin);
            expect(b.creatures, tag).toHaveLength(creatures);
            expect(b.strip, tag).toHaveLength(others);
            const boxes = b.creatures.map((c) => medallionBox(c.x, c.y, b.d));
            const strip = b.strip.map((s) => ({ x: s.x - b.stripD / 2, y: s.y - b.stripD / 2, width: b.stripD, height: b.stripD }));
            for (const r of [...boxes, ...strip]) expect(inside(r, half), `${tag}: ${JSON.stringify(r)}`).toBe(true);
            disjoint(boxes, tag);
            for (const s of strip) for (const c of boxes) expect(overlap(s, c), tag).toBe(false);
          }
        }
      }
    }
  });

  it('puts the front row nearer the turn line on both sides', () => {
    const L = duelPhoneLayout(island);
    const opp = sideBoard(L.oppHalf, 'opp', 8, 2);
    const mine = sideBoard(L.myHalf, 'mine', 8, 2);
    expect(opp.rowY[0]).toBeGreaterThan(opp.rowY[1]);
    expect(opp.stripY).toBeLessThan(opp.rowY[1]);
    expect(mine.rowY[0]).toBeLessThan(mine.rowY[1]);
    expect(mine.stripY).toBeGreaterThan(mine.rowY[1]);
  });

  it('lists the hand down the column: seven cards at 130% show four rows and "3 more" (T-13a)', () => {
    const L = duelPhoneLayout(island, { largeText: true });
    const list = handList(L, 7);
    expect(list.rows).toHaveLength(5);
    expect(list.more).toBe(3);
    const small = handList(duelPhoneLayout(island), 7);
    expect(small.more).toBe(0);
  });

  it('pins the Undo toast and the Warchest row above the hand, apart and in order (M20, T-03b)', () => {
    const L = duelPhoneLayout(island);
    const list = handList(L, 6, 2);
    expect(list.pinned).toHaveLength(2);
    expect(list.pinned[0].y).toBe(L.hand.y);
    expect(list.pinned[1].y).toBeGreaterThan(list.pinned[0].y + list.pinned[0].height);
    disjoint([...list.pinned, ...list.rows.map((row) => row.visual)], 'pinned');
    for (const row of [...list.pinned, ...list.rows.map((r) => r.visual)]) expect(inside(row, L.hand)).toBe(true);
    // Two pinned rows cost the hand two slots: six cards no longer all fit.
    expect(handList(L, 6, 0).more).toBe(0);
    expect(list.more).toBeGreaterThan(0);
  });

  it('opens a card as large as the centre allows, inside it (T-04, T-05)', () => {
    for (const { name, m } of landscape) {
      const L = duelPhoneLayout(m.content);
      const at = focusCard(L, 300, 420);
      const box = { x: at.x - 150 * at.scale, y: at.y - 210 * at.scale, width: 300 * at.scale, height: 420 * at.scale };
      expect(inside(box, L.main), name).toBe(true);
      expect(Math.max(box.height / L.main.height, box.width / L.main.width), name).toBeGreaterThan(0.9);
    }
  });

  it('says what a cast and an Empower leave untapped, never below zero (T-04)', () => {
    expect(castLeavesLine(6, 2, 4)).toBe('Cast leaves 4 · Empower leaves 2');
    expect(castLeavesLine(3, 2, null)).toBe('Cast leaves 1');
    expect(castLeavesLine(1, 3, null)).toBe('Cast leaves 0');
  });

  it('names the move the Undo toast takes back (M20)', () => {
    expect(undoToastDetail('castSpell', 'Kicked Door')).toBe('Cast Kicked Door');
    expect(undoToastDetail('playLand', 'Mountain')).toBe('Played Mountain');
    expect(undoToastDetail('declareAttackers', null)).toBe('Your attack');
  });

  it('reads the animations\' anchors back from the phone regions', () => {
    const L = duelPhoneLayout(island);
    const R = duelPhoneReadback(L);
    const within = (p: { x: number; y: number }, r: Rect): boolean => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
    expect(within(R.myLife, L.myPortrait)).toBe(true);
    expect(within(R.oppLife, L.oppPortrait)).toBe(true);
    expect(within(R.darlingZone.human, L.myHalf)).toBe(true);
    expect(within(R.darlingZone.opponent, L.oppHalf)).toBe(true);
    expect(inside(lifePlate(L.myPortrait), L.myPortrait)).toBe(true);
  });

  it('says why a card cannot go on the board in two words, and keeps Charms lit on the foe\'s turn (T-03a, T-10)', () => {
    const creature = { types: ['creature'], subtypes: ['Human'], attack: 2, defense: 2 };
    const charm = { types: ['charm'], subtypes: [] };
    const ritual = { types: ['ritual'], subtypes: [] };
    const full = handRowLook(creature, { playable: false, reason: 'Your side of the battlefield is full of creatures.', yourDecision: true });
    expect(full).toMatchObject({ detail: 'Board full', tone: 'danger', dim: true });
    expect(handRowLook(charm, { playable: true, reason: null, yourDecision: true })).toMatchObject({ icon: 'bolt', tone: 'gold', dim: false });
    expect(handRowLook(charm, { playable: false, reason: null, yourDecision: false }).dim).toBe(false);
    expect(handRowLook(ritual, { playable: false, reason: null, yourDecision: false })).toMatchObject({ icon: 'scroll', dim: true });
  });

  it('writes the turn line and the buttons in sentence case (M29)', () => {
    expect(turnLineLabel(8, 'MORNING', null)).toBe('Turn 8 · Your Morning');
    expect(turnLineLabel(9, 'MORNING', 'Hestia')).toBe("Turn 9 · Hestia's Morning");
    expect(turnLineLabel(0, 'MORNING', null)).toBe('');
    expect(phoneActionLabel('To Combat')).toBe('To combat');
    expect(phoneActionLabel('Confirm Blocks (2)')).toBe('Confirm blocks (2)');
    expect(phoneActionLabel('Pass ▶')).toBe('Pass');
    expect(plainHistoryLine('[Sanctum of Many Masks] linked to [Gaia]')).toBe('Sanctum of Many Masks linked to Gaia');
  });
});
