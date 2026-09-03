import Phaser from 'phaser';
import { bindTapButton } from '../platform/gestures';
import {
  dropdownPanelWidth,
  dropdownPopoverLayout,
  DROPDOWN_GEOMETRY,
  type FocusMetadata,
} from './layout';
import { roundedTrigger, type RoundedTrigger } from './themeWidgets';
import { theme } from './theme';

/**
 * A compact select dropdown. The trigger and option rows use flat Phaser
 * objects with unscaled Zone input targets; the panel floats above the page at
 * the shared popover depth and closes on select, outside click, or a sibling
 * opening. Positions are DESIGN-space (1280x720); outside-click checks use
 * pointer WORLD coords so the test remains render-scale safe.
 */

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

const PANEL_DEPTH = theme.depth.popover;

function measureOptionLabels<T extends string>(scene: Phaser.Scene, options: readonly DropdownOption<T>[]): number {
  const measure = scene.add
    .text(0, 0, '', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.label}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.body,
    })
    .setVisible(false);
  let longest = 0;
  for (const option of options) {
    measure.setText(option.label);
    longest = Math.max(longest, measure.width);
  }
  measure.destroy();
  return longest;
}

export interface DropdownOpts<T extends string> {
  label: string;
  options: DropdownOption<T>[];
  value: T;
  minW?: number;
  enabled?: boolean;
  focus?: FocusMetadata;
  onSelect: (v: T) => void;
  /** Called just before this dropdown opens - FilterBar uses it to close siblings. */
  onOpen?: () => void;
}

export class Dropdown<T extends string> {
  /** The shared trigger's unscaled Zone, retained as the public guard target. */
  readonly button: Phaser.GameObjects.Zone;
  private readonly trigger: RoundedTrigger;
  private panel: Phaser.GameObjects.Container | null = null;
  private closeListener: ((p: Phaser.Input.Pointer) => void) | null = null;
  private value: T;
  private readonly longestOptionLabelWidth: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly opts: DropdownOpts<T>,
  ) {
    this.value = opts.value;
    this.longestOptionLabelWidth = measureOptionLabels(scene, opts.options);
    this.trigger = roundedTrigger(scene, x, y, '', {
      variant: 'ghost',
      minWidth: this.minW,
      parts: {
        label: opts.label,
        value: this.selectedLabel(),
        maxValueWidth: this.longestOptionLabelWidth,
      },
      enabled: opts.enabled,
      focus: opts.focus,
      onTap: () => this.toggle(),
    });
    this.button = this.trigger.inputZone;
  }

  private get minW(): number {
    return this.opts.minW ?? 96;
  }

  /** World-space bounds of the shared trigger's custom inflated Zone target. */
  private triggerBounds(): Phaser.Geom.Rectangle {
    const measured = this.trigger.getMeasuredBounds();
    return new Phaser.Geom.Rectangle(
      this.trigger.container.x + measured.hit.x,
      this.trigger.container.y + measured.hit.y,
      measured.hit.width,
      measured.hit.height,
    );
  }

  private selectedLabel(): string {
    const sel = this.opts.options.find((o) => o.value === this.value);
    return sel ? sel.label : '\u2014';
  }

  /** Hit-rect bounds relative to the trigger container, for row reflow. */
  hitBounds(): { x: number; width: number } {
    const m = this.trigger.getMeasuredBounds();
    return { x: m.hit.x, width: m.hit.width };
  }

  get containerX(): number {
    return this.trigger.container.x;
  }

  /** Reflow support: the popover derives from live bounds, so moving is safe. */
  setX(x: number): void {
    this.trigger.container.x = x;
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
    this.trigger.setSelected(true);
    this.trigger.setOpen(true);

    const triggerBounds = this.triggerBounds();
    const popover = dropdownPopoverLayout(triggerBounds, this.opts.options.length, {
      panelWidth: dropdownPanelWidth(
        this.trigger.getMeasuredSize().visual.width,
        this.longestOptionLabelWidth,
        this.opts.options.length,
      ),
    });
    const panelBounds = new Phaser.Geom.Rectangle(
      popover.panel.x,
      popover.panel.y,
      popover.panel.width,
      popover.panel.height,
    );
    const panel = this.scene.add.container(0, 0).setDepth(PANEL_DEPTH);
    const plate = this.scene.add
      .graphics()
      .fillStyle(theme.graphics.panelFill, theme.alpha.panel)
      .fillRoundedRect(
        popover.panel.x + DROPDOWN_GEOMETRY.plateOffset,
        popover.panel.y + DROPDOWN_GEOMETRY.plateOffset,
        popover.panel.width,
        popover.panel.height,
        theme.radius.panel,
      );
    const bg = this.scene.add
      .graphics()
      .fillStyle(theme.graphics.panelFill, theme.alpha.panel)
      .fillRoundedRect(
        popover.panel.x,
        popover.panel.y,
        popover.panel.width,
        popover.panel.height,
        theme.radius.panel,
      )
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(
        popover.panel.x,
        popover.panel.y,
        popover.panel.width,
        popover.panel.height,
        theme.radius.panel,
      );
    panel.add([plate, bg]);
    if (popover.separator) {
      panel
        .add(
          this.scene.add
            .graphics()
            .fillStyle(theme.graphics.panelStroke, theme.alpha.chrome)
            .fillRect(
              popover.separator.x,
              popover.separator.y,
              popover.separator.width,
              popover.separator.height,
            ),
        );
    }

    this.opts.options.forEach((option, index) => {
      const rowBounds = popover.rows[index];
      const selected = option.value === this.value;
      const disabled = option.disabled ?? false;
      let hovered = false;
      let pressed = false;
      const row = this.scene.add.container(0, 0);
      const rowBg = this.scene.add.graphics();
      const text = this.scene.add
        .text(
          rowBounds.x + DROPDOWN_GEOMETRY.rowTextInset,
          rowBounds.y + rowBounds.height / 2,
          option.label,
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            fontStyle: selected ? theme.weight.w700 : theme.weight.w600,
            color: selected ? theme.colors.gold : theme.colors.body,
          },
        )
        .setOrigin(0, 0.5);
      const check = selected
        ? this.scene.add
            .text(
              rowBounds.x + rowBounds.width - DROPDOWN_GEOMETRY.rowTextInset - DROPDOWN_GEOMETRY.glyphSlotWidth / 2,
              rowBounds.y + rowBounds.height / 2,
              '\u2713',
              {
                fontFamily: theme.fonts.ui,
                fontSize: `${theme.type.label}px`,
                fontStyle: theme.weight.w700,
                color: theme.colors.gold,
              },
            )
            .setOrigin(0.5, 0.5)
        : null;
      const zone = this.scene.add
        .zone(
          rowBounds.x + rowBounds.width / 2,
          rowBounds.y + rowBounds.height / 2,
          rowBounds.width,
          rowBounds.height,
        )
        .setInteractive({ useHandCursor: !disabled });
      const redraw = (): void => {
        if (!row.active) return;
        rowBg.clear();
        if (selected) {
          rowBg.fillStyle(theme.graphics.rowFillActive, 1);
          rowBg.fillRect(rowBounds.x, rowBounds.y, rowBounds.width, rowBounds.height);
        } else if (hovered || pressed) {
          rowBg.fillStyle(theme.graphics.rowFill, 1);
          rowBg.fillRect(rowBounds.x, rowBounds.y, rowBounds.width, rowBounds.height);
        }
        row.setAlpha(disabled ? theme.alpha.subtle : 1);
        text.setColor(
          disabled
            ? theme.colors.muted
            : selected
                ? theme.colors.gold
                : hovered || pressed
                  ? theme.colors.heading
                  : theme.colors.body,
        );
        check?.setColor(theme.colors.gold);
      };
      if (disabled) zone.disableInteractive();
      zone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch && !disabled) {
          hovered = true;
          redraw();
        }
      });
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch && !disabled) {
          pressed = true;
          redraw();
        }
      });
      zone.on('pointerout', () => {
        hovered = false;
        pressed = false;
        redraw();
      });
      if (!disabled) bindTapButton(this.scene, zone, () => this.select(option.value));
      const rowChildren: Phaser.GameObjects.GameObject[] = [rowBg, text];
      if (check) rowChildren.push(check);
      rowChildren.push(zone);
      row.add(rowChildren);
      panel.add(row);
      redraw();
    });
    this.panel = panel;

    // Defer registration so the opening pointerdown does not immediately
    // close the panel. The trigger and panel are both explicitly exempted.
    this.scene.time.delayedCall(0, () => {
      if (!this.panel) return;
      this.closeListener = (p: Phaser.Input.Pointer) => {
        if (Phaser.Geom.Rectangle.Contains(triggerBounds, p.worldX, p.worldY)) return;
        if (Phaser.Geom.Rectangle.Contains(panelBounds, p.worldX, p.worldY)) return;
        this.close();
      };
      this.scene.input.on('pointerdown', this.closeListener);
    });
  }

  private select(v: T): void {
    this.value = v;
    this.trigger.setValue(this.selectedLabel());
    this.close();
    this.opts.onSelect(v);
  }

  close(): void {
    if (!this.panel) return;
    this.panel.destroy();
    this.panel = null;
    this.trigger.setSelected(false);
    this.trigger.setOpen(false);
    if (this.closeListener) {
      this.scene.input.off('pointerdown', this.closeListener);
      this.closeListener = null;
    }
  }

  /**
   * Scene-shutdown cleanup: drop the outside-click listener and panel ref.
   * The scene owns GameObject destruction during shutdown, so this does not
   * restyle the trigger while Phaser's Text canvas is tearing down.
   */
  teardown(): void {
    if (this.closeListener) {
      this.scene.input.off('pointerdown', this.closeListener);
      this.closeListener = null;
    }
    this.panel = null;
  }

  /** Sync the displayed value from external state (for example a filter reset). */
  setValue(v: T): void {
    this.value = v;
    this.trigger.setValue(this.selectedLabel());
  }

  destroy(): void {
    this.close();
    this.trigger.container.destroy();
  }
}
