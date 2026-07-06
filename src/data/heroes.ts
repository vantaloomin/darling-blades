/**
 * Premium hero portraits — bespoke, non-card illustrations that front the
 * in-duel commander portrait (src/ui/CommanderPortrait.ts). Unlike `heroCardId`
 * (any collected card), a premium hero is UNLOCKED ONLY by owning its theme
 * deck, so it's an exclusive cosmetic reward. The art is a standalone PNG under
 * public/assets/art/heroes/, preloaded by key in PreloadScene; a missing file
 * degrades gracefully (the portrait falls back to the card-based hero/face).
 */
export interface PremiumHero {
  /** Save-stored selection id (SaveData.heroPortraitId). */
  id: string;
  name: string;
  /** Preloaded texture key (matches the PNG basename). */
  textureKey: string;
  /** Owning this deck (by id) unlocks the hero for selection. */
  unlockDeckId: string;
  /** Short line for the selection UI. */
  blurb: string;
}

export const PREMIUM_HEROES: readonly PremiumHero[] = [
  {
    id: 'hero-valhalla',
    name: 'Sigrún, Chooser of the Slain',
    textureKey: 'hero-valhalla',
    unlockDeckId: 'theme-ragnarok',
    blurb: "Exclusive hero — Valhalla's Muster",
  },
];

export function heroById(id: string): PremiumHero | undefined {
  return PREMIUM_HEROES.find((h) => h.id === id);
}

/** Premium heroes unlocked by any deck in `ownedDeckIds`. */
export function heroesForDecks(ownedDeckIds: readonly string[]): PremiumHero[] {
  const owned = new Set(ownedDeckIds);
  return PREMIUM_HEROES.filter((h) => owned.has(h.unlockDeckId));
}
