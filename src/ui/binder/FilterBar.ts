import Phaser from 'phaser';
import type { CardType, Color, Rarity } from '../../engine/types';
import {
  SORT_LABEL,
  type CollectionFilterState,
  type SortMode,
} from '../../meta/collectionFilter';
import { TIER_LABEL } from '../../meta/variants';
import { bindTapButton, inflateHitArea } from '../../platform/gestures';
import { Dropdown, type DropdownOption } from '../Dropdown';

/**
 * Tier text colours for chips and binder badges — the light stops of
 * CardFrameFactory's gem palette (c lightened from the near-black gem grey so
 * it reads on the dimmed backdrop).
 */
export const TIER_TEXT_COLOR: Record<Rarity, string> = {
  c: '#9aa0ab', // grey (gem-c is #2b2b30)
  r: '#dfe6f2', // silver-blue (gem-r)
  sr: '#ffe08a', // gold (gem-sr)
  ssr: '#d9a8ff', // violet (gem-ssr)
  ur: '#ff9a8a', // crimson (gem-ur)
};

const PILL_BG = '#241d3a';
const PILL_BG_ACTIVE = '#5a4390';
const PILL_FG = '#c9bde0';
const PILL_FG_ACTIVE = '#ffffff';

/**
 * The Collection binder's control bar. Modern dropdowns (one per facet — set /
 * colour / type / rarity / sort) plus an Owned toggle pill, all mutating a
 * shared CollectionFilterState and calling `onChange`. Replaces the old
 * two-row chip grid. Opening one dropdown closes the others.
 */
export class FilterBar {
  /** Interactive controls handed to the scene's ModalGuard. */
  readonly targets: Phaser.GameObjects.GameObject[] = [];
  private readonly dropdowns: Dropdown<string>[] = [];
  private readonly ownedPill: Phaser.GameObjects.Text;
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

    const setOpts: DropdownOption<'all' | 'base' | 'ragnarok'>[] = [
      { value: 'all', label: 'All Sets' },
      { value: 'base', label: 'Base' },
      { value: 'ragnarok', label: 'Ragnarök' },
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
      { value: 'instant', label: 'Instant' },
      { value: 'sorcery', label: 'Sorcery' },
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

    // Owned toggle — a pill, since it is boolean, not a select.
    this.ownedPill = scene.add
      .text(955, y, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '600',
        color: PILL_FG,
        backgroundColor: PILL_BG,
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(scene, this.ownedPill, () => {
      state.ownedOnly = !state.ownedOnly;
      this.refreshOwned();
      change();
    });
    this.targets.push(this.ownedPill);
    this.refreshOwned();

    // On scene shutdown, drop each dropdown's outside-click pointer listener so
    // it can't fire on a torn-down scene. Uses teardown() (listener + panel ref
    // only) rather than close(), because restyling the being-destroyed button
    // Texts during shutdown throws in Text.updateText. `once` auto-removes.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const dd of this.dropdowns) dd.teardown();
    });
  }

  private closeAllExcept(keep: Dropdown<string>): void {
    for (const dd of this.dropdowns) if (dd !== keep) dd.close();
  }

  /** Close any open dropdown — the scene calls this before opening an overlay. */
  closeAll(): void {
    for (const dd of this.dropdowns) dd.close();
  }

  private refreshOwned(): void {
    const on = this.state.ownedOnly;
    this.ownedPill.setText(on ? '● Owned only' : '○ Owned only');
    this.ownedPill.setColor(on ? PILL_FG_ACTIVE : PILL_FG);
    this.ownedPill.setBackgroundColor(on ? PILL_BG_ACTIVE : PILL_BG);
    inflateHitArea(this.ownedPill, 96, 40);
  }
}
