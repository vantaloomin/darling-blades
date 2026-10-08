/**
 * Colour-vision helpers for the cue-distinctness gate (1.9 lane C, C5): the
 * CIEDE2000 colour difference and a simulation of the three dichromacies.
 *
 * A test helper, not a test file: `tests/ui/boardCuePresentation.test.ts`
 * imports it and anchors both halves against published reference data.
 *
 * Sources:
 * - CIEDE2000: G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference
 *   Formula: Implementation Notes, Supplementary Test Data, and Mathematical
 *   Observations", Color Research & Application 30(1), 2005. The formula below
 *   follows their implementation notes (kL = kC = kH = 1), including the hue
 *   mean and hue difference rules at the 180 degree wrap.
 * - sRGB to CIE Lab: IEC 61966-2-1 sRGB transfer function, the sRGB primaries'
 *   XYZ matrix, D65 reference white (0.95047, 1, 1.08883).
 * - Dichromacy: G. M. Machado, M. M. Oliveira, L. A. F. Fernandes, "A
 *   Physiologically-based Model for Simulation of Color Vision Deficiency",
 *   IEEE TVCG 15(6), 2009. The severity 1.0 matrices (protanopia,
 *   deuteranopia, tritanopia) from the paper's table, applied to linear RGB,
 *   as the plan's colour inventory measured them (plan-accessibility-i18n.md,
 *   "States that rely on colour").
 */

export type Rgb = readonly [r: number, g: number, b: number];
export type Lab = readonly [L: number, a: number, b: number];

/** Normal vision plus the three dichromacies the gate simulates. */
export const VISION_KINDS = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'] as const;
export type VisionKind = (typeof VISION_KINDS)[number];

/** `#rrggbb` or a Phaser-style `0xrrggbb` number to 0-255 channels. */
export function toRgb(color: string | number): Rgb {
  const n = typeof color === 'number' ? color : Number.parseInt(color.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(linear: number): number {
  const c = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, c * 255));
}

/** Machado, Oliveira & Fernandes 2009, severity 1.0, over linear RGB. */
const MACHADO_2009: Readonly<Record<Exclude<VisionKind, 'normal'>, readonly (readonly number[])[]>> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** A colour as a viewer with `kind` sees it (0-255 channels, clamped). */
export function simulateVision(rgb: Rgb, kind: VisionKind): Rgb {
  if (kind === 'normal') return rgb;
  const linear = rgb.map(toLinear);
  const m = MACHADO_2009[kind];
  return m.map((row) => fromLinear(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2])) as unknown as Rgb;
}

/** sRGB (0-255) to CIE L*a*b* under D65. */
export function rgbToLab(rgb: Rgb): Lab {
  const [r, g, b] = rgb.map(toLinear);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIEDE2000 between two Lab colours (Sharma, Wu & Dalal 2005; kL = kC = kH = 1). */
export function deltaE2000Lab(first: Lab, second: Lab): number {
  const [L1, a1, b1] = first;
  const [L2, a2, b2] = second;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (a: number, b: number): number => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h >= 0 ? h : h + 360;
  };
  const h1p = hue(a1p, b1);
  const h2p = hue(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbarp += h1p + h2p < 360 ? 360 : -360;
    hbarp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * rad) +
    0.24 * Math.cos(2 * hbarp * rad) +
    0.32 * Math.cos((3 * hbarp + 6) * rad) -
    0.2 * Math.cos((4 * hbarp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

/** CIEDE2000 between two sRGB colours as a viewer with `kind` sees them. */
export function deltaE2000(first: string | number, second: string | number, kind: VisionKind = 'normal'): number {
  return deltaE2000Lab(rgbToLab(simulateVision(toRgb(first), kind)), rgbToLab(simulateVision(toRgb(second), kind)));
}

/** The smallest CIEDE2000 across normal vision and the three simulations. */
export function worstCaseDeltaE(first: string | number, second: string | number): { kind: VisionKind; deltaE: number } {
  let worst: { kind: VisionKind; deltaE: number } = { kind: 'normal', deltaE: Infinity };
  for (const kind of VISION_KINDS) {
    const deltaE = deltaE2000(first, second, kind);
    if (deltaE < worst.deltaE) worst = { kind, deltaE };
  }
  return worst;
}
