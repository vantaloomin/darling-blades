import Phaser from 'phaser';
import type { DeckPipBead } from './deckStats';
import { theme } from './theme';

export interface PipBeadRowOptions {
  /** Bead diameter. */
  size?: number;
  /** Between a bead and its count. */
  countGap?: number;
  /** Between one bead-and-count pair and the next. */
  pairGap?: number;
}

/**
 * A deck summary's colours as mana-pip beads with their counts, right-aligned
 * so the run ends on `right`, in the Deck Builder's bead recipe. Colors are
 * shown as beads everywhere a deck is summarized, never as letter codes. The
 * caller bakes the pip textures (`bakeManaSymbols`); a missing one leaves its
 * slot empty rather than drawing a placeholder. Returns the drawn objects and
 * the run's left edge, so the caller can fit the text beside it.
 */
export function drawPipBeadRow(
  scene: Phaser.Scene,
  right: number,
  y: number,
  beads: readonly DeckPipBead[],
  opts: PipBeadRowOptions = {},
): { objects: Phaser.GameObjects.GameObject[]; left: number } {
  const size = opts.size ?? 16;
  const countGap = opts.countGap ?? 3;
  const pairGap = opts.pairGap ?? 10;
  const objects: Phaser.GameObjects.GameObject[] = [];
  let cursor = right;
  let left = right;
  for (const bead of [...beads].reverse()) {
    if (bead.count !== null) {
      const count = scene.add
        .text(cursor, y, `${bead.count}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(1, 0.5);
      objects.push(count);
      cursor -= count.width + countGap;
    }
    const key = `pip-${bead.color}`;
    if (scene.textures.exists(key)) {
      objects.push(scene.add.image(cursor - size / 2, y, key).setDisplaySize(size, size));
    }
    left = cursor - size;
    cursor = left - pairGap;
  }
  return { objects, left };
}
