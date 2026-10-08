import Phaser from 'phaser';
import { currentAccessibility } from './accessibility';
import { duelModalLayout, type DuelModalLayout } from './duelModalPresentation';
import { modalShellLayout, type Rect } from './layout';
import { theme } from './theme';
import type { ModalShell } from './themeWidgets';

export interface DuelModalRow {
  /** The existing authored centre/anchor y of this horizontal band. */
  readonly y: number;
  /** Omitted: use only direct content children at the authored y. */
  readonly objects?: readonly Phaser.GameObjects.GameObject[];
  /** Full text wraps inside this width; no abbreviation or font shrinking. */
  readonly wrapWidth?: number;
}

export interface FitDuelModalOptions {
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
  readonly rows: readonly DuelModalRow[];
  readonly gap?: number;
  readonly padding?: number;
}

type RowObject = Phaser.GameObjects.GameObject & Pick<Phaser.GameObjects.Text, 'y' | 'setY' | 'getBounds'>;
const originalRows = new WeakMap<Phaser.GameObjects.GameObject, { row: number; y: number }>();

function movable(object: Phaser.GameObjects.GameObject): object is RowObject {
  return 'y' in object && 'setY' in object && 'getBounds' in object;
}

function union(objects: readonly RowObject[]): Rect {
  const bounds = objects.map((object) => object.getBounds());
  const x = Math.min(...bounds.map((rect) => rect.x)), y = Math.min(...bounds.map((rect) => rect.y));
  return { x, y, width: Math.max(...bounds.map((rect) => rect.right)) - x, height: Math.max(...bounds.map((rect) => rect.bottom)) - y };
}

/**
 * Reflow explicitly named bands after a duel shell has been populated. This
 * touches only those bands, never discovers or moves unrelated decorations.
 * Repeat after rebuilding a dynamic dialog state; authored positions are kept
 * so a second measurement does not accumulate the first call's displacement.
 */
export function fitDuelModal(scene: Phaser.Scene, shell: ModalShell, options: FitDuelModalOptions): DuelModalLayout {
  const groups: { row: DuelModalRow; objects: RowObject[] }[] = [];
  for (const row of options.rows) {
    const candidates = row.objects ?? shell.container.list.filter((object) =>
      movable(object) && (Math.abs(object.y - row.y) < 0.01 || originalRows.get(object)?.row === row.y));
    const objects = candidates.filter((object): object is RowObject =>
      object !== shell.dim && object !== shell.panel && object !== shell.closeButton?.container && movable(object) && object.active && !('visible' in object && object.visible === false));
    if (objects.length === 0) continue;
    for (const object of objects) {
      const previous = originalRows.get(object);
      if (previous?.row === row.y) object.setY(previous.y);
      else originalRows.set(object, { row: row.y, y: object.y });
      if (object instanceof Phaser.GameObjects.Text) {
        if (row.wrapWidth !== undefined) object.setWordWrapWidth(row.wrapWidth, true);
        object.setData('a11yKeepVisible', true);
        object.setData('a11yFullText', object.text);
      }
    }
    groups.push({ row, objects });
  }
  const x = options.x ?? theme.design.centerX, y = options.y ?? theme.design.centerY;
  const result = duelModalLayout(
    { x: x - options.width / 2, y: y - options.height / 2, width: options.width, height: options.height },
    groups.map(({ row, objects }) => ({ y: row.y, bounds: union(objects) })),
    currentAccessibility().textScale,
    { gap: options.gap, padding: options.padding, safe: { x: theme.design.safeLeft, y: theme.design.titleSafe.top, width: theme.design.safeWidth, height: theme.design.safeHeight } },
  );
  groups.forEach(({ objects }, index) => {
    for (const object of objects) object.setY(object.y + result.rows[index].offsetY);
  });
  shell.container.setData('a11yDuelModal', { scene: scene.sys.settings.key, ...result });
  if (currentAccessibility().textScale === 1) return result;
  const frame = result.panel;
  shell.panel.clear().fillStyle(theme.graphics.panelFill, theme.alpha.panel)
    .fillRoundedRect(frame.x, frame.y, frame.width, frame.height, theme.radius.panel)
    .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
    .strokeRoundedRect(frame.x, frame.y, frame.width, frame.height, theme.radius.panel);
  const layout = modalShellLayout({ width: frame.width, height: frame.height, x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 });
  const first = result.rows[0]?.bounds, last = result.rows[result.rows.length - 1]?.bounds;
  const titleTrack = first ? { ...layout.inner, y: first.y, height: first.height } : layout.titleTrack;
  const footerTrack = last ? { ...layout.inner, y: last.y, height: last.height } : layout.footerTrack;
  const contentTop = titleTrack.y + titleTrack.height + (options.gap ?? 6);
  const contentBottom = footerTrack.y - (options.gap ?? 6);
  const contentBounds = { ...layout.inner, y: Math.min(contentTop, contentBottom), height: Math.max(0, contentBottom - contentTop) };
  shell.tracks = { titleTrack, contentBounds, footerTrack, closeTrack: layout.closeTrack, centredTitleTrack: { ...titleTrack } };
  shell.contentBounds = contentBounds;
  shell.closeButton?.container.setPosition(layout.closeTrack.x + layout.closeTrack.width / 2, layout.closeTrack.y + layout.closeTrack.height / 2);
  return result;
}
