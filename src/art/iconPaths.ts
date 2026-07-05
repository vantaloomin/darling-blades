/**
 * Hand-authored SVG path strings for mana/land/tap iconography — same
 * convention as TribeEmblems.ts: each icon is designed in a 100×100 box,
 * centered at 50,50, absolute commands only (M/L/C/A/Z).
 *
 * These are bold single-fill silhouettes tuned to read at 4px (land-stack
 * thumbs) and ~32px (inspect overlay). Interior details are punched out as
 * subpaths: consumers MUST fill with the 'evenodd' rule
 * (`ctx.fill(new Path2D(p), 'evenodd')`) — positive subpaths never overlap
 * each other, so evenodd turns every nested subpath into a hole.
 */
export type IconKey = 'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'T';

export const ICON_PATHS: Record<IconKey, string> = {
  // W — radiant sun: solid disc + 8 detached triangular rays (equal length).
  W:
    'M50 32 A18 18 0 1 1 50 68 A18 18 0 1 1 50 32 Z ' +
    'M50 5 L58 26 L42 26 Z M95 50 L74 58 L74 42 Z ' +
    'M50 95 L42 74 L58 74 Z M5 50 L26 42 L26 58 Z ' +
    'M82 18 L73 39 L61 27 Z M82 82 L61 73 L73 61 Z ' +
    'M18 82 L27 61 L39 73 Z M18 18 L39 27 L27 39 Z',
  // U — water droplet: pointed top, semicircular belly.
  U: 'M50 6 C50 6 79 46 79 64 A29 29 0 1 1 21 64 C21 46 50 6 50 6 Z',
  // B — skull: cranium + toothed jaw, eye sockets and nasal cavity punched out.
  B:
    'M50 8 C28 8 14 24 14 44 C14 58 22 68 32 72 L32 90 L40 90 L40 80 ' +
    'L46 80 L46 90 L54 90 L54 80 L60 80 L60 90 L68 90 L68 72 ' +
    'C78 68 86 58 86 44 C86 24 72 8 50 8 Z ' +
    'M27 44 A9 10 0 1 0 45 44 A9 10 0 1 0 27 44 Z ' +
    'M55 44 A9 10 0 1 0 73 44 A9 10 0 1 0 55 44 Z ' +
    'M50 52 L44 64 L56 64 Z',
  // R — flame: leaning tongue with a side lick and a punched inner tongue.
  R:
    'M55 4 C50 16 38 24 32 36 C24 50 26 68 38 80 C46 88 58 92 68 88 ' +
    'C80 83 86 70 84 56 C82 44 74 36 70 26 C66 34 66 40 68 46 ' +
    'C62 42 58 34 58 24 C57 16 56 10 55 4 Z ' +
    'M52 46 C58 54 62 60 60 68 C58 76 51 79 46 76 C40 72 40 64 44 57 C47 52 50 49 52 46 Z',
  // G — tree: round canopy on a flared trunk.
  G:
    'M50 6 C69 6 83 20 83 37 C83 52 72 62 59 65 L59 82 L68 90 L32 90 ' +
    'L41 82 L41 65 C28 62 17 52 17 37 C17 20 31 6 50 6 Z',
  // C — colorless crystal: hexagonal ring (open center keeps overlaid
  // generic-cost numerals legible).
  C:
    'M50 6 L86 28 L86 72 L50 94 L14 72 L14 28 Z ' +
    'M50 20 L74 35 L74 65 L50 80 L26 65 L26 35 Z',
  // T — tap: thick arrow sweeping clockwise over the top, head pointing down.
  T: 'M20 61 A32 32 0 1 1 82 50 L88 50 L75 72 L62 50 L68 50 A18 18 0 1 0 33 56 Z',
};
