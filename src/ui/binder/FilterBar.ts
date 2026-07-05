import Phaser from 'phaser';
import type { CardType, Color, Rarity } from '../../engine/types';
import {
  nextSortMode,
  SORT_LABEL,
  type CollectionFilterState,
} from '../../meta/collectionFilter';
import { TIER_LABEL } from '../../meta/variants';
import { bindTapButton, inflateHitArea } from '../../platform/gestures';

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

/**
 * Horizontal chip pitch is the full 90px minimum; chip hit HEIGHT is the row
 * pitch (50px) so the two stacked rows never overlap each other — and the
 * caller places the rows so row B's hit rects end above the top card pockets
 * (CollectionScene documents that budget).
 */
const CHIP_PITCH = 90;
const CHIP_HIT_H = 50;

const CHIP_BG = '#241d3a';
const CHIP_BG_ACTIVE = '#5a4390';
const CHIP_FG = '#c9bde0';
const CHIP_FG_ACTIVE = '#ffffff';

interface Chip {
  text: Phaser.GameObjects.Text;
  isActive: () => boolean;
  idleColor: string;
  minW: number;
}

/**
 * The Collection binder's control bar: two chip rows (row A: color facet +
 * Owned toggle + sort cycler; row B: type facet + rarity facet) mutating a
 * shared CollectionFilterState. Facets toggle off when their active chip is
 * tapped again. Every restyle goes through refresh(), which re-inflates every
 * chip hit area (Phaser's Text.updateText resets hit bounds on ANY
 * setText/setColor — playbook §11).
 */
export class FilterBar {
  /** All interactive chips — the scene hands these to ModalGuard. */
  readonly targets: Phaser.GameObjects.GameObject[] = [];
  private chips: Chip[] = [];
  private sortChip: Chip;
  private readonly state: CollectionFilterState;

  constructor(
    scene: Phaser.Scene,
    state: CollectionFilterState,
    opts: { rowAY: number; rowBY: number; onChange: () => void },
  ) {
    this.state = state;
    const change = (): void => {
      this.refresh();
      opts.onChange();
    };

    const mk = (
      x: number,
      y: number,
      label: string,
      isActive: () => boolean,
      onTap: () => void,
      minW = CHIP_PITCH,
      idleColor = CHIP_FG,
    ): Chip => {
      const text = scene.add
        .text(x, y, label, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          fontStyle: '600',
          color: idleColor,
          backgroundColor: CHIP_BG,
          padding: { x: 10, y: 5 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(scene, text, onTap);
      const chip: Chip = { text, isActive, idleColor, minW };
      this.chips.push(chip);
      this.targets.push(text);
      return chip;
    };

    // Row A — color facet ('All' explicit; a color chip re-tapped toggles off).
    const colorDefs: { key: Color | 'all'; label: string }[] = [
      { key: 'all', label: 'All' },
      { key: 'W', label: 'W' },
      { key: 'U', label: 'U' },
      { key: 'B', label: 'B' },
      { key: 'R', label: 'R' },
      { key: 'G', label: 'G' },
    ];
    colorDefs.forEach((def, i) =>
      mk(
        260 + i * CHIP_PITCH,
        opts.rowAY,
        def.label,
        () => state.color === def.key,
        () => {
          state.color = state.color === def.key ? 'all' : def.key;
          change();
        },
      ),
    );

    mk(
      830,
      opts.rowAY,
      'Owned',
      () => state.ownedOnly,
      () => {
        state.ownedOnly = !state.ownedOnly;
        change();
      },
    );

    // Sort cycler — label rewritten on every refresh (hence re-inflate there).
    this.sortChip = mk(
      1010,
      opts.rowAY,
      '',
      () => false,
      () => {
        state.sort = nextSortMode(state.sort);
        change();
      },
      170,
      '#e8e2f4',
    );

    // Row B — type facet, then rarity facet (20px group gap at x≈690).
    const typeDefs: { key: CardType; label: string }[] = [
      { key: 'creature', label: 'Creature' },
      { key: 'instant', label: 'Instant' },
      { key: 'sorcery', label: 'Sorcery' },
      { key: 'enchantment', label: 'Enchant' },
      { key: 'artifact', label: 'Artifact' },
      { key: 'land', label: 'Land' },
    ];
    typeDefs.forEach((def, i) =>
      mk(
        180 + i * CHIP_PITCH,
        opts.rowBY,
        def.label,
        () => state.type === def.key,
        () => {
          state.type = state.type === def.key ? 'all' : def.key;
          change();
        },
      ),
    );

    const rarities: Rarity[] = ['c', 'r', 'sr', 'ssr', 'ur'];
    rarities.forEach((r, i) =>
      mk(
        745 + i * CHIP_PITCH,
        opts.rowBY,
        TIER_LABEL[r],
        () => state.rarity === r,
        () => {
          state.rarity = state.rarity === r ? 'all' : r;
          change();
        },
        CHIP_PITCH,
        TIER_TEXT_COLOR[r],
      ),
    );

    this.refresh();
  }

  /** Restyle every chip from the current state and RE-INFLATE its hit area. */
  refresh(): void {
    for (const chip of this.chips) {
      if (chip === this.sortChip) {
        chip.text.setText(`Sort: ${SORT_LABEL[this.state.sort]}`);
        chip.text.setColor(chip.idleColor);
        chip.text.setBackgroundColor('#2d2547');
      } else {
        const active = chip.isActive();
        chip.text.setColor(active ? CHIP_FG_ACTIVE : chip.idleColor);
        chip.text.setBackgroundColor(active ? CHIP_BG_ACTIVE : CHIP_BG);
      }
      // Text.updateText just reset the hit bounds to the glyph rect — restore.
      inflateHitArea(chip.text, chip.minW, CHIP_HIT_H);
    }
  }
}
