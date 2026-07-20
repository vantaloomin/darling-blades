<!-- source-of-truth: src/data/cards/lands.ts, src/data/cards/duals.ts, src/data/cards/gothic-monsters.ts, src/ui/CardView.ts · last-verified: 2026-07-17 -->

# Land Art — Direction + Generation Contract

The 22 **land cards** — 5 basic lands, 10 dual taplands, and the 7 Gothic
Monsters set lands (section 4) — get their own art program here. The 215-entry creature art bible (`docs/art-bible/index.md`)
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

---

## 3. Proposed expansion land variants (not yet wired)

**Status: PROPOSAL ONLY — none of these are wired into the game.** The game
supports exactly one art file per land id, so these themed basic-land variants
(base / ragnarok / celtic-fae, 2 per land per set) were generated ahead of a
wiring decision and live **only in the art vault**
(`WaifuTCG-Art-Pilots/raws/lands-variants/`, deliverables named
`<land-id>-<set>-v<N>.png`) — **never** in `public/assets/`. The entries below
are kept inside a fenced block deliberately: `scripts/gen-land-art.ts` skips
fenced code blocks when parsing, so these can never masquerade as live land
entries and be generated into the shipping art directory by a routine run.
They follow the same environment-first contract as section 1 and were produced
at 1024×1536 → smartcrop **environment** mode → 640×800.

```markdown
### Plains (base) — `land-plains-base-v1`
- **Prompt:** Rolling golden meadowlands under a bright morning sky, wildflower-dotted grass bending in a soft wind, a chalk-white road winding toward a distant walled keep, warm ivory-and-gold light in the W palette (`#f2e8cf`, `#c9a84c`, `#fffef2`), the sweeping meadows centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Plains (base) — `land-plains-base-v2`
- **Prompt:** Harvest-gold pastureland at dawn, round haystacks and a lone windmill on a low rise, mist lifting off hedgerowed fields, warm ivory-and-gold W palette (`#f2e8cf`, `#c9a84c`, `#fffef2`), the golden fields centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Plains (ragnarok) — `land-plains-ragnarok-v1`
- **Prompt:** A wind-silvered Norse coastal plain over old grassy barrow mounds, a long turf-roofed hall with blank banners far off under a pale gold northern sky, cold sunlight in the W palette (`#f2e8cf`, `#c9a84c`, `#fffef2`), the barrow plain centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Plains (ragnarok) — `land-plains-ragnarok-v2`
- **Prompt:** The plain of Idavoll at first light after a storm, bright gold meadow braided with glacier-fed streams, distant blank runestones on the horizon and a fading green aurora above dawn, W palette (`#f2e8cf`, `#c9a84c`, `#fffef2`) with a glacier-blue accent, the shining plain centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Plains (celtic-fae) — `land-plains-celtic-fae-v1`
- **Prompt:** Dawn over a fae meadow, dew-bright pale-gold grass around a ring of small white standing stones, drifting hawthorn petals and a hollow hill soft in the mist beyond, pearl-and-gold W palette (`#f2e8cf`, `#c9a84c`, `#fffef2`) with silver mist, the stone-ring meadow centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Plains (celtic-fae) — `land-plains-celtic-fae-v2`
- **Prompt:** A sunlit fae orchard-meadow, pale gold light slanting through hawthorn trees in white bloom, a wide mushroom ring in the open grass and torc-gold light along the horizon, W palette (`#f2e8cf`, `#c9a84c`, `#fffef2`), the blossoming meadow centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Island (base) — `land-island-base-v1`
- **Prompt:** A vast calm lake scattered with small rocky isles under a bright blue sky, sunlight glittering on open water and one tiny white sail far off, deep blue U palette (`#4a90d9`, `#16294f`, `#a8d4f7`), the island-dotted water centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Island (base) — `land-island-base-v2`
- **Prompt:** Sea cliffs sheltering a turquoise cove, tide pools mirroring the sky between wet rocks, gulls reduced to distant specks, azure U palette (`#4a90d9`, `#16294f`, `#a8d4f7`), the cove and its bright water centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Island (ragnarok) — `land-island-ragnarok-v1`
- **Prompt:** A deep Norse fjord between snow-dusted cliffs, still glacier-blue water mirroring a green-violet aurora, one tiny longship silhouette far down the channel, glacial U palette (`#4a90d9`, `#16294f`, `#a8d4f7`), the mirrored fjord centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Island (ragnarok) — `land-island-ragnarok-v2`
- **Prompt:** An iceberg-strewn northern sea under a pale midnight sun, long whale-road swells and a glacier front calving in the far distance, cold blue U palette (`#4a90d9`, `#16294f`, `#a8d4f7`), the ice-scattered sea centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Island (celtic-fae) — `land-island-celtic-fae-v1`
- **Prompt:** A glassy moonlit lough with a single reed-ringed isle, silver mist low over black-blue water and one warm hollow-hill light reflected across it, moonlit U palette (`#4a90d9`, `#16294f`, `#a8d4f7`), the mirrored lough and isle centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Island (celtic-fae) — `land-island-celtic-fae-v2`
- **Prompt:** A wet tidal causeway leading out to a mist-veiled otherworld isle at moonrise, rippled sand mirroring the pale blue sky, seal-shaped rocks dark along the waterline, silvery U palette (`#4a90d9`, `#16294f`, `#a8d4f7`), the causeway and isle centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Swamp (base) — `land-swamp-base-v1`
- **Prompt:** A black-water marsh at dusk, drowned skeletal trees rising from still pools, faint will-o'-wisp lights drifting through violet fog, purple-black B palette (`#5a3a70`, `#140d1c`, `#9b6fc4`), the haunted marsh centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Swamp (base) — `land-swamp-base-v2`
- **Prompt:** A sunken graveyard fen, leaning weathered stones (entirely blank) half-swallowed by black pools, pale night-blooming flowers glowing along the waterline, violet-black B palette (`#5a3a70`, `#140d1c`, `#9b6fc4`), the drowned stones centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Swamp (ragnarok) — `land-swamp-ragnarok-v1`
- **Prompt:** The poison-fens below Niflheim, steaming black bog water between rime-crusted roots, a great serpent-spine ridge of dark stone half-lost in the mist, cold green-violet aurora glow above, B palette (`#5a3a70`, `#140d1c`, `#9b6fc4`), the steaming fen centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Swamp (ragnarok) — `land-swamp-ragnarok-v2`
- **Prompt:** A drowned battlefield bog at violet dusk, rusted blades and round shield-bosses swallowed by dark peat water, cold marsh-lights guttering between tussocks, B palette (`#5a3a70`, `#140d1c`, `#9b6fc4`), the relic-strewn bog centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Swamp (celtic-fae) — `land-swamp-celtic-fae-v1`
- **Prompt:** A moonlit blackthorn bog, glassy black pools between low stone cairns, lilac bog-glow rising off the water and raven feathers drifting on the surface, B palette (`#5a3a70`, `#140d1c`, `#9b6fc4`), the cairn-ringed bog centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Swamp (celtic-fae) — `land-swamp-celtic-fae-v2`
- **Prompt:** A haunted fae mire under a bruised violet moon, pale bog-cotton and ghostly asphodel glowing among black pools, faint mushroom-ring lights deep in the fog, B palette (`#5a3a70`, `#140d1c`, `#9b6fc4`), the glowing mire centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Mountain (base) — `land-mountain-base-v1`
- **Prompt:** Jagged volcanic crags at sunset, rivers of ember light glowing in the rock fissures beneath drifting ash haze, fierce red-ochre R palette (`#d95436`, `#5e0f0f`, `#f7b267`), the burning ridgeline centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Mountain (base) — `land-mountain-base-v2`
- **Prompt:** A red-rock canyon pass, a frayed rope bridge spanning a lava-lit gorge between sheer cliffs, heat shimmer rising from below, ember R palette (`#d95436`, `#5e0f0f`, `#f7b267`), the gorge and bridge centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Mountain (ragnarok) — `land-mountain-ragnarok-v1`
- **Prompt:** The borderlands of Muspelheim, black basalt peaks veined with running fire under a smoke-red sky, ember rain drifting across the pass, R palette (`#d95436`, `#5e0f0f`, `#f7b267`), the fire-veined peaks centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Mountain (ragnarok) — `land-mountain-ragnarok-v2`
- **Prompt:** A shattered mountain pass after the first tremor of Ragnarök, freshly split cliffs and tumbled scree, a bruised red storm sky torn by lightning beyond the ridge, R palette (`#d95436`, `#5e0f0f`, `#f7b267`), the broken pass centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Mountain (celtic-fae) — `land-mountain-celtic-fae-v1`
- **Prompt:** A red-heather highland tor at fiery sunset, scree slopes climbing to a jagged natural stone crown at the summit, foxfire sparks drifting on the wind, R palette (`#d95436`, `#5e0f0f`, `#f7b267`) over moor tones, the crowned tor centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Mountain (celtic-fae) — `land-mountain-celtic-fae-v2`
- **Prompt:** A fomorian coast of storm-red sea cliffs, giant basalt columns stepping into a violent surf, one burning beacon flame on the far headland, R palette (`#d95436`, `#5e0f0f`, `#f7b267`), the cliff wall centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Forest (base) — `land-forest-base-v1`
- **Prompt:** Ancient deep forest, colossal moss-covered trunks under shafts of green-gold light, ferns and roots tangling the shaded floor, rich G palette (`#4fa06a`, `#123a22`, `#a9dcae`), the towering trees centered in frame, wild and unpeopled — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Forest (base) — `land-forest-base-v2`
- **Prompt:** A fern-choked river glen beneath old-growth canopy, a small waterfall sliding into a green-shaded pool, moss glowing where the light lands, deep G palette (`#4fa06a`, `#123a22`, `#a9dcae`), the glen and falls centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Forest (ragnarok) — `land-forest-ragnarok-v1`
- **Prompt:** The iron-wood Járnviðr in deep winter, dark snow-laden pines in ranks, fresh wolf tracks crossing the drifts and a cold green-violet aurora between the trunks, wintry G palette (`#4fa06a`, `#123a22`, `#a9dcae`), the dark pinewood centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Forest (ragnarok) — `land-forest-ragnarok-v2`
- **Prompt:** A colossal root of the world-tree rising through a sunlit spruce forest, its bark ancient and blank, golden motes drifting in the green light along its curve, G palette (`#4fa06a`, `#123a22`, `#a9dcae`) with runic-gold accents, the great root centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Forest (celtic-fae) — `land-forest-celtic-fae-v1`
- **Prompt:** A moonlit fae greenwood, a glowing mushroom ring in a mossy clearing between ancient oaks, silver mist threading the undergrowth, G palette (`#4fa06a`, `#123a22`, `#a9dcae`) under cold moonlight, the luminous ring centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Forest (celtic-fae) — `land-forest-celtic-fae-v2`
- **Prompt:** A blackthorn-and-oak hollow way, arched branches forming a long tunnel toward the soft green light of a hollow hill door, wet leaves catching moonlight, G palette (`#4fa06a`, `#123a22`, `#a9dcae`), the branch tunnel centered in frame, no people — crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait
```

---

## 4. Gothic Monsters set lands (7) — LIVE entries

The Gothic Monsters expansion's 7 set lands (`src/data/cards/gothic-monsters.ts`):
5 mono-color taplands and 2 dual taplands. Same environment-first contract as
section 1, in the set's candlelit horror-glamour identity — moonlit stone,
candle-warm windows against storm cold, iron gates, grave roses, stormglass,
white lightning — luxurious, never grimy. These are parsed by
`scripts/gen-land-art.ts` exactly like section 2 (unlike the fenced section-3
proposals). Per the player-copy style rule these Prompt lines use commas before
the standard suffix instead of a dash.

### Chapel Yard — `gm-chapel-yard`
- **Flavor:** "The graves are tidy and the roses have opinions." Single color: **W**.
- **Prompt:** A tidy chapel graveyard at candlelit dusk, white chapel walls and neat rows of blank gravestones among climbing grave roses, warm lantern-light pooling on a swept stone path against a cold violet evening sky, gothic W palette (`#f2e8cf`, `#c9a84c`, `#fffef2`), the chapel and its yard centered in frame, no people, crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Lab Annex — `gm-lab-annex`
- **Flavor:** "The main lab exploded, so this one is the responsible branch." Single color: **U**.
- **Prompt:** A stone laboratory annex under a night storm, tall leaded windows glowing cold blue with stormglass apparatus arcing inside, a lightning rod on the slate roof catching a distant white bolt, rain-slick cobbles and copper pipes along the wall, U palette (`#4a90d9`, `#16294f`, `#a8d4f7`) with a white-lightning accent, the glowing annex centered in frame, no people, crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Moor Path — `gm-moor-path`
- **Flavor:** "The path is damp, dark, and technically a shortcut." Single color: **B**.
- **Prompt:** A damp moor path at night, a narrow flagstone track winding between black pools and leaning blank waymarker stones under a bruised violet sky, cold marsh-lights guttering low in the fog and one far-off candle-warm manor window, B palette (`#5a3a70`, `#140d1c`, `#9b6fc4`), the winding path centered in frame, no people, crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Red-Roof Village — `gm-red-roof-village`
- **Flavor:** "The roofs are red from paint, weather, and one regrettable festival." Single color: **R**.
- **Prompt:** A gothic village of steep red rooftops at dusk, crooked chimneys and warm lantern-lit windows stacked down a hillside lane below a dark castle ridge, ember light glowing against a rolling storm sky, R palette (`#d95436`, `#5e0f0f`, `#f7b267`), the red rooftops centered in frame, no people, crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Thorned Cemetery — `gm-thorned-cemetery`
- **Flavor:** "The vines keep visitors from leaving with the wrong memories." Single color: **G**.
- **Prompt:** An overgrown cemetery swallowed by briars, glowing green vines and dark crimson grave roses winding over blank tilted headstones, moonlight filtering through a broken iron fence onto moss-deep ground, G palette (`#4fa06a`, `#123a22`, `#a9dcae`), the thorn-wrapped graves centered in frame, no people, crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Stormtower Roof — `gm-stormtower-roof`
- **Flavor:** "The roof catches storms, secrets, and the occasional ambitious gargoyle." Colors: **U/B**.
- **Prompt:** The flat rooftop of a storm tower at the height of a night storm, iron conductors and stormglass domes crackling with white lightning above a stone parapet lined with gargoyle silhouettes, churning clouds and moonlit rain beyond, blending the azure U palette (`#4a90d9`, `#a8d4f7`) with the purple-black B palette (`#5a3a70`, `#140d1c`), the crackling rooftop centered in frame, no people, crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait

### Moonmoor Estate — `gm-moonmoor-estate`
- **Flavor:** "The moor has room for one more estate and no more sensible heirs." Colors: **R/G**.
- **Prompt:** A grand moorland estate under a huge low moon, wind-bent green moor grass rolling up to open iron gates and a firelit manor front, a lone wolf silhouetted small on a distant ridge, blending the ember-red R palette (`#d95436`, `#f7b267`) with the verdant G palette (`#4fa06a`, `#123a22`), the moonlit estate centered in frame, no people, crisp cel-shaded gacha anime landscape art, fully rendered scenic terrain, 640×800 portrait
