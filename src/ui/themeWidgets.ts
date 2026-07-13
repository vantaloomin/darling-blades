import Phaser from 'phaser';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { colorInt, theme } from './theme';
import {
  anchoredControlBounds,
  measureThemedButton,
  modalShellLayout,
  sceneHeaderFooterLayout,
  type ControlSize,
  type FocusMetadata,
  type HeaderFooterLayout,
  type ModalShellLayout,
  type Rect,
  type ThemedButtonMeasurement,
} from './layout';

export type ButtonVariant = 'primary' | 'emphasis' | 'ghost' | 'danger';
export type ButtonSize = ControlSize;

export interface ThemedButtonOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  minWidth?: number;
  padding?: number;
  onTap?: (pointer: Phaser.Input.Pointer) => void;
  enabled?: boolean;
  focus?: FocusMetadata;
}

export interface ThemedButton {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  inputZone: Phaser.GameObjects.Zone;
  /** Inert metadata for the future shared focus manager. */
  focus?: FocusMetadata;
  getMeasuredBounds(): ThemedButtonMeasurement;
  getMeasuredSize(): {
    visual: { width: number; height: number };
    hit: { width: number; height: number };
  };
  setLabel(label: string): void;
  setVariant(variant: ButtonVariant): void;
  setEnabled(enabled: boolean): void;
}

const BUTTON_STYLE: Record<ButtonVariant, { bg: string; fg: string; stroke: string; hoverStroke: string }> = {
  primary: { bg: theme.colors.btnPrimaryBg, fg: theme.colors.onGold, stroke: theme.colors.goldHover, hoverStroke: theme.colors.heading },
  emphasis: { bg: theme.colors.btnEmphasisBg, fg: theme.colors.gold, stroke: theme.colors.panelStroke, hoverStroke: theme.colors.goldHover },
  ghost: { bg: theme.colors.btnGhostBg, fg: theme.colors.body, stroke: theme.colors.panelStroke, hoverStroke: theme.colors.goldHover },
  danger: { bg: theme.colors.dangerBg, fg: theme.colors.danger, stroke: theme.colors.dangerArmed, hoverStroke: theme.colors.danger },
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
  const height = size === 'sm' ? theme.control.heightSm : theme.control.heightMd;
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
  let hovered = false;
  let measurement = measureThemedButton(label.width, size, opts.minWidth ?? 0, opts.padding);
  const redraw = (): void => {
    measurement = measureThemedButton(label.width, size, opts.minWidth ?? 0, opts.padding);
    background.clear();
    background.fillStyle(colorInt(style.bg), 1);
    background.fillRoundedRect(
      measurement.visual.x,
      measurement.visual.y,
      measurement.visual.width,
      measurement.visual.height,
      theme.radius.control,
    );
    background.lineStyle(
      theme.control.borderWidth,
      colorInt(hovered ? style.hoverStroke : style.stroke),
      hovered ? 1 : theme.alpha.chrome,
    );
    background.strokeRoundedRect(
      measurement.visual.x,
      measurement.visual.y,
      measurement.visual.width,
      measurement.visual.height,
      theme.radius.control,
    );
    inputZone.setSize(measurement.width, measurement.height);
    // The Zone is the input surface. Re-apply after every label update so a
    // Phaser size/input refresh cannot regress the minimum touch target.
    inflateHitArea(
      inputZone,
      measurement.hitWidth,
      measurement.hitHeight,
    );
  };
  const setEnabled = (next: boolean): void => {
    enabled = next;
    if (!enabled) hovered = false;
    container.setAlpha(enabled ? 1 : theme.alpha.subtle);
    if (enabled) inputZone.setInteractive({ useHandCursor: true });
    else inputZone.disableInteractive();
    redraw();
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
    if (!pointer.wasTouch && enabled) {
      hovered = true;
      redraw();
    }
  });
  inputZone.on('pointerout', () => {
    hovered = false;
    redraw();
  });
  redraw();
  setEnabled(enabled);

  const getMeasuredBounds = (): ThemedButtonMeasurement => ({
    ...measurement,
    visual: { ...measurement.visual },
    hit: { ...measurement.hit },
  });
  const getMeasuredSize = (): {
    visual: { width: number; height: number };
    hit: { width: number; height: number };
  } => ({
    visual: { width: measurement.visual.width, height: measurement.visual.height },
    hit: { width: measurement.hit.width, height: measurement.hit.height },
  });
  return {
    container,
    background,
    label,
    inputZone,
    focus: opts.focus,
    getMeasuredBounds,
    getMeasuredSize,
    setLabel,
    setVariant,
    setEnabled,
  };
}

export interface RoundedTriggerOptions {
  variant?: Extract<ButtonVariant, 'emphasis' | 'ghost'>;
  size?: ButtonSize;
  minWidth?: number;
  padding?: number;
  selected?: boolean;
  enabled?: boolean;
  onTap?: (pointer: Phaser.Input.Pointer) => void;
  focus?: FocusMetadata;
}

export interface RoundedTrigger {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  /** The only interactive object; the containing chrome stays unscaled. */
  inputZone: Phaser.GameObjects.Zone;
  /** Inert metadata for the future shared focus manager. */
  focus?: FocusMetadata;
  getMeasuredBounds(): ThemedButtonMeasurement;
  getMeasuredSize(): {
    visual: { width: number; height: number };
    hit: { width: number; height: number };
  };
  setLabel(label: string): void;
  setVariant(variant: Extract<ButtonVariant, 'emphasis' | 'ghost'>): void;
  setSelected(selected: boolean): void;
  setEnabled(enabled: boolean): void;
}

/**
 * Rounded select/toggle chrome with a stable visual box and an unscaled Zone
 * input. The x/y API is top-left for compatibility with the older flat Text
 * controls; the internal container remains centered like themedButton.
 */
export function roundedTrigger(
  scene: Phaser.Scene,
  x: number,
  y: number,
  initialLabel: string,
  opts: RoundedTriggerOptions = {},
): RoundedTrigger {
  let variant = opts.variant ?? 'ghost';
  const size = opts.size ?? 'md';
  let selected = opts.selected ?? false;
  let enabled = opts.enabled ?? true;
  let hovered = false;
  let pressed = false;
  let style = BUTTON_STYLE[variant];
  const height = size === 'sm' ? theme.control.heightSm : theme.control.heightMd;
  const fontSize = size === 'sm' ? theme.type.caption : theme.type.label;
  const container = scene.add.container(0, 0);
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

  let measurement = measureThemedButton(label.width, size, opts.minWidth ?? 0, opts.padding);
  const activeStyle = (): { bg: string; fg: string; stroke: string; hoverStroke: string } =>
    selected && variant === 'ghost' ? BUTTON_STYLE.emphasis : style;
  const place = (): void => {
    container.setPosition(x + measurement.visual.width / 2, y);
  };
  const redraw = (): void => {
    measurement = measureThemedButton(label.width, size, opts.minWidth ?? 0, opts.padding);
    const stateStyle = activeStyle();
    background.clear();
    background.fillStyle(colorInt(stateStyle.bg), 1);
    background.fillRoundedRect(
      measurement.visual.x,
      measurement.visual.y,
      measurement.visual.width,
      measurement.visual.height,
      theme.radius.control,
    );
    background.lineStyle(
      theme.control.borderWidth,
      colorInt(hovered || pressed ? stateStyle.hoverStroke : stateStyle.stroke),
      hovered || pressed ? 1 : theme.alpha.chrome,
    );
    background.strokeRoundedRect(
      measurement.visual.x,
      measurement.visual.y,
      measurement.visual.width,
      measurement.visual.height,
      theme.radius.control,
    );
    label.setColor(stateStyle.fg);
    inputZone.setSize(measurement.width, measurement.height);
    // The Zone is the input surface. Re-apply after every label update so its
    // minimum touch target remains explicit even when Phaser refreshes size.
    inflateHitArea(inputZone, measurement.hitWidth, measurement.hitHeight);
    place();
  };
  const setEnabled = (next: boolean): void => {
    enabled = next;
    if (!enabled) {
      hovered = false;
      pressed = false;
    }
    container.setAlpha(enabled ? 1 : theme.alpha.subtle);
    if (enabled) inputZone.setInteractive({ useHandCursor: true });
    else inputZone.disableInteractive();
    redraw();
  };
  const setLabel = (next: string): void => {
    label.setText(next);
    redraw();
  };
  const setVariant = (next: Extract<ButtonVariant, 'emphasis' | 'ghost'>): void => {
    variant = next;
    style = BUTTON_STYLE[next];
    redraw();
  };
  const setSelected = (next: boolean): void => {
    selected = next;
    redraw();
  };

  bindTapButton(scene, inputZone, (pointer) => {
    if (enabled) opts.onTap?.(pointer);
  });
  inputZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch && enabled) {
      hovered = true;
      redraw();
    }
  });
  inputZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch && enabled) {
      pressed = true;
      redraw();
    }
  });
  inputZone.on('pointerup', () => {
    if (pressed) {
      pressed = false;
      redraw();
    }
  });
  inputZone.on('pointerout', () => {
    hovered = false;
    pressed = false;
    redraw();
  });
  redraw();
  setEnabled(enabled);

  // Existing scene consumers use Dropdown.button.setDepth(). Forward that
  // call to the visual container while retaining the Zone as the guard target.
  const zoneSetDepth = inputZone.setDepth.bind(inputZone);
  inputZone.setDepth = (depth: number): Phaser.GameObjects.Zone => {
    container.setDepth(depth);
    zoneSetDepth(depth);
    return inputZone;
  };

  const getMeasuredBounds = (): ThemedButtonMeasurement => ({
    ...measurement,
    visual: { ...measurement.visual },
    hit: { ...measurement.hit },
  });
  const getMeasuredSize = (): {
    visual: { width: number; height: number };
    hit: { width: number; height: number };
  } => ({
    visual: { width: measurement.visual.width, height: measurement.visual.height },
    hit: { width: measurement.hit.width, height: measurement.hit.height },
  });
  return {
    container,
    background,
    label,
    inputZone,
    focus: opts.focus,
    getMeasuredBounds,
    getMeasuredSize,
    setLabel,
    setVariant,
    setSelected,
    setEnabled,
  };
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
    .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, opts.strokeAlpha ?? theme.alpha.chrome)
    .strokeRoundedRect(x, y, width, height, opts.radius ?? theme.radius.panel);
}

export type SceneFooterAction = Omit<ThemedButtonOptions, 'onTap'> & {
  label: string;
  onTap?: (pointer: Phaser.Input.Pointer) => void;
};

export interface SceneHeaderFooterOptions {
  title: string;
  onBack?: (pointer: Phaser.Input.Pointer) => void;
  currency?: GoldBadgeOptions;
  footerActions?: readonly SceneFooterAction[];
  depth?: number;
  focus?: FocusMetadata;
  backFocus?: FocusMetadata;
}

export interface SceneHeaderFooter {
  container: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  currency: GoldBadge;
  footerActions: ThemedButton[];
  layout: HeaderFooterLayout;
  /** Inert metadata for a future focus registration pass. */
  focus?: FocusMetadata;
}

/** Safe-anchored page chrome for Wave 2 scene adoption. */
export function sceneHeaderFooter(
  scene: Phaser.Scene,
  opts: SceneHeaderFooterOptions,
): SceneHeaderFooter {
  const back = backButton(scene, opts.onBack, { focus: opts.backFocus });
  const title = scene.add
    .text(0, 0, opts.title, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h1}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.heading,
    })
    .setOrigin(0.5);
  const currency = goldBadge(scene, 0, 0, opts.currency);
  const footerActions = (opts.footerActions ?? []).map((action) => {
    const { label, ...buttonOpts } = action;
    return themedButton(scene, 0, 0, label, buttonOpts);
  });
  const layout = sceneHeaderFooterLayout({
    backVisual: { width: back.width, height: back.height },
    titleVisual: { width: title.width, height: title.height },
    currencyVisual: { width: currency.text.width, height: currency.text.height },
    footerActionVisuals: footerActions.map((action) => {
      const size = action.getMeasuredSize().visual;
      return { width: size.width, height: size.height };
    }),
  });
  back.setPosition(layout.back.visual.x, layout.back.visual.y + layout.back.visual.height / 2);
  title.setPosition(layout.title.x + layout.title.width / 2, layout.title.y + layout.title.height / 2);
  currency.text.setPosition(
    layout.currency.x + layout.currency.width,
    layout.currency.y + layout.currency.height / 2,
  );
  footerActions.forEach((action, index) => {
    const visual = layout.footerActions[index].visual;
    action.container.setPosition(visual.x + visual.width / 2, visual.y + visual.height / 2);
  });
  const container = scene.add
    .container(0, 0, [back, title, currency.text, ...footerActions.map((action) => action.container)])
    .setDepth(opts.depth ?? theme.depth.hud);
  return { container, back, title, currency, footerActions, layout, focus: opts.focus };
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
  panelPadding?: number;
  trackGap?: number;
  titleTrackHeight?: number;
  footerTrackHeight?: number;
  focus?: FocusMetadata;
}

export interface ModalShell {
  container: Phaser.GameObjects.Container;
  dim: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Graphics;
  closeButton?: ThemedButton;
  interactiveChildren: Phaser.GameObjects.GameObject[];
  tracks: Pick<ModalShellLayout, 'titleTrack' | 'contentBounds' | 'footerTrack' | 'closeTrack'>;
  contentBounds: Rect;
  /** Inert metadata for the future shared focus manager. */
  focus?: FocusMetadata;
  close(): void;
}

/** Standardized modal chrome; callers retain ownership of ModalGuard lists. */
export function modalShell(scene: Phaser.Scene, opts: ModalShellOptions): ModalShell {
  const x = opts.x ?? theme.design.centerX;
  const y = opts.y ?? theme.design.centerY;
  const dim = scene.add.rectangle(
    theme.design.centerX,
    theme.design.centerY,
    theme.design.width,
    theme.design.height,
    theme.graphics.dim,
    opts.dimAlpha ?? theme.alpha.overlayDim,
  );
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
    closeButton = themedButton(scene, 0, 0, '×', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 30,
      onTap: close,
    });
    container.add(closeButton.container);
    interactiveChildren.push(closeButton.inputZone);
  }
  const closeSize = closeButton?.getMeasuredSize().hit ?? {
    width: theme.control.minHitWidth,
    height: theme.control.minHitHeight,
  };
  const layout = modalShellLayout({
    width: opts.width,
    height: opts.height,
    x,
    y,
    panelPadding: opts.panelPadding,
    trackGap: opts.trackGap,
    titleTrackHeight: opts.titleTrackHeight,
    footerTrackHeight: opts.footerTrackHeight,
    closeHitWidth: closeSize.width,
    closeHitHeight: closeSize.height,
  });
  if (closeButton) {
    closeButton.container.setPosition(
      layout.closeTrack.x + layout.closeTrack.width / 2,
      layout.closeTrack.y + layout.closeTrack.height / 2,
    );
  }
  if (escToClose) scene.input.keyboard?.on('keydown-ESC', close);
  container.once('destroy', cleanup);
  return {
    container,
    dim,
    panel: chrome,
    closeButton,
    interactiveChildren,
    tracks: {
      titleTrack: layout.titleTrack,
      contentBounds: layout.contentBounds,
      footerTrack: layout.footerTrack,
      closeTrack: layout.closeTrack,
    },
    contentBounds: layout.contentBounds,
    focus: opts.focus,
    close,
  };
}

/** The single shared back affordance for future scene migrations. */
export interface BackButtonOptions {
  focus?: FocusMetadata;
}

type FocusableText = Phaser.GameObjects.Text & { focusMetadata?: FocusMetadata };

export function backButton(
  scene: Phaser.Scene,
  onTap: (pointer: Phaser.Input.Pointer) => void = () => scene.scene.start('MainMenu'),
  opts: BackButtonOptions = {},
): FocusableText {
  const button = scene.add
    .text(0, 0, '← Menu', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.label}px`,
      fontStyle: theme.weight.w600,
      color: theme.colors.gold,
    })
    .setOrigin(0, 0.5)
    .setInteractive({ useHandCursor: true });
  const placement = anchoredControlBounds('top-left', button.width, button.height);
  button.setPosition(placement.visual.x, placement.visual.y + placement.visual.height / 2);
  bindTapButton(scene, button, onTap);
  inflateHitArea(button, theme.control.minHitWidth, theme.control.minHitHeight);
  button.on('pointerover', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch) {
      button.setColor(theme.colors.goldHover);
      inflateHitArea(button, theme.control.minHitWidth, theme.control.minHitHeight);
    }
  });
  button.on('pointerout', (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch) {
      button.setColor(theme.colors.gold);
      inflateHitArea(button, theme.control.minHitWidth, theme.control.minHitHeight);
    }
  });
  const focusable = button as FocusableText;
  focusable.focusMetadata = opts.focus;
  return focusable;
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
        duration: theme.motion.fast,
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
  focus?: FocusMetadata;
  previousFocus?: FocusMetadata;
  nextFocus?: FocusMetadata;
  refresh(page: number, pageCount: number): void;
}

export interface PagerOptions {
  focus?: FocusMetadata;
  previousFocus?: FocusMetadata;
  nextFocus?: FocusMetadata;
}

export function pager(
  scene: Phaser.Scene,
  x: number,
  y: number,
  page: number,
  pageCount: number,
  onChange: (page: number) => void,
  opts: PagerOptions = {},
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
  const setDirectionEnabled = (button: Phaser.GameObjects.Text, enabled: boolean): void => {
    if (enabled) button.setInteractive({ useHandCursor: true });
    else button.disableInteractive();
    inflateHitArea(button, theme.control.minHitHeight, theme.control.minHitHeight);
  };
  const refresh = (nextPage: number, nextPageCount: number): void => {
    current = nextPage;
    total = Math.max(1, nextPageCount);
    label.setText(`${current + 1} / ${total}`);
    const previousEnabled = current > 0;
    const nextEnabled = current < total - 1;
    previous.setAlpha(previousEnabled ? 1 : theme.alpha.subtle);
    next.setAlpha(nextEnabled ? 1 : theme.alpha.subtle);
    setDirectionEnabled(previous, previousEnabled);
    setDirectionEnabled(next, nextEnabled);
  };
  for (const [button, delta] of [[previous, -1], [next, 1]] as const) {
    bindTapButton(scene, button, () => {
      const target = current + delta;
      if (target >= 0 && target < total) onChange(target);
    });
  }
  refresh(page, pageCount);
  return {
    container,
    previous,
    next,
    label,
    focus: opts.focus,
    previousFocus: opts.previousFocus,
    nextFocus: opts.nextFocus,
    refresh,
  };
}
