import Phaser from 'phaser';
import type { CardDef } from '../engine/types';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { makeCardThumb } from './CardThumbCache';
import { CARD_H, CARD_W } from './CardView';
import { colorInt, theme } from './theme';
import { modalShell, pager, type ModalShellOptions } from './themeWidgets';

export interface ZoneContentsEntry {
  card: CardDef;
  count: number;
  landStyle?: string;
}

export interface ZoneContentsModalOptions
  extends Pick<
    ModalShellOptions,
    'dimAlpha' | 'escToClose' | 'tapDimToClose' | 'showClose' | 'depth' | 'onClose'
  > {
  title: string;
  entries: ZoneContentsEntry[];
  onInspect: (card: CardDef, landStyle?: string) => void;
  emptyText?: string;
}

export interface ZoneContentsModal {
  container: Phaser.GameObjects.Container;
  close(): void;
}

const MODAL_W = 920;
const MODAL_H = 620;
const GRID_COLS = 6;
const GRID_ROWS = 4;
const PAGE_SIZE = GRID_COLS * GRID_ROWS;
const THUMB_SCALE = 0.24;
const COL_GAP = 128;
const ROW_GAP = 120;
const GRID_CX = 640;
const GRID_TOP_Y = 176;
const BADGE_H = 18;

export function showZoneContents(
  scene: Phaser.Scene,
  opts: ZoneContentsModalOptions,
): ZoneContentsModal {
  const shell = modalShell(scene, {
    width: MODAL_W,
    height: MODAL_H,
    dimAlpha: opts.dimAlpha ?? 0.62,
    escToClose: opts.escToClose ?? true,
    tapDimToClose: opts.tapDimToClose ?? true,
    showClose: opts.showClose ?? false,
    depth: opts.depth ?? theme.depth.inspect,
    onClose: opts.onClose,
  });
  const container = shell.container;
  const pageCount = Math.max(1, Math.ceil(opts.entries.length / PAGE_SIZE));
  const thumbW = CARD_W * THUMB_SCALE;
  const thumbH = CARD_H * THUMB_SCALE;
  let page = 0;
  let pageControl: ReturnType<typeof pager> | null = null;
  let gridItems: Phaser.GameObjects.GameObject[] = [];

  container.add(
    scene.add
      .text(GRID_CX, 86, opts.title, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.heading,
        resolution: 2,
      })
      .setOrigin(0.5),
  );

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

  const addCountBadge = (x: number, y: number, count: number): void => {
    const label = scene.add
      .text(x + thumbW / 2 - 4, y - thumbH / 2 + 4, `x${count}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        resolution: 2,
      })
      .setOrigin(1, 0);
    const badgeW = Math.max(34, Math.ceil(label.width + 10));
    const badge = scene.add.graphics();
    badge.fillStyle(theme.graphics.panelFill, 0.94);
    badge.fillRoundedRect(label.x - badgeW, label.y - 2, badgeW, BADGE_H, theme.radius.control);
    badge.lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
    badge.strokeRoundedRect(label.x - badgeW, label.y - 2, badgeW, BADGE_H, theme.radius.control);
    addGridItem(badge);
    addGridItem(label);
  };

  const renderPage = (nextPage: number): void => {
    page = Phaser.Math.Clamp(nextPage, 0, pageCount - 1);
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

    const start = page * PAGE_SIZE;
    for (const [i, entry] of opts.entries.slice(start, start + PAGE_SIZE).entries()) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = GRID_CX - ((GRID_COLS - 1) * COL_GAP) / 2 + col * COL_GAP;
      const y = GRID_TOP_Y + row * ROW_GAP;
      const thumb = makeCardThumb(scene, x, y, entry.card, THUMB_SCALE, entry.landStyle);
      thumb.setInteractive({ useHandCursor: true });
      bindTapButton(scene, thumb, (pointer) => {
        if (pointer.rightButtonReleased()) return;
        shell.close();
        opts.onInspect(entry.card, entry.landStyle);
      });
      inflateHitArea(thumb, 44, 44);
      thumb.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch) thumb.setTint(colorInt(theme.colors.gold));
      });
      thumb.on('pointerout', () => thumb.clearTint());
      addGridItem(thumb);
      addCountBadge(x, y, entry.count);
    }
    pageControl?.refresh(page, pageCount);
  };

  if (pageCount > 1) {
    pageControl = pager(scene, GRID_CX - 44, 632, page, pageCount, renderPage);
    container.add(pageControl.container);
  }
  renderPage(0);
  container.once('destroy', clearGrid);

  return { container, close: shell.close };
}
