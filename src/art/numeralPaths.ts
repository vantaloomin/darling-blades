/**
 * Hand-authored SVG path strings for the generic-cost numerals baked into the
 * grey `pip-C-<n>` beads (src/ui/ManaSymbols.ts `ensureNumeralPip`). Same
 * conventions as iconPaths.ts: absolute commands only (M/L/C/Z here), and
 * consumers fill with the 'evenodd' rule. Each glyph is ONE outer contour
 * plus non-overlapping counters (0 4 6 8 9), so evenodd punches every counter.
 *
 * Box: designed in a 100x100 box, y down. The figures are LINING: every
 * digit's ink runs from the cap line y=14 to the baseline y=86 (cap height
 * 72), so a "10" never bounces. Horizontal placement inside the box is
 * loose on purpose; layout never trusts it, it centres each group on its
 * real ink bounds (`pathInkBox`), never on font or box metrics.
 *
 * Style: a bold classical serif in the spirit of the game's Cinzel titling,
 * with vertical stress (stems and bowl sides ~14-15 units, hairlines and
 * bars ~7-8), bracketed slab serifs on 1 and 4, ball terminals on 2 3 5 6 9.
 * Strokes are sized to survive the 64px bake shrunk to a 16px bead.
 */
export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
/** A glyph a numeral label can draw: the digits, the comma of a repeated-pick
 * label ("1, 2") and the plus of a Mark count ("+2"). */
export type NumeralGlyph = Digit | ',' | '+';

export const NUMERAL_PATHS: Record<NumeralGlyph, string> = {
  // 0: tall oval ring, thick sides, hairline top and bottom.
  '0':
    'M50 14 C63.8 14 75 30.1 75 50 C75 69.9 63.8 86 50 86 C36.2 86 25 69.9 25 50 C25 30.1 36.2 14 50 14 Z ' +
    'M50 21 C55.8 21 60.5 34 60.5 50 C60.5 66 55.8 79 50 79 C44.2 79 39.5 66 39.5 50 C39.5 34 44.2 21 50 21 Z',
  // 1: thick stem, curved flag to the upper left, bracketed foot serif.
  '1':
    'M57.5 14 L57.5 76 C57.5 79 60 80 66 80.5 L68 81 L68 86 L32 86 L32 81 L34 80.5 ' +
    'C40 80 42.5 79 42.5 76 L42.5 29 C39 30.5 34 31.5 29 31.5 L29 27.5 C36 25 42 20 46 14 Z',
  // 2: ball terminal, round shoulder, thick spine sweeping to a flat foot
  // with an upturned spur.
  '2':
    'M50 14 C65 14 74 23 74 35 C74 48 64 57 50 67 L40 75.5 L67 75.5 C70 75.5 71.5 74 72.5 70 ' +
    'L76 70 L76 86 L26 86 L26 82 C42 69 59 55 59.5 36 C60 27 56 21.5 49 21.5 ' +
    'C42 21.5 38 25 37 30 C41 31 43 34 43 37.5 C43 42 39.5 45 35 45 C30 45 27 41.5 27 37 ' +
    'C27 24 37 14 50 14 Z',
  // 3: two bowls (the lower one wider), short pointed waist, ball terminals left.
  '3':
    'M49 14 C63 14 72 22 72 32.5 C72 41 66 46.5 58 48.5 C68 50.5 76 58 76 67 ' +
    'C76 79 65 86 50 86 C36 86 25 80 25 71.5 C25 67 28.5 64 33 64 C37.5 64 41 67 41 71 ' +
    'C41 74 39.5 75.5 38.5 77 C41 78.5 45 79 49 79 C57 79 61 74 61 66.5 C61 58 56 53 46 53 ' +
    'L43 53 L39.5 49.5 L43 46 L45 46 C53 46 58 41 58 33 C58 26 54.5 21.5 48.5 21.5 ' +
    'C43 21.5 40 23.5 38.5 26 C40 27 41 29 41 31 C41 35 38 38 34 38 C29.5 38 26.5 34.5 26.5 30.5 ' +
    'C26.5 20 37 14 49 14 Z',
  // 4: hairline diagonal into a thick stem, crossbar, bracketed foot serif;
  // the triangle counter is punched.
  '4':
    'M52 14 L68 14 L68 61 L78 61 L78 69 L68 69 L68 78 C68 80 69 80.5 71 80.5 L75 81 L75 86 ' +
    'L46 86 L46 81 L50 80.5 C52 80.5 53 80 53 78 L53 69 L22 69 L22 62 Z ' +
    'M53 27.5 L53 61 L32 61 Z',
  // 5: flat top bar, short stem, round bowl, ball terminal lower left.
  '5':
    'M31 14 L71 14 L68.5 23 L41 23 L40 39.5 C43.5 37.5 47.5 37 51.5 37 C66 37 76 46.5 76 61 ' +
    'C76 76 65 86 49.5 86 C35.5 86 25 80 25 71.5 C25 67 28.5 64 33 64 C37.5 64 41 67 41 71 ' +
    'C41 74 39.5 75.5 38.5 77 C41 78.5 45 79 49 79 C57 79 61 72 61 62 C61 51.5 56 44.5 48 44.5 ' +
    'C42 44.5 36.5 46.5 32.5 50 L29.5 50 Z',
  // 6: ball terminal upper right, thick left sweep into a round bowl.
  '6':
    'M52 14 C63 14 72 19.5 72 27.5 C72 32 68.5 35.5 64 35.5 C59.5 35.5 56 32 56 27.5 ' +
    'C56 25 57 23.5 58.5 22.5 C56.5 21.8 54.5 21.5 52.5 21.5 C44 21.5 40 30 39.5 42 ' +
    'C43.5 39 47.5 37.5 52 37.5 C66 37.5 76 47 76 61.5 C76 76 65 86 50.5 86 ' +
    'C35 86 25 72 25 52 C25 29 37 14 52 14 Z ' +
    'M50.5 44.5 C57 44.5 61 52 61 62 C61 72 57 79 50.5 79 C44 79 39.5 72 39.5 62 C39.5 52 44 44.5 50.5 44.5 Z',
  // 7: top bar with a dropped left serif, thick curved stem to the baseline.
  '7':
    'M25 14 L75 14 L75 20 C62 38 54 58 52.5 86 L37.5 86 C40 62 50 42 63 22.5 ' +
    'L33 22.5 C30 22.5 29 24 28.5 28 L25 29 Z',
  // 8: small upper bowl on a wider lower bowl, both counters punched.
  '8':
    'M50 14 C63 14 72 21.5 72 31.5 C72 39 67.5 44.5 61 47.5 C70 51 76 58 76 67 ' +
    'C76 78.5 65 86 50 86 C35 86 24 78.5 24 67 C24 58 30 51 39 47.5 ' +
    'C32.5 44.5 28 39 28 31.5 C28 21.5 37 14 50 14 Z ' +
    'M50 21.5 C55.5 21.5 59 25.5 59 32 C59 38.5 55.5 43 50 43 C44.5 43 41 38.5 41 32 C41 25.5 44.5 21.5 50 21.5 Z ' +
    'M50 51 C56.5 51 61 57 61 65 C61 73.5 56.5 79 50 79 C43.5 79 39 73.5 39 65 C39 57 43.5 51 50 51 Z',
  // 9: the 6 turned half a revolution about the box centre (50,50).
  '9':
    'M48 86 C37 86 28 80.5 28 72.5 C28 68 31.5 64.5 36 64.5 C40.5 64.5 44 68 44 72.5 ' +
    'C44 75 43 76.5 41.5 77.5 C43.5 78.2 45.5 78.5 47.5 78.5 C56 78.5 60 70 60.5 58 ' +
    'C56.5 61 52.5 62.5 48 62.5 C34 62.5 24 53 24 38.5 C24 24 35 14 49.5 14 ' +
    'C65 14 75 28 75 48 C75 71 63 86 48 86 Z ' +
    'M49.5 55.5 C43 55.5 39 48 39 38 C39 28 43 21 49.5 21 C56 21 60.5 28 60.5 38 C60.5 48 56 55.5 49.5 55.5 Z',
  // ,: a ball sitting on the baseline (the digits' ball terminals) with a
  // tapering tail curled down and left below it.
  ',':
    'M50 69.5 C55 69.5 59 73.5 59 78.5 C59 88 54 95.5 44 100.5 L42.5 97.5 C48 94.5 51 91 52 87.2 ' +
    'C51.4 87.4 50.7 87.5 50 87.5 C45 87.5 41 83.5 41 78.5 C41 73.5 45 69.5 50 69.5 Z',
  // +: even arms (between the stems and the hairlines in weight) crossing on
  // the cap middle, so a "+2" sits level with its digit.
  '+':
    'M45 29 L55 29 L55 45 L71 45 L71 55 L55 55 L55 71 L45 71 L45 55 L29 55 L29 45 L45 45 Z',
};

export interface InkBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Real ink bounds of the cubic segment p0..p3 on one axis (exact: endpoints
 * plus the roots of the derivative inside (0,1)). */
function cubicExtent(p0: number, p1: number, p2: number, p3: number): [number, number] {
  let lo = Math.min(p0, p3);
  let hi = Math.max(p0, p3);
  // B'(t)/3 = a t^2 + b t + c
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) roots.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      roots.push((-b + s) / (2 * a), (-b - s) / (2 * a));
    }
  }
  for (const t of roots) {
    if (t <= 0 || t >= 1) continue;
    const u = 1 - t;
    const v = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return [lo, hi];
}

/**
 * Ink bounding box of an absolute M/L/C/Z path, computed from the curve
 * geometry itself (control points that the curve never reaches do not
 * count). Throws on any other command so a new glyph cannot slip in a
 * command this measurement ignores.
 */
export function pathInkBox(d: string): InkBox {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const box: InkBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x: number, y: number): void => {
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y);
    box.maxY = Math.max(box.maxY, y);
  };
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  const num = (): number => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error(`pathInkBox: bad number in "${d}"`);
    return v;
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') {
      x = num();
      y = num();
      include(x, y);
    } else if (cmd === 'C') {
      const x1 = num();
      const y1 = num();
      const x2 = num();
      const y2 = num();
      const x3 = num();
      const y3 = num();
      const [lx, hx] = cubicExtent(x, x1, x2, x3);
      const [ly, hy] = cubicExtent(y, y1, y2, y3);
      include(lx, ly);
      include(hx, hy);
      x = x3;
      y = y3;
    } else if (cmd === 'Z') {
      cmd = '';
    } else {
      throw new Error(`pathInkBox: unsupported command "${cmd || tokens[i]}" (absolute M/L/C/Z only)`);
    }
  }
  return box;
}

const INK_BOXES = new Map<NumeralGlyph, InkBox>();
function glyphInkBox(glyph: NumeralGlyph): InkBox {
  let box = INK_BOXES.get(glyph);
  if (!box) {
    box = pathInkBox(NUMERAL_PATHS[glyph]);
    INK_BOXES.set(glyph, box);
  }
  return box;
}

/** Gap between adjacent glyphs' ink, in path units (scaled with the glyphs). */
export const NUMERAL_TRACKING = 5;
/** The word space after a comma ("1, 2"), on top of the tracking. */
export const NUMERAL_WORD_SPACE = 16;
/** Cap height of a lone numeral as a fraction of the bead diameter. */
export const NUMERAL_CAP_FRACTION = 0.5;
/** Margin kept between the group's ink box corners and the bead's inner
 * edge, as a fraction of the bead diameter. The bead's outline stroke eats
 * the outer ~6% of the radius, so the ink box must stay within this radius. */
export const NUMERAL_SAFE_RADIUS = 0.4;

export interface NumeralGlyphPlacement {
  glyph: NumeralGlyph;
  /** Path-unit → bead-pixel transform: px = tx + k * x, py = ty + k * y. */
  tx: number;
  ty: number;
}

export interface NumeralLayout {
  /** Path-unit → bead-pixel scale shared by every glyph in the group. */
  k: number;
  glyphs: NumeralGlyphPlacement[];
}

interface GroupExtent {
  glyphs: NumeralGlyph[];
  /** Per glyph: the x shift that puts its ink left edge at its slot. */
  offsets: number[];
  width: number;
  /** The digits' cap line and height: what a label is sized and centred by
   * (a comma's tail hangs below the baseline, as it does in type). */
  top: number;
  height: number;
  /** Farthest ink above and below the cap box's middle (the comma's tail). */
  reach: number;
}

/** Labels a numeral can draw: a whole number, a Mark count "+2", or
 * repeated picks "1, 2". */
const NUMERAL_LABEL = /^\+?\d+(?:, \d+)*$/;

/** True when `label` is drawable in vector numerals. */
export function isNumeralText(label: string): boolean {
  return NUMERAL_LABEL.test(label);
}

function labelGlyphs(label: number | string): NumeralGlyph[] {
  if (typeof label === 'number') {
    if (!Number.isInteger(label) || label < 0) throw new Error(`numeralLayout: expected a whole number, got ${label}`);
    label = String(label);
  }
  if (!NUMERAL_LABEL.test(label)) throw new Error(`numeralLayout: not a numeral label: "${label}"`);
  return label.replace(/ /g, '').split('') as NumeralGlyph[];
}

/** The ink extent of a label's glyphs packed side by side, in path units. */
function groupExtent(label: number | string): GroupExtent {
  const glyphs = labelGlyphs(label);
  let cursor = 0;
  let top = Infinity;
  let bottom = -Infinity;
  let inkTop = Infinity;
  let inkBottom = -Infinity;
  const offsets: number[] = [];
  glyphs.forEach((glyph, index) => {
    const box = glyphInkBox(glyph);
    if (index > 0) cursor += NUMERAL_TRACKING + (glyphs[index - 1] === ',' ? NUMERAL_WORD_SPACE : 0);
    offsets.push(cursor - box.minX);
    cursor += box.maxX - box.minX;
    if (glyph !== ',' && glyph !== '+') {
      top = Math.min(top, box.minY);
      bottom = Math.max(bottom, box.maxY);
    }
    inkTop = Math.min(inkTop, box.minY);
    inkBottom = Math.max(inkBottom, box.maxY);
  });
  const middle = (top + bottom) / 2;
  const reach = Math.max(middle - inkTop, inkBottom - middle);
  return { glyphs, offsets, width: cursor, top, height: bottom - top, reach };
}

export interface NumeralLayoutOptions {
  /** A lone digit's cap height as a fraction of the box (default NUMERAL_CAP_FRACTION). */
  capFraction?: number;
  /** The radius, as a fraction of the box, that the group's ink box corners
   * must stay inside (default NUMERAL_SAFE_RADIUS). */
  safeRadius?: number;
}

/** Place a measured group at scale `k`, its ink width and cap box centred
 * on (cx, cy). */
function placeGroup(group: GroupExtent, k: number, cx: number, cy: number): NumeralLayout {
  const left = cx - (k * group.width) / 2;
  const ty = cy - k * (group.top + group.height / 2);
  return {
    k,
    glyphs: group.glyphs.map((glyph, index) => ({ glyph, tx: left + k * group.offsets[index], ty })),
  };
}

/**
 * Lay out a numeral label (a whole number, "+2", "1, 2") in a square box of
 * `boxSize` pixels (the bead, the badge disc or the Forge's SVG viewBox):
 * glyphs sit side by side with NUMERAL_TRACKING between their ink, and the
 * group's ink width and the digits' cap box are centred on the box centre
 * (for digits alone that is the ink box). A lone digit's cap height is
 * `capFraction` of the box; wider groups shrink until every ink corner,
 * a comma's tail included, sits inside `safeRadius` of the box centre.
 */
export function numeralLayout(label: number | string, boxSize: number, options: NumeralLayoutOptions = {}): NumeralLayout {
  const group = groupExtent(label);
  const capK = ((options.capFraction ?? NUMERAL_CAP_FRACTION) * boxSize) / group.height;
  const safe = (options.safeRadius ?? NUMERAL_SAFE_RADIUS) * boxSize;
  const fitK = safe / Math.hypot(group.width / 2, group.reach);
  return placeGroup(group, Math.min(capK, fitK), boxSize / 2, boxSize / 2);
}

/** How far inside a badge disc's edge the numeral's ink box corners stay:
 * clear of a ring stroked on the edge (up to 5px in high contrast, so 2.5px
 * inside) with a hair of air. */
export const NUMERAL_BADGE_INSET = 3;
/** Side padding a badge keeps around a wide numeral group (the old Text
 * badges grew their radius to `text.width / 2 + 4`). */
export const NUMERAL_BADGE_PAD = 4;

export interface NumeralBadgeGeometry {
  /** The disc's diameter in pixels: `minDiameter`, grown for wide groups. */
  diameter: number;
  /** The layout options as fractions of the disc, so a bake at any
   * resolution lays out the same numeral (`numeralLayout(n, size, options)`). */
  options: Required<NumeralLayoutOptions>;
  /** The numeral laid out in a `diameter`-pixel box centred on the disc. */
  layout: NumeralLayout;
}

/**
 * A numeral on a round badge (pick order, castable count): the digits keep
 * `digitHeight` pixels of cap height, the disc keeps `minDiameter` unless a
 * wide group needs more (side padding NUMERAL_BADGE_PAD, ink box corners
 * NUMERAL_BADGE_INSET inside the edge), and the group is centred on its ink.
 */
export function numeralBadgeGeometry(label: number | string, digitHeight: number, minDiameter: number): NumeralBadgeGeometry {
  const group = groupExtent(label);
  const k = digitHeight / group.height;
  const inkW = k * group.width;
  const corner = Math.hypot(inkW / 2, k * group.reach);
  const diameter = Math.max(minDiameter, inkW + 2 * NUMERAL_BADGE_PAD, 2 * (corner + NUMERAL_BADGE_INSET));
  const options = {
    capFraction: digitHeight / diameter,
    safeRadius: (diameter / 2 - NUMERAL_BADGE_INSET) / diameter,
  };
  return { diameter, options, layout: numeralLayout(label, diameter, options) };
}

export interface NumeralPlateSpec {
  /** Cap height of the digits, in pixels. */
  digitHeight: number;
  /** Air kept beside and above/below the ink. */
  padX: number;
  padY: number;
  /** The plate never shrinks below this (a fixed-size count plate). */
  minWidth?: number;
  minHeight?: number;
}

export interface NumeralPlateGeometry {
  width: number;
  height: number;
  /** The label laid out in a `width` x `height` box, centred like a badge. */
  layout: NumeralLayout;
}

/**
 * A numeral on a rectangular plate (the Mark "+2" badge, the pile counts):
 * the digits keep `digitHeight` of cap height and the plate is the ink plus
 * its padding (or the minimum size), with the label centred on it. Scaling
 * every length in `spec` scales the result exactly, so a bake at twice the
 * size is the same layout.
 */
export function numeralPlateGeometry(label: number | string, spec: NumeralPlateSpec): NumeralPlateGeometry {
  const group = groupExtent(label);
  const k = spec.digitHeight / group.height;
  const width = Math.max(spec.minWidth ?? 0, k * group.width + 2 * spec.padX);
  const height = Math.max(spec.minHeight ?? 0, 2 * k * group.reach + 2 * spec.padY);
  return { width, height, layout: placeGroup(group, k, width / 2, height / 2) };
}

/** The Forge page's inline-SVG numeral: a 100-unit viewBox filling the
 * content box of its grey `.generic-pip` circle. */
export const FORGE_NUMERAL_BOX = 100;
export const FORGE_NUMERAL_OPTIONS: Readonly<Required<NumeralLayoutOptions>> = {
  capFraction: 0.42,
  safeRadius: 0.4,
};
