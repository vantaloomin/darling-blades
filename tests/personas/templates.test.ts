import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DECK_ROLES,
  PERSONA_TEMPLATES,
  PERSONA_TEMPLATE_VERSION,
  type PersonaTemplate,
} from '../../scripts/personas/templates';
import { LAND_RESERVE_SIZE, WARCHEST_DECK_SIZE } from '../../src/meta/warchest';

const colorPair = (template: PersonaTemplate): string => [...template.colorIdentity].sort().join('');

describe('persona template roster', () => {
  // A persona id names craft files, artifacts and journal keys; two templates
  // sharing one would overwrite each other's crafts in a sweep.
  it('gives every persona its own id and dashboard name', () => {
    expect(new Set(PERSONA_TEMPLATES.map((template) => template.id)).size).toBe(PERSONA_TEMPLATES.length);
    expect(new Set(PERSONA_TEMPLATES.map((template) => template.name)).size).toBe(PERSONA_TEMPLATES.length);
  });

  // Two fixed personas in one pair would spend a craft per round re-measuring
  // colours the sweep already sees, instead of a pair it does not.
  it('gives every fixed-colour persona its own colour pair', () => {
    const pairs = PERSONA_TEMPLATES.filter((template) => template.colorPolicy === 'fixed').map(colorPair);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  // Ruling D12 (plan-1.9 lane F item 5): the sweep plays red-green, First
  // Dawn's core pair, and red-white, the gap the ruling names.
  it.each(['GR', 'RW'])('has a fixed persona in the D12 pair %s', (pair) => {
    expect(PERSONA_TEMPLATES.some((template) =>
      template.colorPolicy === 'fixed' && colorPair(template) === pair)).toBe(true);
  });

  // The hosted workflow's header promises its default dispatch is the same
  // sweep as a local `craft.ts --metagame --all`, which crafts every template.
  it('makes the hosted sweep default to every persona', () => {
    const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/metagame-sweep.yml'), 'utf8');
    const block = /^ {6}personas:\r?\n(?: {8}.*\r?\n)*? {8}default:\s*(.+)$/m.exec(workflow);
    expect(block).not.toBeNull();
    const defaults = block![1].split(',').map((id) => id.trim()).filter(Boolean);
    expect(new Set(defaults)).toEqual(new Set(PERSONA_TEMPLATES.map((template) => template.id)));
    expect(defaults).toHaveLength(new Set(defaults).size);
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
