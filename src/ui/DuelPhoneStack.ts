import Phaser from 'phaser';
import type { CardDef, StackItem, TargetRef } from '../engine/types';
import { bindTapButton } from '../platform/gestures';
import { medallionRim } from './duelCompact';
import type { Rect } from './layout';
import { addPortraitArt } from './portraitArt';
import { coverFitImage } from './compactWidgets';
import { renderManaText } from './ManaText';
import { rulesText } from './rulesText';
import { ellipsizeText } from './textFit';
import { colorInt, theme } from './theme';

/**
 * The phone Duel's stack (mocks W-Stack, W-Stack130): over the foe's half,
 * the spells waiting to resolve, the next one first. Up to three stand side
 * by side, each with who cast it, its text and what it is aimed at; with
 * more, or at Largest text, the next one is large and the rest are a list
 * under it. A tap on a spell targets it when it can be targeted, else opens
 * it in full; a long press previews it.
 */

export interface PhoneStackOptions {
  rect: Rect;
  largeText: boolean;
  cardFor: (cardId: string) => CardDef;
  casterLabel: (controller: StackItem['controller']) => string;
  targetName: (ref: TargetRef) => string;
  isTargetable: (sid: number) => boolean;
  onTarget: (sid: number) => void;
  onInspect?: (card: CardDef) => void;
}

export interface PhoneStackDrawn {
  zones: Phaser.GameObjects.Zone[];
  centers: Map<number, { x: number; y: number }>;
}

/** "Next", "Then", "Last": a spell's place in the order it resolves. */
export function stackPlace(index: number, count: number): string {
  if (index === 0) return 'Next';
  return index === count - 1 ? 'Last' : 'Then';
}

const PAD = 8;
const GAP = 8;

export function drawPhoneStack(scene: Phaser.Scene, root: Phaser.GameObjects.Container, items: readonly StackItem[], opts: PhoneStackOptions): PhoneStackDrawn {
  const type = theme.compactType;
  const R = opts.rect;
  const zones: Phaser.GameObjects.Zone[] = [];
  const centers = new Map<number, { x: number; y: number }>();
  // The next spell first; the engine's stack is bottom-first.
  const order = [...items].reverse();
  // The strip covers the foe's half so the spells read on a plain panel.
  root.add(scene.add.graphics()
    .fillStyle(theme.graphics.panelFill, 0.97).fillRoundedRect(R.x, R.y, R.width, R.height, theme.radius.panel + 2)
    .lineStyle(1, theme.graphics.panelStroke, 0.9).strokeRoundedRect(R.x, R.y, R.width, R.height, theme.radius.panel + 2));
  const label = (item: StackItem, i: number): string => `${stackPlace(i, order.length)} · ${opts.casterLabel(item.controller)}`;
  const target = (item: StackItem): string | null => item.targets.length ? `at ${item.targets.map(opts.targetName).join(', ')}` : null;
  const hit = (rect: Rect, item: StackItem, card: CardDef): void => {
    const zone = scene.add.zone(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height).setInteractive({ useHandCursor: true });
    zone.setName(`stack:${item.sid}`);
    bindTapButton(scene, zone, (p) => {
      if (p.rightButtonReleased()) return;
      if (opts.isTargetable(item.sid)) opts.onTarget(item.sid);
      else opts.onInspect?.(card);
    }, { card });
    root.add(zone);
    zones.push(zone);
    centers.set(item.sid, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  };

  const across = !opts.largeText && order.length <= 3;
  if (across) {
    const labelH = Math.round(type.label * 1.5);
    const n = order.length;
    const w = (R.width - 2 * PAD - (n - 1) * GAP) / n;
    order.forEach((item, i) => {
      const card = opts.cardFor(item.cardId);
      const x = R.x + PAD + i * (w + GAP);
      const head = scene.add.text(x + 2, R.y + PAD, label(item, i), {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700,
        color: i === 0 ? theme.colors.gold : theme.colors.body,
      });
      // On a narrow phone the label steps down, then ends in an ellipsis, inside its own column.
      for (let size = type.label; head.width > w - 4 && size > type.label * 0.8;) head.setFontSize(--size);
      ellipsizeText(head, w - 4);
      root.add(head);
      const box: Rect = { x, y: R.y + PAD + labelH, width: w, height: R.height - 2 * PAD - labelH };
      drawSpell(scene, root, box, card, target(item), i === 0, opts.isTargetable(item.sid), w >= 170);
      hit(box, item, card);
    });
    return { zones, centers };
  }

  // The next spell large across the strip, the rest listed under it (W-Stack130).
  const [next, ...rest] = order;
  const nextCard = opts.cardFor(next.cardId);
  const lineH = Math.round(type.body * 1.35);
  // The next spell keeps room for its caption, name and target; the list takes what is left.
  const bigMin = 16 + Math.round(type.body * 1.35) * 2 + Math.round(type.label * 1.4) + 6;
  const room = R.height - 2 * PAD - bigMin - GAP - 2 * PAD;
  const listShown = Math.max(1, Math.min(rest.length, 3, Math.floor(room / lineH)));
  const listH = rest.length ? listShown * lineH + 2 * PAD : 0;
  const big: Rect = { x: R.x + PAD, y: R.y + PAD, width: R.width - 2 * PAD, height: R.height - 2 * PAD - (listH ? listH + GAP : 0) };
  drawSpell(scene, root, big, nextCard, target(next), true, opts.isTargetable(next.sid), true, label(next, 0));
  hit(big, next, nextCard);
  if (!rest.length) return { zones, centers };
  const list: Rect = { x: big.x, y: big.y + big.height + GAP, width: big.width, height: listH };
  root.add(scene.add.graphics()
    .lineStyle(1, theme.graphics.panelStroke, 1).strokeRoundedRect(list.x, list.y, list.width, list.height, theme.radius.panel));
  rest.slice(0, listShown).forEach((item, k) => {
    const i = k + 1;
    const card = opts.cardFor(item.cardId);
    const y = list.y + PAD + k * lineH;
    const extra = k === listShown - 1 ? rest.length - listShown : 0;
    const more = extra > 0 ? scene.add.text(list.x + list.width - 12, y, `+${extra} more`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    }).setOrigin(1, 0) : null;
    const head = scene.add.text(list.x + 12, y, `${label(item, i)}: `, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    const name = scene.add.text(head.x + head.width, y, card.name, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body,
    });
    ellipsizeText(name, (more ? more.x - more.width - 10 : list.x + list.width - 12) - name.x);
    if (more) root.add(more);
    root.add([head, name]);
    hit({ x: list.x, y, width: list.width, height: lineH }, item, card);
  });
  return { zones, centers };
}

/** One spell's panel: its art (when there is room), name, text, and target at the foot. */
function drawSpell(scene: Phaser.Scene, root: Phaser.GameObjects.Container, box: Rect, card: CardDef, aim: string | null,
  lead: boolean, targetable: boolean, thumb: boolean, caption?: string): void {
  const type = theme.compactType;
  const rim = targetable ? colorInt(theme.colors.gold) : colorInt(medallionRim(card.colors, card.types));
  root.add(scene.add.graphics()
    .fillStyle(targetable ? theme.graphics.rowFillActive : theme.graphics.panelFill, 1)
    .fillRoundedRect(box.x, box.y, box.width, box.height, theme.radius.panel)
    .lineStyle(lead || targetable ? 2.5 : 1.5, rim, lead || targetable ? 1 : 0.8)
    .strokeRoundedRect(box.x, box.y, box.width, box.height, theme.radius.panel));
  const inner = { x: box.x + 10, y: box.y + 8, width: box.width - 20 };
  let tx = inner.x;
  const art = Math.round(type.body * 2.4);
  if (thumb) {
    const rect = { x: inner.x, y: inner.y, width: art, height: art };
    try {
      const image = addPortraitArt(scene, rect.x + art / 2, rect.y + art / 2, card.id, (img) => coverFitImage(img, rect, 0.1), 'half');
      if (image) root.add(image);
    } catch {
      // No art: the panel reads as its name and text.
    }
    root.add(scene.add.graphics().lineStyle(1.5, rim, 0.9).strokeRoundedRect(rect.x, rect.y, art, art, 4));
    tx = inner.x + art + 10;
  }
  let y = inner.y;
  if (caption) {
    const cap = scene.add.text(tx, y, caption, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    });
    root.add(cap);
    y += cap.height;
  }
  const name = scene.add.text(tx, y, card.name, {
    fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    wordWrap: { width: inner.x + inner.width - tx }, lineSpacing: -2,
  });
  root.add(name);
  y = Math.max(y + name.height, thumb ? inner.y + art : 0) + 4;
  const foot = aim ? scene.add.text(inner.x, 0, aim, {
    fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.gold,
    wordWrap: { width: inner.width },
  }) : null;
  if (foot) {
    // At the foot of the panel, or straight under the name when the panel is short.
    foot.setY(Math.max(y, box.y + box.height - 8 - foot.height));
    ellipsizeText(foot, inner.width);
    root.add(foot);
  }
  const bottom = foot ? foot.y - 2 : box.y + box.height - 8;
  if (targetable) {
    const hint = scene.add.text(box.x + box.width - 10, box.y + 8, 'Tap to target', {
      fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    }).setOrigin(1, 0);
    root.add(hint);
  }
  const style = { fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.body, lineSpacing: 1 };
  const raw = rulesText(card).replace(/\n+/g, ' ');
  // Measure on the raw text (a "{R}" is about a pip wide), cut to the lines
  // that fit above the target, then draw it with real mana symbols.
  const probe = scene.add.text(0, 0, raw, { ...style, wordWrap: { width: inner.width } });
  const lines = probe.getWrappedText(raw);
  const lineH = probe.height / Math.max(1, lines.length);
  probe.destroy();
  const keep = Math.max(0, Math.floor((bottom - y) / lineH));
  if (keep === 0) return;
  const shown = keep < lines.length ? `${lines.slice(0, keep).join(' ').replace(/\s+\S*$/, '')}…` : raw;
  renderManaText(scene, root, inner.x, y, shown, { ...style, wordWrap: { width: inner.width, useAdvancedWrap: true } }).reflow();
}
