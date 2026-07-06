/**
 * Local / dev-build gate for dev-only surfaces (currently the Card Showcase
 * variant-QA scene). `IS_DEV` is true when the game runs from the local Vite
 * dev server (`npm run dev` / `tauri dev`) and false in the deployed GitHub
 * Pages build and the packaged Tauri installer — so QA-only screens never ship
 * to players.
 *
 * The localStorage escape hatch (`darlingblades.devtools = '1'`) re-enables the
 * dev surfaces in any *local* packaged build without a rebuild — the same
 * "cheats/debug toggle" convenience. Because it is a runtime value, the gated
 * scene stays in the bundle (that's what makes the toggle work); a normal player
 * on the public build has neither the flag nor `import.meta.env.DEV`, so the
 * surface is simply never registered or listed.
 *
 * Read once at module load — the flag is not expected to change mid-session.
 */
function readDevtoolsFlag(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('darlingblades.devtools') === '1';
  } catch {
    return false; // storage blocked (private mode / headless) — treat as off
  }
}

export const IS_DEV: boolean = import.meta.env.DEV || readDevtoolsFlag();
