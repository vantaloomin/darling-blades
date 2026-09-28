/** Release feature switches. Warchest and Darlings ship in 1.5.5. */
export const FEATURES = {
  reserveFormats: true,
  /** Sands of the Duat went live 2026-08-21 with the tuning pass; the gate stays as the pattern for the next unreleased set. */
  duatLive: true,
  /** Dark Tales companion wave; flips with its balance pass. */
  dtCompanionLive: true,
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
  // --- 1.9 lane C: the Accessibility controls' ship gates (C4) ---
  /**
   * One switch per Settings control (docs/plan-accessibility-i18n.md, "The
   * ship gate"). While a switch is false its control is hidden in production
   * builds (dev builds always show it) and a saved value is not applied, so
   * no player lands in a half-built state they have no control to undo. Each
   * flips when every player-facing scene clears the rendered probe in the
   * cells its control opens; high contrast may ship before 130% text.
   */
  textSizeLive: false,
  highContrastLive: false,
  // --- end lane C ship gates ---
  /**
   * 1.9 lane D (docs/plan-art-streaming.md): card art loads on demand through
   * the art store and is evicted under a memory budget. Off is the 1.8
   * whole-manifest stream, unchanged. It stays off until S5a moves Collection,
   * the Deck Builder and the Showcase off their whole-manifest gates: before
   * that, switching it on pins all 1,537 files there (about 3 GB on desktop).
   * `?artStream=on` / `?artStream=off` override it for one page load.
   */
  artStream: false,
};

/**
 * Whether this page load streams card art through the art store. The
 * `?artStream=on|off` URL switch (developer and probe use; no player copy)
 * wins over the flag; anything else leaves the flag's answer.
 */
export function artStreamEnabled(search: string, flag: boolean = FEATURES.artStream): boolean {
  const value = new URLSearchParams(search).get('artStream');
  if (value === 'on') return true;
  if (value === 'off') return false;
  return flag;
}
