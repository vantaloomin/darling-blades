import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DROWNED_DEEP } from '../../src/data/cards/drowned-deep';
import { TOKENS } from '../../src/data/cards/tokens';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { AXES } from '../../src/data/axes';
import { DROWNED_DEEP_SET, isLiveCollectible, isLiveSet } from '../../src/data/liveness';
import { SET_BLURBS, SET_IDS, SET_TITLES } from '../../src/data/setTitles';
import { classifyPermanent } from '../../src/data/permanentClass';
import { packPool } from '../../src/meta/PackOpener';
import { activatedAbilitiesOf, validateTitheDef, validateWhispersDef } from '../../src/engine/types';
import type { CardDef, EffectOp } from '../../src/engine/types';
import { KEYWORD_NAMES, manaCostText, rulesText } from '../../src/ui/rulesText';

const readDoc = (path: string): string => readFileSync(new URL('../../docs/' + path, import.meta.url), 'utf8');
const overplan = readDoc('expansions/drafts/drowned-deep-overplan.md');
const rows = new Map(overplan.split(/\r?\n/).filter((line) => line.startsWith('| dd-')).map((line) => {
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  return [cells[0], cells] as const;
}));
const kept = [...overplan.split('### Kept, by rarity and colour')[1].split('### Cut (68)')[0].matchAll(/\x60(dd-[^\x60]+)\x60/g)].map((match) => match[1]);
const headingIds = (text: string): string[] =>
  [...text.matchAll(/^### .*?\x60(dd-[^\x60]+)\x60/gm)].map((match) => match[1]);
const tokenIds = ['tok-deep-spawn', 'tok-drowned-spirit', 'tok-lantern-wisp', 'tok-kelp-shade'];
const rarities = ['ur', 'ssr', 'sr', 'r', 'c'] as const;
const card = (id: string): CardDef => CARD_DB[id];

function opsOf(d: CardDef): EffectOp[] {
  return [
    ...(d.abilities ?? []).flatMap((ability) => ability.ops ?? []),
    ...activatedAbilitiesOf(d).flatMap((ability) => ability.ops),
    ...(d.empower?.ops ?? []),
    ...(d.retell?.ops ?? []),
    ...(d.chapters ?? []).flat(),
  ];
}

describe('Drowned Deep transcription', () => {
  it('pins the actual 252-card cut and its 13/17/23/75/124 rarity mix', () => {
    expect(DROWNED_DEEP).toHaveLength(252);
    // RULED 2026-09-15: the set over-delivers on UR and SSR; 13/17/23/75/124 = 252 is the locked histogram.
    expect(Object.fromEntries(rarities.map((rarity) => [
      rarity, DROWNED_DEEP.filter((d) => d.rarity === rarity).length,
    ]))).toEqual({ ur: 13, ssr: 17, sr: 23, r: 75, c: 124 });
    expect(new Set(DROWNED_DEEP.map((d) => d.id)).size).toBe(252);
    expect(DROWNED_DEEP.map((d) => d.id).sort()).toEqual([...kept].sort());
  });

  it('uses the canonical 155 creature headings followed by the 97 spell-art headings', () => {
    const creatures = headingIds(readDoc('art-bible/drowned-deep.md'));
    const noncreatures = headingIds(readDoc('spell-art.md').split('## Drowned Deep non-creatures (97)')[1]);
    expect(creatures).toHaveLength(155);
    expect(noncreatures).toHaveLength(97);
    expect(DROWNED_DEEP.map((d) => d.id)).toEqual([...creatures, ...noncreatures]);
    expect(DROWNED_DEEP.slice(0, 155).every((d) => d.types.includes('creature'))).toBe(true);
    expect(DROWNED_DEEP.slice(155).every((d) => !d.types.includes('creature'))).toBe(true);
  });

  it.each(DROWNED_DEEP.map((d) => [d.id, d] as const))('%s preserves its approved row identity and keyword/cost lines', (id, d) => {
    const row = rows.get(id)!;
    expect(row, id).toBeDefined();
    const [, name, rarity, colors, type, cost, stats, printed, flavor] = row;
    const typeParts = type.split(', ');
    const subtypes = typeParts[1] && typeParts[1] !== 'legendary'
      ? typeParts[1].match(/Deep One|[A-Za-z]+/g) ?? [] : [];
    const legendary = typeParts.includes('legendary') ||
      ['dd-drowned-deacon', 'dd-marsh-mother-horror'].includes(id); // DC3, 2026-09-15.
    expect(d.name).toBe(name);
    expect(d.rarity).toBe(rarity.toLowerCase());
    expect(d.colors).toEqual(colors.split('/'));
    expect(d.types).toEqual([typeParts[0].toLowerCase()]);
    expect(d.subtypes).toEqual(subtypes);
    expect(d.supertypes ?? []).toEqual(legendary ? ['legendary'] : []);
    expect(manaCostText(d.cost!)).toBe(cost);
    expect(d.types.includes('creature') ? d.attack + '/' + d.defense : 'none').toBe(stats);
    expect(d.flavor).toBe(flavor);
    expect(d.set).toBe('drowned-deep');
    const clauses = printed.replace(/\.$/, '').split('. ');
    expect((d.keywords ?? []).map((keyword) => KEYWORD_NAMES[keyword])).toEqual(
      clauses.filter((clause) => Object.values(KEYWORD_NAMES).includes(clause)),
    );
    for (const mechanic of ['skim', 'whispers', 'retell', 'empower'] as const) {
      const name = mechanic[0].toUpperCase() + mechanic.slice(1);
      const expected = printed.match(new RegExp(name + ' ((?:\\{[^}]+\\})+)'))?.[1];
      expect(d[mechanic] ? manaCostText(d[mechanic]!.cost) : undefined).toBe(expected);
    }
    const dutyCosts = [...printed.matchAll(/Duty(?:, ((?:\{[^}]+\})+))?:/g)].map((match) => match[1] ?? '{0}');
    expect(activatedAbilitiesOf(d).map((ability) => ability.cost.mana ? manaCostText(ability.cost.mana) : '{0}')).toEqual(dutyCosts);
  });

  // owner ruling 2026-09-17: Whispers and Tithe may share a card, so Cinderjaw
  // takes Tithe and the named exception is gone. Tithe carriers 31 -> 32.
  it('requires Tithe on every Horror and Horror on every Tithe carrier', () => {
    for (const d of DROWNED_DEEP) {
      expect(validateWhispersDef(d), d.id).toEqual([]);
      expect(validateTitheDef(d), d.id).toEqual([]);
      if (d.tithe) expect(d.subtypes, d.id).toContain('Horror');
      if (d.subtypes.includes('Horror')) expect(d.tithe, d.id).toEqual({ per: 2 });
    }
    expect(DROWNED_DEEP.filter((d) => d.tithe)).toHaveLength(32);
    const cinderjaw = DROWNED_DEEP.find((d) => d.id === 'dd-cinderjaw')!;
    expect(cinderjaw.whispers).toBeDefined();
    expect(cinderjaw.tithe).toEqual({ per: 2 });
  });

  it('restricts Rite to white or red non-Horrors and excludes Whispers beside Retell', () => {
    const rites = DROWNED_DEEP.filter((d) => d.rite);
    expect(rites).toHaveLength(5);
    for (const d of rites) {
      expect(d.colors.some((color) => color === 'W' || color === 'R'), d.id).toBe(true);
      expect(d.colors.every((color) => color === 'W' || color === 'R'), d.id).toBe(true);
      expect(d.subtypes, d.id).not.toContain('Horror');
    }
    expect(DROWNED_DEEP.filter((d) => d.whispers && d.retell)).toEqual([]);
  });

  it('gives each of the four tokens at least two distinct minters, including Duty and dies', () => {
    const counts = Object.fromEntries(tokenIds.map((id) => [
      id, DROWNED_DEEP.filter((d) => opsOf(d).some((op) => op.op === 'createToken' && op.token === id)).length,
    ]));
    expect(counts).toEqual({ 'tok-deep-spawn': 4, 'tok-drowned-spirit': 2, 'tok-lantern-wisp': 4, 'tok-kelp-shade': 12 });
    for (const count of Object.values(counts)) expect(count).toBeGreaterThanOrEqual(2);
    for (const d of DROWNED_DEEP) {
      for (const op of opsOf(d)) {
        if (op.op === 'createToken') {
          expect(tokenIds, d.id).toContain(op.token);
          expect(CARD_DB[op.token]?.token, d.id).toBe(true);
        }
      }
    }
  });

  it('keeps keyword-only creatures below 30 percent of commons', () => {
    const commons = DROWNED_DEEP.filter((d) => d.rarity === 'c');
    const nearVanilla = commons.filter((d) => d.types.includes('creature') &&
      !(d.abilities?.length || d.activated || d.skim || d.whispers || d.retell || d.tithe || d.rite || d.empower || d.manaAbility || d.chapters));
    expect(nearVanilla).toHaveLength(20);
    expect(nearVanilla.length / commons.length).toBeLessThanOrEqual(0.3);
  });

  it('renders non-empty rules for every collectible and preserves flavor without em dashes', () => {
    for (const d of DROWNED_DEEP) {
      expect(rulesText(d).trim(), d.id).not.toBe('');
      expect(d.flavor, d.id).not.toContain('\u2014');
    }
  });

  it('keeps multicolour cards at Rare or higher and below ten percent', () => {
    const multi = DROWNED_DEEP.filter((d) => d.colors.length > 1);
    expect(multi).toHaveLength(7);
    expect(multi.length / DROWNED_DEEP.length).toBeLessThan(0.1);
    expect(multi.filter((d) => d.rarity === 'c')).toEqual([]);
  });

  it('gives every non-creature permanent ongoing battlefield text', () => {
    const permanents = DROWNED_DEEP.filter((d) => !d.types.includes('creature') &&
      (d.types.includes('artifact') || d.types.includes('enchantment')));
    expect(permanents).toHaveLength(37);
    expect(permanents.filter((d) => ['ONE-SHOT', 'BLANK'].includes(classifyPermanent(d).klass)).map((d) => d.id)).toEqual([]);
  });

  it('registers the catalog and display identity and makes the set live for acquisition', () => {
    expect(DROWNED_DEEP_SET).toBe('drowned-deep');
    expect(SET_IDS).toContain('drowned-deep');
    expect(SET_TITLES['drowned-deep']).toBe('Drowned Deep');
    expect(SET_BLURBS['drowned-deep']).toBe('The lamps are lit, and the Deep is owed');
    expect(isLiveSet(DROWNED_DEEP_SET)).toBe(true);
    for (const d of DROWNED_DEEP) {
      expect(CARD_DB[d.id]).toEqual(d);
      expect(isLiveCollectible(CARD_DB[d.id]), d.id).toBe(true);
    }
    for (const rarity of rarities) {
      expect(packPool(CARD_DB, rarity, DROWNED_DEEP_SET).sort()).toEqual(
        DROWNED_DEEP.filter((card) => card.rarity === rarity).map((card) => card.id).sort(),
      );
    }
    for (const id of tokenIds) expect(isLiveCollectible(CARD_DB[id]), id).toBe(false);
    expect(AXES).toContain('Horror');
    expect(AXES).toContain('Warden');
    expect(AXES).not.toContain('Plant');
  });

  it('pins four zero-cost token identities with no flavor', () => {
    const expected = [
      { id: 'tok-deep-spawn', name: 'Deep-Spawn', subtypes: ['Deep One', 'Horror'], colors: ['B'], attack: 2, defense: 2, keywords: [] },
      { id: 'tok-drowned-spirit', name: 'Drowned Spirit', subtypes: ['Spirit'], colors: ['B'], attack: 1, defense: 1, keywords: [] },
      { id: 'tok-lantern-wisp', name: 'Lantern Wisp', subtypes: ['Spirit'], colors: ['W'], attack: 1, defense: 1, keywords: ['skyborne'] },
      { id: 'tok-kelp-shade', name: 'Kelp Shade', subtypes: ['Plant'], colors: ['G'], attack: 2, defense: 2, keywords: [] },
    ];
    for (const shape of expected) {
      const d: CardDef | undefined = TOKENS.find((token) => token.id === shape.id);
      expect(d).toBeDefined();
      expect({ ...d, keywords: d?.keywords ?? [] }).toMatchObject(shape);
      expect(d).toMatchObject({ types: ['creature'], token: true, cost: { generic: 0, pips: {} }, rarity: 'c', set: 'drowned-deep' });
      expect(d?.flavor).toBeUndefined();
      expect(d?.abilities).toBeUndefined();
      expect(d?.tithe).toBeUndefined();
    }
  });

  it('adds exactly 252 collectibles and four tokens', () => {
    expect(ALL_CARDS.filter((d) => d.set === DROWNED_DEEP_SET && !d.token)).toHaveLength(252);
    expect(ALL_CARDS.filter((d) => d.set === DROWNED_DEEP_SET && d.token).map((d) => d.id)).toEqual(tokenIds);
  });

  it('preserves cost and attack caps and opponent-only targets', () => {
    const maxCosts: [string, number][] = [
      ['dd-tidewife', 3], ['dd-cold-current', 3], ['dd-drowned-saint', 3], ['dd-the-price', 3],
      ['dd-bell-hand', 2], ['dd-undertow-charm', 2], ['dd-still-harbour', 2],
      ['dd-the-deep-collects', 2], ['dd-what-the-sea-wants', 2], ['dd-drowned-nurse', 2],
    ];
    const targets = (d: CardDef) => [
      ...(d.abilities ?? []).flatMap((a) => a.targets ?? []),
      ...activatedAbilitiesOf(d).flatMap((a) => a.targets ?? []),
      ...(d.empower?.targets ?? []),
    ];
    for (const [id, maxCost] of maxCosts) expect(targets(card(id)), id).toContainEqual(expect.objectContaining({ maxCost }));
    expect(targets(card('dd-rite-of-the-salt-gate'))).toEqual([{ what: 'creature', minAttack: 4 }]);
    expect(targets(card('dd-salt-and-prayer'))).toEqual([{ what: 'creature', minAttack: 3 }]);
    for (const id of ['dd-lightkeeper', 'dd-gate-warden', 'dd-tide-gate', 'dd-thing-in-the-cistern']) {
      expect(targets(card(id)), id).toEqual([{ what: 'opponentCreature' }]);
    }
  });

  it('preserves loot choices, edicts and the sacrifice-only death observer', () => {
    const looters = DROWNED_DEEP.filter((d) => opsOf(d).some((op) => op.op === 'discard'));
    expect(looters).toHaveLength(8);
    for (const d of looters) {
      expect(opsOf(d), d.id).toEqual([{ op: 'draw', n: 1 }, { op: 'discard', who: 'self', n: 1 }]);
    }
    for (const id of ['dd-tithe-to-the-deep', 'dd-marsh-lamp-lure']) {
      expect(opsOf(card(id)), id).toContainEqual({ op: 'sacrifice', who: 'opponent', n: 1 });
    }
    expect(opsOf(card('dd-reckoning-below'))).toContainEqual({ op: 'sacrifice', who: 'each', n: 1 });
    expect(card('dd-horror-garden').abilities).toContainEqual({
      when: 'allyDies', filter: { sacrifice: true }, ops: [{ op: 'gainLife', n: 1 }],
    });
    expect(card('dd-what-the-nets-remember').abilities).toContainEqual({
      when: 'allyDies', filter: { other: true, subtype: 'Horror' }, ops: [{ op: 'gainLife', n: 2 }],
    });
  });

  it('preserves conditional Dawn, Sunset, life-gain, Charm-cast and attack observers', () => {
    expect(card('dd-mother-hydra').abilities).toEqual([{
      when: 'dawn', condition: { kind: 'controlsOther', subtype: 'Horror' }, ops: [{ op: 'loseLife', n: 2, who: 'opponent' }],
    }]);
    expect(card('dd-false-beacon').abilities).toEqual([{
      when: 'sunset', condition: 'creatureDiedThisTurn', ops: [{ op: 'damage', n: 1, to: 'opponent' }],
    }]);
    // Old: youGainLife -> addCounters(1, self), unlimited. New: same ops, oncePerTurn: true.
    expect(card('dd-lamp-oil-saint').abilities).toEqual([{ when: 'youGainLife', oncePerTurn: true, ops: [{ op: 'addCounters', n: 1, to: 'self' }] }]);
    expect(card('dd-bell-below').abilities).toContainEqual({ when: 'youCastCharm', ops: [{ op: 'foresee', n: 1 }] });
    expect(card('dd-storm-front-lesser').abilities).toEqual([{ when: 'allyAttacks', ops: [{ op: 'damage', n: 1, to: 'opponent' }] }]);
  });

  it('preserves targeted triggers, two independent spell targets and two mandatory tap targets', () => {
    expect(card('dd-wrecker-queen').abilities).toEqual([{ when: 'attacks', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] }]);
    expect(card('dd-marsh-gate').abilities).toEqual([{ when: 'dawn', targets: [{ what: 'yourCreature' }], ops: [{ op: 'addCounters', n: 1, to: 'target' }] }]);
    expect(card('dd-the-marsh-remembers').abilities).toEqual([{
      when: 'spell', targets: [{ what: 'yourGraveCreature' }, { what: 'yourCreature' }],
      ops: [{ op: 'reclaim' }, { op: 'addCounters', n: 1, to: 'target', targetIndex: 1 }],
    }]);
    expect(card('dd-drowned-chapel-bell').abilities).toEqual([{
      when: 'spell', targets: [{ what: 'creature', exactly: 2 }], ops: [{ op: 'tap', to: 'target' }],
    }]);
  });

  it('keeps all three Kelp anthems restricted to Plant tokens under DC4', () => {
    for (const id of ['dd-kelp-cathedral', 'dd-marsh-road', 'dd-kelp-shade-elder']) {
      const statics = card(id).abilities?.filter((a) => a.when === 'static') ?? [];
      expect(statics.length, id).toBeGreaterThan(0);
      for (const ability of statics) expect(ability.static?.filter, id).toEqual({ subtype: 'Plant', token: true });
    }
  });

  it('preserves mass-tap, self-only boost, other-only marks and one-sided damage scopes', () => {
    for (const id of ['dd-lightkeepers-oath', 'dd-vigil-bell', 'dd-salt-fog']) {
      expect(opsOf(card(id)), id).toContainEqual({ op: 'tapAll', who: 'opponent' });
    }
    expect(opsOf(card('dd-breakwater-brawler'))).toEqual([{ op: 'boost', p: 1, t: 0, scope: 'self' }]);
    expect(opsOf(card('dd-the-reef-that-walks'))).toEqual([{ op: 'markAll', scope: 'yourCreatures', other: true }]);
    expect(opsOf(card('dd-fire-on-the-point'))).toEqual([{ op: 'damage', n: 3, to: 'eachOpponentCreature' }]);
    expect(opsOf(card('dd-harbour-vigil'))).toEqual([{ op: 'preventCombatTo', to: 'target' }]);
  });

  it('binds self-return, marked token creation and the raised creature keyword grant', () => {
    expect(card('dd-drowned-bride').abilities).toEqual([{ when: 'dies', ops: [{ op: 'reclaimSelf' }] }]);
    expect(opsOf(card('dd-net-full-of-stars'))).toEqual([{ op: 'createToken', token: 'tok-kelp-shade', count: 1, marks: 1 }]);
    expect(opsOf(card('dd-salt-marsh-bargain'))).toEqual([{ op: 'raise', to: 'target', grantKeywords: ['dreaded'] }]);
  });

  it('preserves both Duties, creature Retell override and the targeted Empower destroy', () => {
    expect(activatedAbilitiesOf(card('dd-glass-that-came-back'))).toEqual([
      { cost: { tap: true }, ops: [{ op: 'foresee', n: 2 }] },
      { cost: { tap: true, mana: { generic: 2, pips: {} } }, ops: [{ op: 'draw', n: 1 }] },
    ]);
    expect(card('dd-reach-fire-witch').retell).toEqual({
      cost: { generic: 2, pips: { R: 1 } }, targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 2, to: 'target' }],
    });
    expect(card('dd-drowned-saint').empower).toEqual({
      cost: { generic: 2, pips: {} }, targets: [{ what: 'creature', maxCost: 3 }], ops: [{ op: 'destroy', to: 'target' }],
    });
  });

  it('uses controller damage for printed life loss and destroy for Artifact or Enchantment', () => {
    for (const [id, n] of [['dd-wreckfire', 5], ['dd-black-water', 3], ['dd-cold-bargain', 2]] as const) {
      expect(opsOf(card(id)), id).toContainEqual({ op: 'damage', n, to: 'controller' });
    }
    for (const id of ['dd-what-the-lamps-saw', 'dd-chapel-ward']) {
      expect(card(id).abilities?.[0].targets, id).toEqual([{ what: 'artifactOrEnchantment' }]);
      expect(opsOf(card(id)), id).toContainEqual({ op: 'destroy', to: 'target' });
    }
  });
});
