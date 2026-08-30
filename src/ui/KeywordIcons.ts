import type Phaser from 'phaser';
import type { CardType, Keyword } from '../engine/types';
import type { MechanicIconId } from '../data/glossary';
import { theme } from './theme';

export const KEYWORD_ICON_SIZE = 44;

/** Texture keys are total over the engine keyword union: future keywords must add an icon. */
export const KEYWORD_ICON_KEY: Record<Keyword, string> = {
  skyborne: 'keyword-skyborne',
  wardingGaze: 'keyword-wardingGaze',
  firstBlade: 'keyword-firstBlade',
  twinBlades: 'keyword-twinBlades',
  warcry: 'keyword-warcry',
  overrun: 'keyword-overrun',
  sentinel: 'keyword-sentinel',
  bulwark: 'keyword-bulwark',
  deathblade: 'keyword-deathblade',
  bloodoath: 'keyword-bloodoath',
  untouchable: 'keyword-untouchable',
  dreaded: 'keyword-dreaded',
  rage: 'keyword-rage',
};

/**
 * Named mechanics and zone terms share the keyword chip bake. Total over
 * `MechanicIconId`, so a new mechanic fails the typecheck until it has a glyph
 * (before 2026-08-24 only Champion Awakening had one, and the Glossary's
 * Mechanics tab rendered thirteen empty icon gutters beside it).
 */
export const MECHANIC_ICON_KEY: Record<MechanicIconId, string> = {
  sever: 'mechanic-sever',
  foresee: 'mechanic-foresee',
  mark: 'mechanic-mark',
  propagate: 'mechanic-propagate',
  quest: 'mechanic-quest',
  championAwakening: 'mechanic-championAwakening',
  empower: 'mechanic-empower',
  skim: 'mechanic-skim',
  retell: 'mechanic-retell',
  hauntlink: 'mechanic-hauntlink',
  rite: 'mechanic-rite',
  nineLives: 'mechanic-nineLives',
  preserve: 'mechanic-preserve',
  warchest: 'mechanic-warchest',
  darlings: 'mechanic-darlings',
};

/** Card-type glyphs, total over the engine's `CardType` union. */
export const CARD_TYPE_ICON_KEY: Record<CardType, string> = {
  creature: 'cardtype-creature',
  charm: 'cardtype-charm',
  ritual: 'cardtype-ritual',
  enchantment: 'cardtype-enchantment',
  artifact: 'cardtype-artifact',
  land: 'cardtype-land',
};

/** Deliberately bold silhouettes; these are read at a 16px display size. */
const KEYWORD_ICON_PATH: Record<Keyword, string> = {
  skyborne: 'M4 24 L15 15 L22 22 L29 15 L40 24 L35 32 L27 28 L22 35 L17 28 L9 32 Z',
  wardingGaze: 'M3 22 Q12 9 22 9 Q32 9 41 22 Q32 35 22 35 Q12 35 3 22 Z M17 22 A5 5 0 1 0 27 22 A5 5 0 1 0 17 22',
  firstBlade: 'M22 4 L28 19 L25 37 L19 37 L16 19 Z M18 20 L26 20 L22 25 Z',
  twinBlades: 'M8 6 L14 20 L31 37 L26 42 L10 25 L4 11 Z M36 6 L40 11 L34 25 L18 42 L13 37 L30 20 Z',
  warcry: 'M5 18 L16 18 L22 10 L22 34 L16 26 L5 26 Z M27 15 Q37 22 27 29 L30 25 Q35 22 30 19 Z',
  overrun: 'M4 16 L13 16 L18 11 L22 17 L30 17 L36 11 L40 15 L34 22 L40 29 L36 33 L30 27 L22 27 L18 33 L13 28 L4 28 L10 22 Z',
  sentinel: 'M11 8 L33 8 L39 17 L36 37 L22 42 L8 37 L5 17 Z M10 23 Q16 17 22 17 Q28 17 34 23 Q28 29 22 29 Q16 29 10 23 Z M19 23 A3 3 0 1 0 25 23 A3 3 0 1 0 19 23',
  bulwark: 'M22 3 L38 10 L35 30 Q31 38 22 42 Q13 38 9 30 L6 10 Z M22 9 L22 35',
  deathblade: 'M22 3 L28 17 L25 30 L22 38 L19 30 L16 17 Z M15 29 Q22 24 29 29 L29 37 L25 41 L19 41 L15 37 Z M18 32 A2 2 0 1 0 22 32 A2 2 0 1 0 18 32 M22 32 A2 2 0 1 0 26 32 A2 2 0 1 0 22 32',
  bloodoath: 'M22 3 C22 3 10 19 10 28 A12 12 0 0 0 34 28 C34 19 22 3 22 3 Z',
  untouchable: 'M5 7 L39 37 M39 7 L5 37 M8 10 Q22 1 36 10 L39 22 Q34 37 22 42 Q10 37 5 22 Z',
  dreaded: 'M8 5 L15 8 L15 39 L8 34 Z M19 5 L26 8 L26 39 L19 34 Z M30 5 L37 8 L37 39 L30 34 Z',
  // A clenched fist: four knuckles and a thumb. Deliberately not another blade,
  // eye, shield or arrow — every one of those motifs is already spoken for
  // above, and this has to be told apart from all twelve at a 16px display.
  rage: 'M10 22 Q13 14 16 22 Q20 14 24 22 Q28 14 32 22 L35 22 L35 33 Q35 39 29 39 L16 39 Q10 39 10 33 Z M10 26 L4 29 L7 34 L10 32 Z',
};

/**
 * Mechanic and zone glyphs. Each one had to stay legible at 16px AND stay
 * distinct from all twelve keyword silhouettes above, which is why Foresee is a
 * lifted deck rather than a fourth eye (Warding Gaze, Sentinel and Champion
 * Awakening already own that motif) and Rite is a chalice rather than a blade
 * or a droplet (First Blade, Deathblade and Blood Oath own those).
 */
const MECHANIC_ICON_PATH: Record<MechanicIconId, string> = {
  // A card parted along a clean diagonal: cut out, never coming back.
  sever: 'M6 6 L14 6 L26 38 L6 38 Z M20 6 L38 6 L38 38 L32 38 Z',
  // The top card of a deck lifted clear so you can read it.
  foresee: 'M9 7 L33 3 L36 15 L12 19 Z M8 23 L36 23 L36 27 L8 27 Z M8 30 L36 30 L36 34 L8 34 Z',
  // The +1/+1 itself.
  mark: 'M18 7 L26 7 L26 18 L37 18 L37 26 L26 26 L26 37 L18 37 L18 26 L7 26 L7 18 L18 18 Z',
  // A mark, and then ANOTHER one beside it. Two offset pluses rather than one
  // big one, because the single centered plus one row above is Mark itself and
  // the pair has to read as "it doubled" at 16px. They meet corner to corner
  // and never overlap, so the evenodd fill cannot punch a hole between them.
  propagate:
    'M10 4 L18 4 L18 10 L24 10 L24 18 L18 18 L18 24 L10 24 L10 18 L4 18 L4 10 L10 10 Z ' +
    'M26 20 L34 20 L34 26 L40 26 L40 34 L34 34 L34 40 L26 40 L26 34 L20 34 L20 26 L26 26 Z',
  // Chapters climbing toward the flag they plant at the end.
  quest: 'M5 35 L14 35 L14 40 L5 40 Z M16 27 L25 27 L25 40 L16 40 Z M27 19 L36 19 L36 40 L27 40 Z M29 4 L32 4 L32 19 L29 19 Z M32 5 L41 9 L32 13 Z',
  // A one-way upgrade, climbing. Was an open eye until 2026-08-24, which read
  // as a near-duplicate of Warding Gaze one row above it (user report).
  championAwakening:
    'M22 4 L39 21 L31 21 L22 12 L13 21 L5 21 Z ' +
    'M22 21 L39 38 L31 38 L22 29 L13 38 L5 38 Z',
  // Extra power poured into the cast.
  empower: 'M25 3 L9 25 L19 25 L17 41 L35 18 L24 18 Z',
  // One card down, one card up: the trade Skim makes.
  skim: 'M9 4 L15 4 L15 22 L20 22 L12 38 L4 22 L9 22 Z M29 40 L35 40 L35 22 L40 22 L32 6 L24 22 L29 22 Z',
  // The story comes back around once. The head caps the arm's end face in the
  // quadrant the 270-degree sector leaves open, so it points along the travel
  // rather than floating across the band.
  retell: 'M22 7 A15 15 0 1 0 37 22 L31 22 A9 9 0 1 1 22 13 Z M28 22 L40 22 L34 10 Z',
  // Two rings through each other: the permanent bound to its host.
  hauntlink:
    'M3 22 A11 11 0 1 0 25 22 A11 11 0 1 0 3 22 Z M8 22 A6 6 0 1 0 20 22 A6 6 0 1 0 8 22 Z ' +
    'M19 22 A11 11 0 1 0 41 22 A11 11 0 1 0 19 22 Z M24 22 A6 6 0 1 0 36 22 A6 6 0 1 0 24 22 Z',
  // A chalice and the offerings going into it.
  rite: 'M15 6 A3 3 0 1 0 21 6 A3 3 0 1 0 15 6 Z M23 6 A3 3 0 1 0 29 6 A3 3 0 1 0 23 6 Z M11 13 L33 13 L29 26 L15 26 Z M20 26 L24 26 L24 33 L20 33 Z M13 33 L31 33 L31 38 L13 38 Z',
  // The cat, because the mechanic is named for it. A flatter skull, corner ears
  // and slit pupils: the first draft's round head and tall tufts read as an owl.
  nineLives:
    'M8 23 Q8 39 22 39 Q36 39 36 23 Q36 14 22 14 Q8 14 8 23 Z ' +
    'M10 18 L7 3 L21 12 Z M34 18 L37 3 L23 12 Z ' +
    'M16 21 A2 4 0 1 0 20 21 A2 4 0 1 0 16 21 Z M24 21 A2 4 0 1 0 28 21 A2 4 0 1 0 24 21 Z ' +
    'M19 28 L25 28 L22 32 Z',
  // A sealed jar: kept whole, opened once.
  preserve: 'M15 5 Q22 1 29 5 L29 9 L15 9 Z M17 11 L27 11 L27 14 L17 14 Z M12 16 Q10 28 13 34 Q17 39 22 39 Q27 39 31 34 Q34 28 32 16 Z M13 23 L31 23 L31 27 L13 27 Z',
  // The lands you have not deployed yet, still in the chest.
  warchest: 'M5 15 Q5 11 9 11 L35 11 Q39 11 39 15 L39 19 L5 19 Z M5 22 L39 22 L39 34 Q39 38 35 38 L9 38 Q5 38 5 34 Z M18 15 L26 15 L26 26 L18 26 Z',
  // Her crown: she waits in her own zone and answers when called.
  darlings: 'M5 33 L39 33 L39 40 L5 40 Z M5 31 L8 11 L16 21 L22 6 L28 21 L36 11 L39 31 Z',
};

/** Card-type glyphs, drawn to the same chip conventions. */
const CARD_TYPE_ICON_PATH: Record<CardType, string> = {
  // A fighter's head and shoulders.
  creature: 'M22 5 A7 7 0 1 0 22 19 A7 7 0 1 0 22 5 Z M8 40 Q8 22 22 22 Q36 22 36 40 Z',
  // A snap of instant-speed magic.
  charm: 'M22 3 L26 18 L41 22 L26 26 L22 41 L18 26 L3 22 L18 18 Z',
  // A written working, cast on your own time.
  ritual: 'M10 5 L34 5 Q38 5 38 9 L38 35 Q38 39 34 39 L10 39 Q6 39 6 35 L6 9 Q6 5 10 5 Z M13 14 L31 14 L31 17 L13 17 Z M13 21 L31 21 L31 24 L13 24 Z M13 28 L26 28 L26 31 L13 31 Z',
  // A ward set down on the battlefield and left there.
  enchantment: 'M22 2 L40 22 L22 42 L4 22 Z M22 12 L32 22 L22 32 L12 22 Z',
  // A key: a made thing, and nothing else in the set is shaped like it. The
  // first draft was a cut gem, which read as a shield one row from Bulwark.
  artifact: 'M15 3 A11 11 0 1 0 15 25 A11 11 0 1 0 15 3 Z M15 10 A4 4 0 1 0 15 18 A4 4 0 1 0 15 10 Z M12 25 L18 25 L18 41 L12 41 Z M18 29 L27 29 L27 33 L18 33 Z M18 36 L24 36 L24 40 L18 40 Z',
  // Ground and the sun over it.
  land: 'M12 6 A5 5 0 1 0 12 16 A5 5 0 1 0 12 6 Z M3 38 L16 17 L24 28 L30 19 L41 38 Z',
};

/**
 * One dark rounded chip with the glyph knocked out in gold. Shared by all three
 * icon families so a new family cannot drift from the chip look.
 */
function bakeChip(scene: Phaser.Scene, key: string, path: string): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, KEYWORD_ICON_SIZE, KEYWORD_ICON_SIZE)!;
  const ctx = tex.getContext();
  const m = 2;
  const r = 8;
  const s = KEYWORD_ICON_SIZE;
  ctx.beginPath();
  ctx.moveTo(m + r, m);
  ctx.lineTo(s - m - r, m);
  ctx.quadraticCurveTo(s - m, m, s - m, m + r);
  ctx.lineTo(s - m, s - m - r);
  ctx.quadraticCurveTo(s - m, s - m, s - m - r, s - m);
  ctx.lineTo(m + r, s - m);
  ctx.quadraticCurveTo(m, s - m, m, s - m - r);
  ctx.lineTo(m, m + r);
  ctx.quadraticCurveTo(m, m, m + r, m);
  ctx.fillStyle = theme.colors.rowFill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.colors.panelStroke;
  ctx.stroke();
  ctx.fillStyle = theme.colors.gold;
  ctx.fill(new Path2D(path), 'evenodd');
  tex.refresh();
}

/** Bake one small dark trait chip per keyword, mechanic, and card type. Safe to call on every scene create/restart. */
export function bakeKeywordIcons(scene: Phaser.Scene): void {
  for (const keyword of Object.keys(KEYWORD_ICON_KEY) as Keyword[]) {
    bakeChip(scene, KEYWORD_ICON_KEY[keyword], KEYWORD_ICON_PATH[keyword]);
  }
  for (const mechanic of Object.keys(MECHANIC_ICON_KEY) as MechanicIconId[]) {
    bakeChip(scene, MECHANIC_ICON_KEY[mechanic], MECHANIC_ICON_PATH[mechanic]);
  }
  for (const type of Object.keys(CARD_TYPE_ICON_KEY) as CardType[]) {
    bakeChip(scene, CARD_TYPE_ICON_KEY[type], CARD_TYPE_ICON_PATH[type]);
  }
}
