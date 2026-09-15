import type { CardDef } from '../../src/engine/types';

/**
 * Browser-only CardView probes may substitute an existing catalog id for the
 * isBasic lookup and use flat test art. These fixtures never enter CARD_DB.
 */
export const DROWNED_DEEP_CARD_LAYOUT_FIXTURES: readonly CardDef[] = [
  {
    // Approved Tidewife row in drowned-deep-overplan.md, including its flavor
    // budget: a cost-capped Duty shares the face with two other rules lines.
    id: 'dd-layout-tidewife',
    name: 'Ysolt the Tidewife',
    types: ['creature'],
    subtypes: ['Mermaid'],
    supertypes: ['legendary'],
    cost: { generic: 4, pips: { U: 2 } },
    colors: ['U'],
    attack: 4,
    defense: 4,
    keywords: ['skyborne'],
    rarity: 'ssr',
    flavor: 'She married the tide. The tide has been very attentive.',
    abilities: [{ when: 'arrives', ops: [{ op: 'grind', n: 3, who: 'self' }] }],
    activated: {
      cost: { tap: true },
      targets: [{ what: 'creature', maxCost: 3 }],
      ops: [{ op: 'recall', to: 'target' }],
    },
  },
  {
    // Synthetic stress case, not a proposed card: retain long target clauses
    // and both independent tap/mana runs in the existing card face renderer.
    id: 'dd-layout-multiple-duty',
    name: 'Duty Fixture',
    types: ['artifact'],
    subtypes: [],
    colors: ['B'],
    rarity: 'r',
    cost: { generic: 3, pips: { B: 1 } },
    activated: [
      {
        cost: { tap: true, mana: { generic: 2, pips: { B: 1 } } },
        targets: [{ what: 'yourGraveCreature', maxCost: 2 }],
        ops: [{ op: 'reclaim' }],
      },
      {
        cost: { tap: true, mana: { generic: 1, pips: { B: 1 } } },
        targets: [{ what: 'opponentCreature', maxCost: 3, minAttack: 4 }],
        ops: [{ op: 'damage', n: 2, to: 'target' }],
      },
    ],
  },
];

/**
 * Card-local fitting happens before parent scaling. Include the UI's small
 * thumbnails, duel presentations, exact hand hover/drag products and inspect
 * scales for browser bounds measurements; these are not font measurements.
 */
export const DROWNED_DEEP_CARD_LAYOUT_SCALES = [
  0.09, 0.10, 0.12, 0.15, 0.20, 0.21, 0.24, 0.25, 0.28, 0.32,
  0.34, 0.35, 0.40, 0.42, 0.43, 0.448, 0.46, 0.47, 0.48, 0.50,
  0.5152, 0.529, 0.54, 0.55, 0.56, 0.60, 0.62, 0.64, 0.66, 0.69,
  0.72, 0.80, 1, 1.10, 1.22, 1.25, 1.30, 1.35, 1.50,
] as const;
