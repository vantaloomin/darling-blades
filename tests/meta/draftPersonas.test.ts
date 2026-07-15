import { describe, expect, it } from 'vitest';
import { DRAFT_PERSONAS, draftPersonaById, type DraftPersona } from '../../src/data/draftPersonas';
import { CARD_DB } from '../../src/data/catalog';
import { def, isType } from '../../src/engine/types';
import { assignDraftPersonas, DEFAULT_PICKER, pickNoise, scorePick } from '../../src/meta/draftPicker';
import { DRAFT_SEATS } from '../../src/meta/Limited';

function persona(id: string): DraftPersona {
  const found = draftPersonaById(`dp-${id}`);
  if (!found) throw new Error(`missing persona ${id}`);
  return found;
}

function choose(
  cardIds: readonly string[],
  draftPersona: DraftPersona,
  picks: readonly string[] = [],
  seed = 1,
): string {
  return [...cardIds].sort(
    (a, b) =>
      scorePick(CARD_DB, b, picks, draftPersona.picker, pickNoise(seed, 1, 0, picks.length, b)) -
        scorePick(CARD_DB, a, picks, draftPersona.picker, pickNoise(seed, 1, 0, picks.length, a)) ||
      def(CARD_DB, a).name.localeCompare(def(CARD_DB, b).name) ||
      a.localeCompare(b),
  )[0];
}

function chooseDefault(cardIds: readonly string[], picks: readonly string[] = []): string {
  return [...cardIds].sort(
    (a, b) =>
      scorePick(CARD_DB, b, picks, DEFAULT_PICKER, 0) - scorePick(CARD_DB, a, picks, DEFAULT_PICKER, 0) ||
      def(CARD_DB, a).name.localeCompare(def(CARD_DB, b).name) ||
      a.localeCompare(b),
  )[0];
}

describe('draft persona roster', () => {
  it('contains 20 unique, valid, sane personas with non-character male portraits', () => {
    expect(DRAFT_PERSONAS).toHaveLength(20);
    // HARD FLOOR: assignDraftPersonas throws below 7 unique ids, and inside
    // SaveManager.migrate() that throw is caught by load()'s try/catch and
    // silently replaces the WHOLE save with freshSave — never shrink the
    // roster below 7 (the exact-20 assertion above already blocks it in CI).
    expect(DRAFT_PERSONAS.length).toBeGreaterThanOrEqual(7);
    expect(new Set(DRAFT_PERSONAS.map((p) => p.id)).size).toBe(20);
    expect(new Set(DRAFT_PERSONAS.map((p) => p.name)).size).toBe(20);
    expect(DRAFT_PERSONAS.filter((p) => p.gender === 'f')).toHaveLength(10);
    expect(DRAFT_PERSONAS.filter((p) => p.gender === 'm')).toHaveLength(10);

    for (const draftPersona of DRAFT_PERSONAS) {
      const portrait = CARD_DB[draftPersona.portraitCardId];
      expect(portrait, draftPersona.id).toBeDefined();
      expect(portrait.token, draftPersona.id).not.toBe(true);
      if (draftPersona.gender === 'm') {
        expect(isType(portrait, 'creature'), draftPersona.id).toBe(false);
      } else {
        expect(isType(portrait, 'creature'), draftPersona.id).toBe(true);
      }

      expect(draftPersona.colorHint.length, draftPersona.id).toBeGreaterThan(0);
      for (const value of Object.values(draftPersona.picker)) {
        if (typeof value === 'number') expect(Number.isFinite(value), draftPersona.id).toBe(true);
      }
      expect(draftPersona.picker.chaos, draftPersona.id).toBeGreaterThanOrEqual(0);
      expect(draftPersona.picker.chaos, draftPersona.id).toBeLessThanOrEqual(1);
      expect(draftPersona.picker.statBias, draftPersona.id).toBeGreaterThanOrEqual(-1);
      expect(draftPersona.picker.statBias, draftPersona.id).toBeLessThanOrEqual(1);
      expect(draftPersona.picker.commitAfter, draftPersona.id).toBeGreaterThanOrEqual(0);
    }
    expect(persona('chris').picker).toEqual(DEFAULT_PICKER);
  });

  it('assigns seven distinct personas deterministically after the human seat', () => {
    const ids = DRAFT_PERSONAS.map((p) => p.id);
    const a = assignDraftPersonas(9173, ids);
    const b = assignDraftPersonas(9173, ids);
    const c = assignDraftPersonas(9174, ids);

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    // Cross-module pin: draftPicker.ts keeps its own private seat-count const
    // (importing Limited.ts would be a cycle) — this catches the two drifting.
    expect(a).toHaveLength(DRAFT_SEATS);
    expect(a[0]).toBe('');
    expect(new Set(a.slice(1)).size).toBe(7);
    expect(a.slice(1).every((id) => ids.includes(id))).toBe(true);
  });
});

describe('draft persona differentiation', () => {
  const redPicks = Array.from({ length: 5 }, () => 'tk-wei-yuejin');
  const cases: readonly {
    id: string;
    pack: readonly [string, string];
    expected: string;
    defaultExpected: string;
    picks?: readonly string[];
  }[] = [
    { id: 'tiffany', pack: ['rg-freya', 'tk-wu-huanggai'], expected: 'rg-freya', defaultExpected: 'tk-wu-huanggai', picks: redPicks },
    { id: 'brandon', pack: ['rg-angrboda', 'tk-other-lubu'], expected: 'rg-angrboda', defaultExpected: 'tk-other-lubu' },
    { id: 'megan', pack: ['tk-shu-zhangfei', 'gk-zeus'], expected: 'tk-shu-zhangfei', defaultExpected: 'gk-zeus' },
    { id: 'kyle', pack: ['rg-freya', 'tk-other-lubu'], expected: 'rg-freya', defaultExpected: 'tk-other-lubu' },
    { id: 'jessica', pack: ['rg-berserker-chieftain', 'gk-gaia'], expected: 'rg-berserker-chieftain', defaultExpected: 'gk-gaia' },
    { id: 'lauren', pack: ['tk-wei-caocao', 'gk-zeus'], expected: 'tk-wei-caocao', defaultExpected: 'gk-zeus' },
    { id: 'tyler', pack: ['rg-fenrir', 'tk-other-lubu'], expected: 'rg-fenrir', defaultExpected: 'tk-other-lubu' },
    { id: 'derek', pack: ['tk-wei-xiahoudun', 'tk-wei-caocao'], expected: 'tk-wei-xiahoudun', defaultExpected: 'tk-wei-caocao' },
    { id: 'amanda', pack: ['tk-wu-huanggai', 'rg-freya'], expected: 'rg-freya', defaultExpected: 'tk-wu-huanggai', picks: redPicks },
    { id: 'brittany', pack: ['tk-shu-guanyu', 'tk-other-lubu'], expected: 'tk-shu-guanyu', defaultExpected: 'tk-other-lubu' },
    { id: 'kevin', pack: ['tk-wei-chenqun', 'tk-wei-zhanghe'], expected: 'tk-wei-chenqun', defaultExpected: 'tk-wei-zhanghe' },
    { id: 'stephanie', pack: ['bk-foxfire-priestess', 'tk-other-lubu'], expected: 'bk-foxfire-priestess', defaultExpected: 'tk-other-lubu' },
    { id: 'zach', pack: ['rg-hel', 'tk-other-lubu'], expected: 'rg-hel', defaultExpected: 'tk-other-lubu' },
    { id: 'rachel', pack: ['in-dream-fracture', 'gk-gaia'], expected: 'in-dream-fracture', defaultExpected: 'gk-gaia' },
    { id: 'justin', pack: ['tk-wu-zhouyu', 'ar-siege-juggernaut'], expected: 'tk-wu-zhouyu', defaultExpected: 'ar-siege-juggernaut' },
    { id: 'samantha', pack: ['tk-shu-zhaoyun', 'tk-wei-caocao'], expected: 'tk-shu-zhaoyun', defaultExpected: 'tk-wei-caocao' },
    { id: 'matt', pack: ['in-comet-blast', 'tk-other-lubu'], expected: 'in-comet-blast', defaultExpected: 'tk-other-lubu' },
    { id: 'ashley', pack: ['cf-cauldron-of-dagda', 'gk-gaia'], expected: 'cf-cauldron-of-dagda', defaultExpected: 'gk-gaia' },
  ];

  for (const row of cases) {
    it(`${row.id} makes the archetypal pick over the textbook pick`, () => {
      expect(chooseDefault(row.pack, row.picks)).toBe(row.defaultExpected);
      expect(choose(row.pack, persona(row.id), row.picks)).toBe(row.expected);
    });
  }

  it('cody diverges from the textbook pick on a healthy fraction of deterministic seeds', () => {
    const pack = [
      'tk-other-lubu',
      'gk-zeus',
      'rg-fenrir',
      'in-comet-blast',
      'ar-training-dummy',
      'cf-cauldron-of-dagda',
      'rg-hel',
      'so-raise-dead',
    ];
    const textbook = chooseDefault(pack);
    let divergences = 0;
    for (let seed = 1; seed <= 100; seed++) {
      if (choose(pack, persona('cody'), [], seed) !== textbook) divergences++;
    }
    expect(divergences).toBeGreaterThanOrEqual(60);
  });

  it('chris remains exactly lockstep with the textbook picker', () => {
    const pack = ['tk-other-lubu', 'gk-zeus', 'rg-fenrir', 'in-comet-blast', 'ar-training-dummy'];
    expect(choose(pack, persona('chris'))).toBe(chooseDefault(pack));
  });
});
