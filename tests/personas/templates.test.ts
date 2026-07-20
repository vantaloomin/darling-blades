import { describe, expect, it } from 'vitest';
import { DECK_ROLES, PERSONA_TEMPLATES, PERSONA_TEMPLATE_VERSION } from '../../scripts/personas/templates';

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

  it.each(PERSONA_TEMPLATES)('$id quotas sum to a 60-card deck', (template) => {
    expect(Object.values(template.quotas).reduce((sum, count) => sum + count, 0)).toBe(60);
    expect(template.quotas.lands).toBeGreaterThanOrEqual(20);
  });

  it.each(PERSONA_TEMPLATES)('$id curve targets cover every nonland slot', (template) => {
    expect(Object.values(template.curve.targets).reduce((sum, count) => sum + count, 0)).toBe(
      60 - template.quotas.lands,
    );
    expect(template.curve.maxManaValue).toBeGreaterThanOrEqual(4);
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
