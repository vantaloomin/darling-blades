import Phaser from 'phaser';
import { RARITY_NAMES } from '../../data/glossary';
import type { CardType, Color, Rarity } from '../../engine/types';
import {
  SORT_LABEL,
  type CollectionFilterState,
  type SortMode,
} from '../../meta/collectionFilter';
import { isLiveSet } from '../../data/liveness';
import { SET_IDS, SET_TITLES } from '../../data/setTitles';
import { colorInt, theme } from '../theme';
import { Dropdown, type DropdownOption } from '../Dropdown';
import { bindTapButton } from '../../platform/gestures';
import { controlPadding, measureThemedButton } from '../layout';
import { controlFontSize } from '../controlStyle';
import { themedButton, type ThemedButton } from '../themeWidgets';
import { iconToken } from '../iconLabel';
import { uiIconSize } from '../uiIcons';
import { TIER_TEXT_COLOR } from '../theme';
import { collectionFilterLayout, type CollectionFilterName } from '../collectionPresentation';

/**
 * Tier text colours for chips and binder badges - the light stops of
 * CardFrameFactory's gem palette (c lightened from the near-black gem grey so
 * it reads on the dimmed backdrop).
 */
export { TIER_TEXT_COLOR };

/**
 * The Collection binder's control bar. Modern dropdowns (one per facet - set /
 * colour / type / rarity / sort) plus an Owned only checkbox, all mutating a
 * shared CollectionFilterState and calling onChange. Replaces the old
 * two-row chip grid. Opening one dropdown closes the others.
 */
export class FilterBar {
  /** Interactive controls handed to the scene's ModalGuard. */
  readonly targets: Phaser.GameObjects.GameObject[] = [];
  private readonly dropdowns: Dropdown<string>[] = [];
  /** Owned only: a checkbox and its label, left-aligned in the last grid cell. */
  private readonly owned: {
    container: Phaser.GameObjects.Container;
    box: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    zone: Phaser.GameObjects.Zone;
    hover: boolean;
  };
  /**
   * The sort-direction flip (2026-10-09 UI review): a ghost button that shows
   * the current direction and flips it on tap. It shares the last grid cell
   * with Owned only, sized to its longest label so the checkbox never moves.
   */
  private readonly flip: {
    button: ThemedButton;
    label: () => string;
    width: number;
    showIcon: boolean;
  } | null = null;
  private readonly state: CollectionFilterState;
  private readonly top: number;
  bottom = 0;
  /** The grid's column width; the scene's search box takes one column. */
  columnWidth = 0;

  constructor(
    scene: Phaser.Scene,
    state: CollectionFilterState,
    opts: {
      y: number;
      onChange: () => void;
      sortControl?: {
        options: readonly DropdownOption<string>[];
        get: () => string;
        set: (value: string) => void;
        /** A direction flip beside Owned only; `labels` sizes it to its longest state. */
        direction?: {
          label: () => string;
          labels: readonly string[];
          flip: () => void;
        };
      };
    },
  ) {
    this.state = state;
    const y = opts.y;
    this.top = y - theme.control.minHitHeight / 2;
    const change = opts.onChange;

    const mk = <T extends string>(
      x: number,
      label: string,
      options: DropdownOption<T>[],
      get: () => T,
      set: (v: T) => void,
      minW = 96,
      maxValueWidth = 150,
    ): void => {
      const dd = new Dropdown<T>(scene, x, y, {
        label,
        options,
        value: get(),
        minW,
        maxValueWidth,
        onSelect: (v) => {
          set(v);
          this.reflow();
          change();
        },
        onOpen: () => this.closeAllExcept(dd as unknown as Dropdown<string>),
      });
      this.dropdowns.push(dd as unknown as Dropdown<string>);
      this.targets.push(dd.button);
    };

    const setOpts: DropdownOption<CollectionFilterState['set']>[] = [
      { value: 'all', label: 'All sets' },
      ...SET_IDS.filter(isLiveSet).map((id) => ({ value: id, label: SET_TITLES[id] })),
    ];
    // The row starts on the title-safe frame's left edge (it started at x 55
    // until the 1.8 cut, 2026-09-23); reflow() places everything after it.
    mk(theme.design.safeLeft, 'Set', setOpts, () => state.set, (v) => (state.set = v), 92, 180);

    const colorOpts: DropdownOption<Color | 'all'>[] = [
      { value: 'all', label: 'All' },
      { value: 'W', label: 'White' },
      { value: 'U', label: 'Blue' },
      { value: 'B', label: 'Black' },
      { value: 'R', label: 'Red' },
      { value: 'G', label: 'Green' },
    ];
    mk(235, 'Color', colorOpts, () => state.color, (v) => (state.color = v), 92);

    const typeOpts: DropdownOption<CardType | 'all'>[] = [
      { value: 'all', label: 'All' },
      { value: 'creature', label: 'Creature' },
      { value: 'charm', label: 'Charm' },
      { value: 'ritual', label: 'Ritual' },
      { value: 'enchantment', label: 'Enchantment' },
      { value: 'artifact', label: 'Artifact' },
      { value: 'land', label: 'Land' },
    ];
    mk(410, 'Type', typeOpts, () => state.type, (v) => (state.type = v), 96);

    const rarityOpts: DropdownOption<Rarity | 'all'>[] = [
      { value: 'all', label: 'All' },
      { value: 'c', label: RARITY_NAMES.c },
      { value: 'r', label: RARITY_NAMES.r },
      { value: 'sr', label: RARITY_NAMES.sr },
      { value: 'ssr', label: RARITY_NAMES.ssr },
      { value: 'ur', label: RARITY_NAMES.ur },
    ];
    mk(600, 'Rarity', rarityOpts, () => state.rarity, (v) => (state.rarity = v), 90);

    const sortOpts: DropdownOption<SortMode>[] = [
      { value: 'rarity', label: SORT_LABEL.rarity },
      { value: 'mana', label: SORT_LABEL.mana },
      { value: 'name', label: SORT_LABEL.name },
    ];
    if (opts.sortControl) {
      mk(
        775,
        'Sort by',
        [...opts.sortControl.options],
        opts.sortControl.get,
        opts.sortControl.set,
        230,
        210,
      );
    } else {
      mk(775, 'Sort', sortOpts, () => state.sort, (v) => (state.sort = v), 92);
    }
    // Owned toggle - a rounded shared trigger, since it is boolean, not a select.
    // It joins the reflow after the last dropdown rather than sitting at a
    // fixed x, so the row cannot run into it when the first chip moves.
    // A checkbox, not a full-width pill: it is a filter toggle, so it reads
    // like one and starts on the same left inset as the dropdown labels.
    const ownedLabel = scene.add.text(0, 0, 'Owned only', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.label}px`,
      fontStyle: theme.weight.w600,
      color: theme.colors.body,
    }).setOrigin(0, 0.5);
    const ownedZone = scene.add.zone(0, 0, 1, theme.control.minHitHeight).setOrigin(0, 0.5);
    ownedZone.setInteractive({ useHandCursor: true });
    const ownedBox = scene.add.graphics();
    this.owned = {
      container: scene.add.container(0, y, [ownedBox, ownedLabel, ownedZone]),
      box: ownedBox,
      label: ownedLabel,
      zone: ownedZone,
      hover: false,
    };
    ownedZone.on('pointerover', () => { this.owned.hover = true; this.refreshOwned(); });
    ownedZone.on('pointerout', () => { this.owned.hover = false; this.refreshOwned(); });
    bindTapButton(scene, ownedZone, () => {
      state.ownedOnly = !state.ownedOnly;
      this.refreshOwned();
      change();
    });
    this.targets.push(ownedZone);
    const direction = opts.sortControl?.direction;
    if (direction) {
      // Keep the arrows only while the shared cell has room for them; at large
      // text sizes they go before any of the words do.
      const widths = flipWidths(scene, direction.labels);
      const fits = (width: number): boolean => {
        const need = width + theme.space(2) + this.checkboxWidth();
        return collectionFilterLayout([...this.dropdowns.map((dd) => dd.naturalWidth()), need], this.top).columnWidth >= need;
      };
      const showIcon = fits(widths.withIcon);
      const width = showIcon ? widths.withIcon : widths.textOnly;
      const button = themedButton(scene, 0, y, '', {
        variant: 'ghost',
        size: 'md',
        minWidth: width,
        onTap: () => {
          direction.flip();
          this.refreshFlip();
          change();
        },
      });
      this.flip = { button, label: direction.label, width, showIcon };
      this.targets.push(button.inputZone);
    }
    this.refreshOwned();
    this.reflow();

    // On scene shutdown, drop each dropdown's outside-click pointer listener so
    // it cannot fire on a torn-down scene. Uses teardown() (listener + panel ref
    // only) rather than close(), because restyling the being-destroyed trigger
    // during shutdown is unsafe. once auto-removes.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const dd of this.dropdowns) dd.teardown();
    });
  }

  /**
   * Lay the controls on collectionFilterLayout's equal-column grid: each
   * trigger is measured at its natural width, then stretched to its column,
   * so the bar spans the binder and every edge shares a column line. The
   * Owned only checkbox takes the last cell, left-aligned on the labels' inset.
   */
  private reflow(): void {
    const flipWidth = this.flip ? this.flip.width + theme.space(2) : 0;
    const layout = collectionFilterLayout(
      [...this.dropdowns.map((dd) => dd.naturalWidth()), flipWidth + this.checkboxWidth()],
      this.top,
    );
    this.columnWidth = layout.columnWidth;
    this.dropdowns.forEach((dd, index) => {
      const rect = layout.controls[index];
      dd.setWidth(rect.width);
      dd.setPosition(rect.x - dd.visualBounds().x, rect.y + rect.height / 2);
    });
    const rect = layout.controls[layout.controls.length - 1];
    const ownedX = rect.x + flipWidth;
    const ownedWidth = rect.x + rect.width - ownedX;
    if (this.flip) {
      this.flip.button.container.setPosition(rect.x + this.flip.width / 2, rect.y + rect.height / 2);
      this.refreshFlip();
    }
    this.owned.container.setPosition(ownedX, rect.y + rect.height / 2);
    this.owned.label.setX(controlPadding('md') + this.ownedBoxSize() + theme.space(2));
    this.owned.zone.setSize(ownedWidth, rect.height);
    this.owned.zone.input?.hitArea.setTo(0, 0, ownedWidth, rect.height);
    this.refreshOwned();
    this.bottom = layout.bottom;
  }

  /** Fixture entry and scene-level navigation guard share the real controls. */
  open(name: CollectionFilterName): void {
    this.dropdowns[['set', 'color', 'type', 'rarity', 'sort'].indexOf(name)]?.open();
  }

  get isOpen(): boolean {
    return this.dropdowns.some((dd) => dd.isOpen);
  }

  private closeAllExcept(keep: Dropdown<string>): void {
    for (const dd of this.dropdowns) if (dd !== keep) dd.close();
  }

  /** Close any open dropdown - the scene calls this before opening an overlay. */
  closeAll(): void {
    for (const dd of this.dropdowns) dd.close();
  }

  /** Show the current direction; picking a new criterion resets it, so the dropdown's reflow calls this too. */
  private refreshFlip(): void {
    if (!this.flip) return;
    const text = this.flip.label();
    this.flip.button.setLabel(this.flip.showIcon ? `${iconToken('sort')} ${text}` : text);
  }

  private checkboxWidth(): number {
    return controlPadding('md') * 2 + this.ownedBoxSize() + theme.space(2) + this.owned.label.width;
  }

  private ownedBoxSize(): number {
    return Math.round(theme.type.label * 1.2);
  }

  /** Redraw the Owned only box: an outlined square, gold-filled with a check when on. */
  private refreshOwned(): void {
    const on = this.state.ownedOnly;
    const { box, label, hover } = this.owned;
    const size = this.ownedBoxSize();
    const x = controlPadding('md');
    const c = theme.colors;
    box.clear();
    box.fillStyle(colorInt(on ? c.gold : c.btnGhostBg), 1);
    box.fillRoundedRect(x, -size / 2, size, size, 3);
    box.lineStyle(theme.control.borderWidth, colorInt(on || hover ? c.gold : c.panelStroke), 1);
    box.strokeRoundedRect(x, -size / 2, size, size, 3);
    if (on) {
      box.lineStyle(Math.max(2, Math.round(size / 8)), colorInt(c.onGold), 1);
      box.beginPath();
      box.moveTo(x + size * 0.24, size * 0.02);
      box.lineTo(x + size * 0.42, size * 0.2);
      box.lineTo(x + size * 0.76, -size * 0.2);
      box.strokePath();
    }
    label.setColor(on || hover ? c.gold : c.body);
  }
}

/**
 * The flip button's fixed width, with and without its arrows: the longest
 * label decides it, so the button and the checkbox beside it hold still as
 * the label changes. Mirrors themedButton's icon-label metrics.
 */
function flipWidths(scene: Phaser.Scene, labels: readonly string[]): { withIcon: number; textOnly: number } {
  const fontSize = controlFontSize('md');
  const probe = scene.add.text(0, 0, '', {
    fontFamily: theme.fonts.ui,
    fontSize: `${fontSize}px`,
    fontStyle: theme.weight.w600,
  });
  const longest = Math.max(0, ...labels.map((label) => probe.setText(label).width));
  probe.destroy();
  const icon = uiIconSize(fontSize) + theme.space(1.5);
  return {
    withIcon: measureThemedButton(icon + longest, 'md', 0).visual.width,
    textOnly: measureThemedButton(longest, 'md', 0).visual.width,
  };
}
