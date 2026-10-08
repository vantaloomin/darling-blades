import Phaser from 'phaser';
import { bindTapButton } from '../platform/gestures';
import { controlStrokeWidth, themedButtonColors } from './controlStyle';
import type { Rect } from './layout';
import { colorInt, theme } from './theme';

export interface MenuNavButtonOptions {
  label: string;
  /** Primary: the screen's one gold action, with a display-font label. */
  primary?: boolean;
  /** A second line under the label (the primary plate only). */
  sublabel?: string;
  /** Right-aligned trailing text, such as a progress count. */
  trailing?: string;
  onTap: () => void;
}

export interface MenuNavButton {
  container: Phaser.GameObjects.Container;
  inputZone: Phaser.GameObjects.Zone;
  /** The local x where trailing content ends, for a badge placed beside it. */
  trailingLeft: number;
}

const INSET = theme.space(5);

/**
 * A main-menu nav plate: a full-width, left-aligned row (the approved
 * 2026-10-08 menu). The Zone is the input surface, never the container, and
 * it covers the whole plate, which is always at least the 44px hit height.
 */
export function menuNavButton(scene: Phaser.Scene, rect: Rect, opts: MenuNavButtonOptions): MenuNavButton {
  const variant = opts.primary ? 'primary' : 'ghost';
  const colors = themedButtonColors(variant);
  const container = scene.add.container(rect.x, rect.y);
  const plate = scene.add.graphics();
  const label = scene.add.text(INSET, rect.height / 2, opts.label, {
    fontFamily: opts.primary ? theme.fonts.display : theme.fonts.ui,
    fontSize: `${opts.primary ? theme.type.display : theme.type.body}px`,
    fontStyle: theme.weight.w600,
    color: colors.fg,
  }).setOrigin(0, 0.5);
  const children: Phaser.GameObjects.GameObject[] = [plate, label];
  if (opts.sublabel) {
    const sub = scene.add.text(INSET, 0, opts.sublabel, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.label}px`,
      fontStyle: theme.weight.w600,
      color: colors.fg,
      wordWrap: { width: rect.width - 2 * INSET, useAdvancedWrap: true },
    }).setOrigin(0, 0).setAlpha(0.8);
    // Centre the two-line stack on the plate.
    const gap = theme.space(1);
    const top = (rect.height - label.height - gap - sub.height) / 2;
    label.setOrigin(0, 0).setY(top);
    sub.setY(top + label.height + gap);
    children.push(sub);
  }
  let trailingLeft = rect.width - INSET;
  if (opts.trailing) {
    const trailing = scene.add.text(rect.width - INSET, rect.height / 2, opts.trailing, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.label}px`,
      color: theme.colors.muted,
    }).setOrigin(1, 0.5);
    trailingLeft = trailing.x - trailing.width;
    children.push(trailing);
  }
  const inputZone = scene.add.zone(rect.width / 2, rect.height / 2, rect.width, rect.height)
    .setInteractive({ useHandCursor: true });
  children.push(inputZone);
  container.add(children);

  let hovered = false;
  const redraw = (): void => {
    plate.clear()
      .fillStyle(colorInt(colors.bg), 1)
      .fillRoundedRect(0, 0, rect.width, rect.height, theme.radius.panel)
      .lineStyle(controlStrokeWidth(hovered, variant), colorInt(hovered ? colors.hoverStroke : colors.stroke),
        hovered ? 1 : theme.alpha.chrome)
      .strokeRoundedRect(0, 0, rect.width, rect.height, theme.radius.panel);
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
  return { container, inputZone, trailingLeft };
}
