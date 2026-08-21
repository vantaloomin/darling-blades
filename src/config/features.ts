/** Release feature switches. Warchest and Darlings ship in 1.5.5. */
export const FEATURES = {
  reserveFormats: true,
  /** Sands of the Duat went live 2026-08-21 with the tuning pass; the gate stays as the pattern for the next unreleased set. */
  duatLive: true,
  /** Dark Tales companion wave; flips with its balance pass. */
  dtCompanionLive: false,
  /**
   * 1.6 classic retirement (2026-08-10). Warchest is now THE constructed
   * format: the Tower fields each avatar's `reserveDeck` + `landReserve`,
   * granted decks the player never edited auto-convert to their shipped
   * reserve build at migration, and the builder stops offering Constructed
   * to new decks.
   *
   * Classic decks are NOT deleted. They stay saved, visible and openable, and
   * `deckHealth` marks them invalid so the shipped flag-and-fix flow routes
   * the player to the builder to convert them. Retirement implies
   * `reserveFormats`; the two are never independently false/true.
   */
  classicRetired: true,
};
