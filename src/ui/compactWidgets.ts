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
import { modalShell, type ModalShell, type ModalShellOptions } from './themeWidgets';
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
const ROW_INSET = 16;

export function compactButton(scene: Phaser.Scene, rect: Rect, text: string, opts: CompactButtonOptions): CompactButton {
  let variant = opts.variant ?? 'ghost';
  let colors = themedButtonColors(variant);
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
    const left = opts.align === 'left' ? opts.inset ?? ROW_INSET : Math.round((rect.width - contentW) / 2);
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
  let enabled = true;
  bindTapButton(scene, inputZone, (pointer) => {
    if (enabled && !dragged(pointer)) opts.onTap(pointer);
  });
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
    setVariant: (next) => {
      if (next === variant) return;
      variant = next;
      colors = themedButtonColors(variant);
      label.setColor(colors.fg);
      if (icon && opts.icon && uiIconTinted(opts.icon)) icon.setTint(colorInt(colors.fg));
      redraw();
    },
    setEnabled: (next) => {
      enabled = next;
      container.setAlpha(next ? 1 : 0.45);
      if (inputZone.input) inputZone.input.cursor = next ? 'pointer' : 'default';
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
    primary: CompactDialogAction & { variant?: ThemedButtonVariant };
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
  const room = content.height - theme.space(4) - fieldH - menuNoticeLayout(width, title.height, 0).height;
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
  const layout = menuNoticeLayout(width, title.height, bodyH + fieldH);
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
  let input: SearchInputHandle | null = null;
  if (opts.field) {
    const field = opts.field;
    const top = body.y + bodyH + paragraphGap;
    input = createSearchInput(scene, body.x + body.width / 2, top + COMPACT.touch / 2, {
      width: body.width, placeholder: field.placeholder ?? '', accessibleName: field.accessibleName, onChange: () => undefined,
    });
    const el = input.inputElement;
    el.value = field.value;
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
  const half = (footer.width - gap) / 2;
  const primaryRect = opts.secondary
    ? { x: footer.x + half + gap, y: footer.y, width: half, height: footer.height }
    : { x: footer.x + footer.width - half, y: footer.y, width: half, height: footer.height };
  if (opts.secondary) {
    const secondary = opts.secondary;
    const left = compactButton(scene, { x: footer.x, y: footer.y, width: half, height: footer.height }, secondary.label, {
      onTap: () => secondary.onTap(close, fieldValue()),
    });
    shell.container.add(left.container);
  }
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
  container.add(plate);
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
  const draw = (): void => {
    const ghost = themedButtonColors('ghost');
    const chosen = themedButtonColors('selected');
    plate.clear()
      .fillStyle(colorInt(ghost.bg), 1)
      .fillRoundedRect(0, 0, rect.width, rect.height, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, colorInt(ghost.stroke), theme.alpha.chrome)
      .strokeRoundedRect(0, 0, rect.width, rect.height, theme.radius.panel);
    if (current >= 0 && current < n) {
      const x = segXs[current];
      plate.fillStyle(colorInt(chosen.bg), 1)
        .fillRoundedRect(x, inset, segWs[current], rect.height - inset * 2, theme.radius.control)
        .lineStyle(theme.control.borderWidth, colorInt(chosen.stroke), 1)
        .strokeRoundedRect(x, inset, segWs[current], rect.height - inset * 2, theme.radius.control);
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
}

/**
 * The On/Off switch (M-Settings): the word, then the track, its right edge at
 * `right` and centred on `centerY`. It draws only; the row it sits in takes
 * the tap, so the whole row toggles.
 */
export function compactSwitch(scene: Phaser.Scene, right: number, centerY: number, on: boolean): CompactSwitch {
  const type = theme.compactType;
  const { width: trackW, height: trackH } = COMPACT.switchTrack;
  const container = scene.add.container(right, centerY);
  const track = scene.add.graphics();
  const word = scene.add.text(-trackW - 10, 0, 'Off', {
    fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.muted,
  }).setOrigin(1, 0.5);
  container.add([track, word]);
  const knob = trackH / 2 - 4;
  const set = (value: boolean): void => {
    const ghost = themedButtonColors('ghost');
    word.setText(value ? 'On' : 'Off').setColor(value ? theme.colors.gold : theme.colors.muted);
    track.clear();
    if (value) {
      track.fillStyle(colorInt(theme.colors.gold), 1).fillRoundedRect(-trackW, -trackH / 2, trackW, trackH, trackH / 2)
        .fillStyle(colorInt(theme.colors.onGold), 1).fillCircle(-trackH / 2, 0, knob);
    } else {
      track.fillStyle(colorInt(ghost.bg), 1).fillRoundedRect(-trackW, -trackH / 2, trackW, trackH, trackH / 2)
        .lineStyle(theme.control.borderWidth, colorInt(ghost.stroke), 1)
        .strokeRoundedRect(-trackW, -trackH / 2, trackW, trackH, trackH / 2)
        .fillStyle(colorInt(theme.colors.body), 1).fillCircle(-trackW + trackH / 2, 0, knob);
    }
  };
  set(on);
  // The widest word, so a row can leave room whichever is showing.
  const widest = Math.max(word.width, (word.setText('Off'), word.width), (word.setText('On'), word.width));
  set(on);
  return { container, width: trackW + 10 + widest, set };
}
