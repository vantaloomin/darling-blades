import Phaser from 'phaser';
import type { CardDef } from '../engine/types';
import { makeCardThumb } from './CardThumbCache';

/**
 * One land group on the duel board: a small stacked pile of cached card
 * thumbnails with a mana-color pip and an untapped/total badge. Fully tapped
 * groups dim and turn their top card sideways, so board mana reads at a
 * glance. The pile itself is display-only; the exposed `top` Image is a plain
 * (safely interactive) hook for hover-zoom / right-click-inspect wiring.
 */

/** Horizontal step between adjacent stacks in a land row. */
export const LAND_STACK_STEP = 100;
/** Thumb scale in CardView units → ~54×79 px cards. */
const LAND_SCALE = 0.18;
/** Draw at most this many physical thumbs; the badge carries the real count. */
const MAX_LAYERS = 4;

export class LandStackView extends Phaser.GameObjects.Container {
  /** Top thumb of the pile — a plain Image; safe to setInteractive directly. */
  readonly top: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    card: CardDef,
    total: number,
    untapped: number,
  ) {
    super(scene, x, y);

    const layers = Math.max(1, Math.min(total, MAX_LAYERS));
    let top: Phaser.GameObjects.Image | null = null;
    for (let j = 0; j < layers; j++) {
      // Bottom of the pile first; each layer steps up-right slightly.
      const k = j - (layers - 1) / 2;
      const img = makeCardThumb(scene, k * 3, -k * 2, card, LAND_SCALE);
      this.add(img); // pulls it off the scene display list into the container
      top = img;
    }
    this.top = top!;
    if (untapped === 0) {
      this.top.setAngle(90);
      this.setAlpha(0.6);
    }

    // Mana-color pips at the pile's top-left corner (up to two colors).
    (card.manaAbility ?? []).slice(0, 2).forEach((c, i) => {
      this.add(scene.add.image(-26 + i * 14, -32, `pip-${c}`).setDisplaySize(16, 16));
    });

    // untapped/total badge, gold while mana is available. Sits at y+24 —
    // over the pile's lower third rather than below it — to keep the count
    // legible where it isn't tucked under the hand. NOTE (1a fan, 2026-07-04):
    // the resting fan now tops out at y≈462–496 (above this badge at ~cy+24),
    // so every stack the fan spans (all but the leftmost) has its badge
    // intentionally occluded — the authoritative "what mana do I have"
    // readout is the AVAILABLE MANA pip row (DuelScene.syncManaPips), NOT
    // these per-stack badges. Only stack 1 (x 210) stays fully visible.
    const badgeBg = scene.add
      .rectangle(0, 24, 40, 16, 0x120e1e, 0.88)
      .setStrokeStyle(1, 0x3a2f5c, 1);
    const badge = scene.add
      .text(0, 24, `${untapped}/${total}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: untapped > 0 ? '#ffd88a' : '#a89cc6',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.add([badgeBg, badge]);

    scene.add.existing(this);
  }
}
