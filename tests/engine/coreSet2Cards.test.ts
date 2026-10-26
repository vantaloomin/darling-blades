import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, GameState, Permanent } from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * The engine pieces Core Set II's transcription needed beyond the 2.0 spec
 * (src/data/cards/core-set-2.ts): an Attack ceiling on a target, the marked
 * creature as a mark trigger's "it", Warchest ramp, an Empower damage rider,
 * and a Duty that makes your creature hunt. Real rows, costs zeroed.
 */
const free = (id: string): CardDef => ({ ...CARD_DB[id], cost: { generic: 0, pips: {} }, ...(CARD_DB[id].empower ? { empower: { ...CARD_DB[id].empower!, cost: { generic: 0, pips: {} } } } : {}),
  ...(CARD_DB[id].activated && !Array.isArray(CARD_DB[id].activated) ? { activated: { ...(CARD_DB[id].activated as object), cost: { tap: true } } as CardDef['activated'] } : {}) });
const IDS = ['cs2-jia-nanfeng', 'cs2-usurp-the-seal', 'cs2-peach-garden-oath', 'cs2-ma-yunlu', 'cs2-seeds-of-the-south', 'cs2-wu-marine',
  'cs2-grove-of-artemis', 'cs2-circe', 'tok-pig'];
const vanilla = (id: string, attack: number, defense: number): CardDef => ({ id, name: id, types: ['creature'], subtypes: [], cost: { generic: 0, pips: {} }, colors: [], attack, defense, rarity: 'c' });
const DB: CardDb = { ...TEST_DB, ...Object.fromEntries(IDS.map((id) => [id, free(id)])), small: vanilla('small', 2, 2), big: vanilla('big', 4, 4) };

function boardState(battlefield: Partial<Permanent>[], hands: [string[], string[]] = [[], []]): GameState {
  const state = makeTestState({ battlefield, hands, active: 0 });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 100;
  state.nextInstanceId = 1000;
  for (const player of state.players) player.deck = Array(20).fill('small');
  return state;
}
const perm = (game: Game, iid: number) => game.instanceState.battlefield.find((p) => p.iid === iid);

describe('Core Set II rows on the engine', () => {
  it('Jia Nanfeng severs only a creature with Attack 3 or less', () => {
    const game = Game.restore(boardState([{ iid: 1, cardId: 'cs2-jia-nanfeng' }, { iid: 2, cardId: 'small', controller: 1 }, { iid: 3, cardId: 'big', controller: 1 }],
      [['cs2-usurp-the-seal'], []]), DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    const offered = game.legalActions(0).flatMap((a) => a.type === 'chooseTarget' && a.target.kind === 'permanent' ? [a.target.iid] : []);
    expect(offered).toEqual([2]);
    expect(rulesText(CARD_DB['cs2-jia-nanfeng'])).toContain('Sever target creature an opponent controls with attack 3 or less.');
  });

  it('Peach Garden Oath: the marked creature gets +1/+0 only while you are Sworn', () => {
    for (const sworn of [true, false]) {
      const field: Partial<Permanent>[] = [{ iid: 1, cardId: 'cs2-peach-garden-oath' }, { iid: 2, cardId: 'small' }];
      if (sworn) field.push({ iid: 3, cardId: 'cs2-ma-yunlu' });
      const game = Game.restore(boardState(field), DB);
      game.submit(0, { type: 'activate', iid: 1, targets: [{ kind: 'permanent', iid: 2 }] });
      const marked = perm(game, 2)!;
      expect(marked.plusOneCounters).toBe(1);
      expect(game.instanceState.players[0].life).toBe(21);
      expect(marked.untilEotMods.reduce((n, mod) => n + (mod.p ?? 0), 0)).toBe(sworn ? 1 : 0);
    }
    expect(rulesText(CARD_DB['cs2-peach-garden-oath'])).toContain('Sworn: whenever a creature you control gets a Mark, it gets +1/+0 until Sunset.');
  });

  it('ramp takes the first land of the Warchest, tapped', () => {
    const state = boardState([], [['cs2-seeds-of-the-south'], []]);
    state.players[0].landReserve = ['plains', 'forest'];
    const game = Game.restore(state, DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.instanceState.players[0].landReserve).toHaveLength(1);
    const land = game.instanceState.battlefield.find((p) => p.controller === 0 && p.cardId === 'plains');
    expect(land?.tapped).toBe(true);
  });

  it('Wu Marine\'s Empower deals 2 damage to its target', () => {
    const game = Game.restore(boardState([{ iid: 2, cardId: 'big', controller: 1 }], [['cs2-wu-marine'], []]), DB);
    const cast = game.legalActions(0).find((a) => a.type === 'castSpell' && a.empowered && a.targets?.[0]?.kind === 'permanent');
    expect(cast).toBeDefined();
    game.submit(0, cast!);
    expect(perm(game, 2)!.damage).toBe(2);
  });

  it('Grove of Artemis: your creature hunts the prey you pick', () => {
    const game = Game.restore(boardState([{ iid: 1, cardId: 'cs2-grove-of-artemis' }, { iid: 2, cardId: 'big' }, { iid: 3, cardId: 'small', controller: 1 }]), DB);
    game.submit(0, { type: 'activate', iid: 1, targets: [{ kind: 'permanent', iid: 2 }, { kind: 'permanent', iid: 3 }] });
    expect(perm(game, 3)).toBeUndefined();
    expect(perm(game, 2)!.damage).toBe(2);
  });

  it('Circe names the Pig', () => {
    expect(rulesText(CARD_DB['cs2-circe'])).toContain('then its controller creates one 1/1 Pig token.');
  });
});
