<!-- source-of-truth: src/data/cards/instants.ts, src/data/cards/sorceries.ts, src/data/cards/enchantments.ts, src/data/cards/artifacts.ts, src/data/cards/ragnarok.ts, src/ui/CardView.ts · last-verified: 2026-07-09 -->

# Darling Blades Art Bible — Spells (Charms · Rituals · Enchantments · the Jade Seal)

This file is the **binding contract** for the art of the base set's **43 non-creature
spell cards** — the 18 charms, 14 rituals, 10 enchantments, and the single
non-creature artifact (`ar-imperial-jade-seal`) — plus the 9-card Ragnarök addendum
below, for 52 entries in all. The 215-entry creature art-bible
(`docs/art-bible/`) covers creatures, tokens, and the Construct creatures; it does
**not** cover these cards, which otherwise render procedural placeholders. Every rule
below is grounded in the source files named in the header comment. When this document
and the card data disagree, the card data wins.

`scripts/gen-spell-art.ts` parses the `### <Name> — \`<id>\`` heading and the
`- **Prompt:**` line of each entry below, assembles
`[SPELL/EFFECT PREAMBLE] + [entry Prompt] + [NEGATIVES]`, generates at 1024×1536, and
center cover-crops to the **640×800** deliverable at
`public/assets/art/cards/<id>.png` — the same directory and dimensions as every other
card, so the manifest and `ArtResolver` pick these up with no code change.

---

## 1. What a spell illustration IS (binding)

Spell cards are **not** portraits and **not** empty landscapes. A spell illustration
depicts the spell's **dramatic MOMENT or magical EFFECT** — the instant the magic
fires or the ongoing enchanted state it imposes — rendered as a cinematic
cel-gacha anime splash.

- **Charms & rituals — the effect firing.** The subject is the *effect*: a burst
  of flame, a bolt of death-energy, a resurrection clawing out of a grave, a scrying
  vision blooming over a teacup, a battle-charge, a sweeping gale. A figure
  (caster, victim, or soldier) may appear where the effect implies one, but the
  effect is the hero of the frame and owns the central band. The moment shown is the
  split second the mechanic resolves.
- **Enchantments — an ongoing magical state.** An aura, blessing, curse, or
  battlefield-wide banner: a warded calm, creeping decay, radiant flight, a war-aura.
  Aura enchantments (subtype `Aura`) may show a single affected figure wrapped in the
  effect; the battlefield banners (`Call of the Wilds`, `Banner of the Hegemon`,
  `Peach Garden Oath`, `Olympus Ascendant`) show the *symbol/standard/oath itself* as
  the hero element, never a stat-line character.
- **Artifact (Imperial Jade Seal) — an OBJECT hero-shot.** The Heirloom Seal of the
  Realm as a carved jade seal-object on a pedestal, imperial and numinous. No figure.

### Style DNA (shared with the creature bible)

Crisp cel-shaded gacha anime splash art: clean confident inked linework with
line-weight variation, hard-edged cel shading in two-to-three tone steps, bright anime
specular highlights, saturated readable color, atmospheric depth. The effect glows
and pops off a fully rendered scenic background rendered slightly softer than the
focal magic. Dynasty-Warriors key-art energy held inside MTG framing discipline.

---

## 2. Composition — the ART_RECT central band (load-bearing)

Verified against `src/ui/CardView.ts`:
`ART_RECT = { x: -132, y: -164, w: 264, h: 192 }`, cover-crop
`scale = max(264/srcW, 192/srcH)`. For a 4:5 (640×800) source the scale is
width-driven (264/640), the full width shows, and the vertical overflow is cropped
symmetrically — the card frame displays only the **middle 58.2 % vertical band:
y ≈ 167 → 633** of the 640×800 deliverable.

- **The spell's dramatic focal action MUST sit in the central vertical band**
  (≈ y 167–633; ideal focal center ≈ y 320–420). Everything above/below is bleed —
  paint it coherently (effects and energy may deliberately break the band, which
  reads as power, not error) but tell **no readable story** there.
- **Horizontal: the full 640 px width is visible.** Keep the identifying core of the
  effect at least **32 px** off the left/right edges.
- **Read at thumbnail.** Battlefield cards scale to ≈ 119×86 px. Commons must
  communicate their single idea at that size: one clear effect, two dominant values.
  Uncommons add one motion/story element; rares get a full dramatic "moment."

---

## 3. Per-color palette (the magic's palette)

Each spell is keyed to its card `colors` — the palette of its magic. Triples from
`PALETTES` in `src/art/PlaceholderArtGenerator.ts` (`[top, bottom, accent]`); treat
them as tonal anchors (dominant mid, deep shadow, highlight/accent), not gradients.

| Color | Top | Bottom | Accent | The magic reads as |
|---|---|---|---|---|
| **W** (white) | `#f2e8cf` | `#c9a84c` | `#fffef2` | holy gold-and-ivory light, order, dawn |
| **U** (blue) | `#4a90d9` | `#16294f` | `#a8d4f7` | cold arcane blue, water, mind, insight |
| **B** (black) | `#5a3a70` | `#140d1c` | `#9b6fc4` | violet-black death, decay, the grave |
| **R** (red) | `#d95436` | `#5e0f0f` | `#f7b267` | fire, ember, fury, molten heat |
| **G** (green) | `#4fa06a` | `#123a22` | `#a9dcae` | living green, growth, the wilds, beasts |
| **C** (colorless) | `#a9adb5` | `#4e535c` | `#dfe3ea` | stone, jade, numinous relic (the Seal) |

Faction accents (lapis+bronze Wei, jade+ivory Shu, marble+Aegean+gilt Greek, etc.)
layer over the color anchor where a card's flavor names a faction — but the
color-identity anchor always dominates.

---

## 4. NO-TEXT hard rule (high risk on spells — read verbatim)

**No text of any kind anywhere in the image — no words, letters, numbers,
nameplates, captions, titles, logos, watermarks, signatures, calligraphy panels, or
CJK glyphs. Banners, seals, war-standards, oath-scrolls, and sashes render BLANK or
abstract-patterned, never lettered — no nameplates, no CJK, no numbers.** Generation
backends habitually stamp gacha nameplates and garbled CJK title-text onto
Three-Kingdoms art, and the banner/seal/scroll motifs in this file (Banner of the
Hegemon, Imperial Jade Seal, Peach Garden Oath) invite it — so
`scripts/gen-spell-art.ts` rides this rule on **every** prompt as both a positive cue
in the preamble and an explicit negative block. Any figure present is an adult,
genre-appropriate, with no real-person likeness.

---

## 5. Prompt format

Each entry below is `### <Name> — \`<id>\`` followed by a single one-line
`- **Prompt:**` field. Every Prompt line is self-contained, names the effect and its
color-palette, states where the focal action sits, and ends with the standard suffix:

> `— crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait`

The script appends the shared preamble and negatives; do not restate them per entry.

---

## Charms

### Fire Attack — `in-fire-attack`
- **Prompt:** A fireship assault at night — a blazing war-vessel and a gout of orange flame surging across dark water toward the viewer, sparks and ember-smoke filling the frame, the wall of fire centered in the band, R fire palette of `#d95436` and `#5e0f0f` with `#f7b267` ember highlights — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Wild Surge — `in-wild-surge`
- **Prompt:** A sudden explosion of green growth-magic engulfing a warrior — a burst of glowing vines, leaves, and living light swelling a figure larger and stronger at frame center, verdant energy radiating outward, G growth palette `#4fa06a` and `#123a22` with `#a9dcae` glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Read the Ruse — `in-read-the-ruse`
- **Prompt:** A cancel spell shattering an enemy's magic — a smug blue-robed sorceress at frame center flicks her fingers as a rival's spell fractures into cracking arcane glass and dissolving sigils, cold blue cancel-energy centered, U mind palette `#4a90d9` and `#16294f` with `#a8d4f7` sparks — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Shieldwall Discipline — `in-shieldwall`
- **Prompt:** A locked shieldwall snapping into formation — interlocking shields and leveled spears wreathed in a golden ward of protective light at frame center, disciplined soldiers braced behind, holy W palette `#f2e8cf` and `#c9a84c` with `#fffef2` radiant glint — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Valley Mist — `in-valley-mist`
- **Prompt:** A concealing fog rolling low across an open battlefield — thick neutral silver-grey mist, the color of overcast cloud, sweeping over churned ground at frame center, the faint faded silhouettes of two armies clashing dimly deep in the hazy background, blurred plain tattered banners bearing no symbols or writing and leveled spears half-swallowed by the vapor, the mist itself grey-white and desaturated with only the faintest hint of `#a9dcae` green light glowing low where the fog is deepest — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Undertow — `in-undertow`
- **Prompt:** A magical riptide dragging a warrior back into the sea — a swirling blue vortex of water and current pulling a struggling figure off their feet at frame center, foam and spray spiraling, U water palette `#4a90d9` and `#16294f` with `#a8d4f7` highlights — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Blessed Respite — `in-blessed-respite`
- **Prompt:** A moment of healing calm — a wounded figure bathed in warm golden restorative light at frame center, gentle motes of holy radiance and a soft aura closing their wounds, tea steam and quiet, holy W palette `#f2e8cf` and `#c9a84c` with `#fffef2` glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Grave Chill — `in-grave-chill`
- **Prompt:** A wave of deathly cold sapping a creature's strength — creeping violet-black frost and skeletal underworld chill wrapping a weakening figure at frame center, its glow draining away, B death palette `#5a3a70` and `#140d1c` with `#9b6fc4` spectral rime — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Boar Rush — `in-boar-rush`
- **Prompt:** A goring charge — a spectral red war-boar of ember and fury trampling forward at the viewer, dust and shattered ground erupting, the charging silhouette centered and breaking the band, R fury palette `#d95436` and `#5e0f0f` with `#f7b267` ember trail — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Tidal Slip — `in-tidal-slip`
- **Prompt:** A sudden wave sweeping an enemy's footing out — a curling blue tide surging under a stumbling warrior at frame center while cool arcane water-light glimmers, foam and reflected knowledge, U water palette `#4a90d9` and `#16294f` with `#a8d4f7` crest highlights — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Doom Bolt — `in-doom-bolt`
- **Prompt:** A bolt of pure death-magic annihilating its target — a searing violet-black lance of necrotic energy striking a creature dead at frame center, the victim dissolving into ash and dark smoke as the bolt lands, B death palette `#5a3a70` and `#140d1c` with `#9b6fc4` deathly glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Char — `in-char`
- **Prompt:** A concentrated blast of scorching fire — a lance of white-hot flame incinerating its mark at frame center, the target seared and smoking, embers and heat-shimmer radiating, R fire palette `#d95436` and `#5e0f0f` with `#f7b267` searing core — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Stand as One — `in-stand-as-one`
- **Prompt:** A rallying surge of unity — a golden banner-light washing over a line of soldiers who stand shoulder to shoulder and glow with shared resolve at frame center, uplifted spears catching the radiance, holy W palette `#f2e8cf` and `#c9a84c` with `#fffef2` unifying glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Sudden Insight — `in-sudden-insight`
- **Prompt:** A flash of revelation — glowing blue arcane sigils, diagrams, and knowledge-light bursting outward from a strategist's mind at frame center, scattered scrolls lifting in the arcane wind, U mind palette `#4a90d9` and `#16294f` with `#a8d4f7` sparks — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Skysweeper Gale — `in-skysweeper-gale`
- **Prompt:** A green tempest scouring the sky — a howling gale of wind and torn leaves ripping flying creatures out of the air at frame center, dark bird-silhouettes tumbling in the wind-vortex, canopy thrashing below, G palette `#4fa06a` and `#123a22` with `#a9dcae` wind-streaks — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Comet Blast — `in-comet-blast`
- **Prompt:** A falling comet detonating on impact — a blazing meteor of red-orange fire streaking down and bursting in a radial shockwave of flame and light at frame center, sparks flung outward in rings, R fire palette `#d95436` and `#5e0f0f` with `#f7b267` fiery core, a centered glow source for the radial holo — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Reaper's Due — `in-reapers-due`
- **Prompt:** A reaper collecting a soul — a spectral hooded death-figure of violet-black shadow reaping a creature at frame center with a scythe of dark energy, a wisp of drawn life spiraling upward, B death palette `#5a3a70` and `#140d1c` with `#9b6fc4` soul-glow, smooth textured shadow for the sheen sweep — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Dream Fracture — `in-dream-fracture`
- **Prompt:** A dream shattering into stolen fragments — an opponent's glowing blue thought-form cracking apart into drifting shards of arcane glass at frame center while a thread of stolen idea coils toward the caster, cold oneiric light, U mind palette `#4a90d9` and `#16294f` with `#a8d4f7` prismatic shards for the foil holo — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

## Rituals

### Divination — `so-divination`
- **Prompt:** A scrying vision blooming over still water — a blue seer's reflecting pool at frame center flaring with luminous arcane visions and drifting omen-sigils, two ghostly future-images rising from the surface, U insight palette `#4a90d9` and `#16294f` with `#a8d4f7` vision-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Verdant Invitation — `so-rampant-growth`
- **Prompt:** A landscape erupting into sudden verdant life — new forest, vines, and glowing green land-energy bursting up out of bare earth at frame center, a fresh spring of living mana welling forth, G growth palette `#4fa06a` and `#123a22` with `#a9dcae` sprout-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Summon the Dead — `so-raise-dead`
- **Prompt:** A resurrection clawing up from a grave — a violet-black necromantic glow pouring into an open tomb at frame center as a skeletal armored hand thrusts up through the soil, grave-mist and spectral light swirling, B death palette `#5a3a70` and `#140d1c` with `#9b6fc4` raising glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Lava Axe — `so-lava-axe`
- **Prompt:** A hurled axe of molten lava — a great glowing fire-axe of liquid magma spinning through the air toward a distant fortress at frame center, trailing droplets of flame and smoke, R fire palette `#d95436` and `#5e0f0f` with `#f7b267` molten edge — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Muster the Militia — `so-muster-militia`
- **Prompt:** Peasants rallying into an armed militia — a golden call-to-arms light gathering farmers who take up spears and pitchforks at frame center, a surge of new recruits emerging from a village, holy W palette `#f2e8cf` and `#c9a84c` with `#fffef2` rallying glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Nurture — `so-nurture`
- **Prompt:** A creature strengthened by nurturing magic — warm green growth-energy and glowing counters flowing into a beast at frame center, vines and blossoms curling around it as it swells with vigor, G growth palette `#4fa06a` and `#123a22` with `#a9dcae` nurturing glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Night Extortion — `so-night-extortion`
- **Prompt:** A midnight coercion — a shadowy black-cloaked extortionist at frame center pulling a glowing secret from a victim's mind into her ledger of shadow, a stolen thought-wisp trailing violet light, B palette `#5a3a70` and `#140d1c` with `#9b6fc4` shadow-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Flame Lash — `so-flame-lash`
- **Prompt:** A whip of living fire cracking across a target — a coiling lash of orange flame snapping around a creature at frame center, ash and sparks scattering from the strike, R fire palette `#d95436` and `#5e0f0f` with `#f7b267` fiery lash — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Dirge of Loss — `so-dirge-of-loss`
- **Prompt:** A funeral dirge draining an enemy's hope — mournful violet-black sound-waves and grief-mist radiating from a shadowed singer at frame center, ghostly notes tearing memories loose from a huddled foe, B palette `#5a3a70` and `#140d1c` with `#9b6fc4` sorrow-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Parade of Heroes — `so-parade-of-heroes`
- **Prompt:** A triumphant procession of summoned soldiers — a column of gleaming militia marching forward beneath golden banner-light at frame center, spears aloft and a wave of new heroes streaming from the horizon, holy W palette `#f2e8cf` and `#c9a84c` with `#fffef2` parade glow (banners blank) — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Strategic Planning — `so-strategic-planning`
- **Prompt:** A war-table lit by insight — a strategist's map-table at frame center blazing with glowing blue arcane markers, drifting scrolls, and projected battle-plan light, cold knowledge radiating upward, U mind palette `#4a90d9` and `#16294f` with `#a8d4f7` plan-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Warcry — `so-warcry`
- **Prompt:** A battle-shout igniting an army — a shockwave of red war-fervor bursting from a roaring commander at frame center, soldiers around surging forward wreathed in ember-light and haste, R fury palette `#d95436` and `#5e0f0f` with `#f7b267` roar-shockwave — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Stampede Season — `so-stampede-season`
- **Prompt:** A stampede of the wilds surging as one — a thundering wall of green-glowing beasts charging forward at frame center under an emerald aura of trampling growth-energy, dust and torn earth flung skyward, G wild palette `#4fa06a` and `#123a22` with `#a9dcae` charge-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Judgment of Heaven — `so-judgment-of-heaven`
- **Prompt:** Divine punishment raining from the sky — vast golden pillars of holy judgment-light lancing down through parting storm-clouds to smite the battlefield at frame center, creatures caught and dissolving in the radiance, holy W palette `#f2e8cf` and `#c9a84c` with `#fffef2` blinding light, a bright celestial background for the galaxy holo — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

## Enchantments

### Vow of Peace — `en-vow-of-peace`
- **Prompt:** A warrior bound by a pacifying ward — a serene sphere of soft golden peace-light enclosing a lowered-weapon figure at frame center, a glowing seal of calm suppressing their aggression, holy W palette `#f2e8cf` and `#c9a84c` with `#fffef2` ward-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Wild Blessing — `en-wild-blessing`
- **Prompt:** A beast crowned by the forest's favor — a swirling green aura of leaves, blossoms, and living light haloing an empowered creature at frame center, the wilds visibly blessing it, G growth palette `#4fa06a` and `#123a22` with `#a9dcae` blessing-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Withering Curse — `en-withering-curse`
- **Prompt:** A creeping decay overtaking a creature — tendrils of violet-black rot and withering blight spreading across a slumping figure at frame center, its color and vitality draining into grey, B decay palette `#5a3a70` and `#140d1c` with `#9b6fc4` sickly glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Clouded Mind — `en-clouded-mind`
- **Prompt:** A mind lost to blue confusion — a haze of drifting arcane fog and spiraling dream-sigils clouding a bewildered figure's head at frame center, their focus dissolving into mist, U mind palette `#4a90d9` and `#16294f` with `#a8d4f7` fog-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Wings of Dawn — `en-wings-of-dawn`
- **Prompt:** A figure granted radiant flight — great luminous golden feathered wings of dawn-light unfurling from an ascending warrior at frame center, sunrise motes streaming off the pinions, holy W palette `#f2e8cf` and `#c9a84c` with `#fffef2` dawn radiance — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Battle Fervor — `en-battle-fervor`
- **Prompt:** A warrior consumed by battle-rage — a blazing red aura of ember and fury erupting around a charging figure at frame center, eyes and weapon glowing with hastened wrath, R fury palette `#d95436` and `#5e0f0f` with `#f7b267` fervor-flames — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Call of the Wilds — `en-call-of-the-wilds`
- **Prompt:** A great howl summoning the wild — a resonant green sound-wave of primal call rippling out over a moonlit forest at frame center, beast-eyes glinting awake in the trees and a spectral wolf-howl of light rising, G wild palette `#4fa06a` and `#123a22` with `#a9dcae` call-glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Banner of the Hegemon — `en-banner-of-the-hegemon`
- **Prompt:** A great Wei war-banner raised over the host — a towering dark standard of blank patterned cloth (absolutely no lettering) snapping in the wind at frame center above a shadowed army, lapis-and-bronze trim catching an ominous violet glow, B palette `#5a3a70` and `#140d1c` with `#9b6fc4` accent — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Peach Garden Oath — `en-peach-garden-oath`
- **Prompt:** Three sworn silhouettes clasping hands under peach blossoms — three warriors' clasped hands at frame center haloed in warm golden-green oath-light beneath a canopy of falling pink peach petals, a bond made visible, W/G palette blending `#f2e8cf` and `#4fa06a` with `#fffef2` oath-glow (no scrolls, no text) — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Olympus Ascendant — `en-olympus-ascendant`
- **Prompt:** The Olympian heavens blazing in ascendance — the marble-and-gilt peak of Olympus at frame center crowned in surging golden divine light, storm-glory and radiant clouds parting around the summit throne, holy W palette `#f2e8cf` and `#c9a84c` with `#fffef2` celestial gold, textured gilt marble for the foil holo — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

## Artifact

### Imperial Jade Seal — `ar-imperial-jade-seal`
- **Prompt:** The Heirloom Seal of the Realm — a carved translucent green jade imperial seal resting on an ornate pedestal at frame center, its top a coiled dragon-relief (abstract carving only, no glyphs on the face), lit by a numinous inner glow with drifting motes of imperial light, C jade palette `#a9adb5` and `#4e535c` with `#dfe3ea` highlight over deep jade green, an OBJECT hero-shot, no figure — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

---

## Ragnarök expansion (9)

The 1st expansion's non-creature cards — 4 spells (`rg-`) and the 5-rune Aura cycle.
Effect-first like the rest of this file; the runes are carved standing-stones (their
glyphs abstract, never lettered — the NO-TEXT rule is doubly load-bearing here).

### Ragnarök — `rg-ragnarok`
- **Prompt:** Ragnarök, the doom of the powers — a world-ending cataclysm at frame center: the great wolf's jaws swallowing a blackening sun while fire and glacier-ice tear a battlefield apart, tiny silhouetted warriors falling into a splitting chasm, the sky torn between ember-red and cold aurora, R fire palette `#d95436` and `#5e0f0f` with `#f7b267` ember highlight shot through with glacier blue, the cataclysm the hero of the frame with no single figure — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Read the Runes — `rg-read-the-runes`
- **Prompt:** Read the Runes — a slowly spinning ring of glowing carved bone-and-stone rune-tiles hovering at frame center above a scrying-bowl of dark still water, threads of pale blue fate-light drawn up from the water into the tiles, cold mist curling below, U arcane-blue palette `#4a90d9` and `#16294f` with `#a8d4f7` highlight, the divination effect the hero with only an unseen seer's fingertips at the lower edge — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Berserker's Fury — `rg-berserkers-fury`
- **Prompt:** Berserker's Fury — an explosion of red battle-rage at frame center: a warrior mid-roar wreathed in a blazing crimson aura with twin motion-blur afterimages of a doubled axe-strike streaking outward, sparks and blood-red energy erupting off her, R fire palette `#d95436` and `#5e0f0f` with `#f7b267` ember highlight, the fury-burst the hero of the frame and the figure secondary, half-consumed by the glow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Call the Einherjar — `rg-call-the-einherjar`
- **Prompt:** Call the Einherjar — the honored dead rising at frame center: spectral armored warriors reforming out of cold blue-violet grave-light that streams up from a cracked-open barrow mound, tattered ghost-banners and ghost-mail coalescing, ash and grave-motes swirling, B death palette `#5a3a70` and `#140d1c` with `#9b6fc4` violet highlight over cold grave-blue, the resurrection effect the hero with the risen faces kept in shadow — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Rune of Fury — `rg-rune-of-fury`
- **Prompt:** Rune of Fury — a single carved standing runestone at frame center blazing with molten red rune-light, an angular abstract fury-glyph glowing white-hot in its face (abstract carving only, no letters), fire-sparks and heat-shimmer pouring off it, a weapon leaning against its base catching the ember glow, R fire palette `#d95436` and `#5e0f0f` with `#f7b267` highlight, the burning rune the hero with no figure — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Rune of the Hunt — `rg-rune-of-the-hunt`
- **Prompt:** Rune of the Hunt — a moss-grown carved standing runestone at frame center glowing deep green, an abstract antlered beast-glyph alight in its face (abstract carving only, no letters), living vines and wild growth erupting around its base and a faint stag-antler motif in the aura, G green palette `#4fa06a` and `#123a22` with `#a9dcae` highlight, the wild rune the hero with no figure — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Rune of Hunger — `rg-rune-of-hunger`
- **Prompt:** Rune of Hunger — a black weathered carved standing runestone at frame center dripping with venom-dark violet light, an abstract fanged devouring-glyph burning cold in its face (abstract carving only, no letters), tendrils of grave-shadow and dripping poison curling off it, B death palette `#5a3a70` and `#140d1c` with `#9b6fc4` violet highlight, the hungry rune the hero with no figure — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Rune of Insight — `rg-rune-of-insight`
- **Prompt:** Rune of Insight — a pale carved standing runestone at frame center floating just off the ground in a swirl of cold blue wind, an abstract open-eye-and-wind glyph glowing in its face (abstract carving only, no letters), feathers and streaming air-currents lifting around it, U arcane-blue palette `#4a90d9` and `#16294f` with `#a8d4f7` highlight, the levitating rune the hero with no figure — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Rune of Warding — `rg-rune-of-warding`
- **Prompt:** Rune of Warding — a white-and-gold carved standing runestone at frame center haloed by a radiant protective ward-dome of golden light, an abstract shield-glyph shining in its face (abstract carving only, no letters), motes of holy light and a faint runic circle glowing on the ground, W holy palette `#f2e8cf` and `#c9a84c` with `#fffef2` highlight, the warding light the hero with no figure — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

---

## Celtic Fae non-creature addendum — shipped-prompt record (NOT parsed by gen-spell-art)

The Celtic Fae expansion's two colorless non-creature cards below shipped on
2026-07-13 via one-off generations through the card pipeline (character
smart-crop), regenerated to user review feedback. Their prompts are recorded
here so the direction is durable. **Deliberately parser-proof formatting:**
`scripts/gen-spell-art.ts` parses `### ` headings plus top-level
`- **Prompt:**` lines and hard-fails on any id outside its fixed 52-id roster
(a stray top-level Prompt bullet would even silently overwrite the previous
entry's prompt) — so these records use `####` headings and indented field
bullets, which that parser cannot see. Regenerating either card means a one-off
CLI invocation (or temporary driver wiring), not a routine gen-spell-art run.

#### Dawn Torc — cf-dawn-torc
  - **Card facts:** {1} · C · Artifact (court trinket, tap: gain life) · c
  - **User feedback driving the shipped render:** "more room above head" — the regen buys a tall band of clear dawn sky above the figure so nothing clips at the card-window ceiling.
  - **Shipped direction (2026-07-13 15:40):** an adult fae courtier at first light holding the Dawn Torc — a glowing pale-gold woven-knotwork torc ring — at chest height as the hero object, its warm light washing over her leaf-and-silver court dress; blackthorn scrub, white blossoms, and standing stones fading into a misted sunrise valley behind her; warm ivory-and-gold W-support palette (`#f2e8cf`, `#c9a84c`, `#fffef2`) over silver fae accents; the entire top third clear empty dawn sky above her head; knotwork strictly abstract, no readable ogham, runes, letters, or text anywhere — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait
  - **Verified:** shipped PNG satisfies the feedback (head top ≈ y 205 with generous sky; torc hero-object centered in the visible band; text-free).

#### Silver Thread — cf-silver-thread
  - **Card facts:** {2} · C · Enchantment — Aura (attached gets +0/+2, scry) · c
  - **User feedback driving the shipped render:** "zoom out, show more of the character, more room above her head" — the regen pulls the camera back to a full-figure view with clear moonlit sky above.
  - **Shipped direction (2026-07-13 15:43):** an adult fae fate-weaver seen full-figure from further back, a single luminous silver thread of fate spiraling loosely around her whole body and trailing off-frame, a small silver key-charm dangling from one raised hand; she stands among mossy standing stones on a night moor beneath a full moon; cold moonlit silver-and-blue-black palette with thorn-silver gown detail; the entire top third clear empty moonlit sky above her head; no readable ogham, runes, letters, or text anywhere — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait
  - **Verified:** shipped PNG satisfies the feedback (full figure head-to-ankles in frame; head top ≈ y 255 under open sky and moon; thread reads clearly at card scale; text-free).
