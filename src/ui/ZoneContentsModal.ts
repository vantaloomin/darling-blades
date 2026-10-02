import Phaser from 'phaser';
import type { CardDef, ManaCost } from '../engine/types';
import type { CardVariant } from '../meta/variants';
import { pageNeighbourhood } from '../meta/collectionFilter';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { makeCardThumb, thumbArtWanted } from './CardThumbCache';
import { PagedArt } from './artGate';
import { CARD_H, CARD_W } from './CardView';
import { manaCostText } from './rulesText';
import { renderManaText } from './ManaText';
import { colorInt, theme } from './theme';
import { modalShell, pager, type ModalShellOptions } from './themeWidgets';
import { WHISPERS_ZONE_LAYOUT } from './zoneContentsPresentation';
import { duelPanelAlpha, duelPanelType, zonePanelLayout } from './duelPanelPresentation';
import { fitMenuName } from './menuText';

export interface ZoneContentsAction {
  label: string;
  enabled?: boolean;
  /** Omit for zero-cost actions such as playing a reserve land. */
  cost?: ManaCost;
  onSelect: () => void;
}

export interface ZoneContentsEntry {
  card: CardDef;
  count: number;
  landStyle?: string;
  variant?: CardVariant;
  action?: ZoneContentsAction;
  /** A live Whispers card can also offer Preserve. Both choices stay visible. */
  additionalActions?: ZoneContentsAction[];
  deadline?: string;
  /**
   * Corner-chip text, replacing the default `x{count}`. Zones that list one
   * tile per physical card (the ordered graveyard) pass a position marker here
   * instead, or `null` for no chip at all.
   */
  badge?: string | null;
}

export interface ZoneContentsModalOptions
  extends Pick<
    ModalShellOptions,
    'dimAlpha' | 'escToClose' | 'tapDimToClose' | 'showClose' | 'depth' | 'onClose'
  > {
  title: string;
  entries: ZoneContentsEntry[];
  onInspect: (card: CardDef, variant?: CardVariant, landStyle?: string) => void;
  emptyText?: string;
  /**
   * Optional mana-context line under the title (`{W}`/`{2}` tokens render as
   * pips). Zone modals cover the board's mana strip, so casting decisions
   * (e.g. graveyard Retell) need the untapped summary restated here.
   */
  subtitle?: string;
}

export interface ZoneContentsModal {
  container: Phaser.GameObjects.Container;
  close(): void;
  showPage(page: number): void;
}

const MODAL_W = 920;
const MODAL_H = 620;
const THUMB_SCALE = 0.24;
const GRID_CX = 640;
const BADGE_H = 18;
const ACTION_H = 28;

export function showZoneContents(
  scene: Phaser.Scene,
  opts: ZoneContentsModalOptions,
): ZoneContentsModal {
  const shell = modalShell(scene, {
    width: MODAL_W,
    height: MODAL_H,
    dimAlpha: duelPanelAlpha(opts.dimAlpha ?? 0.62),
    escToClose: opts.escToClose ?? true,
    tapDimToClose: opts.tapDimToClose ?? true,
    showClose: opts.showClose ?? false,
    depth: opts.depth ?? theme.depth.inspect,
    onClose: opts.onClose,
  });
  const container = shell.container;
  const expanded = opts.entries.some((entry) => entry.deadline || entry.additionalActions?.length);
  const thumbScale = THUMB_SCALE;
  const thumbW = CARD_W * thumbScale;
  const thumbH = CARD_H * thumbScale;
  let page = 0;
  let pageControl: ReturnType<typeof pager> | null = null;
  let gridItems: Phaser.GameObjects.GameObject[] = [];

  const title = scene.add.text(GRID_CX, 86, opts.title, {
    fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`,
    fontStyle: theme.weight.w700, color: theme.colors.heading, resolution: 2, align: 'center',
  }).setOrigin(0.5);
  fitMenuName(title, 840, 3);
  container.add(title);
  let sub: Phaser.GameObjects.Container | undefined;
  let subtitleHeight = 0;
  if (opts.subtitle) {
    sub = scene.add.container(GRID_CX, 122);
    const rendered = renderManaText(scene, sub, 0, 0, opts.subtitle, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, color: theme.colors.body,
      wordWrap: { width: 840, useAdvancedWrap: true }, align: 'center', resolution: 2,
    });
    rendered.text.setOrigin(0.5).setData('a11yKeepVisible', true).setData('a11yFullText', rendered.text.text);
    rendered.reflow();
    const subtitleBounds = sub.getBounds();
    subtitleHeight = 2 * Math.max(sub.y - subtitleBounds.y, subtitleBounds.bottom - sub.y);
    container.setData('a11yZoneHeader', { title, subtitle: sub });
    container.add(sub);
  }
  const measure = scene.add.container(0, 0).setVisible(false);
  let deadlineHeight = 0, actionHeight = ACTION_H, actionWidth = 0, badgeHeight = BADGE_H;
  for (const entry of opts.entries) {
    const badge = scene.add.text(0, 0, entry.badge ?? `x${entry.count}`, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px`, fontStyle: theme.weight.w700,
    });
    measure.add(badge); badgeHeight = Math.max(badgeHeight, badge.height + 4);
    if (entry.deadline) {
      const deadline = scene.add.text(0, 0, entry.deadline, {
        fontFamily: theme.fonts.ui, fontSize: `${duelPanelType().deadline}px`,
        padding: { x: 3, y: 2 }, wordWrap: { width: 112, useAdvancedWrap: true },
      });
      measure.add(deadline); deadlineHeight = Math.max(deadlineHeight, deadline.height);
    }
    for (const action of [...(entry.action ? [entry.action] : []), ...(entry.additionalActions ?? [])]) {
      const cost = action.cost ? ` ${manaCostText(action.cost)}` : '';
      const text = renderManaText(scene, measure, 0, 0, `${action.label}${cost}`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.micro}px`, fontStyle: theme.weight.w700,
        wordWrap: { width: expanded ? 170 : 110, useAdvancedWrap: true }, align: 'center',
      });
      actionHeight = Math.max(actionHeight, text.text.height + 10);
      actionWidth = Math.max(actionWidth, text.text.width + 18);
    }
  }
  measure.destroy();
  const layout = zonePanelLayout(expanded, title.height, subtitleHeight, badgeHeight, deadlineHeight, actionHeight, actionWidth);
  title.setY(layout.titleY);
  sub?.setY(layout.subtitleY);
  const { columns, columnGap, pageSize } = layout;
  const pageCount = Math.max(1, Math.ceil(opts.entries.length / pageSize));
  const pageArt = new PagedArt(scene, 'zone-contents', { owner: container });
  const wantedArt = (entries: readonly ZoneContentsEntry[]): string[] => entries.flatMap((entry) => {
    const wanted = thumbArtWanted(scene, entry.card, entry.landStyle, entry.variant);
    return wanted === null ? [] : [wanted.key];
  });
  container.setData('a11yDensity', {
    actual: { id: 'duel-zone', rows: layout.rows, columns, pitch: layout.pitch, top: layout.firstY },
    release: expanded ? { id: 'duel-zone', rows: 2, columns: 4, pitch: 235, top: 195 } : { id: 'duel-zone', rows: 4, columns: 6, pitch: 120, top: 176 },
  });

  const clearGrid = (): void => {
    for (const item of gridItems) {
      if (item.active) item.destroy();
    }
    gridItems = [];
  };

  const addGridItem = (item: Phaser.GameObjects.GameObject): void => {
    gridItems.push(item);
    container.add(item);
  };

  const addBadge = (x: number, y: number, text: string): void => {
    const label = scene.add
      .text(x + thumbW / 2 - 4, y - thumbH / 2 + 4, text, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        resolution: 2,
      })
      .setOrigin(1, 0);
    const badgeW = Math.max(34, Math.ceil(label.width + 10));
    const badge = scene.add.graphics();
    badge.setData('a11yZoneGrid', true);
    badge.fillStyle(theme.graphics.panelFill, duelPanelAlpha(0.94));
    badge.fillRoundedRect(label.x - badgeW, label.y - 2, badgeW, badgeHeight, theme.radius.control);
    badge.lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
    badge.strokeRoundedRect(label.x - badgeW, label.y - 2, badgeW, badgeHeight, theme.radius.control);
    addGridItem(badge);
    addGridItem(label);
  };

  const addActionChip = (x: number, y: number, action: ZoneContentsAction): void => {
    const chip = scene.add.container(x, y);
    const enabled = action.enabled !== false;
    const cost = action.cost ? ` ${manaCostText(action.cost)}` : '';
    const rendered = renderManaText(scene, chip, 0, 0, `${action.label}${cost}`, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.gold, wordWrap: { width: expanded ? 170 : 110, useAdvancedWrap: true }, align: 'center',
      resolution: 2,
    });
    rendered.text.setOrigin(0.5).setData('a11yKeepVisible', true).setData('a11yFullText', rendered.text.text);
    rendered.reflow();
    const width = Math.max(76, rendered.text.width + 18);
    const background = scene.add.graphics();
    background
      .fillStyle(colorInt(theme.colors.btnEmphasisBg), 1)
      .fillRoundedRect(-width / 2, -actionHeight / 2, width, actionHeight, theme.radius.control)
      .lineStyle(1, colorInt(theme.colors.gold), theme.alpha.chrome)
      .strokeRoundedRect(-width / 2, -actionHeight / 2, width, actionHeight, theme.radius.control);
    chip.addAt(background, 0);
    if (enabled) {
      const zone = scene.add.zone(0, 0, width, actionHeight).setInteractive({ useHandCursor: true });
      chip.add(zone);
      bindTapButton(scene, zone, (pointer) => {
        if (pointer.rightButtonReleased()) return;
        shell.close();
        action.onSelect();
      });
      inflateHitArea(zone, Math.max(90, width), 44);
    } else chip.setAlpha(theme.alpha.subtle);
    addGridItem(chip);
  };

  const renderPage = (nextPage: number): void => {
    if (!container.active) return;
    page = Phaser.Math.Clamp(nextPage, 0, pageCount - 1);
    const around = pageNeighbourhood(opts.entries, page, pageSize);
    // A duel normally already holds these sources. Other callers, and styled
    // or newly created cards, still get the same bounded page request rule.
    pageArt.show(wantedArt(around.shown), wantedArt(around.near));
    clearGrid();
    if (opts.entries.length === 0) {
      addGridItem(
        scene.add
          .text(GRID_CX, 350, opts.emptyText ?? 'No cards here.', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.body}px`,
            color: theme.colors.muted,
            resolution: 2,
          })
          .setOrigin(0.5),
      );
      pageControl?.refresh(page, pageCount);
      return;
    }

    const start = page * pageSize;
    for (const [i, entry] of opts.entries.slice(start, start + pageSize).entries()) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = GRID_CX - ((columns - 1) * columnGap) / 2 + col * columnGap;
      const y = layout.firstY + row * layout.pitch;
      const thumb = makeCardThumb(scene, x, y, entry.card, thumbScale, entry.landStyle, entry.variant);
      thumb.setData('a11yZoneGrid', true);
      thumb.setInteractive({ useHandCursor: true });
      bindTapButton(scene, thumb, (pointer) => {
        if (pointer.rightButtonReleased()) return;
        shell.close();
        opts.onInspect(entry.card, entry.variant, entry.landStyle);
      });
      inflateHitArea(thumb, 44, 44);
      thumb.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch) thumb.setTint(colorInt(theme.colors.gold));
      });
      thumb.on('pointerout', () => thumb.clearTint());
      addGridItem(thumb);
      const badge = entry.badge === undefined ? `x${entry.count}` : entry.badge;
      if (badge) addBadge(x, y, badge);
      if (entry.deadline) addGridItem(scene.add.text(x, y + layout.deadlineOffset, entry.deadline, {
        fontFamily: theme.fonts.ui, fontSize: `${duelPanelType().deadline}px`, color: theme.colors.gold,
        backgroundColor: theme.colors.btnGhostBg, padding: { x: 3, y: 2 },
        wordWrap: { width: 112, useAdvancedWrap: true }, align: 'center', resolution: 2,
      }).setOrigin(0.5).setData('a11yKeepVisible', true).setData('a11yFullText', entry.deadline));
      const actions = [...(entry.action ? [entry.action] : []), ...(entry.additionalActions ?? [])];
      actions.forEach((action, index) => addActionChip(x,
        y + layout.actionOffset + index * layout.actionGap, action));
    }
    pageControl?.refresh(page, pageCount);
  };

  if (pageCount > 1) {
    pageControl = pager(scene, GRID_CX - 44, WHISPERS_ZONE_LAYOUT.pagerY, page, pageCount, renderPage);
    container.add(pageControl.container);
  }
  renderPage(0);
  container.once('destroy', clearGrid);

  return { container, close: shell.close, showPage: renderPage };
}
