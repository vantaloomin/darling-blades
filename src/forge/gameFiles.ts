/**
 * Where the Forge page reaches the game's own files.
 *
 * The Forge is served one folder below the game (`/forge/`), and every game
 * file it draws (card art, the webfonts, the favicons) is deployed by the GAME
 * build at the site root. The Forge build copies none of them (`public/` holds
 * hundreds of megabytes of art). A relative `../` reaches them from both places
 * the page runs: production `https://bladedarlings.com/forge/`, and
 * `npm run forge`, whose dev server also serves the page at `/forge/` and
 * `public/` at `/`.
 */
export const GAME_ROOT = '../';

export function gameFileUrl(path: string): string {
  return `${GAME_ROOT}${path}`;
}
