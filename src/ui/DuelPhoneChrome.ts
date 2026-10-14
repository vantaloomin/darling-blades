import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import { holdArt } from '../art/artWatch';
import type { CardDef, ManaCost } from '../engine/types';
import { bindTapButton } from '../platform/gestures';
import { COMPACT } from './compactLayout';
import { compactButton, compactIconButton, type CompactButton } from './compactWidgets';
import {
  blockCounts,
  blockManaY,
  handList,
  lifePlate,
  type DuelPhoneLayout,
  type HandRowLook,
  type ZoneCount,
} from './duelCompact';
import { CardView } from './CardView';
import { renderManaText } from './ManaText';
import { ellipsizeText } from './textFit';
import { ensureNumeralPip, pipsFor } from './ManaSymbols';
import { colorInt, theme } from './theme';
import { bakeUiIcon, type UiIconName } from './uiIcons';

/**
 * The phone Duel's own chrome (docs/plan-mobile-overhaul.md C4; mocks T-03a,
 * T-03b, T-10, T-13a): the board halves and the turn line, the resource
 * blocks with their zone counts, the History and Menu buttons, the life
 * plates, the hand list and the foot of the command column. It draws what
 * DuelScene tells it and reports taps back; the game, the medallions and the
 * portraits stay the scene's. Geometry comes from src/ui/duelCompact.ts.
 */

export interface PhoneManaSlot {
  /** The pip texture (a colour, a split pip, or colourless). */
  texture: string;
  untapped: number;
  total: number;
}

export interface PhoneHandRow {
  card: CardDef;
  look: HandRowLook;
  onTap: () => void;
  /** Right-click: the card read in full (a long press opens the sticky preview). */
  onInspect: () => void;
}

export interface PhonePinnedRow {
  title: string;
  detail: string;
  icon: UiIconName;
  onTap: () => void;
}

export interface PhoneFootButton {
  label: string;
  onTap: () => void;
  /** A destructive confirm (lethal no-blocks, the land-drop guard). */
  danger?: boolean;
  /** Drawn faded and deaf to taps (Cast before a target is picked). */
  enabled?: boolean;
  /** A plain button in the primary's slot (Close). */
  ghost?: boolean;
}

export interface PhoneFoot {
  /** The narrow left button: End turn, or Cancel and Clear in a prompt. */
  left: PhoneFootButton | null;
  /** The primary action, or null for none. */
  primary: PhoneFootButton | null;
  /** In place of both buttons: a waiting line (the foe's turn, T-10). */
  status?: string | null;
  /** The primary alone, across the whole foot (a window's Confirm, W-Foresee). */
  wide?: boolean;
}

/** A card opened from the hand (T-04, T-13b): the column asks Cast or Empower. */
export interface PhoneFocusPanel {
  kind: 'focus';
  title: string;
  /** The Empower rider in its box, with mana symbols ("Empower {1}{R}: ..."). */
  rider: string | null;
  /** Your untapped mana by colour. */
  untapped: readonly PhoneManaSlot[];
  /** "Cast leaves 4 · Empower leaves 2", or why it cannot be cast. */
  leaves: string;
  leavesTone?: 'muted' | 'danger';
  /** The wide Empower button above the foot, with its whole cost. */
  empower: { cost: ManaCost; onTap: () => void } | null;
}

/** A spell waiting on its target (T-06): the spell, the question, and what is picked. */
export interface PhoneTargetPanel {
  kind: 'target';
  card: CardDef | null;
  cost: ManaCost | null;
  /** "Empowered" beside the type, when it is. */
  chip: string | null;
  title: string;
  text: string;
  picks: readonly { card: CardDef | null; portrait: string | null; name: string; detail: string }[];
}

/** A card read in full (T-05a, T-05b): its live numbers and the keyword guide. */
export interface PhoneInspectPanel {
  kind: 'inspect';
  stats: { now: string; printed: string | null } | null;
  lines: readonly string[];
  guide: readonly { name: string; reminder: string }[];
}

/** One creature in a combat list: an attacker you declared, or one attacking you. */
export interface PhoneCombatRow {
  card: CardDef;
  /** "7/3 · Twin Blades, Rage". */
  detail: string;
  /** At the right: × to take it back, a lock (Rage), its blockers, or "Takes 4". */
  right: { kind: 'remove'; onTap: () => void } | { kind: 'lock' } | { kind: 'blockers'; cards: readonly CardDef[] } | { kind: 'chip'; text: string } | null;
  /** Lit while the picked blocker can block it; dimmed while it cannot. */
  look?: 'lit' | 'dim';
  onTap?: () => void;
}

/** Declaring attackers (T-07) or blockers (T-08) in the column. */
export interface PhoneCombatPanel {
  kind: 'combat';
  /** The gold caption: "YOUR COMBAT", "HESTIA ATTACKS WITH 4". */
  heading: string;
  /** The foe's face beside the caption while she attacks. */
  face: CardDef | null;
  title: string;
  forecast: { text: string; danger: boolean } | null;
  rows: readonly PhoneCombatRow[];
}

/** The combat damage recap (T-09): each step's blows, then the life it cost. */
export interface PhoneRecapPanel {
  kind: 'recap';
  sections: readonly { title: string | null; lines: readonly { cards: readonly CardDef[]; text: string; deaths: string | null }[] }[];
  life: readonly { label: string; from: number; to: number }[];
  onDismiss: () => void;
}

/** A window's summary beside its sheet (W-Foresee, W-Loot, W-HandSize): what it is for and what is picked. */
export interface PhoneSummaryPanel {
  kind: 'summary';
  /** The card that opened the window, its type line, and its cost. */
  source: { card: CardDef; detail: string; cost: ManaCost | null } | null;
  /** The source's rules, with mana symbols. */
  text: string | null;
  heading: string | null;
  sub: string | null;
  /** "1 remaining". */
  count: string | null;
  /** "Stays on top" (numbered), "Goes to the bottom". */
  sections: readonly { title: string; numbered: boolean; lines: readonly string[] }[];
  /** The cards picked so far, each with what happens to it. */
  picks: readonly { card: CardDef; detail: string }[];
  /** A keyword the last pick brings along ("Whispers: ..."). */
  note: { name: string; reminder: string } | null;
}

export type PhonePanel = PhoneFocusPanel | PhoneTargetPanel | PhoneInspectPanel | PhoneCombatPanel | PhoneRecapPanel | PhoneSummaryPanel;

export interface DuelPhoneCallbacks {
  onHistory: () => void;
  onMenu: () => void;
  onBlock: (side: 'opp' | 'mine') => void;
}

type Side = 'opp' | 'mine';

/** Zone-count icon size in a block. */
const COUNT_ICON = 12;
const BLOCK_ICON: Record<ZoneCount, UiIconName> = { hand: 'cards', deck: 'deck', grave: 'grave' };
const PHASE_DOTS = 5;
const DOT_R = 4;
const DOT_GAP = 12;

export class DuelPhoneChrome {
  private readonly scene: Phaser.Scene;
  private readonly L: DuelPhoneLayout;
  private readonly cb: DuelPhoneCallbacks;
  private readonly type = theme.compactType;
  private readonly mana: Record<Side, Phaser.GameObjects.GameObject[]> = { opp: [], mine: [] };
  private readonly counts: Record<Side, Phaser.GameObjects.Text[]> = { opp: [], mine: [] };
  private readonly blockZones: Phaser.GameObjects.Zone[] = [];
  private readonly lineText: Phaser.GameObjects.Text;
  private readonly lineArt: Phaser.GameObjects.Graphics;
  private handObjects: Phaser.GameObjects.GameObject[] = [];
  private footLeft: PhoneFootButton | null = null;
  private footPrimary: PhoneFootButton | null = null;
  private stage: Phaser.GameObjects.Container | null = null;
  private handZones: Phaser.GameObjects.Zone[] = [];
  private readonly endTurnButton: CompactButton;
  private readonly primaryButton: CompactButton;
  private readonly wideButton: CompactButton;
  private readonly status: Phaser.GameObjects.Container;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly banner: Phaser.GameObjects.Container;
  private readonly bannerTag: Phaser.GameObjects.Text;
  private readonly bannerText: Phaser.GameObjects.Text;
  readonly history: CompactButton;
  readonly menu: CompactButton;

  constructor(scene: Phaser.Scene, L: DuelPhoneLayout, cb: DuelPhoneCallbacks) {
    this.scene = scene;
    this.L = L;
    this.cb = cb;
    const g = scene.add.graphics().setDepth(1);
    const panel = (r: { x: number; y: number; width: number; height: number }, alpha = 0.55): void => {
      g.fillStyle(theme.graphics.panelFill, alpha).fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel + 2);
      g.lineStyle(1, theme.graphics.panelStroke, 0.9).strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel + 2);
    };
    panel(L.oppHalf);
    panel(L.myHalf);
    panel(L.oppBlock, 0.9);
    panel(L.myBlock, 0.9);

    // The blocks are one framed button each (M15).
    for (const [side, block] of [['opp', L.oppBlock], ['mine', L.myBlock]] as const) {
      const zone = scene.add.zone(block.x + block.width / 2, block.y + block.height / 2, block.width, block.height)
        .setInteractive({ useHandCursor: true }).setDepth(4);
      bindTapButton(scene, zone, () => cb.onBlock(side));
      this.blockZones.push(zone);
      this.counts[side] = blockCounts(block, side).map((spot) => {
        const icon = scene.add.image(0, spot.y, bakeUiIcon(scene, BLOCK_ICON[spot.kind])).setDisplaySize(COUNT_ICON, COUNT_ICON)
          .setTint(colorInt(theme.colors.muted)).setDepth(3);
        const text = scene.add.text(0, spot.y, '0', {
          fontFamily: theme.fonts.ui, fontSize: `${this.type.caption}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
        }).setOrigin(0, 0.5).setDepth(3);
        text.setData('icon', icon);
        return text;
      });
    }

    // History and Menu.
    this.history = compactIconButton(scene, L.history, 'history', () => cb.onHistory());
    this.menu = compactIconButton(scene, L.menu, 'gear', () => cb.onMenu());
    this.history.container.setDepth(4);
    this.menu.container.setDepth(4);

    // Life plates sit on the portraits' lower edge; the scene puts its life Texts on them.
    const plates = scene.add.graphics().setDepth(theme.depth.hud);
    for (const portrait of [L.oppPortrait, L.myPortrait]) {
      const p = lifePlate(portrait);
      plates.fillStyle(theme.graphics.panelFill, 0.95).fillRoundedRect(p.x, p.y, p.width, p.height, p.height / 2);
      plates.lineStyle(1.5, colorInt(theme.colors.goldHover), 0.55).strokeRoundedRect(p.x, p.y, p.width, p.height, p.height / 2);
    }

    // The turn line.
    this.lineArt = scene.add.graphics().setDepth(2);
    this.lineText = scene.add.text(0, L.line.y + L.line.height / 2, '', {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.gold,
    }).setOrigin(0, 0.5).setDepth(2);

    // The foot.
    this.endTurnButton = compactButton(scene, L.endTurn, 'End turn', { onTap: () => this.footLeft?.onTap(), fontSize: this.type.body });
    this.primaryButton = compactButton(scene, L.primary, '', { variant: 'primary', onTap: () => this.footPrimary?.onTap(), fontSize: this.type.h2 });
    this.wideButton = compactButton(scene, L.foot, '', { variant: 'primary', onTap: () => this.footPrimary?.onTap(), fontSize: this.type.h2 });
    this.endTurnButton.container.setDepth(theme.depth.hud);
    this.primaryButton.container.setDepth(theme.depth.hud);
    this.wideButton.container.setDepth(theme.depth.hud).setVisible(false);
    const foot = L.foot;
    const statusPlate = scene.add.graphics();
    statusPlate.lineStyle(1, colorInt(theme.colors.muted), 0.7);
    dashedRoundRect(statusPlate, 0, 0, foot.width, foot.height, theme.radius.control);
    this.statusText = scene.add.text(foot.width / 2 + 14, foot.height / 2, '', {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
    }).setOrigin(0.5);
    const dots = [0, 1, 2].map((i) => scene.add.circle(0, foot.height / 2, 3, colorInt(theme.colors.gold), i === 2 ? 0.45 : 1));
    this.status = scene.add.container(foot.x, foot.y, [statusPlate, ...dots, this.statusText]).setDepth(theme.depth.hud).setVisible(false);
    this.status.setData('dots', dots);

    // The latest move, over the foe's strip while it is her turn (T-10).
    const bannerRect = { x: L.oppHalf.x, y: L.oppHalf.y, width: L.oppHalf.width, height: 42 };
    const bannerPlate = scene.add.graphics()
      .fillStyle(theme.graphics.panelFill, 0.96).fillRoundedRect(0, 0, bannerRect.width, bannerRect.height, theme.radius.panel + 2)
      .lineStyle(1.5, colorInt(theme.colors.gold), 0.9).strokeRoundedRect(0, 0, bannerRect.width, bannerRect.height, theme.radius.panel + 2);
    this.bannerTag = scene.add.text(12, 5, '', {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    }).setLetterSpacing(1);
    this.bannerText = scene.add.text(12, 21, '', {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, color: theme.colors.heading,
    });
    this.banner = scene.add.container(bannerRect.x, bannerRect.y, [bannerPlate, this.bannerTag, this.bannerText])
      .setDepth(theme.depth.hud).setVisible(false);
  }

  /** Everything here that takes taps, for an overlay's guard. */
  inputTargets(): Phaser.GameObjects.GameObject[] {
    return [
      ...this.blockZones, ...this.handZones, this.history.inputZone, this.menu.inputZone,
      this.endTurnButton.inputZone, this.primaryButton.inputZone, this.wideButton.inputZone,
    ];
  }

  /** A block's mana line: up to two pips with their untapped/total counts, a third and more folding into "+N" (M16). */
  setMana(side: Side, slots: readonly PhoneManaSlot[]): void {
    for (const o of this.mana[side]) o.destroy();
    this.mana[side] = [];
    const block = side === 'opp' ? this.L.oppBlock : this.L.myBlock;
    const y = blockManaY(block, side);
    // M16: three or more colour sets fold into a "+N" pip after the first.
    const folded = slots.length > 2;
    const shown = folded ? slots.slice(0, 1) : slots.length ? slots : [{ texture: 'pip-C', untapped: 0, total: 0 }];
    const pip = 18;
    const pitch = (block.width - 12) / 2;
    let x = block.x + 6;
    let textRight = x;
    for (const slot of shown) {
      const alpha = slot.untapped > 0 ? 1 : 0.45;
      this.mana[side].push(this.scene.add.image(x + pip / 2, y, slot.texture).setDisplaySize(pip, pip).setAlpha(alpha).setDepth(3));
      this.mana[side].push(this.scene.add.text(x + pip + 2, y, `${slot.untapped}/${slot.total}`, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.caption}px`, fontStyle: theme.weight.w600,
        color: slot.untapped > 0 ? theme.colors.body : theme.colors.muted,
      }).setOrigin(0, 0.5).setDepth(3));
      textRight = (this.mana[side][this.mana[side].length - 1] as Phaser.GameObjects.Text).getRightCenter().x ?? x;
      x += pitch;
    }
    if (folded) {
      const more = slots.length - 1;
      const label = this.scene.add.text(0, y, `+${more}`, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.body,
      }).setOrigin(0.5).setDepth(3);
      const radius = Math.max(pip / 2, label.width / 2 + 3);
      const cx = Math.max(x, textRight + 4) + radius;
      this.mana[side].push(this.scene.add.circle(cx, y, radius, colorInt(theme.colors.rowFillActive), 1)
        .setStrokeStyle(1, colorInt(theme.colors.muted), 0.9).setDepth(3));
      this.mana[side].push(label.setX(cx).setDepth(4));
    }
  }

  /** A block's zone counts: hand, library, graveyard. */
  setCounts(side: Side, counts: Record<ZoneCount, number>): void {
    const kinds: ZoneCount[] = ['hand', 'deck', 'grave'];
    const texts = this.counts[side];
    texts.forEach((text, i) => text.setText(`${counts[kinds[i]]}`));
    // Spread the three groups by their real widths, so large text never runs one into the next.
    const block = side === 'opp' ? this.L.oppBlock : this.L.myBlock;
    const widths = texts.map((text) => COUNT_ICON + 2 + text.width);
    const gap = Math.max(2, (block.width - 8 - widths.reduce((a, b) => a + b, 0)) / 2);
    let x = block.x + 4;
    texts.forEach((text, i) => {
      (text.getData('icon') as Phaser.GameObjects.Image).setX(x + COUNT_ICON / 2);
      text.setX(x + COUNT_ICON + 2);
      x += widths[i] + gap;
    });
  }

  /** "Turn 8 · Your Morning" with the five phase dots, hairlines either side (T-03a). */
  setTurnLine(label: string, phase: number | null, yours: boolean): void {
    const L = this.L;
    const cy = L.line.y + L.line.height / 2;
    this.lineText.setText(label).setColor(yours ? theme.colors.gold : theme.colors.body);
    const dotsW = PHASE_DOTS * DOT_R * 2 + (PHASE_DOTS - 1) * (DOT_GAP - DOT_R * 2);
    const groupW = this.lineText.width + (phase === null ? 0 : 12 + dotsW);
    const x0 = L.line.x + (L.line.width - groupW) / 2;
    this.lineText.setX(x0);
    const g = this.lineArt.clear();
    const accent = colorInt(yours ? theme.colors.gold : theme.colors.muted);
    g.lineStyle(1, accent, 0.45);
    g.lineBetween(L.line.x + 12, cy, x0 - 10, cy);
    g.lineBetween(x0 + groupW + 10, cy, L.line.x + L.line.width - 12, cy);
    if (phase === null) return;
    const dx0 = x0 + this.lineText.width + 12 + DOT_R;
    for (let i = 0; i < PHASE_DOTS; i++) {
      g.fillStyle(i === phase ? accent : colorInt(theme.colors.muted), i === phase ? 1 : 0.6);
      g.fillCircle(dx0 + i * DOT_GAP, cy, DOT_R);
    }
  }

  /**
   * The command column's hand list, rebuilt on each sync (a few rows).
   * Returns each row's thumbnail centre, in `rows` order; a row folded into
   * "N more in hand" reports that row's centre.
   */
  setHand(rows: readonly PhoneHandRow[], pinned: readonly PhonePinnedRow[], caption: string | null = null): { x: number; y: number }[] {
    this.clearColumn();
    // A response window names itself over the hand ("Your response", W-Stack).
    const head = caption ? this.caption(this.L.hand.x + 2, this.L.hand.y, caption) : null;
    const list = handList(this.L, rows.length, pinned.length, head ? Math.ceil(head.height) + 6 : 0);
    pinned.forEach((row, i) => this.drawPinnedRow(list.pinned[i], row));
    const visible = list.more > 0 ? list.rows.length - 1 : list.rows.length;
    for (let i = 0; i < visible; i++) this.drawHandRow(list.rows[i].visual, list.rows[i].hit, rows[i]);
    const thumbX = this.L.hand.x + 6 + Math.min(32, this.L.handRowH - 8) / 2;
    const spot = (r: { y: number; height: number }) => ({ x: thumbX, y: r.y + r.height / 2 });
    if (list.more > 0) {
      const last = list.rows[list.rows.length - 1];
      this.drawMoreRow(last.visual, `${list.more} more in hand`);
    }
    return rows.map((_, i) => {
      const row = list.rows[Math.min(i, list.rows.length - 1)];
      return row ? spot(row.visual) : { x: thumbX, y: this.L.hand.y + this.L.handRowH / 2 };
    });
  }

  /**
   * The move history in the command column, newest first (W-History): the
   * desktop's lines with card names in gold; a line naming a card opens it.
   * Rows that do not fit are left off; the last shown row is the cue.
   */
  setHistory(lines: readonly { text: string; cardId?: string }[], onCard: (cardId: string) => void): void {
    this.clearColumn();
    const scene = this.scene;
    const pane = this.L.hand;
    const title = scene.add.text(pane.x + 4, pane.y + 2, 'History', {
      fontFamily: theme.fonts.display, fontSize: `${this.type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    }).setDepth(theme.depth.hand);
    this.handObjects.push(title);
    let y = title.y + title.height + 8;
    if (lines.length === 0) {
      this.handObjects.push(scene.add.text(pane.x + 4, y, 'Nothing has happened yet.', {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, color: theme.colors.muted,
      }).setDepth(theme.depth.hand));
      return;
    }
    for (const line of lines) {
      if (y >= pane.y + pane.height - 12) break;
      const text = scene.add.text(pane.x + 4, y, line.text.replace(/\[([^\]]+)\]/g, '$1'), {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, lineSpacing: 2,
        color: line.cardId ? theme.colors.heading : theme.colors.body,
        wordWrap: { width: pane.width - 8, useAdvancedWrap: true },
      }).setDepth(theme.depth.hand);
      this.handObjects.push(text);
      if (line.cardId) {
        const cardId = line.cardId;
        this.rowZone({ x: pane.x, y: y - 4, width: pane.width, height: Math.max(COMPACT.touch, text.height + 8) }, () => onCard(cardId));
      }
      y += Math.max(text.height + 10, line.cardId ? COMPACT.touch : 0);
      const rule = scene.add.graphics().setDepth(theme.depth.hand);
      rule.lineStyle(1, theme.graphics.panelStroke, 0.6).lineBetween(pane.x + 4, y - 5, pane.x + pane.width - 4, y - 5);
      this.handObjects.push(rule);
    }
  }

  private clearColumn(): void {
    for (const o of this.handObjects) o.destroy();
    this.handObjects = [];
    this.handZones = [];
  }

  /** The foot: a left button and the primary, or a waiting status in their place. */
  setFoot(foot: PhoneFoot): void {
    const status = foot.status ?? null;
    this.status.setVisible(status !== null);
    if (status !== null) {
      this.statusText.setText(status);
      const dots = this.status.getData('dots') as Phaser.GameObjects.Arc[];
      const left = this.statusText.x - this.statusText.width / 2 - 14 - 2 * 9;
      dots.forEach((d, i) => d.setX(left + i * 9));
    }
    const wide = status === null && foot.wide === true;
    this.footLeft = status === null && !wide ? foot.left : null;
    this.footPrimary = status === null ? foot.primary : null;
    const show = (button: CompactButton, spec: PhoneFootButton | null, variant: 'ghost' | 'primary'): void => {
      // A hidden button takes no taps (Phaser skips what does not render); its
      // input stays enabled so it answers again once shown.
      button.container.setVisible(spec !== null);
      if (spec === null) return;
      if (button.label.text !== spec.label) {
        button.setLabel(spec.label);
        // A long label ("Confirm blocks (3)") steps its type down to fit the button.
        const base = Number(button.label.getData('baseFontSize') ?? parseFloat(String(button.label.style.fontSize)));
        button.label.setData('baseFontSize', base);
        const room = (button === this.primaryButton ? this.L.primary : button === this.wideButton ? this.L.foot : this.L.endTurn).width - 16;
        let size = base;
        button.label.setFontSize(size);
        while (button.label.width > room && size > base * 0.7) button.label.setFontSize(--size);
        button.setLabel(spec.label); // re-centres at the new width
      }
      button.setVariant(spec.danger ? 'danger' : spec.ghost ? 'ghost' : variant);
      button.setEnabled(spec.enabled !== false);
    };
    show(this.endTurnButton, this.footLeft, 'ghost');
    show(this.primaryButton, wide ? null : this.footPrimary, 'primary');
    show(this.wideButton, wide ? this.footPrimary : null, 'primary');
  }

  /**
   * A card opened over the board (T-04, T-05): the centre dims and the card
   * stands in it at full height. A tap on the dim calls `onDismiss`. Null
   * takes it down.
   */
  setStage(card: CardView | null, onDismiss: () => void = () => {}): void {
    this.stage?.destroy();
    this.stage = null;
    if (!card) return;
    const L = this.L;
    const dim = this.scene.add.rectangle(L.main.x + L.main.width / 2, L.main.y + L.main.height / 2, L.main.width + 8, L.main.height + 16,
      theme.graphics.dim, 0.78).setInteractive();
    bindTapButton(this.scene, dim, (p) => { if (!p.rightButtonReleased()) onDismiss(); });
    this.stage = this.scene.add.container(0, 0, [dim, card]).setDepth(theme.depth.overlay);
  }

  /** The foot's buttons, for a guard that leaves them live (Close under an inspect). */
  footTargets(): Phaser.GameObjects.GameObject[] {
    return [this.endTurnButton.inputZone, this.primaryButton.inputZone, this.wideButton.inputZone];
  }

  /** The stage's tap target, for a guard that leaves it live. */
  stageTargets(): Phaser.GameObjects.GameObject[] {
    return this.stage ? [this.stage.list[0] as Phaser.GameObjects.GameObject] : [];
  }

  /** The command column given over to a prompt in place of the hand. */
  setPanel(panel: PhonePanel): void {
    this.clearColumn();
    if (panel.kind === 'focus') this.drawFocusPanel(panel);
    else if (panel.kind === 'target') this.drawTargetPanel(panel);
    else if (panel.kind === 'combat') this.drawCombatPanel(panel);
    else if (panel.kind === 'recap') this.drawRecapPanel(panel);
    else if (panel.kind === 'summary') this.drawSummaryPanel(panel);
    else this.drawInspectPanel(panel);
  }

  private panelText(x: number, y: number, raw: string, style: Phaser.Types.GameObjects.Text.TextStyle, width: number): Phaser.GameObjects.Container {
    const box = this.scene.add.container(0, 0).setDepth(theme.depth.hand);
    const rendered = renderManaText(this.scene, box, x, y, raw, { ...style, wordWrap: { width, useAdvancedWrap: true } });
    rendered.reflow();
    this.handObjects.push(box);
    return box;
  }

  private costPips(cost: ManaCost, right: number, cy: number, pip: number): number {
    const scene = this.scene;
    let px = right - pip / 2;
    for (const spec of [...pipsFor(cost)].reverse()) {
      const key = spec.number !== undefined ? ensureNumeralPip(scene, spec.number) : spec.texture;
      if (scene.textures.exists(key)) this.handObjects.push(scene.add.image(px, cy, key).setDisplaySize(pip, pip).setDepth(theme.depth.hand + 1));
      px -= pip + 2;
    }
    return px + pip / 2;
  }

  private drawFocusPanel(panel: PhoneFocusPanel): void {
    const scene = this.scene;
    const pane = this.L.hand;
    const x = pane.x + 2;
    const width = pane.width - 4;
    const title = scene.add.text(x, pane.y, panel.title, {
      fontFamily: theme.fonts.display, fontSize: `${this.type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      wordWrap: { width, useAdvancedWrap: true }, lineSpacing: -2,
    }).setDepth(theme.depth.hand);
    this.handObjects.push(title);
    let y = title.y + title.height + 8;
    if (panel.rider) {
      const pad = 10;
      const box = this.panelText(x + pad, y + pad, panel.rider, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, color: theme.colors.heading, lineSpacing: 2,
      }, width - 2 * pad);
      const h = box.getBounds().height + 2 * pad;
      this.rowPlate({ x, y, width, height: h }, theme.colors.goldHover, 0.6);
      box.setDepth(theme.depth.hand + 1);
      y += h + 8;
    }
    // Your untapped mana: each colour's pip and count, then "untapped",
    // wrapping to a second line rather than running off the column at 130%.
    const pip = 18;
    const lineH = Math.max(pip, this.type.body * 1.3) + 4;
    let cx = x;
    const fit = (w: number): void => {
      if (cx > x && cx + w > x + width) { cx = x; y += lineH; }
    };
    for (const slot of panel.untapped) {
      const n = scene.add.text(0, y + lineH / 2, `${slot.untapped}`, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      }).setOrigin(0, 0.5).setDepth(theme.depth.hand);
      fit(pip + 4 + n.width);
      this.handObjects.push(scene.add.image(cx + pip / 2, y + lineH / 2, slot.texture).setDisplaySize(pip, pip).setDepth(theme.depth.hand));
      n.setPosition(cx + pip + 4, y + lineH / 2);
      this.handObjects.push(n);
      cx = n.x + n.width + 8;
    }
    const tail = scene.add.text(0, y + lineH / 2, panel.untapped.length ? 'untapped' : 'No untapped mana', {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, color: theme.colors.muted,
    }).setOrigin(0, 0.5).setDepth(theme.depth.hand);
    fit(tail.width);
    tail.setPosition(cx, y + lineH / 2);
    this.handObjects.push(tail);
    y += lineH + 2;
    const leaves = scene.add.text(x, y, panel.leaves, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`,
      color: panel.leavesTone === 'danger' ? theme.colors.dangerArmed : theme.colors.muted,
      wordWrap: { width, useAdvancedWrap: true },
    }).setDepth(theme.depth.hand);
    this.handObjects.push(leaves);
    if (panel.empower) {
      // Empower sits above the foot, Cast stays under the thumb (T-04).
      const h = Math.max(COMPACT.touch, Math.round(this.type.h2 * 2.4));
      const rect = { x: pane.x, y: pane.y + pane.height - h, width: pane.width, height: h };
      const onTap = panel.empower.onTap;
      const plate = this.rowPlate(rect, theme.colors.gold, 0.95);
      plate.setDepth(theme.depth.hand);
      const label = scene.add.text(0, rect.y + rect.height / 2, 'Empower', {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      }).setOrigin(0, 0.5).setDepth(theme.depth.hand + 1);
      const icon = scene.add.image(0, label.y, bakeUiIcon(scene, 'bolt')).setDisplaySize(20, 20)
        .setTint(colorInt(theme.colors.gold)).setDepth(theme.depth.hand + 1);
      const pipW = pipsFor(panel.empower.cost).length * (pip + 2);
      const total = 20 + 8 + label.width + 10 + pipW;
      const left = rect.x + (rect.width - total) / 2;
      icon.setX(left + 10);
      label.setX(left + 28);
      this.costPips(panel.empower.cost, left + total, label.y, pip);
      this.handObjects.push(label, icon);
      this.rowZone(rect, onTap).setName('focus:empower');
    }
  }

  private drawTargetPanel(panel: PhoneTargetPanel): void {
    const scene = this.scene;
    const pane = this.L.hand;
    const x = pane.x + 2;
    const width = pane.width - 4;
    let y = pane.y;
    if (panel.card) {
      // The spell's own row: art, name, type and Empowered, its cost.
      const rowH = this.L.handRowH + 8;
      const rect = { x: pane.x, y, width: pane.width, height: rowH };
      this.rowPlate(rect, theme.colors.panelStroke, 1);
      const thumb = rowH - 12;
      this.thumbArt(panel.card, rect.x + 6 + thumb / 2, y + rowH / 2, thumb);
      const right = panel.cost ? this.costPips(panel.cost, rect.x + rect.width - 8, y + 14, 18) : rect.x + rect.width - 8;
      const tx = rect.x + thumb + 14;
      const name = scene.add.text(tx, y + rowH / 2 - 1, panel.card.name, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
      }).setOrigin(0, 1).setDepth(theme.depth.hand);
      ellipsizeText(name, right - 6 - tx);
      const type = scene.add.text(tx, y + rowH / 2 + 3, panel.card.types[0] ? panel.card.types[0].charAt(0).toUpperCase() + panel.card.types[0].slice(1) : '', {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.muted,
      }).setDepth(theme.depth.hand);
      this.handObjects.push(name, type);
      if (panel.chip) {
        const chip = scene.add.text(type.x + type.width + 8, type.y, panel.chip, {
          fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
          padding: { x: 6, y: 0 },
        }).setDepth(theme.depth.hand + 1);
        const g = scene.add.graphics().setDepth(theme.depth.hand);
        g.lineStyle(1, colorInt(theme.colors.gold), 0.9).strokeRoundedRect(chip.x, chip.y, chip.width, chip.height, chip.height / 2);
        this.handObjects.push(chip, g);
      }
      y += rowH + 10;
    }
    const title = scene.add.text(x, y, panel.title, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      wordWrap: { width, useAdvancedWrap: true },
    }).setDepth(theme.depth.hand);
    this.handObjects.push(title);
    y += title.height + 6;
    if (panel.text) {
      const body = this.panelText(x, y, panel.text, { fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, color: theme.colors.muted, lineSpacing: 2 }, width);
      y += body.getBounds().height + 10;
    }
    if (panel.picks.length === 0) return;
    const label = scene.add.text(x, y, 'TARGET', {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    }).setLetterSpacing(1).setDepth(theme.depth.hand);
    this.handObjects.push(label);
    y += label.height + 6;
    const rowH = this.L.handRowH + 8;
    for (const pick of panel.picks) {
      if (y + rowH > pane.y + pane.height) break;
      const rect = { x: pane.x, y, width: pane.width, height: rowH };
      this.rowPlate(rect, theme.colors.gold, 0.9);
      const thumb = rowH - 12;
      const cx = rect.x + 6 + thumb / 2;
      if (pick.card) this.thumbArt(pick.card, cx, y + rowH / 2, thumb);
      else if (pick.portrait && scene.textures.exists(pick.portrait)) {
        this.handObjects.push(scene.add.image(cx, y + rowH / 2, pick.portrait).setDisplaySize(thumb, thumb).setDepth(theme.depth.hand));
      }
      const tx = rect.x + thumb + 14;
      const name = scene.add.text(tx, y + rowH / 2 - 1, pick.name, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
      }).setOrigin(0, 1).setDepth(theme.depth.hand);
      ellipsizeText(name, rect.width - (tx - rect.x) - 8);
      const detail = scene.add.text(tx, y + rowH / 2 + 3, pick.detail, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.body,
      }).setDepth(theme.depth.hand);
      ellipsizeText(detail, rect.width - (tx - rect.x) - 8);
      this.handObjects.push(name, detail);
      y += rowH + 6;
    }
  }

  /** A small gold caption over a column panel ("YOUR COMBAT"). */
  private caption(x: number, y: number, text: string): Phaser.GameObjects.Text {
    const label = this.scene.add.text(x, y, text.toUpperCase(), {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    }).setLetterSpacing(1).setDepth(theme.depth.hand);
    this.handObjects.push(label);
    return label;
  }

  private drawCombatPanel(panel: PhoneCombatPanel): void {
    const scene = this.scene;
    const pane = this.L.hand;
    const x = pane.x + 2;
    const width = pane.width - 4;
    let y = pane.y;
    let tx = x;
    const faceSize = 30;
    if (panel.face) {
      this.discArt(panel.face, x + faceSize / 2, y + faceSize / 2 + 2, faceSize);
      tx = x + faceSize + 8;
    }
    const head = this.caption(tx, y, panel.heading);
    ellipsizeText(head, x + width - tx);
    const title = scene.add.text(tx, head.y + head.height + 1, panel.title, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.h2}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
      wordWrap: { width: x + width - tx, useAdvancedWrap: true },
    }).setDepth(theme.depth.hand);
    this.handObjects.push(title);
    y = Math.max(title.y + title.height, panel.face ? y + faceSize + 4 : 0) + 6;
    if (panel.forecast) {
      const tone = panel.forecast.danger ? theme.colors.dangerArmed : theme.colors.body;
      const icon = scene.add.image(x + 9, 0, bakeUiIcon(scene, panel.forecast.danger ? 'warning' : 'sword')).setDisplaySize(16, 16)
        .setTint(colorInt(tone)).setDepth(theme.depth.hand);
      const text = scene.add.text(x + 24, y, panel.forecast.text, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: tone,
        wordWrap: { width: width - 24, useAdvancedWrap: true },
      }).setDepth(theme.depth.hand);
      icon.setY(y + Math.min(text.height, this.type.body * 1.3) / 2);
      this.handObjects.push(icon, text);
      y += text.height + 6;
    }
    const rowH = this.L.handRowH + 2;
    const gap = 4;
    const fit = Math.max(0, Math.floor((pane.y + pane.height - y + gap) / (rowH + gap)));
    const shown = panel.rows.length > fit ? Math.max(0, fit - 1) : panel.rows.length;
    for (const row of panel.rows.slice(0, shown)) {
      this.drawCombatRow({ x: pane.x, y, width: pane.width, height: rowH }, row);
      y += rowH + gap;
    }
    if (shown < panel.rows.length && fit > 0) {
      this.drawMoreRow({ x: pane.x, y, width: pane.width, height: rowH }, `${panel.rows.length - shown} more`);
    }
  }

  private drawCombatRow(rect: { x: number; y: number; width: number; height: number }, row: PhoneCombatRow): void {
    const scene = this.scene;
    const alpha = row.look === 'dim' ? 0.5 : 1;
    this.rowPlate(rect, row.look === 'lit' ? theme.colors.gold : theme.colors.panelStroke, row.look === 'lit' ? 0.95 : 1).setAlpha(alpha);
    const cy = rect.y + rect.height / 2;
    const thumb = Math.min(34, rect.height - 10);
    this.thumbArt(row.card, rect.x + 6 + thumb / 2, cy, thumb).setAlpha(alpha);
    let right = rect.x + rect.width - 8;
    const r = row.right;
    if (r?.kind === 'remove' || r?.kind === 'lock') {
      const size = Math.min(COMPACT.touch, rect.height);
      const icon = scene.add.image(right - size / 2, cy, bakeUiIcon(scene, r.kind === 'lock' ? 'lock' : 'close')).setDisplaySize(16, 16)
        .setTint(colorInt(r.kind === 'lock' ? theme.colors.gold : theme.colors.muted)).setDepth(theme.depth.hand + 1);
      this.handObjects.push(icon);
      if (r.kind === 'lock') {
        const ring = scene.add.graphics().setDepth(theme.depth.hand);
        ring.lineStyle(1.5, colorInt(theme.colors.gold), 0.9).strokeCircle(icon.x, cy, 14);
        this.handObjects.push(ring);
      }
      right -= size;
    } else if (r?.kind === 'blockers') {
      const d = Math.min(28, thumb);
      for (const card of [...r.cards].reverse()) {
        this.discArt(card, right - d / 2, cy, d);
        right -= d + 4;
      }
    } else if (r?.kind === 'chip') {
      const chip = scene.add.text(0, rect.y + 8, r.text, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.dangerArmed,
        padding: { x: 7, y: 1 },
      }).setOrigin(1, 0).setDepth(theme.depth.hand + 1);
      chip.setX(right);
      const g = scene.add.graphics().setDepth(theme.depth.hand);
      g.fillStyle(colorInt(theme.colors.dangerArmed), 0.18).fillRoundedRect(chip.x - chip.width, chip.y, chip.width, chip.height, chip.height / 2);
      g.lineStyle(1, colorInt(theme.colors.dangerArmed), 0.9).strokeRoundedRect(chip.x - chip.width, chip.y, chip.width, chip.height, chip.height / 2);
      this.handObjects.push(g, chip);
      // The chip rides the name line; the detail line keeps the full width.
    }
    const textX = rect.x + thumb + 12;
    const chipW = r?.kind === 'chip' ? (this.handObjects[this.handObjects.length - 1] as Phaser.GameObjects.Text).width + 6 : 0;
    const name = scene.add.text(textX, cy - 1, row.card.name, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
    }).setOrigin(0, 1).setAlpha(alpha).setDepth(theme.depth.hand);
    ellipsizeText(name, right - textX - 6 - chipW);
    const detail = scene.add.text(textX, cy + 3, row.detail, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.body,
    }).setAlpha(alpha).setDepth(theme.depth.hand);
    ellipsizeText(detail, right - textX - 6);
    this.handObjects.push(name, detail);
    if (r?.kind === 'remove') {
      // × is the row's whole tap: the row is the creature taken out of the attack.
      this.rowZone(rect, r.onTap, row.card).setName(`combat-row:${row.card.id}`);
    } else if (row.onTap) {
      this.rowZone(rect, row.onTap, row.card).setName(`combat-row:${row.card.id}`);
    }
  }

  /** A creature's round art disc, as on the board, for blocker and recap thumbs. */
  private discArt(card: CardDef, cx: number, cy: number, d: number): void {
    const img = this.thumbArt(card, cx, cy, d);
    const mask = this.scene.make.graphics({}, false).fillCircle(cx, cy, d / 2);
    const geo = mask.createGeometryMask();
    img.setMask(geo);
    const ring = this.scene.add.graphics().setDepth(theme.depth.hand + 1);
    ring.lineStyle(1.5, colorInt(theme.colors.panelStroke), 1).strokeCircle(cx, cy, d / 2);
    this.handObjects.push(ring);
    img.once('destroy', () => { geo.destroy(); mask.destroy(); });
  }

  private drawRecapPanel(panel: PhoneRecapPanel): void {
    const scene = this.scene;
    const pane = this.L.hand;
    const x = pane.x + 2;
    const width = pane.width - 4;
    let y = pane.y;
    y += this.caption(x, y, 'Combat damage').height + 6;
    const lifeH = panel.life.length > 0 ? Math.max(COMPACT.touch, Math.round(this.type.h2 * 2.2)) : 0;
    const bottom = pane.y + pane.height - (lifeH > 0 ? lifeH * panel.life.length + 8 : 0);
    const d = Math.round(this.type.body * 1.9);
    outer: for (const section of panel.sections) {
      if (section.title) {
        if (y + this.type.body * 1.4 > bottom) break;
        const title = scene.add.text(x, y, section.title, {
          fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
        }).setDepth(theme.depth.hand);
        this.handObjects.push(title);
        y += title.height + 4;
      }
      for (const line of section.lines) {
        const thumbs = Math.min(line.cards.length, 2);
        const textX = x + d + (thumbs - 1) * (d * 0.6) + 8;
        const text = scene.add.text(textX, y, line.text, {
          fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.body, lineSpacing: 1,
          wordWrap: { width: x + width - textX, useAdvancedWrap: true },
        }).setDepth(theme.depth.hand);
        // The deaths read on their own line in the danger colour, after the blows.
        const deaths = line.deaths ? scene.add.text(textX, text.y + text.height + 1, line.deaths, {
          fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.dangerArmed,
        }).setDepth(theme.depth.hand) : null;
        const h = Math.max(d, text.height + (deaths ? deaths.height + 1 : 0));
        if (y + h > bottom) { text.destroy(); deaths?.destroy(); break outer; }
        this.handObjects.push(text);
        if (deaths) this.handObjects.push(deaths);
        line.cards.slice(0, 2).forEach((card, i) => this.discArt(card, x + d / 2 + i * d * 0.6, y + d / 2, d));
        y += h + 8;
      }
    }
    let ly = pane.y + pane.height - lifeH * panel.life.length - 6 * (panel.life.length - 1);
    for (const life of panel.life) {
      const rect = { x: pane.x, y: ly, width: pane.width, height: lifeH };
      const loss = life.to < life.from;
      const g = scene.add.graphics().setDepth(theme.depth.hand);
      g.fillStyle(colorInt(loss ? theme.colors.dangerArmed : theme.colors.gold), 0.14).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
      g.lineStyle(1.5, colorInt(loss ? theme.colors.dangerArmed : theme.colors.gold), 0.9).strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
      const label = scene.add.text(rect.x + 12, rect.y + rect.height / 2, life.label, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.h2}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
      }).setOrigin(0, 0.5).setDepth(theme.depth.hand);
      const value = scene.add.text(rect.x + rect.width - 12, label.y, `${life.from} → ${life.to}`, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.h2}px`, fontStyle: theme.weight.w700, color: loss ? theme.colors.dangerArmed : theme.colors.gold,
      }).setOrigin(1, 0.5).setDepth(theme.depth.hand);
      ellipsizeText(label, value.x - value.width - 8 - label.x);
      this.handObjects.push(g, label, value);
      ly += lifeH + 6;
    }
    // A tap anywhere on the recap puts the hand back.
    this.rowZone({ x: pane.x, y: pane.y, width: pane.width, height: pane.height }, panel.onDismiss).setName('recap:dismiss');
  }

  private drawSummaryPanel(panel: PhoneSummaryPanel): void {
    const scene = this.scene;
    const pane = this.L.hand;
    const x = pane.x + 2;
    const width = pane.width - 4;
    const bottom = pane.y + pane.height;
    let y = pane.y;
    const rule = (): void => {
      const g = scene.add.graphics().setDepth(theme.depth.hand);
      g.lineStyle(1, theme.graphics.panelStroke, 0.9).lineBetween(x, y, x + width, y);
      this.handObjects.push(g);
      y += 8;
    };
    if (panel.source) {
      // The card that opened the window: its art, name, type and cost (W-Foresee, W-Loot).
      const thumb = Math.max(36, this.L.handRowH);
      this.thumbArt(panel.source.card, x + thumb / 2, y + thumb / 2, thumb);
      const tx = x + thumb + 10;
      const name = scene.add.text(tx, y, panel.source.card.name, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      }).setDepth(theme.depth.hand);
      ellipsizeText(name, x + width - tx);
      this.handObjects.push(name);
      const detail = scene.add.text(tx, name.y + name.height, panel.source.detail, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.muted,
      }).setDepth(theme.depth.hand);
      this.handObjects.push(detail);
      if (panel.source.cost) {
        const pip = 16;
        const pips = pipsFor(panel.source.cost).length;
        this.costPips(panel.source.cost, detail.x + detail.width + 8 + pips * (pip + 2), detail.y + detail.height / 2, pip);
      }
      y += Math.max(thumb, detail.y + detail.height - y) + 6;
    }
    if (panel.text) {
      const box = this.panelText(x, y, panel.text, { fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, color: theme.colors.heading, lineSpacing: 2 }, width);
      y += box.getBounds().height + 8;
    }
    if (panel.source || panel.text) rule();
    if (panel.heading) {
      const heading = scene.add.text(x, y, panel.heading, {
        fontFamily: theme.fonts.display, fontSize: `${this.type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
        wordWrap: { width, useAdvancedWrap: true },
      }).setDepth(theme.depth.hand);
      this.handObjects.push(heading);
      y += heading.height + 4;
    }
    if (panel.sub) {
      const sub = scene.add.text(x, y, panel.sub, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.body,
        wordWrap: { width, useAdvancedWrap: true },
      }).setDepth(theme.depth.hand);
      this.handObjects.push(sub);
      y += sub.height + 6;
    }
    if (panel.count) {
      const count = scene.add.text(x, y, panel.count, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.muted,
      }).setDepth(theme.depth.hand);
      this.handObjects.push(count);
      y += count.height + 8;
    }
    for (const section of panel.sections) {
      if (y + this.type.body > bottom) break;
      const title = scene.add.text(x, y, section.title.toUpperCase(), {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.muted,
      }).setLetterSpacing(1).setDepth(theme.depth.hand);
      this.handObjects.push(title);
      y += title.height + 4;
      section.lines.forEach((line, i) => {
        if (y + this.type.body > bottom) return;
        let lx = x;
        if (section.numbered) {
          const n = scene.add.text(x, y, `${i + 1}`, {
            fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
          }).setDepth(theme.depth.hand);
          this.handObjects.push(n);
          lx = x + Math.max(n.width, this.type.body * 0.7) + 10;
        }
        const text = scene.add.text(lx, y, line, {
          fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, color: theme.colors.heading,
        }).setDepth(theme.depth.hand);
        ellipsizeText(text, x + width - lx);
        this.handObjects.push(text);
        y += text.height + 4;
      });
      y += 4;
    }
    const rowH = this.L.handRowH + 8;
    for (const pick of panel.picks) {
      if (y + rowH > bottom) break;
      const rect = { x: pane.x, y, width: pane.width, height: rowH };
      this.rowPlate(rect, theme.colors.dangerArmed, 0.55);
      const thumb = rowH - 12;
      this.thumbArt(pick.card, rect.x + 6 + thumb / 2, y + rowH / 2, thumb);
      const right = pick.card.cost ? this.costPips(pick.card.cost, rect.x + rect.width - 8, y + rowH / 2, 18) : rect.x + rect.width - 8;
      const tx = rect.x + thumb + 14;
      const name = scene.add.text(tx, y + rowH / 2 - 1, pick.card.name, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
      }).setOrigin(0, 1).setDepth(theme.depth.hand);
      ellipsizeText(name, right - 6 - tx);
      const detail = scene.add.text(tx, y + rowH / 2 + 3, pick.detail, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.dangerArmed,
      }).setDepth(theme.depth.hand);
      this.handObjects.push(name, detail);
      y += rowH + 6;
    }
    if (panel.note && y + this.type.body < bottom) {
      y += 2;
      const box = this.panelText(x, y, `${panel.note.name}: ${panel.note.reminder}`, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.body, lineSpacing: 1,
      }, width);
      if (box.getBounds().bottom > bottom) box.destroy();
    }
  }

  private drawInspectPanel(panel: PhoneInspectPanel): void {
    const scene = this.scene;
    const pane = this.L.hand;
    const x = pane.x + 2;
    const width = pane.width - 4;
    let y = pane.y;
    if (panel.stats) {
      const now = scene.add.text(0, 0, panel.stats.now, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.h1 + 6}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      }).setOrigin(0.5).setDepth(theme.depth.hand + 1);
      const boxW = Math.max(64, now.width + 20);
      const boxH = Math.max(COMPACT.touch, now.height + 8);
      this.rowPlate({ x, y, width: boxW, height: boxH }, theme.colors.gold, 0.95);
      now.setPosition(x + boxW / 2, y + boxH / 2);
      this.handObjects.push(now);
      if (panel.stats.printed) {
        const printed = scene.add.text(x + boxW + 10, y + boxH / 2, panel.stats.printed, {
          fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.body,
          wordWrap: { width: width - boxW - 10, useAdvancedWrap: true },
        }).setOrigin(0, 0.5).setDepth(theme.depth.hand);
        this.handObjects.push(printed);
      }
      y += boxH + 8;
    }
    for (const line of panel.lines) {
      const text = scene.add.text(x, y, line, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.body,
        wordWrap: { width, useAdvancedWrap: true },
      }).setDepth(theme.depth.hand);
      this.handObjects.push(text);
      y += text.height + 6;
    }
    if (panel.guide.length === 0) return;
    const head = scene.add.text(x, y, 'Keyword guide', {
      fontFamily: theme.fonts.display, fontSize: `${this.type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    }).setDepth(theme.depth.hand);
    this.handObjects.push(head);
    y += head.height + 2;
    const rule = scene.add.graphics().setDepth(theme.depth.hand);
    rule.lineStyle(1, theme.graphics.panelStroke, 0.9).lineBetween(x, y, x + width, y);
    this.handObjects.push(rule);
    y += 8;
    const bottom = pane.y + pane.height;
    for (const entry of panel.guide) {
      if (y >= bottom - this.type.body) break;
      const name = scene.add.text(x, y, entry.name, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      }).setDepth(theme.depth.hand);
      this.handObjects.push(name);
      y += name.height + 1;
      const reminder = scene.add.text(x, y, entry.reminder, {
        fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.body, lineSpacing: 1,
        wordWrap: { width, useAdvancedWrap: true },
      }).setDepth(theme.depth.hand);
      // A reminder that would run past the foot is cut to the lines that fit.
      const room = bottom - y;
      if (reminder.height > room) {
        const lines = reminder.getWrappedText(entry.reminder);
        const lineH = reminder.height / Math.max(1, lines.length);
        const keep = Math.max(1, Math.floor(room / lineH));
        reminder.setText(`${lines.slice(0, keep).join(' ').replace(/\s+\S*$/, '')}…`);
      }
      this.handObjects.push(reminder);
      y += reminder.height + 8;
    }
  }

  /** The latest move over the foe's strip while it is her turn; null hides it. */
  setBanner(tag: string | null, text: string): void {
    this.banner.setVisible(tag !== null);
    if (tag === null) return;
    this.bannerTag.setText(tag.toUpperCase());
    this.bannerText.setText(text);
    ellipsizeText(this.bannerText, this.L.oppHalf.width - 24);
  }

  private rowPlate(rect: { x: number; y: number; width: number; height: number }, stroke: string, strokeAlpha: number, dashed = false): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics().setDepth(theme.depth.hand);
    g.fillStyle(theme.graphics.panelFill, dashed ? 0.6 : 0.92).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
    g.lineStyle(1, colorInt(stroke), strokeAlpha);
    if (dashed) dashedRoundRect(g, rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
    else g.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
    this.handObjects.push(g);
    return g;
  }

  private rowZone(hit: { x: number; y: number; width: number; height: number }, onTap: () => void, card?: CardDef, onInspect?: () => void): Phaser.GameObjects.Zone {
    const zone = this.scene.add.zone(hit.x + hit.width / 2, hit.y + hit.height / 2, hit.width, hit.height)
      .setInteractive({ useHandCursor: true }).setDepth(theme.depth.hand + 1);
    // A long press is the sticky card preview (its tap opens the full read); a right-click reads it at once.
    bindTapButton(this.scene, zone, (p) => { if (!p.rightButtonReleased()) onTap(); }, card ? { card } : {});
    if (onInspect) zone.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.button === 2) onInspect(); });
    this.handObjects.push(zone);
    this.handZones.push(zone);
    return zone;
  }

  private drawHandRow(rect: { x: number; y: number; width: number; height: number }, hit: { x: number; y: number; width: number; height: number }, row: PhoneHandRow): void {
    const scene = this.scene;
    const alpha = row.look.dim ? 0.5 : 1;
    this.rowPlate(rect, theme.colors.panelStroke, 1).setAlpha(alpha);
    const thumb = Math.min(32, rect.height - 8);
    const tx = rect.x + 6;
    const cy = rect.y + rect.height / 2;
    const art = this.thumbArt(row.card, tx + thumb / 2, cy, thumb);
    art.setAlpha(alpha);
    // Cost pips at the right, generic first.
    const pip = 18;
    const specs = row.card.cost ? pipsFor(row.card.cost as ManaCost) : [];
    let px = rect.x + rect.width - 10 - pip / 2;
    for (const spec of [...specs].reverse()) {
      const key = spec.number !== undefined ? ensureNumeralPip(scene, spec.number) : spec.texture;
      if (scene.textures.exists(key)) {
        this.handObjects.push(scene.add.image(px, cy, key).setDisplaySize(pip, pip).setAlpha(alpha).setDepth(theme.depth.hand));
      }
      px -= pip + 2;
    }
    const textX = tx + thumb + 8;
    const textW = px + pip / 2 - 6 - textX;
    const name = scene.add.text(textX, cy - 1, row.card.name, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
    }).setOrigin(0, 1).setAlpha(alpha).setDepth(theme.depth.hand);
    ellipsizeText(name, textW);
    name.setData('a11yReleaseFullText', row.card.name);
    const toneColor = row.look.tone === 'gold' ? theme.colors.gold : row.look.tone === 'danger' ? theme.colors.dangerArmed : theme.colors.muted;
    let dx = textX;
    if (row.look.icon) {
      const size = Math.round(this.type.label * 1.1);
      this.handObjects.push(scene.add.image(dx + size / 2, cy + 2 + this.type.label * 0.65, bakeUiIcon(scene, row.look.icon))
        .setDisplaySize(size, size).setTint(colorInt(toneColor)).setAlpha(alpha).setDepth(theme.depth.hand));
      dx += size + 4;
    }
    const detail = scene.add.text(dx, cy + 2, row.look.detail, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: toneColor,
    }).setOrigin(0, 0).setAlpha(alpha).setDepth(theme.depth.hand);
    ellipsizeText(detail, textX + textW - dx);
    this.handObjects.push(name, detail);
    this.rowZone(hit, row.onTap, row.card, row.onInspect).setName(`hand-row:${row.card.id}`);
  }

  private drawPinnedRow(rect: { x: number; y: number; width: number; height: number }, row: PhonePinnedRow): void {
    const scene = this.scene;
    this.rowPlate(rect, theme.colors.gold, 0.9);
    const cy = rect.y + rect.height / 2;
    this.handObjects.push(scene.add.image(rect.x + 22, cy, bakeUiIcon(scene, row.icon)).setDisplaySize(18, 18)
      .setTint(colorInt(theme.colors.gold)).setDepth(theme.depth.hand));
    const title = scene.add.text(rect.x + 42, cy - 1, row.title, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.gold,
    }).setOrigin(0, 1).setDepth(theme.depth.hand);
    const detail = scene.add.text(rect.x + 42, cy + 2, row.detail, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.label}px`, color: theme.colors.muted,
    }).setOrigin(0, 0).setDepth(theme.depth.hand);
    ellipsizeText(title, rect.width - 52);
    ellipsizeText(detail, rect.width - 52);
    this.handObjects.push(title, detail);
    this.rowZone({ x: rect.x, y: rect.y - 2, width: rect.width, height: rect.height + 4 }, row.onTap).setName(`hand-row:${row.icon}`);
  }

  private drawMoreRow(rect: { x: number; y: number; width: number; height: number }, label: string): void {
    this.rowPlate(rect, theme.colors.muted, 0.7, true);
    const text = this.scene.add.text(rect.x + rect.width / 2, rect.y + rect.height / 2, label, {
      fontFamily: theme.fonts.ui, fontSize: `${this.type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
    }).setOrigin(0.5).setDepth(theme.depth.hand);
    this.handObjects.push(text);
  }

  /** A row's square art thumbnail, cover-cropped toward the face. */
  private thumbArt(card: CardDef, cx: number, cy: number, size: number): Phaser.GameObjects.Image {
    const scene = this.scene;
    const image = scene.add.image(cx, cy, '__WHITE').setDepth(theme.depth.hand);
    const frame = scene.add.graphics().setDepth(theme.depth.hand);
    const draw = (): void => {
      const ref = Art.resolver!.getArt(card.id);
      if (ref.frameName) image.setTexture(ref.textureKey, ref.frameName);
      else image.setTexture(ref.textureKey);
      const srcW = image.frame.width;
      const srcH = image.frame.height;
      const side = Math.min(srcW, srcH);
      const cropY = (srcH - side) * 0.14;
      image.setCrop((srcW - side) / 2, cropY, side, side);
      const scale = size / side;
      image.setScale(scale);
      // setCrop keeps the full frame's footprint; shift the cropped square onto the centre.
      image.setPosition(cx, cy + scale * (srcH / 2 - cropY - side / 2));
      holdArt(image, ref, () => { if (image.active) draw(); });
    };
    draw();
    frame.lineStyle(1.5, colorInt(theme.colors.panelStroke), 1).strokeRoundedRect(cx - size / 2, cy - size / 2, size, size, 4);
    this.handObjects.push(image, frame);
    return image;
  }
}

/** A dashed rounded rectangle (the "N more in hand" row, the waiting status). */
function dashedRoundRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number): void {
  const dash = 5;
  const gap = 4;
  const segment = (x1: number, y1: number, x2: number, y2: number): void => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let t = 0; t < len; t += dash + gap) {
      const a = t / len;
      const b = Math.min(len, t + dash) / len;
      g.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
    }
  };
  segment(x + r, y, x + w - r, y);
  segment(x + w, y + r, x + w, y + h - r);
  segment(x + w - r, y + h, x + r, y + h);
  segment(x, y + h - r, x, y + r);
  g.beginPath();
  g.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  g.strokePath();
  g.beginPath();
  g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  g.strokePath();
  g.beginPath();
  g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  g.strokePath();
  g.beginPath();
  g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  g.strokePath();
}

