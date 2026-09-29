<!-- source-of-truth: docs/expansions/drafts/first-dawn-brief.md, docs/expansions/drafts/first-dawn-overplan.md, docs/art-bible/index.md · last-verified: 2026-09-28 · art bible draft — the First Dawn art pilot (lane B, wave 2): thirteen entries written before the cut, with the owner's pilot rulings P11-P15 applied; card facts are transcribed from the First Dawn overplan rows and change when the cut locks; check-art-bible does not read this file until src/data/cards/first-dawn.ts exists -->

# First Dawn Art Bible: the pilot

The pilot batch for **First Dawn** (1.9 lane B, wave 2): ten hard cases from
section 11 of the approved identity brief
([first-dawn-brief.md](../expansions/drafts/first-dawn-brief.md)), eleven
images because case 7 is two, plus the two summit boss portraits (rungs 27
and 28). Large non-humanoid subjects are new territory for the prompt recipe,
so these images go through the owner's eyes before the full run; the full
run starts the day the cut locks. The **First Dawn register** in
[index.md](index.md) section 4d governs every palette, lighting pair,
species tell, costume and large-subject rule below, the First Dawn tokens and
places in section 7 are canon here, and the global style contract in section
2 remains in force above it.

**Card facts are transcribed from overplan rows** (the First Dawn overplan,
[first-dawn-overplan.md](../expansions/drafts/first-dawn-overplan.md),
2026-09-28), not from card data: the set has none yet, and every fact line here is
re-checked at the cut. Holo follows the Drowned Deep convention (common none,
rare and super rare sheen, double super rare shiny, ultra rare prism).

**How the pipeline reads this file.** It is a draft: `gen-card-art.ts` reads
it only through `--bible docs/art-bible/first-dawn.md --out-dir <scratch>`,
and `gen-spell-art.ts` through `--spec ... --out-dir <scratch>`; both refuse
an out-dir under `public/` and skip the manifest, so no pilot id can ship.
The three beast-alone entries (The Horned Herd, Hatchling, Tar-Bones) open
their Prompt with "NO woman", which makes `gen-card-art.ts` use its beast
preamble instead of the waist-up portrait preamble. **The Painted Cave** is
an enchantment: it runs through `gen-spell-art.ts` and ends with the spell
suffix of `docs/spell-art.md`.

Four register rules bind hardest and are repeated here because a generator
breaks them first:

- **Every head top at or below y ≈ 179, human or dinosaur**, with horns,
  frills and crests counted (section 3's headroom rule on the 216 window,
  y 138 to 662), **and nothing climbs above that line**: tail tips, skulls,
  raised weapons and wings stay under it too (index.md section 4d, the
  pilot's lesson).
- **Scale by distance, never by shrinking the woman**; mount and rider never
  fuse; every tail states its count, root and tip.
- **The costume coverage rule**: chest and hips fully covered, visible ties,
  one more named layer, never string-minimal or slipping.
- **NO-TEXT, the stone-age variant**: cave paintings show animals and hunts
  only, no pictograph rows, no tally marks, no carved symbols.

**The Mark bead stays cyan** (owner ruling P12, 2026-09-28), as in Starborne
and Drowned Deep: a Mark is the section 4d bead, one small bead of biolume
cyan `#5ff0e0` in the skin or hide, one per Mark, countable, at mid-height.

- **Where it appears:** on the bearer, when an entry's art shows a creature
  carrying a Mark as a state (the creature a Mark card has marked, drawn
  close enough for a bead to read), with the stated count and section 4b's placement
  clause. That entry drops "no cyan glow, no cyan light" for "cyan only in
  the [N] beads on [the bearer], nowhere else in the frame".
- **Where it does not:** the sky, the Ice Wall, water, fire, eyes, body paint
  and cave paintings (section 4d); any token's canon art, since a Mark is a
  game state a token may or may not carry; a card whose Mark lands on
  something the frame shows only at a distance (Great-Horn Herder's sauropod,
  below), where a bead would not read; and The Painted Cave, whose Dawn Mark
  is not painted. None of the thirteen pilot entries depicts a Mark, so all
  of them keep "no cyan glow, no cyan light".

## The pilot

| # | Entry | Overplan row | Rarity | Hard case and its named control |
| ---: | --- | --- | --- | --- |
| 1 | Kesh, Raptor-Rider | `fd-kesh-raptor-rider` (SSR, R) | ssr | a raptor rider at a sprint: no fused bodies, tail root and tip |
| 2 | Great-Horn Herder | `fd-great-horn-herder` (R, G) | r | a shepherdess beside a sauropod: scale by distance, head inside the band |
| 3 | Korru, Eldest of the Trackers | `fd-korru-eldest-tracker` (UR, G) | ur | a hunter facing a tyrant: two creatures, count control, no gore |
| 4 | Frill-Neck Stalker | `fd-frill-neck-stalker` (R, G) | r | a horned Dinokin warrior: the frill against the headroom rule |
| 5 | Scorch-Tail Raptor | `fd-scorch-tail` (C, R) | c | a raptor Dinokin: tail root and tip |
| 6 | Asha and Shree, Sky-Riders | `fd-sky-riders-pact` (SSR, W/U) | ssr | a pterosaur rider airborne: no fused bodies, count control |
| 7a | The Horned Herd | `fd-horned-herd` (R, G) | r | an adult horned beast alone: no woman in frame, head inside the band |
| 7b | Hatchling | the Hatchling token, `tok-hatchling` | token | the same beast newborn: visibly young, no human child |
| 8 | Tar-Bones | the Tar-Bones token, `tok-tar-bones` | token | a fossil rising from the tar: clean stone-coloured bone, no gore |
| 9 | The Painted Cave | `fd-painted-cave` (UR, W; flex, cut in the projected cut) | ur | cave art: animals and hunts only, no text, no tally marks |
| 10 | Pack-Caller of the Red Cliffs | `fd-pack-caller` (C, R) | c | exactly one raptor at her side, the one the card makes: count control, no fused bodies (the pilot drew three as a count test) |
| R27 | Tahla, Shepherdess of Thunder | `fd-tahla-shepherdess` (UR, G/W) | ur | the rung 27 tower portrait: count control, scale by distance |
| R28 | Oru, the Tyrant Queen | `fd-oru-tyrant-queen` (UR, R/G) | ur | the rung 28 tower portrait: the costume rule, tail root and tip |

Every entry name, id and fact is a working one until the cut. The two
portrait entries are the Darlings of the summit pair; their art is the tower
portrait, so the face is the brightest, most central thing in frame.

**The pilot's verdict** (owner rulings P10-P15, 2026-09-28). The recipe
reads as First Dawn (P11: "Mostly, yes. I think it's a good look overall.").
The thirteen pilot images are kept locally and gitignored, in the main
checkout's research folder (`research/first-dawn-art-pilot/`), with the
contact sheet `pilot-sheet.png` and the assembled prompts; their retained
raws are in `%TEMP%/gen-card-art/`. They are **candidates for the art run,
not shipped art**: each is re-checked against its entry when the cut locks
the facts. (The sheet's other two images, Swan-Lake Sovereign and Brood
Communion, were approved to replace the shipped art, P10, and are committed.)
Two are redone at the art run, from the tightened entries below, and one is
re-cropped:

- **Tar-Bones (re-cropped, no regeneration):** the pilot crop put the skull
  above the card window (its top at about y 48), because the person detector
  boxed the tail of bones. Cropping the retained raw from its top row
  (offset -239) puts the skull top at about y 197, inside the window, with
  the tar still in band. The candidate in the research folder is that
  re-crop; the tightened entry below stands if it is ever regenerated.
- **Scorch-Tail Raptor:** the tail tip rises above the card window (about
  y 70).
- **Pack-Caller of the Red Cliffs:** the pilot drew three raptors as a count
  test; the card makes one Pack Raptor, so the art shows one (P15).

**Case 2 lives on a woman's card** (confirmed, P13). The brief's case (a
shepherdess beside a sauropod, typed after the woman, D2) sits on Great-Horn
Herder, a Human Shepherd whose Duty marks a creature with Attack 4 or more:
the herder of the big beasts, and the brief's "big-beast pairings from R".
Her Duty's Mark is not depicted in the pilot: at scale by distance a bead on
the sauropod would not read. The shipping entry decides whether it moves
closer.

**For the cut, not the pilot: The Walking Mountain is beast-only** (P13). The
Walking Mountain (`fd-walking-mountain`, SSR, a Dinosaur Longneck) gets a
beast-only image at the cut: its Prompt opens "NO woman", it reads huge by
distance (fern trees, a river, pterosaurs below its head), its whole
body and raised head sit inside the band with the head top at or below
y 179, and its Provoked Hatchlings are foreshadowed as exactly two hatchlings
of the one Hatchling design (the horned calf, below), or two eggs, at its
feet.

## Entries

### Kesh, Raptor-Rider — `fd-kesh-raptor-rider`
- **Card facts:** {2}{R} · R · 3/2 · warcry · ssr · holo: shiny
- **Character & source:** Kesh, an Ember-clan woman in her late twenties; a Human Rider (D2), so her mount is the plain Pack Raptor design (section 7). Lean and long-legged, warm brown skin, one low black braid, ochre cheek stripes.
- **Personality / mood:** Warcry and the attack Hunt: she charges first and picks her fight at full speed.
- **Pose & composition:** Three-quarter front, sprinting toward the lower-left camera, the raptor's head low at the left third (y 400). Kesh upright in the saddle behind its shoulders, spear levelled forward at prey off-frame left. Head top at or below y 179, eye line y 290; tail root and tip in frame at the right, the tip lower than her head.
- **Costume & attire:** Scorched-leather two-piece, chest and hips covered, sinew ties, a shoulder pelt, leg wraps.
- **Palette:** R `#d95436` / `#5e0f0f`, accent `#f7b267`; lava orange `#ff7a2e` paint and crest; sandstone `#d9b98c` dust.
- **Lighting:** Low sun from the right, dawn-peach key, long shadows; sky-blue `#8cc4ec` rim on the left edges.
- **Expression:** A fierce open grin, eyes on the prey.
- **Props / weapon:** Flint spear, edge forward; braided hide reins; a hide saddle.
- **Background:** The Long Grass at dawn, ferns splitting around the sprint, a steaming river.
- **Holo interaction:** Shiny: the sweep catches the flint and crest; her face stays clean.
- **Rarity ambition:** Double super rare moment: the instant before the Hunt lands.
- **Prompt:** EXACTLY ONE adult woman riding EXACTLY ONE plain raptor, nothing else alive in the frame, three-quarter front view of the pair sprinting diagonally toward the lower-left camera through tall ferns and thrown dust, the raptor foreshortened with its head low and forward at the left third inside the middle band, the woman upright in a hide saddle strapped behind the raptor's shoulders, one leg on each side of its body, her left hand on braided hide reins, her body and the raptor's two separate shapes with a visible line between them, the raptor's head its own and well ahead of her, mount and rider never fused, the raptor with two legs and two small clawed forelimbs, one curved sickle claw on each foot, rust-red feathers along its back, a low crest, and exactly one long stiff tail emerging from the base of its spine at the hips, never from its side, ending in exactly one tip fan of dark feathers, the tail streaming back to the right with root and tip both inside the frame and its tip lower than her head, she is a lean long-legged woman in her late twenties with warm brown skin, black hair in one low braid, ochre stripes across her cheekbones, a fierce open grin, levelling a long flint-headed spear forward past the raptor's head toward prey off the left edge, a scorched-leather two-piece with chest and hips fully covered and visible sinew ties plus a dark red-brown shoulder pelt and leather leg wraps, never string-minimal, never slipping, the top of every head, hers and the raptor's crest included, no higher than one quarter of the way down the canvas with open sky above it, the edge of a fern plain at dawn with steam off a warm river and a ring of smoking mountains on the horizon, lit by a low morning sun as the one warm dawn-peach key from the right with long shadows, one cool sky-blue rim, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no metal anywhere, ornaments of bone, shell, stone, amber and teeth only, no cyan glow, no cyan light, no men, no male figures, no children, no feathered war bonnets, no Plains headdresses, no Arctic peoples' dress, no dot-painting, no gore, no blood, no wounds, no captive or bound women, no franchise creature designs, no film dinosaur designs, no hybrid monsters, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no hand stencils, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### Great-Horn Herder — `fd-great-horn-herder`
- **Card facts:** {1}{G} · G · 1/2 · r · holo: sheen
- **Character & source:** A Fern-clan Human Shepherd, a herder of the big beasts; case 2 (the woman typed first, D2), the sauropod her partner. Late twenties, compact and sturdy, deep tan skin, black hair cropped short. She stands at true human size in front.
- **Personality / mood:** Her Duty tends the biggest beast in the herd: fearless, fond, a little proud.
- **Pose & composition:** She stands at the lower right third, three-quarter from behind, knees up, crook raised in a call, looking up and left. The sauropod walks far back across the river in side view, facing left, its whole body inside the band, its raised head top at or below y 179 and higher in frame than hers (her eye line y 330). Exactly two small pterosaurs veer away from its head.
- **Costume & attire:** Leaf-dyed hide two-piece, chest and hips covered, rawhide ties, a woven-grass cloak.
- **Palette:** G `#4fa06a` / `#123a22`, accent `#a9dcae`; fern green `#8cc063`; dawn peach `#ffc7a0` on the flank.
- **Lighting:** Low sun from the left behind the viewer, dawn-peach key; sky-blue `#8cc4ec` rim along the neck.
- **Expression:** Quarter profile, calm wonder.
- **Props / weapon:** A pale wooden crook.
- **Background:** A warm river steaming between fern banks, the smoking mountains beyond.
- **Holo interaction:** Sheen: the sweep runs along the neck; keep the sky textured.
- **Rarity ambition:** Rare moment: the call, the beast answering at scale.
- **Prompt:** An extreme wide establishing shot, EXACTLY ONE adult woman and EXACTLY ONE enormous plain sauropod long-neck and EXACTLY TWO small pterosaurs, nothing else alive in the frame, the woman in the lower right third of the frame close to the viewer at true human size, seen three-quarter from behind from the knees up, a pale wooden crook raised high in one hand as a call, looking up and to the left, compact and sturdy in her late twenties, deep tan skin, black hair cropped short, the sauropod walking far back across a steaming river valley in side view facing left, its whole body from head to tail tip inside the middle band of the frame, it reads huge by distance, never by shrinking the woman, its raised head still higher in the frame than hers, four pillar legs, grey-green hide with pale dappled flanks, exactly one long tail from its hips tapering to exactly one thin tip, root and tip both in frame, exactly two small leathery-winged pterosaurs wheeling near its raised head and veering away, the top of every head, hers and the sauropod's, no higher than one quarter of the way down the canvas with open sky above it, she wears a leaf-dyed hide two-piece with chest and hips fully covered and visible rawhide ties plus a long woven-grass cloak, never string-minimal, never slipping, green fern banks, a warm river steaming, a ring of smoking mountains beyond, lit by a low morning sun as the one warm dawn-peach key from the left behind the viewer with long shadows, one cool sky-blue rim along the long neck, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no metal anywhere, no cyan glow, no cyan light, no men, no male figures, no children, no riders, no saddle, no feathered war bonnets, no Plains headdresses, no Arctic peoples' dress, no dot-painting, no gore, no blood, no wounds, no franchise creature designs, no film dinosaur designs, no hybrid monsters, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no hand stencils, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### Korru, Eldest of the Trackers — `fd-korru-eldest-tracker`
- **Card facts:** {3}{G}{G} · G · 4/5 · ur, legendary · holo: prism
- **Character & source:** Korru, the Fern clan's eldest tracker, late fifties: lean and hard, deep brown weathered skin, grey-streaked black hair in one low braid. Her Duty is a Hunt: case 3, a hunter facing a tyrant, both whole.
- **Personality / mood:** "Eldest of the Trackers": patient, unhurried, still here.
- **Pose & composition:** Korru at the left third, three-quarter from behind, turning her face toward the tyrant, spear braced low. The tyrant at the right, ten paces off across open ground, head lowered to her eye level, jaws closed. Her head top at or below y 179, eye line y 310; its head y 320. The instant before contact.
- **Costume & attire:** Leaf-dyed hide two-piece, chest and hips covered, rawhide ties, a woven-grass cloak, leg wraps.
- **Palette:** G `#4fa06a` / `#123a22`, accent `#a9dcae`; fern green `#4f8a3c`; the tyrant olive and rust.
- **Lighting:** Low sun behind the tyrant, dawn-peach key, its shadow reaching toward her; sky-blue `#8cc4ec` rim.
- **Expression:** Calm, narrowed eyes.
- **Props / weapon:** Long flint spear; the plain tyrant.
- **Background:** A trampled fern clearing, steam, the volcanic ring.
- **Holo interaction:** Prism: the sun behind the tyrant is the centred glow.
- **Rarity ambition:** Ultra rare box-art: the whole Hunt in one frame.
- **Prompt:** EXACTLY ONE adult woman and EXACTLY ONE plain tyrant dinosaur facing each other across open ground, nothing else alive in the frame, a hunt where both could lose, the instant before contact, both whole and unhurt, the woman at the left third seen three-quarter from behind, turning her face toward the beast, a lean hard woman in her late fifties with deep brown weathered skin, crow's feet and grey-streaked black hair in one low braid, a long flint spear braced low in both hands with the point forward, the tyrant at the right in the mid-ground ten paces away, its head lowered to her eye level with its jaws closed, olive-and-rust scales, small bony ridges above its eyes, two small forelimbs, two massive legs, and exactly one massive tail from its hips ending in exactly one tip, root and tip both in frame, both heads fully inside the middle band, the top of every head, hers and the tyrant's, no higher than one quarter of the way down the canvas with open sky above it, the two bodies separated by open trampled ground, never touching, she wears a leaf-dyed hide two-piece with chest and hips fully covered and visible rawhide ties plus a long cloak of woven grass and leather leg wraps, never string-minimal, never slipping, a trampled clearing in a fern forest with broken fronds and steam, a ring of smoking mountains beyond, lit by a low morning sun behind the tyrant at the right as the one warm dawn-peach key throwing its long shadow toward her, one cool sky-blue rim along her cloak, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no metal anywhere, ornaments of bone, shell, stone, amber and teeth only, no cyan glow, no cyan light, no men, no male figures, no children, no feathered war bonnets, no Plains headdresses, no Arctic peoples' dress, no dot-painting, no gore, no blood, no wounds, no butchery, no carcasses, no open jaws with anything in them, no franchise creature designs, no film dinosaur designs, no hybrid monsters, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no hand stencils, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### Frill-Neck Stalker — `fd-frill-neck-stalker`
- **Card facts:** {3}{G}{G} · G · 4/4 · r · holo: sheen
- **Character & source:** A Fern-clan Dinokin Hornback (case 4) with the three Hornback tells: two forward brow horns, a bony frill, one thick blunt-tipped tail. Small scaled patches at her temples are the Dinokin skin, not a tell (§4d). Broad-shouldered, olive skin, short dark-green hair.
- **Personality / mood:** "Stalker" and the arrival Hunt: she leaves the ferns already chosen.
- **Pose & composition:** Low stalking crouch, centre-left, three-quarter left, horns lowered, one hand parting fronds, the other on a stone-headed spear. The frill's top edge is her head top, at or below y 179; eye line y 320. Exactly one plain raptor, her prey, half-screened by ferns at the far right, its whole head at y 360.
- **Costume & attire:** Leaf-dyed hide two-piece, chest and hips covered, rawhide ties, a shoulder pelt, leg wraps.
- **Palette:** G `#4fa06a` / `#123a22`, accent `#a9dcae`; fern green `#8cc063`; bone ivory `#efe6d0` horns.
- **Lighting:** Low sun from the left through the fronds, dawn-peach key; sky-blue rim on the frill.
- **Expression:** Intent, lips parted.
- **Props / weapon:** Stone-headed spear.
- **Background:** Dense fern forest at dawn, steam.
- **Holo interaction:** Sheen: keep the frill textured so the sweep does not white it out.
- **Rarity ambition:** Rare moment: the second before she breaks cover.
- **Prompt:** EXACTLY ONE adult woman, a dinosaur monster-girl with exactly three species features and no others: exactly two bone-ivory brow horns curving forward from above her eyebrows, a bony frill fanning back behind her head no taller than a hand's width above her crown, and exactly one thick tail emerging from the base of her spine at the tailbone, never from her hip, side or waist, ending in exactly one blunt tip, root and tip both in frame, broad-shouldered and muscular with olive skin, small scaled patches at her temples as part of her skin and not a species feature, short dark-green hair, human ears, no fur, in a low stalking crouch at the centre-left of the frame, three-quarter left, horns lowered, one hand parting fern fronds, the other gripping a stone-headed spear, intent eyes, the top of her head with the frill and horns included no higher than one quarter of the way down the canvas with open space above it, exactly one plain raptor as her prey standing half-screened by ferns at the far right, its whole head visible inside the middle band, the two never touching, she wears a leaf-dyed hide two-piece with chest and hips fully covered and visible rawhide ties plus a shoulder pelt and leather leg wraps, never string-minimal, never slipping, a dense fern forest at dawn with steam and one shaft of low sun, lit by a low morning sun as the one warm dawn-peach key from the left through the fronds with long shadows, one cool sky-blue rim on the frill's edge, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no metal anywhere, no cyan glow, no cyan light, no men, no male figures, no children, no feathered war bonnets, no Plains headdresses, no Arctic peoples' dress, no dot-painting, no gore, no blood, no wounds, no franchise creature designs, no film dinosaur designs, no hybrid monsters, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no hand stencils, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### Scorch-Tail Raptor — `fd-scorch-tail`
- **Card facts:** {2}{R} · R · 2/3 · c · holo: none
- **Character & source:** An Ember-clan Dinokin Raptor (case 5) with the three Raptor tells: one long stiff feathered tail, a low feather crest along crown and nape, a sickle claw on each foot. Wiry, tan skin, cropped rust-red hair. The smouldering tail tip is her name, not a mechanic tell.
- **Personality / mood:** The name and Provoked: hit her once and she answers with sparks.
- **Pose & composition:** Side three-quarter, landing low from a spin on a basalt ridge, weight coming forward, dust falling. The tail sweeps out behind her to the right in one low, shallow curve between hip and shoulder height, root at her tailbone and smouldering tip both inside the band, the tip lower than her head; embers drift sideways from the tip, not up. Her head top is the figure's highest point, at or below y 179 (crest flat), eye line y 300. (The pilot's tail curled up in an S and its tip rose above the card window: redo at the art run.)
- **Costume & attire:** Scorched-leather two-piece, chest and hips covered, sinew ties, knee-high leg wraps, bare clawed feet.
- **Palette:** R `#d95436` / `#5e0f0f`, accent `#f7b267`; lava orange `#ff7a2e` / `#ffb057` tail tip; basalt grey `#5b6166`.
- **Lighting:** Low sun from the left, dawn-peach key; sky-blue rim on her back and tail.
- **Expression:** Snarling grin, sharp teeth.
- **Props / weapon:** None: claws and the tail.
- **Background:** A bare basalt ridge, one steaming vent, two values.
- **Holo interaction:** None: common.
- **Rarity ambition:** Common: one figure, one idea (the tail), readable at 119×97.
- **Prompt:** EXACTLY ONE adult woman, a raptor monster-girl with exactly three species features and no others: exactly one long stiff tail emerging from the base of her spine at the tailbone, never from her hip, side or waist, covered in rust-red feathers and ending in exactly one tip fan of feathers that smoulder lava orange like a coal, a low crest of short feathers along her crown and nape lying flat, and one curved sickle claw on each bare foot, wiry compact build, tan skin, cropped rust-red hair, human ears, no fur, side three-quarter view landing low from a spin on a basalt ridge, weight coming forward, dust still falling around her, her tail sweeping out behind her to the right in one low shallow curve between her hips and her shoulders, never curling upward, never raised above her shoulders, its root at her tailbone and its smouldering tip both fully inside the middle band, the tail tip lower than the top of her head, a small spray of embers drifting sideways from the tail tip, a snarling grin, the top of her head the highest point of the whole figure, tail and crest included, and no higher than one quarter of the way down the canvas with open sky above it, she wears a scorched-leather two-piece with chest and hips fully covered and visible sinew ties plus leather leg wraps to the knee, never string-minimal, never slipping, a bare basalt ridge at dawn with one steaming vent, simple two-value background, lit by a low morning sun as the one warm dawn-peach key from the left with long shadows, one cool sky-blue rim on her back and tail, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no metal anywhere, no cyan glow, no cyan light, no men, no male figures, no children, no feathered war bonnets, no Plains headdresses, no Arctic peoples' dress, no dot-painting, no gore, no blood, no wounds, no franchise creature designs, no film dinosaur designs, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no hand stencils, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### Asha and Shree, Sky-Riders — `fd-sky-riders-pact`
- **Card facts:** {4}{W}{U} · W/U (gold frame) · 3/3 · skyborne · ssr · holo: shiny
- **Character & source:** Asha, a Sky-clan woman in her thirties, and Shree, her pterosaur (case 6); a Human Rider (D2). Tall and rangy, fair freckled skin, pale blonde hair under a leather cap. Her arrival makes two Gliders: two small pterosaurs of the Glider design (section 7) fly with them.
- **Personality / mood:** "Sky-Riders": easy, practised, at home in open air.
- **Pose & composition:** Airborne, banking left at mid-height, Shree's wings nearly full width, its crested head leading at the left third. Asha in a saddle at the base of its neck, knees gripping, looking back. Her head top at or below y 179, eye line y 300. The Gliders trail upper and lower right, smaller. No ground under them.
- **Costume & attire:** Pale leather two-piece, chest and hips covered, sinew ties, leg wraps, an invented hide-and-fur cape, not Arctic dress.
- **Palette:** Gold frame; W `#f2e8cf` / `#c9a84c`, U `#4a90d9` / `#16294f`; glacier white-blue `#e6f3fb`.
- **Lighting:** Low sun from the right through the wing membranes, dawn-peach key; sky-blue rim.
- **Expression:** Relaxed half-smile.
- **Props / weapon:** Braided hide reins; a bone signal horn.
- **Background:** Open sky over the Cliff Nests, mist in the gorge far below.
- **Holo interaction:** Shiny: the sweep crosses the wing membranes.
- **Rarity ambition:** Double super rare moment: three fliers, one frame.
- **Prompt:** EXACTLY ONE adult woman riding EXACTLY ONE large pterosaur, with EXACTLY TWO small pterosaurs flying behind them, nothing else alive in the frame, airborne and banking left across the frame at mid-height, open sky all around and beneath them, no ground, cliff or ledge under them, the large pterosaur's leathery wings, stretched from one long wing finger on each side to its hind legs, spanning nearly the full width of the frame, exactly two wings, no feathers, its crested head leading at the left third inside the middle band, a backswept head crest, no tail, the woman sitting in a hide saddle strapped at the base of its neck, knees gripping either side, one hand on braided hide reins, looking back over her shoulder, her body and the pterosaur's two separate shapes with a visible line between them, mount and rider never fused, the two small pterosaurs trailing, one at the upper right and one at the lower right, smaller and further off, each with two wings and its own whole head, the top of every head, hers and the pterosaur's crest included, no higher than one quarter of the way down the canvas with open sky above it, she is tall and rangy in her thirties with fair freckled skin and pale blonde hair bound low under a close leather cap, a relaxed half-smile, a wind-cut pale leather two-piece with chest and hips fully covered and visible sinew ties plus leather leg wraps and a short invented cape of pale hide trimmed with glacier-white fur, an invented stone-age hide-and-fur cape, not Arctic peoples' dress, never string-minimal, never slipping, sea cliffs full of nests far below and behind with mist in the gorge, lit by a low morning sun as the one warm dawn-peach key from the right glowing through the wing membranes with long light, one cool sky-blue rim on her far side, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no metal anywhere, no cyan glow, no cyan light, no men, no male figures, no children, no feathered war bonnets, no Plains headdresses, no parkas, no Arctic peoples' dress, no dot-painting, no gore, no blood, no franchise creature designs, no film dinosaur designs, no hybrid monsters, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no hand stencils, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### The Horned Herd — `fd-horned-herd`
- **Card facts:** {4}{G} · G · 3/3 · r · holo: sheen
- **Character & source:** A plain Dinosaur Hornback (case 7, the adult): the beast alone, no woman (the brief's rule 3). An invented horned plant-eater, the adult of the Hatchling design (section 7). Its arrival makes two Hatchlings, foreshadowed as exactly two unbroken eggs at its feet.
- **Personality / mood:** A herd mother over the next of the herd; placid until something nears the nest.
- **Pose & composition:** Side three-quarter facing left, head lowered over the nest, horns forward at an off-frame threat. The frill's top edge is its head top, at or below y 179; eye y 330; nest y 560. Tail root and tip in frame at the right.
- **Costume & attire:** None: olive-green hide with sandstone mottling, paler belly, bone-ivory horns.
- **Palette:** G `#4fa06a` / `#123a22`, accent `#a9dcae`; sandstone `#d9b98c`; bone ivory `#efe6d0`.
- **Lighting:** Low sun from the right through the frill's thin edge, dawn-peach key; sky-blue rim on the back.
- **Expression:** Head lowered, eye watchful.
- **Props / weapon:** The nest scrape and its two eggs.
- **Background:** The Long Grass at dawn, steam, the volcanic ring.
- **Holo interaction:** Sheen: texture the frill and hide.
- **Rarity ambition:** Rare moment: the horns lowering over the nest.
- **Prompt:** NO woman, no person, no human figure anywhere in the frame: EXACTLY ONE adult plain horned dinosaur, alone, the only living thing in the frame, an invented horned plant-eater in side three-quarter view facing left toward the viewer, filling the middle band of the frame, head lowered over a nest scrape, three bone-ivory horns (two long brow horns and one short nose horn) pointed forward at a threat off the left edge, a broad scalloped bony frill behind its head, olive-green hide with sandstone mottling and a paler belly, a heavy four-legged body, exactly four legs, exactly one short thick tail from its hips ending in exactly one blunt tip, root and tip both inside the frame at the right, the top of its head with the frill and horns included no higher than one quarter of the way down the canvas with open sky above it, the whole head inside the middle band and never cropped, at its front feet a shallow nest scrape holding EXACTLY TWO large pale unbroken eggs, no hatchlings, no other animals, a grassy fern plain at dawn with steam rising and a far line of fern trees and a ring of smoking mountains, lit by a low morning sun as the one warm dawn-peach key from the right glowing through the frill's thin edge with long shadows, one cool sky-blue rim along its back, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no cyan glow, no cyan light, no people, no women, no men, no children, no riders, no saddle, no gore, no blood, no wounds, no franchise creature designs, no film dinosaur designs, no hybrid monsters, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### Hatchling — `tok-hatchling`
- **Card facts:** {0} · G · 1/1 · c · holo: none
- **Character & source:** The Hatchling token (G 1/1 Dinosaur) in its one canon design (section 7), the horned calf, for every minter (owner ruling P14): nest commons, the Herd-Horn, the Provoked walls, R27's herd, and the long-neck makers too, by name The Walking Mountain, Mother of the Long-Necks, The Long-Neck Herd, Herd-Guardian Longneck, Nest-Guard Longneck and Hatchling-Mother (flex, cut in the projected cut). A long-neck's calf is this horned calf: there is no long-necked hatchling and no second design. Case 7, the young: The Horned Herd's beast, newborn. No woman, no adult beast, no human child.
- **Personality / mood:** Brand new and already curious; wobbly, bright-eyed, unbothered.
- **Pose & composition:** Low camera at its eye level, the hatchling centred in the lower two thirds of the band, three-quarter left, one front foot on a broken shell. Nub horns and tiny frill are its head top, at or below y 179, fern fronds arching above; eye y 360. Stub tail root and tip in frame.
- **Costume & attire:** None: soft pale-olive skin, faint sandstone mottling.
- **Palette:** G `#4fa06a` / `#123a22`, accent `#a9dcae`; fern green `#8cc063`; bone ivory `#efe6d0` shell.
- **Lighting:** Low sun from the right through fern fronds, dawn-peach key; sky-blue rim on its back.
- **Expression:** Big round eyes, mouth slightly open.
- **Props / weapon:** Broken egg shell fragments.
- **Background:** A fern nest at dawn, dew on the fronds, steam rising, two simple values.
- **Holo interaction:** None: token.
- **Rarity ambition:** Token: one idea, readable at hand size.
- **Prompt:** NO woman, no person, no human figure anywhere in the frame: EXACTLY ONE newborn baby horned dinosaur, alone, the only living thing in the frame, clearly a baby animal just out of its egg, an oversized head and big round bright eyes, stubby legs, exactly four legs, soft pale-olive skin with faint sandstone mottling, three tiny nub horns and a tiny soft frill, exactly one short stub tail from its hips with exactly one rounded tip, root and tip both in frame, low camera at its eye level, the baby at the centre filling the lower two thirds of the middle band in three-quarter view facing left, one front foot on a broken bone-ivory egg shell, shell fragments around it, fern fronds taller than it arching above, the top of its head with the nub horns and frill included no higher than one quarter of the way down the canvas with open space above it, a fern nest at dawn with dew and steam, simple two-value background, lit by a low morning sun as the one warm dawn-peach key from the right through the fern fronds, one cool sky-blue rim along its back, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no true black, darkest visible value basalt grey #34383b, no cyan glow, no cyan light, no people, no women, no men, no human children, no babies of any people, no adult animal, no gore, no blood, no franchise creature designs, no film dinosaur designs, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### Tar-Bones — `tok-tar-bones`
- **Card facts:** {0} · B · 2/2 · c · holo: none
- **Character & source:** The Tar-Bones token (B 2/2 Skeleton) in its canon design (section 7), minted by the Tar clan's rituals and bone-callers (case 8). The fossil is dead: clean stone-coloured bone, raptor-sized, no flesh, no glow in the sockets. No woman in frame.
- **Personality / mood:** Old bones standing up out of the tar, slow and patient.
- **Pose & composition:** Front three-quarter, centred, seen from a few steps back, risen out of a glossy tar pool to the hips, forelimbs lifted, tar sliding off in strands. The neck curves forward and the skull is held low at the front, never reared up: the skull top is the skeleton's highest point, at y 200 to 240, below the y 179 line; tar surface y 560. One tail of bones curls out low along the tar at the right, root and tip visible, the tip below the skull. (The pilot's skull reared up above the card window: redo at the art run.)
- **Costume & attire:** None: bone and tar.
- **Palette:** B `#5a3a70` / `#140d1c`, accent `#9b6fc4` in the ash haze; tar brown `#3d2a1a` / `#8a6a48`; basalt grey `#34383b`.
- **Lighting:** Low sun from the left glinting on the wet tar, dawn-peach key; sky-blue `#8cc4ec` rim (§4d's one cool rim).
- **Expression:** Empty sockets, jaw closed.
- **Props / weapon:** None.
- **Background:** The Tar Flats: bubbling tar, basalt boulders, steam, a smoking cone under ash haze.
- **Holo interaction:** None: token.
- **Rarity ambition:** Token: one idea (the rise), readable at hand size.
- **Prompt:** NO woman, no person, no human figure anywhere in the frame: EXACTLY ONE fossil skeleton of a raptor-sized dinosaur, alone, the only figure in the frame, risen out of a glossy tar pool to its hips at the centre of the frame, front three-quarter view seen from a few steps back, the whole skeleton from skull to tar surface inside the middle band, forelimbs lifted, its neck curving forward and down so the skull is held low at the front at the height of its shoulders, never reared up, never raised high, the bones clean and stone-coloured like weathered grey-tan limestone, no flesh, no skin, no blood, no gore, no rot, empty eye sockets with no glow, jaw closed, glossy dark-brown tar sliding off the bones in long strands with the sky reflected in it, exactly one tail of bones curling out low along the tar at the right with its root at the hips and exactly one tip, both visible, the tail tip lower than the skull, the skull the highest point of the whole skeleton and fully inside the middle band, the top of the skull well below one quarter of the way down the canvas with a wide stretch of open sky above it, the tar surface low in the middle band, the Tar Flats at dawn with bubbling tar pools, basalt boulders, steam and a smoking volcanic cone under a faint violet ash haze, lit by a low morning sun as the one warm dawn-peach key from the left glinting on the wet tar, one cool sky-blue rim from the clear sky, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, tar glossy dark brown #3d2a1a with highlights #8a6a48, never black, no true black, darkest visible value basalt grey #34383b, no cyan glow, no cyan light, no people, no women, no men, no children, no flesh, no wounds, no butchery, no carcasses, no franchise creature designs, no film dinosaur designs, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### The Painted Cave — `fd-painted-cave`
- **Card facts:** {1}{W}{W} · W · none · ur, legendary · holo: prism
- **Character & source:** The Hearth clan's painted cave, a legendary enchantment (flex, cut in the overplan's projected cut); here as case 9, the cave-art test. The wall is the hero; one Hearth elder paints, the Duty mid-act. Its Dawn Mark is not depicted, on purpose. Animals and hunts only.
- **Personality / mood:** Every morning the clan comes back to the wall and adds to it.
- **Pose & composition:** The wall curves across the centre: three long-necks in a line, one horned beast, two women hunters with spears facing it. The elder at the right third, three-quarter left, brushing a long-neck's outline. Her head top at or below y 179, eye line y 310; paintings y 250 to 520.
- **Costume & attire:** Bleached hide two-piece, chest and hips covered, rawhide ties, a long hide wrap, a bone-bead collar.
- **Palette:** W `#f2e8cf` / `#c9a84c`, accent `#fffef2`; sandstone `#d9b98c` wall; matte ochre, charcoal and chalk paint.
- **Lighting:** Low sun raking through the cave mouth, dawn-peach key; sky-blue rim on her hair.
- **Expression:** Concentration, a small smile.
- **Props / weapon:** Reed brush, a shell of ochre, a small ember-hearth.
- **Background:** A sandstone hollow opening on the valley.
- **Holo interaction:** Prism: the sunlit wall is the centred glow.
- **Rarity ambition:** Ultra rare splash: the clan's memory as a place.
- **Prompt:** Enchantment effect, a sunlit sandstone cave whose long painted wall curves across the centre of the frame as the hero, the wall painted with animals and hunts only: EXACTLY THREE painted long-necked dinosaurs walking in a line, EXACTLY ONE painted horned beast, and EXACTLY TWO painted women hunters with spears facing that beast, long-haired silhouettes, every painting a flat bold silhouette in red ochre, charcoal brown and chalk white with clean continuous outlines, drawn in the card's own crisp style and never imitating any real prehistoric cave painting, the paintings are matte pigment on dry stone, not glowing, no magical light on the wall, no glowing outlines, the paintings fully inside the middle band, EXACTLY ONE adult woman, a Hearth-clan elder in her forties with warm olive skin and grey-streaked brown hair in a low knot, standing at the right third in three-quarter view facing left, reaching a reed brush to one painted long-neck's outline, a shell of red ochre in her other hand, her head fully inside the middle band, the top of her head no higher than one quarter of the way down the canvas with open space above it, she wears a bleached pale hide two-piece with chest and hips fully covered and visible rawhide ties plus a long pale hide wrap and a bone-bead collar, never string-minimal, never slipping, a small ember-hearth on the cave floor, the cave mouth open on a green valley at the left, lit by a low morning sun raking through the cave mouth as the one warm dawn-peach key across the painted wall, one cool sky-blue rim from the mouth on her hair, a sunlit patch of wall brighter than 70 percent luminance inside the middle band, no night, no true black, darkest visible value basalt grey #34383b, no metal anywhere, no cyan glow, no cyan light, no men, no male figures, no children, no dot-painting, no real cave-art style, no text, no letters, no numerals, no pictograph rows, no rows of small symbols, no tally marks, no dots in rows, no carved symbols, no runes, no glyphs, no hand stencils, no handprints, no writing or symbols on any surface, no gore, no blood, no lens flare, no starburst, no magic circle, no arcane sigil — crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Pack-Caller of the Red Cliffs — `fd-pack-caller`
- **Card facts:** {2}{R} · R · 1/1 · c · holo: none
- **Character & source:** An Ember-clan Human Shepherd of the raptor packs (case 10): twenties, small and quick, dark brown skin, curly black hair tied back. The card makes one Pack Raptor (section 7), so the art shows exactly one (owner ruling P15: the art matches what the card makes). The pilot drew three as a count test only; this entry is the shipping prompt.
- **Personality / mood:** She whistles and the raptor comes, every time.
- **Pose & composition:** Centred on a red sandstone ledge, front three-quarter, a bone whistle at her lips, one hand raised. One raptor at her left, a full pace off with ground between them, its whole head turned to her at y 430 to 470, its tail tip below her head. Her head top at or below y 179, eye line y 300.
- **Costume & attire:** Scorched-leather two-piece, chest and hips covered, sinew ties, a hide wrap skirt, leg wraps.
- **Palette:** R `#d95436` / `#5e0f0f`, accent `#f7b267`; sandstone `#b08a5a`; the raptor rust-red.
- **Lighting:** Low sun from the right, dawn-peach key; sky-blue `#8cc4ec` rim.
- **Expression:** Eyes smiling over the whistle.
- **Props / weapon:** Bone whistle on a thong.
- **Background:** Red sandstone cliffs, two values.
- **Holo interaction:** None: common.
- **Rarity ambition:** Common: one idea (the call), readable at 119×97.
- **Prompt:** EXACTLY ONE adult woman and EXACTLY ONE plain raptor, no more and no fewer, nothing else alive in the frame, no second raptor, no pack behind them, the woman standing at the centre on a red sandstone ledge in front three-quarter view, a bone whistle at her lips and one hand raised, small and quick, in her twenties, dark brown skin, a mane of curly black hair tied back low, ochre stripes on her forearms, eyes smiling over the whistle, the one raptor at her left side, a full pace away with open ground showing between their two bodies, not overlapping her, its own whole head turned toward her inside the middle band below her head, two legs and two small clawed forelimbs, rust-red feathers along its back, a low crest, and exactly one long stiff tail from its hips ending in exactly one tip fan of dark feathers, the tail tip lower than her head, no fused bodies, the top of her head no higher than one quarter of the way down the canvas with open sky above it, she wears a scorched-leather two-piece with chest and hips fully covered and visible sinew ties plus a hide wrap skirt and leather leg wraps, never string-minimal, never slipping, red sandstone cliffs at dawn, simple two-value background, lit by a low morning sun as the one warm dawn-peach key from the right with long shadows, one cool sky-blue rim on the left edges, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no metal anywhere, no cyan glow, no cyan light, no men, no male figures, no children, no feathered war bonnets, no Plains headdresses, no Arctic peoples' dress, no dot-painting, no gore, no blood, no wounds, no captive or bound women, no franchise creature designs, no film dinosaur designs, no hybrid monsters, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no hand stencils, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### Tahla, Shepherdess of Thunder — `fd-tahla-shepherdess`
- **Card facts:** {2}{G}{W} · G/W (gold frame) · 3/4 · sentinel · ur, legendary · holo: prism
- **Character & source:** Tahla, the rung 27 Darling (G/W): the tower portrait. Thirties, tall and strong-shouldered, sun-browned skin, thick auburn hair in a low plait. A Hatchling every Dawn, so one newborn of the canon design (section 7) at her feet; the "thunder" is the long-neck herd behind her.
- **Personality / mood:** Sentinel (attacking does not tap her): warm, unshakeable, always watching the herd.
- **Pose & composition:** Front three-quarter, thigh-up, centred, one hand on a tall crook, the other lowered to one Hatchling nosing her palm, lower left. Far behind, three long-necks walk in single file, small by distance, heads inside the band. Her head top at or below y 179, eye line y 290; her face the brightest thing in frame.
- **Costume & attire:** Leaf-dyed hide two-piece, chest and hips covered, rawhide ties, a pale hide cloak, bone-bead armlets.
- **Palette:** Gold frame; G `#4fa06a` / `#123a22`, W `#f2e8cf` / `#c9a84c`; bone ivory `#efe6d0`; dawn peach `#ffc7a0`.
- **Lighting:** Low sun from the left on her face, dawn-peach key; sky-blue rim on the right.
- **Expression:** Warm, direct eye contact, a slight smile.
- **Props / weapon:** The crook, pale wood with a bone hook.
- **Background:** The Long Grass at dawn, a river bend, the herd's dust.
- **Holo interaction:** Prism: the sun behind her shoulder is the centred glow.
- **Rarity ambition:** Ultra rare portrait: the woman, her newborn, her herd.
- **Prompt:** EXACTLY ONE adult woman, EXACTLY ONE newborn baby horned dinosaur and EXACTLY THREE long-necked dinosaurs far away, nothing else alive in the frame, a portrait of the woman at the centre in front three-quarter view from the thighs up, tall and strong-shouldered, in her thirties, sun-browned skin, thick auburn hair in a low plait over one shoulder, warm direct eye contact and a slight smile, her face the brightest thing in the frame, one hand on a tall crook of pale wood with a bone hook, the other hand lowered toward the baby dinosaur nosing her palm at the lower left, the baby clearly a newborn animal with an oversized head, big round eyes, three tiny nub horns, a small soft frill, a stub tail and four stubby legs, far behind her across the valley the three long-necks walking in single file, small by distance, each with its own whole head inside the middle band and its tail's root and tip in frame, the top of every head no higher than one quarter of the way down the canvas with open sky above it, she wears a leaf-dyed hide two-piece with chest and hips fully covered and visible rawhide ties plus a pale hide cloak and bone-bead armlets, never string-minimal, never slipping, a fern plain at dawn with a river bend and the herd's dust on the horizon, lit by a low morning sun as the one warm dawn-peach key from the left on her face with long shadows, one cool sky-blue rim on her right side, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no metal anywhere, ornaments of bone, shell, stone, amber and teeth only, no cyan glow, no cyan light, no men, no male figures, no human children, no feathered war bonnets, no Plains headdresses, no Arctic peoples' dress, no dot-painting, no gore, no blood, no wounds, no franchise creature designs, no film dinosaur designs, no hybrid monsters, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no hand stencils, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait

### Oru, the Tyrant Queen — `fd-oru-tyrant-queen`
- **Card facts:** {4}{R}{G} · R/G (gold frame) · 5/5 · overrun · ur, legendary · holo: prism
- **Character & source:** Oru, a Dinokin Tyrant and the rung 28 Darling (R/G), the final tower portrait. The split lord: her Dinosaurs are Dreaded, so a plain tyrant looms at her shoulder. Thirties, tall and powerful, bronze skin, long dark-red hair. Tyrant tells: one massive tail, short brow ridges, serrated fangs; scaled patches are Dinokin skin, not a tell.
- **Personality / mood:** "Tyrant Queen" and Overrun: the valley goes where she walks.
- **Pose & composition:** Front three-quarter, thigh-up, centred on a volcanic ridge, looking down at the viewer. Her tail sweeps around her right side into the foreground, root at the tailbone, tip in frame. The tyrant lowers its head behind her left shoulder, below hers. Head top, circlet included, at or below y 179; eye line y 290.
- **Costume & attire:** Scaled-hide two-piece, chest and hips covered, sinew ties, a green half-cloak, an amber-and-bone circlet.
- **Palette:** Gold frame; R `#d95436` / `#5e0f0f`, G `#4fa06a` / `#123a22`; lava orange `#ff7a2e`; amber `#f6c35a`.
- **Lighting:** Low sun from the right on her face, dawn-peach key; sky-blue rim on her left.
- **Expression:** Faint smile, fangs showing.
- **Props / weapon:** The circlet; the tyrant beast.
- **Background:** A basalt ridge, a stampede's dust below.
- **Holo interaction:** Prism: the sun behind her shoulder is the centred glow.
- **Rarity ambition:** Ultra rare portrait: the set's final face.
- **Prompt:** EXACTLY ONE adult woman and EXACTLY ONE plain tyrant dinosaur, nothing else alive in the frame, a portrait of the woman at the centre in front three-quarter view from the thighs up, standing on a basalt ridge and looking down at the viewer, a tyrant monster-girl with exactly three species features and no others: exactly one massive scaled tail emerging from the base of her spine at the tailbone, never from her hip, side or waist, sweeping around her right side into the lower foreground and ending in exactly one tip, root and tip both in frame, a row of short bony ridges above her brows, and serrated fangs showing in a faint smile, tall and powerful, in her thirties, bronze skin with small scaled patches on her shoulders and hips as part of her skin and not a species feature, long dark-red hair loose, heavy-lidded eyes, human ears, no fur, her face the brightest thing in the frame, a low circlet of amber resin and bone beads flat on her brow, the plain tyrant beast behind her left shoulder lowering its head beside her, its head lower than hers and fully inside the middle band, olive-and-rust scales, its body and hers two separate shapes, the top of every head, hers with the circlet included, no higher than one quarter of the way down the canvas with open sky above it, she wears a red-brown scaled-hide two-piece with chest and hips fully covered and visible sinew ties plus a fern-green hide half-cloak, never string-minimal, never slipping, a stampede's dust rising from the valley below and a ring of smoking mountains, lit by a low morning sun as the one warm dawn-peach key from the right on her face with long shadows, one cool sky-blue rim on her left side, clear air, a sunlit surface brighter than 70 percent luminance inside the middle band, no night, no overcast sky, no noon sun, no true black, darkest visible value basalt grey #34383b, no metal anywhere, ornaments of bone, shell, stone, amber and teeth only, no cyan glow, no cyan light, no men, no male figures, no children, no feathered war bonnets, no Plains headdresses, no Arctic peoples' dress, no dot-painting, no gore, no blood, no wounds, no franchise creature designs, no film dinosaur designs, no hybrid monsters, no text, no letters, no numerals, no pictograph rows, no tally marks, no carved symbols, no runes, no glyphs, no hand stencils, no writing or symbols on any surface — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait
