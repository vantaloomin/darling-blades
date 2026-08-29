import { describe, expect, it } from 'vitest';
import type { CardDef, EffectOp } from '../../src/engine/types';
import { createRngState } from '../../src/engine/rng';
import { ECONOMY } from '../../src/config/rules';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { STARBORNE } from '../../src/data/cards/starborne';
import { TOKENS } from '../../src/data/cards/tokens';
import { STARBORNE_SET } from '../../src/data/liveness';
import { packPool, openPack } from '../../src/meta/PackOpener';
import { freshSave } from '../../src/meta/SaveManager';
import { rulesText } from '../../src/ui/rulesText';

const STARBORNE_PACK_SET = STARBORNE_SET as unknown as CardDef['set'];
const RARITIES = ['c', 'r', 'sr', 'ssr', 'ur'] as const;
const KNOWN_KEYWORDS = new Set([
  'skyborne', 'wardingGaze', 'firstBlade', 'twinBlades', 'warcry', 'overrun',
  'sentinel', 'bulwark', 'deathblade', 'bloodoath', 'untouchable', 'dreaded',
]);
const KNOWN_TRIGGERS = new Set([
  'spell', 'arrives', 'dies', 'entersGraveyard', 'dawn',
  'combatDamageToPlayer', 'attacks', 'allyCreatureArrives', 'gainsMark',
  'yourCreatureMarked', 'yourPermanentMarked', 'otherCreatureMarked',
  'youAddMark', 'propagated', 'markedAllyAttacks', 'static',
]);
const KNOWN_TARGETS = new Set([
  'creature', 'player', 'any', 'spell', 'yourCreature', 'yourGraveCreature',
  'yourPermanent', 'artifact', 'enchantment', 'artifactOrEnchantment',
]);
const KNOWN_OPS = new Set([
  'damage', 'gainLife', 'loseLife', 'draw', 'discardRandom', 'destroy', 'sever',
  'severGrave', 'severTop', 'recall', 'destroyArtifactOrSeverEnchantment',
  'cancel', 'boost', 'addCounters', 'propagate', 'tap', 'extraLandDrop',
  'createToken', 'destroyNewestOpponentArtifactOrEnchantment', 'massDestroy',
  'preventCombat', 'reclaim', 'grind', 'foresee', 'awaken', 'raise', 'moveMark',
  'removeMarks', 'markAll', 'loseLifePerTheirMarked', 'fetchLand', 'ifTargetMarked',
  'severSelf',
]);

function opsOf(card: CardDef): EffectOp[] {
  const ops: EffectOp[] = [];
  for (const ability of card.abilities ?? []) ops.push(...(ability.ops ?? []));
  if (card.empower) ops.push(...card.empower.ops);
  if (card.retell?.ops) ops.push(...card.retell.ops);
  for (const chapter of card.chapters ?? []) ops.push(...chapter);
  return ops;
}

function rarityCounts(cards: readonly CardDef[]) {
  return Object.fromEntries(RARITIES.map((rarity) => [
    rarity,
    cards.filter((card) => card.rarity === rarity).length,
  ]));
}

describe('Starborne transcription', () => {
  it('pins the locked 151-card rarity mix', () => {
    expect(STARBORNE).toHaveLength(151);
    // 2026-08-29 owner ruling: relay C->SR at {6}, beacon C->SSR at {7}.
    expect(rarityCounts(STARBORNE)).toEqual({ c: 73, r: 45, sr: 15, ssr: 11, ur: 7 });
    expect(new Set(STARBORNE.map((card) => card.id)).size).toBe(151);
    expect(STARBORNE.every((card) => card.id.startsWith('sb-'))).toBe(true);
  });

  it('expresses the formerly blocked Starborne mechanics with positive assertions', () => {
    const card = (id: string) => CARD_DB[id];
    expect(card('sb-astral-biomancer').abilities).toEqual([
      expect.objectContaining({
        when: 'arrives',
        condition: 'controlMarked',
        targets: [{ what: 'yourPermanent', other: true }],
        ops: [{ op: 'addCounters', n: 1, to: 'target' }, { op: 'foresee', n: 1 }],
      }),
    ]);
    expect(card('sb-signal-inversion').abilities?.[0]).toMatchObject({
      targets: [{ what: 'creature' }],
      ops: [{ op: 'recall' }, { op: 'foresee', n: 1, who: 'targetOwner' }],
    });
    expect(card('sb-signal-cathedral').abilities).toEqual([
      expect.objectContaining({ when: 'dawn', ops: [{ op: 'foresee', n: 2 }] }),
      expect.objectContaining({ when: 'dawn', condition: { kind: 'markedThreshold', n: 5, subject: 'permanents' } }),
    ]);
    expect(card('sb-the-long-crossing').chapters).toHaveLength(3);
    expect(card('sb-interstellar-crossing').manaAbility).toEqual(['C']);
    expect(card('sb-gravitic-bloom').abilities?.[0].targets).toEqual([{ what: 'creature', upTo: 2 }]);
    expect(card('sb-bloomdrive-surge').abilities?.[0].targets).toEqual([{ what: 'creature', upTo: 2 }]);
    expect(card('sb-black-starving-orbit').abilities?.[0].targets).toEqual([{ what: 'creature', marked: true }]);
    expect(card('sb-cometary-verdict').abilities?.[0].targets).toEqual([{ what: 'creature', tapped: true }]);
    expect(card('sb-eclipse-red-queen').abilities?.[0].when).toBe('markedAllyAttacks');
    expect(card('sb-prism-void-comet').abilities?.[0].when).toBe('propagated');
    expect(card('sb-orbital-graft').abilities?.[0].when).toBe('allyCreatureArrives');
    expect(card('sb-voidflare-empress').abilities?.[0].when).toBe('yourCreatureMarked');
    expect(card('sb-appetite-of-the-void').abilities?.[0].ops).toEqual([
      { op: 'boost', p: -2, t: -2, scope: 'theirMarked' },
    ]);
  });

  it('renders non-empty rules text for every Starborne collectible', () => {
    for (const card of STARBORNE) {
      expect(rulesText(card).trim(), `${card.id} has empty rules text`).not.toBe('');
    }
  });

  it('defines the six proposed Starborne tokens with their locked identities', () => {
    const expected = {
      'tok-lumen-drone': { name: 'Lumen Drone', types: ['artifact', 'creature'], subtypes: ['Drone'], colors: [], attack: 1, defense: 1, keywords: ['skyborne'], flavor: 'A bioluminescent maintenance mote that learns attack formations.' },
      'tok-broodling': { name: 'Broodling', types: ['creature'], subtypes: ['Brood'], colors: ['G'], attack: 1, defense: 1, flavor: 'A translucent young swarm member that grows around warm machinery.' },
      'tok-chrome-husk': { name: 'Chrome Husk', types: ['artifact', 'creature'], subtypes: ['Husk'], colors: [], attack: 2, defense: 2, keywords: ['bulwark'], flavor: 'A discarded shell that keeps standing after its owner leaves.' },
      'tok-nebula-firefly': { name: 'Nebula Firefly', types: ['creature'], subtypes: ['Insect'], colors: ['U'], attack: 1, defense: 1, keywords: ['skyborne'], flavor: 'A tiny violet beacon that follows living ships between worlds.' },
      'tok-violet-hullguard': { name: 'Violet Hullguard', types: ['creature'], subtypes: ['Guardian'], colors: ['W'], attack: 1, defense: 3, keywords: ['sentinel'], flavor: 'A pearlescent defense organism shaped like a patient woman at attention.' },
      'tok-void-mote': { name: 'Void Mote', types: ['creature'], subtypes: ['Mote'], colors: ['B'], attack: 1, defense: 1, flavor: 'A black spark that dims one light whenever it dies.' },
    } as const;
    for (const [id, shape] of Object.entries(expected)) {
      const token = TOKENS.find((card) => card.id === id);
      expect(token, `${id} is missing from tokens.ts`).toBeDefined();
      expect(token?.token, `${id} must be a token`).toBe(true);
      expect(token).toMatchObject(shape);
    }
  });

  it('resolves every Starborne token reference and validates engine vocabulary', () => {
    for (const card of STARBORNE) {
      for (const keyword of card.keywords ?? []) {
        expect(KNOWN_KEYWORDS.has(keyword), `${card.id} has unknown keyword ${keyword}`).toBe(true);
      }
      for (const ability of card.abilities ?? []) {
        expect(KNOWN_TRIGGERS.has(ability.when), `${card.id} has unknown trigger ${ability.when}`).toBe(true);
        if (ability.when !== 'spell' && ability.when !== 'arrives') {
          expect(ability.targets ?? [], `${card.id} trigger targets`).toEqual([]);
        }
        for (const target of ability.targets ?? []) {
          expect(KNOWN_TARGETS.has(target.what), `${card.id} has unknown target ${target.what}`).toBe(true);
        }
      }
      for (const op of opsOf(card)) {
        expect(KNOWN_OPS.has(op.op), `${card.id} has unknown op ${op.op}`).toBe(true);
        if (op.op === 'createToken') {
          const token = CARD_DB[op.token];
          expect(token, `${card.id} references unknown token ${op.token}`).toBeDefined();
          expect(token?.token, `${op.token} must be marked token`).toBe(true);
        }
      }
    }
  });

  it('pins the requested Starborne color-pie facts', () => {
    const ops = (card: CardDef) => opsOf(card).map((op) => op.op);
    expect(STARBORNE.filter((card) => card.colors.includes('B') && ops(card).includes('propagate'))).toEqual([]);
    expect(STARBORNE.filter((card) => card.colors.includes('U') && card.id !== 'sb-astral-biomancer' && (ops(card).includes('addCounters') || ops(card).includes('propagate')))).toEqual([]);
  });

  it('registers a live, self-contained booster pool', () => {
    expect(ECONOMY.starbornePackPrice).toBe(525);
    for (const rarity of RARITIES) {
      const pool = packPool(CARD_DB, rarity, STARBORNE_PACK_SET);
      expect(pool.length, `${rarity} Starborne pool`).toBeGreaterThan(0);
      expect(pool.every((id) => CARD_DB[id].set === STARBORNE_PACK_SET), `${rarity} pool crossed sets`).toBe(true);
    }
    const result = openPack(freshSave(0), CARD_DB, createRngState(20260828), STARBORNE_PACK_SET);
    expect(result.cards).toHaveLength(ECONOMY.boosterPackSize);
    expect(result.cards.every((card) => CARD_DB[card.cardId].set === STARBORNE_PACK_SET)).toBe(true);
  });

  it('does not introduce em dashes into locked flavor text', () => {
    expect(STARBORNE.every((card) => !card.flavor?.includes('—'))).toBe(true);
  });

  it('adds exactly 151 collectibles and six tokens to the global catalog', () => {
    expect(ALL_CARDS.filter((card) => String(card.set) === STARBORNE_SET && !card.token)).toHaveLength(151);
    expect(TOKENS.filter((card) => [
      'tok-lumen-drone', 'tok-broodling', 'tok-chrome-husk',
      'tok-nebula-firefly', 'tok-violet-hullguard', 'tok-void-mote',
    ].includes(card.id))).toHaveLength(6);
  });
});
