import Phaser from 'phaser';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { colorInt, theme } from './theme';

type ButtonVariant = 'primary' | 'emphasis' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm';

export interface ThemedButtonOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  minWidth?: number;
  onTap?: (pointer: Phaser.Input.Pointer) => void;
  enabled?: boolean;
}

export interface ThemedButton {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  inputZone: Phaser.GameObjects.Zone;
  setLabel(label: string): void;
  setVariant(variant: ButtonVariant): void;
  setEnabled(enabled: boolean): void;
}

const BUTTON_STYLE: Record<ButtonVariant, { bg: string; fg: string; stroke: string }> = {
  primary: { bg: theme.colors.btnPrimaryBg, fg: theme.colors.onGold, stroke: theme.colors.goldHover },
  emphasis: { bg: theme.colors.btnEmphasisBg, fg: theme.colors.gold, stroke: theme.colors.panelStroke },
  ghost: { bg: theme.colors.btnGhostBg, fg: theme.colors.body, stroke: theme.colors.panelStroke },
  danger: { bg: theme.colors.dangerBg, fg: theme.colors.danger, stroke: theme.colors.dangerArmed },
};

/** Rounded button chrome with an explicit Zone input target (never the container). */
export function themedButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  initialLabel: string,
  opts: ThemedButtonOptions = {},
): ThemedButton {
  const variant = opts.variant ?? 'ghost';
  const size = opts.size ?? 'md';
  let style = BUTTON_STYLE[variant];
  const height = size === 'sm' ? 30 : 40;
  const padding = size === 'sm' ? theme.space(2) : theme.space(3);
  const fontSize = size === 'sm' ? theme.type.caption : theme.type.label;
  const container = scene.add.container(x, y);
  const background = scene.add.graphics();
  const label = scene.add
    .text(0, 0, initialLabel, {
      fontFamily: theme.fonts.ui,
      fontSize: `${fontSize}px`,
      fontStyle: theme.weight.w600,
      color: style.fg,
    })
    .setOrigin(0.5);
  const inputZone = scene.add.zone(0, 0, 1, height).setInteractive({ useHandCursor: true });
  container.add([background, label, inputZone]);

  let enabled = opts.enabled ?? true;
  const redraw = (): void => {
    const width = Math.max(opts.minWidth ?? 0, Math.ceil(label.width + padding * 2));
    background.clear();
    background.fillStyle(colorInt(style.bg), 1);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, theme.radius.control);
    background.lineStyle(1, colorInt(style.stroke), theme.alpha.chrome);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, theme.radius.control);
    inputZone.setSize(width, height);
    // The Zone is the input surface. Re-apply after every label update so a
    // Phaser size/input refresh cannot regress the minimum touch target.
    inflateHitArea(inputZone, Math.max(90, width), Math.max(44, height));
  };
  const setEnabled = (next: boolean): void => {
    enabled = next;
    container.setAlpha(enabled ? 1 : theme.alpha.subtle);
    if (enabled) inputZone.setInteractive({ useHandCursor: true });
    else inputZone.disableInteractive();
  };
  const setLabel = (next: string): void => {
    label.setText(next);
    redraw();
  };
  const setVariant = (next: ButtonVariant): void => {
    style = BUTTON_STYLE[next];
    label.setColor(style.fg);
    redraw();
  };

  bindTapButton(scene, inputZone, (pointer) => {
    if (enabled) opts.onTap?.(pointer);
  });
  inputZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch && enabled) background.setAlpha(1);
  });
  inputZone.on('pointerout', () => background.setAlpha(1));
  redraw();
  setEnabled(enabled);

  return { container, background, label, inputZone, setLabel, setVariant, setEnabled };
}

export interface PanelOptions {
  alpha?: number;
  strokeAlpha?: number;
  radius?: number;
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: PanelOptions = {},
): Phaser.GameObjects.Graphics {
  return scene.add
    .graphics()
    .fillStyle(theme.graphics.panelFill, opts.alpha ?? theme.alpha.panel)
    .fillRoundedRect(x, y, width, height, opts.radius ?? theme.radius.panel)
    .lineStyle(1, theme.graphics.panelStroke, opts.strokeAlpha ?? theme.alpha.chrome)
    .strokeRoundedRect(x, y, width, height, opts.radius ?? theme.radius.panel);
}

export interface ModalShellOptions {
  width: number;
  height: number;
  x?: number;
  y?: number;
  dimAlpha?: number;
  escToClose?: boolean;
  depth?: number;
  showClose?: boolean;
  tapDimToClose?: boolean;
  onClose?: () => void;
}

export interface ModalShell {
  container: Phaser.GameObjects.Container;
  dim: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Graphics;
  closeButton?: ThemedButton;
  interactiveChildren: Phaser.GameObjects.GameObject[];
  close(): void;
}

/** Standardized modal chrome; callers retain ownership of ModalGuard lists. */
export function modalShell(scene: Phaser.Scene, opts: ModalShellOptions): ModalShell {
  const x = opts.x ?? 640;
  const y = opts.y ?? 360;
  const dim = scene.add.rectangle(640, 360, 1280, 720, theme.graphics.dim, opts.dimAlpha ?? theme.alpha.overlayDim);
  const chrome = panel(scene, x - opts.width / 2, y - opts.height / 2, opts.width, opts.height);
  const container = scene.add.container(0, 0, [dim, chrome]).setDepth(opts.depth ?? theme.depth.modal);
  const interactiveChildren: Phaser.GameObjects.GameObject[] = [];
  const escToClose = opts.escToClose ?? true;
  let closed = false;
  const cleanup = (): void => {
    if (escToClose) scene.input.keyboard?.off('keydown-ESC', close);
  };
  const close = (): void => {
    if (closed) return;
    closed = true;
    cleanup();
    opts.onClose?.();
    if (container.active) container.destroy();
  };

  if (opts.tapDimToClose) {
    dim.setInteractive({ useHandCursor: true });
    bindTapButton(scene, dim, (pointer) => {
      if (!pointer.rightButtonReleased()) close();
    });
  } else {
    dim.setInteractive();
  }
  interactiveChildren.push(dim);
  let closeButton: ThemedButton | undefined;
  if (opts.showClose ?? true) {
    closeButton = themedButton(scene, x + opts.width / 2 - theme.space(4), y - opts.height / 2 + theme.space(4), '×', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 30,
      onTap: close,
    });
    container.add(closeButton.container);
    interactiveChildren.push(closeButton.inputZone);
  }
  if (escToClose) scene.input.keyboard?.on('keydown-ESC', close);
  container.once('destroy', cleanup);
  return { container, dim, panel: chrome, closeButton, interactiveChildren, close };
}

/** The single shared back affordance for future scene migrations. */
export function backButton(
  scene: Phaser.Scene,
  onTap: (pointer: Phaser.Input.Pointer) => void = () => scene.scene.start('MainMenu'),
): Phaser.GameObjects.Text {
  const button = scene.add
    .text(28, 28, '← Menu', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.label}px`,
      fontStyle: theme.weight.w600,
      color: theme.colors.gold,
    })
    .setInteractive({ useHandCursor: true });
  bindTapButton(scene, button, onTap);
  inflateHitArea(button, 90, 44);
  button.on('pointerover', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch) {
      button.setColor(theme.colors.goldHover);
      inflateHitArea(button, 90, 44);
    }
  });
  button.on('pointerout', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch) {
      button.setColor(theme.colors.gold);
      inflateHitArea(button, 90, 44);
    }
  });
  return button;
}

export interface GoldBadgeOptions {
  getValue?: () => number;
  flashOnChange?: boolean;
}

export interface GoldBadge {
  text: Phaser.GameObjects.Text;
  refresh(value?: number): void;
}

export function goldBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: GoldBadgeOptions = {},
): GoldBadge {
  const text = scene.add
    .text(x, y, '🪙 0', {
      fontFamily: theme.fonts.ui,
      fontSize: '20px',
      fontStyle: theme.weight.w600,
      color: theme.colors.gold,
    })
    .setOrigin(1, 0.5);
  let lastValue: number | null = null;
  const refresh = (value = opts.getValue?.() ?? 0): void => {
    const changed = lastValue !== null && value !== lastValue;
    lastValue = value;
    text.setText(`🪙 ${value}`);
    if (changed && opts.flashOnChange && text.active) {
      scene.tweens.add({
        targets: text,
        alpha: 0.35,
        yoyo: true,
        duration: 100,
        repeat: 1,
        onComplete: () => {
          if (text.active) text.setAlpha(1);
        },
      });
    }
  };
  refresh();
  return { text, refresh };
}

export interface Pager {
  container: Phaser.GameObjects.Container;
  previous: Phaser.GameObjects.Text;
  next: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  refresh(page: number, pageCount: number): void;
}

export function pager(
  scene: Phaser.Scene,
  x: number,
  y: number,
  page: number,
  pageCount: number,
  onChange: (page: number) => void,
): Pager {
  // All three share the y centerline (the chevrons' old top-origin hung them
  // below the middle-anchored label), and the label centers BETWEEN the
  // chevrons so "1 / 1" and "10 / 12" both sit symmetric (user-reported
  // 2026-07-12).
  const previous = scene.add.text(x, y, '‹', { fontFamily: theme.fonts.display, fontSize: '24px', color: theme.colors.gold }).setOrigin(0, 0.5);
  const label = scene.add.text(x + 51, y, '', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, color: theme.colors.body }).setOrigin(0.5);
  const next = scene.add.text(x + 88, y, '›', { fontFamily: theme.fonts.display, fontSize: '24px', color: theme.colors.gold }).setOrigin(0, 0.5);
  const container = scene.add.container(0, 0, [previous, label, next]);
  let current = page;
  let total = pageCount;
  const refresh = (nextPage: number, nextPageCount: number): void => {
    current = nextPage;
    total = Math.max(1, nextPageCount);
    label.setText(`${current + 1} / ${total}`);
    previous.setAlpha(current > 0 ? 1 : theme.alpha.subtle);
    next.setAlpha(current < total - 1 ? 1 : theme.alpha.subtle);
  };
  for (const [button, delta] of [[previous, -1], [next, 1]] as const) {
    button.setInteractive({ useHandCursor: true });
    bindTapButton(scene, button, () => {
      const target = current + delta;
      if (target >= 0 && target < total) onChange(target);
    });
    inflateHitArea(button, 44, 44);
  }
  refresh(page, pageCount);
  return { container, previous, next, label, refresh };
}
