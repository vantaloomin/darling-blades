/**
 * Hand-authored SVG path strings for the per-set card symbols (MTG-style
 * expansion marks: shape identifies the SET, fill tint identifies the RARITY).
 * Same convention as iconPaths.ts / TribeEmblems.ts: each icon is designed in
 * a 100×100 box, centered at 50,50, absolute commands only, and consumers
 * MUST fill with the 'evenodd' rule — positive subpaths never overlap each
 * other, so every nested subpath is a punched hole.
 *
 * Motifs: base = a heart pierced by a downward blade ("Darling Blades");
 * ragnarok = a Mjölnir pendant; celtic-fae = a crescent moon with a
 * four-point star ("The Silver Veil"); arthurian-court = a five-point royal
 * crown. Tuned to read at ~21px on the card face and ~40px in the glossary.
 */
export type CardSetId = 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court';

export const SET_ICON_PATHS: Record<CardSetId, string> = {
  // Heart pierced by a blade: grip + crossguard above the cleft, a tapered
  // blade stub entering it, and the tip emerging below the heart's point.
  // The heart body and the blade pieces never overlap (evenodd-safe).
  base:
    'M50 88 C27 68 10 52 10 37 C10 25 19 17 30 17 C39 17 46 22 50 30 ' +
    'C54 22 61 17 70 17 C81 17 90 25 90 37 C90 52 73 68 50 88 Z ' +
    'M45 0 L55 0 L55 8 L45 8 Z ' +
    'M32 8 L68 8 L68 15 L32 15 Z ' +
    'M47 15 L53 15 L50 27 Z ' +
    'M44 90 L56 90 L50 100 Z',
  // Mjölnir pendant: handle up, flared head down, punched ring in the head.
  ragnarok:
    'M44 4 L56 4 L56 50 L84 50 L90 90 L10 90 L16 50 L44 50 Z ' +
    'M43 70 A7 7 0 1 1 57 70 A7 7 0 1 1 43 70 Z',
  // Crescent moon (horns right) with a four-point star in the hollow.
  'celtic-fae':
    'M46 8 A42 42 0 1 0 46 92 A44.3 44.3 0 0 1 46 8 Z ' +
    'M66 32 L70 46 L84 50 L70 54 L66 68 L62 54 L48 50 L62 46 Z',
  // Five-point royal crown: deep valleys keep the crown silhouette legible at
  // card size, while three punched jewels separate its broad band from the
  // solid head of the Ragnarök hammer.
  'arthurian-court':
    'M8 30 L26 48 L34 19 L46 44 L50 8 L54 44 L66 19 L74 48 L92 30 L82 84 L18 84 Z ' +
    'M26 64 L32 58 L38 64 L32 70 Z ' +
    'M44 64 L50 58 L56 64 L50 70 Z ' +
    'M62 64 L68 58 L74 64 L68 70 Z',
};
