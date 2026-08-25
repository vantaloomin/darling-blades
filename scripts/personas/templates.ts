import type { Color, EffectOp, Keyword } from '../../src/engine/types';

/**
 * Bumped to v2 for the reserve-native migration (2026-08-25). v1 templates
 * described a 60-card CLASSIC deck: role quotas summing to 36-38 spells plus
 * 22-24 lands inside the deck. Warchest puts lands in a separate reserve, so
 * quotas now sum to WARCHEST_DECK_SIZE spells and `lands` means the RESERVE
 * size, not in-deck lands.
 *
 * Spell quotas and curve targets were rescaled by largest remainder from each
 * persona's authored v1 proportions, so every persona keeps its shape (weenie
 * stays threat-dense, draw-go stays interaction-heavy) rather than being
 * re-authored. Artifacts record `templateVersion`, so v1 sweep results are
 * correctly non-comparable with v2 ones.
 */
export const PERSONA_TEMPLATE_VERSION = 'persona-v2.0.0';

export const DECK_ROLES = [
  'threats',
  'removal',
  'interaction',
  'draw',
  'finishers',
  'lands',
] as const;

export type DeckRole = (typeof DECK_ROLES)[number];
export type SpellRole = Exclude<DeckRole, 'lands'>;
export type CurveBand = 'early' | 'mid' | 'late';
export type EffectOpName = EffectOp['op'];

export interface PersonaTemplate {
  id: string;
  name: string;
  archetype: string;
  version: string;
  /** Fixed colors, or an empty list when colorPolicy chooses the best two. */
  colorIdentity: readonly Color[];
  colorPolicy: 'fixed' | 'best-two';
  curve: {
    maxManaValue: number;
    targets: Readonly<Record<CurveBand, number>>;
  };
  quotas: Readonly<Record<DeckRole, number>>;
  synergy: {
    subtypes: readonly string[];
    keywords: readonly Keyword[];
    effectOps: readonly EffectOpName[];
  };
}

const template = (value: Omit<PersonaTemplate, 'version'>): PersonaTemplate => ({
  ...value,
  version: PERSONA_TEMPLATE_VERSION,
});

export const PERSONA_TEMPLATES = [
  template({
    id: 'burn',
    name: 'The Burn Player',
    archetype: 'Red and black-red face aggro',
    colorIdentity: ['R', 'B'],
    colorPolicy: 'fixed',
    curve: { maxManaValue: 4, targets: { early: 27, mid: 11, late: 2 } },
    quotas: { threats: 20, removal: 9, interaction: 5, draw: 2, finishers: 4, lands: 10 },
    synergy: {
      subtypes: ['Vampire', 'Berserker'],
      keywords: ['firstBlade', 'twinBlades', 'warcry', 'dreaded'],
      effectOps: ['damage', 'loseLife'],
    },
  }),
  template({
    id: 'draw-go',
    name: 'The Draw-Go Player',
    archetype: 'White-blue counter control',
    colorIdentity: ['W', 'U'],
    colorPolicy: 'fixed',
    curve: { maxManaValue: 7, targets: { early: 13, mid: 20, late: 7 } },
    quotas: { threats: 7, removal: 7, interaction: 11, draw: 9, finishers: 6, lands: 10 },
    synergy: {
      subtypes: ['Wizard', 'Kitsune'],
      keywords: ['skyborne', 'sentinel', 'untouchable'],
      effectOps: ['cancel', 'draw', 'foresee', 'preventCombat', 'recall'],
    },
  }),
  template({
    id: 'attrition',
    name: 'The Attrition Player',
    archetype: 'Black-white removal grind',
    colorIdentity: ['B', 'W'],
    colorPolicy: 'fixed',
    curve: { maxManaValue: 6, targets: { early: 16, mid: 20, late: 4 } },
    quotas: { threats: 16, removal: 11, interaction: 5, draw: 4, finishers: 4, lands: 10 },
    synergy: {
      subtypes: ['Vampire', 'Knight', 'Wei'],
      keywords: ['deathblade', 'bloodoath', 'sentinel'],
      effectOps: ['destroy', 'discardRandom', 'reclaim', 'raise'],
    },
  }),
  template({
    id: 'reanimator',
    name: 'The Reanimator',
    archetype: 'Blue-black graveyard combo',
    colorIdentity: ['U', 'B'],
    colorPolicy: 'fixed',
    curve: { maxManaValue: 8, targets: { early: 13, mid: 16, late: 11 } },
    quotas: { threats: 15, removal: 4, interaction: 7, draw: 7, finishers: 7, lands: 10 },
    synergy: {
      subtypes: ['Draugr', 'Construct', 'Spirit'],
      keywords: ['deathblade', 'dreaded', 'untouchable'],
      effectOps: ['grind', 'raise', 'reclaim', 'draw'],
    },
  }),
  template({
    id: 'weenie',
    name: 'The Weenie Player',
    archetype: 'White and white-green go-wide aggro',
    colorIdentity: ['W', 'G'],
    colorPolicy: 'fixed',
    curve: { maxManaValue: 5, targets: { early: 29, mid: 9, late: 2 } },
    quotas: { threats: 25, removal: 5, interaction: 4, draw: 2, finishers: 4, lands: 10 },
    synergy: {
      subtypes: ['Knight', 'Soldier', 'Fae', 'Olympian'],
      keywords: ['warcry', 'firstBlade', 'sentinel', 'overrun'],
      effectOps: ['createToken', 'boost', 'addCounters'],
    },
  }),
  template({
    id: 'midrange',
    name: 'The Midrange Player',
    archetype: 'Color-agnostic goodstuff control',
    colorIdentity: [],
    colorPolicy: 'best-two',
    curve: { maxManaValue: 7, targets: { early: 13, mid: 21, late: 6 } },
    quotas: { threats: 17, removal: 9, interaction: 6, draw: 4, finishers: 4, lands: 10 },
    synergy: { subtypes: [], keywords: [], effectOps: [] },
  }),
] as const satisfies readonly PersonaTemplate[];

export type PersonaId = (typeof PERSONA_TEMPLATES)[number]['id'];

export function personaTemplate(id: string): PersonaTemplate {
  const found = PERSONA_TEMPLATES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown persona: ${id}`);
  return found;
}
