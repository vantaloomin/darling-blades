<!-- source-of-truth: forge/index.html, src/forge, src/power/scoreCore.ts, vite.forge.config.ts, scripts/build-forge.ts, tests/forge, tests/power · last-verified: 2026-09-25 -->

# The Forge

The Forge is the public card designer: build a card in the left rail, see it
drawn by the game's own `CardView` in the middle, and read on the right how its
cost measures up (the page calls the scorer's PowerScore **Power**, the v3
Budget **Budget** and their Delta **Difference**, beside the Power Breakdown and
one-click costing hints). A card can show any game card's art or the player's
own image, framed in the art window. Under the card, a set builder collects
cards into a named set that exports and imports as JSON; any card can be shared
as a link or saved as a PNG; and the header links back to the game. It began as
the old local Card Builder workbench, moved into the repo and deployed with the
game.

## Features

- **Set builder.** Save to Set adds the card in the editor to the set, or
  updates the set card being edited; Save and Start Next saves, then opens a
  fresh card; New Card opens a fresh card (asking first over unsaved changes).
  The set panel lists every card (cost, name, type line, and a verdict chip
  with its Difference); clicking a row opens that card, and each row can be
  removed. A set holds up to 500 cards. The status line under the card says
  whether the editor holds a new card or card n of the set, and whether it has
  unsaved changes. Export JSON, Import JSON and Clear Set sit under the list.
- **Autosave.** The set and the card in the editor are saved in the browser as
  you work and come back on reload (see Storage below). A second tab picks up
  the set the first one saved; each tab keeps its own card in the editor.
- **Share link.** Copy Link puts the card in the URL fragment (format below).
  Opening such a link puts the card in the editor as a new, unsaved card and
  never changes the set.
- **Save Image.** A PNG of the card as displayed (frame, art, text, the current
  holo finish as a still) on a transparent background, 600 x 840 (848 for a
  legendary card, whose crown rises above the frame), named after the card. The
  canvas renders one frame at twice the card's canonical size, the resolution
  the frames and card text are baked at, so nothing is upscaled.
- **Your own image.** The Art section switches between **Game Art** (borrow
  any card's art, as before) and **Your Image**: choose a PNG, JPEG, WebP or
  GIF of up to 20 MB, or drop one on the panel or on the card, and frame it in
  the art window with Zoom, Left and Right, Up and Down and Rotate sliders,
  Flip, Fit Whole Image, Fill the Frame and Reset, or by dragging on the card's
  art. Background (a color) shows only while the picture leaves part of the
  frame empty, or has see-through pixels. It works in the standard frame and
  in Full Art, the card redraws live, and Save Image includes it. Choose
  Another replaces the image; Remove Image (after a confirm) takes it off the
  card. The image never leaves the device: nothing is uploaded, and the page
  makes no network request for it (see Storage below). Switching to Game Art
  keeps the image in the editor so switching back finds it, but a card is
  saved with its own image only while it shows it. Every control is a real
  range input or button, so the framing is keyboard-usable; the drag has the
  sliders as its keyboard equivalent.
- **Play Darling Blades.** The header links to the game (`../`).
- **The game's own words.** Keyword, mechanic, rarity, set and effect names are
  read from game data at runtime (the glossary, `src/data/setTitles.ts`, and the
  builder's effect menu), so a rename in the game reaches the Forge with no
  Forge edit (owner ruling 2026-09-25; `tests/forge/ledgerNames.test.ts` holds
  it). The scorer's machine labels are translated for display in
  `src/forge/ledger.ts`; the scorer itself is untouched.

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

The page's QA probe runs with `?qa=1` (`/forge/?qa=1`): it starts from a fresh
card and an empty set, waits for the first card, waits for the card to be
redrawn with its real art, checks that both webfonts loaded, drives the mana
slider, a pip, a keyword drag and a hint, then Save to Set, Save and Start Next
and a second save, exports the set and imports the file back (the same cards
and scores must return), encodes a share link, decodes it and opens it the way
a link does. Then the own-image steps (`src/forge/customArtQa.ts`): it paints a
four-color test picture on a canvas (nothing is fetched), chooses it through
Your Image, checks Fill the Frame, Fit Whole Image and Reset each land on
their defined framing, frames it with the sliders, Flip and Background, drags
it on the card (the move must equal the drag in art pixels), checks that
CardView crops exactly the windows `framing.ts` assumes, that the card's
texture shows the framed picture pixel for pixel (sampled against the framing
math), and that the Save Image PNG does too, in the standard frame and in Full
Art. It saves the card (the row must carry the Own art tag), exports and
re-imports the set (same framing, same image id, same bytes), checks a share
payload carries no image, the Forge key holds the image's id and no image
bytes and stays under 64 KB, the image is in IndexedDB, and that removing the
card deletes it. After that it makes the Save Image PNG without downloading it
(it must be `image/png` and at least 700 px tall), and finally checks storage:
every localStorage key and value is snapshotted before the page writes
anything, and afterwards only `darlingblades.forge.v1` may differ. It then
restores that key (and the page's set and card) to what they were, deletes
every image it made from IndexedDB (never one the restored page refers to),
and fails if any is left. The result is published as
`document.documentElement.dataset.qaStatus` (`pass` or `fail`) and
`window.__cardBuilderQa` (the details, including every console error or warning
seen). A `?qa=1` load ignores any `#card=` fragment. In a hidden browser pane Phaser's loop does not run on
its own: step it by hand (`window.__game.loop.step(t)` with a monotonic `t`, as
in the playbook's preview-probe recipe) until the status appears.

## Build

The Forge has its own Vite config, `vite.forge.config.ts`, so none of its
settings (the FX alias, the storage define) can reach the game bundle; the
game's own output does not change because the Forge exists (checked
byte-identical against the pre-Forge commit on 2026-09-25). The config's root
is the repository, so the page sits at `/forge/` in dev exactly as in
production. Output: `dist/forge/index.html` plus its JS and CSS under
`dist/forge/assets/`, three files and 1,960,158 bytes (measured 2026-09-25,
after the own-image wave landed).
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
- **`src/forge/`: the page.** Its headless half: `logic.ts` (builder state,
  conversion to and from `CardDef`, the verdict, the structured warnings),
  `hints.ts` (costing hints, each re-scored for real), `store.ts`, `vocab.ts`,
  `ledger.ts` (the Power Breakdown's display labels), `validate.ts` (the one
  validator for imported files, share links and the autosave, plus the editors'
  limits), `setModel.ts` (the set, the file format, the editor session),
  `share.ts` (the share-link codec), `storage.ts` (the autosave) and
  `markup.ts` (escaped HTML for player-controlled text). ESLint keeps them free
  of Phaser, the DOM and Node, which is what lets the tests import them. The
  rest is browser-side: `main.ts` (the controls, the set panel and the QA
  probe), `scene.ts` (the Phaser scenes, art streaming, font wait, Save Image,
  and the own image: the composed texture, the `ForgeArtResolver` and the drag
  on the card), `gameFiles.ts`, `fxSupportStub.ts` and `style.css`.
- **The player's own image.** Headless: `framing.ts` (the framing model and
  its math: cover, contain, the zoom floor, pan room, Fit, Fill, Reset, the
  drag conversion, and whether the frame shows empty) and `customArt.ts` (the
  `art.custom` shape and its validation, image data URLs, the image-header
  check, image ids, and which stored images are still referenced).
  Browser-side: `imageStore.ts` (IndexedDB, with the in-memory fallback),
  `imageIntake.ts` (decode, downscale, re-encode), `imageLibrary.ts` (decoded
  images, and the clean-up), `customArtPanel.ts` (the Your Image controls) and
  `customArtQa.ts` (the probe's own-image steps).
- **How the card shows it.** No production file changes. The picture is
  composed with its framing into a 640 x 800 canvas, the art-file space a real
  card art file fills, and registered as a Phaser canvas texture
  (`forge-custom-art`). The forge's `ForgeArtResolver` (a subclass of the
  game's `ArtResolver`, set as `Art.resolver`) returns that texture for the
  card's id while it shows its own image, and the loading stand-in while the
  image is read. `CardView` still draws the card by its real catalog id (the
  art donor, which stays set underneath) and cover-crops the texture exactly as
  it crops real art, so what the card shows is the composition, in both frames.
- **`forge/index.html`**: the page, its head tags and the `@font-face` block.

## Storage and network isolation

The Forge is served from the same origin as the game, so the game save
(`darlingblades.save.v1`, and the legacy `waifutcg.save.v1`) is within its
reach. The rules:

- **One key.** The Forge reads and writes exactly one localStorage key,
  `darlingblades.forge.v1`, and only through `src/forge/storage.ts`. It never
  reads or writes the game save keys, and never clears, removes or enumerates
  storage (the `?qa=1` probe alone lists the keys, read-only, to prove nothing
  else changed; it removes nothing but its own key when restoring it).
  `tests/forge/storage.test.ts` holds this with a Storage fake that records
  every call.
- **`window.localStorage`, spelled out.** The build replaces every bare
  `localStorage` with `undefined` (the card-proof recipe; it neuters Phaser's
  storage probe, which is still wanted). `main.ts` reaches storage as
  `window.localStorage` inside a try/catch, which the define leaves alone
  (checked in the built bundle, 2026-09-25). Dev applies the same define while
  pre-bundling Phaser only, because Vite 8's dev client assigns top-level
  defines onto `window` and `window.localStorage` is read-only.
- **Small.** The autosave is text only: the set's card entries (no scores) and
  the card in the editor, capped at 2 MB of JSON, because the game save
  shares this origin's quota of a few megabytes. A card with its own
  image stores only the image's id there; the write drops any custom image
  that is not an id, so image bytes cannot reach this key.
- **Images live in IndexedDB.** The Forge's own database,
  `darlingblades-forge`, store `images`, keyed by the image id (the SHA-256 of
  its bytes, so an image used on several cards is stored once). Each record
  holds the bytes, their type, the picture's size and whether it has
  see-through pixels. Why not localStorage: one image is hundreds of
  kilobytes, and filling the shared quota would make the game's own saves fail.
  A record read back is checked (field types, an accepted image header, bytes
  that hash to its id) and decoded before it is drawn. If the browser refuses
  IndexedDB (blocked, private, or out of room), images are kept in memory for
  as long as the tab stays open and the page says so ("This browser couldn't
  store the image...").
- **Clean-up.** An image is kept while anything refers to it: a card in the
  set, the card in the editor (even while it shows game art), what the editor
  was opened as, an image in the middle of being added, and any image id
  another tab's autosave names. Everything else is deleted, a moment after
  each change, so Clear Set, Remove, New Card, Remove Image and Choose Another
  leave nothing behind and the database cannot grow past what is in use. A
  tab puts back an image it still uses if another tab's clean-up removed it.
- **Untrusted on the way back.** What the autosave reads back goes through the
  same validator as an imported file. If the browser refuses storage (blocked,
  private, or full), the page says so under the set list and keeps working.
- `fxSupportStub.ts` stands in for `src/ui/fx/FXSupport.ts`, whose real
  `fxPolicy` reads the player's animation setting from the save.
- The page's CSP is `connect-src 'self'`: no telemetry, no update check, no
  host but the site itself. Share links live in the URL fragment, which the
  browser never sends to a server.

Keep it that way: a Forge feature that wants to remember something uses the
one Forge key (or, for images, IndexedDB), never the game's.

## The set file format (version 1)

Export JSON writes, and Import JSON reads:

```json
{
  "format": "darling-blades-forge-set",
  "version": 1,
  "name": "<set name>",
  "cards": [
    {
      "card": { "id": "forge-<name slug>-<n>", "name": "...", "types": ["creature"], "...": "the CardDef the Forge builds" },
      "art": {
        "donor": "<catalog card id supplying the art>",
        "custom": {
          "image": "data:image/webp;base64,...",
          "zoom": 0.75, "x": -0.2, "y": 0.4, "rotation": 15, "flip": false,
          "background": "#1a1426"
        }
      },
      "appearance": { "frame": "default", "holo": "default", "fullArt": false },
      "score": { "power": 2.1, "budget": 1.5, "delta": 0.6, "verdict": "accurate" }
    }
  ]
}
```

- **`card`** is the `CardDef` the builder produces (`toCardDef`), with `id`
  replaced by a per-set id, `forge-<slug of the name at first save>-<n>`, that
  never changes while the card is in the set.
- **`art`** holds the `donor` (the catalog card whose art the card borrows)
  and, for a card with its own image, `custom`. An unknown donor falls back to
  the default donor; any other field in `art` is ignored.
- **`art.custom`** is optional and additive: a file without it imports exactly
  as before, and the format stays version 1. `image` is the image as a data
  URL (PNG, JPEG, WebP or GIF, base64); the rest is its framing, in art-file
  space (the 640 x 800 canvas CardView cover-crops into the art window):
  `zoom` (1 = the picture exactly covers the art file; the floor lets the whole
  picture fit either frame at any angle; the ceiling is 5), `x` and `y` (-1 to
  1: the share of the room the picture has to move in the frame, positive
  right and down), `rotation` (degrees, -180 to 180, clockwise), `flip`
  (mirrored left to right, before it is turned) and `background` (`#rrggbb`).
  The donor stays set under a custom image: it is what a share link shows. In
  the page and in the autosave, `image` is the image's id instead (64 hex
  digits), and the bytes are in IndexedDB; only the file embeds them.
- **`appearance`** is cosmetic; an unreadable one falls back to the default
  look.
- **`score`** is written for people reading the file. Import ignores it and
  recomputes every score.
- The file name is a slug of the set name plus `.json`.

**Import is hostile-input handling** (`src/forge/validate.ts`): a file over
100 MB is refused before it is read (a set that embeds its images runs to a
few hundred kilobytes per image; a set of text alone is a few megabytes); a file whose `format`, `version` or `cards`
is wrong is refused whole ("That file isn't a Forge set."); otherwise every
card is checked on its own and a bad one is skipped with a reason while the
rest import. The validator never passes an input object through: it reads each
known field, checks its type, its vocabulary (card types, rarities, sets,
colors, keywords, effect kinds, triggers, targets, tokens) and the number
ranges the editors allow, caps string lengths (name 80, subtype 120, set name
60), list sizes (12 abilities, 12 effects per list, 9 chapters) and branch
nesting (4 deep), refuses any unknown field, and builds a fresh object from the
checked values. One field is read past and dropped rather than refused:
`flavor`. Flavor text is removed from the whole game (owner ruling R13,
2026-09-25, in `docs/plan-1.9.md`), so the Forge has no flavor editor, never
carries flavor in an export, share link or autosave, and never hands it to
`CardView`, even for a game card that still prints some before 1.9 lands. The accepted card is then passed through the builder
(`fromCardDef`, then `toCardDef`), so a set only ever holds cards the Forge can
build and edit. The editors clamp to the same limits (`FORGE_LIMITS`,
`OP_RULES`), so everything the Forge can build passes. Ids are kept when well
formed and unique, otherwise replaced. At most 500 cards import. A card's
`art.custom` is checked structurally (`src/forge/customArt.ts`): the known
fields only, a data URL of an accepted image type within the per-image cap of
3 MB of image bytes, and every framing number in range. The page then decodes
it (the image's own header must match its type and claim at most 100
megapixels, and the browser must decode it) and stores it: the exact bytes
when they already fit (so an export and its import match byte for byte), or
re-encoded when the picture is over 1600 px or a GIF. A card whose image fails
any of this imports with its game art and is named in the import message; it
is not dropped. Export JSON embeds each image as a data URL, and the set panel
says so ("Exported sets include your images, so the file can be large.") while
any card has one; an export over the 100 MB import cap still downloads, with a
warning.

**Own images coming in** (`src/forge/imageIntake.ts`): a chosen or dropped
file over 20 MB is refused before it is read; its header must be PNG, JPEG,
WebP or GIF and claim at most 100 megapixels (so SVG, HTML and decompression
bombs never reach the decoder); it must decode with `createImageBitmap`
(bytes become a Blob, never a URL: the page's CSP is `connect-src 'self'`
and a `data:` or `blob:` fetch would fall under it). It is then downscaled so
its long side is at most 1600 px and re-encoded as WebP at quality 0.85, which
keeps transparency; where the browser cannot encode WebP, as PNG when it has
see-through pixels and JPEG at 0.85 otherwise. An encoding over 3 MB is redone
at 80% of the size until it fits.

**Round-trip contract:** for every card the Forge can build, importing its
export reproduces the same `CardDef`, art and look, and an identical score, and
for a card with its own image, the same framing and the same image bytes.
`tests/forge/setFormat.test.ts` checks this over every collectible catalog card
(and the own-image part on the file's side); the `?qa=1` probe checks the bytes
through the real store.

## The share-link format (version 1)

A shared card travels in the URL fragment: `/forge/#card=<payload>`. The
payload is `1.` followed by the base64url (no padding) of the deflate-raw
compressed UTF-8 JSON of one card entry, `{ "card", "art", "appearance" }`: the
same per-card shape as the set file, without `score`. The fragment never
reaches a server.

- **Copy Link** writes the link with `navigator.clipboard.writeText`; when the
  browser refuses, a field labelled "Copy this link:" shows it selected. A link
  over 8,000 characters is refused (use Export JSON instead).
- **A link never carries the player's own image.** The encoder writes the art
  donor alone, and the decoder drops any `art.custom` a payload brings, so a
  shared card opens with its game art. After Copy Link on a card with its own
  image, the page says so ("Links don't include your own image, so the card
  opens with game art instead.").
- **Opening a link**: the payload is decoded and checked by the same validator
  as an imported file, opened in the editor as a new unsaved card (asking first
  if the editor has unsaved changes), and the fragment is removed with
  `history.replaceState` so a reload does not open it again. A bad payload
  shows a message and leaves the editor alone. Decoding caps the payload at
  10,000 characters and the inflated JSON at 256 KB (a few bytes of deflate can
  inflate to gigabytes).
- **Compatibility:** `tests/forge/share.test.ts` carries a golden version 1
  payload that must always decode to the same card, so links shared today keep
  opening. A future format takes a new prefix (`2.`); `1.` links must keep
  decoding.

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
  the colour-pie facts in the breakdown, the verdict bands, and hint
  truthfulness.
- `tests/forge/mechanics18.test.ts`: Duty, Whispers and Tithe in the builder
  (round trips, and the combinations the game refuses surfacing as `illegal`
  warnings; tests assert a warning's kind and rule, never its wording).
- `tests/forge/setFormat.test.ts`: the **export/import round trip** over every
  collectible catalog card, the validator refusing malformed and hostile cards
  while importing the good ones, the size and card caps, ids, the editor
  session (save adds then updates, unsaved changes, the 500-card cap), and the
  own image in the file (embedded on export, the same framing and bytes on
  import, an unreadable image leaving the card in with its game art, and a
  card saved with its image only while it shows it).
- `tests/forge/share.test.ts`: the golden version 1 share payload, encode and
  decode round trips, a link never carrying a card's own image, hostile
  payloads (bad prefix, bad base64, not deflate, a decompression bomb, an
  unknown effect).
- `tests/forge/framing.test.ts`: the framing model for wide, tall and square
  pictures: zoom 1 covers the art file exactly, the zoom floor fits the whole
  picture in either frame at any angle, Fit Whole Image, Fill the Frame and
  Reset land on their defined states, the background shows exactly while the
  frame has an empty part, clamping, the drag conversion (the picture moves
  by the drag in art pixels, stops at the frame's edge, and stays put on an
  axis with no room), and the art windows as CardView crops them.
- `tests/forge/customArt.test.ts`: the image-header check (the four accepted
  formats read, anything else and pixel bombs refused), image ids (SHA-256,
  the plain-code fallback matching `crypto.subtle`), data URLs (exact bytes,
  other types and the per-image cap refused), the `art.custom` validator, and
  which stored images are still referenced.
- `tests/forge/storage.test.ts`: the autosave touches only its own key (a
  recording Storage fake), round-trips, keeps an own image by id and never
  writes image bytes, and survives corrupt or blocked storage.
- `tests/forge/markup.test.ts`: a hostile card name is escaped in text and in
  attributes of the set row and warning chips.
- `tests/forge/ledger.test.ts` and `ledgerNames.test.ts`: every breakdown label
  of every collectible card reads as player words (no section signs, NEEDS
  MATH, MEP, em-dashes, engine ids or Magic's vocabulary), provisional rates
  carry the Estimate tag, and a rename in the game glossary reaches the Forge.

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
