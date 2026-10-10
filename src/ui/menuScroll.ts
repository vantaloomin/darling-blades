import Phaser from 'phaser';
import { tapSlopWorldPx } from '../platform/renderScale';
import { isRectContained, type Rect } from './layout';
import { menuScrollOffset } from './menuText';
import { theme } from './theme';
import { sceneHasOpenModal, type ModalShell, type ThemedButton } from './themeWidgets';

/** A measured menu column. Its content uses world x and local y; no scaled input. */
export function bindMenuScroll(
  scene: Phaser.Scene, content: Phaser.GameObjects.Container, viewport: Rect, contentHeight: number,
  blocked: () => boolean = () => false, buttons: readonly ThemedButton[] = [], step = 0, modal?: ModalShell,
  initialOffset = 0,
): void {
  const maxScroll = Math.max(0, contentHeight - viewport.height);
  const mask = scene.add.graphics().fillStyle(theme.graphics.panelFill, 1)
    .fillRect(viewport.x, viewport.y, viewport.width, viewport.height).setVisible(false);
  content.setMask(mask.createGeometryMask());
  const thumb = scene.add.graphics();
  content.parentContainer?.add(thumb);
  let offset = 0;
  let requested = 0;
  let drag: { id: number; y: number; offset: number } | null = null;
  const contains = (p: Phaser.Input.Pointer): boolean => p.worldX >= viewport.x && p.worldX <= viewport.x + viewport.width
    && p.worldY >= viewport.y && p.worldY <= viewport.y + viewport.height;
  const unavailable = (): boolean => blocked() || (modal ? !modal.isTop() : sceneHasOpenModal(scene));
  const place = (next: number): void => {
    requested = Math.max(0, Math.min(maxScroll, next));
    offset = menuScrollOffset(requested, maxScroll, step);
    content.setY(viewport.y - offset);
    for (const button of buttons) {
      const hit = button.getMeasuredBounds().hit;
      const world = button.container.getWorldTransformMatrix();
      button.setEnabled(isRectContained({ ...hit, x: hit.x + world.tx, y: hit.y + world.ty }, viewport));
    }
    thumb.clear();
    if (maxScroll > 0) {
      const height = Math.max(theme.space(8), viewport.height * viewport.height / contentHeight);
      thumb.fillStyle(theme.graphics.panelStroke, theme.alpha.chrome).fillRoundedRect(
        viewport.x + viewport.width - theme.space(1), viewport.y + offset / maxScroll * (viewport.height - height),
        theme.space(1), height, theme.space(0.5));
    }
  };
  place(initialOffset);
  if (maxScroll <= 0) {
    content.once('destroy', () => { mask.destroy(); thumb.destroy(); });
    return;
  }
  const wheel = (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void => {
    if (!unavailable() && contains(p)) place(requested + dy);
  };
  const down = (p: Phaser.Input.Pointer): void => {
    if (!unavailable() && contains(p)) drag = { id: p.id, y: p.worldY, offset };
  };
  const move = (p: Phaser.Input.Pointer): void => {
    if (unavailable()) { drag = null; return; }
    if (drag?.id === p.id && Math.abs(p.worldY - drag.y) > tapSlopWorldPx()) place(drag.offset + drag.y - p.worldY);
  };
  const up = (p: Phaser.Input.Pointer): void => { if (drag?.id === p.id) drag = null; };
  let disposed = false;
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    scene.input.off('wheel', wheel); scene.input.off('pointerdown', down); scene.input.off('pointermove', move);
    scene.input.off('pointerup', up); scene.input.off('pointerupoutside', up);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    mask.destroy(); thumb.destroy();
  };
  scene.input.on('wheel', wheel); scene.input.on('pointerdown', down); scene.input.on('pointermove', move);
  scene.input.on('pointerup', up); scene.input.on('pointerupoutside', up);
  content.once('destroy', cleanup);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
}
