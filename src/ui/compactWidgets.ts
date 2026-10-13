import Phaser from 'phaser';
import { bindTapButton } from '../platform/gestures';
import type { Rect } from './layout';
import { COMPACT, type CompactShell } from './compactLayout';
import { formatCount } from './goldFormat';
import { ellipsizeText } from './textFit';
import { menuNoticeLayout } from './mainMenuPresentation';
import { sceneStage } from './SceneBackdrop';
import { modalShell, type ModalShell } from './themeWidgets';
import { controlStrokeWidth, themedButtonColors, type ThemedButtonVariant } from './controlStyle';
import { colorInt, theme } from './theme';
import { bakeUiIcon, uiIconTinted, type UiIconName } from './uiIcons';

/**
 * The compact profile's drawn controls (docs/plan-mobile-overhaul.md C6):
 * the Version C plates, drawn exactly at the rect the scene's Phaser-free
 * layout gives them (src/ui/compactLayout.ts and each scene's own layout
 * module), in the same colours as the desktop's themed buttons. A rect is
 * already at least 44 px each way, so the plate is the tap area; nothing is
 * inflated past what is drawn. Labels use the compact type ramp.
 */

export interface CompactButtonOptions {
  variant?: ThemedButtonVariant;
  /** A drawn icon before the label (src/ui/uiIcons.ts). */
  icon?: UiIconName;
  /** Centre the icon and label (buttons) or start them at the left (list rows). */
  align?: 'center' | 'left';
  /** The label's size; the compact body size by default. */
  fontSize?: number;
  fontFamily?: string;
  /** Plate corner radius; rows use the panel radius, buttons the control one. */
  radius?: number;
  onTap: () => void;
}

export interface CompactButton {
  container: Phaser.GameObjects.Container;
  inputZone: Phaser.GameObjects.Zone;
  label: Phaser.GameObjects.Text;
  /** The x, in the container, where the label ends (for a trailing badge). */
  labelRight(): number;
  setLabel(label: string): void;
}

const ICON_GAP = 10;
const ROW_INSET = 16;

export function compactButton(scene: Phaser.Scene, rect: Rect, text: string, opts: CompactButtonOptions): CompactButton {
  const variant = opts.variant ?? 'ghost';
  const colors = themedButtonColors(variant);
  const radius = opts.radius ?? theme.radius.control;
  const fontSize = opts.fontSize ?? theme.compactType.body;
  const container = scene.add.container(rect.x, rect.y);
  const plate = scene.add.graphics();
  const label = scene.add.text(0, rect.height / 2, text, {
    fontFamily: opts.fontFamily ?? theme.fonts.ui,
    fontSize: `${fontSize}px`,
    fontStyle: theme.weight.w600,
    color: colors.fg,
  }).setOrigin(0, 0.5);
  const iconSize = Math.round(fontSize * 1.45);
  const icon = opts.icon
    ? scene.add.image(0, rect.height / 2, bakeUiIcon(scene, opts.icon)).setDisplaySize(iconSize, iconSize)
    : null;
  if (icon && opts.icon && uiIconTinted(opts.icon)) icon.setTint(colorInt(colors.fg));
  const place = (): void => {
    const contentW = (icon ? iconSize + (label.text ? ICON_GAP : 0) : 0) + label.width;
    const left = opts.align === 'left' ? ROW_INSET : Math.round((rect.width - contentW) / 2);
    icon?.setX(left + iconSize / 2);
    label.setX(left + (icon ? iconSize + ICON_GAP : 0));
  };
  place();
  const inputZone = scene.add.zone(rect.width / 2, rect.height / 2, rect.width, rect.height)
    .setInteractive({ useHandCursor: true });
  container.add([plate, ...(icon ? [icon] : []), label, inputZone]);

  let hovered = false;
  const redraw = (): void => {
    plate.clear()
      .fillStyle(colorInt(colors.bg), 1)
      .fillRoundedRect(0, 0, rect.width, rect.height, radius)
      .lineStyle(controlStrokeWidth(hovered, variant), colorInt(hovered ? colors.hoverStroke : colors.stroke),
        hovered ? 1 : theme.alpha.chrome)
      .strokeRoundedRect(0, 0, rect.width, rect.height, radius);
  };
  bindTapButton(scene, inputZone, () => opts.onTap());
  inputZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch) return;
    hovered = true;
    redraw();
  });
  inputZone.on('pointerout', () => {
    hovered = false;
    redraw();
  });
  redraw();
  return {
    container,
    inputZone,
    label,
    labelRight: () => label.x + label.width,
    setLabel: (next) => {
      label.setText(next);
      place();
    },
  };
}

/** A square icon-only button (Settings, full screen) on the ghost plate. */
export function compactIconButton(
  scene: Phaser.Scene,
  rect: Rect,
  icon: UiIconName,
  onTap: () => void,
): CompactButton & { setIcon(icon: UiIconName): void } {
  const button = compactButton(scene, rect, '', { icon, onTap, fontSize: 16 });
  const image = button.container.list.find((o): o is Phaser.GameObjects.Image => o instanceof Phaser.GameObjects.Image);
  return {
    ...button,
    setIcon: (next) => {
      image?.setTexture(bakeUiIcon(scene, next)).setDisplaySize(image.displayWidth, image.displayHeight);
    },
  };
}

/**
 * The gold pill at the top bar's right end (every compact screen that shows
 * the purse): the coin and the amount on a rounded plate, its right edge at
 * `right`. Returns its left edge, so a caller can place what sits beside it.
 */
export function compactGoldPill(scene: Phaser.Scene, right: number, centerY: number, height: number, gold: number): number {
  const type = theme.compactType;
  const plate = scene.add.graphics();
  const amount = scene.add.text(0, centerY, formatCount(gold), {
    fontFamily: theme.fonts.ui, fontSize: `${type.h2}px`, fontStyle: theme.weight.w600, color: theme.colors.gold,
  }).setOrigin(0, 0.5);
  const coinSize = Math.round(type.h2 * 1.15);
  const padX = 14;
  const gap = 8;
  const width = padX + coinSize + gap + amount.width + padX;
  const left = right - width;
  plate
    .fillStyle(theme.graphics.panelFill, theme.alpha.panel)
    .fillRoundedRect(left, centerY - height / 2, width, height, height / 2)
    .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
    .strokeRoundedRect(left, centerY - height / 2, width, height, height / 2);
  scene.add.image(left + padX + coinSize / 2, centerY, bakeUiIcon(scene, 'gold')).setDisplaySize(coinSize, coinSize);
  amount.setX(left + padX + coinSize + gap);
  return left;
}

export interface CompactHeader {
  back: CompactButton;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text | null;
}

/**
 * The top bar of every compact screen but the main menu (Version C): the back
 * chevron at the left, the title beside it with an optional one-line subtitle
 * under it, and the gold pill at the right when `gold` is given.
 */
export function compactHeader(
  scene: Phaser.Scene,
  shell: CompactShell,
  opts: { title: string; subtitle?: string; gold?: number; onBack: () => void },
): CompactHeader {
  const type = theme.compactType;
  const backRect = shell.back?.visual ?? { x: shell.title.x - COMPACT.touch - 12, y: shell.title.y, width: COMPACT.touch, height: COMPACT.touch };
  const back = compactIconButton(scene, backRect, 'back', opts.onBack);
  let titleRight = shell.title.x + shell.title.width;
  if (opts.gold !== undefined) {
    const left = compactGoldPill(scene, shell.right.x + shell.right.width, shell.right.y + shell.right.height / 2, 38, opts.gold);
    titleRight = Math.min(titleRight, left - COMPACT.gap);
  }
  const maxW = Math.max(0, titleRight - shell.title.x);
  const title = scene.add.text(shell.title.x, 0, opts.title, {
    fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
  });
  const subtitle = opts.subtitle
    ? scene.add.text(shell.title.x, 0, opts.subtitle, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
    })
    : null;
  if (subtitle) ellipsizeText(subtitle, maxW);
  ellipsizeText(title, maxW);
  // At larger text the two lines outgrow the bar; the subtitle is the
  // screen's flavour line, so it gives way and the title stays in the bar.
  let line = subtitle;
  if (line && title.height + line.height > shell.title.height) {
    line.destroy();
    line = null;
  }
  const block = title.height + (line ? line.height : 0);
  const top = shell.title.y + (shell.title.height - block) / 2;
  title.setY(top);
  line?.setY(top + title.height);
  return { back, title, subtitle: line };
}

/**
 * Cover-fit an image into `rect` (the source cropped to the rect, never
 * stretched). `biasUp` moves the crop up by that share of the rect's height,
 * so a portrait's face stays in frame.
 */
export function coverFitImage(image: Phaser.GameObjects.Image, rect: Rect, biasUp = 0): void {
  const scale = Math.max(rect.width / image.width, rect.height / image.height);
  image.setScale(scale);
  const cropW = Math.min(image.width, rect.width / scale);
  const cropH = Math.min(image.height, rect.height / scale);
  const cropX = (image.width - cropW) / 2;
  const cropY = Math.max(0, Math.min(image.height - cropH, (image.height - cropH) / 2 - (rect.height * biasUp) / scale));
  image.setCrop(cropX, cropY, cropW, cropH);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  image.setPosition(cx - (cropX + cropW / 2 - image.width / 2) * scale, cy - (cropY + cropH / 2 - image.height / 2) * scale);
}

/**
 * A scrim over the lower part of a tile, from `from` (a share of its height)
 * down, so text reads over any art. Stepped bands rather than a gradient
 * fill, which not every renderer draws.
 */
export function compactScrim(scene: Phaser.Scene, rect: Rect, from = 0.4, alpha = 0.94): Phaser.GameObjects.Graphics {
  const scrim = scene.add.graphics();
  const top = rect.y + rect.height * from;
  const bands = 12;
  const bandH = (rect.y + rect.height - top) / bands;
  for (let i = 0; i < bands; i++) {
    scrim.fillStyle(theme.graphics.panelFill, Math.min(alpha, ((i + 1) / bands) * 1.1));
    scrim.fillRect(rect.x, top + i * bandH, rect.width, Math.ceil(bandH));
  }
  return scrim;
}

export interface CompactDialogAction {
  label: string;
  onTap: (close: () => void) => void;
}

/** A compact dialog's width: the mocks' notices, never wider than the content box. */
export const COMPACT_DIALOG_W = 520;

/**
 * A compact notice (M-NoticeRepair, M-TutorialPrompt, the Play hub's launch
 * notices): the title, the message, and one or two equal footer buttons, the
 * safe choice left and the action right, in a modalShell sized to its text.
 * The caller guards its own targets after this returns and releases them in
 * `onClose`.
 */
export function compactDialog(
  scene: Phaser.Scene,
  opts: {
    title: string;
    message: string;
    secondary?: CompactDialogAction;
    primary: CompactDialogAction & { variant?: ThemedButtonVariant };
    dismissal?: 'mandatory' | 'dismissible';
    onClose: () => void;
  },
): ModalShell {
  const type = theme.compactType;
  const content = sceneStage(scene).content;
  const width = Math.min(COMPACT_DIALOG_W, content.width);
  const pad = theme.space(6);
  const title = scene.add.text(0, 0, opts.title, {
    fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    wordWrap: { width: width - 2 * pad },
  });
  const message = scene.add.text(0, 0, opts.message, {
    fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body,
    wordWrap: { width: width - 2 * pad }, lineSpacing: theme.space(1),
  });
  const layout = menuNoticeLayout(width, title.height, message.height);
  const shell = modalShell(scene, {
    width: layout.width, height: layout.height, titleTrackHeight: layout.titleTrackHeight,
    dismissal: opts.dismissal ?? 'mandatory', onClose: opts.onClose,
  });
  title.setPosition(shell.tracks.titleTrack.x, shell.tracks.titleTrack.y + (shell.tracks.titleTrack.height - title.height) / 2);
  message.setPosition(shell.tracks.contentBounds.x, shell.tracks.contentBounds.y);
  shell.container.add([title, message]);
  const footer = shell.tracks.footerTrack;
  const gap = theme.space(4);
  const close = (): void => shell.close();
  const half = (footer.width - gap) / 2;
  const primaryRect = opts.secondary
    ? { x: footer.x + half + gap, y: footer.y, width: half, height: footer.height }
    : { x: footer.x + footer.width - half, y: footer.y, width: half, height: footer.height };
  if (opts.secondary) {
    const secondary = opts.secondary;
    const left = compactButton(scene, { x: footer.x, y: footer.y, width: half, height: footer.height }, secondary.label, {
      onTap: () => secondary.onTap(close),
    });
    shell.container.add(left.container);
  }
  const right = compactButton(scene, primaryRect, opts.primary.label, {
    variant: opts.primary.variant ?? 'primary', onTap: () => opts.primary.onTap(close),
  });
  shell.container.add(right.container);
  return shell;
}

/**
 * The loading line's bar (mocks M-Loading, M-ArtWait): a thin track centred
 * at `centerX`, filled to the progress. Returns its setter (0..1).
 */
export function compactProgressBar(scene: Phaser.Scene, centerX: number, y: number, width = 200): {
  set: (progress: number) => void;
  graphics: Phaser.GameObjects.Graphics;
} {
  const g = scene.add.graphics();
  const set = (progress: number): void => {
    const p = Math.max(0, Math.min(1, progress));
    g.clear()
      .fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(centerX - width / 2, y - 2, width, 4, 2)
      .fillStyle(colorInt(theme.colors.muted), 1).fillRoundedRect(centerX - width / 2, y - 2, Math.max(4, width * p), 4, 2);
  };
  set(0);
  return { set, graphics: g };
}
