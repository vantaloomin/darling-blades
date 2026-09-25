import { ALL_CARDS } from '../data/catalog';
import { KEYWORD_NAMES, KEYWORD_REMINDER, RARITY_NAMES } from '../data/glossary';
import type {
  CardType,
  Color,
  Keyword,
  Rarity,
  TargetSpec,
} from '../engine/types';
import {
  KEYWORD_VALUE,
  type ScorableEffectOp,
  type ScorableTriggerWhen,
} from '../power/scoreCore';
import type { CardSet } from './logic';

export const CARD_TYPES = [
  'creature',
  'charm',
  'ritual',
  'enchantment',
  'artifact',
  'land',
] as const satisfies readonly CardType[];

export const RARITIES = ['c', 'r', 'sr', 'ssr', 'ur'] as const satisfies readonly Rarity[];

export const RARITY_LABELS = RARITY_NAMES;

export const SETS = [
  'base',
  'ragnarok',
  'celtic-fae',
  'arthurian-court',
  'gothic-monsters',
  'dark-tales',
  'yokai-nights',
  'drowned-deep',
  'starborne',
] as const satisfies readonly CardSet[];

export const SET_LABELS: Record<CardSet, string> = {
  base: 'Base Set',
  ragnarok: 'Ragnarök',
  'celtic-fae': 'Celtic Fae',
  'arthurian-court': 'Arthurian Court',
  'gothic-monsters': 'Gothic Monsters',
  'dark-tales': 'Dark Tales',
  'yokai-nights': 'Yokai Nights',
  'drowned-deep': 'Drowned Deep',
  starborne: 'Starborne',
};

export const TRIGGERS = [
  'spell',
  'arrives',
  'dies',
  'entersGraveyard',
  'dawn',
  'combatDamageToPlayer',
  'attacks',
  'gainsMark',
  'yourCreatureMarked',
  'yourPermanentMarked',
  'youAddMark',
  'otherCreatureMarked',
  'propagated',
  'markedAllyAttacks',
  'allyCreatureArrives',
  'allyDies',
  'allyAttacks',
  'youGainLife',
  'youCastCharm',
  'sunset',
  'static',
] as const satisfies readonly ScorableTriggerWhen[];

export const TRIGGER_LABELS: Record<ScorableTriggerWhen, string> = {
  spell: 'Spell',
  arrives: 'Arrives',
  dies: 'Dies',
  entersGraveyard: 'Enters Graveyard',
  dawn: 'Dawn',
  combatDamageToPlayer: 'Combat Damage to Player',
  attacks: 'Attacks',
  gainsMark: 'Host Gains Mark',
  yourCreatureMarked: 'Your Creature Marked',
  yourPermanentMarked: 'Your Permanent Marked',
  youAddMark: 'You Add Mark',
  otherCreatureMarked: 'Other Creature Marked',
  propagated: 'Propagated',
  markedAllyAttacks: 'Marked Ally Attacks',
  allyCreatureArrives: 'Ally Creature Arrives',
  allyDies: 'Ally Dies',
  allyAttacks: 'Ally Attacks',
  youGainLife: 'You Gain Life',
  youCastCharm: 'You Cast a Charm',
  sunset: 'Sunset (each end step)',
  static: 'Static',
};

export const TARGETS = [
  'none',
  'creature',
  'player',
  'any',
  'spell',
  'yourCreature',
  'yourGraveCreature',
  'artifact',
  'enchantment',
  'artifactOrEnchantment',
] as const satisfies readonly (TargetSpec['what'] | 'none')[];

export const TARGET_LABELS: Record<(typeof TARGETS)[number], string> = {
  none: 'No target',
  creature: 'Creature',
  player: 'Player',
  any: 'Any target',
  spell: 'Spell',
  yourCreature: 'Your creature',
  yourGraveCreature: 'Your grave creature',
  artifact: 'Artifact',
  enchantment: 'Enchantment',
  artifactOrEnchantment: 'Artifact or enchantment',
};

export const KEYWORDS = Object.keys(KEYWORD_NAMES) as Keyword[];

export const KEYWORD_OPTIONS = KEYWORDS.map((keyword) => ({
  keyword,
  name: KEYWORD_NAMES[keyword],
  reminder: KEYWORD_REMINDER[keyword],
  value: KEYWORD_VALUE[keyword],
}));

/** Suggestion heuristic only. The scorer itself is color agnostic. */
export const COLOR_PIE_KEYWORDS: Record<Color, readonly Keyword[]> = {
  W: ['sentinel', 'firstBlade', 'bloodoath', 'skyborne'],
  U: ['skyborne', 'untouchable', 'wardingGaze'],
  B: ['deathblade', 'dreaded', 'bloodoath'],
  R: ['warcry', 'firstBlade', 'twinBlades', 'overrun'],
  G: ['overrun', 'wardingGaze', 'sentinel', 'bulwark', 'deathblade'],
};

export type OpKind = ScorableEffectOp['op'];

export interface OpOption {
  kind: OpKind;
  label: string;
  description: string;
}

export const OP_OPTIONS: readonly OpOption[] = [
  { kind: 'damage', label: 'Damage', description: 'Damage a target, player, controller, or every creature.' },
  { kind: 'gainLife', label: 'Gain Life', description: 'Controller gains life.' },
  { kind: 'loseLife', label: 'Lose Life', description: 'Opponent loses life.' },
  { kind: 'draw', label: 'Draw', description: 'Draw cards.' },
  { kind: 'discardRandom', label: 'Discard Random', description: 'Opponent discards at random.' },
  { kind: 'discard', label: 'Discard (self)', description: 'You discard cards of your choice (the loot half).' },
  { kind: 'sacrifice', label: 'Sacrifice (edict)', description: 'The opponent, or each player, sacrifices a creature.' },
  { kind: 'tapAll', label: 'Tap All', description: 'Tap every creature the opponent controls.' },
  { kind: 'preventCombatTo', label: 'Prevent Combat To', description: 'Prevent all combat damage to the target creature this turn.' },
  { kind: 'reclaimSelf', label: 'Reclaim Self', description: 'Return this card from your graveyard to hand.' },
  { kind: 'destroy', label: 'Destroy', description: 'Destroy the selected permanent.' },
  { kind: 'sever', label: 'Sever', description: 'Sever the selected permanent.' },
  { kind: 'severGrave', label: 'Sever Grave', description: 'Sever cards from a graveyard.' },
  { kind: 'severTop', label: 'Sever Top', description: 'Sever cards from your deck.' },
  { kind: 'recall', label: 'Recall', description: 'Return a permanent to hand.' },
  {
    kind: 'destroyArtifactOrSeverEnchantment',
    label: 'Disenchant',
    description: 'Destroy an artifact or sever an enchantment.',
  },
  { kind: 'cancel', label: 'Cancel', description: 'Cancel a spell.' },
  { kind: 'boost', label: 'Boost', description: 'Apply temporary stats and keywords.' },
  { kind: 'addCounters', label: 'Add Marks', description: 'Add +1/+1 marks.' },
  { kind: 'fetchLand', label: 'Fetch Land', description: 'Fetch any land to the battlefield tapped.' },
  { kind: 'markAll', label: 'Mark All', description: 'Add one mark to each creature you control.' },
  { kind: 'moveMark', label: 'Move Mark', description: 'Move one mark between your permanents.' },
  { kind: 'removeMarks', label: 'Remove Marks', description: 'Remove all marks from the target.' },
  { kind: 'severSelf', label: 'Sever Self', description: 'Sever the source as an ability cost.' },
  { kind: 'loseLifePerTheirMarked', label: 'Marked Life Loss', description: 'Opponent loses life for each marked creature they control.' },
  { kind: 'ifTargetMarked', label: 'If Target Marked', description: 'Use different effects for marked and unmarked targets.' },
  { kind: 'tap', label: 'Tap', description: 'Tap a target.' },
  { kind: 'propagate', label: 'Propagate', description: 'Add one mark to your marked permanents.' },
  { kind: 'extraLandDrop', label: 'Extra Land Drop', description: 'Allow additional land plays.' },
  { kind: 'createToken', label: 'Create Token', description: 'Create one or more catalog tokens.' },
  {
    kind: 'destroyNewestOpponentArtifactOrEnchantment',
    label: 'Destroy Newest Relic',
    description: 'Destroy the opponent’s newest artifact or enchantment.',
  },
  { kind: 'massDestroy', label: 'Mass Destroy', description: 'Destroy a selected permanent class.' },
  { kind: 'preventCombat', label: 'Prevent Combat', description: 'Prevent combat damage this turn.' },
  { kind: 'reclaim', label: 'Reclaim', description: 'Return a grave creature to hand.' },
  { kind: 'grind', label: 'Grind', description: 'Put deck cards into a graveyard.' },
  { kind: 'foresee', label: 'Foresee', description: 'Look at and reorder the top cards.' },
  { kind: 'awaken', label: 'Awaken', description: 'Apply champion awakening.' },
  { kind: 'raise', label: 'Raise', description: 'Return a creature from graveyard to play.' },
];

export const TOKEN_OPTIONS = ALL_CARDS.filter((card) => card.token)
  .map((card) => ({ id: card.id, name: card.name, attack: card.attack ?? 0, defense: card.defense ?? 0 }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function defaultOp(kind: OpKind): ScorableEffectOp {
  switch (kind) {
    case 'damage': return { op: 'damage', n: 2, to: 'target' };
    case 'gainLife': return { op: 'gainLife', n: 2 };
    case 'loseLife': return { op: 'loseLife', n: 2, who: 'opponent' };
    case 'draw': return { op: 'draw', n: 1 };
    case 'discardRandom': return { op: 'discardRandom', n: 1, who: 'opponent' };
    case 'discard': return { op: 'discard', n: 1, who: 'self' };
    case 'sacrifice': return { op: 'sacrifice', who: 'opponent', n: 1 };
    case 'tapAll': return { op: 'tapAll', who: 'opponent' };
    case 'preventCombatTo': return { op: 'preventCombatTo', to: 'target' };
    case 'reclaimSelf': return { op: 'reclaimSelf' };
    case 'destroy': return { op: 'destroy', to: 'target' };
    case 'sever': return { op: 'sever', to: 'target' };
    case 'severGrave': return { op: 'severGrave', n: 1, who: 'opponent' };
    case 'severTop': return { op: 'severTop', n: 1, who: 'self' };
    case 'recall': return { op: 'recall', to: 'target' };
    case 'destroyArtifactOrSeverEnchantment': return { op: 'destroyArtifactOrSeverEnchantment', to: 'target' };
    case 'cancel': return { op: 'cancel', to: 'target' };
    case 'boost': return { op: 'boost', p: 1, t: 1, scope: 'target' };
    case 'addCounters': return { op: 'addCounters', n: 1, to: 'target' };
    case 'fetchLand': return { op: 'fetchLand' };
    case 'markAll': return { op: 'markAll' };
    case 'moveMark': return { op: 'moveMark' };
    case 'removeMarks': return { op: 'removeMarks' };
    case 'severSelf': return { op: 'severSelf' };
    case 'loseLifePerTheirMarked': return { op: 'loseLifePerTheirMarked' };
    case 'ifTargetMarked': return {
      op: 'ifTargetMarked',
      then: [{ op: 'boost', p: -2, t: -2, scope: 'target' }],
      else: [{ op: 'boost', p: -1, t: -1, scope: 'target' }],
    };
    case 'tap': return { op: 'tap', to: 'target' };
    case 'propagate': return { op: 'propagate' };
    case 'extraLandDrop': return { op: 'extraLandDrop', n: 1 };
    case 'createToken': return { op: 'createToken', token: TOKEN_OPTIONS[0]?.id ?? 'token-soldier', count: 1 };
    case 'destroyNewestOpponentArtifactOrEnchantment': return { op: 'destroyNewestOpponentArtifactOrEnchantment' };
    case 'massDestroy': return { op: 'massDestroy', filter: 'allCreatures' };
    case 'preventCombat': return { op: 'preventCombat' };
    case 'reclaim': return { op: 'reclaim' };
    case 'grind': return { op: 'grind', n: 2, who: 'opponent' };
    case 'foresee': return { op: 'foresee', n: 2 };
    case 'awaken': return { op: 'awaken', scope: 'self' };
    case 'raise': return { op: 'raise', to: 'target' };
  }
}
