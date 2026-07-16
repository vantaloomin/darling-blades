/**
 * One-off generator for docs/art-bible/arthurian-court.md. Emits a 13-field
 * art-bible entry for every Arthurian Court creature in source-file order.
 * Card facts are computed from src/data/cards/arthurian-court.ts so the
 * checker cannot drift from the catalog. Re-run with:
 * `npx tsx scripts/gen-arthuriancourt-artbible.ts`.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTHURIAN_COURT } from '../src/data/cards/arthurian-court';
import type { CardDef, Color, ManaCost } from '../src/data/cardTypes';

const PROMPT_SUFFIX =
  '— crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait';
const WUBRG: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];

// Arthurian Court's finish ladder follows the set's material story: steel
// catches a restrained sheen, grail light blooms through the upper rarities.
const HOLO: Record<string, string> = {
  c: 'none',
  r: 'sheen',
  sr: 'foil',
  ssr: 'radial',
  ur: 'galaxy',
};

const RARITY_AMBITION: Record<string, string> = {
  c: 'Common — one adult-coded court figure and one instantly readable action; keep the background to two dominant values and let steel or fabric carry the silhouette.',
  r: 'Rare — a decisive chivalric action plus one environmental story beat, with the weapon, creature tell, or court prop readable at battlefield scale.',
  sr: 'Super-rare moment — an elegant awakening, vow, or magical turning point, with chapel, lake, or grail light actively framing the figure.',
  ssr: 'Legendary splash — a commanding court scene where polished steel, pennants, and architecture participate in the character’s oath or tragedy.',
  ur: 'Marquee sovereign — the full Arthurian key visual: a singular regal silhouette, a sacred symbol, and a landscape lit by grail radiance or white-gold fate.',
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
  W: 'W palette (`#f2e8cf` → `#c9a84c`, accent `#fffef2`) — pearl-white steel, white-gold sunlight, ivory chapel stone, and crimson pennant thread',
  U: 'U palette (`#4a90d9` → `#16294f`, accent `#a8d4f7`) — moonlit lake blue, silver steel, blue-black water, and clear Avalon light',
  B: 'B palette (`#5a3a70` → `#140d1c`, accent `#9b6fc4`) — thorn-black, bruised violet, wine velvet, and cold silver blade edges',
  R: 'R palette (`#d95436` → `#5e0f0f`, accent `#f7b267`) — tournament crimson, ember orange, polished steel, and white-gold fire',
  G: 'G palette (`#4fa06a` → `#123a22`, accent `#a9dcae`) — ashwood green, moss-dark shadow, grail leaf-light, and weathered stone',
  gold: 'gold multicolor palette (`#e8c95a` → `#7a5a18`, accent `#fff2b8`) — white-gold radiance, polished steel, court crimson, and deep lake or thorn contrast',
  C: 'colorless palette (`#a9adb5` → `#4e535c`, accent `#dfe3ea`) — cold steel, weathered stone, and fog-grey silver',
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

// Every subtype currently used by the 36 Arthurian Court creatures is named
// here. The first matching subtype supplies a coherent default; exact raws
// with an approved audit distinction are replaced in CARD_OVERRIDES below.
const BY_SUB: Record<string, Art> = {
  Knight: {
    kind: 'an adult genderbent Arthurian knight, a polished-steel oath warrior',
    costume: 'fitted silver plate with white cloak panels, white-gold edging, a low thorned crown or circlet, and a crimson pennant tabard',
    background: 'a stone keep or tournament ground with chapel windows and blank crimson pennants',
    props: 'an enchanted blade or knightly lance held with a clean, anatomically correct grip and a round steel shield',
    pose: 'three-quarter ready guard with the weapon cutting a clear diagonal through the middle band',
    mood: 'disciplined, courtly, and carrying an oath too heavy to set down',
    lighting: 'white-gold upper-left sunlight as key; cool steel-blue rim along the far plate and cloak',
  },
  Queen: {
    kind: 'an adult genderbent Arthurian queen, sovereign of a beautiful court under oath',
    costume: 'white-gold court gown beneath tailored steel shoulder armor, an elegant thorned crown, pearl jewelry, and a crimson mantle',
    background: 'a high stone hall opening onto tournament grounds, chapel glass, and rows of blank pennants',
    props: 'a ceremonial sword or sceptre, a signet ring with no lettering, and an open hand that grants judgment',
    pose: 'standing above the camera in a calm three-quarter turn, one hand extended while the mantle frames the lower band',
    mood: 'radiant, composed, and perfectly aware of the price of mercy',
    lighting: 'sunlight through chapel windows as warm white-gold key; cool silver rim on crown and mantle',
  },
  Noble: {
    kind: 'an adult Arthurian noblewoman, court-bred and battle-ready beneath the etiquette',
    costume: 'white-and-gold court silk over fitted steel, a restrained thorn circlet, pearl jewelry, and a crimson mantle clasp',
    background: 'a sunlit stone audience hall opening onto tournament grounds, chapel windows, and blank pennants',
    props: 'a silver cup, a ceremonial short sword, and an unmarked signet carried as a visual court token',
    pose: 'upright three-quarter presentation with one hand offering hospitality and the other resting near the sword',
    mood: 'gracious, observant, and fully capable of turning courtesy into command',
    lighting: 'white-gold window light as key across silk and face; cool silver rim on steel and mantle',
  },
  Witch: {
    kind: 'an adult Arthurian court witch, a keeper of vows that can curdle into curses',
    costume: 'black velvet and fitted dark steel, a thorned crown, silver chainwork, and a deep crimson inner mantle',
    background: 'a candlelit stone chapel with thorn shadows climbing the walls and blank hanging pennants',
    props: 'a black rose, a silver ritual blade, and a shallow grail-like bowl with no markings',
    pose: 'waist-up beside the chapel altar, one hand lifting the spell while the other steadies the bowl',
    mood: 'intimate, sovereign, and smiling as though betrayal were a form of etiquette',
    lighting: 'candle flame as warm low key; cold moonlight rim through the chapel window',
  },
  Mage: {
    kind: 'an adult lake mage of Avalon, a court magician whose power is reflected rather than shouted',
    costume: 'a blue-white court gown under silver shoulder plates, a low crown of lake glass, and translucent veil panels',
    background: 'a moonlit lake beside a stone landing, chapel windows and blank pennants reflected in the water',
    props: 'a clear water mirror, a silver wand, and a small grail-bright orb without symbols',
    pose: 'three-quarter at the lake edge, lifting the wand so a controlled arc of water frames the face',
    mood: 'calm, observant, and already aware of the ending hidden inside the question',
    lighting: 'moonlit lake reflection as blue-silver key; white-gold magical rim around wand and hair',
  },
  Sovereign: {
    kind: 'an adult Lady-of-the-Lake sovereign, an otherworldly ruler in formal Arthurian regalia',
    costume: 'silver-blue layered silk, polished shoulder armor, a thorned moonstone crown, and long white-gold sleeves',
    background: 'a mirror-still moonlit lake with a stone causeway, distant chapel windows, and no readable markings',
    props: 'a lifted enchanted blade, a grail-bright water orb, and ripples that hold a deliberate circular composition',
    pose: 'turning from the lake in a full readable three-quarter figure, arm extended over the water',
    mood: 'distant, patient, and powerful enough to make silence feel like a royal decree',
    lighting: 'cold moonlight on the lake as key; white-gold rim tracing the crown, blade, and sleeve',
  },
  Champion: {
    kind: 'an adult awakened court champion, a legendary knight whose body remembers the vow before the blade does',
    costume: 'ceremonial polished steel over white cloth, a luminous oath-seal at the breast, a low crown, and a crimson shoulder sash',
    background: 'a tournament ground opening toward a chapel and a rising dawn over stone keeps',
    props: 'a signature enchanted blade, a second weapon or oath-seal as appropriate, and blank pennants snapping behind',
    pose: 'caught at the instant of commitment, with the weapon and shoulders driving forward while the face stays clear',
    mood: 'exalted, burdened, and one breath from becoming legend',
    lighting: 'white-gold dawn key on the face and steel; cool silver rim separating the champion from the grounds',
  },
  'Grail-Seeker': {
    kind: 'an adult Grail-Seeker knight, a sincere pilgrim in the court’s polished heroic register',
    costume: 'travel-worn white cloak over bright steel, a small thorned circlet, a grail-shaped clasp, and crimson road sash',
    background: 'a chapel road through wet green fields toward a stone keep and a distant grail radiance',
    props: 'a plain sword, a closed travel cup, and a small shield with no heraldic text',
    pose: 'walking into the light with the shield forward and the sword lowered in restraint',
    mood: 'earnest, brave, and more frightened of failing the vow than of death',
    lighting: 'warm white-gold chapel light as key; cool green rim from the wet road and fields',
  },
  Wizard: {
    kind: 'an adult court wizard, an eccentric keeper of mechanisms, omens, and impossible timing',
    costume: 'a long midnight-blue mantle, silver astrolabe fittings, tailored steel bracers, and a restrained thorn circlet',
    background: 'a clockwork observatory built into a stone keep, with chapel windows and a moonlit court below',
    props: 'a mechanical familiar, an astrolabe, and gearwork with no numerals, letters, or readable symbols',
    pose: 'standing amid the instruments with one hand adjusting the mechanism and the other keeping the familiar aloft',
    mood: 'wry, sleepless, and listening to a future that has not happened yet',
    lighting: 'cold observatory moonlight as key; warm brass-and-candle rim along the mechanism and shoulders',
  },
  Sage: {
    kind: 'an adult Arthurian sage, a court scholar who treats prophecy as a practical tool',
    costume: 'layered blue-black robes under polished silver shoulder guards, a pale mantle, and a small thorn crown',
    background: 'a high keep chamber overlooking a moonlit lake, with blank pennants and unmarked instruments',
    props: 'a scrying bowl, a silver astrolabe, and a mechanical or feathered omen with no numerals',
    pose: 'seated upright at a worktable, one hand arranging the omen while the gaze remains centered',
    mood: 'patient, dryly amused, and quietly alarmed by how neatly the pieces fit',
    lighting: 'candlelit gold key across the hands and face; blue moon rim on the mantle and instruments',
  },
  Rebel: {
    kind: 'an adult bastard-born Arthurian rebel, a court-made warrior who refuses the court’s script',
    costume: 'blackened steel with red underlayers, an asymmetrical torn mantle, a sharp star-shaped clasp, and a low thorn crown',
    background: 'a breached stone keep under a hard red sunset, blank pennants fallen across the tournament yard',
    props: 'a broad enchanted sword, a battered shield, and one broken crown fragment without markings',
    pose: 'advancing through the breach with the sword low and the shoulders angled toward the viewer',
    mood: 'defiant, wounded, and dangerously pleased to have inherited the shadow',
    lighting: 'crimson sunset key through dust; cold steel rim on the blade and torn mantle',
  },
  Soldier: {
    kind: 'an adult Arthurian court soldier, a trained retainer rather than a faceless extra',
    costume: 'practical polished-steel half-plate, white cloth, a crimson tabard or pennant strip, and simple court boots',
    background: 'a stone keep gate or tournament muster yard with blank pennants and ordered ranks kept secondary',
    props: 'a straight sword, a round shield, or a raised torch according to the card’s action',
    pose: 'mid-march or planted in a clean guard, with feet and held equipment fully separated in the silhouette',
    mood: 'earnest, professional, and ready to turn an order into a charge',
    lighting: 'warm white-gold daylight as key; cool grey steel rim around shield and shoulders',
  },
  Initiate: {
    kind: 'an adult lakeblade initiate, a young-in-rank but fully adult retainer at the first oath threshold',
    costume: 'a blue-white training coat under a single polished shoulder plate, a slim silver circlet, and a crimson practice sash',
    background: 'a moonlit lake landing beside a quiet sword-test stone and distant chapel windows',
    props: 'a newly drawn enchanted blade, a plain scabbard, and one unmarked oath ribbon',
    pose: 'three-quarter draw with the blade angled cleanly across the middle band and the face held forward',
    mood: 'eager, cautious, and determined to earn permission rather than assume it',
    lighting: 'blue moonlight from the lake as key; bright silver rim on the new blade and circlet',
  },
  Cleric: {
    kind: 'an adult chapel cleric, a healer and oath-keeper in Arthurian service',
    costume: 'a white-and-silver chapel gown with fitted steel bracers, a small thorned halo-crown, and a crimson stole',
    background: 'a chapel interior with stained-glass windows, candlelit stone, and blank devotional pennants',
    props: 'a grail-shaped reliquary, a haloed mace or repair tools, and a small basin of radiance',
    pose: 'standing at the altar with one hand offering aid and the other holding the sacred implement upright',
    mood: 'tender without softness, devout, and willing to carry the wound home',
    lighting: 'white-gold window light as key; warm candle rim around the shoulders and reliquary',
  },
  'Quest-Seeker': {
    kind: 'an adult questing chapel retainer, a pilgrim who has learned to walk when the sign is silence',
    costume: 'a practical white cloak over light steel, a grail clasp, a crimson road sash, and a low thorn circlet',
    background: 'a chapel threshold opening to a long road, with illuminated relief panels kept purely pictorial and blank',
    props: 'a small chalice, a plain sword, and a weathered quest token without letters',
    pose: 'striding past the threshold with the chalice close to the heart and the sword ready at the hip',
    mood: 'quietly faithful, resilient, and past the point of asking for permission',
    lighting: 'warm chapel gold as key; cool dawn rim on cloak and sword',
  },
  Ranger: {
    kind: 'an adult ashwood ranger, a border knight who reads the forest as another court',
    costume: 'green-and-steel forest armor, an ashwood cloak, a low thorn circlet, and pale-gold fasteners',
    background: 'an ashwood border path beside a stone keep, with crimson pennants distant in the mist',
    props: 'a longbow, a nocked arrow, and an ashwood knife with the grip and nock clearly separated',
    pose: 'wide three-quarter draw, body turned but face visible, with the bow and arrow spanning the middle band',
    mood: 'watchful, territorial, and patient enough to let the border choose the fight',
    lighting: 'filtered white-gold daylight as key; cool green rim through the ashwood leaves',
  },
  Spy: {
    kind: 'an adult court infiltrator, dressed as a bright princess-knight whose intelligence work hides in plain sight',
    costume: 'an ornate white-and-crimson court gown over polished steel, jeweled thorn crown, velvet sleeves, and silver armor trim',
    background: 'a brilliantly lit tournament hall with chapel windows, velvet drapery, and blank crimson pennants',
    props: 'floating translucent foresee panels with abstract light only, a concealed court blade, and a silver cup',
    pose: 'front three-quarter court presentation, one hand calmly arranging the floating panels while the other rests near the blade',
    mood: 'bright, charming, and knowingly unstealthy; the performance is the disguise',
    lighting: 'bright white-gold hall light as key; cool silver rim on the panels, crown, and blade',
  },
  Courtier: {
    kind: 'an adult velvet courtier, a polished social weapon in the queen’s orbit',
    costume: 'ornate velvet court layers, fitted silver shoulder armor, pearl chains, a low thorned circlet, and crimson lining',
    background: 'a sunlit stone audience hall with long tables, chapel windows, and blank banners',
    props: 'a silver cup, a sealed unlettered token, and a slim court blade kept visibly separate from the hand',
    pose: 'three-quarter reception stance with one hand offering hospitality and the other hiding the calculation',
    mood: 'gracious, measuring, and too observant to be mistaken for harmless',
    lighting: 'bright white-gold window key on velvet; cool silver rim along the armor and hair',
  },
  Hunter: {
    kind: 'an adult Arthurian huntress, a court tracker who pursues myth rather than ordinary prey',
    costume: 'green polished leather and light steel, a white hunting mantle, a thorn circlet, and crimson bridle accents',
    background: 'a tournament hunt road leaving the stone keep for a moonlit forest and open meadow',
    props: 'a hunting spear or bow, a weathered bridle charm, and a secondary beast silhouette kept readable',
    pose: 'striding or charging across the frame, weapon leading and the feet fully visible so the hunt reads as an action',
    mood: 'exultant, focused, and certain the impossible quarry has finally shown itself',
    lighting: 'white-gold low sun as key; cool green rim from the forest edge and wet grass',
  },
  Beast: {
    kind: 'a mythic Arthurian beast treated as a full subject, never reduced to a decorative emblem',
    costume: 'natural coat and ceremonial caparison with polished silver fittings and a crimson pennant thread',
    background: 'a moonlit hunt road bordered by stone markers, chapel light, and a distant tournament ground',
    props: 'the creature’s defining anatomy and a cleanly separated bridle, spear, or pennant as the card requires',
    pose: 'full-body stride or charge with all species-defining limbs and hooves in frame, never cropped into a bust',
    mood: 'sacred, dangerous, and too old to care whether the court approves',
    lighting: 'cold moonlight as key across the animal’s face; white-gold rim on mane, horns, or caparison',
  },
  Attendant: {
    kind: 'an adult Avalon court attendant, a precise servant of lake, chapel, and court ritual',
    costume: 'a blue-white or ivory attendant gown, polished steel bracers, a slim silver circlet, and a small crimson sash',
    background: 'a moonlit lake landing or chapel gallery with clean stone architecture and blank pennants',
    props: 'a silver bowl, lilies, or a small grail-bright vessel held with deliberate care',
    pose: 'upright three-quarter service stance with the prop held below the face and the gesture fully legible',
    mood: 'courteous, alert, and aware that every ripple may be a warning',
    lighting: 'cool lake light as key; warm white-gold rim from chapel windows or the vessel',
  },
  Mystic: {
    kind: 'an adult Grail mystic, a solitary guide whose roughness conceals exact knowledge',
    costume: 'a weathered green cloak over hidden polished steel, a simple thorn crown, a grail clasp, and worn boots',
    background: 'a green roadside chapel or stone spring, with a distant keep and soft grail radiance',
    props: 'a covered grail, a plain staff, and a small unmarked bowl or charm',
    pose: 'standing in a guarded three-quarter turn, cloak open just enough to reveal the sacred object',
    mood: 'wry, generous, and quietly unwilling to explain the answer twice',
    lighting: 'warm grail-white key from beneath the cloak; cool forest-green rim on the hood and staff',
  },
  Guide: {
    kind: 'an adult moorland Grail guide, a border-walker in formal traveling dress',
    costume: 'a weathered white cloak over low-profile steel, a thorn circlet, silver fasteners, and a crimson road cord',
    background: 'a wet stone path between a lake and a keep, chapel windows dim in the far mist',
    props: 'a crook-staff, a covered grail vessel, and a small silver lantern without lettering',
    pose: 'stopping mid-step to indicate the road, staff vertical beside a fully visible face',
    mood: 'patient, professional, and subtly amused by anyone who thinks the road is free',
    lighting: 'soft lantern-white key at chest height; cool moonlit rim tracing cloak and staff',
  },
  Bird: {
    kind: 'an actual raven, a black corvid omen rather than an anthro mascot or human courtier',
    costume: 'natural black feathers with no clothing or humanoid anatomy',
    background: 'a moonlit battlefield edge with tattered blank pennants and a stone halberd standard',
    props: 'a halberd used as the perch and ragged banners with no letters, seals, or heraldic text',
    pose: 'wings spread wide while perched on the halberd, body and beak fully readable in the center band',
    mood: 'watchful, ominous, and carrying the silence after an oath breaks',
    lighting: 'cold moonlight as key on the feather planes; white-gold edge rim on wing tips and halberd',
  },
  Omen: {
    kind: 'an adult court omen given a crisp, readable raven-and-battlefield silhouette',
    costume: 'black feather mantle over slim dark steel, a silver thorn circlet, and one crimson warning cord',
    background: 'a moonlit keep wall overlooking a battlefield, with blank pennants lifting in the wind',
    props: 'a raven feather, an unmarked halberd standard, and a small silver omen token',
    pose: 'perched or hovering at the edge of the action, head turned toward the hour of consequence',
    mood: 'formal, unsettling, and entirely certain that the ending has already arrived',
    lighting: 'silver moon key across the eye and weapon; pale gold rim on the feather edges',
  },
  Fallen: {
    kind: 'an adult fallen knight, still unmistakably court-trained beneath the damage',
    costume: 'polished steel scarred but not muddied, a torn white cloak gone dark at the hem, black thorn crown, and crimson wound-cloth',
    background: 'a ruined chapel stair beneath a moonlit keep, fallen blank pennants in the stones',
    props: 'a single lethal enchanted blade, broken oath clasp, and a shield hanging at the side',
    pose: 'low forward stalking stance with the blade held away from the body and the face unobscured',
    mood: 'bitter, precise, and more dangerous for remembering exactly what was promised',
    lighting: 'cold moonlight as key on the blade edge; red ember rim through dust and torn cloth',
  },
  Squire: {
    kind: 'an adult court squire woman, a retainer learning the weight of service before the title',
    costume: 'white-and-steel practice armor, a plain crimson shoulder cord, polished bracers, and a low silver circlet',
    background: 'a dawn training yard beside a stone keep, blank practice pennants and racks of weapons behind',
    props: 'a shield, practice sword, or bundle of training gear carried close to the body',
    pose: 'planted in an attentive service stance with the face centered and the equipment clearly separated',
    mood: 'earnest, patient, and quietly determined to be ready when called',
    lighting: 'warm dawn sunlight as key; cool steel-blue rim along the armor and weapon rack',
  },
  Guard: {
    kind: 'an adult castle guard, a formal protector of a gate that has become part of her',
    costume: 'heavy polished steel, white cloak panels, a black or crimson guard tabard, and a thorned helm-circlet',
    background: 'a stone keep gate or dark stair with blank pennants, deep masonry, and a narrow chapel window',
    props: 'a grounded halberd or thorn-edged greatsword and a broad shield held without fused geometry',
    pose: 'square planted guard with the weapon upright or diagonally braced, shoulders immovable in the frame',
    mood: 'silent, professional, and impossible to hurry through the gate',
    lighting: 'hard white-gold gate light as key; cool blue-grey rim down the weapon and far shoulder',
  },
  Bard: {
    kind: 'an adult court minstrel, a bard whose music turns a table into a formation',
    costume: 'blue velvet and silver stage armor, a short white mantle, a thorn circlet, and crimson ribbon accents',
    background: 'a candlelit round-table hall with chapel windows, polished tables, and blank pennants',
    props: 'a clearly visible lyre or court instrument, held in playing position with strings and hands separated',
    pose: 'mid-verse with the instrument open to the viewer, one hand lifting the next phrase and the face centered',
    mood: 'warm, persuasive, and brave enough to sing while the walls shake',
    lighting: 'candle-gold key on hands and instrument; cool moonlit rim through the hall windows',
  },
  Huntress: {
    kind: 'an adult borderland huntress, a practical archer who meets fear beyond the court wall',
    costume: 'green hunting leathers reinforced with light steel, a white mantle, silver bracers, and crimson cordage',
    background: 'a misty border field beyond a stone keep, with a tournament road and blank pennants far behind',
    props: 'a longbow with a correctly nocked arrow, a hunting knife, and a small leather quiver',
    pose: 'wide full-body drawing stance with the nock visible and the bow limbs clear of face and torso',
    mood: 'focused, wary, and more comfortable beyond the border than inside the hall',
    lighting: 'low white-gold field light as key; cool green rim from the distant woodline',
  },
  Horse: {
    kind: 'a literal caparisoned white warhorse, an animal subject with no rider and no anthropomorphic anatomy',
    costume: 'white coat, polished steel bridle and breastplate, white-gold caparison, and a blank crimson pennant',
    background: 'a muddy tournament road beside a stone keep, smoke, chapel light, and distant blank banners',
    props: 'the caparison, bridle, and a cleanly separated banner; no rider, saddle figure, or human limbs',
    pose: 'full-body three-quarter stride with all four legs and the head in frame, bearing the banner through the charge',
    mood: 'steady, noble, and carrying the last clean light through mud and smoke',
    lighting: 'white-gold daylight as key across the coat and steel; cool silver rim along mane and pennant',
  },
  Duelist: {
    kind: 'an adult errant court duelist, a knight who travels from joust to joust looking for a worthy ending',
    costume: 'light polished steel, a white half-cloak, crimson tournament sash, silver circlet, and streamlined boots',
    background: 'a moonlit tournament ground with stone stands, chapel windows, and blank pennants whipping behind',
    props: 'a single slender enchanted sword, a clean scabbard, and no extra weapon clutter',
    pose: 'dynamic low lunge with the sword thrust forward and the full stance readable from boots to crown',
    mood: 'restless, honorable, and delighted that the next opponent might finally be enough',
    lighting: 'cool moonlight as key on the blade; white-gold rim from the tournament lamps',
  },
  Druid: {
    kind: 'an adult root-chapel druid, a green court warden who keeps faith with living stone and wood',
    costume: 'moss-green mantle over polished leaf-edged steel, a thorn crown, white chapel cords, and crimson seed beads',
    background: 'a root-wrapped chapel in an ashwood grove beside a clear spring and distant stone keep',
    props: 'a rooted spear, a bowl of clear water, and living branches that do not obscure the hands',
    pose: 'planted sentinel stance with the spear rising through the frame and the face centered beneath the roots',
    mood: 'grounded, watchful, and willing to let the chapel outlast every kingdom',
    lighting: 'grail-white spring light as key from below; cool green rim through roots and leaves',
  },
  Banneret: {
    kind: 'an adult Camelot banneret, a court soldier trusted to carry the memory of the army',
    costume: 'bright polished half-plate, white cloak, crimson tabard, silver circlet, and practical gauntlets',
    background: 'a stone keep courtyard after rain, blank crimson pennants arranged in deep perspective',
    props: 'one tall pennant held upright with its fabric visibly blank, plus a short sword kept at the hip',
    pose: 'front three-quarter march with the banner rising cleanly through the middle band and the face centered',
    mood: 'solemn, dependable, and proud of the thing she has been trusted to remember',
    lighting: 'white-gold post-rain sunlight as key; cool silver rim on pennant pole and plate',
  },
  Archer: {
    kind: 'an adult court archer, a quiet marksman who can loose a shot without interrupting the music',
    costume: 'green-and-white archery coat over fitted steel, silver armguard, thorn circlet, and crimson fletching accents',
    background: 'a keep gallery overlooking a moonlit tournament ground, chapel windows glowing behind',
    props: 'a longbow with a visible correct grip, a nocked arrow, and a plain quiver with no markings',
    pose: 'side-on full draw with the bow curved around the face without crossing it, stance stable and deliberate',
    mood: 'serene, exacting, and already certain of the shot’s landing place',
    lighting: 'cool lake-moon key on face and bow; warm white-gold rim along the arrow and shoulder',
  },
  Seer: {
    kind: 'an adult Avalon seer, a court attendant who carries tomorrow in a silver bowl',
    costume: 'blue-white silk beneath light silver armor, a small thorn crown, pearl chains, and a crimson cord at the wrist',
    background: 'a moonlit lake gallery with chapel windows, a round table in soft focus, and blank pennants',
    props: 'a silver scrying orb or bowl, pale water ripples, and no readable symbols or numerals',
    pose: 'upright three-quarter presentation of the orb below the face, gaze steady over its reflected light',
    mood: 'careful, serene, and aware that the future spills if the hand shakes',
    lighting: 'blue-silver lake reflection as key; white-gold rim on bowl, crown, and sleeve',
  },
};

const COLOR_FALLBACK: Record<string, Art> = {
  W: BY_SUB.Knight,
  U: BY_SUB.Mage,
  B: BY_SUB.Witch,
  R: BY_SUB.Champion,
  G: BY_SUB.Druid,
  C: BY_SUB.Knight,
};

// The approved audit called out these raw-specific reads. Keeping them as
// data, instead of burying them in emitter conditionals, makes the exceptions
// reviewable and keeps the subtype defaults reusable.
const CARD_OVERRIDES: Record<string, Art> = {
  'ac-artoria-once-future': {
    kind: 'an adult genderbent Artoria, Once and Future Queen, the polished-steel sovereign of the set',
    costume: 'full ornate silver-and-white plate with gold filigree over a blue royal underdress, golden hair gathered into a braided crown bun, and a royal crown',
    background: 'a throne-hall dais with stained glass and blank crimson banners behind her',
    props: 'a greatsword held point-down in both hands before the throne-hall dais',
    pose: 'pulled-back three-quarter framing from the crown to mid-thigh, both hands holding the greatsword point-down before the throne-hall dais, with the full plate and braided crown bun clearly separated from the upper frame',
    mood: 'commanding, hopeful, and burdened by every oath the crown remembers',
    lighting: 'white-gold key light across the plate and face; cool blue rim along the crown, blade, and cloak',
  },
  'ac-morgan-thorn-crown': {
    kind: 'an adult genderbent Morgan le Fay, sovereign witch of the Thorn Crown',
    costume: 'a silver thorn crown, black velvet gown over fitted dark steel, silver throat chains, and a deep crimson mantle',
    background: 'a candlelit black chapel cathedral with tall windows, dark stone, and blank crimson pennants in the nave',
    props: 'a conjured black rose held in one hand, a silver ritual blade, and thorn shadows curling from the altar',
    pose: 'three-quarter cathedral portrait with the black rose lifted beside the face and the crown clearly silhouetted',
    mood: 'regal, intimate, and amused by the wound she has renamed a treaty',
    lighting: 'candle flame as warm low key on rose and face; cold moonlit rim through the cathedral windows',
  },
  'ac-nimue-lake-sovereign': {
    kind: 'an adult genderbent Nimue, Lady of the Lake and sovereign of Avalon',
    costume: 'silver-blue court armor over flowing lake silk, a low moonstone crown, pearl chains, and white-gold sleeves',
    background: 'a mirror-still moonlit lake with a stone causeway and chapel windows dissolving into blue haze',
    props: 'a clear water mirror and an enchanted blade rising from the lake, both fully separated from her hands',
    pose: 'calm three-quarter turn at the shoreline, one arm extended over the water and the face centered in the reflection',
    mood: 'secretive, patient, and powerful enough to drown a kingdom without raising her voice',
    lighting: 'blue-silver moonlight reflected from the lake as key; white-gold rim on crown, blade, and shoulder',
  },
  'ac-lancelot-moonlit-shame': {
    kind: 'an adult genderbent Lancelot, a moonlit silver-blue plate duelist whose shame rides beside her',
    costume: 'moonlit silver-blue plate over dark underlayers, long dark hair falling behind the shoulders, and no ghostly weapon effects',
    background: 'a night courtyard beneath a full moon with blank banners along the walls',
    props: 'two solid steel swords, one gripped in each hand, with both blades fully visible and distinct',
    pose: 'low crossed dueling guard, one solid steel sword gripped in each hand and crossed low, with no duplicated or ghostly blade',
    mood: 'fierce and grieving, with a single tear track cutting down the face',
    lighting: 'cold moonlight key across the tear and silver-blue plate; warm candle rim along the nearer sword and shoulder',
  },
  'ac-guinevere-court-sun': {
    kind: 'an adult genderbent Guinevere, the bright court sun and queen of Camelot',
    costume: 'ornate white-and-gold court gown over polished steel, a high sun-crown, pearl jewelry, and crimson mantle',
    background: 'a brilliantly lit stone audience hall with chapel-window filigree, velvet drapery, and blank pennants',
    props: 'a silver cup, a small grail-bright light, and one translucent unlettered court panel',
    pose: 'enthroned or standing in a luminous three-quarter court presentation, sun-crown high but fully readable',
    mood: 'warm, sovereign, and silently naming the price beneath the smile',
    lighting: 'white-gold sunlight as key across face and crown; cool silver rim on plate and mantle',
  },
  'ac-gawain-noonblade': {
    kind: 'an adult genderbent Gawain, solar knight of the Noonblade',
    costume: 'mirror-bright gold-and-steel plate, a high sun-crown, white cloak, and crimson tournament sash',
    background: 'a blazing tournament ground at noon with stone stands, chapel windows, and blank pennants',
    props: 'the Noonblade held in a clean first-strike line, a round shield, and no extra weapon clutter',
    pose: 'low-angle three-quarter charge with the solar crown deliberately reaching toward the upper bleed and the blade cutting the band',
    mood: 'invincible at noon, radiant enough to make the coming dusk feel like tragedy',
    lighting: 'hard white-gold noon key on crown and blade; cool silver rim under the cloak and shield',
  },
  'ac-percival-clear-heart': {
    kind: 'an adult genderbent Percival, clear-hearted Grail knight',
    costume: 'white polished plate, a simple grail clasp, white cloak, small thorn circlet, and green chapel sash',
    background: 'a green chapel clearing with a white stag beside the altar and grail light through the windows',
    props: 'a plain sword, a small shield, and the clearly visible white stag standing beside her',
    pose: 'quiet three-quarter approach toward the chapel, sword lowered and stag fully in frame as a companion',
    mood: 'earnest, brave, and changed by what the empty hand carries home',
    lighting: 'grail-white chapel light as key; cool green rim across plate, stag, and cloak',
  },
  'ac-galahad-silver-oath': {
    kind: 'an adult genderbent Galahad, silver-oathed holy paladin',
    costume: 'immaculate silver plate, white cloak, a luminous halo-crown, a crimson oath cord, and a polished breastplate',
    background: 'a high chapel nave with pale windows, stone reliefs kept pictorial, and blank pennants',
    props: 'a straight silver sword, a round shield, and the halo as the central sacred sign',
    pose: 'front three-quarter paladin stance, sword vertical and halo fully separated from the upper frame',
    mood: 'pure without gentleness, composed, and impossible to bend away from the vow',
    lighting: 'white-gold chapel light as key on halo and face; cool blue-silver rim along the armor',
  },
  'ac-merlin-crow-clock': {
    kind: 'an adult genderbent Merlin, Crow-Clock Sage surrounded by mechanical prophecy',
    costume: 'midnight-blue sage robes, polished silver bracers, brass astrolabe harness, a low thorn circlet, and white mantle',
    background: 'a clockwork observatory inside a stone keep, moonlit lake below, chapel windows behind, no numerals anywhere',
    props: 'a mechanical crow, an astrolabe, and clock motifs with blank faces and no letters or numerals',
    pose: 'standing beside the instrument, one hand steadying the mechanical crow while the astrolabe turns around the other',
    mood: 'wry, sleepless, and listening to the crows refuse to explain the countdown',
    lighting: 'cold observatory moonlight as key on face and crow; warm brass-candle rim on astrolabe and clockwork',
  },
  'ac-mordred-bastard-star': {
    kind: 'an adult genderbent Mordred, bastard star beneath the Arthurian crown',
    costume: 'blackened steel with crimson underlayers, a sharp star clasp, a long ponytail, and a thorn crown reaching near the upper bleed',
    background: 'a breached stone keep and dark tournament yard under a red-black evening sky, blank pennants fallen behind',
    props: 'a broad enchanted sword, a battered shield, and a broken crown fragment without markings',
    pose: 'low forward three-quarter advance, ponytail and crown driving toward the top while the face remains hard and clear',
    mood: 'excellent, villainous, and born beneath a crown she learned to sharpen into a shadow',
    lighting: 'red sunset key through dust; cold steel rim on sword, ponytail, and crown',
  },
  'ac-velvet-court-spy': {
    kind: 'an adult stealthy court spy, a practiced palace infiltrator who survives by looking exactly where she should not',
    costume: 'a dark plum velvet half-cloak with the hood down, a fitted midnight doublet, soft leather boots, and no plate armor',
    background: 'a shadowed palace corridor lined with tapestries and broken by a narrow slit window',
    props: 'a thin stiletto dagger held reversed and flat along her forearm',
    pose: 'slipping along a wall with the thin stiletto held reversed flat along her forearm, half her face hidden in shadow while the sidelong glance stays readable',
    mood: 'stealthy, knowing, and amused by the danger she has already measured',
    lighting: 'a single candle-sconce key from the right; cold moon rim through the slit window along the cloak and dagger',
  },
  'ac-tournament-favorite': {
    kind: 'an adult tournament champion, the crowd’s favorite because her skill is visible from the cheap seats',
    costume: 'red-and-white polished tournament plate, a crimson plume, silver gorget, and a short white mantle',
    background: 'a moonlit tournament ground with stone stands, chapel windows, and blank pennants in the stands',
    props: 'a clearly separated jousting lance, round shield, and horse tack kept distinct from her body',
    pose: 'full readable lunge into the joust, lance leading through the middle band and feet or mount anatomy visible',
    mood: 'confident, kinetic, and delighted that the crowd already knows the ending',
    lighting: 'warm tournament torchlight as key; cool moonlit rim on lance and plate',
  },
  'ac-questing-beast-maiden': {
    kind: 'an adult genderbent questing beast-maiden, a huntress who strides with the Questing Beast itself',
    costume: 'green-and-steel hunt armor, white mantle, thorn circlet, crimson bridle cords, and polished silver fittings',
    background: 'a moonlit Arthurian hunt road beside stone markers and a distant chapel, with the beast’s shadow crossing the grass',
    props: 'a hunting spear and the Questing Beast beside her: serpent head and neck, leopard-spotted body, lion haunches, and hart hooves',
    pose: 'full-body stride with maiden and Questing Beast moving together, every beast section and all four hart hooves visible, no cropped species tell',
    mood: 'exultant, uncanny, and certain that ordinary prey has stopped running for a reason',
    lighting: 'cold moonlight as key across the beast’s spots and maiden’s spear; white-gold rim on horns, steel, and mane',
  },
  'ac-grail-hermit': {
    kind: 'an adult humble acolyte, a quiet Grail hermit whose holiness lives in ordinary things',
    costume: 'rough undyed homespun robes with a rope belt and wooden prayer beads, no armor or finery, and hair in a loose plain braid',
    background: 'a mossy stone hermitage shrine deep in the woods, with roots, damp leaves, and unmarked devotional stone',
    props: 'a plain wooden cup cradled in both hands and glowing with faint holy light',
    pose: 'humble three-quarter framing, cradling the plain wooden cup close to the chest so the cup and its faint glow remain fully visible',
    mood: 'quiet, devout, and tenderly protective of the small light entrusted to her',
    lighting: 'the cup\'s soft golden glow as key across the hands and face; cool forest rim through the moss and leaves',
  },
  'ac-raven-of-camlann': {
    kind: 'an actual raven of Camlann, a black bird and war omen, not an anthro character',
    costume: 'natural black feathers only, with no humanoid anatomy or clothing',
    background: 'a moonlit battlefield with tattered blank banners and a halberd planted in the earth',
    props: 'a halberd as the perch and tattered banners that are visibly blank, with no lettering or heraldic text',
    pose: 'wings spread while perched on the halberd, raven body, beak, talons, and wing silhouette all fully readable',
    mood: 'watchful, ominous, and circling the hour when every oath expires',
    lighting: 'cold moonlight as key on feathers and halberd; white-gold rim along the spread wings',
  },
  'ac-oathbroken-knight': {
    kind: 'an adult fallen knight whose approved art reads pristine and dangerous rather than visibly ruined',
    costume: 'clean polished black-and-silver plate, a white cloak with only restrained damage, crimson wound-cloth, and a thorn crown',
    background: 'a moonlit chapel stair beneath a stone keep, blank pennants lying across the steps',
    props: 'one lethal enchanted blade, broken oath clasp, and a shield hanging separately at the side',
    pose: 'low stalking three-quarter stance with the blade held away from the body and face unobscured',
    mood: 'bitter, precise, and more dangerous because the armor still looks almost immaculate',
    lighting: 'cold moonlight as key on the blade and face; red ember rim through the stair dust',
  },
  'ac-torchbearer-knight': {
    kind: 'an adult torchbearer knight, a rallying soldier whose defining prop is the raised flame',
    costume: 'red-and-steel knight armor, white shoulder mantle, crimson pennant sash, and a polished gauntlet on the torch hand',
    background: 'a night courtyard at a stone keep with blank pennants, torchlit walls, and deep blue sky',
    props: 'a blazing torch thrust high in her right fist, with a sword and shield carried separately below',
    pose: 'mid rallying-shout, right arm fully raised with the flame above the head and the body driving the army forward',
    mood: 'ferocious, encouraging, and loud enough to make the night answer',
    lighting: 'the blazing torch as warm orange key on face and armor; cool moonlit rim around the raised arm and shield',
  },
  'ac-borderland-huntress': {
    kind: 'an adult borderland huntress, a green-cloaked ranger who keeps watch where court and wilderness meet',
    costume: 'green ranger cloak over practical forest leathers, auburn hair in a single braid, and a quiver harness at the hip',
    background: 'a wooded border watchpost with a distant timber palisade visible between the trees',
    props: 'a full recurve longbow in her left hand, an arrow nocked and drawn to her cheek, and a quiver of fletched arrows at her hip',
    pose: 'pulled-back three-quarter ranger stance, left hand holding the full recurve bow while the nocked arrow is drawn to her cheek, with the bow limbs and string fully in frame',
    mood: 'watchful, patient, and ready to loose the shot before the border is crossed',
    lighting: 'cool morning sun as key across the face, bow, and cloak; green forest rim through the leaves and palisade',
  },
  'ac-chapel-mender': {
    kind: 'an adult priestess healer, a chapel mender who treats armor as a patient rather than a costume',
    costume: 'flowing white-and-gold vestments and a sheer veil, with no armor worn and a rosary at the wrist',
    background: 'a small stone chapel with lilies on the altar and blank votive ribbons hanging near the stained glass',
    props: 'a cracked pauldron resting on the altar as the patient, with the rosary visible at her wrist and no armor on her body',
    pose: 'caught mid-mending with both open hands sending warm golden healing light into the cracked pauldron resting on the altar',
    mood: 'focused, compassionate, and reverent toward the wound she has been trusted to close',
    lighting: 'warm altar-candle key through the healing light and white vestments; cool stained-glass rim along the veil and stone',
  },
  'ac-court-minstrel': {
    kind: 'an adult court minstrel, a bright musician whose song turns a great hall into a shared court ritual',
    costume: 'courtly teal-and-cream silks with ribbon sleeves and a feathered cap, with no armor worn',
    background: 'a great hall with blurred dancers moving behind the performer and warm firelight across the floor',
    props: 'an ornate lute held across the body, with the fretting hand and the mid-strum hand clearly separated',
    pose: 'caught mid-song playing the ornate lute, one hand fretting the strings and the other hand suspended mid-strum',
    mood: 'joyful, theatrical, and perfectly aware of every ear turned toward the melody',
    lighting: 'warm hall firelight as key across the silks, lute, and face; cool window rim on the feathered cap and sleeves',
  },
  'ac-prophecy-attendant': {
    kind: 'an adult scholarly attendant, an astronomer who keeps prophecy moving between hand and instrument',
    costume: 'layered midnight-blue astronomer robes stitched with silver constellations, with no armor worn',
    background: 'a candlelit stone observatory with a great brass telescope and dark windows beyond',
    props: 'a scrying orb of drifting starlight in one palm and brass orrery rings turning around the other hand',
    pose: 'standing in a three-quarter observatory stance, holding the drifting-starlight orb in one palm while the brass orrery rings turn around the other hand',
    mood: 'scholarly, alert, and quietly awed by the future taking shape in both hands',
    lighting: 'the orb\'s cool starlight as key across the face and constellation stitching; warm candle rim on the telescope and robe edges',
  },
  'ac-root-chapel-warden': {
    kind: 'an adult wilderness warden, a living forest guardian whose armor has grown from the chapel ground',
    costume: 'living bark-and-moss armor plates grown over homespun leathers, ivy braided through wild hair, and small white flowers at the collar',
    background: 'a ruined forest chapel swallowed by roots, its altar cracked open by an oak',
    props: 'a wooden polearm sprouting living green shoots, held in a grounded guard with the shoots and head fully visible',
    pose: 'grounded three-quarter guard, holding the wooden polearm sprouting living green shoots across the body as roots break through the ruined altar behind',
    mood: 'steadfast, feral, and protective of the sanctuary the forest has reclaimed',
    lighting: 'dappled green-gold canopy light as key across bark, moss, and flowers; cool mossy rim along the polearm and roots',
  },
  'ac-white-horse': {
    kind: 'a literal caparisoned white warhorse, the set’s approved non-woman animal subject, with no rider and no anthro anatomy',
    costume: 'bright white coat, polished steel bridle and breastplate, white-gold caparison, and a blank crimson pennant',
    background: 'a muddy tournament road beside a stone keep, smoke, chapel light, and distant blank banners',
    props: 'the caparison, bridle, and cleanly separated banner; absolutely no rider, saddle figure, or human limbs',
    pose: 'full-body three-quarter stride with head, torso, and all four legs in frame, bearing the banner through mud and smoke',
    mood: 'steady, noble, and carrying the last clean light through the battle road',
    lighting: 'white-gold daylight as key across coat and steel; cool silver rim along mane and pennant',
  },
};

// These notes preserve the vision-lane observations in the generated bible,
// including accepted register/crop judgments that a future artist should know.
const AUDIT_NOTES: Record<string, string> = {
  'ac-artoria-once-future': 'QA-verified regenerated art: pulled-back three-quarter framing runs from crown to mid-thigh, with the greatsword point-down before the throne-hall dais.',
  'ac-morgan-thorn-crown': 'Morgan is unmistakable; the approved face sits slightly high near y 272.',
  'ac-nimue-lake-sovereign': 'Lady of the Lake read is exact; the face lands near y 323.',
  'ac-lancelot-moonlit-shame': 'QA-verified regenerated art: two solid steel swords are crossed low in a dueling guard, one gripped in each hand, with a single tear track.',
  'ac-guinevere-court-sun': 'Sun-crown runs high and the raw has a decorative inner border; keep any filigree purely pictorial and unreadable.',
  'ac-gawain-noonblade': 'Solar knight read is strong; the crown grazes the upper window and is a smartcrop zoom candidate.',
  'ac-percival-clear-heart': 'The white stag and chapel are the approved secondary read; the face sits near y 268.',
  'ac-galahad-silver-oath': 'Holy paladin and halo read clearly; the face is high near y 213, so preserve the full halo during crop.',
  'ac-merlin-crow-clock': 'Mechanical crow and astrolabe/clock motifs are present; all clock faces remain non-numerical and the face sits near y 222.',
  'ac-mordred-bastard-star': 'Villain read is excellent; the ponytail and crown approach the ceiling but remain part of the approved silhouette.',
  'ac-camelot-banneret': 'Blank banner is verified; the face near y 342 is the strongest-composed raw in the second batch.',
  'ac-lakeblade-initiate': 'Lake-blade identity is clear; the approved face sits near the visible-band edge at y 165.',
  'ac-chapel-questant': 'Grail-chalice tell is clear; the face sits near y 159 and benefits from crop zoom.',
  'ac-ashwood-ranger': 'The approved raw uses a wide forest shot with a small face near y 187; keep the bow and border readable.',
  'ac-velvet-court-spy': 'QA-verified regenerated art: dark plum velvet, a reversed stiletto along the forearm, and the shadowed palace corridor restore the stealth read.',
  'ac-tournament-favorite': 'The lunge verb reads well; face near y 176 and the lance remains cleanly separated.',
  'ac-questing-beast-maiden': 'The approved direction requires the full Questing Beast companion and its chimeric anatomy beside the maiden.',
  'ac-lady-of-lilies': 'Pictorial grail-sigil read is present; face near y 232.',
  'ac-grail-hermit': 'QA-verified regenerated art: humble undyed homespun, a loose plain braid, and a faintly glowing wooden cup replace the armored-paladin read.',
  'ac-raven-of-camlann': 'Center fallback is expected for the non-humanoid raven; wings-spread airborne read is confirmed.',
  'ac-oathbroken-knight': 'The approved armor reads pristine rather than fallen; preserve the dangerous oathbroken mood without forced grime.',
  'ac-novice-squire': 'Adult-coded squire is confirmed; face near y 90 is the worst crop candidate, so retain crop-safe headroom.',
  'ac-keep-watchwoman': 'Castle guard read is clear; face near y 111 is a zoom-crop candidate.',
  'ac-lake-attendant': 'Avalon attendant read is clear; face near y 133 benefits from a tighter crop.',
  'ac-court-minstrel': 'QA-verified regenerated art: the minstrel is caught mid-song on an ornate lute, with one hand fretting and the other mid-strum.',
  'ac-torchbearer-knight': 'Approved art must show the blazing torch high in the right fist during the rallying shout, in the night courtyard.',
  'ac-borderland-huntress': 'QA-verified regenerated art: the full recurve bow is in her left hand, the arrow is nocked and drawn to her cheek, and the quiver is at her hip.',
  'ac-chapel-mender': 'QA-verified regenerated art: the priestess wears no armor and mends a cracked pauldron on the altar with open hands and golden healing light.',
  'ac-castle-blackguard': 'Thorn greatsword is the approved silhouette; face near y 122 is a zoom-crop candidate.',
  'ac-white-horse': 'Literal caparisoned white warhorse is confirmed; no rider, no anthro anatomy, and head near y 112.',
  'ac-riverford-guard': 'Riverford guard read is clear; face near y 193.',
  'ac-errant-duelist': 'Dynamic lunge reads well; face near y 278.',
  'ac-root-chapel-warden': 'QA-verified regenerated art: bark-and-moss armor grows over homespun leathers, and the living-shoot polearm is held in a grounded guard.',
  'ac-pennant-carrier': 'Pennant is verified blank; face near y 239.',
  'ac-court-archer': 'Longbow grip reads correctly; face near y 201.',
  'ac-prophecy-attendant': 'QA-verified regenerated art: the attendant holds a drifting-starlight scrying orb in one palm while brass orrery rings turn around the other.',
};

function artFor(card: CardDef): Art {
  const override = CARD_OVERRIDES[card.id];
  if (override) return override;
  for (const subtype of card.subtypes) {
    const art = BY_SUB[subtype];
    if (art) return art;
  }
  return COLOR_FALLBACK[card.colors[0] ?? 'C'];
}

function mechanicalNote(card: CardDef): string {
  const keywords = card.keywords ?? [];
  const ops = (card.abilities ?? []).flatMap((ability) => (ability.ops ?? []).map((op) => op.op));
  const notes: string[] = [];
  if (keywords.includes('sentinel') || keywords.includes('bulwark')) notes.push('a steadfast keeper of a gate, oath, or formation');
  if (keywords.includes('firstBlade')) notes.push('a first-strike duelist');
  if (keywords.includes('twinBlades')) notes.push('a dual-blade champion');
  if (keywords.includes('untouchable')) notes.push('a difficult-to-answer quest champion');
  if (keywords.includes('bloodoath')) notes.push('a vow made potent by sacrifice');
  if (keywords.includes('deathblade')) notes.push('lethal at a single precise touch');
  if (keywords.includes('warcry') || keywords.includes('overrun')) notes.push('an aggressive rally or hunt leader');
  if (keywords.includes('skyborne')) notes.push('an airborne omen');
  if (ops.includes('foresee')) notes.push('a reader and arranger of fate');
  if (ops.includes('severGrave')) notes.push('a keeper of the grave-side veil');
  if (ops.includes('createToken')) notes.push('a caller of Squire retainers');
  if (ops.includes('gainLife')) notes.push('a conduit for grail or chapel restoration');
  if (ops.includes('draw')) notes.push('a court engine that turns an active Quest into advantage');
  if (card.awakening) notes.push('a dormant champion with a visible awakening path');
  return notes.length ? notes.join(', ') : 'a poised, immediate presence on the battlefield';
}

function holoNote(card: CardDef): string {
  const finish = HOLO[card.rarity];
  if (finish === 'none') return 'No signature holo; keep face, steel planes, and central action clean for the common card read.';
  if (finish === 'sheen') return 'Sheen; let a moving shine pass across textured steel, velvet, and pennant thread without flattening the face.';
  if (finish === 'foil') return 'Foil; place material texture in polished plate, embroidery, lake ripples, or grail metal while keeping faces and flat darks quiet.';
  if (finish === 'radial') return 'Radial; center the glow in the crown, blade, chapel window, or court sun so concentric rings reinforce the composition.';
  return 'Galaxy; keep the background dark and high-contrast so the nebula inhabits the lake or night sky while the face and blade stay bright.';
}

function shortName(name: string): string {
  return name.split(/[,—]/)[0].trim();
}

function entry(card: CardDef): string {
  const art = artFor(card);
  const flavor = (card.flavor ?? '').replace(/"/g, '”');
  const promptSubject = art.kind.startsWith(shortName(card.name)) ? art.kind : `${shortName(card.name)}, ${art.kind}`;
  const prompt =
    `${promptSubject}, wearing ${art.costume}; ${art.pose}; ${art.mood}; against ${art.background}; ${art.lighting}; ` +
    'reserve the entire top third as clear, empty sky, lake haze, or chapel air above the head, crown, mane, or wings so the full silhouette survives smart-crop; ' +
    'no readable letters, numerals, runes, heraldic text, banners with writing, cards, mirrors with writing, logos, or watermarks anywhere';
  return [
    `### ${card.name} — \`${card.id}\``,
    `- **Card facts:** ${factsLine(card)}`,
    `- **Character & source:** ${art.kind}; mechanically ${mechanicalNote(card)}. Approved-art audit: ${AUDIT_NOTES[card.id] ?? 'Approved raw reviewed for adult-coded subject, clear kit, and crop-safe silhouette.'}`,
    `- **Personality / mood:** ${flavor ? `“${flavor}” — ` : ''}${art.mood}.`,
    `- **Pose & composition:** ${art.pose}; face ≈ y 320 and eye-line ≈ y 300–360 where humanoid, with the full species anatomy and defining prop in frame. The entire top third stays clear above the head, crown, mane, or wings for crop-safe headroom.`,
    `- **Costume & attire:** ${art.costume}.`,
    `- **Palette:** ${paletteOf(card)}; Arthurian accents — polished steel, white-gold sunlight, chapel ivory, crimson pennants, moonlit lake blue, thorn black, and grail radiance — reinforce the card color without becoming Celtic Fae mist/thorn.` ,
    `- **Lighting:** ${art.lighting}.`,
    `- **Expression:** ${art.mood}.`,
    `- **Props / weapon:** ${art.props}.`,
    `- **Background:** ${art.background}. Keep scene detail subordinate to the action while preserving the approved court anchor.`,
    `- **Holo interaction:** ${holoNote(card)}`,
    `- **Rarity ambition:** ${RARITY_AMBITION[card.rarity]}`,
    `- **Prompt:** ${prompt} ${PROMPT_SUFFIX}`,
  ].join('\n');
}

const creatures = (ARTHURIAN_COURT as readonly CardDef[]).filter((card) => card.types.includes('creature'));
const creatureSubtypes = [...new Set(creatures.flatMap((card) => card.subtypes))];
const missingSubtypeDirections = creatureSubtypes.filter((subtype) => !BY_SUB[subtype]);
if (missingSubtypeDirections.length > 0) {
  throw new Error(`gen-arthuriancourt-artbible: missing BY_SUB directions for ${missingSubtypeDirections.join(', ')}`);
}
const fallbackIds = creatures.filter((card) => !card.subtypes.some((subtype) => BY_SUB[subtype])).map((card) => card.id);

const header = `<!-- source-of-truth: src/data/cards/arthurian-court.ts, docs/expansions/arthurian-court.md · last-verified: 2026-07-16 -->

# Darling Blades Art Bible — Arthurian Court (\`ac\`)

Arthurian Court is the polished-steel half of the Celtic/Arthurian two-set block:
adult-coded, genderbent court figures carry vows through white-gold sunlight,
crimson pennants, moonlit lakes, chapel windows, tournament grounds, stone
keeps, thorned crowns, grail radiance, and enchanted blades. Court fabrics and
steel must read distinct from Celtic Fae mist and thorn silhouettes. Quests use
blank illuminated-manuscript panels and pictorial chapel reliefs only: no
letters, numerals, runes, heraldic writing, or readable seals. Compose the
mechanical verb, keep every species-defining feature in frame, and reserve a
clear empty top third above the tallest silhouette for smart-crop headroom.
The approved audit raws are the visual source; these entries preserve their
specific reads, including the literal white horse and raven subjects.
`;

const body = creatures.map(entry).join('\n\n');
const output = `${header}\n${body}\n`;
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'art-bible');
writeFileSync(join(dir, 'arthurian-court.md'), output, 'utf8');
console.log(
  `gen-arthuriancourt-artbible: wrote ${creatures.length} entries to docs/art-bible/arthurian-court.md; ` +
    `${creatureSubtypes.length} subtype directions; COLOR_FALLBACK used by ${fallbackIds.length}` +
    (fallbackIds.length ? ` (${fallbackIds.join(', ')})` : ' (none)'),
);
