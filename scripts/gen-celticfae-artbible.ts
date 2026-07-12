/**
 * One-off generator for docs/art-bible/celtic-fae.md. Emits a 13-field art-bible
 * entry for every creature in Celtic Fae (src/data/cards/celtic-fae.ts), in
 * source-file order. The Card-facts line is computed EXACTLY from card data so
 * `npm run check-art-bible` cannot drift. Re-run after editing the set:
 * `npx tsx scripts/gen-celticfae-artbible.ts`.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CELTIC_FAE } from '../src/data/cards/celtic-fae';
import type { CardDef, Color, ManaCost } from '../src/data/cardTypes';

const SUFFIX =
  '— crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait';
const WUBRG: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
const HOLO: Record<string, string> = {
  c: 'none',
  r: 'shiny',
  sr: 'radiant foil',
  ssr: 'prismatic moonfoil',
  ur: 'otherworldly aurora',
};
const RARITY_AMBITION: Record<string, string> = {
  c: 'Common — one poised figure and one instantly readable fae gesture; keep the scenic background to two dominant values.',
  r: 'Uncommon — a decisive courtly action plus one environmental story beat, without losing the silhouette at battlefield scale.',
  sr: 'Rare moment — an elegant magical turning point, with mist, water, or thornwork actively framing the figure.',
  ssr: 'Legendary splash — a commanding court scene where the Otherworld itself participates in the composition.',
  ur: 'Marquee sovereign — the full fae-court key visual: a singular regal silhouette, a secondary symbol, and a landscape with consequences.',
};

function costStr(cost?: ManaCost): string {
  if (!cost) return '{0}';
  let out = cost.generic > 0 ? `{${cost.generic}}` : '';
  for (const color of WUBRG) {
    for (let i = 0; i < (cost.pips[color] ?? 0); i++) out += `{${color}}`;
  }
  return out || '{0}';
}

function colorStr(card: CardDef): string {
  if (card.colors.length === 0) return 'C';
  return card.colors.join('/') + (card.colors.length >= 2 ? ' (gold frame)' : '');
}

function factsLine(card: CardDef): string {
  const legendary = card.supertypes?.includes('legendary') ?? false;
  const parts = [costStr(card.cost), colorStr(card), `${card.attack}/${card.defense}`];
  if (card.keywords?.length) parts.push(card.keywords.join(', '));
  parts.push(`${card.rarity}${legendary ? ', legendary' : ''}`);
  parts.push(`holo: ${HOLO[card.rarity]}`);
  return parts.join(' · ');
}

const PALETTE: Record<string, string> = {
  W: 'W palette (`#f2e8cf` → `#c9a84c`, accent `#fffef2`) — pearl-white, pale gold, and moonlit ivory',
  U: 'U palette (`#4a90d9` → `#16294f`, accent `#a8d4f7`) — deep pool-blue, silver mist, and cold moonlight',
  B: 'B palette (`#5a3a70` → `#140d1c`, accent `#9b6fc4`) — blackthorn violet, raven-black, and grave-lilac',
  R: 'R palette (`#d95436` → `#5e0f0f`, accent `#f7b267`) — foxfire ember, blood-red, and warm peat',
  G: 'G palette (`#4fa06a` → `#123a22`, accent `#a9dcae`) — moss green, wet leaf shadow, and luminous verdigris',
  gold: 'gold multicolor palette (`#e8c95a` → `#7a5a18`, accent `#fff2b8`) — pale gold torcs, silver moonlight, and courtly green-black depth',
  C: 'colorless palette (`#a9adb5` → `#4e535c`, accent `#dfe3ea`) — cold iron, weathered standing stone, and fog-grey silver',
};

const paletteOf = (card: CardDef): string =>
  card.colors.length >= 2 ? PALETTE.gold : PALETTE[card.colors[0] ?? 'C'];

interface Art {
  kind: string;
  costume: string;
  background: string;
  props: string;
  pose: string;
  mood: string;
  lighting: string;
}

const BY_SUB: Record<string, Art> = {
  Goddess: {
    kind: 'Morrigan, an adult fae war goddess in a raven-aspected court form',
    costume: 'a blackthorn crown, layered raven-feather mantle, fitted black-green nature-forged armor, and a pale gold torc',
    background: 'a glassy battlefield pool beneath a silver moon, treaty ribbons torn blank in the reeds',
    props: 'a raven perched on her wrist and a spear whose leaf-shaped blade catches a cold star',
    pose: 'descending from a slow wingbeat, spear angled down while the cloak describes a raven silhouette',
    mood: 'regal, pitiless, and almost amused by the bargain already broken',
    lighting: 'hard silver moonlight from upper left as key; green-black aurora rim along feathers and armor',
  },
  Queen: {
    kind: 'an adult fae queen, sovereign of a beautiful court that is quietly dangerous',
    costume: 'an elongated silver-edged cloak, thorn crown, moonstone jewelry, and bark-and-leaf armor worked like formal regalia',
    background: 'a hollow-hill audience chamber opening through mist onto a moonlit forest',
    props: 'a pale gold torc, a branch sceptre, and drifting moth-like lights',
    pose: 'seated or standing in absolute stillness, one hand extended as if granting a gift with a hidden hook',
    mood: 'perfectly composed, warm enough to invite trust and cold enough to punish it',
    lighting: 'soft silver moon key from high left; saturated moss-green rim separating cloak from the hill-dark',
  },
  Sovereign: {
    kind: 'an adult summer fae sovereign whose generosity reads as a binding contract',
    costume: 'sun-pale layered silk beneath nature-integrated gold-and-leaf armor, a thorn-and-apple crown, and bright silver jewelry',
    background: 'a sunwell grove at twilight where gold light filters through blackthorn branches',
    props: 'a luminous apple in an open palm and a pale gold torc half-hidden by flowering vines',
    pose: 'turning toward the viewer with the offered apple held at heart height, cloak sweeping into the lower band',
    mood: 'radiant, patient, and dangerously sincere',
    lighting: 'warm low sun as the key; cool silver moon rim across the crown and shoulder',
  },
  Mage: {
    kind: 'an adult lake fae mage, a poised proto-Arthurian keeper of impossible promises',
    costume: 'a long blue-white cloak with silver thread embroidery, slim nature-shaped bracers, a thorn circlet, and moonlit eyes',
    background: 'a mirror-still lake before a hollow hill, reeds and standing stones fading into mist',
    props: 'a glassy water mirror, a willow wand, and blank stone tablets with only non-textural weathering',
    pose: 'waist-up at the shore, lifting the wand so a crescent of water arcs around one shoulder',
    mood: 'calm, observant, and already aware of the promise the viewer will regret',
    lighting: 'cool lake reflection as key from below-left; clean silver rim from the moon behind her',
  },
  Selkie: {
    kind: 'an adult selkie courtier, elegant in both sea and shore forms',
    costume: 'a seal-skin mantle worn over a fitted teal-and-silver court gown, shell clasps, a fine torc, and wet moonlit hair',
    background: 'a black-glass tidal pool ringed by kelp, moonlit rocks, and a distant hollow-hill door',
    props: 'a silver comb, pearl-bright droplets, and a folded seal pelt with a clear readable silhouette',
    pose: 'rising from the pool at a three-quarter turn, one hand skimming water into a bright arc',
    mood: 'unhurried, elusive, and delighted to know more than she says',
    lighting: 'moon reflection on the water as a blue-silver key; deep green sea-glow as the rim',
  },
  Hunter: {
    kind: 'an adult Wild Hunt matriarch, a regal fae commander in motion',
    costume: 'blackthorn-and-antler crown, hunting cloak elongated into a banner shape, moss-dark armor, and pale gold bridle jewelry',
    background: 'a moonlit moor cut by a mushroom ring and the ghostly silhouettes of her hunt',
    props: 'a crescent hunting horn, a leaf-bladed spear, and spectral hounds held as secondary silhouettes',
    pose: 'low in the saddle or striding into the charge, horn just lowered and spear pointing past the viewer',
    mood: 'exultant, authoritative, and certain the quarry is already hers',
    lighting: 'cold silver moon key on the face and weapon; hot foxfire rim from the passing hunt',
  },
  Banshee: {
    kind: 'an adult banshee of the old courts, beautiful and ruinously composed',
    costume: 'a torn but regal mist-grey mourning cloak, thorn-silver hair ornaments, and nature-etched black armor at the shoulders',
    background: 'a bog-side cairn field with low mist, raven feathers, and one distant hollow-hill light',
    props: 'a silver keening bell and shredded veil streamers that remain blank and non-lettered',
    pose: 'floating forward with one hand near her throat, cloak and hair rising in the note she has not yet released',
    mood: 'funereal, intimate, and mercilessly patient',
    lighting: 'lilac bog-glow as key from below; sharp moon-silver rim around the veiling hair',
  },
  Seer: {
    kind: 'an adult fae oracle who reads fate from living wood and reflected water',
    costume: 'a long moss-and-silver mantle, thorn circlet, layered beadwork, and lacquered leaf armor at the wrists',
    background: 'a silver-branch grove around a glassy pool, its boughs carefully clear of any readable marks',
    props: 'a forked silver branch, a shallow scrying bowl, and floating leaf motes',
    pose: 'seated upright beside the pool, branch pointing through the frame while her gaze stays centered',
    mood: 'serene, businesslike, and faintly amused by mortal certainty',
    lighting: 'pool-light key across the face; cool moon rim tracing the branch and cloak edge',
  },
  Redcap: {
    kind: 'an adult redcap skirmisher, compact, regal, and very pleased with the violence',
    costume: 'a crimson cap over a thorn crownlet, short blackthorn cloak, layered peat-black armor, and silver rings',
    background: 'a blackthorn lane under a bruised moon, red mushrooms and wet stone flashing past',
    props: 'a hooked sickle, a small round buckler, and a single redcap banner rendered blank',
    pose: 'caught at the first violent step of a sprint, sickle low and shoulders driving forward',
    mood: 'reckless, courtly in the worst possible way, and laughing through clenched teeth',
    lighting: 'warm foxfire key across the cap and weapon; hard violet moon rim on the moving silhouette',
  },
  Sentinel: {
    kind: 'an adult fae gatekeeper, a court sentinel whose welcome is a test',
    costume: 'a columnar blue-silver cloak, thorn crown, bark-lamellar armor, and an engraved-looking but textless torc',
    background: 'the threshold of a hollow hill, mist spilling over a moonlit stone stair',
    props: 'a tall silver spear, a round mirror shield, and a gate of blackthorn branches',
    pose: 'front-facing and planted, spear vertical at one side while the shield catches the visible band',
    mood: 'formally courteous, immovable, and impossible to hurry',
    lighting: 'cool interior hill-light as key; moonlit silver rim on the spear and crown',
  },
  Sidhe: {
    kind: 'an adult Sidhe blade dancer of the silver court',
    costume: 'a close-fitted green-black dueling coat under an elongated split cloak, thorn crown, silver jewelry, and leaf-steel vambraces',
    background: 'a blackthorn avenue beside a moonlit pool, fallen white petals caught in the sword wind',
    props: 'a narrow leaf-shaped dueling sword and a pale gold torc at the throat',
    pose: 'three-quarter lunge, blade leading across the middle band while the cloak counter-sweeps behind',
    mood: 'precise, proud, and too polite to call the first strike a threat',
    lighting: 'clean moon-silver key on the blade side; lush moss-green rim along cloak and boots',
  },
  Raven: {
    kind: 'an adult raven-aspected fae envoy, not a childlike bird mascot',
    costume: 'a feathered black cloak over slim court armor, a thorn tiara, silver rings, and a pale gold raven torc',
    background: 'a cairn-lined moor with a murder of ravens circling through silver fog',
    props: 'a blank silver signet ring, feather fan, and one black wing spread as a silhouette accent',
    pose: 'landing or stepping from a low rock with the cloak opening like folded wings',
    mood: 'watchful, formal, and carrying news nobody will enjoy',
    lighting: 'overcast moon key across the face; violet-black feather rim from the fog behind',
  },
  Hound: {
    kind: 'a regal Otherworld hound, lean and ancient rather than cute, with moonlit eyes and a fae-court bearing',
    costume: 'a narrow pale-gold collar, blackthorn charms, and mossy spectral fur that integrates with the surrounding roots',
    background: 'a mist road passing between standing stones and the open mouth of a hollow hill',
    props: 'a silver leash trailing loose, white breath, and thorn vines swept back by the charge',
    pose: 'low and forward in a fast three-quarter run, head and eyes held squarely in the central band',
    mood: 'silent, inexorable, and already on the scent of a broken promise',
    lighting: 'cold moon key on the muzzle and shoulders; sickly green hill-light rim along the fur',
  },
  Knight: {
    kind: 'an adult fae knight whose armor has grown from hedge, bark, and silver',
    costume: 'nature-integrated plate with leaf edges, a long pale cloak, thorn crown under a helm circlet, and a pale gold torc',
    background: 'a moonlit knoll above a misty court-road, oak roots twisting through old stone',
    props: 'a silver lance or leaf-bladed sword, a round oak shield, and no heraldic text',
    pose: 'standing in a ready guard with the weapon held diagonally through the visible band',
    mood: 'chivalric, reserved, and wholly committed to a vow that predates the visitor',
    lighting: 'pearl moon key on the armor planes; saturated green rim along cloak and shield',
  },
  Fomorian: {
    kind: 'an adult Fomorian raider, immense and glamorous in a brutal Otherworld way',
    costume: 'heavy bog-iron plates tangled with blackthorn, a jagged crown, raven feathers, and battered pale-gold rings',
    background: 'a peat-black shore beneath a storm-swollen moon, ruined standing stones at the horizon',
    props: 'a cleaver-like stone blade and a broken, wordless shield of cold iron',
    pose: 'driving forward from a low angle, one shoulder and weapon breaking through a curtain of rain',
    mood: 'hungry, magnificent, and barely interested in restraint',
    lighting: 'red storm-fire key from the left; silver lightning rim along the weapon and crown',
  },
  Otter: {
    kind: 'a sleek adult fae otter familiar, clever and courtly rather than cartoonish',
    costume: 'a tiny silver torc, moss-green ribbon charms, and a wet blackthorn-leaf mantle',
    background: 'a shallow moon pool under willow roots, with a blurred fae court across the water',
    props: 'a polished river stone, reed wand, and a luminous fish-scale glint',
    pose: 'upright on a river rock with forepaws poised over the stone, face centered and alert',
    mood: 'mischievous, exacting, and visibly calculating the price of a shortcut',
    lighting: 'water reflection as a blue-green key; crisp silver moon rim around the wet silhouette',
  },
  Oracle: {
    kind: 'an adult crowbone prophet, a fae death oracle dressed for court rather than a cottage',
    costume: 'a long black-violet cloak, thorn crown, silver jewelry, and layered bone-and-bark armor',
    background: 'a low cairn beside a glassy bog, ravens crossing a silver moon through drifting mist',
    props: 'a bowl of smooth crow bones without markings, a black feather, and a pale gold knife',
    pose: 'kneeling upright at the cairn, one hand releasing bones into the bowl while her eyes meet the viewer',
    mood: 'intimate, dryly amused, and unafraid of the answer',
    lighting: 'cold lantern key over the hands; moon-silver rim separating black cloak from the bog',
  },
  Ranger: {
    kind: 'an adult fae ranger who knows every hedge as a court corridor',
    costume: 'a moss-green elongated hooded cloak, leaf-scale armor, thorn circlet, and silver fastenings',
    background: 'a thornmaze tunnel opening onto a silver-lit mushroom ring',
    props: 'a yew bow, pale-gold arrowheads, and a compact blackthorn lantern',
    pose: 'drawing the bow sideways across the frame, body turned but moonlit eyes fixed on the viewer',
    mood: 'quietly territorial, patient, and pleased that the hedge has chosen a side',
    lighting: 'silver moon key across the face and bow; green bioluminescent rim from the thornmaze',
  },
  Witch: {
    kind: 'an adult bog witch of the fae court, regal and terrifyingly hospitable',
    costume: 'a layered blackthorn cloak, a silver torc, a thorn crown, and fitted bark armor under wet moss shawls',
    background: 'a reed-choked bog with a single glassy pool, cairns, and distant mushroom-ring lights',
    props: 'a bog lantern, a slim thorn knife, and a cauldron charm without any readable marks',
    pose: 'waist-up at the waterline, lantern held low to light the central face and knife hand',
    mood: 'inviting, unsmiling, and entirely aware that the safe road ends elsewhere',
    lighting: 'lantern-green key from below-left; sharp silver moon rim across the crown and cloak',
  },
  Adept: {
    kind: 'an adult fae-ring initiate at the first threshold of a dangerous education',
    costume: 'a simple elongated blue cloak, small thorn circlet, silver earrings, and leaf-shaped shoulder guards',
    background: 'a small mushroom ring in dewy grass beneath a hollow-hill glow',
    props: 'a clear scrying bowl and a modest hazel wand, both deliberately free of text',
    pose: 'standing inside the ring with the bowl held just below the face, chin lifted in resolve',
    mood: 'eager, cautious, and beginning to understand the price of being welcomed',
    lighting: 'soft pool-blue moon key; green mushroom-light rim on the cloak hem and hair',
  },
  Pixie: {
    kind: 'an adult pixie court scout, petite but clearly adult-coded and battle-ready',
    costume: 'a silver-edged mist cloak, thorn circlet, fitted leaf armor, and fine jewelry that catches the moon',
    background: 'high fog above a blackthorn copse, with distant hollow hills reduced to soft shapes',
    props: 'translucent insect wings, a tiny silver dagger, and drifting glimmerdust',
    pose: 'hovering upright at a three-quarter angle, wings framing rather than hiding the centered face',
    mood: 'playful, sharp-eyed, and just out of reach',
    lighting: 'cool moon key through the wings; lavender fog rim around cloak and ankles',
  },
  Sprite: {
    kind: 'an adult thorn sprite, small in scale but regal in stance',
    costume: 'a blackthorn-petal cloak, slim green armor grown from leaves, a tiny thorn crown, and silver ear cuffs',
    background: 'a close blackthorn hedge opening onto a moonlit clearing, rendered with deep readable depth',
    props: 'a thorn rapier, seed-lantern, and sharp leaf wings',
    pose: 'balanced on a thorn branch with the rapier held forward, face fully visible in the center band',
    mood: 'alert, proud, and one bad step away from delighted retaliation',
    lighting: 'cold moon key on the cheek and blade; acid-green leaf rim along the small silhouette',
  },
  Guard: {
    kind: 'an adult fae ring guard, a formal protector of the boundary between invitation and trap',
    costume: 'mushroom-cap-inspired pauldrons, a long moss cloak, thorn crown, silver bracelets, and bark armor',
    background: 'a giant mushroom ring at night, fog passing between its luminous caps',
    props: 'a broad staff topped with a blank silver disk and a root-woven shield',
    pose: 'squarely braced at the ring entrance, staff angled toward the ground and shoulders immovable',
    mood: 'patient, ceremonious, and impossible to embarrass into moving',
    lighting: 'pale mushroom-light key from the front; deep moss-green rim against the night',
  },
  Wisp: {
    kind: 'an adult willow-wisp guide, a luminous fae apparition with a courtly silhouette',
    costume: 'a gauzy elongated cloak of silver mist, a delicate thorn circlet, and faint leaf-metal bracers',
    background: 'a willow-fringed marsh road disappearing into moonlit fog',
    props: 'a floating wisp lantern, willow switch, and tiny pale-gold charms',
    pose: 'gliding forward with the lantern held in front of the torso, face calm and directly readable',
    mood: 'helpful in the manner of someone who knows a more interesting route',
    lighting: 'blue-white wisp key on the face; green fog rim dissolving the cloak edges',
  },
  Reveler: {
    kind: 'an adult fae court reveler who treats celebration as summoning magic',
    costume: 'a flowing moss-green cloak, thorn crown, moon-silver jewelry, and petal-and-bark dance armor',
    background: 'a moonlit dance beneath the mound, with mushroom rings and soft figures kept secondary',
    props: 'a silver cup, flower motes, and a slender branch ribbon with no lettering',
    pose: 'mid-turn with one hand raised, cloak orbiting around a face held steady in the central band',
    mood: 'joyous, commanding, and reckless only if you mistake the invitation for freedom',
    lighting: 'pale gold dance-fire key; cold silver moon rim along the spinning cloak',
  },
  Archer: {
    kind: 'an adult cold-moon fae archer, serene behind a lethal draw',
    costume: 'a white-silver cloak, thorn tiara, leaf-steel cuirass, and pale gold arm rings',
    background: 'a frost-pale oak grove above a misted barrow, moonlight caught on wet grass',
    props: 'a crescent yew bow, a silver apple-arrow, and a patterned but textless quiver',
    pose: 'waist-up in a controlled full draw, bow curving around the face without crossing it',
    mood: 'still, courtly, and already certain of the shot',
    lighting: 'cold moon key on face and arrowhead; blue-green rim from the low mist',
  },
  Scout: {
    kind: 'an adult highland fae scout, swift and sharply self-possessed',
    costume: 'a heather-purple cloak over green leaf armor, a small thorn crown, silver rings, and travel-worn boots',
    background: 'wind-bent heather above a misty valley, a hollow hill distant under the moon',
    props: 'a short heatherblade, folded map skin with no markings, and a raven feather clasp',
    pose: 'running across a ridge in a three-quarter turn, blade low and face turned back toward the viewer',
    mood: 'quick, observant, and pleased to have found the better route first',
    lighting: 'cool moon key over the ridge wind; warm foxfire rim on the moving cloak edge',
  },
  Diplomat: {
    kind: 'an adult fae diplomat whose hospitality is a precise form of power',
    costume: 'a pearl-white elongated cloak, restrained thorn crown, silver jewelry, and smooth oak-leaf armor',
    background: 'a moonlit court bridge over a glassy pool, blackthorn arches fading into mist',
    props: 'a small torc-lantern, an open empty hand, and a sealed-looking but unlettered silver token',
    pose: 'front three-quarter, lantern held just below the face while the other hand offers passage',
    mood: 'kindly, measuring, and impossible to read as harmless',
    lighting: 'warm torc-lantern key across the hands; clean silver moon rim on the cloak',
  },
  Pooka: {
    kind: 'an adult pooka trickster caught between elegant court form and a wild horse-shadow',
    costume: 'a short ember-red cloak, thorn crown, silver earrings, and flexible leaf-and-leather armor',
    background: 'a moonlit lane where a goat, horse, and hare-like shadow overlap in the mist',
    props: 'a silver bridle charm, a foxfire lantern, and a curved switch',
    pose: 'springing sideways in a dancer’s feint, cloak and shadow suggesting transformation without obscuring the face',
    mood: 'laughing, insolent, and visibly one step ahead of the explanation',
    lighting: 'foxfire key warming the grin; silver moon rim splitting the transformation shadows',
  },
  Druid: {
    kind: 'an adult hazelwand mystic, a fae druid who treats the grove as her court',
    costume: 'a moss-green cloak, mature thorn crown, silver torc, and leaf-scale armor with rootlike seams',
    background: 'a hazel grove around a clear spring, blackthorn and standing stones softened by moon mist',
    props: 'a forked hazel wand, a bowl of clear water, and a cluster of bright nuts',
    pose: 'standing waist-up with the wand tracing a circle over the spring, face held central and calm',
    mood: 'grounded, wry, and more interested in the roots than the visitor',
    lighting: 'spring reflection as a green-blue key; silver moon rim on crown, wand, and shoulder',
  },
  Guide: {
    kind: 'an adult moorland fae guide, a composed border-walker in formal traveling dress',
    costume: 'a weathered white cloak, thorn circlet, silver jewelry, and low-profile bark armor under the fabric',
    background: 'a dry stone path across a wet moonlit moor, black dogs and hollow hills far in the mist',
    props: 'a crook-staff, a small silver lantern, and a braided blackthorn charm',
    pose: 'stopping mid-step to indicate the path, staff vertical beside a fully visible face',
    mood: 'professional, patient, and subtly amused by anyone who thinks the path is free',
    lighting: 'soft lantern key at chest height; cool moon rim tracing the cloak and staff',
  },
  Hart: {
    kind: 'a sacred Otherworld hart, statuesque and ancient rather than cute, with luminous moonlit eyes',
    costume: 'mossy fur, a pale gold antler torque, silver leaf charms, and blackthorn vines braided through its antlers',
    background: 'a silver-green grove with a glassy pool and mushroom ring blurred behind the antler silhouette',
    props: 'branching antlers bearing one raven feather and a faint trail of drifting motes',
    pose: 'standing three-quarter with the head lifted, eyes and antlers completely clear in the middle band',
    mood: 'watchful, solemn, and gently warning the viewer not to follow',
    lighting: 'silver moon key down the face and antlers; green pool-light rim through the fur',
  },
};

const COLOR_FALLBACK: Record<string, Art> = {
  W: BY_SUB.Knight,
  U: BY_SUB.Seer,
  B: BY_SUB.Witch,
  R: BY_SUB.Redcap,
  G: BY_SUB.Druid,
};

function artFor(card: CardDef): Art {
  for (const subtype of card.subtypes) {
    const art = BY_SUB[subtype];
    if (art) return art;
  }
  return COLOR_FALLBACK[card.colors[0] ?? 'G'];
}

function mechanicalNote(card: CardDef): string {
  const keywords = card.keywords ?? [];
  const ops = (card.abilities ?? []).flatMap((ability) => (ability.ops ?? []).map((op) => op.op));
  const notes: string[] = [];
  if (keywords.includes('skyborne')) notes.push('an airborne omen and evasive threat');
  if (keywords.includes('untouchable')) notes.push('a difficult-to-answer court sovereign');
  if (keywords.includes('bloodoath')) notes.push('a bargain made potent by sacrifice');
  if (keywords.includes('firstBlade')) notes.push('a first-strike duelist');
  if (keywords.includes('sentinel') || keywords.includes('bulwark')) notes.push('a steadfast boundary keeper');
  if (keywords.includes('deathblade')) notes.push('lethal at a single precise touch');
  if (keywords.includes('warcry') || keywords.includes('overrun')) notes.push('an aggressive hunt leader');
  if (ops.includes('foresee')) notes.push('a reader and arranger of fate');
  if (ops.includes('sever') || ops.includes('severGrave')) notes.push('a keeper of the veil between worlds');
  if (ops.includes('grind')) notes.push('an intimate worker of grave memories');
  if (ops.includes('createToken')) notes.push('a caller of courtly bloom spirits');
  if (card.manaAbility?.length) notes.push('a conduit for the grove’s living mana');
  return notes.length ? notes.join(', ') : 'a poised, immediate presence on the battlefield';
}

function holoNote(card: CardDef): string {
  const finish = HOLO[card.rarity];
  if (finish === 'none') {
    return 'No signature holo; keep the face and central silhouette clean so the moonlit value read survives at small scale.';
  }
  return `Rolled specials favor ${finish}; concentrate reflective texture in silver torcs, dew, wet leaves, and thorn-metal while the face remains calm.`;
}

function shortName(name: string): string {
  return name.split(/[,—]/)[0].trim();
}

function entry(card: CardDef): string {
  const art = artFor(card);
  const flavor = (card.flavor ?? '').replace(/"/g, '”');
  const promptSubject = art.kind.startsWith(shortName(card.name))
    ? art.kind
    : `${shortName(card.name)}, ${art.kind}`;
  const prompt =
    `${promptSubject}, wearing ${art.costume}; ${art.pose}; ${art.mood}; ` +
    `against ${art.background}; ${art.lighting}; reserve the entire top third as clear, empty moonlit mist or sky above the head, thorn crown, and antlers so no crown clips; ` +
    'no readable ogham, runes, letters, banners, cards, mirrors, or text anywhere';
  return [
    `### ${card.name} — \`${card.id}\``,
    `- **Card facts:** ${factsLine(card)}`,
    `- **Character & source:** ${art.kind}; mechanically ${mechanicalNote(card)}.`,
    `- **Personality / mood:** ${flavor ? `“${flavor}” — ` : ''}${art.mood}.`,
    `- **Pose & composition:** ${art.pose}; face ≈ y 320 and eye-line ≈ y 300–360. The entire top third stays clear empty sky or mist above the head, crown, antlers, and hair for crop-safe headroom.`,
    `- **Costume & attire:** ${art.costume}.`,
    `- **Palette:** ${paletteOf(card)}; Celtic Fae accents — silver moonlight, moss green, blackthorn, raven black, glassy water, and pale gold torcs — layer over the color anchor without replacing it.`,
    `- **Lighting:** ${art.lighting}.`,
    `- **Expression:** ${art.mood}.`,
    `- **Props / weapon:** ${art.props}.`,
    `- **Background:** ${art.background}.`,
    `- **Holo interaction:** ${holoNote(card)}`,
    `- **Rarity ambition:** ${RARITY_AMBITION[card.rarity]}`,
    `- **Prompt:** ${prompt} ${SUFFIX}`,
  ].join('\n');
}

const creatures = (CELTIC_FAE as readonly CardDef[]).filter((card) => card.types.includes('creature'));
const header = `<!-- source-of-truth: src/data/cards/celtic-fae.ts · last-verified: 2026-07-10 -->

# Darling Blades Art Bible — Celtic Fae (\`cf\`)

The Silver Veil is an elegant, dangerous fae court at silver-green twilight:
moonlight catches on moss, blackthorn, pale gold torcs, raven feathers, and
glassy pools while mist opens onto mushroom rings and hollow hills. Every fae
figure is adult-coded and regal, with an elongated cloak, thorn crown, silver
jewelry, moonlit eyes, and nature-integrated armor forming the set’s shared
silhouette language. The court gives gifts as bargains, so beauty always has a
hook. Keep ogham stones, banners, mirrors, books, cards, and seals entirely
blank or patterned: no readable runes or text. Every prompt reserves a clear,
empty top third above the subject’s head and crown, preserving headroom for
smart-crop and preventing clipped silhouettes in the card window.
`;

const body = creatures.map(entry).join('\n\n');
const output = `${header}\n${body}\n`;
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'art-bible');
writeFileSync(join(dir, 'celtic-fae.md'), output, 'utf8');
console.log(`gen-celticfae-artbible: wrote ${creatures.length} entries to docs/art-bible/celtic-fae.md`);
