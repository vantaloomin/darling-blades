/**
 * One-off generator for docs/art-bible/ragnarok.md. Emits a 13-field art-bible
 * entry for every creature in the Ragnarök set (src/data/cards/ragnarok.ts), in
 * source-file order. The Card-facts line is computed EXACTLY from the card data
 * so `npm run check-art-bible` passes; the prose fields are Norse art direction
 * keyed by the card's primary subtype, color palette, and its own flavor text.
 * Re-run after editing the set: `npx tsx scripts/gen-ragnarok-artbible.ts`.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAGNAROK } from '../src/data/cards/ragnarok';
import type { CardDef, Color, ManaCost } from '../src/data/cardTypes';

const SUFFIX =
  '— crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait';
const WUBRG: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
const HOLO: Record<string, string> = {
  c: 'none',
  r: 'shiny',
  sr: 'radiant foil',
  ssr: 'prismatic aurora',
  ur: 'void',
};
const RARITY_AMBITION: Record<string, string> = {
  c: 'Common — one clear figure, one idea, a simple two-value background.',
  r: 'Uncommon — the figure plus one environmental story beat or a beat of motion.',
  sr: 'Rare "moment" — dramatic light and the split second the mechanic implies.',
  ssr: 'Legendary splash — full hero shot with a secondary canon element in frame.',
  ur: 'Marquee legend — the biggest hero splash in the set; the background participates.',
};

function costStr(cost?: ManaCost): string {
  if (!cost) return '{0}';
  let s = cost.generic > 0 ? `{${cost.generic}}` : '';
  for (const c of WUBRG) for (let i = 0; i < (cost.pips[c] ?? 0); i++) s += `{${c}}`;
  return s || '{0}';
}

function colorStr(card: CardDef): string {
  if (card.colors.length === 0) return 'C';
  return card.colors.join('/') + (card.colors.length >= 2 ? ' (gold frame)' : '');
}

function factsLine(card: CardDef): string {
  const legendary = card.supertypes?.includes('legendary') ?? false;
  const parts = [costStr(card.cost), colorStr(card), `${card.power}/${card.toughness}`];
  if (card.keywords?.length) parts.push(card.keywords.join(', '));
  parts.push(`${card.rarity}${legendary ? ', legendary' : ''}`);
  parts.push(`holo: ${HOLO[card.rarity]}`);
  return parts.join(' · ');
}

const PALETTE: Record<string, string> = {
  W: 'W palette (`#f2e8cf` → `#c9a84c`, accent `#fffef2`) — bleached bone and pale gold',
  U: 'U palette (`#4a90d9` → `#16294f`, accent `#a8d4f7`) — glacier blue and mist-grey',
  B: 'B palette (`#5a3a70` → `#140d1c`, accent `#9b6fc4`) — grave-violet and ash-black',
  R: 'R palette (`#d95436` → `#5e0f0f`, accent `#f7b267`) — ember and blood-red',
  G: 'G palette (`#4fa06a` → `#123a22`, accent `#a9dcae`) — pine-dark and moss',
  gold: 'gold multicolor palette (`#e8c95a` → `#7a5a18`, accent `#fff2b8`)',
  C: 'colorless palette (`#a9adb5` → `#4e535c`) — worn iron and stone',
};
const paletteOf = (card: CardDef): string =>
  card.colors.length >= 2 ? PALETTE.gold : PALETTE[card.colors[0] ?? 'C'];

interface Art {
  kind: string;
  costume: string;
  bg: string;
  props: string;
  pose: string;
  expr: string;
  light: string;
}

// Priority-ordered subtype art direction. First match wins; else a color fallback.
const BY_SUB: Record<string, Art> = {
  Valkyrie: {
    kind: 'a winged Valkyrie, a chooser of the slain',
    costume: 'gold-chased scale mail over a great feathered cloak, a winged helm',
    bg: 'a storm-lit battlefield seen from above the clouds, an aurora banding the sky',
    props: 'a spear and a round shield, broad feathered wings',
    pose: 'descending mid-flight with wings flared, one boot about to touch the field',
    expr: 'serene and judging, already deciding who the day remembers',
    light: 'a cold aurora key with a warm rune-gold rim off the mail',
  },
  Norn: {
    kind: 'a Norn, a weaver of fate at the world-well',
    costume: 'layered rune-embroidered robes and a veil of drifting mist',
    bg: 'the Well of Urd beneath a root of Yggdrasil, threads of fate glinting in the air',
    props: 'a carved spindle, rune-staves, and a bowl of still dark water',
    pose: 'seated at the loom of fate, reading a thread drawn taut between her hands',
    expr: 'unreadable and ancient, seeing the ending already written',
    light: 'a pale well-glow from below with a violet rim',
  },
  Draugr: {
    kind: 'a Draugr, a barrow-dead warrior risen from the howe',
    costume: 'rusted grave-mail and torn burial finery, cold grave-fire burning in the eye-sockets',
    bg: 'a cracked-open barrow mound spilling blue grave-light over black earth',
    props: 'a corroded blade and a fistful of hoarded gold',
    pose: 'hauling upright out of the grave-earth, blade first',
    expr: 'hateful and patient, robbed of everything but the grudge',
    light: 'a cold blue grave-fire key, near-black fill',
  },
  Jotun: {
    kind: 'a towering Jotun giant-woman of the elemental wilds',
    costume: 'rough hide and rime-crusted plate, primal bone-and-gold jewelry',
    bg: 'a shattered mountain pass under a bruised, wind-torn sky',
    props: 'a boulder-headed maul, or bare fists like millstones',
    pose: 'looming from a low angle, one stride that is itself an earthquake',
    expr: 'slow, immovable, and entirely certain',
    light: 'a stark high key with a long cold rim down one flank',
  },
  Einherjar: {
    kind: 'an Einherjar, an honored dead warrior of the feast-hall',
    costume: 'scarred lamellar and furs, a warm Valhalla feast-glow caught in the mail',
    bg: 'the mead-hall of the slain — long-fires, shield-hung walls, raftered dark',
    props: 'a notched sword and a battered, well-loved shield',
    pose: 'mid-stride into the charge, weapon already committed',
    expr: 'grim and elated at once — dies every night, wins every morning',
    light: 'a warm hearth-fire key with a steel rim on the blade',
  },
  Shieldmaiden: {
    kind: 'a viking Shieldmaiden of the raiding-line',
    costume: 'braided hair, ring-mail over leather, a painted round shield',
    bg: 'a burning coastal longhouse and a beached longship at low tide',
    props: 'a bearded axe and a round shield',
    pose: 'shield up, axe cocked back over the shoulder for the swing',
    expr: 'fierce and laughing, in her element',
    light: 'a hot firelight key from the burning hall, cool sea rim',
  },
  Wolf: {
    kind: "a great dire-wolf of Fenrir's brood",
    costume: 'thick hackled winter fur, breath steaming',
    bg: 'a moonlit frost-forest, snow churned by the pack',
    props: 'bared fangs and claws',
    pose: 'mid-lunge, low and fast, closing the distance',
    expr: 'feral, fixed on the throat',
    light: 'a cold moonlight key, blue snow-bounce fill',
  },
  Vanir: {
    kind: 'a Vanir deity of seiðr and green growth',
    costume: 'flowing seiðr robes in amber and gold, living vines worked through the cloth',
    bg: 'a sunlit sacred grove around a great root of the world-tree',
    props: 'golden apples, a distaff, or a falcon-feather cloak',
    pose: 'one hand raised in a working, growth answering the gesture',
    expr: 'warm and knowing, unbothered by the twilight of the gods',
    light: 'a warm dappled sun-through-leaves key, soft green fill',
  },
  Aesir: {
    kind: 'an Aesir deity of the high seats',
    costume: 'the regalia of Asgard — dark iron and cold gold, a god-mark at the brow',
    bg: 'a hall of the gods opening onto a frozen underworld, an aurora far off',
    props: 'a god-mark relic held with total ownership',
    pose: 'enthroned or standing sovereign, weight utterly settled',
    expr: 'cold, sovereign, already several moves ahead',
    light: 'a low regal key with a hard cold rim',
  },
  Spirit: {
    kind: 'a mist-wraith shade of the fens',
    costume: 'tattered translucent shrouds trailing away into vapor',
    bg: 'a fog-drowned fen at dusk, shapes half-guessed in the murk',
    props: 'clawed hands that fray into mist',
    pose: 'half-dissolved, drifting forward faster than mist should move',
    expr: 'hollow and hungry',
    light: 'a low grey diffuse key, no hard shadows',
  },
  Cleric: {
    kind: 'an oathbound priestess of the old rites',
    costume: 'pale vestments and a rune-graven torc, a warm blessing-light at her hands',
    bg: 'a rune-carved stave-shrine at first light',
    props: 'a blessing-bowl and a graven oath-ring',
    pose: 'hands raised mid-blessing, light pooling around them',
    expr: 'calm and certain of the oath',
    light: 'a warm dawn key with a soft gold bloom',
  },
  // Deepening factions keep their home aesthetic, tinted by the twilight event.
  Shu: {
    kind: 'a genderbent Three Kingdoms Shu officer, returned deathless',
    costume: 'jade-and-ivory lamellar and officer robes, a faint grave-pallor over the skin',
    bg: 'a rammed-earth rampart under a bannered dusk, cranes over the walls',
    props: 'her signature polearm, held with a duelist’s certainty',
    pose: 'a single-combat lunge, spear driving through the guard',
    expr: 'righteous and unfaltering — the oath outlived everyone who swore it',
    light: 'a warm banner-torch key with a cool steel rim on the blade',
  },
  Wei: {
    kind: 'a genderbent Three Kingdoms Wei officer, returned deathless',
    costume: 'lapis-and-bronze plate over a scholar-officer’s robe, high collar, cool grave-pallor',
    bg: 'a watchtower and command tents on the disciplined northern plain',
    props: 'a heavy blade or halberd swung with reckless strength',
    pose: 'a full-body cleaving strike, armor half-shed for speed',
    expr: 'ferocious, past caring for her own defense',
    light: 'a hard overcast key with a bronze rim',
  },
  Olympian: {
    kind: 'a Greek underworld power, drawn up by the twilight',
    costume: 'sun-bleached marble whites and gilt over a draped chiton, an ashen underworld tint',
    bg: 'the far bank of the Styx under a starless sky, asphodel underfoot',
    props: 'a ferryman’s pole or a quiet, certain instrument of death',
    pose: 'a slow, patient advance across the dark water',
    expr: 'gentle and absolutely certain of the appointment',
    light: 'a low cold underworld key, single gilt rim',
  },
  Beastkin: {
    kind: 'an ancestral beast-girl spirit of the old wilds',
    costume: 'furs and bone-charms over layered wraps, her species’ ears and tail non-negotiable',
    bg: 'a snow-laden ancestor-grove hung with offering-cords',
    props: 'a hunting weapon and a beast-token of her line',
    pose: 'a low predatory ready-stance, weight forward',
    expr: 'wild and watchful',
    light: 'a cold woodland key, warm ember rim',
  },
};

const COLOR_FALLBACK: Record<string, Art> = {
  W: BY_SUB.Cleric,
  U: BY_SUB.Norn,
  B: BY_SUB.Draugr,
  R: BY_SUB.Einherjar,
  G: BY_SUB.Jotun,
};

function artFor(card: CardDef): Art {
  for (const key of Object.keys(BY_SUB)) {
    if (card.subtypes.includes(key)) return BY_SUB[key];
  }
  return COLOR_FALLBACK[card.colors[0] ?? 'R'] ?? BY_SUB.Einherjar;
}

function mechanicalNote(card: CardDef): string {
  const kw = card.keywords ?? [];
  const ops = (card.abilities ?? []).flatMap((a) => (a.ops ?? []).map((o) => o.op));
  const notes: string[] = [];
  if (kw.includes('doubleStrike')) notes.push('an elite duelist who strikes twice');
  if (kw.includes('flying')) notes.push('an airborne threat');
  if (kw.includes('deathtouch')) notes.push('lethal at a touch');
  if (kw.includes('trample')) notes.push('an unstoppable bruiser');
  if (ops.includes('mill')) notes.push('she feeds the graveyard');
  if (ops.includes('reanimate')) notes.push('she calls the fallen back to the field');
  if (ops.includes('createToken')) notes.push('she brings a host with her');
  return notes.length ? notes.join(', ') : 'a straightforward body on the battlefield';
}

function holoNote(card: CardDef): string {
  const finish = HOLO[card.rarity];
  if (finish === 'none') return 'No signature holo; build clean readable value so a pulled shiny/rainbow foil reads well.';
  return `Rolled specials favor ${finish} — concentrate texture variance in the metal, cloth-trim, and any relic so the finish lands there and the face stays quiet.`;
}

function shortName(name: string): string {
  return name.split(/[,—]/)[0].trim();
}

function entry(card: CardDef): string {
  const a = artFor(card);
  const flavor = (card.flavor ?? '').replace(/"/g, '”');
  const promptBody =
    `${shortName(card.name)}, ${a.kind}, in ${a.costume}; ${a.pose}, against ${a.bg}; ` +
    `${a.expr}; ${a.light}`;
  return [
    `### ${card.name} — \`${card.id}\``,
    `- **Card facts:** ${factsLine(card)}`,
    `- **Character & source:** ${a.kind}; mechanically ${mechanicalNote(card)}.`,
    `- **Personality / mood:** ${flavor ? `"${flavor}" — ` : ''}${a.expr}.`,
    `- **Pose & composition:** ${a.pose}; face ≈ y 320, eye-line ≈ y 300–360, weapon or effect free to break the top of the band.`,
    `- **Costume & attire:** ${a.costume}.`,
    `- **Palette:** ${paletteOf(card)}; Ragnarök accents — glacier blue-white, aurora green-violet, runic gold, and ash — layered over the color anchor, never replacing it.`,
    `- **Lighting:** ${a.light}.`,
    `- **Expression:** ${a.expr}.`,
    `- **Props / weapon:** ${a.props}.`,
    `- **Background:** ${a.bg}.`,
    `- **Holo interaction:** ${holoNote(card)}`,
    `- **Rarity ambition:** ${RARITY_AMBITION[card.rarity]}`,
    `- **Prompt:** ${promptBody} ${SUFFIX}`,
  ].join('\n');
}

const creatures = (RAGNAROK as readonly CardDef[]).filter((c) => c.types.includes('creature'));
const header = `<!-- source-of-truth: src/data/cards/ragnarok.ts · last-verified: 2026-07-05 -->

# Darling Blades Art Bible — Ragnarök (\`rg\`)

The 1st expansion reads as one civilization at its twilight: a Norse pantheon
(Valkyries, Norns, Jotun, Draugr, the death-goddess Hel) with a graveyard soul,
joined by the honored dead of the existing worlds. The faction accents —
**glacier blue-white**, **aurora green-violet**, **runic gold**, and **ash** —
layer over each card's color-identity anchor and never replace it. Costume
language is furs, ring-mail and scale, rune-graven metal, and feathered cloaks;
architecture is barrow, stave-shrine, mead-hall, and mountain pass; nature is
frost-forest, fen, and aurora-lit sky. Every figure is an adult woman;
genderbent characters keep their source kit. Deepening entries (Shu/Wei
duelists, a Greek underworld shade) keep their home aesthetic, tinted by the
twilight event. Hard NO-TEXT rule: banners and runestones render blank or
patterned, never lettered.
`;

const body = creatures.map(entry).join('\n\n');
const out = `${header}\n${body}\n`;
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'art-bible');
writeFileSync(join(dir, 'ragnarok.md'), out, 'utf8');
console.log(`gen-ragnarok-artbible: wrote ${creatures.length} entries to docs/art-bible/ragnarok.md`);
