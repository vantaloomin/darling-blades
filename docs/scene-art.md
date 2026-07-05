<!-- source-of-truth: src/scenes/MainMenuScene.ts, src/scenes/DuelScene.ts, src/scenes/GauntletScene.ts, src/scenes/ShopScene.ts, src/scenes/PackOpeningScene.ts, src/scenes/CollectionScene.ts, src/scenes/DeckBuilderScene.ts, src/scenes/CardShowcaseScene.ts, src/scenes/PreloadScene.ts, src/ui/CardView.ts, src/ui/CardFrameFactory.ts, docs/art-bible/index.md, scripts/gen-scene-art.ts · last-verified: 2026-07-05 -->

# Scene & Menu Art — Direction + Integration Contract

Every non-card visual asset the final game needs: stage backdrops for the eight
Phaser scenes, the card back, and the booster-pack front. This document is the
**binding contract** for authoring them, the parse source for the generation
driver (`scripts/gen-scene-art.ts` reads the entries below the same way
`scripts/gen-card-art.ts` reads the art bible), and the specification a later
integration task implements. Card illustrations are governed by
`docs/art-bible/index.md`; this doc governs everything else.

---

## 1. Global rules (binding)

These apply to **every** entry in section 2. Entries do not restate them and
never contradict them.

- **Same cel-gacha idiom, environment-first.** These are the painted anime
  key-visual environments the card characters live in (the background language
  of `docs/art-bible/index.md` §2) promoted to full frames — clean inked
  environmental linework, hard-edged cel/painted-key-visual rendering, subtle
  depth haze. NOT photoreal, NOT 3D render, NOT rough sketch.
- **These are STAGES, not character splashes.** Deliberately desaturated and
  atmospheric: **characters and cards own saturation, backdrops own mood.**
  Nothing in a backdrop may out-saturate a common card's art or the gold UI
  accents (`#ffd88a`, `#c9a84c`) that render over it. Keep chroma low and
  values deep; the palette anchor is the game's indigo-violet family
  (`#171222`, `#131022`, `#120e20` down to `#0b0812`, `#080610`, `#0d0a14`).
- **NO characters** — or at most distant, unreadable silhouettes where an
  entry explicitly allows them. A backdrop must never compete with card art.
  No faces, no figures, no portrait framing, ever.
- **NO-TEXT hard rule.** No text of any kind anywhere in the image — no words,
  letters, numbers, nameplates, captions, titles, logos, watermarks,
  signatures, calligraphy panels, or CJK glyphs. Banners, seals, and sashes
  render blank or patterned, never lettered. (`scripts/gen-scene-art.ts` rides
  this rule on every prompt as both a positive cue and a negative block,
  exactly like the card driver.)
- **Deliverable: 1280×720 PNG** — the game's design resolution
  (`src/main.ts`, `Phaser.Scale.FIT`), rendered 1:1 with no bleed — **unless
  the entry's Deliverable field says otherwise** (`card-back` and `pack-art`
  are 640×800 portrait).
- **Darkness discipline.** Every backdrop renders UNDER the existing UI —
  lavender text (`#c9bde0`, `#f0e6ff`, `#8f83a8`) and dark plates
  (`#241d3a`, `#2c2344`) drawn directly on top. Each entry lists a
  **Max luminance** line (percent of full white, sRGB relative luminance):
  an average cap for the whole frame, a peak cap for its brightest feature,
  and a tighter cap inside the entry's UI safe zones. Exceed them and UI text
  stops reading; the integration dim (section 3) is a tuning pass, not a
  rescue.
- **Anti-focal composition.** Wide establishing framing; visual interest lives
  at the edges and in atmosphere, never as a strong focal object where UI
  sits. The entry's Composition & safe zones field names the exact regions
  that must stay quiet (low contrast, no high-frequency detail, no hot
  highlights).

---

## 2. Asset entries

Machine-parseable, one entry per asset: `### <Name> — `asset-key`` heading +
fixed fields. The **Prompt** field is one self-contained generation-ready line
ending with the standardized suffix for its class:

- Stage backdrops: `— crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop`
- Card back: `— crisp cel-shaded gacha anime ornamental card-back art, 640×800 portrait`
- Pack front: `— crisp cel-shaded gacha anime booster-pack key art, 640×800 portrait`

The **Deliverable** field carries the output dimensions (`<W>×<H>`) that
`gen-scene-art.ts` parses for its per-asset crop.

### Main Menu Key Visual — `scene-mainmenu`
- **Role:** Title screen stage under `MainMenuScene` (currently bare `#0d0a14` — the only scene with no gradient of its own).
- **Deliverable:** 1280×720 PNG (landscape stage).
- **Mood & palette:** The one showpiece backdrop: an Olympian-meets-Three-Kingdoms twilight vista. Deep indigo dusk (`#171222` → `#0b0812`) with a restrained ember-gold horizon (`#c9a84c` desaturated); faint marble cools left, warm lacquer darks right.
- **Composition & safe zones:** Low horizon (bottom ~fifth). Distant marble colonnades and a mountain sanctuary at the far LEFT edge; sweeping Chinese watchtower rooflines and blank war banners at the far RIGHT edge. The center is sky. Safe zones: the central menu column **x 460–820, y 90–710** (title y 140, subtitle y 205, menu items y 300–692, all centered on x 640) stays a calm, near-flat dark gradient band; top-right corner (gold counter) and bottom-left corner (volume control) stay quiet.
- **Max luminance:** average ≤ 18 %; peak ≤ 55 % (horizon glow only, below y ≈ 600); central column and corners ≤ 28 %.
- **Integration:** Image at (640,360), then dim rect `0x0d0a14` at 0.50 over the full frame (raised from the 0.35 starting point 2026-07-03 — the generated vista's horizon glow reaches the lower menu items); added first in `create()` so all text renders above.
- **QA:** Menu hover state (`#ffd700`) must not collide with any warm highlight behind the column; verify title serif at y 140 reads crisply.
- **Prompt:** Twilight fantasy vista where Olympus meets Three Kingdoms China, distant marble colonnades and a mountain sanctuary at the far left edge, sweeping dark watchtower rooflines with blank war banners at the far right edge, a broad calm band of deep indigo dusk sky filling the center, faint ember-gold glow on a low mist-covered horizon, desaturated and atmospheric with no focal object in the middle — crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop

### Duel Battlefield Stage — `scene-duel`
- **Role:** The battlefield under `DuelScene.buildZones()` — the opponent strip plate, the two inset zone plates (0.45–0.5 alpha fills), tiles, and 10px zone labels ALL render over it. Since the 1a "Immersive Fan" redesign (2026-07-04) the backdrop shows THROUGH around the inset plates — more of this art is visible than under the old full-width bands.
- **Deliverable:** 1280×720 PNG (landscape stage).
- **Mood & palette:** The most subdued asset in the program. Night war plain in near-monochrome indigo (`#131022` → `#0a0812`); mood, not scenery.
- **Composition & safe zones:** A vast dark field under low mist, viewed from above the battle lines; the faintest suggestions of distant campfires and torn blank banners at the extreme left/right edges only. NO landmark, no horizon feature, no texture busier than mist anywhere — the whole 1280×720 frame is effectively a safe zone (the strip, both zone plates, the phase rail, and the bottom stage cover or border every region, and the exposed margins must stay featureless).
- **Max luminance:** average ≤ 8 %; peak ≤ 22 % (edge campfire embers only); central 1160px play area ≤ 15 %.
- **Integration:** Replaces the base gradient fill at the top of `buildZones()`; every existing plate/hairline/label draws over it unchanged, plus a dim rect `0x0a0812` at 0.55 between backdrop and plates.
- **QA:** With plates over it, the 10px OPPONENT/YOU labels and land-stack badges must read at a glance; screenshot at hand-fan rest position — no backdrop feature may masquerade as a card edge.
- **Prompt:** Night war plain shrouded in low rolling mist seen from above the battle lines, a vast dark empty field in near-monochrome deep indigo, the faintest ember glints of distant campfires and torn blank banners at the extreme left and right edges, no landmarks, soft dim low-contrast atmosphere throughout — crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop

### Gauntlet Tower — `scene-gauntlet`
- **Role:** Backdrop under `GauntletScene` — right-rail ladder (x 820–1240, y 116–646), left portrait panel (x 166–434, y 132–490), and center text block (x 500–970, y 150–480) render over it.
- **Deliverable:** 1280×720 PNG (landscape stage).
- **Mood & palette:** Mysterious ascent. Slate-indigo night (`#171222` → `#0b0812`) with one cold teal-aurora accent high up, heavily desaturated.
- **Composition & safe zones:** A colossal pagoda-tower silhouette rising from bottom-center-left into aurora-lit clouds, faint floating stone rungs spiraling its flank — the climb reads even mostly occluded. Detail concentrates in the bottom third and extreme top; the middle band y 130–500 (where all three UI blocks sit) stays soft silhouette-on-haze.
- **Max luminance:** average ≤ 12 %; peak ≤ 35 % (aurora crown, above y ≈ 110); middle band ≤ 18 %.
- **Integration:** Replaces the `create()` gradient; dim rect `0x0b0812` at 0.5.
- **QA:** Rung-row stroke states (gold current / grey future) must remain the brightest edges in the rail region; tower silhouette must not create a false column behind the portrait frame.
- **Prompt:** Colossal night pagoda-tower rising from mist into aurora-lit clouds, faint floating stone rungs spiraling up its flank, cold moonlit haze, deep slate-indigo palette with one dim teal aurora glow at the very top of frame, silhouettes only through the middle of frame, dark mysterious low-contrast ascent — crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop

### Merchant Bazaar — `scene-shop`
- **Role:** Backdrop under `ShopScene` — floating pack at (640,360) 238×340, Buy button y 570, title y 70.
- **Deliverable:** 1280×720 PNG (landscape stage).
- **Mood & palette:** Lantern-lit merchant hall interior, warmth allowed but banked: ember lantern accents (`#c9a84c` family, desaturated) over the base indigo (`#171222` → `#0b0812`).
- **Composition & safe zones:** Wooden stalls stacked with scroll cases, card chests, and silk bundles receding into shadow at BOTH side edges; shelf lines converge toward an open, dark center aisle. Safe zone: the central well **x 480–800, y 150–620** (pack + price button) stays open shadow so the shining pack owns it; title band y 40–100 stays quiet.
- **Max luminance:** average ≤ 15 %; peak ≤ 45 % (lantern cores at the edges only); central well ≤ 22 %.
- **Integration:** Replaces the `create()` gradient; dim rect `0x0b0812` at 0.45.
- **QA:** The pack's `preFX` shine must remain the brightest moving element on screen; lantern glow may not bleed into the central well.
- **Prompt:** Dim fantasy merchant bazaar interior, lantern-lit wooden stalls stacked with scroll cases, card chests and silk bundles receding into shadow along both side edges, warm banked ember lantern glow kept desaturated, a dark open aisle filling the center of frame, moody low-contrast interior depth — crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop

### Pack Ritual Treasury — `scene-packopening`
- **Role:** Backdrop under `PackOpeningScene` — pack at (640,340), commons grid x 250–1010 / y 190–406, specials row y 560, buttons y 686. The rare-reveal spotlight dims it to 0.7 black at the ritual's peak.
- **Deliverable:** 1280×720 PNG (landscape stage).
- **Mood & palette:** Dim treasury/altar chamber (`#120e20` → `#080610`), near-black violet with sunken gold glints.
- **Composition & safe zones:** A low stone altar dais at bottom-center under a faint shaft of dusty light from above; heaps of coins and relics sunk in deep shadow along the walls; ember-dark braziers. The dais light shaft is vertical and soft, centered near x 640 — it flatters the floating pack without outshining it. Everything above y ≈ 150 fades to black (commons grid + reveal beats live there).
- **Max luminance:** average ≤ 10 %; peak ≤ 30 % (the light shaft core); above y 150 ≤ 12 %.
- **Integration:** Replaces the `create()` gradient; dim rect `0x080610` at 0.5. The existing flash/starburst/slow-mo choreography needs no change.
- **QA:** NEW/dupe badges (13px on `#1c1730`) must read against the backdrop at every grid position; the shaft must not tint revealed card frames.
- **Prompt:** Dim underground treasury altar chamber, a low stone dais at bottom center under a faint vertical shaft of dusty light, heaps of coins and relics sunk in deep shadow along the walls, ember-dark braziers, near-black violet darkness swallowing the upper half of frame, hushed ceremonial gloom — crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop

### Collection Archive — `scene-collection`
- **Role:** Backdrop under `CollectionScene` — 6×3 thumb grid x 220–1020 / y 210–640, filter chips y 88, pagers at x 80 / x 1200.
- **Deliverable:** 1280×720 PNG (landscape stage).
- **Mood & palette:** Extremely subdued archive/gallery hall. Cool near-black (`#171222` → `#0b0812`), the flattest asset after `scene-duel`.
- **Composition & safe zones:** Tall shadowed shelves and glass display cases receding into darkness at the far left/right edges (outside x 200 / beyond x 1080); a broad flat dark wall behind everything else. NO framed rectangles anywhere — framed shapes read as ghost UI behind a card grid. Center field x 150–1130 stays near-flat.
- **Max luminance:** average ≤ 8 %; peak ≤ 20 % (case-glass glints at the edges); grid region ≤ 12 %.
- **Integration:** Replaces the `create()` gradient; dim rect `0x0b0812` at 0.7 (raised from the 0.6 starting point 2026-07-03 — both generation rolls painted small lantern hotspots at the grid's corner columns; 0.7 keeps the grid region under its effective cap).
- **QA:** Unowned thumbs render at 0.32 alpha — they must still separate from the backdrop; no backdrop edge may align with grid gutters.
- **Prompt:** Extremely subdued archive hall interior, tall shadowed shelves and glass display cases receding into darkness at the far left and right edges, a broad flat near-black wall filling the center, faint cool lamplight pooling low, minimal detail, very low contrast, no rectangular frames — crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop

### War-Room Strategy Table — `scene-deckbuilder`
- **Role:** Backdrop under `DeckBuilderScene` — pool grid on the left, and the right 400px is covered by the existing deck panel (`0x1c1730` at 0.85).
- **Deliverable:** 1280×720 PNG (landscape stage).
- **Mood & palette:** Dim war-room interior, muted slate-violet (`#171222` → `#0b0812`) with lacquered-wood darks.
- **Composition & safe zones:** A great strategy table edge with an UNMARKED campaign map (blank vellum — the no-text rule bites hardest here), brush stands and a shaded lantern in the lower foreground; blank faction banners hanging in shadow behind. Upper half fades to black. Left/center x 40–880 (pool grid + pager glyphs) stays quiet; the right 400px may carry slightly more detail since the panel covers it.
- **Max luminance:** average ≤ 10 %; peak ≤ 25 % (lantern shade rim); pool-grid region ≤ 15 %.
- **Integration:** Replaces the `create()` gradient (drawn before the right-panel fill); dim rect `0x0b0812` at 0.55.
- **QA:** The blank map MUST be blank — no glyph-like markings; 12px status text (bottom-right, `#f0b0a0`) reads against the panel, not the art, but verify anyway at panel alpha 0.85.
- **Prompt:** Dim candlelit war-room interior, the edge of a great strategy table with a blank unmarked vellum campaign map, brush stands and a shaded lantern in the lower foreground, blank faction banners hanging in shadow behind, muted slate-violet palette, upper half of frame fading to black, quiet contemplative gloom — crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop

### Showcase Void — `scene-showcase`
- **Role:** Backdrop under `CardShowcaseScene` — three FX cards at x 256 / 538 / 922, y ≈ 370, title y 48.
- **Deliverable:** 1280×720 PNG (landscape stage).
- **Mood & palette:** Abstract pedestal/spotlight void, deep indigo-black (`#171222` → `#0b0812`) — a jewelry-case nothing that makes holo FX the show.
- **Composition & safe zones:** A dark polished floor plane catching a faint cool reflection across the bottom quarter; one soft god-ray falling from high center into empty space; drifting dust motes; no architecture, no pedestals (card positions may change — the void must not anchor them). Center band y 150–620 stays quiet so all three cards and their labels pop.
- **Max luminance:** average ≤ 8 %; peak ≤ 30 % (god-ray core); center band outside the ray ≤ 12 %.
- **Integration:** Replaces the `create()` gradient; dim rect `0x0b0812` at 0.4.
- **QA:** Galaxy-foil SCREEN blending lightens darks — the void behind the rare (x ≈ 922) must stay deep enough that the nebula reads on the card, not the wall; god-ray must not overlap any card slot.
- **Prompt:** Abstract dark exhibition void, a polished black floor plane catching a faint cool reflection across the bottom of frame, a single soft god-ray falling from high center into empty space, drifting dust motes, deep indigo-black gradient walls with no architecture and no objects, pristine museum stillness — crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop

### Boot Loading Backdrop — `scene-preload`
- **Role:** *Optional — added by this program's judgment as missing for "final"; integration may ship without it.* Behind `PreloadScene`'s "Unsheathing Blades… N%" label at (640,360). Special load order: this file must be queued by `BootScene` (the manifest JSON is a build-time import, so Boot can check it) since Preload's own queue is what it decorates.
- **Deliverable:** 1280×720 PNG (landscape stage).
- **Mood & palette:** The quietest asset: near-black void (`#0d0a14` family) with the faintest indigo nebula haze.
- **Composition & safe zones:** A handful of dim stars toward the edges, an almost imperceptible horizon glow at the very bottom; the entire center is empty darkness (the label sits dead center).
- **Max luminance:** average ≤ 6 %; peak ≤ 15 %; center third ≤ 8 %.
- **Integration:** Image at (640,360) added before the label; no dim needed at these levels.
- **QA:** The 22px `#8f83a8` label must read at every progress tick; no star may sit within 200px of center.
- **Prompt:** Near-black cosmic void with the faintest indigo nebula haze, a sparse scattering of dim stars kept toward the frame edges, an almost imperceptible cool glow along the very bottom horizon, the entire center empty and dark, absolute quiet — crisp cel-shaded gacha anime environment art, 1280×720 stage backdrop

### Card Back — `card-back`
- **Role:** The face-down card design. Today `bakeCardFrames` (`src/ui/CardFrameFactory.ts`) paints a procedural 600×840 `cardback` canvas — dark violet radial field (`#3a2a55` → `#171024`) on `#141318`, gold border `#8a6d1f`, inner hairline, and a triple gold diamond sigil with a `#d4af37` core — which `CardView.back` displays at 300×420. **Face-down cards render via `CardView.setCard(null)`, used today only by `PackOpeningScene`** (commons dealt face-down + the specials row); `DuelScene` shows no face-down cards (opponent hand is a HUD count). Any future face-down context inherits this texture automatically.
- **Deliverable:** 640×800 PNG (portrait, 4:5 — same as card faces).
- **Mood & palette:** Continuity with the procedural back: deep violet field, radial glow, gold filigree (`#8a6d1f`/`#d4af37`), central diamond sigil motif. Richer than a stage (it IS a card object) but darker than any card face.
- **Composition & safe zones:** Ornamental and **fully symmetric on both axes**: central golden diamond sigil, concentric filigree frames, mirrored corner flourishes, subtle arcane line engraving. Integration cover-crops 640×800 → the 600×840 (5:7) texture, cutting **≈ 34 px off each side** — all border ornament and any element whose symmetry matters stays inside **x 34–606**; full height survives.
- **Max luminance:** average ≤ 20 %; peak ≤ 60 % (sigil core only) — it must sit visually *behind* face-up cards in the same shot.
- **Integration:** In `bakeCardFrames`, when the real texture is loaded, draw it cover-cropped into the 600×840 `cardback` canvas inside the existing rounded-rect clip (r 34) instead of the procedural painting; `CardView` needs no change. Falls back to the procedural back when absent.
- **QA:** Print-test symmetry (flip horizontal — must be identical within the x 34–606 zone); confirm it reads as "a card back" at 0.1 scale (the deal-in animation's start size); zero letterforms in the engraving.
- **Prompt:** Ornate symmetrical trading-card back design, deep violet field with a soft radial glow behind a central golden diamond sigil, concentric gold filigree frames and mirrored corner flourishes, subtle arcane line engraving, rich dark royal palette, perfect two-axis symmetry, blank of any lettering — crisp cel-shaded gacha anime ornamental card-back art, 640×800 portrait

### Booster Pack Front — `pack-art`
- **Role:** The booster pack shown floating in `ShopScene` and torn open in `PackOpeningScene`. Today `bakePackArt` (`src/scenes/ShopScene.ts`, shared) paints a procedural 280×400 canvas displayed at 238×340: violet gradient (`#3a2a63` → `#1c1433` → `#4a1c4a`), gold border `#c9a84c`, dark crimp bands top/bottom (26px each at texture scale), a foil shimmer band, a triple gold diamond sigil — **and baked wordmark text ("Darling Blades" / "BOOSTER PACK" / pack contents), which the real art must NOT reproduce** (NO-TEXT rule; code re-stamps any wordmark over the PNG at integration time).
- **Deliverable:** 640×800 PNG (portrait).
- **Mood & palette:** Product-hero continuity with the procedural pack: dark royal violet deepening toward top and bottom, gold trim, central radiant diamond sigil over a restrained violet-magenta nebula. This is the ONE asset allowed near card-art saturation — it's merchandise, not a stage.
- **Composition & safe zones:** Integration cover-crops 640×800 → 560×800 (7:10), cutting **≈ 40 px off each side** — keep all trim and the sigil inside **x 40–600**. Keep the top and bottom **~52 px bands plain** (crimp zones; code overlays the crimps) and leave the upper-middle region (y ≈ 120–200 at deliverable scale) calm enough for a code-stamped wordmark.
- **Max luminance:** average ≤ 25 %; peak ≤ 70 % (sigil core / foil glints).
- **Integration:** In `bakePackArt`, when the real texture is loaded, draw it cover-cropped into the 280×400 canvas inside the rounded clip (r 14), then re-stamp crimp bands and wordmark text over it; both consuming scenes pick it up automatically via the shared `packart` texture key.
- **QA:** Verify the pack still reads as a sealed product (not a card) at 238×340 with the shine FX; crimp/wordmark zones plain; zero baked letterforms.
- **Prompt:** Booster pack front key art, a radiant golden diamond sigil floating over a restrained swirling violet and magenta nebula, ornate gold trim frame, faint sparkling foil glints, dark royal-violet field deepening toward the plain top and bottom edges, dramatic sealed-product presentation with no lettering — crisp cel-shaded gacha anime booster-pack key art, 640×800 portrait

---

## 3. Integration contract

Integration is a **later task**; this section defines the contract it
implements. Nothing below exists in code yet except where noted.

### Files & manifest

- Assets land at **`public/assets/art/scenes/<asset-key>.png`** (the filename
  minus `.png` is the asset key from the section-2 heading). This is where
  `scripts/gen-scene-art.ts` writes.
- **Mechanism (proposed): extend `scripts/gen-art-manifest.ts`** to also scan
  the scenes folder and emit a `scenes` array alongside `cards` in
  `src/data/art-manifest.json` (additive — `ArtResolver` reads only `.cards`,
  so the change is backward-compatible). `PreloadScene` then queues
  `load.image('scene-<key>', 'assets/art/scenes/<key>.png')` for each listed
  key — the card-manifest discipline exactly: only manifest-listed files are
  ever requested, zero runtime 404s. Until integration lands, PNGs on disk
  are inert (nothing requests them).
- Texture-key convention: **`scene-<asset-key>`** for all entries, including
  `scene-card-back` and `scene-pack-art` (uniform loader; their consumers are
  the two bake functions, not scene backgrounds).

### Attach points, dim, and depth

Each Phaser scene checks `this.textures.exists('scene-<key>')` at the **top of
`create()`** (or the named bake/build function): if present, add the image at
(640, 360), draw the dim rect from the table over it, and skip or retain the
procedural fill as listed; if absent, current procedural rendering is the
unchanged fallback. Backdrops are added first, so display-list order keeps
them under everything — **no `setDepth` needed anywhere** (DuelScene's
explicit depths start at 40 for arrows/overlays, all above).

| Asset | Scene file · attach point | Replaces | Dim over the art |
|---|---|---|---|
| `scene-mainmenu` | `MainMenuScene.create()` | nothing (scene had no bg) | `0x0d0a14` @ 0.50 |
| `scene-duel` | `DuelScene.buildZones()` | base gradient only — strip + inset zone plates/labels stay | `0x0a0812` @ 0.55 |
| `scene-gauntlet` | `GauntletScene.create()` | gradient | `0x0b0812` @ 0.50 |
| `scene-shop` | `ShopScene.create()` | gradient | `0x0b0812` @ 0.45 |
| `scene-packopening` | `PackOpeningScene.create()` | gradient | `0x080610` @ 0.50 |
| `scene-collection` | `CollectionScene.create()` | gradient | `0x0b0812` @ 0.70 |
| `scene-deckbuilder` | `DeckBuilderScene.create()` | gradient (right-panel fill stays) | `0x0b0812` @ 0.55 |
| `scene-showcase` | `CardShowcaseScene.create()` | gradient | `0x0b0812` @ 0.40 |
| `scene-preload` | `BootScene` queues; `PreloadScene.preload()` displays | nothing | none |
| `card-back` | `CardFrameFactory.bakeCardFrames()` — `cardback` canvas | procedural back painting | n/a (cover-crop 640×800 → 600×840, rounded clip r 34) |
| `pack-art` | `ShopScene.bakePackArt()` — `packart` canvas | procedural pack painting | n/a (cover-crop 640×800 → 280×400, rounded clip r 14; crimps + wordmark re-stamped by code) |

Dim values are calibrated starting points, tuned per scene against the
section-2 Max-luminance lines during integration — raise the dim before ever
asking for a darker regeneration.

---

## 4. QA checklist (run per asset)

1. **No text** — full-resolution sweep, including banners, seals, sashes,
   spines, and map surfaces; engraving and filigree must contain zero
   letterforms or glyph-like marks (CJK included).
2. **Luminance** — histogram average and peak within the entry's
   Max-luminance caps; then screenshot the asset behind the live scene UI
   (dev server) and confirm every text element reads without squinting,
   including the dimmest (`#57506e` duel labels, `#8f83a8` captions).
3. **Style match** — cel/painted key-visual idiom per section 1; desaturated
   (except `pack-art`); no characters or faces (distant silhouettes only
   where the entry allows); no photoreal, 3D, or sketch drift.
4. **Safe zones** — the entry's named regions are quiet: no hot highlights,
   no high-frequency detail, no false UI shapes (frames, columns, panels)
   under real UI; for `card-back`/`pack-art`, all critical ornament inside
   the crop-safe zone and symmetric where required.
5. **Integration screenshot** — after the dim rect, the scene's cards/UI own
   the saturation in frame; if the backdrop competes, raise the dim first,
   regenerate second.
