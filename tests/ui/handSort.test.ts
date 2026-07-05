import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef, Color, ManaCost } from '../../src/engine/types';
import { colorClusterKey, handDisplayOrder } from '../../src/ui/handSort';

// Tiny hand-rolled catalog: only the fields handSort reads (types, colors,
// cost, manaAbility, name) matter — the rest are stubbed to satisfy CardDef.
function card(id: string, over: Partial<CardDef>): CardDef {
  return {
    id,
    name: id,
    types: ['creature'],
    subtypes: [],
    colors: [],
    rarity: 'c',
    ...over,
  };
}

function cost(generic: number, pips: Partial<Record<Color, number>> = {}): ManaCost {
  return { generic, pips };
}

const DB: CardDb = Object.fromEntries(
  [
    // lands (basics: colorless, mana identity via manaAbility)
    card('plains', { types: ['land'], subtypes: ['Plains'], manaAbility: ['W'] }),
    card('island', { types: ['land'], subtypes: ['Island'], manaAbility: ['U'] }),
    card('forest', { types: ['land'], subtypes: ['Forest'], manaAbility: ['G'] }),
    card('dual-wu', { types: ['land'], manaAbility: ['W', 'U'] }),
    // spells
    card('w1', { colors: ['W'], cost: cost(0, { W: 1 }) }), // mv 1
    card('u1', { colors: ['U'], cost: cost(0, { U: 1 }) }), // mv 1
    card('w2', { colors: ['W'], cost: cost(1, { W: 1 }) }), // mv 2
    card('w2b', { colors: ['W'], cost: cost(1, { W: 1 }) }), // mv 2 (dup color/cost)
    card('r2', { colors: ['R'], cost: cost(1, { R: 1 }) }), // mv 2
    card('g3', { colors: ['G'], cost: cost(2, { G: 1 }) }), // mv 3
    card('artifact3', { colors: [], cost: cost(3) }), // mv 3, colorless
    card('gold2-wu', { colors: ['W', 'U'], cost: cost(0, { W: 1, U: 1 }) }), // mv 2 gold
    card('gold2-rg', { colors: ['R', 'G'], cost: cost(0, { R: 1, G: 1 }) }), // mv 2 gold
  ].map((d) => [d.id, d]),
);

/** Convenience: hand of ids → ordered ids. */
const order = (ids: string[]): string[] => handDisplayOrder(ids, DB).map((i) => ids[i]);

describe('handDisplayOrder', () => {
  it('returns a valid permutation of indices (each once, none lost)', () => {
    const hand = ['w2', 'plains', 'u1', 'g3', 'island'];
    const perm = handDisplayOrder(hand, DB);
    expect([...perm].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('is a no-op-length identity on empty and single hands', () => {
    expect(handDisplayOrder([], DB)).toEqual([]);
    expect(handDisplayOrder(['w1'], DB)).toEqual([0]);
  });

  it('puts every land before every non-land', () => {
    const out = order(['w1', 'island', 'g3', 'plains', 'r2']);
    expect(out.slice(0, 2)).toEqual(['plains', 'island']); // lands, WUBRG-clustered (W<U)
    expect(out.slice(2)).not.toContain('plains');
    expect(out.slice(2)).not.toContain('island');
  });

  it('orders non-lands by ascending mana value', () => {
    const out = order(['g3', 'w2', 'w1']);
    expect(out).toEqual(['w1', 'w2', 'g3']); // mv 1, 2, 3
  });

  it('clusters like colors within an equal-cost band (WUBRG order)', () => {
    // all mv 2: two white, one red → whites adjacent, then red (W<R).
    const out = order(['r2', 'w2', 'w2b']);
    expect(out).toEqual(['w2', 'w2b', 'r2']);
  });

  it('clusters basic lands by the color they tap for (WUBRG)', () => {
    const out = order(['forest', 'island', 'plains']);
    expect(out).toEqual(['plains', 'island', 'forest']); // W, U, G
  });

  it('sorts multicolor after monocolor and colorless last within a cost band', () => {
    // mv 2: monocolor whites, then gold, then... (no mv-2 colorless here).
    const out = order(['gold2-wu', 'w2', 'r2']);
    // W(0) and R(3) monocolor precede gold (>=5).
    expect(out).toEqual(['w2', 'r2', 'gold2-wu']);
  });

  it('sorts colorless spells last within their cost band', () => {
    const out = order(['artifact3', 'g3']); // both mv 3: G(4) before colorless(999)
    expect(out).toEqual(['g3', 'artifact3']);
  });

  it('is stable and deterministic for identical / duplicate cards', () => {
    const hand = ['w2', 'w2b', 'w2', 'w2b'];
    const a = handDisplayOrder(hand, DB);
    const b = handDisplayOrder(hand, DB);
    expect(a).toEqual(b);
    // duplicates never dropped; every index present.
    expect([...a].sort((x, y) => x - y)).toEqual([0, 1, 2, 3]);
  });

  it('does not mutate the input hand', () => {
    const hand = ['w2', 'plains', 'w1'];
    const snapshot = [...hand];
    handDisplayOrder(hand, DB);
    expect(hand).toEqual(snapshot);
  });

  it('produces the full "land → cost → color" shape end to end', () => {
    const hand = ['g3', 'plains', 'u1', 'r2', 'island', 'w1', 'w2'];
    expect(order(hand)).toEqual([
      'plains', // lands first, WUBRG
      'island',
      'w1', // mv 1
      'u1', // mv 1 (W before U keeps like colors grouped inside the band)
      'w2', // mv 2 (W before R)
      'r2', // mv 2
      'g3', // mv 3
    ]);
  });
});

describe('colorClusterKey', () => {
  const c = (over: Partial<CardDef>): number => colorClusterKey(card('x', over));

  it('ranks monocolor in WUBRG order', () => {
    expect(c({ colors: ['W'] })).toBe(0);
    expect(c({ colors: ['U'] })).toBe(1);
    expect(c({ colors: ['B'] })).toBe(2);
    expect(c({ colors: ['R'] })).toBe(3);
    expect(c({ colors: ['G'] })).toBe(4);
  });

  it('puts multicolor after monocolor and colorless last', () => {
    expect(c({ colors: ['W', 'U'] })).toBeGreaterThanOrEqual(5);
    expect(c({ colors: [] })).toBe(999);
  });

  it('gives identical multicolor sets the same key regardless of order', () => {
    expect(c({ colors: ['W', 'U'] })).toBe(c({ colors: ['U', 'W'] }));
    expect(c({ colors: ['W', 'U'] })).not.toBe(c({ colors: ['R', 'G'] }));
  });

  it('uses manaAbility for colorless lands', () => {
    expect(c({ types: ['land'], colors: [], manaAbility: ['R'] })).toBe(3);
  });
});
