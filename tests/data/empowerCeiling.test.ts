import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { LAND_RESERVE_SIZE } from '../../src/config/rules';
import { manaValue, type CardDef } from '../../src/engine/types';

/**
 * Empower is the only rider whose cost is ADDITIVE: you pay the printed cost
 * and the Empower cost in the same cast. Every other alternate cost (Retell,
 * Preserve, Hauntlink, Skim) is paid INSTEAD of the printed one, so it can
 * never ask for more mana than the card already asks for.
 *
 * That makes the Empower total the one number that can quietly print an
 * uncastable card, which is exactly what happened: Silt-Crowned Harvester
 * shipped at 7 + 4 = 11 and Ra, Helm of the Night Barge at 7 + 5 = 12, against
 * a Warchest that holds LAND_RESERVE_SIZE lands. Both were recosted to 9 by
 * owner ruling 2026-08-24.
 *
 * Two ceilings, because they say different things:
 *
 * - HARD: above LAND_RESERVE_SIZE the Empower cannot be paid from lands at all.
 *   Anything here is a bug, not a design choice.
 * - DESIGN: at 9 a player can pay on the turn they have nine lands. The 10s are
 *   the acknowledged top of the curve, allowlisted by name so a new one is a
 *   deliberate decision rather than a card that slipped through.
 */
const HARD_CEILING = LAND_RESERVE_SIZE;
const DESIGN_CEILING = 9;

/** Cards knowingly printed at the hard cap. Adding a name here is a ruling. */
const TOP_OF_CURVE = ['Renenutet, Who Measures the Flood', 'Silt-Fat Behemoth'];

interface EmpowerRow {
  name: string;
  base: number;
  empower: number;
  total: number;
}

function empowerRows(): EmpowerRow[] {
  return (Object.values(CARD_DB) as CardDef[])
    .filter((d) => d.empower)
    .map((d) => ({
      name: d.name,
      base: manaValue(d.cost),
      empower: manaValue(d.empower!.cost),
      total: manaValue(d.cost) + manaValue(d.empower!.cost),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

describe('Empower cost ceiling', () => {
  it('has Empower cards to check', () => {
    expect(empowerRows().length).toBeGreaterThan(20);
  });

  it('never prints an Empower total the Warchest cannot pay', () => {
    expect(empowerRows().filter((row) => row.total > HARD_CEILING)).toEqual([]);
  });

  it('keeps every card above the design ceiling on the explicit allowlist', () => {
    const above = empowerRows()
      .filter((row) => row.total > DESIGN_CEILING)
      .map((row) => row.name)
      .sort();
    expect(above).toEqual([...TOP_OF_CURVE].sort());
  });

  it('pins the two cards the ruling recosted', () => {
    const harvester = CARD_DB['sd-silt-crowned-harvester'];
    expect(manaValue(harvester.cost)).toBe(6);
    expect(manaValue(harvester.empower!.cost)).toBe(3);

    const ra = CARD_DB['sd-ra-helm-of-the-night-barge'];
    expect(manaValue(ra.cost)).toBe(6);
    expect(manaValue(ra.empower!.cost)).toBe(3);
  });
});
