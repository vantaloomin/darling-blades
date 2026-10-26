import Phaser from 'phaser';
import { bindTapButton } from '../platform/gestures';
import type { Rect } from './layout';
import { COMPACT, type CompactShell } from './compactLayout';
import { formatCount } from './goldFormat';
import { ellipsizeText } from './textFit';
import { menuNoticeLayout } from './mainMenuPresentation';
import { sceneStage } from './SceneBackdrop';
import { bindMenuScroll } from './menuScroll';
import { createSearchInput, type SearchInputHandle } from './SearchInput';
import { goldBadge, modalShell, panel, type GoldBadge, type ModalShell, type ModalShellOptions } from './themeWidgets';
import { controlStrokeWidth, themedButtonColors, type ThemedButtonVariant } from './controlStyle';
import { colorInt, theme } from './theme';
import { bakeUiIcon, uiIconSize, uiIconTinted, type UiIconName } from './uiIcons';
import { splitIconLabel } from './iconLabel';

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
  /** With `align: 'left'`, where the icon or label starts; 16 px by default. */
  inset?: number;
  /** Plate corner radius; rows use the panel radius, buttons the control one. */
  radius?: number;
  onTap: (pointer: Phaser.Input.Pointer) => void;
}

/** A press that travelled this far (a scroll's drag) is not a tap. */
export const COMPACT_DRAG_SLOP = 12;
const dragged = (pointer: Phaser.Input.Pointer): boolean => Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP;

export interface CompactButton {
  container: Phaser.GameObjects.Container;
  inputZone: Phaser.GameObjects.Zone;
  label: Phaser.GameObjects.Text;
  /** The x, in the container, where the label ends (for a trailing badge). */
  labelRight(): number;
  setLabel(label: string): void;
  /** Redraw in another variant (a jump list's current section, an armed action). */
  setVariant(variant: ThemedButtonVariant): void;
  /** Off: drawn faded and deaf to taps (Replace save until a code is previewed). */
  setEnabled(enabled: boolean): void;
}

const ICON_GAP = 10;
const INLINE_GAP = 6;
const ROW_INSET = 16;

export function compactButton(scene: Phaser.Scene, rect: Rect, text: string, opts: CompactButtonOptions): CompactButton {
  let variant = opts.variant ?? 'ghost';
  let colors = themedButtonColors(variant);
  const radius = opts.radius ?? theme.radius.control;
  const fontSize = opts.fontSize ?? theme.compactType.body;
  const container = scene.add.container(rect.x, rect.y);
  const plate = scene.add.graphics();
  const style = {
    fontFamily: opts.fontFamily ?? theme.fonts.ui,
    fontSize: `${fontSize}px`,
    fontStyle: theme.weight.w600,
    color: colors.fg,
  };
  const label = scene.add.text(0, rect.height / 2, '', style).setOrigin(0, 0.5);
  const iconSize = Math.round(fontSize * 1.45);
  const icon = opts.icon
    ? scene.add.image(0, rect.height / 2, bakeUiIcon(scene, opts.icon)).setDisplaySize(iconSize, iconSize)
    : null;
  if (icon && opts.icon && uiIconTinted(opts.icon)) icon.setTint(colorInt(colors.fg));
  // A label may carry one icon inside it (`Buy · {gold} 525`): the text before
  // it, the icon at the text's size, then the rest.
  const inlineSize = uiIconSize(fontSize);
  const tail = scene.add.text(0, rect.height / 2, '', style).setOrigin(0, 0.5);
  let inline: { image: Phaser.GameObjects.Image; name: UiIconName } | null = null;
  const applyText = (next: string): void => {
    const split = opts.icon ? null : splitIconLabel(next);
    label.setText(split ? split.head : next);
    tail.setText(split ? split.tail : '');
    if (split) {
      if (!inline) {
        inline = { image: scene.add.image(0, rect.height / 2, bakeUiIcon(scene, split.icon)), name: split.icon };
        container.addAt(inline.image, container.getIndex(tail));
      }
      inline.name = split.icon;
      inline.image.setTexture(bakeUiIcon(scene, split.icon)).setDisplaySize(inlineSize, inlineSize).setVisible(true);
      tintInline();
    } else inline?.image.setVisible(false);
  };
  const tintInline = (): void => {
    if (!inline) return;
    if (uiIconTinted(inline.name)) inline.image.setTint(colorInt(colors.fg));
    else inline.image.clearTint();
  };
  const inlineShown = (): boolean => inline?.image.visible ?? false;
  const place = (): void => {
    const inlineW = inlineShown() ? INLINE_GAP + inlineSize + INLINE_GAP + tail.width : 0;
    const contentW = (icon ? iconSize + (label.text ? ICON_GAP : 0) : 0) + label.width + inlineW;
    const left = opts.align === 'left' ? opts.inset ?? ROW_INSET : Math.round((rect.width - contentW) / 2);
    icon?.setX(left + iconSize / 2);
    label.setX(left + (icon ? iconSize + ICON_GAP : 0));
    if (inline && inlineShown()) {
      inline.image.setX(label.x + label.width + INLINE_GAP + inlineSize / 2);
      tail.setX(label.x + label.width + INLINE_GAP + inlineSize + INLINE_GAP);
    }
  };
  const inputZone = scene.add.zone(rect.width / 2, rect.height / 2, rect.width, rect.height)
    .setInteractive({ useHandCursor: true });
  container.add([plate, ...(icon ? [icon] : []), label, tail, inputZone]);
  applyText(text);
  place();

  let pointerState: PointerState = 'idle';
  let enabled = true;
  const redraw = (): void => {
    if (!plate.scene) return;
    // A faded (disabled) button shows no pointer state.
    const state = enabled ? pointerState : 'idle';
    const hovered = state !== 'idle';
    plate.clear()
      .fillStyle(colorInt(colors.bg), 1)
      .fillRoundedRect(0, 0, rect.width, rect.height, radius);
    if (hovered) plate.fillStyle(POINTER_WASH.color, washAlpha(state)).fillRoundedRect(0, 0, rect.width, rect.height, radius);
    plate.lineStyle(controlStrokeWidth(hovered, variant), colorInt(hovered ? colors.hoverStroke : colors.stroke),
      hovered ? 1 : theme.alpha.chrome)
      .strokeRoundedRect(0, 0, rect.width, rect.height, radius);
  };
  bindTapButton(scene, inputZone, (pointer) => {
    if (enabled && !dragged(pointer)) opts.onTap(pointer);
  });
  bindPointerState(inputZone, (state) => {
    pointerState = state;
    redraw();
  });
  redraw();
  return {
    container,
    inputZone,
    label,
    labelRight: () => (inlineShown() ? tail.x + tail.width : label.x + label.width),
    setLabel: (next) => {
      applyText(next);
      place();
    },
    setVariant: (next) => {
      if (next === variant) return;
      variant = next;
      colors = themedButtonColors(variant);
      label.setColor(colors.fg);
      tail.setColor(colors.fg);
      if (icon && opts.icon && uiIconTinted(opts.icon)) icon.setTint(colorInt(colors.fg));
      tintInline();
      redraw();
    },
    setEnabled: (next) => {
      enabled = next;
      container.setAlpha(next ? 1 : 0.45);
      if (inputZone.input) inputZone.input.cursor = next ? 'pointer' : 'default';
      redraw();
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

/**
 * The purse at the top bar's right end when it changes on screen (a buy, a
 * craft, the shard ritual's count-up): the shared gold badge on a pill, its
 * right edge at `right`. Returns the badge, whose refresh redraws the pill,
 * and the pill's left edge with room for one more digit.
 */
export function compactPurse(
  scene: Phaser.Scene,
  right: number,
  centerY: number,
  getValue: () => number,
): { badge: GoldBadge; left: number } {
  const height = 38;
  const padX = 14;
  const badge = goldBadge(scene, right - padX, centerY, { fontSize: theme.compactType.h2, flashOnChange: true, getValue });
  const plate = scene.add.graphics();
  badge.container.addAt(plate, 0);
  const draw = (): void => {
    const width = badge.width() + padX * 2;
    plate.clear()
      .fillStyle(theme.graphics.panelFill, theme.alpha.panel)
      .fillRoundedRect(padX - width, -height / 2, width, height, height / 2)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(padX - width, -height / 2, width, height, height / 2);
  };
  draw();
  const refresh = badge.refresh;
  const digit = badge.text.width / Math.max(1, badge.text.text.length);
  return {
    badge: { ...badge, refresh: (value?: number) => { refresh(value); draw(); } },
    left: right - badge.width() - padX * 2 - digit,
  };
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
  // With nothing in the right slot the title's lines may run on across it.
  let titleRight = opts.gold === undefined ? shell.right.x + shell.right.width : shell.title.x + shell.title.width;
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
  const bottom = rect.y + rect.height;
  const bands = 24;
  const bandH = (bottom - top) / bands;
  // Whole-pixel edges that meet exactly: an overlapping row draws twice as
  // dark and reads as a line across the art.
  const edge = (i: number): number => (i === bands ? bottom : Math.round(top + i * bandH));
  for (let i = 0; i < bands; i++) {
    scrim.fillStyle(theme.graphics.panelFill, Math.min(alpha, ((i + 1) / bands) * 1.1));
    scrim.fillRect(rect.x, edge(i), rect.width, edge(i + 1) - edge(i));
  }
  return scrim;
}

/**
 * Clip a tile's art and scrim to the tile's rounded corners, so nothing
 * square shows past the border. For objects drawn straight on the scene
 * (a geometry mask is placed in world space, so not inside a scrolling list).
 */
export function clipToRoundedRect(
  scene: Phaser.Scene,
  rect: Rect,
  radius: number,
  objects: readonly (Phaser.GameObjects.Image | Phaser.GameObjects.Graphics)[],
): void {
  const shape = scene.make.graphics({}, false).fillStyle(0xffffff, 1).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, radius);
  const mask = shape.createGeometryMask();
  for (const object of objects) object.setMask(mask);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { mask.destroy(); shape.destroy(); });
}

/**
 * Desktop pass (docs/plan-mobile-overhaul.md, "Desktop pass"): the faded
 * panel behind a block of running text in a side column or pane, so body
 * text keeps its contrast over the backdrop's art. `pad` grows the panel past
 * the text's rect; keep it at or under `COMPACT.gap` where the rect sits next
 * to another pane.
 */
export function desktopTextPanel(scene: Phaser.Scene, rect: Rect, pad = 8): Phaser.GameObjects.Graphics {
  return panel(scene, rect.x - pad, rect.y - pad, rect.width + 2 * pad, rect.height + 2 * pad);
}

/** The pointer's state layer on a desktop plate: a light wash, deeper while pressed (Material: hover 8%, pressed 10%). */
export const POINTER_WASH = { color: 0xffffff, hover: 0.08, pressed: 0.1 } as const;

/** Where a mouse is relative to a control: away, over it, or holding it down. */
export type PointerState = 'idle' | 'hover' | 'pressed';

/** The wash's alpha for a pointer state (none at rest). */
export function washAlpha(state: PointerState): number {
  return state === 'pressed' ? POINTER_WASH.pressed : state === 'hover' ? POINTER_WASH.hover : 0;
}

/**
 * The one pointer state machine behind every compact control's hover and
 * press (the button, each segment, the switch's row, a plain row). Touch
 * pointers never enter it: a tap's synthetic over/down is ignored, and its
 * up or out only ever settles the state back, so nothing sticks after a tap
 * and phones draw exactly as before. `onChange` fires on each transition.
 */
export function bindPointerState(zone: Phaser.GameObjects.Zone, onChange: (state: PointerState) => void): void {
  let over = false;
  let pressed = false;
  let last: PointerState = 'idle';
  const emit = (): void => {
    const next: PointerState = pressed ? 'pressed' : over ? 'hover' : 'idle';
    if (next === last) return;
    last = next;
    onChange(next);
  };
  zone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch) return;
    over = true;
    emit();
  });
  zone.on('pointerout', () => {
    over = false;
    pressed = false;
    emit();
  });
  zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch) return;
    pressed = true;
    emit();
  });
  zone.on('pointerup', () => {
    pressed = false;
    emit();
  });
}

/**
 * Desktop pass: hover feedback for a plain list row or card that has a zone
 * but no plate of its own (a Settings row, a Glossary term, a trophy card).
 * Draws the pointer wash over `rect` (in `parent`'s coordinates, or the
 * scene's) while a mouse is over the zone; a no-op on touch screens and off
 * the desktop profile, so phones are unchanged.
 */
export function compactRowHover(
  scene: Phaser.Scene,
  zone: Phaser.GameObjects.Zone,
  rect: Rect,
  parent?: Phaser.GameObjects.Container,
  radius: number = theme.radius.panel,
): void {
  if (sceneStage(scene).metrics?.device !== 'desktop') return;
  const wash = scene.add.graphics();
  if (parent) parent.addAt(wash, Math.max(0, parent.getIndex(zone)));
  bindPointerState(zone, (state) => {
    if (!wash.scene) return;
    wash.clear();
    if (state !== 'idle') wash.fillStyle(POINTER_WASH.color, washAlpha(state)).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, radius);
  });
}

export interface CompactDialogAction {
  label: string;
  variant?: ThemedButtonVariant;
  /** `value` is the dialog's field, when it has one. */
  onTap: (close: () => void, value: string) => void;
}

/** A dialog's text field (M25): a real page input, so the phone's keyboard comes up. */
export interface CompactDialogField {
  value: string;
  accessibleName: string;
  placeholder?: string;
  /** A number pad rather than the full keyboard. */
  numeric?: boolean;
  /** The most characters it takes (a deck name's 24). */
  maxLength?: number;
}

/** A choice row under a dialog's message (D-NewDeck): a title over a caption, and a chevron. */
export interface CompactDialogOption {
  label: string;
  caption?: string;
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
    /** One paragraph, or several (M-Darlings), set apart by a small gap. */
    message: string | readonly string[];
    secondary?: CompactDialogAction;
    /** A third footer button, between the two (D-Unsaved's Leave without saving). */
    middle?: CompactDialogAction;
    primary: CompactDialogAction;
    /** Choice rows under the message, each its own action (D-NewDeck). */
    options?: readonly CompactDialogOption[];
    dismissal?: 'mandatory' | 'dismissible' | 'esc-only';
    /** A text field under the message; the dialog then docks to the top, above the keyboard. */
    field?: CompactDialogField;
    /** A scene that routes its overlays through an OverlayCoordinator (Profile) registers the dialog with it. */
    overlay?: Pick<ModalShellOptions, 'coordinator' | 'registration' | 'depth'>;
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
  const style = {
    fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body,
    wordWrap: { width: width - 2 * pad }, lineSpacing: theme.space(1),
  };
  const paragraphs = typeof opts.message === 'string' ? [opts.message] : [...opts.message];
  const paragraphGap = theme.space(2);
  let texts = paragraphs.map((p) => scene.add.text(0, 0, p, style));
  let bodyH = texts.reduce((sum, t) => sum + t.height, 0) + paragraphGap * (texts.length - 1);
  // Taller than the screen (Largest text on a small phone): one text, the
  // paragraphs a blank line apart, scrolling in whole lines inside the dialog.
  const fieldH = opts.field ? COMPACT.touch + paragraphGap : 0;
  // Choice rows, measured: a title over an optional caption, a chevron at the right.
  const chevron = Math.round(type.body * 0.9);
  const optionTextW = width - 2 * pad - 32 - chevron;
  const optionTexts = (opts.options ?? []).map((option) => {
    const head = scene.add.text(0, 0, option.label, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.heading,
      wordWrap: { width: optionTextW },
    });
    const sub = option.caption
      ? scene.add.text(0, 0, option.caption, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: optionTextW },
      })
      : null;
    return { head, sub, height: Math.max(COMPACT.touch, head.height + (sub?.height ?? 0) + 16) };
  });
  const optionsH = optionTexts.reduce((sum, o) => sum + o.height + COMPACT.gap, 0);
  if (optionTexts.length > 0 && paragraphs.every((p) => p === '')) {
    for (const t of texts) t.destroy();
    texts = [];
    bodyH = -paragraphGap;
  }
  const room = content.height - theme.space(4) - fieldH - optionsH - menuNoticeLayout(width, title.height, 0).height;
  let scroll: { linePitch: number } | null = null;
  if (bodyH > room) {
    for (const t of texts) t.destroy();
    const one = scene.add.text(0, 0, paragraphs.join('\n\n'), style);
    const lines = Math.max(1, one.getWrappedText().length);
    const lineHeight = (one.height - one.lineSpacing * (lines - 1)) / lines;
    const linePitch = lineHeight + one.lineSpacing;
    one.setData('a11yWholeLines', { lineHeight, linePitch });
    texts = [one];
    bodyH = Math.max(lineHeight, Math.floor((room + one.lineSpacing) / linePitch) * linePitch - one.lineSpacing);
    scroll = { linePitch };
  }
  const layout = menuNoticeLayout(width, title.height, bodyH + fieldH + optionsH);
  const shell = modalShell(scene, {
    width: layout.width, height: layout.height, titleTrackHeight: layout.titleTrackHeight,
    dismissal: opts.dismissal ?? 'mandatory', onClose: opts.onClose, ...opts.overlay,
    // With a field the dialog docks to the top, where the keyboard cannot cover it.
    ...(opts.field ? { y: content.y + Math.min(layout.height, content.height) / 2 } : {}),
  });
  title.setPosition(shell.tracks.titleTrack.x, shell.tracks.titleTrack.y + (shell.tracks.titleTrack.height - title.height) / 2);
  shell.container.add(title);
  const body = shell.tracks.contentBounds;
  if (scroll) {
    const column = scene.add.container(0, body.y);
    texts[0].setPosition(body.x, 0);
    column.add(texts[0]);
    shell.container.add(column);
    bindMenuScroll(scene, column, { x: body.x, y: body.y, width: body.width, height: bodyH }, texts[0].height,
      undefined, undefined, scroll.linePitch, shell);
  } else {
    let y = body.y;
    for (const t of texts) {
      t.setPosition(body.x, y);
      y += t.height + paragraphGap;
    }
    shell.container.add(texts);
  }
  let optionY = body.y + bodyH + paragraphGap;
  optionTexts.forEach(({ head, sub, height }, i) => {
    const option = opts.options![i];
    const plate = scene.add.graphics()
      .fillStyle(theme.graphics.rowFill, theme.alpha.panel).fillRoundedRect(body.x, optionY, body.width, height, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(body.x, optionY, body.width, height, theme.radius.panel);
    const top = optionY + (height - head.height - (sub?.height ?? 0)) / 2;
    head.setPosition(body.x + 16, top);
    sub?.setPosition(body.x + 16, top + head.height);
    const arrow = scene.add.image(body.x + body.width - 16 - chevron / 2, optionY + height / 2, bakeUiIcon(scene, 'chevron'))
      .setDisplaySize(chevron, chevron).setTint(colorInt(theme.colors.body));
    const zone = scene.add.zone(body.x + body.width / 2, optionY + height / 2, body.width, height).setInteractive({ useHandCursor: true });
    bindTapButton(scene, zone, (pointer) => {
      if (!dragged(pointer)) option.onTap(() => shell.close());
    });
    shell.container.add([plate, head, ...(sub ? [sub] : []), arrow, zone]);
    optionY += height + COMPACT.gap;
  });
  let input: SearchInputHandle | null = null;
  if (opts.field) {
    const field = opts.field;
    const top = body.y + bodyH + paragraphGap + optionsH;
    input = createSearchInput(scene, body.x + body.width / 2, top + COMPACT.touch / 2, {
      width: body.width, placeholder: field.placeholder ?? '', accessibleName: field.accessibleName, onChange: () => undefined,
    });
    const el = input.inputElement;
    if (field.maxLength !== undefined) el.maxLength = field.maxLength;
    el.value = field.maxLength !== undefined ? field.value.slice(0, field.maxLength) : field.value;
    if (field.numeric) {
      el.inputMode = 'numeric';
      el.pattern = '[0-9]*';
    }
    // 16 px or more, or a phone's browser zooms the page when the field takes focus.
    Object.assign(el.style, { height: `${COMPACT.touch}px`, fontSize: `${Math.max(16, type.body)}px` });
    const handle = input;
    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      opts.primary.onTap(() => shell.close(), handle.inputElement.value);
    });
    shell.container.once('destroy', () => handle.destroy());
    handle.focus();
  }
  const fieldValue = (): string => input?.inputElement.value ?? '';
  const footer = shell.tracks.footerTrack;
  const gap = theme.space(4);
  const close = (): void => shell.close();
  // Two halves, or three thirds with a middle action; a lone primary takes the right half.
  const slots = opts.middle ? 3 : 2;
  const slotW = (footer.width - gap * (slots - 1)) / slots;
  const slot = (i: number): Rect => ({ x: footer.x + i * (slotW + gap), y: footer.y, width: slotW, height: footer.height });
  const primaryRect = slot(slots - 1);
  const extra = (action: CompactDialogAction | undefined, rect: Rect): void => {
    if (!action) return;
    const button = compactButton(scene, rect, action.label, {
      variant: action.variant ?? 'ghost', onTap: () => action.onTap(close, fieldValue()),
    });
    // A label longer than its third gets the label size before it would clip.
    if (button.label.width > rect.width - 16) {
      button.label.setFontSize(type.label);
      button.setLabel(action.label);
    }
    shell.container.add(button.container);
  };
  extra(opts.secondary, slot(0));
  extra(opts.middle, slot(1));
  const right = compactButton(scene, primaryRect, opts.primary.label, {
    variant: opts.primary.variant ?? 'primary', onTap: () => opts.primary.onTap(close, fieldValue()),
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

export interface CompactSegments {
  container: Phaser.GameObjects.Container;
  zones: Phaser.GameObjects.Zone[];
  select(index: number): void;
}

/**
 * A segmented choice (the Practice difficulty, M-Practice): equal segments
 * side by side on one plate, the chosen one drawn in the selected style (gold
 * outline and label) so the screen's one gold plate stays its primary. Each
 * segment is its full share of the rect, at least the touch floor high.
 */
export function compactSegments(
  scene: Phaser.Scene,
  rect: Rect,
  labels: readonly string[],
  selected: number,
  onPick: (index: number) => void,
  /** Segments this device cannot take (M-SettingsGameplay's render sizes): a lock, muted, no tap. */
  disabled: readonly boolean[] = [],
  /** Size each segment to its label, the spare shared out evenly (M-Profile's stat tabs), rather than equal shares. */
  proportional = false,
): CompactSegments {
  const type = theme.compactType;
  const container = scene.add.container(rect.x, rect.y);
  const plate = scene.add.graphics();
  // The pointer wash, over the plate and under the labels.
  const wash = scene.add.graphics();
  container.add([plate, wash]);
  const n = Math.max(1, labels.length);
  const inset = 4;
  const inner = rect.width - inset * 2;
  const texts = labels.map((label) => scene.add.text(0, rect.height / 2, label, {
    fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
  }).setOrigin(0.5));
  const lockSize = (size: number): number => Math.round(size * 1.15);
  const lockRoom = (t: Phaser.GameObjects.Text, i: number): number =>
    disabled[i] ? lockSize(parseFloat(String(t.style.fontSize))) + 6 : 0;
  const widths = (): number[] => {
    if (!proportional) return texts.map(() => inner / n);
    const needs = texts.map((t, i) => t.width + lockRoom(t, i) + 8);
    const spare = (inner - needs.reduce((a, b) => a + b, 0)) / n;
    return spare >= 0 ? needs.map((need) => need + spare) : texts.map(() => inner / n);
  };
  let segWs = widths();
  // One size for every segment: the label size when any would not fit at body.
  if (texts.some((t, i) => t.width + lockRoom(t, i) > segWs[i] - 8)) {
    texts.forEach((t) => t.setFontSize(type.label));
    segWs = widths();
  }
  const segXs = segWs.map((_, i) => inset + segWs.slice(0, i).reduce((a, b) => a + b, 0));
  texts.forEach((t, i) => {
    t.setX(segXs[i] + segWs[i] / 2);
    ellipsizeText(t, segWs[i] - 8 - lockRoom(t, i));
  });
  container.add(texts);
  texts.forEach((t, i) => {
    if (!disabled[i]) return;
    const size = lockSize(parseFloat(String(t.style.fontSize)));
    const cx = t.x;
    const total = size + 6 + t.width;
    const lock = scene.add.image(cx - total / 2 + size / 2, rect.height / 2, bakeUiIcon(scene, 'lock'))
      .setDisplaySize(size, size).setTint(colorInt(theme.colors.muted));
    t.setX(cx - total / 2 + size + 6 + t.width / 2);
    container.add(lock);
  });
  let current = selected;
  let pointed = -1;
  let pointerState: PointerState = 'idle';
  const draw = (): void => {
    if (!plate.scene) return;
    const ghost = themedButtonColors('ghost');
    const chosen = themedButtonColors('selected');
    const active = pointerState !== 'idle' && pointed >= 0 && pointed < n;
    plate.clear()
      .fillStyle(colorInt(ghost.bg), 1)
      .fillRoundedRect(0, 0, rect.width, rect.height, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, colorInt(ghost.stroke), theme.alpha.chrome)
      .strokeRoundedRect(0, 0, rect.width, rect.height, theme.radius.panel);
    if (current >= 0 && current < n) {
      const x = segXs[current];
      const lit = active && pointed === current;
      plate.fillStyle(colorInt(chosen.bg), 1)
        .fillRoundedRect(x, inset, segWs[current], rect.height - inset * 2, theme.radius.control)
        .lineStyle(controlStrokeWidth(lit, 'selected'), colorInt(lit ? chosen.hoverStroke : chosen.stroke), 1)
        .strokeRoundedRect(x, inset, segWs[current], rect.height - inset * 2, theme.radius.control);
    }
    wash.clear();
    if (active) {
      wash.fillStyle(POINTER_WASH.color, washAlpha(pointerState))
        .fillRoundedRect(segXs[pointed], inset, segWs[pointed], rect.height - inset * 2, theme.radius.control);
    }
    texts.forEach((t, i) => t.setColor(i === current ? chosen.fg : disabled[i] ? theme.colors.muted : ghost.fg));
  };
  const zones = labels.map((_, i) => {
    const zone = scene.add.zone(segXs[i] + segWs[i] / 2, rect.height / 2, segWs[i], rect.height);
    if (!disabled[i]) zone.setInteractive({ useHandCursor: true });
    bindTapButton(scene, zone, (pointer) => {
      if (dragged(pointer)) return;
      current = i;
      draw();
      onPick(i);
    });
    bindPointerState(zone, (state) => {
      if (state === 'idle' && pointed !== i) return;
      pointed = i;
      pointerState = state;
      draw();
    });
    return zone;
  });
  container.add(zones);
  draw();
  return {
    container,
    zones,
    select: (index) => {
      current = index;
      draw();
    },
  };
}

export interface CompactSwitch {
  container: Phaser.GameObjects.Container;
  /** The drawn width, the On/Off word included, measured from the right edge. */
  width: number;
  set(on: boolean): void;
  /**
   * Give the switch the shared pointer state from the row zone that takes its
   * tap: the wash over the track and, while off, the brighter outline. Call
   * once with the row's zone; touch never shows it.
   */
  bindHover(zone: Phaser.GameObjects.Zone): void;
}

/**
 * The On/Off switch (M-Settings): the word, then the track, its right edge at
 * `right` and centred on `centerY`. It draws only; the row it sits in takes
 * the tap, so the whole row toggles.
 */
export interface CompactSwitchOptions {
  /** The word beside the track for a state; "On" / "Off" when absent. */
  word?: (on: boolean) => string;
  /** The "on" word's colour; gold when absent. */
  onWordColor?: string;
}

export function compactSwitch(
  scene: Phaser.Scene, right: number, centerY: number, on: boolean, opts: CompactSwitchOptions = {},
): CompactSwitch {
  const wordFor = opts.word ?? ((value: boolean) => (value ? 'On' : 'Off'));
  const onWordColor = opts.onWordColor ?? theme.colors.gold;
  const type = theme.compactType;
  const { width: trackW, height: trackH } = COMPACT.switchTrack;
  const container = scene.add.container(right, centerY);
  const track = scene.add.graphics();
  const word = scene.add.text(-trackW - 10, 0, 'Off', {
    fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.muted,
  }).setOrigin(1, 0.5);
  container.add([track, word]);
  const knob = trackH / 2 - 4;
  let current = on;
  let pointerState: PointerState = 'idle';
  const set = (value: boolean): void => {
    current = value;
    if (!track.scene) return;
    const ghost = themedButtonColors('ghost');
    const hovered = pointerState !== 'idle';
    word.setText(wordFor(value)).setColor(value ? onWordColor : theme.colors.muted);
    track.clear();
    if (value) {
      track.fillStyle(colorInt(theme.colors.gold), 1).fillRoundedRect(-trackW, -trackH / 2, trackW, trackH, trackH / 2)
        .fillStyle(colorInt(theme.colors.onGold), 1).fillCircle(-trackH / 2, 0, knob);
    } else {
      track.fillStyle(colorInt(ghost.bg), 1).fillRoundedRect(-trackW, -trackH / 2, trackW, trackH, trackH / 2)
        .lineStyle(controlStrokeWidth(hovered), colorInt(hovered ? ghost.hoverStroke : ghost.stroke), 1)
        .strokeRoundedRect(-trackW, -trackH / 2, trackW, trackH, trackH / 2)
        .fillStyle(colorInt(theme.colors.body), 1).fillCircle(-trackW + trackH / 2, 0, knob);
    }
    if (hovered) {
      track.fillStyle(POINTER_WASH.color, washAlpha(pointerState))
        .fillRoundedRect(-trackW, -trackH / 2, trackW, trackH, trackH / 2);
    }
  };
  set(on);
  // The widest word, so a row can leave room whichever is showing.
  const widest = Math.max(word.width, (word.setText(wordFor(false)), word.width), (word.setText(wordFor(true)), word.width));
  set(on);
  const bindHover = (zone: Phaser.GameObjects.Zone): void => {
    if (!zone.input) zone.setInteractive({ useHandCursor: true });
    else zone.input.cursor = 'pointer';
    bindPointerState(zone, (state) => {
      pointerState = state;
      set(current);
    });
  };
  return { container, width: trackW + 10 + widest, set, bindHover };
}
