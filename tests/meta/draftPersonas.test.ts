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
    // Phase D, 2026-09-17: the old pack (rg-berserker-chieftain vs gk-gaia)
    // stopped isolating her knob once the Chieftain's self-damage lost its
    // false removal credit (51.7 -> 22.7), so the textbook drafter agreed with
    // her. New pack: a deathblade body the textbook takes by 11.5 against a
    // base-set burn Charm her removalWeight 28 takes by 11.5.
    { id: 'jessica', pack: ['so-flame-lash', 'tk-jin-zhangchunhua'], expected: 'so-flame-lash', defaultExpected: 'tk-jin-zhangchunhua' },
    // gk-zeus stopped working as lauren's textbook foil when the v3.1 slate
    // cut him to {W}{W}{R}{R} - cheap enough that even her picker takes him.
    { id: 'lauren', pack: ['tk-wei-caocao', 'gk-gaia'], expected: 'tk-wei-caocao', defaultExpected: 'gk-gaia' },
    // Phase D, 2026-09-17: the old pack (rg-fenrir vs tk-other-lubu) stopped
    // isolating his knob once Lu Bu lost Rage's keyword bonus and the false
    // removal credit for his self-damage (39.4 -> 31.9), so the textbook took
    // Fenrir too. New pack: a four-mana legend the textbook takes by 14.5
    // against a seven-mana 6/7 his bigStuffBias 10 takes by 15.5.
    { id: 'tyler', pack: ['dd-old-growth-horror', 'tk-wu-sunquan'], expected: 'dd-old-growth-horror', defaultExpected: 'tk-wu-sunquan' },
    { id: 'derek', pack: ['tk-wei-xiahoudun', 'tk-wei-caocao'], expected: 'tk-wei-xiahoudun', defaultExpected: 'tk-wei-caocao' },
    { id: 'amanda', pack: ['tk-wu-huanggai', 'rg-freya'], expected: 'rg-freya', defaultExpected: 'tk-wu-huanggai', picks: redPicks },
    // tk-other-lubu at {1}{R}{R} with Twin Blades (v3.1) now outbids brittany's
    // shu loyalty; gk-zeus is the bomb she can still walk past.
    { id: 'brittany', pack: ['tk-shu-guanyu', 'gk-zeus'], expected: 'tk-shu-guanyu', defaultExpected: 'gk-zeus' },
    // Phase D, 2026-09-17: the old pack (tk-wei-chenqun vs tk-wei-zhanghe)
    // stopped isolating his knob once Bulwark lost its generic keyword bonus
    // (11.3 -> 9.8 against an unchanged 10.9). His knob is statBias -1, not a
    // keyword preference, so the new pack is a literal wall against a
    // fighter: the textbook takes Zhu Ran by 3.1, the Wall Architect takes
    // Turtlekin Bulwark by 3.3.
    { id: 'kevin', pack: ['bk-turtlekin-bulwark', 'tk-wu-zhuran'], expected: 'bk-turtlekin-bulwark', defaultExpected: 'tk-wu-zhuran' },
    { id: 'stephanie', pack: ['bk-foxfire-priestess', 'tk-other-lubu'], expected: 'bk-foxfire-priestess', defaultExpected: 'tk-other-lubu' },
    // Phase D, 2026-09-17: the old pack (rg-hel vs tk-other-lubu) stopped
    // isolating his knob for the same Lu Bu correction. New pack: a legend the
    // textbook takes by 27.2 against a Starborne graveyard engine his
    // graveyardWeight 18 takes by 26.8.
    { id: 'zach', pack: ['sb-umbral-antenna', 'tk-shu-guanyu'], expected: 'sb-umbral-antenna', defaultExpected: 'tk-shu-guanyu' },
    // Phase D, 2026-09-17: the old pack (in-dream-fracture vs gk-gaia) stopped
    // isolating her knob once Gaia's Mark became visible (30.5 -> 31.5 against
    // an unchanged 31). New pack: a body the textbook takes by 6.5 against a
    // base-set Ritual her spellWeight 13 takes by 6.5.
    { id: 'rachel', pack: ['so-night-extortion', 'tk-wei-dianwei'], expected: 'so-night-extortion', defaultExpected: 'tk-wei-dianwei' },
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
