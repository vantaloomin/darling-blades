import Phaser from 'phaser';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { theme } from './theme';

/**
 * A compact select dropdown — the first reusable one in the codebase. Flat
 * scene objects (never a scaled interactive Container — playbook §11): a button
 * that shows `Label: Value ▾`, and an on-demand options panel at a high depth so
 * it floats over the page beneath. Closes on select, on an outside click, or
 * when a sibling opens (via `onOpen`). Positions are DESIGN-space (1280×720);
 * the outside-click test uses pointer WORLD coords so it is render-scale safe.
 */

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

const ROW_H = 30;
const PANEL_DEPTH = 200;

export interface DropdownOpts<T extends string> {
  label: string;
  options: DropdownOption<T>[];
  value: T;
  minW?: number;
  onSelect: (v: T) => void;
  /** Called just before this dropdown opens — FilterBar uses it to close siblings. */
  onOpen?: () => void;
}

export class Dropdown<T extends string> {
  readonly button: Phaser.GameObjects.Text;
  private panel: Phaser.GameObjects.Container | null = null;
  private closeListener: ((p: Phaser.Input.Pointer) => void) | null = null;
  private value: T;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly opts: DropdownOpts<T>,
  ) {
    this.value = opts.value;
    this.button = scene.add
      .text(x, y, this.caption(), {
        fontFamily: theme.fonts.ui,
        fontSize: '13px',
        fontStyle: theme.weight.w600,
        color: theme.colors.body,
        backgroundColor: theme.colors.btnGhostBg,
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(scene, this.button, () => this.toggle());
    this.reinflate();
  }

  private get minW(): number {
    return this.opts.minW ?? 96;
  }

  /** Text.updateText resets the hit area on any setText/style change — restore it. */
  private reinflate(): void {
    inflateHitArea(this.button, this.minW, 40);
  }

  private caption(): string {
    const sel = this.opts.options.find((o) => o.value === this.value);
    return `${this.opts.label}: ${sel ? sel.label : '—'} ▾`;
  }

  get isOpen(): boolean {
    return this.panel !== null;
  }

  private toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (this.panel) return;
    this.opts.onOpen?.();
    this.button.setBackgroundColor(theme.colors.btnEmphasisBg);
    this.reinflate();

    const n = this.opts.options.length;
    const top = this.y + 16; // just under the button
    const w = Math.max(this.button.width, this.minW);
    const panel = this.scene.add.container(0, 0).setDepth(PANEL_DEPTH);
    const bg = this.scene.add
      .rectangle(this.x, top, w + 8, n * ROW_H + 8, theme.graphics.panelFill, theme.alpha.panel)
      .setOrigin(0, 0)
      .setStrokeStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
    panel.add(bg);
    this.opts.options.forEach((o, i) => {
      const oy = top + 4 + i * ROW_H + ROW_H / 2;
      const active = o.value === this.value;
      const t = this.scene.add
        .text(this.x + 10, oy, o.label, {
          fontFamily: theme.fonts.ui,
          fontSize: '13px',
          fontStyle: active ? theme.weight.w700 : theme.weight.w600,
          color: active ? theme.colors.gold : theme.colors.body,
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) t.setColor(theme.colors.heading);
      });
      t.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) t.setColor(active ? theme.colors.gold : theme.colors.body);
      });
      bindTapButton(this.scene, t, () => this.select(o.value));
      inflateHitArea(t, w, ROW_H);
      panel.add(t);
    });
    this.panel = panel;

    // Outside-click closes. Deferred a tick so the opening click (this very
    // pointerdown) doesn't immediately close it. Clicks ON the button are left
    // to the button's own toggle (else pointerdown-close + pointerup-open would
    // cancel out and the button could never close the panel).
    this.scene.time.delayedCall(0, () => {
      if (!this.panel) return;
      this.closeListener = (p: Phaser.Input.Pointer) => {
        if (Phaser.Geom.Rectangle.Contains(this.button.getBounds(), p.worldX, p.worldY)) return;
        if (Phaser.Geom.Rectangle.Contains(bg.getBounds(), p.worldX, p.worldY)) return;
        this.close();
      };
      this.scene.input.on('pointerdown', this.closeListener);
    });
  }

  private select(v: T): void {
    this.value = v;
    this.button.setText(this.caption());
    this.reinflate();
    this.close();
    this.opts.onSelect(v);
  }

  close(): void {
    if (!this.panel) return;
    this.panel.destroy();
    this.panel = null;
    this.button.setBackgroundColor(theme.colors.btnGhostBg);
    this.reinflate();
    if (this.closeListener) {
      this.scene.input.off('pointerdown', this.closeListener);
      this.closeListener = null;
    }
  }

  /**
   * Scene-shutdown cleanup: drop the outside-click listener and our panel ref.
   * The button + panel GameObjects are destroyed by the scene itself during
   * shutdown, so this must NOT touch them — restyling a Text whose canvas is
   * mid-teardown throws in Text.updateText.
   */
  teardown(): void {
    if (this.closeListener) {
      this.scene.input.off('pointerdown', this.closeListener);
      this.closeListener = null;
    }
    this.panel = null;
  }

  /** Sync the displayed value from external state (e.g. a filter reset). */
  setValue(v: T): void {
    this.value = v;
    this.button.setText(this.caption());
    this.reinflate();
  }

  destroy(): void {
    this.close();
    this.button.destroy();
  }
}
