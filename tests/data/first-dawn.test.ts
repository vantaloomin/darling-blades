import { describe, expect, it } from 'vitest';
import { AXES } from '../../src/data/axes';
import { FIRST_DAWN } from '../../src/data/cards/first-dawn';
import { TOKENS } from '../../src/data/cards/tokens';
import { CARD_DB } from '../../src/data/catalog';
import { FIRST_DAWN_SET, isLiveCollectible, isLiveSet } from '../../src/data/liveness';
import { SET_IDS, SET_TITLES } from '../../src/data/setTitles';
import {
  activatedAbilitiesOf,
  flatOps,
  validateA16Def,
  validateEmpowerDef,
  validateHuntDef,
  validateProvokedDef,
} from '../../src/engine/types';
import type { CardDef, EffectOp } from '../../src/engine/types';

const tokenIds = ['tok-hatchling', 'tok-pack-raptor', 'tok-tar-bones', 'tok-glider'];

function opsOf(card: CardDef): EffectOp[] {
  return flatOps([
    ...(card.abilities ?? []).flatMap((ability) => ability.ops ?? []),
    ...activatedAbilitiesOf(card).flatMap((ability) => ability.ops),
    ...(card.manaActivated ?? []).flatMap((ability) => ability.ops),
    ...(card.empower?.ops ?? []),
    ...(card.retell?.ops ?? []),
    ...(card.chapters ?? []).flat(),
  ]);
}

describe('First Dawn transcription', () => {
  it('accepts every printed Hunt, Provoked, Empower, and A1.6 shape', () => {
    for (const card of FIRST_DAWN) {
      expect(validateHuntDef(card), card.id).toEqual([]);
      expect(validateProvokedDef(card), card.id).toEqual([]);
      expect(validateEmpowerDef(card), card.id).toEqual([]);
      expect(validateA16Def(card), card.id).toEqual([]);
    }
  });

  it('mints every First Dawn token and no foreign token', () => {
    const minted = new Set<string>();
    for (const card of FIRST_DAWN) {
      for (const op of opsOf(card)) {
        if (op.op !== 'createToken') continue;
        expect(tokenIds, card.id).toContain(op.token);
        expect(CARD_DB[op.token]?.token, card.id).toBe(true);
        minted.add(op.token);
      }
    }
    expect([...minted].sort()).toEqual([...tokenIds].sort());
  });

  it('registers its live set identity and stamps each First Dawn token as a creature token', () => {
    expect(SET_IDS).toContain(FIRST_DAWN_SET);
    expect(SET_TITLES[FIRST_DAWN_SET]).toBe('First Dawn');
    expect(isLiveSet(FIRST_DAWN_SET)).toBe(true);
    expect(AXES).toEqual(expect.arrayContaining(['Dinokin', 'Dinosaur']));
    for (const card of FIRST_DAWN) expect(isLiveCollectible(card), card.id).toBe(true);

    for (const id of tokenIds) {
      const token: CardDef | undefined = TOKENS.find((candidate) => candidate.id === id);
      expect(token?.types, id).toContain('creature');
      expect(token, id).toMatchObject({ token: true, set: FIRST_DAWN_SET });
    }
  });
});
