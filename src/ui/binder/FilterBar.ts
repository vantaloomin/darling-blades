import Phaser from 'phaser';
import type { CardType, Color, Rarity } from '../../engine/types';
import {
  SORT_LABEL,
  type CollectionFilterState,
  type SortMode,
} from '../../meta/collectionFilter';
import { TIER_LABEL } from '../../meta/variants';
import { Dropdown, type DropdownOption } from '../Dropdown';
import { roundedTrigger, type RoundedTrigger } from '../themeWidgets';
import { TIER_TEXT_COLOR } from '../theme';

/**
 * Tier text colours for chips and binder badges - the light stops of
 * CardFrameFactory's gem palette (c lightened from the near-black gem grey so
 * it reads on the dimmed backdrop).
 */
export { TIER_TEXT_COLOR };

/**
 * The Collection binder's control bar. Modern dropdowns (one per facet - set /
 * colour / type / rarity / sort) plus an Owned toggle pill, all mutating a
 * shared CollectionFilterState and calling onChange. Replaces the old
 * two-row chip grid. Opening one dropdown closes the others.
 */
export class FilterBar {
  /** Interactive controls handed to the scene's ModalGuard. */
  readonly targets: Phaser.GameObjects.GameObject[] = [];
  private readonly dropdowns: Dropdown<string>[] = [];
  private readonly ownedPill: RoundedTrigger;
  private readonly state: CollectionFilterState;

  constructor(
    scene: Phaser.Scene,
    state: CollectionFilterState,
    opts: { y: number; onChange: () => void },
  ) {
    this.state = state;
    const y = opts.y;
    const change = opts.onChange;

    const mk = <T extends string>(
      x: number,
      label: string,
      options: DropdownOption<T>[],
      get: () => T,
      set: (v: T) => void,
      minW = 96,
    ): void => {
      const dd = new Dropdown<T>(scene, x, y, {
        label,
        options,
        value: get(),
        minW,
        onSelect: (v) => {
          set(v);
          change();
        },
        onOpen: () => this.closeAllExcept(dd as unknown as Dropdown<string>),
      });
      this.dropdowns.push(dd as unknown as Dropdown<string>);
      this.targets.push(dd.button);
    };

    const setOpts: DropdownOption<'all' | 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court'>[] = [
      { value: 'all', label: 'All Sets' },
      { value: 'base', label: 'Core Set' },
      { value: 'ragnarok', label: 'Ragnar\u00f6k' },
      { value: 'celtic-fae', label: 'Celtic Fae' },
      { value: 'arthurian-court', label: 'Arthurian Court' },
    ];
    mk(55, 'Set', setOpts, () => state.set, (v) => (state.set = v), 92);

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
      { value: 'c', label: TIER_LABEL.c },
      { value: 'r', label: TIER_LABEL.r },
      { value: 'sr', label: TIER_LABEL.sr },
      { value: 'ssr', label: TIER_LABEL.ssr },
      { value: 'ur', label: TIER_LABEL.ur },
    ];
    mk(600, 'Rarity', rarityOpts, () => state.rarity, (v) => (state.rarity = v), 90);

    const sortOpts: DropdownOption<SortMode>[] = [
      { value: 'rarity', label: SORT_LABEL.rarity },
      { value: 'mana', label: SORT_LABEL.mana },
      { value: 'name', label: SORT_LABEL.name },
    ];
    mk(775, 'Sort', sortOpts, () => state.sort, (v) => (state.sort = v), 92);

    // Owned toggle - a rounded shared trigger, since it is boolean, not a select.
    this.ownedPill = roundedTrigger(scene, 955, y, '', {
      variant: 'ghost',
      size: 'sm',
      minWidth: 96,
      onTap: () => {
        state.ownedOnly = !state.ownedOnly;
        this.refreshOwned();
        change();
      },
    });
    this.targets.push(this.ownedPill.inputZone);
    this.refreshOwned();

    // On scene shutdown, drop each dropdown's outside-click pointer listener so
    // it cannot fire on a torn-down scene. Uses teardown() (listener + panel ref
    // only) rather than close(), because restyling the being-destroyed trigger
    // during shutdown is unsafe. once auto-removes.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const dd of this.dropdowns) dd.teardown();
    });
  }

  private closeAllExcept(keep: Dropdown<string>): void {
    for (const dd of this.dropdowns) if (dd !== keep) dd.close();
  }

  /** Close any open dropdown - the scene calls this before opening an overlay. */
  closeAll(): void {
    for (const dd of this.dropdowns) dd.close();
  }

  private refreshOwned(): void {
    const on = this.state.ownedOnly;
    this.ownedPill.setLabel(on ? '\u25cf Owned only' : '\u25cb Owned only');
    this.ownedPill.setSelected(on);
  }
}
