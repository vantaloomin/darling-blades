/** Set ids as they appear on CardDef.set ('base' when absent). Kept in the
 * data layer so meta/data consumers avoid presentation imports; the identical
 * CardSetId union in src/art/setIcons.ts is presentation-side. */
export type SetId = 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court' | 'gothic-monsters';

/**
 * Player-facing set titles (user-directed 2026-07-20): expansions surface
 * their THEME title everywhere plain text names a set; internal ids and doc
 * prose keep the working names. One map so shop tiles, filters, odds copy,
 * and achievement text can never drift apart.
 */
export const SET_TITLES: Readonly<Record<SetId, string>> = Object.freeze({
  base: 'Core Set',
  ragnarok: 'Ragnarök',
  'celtic-fae': 'Silver Veil',
  'arthurian-court': 'Grail Oath',
  'gothic-monsters': 'Nocturne Manor',
});
