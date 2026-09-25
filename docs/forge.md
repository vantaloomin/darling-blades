<!-- source-of-truth: forge/index.html, src/forge, src/power/scoreCore.ts, vite.forge.config.ts, scripts/build-forge.ts, tests/forge, tests/power · last-verified: 2026-09-25 -->

# The Forge

The Forge is the card designer: build a card in the left rail, see it drawn by
the game's own `CardView` in the middle, and read on the right how its cost
measures up (PowerScore, the v3 Budget, their Delta, the itemized ledger, and
one-click costing hints). It is the old local Card Builder workbench, moved into
the repo and deployed with the game.

## Where it lives

- **URL:** `https://bladedarlings.com/forge/`. Deployed by the normal
  production build and the existing Pages workflow, beside the game.
- **Unlinked and noindexed.** Nothing in the game links to it, and the page
  carries `<meta name="robots" content="noindex, nofollow">`. It is not secret
  (the repo is public), just not advertised, which is also why `robots.txt`
  does not name it: `robots.txt` is public and would advertise the path.
- **Web only.** The desktop app does not carry it (see Build).

## Commands

| Command | What it does |
| --- | --- |
| `npm run forge` | Dev server on port 5176 (`strictPort`: it stops rather than move). `/` redirects to `/forge/`. The `forge` entry in `.claude/launch.json` runs it. |
| `npm run build` | Builds the game, then the Forge into `dist/forge/` (the last step, `npm run forge:build`). |
| `npm run forge:build` | The Forge build alone (`scripts/build-forge.ts`); it clears and refills `dist/forge/` only. |
| `npx vitest run tests/forge tests/power` | The Forge and scorer tests (also part of the full suite in CI). |

The page's QA probe runs with `?qa=1` (`/forge/?qa=1`): it waits for the first
card, waits for the card to be redrawn with its real art, checks that both
webfonts loaded, drives the mana slider, a pip, a keyword drag and a hint, and
publishes the result as `document.documentElement.dataset.qaStatus` (`pass` or
`fail`) and `window.__cardBuilderQa` (the details, including every console
error or warning seen). In a hidden browser pane Phaser's loop does not run on
its own: step it by hand (`window.__game.loop.step(t)` with a monotonic `t`, as
in the playbook's preview-probe recipe) until the status appears.

## Build

The Forge has its own Vite config, `vite.forge.config.ts`, so none of its
settings (the FX alias, the storage define) can reach the game bundle; the
game's own output does not change because the Forge exists (checked
byte-identical against the pre-Forge commit on 2026-09-25). The config's root
is the repository, so the page sits at `/forge/` in dev exactly as in
production. Output: `dist/forge/index.html` plus its JS and CSS under
`dist/forge/assets/`, three files and 1,870,153 bytes (measured 2026-09-25).
`public/` is not copied (it is hundreds of megabytes of art that the game
build already deploys).

Tauri runs `npm run build` as its `beforeBuildCommand` with
`TAURI_ENV_PLATFORM` set; `scripts/build-forge.ts` sees that
(`isDesktopBuild`, `scripts/cspForTarget.ts`) and skips the Forge, so the
installer's `dist/` holds the game alone.

## Reaching the game's files

Every game file the Forge draws (card art, the two webfonts, the favicons) is
deployed by the game build at the site root, and the Forge reaches it through a
relative `../` (`src/forge/gameFiles.ts`, and the `<head>` of `forge/index.html`).
That resolves to the site root from `/forge/` in production, and in dev too,
where the server serves the page at `/forge/` and `public/` at `/`.

- **Card art streams one file at a time.** The card is drawn at once with the
  flat loading stand-in (`ART_LOADING_TEXTURE`), the donor's file is requested,
  and its arrival redraws the card. Changing the art donor or loading a catalog
  card requests that one file. The art picker's thumbnails are lazy `<img>`s.
  Measured 2026-09-25 on production builds served locally with caching off,
  counting what had arrived by the time the first card was drawn: the old
  builder fetched 1,540 files, 228,987,968 bytes (1,537 of them card art); the
  Forge fetches 5 files, 1,945,876 bytes (page, JS, CSS, two fonts), then one
  art file of about 109 KB for the card's real art.
- **Fonts.** `forge/index.html` declares the game's self-hosted Cinzel and
  Inter faces (the same files and descriptors as the game's `index.html`), and
  the preload scene requests the four faces `CardView` uses and waits for them,
  so card text never bakes with a system fallback. A face that fails to load is
  reported as a console warning, which fails the QA probe.

## Code layout

- **`src/power/scoreCore.ts`: the scorer.** Pure and headless: no Phaser, no
  DOM, no Node built-ins (ESLint's purity block covers `src/power/**`). The
  Forge scores with it in the browser; the local balance CLI
  (`balance/score.ts`, gitignored) scores the whole pool with it through the
  one-line shim `balance/scoreCore.ts` (`export * from '../src/power/scoreCore';`).
  The rationale for every rate is in `balance/power-formula.md`, which is
  local-only and not in the repo.
- **`src/forge/`: the page.** Its headless half is `logic.ts` (builder state,
  conversion to and from `CardDef`, the verdict, warnings), `hints.ts`
  (costing hints, each re-scored for real), `store.ts` and `vocab.ts`. ESLint
  keeps those four free of Phaser, the DOM and Node, which is what lets the
  tests import them. The rest is browser-side: `main.ts` (the controls and the
  QA probe), `scene.ts` (the Phaser scenes, art streaming, font wait),
  `gameFiles.ts`, `fxSupportStub.ts` and `style.css`.
- **`forge/index.html`**: the page, its head tags and the `@font-face` block.

## Storage and network isolation

The Forge is served from the same origin as the game, so the game save
(`darlingblades.save.v1`, and the legacy `waifutcg.save.v1`) is within its
reach. The rule: **the Forge never reads or writes browser storage.**

- The build replaces every bare `localStorage` with `undefined` (the card-proof
  recipe; it also neuters Phaser's storage probe). Dev applies the same define
  while pre-bundling Phaser only, because Vite 8's dev client assigns top-level
  defines onto `window` and `window.localStorage` is read-only.
- `fxSupportStub.ts` stands in for `src/ui/fx/FXSupport.ts`, whose real
  `fxPolicy` reads the player's animation setting from the save.
- The page's CSP is `connect-src 'self'`: no telemetry, no update check, no
  host but the site itself.

Keep it that way: a Forge feature that wants to remember something must not
use the game's origin storage.

## Tests

- `tests/power/scoreCore.test.ts`: the data-integrity invariant that every
  collectible catalog card scores with **zero unknown vocabulary** (the CI half
  of the rule that every mechanic is priced; the local CLI refuses to run on
  unknown vocabulary, and this catches a new mechanic reaching the catalog
  before the scorer, and so the Forge, has a rate for it), plus the 1.8 rates
  (Duty, Whispers, Tithe).
- `tests/forge/builder.test.ts`: the **load round trip** (every collectible
  catalog card, loaded into builder state and converted back, scores exactly
  as the card itself: PowerScore, Budget and Delta), conversion, the v3 budget,
  the colour-pie ledger, the verdict bands, and hint truthfulness.
- `tests/forge/mechanics18.test.ts`: Duty, Whispers and Tithe in the builder
  (round trips and the validator-exclusion warnings).

None of them reads a gitignored file.

## Local procedure: a byte-identical rescore

A change to `src/power/scoreCore.ts` that should not move any number (a
refactor, a move, a comment) is checked against the full saved score file
before it lands. This is a local procedure, not a CI test: in CI the file does
not exist, and a deliberate rate change would fail it every time.

1. Before the change, with the local workbench present (`balance/score.ts`
   and the shim), run `npx tsx balance/score.ts` and record
   `sha256sum balance/power-scores.json`.
2. Make the change.
3. Delete `balance/power-scores.json` and run `npx tsx balance/score.ts` again
   (it exits non-zero on unknown vocabulary).
4. The new SHA-256 must equal the recorded one. If it differs, the change moved
   a number: diff the two files, and treat it as a rate change (priced,
   documented in `balance/power-formula.md`, and reviewed) or undo it.

The move of the scorer into `src/power/` passed this check on 2026-09-25
(SHA-256 `49152a4be1b33f0a98b3efb86eb1bbb716cff422d8d9e60f2485ecdc74cf3562`
before and after).
