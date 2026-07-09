<!-- source-of-truth: src/data/cards/lands.ts, src/data/cards/duals.ts, src/ui/CardView.ts · last-verified: 2026-07-09 -->

# Land Art — Direction + Generation Contract

The 15 **land cards** — 5 basic lands and 10 dual taplands — get their own art
program here. The 215-entry creature art bible (`docs/art-bible/index.md`)
covers creatures and tokens only; without the entries below, lands render the
deterministic procedural placeholder. This document is the **binding contract**
for authoring land art and the parse source for the generation driver
(`scripts/gen-land-art.ts` reads the entries the same way `scripts/gen-card-art.ts`
reads the art bible). Land art is **landscape, not character** — the sibling
approach to `docs/scene-art.md`'s environment-first stages, but delivered at the
card face's own 640×800 crop so the manifest + `ArtResolver` pick them up
automatically.

---

## 1. Global rules (binding)

These apply to **every** entry in section 2. Entries do not restate them and
never contradict them.

- **Cel-gacha anime ENVIRONMENT idiom.** Same house style as the cards
  (`docs/art-bible/index.md` §2) but promoted to a full scenic frame: hard-edged
  cel shading in two to three tone steps, clean confident inked *environmental*
  linework with line-weight variation, saturated but atmospheric color, bright
  anime specular highlights on water/stone/foliage. These are **terrain, not
  character splashes** — a painted anime key-visual landscape, fully rendered,
  with real depth and story. NOT painterly, NOT soft-focus, NOT 3D render, NOT
  photorealistic, NOT a rough sketch, NOT a flat color-wash or empty gradient.
- **NO character / NO people / NO faces.** A land is a place, never a person. No
  figure, no portrait framing, no face anywhere — **at most a tiny distant,
  unreadable silhouette** (a far junk on the river, a lone banner-bearer on a
  ridge) where an entry explicitly calls for one. Nothing that could read as a
  card character.
- **Iconic terrain in the central vertical band (load-bearing).** `CardView`
  (`src/ui/CardView.ts`, `ART_RECT = { x:-132, y:-164, w:264, h:192 }`)
  cover-crops the 640×800 source into a **264×192** window, showing only the
  **middle 58.2 % vertical band: y ≈ 167 → 633** (`docs/art-bible/index.md` §3 —
  same crop math). Compose the land's **defining terrain element** (the river,
  the peak, the burning hall, the blossom orchard) so its readable subject sits
  inside that band, horizon roughly centered. The full 640 width is visible;
  keep any critical silhouette ≥ 32 px off the left/right edges. Paint the top
  and bottom bleed coherently (sky above, foreground below) but tell no story
  there — it is cropped away in the card window.
- **Keyed to the mana-color palette.** Every land leans on the palette(s) of the
  color(s) it taps for, from `docs/art-bible/index.md` §4 / the `PALETTES`
  table:

  | Color | Top | Bottom | Accent |
  |---|---|---|---|
  | **W** (white) | `#f2e8cf` | `#c9a84c` | `#fffef2` |
  | **U** (blue)  | `#4a90d9` | `#16294f` | `#a8d4f7` |
  | **B** (black) | `#5a3a70` | `#140d1c` | `#9b6fc4` |
  | **R** (red)   | `#d95436` | `#5e0f0f` | `#f7b267` |
  | **G** (green) | `#4fa06a` | `#123a22` | `#a9dcae` |

  A **basic** land uses its single color's palette as the whole scene's tonal
  anchor (dominant mid, deep shadow, highlight/accent). A **dual tapland**
  blends **both** colors' terrain and palette — e.g. W/U marble-and-river, B/R
  smoke-and-ember — so the two colors read at a glance without either owning the
  frame.
- **NO-TEXT hard rule.** No text of any kind anywhere in the image — no words,
  letters, numbers, nameplates, captions, titles, banners with lettering, logos,
  watermarks, signatures, calligraphy panels, or CJK glyphs. Banners, seals,
  sails, and sashes render **blank or patterned, never lettered**. (Wolfpack
  Highlands' flavor jokes that "the howling is a land acknowledgment" — the
  acknowledgment is the howl, not any sign: render **NO text**.)
  `scripts/gen-land-art.ts` rides this rule on every prompt as both a positive
  cue and a negative block, exactly like the card and scene drivers.
- **Deliverable: 640×800 PNG** (portrait, 4:5 — same dir/dims as the creature
  card faces, `public/assets/art/cards/<land-id>.png`), so the manifest and
  `ArtResolver` pick it up with no code changes.

---

## 2. Land entries

Machine-parseable, one entry per land: `### <Name> — `land-id`` heading + a
one-line **Prompt** field. The Prompt is one self-contained generation-ready
line ending with the standardized suffix
`— crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait`.
Basics come first in `src/data/cards/lands.ts` order, then duals in
`src/data/cards/duals.ts` order. The flavor text quoted in each entry is the
canon anchor.

### Plains — `land-plains`
- **Flavor:** "Dawn over the imperial fields." Single color: **W**.
- **Prompt:** Sunlit imperial farmland at dawn, rolling golden savanna and terraced grain fields stretching to a low misty horizon, a distant imperial watchtower and tiny blank banners far off, warm ivory-and-gold light in the W palette (`#f2e8cf`, `#c9a84c`, `#fffef2`), the sweeping fields centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Island — `land-island`
- **Flavor:** "The river remembers every fleet it carried." Single color: **U**.
- **Prompt:** A great slow river winding between mist-wrapped island isles, tiny distant sailing junks and a far fleet reduced to silhouettes on the water, reflective blue-and-azure surface catching pale sky, deep blue U palette (`#4a90d9`, `#16294f`, `#a8d4f7`), the broad river centered across the frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Swamp — `land-swamp`
- **Flavor:** "Asphodel blooms where nothing else dares." Single color: **B**.
- **Prompt:** A dark underworld fen choked with pale asphodel blossoms, black still water and skeletal drowned trees under a bruised violet sky, cold wisps of marsh-light drifting low, deep purple-black B palette (`#5a3a70`, `#140d1c`, `#9b6fc4`), the flowering marsh centered in frame, ominous and quiet, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Mountain — `land-mountain`
- **Flavor:** "Hulao Gate never fell — it was climbed." Single color: **R**.
- **Prompt:** Jagged red-lit mountain peaks flanking a narrow fortress-pass gate carved into the rock, a switchback climbing path scaling the cliff, ember haze and volcanic red glow behind the ridgeline, fierce red-and-ochre R palette (`#d95436`, `#5e0f0f`, `#f7b267`), the fortress-pass centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Forest — `land-forest`
- **Flavor:** "The wilds keep their own census." Single color: **G**.
- **Prompt:** Deep untamed old-growth woods, towering moss-hung trees and tangled undergrowth in shafts of green-filtered light, a hidden game trail vanishing into the canopy, rich green G palette (`#4fa06a`, `#123a22`, `#a9dcae`), the dense forest centered in frame, wild and unpeopled — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Misty Palace Terrace — `ld-misty-palace-terrace`
- **Flavor:** "Court intrigue with a river view." Colors: **W/U**.
- **Prompt:** A high marble palace terrace overlooking a broad misty river far below, white-and-gold balustrades and lacquered eaves catching soft dawn light, distant island isles fading into blue haze, blending the ivory-gold W palette (`#f2e8cf`, `#c9a84c`) with the azure U palette (`#4a90d9`, `#a8d4f7`), the terrace-and-river vista centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Shadowed Court — `ld-shadowed-court`
- **Flavor:** "Every throne casts one." Colors: **W/B**.
- **Prompt:** A grand imperial throne-hall interior half-swallowed by long shadow, pale marble columns and a gilded empty dais lit by one shaft of cold light while violet darkness pools around it, blending the ivory-gold W palette (`#f2e8cf`, `#fffef2`) with the purple-black B palette (`#5a3a70`, `#140d1c`), the shadowed throne centered in frame, hushed and empty, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Beacon Ridge — `ld-beacon-ridge`
- **Flavor:** "One fire for warning, two for glory." Colors: **W/R**.
- **Prompt:** A lonely signal-beacon fire-tower crowning a windswept mountain ridge, a bright warning flame streaming from its brazier against a dawn sky, pale stone battlements catching gold light, blending the ivory-gold W palette (`#f2e8cf`, `#c9a84c`) with the ember-red R palette (`#d95436`, `#f7b267`), the flaming beacon centered on the ridge in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Peach Garden Orchard — `ld-peach-garden-orchard`
- **Flavor:** "Oaths sworn here tend to outlive the swearers." Colors: **W/G**.
- **Prompt:** The Peach Garden in full blossom, rows of pink-flowering peach trees over soft green grass, drifting petals and a small stone oath-altar in a sunlit clearing, warm ivory light through the canopy, blending the ivory-gold W palette (`#f2e8cf`, `#fffef2`) with the verdant G palette (`#4fa06a`, `#a9dcae`), the blossoming orchard centered in frame, serene and unpeopled — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Moonlit Marsh — `ld-moonlit-marsh`
- **Flavor:** "The frogs know secrets. The frogs sell secrets." Colors: **U/B**.
- **Prompt:** A moonlit frog-marsh at night, still black water dotted with lily pads and reeds under a pale full moon, cold blue moonlight rippling across the wetland with violet shadows in the sedge, blending the azure U palette (`#4a90d9`, `#a8d4f7`) with the purple-black B palette (`#5a3a70`, `#140d1c`), the moonlit marsh centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Red Cliffs Anchorage — `ld-red-cliffs-anchorage`
- **Flavor:** "Excellent harbor. Historically flammable." Colors: **U/R**.
- **Prompt:** The Red Cliffs harbor at dusk, towering rust-red cliffs above a dark river anchorage with a moored fleet of tiny distant junk silhouettes, the water reflecting both cold blue evening and warm firelit red from the cliffs, blending the azure U palette (`#4a90d9`, `#16294f`) with the ember-red R palette (`#d95436`, `#f7b267`), the cliff harbor centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Foxglade Springs — `ld-foxglade-springs`
- **Flavor:** "The water shows nine reflections. Trust none." Colors: **U/G**.
- **Prompt:** A fox-haunted forest spring in a green glade, clear blue pools mirroring mossy trees and pale foxfire wisps drifting between the trunks, uncanny still reflections doubling the woods, blending the azure U palette (`#4a90d9`, `#a8d4f7`) with the verdant G palette (`#4fa06a`, `#a9dcae`), the reflective spring centered in frame, mysterious and unpeopled — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Burning Luoyang — `ld-burning-luoyang`
- **Flavor:** "The capital moved. The smoke stayed." Colors: **B/R**.
- **Prompt:** The capital Luoyang burning, ruined imperial palace halls and collapsed rooftops wreathed in fire and rolling black smoke over a night sky, ember sparks storming upward and orange glow beneath the smoke pall, blending the purple-black B palette (`#5a3a70`, `#140d1c`) with the ember-red R palette (`#d95436`, `#f7b267`), the burning ruins centered in frame, desolate and unpeopled — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Asphodel Meadow — `ld-asphodel-meadow`
- **Flavor:** "Half the flowers bloom down. It’s a commute thing." Colors: **B/G**.
- **Prompt:** A vast Greek underworld meadow of pale asphodel, half the ghostly flowers blooming upward and half hanging inverted toward the earth, a dim grey-green field under a starless violet sky with cold mist between the stems, blending the purple-black B palette (`#5a3a70`, `#9b6fc4`) with the muted G palette (`#4fa06a`, `#123a22`), the uncanny flowering meadow centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Wolfpack Highlands — `ld-wolfpack-highlands`
- **Flavor:** "The howling is a land acknowledgment." Colors: **R/G**.
- **Prompt:** Wild rugged highlands at dusk, wind-bent grass over rolling green-and-ochre moors with a jagged rocky tor, a lone wolf silhouetted small on a distant ridge mid-howl against a burning red-orange sky, blending the ember-red R palette (`#d95436`, `#f7b267`) with the verdant G palette (`#4fa06a`, `#123a22`), the wild moorland centered in frame, no lettering of any kind anywhere — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait
