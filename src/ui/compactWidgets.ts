import Phaser from 'phaser';
import { bindTapButton } from '../platform/gestures';
import type { Rect } from './layout';
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
