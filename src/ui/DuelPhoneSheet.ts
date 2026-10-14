import Phaser from 'phaser';
import type { CardDef } from '../engine/types';
import type { CardVariant } from '../meta/variants';
import { bindTapButton } from '../platform/gestures';
import { CARD_H, CARD_W, CardView } from './CardView';
import { compactIconButton, compactScrim, coverFitImage } from './compactWidgets';
import { medallionRim, sheetGrid } from './duelCompact';
import type { Rect } from './layout';
import { ensureNumeralPip, pipsFor } from './ManaSymbols';
import { addPortraitArt } from './portraitArt';
import { colorInt, theme } from './theme';
import { bakeUiIcon } from './uiIcons';

/**
 * The phone Duel's windows (mocks W-Foresee, W-Loot, W-HandSize): a sheet
 * over the left column and the centre, with a heading, a line on what to do,
 * and the cards. The command column beside it keeps the summary and the
 * Confirm; DuelScene draws that through DuelPhoneChrome. Geometry comes from
 * duelSheet() and sheetGrid() in src/ui/duelCompact.ts.
 */

interface SheetCard {
  card: CardDef;
  variant?: CardVariant;
  landStyle?: string;
  /** The pill on a picked card ("Discard", "Bottom"); null while it is not picked. */
  pill: string | null;
  onTap: () => void;
}

/** A card shown as its art (W-Loot, W-HandSize): cost, type, name. */
export type SheetArtTile = SheetCard;

/** A card shown as its whole face, with its place above it (W-Foresee). */
export interface SheetFace extends SheetCard {
  label: string;
  /** The top card's place is gold; the rest are muted. */
  lead: boolean;
}

export interface DuelSheetSpec {
  title: string;
  subtitle: string;
  onClose?: () => void;
  tiles?: readonly SheetArtTile[];
  faces?: readonly SheetFace[];
}

/** Art tiles are a little taller than wide, as in the mocks. */
const TILE_ASPECT = 1.22;
const PAD = 16;

export function drawDuelSheet(scene: Phaser.Scene, rect: Rect, spec: DuelSheetSpec): Phaser.GameObjects.Container {
  const type = theme.compactType;
  const c = scene.add.container(0, 0).setDepth(theme.depth.overlay);
  // The plate swallows taps that miss a card, so nothing under the sheet answers them.
  const plate = scene.add.rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height, 0, 0).setInteractive();
  const frame = scene.add.graphics()
    .fillStyle(theme.graphics.panelFill, 0.97).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel + 4)
    .lineStyle(1.5, theme.graphics.panelStroke, 1).strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel + 4);
  c.add([plate, frame]);
  const title = scene.add.text(rect.x + PAD, rect.y + 10, spec.title, {
    fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
  });
  const subtitle = scene.add.text(rect.x + PAD, title.y + title.height, spec.subtitle, {
    fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
    wordWrap: { width: rect.width - 2 * PAD, useAdvancedWrap: true },
  });
  c.add([title, subtitle]);
  if (spec.onClose) {
    const size = 36;
    const close = compactIconButton(scene, { x: rect.x + rect.width - size - 8, y: rect.y + 8, width: size, height: size }, 'close', spec.onClose);
    c.add(close.container);
  }
  const top = subtitle.y + subtitle.height + 10;
  const body: Rect = { x: rect.x + PAD, y: top, width: rect.width - 2 * PAD, height: rect.y + rect.height - PAD + 4 - top };
  if (spec.faces) drawFaces(scene, c, body, spec.faces);
  if (spec.tiles) drawTiles(scene, c, body, spec.tiles);
  return c;
}

function drawTiles(scene: Phaser.Scene, c: Phaser.GameObjects.Container, body: Rect, tiles: readonly SheetArtTile[]): void {
  const type = theme.compactType;
  const grid = sheetGrid(body, tiles.length, TILE_ASPECT, 120, 48);
  tiles.forEach((tile, i) => {
    const cell = grid.cells[i];
    const rim = colorInt(medallionRim(tile.card.colors, tile.card.types));
    const picked = tile.pill !== null;
    const r = theme.radius.panel;
    c.add(scene.add.graphics().fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(cell.x, cell.y, cell.width, cell.height, r));
    const art: Rect = { x: cell.x + 3, y: cell.y + 3, width: cell.width - 6, height: cell.height - 6 };
    try {
      const image = addPortraitArt(scene, art.x + art.width / 2, art.y + art.height / 2, tile.card.id, (img) => coverFitImage(img, art, 0.1),
        'half', tile.landStyle);
      if (image) c.add(image);
    } catch {
      // No art: the tile reads as its name and cost.
    }
    c.add(compactScrim(scene, art, 0.5));
    // Cost at the top left, generic first; the type's glyph at the top right.
    const pip = Math.round(type.label * 1.3);
    let px = art.x + 3;
    for (const spec of tile.card.cost ? pipsFor(tile.card.cost) : []) {
      const key = spec.number !== undefined ? ensureNumeralPip(scene, spec.number) : spec.texture;
      if (!scene.textures.exists(key) || px + pip > art.x + art.width - pip - 4) break;
      c.add(scene.add.image(px + pip / 2, art.y + 3 + pip / 2, key).setDisplaySize(pip, pip));
      px += pip + 1;
    }
    const glyph = tile.card.types.includes('charm') ? 'bolt' : tile.card.types.includes('ritual') ? 'scroll' : null;
    if (glyph) {
      const gx = art.x + art.width - 3 - pip / 2;
      const gy = art.y + 3 + pip / 2;
      c.add(scene.add.graphics().fillStyle(theme.graphics.panelFill, 0.9).fillCircle(gx, gy, pip / 2 + 1)
        .lineStyle(1, colorInt(theme.colors.gold), 0.9).strokeCircle(gx, gy, pip / 2 + 1));
      c.add(scene.add.image(gx, gy, bakeUiIcon(scene, glyph)).setDisplaySize(pip * 0.7, pip * 0.7).setTint(colorInt(theme.colors.gold)));
    }
    c.add(tileName(scene, art, tile.card.name));
    if (picked) {
      c.add(scene.add.graphics().fillStyle(theme.graphics.dim, 0.62).fillRect(art.x, art.y, art.width, art.height));
      c.add(pill(scene, cell.x + cell.width / 2, cell.y + cell.height * 0.42, tile.pill!, cell.width - 8));
    }
    c.add(scene.add.graphics().lineStyle(2.5, picked ? colorInt(theme.colors.dangerArmed) : rim, picked ? 0.7 : 1)
      .strokeRoundedRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2, r));
    c.add(tapZone(scene, cell, tile));
  });
}

function drawFaces(scene: Phaser.Scene, c: Phaser.GameObjects.Container, body: Rect, faces: readonly SheetFace[]): void {
  const type = theme.compactType;
  const labelH = Math.round(type.body * 1.5);
  const pillH = Math.round(type.label * 2.4);
  const row: Rect = { x: body.x, y: body.y + labelH, width: body.width, height: body.height - labelH - pillH };
  // One row: as wide as the height allows, narrower when more cards share it.
  const gap = 12;
  const w = Math.min(row.height * CARD_W / CARD_H, (row.width - (faces.length - 1) * gap) / Math.max(1, faces.length));
  const h = w * CARD_H / CARD_W;
  const left = row.x + (row.width - (faces.length * w + (faces.length - 1) * gap)) / 2;
  faces.forEach((face, i) => {
    const cell: Rect = { x: left + i * (w + gap), y: row.y, width: w, height: h };
    const cx = cell.x + w / 2;
    c.add(scene.add.text(cx, cell.y - 4, face.label, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700,
      color: face.lead ? theme.colors.gold : theme.colors.muted,
    }).setOrigin(0.5, 1));
    const view = new CardView(scene, cx, cell.y + h / 2).setScale(w / CARD_W);
    view.setCard(face.card, { fx: 'none', variant: face.variant, fullArt: face.variant?.fullArt === true, landStyle: face.landStyle });
    view.setAlpha(face.pill !== null ? 0.55 : 1);
    c.add(view);
    if (face.pill !== null) c.add(pill(scene, cx, cell.y + h + pillH / 2 + 2, face.pill));
    c.add(tapZone(scene, cell, face));
  });
}

/**
 * A tile's name over the scrim, broken only between words: the type steps
 * down until the longest word fits, and a third line is cut to two.
 */
function tileName(scene: Phaser.Scene, art: Rect, text: string): Phaser.GameObjects.Text {
  const base = theme.compactType.label;
  const room = art.width - 8;
  const name = scene.add.text(art.x + 5, art.y + art.height - 4, text, {
    fontFamily: theme.fonts.ui, fontSize: `${base}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    wordWrap: { width: room }, lineSpacing: -2,
  }).setOrigin(0, 1);
  const fits = (): boolean => name.width <= room && name.getWrappedText(text).length <= 2;
  for (let size = base; !fits() && size > base * 0.75;) name.setFontSize(--size);
  if (!fits()) {
    const lines = name.getWrappedText(text);
    name.setText(`${lines[0]}\n${lines.slice(1).join(' ')}`);
    name.setWordWrapWidth(null);
    ellipsizeLast(name, room);
  }
  return name;
}

function ellipsizeLast(text: Phaser.GameObjects.Text, room: number): void {
  const [first, second = ''] = text.text.split('\n');
  let tail = second;
  while (tail.length > 1 && text.setText(`${first}\n${tail}…`).width > room) tail = tail.slice(0, -1);
}

/** "Discard", "Bottom": what happens to a picked card. */
function pill(scene: Phaser.Scene, x: number, y: number, text: string, maxW = Infinity): Phaser.GameObjects.Container {
  const base = theme.compactType.body;
  const label = scene.add.text(0, 0, text, {
    fontFamily: theme.fonts.ui, fontSize: `${base}px`, fontStyle: theme.weight.w700, color: theme.colors.dangerArmed,
  }).setOrigin(0.5);
  // On a small tile the pill steps its type down rather than spill past the rim.
  for (let size = base; label.width + 24 > maxW && size > base * 0.7;) label.setFontSize(--size);
  const pad = Math.min(24, Math.max(10, maxW - label.width));
  const w = label.width + pad;
  const h = label.height + 8;
  const plate = scene.add.graphics()
    .fillStyle(colorInt(theme.colors.dangerBg), 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)
    .lineStyle(1.5, colorInt(theme.colors.dangerArmed), 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  return scene.add.container(x, y, [plate, label]);
}

/** A tap picks the card; a long press reads it. A Zone, never the scaled card, takes the input. */
function tapZone(scene: Phaser.Scene, cell: Rect, card: SheetCard): Phaser.GameObjects.Zone {
  const zone = scene.add.zone(cell.x + cell.width / 2, cell.y + cell.height / 2, cell.width, cell.height).setInteractive({ useHandCursor: true });
  zone.setName(`sheet:${card.card.id}`);
  bindTapButton(scene, zone, (p) => { if (!p.rightButtonReleased()) card.onTap(); },
    { card: card.card, variant: card.variant, landStyle: card.landStyle });
  return zone;
}
