import { describe, expect, it } from 'vitest';
import {
  CLUSTER_BUTTON,
  clusterControlX,
  DUEL_LAYOUT,
  manaStripPitch,
  MY_RESERVE_PILE_VISUAL,
  myCreatureBand,
  lifeBadgeBounds,
  passButtonBounds,
  pileBounds,
  pileHitBounds,
  severedPileHitBounds,
} from '../../src/ui/duelLayout';
import { isInsideTitleSafe, type Rect } from '../../src/ui/layout';
import { packRow } from '../../src/ui/rowPacking';

const L = DUEL_LAYOUT;

/** Inactive space between two rectangles; negative when they overlap. */
function gapBetween(a: Rect, b: Rect): number {
  return Math.max(
    b.x - (a.x + a.width),
    a.x - (b.x + b.width),
    b.y - (a.y + a.height),
    a.y - (b.y + b.height),
  );
}

const foePiles = [L.oppPiles.handY, L.oppPiles.graveY, L.oppPiles.deckY, L.oppPiles.severedY]
  .map((y) => ({ x: L.oppPiles.x, y }));
const myPiles = [L.piles.severedY, L.piles.deckY, L.piles.graveY].map((y) => ({ x: L.piles.x, y }));

/**
 * The title-safe contract (docs/design-system.md, "Safe-area model"): a card
 * count or life total must survive a cropped outer band. Not held here yet,
 * pending the owner's ruling on 1.8.1 G20: the two commander portraits
 * (full-bleed stage art), Undo (the left rail is 44px wide inside the frame,
 * the button about 80) and the ⚙ Menu.
 */
describe('Duel HUD: title-safe frame', () => {
  it('keeps every pile in both columns inside the frame', () => {
    for (const pile of [...foePiles, ...myPiles]) {
      expect(isInsideTitleSafe(pileBounds(pile.x, pile.y)), JSON.stringify(pile)).toBe(true);
    }
  });

  it('keeps both life badges inside the frame, legal-target ring included', () => {
    expect(isInsideTitleSafe(lifeBadgeBounds(L.myLife))).toBe(true);
    expect(isInsideTitleSafe(lifeBadgeBounds(L.oppLife))).toBe(true);
  });

  it('sits both life badges at the same offset from their portrait\'s outer top corner', () => {
    const mine = { x: L.myLife.x - L.portrait.x, y: L.myLife.y - L.portrait.y };
    const foe = { x: L.oppPortrait.x + L.oppPortrait.w - L.oppLife.x, y: L.oppLife.y - L.oppPortrait.y };
    expect(mine).toEqual(foe);
  });
});

describe('Duel HUD: isolation from the board and the smart button', () => {
  it('keeps the foe pile column, wide severed target included, off both battlefield plates', () => {
    const plateLeft = Math.min(L.oppZone.x0, L.myZone.x0);
    const targets = [
      ...foePiles.map((pile) => pileHitBounds(pile.x, pile.y)),
      severedPileHitBounds(L.oppPiles.x, L.oppPiles.severedY, -1),
    ];
    for (const rect of targets) expect(rect.x + rect.width, JSON.stringify(rect)).toBeLessThanOrEqual(plateLeft);
  });

  it('keeps your piles a compact-touch gap (12px) from the smart button', () => {
    const pass = passButtonBounds();
    const targets = [
      ...myPiles.map((pile) => pileHitBounds(pile.x, pile.y)),
      severedPileHitBounds(L.piles.x, L.piles.severedY, 1),
    ];
    for (const rect of targets) expect(gapBetween(rect, pass), JSON.stringify(rect)).toBeGreaterThanOrEqual(12);
  });

  it('keeps neighbouring piles in a column from touching', () => {
    for (const column of [foePiles, myPiles]) {
      const hits = [...column].sort((a, b) => a.y - b.y).map((pile) => pileHitBounds(pile.x, pile.y));
      for (let i = 1; i < hits.length; i++) expect(gapBetween(hits[i - 1], hits[i])).toBeGreaterThanOrEqual(8);
    }
  });
});

describe('Duel HUD: controls that grow with text', () => {
  it('keeps a mana count clear of the next pip at any count width', () => {
    for (const strip of [L.myManaStrip, L.oppManaStrip]) {
      for (const countWidth of [20, 28, 40]) {
        const pitch = manaStripPitch(strip.step, strip.pipSize, countWidth);
        const countRight = strip.pipSize * 0.64 + countWidth;
        expect(pitch - strip.pipSize / 2 - countRight).toBeGreaterThanOrEqual(8);
        expect(pitch).toBeGreaterThanOrEqual(strip.step);
      }
    }
  });

  it('keeps sidebar confirm buttons off your pile column', () => {
    const y = L.cluster.endTurnY;
    for (const width of [CLUSTER_BUTTON.minWidth, 180]) {
      const x = clusterControlX(width);
      const button = { x: x - width / 2, y: y - 22, width, height: 44 };
      for (const pileY of [L.piles.deckY, L.piles.graveY]) {
        expect(gapBetween(button, pileHitBounds(L.piles.x, pileY))).toBeGreaterThanOrEqual(8);
      }
    }
    // A narrow control stays on the cluster's own column.
    expect(clusterControlX(90)).toBe(L.cluster.x);
  });
});

/**
 * Your creature row sits just above your mana counters and Warchest pile.
 * Tile sizes are BoardCardView's (156×170, a tapped tile turns sideways); the
 * state ring reaches 3px out plus half its stroke (5px in high contrast).
 */
describe('Duel board: your creature row', () => {
  const TILE = { w: 156, h: 170, ringReach: 3 + 5 / 2, maxSpacing: 174, gutter: 6 };

  function rowRects(count: number, tapped: boolean): Rect[] {
    const band = myCreatureBand(count, TILE.w, TILE.maxSpacing, TILE.gutter);
    const packed = packRow(count, band.usable, TILE.w, TILE.maxSpacing, TILE.gutter);
    const w = (tapped ? TILE.h : TILE.w) * packed.scale + TILE.ringReach * 2;
    const h = (tapped ? TILE.w : TILE.h) * packed.scale + TILE.ringReach * 2;
    return packed.offsets.map((offset) => ({
      x: band.x + offset - w / 2,
      y: L.myCreatures.cy - h / 2,
      width: w,
      height: h,
    }));
  }

  const strip = L.myManaStrip;
  const mana: Rect = {
    x: strip.x0 - strip.pipSize / 2,
    y: strip.cy - strip.pipSize / 2,
    width: L.myZone.x1 - (strip.x0 - strip.pipSize / 2),
    height: strip.pipSize,
  };
  const pile = L.reservePiles.human;
  const warchest: Rect = {
    x: pile.x - MY_RESERVE_PILE_VISUAL.halfWidth,
    y: pile.y + MY_RESERVE_PILE_VISUAL.top,
    width: MY_RESERVE_PILE_VISUAL.halfWidth * 2,
    height: MY_RESERVE_PILE_VISUAL.bottom - MY_RESERVE_PILE_VISUAL.top,
  };

  it('never covers your mana counters or Warchest, at any row length', () => {
    for (let count = 1; count <= 12; count++) {
      for (const tapped of [false, true]) {
        for (const tile of rowRects(count, tapped)) {
          const label = `${count} creatures${tapped ? ', tapped' : ''}`;
          expect(gapBetween(tile, mana), label).toBeGreaterThan(0);
          expect(gapBetween(tile, warchest), label).toBeGreaterThan(0);
        }
      }
    }
  });

  it('stays over the foe row until a long row would reach the Warchest', () => {
    expect(myCreatureBand(1, TILE.w, TILE.maxSpacing, TILE.gutter).x).toBe(L.oppCreatures.x);
    expect(myCreatureBand(4, TILE.w, TILE.maxSpacing, TILE.gutter).x).toBe(L.oppCreatures.x);
    // A narrowed band keeps the shared right edge.
    const long = myCreatureBand(8, TILE.w, TILE.maxSpacing, TILE.gutter);
    expect(long.x + long.usable / 2).toBe(L.myCreatures.x + L.myCreatures.usable / 2);
  });
});
