import { isRectContained, type Rect } from './layout';
import { ellipsizeText, type MeasuredText } from './textFit';

/** Preserve release shrink-to-fit; larger settings stop at the base role size. */
export function fitMenuListName(
  text: MeasuredText & { setScale(scale: number): unknown; setData(key: string, value: unknown): unknown },
  width: number, fontSize: number, baseFontSize: number,
): void {
  const ratio = Math.min(1, width / Math.max(1, text.width));
  const scale = fontSize <= baseFontSize ? ratio : Math.max(baseFontSize / fontSize, ratio);
  text.setScale(scale);
  text.setData('a11yFitToBox', true);
  if (fontSize > baseFontSize) text.setData('a11yMinFontSize', baseFontSize);
  if (fontSize > baseFontSize && text.width * scale > width) ellipsizeText(text, width / scale);
}

/** The small measured-Text interface keeps the presentation rule Phaser-free. */
export interface MenuNameText {
  text: string;
  width: number;
  setText(value: string): unknown;
  setWordWrapWidth(width: number, useAdvancedWrap?: boolean): unknown;
  setData(key: string, value: unknown): unknown;
}

/** Full menu identity, unlike the deliberately abbreviated rail labels. */
export function fitMenuName(text: MenuNameText, width: number, maxLines = 2): void {
  const value = text.text;
  text.setData('a11yFullText', value);
  text.setData('a11yMaxLines', maxLines);
  text.setWordWrapWidth(width, true);
  text.setData('a11yTextWidth', width);
}

export interface MenuTextCheck {
  expected: string;
  actual: string;
  lines: readonly string[];
  maxLines?: number;
  drawnLines?: number;
  bounds: Rect;
  box?: Rect;
  clip?: Rect;
  lineHeight?: number;
  linePitch?: number;
  /** Prices, rewards and primary actions must never be clipped by a mask. */
  keepVisible?: boolean;
  /** Actual ink, rather than the Text object's padded allocation. */
  glyphBounds?: Rect;
  /** The text's own raster canvas in the same coordinates as glyphBounds. */
  glyphClip?: Rect;
  /** Opaque geometry drawn later in the same widget, including ring strokes. */
  occluders?: readonly Rect[];
}

/** Checks source preservation and measured bounds, including what a mask hides. */
export function menuTextFindings(check: MenuTextCheck): ('truncatedText' | 'clippedText')[] {
  const findings: ('truncatedText' | 'clippedText')[] = [];
  if (check.glyphBounds) {
    const ink = check.glyphBounds;
    if (check.glyphClip && !isRectContained(ink, check.glyphClip, 0.5)) findings.push('clippedText');
    if (check.occluders?.some(cover =>
      Math.min(ink.x + ink.width, cover.x + cover.width) - Math.max(ink.x, cover.x) > 0.5 &&
      Math.min(ink.y + ink.height, cover.y + cover.height) - Math.max(ink.y, cover.y) > 0.5)) findings.push('clippedText');
  }
  const normalized = (value: string): string => value.replace(/\s+/g, ' ').trim();
  if (normalized(check.expected) !== normalized(check.actual)
    || check.expected.replace(/\s+/g, '') !== check.lines.join('').replace(/\s+/g, '')
    || (check.drawnLines !== undefined && check.drawnLines > 0 && check.drawnLines < check.lines.length)
    || (check.maxLines !== undefined && check.lines.length > check.maxLines)) findings.push('truncatedText');
  if (check.box && !isRectContained(check.bounds, check.box, 0.5)) findings.push('clippedText');
  if (check.clip) {
    if (check.keepVisible && !isRectContained(check.bounds, check.clip, 0.5)) findings.push('clippedText');
    if (check.lineHeight !== undefined && check.linePitch !== undefined) {
      for (let i = 0; i < check.lines.length; i++) {
        const top = check.bounds.y + i * check.linePitch, bottom = top + check.lineHeight;
        if (top < check.clip.y + check.clip.height - 0.5 && bottom > check.clip.y + 0.5
          && (top < check.clip.y - 0.5 || bottom > check.clip.y + check.clip.height + 0.5)) {
          findings.push('clippedText'); break;
        }
      }
    } else if (!isRectContained(check.bounds, check.clip, 0.5)) findings.push('clippedText');
  }
  return [...new Set(findings)];
}

export interface MenuDensity {
  id: string;
  rows: number;
  columns: number;
  pitch: number;
  top: number;
}

/** Release density and anchors are a compatibility contract at standard text. */
export function menuDensityFindings(actual: readonly MenuDensity[], release: readonly MenuDensity[], textScale: number): string[] {
  if (textScale !== 1) return [];
  return release.filter((baseline) => {
    const now = actual.find((item) => item.id === baseline.id);
    return !now || (['rows', 'columns', 'pitch', 'top'] as const).some((key) => Math.abs(now[key] - baseline[key]) > 0.5);
  }).map((item) => item.id);
}

/** Whole-line resting positions, with the exact end still reachable. */
export function menuScrollOffset(requested: number, max: number, step = 0): number {
  const clamped = Math.max(0, Math.min(max, requested));
  return step > 0 ? Math.max(0, Math.min(max, Math.round(clamped / step) * step)) : clamped;
}

/** A real foreground plate, with its render order, can cover background text. */
export interface MenuTextSurface { id: string; bounds: Rect; depth: number; order: number }
export interface MenuTextLayer { bounds: Rect; depth: number; order: number; surface?: MenuTextSurface }

/** Only the part actually hidden by a higher plate is excluded from collisions. */
export function menuTextOverlap(a: MenuTextLayer, b: MenuTextLayer): boolean {
  const x = Math.max(a.bounds.x, b.bounds.x), y = Math.max(a.bounds.y, b.bounds.y);
  const width = Math.min(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width) - x;
  const height = Math.min(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height) - y;
  if (width <= 0.5 || height <= 0.5) return false;
  const coveredBy = (front: MenuTextLayer, back: MenuTextLayer): boolean => {
    const surface = front.surface;
    if (!surface || surface.id === back.surface?.id) return false;
    const above = surface.depth > back.depth || (surface.depth === back.depth && surface.order > back.order);
    return above && isRectContained({ x, y, width, height }, surface.bounds, 0.5);
  };
  return !coveredBy(a, b) && !coveredBy(b, a);
}
