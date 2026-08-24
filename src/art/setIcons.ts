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
export type CardSetId = 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court' | 'gothic-monsters' | 'dark-tales' | 'yokai-nights' | 'sands-of-the-duat';

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
  // Bat silhouette: broad angular wings fold into a pointed body and ears.
  'gothic-monsters':
    'M50 86 C42 78 34 70 28 61 L12 70 L20 52 L8 48 L31 39 L26 22 L43 33 L50 14 L57 33 L74 22 L69 39 L92 48 L80 52 L88 70 L72 61 C66 70 58 78 50 86 Z',
  // Open storybook with two broad pages and a central fold.
  'dark-tales':
    'M8 18 C23 12 38 14 50 23 L50 88 C38 78 23 77 8 84 Z ' +
    'M50 23 C62 14 77 12 92 18 L92 84 C77 77 62 78 50 88 Z',
  // Split kitsune mask with two punched eyes, crossed by one hooked signal cable.
  'yokai-nights':
    'M8 26 C20 14 37 12 50 22 L50 78 C37 88 20 86 8 74 Z ' +
    'M50 22 C63 12 80 14 92 26 L92 74 C80 86 63 88 50 78 Z ' +
    'M22 50 C22 45 24 40 27 36 C28 41 31 43 33 46 C34 51 31 56 27 58 C24 57 22 54 22 50 Z ' +
    'M68 38 L82 38 L82 52 L68 52 Z ' +
    'M48 6 L54 6 L54 16 L63 16 L63 22 L54 22 L54 58 C54 70 66 76 78 70 L88 64 L92 70 L80 78 C62 88 46 76 46 58 L46 22 L37 22 L37 16 L46 16 L46 6 Z',
  // Sealed pylon door: a tapered slab with a punched seal ring whose solid
  // core reads as the sun disc (evenodd: slab -> hole -> disc), and a punched
  // threshold band near the base echoing the blank banded registers.
  'sands-of-the-duat':
    'M28 4 L72 4 L82 96 L18 96 Z ' +
    'M33 42 A17 17 0 1 1 67 42 A17 17 0 1 1 33 42 Z ' +
    'M43 42 A7 7 0 1 1 57 42 A7 7 0 1 1 43 42 Z ' +
    'M30 76 L70 76 L70 83 L30 83 Z',
};
