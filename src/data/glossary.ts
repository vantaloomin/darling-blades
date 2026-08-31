import type { CardDef, CardType, Color, EffectOp, Keyword, Rarity } from '../engine/types';

/**
 * The rules vocabulary, as pure data. This lives in `src/data` — not in the
 * Phaser layer — because three consumers need it and only one of them renders:
 * the Glossary scene, the card-face rules text (`src/ui/rulesText.ts`), and
 * Collection / Deck Builder search (`src/meta/collectionFilter.ts`, which the
 * layer-purity lint forbids from importing anything under `src/ui`).
 *
 * Adding a term is an edit to exactly one table in this file. Every table is
 * keyed by a closed union, so a new keyword or mechanic fails the typecheck
 * until its name, its reminder, and its glossary section all exist.
 */

export const KEYWORD_NAMES: Record<Keyword, string> = {
  skyborne: 'Skyborne',
  wardingGaze: 'Warding Gaze',
  firstBlade: 'First Blade',
  twinBlades: 'Twin Blades',
  warcry: 'Warcry',
  overrun: 'Overrun',
  sentinel: 'Sentinel',
  bulwark: 'Bulwark',
  deathblade: 'Deathblade',
  bloodoath: 'Blood Oath',
  untouchable: 'Untouchable',
  dreaded: 'Dreaded',
  rage: 'Rage',
};

/** One-line, player-facing reminder for each evergreen keyword. */
export const KEYWORD_REMINDER: Record<Keyword, string> = {
  skyborne: 'can only be blocked by creatures with Skyborne or Warding Gaze',
  wardingGaze: 'can block creatures with Skyborne',
  firstBlade: 'deals combat damage before creatures without First Blade',
  twinBlades: 'deals combat damage both before and alongside other creatures',
  warcry: 'can attack and tap the turn it arrives',
  overrun: 'excess combat damage past its blockers is dealt to the player',
  sentinel: 'attacking does not cause it to tap',
  bulwark: 'cannot attack',
  deathblade: 'any amount of damage it deals to a creature is lethal',
  bloodoath: 'damage it deals also gains you that much life',
  untouchable: 'cannot be targeted by spells or abilities your opponents control',
  dreaded: 'cannot be blocked except by two or more creatures',
  rage: 'attacks every turn if it is able to',
};

/** Named mechanics that are not creature keywords. */
export type MechanicId =
  | 'sever'
  | 'foresee'
  | 'mark'
  | 'propagate'
  | 'quest'
  | 'championAwakening'
  | 'empower'
  | 'skim'
  | 'retell'
  | 'hauntlink'
  | 'rite'
  | 'nineLives'
  | 'preserve';

export const MECHANIC_NAMES: Record<MechanicId, string> = {
  sever: 'Sever',
  foresee: 'Foresee',
  mark: 'Mark',
  propagate: 'Propagate',
  quest: 'Quest',
  championAwakening: 'Champion Awakening',
  empower: 'Empower',
  skim: 'Skim',
  retell: 'Retell',
  hauntlink: 'Hauntlink',
  rite: 'Rite',
  nineLives: 'Nine Lives',
  preserve: 'Preserve',
};

/** One-line, player-facing definitions for non-keyword mechanics. */
export const MECHANIC_DEFINITIONS: Record<MechanicId, string> = {
  sever: 'severed from the game; severed cards never return',
  foresee: 'look at the top cards of your deck; put any of them on the bottom',
  mark: 'a lasting +1/+1 increase to a creature\'s Attack and Defense',
  propagate: 'put another Mark on each Marked creature you control; it never starts a Mark',
  quest: 'advances a chapter at each of your dawns; leaves after the last',
  championAwakening: 'a one-way upgrade granting the listed stats and keywords',
  empower: 'pay the extra cost as you cast this for the listed bonus effect',
  skim: 'pay the listed cost, discard this card, then draw a card',
  retell: 'cast this from your graveyard for the listed cost, then sever it',
  hauntlink: 'pay Hauntlink at Charm speed to link this permanent to one of your creatures',
  rite: 'as an additional cost to cast this, sacrifice the listed number of creatures',
  nineLives: 'when this dies with no +1/+1 marks on it, it returns to the battlefield with a +1/+1 mark on it',
  preserve: 'pay the listed cost and Sever this card from your graveyard to create a token copy of it; only during your main phase',
};

/** Player-facing rarity tier names, shared by the glossary and the Profile. */
export const RARITY_NAMES: Record<Rarity, string> = {
  c: 'Common',
  r: 'Rare',
  sr: 'Super Rare',
  ssr: 'Super Special Rare',
  ur: 'Ultra Rare',
};

/** One-line player-facing definitions for the card types. */
export const CARD_TYPE_DEFINITIONS: Record<CardType, string> = {
  creature: 'A permanent fighter that can attack and block.',
  charm: 'Cast anytime you have priority, even on the foe\'s turn.',
  ritual: 'Cast only during one of your own main phases.',
  enchantment: 'A lasting spell that changes a creature or the battlefield.',
  artifact: 'A lasting relic with abilities or ongoing effects.',
  land: 'Play one each turn to tap for mana.',
};

// ---------------------------------------------------------------------------
// Structural mechanic detection
// ---------------------------------------------------------------------------

function opImpliesSever(op: EffectOp): boolean {
  return (
    op.op === 'sever' ||
    op.op === 'severGrave' ||
    op.op === 'severTop' ||
    op.op === 'destroyArtifactOrSeverEnchantment'
  );
}

function cardOps(d: CardDef): EffectOp[] {
  const flatten = (ops: readonly EffectOp[]): EffectOp[] => ops.flatMap((op) =>
    op.op === 'ifTargetMarked'
      ? [op, ...flatten(op.then), ...flatten(op.else ?? [])]
      : [op],
  );
  return [
    ...(d.abilities ?? []).flatMap((ab) => flatten(ab.ops ?? [])),
    ...(d.chapters ?? []).flatMap((chapter) => flatten(chapter)),
    ...flatten(d.empower?.ops ?? []),
    ...flatten(d.retell?.ops ?? []),
  ];
}

/**
 * Which named mechanics a card actually uses, read from its structured fields
 * and effect ops rather than from generated prose. `src/ui/rulesText.ts` layers
 * the printed-text view on top of this; search and the glossary read it
 * directly, so a mechanic can never be present on a card yet unfindable.
 *
 * The order is fixed and deliberate: it is the order the card-inspect Keyword
 * Guide lists mechanics in, so it must stay stable even though the Mechanics
 * glossary tab orders its own rows separately (MECHANIC_ORDER below).
 */
export function cardMechanics(d: CardDef): MechanicId[] {
  const ops = cardOps(d);
  const present: MechanicId[] = [];
  if (ops.some((op) => op.op === 'foresee')) present.push('foresee');
  // Retell and Preserve both sever the card as part of their cost, so they
  // teach Sever even when no op on the face says so.
  if (ops.some(opImpliesSever) || d.retell !== undefined || d.preserve !== undefined) present.push('sever');
  // Nine Lives returns the creature WITH a +1/+1 mark, so it teaches Mark too.
  // Propagate is defined entirely in terms of marks, so it teaches Mark as well
  // as itself — a Propagate card that taught only Propagate would leave the
  // player looking up a word its own definition depends on.
  if (ops.some((op) =>
    op.op === 'addCounters' ||
    op.op === 'propagate' ||
    op.op === 'moveMark' ||
    op.op === 'removeMarks' ||
    op.op === 'markAll' ||
    op.op === 'loseLifePerTheirMarked',
  ) || d.nineLives) {
    present.push('mark');
  }
  if (ops.some((op) => op.op === 'propagate')) present.push('propagate');
  if (d.chapters) present.push('quest');
  if (d.awakening || ops.some((op) => op.op === 'awaken')) present.push('championAwakening');
  if (d.empower) present.push('empower');
  if (d.skim) present.push('skim');
  if (d.retell) present.push('retell');
  if (d.hauntlink) present.push('hauntlink');
  if (d.rite) present.push('rite');
  if (d.nineLives) present.push('nineLives');
  if (d.preserve) present.push('preserve');
  return present;
}

/**
 * Every rules term a card teaches, in player-facing spelling: its printed
 * keywords, keywords it grants, and its named mechanics. This is the vocabulary
 * Collection and Deck Builder search match against, so "Nine Lives" and "Twin
 * Blades" find cards the same way "Skyborne" always did.
 */
export function cardTermNames(d: CardDef): string[] {
  const names = new Set<string>();
  for (const k of d.keywords ?? []) names.add(KEYWORD_NAMES[k]);
  for (const op of cardOps(d)) {
    if (op.op === 'boost') for (const k of op.keywords ?? []) names.add(KEYWORD_NAMES[k]);
  }
  for (const ab of d.abilities ?? []) {
    for (const k of ab.static?.grantKeywords ?? []) names.add(KEYWORD_NAMES[k]);
  }
  for (const k of d.awakening?.keywords ?? []) names.add(KEYWORD_NAMES[k]);
  for (const k of d.hauntlink?.linked.grantKeywords ?? []) names.add(KEYWORD_NAMES[k]);
  for (const m of cardMechanics(d)) names.add(MECHANIC_NAMES[m]);
  return [...names];
}

// ---------------------------------------------------------------------------
// Glossary sections
// ---------------------------------------------------------------------------

export type GlossarySectionId = 'combat' | 'mechanics' | 'types' | 'mana' | 'rarity';

/**
 * Everything the icon bake draws a mechanic chip for: the named mechanics plus
 * the two zone terms, which have no card field behind them but still need a
 * glyph so the Mechanics tab has no ragged gutter.
 */
export type MechanicIconId = MechanicId | 'warchest' | 'darlings';

export type GlossaryIcon =
  | { kind: 'keyword'; key: Keyword }
  | { kind: 'mechanic'; key: MechanicIconId }
  | { kind: 'type'; key: CardType }
  | { kind: 'mana'; key: Color }
  | { kind: 'rarity'; key: Rarity }
  | { kind: 'none' };

export interface GlossaryTerm {
  name: string;
  description: string;
  /** Trailing badge for the compact reference rows (mana letter, rarity code). */
  shortLabel?: string;
  icon: GlossaryIcon;
}

export interface GlossarySection {
  id: GlossarySectionId;
  title: string;
  /** One line under the section title, when the section needs framing. */
  note?: string;
  /** Compact sections (mana, rarity) render as icon + name + badge rows. */
  compact?: boolean;
  terms: GlossaryTerm[];
}

const KEYWORD_ORDER = Object.keys(KEYWORD_NAMES) as Keyword[];

/**
 * Zone and format vocabulary that has no card field behind it. These are looked
 * up by name from the Deck Builder's "Read more" links, so their names are
 * load-bearing (`scene.start('Glossary', { focus: 'Darlings' })`).
 */
const ZONE_TERMS: GlossaryTerm[] = [
  {
    name: 'Warchest',
    description:
      'Warchest Reserves hold lands not yet in play. Active Warchest holds your deployed lands. Your Darling waits in her own zone, and each return adds 2 to her next call.',
    icon: { kind: 'mechanic', key: 'warchest' },
  },
  {
    name: 'Darlings',
    description: 'Your Darling waits in her own zone; each time she falls, her next call costs 2 more.',
    icon: { kind: 'mechanic', key: 'darlings' },
  },
];

/** Reading order for the Mechanics tab: shared vocabulary first, then riders. */
const MECHANIC_ORDER: MechanicId[] = [
  'sever',
  'foresee',
  'mark',
  'propagate',
  'quest',
  'championAwakening',
  'empower',
  'skim',
  'retell',
  'hauntlink',
  'rite',
  'nineLives',
  'preserve',
];

export const GLOSSARY_SECTIONS: readonly GlossarySection[] = [
  {
    id: 'combat',
    title: 'Combat Traits',
    note: 'Traits appear in a creature’s rules text.',
    terms: KEYWORD_ORDER.map((keyword) => ({
      name: KEYWORD_NAMES[keyword],
      description: KEYWORD_REMINDER[keyword],
      icon: { kind: 'keyword', key: keyword } as GlossaryIcon,
    })),
  },
  {
    id: 'mechanics',
    title: 'Mechanics',
    note: 'Named rules a card spells out on its face.',
    terms: [
      ...MECHANIC_ORDER.map((mechanic) => ({
        name: MECHANIC_NAMES[mechanic],
        description: MECHANIC_DEFINITIONS[mechanic],
        icon: { kind: 'mechanic', key: mechanic } as GlossaryIcon,
      })),
      ...ZONE_TERMS,
    ],
  },
  {
    id: 'types',
    title: 'Card Types',
    terms: (['creature', 'charm', 'ritual', 'enchantment', 'artifact', 'land'] as CardType[]).map((type) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      description: CARD_TYPE_DEFINITIONS[type],
      icon: { kind: 'type', key: type } as GlossaryIcon,
    })),
  },
  {
    id: 'mana',
    title: 'Mana Colors',
    compact: true,
    terms: [
      { name: 'White', description: 'White mana.', shortLabel: 'W', icon: { kind: 'mana', key: 'W' } },
      { name: 'Blue', description: 'Blue mana.', shortLabel: 'U', icon: { kind: 'mana', key: 'U' } },
      { name: 'Black', description: 'Black mana.', shortLabel: 'B', icon: { kind: 'mana', key: 'B' } },
      { name: 'Red', description: 'Red mana.', shortLabel: 'R', icon: { kind: 'mana', key: 'R' } },
      { name: 'Green', description: 'Green mana.', shortLabel: 'G', icon: { kind: 'mana', key: 'G' } },
    ],
  },
  {
    id: 'rarity',
    title: 'Rarity Tiers',
    compact: true,
    terms: ([
      ['c', 'The most frequent pull.', 'C'],
      ['r', 'One guaranteed in every pack.', 'R'],
      ['sr', 'An uncommon pull.', 'SR'],
      ['ssr', 'A rare pull.', 'SSR'],
      ['ur', 'The rarest pull of all.', 'UR'],
    ] as [Rarity, string, string][]).map(([key, description, shortLabel]) => ({
      name: RARITY_NAMES[key],
      description,
      shortLabel,
      icon: { kind: 'rarity', key } as GlossaryIcon,
    })),
  },
];

export function glossarySection(id: GlossarySectionId): GlossarySection {
  const found = GLOSSARY_SECTIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing glossary section: ${id}`);
  return found;
}

/** Case-insensitive match of a query against one glossary term. */
export function termMatchesQuery(term: GlossaryTerm, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return term.name.toLowerCase().includes(q) || term.description.toLowerCase().includes(q);
}

/** The section a term name lives in, for the Deck Builder's focus deep links. */
export function sectionOfTerm(name: string): GlossarySectionId | null {
  for (const section of GLOSSARY_SECTIONS) {
    if (section.terms.some((term) => term.name === name)) return section.id;
  }
  return null;
}
