import type Phaser from 'phaser';
import {
  controlBounds,
  type HitFloors,
  type Rect,
} from './layout';
import { colorInt, theme, type Theme } from './theme';

export type LayoutDepthBand = keyof Theme['depth'];

export interface LayoutDebugRegistration {
  id: string;
  visual: Rect;
  /** Supply a measured hit rect when the caller already owns its hit geometry. */
  hit?: Rect;
  /** Otherwise the overlay computes centered inflation from these floors. */
  floors?: HitFloors;
  depthBand?: LayoutDepthBand;
}

export interface LayoutDebugOverlayOptions {
  enabled?: boolean;
  /** Defaults to the highest existing named theme depth band. */
  depth?: number;
}

interface MeasuredRegistration {
  id: string;
  visual: Rect;
  hit: Rect;
  depthBand?: LayoutDepthBand;
}

/**
 * Development-only geometry renderer. It is inert until a caller explicitly
 * constructs and enables it, never creates an input target, and owns every
 * display object it creates so a scene restart cannot stack old guides.
 */
export class LayoutDebugOverlay {
  private readonly scene: Phaser.Scene;
  private readonly depth: number;
  private readonly entries = new Map<string, MeasuredRegistration>();
  private root: Phaser.GameObjects.Container | null = null;
  private enabled: boolean;
  private destroyed = false;
  private readonly handleShutdown = (): void => this.destroy();

  public constructor(scene: Phaser.Scene, options: LayoutDebugOverlayOptions = {}) {
    this.scene = scene;
    this.depth = options.depth ?? Math.max(...Object.values(theme.depth));
    this.enabled = options.enabled ?? false;
    scene.events.once('shutdown', this.handleShutdown);
    if (this.enabled) this.show();
  }

  public register(entry: LayoutDebugRegistration): this {
    if (this.destroyed) return this;
    const bounds = entry.hit
      ? { visual: { ...entry.visual }, hit: { ...entry.hit } }
      : controlBounds(entry.visual, entry.floors ?? theme.control);
    this.entries.set(entry.id, { ...bounds, id: entry.id, depthBand: entry.depthBand });
    if (this.enabled) this.render();
    return this;
  }

  public deregister(id: string): boolean {
    if (this.destroyed) return false;
    const removed = this.entries.delete(id);
    if (removed && this.enabled) this.render();
    return removed;
  }

  public clear(): this {
    if (this.destroyed) return this;
    this.entries.clear();
    if (this.enabled) this.render();
    return this;
  }

  public show(): this {
    if (this.destroyed) return this;
    this.enabled = true;
    this.ensureRoot();
    this.render();
    return this;
  }

  public hide(): this {
    this.enabled = false;
    this.root?.setVisible(false);
    return this;
  }

  public toggle(force?: boolean): this {
    return force ?? !this.enabled ? this.show() : this.hide();
  }

  public isShown(): boolean {
    return this.enabled;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.handleShutdown);
    this.entries.clear();
    this.root?.destroy();
    this.root = null;
  }

  private ensureRoot(): void {
    if (this.root?.active) return;
    this.root = this.scene.add.container(0, 0).setDepth(this.depth);
  }

  private render(): void {
    if (!this.enabled || !this.root?.active) return;
    this.root.removeAll(true);

    const safeFrame = this.scene.add.graphics();
    safeFrame.lineStyle(2, colorInt(theme.colors.gold), 0.9);
    safeFrame.strokeRect(
      theme.design.safeLeft,
      theme.design.safeTop,
      theme.design.safeWidth,
      theme.design.safeHeight,
    );
    this.root.add(safeFrame);
    this.addLabel('title-safe', theme.design.safeLeft + 4, theme.design.safeTop + 4, theme.colors.gold);

    const bounds = this.scene.add.graphics();
    bounds.lineStyle(1, colorInt(theme.colors.success), 0.9);
    for (const entry of this.entries.values()) {
      bounds.strokeRect(entry.visual.x, entry.visual.y, entry.visual.width, entry.visual.height);
    }
    bounds.lineStyle(1, colorInt(theme.colors.dangerArmed), 0.8);
    for (const entry of this.entries.values()) {
      bounds.strokeRect(entry.hit.x, entry.hit.y, entry.hit.width, entry.hit.height);
    }
    this.root.add(bounds);

    for (const entry of this.entries.values()) {
      const band = entry.depthBand ? ` [${entry.depthBand}]` : '';
      this.addLabel(`${entry.id}${band}`, entry.visual.x, entry.visual.y - 14, theme.colors.body);
    }

    Object.entries(theme.depth).forEach(([name, value], index) => {
      this.addLabel(`depth.${name} = ${value}`, 8, 8 + index * 14, theme.colors.muted);
    });
  }

  private addLabel(text: string, x: number, y: number, color: string): void {
    if (!this.root?.active) return;
    const label = this.scene.add.text(x, y, text, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      color,
      backgroundColor: theme.colors.dim,
    });
    this.root.add(label);
  }
}
