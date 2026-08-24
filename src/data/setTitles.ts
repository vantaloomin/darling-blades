/**
 * Every set id in release order. This array is the single source: `SetId` is
 * derived from it, and any surface that lists sets should iterate it rather
 * than retyping the members. The Collection binder's set filter silently
 * omitted dark-tales and yokai-nights for two releases because it kept its own
 * hand-written copy of this list.
 */
export const SET_IDS = [
  'base',
  'ragnarok',
  'celtic-fae',
  'arthurian-court',
  'gothic-monsters',
  'dark-tales',
  'yokai-nights',
  'sands-of-the-duat',
] as const;

/** Set ids as they appear on CardDef.set ('base' when absent). Kept in the
 * data layer so meta/data consumers avoid presentation imports; the identical
 * CardSetId union in src/art/setIcons.ts is presentation-side. */
export type SetId = (typeof SET_IDS)[number];

/**
 * Player-facing set titles (user-directed 2026-07-20): expansions surface
 * their THEME title everywhere plain text names a set; internal ids and doc
 * prose keep the working names. One map so shop tiles, filters, odds copy,
 * and achievement text can never drift apart.
 */
export const SET_TITLES: Readonly<Record<SetId, string>> = Object.freeze({
  base: 'Base Set',
  ragnarok: 'Ragnarök',
  'celtic-fae': 'Silver Veil',
  'arthurian-court': 'Grail Oath',
  'gothic-monsters': 'Nocturne Manor',
  'dark-tales': 'Dark Tales',
  'yokai-nights': 'Yokai Nights',
  'sands-of-the-duat': 'Sands of the Duat',
});

/** One short identity line per shop tile. Keep these concrete and editable. */
export const SET_BLURBS: Readonly<Record<SetId, string>> = Object.freeze({
  base: 'A broad foundation for every deck',
  ragnarok: 'Storms, giants, and last stands',
  'celtic-fae': 'Moonlit bargains beneath living thorns',
  'arthurian-court': 'Oaths, knights, and shining steel',
  'gothic-monsters': 'Velvet nights and hungry shadows',
  'dark-tales': 'Curses bloom under storybook moonlight',
  'yokai-nights': 'Neon spirits haunt the city grid',
  'sands-of-the-duat': 'Flood, judgment, and the second return',
});
