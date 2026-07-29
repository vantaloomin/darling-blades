/** Set ids as they appear on CardDef.set ('base' when absent). Kept in the
 * data layer so meta/data consumers avoid presentation imports; the identical
 * CardSetId union in src/art/setIcons.ts is presentation-side. */
export type SetId = 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court' | 'gothic-monsters' | 'dark-tales' | 'yokai-nights';

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
});
