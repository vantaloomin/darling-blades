import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { startTurn } from '../../src/engine/phases';
import { checkStateBased } from '../../src/engine/sba';
import type { AbilityDef, CardDb, CardDef, EffectOp, GameState, PlayerId } from '../../src/engine/types';
import { validateProvokedDef } from '../../src/engine/types';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';
import { HAUNTLINK_DB } from '../hauntlinkFixture';

// Provoked (plan-first-dawn-engine.md, Part 1, as ruled by the owner in E1):
// "Provoked: [effect]" triggers when this creature is dealt damage and
// survives. It fires in the state-based check, after that check's deaths and
// dies triggers, at most once each turn per creature; a targeted one is
// chosen after the current effect or damage step.

const gain = (n: number): EffectOp[] => [{ op: 'gainLife', n }];
const provoked = (ops: EffectOp[], extra: Partial<AbilityDef> = {}): AbilityDef => ({ when: 'provoked', ops, ...extra });

/** 2/4, "Provoked: you gain 3 life." */
const grazer = card('grazer', { abilities: [provoked(gain(3))] });
/** 1/4, "Provoked: this gets +2/+0 until end of turn." */
const brawler = card('brawler', { attack: 1, abilities: [provoked([{ op: 'boost', p: 2, t: 0, scope: 'self' }])] });
/** 2/4, "Provoked: deal 1 damage to target creature an opponent controls." */
const sniper = card('sniper', { abilities: [provoked([{ op: 'damage', n: 1, to: 'target' }], { targets: [{ what: 'opponentCreature' }] })] });
const plain = card('plain');

const ctx = (controller: PlayerId = 0) => ({ controller, sourceCardId: 'test', targets: [] });

/** Deal damage with the real op, then run the state-based check that follows it. */
function strike(state: GameState, db: CardDb, iid: number, n: number, events: GameEvent[] = []): GameEvent[] {
  runOps(state, db, (e) => events.push(e), { ...ctx(), targets: [ref(iid)] }, [{ op: 'damage', n, to: 'target' }]);
  checkStateBased(state, db, (e) => events.push(e));
  return events;
}

const provokedFires = (events: GameEvent[]) => events.filter((e) => e.e === 'triggerFired' && e.when === 'provoked');

describe('Provoked: the boundary', () => {
  const db = dbOf(grazer, plain);

  it('fires when its creature survives non-lethal damage', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'grazer' }]);
    const events = strike(state, db, 1, 2);
    expect(state.players[0].life).toBe(23);
    expect(provokedFires(events)).toEqual([{ e: 'triggerFired', iid: 1, when: 'provoked' }]);
  });

  it('does not fire when the damage is lethal', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'grazer' }]);
    const events = strike(state, db, 1, 4);
    expect(state.battlefield.some((p) => p.iid === 1)).toBe(false);
    expect(state.players[0].life).toBe(20);
    expect(provokedFires(events)).toEqual([]);
  });

  it('does not fire when 1 Deathblade damage kills its creature in combat', () => {
    const viper = card('viper', { attack: 1, defense: 1, keywords: ['deathblade'] });
    const combatDb = dbOf(grazer, viper);
    const state = board([[], []], [{ iid: 1, cardId: 'grazer' }, { iid: 2, cardId: 'viper', controller: 1 }]);
    const game = Game.restore(state, combatDb);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [1] });
    game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 2, attacker: 1 }] });
    expect(game.instanceState.battlefield.some((p) => p.iid === 1)).toBe(false);
    expect(game.instanceState.players[0].life).toBe(20);
  });

  it('does not fire for 0 damage, and fires for the same creature dealt 1', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'grazer' }]);
    expect(provokedFires(strike(state, db, 1, 0))).toEqual([]);
    expect(state.players[0].life).toBe(20);
    expect(provokedFires(strike(state, db, 1, 1))).toHaveLength(1);
  });

  it('does not fire when its combat damage is prevented', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'plain' }, { iid: 2, cardId: 'grazer', controller: 1 }]);
    state.battlefield[1].combatDamagePrevented = true;
    const game = Game.restore(state, db);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [1] });
    game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 2, attacker: 1 }] });
    expect(game.instanceState.battlefield.find((p) => p.iid === 2)!.damage).toBe(0);
    expect(game.instanceState.players[1].life).toBe(20);
  });

  it('fires when it survives combat damage', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'plain' }, { iid: 2, cardId: 'grazer', controller: 1 }]);
    const game = Game.restore(state, db);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [1] });
    game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 2, attacker: 1 }] });
    expect(game.instanceState.players[1].life).toBe(23);
  });
});

describe('Provoked: once each turn', () => {
  const db = dbOf(grazer, sniper, plain);

  it('a second survived blow in the same turn does not fire', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'grazer' }]);
    strike(state, db, 1, 1);
    const second = strike(state, db, 1, 1);
    expect(provokedFires(second)).toEqual([]);
    expect(state.players[0].life).toBe(23);
  });

  it.each([0, 1] as const)('the first survived blow of the next turn fires again (P%i\'s turn)', (next) => {
    const state = board([[], []], [{ iid: 1, cardId: 'grazer' }]);
    strike(state, db, 1, 1);
    state.activePlayer = next;
    startTurn(state, db, () => {});
    expect(provokedFires(strike(state, db, 1, 1))).toHaveLength(1);
    expect(state.players[0].life).toBe(26);
  });

  it('a targeted Provoked with no legal target does not fire and is not spent', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'sniper' }]);
    expect(provokedFires(strike(state, db, 1, 1))).toEqual([]);
    expect(state.pendingDecisions).toEqual([]);
    state.battlefield.push({ ...state.battlefield[0], iid: 2, cardId: 'plain', controller: 1, owner: 1, damage: 0 });
    expect(provokedFires(strike(state, db, 1, 1))).toHaveLength(1);
    expect(state.pendingDecisions).toMatchObject([{ kind: 'chooseTarget', sourceIid: 1, triggerWhen: 'provoked' }]);
  });

  it('a creature that leaves and returns (Nine Lives) is a new creature and can be provoked again', () => {
    const cat = card('cat', { defense: 3, nineLives: true, abilities: [provoked(gain(3))] });
    const catDb = dbOf(cat);
    const state = board([[], []], [{ iid: 1, cardId: 'cat' }]);
    state.battlefield[0].instanceId = 900;
    strike(state, catDb, 1, 1);
    expect(state.players[0].life).toBe(23);
    strike(state, catDb, 1, 2); // lethal: it dies and returns with a Mark
    const returned = state.battlefield.find((p) => p.cardId === 'cat')!;
    expect(returned.iid).not.toBe(1);
    expect(provokedFires(strike(state, catDb, returned.iid, 1))).toHaveLength(1);
    expect(state.players[0].life).toBe(26);
  });

  it('a Preserve token copy of a creature provoked this turn can be provoked again', () => {
    const keeper = card('keeper', { defense: 3, preserve: { cost: { generic: 0, pips: {} } }, abilities: [provoked(gain(3))] });
    const keeperDb = dbOf(keeper);
    const state = board([[], []], [{ iid: 1, cardId: 'keeper' }]);
    strike(state, keeperDb, 1, 1);
    strike(state, keeperDb, 1, 2);
    expect(state.players[0].graveyard.map((c) => (typeof c === 'string' ? c : c.cardId))).toContain('keeper');
    const game = Game.restore(state, keeperDb);
    const preserve = game.legalActions(0).find((a) => a.type === 'preserveCard')!;
    game.submit(0, preserve);
    const st = game.instanceState as GameState;
    const token = st.battlefield.find((p) => p.cardId === 'keeper')!;
    expect(token.isToken).toBe(true);
    expect(provokedFires(strike(st, keeperDb, token.iid, 1))).toHaveLength(1);
    expect(st.players[0].life).toBe(26);
  });
});

describe('Provoked: when it resolves', () => {
  it('after the dies triggers of its own check, and not for a survivor a dies trigger finishes off', () => {
    const martyr = card('martyr', { defense: 2, abilities: [{ when: 'dies', ops: [{ op: 'damage', n: 1, to: 'eachCreature' }] }] });
    const tough = card('tough', { defense: 5, abilities: [provoked(gain(3))] });
    const frail = card('frail', { defense: 3, abilities: [provoked(gain(3))] });
    const sweep = spell('sweep', [{ op: 'damage', n: 2, to: 'eachCreature' }]);
    const db = dbOf(martyr, tough, frail, sweep);
    const state = board([[], []], [
      { iid: 1, cardId: 'tough' }, { iid: 2, cardId: 'frail', controller: 1 }, { iid: 3, cardId: 'martyr', controller: 1 },
    ]);
    const events: GameEvent[] = [];
    runOps(state, db, (e) => events.push(e), ctx(), sweep.abilities![0].ops!);
    checkStateBased(state, db, (e) => events.push(e));
    const dies = events.findIndex((e) => e.e === 'triggerFired' && e.when === 'dies');
    const provokedAt = events.findIndex((e) => e.e === 'triggerFired' && e.when === 'provoked');
    expect(dies).toBeGreaterThanOrEqual(0);
    expect(provokedAt).toBeGreaterThan(dies);
    // tough (2 + 1 of 5) survives and is provoked; frail (2 + 1 of 3) is finished off first.
    expect(provokedFires(events).map((e) => e.e === 'triggerFired' && e.iid)).toEqual([1]);
    expect(state.battlefield.map((p) => p.iid)).toEqual([1]);
    expect(state.players.map((p) => p.life)).toEqual([23, 20]);
  });

  describe('under First Blade', () => {
    const striker = card('striker', { attack: 1, defense: 9, keywords: ['firstBlade'] });

    it('an untargeted Provoked from the first-strike step adds its damage in the regular step', () => {
      const db = dbOf(striker, brawler);
      const game = Game.restore(board([[], []], [{ iid: 1, cardId: 'striker' }, { iid: 2, cardId: 'brawler', controller: 1 }]), db);
      game.submit(0, { type: 'passStep' });
      game.submit(0, { type: 'declareAttackers', attackers: [1] });
      game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 2, attacker: 1 }] });
      // The brawler (1/4) was provoked by the first-strike hit and swung back as a 3/4.
      expect(game.instanceState.battlefield.find((p) => p.iid === 1)!.damage).toBe(3);
    });

    it('a targeted Provoked is chosen after combat damage', () => {
      const db = dbOf(striker, sniper, plain);
      const game = Game.restore(board([[], []], [
        { iid: 1, cardId: 'striker' }, { iid: 3, cardId: 'plain' }, { iid: 2, cardId: 'sniper', controller: 1 },
      ]), db);
      game.submit(0, { type: 'passStep' });
      game.submit(0, { type: 'declareAttackers', attackers: [1] });
      game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: 2, attacker: 1 }] });
      expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 1, sourceIid: 2 });
      // The sniper's regular-step blow has already landed.
      expect(game.instanceState.battlefield.find((p) => p.iid === 1)!.damage).toBe(2);
      game.submit(1, { type: 'chooseTarget', target: ref(3) });
      expect(game.instanceState.battlefield.find((p) => p.iid === 3)!.damage).toBe(1);
    });
  });

  it('with a Hauntlink payable, an untargeted Provoked resolves in its own pass, ahead of that pass\'s held dies trigger', () => {
    // The ruled exception (E1): the dies trigger is held for the window; the
    // Provoked effect of the same check does not wait for it.
    const martyr = card('martyr', { defense: 2, abilities: [{ when: 'dies', ops: gain(5) }] });
    const anchor = card('anchor', { attack: 0, defense: 9 });
    const sweep = spell('sweep', [{ op: 'damage', n: 2, to: 'eachCreature' }]);
    const db: CardDb = { ...HAUNTLINK_DB, ...dbOf(martyr, grazer, anchor, sweep) };
    const state = board([['sweep'], []], [
      { iid: 1, cardId: 'grazer' }, { iid: 2, cardId: 'martyr' },
      { iid: 3, cardId: 'anchor', controller: 1 }, { iid: 4, cardId: 'hauntlink_enchantment', controller: 1 },
    ]);
    const game = Game.restore(state, db);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    // P1 could link in response to the spell; they pass, and it resolves.
    expect(game.awaiting).toMatchObject({ kind: 'respond', player: 1 });
    events.push(...game.submit(1, { type: 'passResponse' }));
    expect(game.awaiting).toMatchObject({ kind: 'hauntlinkWindow', player: 1, over: { type: 'trigger', iid: 2 } });
    expect(game.instanceState.players[0].life).toBe(23); // Provoked's 3, not yet the held 5
    expect(provokedFires(events)).toHaveLength(1);
    const after = game.submit(1, { type: 'passResponse' });
    expect(after.some((e) => e.e === 'lifeChanged' && e.delta === 5)).toBe(true);
    expect(game.instanceState.players[0].life).toBe(28);
  });

  it.each([
    ['killed', [{ op: 'damage', n: 3, to: 'target' }]],
    ['recalled', [{ op: 'recall', to: 'target' }]],
  ] as [string, EffectOp[]][])('a targeted Provoked whose creature is %s before its choice is answered does nothing', (_, ops) => {
    // Both creatures are provoked by one sweep; the first choice (P1's
    // avenger, earlier in battlefield order) removes the second's creature.
    const avenger = card('avenger', { abilities: [provoked(ops, { targets: [{ what: 'opponentCreature' }] })] });
    const sweep = spell('sweep', [{ op: 'damage', n: 1, to: 'eachCreature' }]);
    const db = dbOf(avenger, sniper, sweep);
    const game = Game.restore(board([['sweep'], []], [
      { iid: 1, cardId: 'avenger', controller: 1 }, { iid: 2, cardId: 'sniper' },
    ]), db);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 1, sourceIid: 1 });
    const events = game.submit(1, { type: 'chooseTarget', target: ref(2) });
    expect(game.instanceState.battlefield.some((p) => p.iid === 2)).toBe(false);
    expect(events).toContainEqual({ e: 'triggerFizzled', iid: 2 });
    expect(game.awaiting).toEqual({ player: 0, kind: 'main' });
    expect(game.instanceState.battlefield.find((p) => p.iid === 1)!.damage).toBe(1); // only the sweep's
  });

  it('a targeted Provoked raised in a Dawn check pauses the Dawn and resumes it', () => {
    const drummer = card('drummer', { types: ['enchantment'], attack: undefined, defense: undefined,
      abilities: [{ when: 'dawn', ops: [{ op: 'damage', n: 1, to: 'eachCreature' }] }] });
    const db = dbOf(drummer, sniper, plain);
    const state = board([[], []], [{ iid: 1, cardId: 'drummer' }, { iid: 2, cardId: 'sniper' }, { iid: 3, cardId: 'plain', controller: 1 }]);
    state.activePlayer = 1;
    state.awaiting = { player: 1, kind: 'main' };
    const game = Game.restore(state, db);
    const handBefore = game.instanceState.players[0].hand.length;
    for (let i = 0; i < 20 && game.instanceState.activePlayer === 1; i++) {
      const legal = game.legalActions(game.awaiting.kind === 'gameOver' ? 0 : game.awaiting.player);
      const pick: Action | undefined = legal.find((a) => a.type === 'passStep') ?? legal.find((a) => a.type === 'passResponse') ??
        legal.find((a) => a.type === 'declareAttackers' && a.attackers.length === 0);
      if (!pick) break;
      game.submit((game.awaiting as { player: PlayerId }).player, pick);
    }
    expect(game.instanceState.step).toBe('dawn');
    expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 0, sourceIid: 2 });
    expect(game.instanceState.players[0].hand).toHaveLength(handBefore);
    game.submit(0, { type: 'chooseTarget', target: ref(3) });
    expect(game.instanceState.step).toBe('main1');
    expect(game.instanceState.players[0].hand).toHaveLength(handBefore + 1);
    expect(game.instanceState.battlefield.find((p) => p.iid === 3)!.damage).toBe(2);
  });
});

describe('Provoked: loops', () => {
  it('two full boards of cross-provoking creatures settle within the pass budget', () => {
    // Every creature: "Provoked: deal 1 damage to each creature an opponent
    // controls." Without once each turn this board never stabilises.
    const echo = card('echo', { attack: 1, defense: 30, abilities: [provoked([{ op: 'damage', n: 1, to: 'eachOpponentCreature' }])] });
    const db = dbOf(echo);
    const side = (controller: PlayerId, from: number) =>
      Array.from({ length: 8 }, (_, i) => ({ iid: from + i, cardId: 'echo', controller, owner: controller }));
    const state = board([[], []], [...side(0, 1), ...side(1, 11)]);
    const events: GameEvent[] = [];
    expect(() => strike(state, db, 1, 1, events)).not.toThrow();
    // Each of the sixteen fired exactly once.
    expect(new Set(provokedFires(events).map((e) => e.e === 'triggerFired' && e.iid)).size).toBe(16);
    expect(provokedFires(events)).toHaveLength(16);
  });
});

describe('Provoked: the catalog contract', () => {
  it('is printed on creatures only, at most one per card, never with a printed once-each-turn flag', () => {
    expect(validateProvokedDef(grazer)).toEqual([]);
    const errors = (d: CardDef) => validateProvokedDef(d).length;
    expect(errors({ ...grazer, types: ['artifact'] })).toBeGreaterThan(0);
    expect(errors({ ...grazer, abilities: [provoked(gain(1)), provoked(gain(2))] })).toBeGreaterThan(0);
    expect(errors({ ...grazer, abilities: [provoked(gain(1), { oncePerTurn: true })] })).toBeGreaterThan(0);
  });

});
