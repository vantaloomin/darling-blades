/**
 * Hand-authored SVG path strings — the only "art" drawn by hand in the whole
 * placeholder pipeline. Each is designed in a 100×100 box, centered at 50,50.
 * Rendered via Path2D onto the placeholder canvas at low alpha.
 */
export const TRIBE_EMBLEMS: Record<string, string> = {
  // Wei — angular fortress seal: a diamond keep with flanking walls.
  Wei: 'M50 8 L78 36 L64 36 L64 60 L78 60 L78 74 L22 74 L22 60 L36 60 L36 36 L22 36 Z M42 44 L58 44 L58 66 L42 66 Z',
  // Wu — twin flame / river curve.
  Wu: 'M50 10 C70 26 62 38 54 46 C72 44 80 58 72 74 C68 84 54 90 44 86 C58 82 64 72 58 62 C54 68 44 70 38 64 C28 54 34 40 44 32 C50 26 52 18 50 10 Z',
  // Shu — five-petal peach blossom.
  Shu: 'M50 14 C58 26 58 34 50 40 C42 34 42 26 50 14 Z M84 40 C72 40 64 44 62 52 C70 58 78 56 84 40 Z M70 84 C62 74 54 70 48 74 C48 84 56 90 70 84 Z M30 84 C38 74 46 70 52 74 C52 84 44 90 30 84 Z M16 40 C28 40 36 44 38 52 C30 58 22 56 16 40 Z M50 46 A8 8 0 1 0 50 62 A8 8 0 1 0 50 46 Z',
  // Jin — rising claw crescent (the usurping talon).
  Jin: 'M28 80 C18 60 22 34 42 20 C36 36 38 48 46 56 C44 42 48 30 60 22 C56 36 60 46 68 52 C68 40 74 32 84 28 C80 44 78 60 66 72 C54 84 38 86 28 80 Z',
  // Olympian — laurel wreath (two arcs of leaves).
  Olympian:
    'M50 88 C28 82 14 62 18 38 L26 42 C22 60 32 76 50 82 Z M50 88 C72 82 86 62 82 38 L74 42 C78 60 68 76 50 82 Z M24 34 L34 30 L32 42 Z M32 22 L42 20 L38 32 Z M44 14 L54 14 L48 24 Z M76 34 L66 30 L68 42 Z M68 22 L58 20 L62 32 Z',
  // Beastkin — paw print under a crescent moon.
  Beastkin:
    'M30 22 A26 26 0 1 0 74 42 A20 20 0 1 1 30 22 Z M38 52 A7 8 0 1 0 38 68 A7 8 0 1 0 38 52 Z M62 52 A7 8 0 1 0 62 68 A7 8 0 1 0 62 52 Z M50 46 A7 8 0 1 0 50 62 A7 8 0 1 0 50 46 Z M50 66 C62 66 68 74 66 84 C58 80 42 80 34 84 C32 74 38 66 50 66 Z',
  // Spell — unfurled scroll sigil.
  Spell:
    'M30 20 C24 20 20 24 20 30 C20 36 24 40 30 40 L30 34 C27 34 26 32 26 30 C26 28 27 26 30 26 L70 26 L70 20 Z M30 26 L70 26 C76 26 80 30 80 36 L80 74 C80 78 77 82 72 82 L36 82 C30 82 26 78 26 72 L26 34 Z M36 40 L68 40 L68 46 L36 46 Z M36 54 L68 54 L68 60 L36 60 Z M36 68 L58 68 L58 74 L36 74 Z',
  // Neutral/artifact — cog sigil.
  Neutral:
    'M50 30 L56 18 L64 22 L62 34 L70 40 L82 36 L86 44 L76 52 L76 60 L86 66 L82 76 L70 72 L62 78 L64 90 L56 94 L50 82 L44 94 L36 90 L38 78 L30 72 L18 76 L14 66 L24 60 L24 52 L14 44 L18 36 L30 40 L38 34 L36 22 L44 18 Z M50 46 A10 10 0 1 0 50 66 A10 10 0 1 0 50 46 Z',
};

/** Pick the emblem key for a card's subtypes / types. */
export function emblemFor(subtypes: readonly string[], types: readonly string[]): string {
  for (const t of ['Wei', 'Wu', 'Shu', 'Jin', 'Olympian', 'Beastkin']) {
    if (subtypes.includes(t)) return t;
  }
  if (types.includes('instant') || types.includes('sorcery') || types.includes('enchantment'))
    return 'Spell';
  return 'Neutral';
}
