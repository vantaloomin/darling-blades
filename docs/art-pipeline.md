<!-- source-of-truth: src/art/ArtResolver.ts, src/art/PlaceholderArtGenerator.ts, src/art/ArtAtlas.ts, src/art/SeededRandom.ts, src/art/TribeEmblems.ts, src/ui/CardView.ts, src/ui/BoardCardView.ts, src/ui/fx/HoloEffects.ts, src/ui/fx/IridescencePostFX.ts, src/ui/fx/FXSupport.ts, scripts/gen-art-manifest.ts, scripts/gen-card-art.ts, scripts/gen-land-art.ts, scripts/gen-spell-art.ts, src/data/art-manifest.json · last-verified: 2026-07-06
     If you change those files, update this doc or re-verify the date. -->

# Art pipeline

Every card shows *something* the moment the game boots, whether or not a real
illustration exists. That is the job of the resolver: real art when it's
available, a deterministic procedural placeholder otherwise, and the consumer
never knows which it got.

## Resolver flow

`src/art/ArtResolver.ts` (`ArtResolver.getArt(cardId)`) returns a
`{ textureKey, frameName? }` and hides the real-vs-placeholder decision:

- If the card's **art key** is in the build-time manifest, it returns
  `{ textureKey: 'artfile-<key>' }` — a real, loaded PNG texture.
- Otherwise it returns the placeholder's **atlas frame**
  (`{ textureKey: 'art-page-N', frameName: 'art-<key>' }`).

The art key is `d.artRef ?? cardId`, so a card can **share art** via `artRef`
(both placeholder and real-file paths key off the same value).

Only manifest-listed files are ever requested from the loader
(`queueRealArt`), so there are **zero runtime 404s** — the game never tries to
load a file that isn't there.

`Art.resolver` is a module singleton: `PreloadScene` sets it once, and `CardView`
reads it everywhere.

## Placeholder generator

`src/art/PlaceholderArtGenerator.ts` (`drawPlaceholderArt(ctx, d)`) draws a
**320×400** (`ART_W`×`ART_H`) canvas deterministically from the card's art seed
(`SeededRandom`, keyed by `artRef ?? id`). Layers, in draw order:

1. **Color-identity background gradient** (top→bottom).
2. **Seeded decorative pattern** — one of five: diagonal rays, concentric arcs,
   hex lattice, cloud scrolls, or a meander key strip.
3. **Tribe emblem** — a large centered SVG path (`TribeEmblems.ts`), chosen by
   subtype/type (`emblemFor`).
4. **Character bust silhouette** (creatures only) — head + shoulders with a
   seeded hair/feature shape (long, ponytail, twintails, bun, short, foxears,
   horns) and a rim light.
5. **Embossed monogram** — the card's initials, bottom-right.
6. **Corner ribbon** accent, top-left.

### The `PALETTES` table

Color-identity palettes are `[gradient top, gradient bottom, accent]`
(`PALETTES` in `PlaceholderArtGenerator.ts`):

| Key    | Top       | Bottom    | Accent    | Used for                    |
| ------ | --------- | --------- | --------- | --------------------------- |
| `W`    | `#f2e8cf` | `#c9a84c` | `#fffef2` | White                       |
| `U`    | `#4a90d9` | `#16294f` | `#a8d4f7` | Blue                        |
| `B`    | `#5a3a70` | `#140d1c` | `#9b6fc4` | Black                       |
| `R`    | `#d95436` | `#5e0f0f` | `#f7b267` | Red                         |
| `G`    | `#4fa06a` | `#123a22` | `#a9dcae` | Green                       |
| `C`    | `#a9adb5` | `#4e535c` | `#dfe3ea` | Colorless (0-color nonland) |
| `gold` | `#e8c95a` | `#7a5a18` | `#fff2b8` | Multicolor (≥2 colors)      |
| `land` | `#b09468` | `#4a3a26` | `#e0cfa8` | Lands                       |

`paletteFor(d)` picks: land → `land`; ≥2 colors → `gold`; 0 colors → `C`;
otherwise the single color.

## Atlas paging

`src/art/ArtAtlas.ts` stitches generated arts into shared **DynamicTexture
pages** instead of one texture per card. Each page is a 6×5 grid (`COLS`×`ROWS`)
= **30 arts per page** at `PAGE_W`×`PAGE_H` = 1920×2000. A card's art becomes a
frame `art-<key>` on its page texture, so 30 cards cost one GPU texture bind
instead of 30. A single reused `art-scratch` canvas draws each art before it is
stamped onto the current page.

## Real-art override — step by step

To replace a card's placeholder with a real illustration:

1. **Author a `640×800` PNG** (the placeholder is 320×400; supply real art at 2×
   for crispness — both are the same **4:5** aspect the art window expects).
2. **Drop it at** `public/assets/art/cards/<cardId>.png`. The filename (minus
   `.png`) is the card id — or the shared `artRef` key if several cards share
   art.
3. **Regenerate the manifest:** `npm run gen-art-manifest` scans that folder and
   writes `src/data/art-manifest.json`. `npm run dev` and `npm run build` run it
   for you (see `package.json`).
4. **Done.** `ArtResolver` now returns `artfile-<key>` for that card. No code
   changes; no 404s (the file is in the manifest, so it's requested; unlisted
   files are never requested).

Current status: **every card in the pool has real art on disk** — all **282**
entries (`public/assets/art/cards/`, every one listed in
`src/data/art-manifest.json` with a matching half-res variant in `cards-half/`),
so no card renders a procedural placeholder anymore — the placeholder path
remains as the fallback for future cards. The original 152-entry base-set run
completed 2026-07-03 (see the run status at the end of the next section); the
Ragnarök expansion (69 collectibles + 3 tokens) was generated afterward via the
`ragnarok` art-bible faction plus `gen-spell-art` coverage.

### Generating real art: `scripts/gen-card-art.ts`

The generation driver (`npm run gen-card-art`) automates the steps above for
the whole art bible. **Style pivot (2026-07-02):** the art program moved from
painted-anime splash to **crisp cel-shaded gacha anime with fully rendered
scenic backgrounds** (Ascendant-derived); the binding style contract lives in
`docs/art-bible/index.md` §2, and the script injects a matching preamble and
negatives around every entry prompt. Per entry it parses the Prompt line from
the `docs/art-bible/` faction file and assembles
**[composition+style preamble] + [entry prompt] + [negatives]**: the preamble
carries the composition prefix — "waist-up portrait framing **(even for seated
or enthroned poses)**, the face at the exact vertical center … the entire top
**third** of the image is background only" — load-bearing, because pilot
calibration showed unprefixed generations paint the face in the top ~20% of
the canvas, *above* the card window's visible band. The prefix was
**recalibrated mid-run**: under the cel style the original *top-quarter*
wording still put seated/enthroned-pose eyes at y≈140–175 (above the window)
while standing poses landed fine at y≈260–340; top-THIRD headroom plus the
explicit seated-pose clause fixed the seated cases without disturbing the
standing ones. The preamble also carries the cel-shading DNA, heroic register,
and scenic-background lines mirroring the index contract; the appended
negatives block carries the NO-TEXT hard rule and the anatomy/style negatives.
It then generates at **1024×1536** via the chatgpt-imagegen CLI and center
cover-crops to the exact **640×800** deliverable with Pillow (the same crop
math as the card frame). Runs are **idempotent and resumable**: existing PNGs
are skipped (`--force` regenerates), files are written temp-then-rename (an
interrupted write can never leave a truncated PNG that skip-existing would
treat as done), a Pillow preflight fails fast *before* any quota is spent, and
3 consecutive generation failures abort the batch. Raw uncropped originals are
kept in the temp dir and **reused on rerun** — a leftover raw is re-cropped
instead of paying for a new generation (`--force` always regenerates; its
purpose is a *new* image, not a re-crop of a rejected one). CLI resolution is
`--cli <path>` → `$CHATGPT_IMAGEGEN_CLI` → a search of the local skills-plugin
install → bare `chatgpt-imagegen` on PATH; on Windows the PATH fallback
**fails fast** instead (shell-less spawn only resolves `.exe`, so a `.cmd`
wrapper would ENOENT on every entry). Filters: `--faction <stem>`,
`--only id1,id2`, `--limit N`, `--dry-run`; `--show-prompt` prints the exact
assembled prompt(s) without generating — review text before a batch burns
quota. After a generating batch it re-runs `npm run gen-art-manifest` so the
game picks the new files up.

### Land art: `scripts/gen-land-art.ts`

The 15 **land cards** (5 basic + 10 dual taplands) have their own art program,
separate from the creature art bible — they are **landscape, not character**.
Direction lives in `docs/land-art.md` (the binding contract + one Prompt line
per land) and the driver is `npm run gen-land-art` (`scripts/gen-land-art.ts`),
a sibling of `gen-card-art.ts` with the same hardened machinery
(1024×1536 → Pillow center cover-crop to **640×800**, temp-then-rename writes,
Pillow preflight, 3-consecutive-failure abort, idempotent skip-existing, and
the `--only` / `--limit` / `--dry-run` / `--show-prompt` / `--force` / `--cli`
flags). The one deliberate difference is the prompt preamble: it is
**environment-first** (wide scenery with the iconic terrain in the central
ART_RECT band, NO character/people/figures) rather than the card driver's
waist-up-portrait prefix, while the appended negatives keep the same NO-TEXT
hard rule plus a no-people guard. Output lands in the **same
`public/assets/art/cards/` directory at the same 640×800 dims** as the creature
faces, so `gen-art-manifest` + `ArtResolver` pick land PNGs up with no code
changes (it re-runs the manifest after a generating batch, exactly like the
card driver). Until a land PNG exists, the land keeps its `land`-palette
procedural placeholder.

### Spell art: `scripts/gen-spell-art.ts`

The 43 **non-creature spell cards** (18 instants, 14 sorceries, 10
enchantments, 1 artifact) likewise sit outside the creature art bible and get
their own program. Direction lives in `docs/spell-art.md` and the driver is
`npm run gen-spell-art` (`scripts/gen-spell-art.ts`), a sibling of the card and
land drivers with the identical hardened machinery and flags. Its preamble is
**effect-first** — the spell's dramatic magical *moment* (a bolt, a
resurrection, a curse-aura, a gale) is the hero of the frame, centered in the
ART_RECT band, with any figure secondary — and its negatives harden the NO-TEXT
rule specifically against stamped banner-text/seal-glyphs/nameplates (the
banner, seal, and oath cards invite them). Output goes to the same
`public/assets/art/cards/` at 640×800, so the manifest and resolver pick spell
PNGs up automatically. Together with the land program this closed the base set:
**all 210 base-set cards** (147 creatures + 15 lands + 43 spells) got real
illustrations, and the later Ragnarök run extended the same drivers over the
expansion — so **every one of the 282 cards** now has real art; only
pre-generation does a card fall back to its type-palette procedural placeholder.

**Base-set run status (2026-07-03): COMPLETE — 152/152 on disk** (plus 152
half-res variants and the 11 scene assets); the Ragnarök expansion art was
generated in a later run, bringing the on-disk total to **282** (+282 half-res).
The base run paused twice on the same root
cause: four concurrent lanes raced the CLI's OAuth token refresh at expiry
and invalidated the credential. **Concurrency across a token refresh is a
documented no-go** — after the user re-authenticated (`codex login`), the
remaining 61 generated *serially* without further auth incident. QA record:
**zero text incidents across all 152 images** (the no-text guard holds);
gender drift held at roughly **1 in 22** (`gk-apollo` rendered male against
its genderbent entry — regenerated with `--force --only`); commons tend to
**over-render their backgrounds** past the art bible's two-value spec
(accepted). Three art-bible QA fixes landed during the run: `tok-peacock`'s
palette was corrected to match the shipped blue-green Hera peacocks;
`bk-batkin-duskwing`'s pose was reworded away from an inverted hang that
failed the face safe zone twice — and after a *third* inverted result under
the perched wording, its Prompt now states the upright cue explicitly
("perched fully upright… definitely not hanging upside down"), which passed
on the next roll.

## The art window & safe-zone math (this doc owns it)

`CardView` (`src/ui/CardView.ts`) draws art into a fixed window
`ART_RECT = { x: -132, y: -164, w: 264, h: 192 }` — a **264×192** rectangle in
card-local (center-origin) coordinates.

The art is **cover-fit with a vertical center crop** (`setCard`): the image is
scaled up to fill the window on both axes, and the vertical overflow is cropped
symmetrically top and bottom:

```
scale = max(ART_RECT.w / srcW, ART_RECT.h / srcH)
cropH = ART_RECT.h / scale               // source-space height that fits the window
crop  = (0, (srcH - cropH)/2, srcW, cropH)   // center vertical band
```

For a **4:5 source**, the window is wider-per-height than the source, so width
drives the scale and the **top and bottom of the source are cropped away**.

### Visible fraction (4:5 source)

- `scale = 264 / (4·k) = 66/k` where the source is `4k × 5k`.
- The horizontal scale (`264/4k`) exceeds the vertical (`192/5k`), so it wins.
- `cropH = 192 / scale = 192·k/66 ≈ 2.909·k`.
- Visible height fraction = `cropH / (5k) = 2.909/5 ≈ **0.582`** → **the middle
  58.2% of the source height is visible.**

### Worked example at 640×800

- `scale = max(264/640, 192/800) = max(0.4125, 0.24) = 0.4125`.
- `cropH = 192 / 0.4125 ≈ 465.5` px of source height.
- Cropped margin = `(800 − 465.5)/2 ≈ 167` px top and bottom.
- **Visible vertical band: y ≈ 167 → 633** in the 800-px source.

**Keep faces and focal detail in that middle ~58% band** — anything above
y≈167 or below y≈633 (at 640×800) will be cropped off.

### Display sizes at each card scale

The window is 264×192 at full card scale; multiply by the consumer's scale:

| Context             | Card scale  | Art on screen (px)      |
| ------------------- | ----------- | ----------------------- |
| Inspect overlays    | 1.35        | ~356 × 259              |
| Hover zoom (duel)   | 1.3         | ~343 × 250              |
| Pack reveal (rest)  | 0.62        | ~164 × 119              |
| Duel hand (fan)     | 0.4–0.46    | ~106 × 77 – ~121 × 88   |

**Battlefield permanents don't use `CardView`** (2026-07-03 board redesign) —
they render as compact `BoardCardView` tiles (`src/ui/BoardCardView.ts`, a
132×146 tile) whose art window is the whole tile inset by a 4px frame margin:
a **near-square 124×138** window (`ART_W`×`ART_H`). The tile cover-crops the
source with the crop band biased slightly *upward* — the top offset is
`(srcH − cropH) · 0.3` instead of centered — so for a 640×800 source the tile
shows roughly the **y ≈ 26 → 738** band (~89% of the source height), keeping
the composition-locked faces (eye line y 340–400) in frame at tile size.

## Holo finishes & per-finish shaders

Holo is **per-copy, not per-card** (2026-07-04): a finish is Axis C of the
`CardVariant` a booster slot rolls (`src/meta/variants.ts`), stored on the
owned copy in `SaveData.collectionVariants`. A card rendered without a
variant gets **no holo** — a **solid per-tier metallic ring** (r silver, sr
champagne-gold, ssr violet, ur crimson; c ringless) + the gem still mark
rarity (`RARITY_RING` in `src/ui/CardView.ts`). What each
finish *renders* lives in `src/ui/fx/HoloEffects.ts` (`applyHolo`) and the
shader in `src/ui/fx/IridescencePostFX.ts` (one pipeline, four `mode`s):

| Finish        | Behavior                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `none`        | Nothing (the plain-variant majority).                                                            |
| `shiny`       | A cheap Phaser `preFX.addShine` diagonal sweep (WebGL); a drifting sheen `tileSprite` on canvas/lite. |
| `rainbow`     | Shader **mode 2** — **pointer-reactive** prismatic foil bands over value-noise patches; prism `tileSprite` fallback. |
| `pearlescent` | Shader **mode 3** — pink/green oil-slick interference bands, pointer-reactive; pearl `tileSprite` fallback. |
| `fractal`     | A geometric crystal-facet `tileSprite` (all renderers) plus glints.                              |
| `void`        | A dark vignette over the art plus a continuous **inward** mote stream (all renderers; thinned by `particleScale` on lite). |

`rainbow`/`pearlescent`/`fractal` also get a sparse **sparkle particle**
layer (`fx-star`) over the art window. The border-ring shader is **mode 0**
(rainbow flowing along the baked white ring) — it belongs **exclusively** to
the **frame axis** (`rainbow` frame), applied to the ring in `CardView`, not to
the art. Rarity rings are always a plain solid tint (never this shader), so an
iridescent ring unambiguously means a rainbow-frame copy.

Pointer reactivity is fed by `CardView.setHoloPointer(worldX, worldY)`, which
maps a world position into `-1..1` card-relative coordinates and pushes it into
the foil shader (`HoloHandle.setPointer`).

## WebGL vs canvas fallbacks

`src/ui/fx/FXSupport.ts` exposes a single check, `fxAvailable(scene)` (true when
the renderer is WebGL). It is the one branch point for all FX:

- **WebGL:** shaders (`IridescencePostFX`), `preFX` shine, and post-pipelines are
  available.
- **Canvas:** `applyHolo` silently degrades — every finish swaps its shader
  for a baked `tileSprite` overlay (`fx-sheen`/`fx-prism`/`fx-pearl`) — so no
  scene code ever branches on the renderer itself. `fractal`/`void` use
  tileSprite/particle paths on every renderer.

`BootScene` registers the `IridescencePostFX` pipeline only under WebGL.

## Extending

- **New tribe emblem:** add an SVG path to `TRIBE_EMBLEMS` (`TribeEmblems.ts`,
  designed in a 100×100 box centered at 50,50) and route the subtype in
  `emblemFor`.
- **New holo finish:** add it to `HoloFinish` (`src/meta/variants.ts`), give
  it a weight in `DROPS.holo` (`src/config/rules.ts` — the table must keep
  summing to 100), a render branch in `applyHolo` (with a canvas/lite
  fallback), and (if it's a shader) a new `mode` in the `IridescencePostFX`
  fragment shader.
