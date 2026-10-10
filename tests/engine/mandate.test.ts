import { describe, expect, it } from 'vitest';
import { determinize } from '../../src/ai/determinize';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { startTurn } from '../../src/engine/phases';
import { getEffectiveStats } from '../../src/engine/statics';
import type { CardDb, CardDef, GameState, Permanent, PlayerId } from '../../src/engine/types';
import { rulesText } from '../../src/ui/rulesText';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * The Mandate (2.0, docs/plan-core-set-2-engine.md): one public marker that
 * begins unclaimed, draws its holder a card at their dawn before other dawn
 * triggers, passes to the attacking player once per combat-damage batch that
 * damages the holder, and is claimed by `claimMandate` effects.
 */
const zero = { generic: 0, pips: {} };
const creature = (id: string, attack: number, defense: number, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], cost: zero, colors: [], attack, defense, rarity: 'c', ...extra,
});
const DB: CardDb = {
  ...TEST_DB,
  herald: creature('herald', 2, 2, { abilities: [{ when: 'arrives', ops: [{ op: 'claimMandate' }] }] }),
  edict: { ...creature('edict', 0, 0), types: ['ritual'], attack: undefined, defense: undefined, abilities: [{ when: 'spell', ops: [{ op: 'claimMandate' }, { op: 'draw', n: 1 }] }] },
  brute: creature('brute', 3, 3),
  striker: creature('striker', 2, 2, { keywords: ['firstBlade'] }),
  twin: creature('twin', 2, 2, { keywords: ['twinBlades'] }),
  pacifist: creature('pacifist', 0, 4),
  raider: creature('raider', 2, 2, { abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'gainLife', n: 1 }] }] }),
  seer: creature('seer', 1, 1, { abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 1 }] }] }),
  fog: { ...creature('fog', 0, 0), types: ['charm'], attack: undefined, defense: undefined, abilities: [{ when: 'spell', ops: [{ op: 'preventCombat' }] }] },
  banner: { ...creature('banner', 0, 0), types: ['artifact'], attack: undefined, defense: undefined, abilities: [{ when: 'static', static: { scope: 'filter', p: 1, t: 0, condition: 'youHoldMandate' } }] },
  library: { ...creature('library', 0, 0), types: ['enchantment'], attack: undefined, defense: undefined, abilities: [{ when: 'dawn', condition: 'youHoldMandate', ops: [{ op: 'gainLife', n: 3 }] }] },
  nemesis: creature('nemesis', 2, 4, { abilities: [{ when: 'dawn', condition: 'youDontHoldMandate', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }] }),
  kite: creature('kite', 2, 3, { abilities: [{ when: 'youClaimMandate', ops: [{ op: 'gainLife', n: 1 }] }] }),
  usurper: creature('usurper', 4, 4, { abilities: [{ when: 'youClaimMandate', targets: [{ what: 'opponentCreature' }], ops: [{ op: 'sever', to: 'target' }] }] }),
};

function boardState(
  battlefield: Partial<Permanent>[],
  opts: { holder?: PlayerId; hands?: [string[], string[]]; deck?: number } = {},
): GameState {
  const state = makeTestState({ battlefield, hands: opts.hands, active: 0 });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 100;
  state.nextInstanceId = 1000;
  for (const player of state.players) player.deck = Array(opts.deck ?? 20).fill('forest');
  if (opts.holder !== undefined) state.mandateHolder = opts.holder;
  return state;
}

const changes = (events: GameEvent[]) => events.filter((e) => e.e === 'mandateChanged');

/** Attack with `attackers`, no blocks unless given, through to the end of combat damage. */
function attack(game: Game, attackers: number[], blocks: { blocker: number; attacker: number }[] = []): GameEvent[] {
  const events: GameEvent[] = [];
  events.push(...game.submit(0, { type: 'passStep' }));
  events.push(...game.submit(0, { type: 'declareAttackers', attackers }));
  events.push(...game.submit(1, { type: 'declareBlockers', blocks }));
  return events;
}

describe('the Mandate', () => {
  it('begins unclaimed, and an unclaimed Mandate is absent from both views', () => {
    const game = new Game({ decks: [Array(40).fill('forest'), Array(40).fill('forest')], seed: 7, db: DB });
    expect(game.instanceState.mandateHolder).toBeUndefined();
    expect(game.viewFor(0).mandateHolder).toBeUndefined();
    expect(game.viewFor(1).mandateHolder).toBeUndefined();
  });

  it('a claim effect gives it to its controller, and both seats see the holder', () => {
    const game = Game.restore(boardState([], { hands: [['herald'], []] }), DB);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(changes(events)).toEqual([{ e: 'mandateChanged', from: null, to: 0, reason: 'effect' }]);
    expect(game.viewFor(0).mandateHolder).toBe(0);
    expect(game.viewFor(1).mandateHolder).toBe(0);
  });

  it('claiming from the other player names who held it', () => {
    const game = Game.restore(boardState([], { hands: [['edict'], []], holder: 1 }), DB);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(changes(events)).toEqual([{ e: 'mandateChanged', from: 1, to: 0, reason: 'effect' }]);
  });

  it('claiming the Mandate you already hold changes nothing and emits nothing', () => {
    const game = Game.restore(boardState([], { hands: [['edict'], []], holder: 0 }), DB);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(changes(events)).toEqual([]);
    expect(game.instanceState.mandateHolder).toBe(0);
    // The rest of the spell still resolves.
    expect(events.some((e) => e.e === 'drew' && e.player === 0)).toBe(true);
  });

  describe('at dawn', () => {
    it('its holder draws before their permanents\' dawn triggers, then takes the normal draw', () => {
      const state = boardState([{ iid: 1, cardId: 'seer', controller: 1 }], { holder: 1 });
      state.activePlayer = 1;
      const events: GameEvent[] = [];
      startTurn(state, DB, (e) => events.push(e));
      const draws = events.flatMap((e, i) => (e.e === 'drew' && e.player === 1 ? [i] : []));
      const dawnTrigger = events.findIndex((e) => e.e === 'triggerFired' && e.iid === 1);
      expect(draws).toHaveLength(2);
      expect(draws[0]).toBeLessThan(dawnTrigger);
      expect(draws[1]).toBeGreaterThan(dawnTrigger);
      expect(state.players[1].hand).toHaveLength(2);
    });

    it('a player who does not hold it draws only the normal card', () => {
      const state = boardState([], { holder: 0 });
      state.activePlayer = 1;
      startTurn(state, DB, () => {});
      expect(state.players[1].hand).toHaveLength(1);
    });

    it('still draws on the starting player\'s first turn, which skips only the normal draw', () => {
      const state = boardState([], { holder: 0 });
      state.turn = 1;
      state.startingPlayer = 0;
      startTurn(state, DB, () => {});
      expect(state.players[0].hand).toHaveLength(1);
    });

    it('drawing from an empty deck loses the game at that point', () => {
      const state = boardState([{ iid: 1, cardId: 'seer' }], { holder: 0, deck: 0 });
      const events: GameEvent[] = [];
      startTurn(state, DB, (e) => events.push(e));
      expect(state.winner).toBe(1);
      expect(state.winReason).toBe('deck');
      expect(events.some((e) => e.e === 'triggerFired')).toBe(false);
    });
  });

  describe('in combat', () => {
    it('combat damage to the holder passes it to the attacker', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'brute' }], { holder: 1 }), DB);
      const events = attack(game, [1]);
      expect(changes(events)).toEqual([{ e: 'mandateChanged', from: 1, to: 0, reason: 'combat' }]);
      expect(game.instanceState.mandateHolder).toBe(0);
    });

    it('several attackers connecting claim it once', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'brute' }, { iid: 2, cardId: 'brute' }], { holder: 1 }), DB);
      expect(changes(attack(game, [1, 2]))).toHaveLength(1);
    });

    it('claims after the damage lands and before combat-damage triggers', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'raider' }], { holder: 1 }), DB);
      const events = attack(game, [1]);
      const damage = events.findIndex((e) => e.e === 'lifeChanged' && e.player === 1);
      const claim = events.findIndex((e) => e.e === 'mandateChanged');
      const trigger = events.findIndex((e) => e.e === 'triggerFired' && e.iid === 1);
      expect(damage).toBeGreaterThanOrEqual(0);
      expect(claim).toBeGreaterThan(damage);
      expect(trigger).toBeGreaterThan(claim);
    });

    it('a first-strike batch claims it and the normal batch does not claim it again', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'twin' }, { iid: 2, cardId: 'brute' }], { holder: 1 }), DB);
      const events = attack(game, [1, 2]);
      const fsBatch = events.findIndex((e) => e.e === 'combatDamage' && e.firstStrike);
      const normalBatch = events.findIndex((e) => e.e === 'combatDamage' && !e.firstStrike);
      expect(changes(events)).toHaveLength(1);
      const claim = events.findIndex((e) => e.e === 'mandateChanged');
      expect(claim).toBeGreaterThan(fsBatch);
      expect(claim).toBeLessThan(normalBatch);
    });

    it('combat damage to a player who does not hold it claims nothing', () => {
      const unclaimed = Game.restore(boardState([{ iid: 1, cardId: 'brute' }]), DB);
      expect(changes(attack(unclaimed, [1]))).toEqual([]);
      expect(unclaimed.instanceState.mandateHolder).toBeUndefined();
      const attackerHolds = Game.restore(boardState([{ iid: 1, cardId: 'brute' }], { holder: 0 }), DB);
      expect(changes(attack(attackerHolds, [1]))).toEqual([]);
    });

    it('damage dealt only to blocking creatures claims nothing', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'brute' }, { iid: 2, cardId: 'pacifist', controller: 1 }], { holder: 1 }), DB);
      expect(changes(attack(game, [1], [{ blocker: 2, attacker: 1 }]))).toEqual([]);
      expect(game.instanceState.mandateHolder).toBe(1);
    });

    it('an attacker with no Attack claims nothing', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'pacifist' }], { holder: 1 }), DB);
      expect(changes(attack(game, [1]))).toEqual([]);
    });

    it('prevented combat damage claims nothing', () => {
      const state = boardState([{ iid: 1, cardId: 'brute' }], { holder: 1 });
      state.fogThisTurn = true;
      const game = Game.restore(state, DB);
      expect(changes(attack(game, [1]))).toEqual([]);
      expect(game.instanceState.mandateHolder).toBe(1);
    });

    it('lethal damage still passes it before the game ends', () => {
      const state = boardState([{ iid: 1, cardId: 'brute' }], { holder: 1 });
      state.players[1].life = 3;
      const game = Game.restore(state, DB);
      const events = attack(game, [1]);
      expect(changes(events)).toHaveLength(1);
      expect(game.instanceState.winner).toBe(0);
    });
  });

  it('survives restore and the AI\'s determinized copy exactly', () => {
    const game = Game.restore(boardState([], { holder: 1 }), DB);
    expect(game.instanceState.mandateHolder).toBe(1);
    expect(determinize(game.viewFor(0), DB).instanceState.mandateHolder).toBe(1);
    expect(game.clone().instanceState.mandateHolder).toBe(1);
  });

  describe('on cards', () => {
    it('"while you hold the Mandate" statics follow the holder, including a combat steal', () => {
      const game = Game.restore(boardState([
        { iid: 1, cardId: 'brute' }, { iid: 2, cardId: 'banner', controller: 1 }, { iid: 3, cardId: 'brute', controller: 1 },
      ], { holder: 1 }), DB);
      const attackOf = (iid: number) => getEffectiveStats(game.instanceState, DB, iid).attack;
      expect(attackOf(3)).toBe(4);
      attack(game, [1]);
      expect(game.instanceState.mandateHolder).toBe(0);
      expect(attackOf(3)).toBe(3);
    });

    it('a bare battlefield reads the Mandate as unclaimed', () => {
      const state = boardState([{ iid: 2, cardId: 'banner' }, { iid: 3, cardId: 'brute' }], { holder: 0 });
      expect(getEffectiveStats(state, DB, 3).attack).toBe(4);
      expect(getEffectiveStats(state.battlefield, DB, 3).attack).toBe(3);
    });

    it('"if you hold" and "if you don\'t hold" dawn abilities read the holder when they fire', () => {
      for (const holder of [0, 1, undefined] as const) {
        const state = boardState([{ iid: 1, cardId: 'library' }, { iid: 2, cardId: 'nemesis' }], { holder });
        startTurn(state, DB, () => {});
        expect(state.players[0].life).toBe(holder === 0 ? 23 : 20);
        expect(state.players[1].life).toBe(holder === 0 ? 20 : 18);
      }
    });

    it('"whenever you claim the Mandate" fires for the claimant only, and not on a claim that changes nothing', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'kite' }, { iid: 2, cardId: 'kite', controller: 1 }], { hands: [['edict', 'edict'], []] }), DB);
      game.submit(0, { type: 'castSpell', handIndex: 0 });
      expect(game.instanceState.players.map((p) => p.life)).toEqual([21, 20]);
      game.submit(0, { type: 'castSpell', handIndex: 0 });
      expect(game.instanceState.players.map((p) => p.life)).toEqual([21, 20]);
    });

    it('a combat claim fires claim abilities before combat-damage triggers', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'raider' }, { iid: 2, cardId: 'kite' }], { holder: 1 }), DB);
      const events = attack(game, [1]);
      const claimTrigger = events.findIndex((e) => e.e === 'triggerFired' && e.iid === 2);
      const damageTrigger = events.findIndex((e) => e.e === 'triggerFired' && e.iid === 1);
      expect(claimTrigger).toBeGreaterThan(events.findIndex((e) => e.e === 'mandateChanged'));
      expect(damageTrigger).toBeGreaterThan(claimTrigger);
    });

    it('a targeted claim ability asks its controller for a target', () => {
      const game = Game.restore(boardState([{ iid: 1, cardId: 'usurper' }, { iid: 2, cardId: 'brute', controller: 1 }], { hands: [['edict'], []] }), DB);
      game.submit(0, { type: 'castSpell', handIndex: 0 });
      expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 0 });
      game.submit(0, { type: 'chooseTarget', target: { kind: 'permanent', iid: 2 } });
      expect(game.instanceState.battlefield.some((p) => p.iid === 2)).toBe(false);
    });

    it('reads as card text', () => {
      expect(rulesText(DB.banner)).toBe('While you hold the Mandate, creatures you control get +1/+0.');
      expect(rulesText(DB.kite)).toBe('Whenever you claim the Mandate, you gain 1 life.');
      expect(rulesText(DB.nemesis)).toMatch(/If you don't hold the Mandate, .*loses 2 life/);
    });
  });
});
