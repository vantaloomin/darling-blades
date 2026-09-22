<!-- source-of-truth: docs/spell-art.md, docs/art-bible/yokai-nights.md, scripts/gen-spell-art.ts, scripts/audit-art-window.py · last-verified: 2026-09-22 · owner ruling 2026-09-22: regenerate; Codex transcribes and runs on one lane -->

# Regen briefs: the seventeen hidden faces (authored 2026-09-22, Fable)

Owner ruling 2026-09-22: regenerate the five Drowned Deep close-ups and the
twelve older-set cards whose originals were not kept. These are the prompt
lines, in the `docs/spell-art.md` format (one `- **Prompt:**` line each;
the script adds the preamble and negatives). Codex transcribes them into
`docs/spell-art.md` (replacing the existing Prompt line where an entry
exists, adding an entry under the right set heading where none does; the
Celtic Fae addendum is parser-proof by design, so `cf-badb-cathas-warning`
gets a normal parsed entry under a new "Regenerations 2026-09-22" heading
with the others that have no entry), deletes each card's cached raw
(`%LOCALAPPDATA%/Temp/gen-card-art/<id>.raw.png`), and runs
`npx tsx scripts/gen-spell-art.ts --only <ids> --force` on one serialized
lane. `yn-network-sprite` is a creature and goes through `gen-card-art`
with its bible entry's pose line amended as below.

**The composition rule every brief carries** (this is what went wrong the
first time): the readable core, a face where there is one, sits at one
third from the top of the canvas, never at the top edge, and the card's
OBJECT (jar, net, lamp, bundle, mirror, slipper, knife, ward, ledger) is
fully inside the middle band with the figure. "Top third clear" means
atmosphere above the head, not the head itself.

## Drowned Deep, the five close-ups (regenerate with the object back in frame)

### Cellar Jar — `dd-cellar-jar`
- **Prompt:** Drain effect, EXACTLY ONE sealed stoneware jar with a blank label on a Low Street cellar shelf, the jar filling one third of the frame width with its lid at one third from the top of the canvas and its whole body inside the middle band, a thin thread of warm life-light drawn out of the dark toward the jar's seal, the shelf running left to right behind it with three more blank-labelled jars out of focus, a single lamp burning lamp amber #ffb35c hung at the left as the one practical key, cool grey daylight from a cellar grating at the right, B identity palette of violet-black #140d1c stone and #5a3a70 shadow, no cyan anywhere in the frame, no figure, no text on any label, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Net Full of Stars — `dd-net-full-of-stars`
- **Prompt:** Token and Mark effect, EXACTLY ONE Kelp Shade standing waist-deep in a hauled fishing net on the Salt Marsh bank, a woman-shaped figure of woven kelp in kelp green #3f6b4a with two pale eyes and no face detail, her head at one third from the top of the canvas with clear fog above it, the net's cork floats and mesh spread across the whole lower half of the frame around her, already carrying exactly one cyan bloom #5ff0e0 as a coral polyp of living light on her chest, a state and never a transition, that single bloom the only cyan in the frame, no other figures, a beached rowboat with its stern lantern burning lamp amber #ffb35c as the one practical key, one cool rim of grey daylight from the fog, the marsh water a flat mirror of black water #0d1a22 meeting the granite bank, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Rite of the Lamp-Fire — `dd-rite-of-the-lamp-fire`
- **Prompt:** Rite effect, EXACTLY ONE adult woman wrecker standing on the Breakwater rock in tarred canvas with bare forearms, her face at one third from the top of the canvas and fog clear above her, holding a bronze lamp #a8783c at chest height burning wreck fire #ff6a3d so that lamp and hands sit at the exact centre of the frame, a stream of warm light drawn up from her open palm into the lamp's flame, her outline going faint at the edges as she gives, calm, no wound and no viscera, one idea only, the Reach behind her a flat plane of black water #0d1a22 under fog, the lamp's wreck fire as the one practical key, one cool rim of grey daylight from the fog, the rock's granite hard against the water at a visible line, R identity palette, no drowned gold and no cyan anywhere in the frame, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### The Marsh Remembers — `dd-the-marsh-remembers`
- **Prompt:** Return and Mark effect, EXACTLY ONE adult woman reef-warden kneeling at the Salt Marsh edge seen from a low three-quarter angle, her face at one third from the top of the canvas with fog clear above it, lifting a salt-white #eef0ea linen-wrapped bundle out of the flat marsh water so the bundle sits at the exact centre of the frame with kelp green #3f6b4a growth grown over its cords and water running off it, already carrying exactly one cyan bloom #5ff0e0 as a coral polyp of living light on her shoulder, a state and never a transition, that bloom the only cyan in the frame, no other figures, the marsh a flat mirror of black water #0d1a22 meeting the granite bank, her lantern set on the bank burning lamp amber #ffb35c as the one practical key, one cool rim of grey daylight from the fog, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### What Was Promised — `dd-what-was-promised`
- **Prompt:** Return effect, EXACTLY ONE adult woman kneeling on a Low Street landing stage seen from the water's level, her face at one third from the top of the canvas, lifting a small salt-white #eef0ea linen-wrapped bundle out of the flat black water #0d1a22 so the bundle and her hands sit at the exact centre of the frame with water running off it, her wet reflection in the surface one beat behind her, still reaching down while she has already lifted, the reflection clearly a mirror image and not a second person, beneath the surface two pages settling slowly toward the bottom, the landing's timber planks and the granite quay hard against the water, her lantern set on the planks beside her burning lamp amber #ffb35c as the one practical key, one cool rim of grey daylight from the fog over the harbour, B identity palette, no cyan anywhere in the frame, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

## Older sets, the twelve with no original kept

### Mirror of Avalon — `ac-mirror-of-avalon`
- **Prompt:** Scrying artifact hero-shot, EXACTLY ONE tall oval mirror in a frame of worn silver and pale ash wood standing on a lake shore at dawn, the whole mirror inside the middle band with its top edge at one third from the top of the canvas and mist clear above it, the glass showing not the shore in front of it but a second shore of white apple orchards lit gold, the reflected shore brighter than the real one, no figure, lake water flat and pale U palette #4a90d9 and #16294f with #a8d4f7 dawn light on the frame's silver, one thread of mist crossing the glass, no text on the frame, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Secret of Avalon — `ac-secret-of-avalon`
- **Prompt:** Draw and Foresee effect, a still lake at night with EXACTLY ONE adult woman in a plain grey cloak seen from behind and to the side at the water's edge in the lower left, her hooded head at one third from the top of the canvas, the lake surface at the centre of the frame showing three faint reflections of the same island lit differently, one at dawn, one at noon, one at dusk, laid side by side on the water like turned pages, the real island a dark silhouette above them, U palette #4a90d9 and #16294f with #a8d4f7 moonlight on the ripples, no other figures, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Treasonous Glance — `ac-treasonous-glance`
- **Prompt:** Drain and Foresee effect, a candlelit round-table council seen across the table from a low angle, EXACTLY ONE adult woman knight in a dark surcoat at the centre of the frame with her face at one third from the top of the canvas, turning her eyes sideways toward the viewer while the rest of her stays facing the table, a thin cold thread of blue-black light leaving the crown at the table's head and settling into her eyes, the other seats empty chairs and drawn shadows, U palette #4a90d9 and #16294f with #a8d4f7 candle-edge on her cheek, a blank round shield on the wall behind, no heraldry with letters, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Badb Catha's Warning — `cf-badb-cathas-warning`
- **Prompt:** Foresee and discard and Sever effect, a grey battlefield at dusk with EXACTLY THREE crows circling low over it at the centre of the frame, the lowest crow's eye at one third from the top of the canvas, beneath them two pale torn pages and a soldier's shield tumbling away on the wind in the lower band, one crow looking straight out of the frame while the other two look away, U and B palette of cold grey-blue #16294f and violet-black #140d1c with #9b6fc4 in the crows' feathers, the field's standing stones as dark shapes, no figure, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Glass Slipper at Midnight — `dt-glass-slipper-at-midnight`
- **Prompt:** Skim and team-buff effect, the palace ballroom stair at the first stroke of midnight with EXACTLY ONE glass slipper resting on the third step at the exact centre of the frame, its toe at one third from the top of the canvas, a pale white-gold pulse spreading out from the slipper across the black marble in rings that lift every dancer's shadow on the floor below into a taller sharper shape with Dreaded menace, the dancers themselves out of frame, only their shadows, the clock face on the far wall blank, W and B palette of ivory #f2e8cf and violet-black #140d1c with #fffef2 on the glass, no figure, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Graveyard Waltz — `gm-graveyard-waltz`
- **Prompt:** Token and Empower effect, a moonlit graveyard with EXACTLY TWO revenant noblewomen mid-waltz turn between the headstones at the centre of the frame, their faces at one third from the top of the canvas and the moon clear above them, gown hems dissolving into grave-mist at the knee, jet jewelry and opera gloves, one gloved hand each raised to the other, faint blue spirit-glow at the eyes, B palette #5a3a70 and #140d1c with #9b6fc4 in the mist and cold moonlight on the ash-violet silk, the headstones blank, no third figure, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Rose-Thorn Snare — `gm-rose-thorn-snare`
- **Prompt:** Grave roses lending their thorns, EXACTLY ONE adult woman duelist's blade-arm and shoulder at the centre of the frame with her face in profile at one third from the top of the canvas, glowing green briar-vines and dark crimson grave roses coiling from the ground up the arm to the blade's guard, every thorn-tip gleaming with a venomous glint of deathblade light, petals drifting through a moonlit walled garden, G palette #4fa06a and #123a22 with #a9dcae living glow, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Silver Knife — `gm-silver-knife`
- **Prompt:** A blessed silver knife flashing first, a slender bright silver blade held point-up at the exact centre of the frame in EXACTLY ONE lace-cuffed hand, the blade's tip at one third from the top of the canvas, a lance of holy candlelight catching the edge as a ring of white ward-light blesses the hand, a dark manor corridor behind with one candelabra, W palette #f2e8cf and #c9a84c with #fffef2 on the steel, the rest of the figure out of frame below the wrist, no face, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Wolfsbane Ward — `gm-wolfsbane-ward`
- **Prompt:** A ward of wolfsbane and prayer, EXACTLY ONE sprig of purple wolfsbane bound in white ribbon hanging from a door lintel at the centre of the frame with the ribbon's knot at one third from the top of the canvas, a golden circle of ward-light spreading from it across the threshold and visibly withering a looming beast-shadow back into the dark on the right, two candle flames steady on the sill, W palette #f2e8cf and #c9a84c with #fffef2 ward-glow and a violet wolfsbane accent, no figure, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Night Extortion — `so-night-extortion`
- **Prompt:** A midnight coercion, EXACTLY ONE shadowy black-cloaked adult woman extortionist at the centre of the frame with her hooded face at one third from the top of the canvas, one hand drawing a glowing thought-wisp out of the dark toward an open ledger of shadow held in the other, the wisp trailing violet, a second drop of her own blood falling from her lip as the price, no victim in frame, a lamplit alley behind, B palette #5a3a70 and #140d1c with #9b6fc4 on the wisp, the ledger's pages blank, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Hauntlink Apex — `yn-hauntlink-apex`
- **Prompt:** Hauntlink artifact hero-shot, EXACTLY ONE crown-shaped spirit-mask of black lacquer and shrine gold floating at the exact centre of the frame with its upper rim at one third from the top of the canvas, three cyan foxfire cables trailing down from it into the lower band toward an unseen wearer, the mask's eye-slits lit electric magenta, a wet black-glass rooftop cityscape behind with cyan signal trails on the wet surfaces, U palette #4a90d9 and #16294f with #a8d4f7 on the lacquer, every sign and screen blank or geometric, no figure, no text, crisp cel-shaded gacha anime spell illustration, dramatic magical effect centered in frame, fully rendered scenic background, 640×800 portrait

### Network Sprite — `yn-network-sprite` (creature; `gen-card-art`, bible entry amended)
- **Pose & composition (replacement line for the yokai-nights bible entry):** airborne in a calm hover with the face at one third from the top of the canvas and the whole spectral silhouette, wings and streamers inside the middle band; the top third is clear atmosphere above the head, the figure never touches the top edge, and the face and defining anatomy read at thumbnail. Everything else in the entry stands.

## After generation

Run `python scripts/audit-art-window.py --only <ids>` (the detector from
PR #387) on the seventeen outputs before review; a face above the window
again means the prompt's placement clause lost to the model, and the fix is
the clause, not a re-crop. Then the owner's eyes on all seventeen.
