import Phaser from 'phaser';
import type { CardDef } from '../engine/types';
import type { FrameStyle } from '../meta/variants';
import { compactScrim, coverFitImage } from './compactWidgets';
import { FRAME_TREATMENTS } from './CardFrameFactory';
import { medallionRim } from './duelCompact';
import { tileName } from './DuelPhoneSheet';
import type { Rect } from './layout';
import { ensureNumeralPip, pipsFor } from './ManaSymbols';
import { addPortraitArt } from './portraitArt';
import { colorInt, theme } from './theme';

/**
 * A pull as the compact Pack Opening shows it (S-Pack-Reveal): face down, the
 * deck's card back in a rim; face up, the card's art with its cost at the top
 * left, its name over a scrim at the foot and its stats above the name. The
 * rim is the rolled frame's colour, or the card's colour on a plain frame.
 *
 * The tile is a Container centred on its cell so a flip can squash it on
 * scaleX; it never takes input itself (a scaled Container must not be
 * interactive), so the scene lays a Zone over the cell.
 */
export class PackTile extends Phaser.GameObjects.Container {
  readonly cell: Rect;
  private face: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, cell: Rect) {
    super(scene, cell.x + cell.width / 2, cell.y + cell.height / 2);
    this.cell = cell;
    scene.add.existing(this);
  }

  /** The tile's rect in its own space (centred on 0, 0). */
  private get local(): Rect {
    return { x: -this.cell.width / 2, y: -this.cell.height / 2, width: this.cell.width, height: this.cell.height };
  }

  private clearFace(): void {
    for (const part of this.face) part.destroy();
    this.face = [];
  }

  /** Face down: the card back, rimmed in `rim` (a special's tier colour) or the panel stroke. */
  showBack(textureKey: string, rim?: number): this {
    this.clearFace();
    const r = this.local;
    const radius = theme.radius.panel;
    const back = this.scene.add.image(0, 0, textureKey);
    coverFitImage(back, { x: r.x + 2, y: r.y + 2, width: r.width - 4, height: r.height - 4 });
    const stroke = this.scene.add.graphics()
      .lineStyle(rim === undefined ? 1.5 : 3, rim ?? theme.graphics.panelStroke, 1)
      .strokeRoundedRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2, radius);
    this.face = [back, stroke];
    this.add(this.face);
    return this;
  }

  /** Face up: art, cost, name and stats, in the frame's rim. */
  showFace(card: CardDef, frame: FrameStyle): this {
    this.clearFace();
    const scene = this.scene;
    const type = theme.compactType;
    const r = this.local;
    const radius = theme.radius.panel;
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(scene.add.graphics().fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(r.x, r.y, r.width, r.height, radius));
    const art: Rect = { x: r.x + 3, y: r.y + 3, width: r.width - 6, height: r.height - 6 };
    try {
      const image = addPortraitArt(scene, art.x + art.width / 2, art.y + art.height / 2, card.id, (img) => coverFitImage(img, art, 0.1), 'half');
      if (image) parts.push(image);
    } catch {
      // No art: the tile reads as its name and cost.
    }
    parts.push(compactScrim(scene, art, 0.5));
    const pip = Math.round(Math.min(type.label * 1.3, art.width * 0.2));
    let px = art.x + 3;
    for (const spec of card.cost ? pipsFor(card.cost) : []) {
      const key = spec.number !== undefined ? ensureNumeralPip(scene, spec.number) : spec.texture;
      if (!scene.textures.exists(key) || px + pip > art.x + art.width - 3) break;
      parts.push(scene.add.image(px + pip / 2, art.y + 3 + pip / 2, key).setDisplaySize(pip, pip));
      px += pip + 1;
    }
    const name = tileName(scene, art, card.name);
    parts.push(name);
    if (card.attack !== undefined && card.defense !== undefined) {
      parts.push(statPill(scene, art.x + art.width - 4, name.y - name.height - 3, `${card.attack}/${card.defense}`));
    }
    const rim = frameRim(frame) ?? colorInt(medallionRim(card.colors, card.types));
    parts.push(scene.add.graphics().lineStyle(frame === 'white' ? 2.5 : 3.5, rim, 1)
      .strokeRoundedRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2, radius));
    this.face = parts;
    this.add(parts);
    return this;
  }
}

/** A rolled frame's rim colour, or null for the plain (white) frame. Black reads as slate on the dark table. */
export function frameRim(frame: FrameStyle): number | null {
  if (frame === 'white') return null;
  if (frame === 'black') return 0x6a6a78;
  return FRAME_TREATMENTS[frame].ring;
}

/** "1/2": a creature's stats, right-aligned at `right`, its foot at `bottom`. */
function statPill(scene: Phaser.Scene, right: number, bottom: number, text: string): Phaser.GameObjects.Container {
  const label = scene.add.text(0, 0, text, {
    fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.label}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
  }).setOrigin(0.5);
  const w = label.width + 12;
  const h = label.height + 4;
  const plate = scene.add.graphics()
    .fillStyle(theme.graphics.panelFill, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)
    .lineStyle(1, theme.graphics.panelStroke, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  return scene.add.container(right - w / 2, bottom - h / 2, [plate, label]);
}
