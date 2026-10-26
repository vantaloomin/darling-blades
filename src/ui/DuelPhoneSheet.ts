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
import { renderManaText } from './ManaText';
import { bindMenuScroll } from './menuScroll';
import { ellipsizeText } from './textFit';
import { colorInt, theme } from './theme';
import { bakeUiIcon } from './uiIcons';

/**
 * The phone Duel's windows (mocks W-Foresee, W-Loot, W-HandSize, and the
 * zones W-GraveYours, W-GraveFoe, W-Severed, W-Reserves): a sheet
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

/** What a zone tile adds (W-GraveYours, W-Reserves): its place or count, what it can do, and the pick. */
export interface SheetTileMarks {
  /** The corner chip: "Top", "x2"; omitted for none. */
  badge?: string | null;
  /** Over the name: what the card can do from here, gold while it can ("Whispers", "Retell"). */
  chip?: { label: string; live: boolean } | null;
  /** The card the column is showing: a gold rim and a check. */
  selected?: boolean;
  /** Cost pips and the spell glyph at the top (W-Loot); a zone tile leaves them out. */
  costs?: boolean;
  /** The target picker's pick order ("1", "1, 2"), read by the layout probe. */
  pick?: string | null;
}

/** A card shown as its art (W-Loot, W-HandSize): cost, type, name. */
export type SheetArtTile = SheetCard & SheetTileMarks;

/** A card shown as its whole face, with its place above it (W-Foresee). */
export interface SheetFace extends SheetCard {
  label: string;
  /** The top card's place is gold; the rest are muted. */
  lead: boolean;
}

/** A card on the Mandate sheet (N-04): whose it is, its Mandate sentence, and whether that holds now. */
export interface SheetMandateRow {
  card: CardDef;
  /** The card's name up to its title ("Jia Nanfeng"). */
  name: string;
  /** "yours", "Hestia's". */
  whose: string;
  line: string;
  /** On or off (icon and words); null for a card with no condition. */
  active: boolean | null;
  onTap: () => void;
}

/** The Mandate sheet's body (N-04): the seal and its reminder, then the cards that care. */
export interface SheetMandate {
  reminder: string;
  rows: readonly SheetMandateRow[];
}

export interface DuelSheetSpec {
  title: string;
  subtitle: string;
  onClose?: () => void;
  tiles?: readonly SheetArtTile[];
  faces?: readonly SheetFace[];
  /** Shown in place of the cards when there are none. */
  empty?: string;
  mandate?: SheetMandate;
  /** Where a long grid of tiles was scrolled to, kept across a redraw (a pick redraws the sheet). */
  scroll?: { offset: number; onScroll: (offset: number) => void };
}

/** Art tiles are a little taller than wide, as in the mocks. */
const TILE_ASPECT = 1.22;
const PAD = 16;

export function drawDuelSheet(scene: Phaser.Scene, rect: Rect, spec: DuelSheetSpec): Phaser.GameObjects.Container {
  const type = theme.compactType;
  const c = scene.add.container(0, 0).setDepth(theme.depth.overlay);
  // An opaque plate: the probe reads what it covers as hidden, not as overlapping.
  c.setData('a11ySurface', rect);
  // The plate swallows taps that miss a card, so nothing under the sheet answers them.
  const plate = scene.add.rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height, 0, 0).setInteractive();
  const frame = scene.add.graphics()
    .fillStyle(theme.graphics.panelFill, 0.97).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel + 4)
    .lineStyle(1.5, theme.graphics.panelStroke, 1).strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel + 4);
  c.add([plate, frame]);
  const title = scene.add.text(rect.x + PAD, rect.y + 10, spec.title, {
    fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
  });
  // The title stops short of the close button; a long one steps down, then ends in an ellipsis.
  const titleRoom = rect.width - 2 * PAD - (spec.onClose ? 44 : 0);
  for (let size = type.h1; title.width > titleRoom && size > type.h1 * 0.75;) title.setFontSize(--size);
  ellipsizeText(title, titleRoom);
  const subStyle = {
    fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
    wordWrap: { width: rect.width - 2 * PAD, useAdvancedWrap: true },
  };
  const subY = title.y + title.height;
  let subH: number;
  if (spec.subtitle.includes('{')) {
    // A mana line ("Untapped mana · {R} 3/4") draws its symbols.
    const box = scene.add.container(0, 0);
    renderManaText(scene, box, rect.x + PAD, subY, spec.subtitle, subStyle).reflow();
    subH = spec.subtitle ? box.getBounds().height : 0;
    c.add([title, box]);
  } else {
    const subtitle = scene.add.text(rect.x + PAD, subY, spec.subtitle, subStyle);
    subH = spec.subtitle ? subtitle.height : 0;
    c.add([title, subtitle]);
  }
  if (spec.onClose) {
    const size = 36;
    const close = compactIconButton(scene, { x: rect.x + rect.width - size - 8, y: rect.y + 8, width: size, height: size }, 'close', spec.onClose);
    // Drawn at 36 px to sit beside the title; its tap area is the 44 px touch minimum.
    close.inputZone.setSize(44, 44);
    c.add(close.container);
  }
  const top = subY + subH + 10;
  const body: Rect = { x: rect.x + PAD, y: top, width: rect.width - 2 * PAD, height: rect.y + rect.height - PAD + 4 - top };
  if (spec.mandate) drawMandate(scene, c, body, spec.mandate);
  if (spec.faces) drawFaces(scene, c, body, spec.faces);
  if (spec.tiles?.length) drawTiles(scene, c, body, spec.tiles, spec.scroll);
  else if (spec.empty) {
    c.add(scene.add.text(body.x + body.width / 2, body.y + body.height / 3, spec.empty, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted,
    }).setOrigin(0.5));
  }
  return c;
}

function drawTiles(scene: Phaser.Scene, c: Phaser.GameObjects.Container, body: Rect, tiles: readonly SheetArtTile[], scroll?: DuelSheetSpec['scroll']): void {
  const type = theme.compactType;
  const grid = sheetGrid(body, tiles.length, TILE_ASPECT, 120, 48);
  // A grid taller than the sheet (a long graveyard) scrolls; its tiles sit in a list at local y.
  const list = scene.add.container(0, body.y);
  tiles.forEach((tile, i) => {
    const cell = { ...grid.cells[i], y: grid.cells[i].y - body.y };
    const rim = colorInt(medallionRim(tile.card.colors, tile.card.types));
    const picked = tile.pill !== null;
    const r = theme.radius.panel;
    list.add(scene.add.graphics().fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(cell.x, cell.y, cell.width, cell.height, r));
    const art: Rect = { x: cell.x + 3, y: cell.y + 3, width: cell.width - 6, height: cell.height - 6 };
    try {
      const image = addPortraitArt(scene, art.x + art.width / 2, art.y + art.height / 2, tile.card.id, (img) => coverFitImage(img, art, 0.1),
        'half', tile.landStyle);
      if (image) list.add(image);
    } catch {
      // No art: the tile reads as its name and cost.
    }
    list.add(compactScrim(scene, art, 0.5));
    // Cost at the top left, generic first; the type's glyph at the top right.
    const pip = Math.round(type.label * 1.3);
    const costs = tile.costs !== false;
    let px = art.x + 3;
    for (const spec of costs && tile.card.cost ? pipsFor(tile.card.cost) : []) {
      const key = spec.number !== undefined ? ensureNumeralPip(scene, spec.number) : spec.texture;
      if (!scene.textures.exists(key) || px + pip > art.x + art.width - pip - 4) break;
      list.add(scene.add.image(px + pip / 2, art.y + 3 + pip / 2, key).setDisplaySize(pip, pip));
      px += pip + 1;
    }
    // A land shows the mana it makes there instead (W-Reserves): a dual's two colours side by side.
    if (tile.card.types.includes('land')) {
      for (const color of tile.card.manaAbility ?? []) {
        const key = `pip-${color}`;
        if (!scene.textures.exists(key) || px + pip > art.x + art.width - pip - 4) break;
        list.add(scene.add.image(px + pip / 2, art.y + 3 + pip / 2, key).setDisplaySize(pip, pip));
        px += pip + 1;
      }
    }
    const glyph = !costs ? null : tile.card.types.includes('charm') ? 'bolt' : tile.card.types.includes('ritual') ? 'scroll' : null;
    if (glyph) {
      const gx = art.x + art.width - 3 - pip / 2;
      const gy = art.y + 3 + pip / 2;
      list.add(scene.add.graphics().fillStyle(theme.graphics.panelFill, 0.9).fillCircle(gx, gy, pip / 2 + 1)
        .lineStyle(1, colorInt(theme.colors.gold), 0.9).strokeCircle(gx, gy, pip / 2 + 1));
      list.add(scene.add.image(gx, gy, bakeUiIcon(scene, glyph)).setDisplaySize(pip * 0.7, pip * 0.7).setTint(colorInt(theme.colors.gold)));
    }
    const name = tileName(scene, art, tile.card.name);
    list.add(name);
    if (tile.chip) list.add(actionChip(scene, art.x + 5, name.y - name.height - 4, tile.chip.label, tile.chip.live, art.width - 10));
    if (tile.badge) list.add(cornerBadge(scene, art.x + art.width - 3, art.y + 3, tile.badge));
    if (picked) {
      list.add(scene.add.graphics().fillStyle(theme.graphics.dim, 0.62).fillRect(art.x, art.y, art.width, art.height));
      list.add(pill(scene, cell.x + cell.width / 2, cell.y + cell.height * 0.42, tile.pill!, cell.width - 8));
    }
    const selected = tile.selected === true;
    const stroke = picked ? colorInt(theme.colors.dangerArmed) : selected ? colorInt(theme.colors.gold) : rim;
    list.add(scene.add.graphics().lineStyle(selected ? 3.5 : 2.5, stroke, picked ? 0.7 : 1)
      .strokeRoundedRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2, r));
    if (selected) {
      const d = Math.round(Math.min(type.label * 1.9, art.width * 0.3));
      const cx = art.x + 4 + d / 2;
      const cy = art.y + 4 + d / 2;
      list.add(scene.add.graphics().fillStyle(colorInt(theme.colors.gold), 1).fillCircle(cx, cy, d / 2));
      list.add(scene.add.image(cx, cy, bakeUiIcon(scene, 'check')).setDisplaySize(d * 0.6, d * 0.6).setTint(colorInt(theme.colors.onGold)));
    }
    list.add(tapZone(scene, cell, tile, body).setData('a11yPickBadge', tile.pick ?? null));
  });
  c.add(list);
  const handle = bindMenuScroll(scene, list, body, grid.contentH, undefined, [], 0, undefined, scroll?.offset ?? 0);
  handle.onScroll = scroll?.onScroll ?? null;
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

/** The seal's star on a unit radius, as MandateSeal draws it. */
const SEAL_STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 0.66 : 0.27;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  return { x: r * Math.cos(a), y: 0.05 + r * Math.sin(a) };
});

function drawMandate(scene: Phaser.Scene, c: Phaser.GameObjects.Container, body: Rect, mandate: SheetMandate): void {
  const type = theme.compactType;
  // The seal, then the reminder beside it.
  const seal = Math.round(type.body * 2.6);
  const sx = body.x + seal / 2;
  const sy = body.y + seal / 2;
  const star = SEAL_STAR.map((p) => new Phaser.Math.Vector2(sx + p.x * seal / 2, sy + p.y * seal / 2));
  c.add(scene.add.graphics()
    .fillStyle(colorInt(theme.colors.gold), 1).fillCircle(sx, sy, seal / 2)
    .lineStyle(1, theme.graphics.panelFill, 0.8).strokeCircle(sx, sy, seal / 2 - 3)
    .fillStyle(theme.graphics.panelFill, 1).fillPoints(star, true, true));
  const tx = body.x + seal + 12;
  const reminder = scene.add.text(tx, body.y, mandate.reminder, {
    fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.heading,
    wordWrap: { width: body.x + body.width - tx, useAdvancedWrap: true }, lineSpacing: 2,
  });
  // Past three lines (a narrow phone at Largest text) the reminder steps down so the cards keep their room.
  if (reminder.height > type.body * 4.5) reminder.setFontSize(type.label);
  c.add(reminder);
  let y = body.y + Math.max(seal, reminder.height) + 10;
  const heading = scene.add.text(body.x, y, 'Cards that care', {
    fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
  });
  c.add(heading);
  y += heading.height + 4;
  c.add(scene.add.graphics().lineStyle(1, theme.graphics.panelStroke, 1).lineBetween(body.x, y, body.x + body.width, y));
  y += 8;
  const bottom = body.y + body.height;
  if (mandate.rows.length === 0) {
    c.add(scene.add.text(body.x, y, 'No card on the board reads the Mandate.', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted,
    }));
    return;
  }
  const nameStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading };
  const lineStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.body };
  const probe = scene.add.text(0, 0, 'Ag', nameStyle);
  const lineProbe = scene.add.text(0, 0, 'Ag', lineStyle);
  const rowH = Math.max(48, probe.height + lineProbe.height + 14);
  probe.destroy();
  lineProbe.destroy();
  for (const [i, row] of mandate.rows.entries()) {
    const left = mandate.rows.length - i;
    // A row that would not fit says how many more there are instead, and leaves that line room.
    const moreH = left > 1 ? type.label * 1.5 : 0;
    if (y + rowH + moreH > bottom) {
      c.add(scene.add.text(body.x, y, `+${left} more`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
      }));
      break;
    }
    const r = theme.radius.control;
    c.add(scene.add.graphics()
      .fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(body.x, y, body.width, rowH, r)
      .lineStyle(1.5, theme.graphics.panelStroke, 1).strokeRoundedRect(body.x, y, body.width, rowH, r));
    const thumb = rowH - 12;
    const art: Rect = { x: body.x + 8, y: y + 6, width: thumb, height: thumb };
    try {
      const image = addPortraitArt(scene, art.x + thumb / 2, art.y + thumb / 2, row.card.id, (img) => coverFitImage(img, art, 0.1), 'half');
      if (image) c.add(image);
    } catch {
      // No art: the row reads as its name.
    }
    c.add(scene.add.graphics().lineStyle(2, colorInt(medallionRim(row.card.colors, row.card.types)), 1)
      .strokeRoundedRect(art.x, art.y, thumb, thumb, 6));
    const tx = art.x + thumb + 10;
    const chevron = Math.round(type.body);
    const room = body.x + body.width - 12 - chevron - 8 - tx;
    const whose = scene.add.text(0, y + rowH / 2, ` · ${row.whose}`, { ...nameStyle, fontStyle: 'normal', color: theme.colors.muted }).setOrigin(0, 1);
    const name = scene.add.text(tx, y + rowH / 2, row.name, nameStyle).setOrigin(0, 1);
    ellipsizeText(name, Math.max(40, room - whose.width));
    whose.setX(name.x + name.width);
    c.add([name, whose]);
    // On or off as an icon and words, never colour alone.
    let lx = tx;
    const ly = y + rowH / 2 + 2;
    if (row.active !== null) {
      const d = Math.round(type.label);
      const cy = ly + d / 2 + 2;
      if (row.active) {
        c.add(scene.add.image(lx + d / 2, cy, bakeUiIcon(scene, 'check')).setDisplaySize(d, d).setTint(colorInt(theme.colors.success)));
      } else {
        c.add(scene.add.graphics().lineStyle(1.5, colorInt(theme.colors.muted), 1).strokeCircle(lx + d / 2, cy, d / 2 - 1));
      }
      lx += d + 6;
    }
    const prefix = row.active === null ? '' : row.active ? 'Active: ' : 'Not active: ';
    const line = scene.add.text(lx, ly, `${prefix}${row.line}`, {
      ...lineStyle, color: row.active ? theme.colors.success : row.active === false ? theme.colors.muted : theme.colors.body,
    });
    ellipsizeText(line, tx + room - lx);
    c.add(line);
    c.add(scene.add.image(body.x + body.width - 12 - chevron / 2, y + rowH / 2, bakeUiIcon(scene, 'chevron'))
      .setDisplaySize(chevron, chevron).setTint(colorInt(theme.colors.muted)));
    const zone = scene.add.zone(body.x + body.width / 2, y + rowH / 2, body.width, rowH).setInteractive({ useHandCursor: true });
    zone.setName(`mandate:${row.card.id}`);
    bindTapButton(scene, zone, (p) => { if (!p.rightButtonReleased()) row.onTap(); }, { card: row.card });
    c.add(zone);
    y += rowH + 8;
  }
}

/**
 * A tile's name over the scrim, broken only between words: the type steps
 * down until the longest word fits, and a third line is cut to two.
 */
export function tileName(scene: Phaser.Scene, art: Rect, text: string): Phaser.GameObjects.Text {
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
    name.setWordWrapWidth(null);
    // A word longer than the tile ("Spear-Thrower") never wraps: cut the first line too.
    name.setText(lines[0]);
    ellipsizeText(name, room);
    const rest = lines.slice(1).join(' ');
    if (rest) {
      name.setText(`${name.text}\n${rest}`);
      ellipsizeLast(name, room);
    }
  }
  return name;
}

/** "Whispers", "Retell": what a card can do from the zone, gold while it can, else muted. */
function actionChip(scene: Phaser.Scene, x: number, bottom: number, text: string, live: boolean, maxW: number): Phaser.GameObjects.Container {
  const base = theme.compactType.label;
  const label = scene.add.text(0, 0, text, {
    fontFamily: theme.fonts.ui, fontSize: `${base}px`, fontStyle: theme.weight.w700,
    color: live ? theme.colors.onGold : theme.colors.muted,
  }).setOrigin(0.5);
  for (let size = base; label.width + 20 > maxW && size > base * 0.75;) label.setFontSize(--size);
  const w = Math.min(maxW, label.width + 20);
  const h = label.height + 6;
  const plate = scene.add.graphics();
  if (live) plate.fillStyle(colorInt(theme.colors.btnPrimaryBg), 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  else {
    plate.fillStyle(theme.graphics.panelFill, 0.9).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)
      .lineStyle(1.5, colorInt(theme.colors.muted), 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  }
  return scene.add.container(x + w / 2, bottom - h / 2, [plate, label]);
}

/** The corner chip: a graveyard's "Top", a Warchest stack's "x2". */
function cornerBadge(scene: Phaser.Scene, right: number, top: number, text: string): Phaser.GameObjects.Container {
  const label = scene.add.text(0, 0, text, {
    fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.label}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
  }).setOrigin(0.5);
  const w = label.width + 12;
  const h = label.height + 4;
  const plate = scene.add.graphics()
    .fillStyle(theme.graphics.panelFill, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, 6)
    .lineStyle(1.5, colorInt(theme.colors.gold), 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  return scene.add.container(right - w / 2, top + h / 2, [plate, label]);
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
function tapZone(scene: Phaser.Scene, cell: Rect, card: SheetCard, viewport?: Rect): Phaser.GameObjects.Zone {
  const zone = scene.add.zone(cell.x + cell.width / 2, cell.y + cell.height / 2, cell.width, cell.height).setInteractive({ useHandCursor: true });
  zone.setName(`sheet:${card.card.id}`);
  if (viewport) zone.setData('sheetViewport', viewport);
  // A tile scrolled out of view keeps its zone; a tap outside the grid's viewport is not its.
  const inView = (p: Phaser.Input.Pointer): boolean => !viewport
    || (p.worldY >= viewport.y && p.worldY <= viewport.y + viewport.height);
  bindTapButton(scene, zone, (p) => { if (!p.rightButtonReleased() && inView(p)) card.onTap(); },
    { card: card.card, variant: card.variant, landStyle: card.landStyle });
  return zone;
}
