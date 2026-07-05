import { describe, expect, it } from 'vitest';
import { manaValue } from '../../src/engine/types';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { ARTIFACTS } from '../../src/data/cards/artifacts';
import { BEASTKIN } from '../../src/data/cards/beastkin';
import { DUALS } from '../../src/data/cards/duals';
import { ENCHANTMENTS } from '../../src/data/cards/enchantments';
import { GREEK } from '../../src/data/cards/greek';
import { INSTANTS } from '../../src/data/cards/instants';
import { LANDS } from '../../src/data/cards/lands';
import { SORCERIES } from '../../src/data/cards/sorceries';
import { TK_JIN } from '../../src/data/cards/tk-jin';
import { TK_OTHER } from '../../src/data/cards/tk-other';
import { TK_SHU } from '../../src/data/cards/tk-shu';
import { TK_WEI } from '../../src/data/cards/tk-wei';
import { TK_WU } from '../../src/data/cards/tk-wu';
import { TOKENS } from '../../src/data/cards/tokens';

describe('catalog integrity', () => {
  it('has no duplicate ids', () => {
    const seen = new Set<string>();
    for (const card of ALL_CARDS) {
      expect(seen.has(card.id), `duplicate id: ${card.id}`).toBe(false);
      seen.add(card.id);
    }
  });

  it('ids follow the per-set prefix conventions', () => {
    const conventions: [readonly { id: string }[], string][] = [
      [TK_WEI, 'tk-wei-'],
      [TK_WU, 'tk-wu-'],
      [TK_SHU, 'tk-shu-'],
      [TK_JIN, 'tk-jin-'],
      [TK_OTHER, 'tk-other-'],
      [GREEK, 'gk-'],
      [BEASTKIN, 'bk-'],
      [INSTANTS, 'in-'],
      [SORCERIES, 'so-'],
      [ENCHANTMENTS, 'en-'],
      [ARTIFACTS, 'ar-'],
      [DUALS, 'ld-'],
      [LANDS, 'land-'],
      [TOKENS, 'tok-'],
    ];
    for (const [set, prefix] of conventions) {
      for (const card of set) {
        expect(card.id.startsWith(prefix), `${card.id} should start with ${prefix}`).toBe(true);
      }
    }
    // every catalog card belongs to exactly one of the listed sets
    const setSizes = conventions.reduce((n, [set]) => n + set.length, 0);
    expect(ALL_CARDS.length).toBe(setSizes);
  });

  it('every non-land, non-token card has a cost with mana value 1-8', () => {
    for (const card of ALL_CARDS) {
      if (card.types.includes('land') || card.token) continue;
      expect(card.cost, `${card.id} needs a cost`).toBeDefined();
      const mv = manaValue(card.cost);
      expect(mv, `${card.id} mana value ${mv}`).toBeGreaterThanOrEqual(1);
      expect(mv, `${card.id} mana value ${mv}`).toBeLessThanOrEqual(8);
    }
  });

  it('creature power/toughness stay within 0-10', () => {
    for (const card of ALL_CARDS) {
      if (!card.types.includes('creature')) continue;
      expect(card.power, `${card.id} power`).toBeGreaterThanOrEqual(0);
      expect(card.power, `${card.id} power`).toBeLessThanOrEqual(10);
      expect(card.toughness, `${card.id} toughness`).toBeGreaterThanOrEqual(0);
      expect(card.toughness, `${card.id} toughness`).toBeLessThanOrEqual(10);
    }
  });

  it('every createToken op references a tokens.ts card with token: true', () => {
    for (const card of ALL_CARDS) {
      for (const ability of card.abilities ?? []) {
        for (const op of ability.ops ?? []) {
          if (op.op !== 'createToken') continue;
          const tokenDef = CARD_DB[op.token];
          expect(tokenDef, `${card.id} references unknown token ${op.token}`).toBeDefined();
          expect(tokenDef.token, `${op.token} must have token: true`).toBe(true);
          expect(tokenDef.id.startsWith('tok-'), `${op.token} must live in tokens.ts`).toBe(true);
        }
      }
    }
  });

  it('basic lands carry the basic supertype', () => {
    for (const card of LANDS) {
      expect(card.supertypes, `${card.id} must be basic`).toEqual(['basic']);
    }
  });

  it('rarity mix (excluding basics and tokens) sits in the target bands', () => {
    const pool = ALL_CARDS.filter(
      (c) => !c.token && !(c.supertypes ?? []).includes('basic'),
    );
    const share = (rarity: string) =>
      pool.filter((c) => c.rarity === rarity).length / pool.length;
    // Bands derived from the measured 2026-07-04 remap: 103 c / 65 r / 13 sr /
    // 11 ssr / 8 ur over a 200-card pool (51.5 / 32.5 / 6.5 / 5.5 / 4.0 %).
    expect(share('c')).toBeGreaterThanOrEqual(0.45);
    expect(share('c')).toBeLessThanOrEqual(0.6);
    expect(share('r')).toBeGreaterThanOrEqual(0.25);
    expect(share('r')).toBeLessThanOrEqual(0.4);
    expect(share('sr')).toBeGreaterThanOrEqual(0.04);
    expect(share('sr')).toBeLessThanOrEqual(0.1);
    expect(share('ssr')).toBeGreaterThanOrEqual(0.03);
    expect(share('ssr')).toBeLessThanOrEqual(0.08);
    expect(share('ur')).toBeGreaterThanOrEqual(0.02);
    expect(share('ur')).toBeLessThanOrEqual(0.06);
  });

  it('every rarity tier has a non-empty booster-eligible pool (ur >= 4)', () => {
    // Same filter as PackOpener.packPool: non-token, non-basic, castable or land.
    const booster = ALL_CARDS.filter(
      (c) =>
        !c.token &&
        !(c.supertypes ?? []).includes('basic') &&
        (c.cost !== undefined || c.types.includes('land')),
    );
    for (const tier of ['c', 'r', 'sr', 'ssr', 'ur'] as const) {
      const n = booster.filter((c) => c.rarity === tier).length;
      expect(n, `booster pool for tier ${tier}`).toBeGreaterThan(0);
    }
    expect(
      booster.filter((c) => c.rarity === 'ur').length,
      'ur booster pool must support dupe-protected picks',
    ).toBeGreaterThanOrEqual(4);
  });

  it('the pool holds at least 180 cards', () => {
    expect(ALL_CARDS.length).toBeGreaterThanOrEqual(180);
  });

  it('every multicolor nonland card is legendary', () => {
    for (const card of ALL_CARDS) {
      if (card.types.includes('land') || card.colors.length < 2) continue;
      expect(
        (card.supertypes ?? []).includes('legendary'),
        `${card.id} is multicolor and must be legendary`,
      ).toBe(true);
    }
  });
});
