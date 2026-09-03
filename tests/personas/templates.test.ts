import { describe, expect, it } from 'vitest';
import { DECK_ROLES, PERSONA_TEMPLATES, PERSONA_TEMPLATE_VERSION } from '../../scripts/personas/templates';
import { LAND_RESERVE_SIZE, WARCHEST_DECK_SIZE } from '../../src/meta/warchest';

describe('persona template roster', () => {
  it('contains exactly the six approved personas', () => {
    expect(PERSONA_TEMPLATES.map((template) => template.id)).toEqual([
      'burn',
      'draw-go',
      'attrition',
      'reanimator',
      'weenie',
      'midrange',
    ]);
  });

  it('has unique persona ids', () => {
    expect(new Set(PERSONA_TEMPLATES.map((template) => template.id)).size).toBe(6);
  });

  it('uses one version for every template', () => {
    expect(new Set(PERSONA_TEMPLATES.map((template) => template.version))).toEqual(
      new Set([PERSONA_TEMPLATE_VERSION]),
    );
  });

  it('defines all six quota keys', () => {
    for (const template of PERSONA_TEMPLATES) {
      expect(Object.keys(template.quotas).sort()).toEqual([...DECK_ROLES].sort());
    }
  });

  // Reserve-native since 2026-08-25: the deck is WARCHEST_DECK_SIZE spells and
  // `lands` is the size of the SEPARATE land reserve, not in-deck lands. These
  // three assertions are what catch a template rescaled by hand incorrectly.
  it.each(PERSONA_TEMPLATES)('$id spell quotas sum to a Warchest deck', (template) => {
    const spells = Object.entries(template.quotas)
      .filter(([role]) => role !== 'lands')
      .reduce((sum, [, count]) => sum + count, 0);
    expect(spells).toBe(WARCHEST_DECK_SIZE);
  });

  it.each(PERSONA_TEMPLATES)('$id reserves exactly ten lands', (template) => {
    expect(template.quotas.lands).toBe(LAND_RESERVE_SIZE);
  });

  it.each(PERSONA_TEMPLATES)('$id curve targets cover every spell slot', (template) => {
    expect(Object.values(template.curve.targets).reduce((sum, count) => sum + count, 0)).toBe(
      WARCHEST_DECK_SIZE,
    );
    expect(template.curve.maxManaValue).toBeGreaterThanOrEqual(4);
    // A reserve tops out at LAND_RESERVE_SIZE mana, so a higher curve is uncastable.
    expect(template.curve.maxManaValue).toBeLessThanOrEqual(LAND_RESERVE_SIZE);
  });

  it.each(PERSONA_TEMPLATES)('$id synergy tags have no duplicates', (template) => {
    expect(new Set(template.synergy.subtypes).size).toBe(template.synergy.subtypes.length);
    expect(new Set(template.synergy.keywords).size).toBe(template.synergy.keywords.length);
    expect(new Set(template.synergy.effectOps).size).toBe(template.synergy.effectOps.length);
  });

  it('makes midrange the only color-agnostic control', () => {
    const flexible = PERSONA_TEMPLATES.filter((template) => template.colorPolicy === 'best-two');
    expect(flexible.map((template) => template.id)).toEqual(['midrange']);
    expect(flexible[0].colorIdentity).toEqual([]);
    expect(PERSONA_TEMPLATES.filter((template) => template.colorPolicy === 'fixed').every(
      (template) => template.colorIdentity.length === 2,
    )).toBe(true);
  });
});
