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
  /**
   * Optional colour floor, off unless set: for each named colour, the minimum
   * fraction of the deck's spells whose colours include it. The greedy build
   * meets it and the hill climb never proposes a swap that breaks it. The
   * greedy score is rate-dominated, so without a floor a pair whose one colour
   * out-rates the other builds a one-colour deck with a splash; the floor is
   * how a fixed pair stays a pair. A template without one builds exactly as
   * it did before the field existed. Fixed-colour personas only, naming
   * colours in `colorIdentity`.
   *
   * Changing an existing template's floor changes what it builds, so bump
   * PERSONA_TEMPLATE_VERSION as for any template edit: the journal config
   * does not fingerprint the floor, and an artifact records the floor in
   * force when it was written.
   */
  minColorShare?: Readonly<Partial<Record<Color, number>>>;
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
  // The colour-gap personas (ruling D12, 2026-09-28; plan-1.9 lane F item 5).
  // Until these, no persona played green or red-white outside weenie's first
  // day, so the sweep could not see those cards, nor First Dawn's R/G core
  // (Hunt, Provoked). Appended, not interleaved: a sweep of the original six
  // filters the roster in this order, so its crafts are unchanged. For the
  // same reason PERSONA_TEMPLATE_VERSION stays put: it marks what a template
  // MEANS (v2: reserve-native quotas), and no existing template changed; which
  // personas a sweep crafted is already in every craft's config (personaIds),
  // so a merge never mixes a six-persona sweep with an eight-persona one.
  //
  // R/G: a big-body deck whose removal is burn (Hunt, when First Dawn lands,
  // is the same job in green). The cap of 6 reaches green's top end, and with
  // it six of the eight mono-green nerfs 1.8.5 reverted. Beastkin, Wolf and
  // Hunter are the pair's tribes with payoffs in the pool; Dinokin is First
  // Dawn's R/G tribe and matches nothing until its cards exist (subtype names
  // are inert strings to the scorer, so nothing validates them against the
  // catalog). The keywords are green-leaning on purpose (Warcry and Rage are
  // nearly all red here), though the floor below does the real work.
  template({
    id: 'stompy',
    name: 'The Stompy Player',
    archetype: 'Red-green big bodies backed by burn',
    colorIdentity: ['R', 'G'],
    colorPolicy: 'fixed',
    curve: { maxManaValue: 6, targets: { early: 11, mid: 20, late: 9 } },
    quotas: { threats: 21, removal: 8, interaction: 3, draw: 3, finishers: 5, lands: 10 },
    // Half the spells green, or the rate-led greedy build is 29 red to 11
    // green at the sweep seed (red's top rates out-score green's, and no
    // synergy tag closes that gap). At 0.5 it is 20 red, 16 green, 4 gold.
    minColorShare: { G: 0.5 },
    synergy: {
      subtypes: ['Beastkin', 'Wolf', 'Hunter', 'Dinokin'],
      keywords: ['overrun', 'sentinel'],
      effectOps: ['addCounters', 'createToken', 'extraLandDrop'],
    },
  }),
  // R/W: an aggressive warband, lower than stompy and less spread than weenie.
  // `damage` matches both burn and the pool's self-damage sources (damage to
  // you or to every creature), each op counted, so a card that does both
  // scores twice; First Dawn's red self-damage is the same op. Bastet is the
  // pair's tribe (nine payoffs across R and W, and three of the reverted R/W
  // gods and duelists); the cap of 5 reaches all five reverted R/W cards.
  template({
    id: 'warband',
    name: 'The Warband Player',
    archetype: 'Red-white warcry aggro with pump and self-damage',
    colorIdentity: ['R', 'W'],
    colorPolicy: 'fixed',
    curve: { maxManaValue: 5, targets: { early: 22, mid: 15, late: 3 } },
    quotas: { threats: 22, removal: 9, interaction: 5, draw: 1, finishers: 3, lands: 10 },
    synergy: {
      subtypes: ['Bastet', 'Warrior', 'Valkyrie'],
      keywords: ['warcry', 'firstBlade', 'twinBlades', 'sentinel'],
      effectOps: ['damage', 'gainLife', 'boost'],
    },
  }),
] as const satisfies readonly PersonaTemplate[];

export type PersonaId = (typeof PERSONA_TEMPLATES)[number]['id'];

export function personaTemplate(id: string): PersonaTemplate {
  const found = PERSONA_TEMPLATES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown persona: ${id}`);
  return found;
}
