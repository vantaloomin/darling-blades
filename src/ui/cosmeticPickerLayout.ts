/**
 * The card-back / playmat chooser's vertical rhythm, Phaser-free so the rule
 * is testable (1.9 accessibility wave 3). Every offset is local: the subtitle
 * and grid from the shell's content top, the plate rows from the grid top.
 *
 * At standard text the release geometry stands: a 596 shell, the plate at its
 * natural 392, the name at 152, the blurb at 190 and the tag centred at 268.
 * Larger text pushes each row down by what the row above measured, and the
 * shell grows by exactly that, so a wrapped name never lands on its blurb and
 * the Equip button keeps its own band.
 */
import { theme } from './theme';

export const COSMETIC_PICKER = {
  width: 1120,
  height: 596,
  /** The plate's height inside the release shell. */
  gridHeight: 392,
  subtitleTop: theme.space(3),
  gridTop: theme.space(9),
  /** Under the 87px art or 84px swatch centred at 84. */
  nameTop: theme.space(38),
  blurbTop: theme.space(47.5),
  tagCenter: theme.space(67),
  /** The Equip button's centre sits this far above the plate's bottom. */
  buttonFromBottom: theme.space(11),
  /** Between two rows of a plate, and between the subtitle and the grid. */
  rowGap: theme.space(2),
} as const;

export interface CosmeticMeasured {
  subtitle: number;
  /** The tallest of each row across the plates, so rows stay level. */
  name: number;
  blurb: number;
  tag: number;
  /** The Equip button's hit height. */
  buttonHit: number;
}

export interface CosmeticRows {
  subtitleTop: number;
  gridTop: number;
  nameTop: number;
  blurbTop: number;
  tagCenter: number;
  gridHeight: number;
  /** What the shell grows past its release height. */
  extraHeight: number;
}

export function cosmeticPlateRows(m: CosmeticMeasured): CosmeticRows {
  const C = COSMETIC_PICKER;
  const gridTop = Math.max(C.gridTop, C.subtitleTop + m.subtitle + C.rowGap);
  const blurbTop = Math.max(C.blurbTop, C.nameTop + m.name + C.rowGap);
  const tagCenter = Math.max(C.tagCenter, blurbTop + m.blurb + C.rowGap + m.tag / 2);
  const buttonTopFromBottom = C.buttonFromBottom + m.buttonHit / 2;
  const gridHeight = Math.max(C.gridHeight, Math.ceil(tagCenter + m.tag / 2 + C.rowGap + buttonTopFromBottom));
  return {
    subtitleTop: C.subtitleTop,
    gridTop,
    nameTop: C.nameTop,
    blurbTop,
    tagCenter,
    gridHeight,
    extraHeight: gridTop - C.gridTop + gridHeight - C.gridHeight,
  };
}
