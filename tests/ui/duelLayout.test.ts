import { describe, expect, it } from 'vitest';
import {
  DUEL_LAYOUT,
  lifeBadgeBounds,
  passButtonBounds,
  pileBounds,
  pileHitBounds,
  severedPileHitBounds,
} from '../../src/ui/duelLayout';
import { isInsideTitleSafe, type Rect } from '../../src/ui/layout';

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
