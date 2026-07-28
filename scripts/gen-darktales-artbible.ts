import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DARK_TALES } from '../src/data/cards/dark-tales';
import { TOKENS } from '../src/data/cards/tokens';
import type { CardDef, Color } from '../src/data/cardTypes';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = readFileSync(join(root, 'docs', 'expansions', 'dark-tales.md'), 'utf8');
const subjectById = new Map<string, string>();
for (const line of spec.split(/\r?\n/)) {
  if (!line.startsWith('| dt-')) continue;
  const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
  subjectById.set(cells[0], cells[5]);
}

const TOKEN_SUBJECTS: Record<string, string> = {
  'tok-shadow-miner': 'Set-unique Shadow Miner token',
  'tok-firefly': 'Set-unique Firefly token',
  'tok-masked-guest': 'Set-unique Masked Guest token',
  'tok-hearth-spirit': 'Set-unique Hearth Spirit token',
};

const darkTokens = TOKENS.filter((card) => TOKEN_SUBJECTS[card.id]);
const cards = [
  ...DARK_TALES.filter((card) => card.types.includes('creature')),
  ...darkTokens,
];

const colors = (card: CardDef): string => {
  const letters = card.colors.length > 0 ? card.colors.join('/') : 'C';
  return card.colors.length >= 2 ? `${letters} (gold frame)` : letters;
};

const mana = (card: CardDef): string => {
  if (!card.cost) return '{0}';
  const parts: string[] = [];
  if (card.cost.generic > 0) parts.push(`{${card.cost.generic}}`);
  for (const color of ['W', 'U', 'B', 'R', 'G'] as Color[]) {
    for (let i = 0; i < (card.cost.pips[color] ?? 0); i++) parts.push(`{${color}}`);
  }
  return parts.join('') || '{0}';
};

const facts = (card: CardDef): string => {
  const parts = [mana(card), colors(card), `${card.attack}/${card.defense}`];
  if (card.keywords?.length) parts.push(card.keywords.join(', '));
  parts.push(`${card.rarity}${card.supertypes?.includes('legendary') ? ', legendary' : ''}`);
  return parts.join(' · ');
};

const rarityAmbition = (card: CardDef): string => {
  if (card.token) return 'Token reference sheet: clear silhouette, readable P/T, and a strong single prop.';
  if (card.rarity === 'ur') return 'Marquee Dark Tales key visual with a composed adult-coded silhouette.';
  if (card.rarity === 'ssr') return 'Premium storybook plate with a theatrical focal pose and rich gothic material.';
  if (card.rarity === 'sr') return 'Distinctive supporting plate with a clear motif and controlled glamour.';
  if (card.rarity === 'r') return 'Strong set identity at binder scale, with the mechanical read visible in the pose.';
  return 'Clean common read: one subject, one prop, and a simple storybook silhouette.';
};

const subject = (card: CardDef): string => subjectById.get(card.id) ?? TOKEN_SUBJECTS[card.id] ?? card.name;
const artKind = (card: CardDef): string =>
  card.token ? `an adult-coded gothic token figure representing ${card.name}` : `an adult-coded Dark Tales figure representing ${card.name}`;

function entry(card: CardDef): string {
  const sourceSubject = subject(card);
  const mood = card.token ? 'clear, emblematic, and alert' : 'glamorous, watchful, and touched by a dangerous bargain';
  const palette = card.colors.length ? card.colors.join('/') : 'colorless storybook palette';
  const pose = card.keywords?.includes('skyborne')
    ? 'airborne in a readable three-quarter pose with the face centered'
    : 'framed in a readable three-quarter pose with the face centered';
  const props = card.token ? 'one simple silhouette-defining prop with no lettering' : 'a single motif prop from the Subject column, kept blank of lettering';
  const background = card.token ? 'a simplified moonlit storybook vignette' : 'a moonlit gothic fairy-tale setting with black roses, glass, satin, and candlelit depth';
  const prompt = `${card.name}, ${artKind(card)}, based on the pre-acceptance Subject draft "${sourceSubject}"; ${pose}; ${mood}; ${props}; ${background}; reserve the entire top third as clear empty moonlit air above the head and silhouette; no readable letters, runes, labels, logos, or watermarks anywhere — crisp cel-shaded gacha anime splash art, fully rendered scenic background, 640×800 portrait`;
  return [
    `### ${card.name} — \`${card.id}\``,
    `- **Card facts:** ${facts(card)}`,
    `- **Character & source:** Pre-acceptance draft from the Dark Tales Subject column: ${sourceSubject}. ${artKind(card)}; the final art pass must preserve the set's adult gothic glamour.`,
    `- **Personality / mood:** ${mood}.`,
    `- **Pose & composition:** ${pose}. Keep the face and the main silhouette in the central band, with crop-safe headroom above.`,
    `- **Costume & attire:** Dark Tales gothic glamour, adult-coded proportions, satin, glass, thorn, or moonlit material cues chosen from the Subject draft.`,
    `- **Palette:** ${palette}; midnight blue, candle gold, black rose, pearl, glass, and restrained color accents.`,
    `- **Lighting:** Cool moon key with a warm candle or lantern rim that separates the silhouette from the background.`,
    `- **Expression:** ${mood}.`,
    `- **Props / weapon:** ${props}.`,
    `- **Background:** ${background}; keep books, mirrors, invitations, banners, and pages blank or decorative.`,
    `- **Holo interaction:** Keep the face, P/T focal silhouette, and signature prop readable under every holo finish; let reflective material carry the special treatment.`,
    `- **Rarity ambition:** ${rarityAmbition(card)}`,
    `- **Prompt:** ${prompt}`,
  ].join('\n');
}

const header = `<!-- source-of-truth: src/data/cards/dark-tales.ts, src/data/cards/tokens.ts, docs/expansions/dark-tales.md · last-verified: 2026-07-23 -->

# Darling Blades Art Bible - Dark Tales (\`dt\`)

Dark Tales is the cursed storybook: adult-coded gothic fairy-tale glamour in
moonlit blue, black rose, pearl foam, glass, satin, thorn halos, gilded cages,
candlelit libraries, and midnight magic. These are **pre-acceptance art drafts**
derived from each table row's Subject column. Preserve the original parody
names and silhouettes, keep every book, mirror, invitation, page, and banner
blank or decorative, and reserve a clear top third for crop-safe headroom.
`;

const output = `${header}\n${cards.map(entry).join('\n\n')}\n`;
const outputPath = join(root, 'docs', 'art-bible', 'dark-tales.md');
writeFileSync(outputPath, output, 'utf8');
console.log(`gen-darktales-artbible: wrote ${cards.length} entries to docs/art-bible/dark-tales.md`);
