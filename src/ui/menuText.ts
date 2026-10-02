import { isRectContained, type Rect } from './layout';

/** The small measured-Text interface keeps the presentation rule Phaser-free. */
export interface MenuNameText {
  text: string;
  width: number;
  setText(value: string): unknown;
  setWordWrapWidth(width: number): unknown;
  setData(key: string, value: unknown): unknown;
}

/** Full menu identity, unlike the deliberately abbreviated rail labels. */
export function fitMenuName(text: MenuNameText, width: number, maxLines = 2): void {
  const value = text.text;
  text.setData('a11yFullText', value);
  text.setData('a11yMaxLines', maxLines);
  text.setWordWrapWidth(width);
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
}

/** Checks source preservation and measured bounds, including what a mask hides. */
export function menuTextFindings(check: MenuTextCheck): ('truncatedText' | 'clippedText')[] {
  const findings: ('truncatedText' | 'clippedText')[] = [];
  const normalized = (value: string): string => value.replace(/\s+/g, ' ').trim();
  if (normalized(check.expected) !== normalized(check.actual)
    || normalized(check.expected) !== normalized(check.lines.join(' '))
    || (check.drawnLines !== undefined && check.drawnLines > 0 && check.drawnLines < check.lines.length)
    || (check.maxLines !== undefined && check.lines.length > check.maxLines)) findings.push('truncatedText');
  if (check.box && !isRectContained(check.bounds, check.box, 0.5)) findings.push('clippedText');
  if (check.clip) {
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

/** Whole-line resting positions, with the exact end still reachable. */
export function menuScrollOffset(requested: number, max: number, step = 0): number {
  const clamped = Math.max(0, Math.min(max, requested));
  return step > 0 ? Math.max(0, Math.min(max, Math.round(clamped / step) * step)) : clamped;
}
