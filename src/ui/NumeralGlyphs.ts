import type Phaser from 'phaser';
import {
  isNumeralText,
  NUMERAL_PATHS,
  numeralBadgeGeometry,
  numeralLayout,
  numeralPlateGeometry,
  type NumeralLayout,
  type NumeralPlateSpec,
} from '../art/numeralPaths';

/**
 * Vector numerals for round badges (pick order, castable counts), count
 * plates (Marks, pile counts) and the mana beads. One fill routine, so a
 * bead and a badge draw the same digits.
 */

/** Fill a laid-out numeral group in `ink` (layout units = canvas pixels). */
export function fillNumeral(ctx: CanvasRenderingContext2D, layout: NumeralLayout, ink: string): void {
  ctx.save();
  ctx.fillStyle = ink;
  for (const glyph of layout.glyphs) {
    ctx.save();
    ctx.translate(glyph.tx, glyph.ty);
    ctx.scale(layout.k, layout.k);
    ctx.fill(new Path2D(NUMERAL_PATHS[glyph.glyph]), 'evenodd');
    ctx.restore();
  }
  ctx.restore();
}

/** A label a numeral badge can draw as vector glyphs: a whole number, a
 * Mark count "+2" or repeated picks "1, 2". */
export function isNumeralLabel(label: string | null | undefined): label is string {
  return typeof label === 'string' && label.length <= 40 && isNumeralText(label);
}

/** Baked at twice the display size, like the resolution-2 Text it replaces. */
const BADGE_RESOLUTION = 2;

export interface NumeralBadgeInk {
  /** Texture key: the digits alone, on a transparent square. */
  texture: string;
  /** The disc diameter (and the image's display size), in design pixels. */
  diameter: number;
}

/**
 * Bake (once) the numeral label for a round badge and return the texture and
 * the disc diameter to draw it on. The texture is a transparent square of the
 * disc's size: place the Image at the disc centre with
 * `setDisplaySize(diameter, diameter)` and the numeral's ink sits centred on
 * the disc. The disc itself (fill, ring) stays the consumer's own shape, so
 * every badge keeps its look and only the numeral changes from font to vector.
 * `digitHeight` is the cap height in design pixels; `ink` a CSS colour, read
 * from the live theme so high contrast bakes its own texture.
 */
export function ensureNumeralBadgeInk(
  scene: Phaser.Scene,
  label: number | string,
  ink: string,
  digitHeight: number,
  minDiameter: number,
): NumeralBadgeInk {
  const { diameter, options } = numeralBadgeGeometry(label, digitHeight, minDiameter);
  const texture = `numeral-badge-${label}-${ink}-${digitHeight.toFixed(2)}-${minDiameter}`;
  if (!scene.textures.exists(texture)) {
    const size = Math.ceil(diameter * BADGE_RESOLUTION);
    // The same layout in texture pixels: its options are disc fractions.
    const tex = scene.textures.createCanvas(texture, size, size)!;
    fillNumeral(tex.getContext(), numeralLayout(label, size, options), ink);
    tex.refresh();
  }
  return { texture, diameter };
}

export interface NumeralPlateInk {
  /** Texture key: the label alone, on a transparent plate-sized rectangle. */
  texture: string;
  /** The plate's size (and the image's display size), in design pixels. */
  width: number;
  height: number;
}

/**
 * Bake (once) a numeral label for a rectangular plate (the Mark "+2" badge,
 * a pile count). Like the round badge, the texture is transparent and the
 * plate's size: place the Image on the plate centre with
 * `setDisplaySize(width, height)`; the plate itself stays the consumer's.
 */
export function ensureNumeralPlateInk(
  scene: Phaser.Scene,
  label: number | string,
  ink: string,
  spec: NumeralPlateSpec,
): NumeralPlateInk {
  const { width, height } = numeralPlateGeometry(label, spec);
  const texture = `numeral-plate-${label}-${ink}-${spec.digitHeight.toFixed(2)}-${spec.padX}-${spec.padY}`
    + `-${spec.minWidth ?? 0}-${spec.minHeight ?? 0}`;
  if (!scene.textures.exists(texture)) {
    // Whole texture pixels: the plate at twice its size, rounded up, with the
    // label laid out centred in exactly that canvas.
    const r = BADGE_RESOLUTION;
    const w = Math.ceil(width * r);
    const h = Math.ceil(height * r);
    const baked = numeralPlateGeometry(label, {
      digitHeight: spec.digitHeight * r, padX: spec.padX * r, padY: spec.padY * r, minWidth: w, minHeight: h,
    });
    const tex = scene.textures.createCanvas(texture, w, h)!;
    fillNumeral(tex.getContext(), baked.layout, ink);
    tex.refresh();
  }
  return { texture, width, height };
}

/**
 * Cap height of the bold UI-font digits the badges used to draw, so a vector
 * numeral keeps the size its Text had: Inter's figures stand 0.727 em,
 * Consolas's (the pile numerals) 0.64 em.
 */
export const INTER_FIGURE_HEIGHT = 0.727;
export const CONSOLAS_FIGURE_HEIGHT = 0.64;
