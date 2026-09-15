import { describe, expect, it } from 'vitest';
import { forcedAction, legalActions, reasonUncastable, validateAction } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { startTurn } from '../../src/engine/phases';
import type { CardDb, CardDef, GameState } from '../../src/engine/types';
import { castActionCost, handCastChoices, sacrificeCandidates, sacrificeSelection, toggleSacrifice, whispersDeadline, type HandCastAction } from '../../src/ui/castSacrifice';
import { WHISPERS_ZONE_LAYOUT } from '../../src/ui/zoneContentsPresentation';
import { makeTestState, TEST_DB } from '../helpers';

const creature = (id: string, extra: Partial<CardDef>): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: ['G'], rarity: 'c',
  attack: 4, defense: 4, cost: { generic: 3, pips: { G: 1 } }, ...extra,
});
const DB: CardDb = {
  ...TEST_DB,
  tithe: creature('tithe', { tithe: { per: 2 } }),
  empowered: creature('empowered', { tithe: { per: 2 }, empower: {
    cost: { generic: 2, pips: { G: 1 } }, ops: [{ op: 'gainLife', n: 2 }],
  } }),
  rite: creature('rite', { rite: { n: 2 }, cost: { generic: 0, pips: { G: 1 } } }),
  whisper: creature('whisper', { whispers: { cost: { generic: 0, pips: { G: 1 } } } }),
};

function fixture(card = 'tithe', lands = 2): GameState {
  const state = makeTestState({ hands: [[card], []], battlefield: [
    { iid: 10, cardId: 'bear' }, { iid: 20, cardId: 'giant', tapped: true },
    { iid: 30, cardId: 'archer', enteredThisTurn: true },
    { iid: 40, cardId: 'bear', controller: 1 },
    ...Array.from({ length: lands }, (_, i) => ({ iid: 100 + i, cardId: 'forest' })),
  ] });
  state.rulesRev = 4;
  state.nextIid = 200;
  state.players.forEach((player) => { player.deck = Array.from({ length: 12 }, () => 'forest'); });
  return state;
}

describe('hand and graveyard cast sources', () => {
  it('rebinds a deduplicated hand copy while excluding Retell and Whispers source indices', () => {
    const normal: HandCastAction = { type: 'castSpell', handIndex: 0 };
    expect(handCastChoices([
      normal,
      { ...normal, retell: true, graveIndex: 0 },
      { ...normal, whispers: true, graveIndex: 1 },
    ], ['bear', 'bear'], 1)).toEqual([{ ...normal, handIndex: 1 }]);
  });

  it('offers a Tithe-only legal cast despite the legacy full-price explanation', () => {
    const state = fixture();
    expect(reasonUncastable(state, DB, 0, 0)).not.toBeNull();
    const choices = handCastChoices(legalActions(state, DB, 0), ['tithe'], 0);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((cast) => cast.tithe)).toBe(true);
    expect(choices.every((cast) => validateAction(state, DB, 0, cast) === null)).toBe(true);
  });

  it('reads a whispered price from authoritative graveIndex rather than mirrored handIndex', () => {
    const state = fixture();
    state.players[0].graveyard = ['bear', 'whisper'];
    expect(castActionCost(state, DB, 0, { type: 'castSpell', handIndex: 0, graveIndex: 1, whispers: true }))
      .toEqual({ generic: 0, pips: { G: 1 } });
  });

  it('keeps auto-skip paused for a live-only Whispers cast until its deadline expires', () => {
    const state = fixture();
    state.players[0].hand = [];
    state.players[0].graveyard = [{ instanceId: 500, cardId: 'whisper', variantKey: null, whispersUntilDawnOf: 1 }];
    const game = Game.restore(state, DB);
    expect(forcedAction(game.instanceState, DB, 0)).toBeNull();
    // This is the presentation compatibility projection: it intentionally
    // cannot be used for any rule query that depends on instance markers.
    expect(forcedAction(game.state, DB, 0)).toEqual({ type: 'passStep' });
    const expired: GameState = structuredClone(game.instanceState);
    expired.activePlayer = 1;
    startTurn(expired, DB, () => {});
    expired.activePlayer = 0;
    expired.step = 'main1';
    expired.awaiting = { kind: 'main', player: 0 };
    expect(forcedAction(expired, DB, 0)).toEqual({ type: 'passStep' });
  });
});

describe('shared sacrifice selection', () => {
  it('toggles only controlled creatures, including tapped and newly arrived creatures', () => {
    const state = fixture();
    const candidates = sacrificeCandidates(state, DB, 0);
    expect(candidates).toEqual([10, 20, 30]);
    expect(toggleSacrifice([], 40, candidates)).toEqual([]);
    expect(toggleSacrifice([], 100, candidates)).toEqual([]);
    expect(toggleSacrifice([10], 20, candidates)).toEqual([10, 20]);
    expect(toggleSacrifice([10, 20], 10, candidates)).toEqual([20]);
  });

  it('uses marked Defense, rounds odd totals down, and leaves coloured pips unchanged', () => {
    const state = fixture();
    const cast: HandCastAction = { type: 'castSpell', handIndex: 0, tithe: true };
    expect(sacrificeSelection(state, DB, 0, [cast], [30]).cost).toEqual({ generic: 2, pips: { G: 1 } });
    state.battlefield.find((perm) => perm.iid === 30)!.plusOneCounters = 1;
    const selected = sacrificeSelection(state, DB, 0, [cast], [30]);
    expect(selected.defense).toBe(4);
    expect(selected.cost).toEqual({ generic: 1, pips: { G: 1 } });
    expect(selected.actions).toHaveLength(1);
  });

  it('discounts the total empowered generic cost and never removes its coloured pips', () => {
    const state = fixture('empowered', 4);
    const cast: HandCastAction = { type: 'castSpell', handIndex: 0, tithe: true, empowered: true };
    expect(sacrificeSelection(state, DB, 0, [cast], [10, 20]).cost).toEqual({ generic: 2, pips: { G: 2 } });
    expect(sacrificeSelection(state, DB, 0, [cast], [10, 20, 30]).cost).toEqual({ generic: 1, pips: { G: 2 } });
  });

  it('keeps confirm unavailable until payable and permits zero sacrifices at full price', () => {
    const state = fixture();
    const cast: HandCastAction = { type: 'castSpell', handIndex: 0, tithe: true };
    expect(sacrificeSelection(state, DB, 0, [cast], []).actions).toEqual([]);
    expect(sacrificeSelection(state, DB, 0, [cast], [10]).actions).toEqual([]);
    expect(sacrificeSelection(state, DB, 0, [cast], [20]).actions).toHaveLength(1);
    expect(sacrificeSelection(fixture('tithe', 4), DB, 0, [cast], []).actions).toHaveLength(1);
  });

  it('does not spend or sacrifice during selection and discards stale payment plans', () => {
    const state = fixture();
    const before = structuredClone(state);
    const cast: HandCastAction = { type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [10, 30], manaPlan: [100] };
    const selected = sacrificeSelection(state, DB, 0, [cast], [20]);
    expect(selected.actions).toEqual([{ type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [20] }]);
    expect(state).toEqual(before);
    expect(cast.sacrifices).toEqual([10, 30]);
    const game = Game.restore(state, DB);
    const events = game.submit(0, selected.actions[0]);
    expect(events.filter((event) => event.e === 'died').map((event) => event.iid)).toEqual([20]);
    expect(events.some((event) => event.e === 'spellCast' && event.cardId === 'tithe')).toBe(true);
  });

  it('rejects stale, duplicate, opposing, and noncreature selections', () => {
    const state = fixture();
    const cast: HandCastAction = { type: 'castSpell', handIndex: 0, tithe: true };
    for (const selected of [[999], [20, 20], [40], [100]]) {
      expect(sacrificeSelection(state, DB, 0, [cast], selected).actions).toEqual([]);
    }
  });

  it('preserves Rite exact-n, unchanged mana cost, and player-selected noncanonical fodder', () => {
    const state = fixture('rite');
    const casts = handCastChoices(legalActions(state, DB, 0), ['rite'], 0);
    expect(casts[0].sacrifices).toEqual([10, 20]);
    expect(sacrificeSelection(state, DB, 0, casts, [30]).actions).toEqual([]);
    expect(toggleSacrifice([20, 30], 10, [10, 20, 30], 2)).toEqual([20, 30]);
    expect(toggleSacrifice([20, 30], 20, [10, 20, 30], 2)).toEqual([30]);
    const selected = sacrificeSelection(state, DB, 0, casts, [20, 30]);
    expect(selected.cost).toEqual({ generic: 0, pips: { G: 1 } });
    expect(selected.actions).toHaveLength(1);
    const game = Game.restore(state, DB);
    const events = game.submit(0, selected.actions[0]);
    expect(events.filter((event) => event.e === 'died').map((event) => event.iid)).toEqual([20, 30]);
    expect(game.state.battlefield.some((perm) => perm.iid === 10)).toBe(true);
  });
});

describe('Whispers deadline and modal geometry', () => {
  it('distinguishes the next Dawn from a marker surviving through its owner next turn', () => {
    expect(whispersDeadline(0, 0, 0)).toBe('Whispers: next Dawn');
    expect(whispersDeadline(1, 0, 0)).toBe('Whispers: after your turn');
    expect(whispersDeadline(1, 1, 0)).toBe('Whispers: next Dawn');
    expect(whispersDeadline(0, 1, 0)).toBe("Whispers: after foe's turn");
  });

  it('separates thumbnail, deadline, both 44px actions, adjacent rows, subtitle and pager', () => {
    const l = WHISPERS_ZONE_LAYOUT;
    const halfThumb = 420 * 0.24 / 2;
    expect(l.firstCenterY - halfThumb).toBeGreaterThan(134);
    for (let row = 0; row < l.rows; row++) {
      const y = l.firstCenterY + row * l.rowGap;
      const noteTop = y + l.deadlineOffset - l.deadlineHeight / 2;
      const noteBottom = noteTop + l.deadlineHeight;
      const firstTop = y + l.actionOffset - l.actionHitHeight / 2;
      const lastBottom = y + l.actionOffset + l.actionGap + l.actionHitHeight / 2;
      expect(noteTop).toBeGreaterThan(y + halfThumb);
      expect(firstTop).toBeGreaterThan(noteBottom);
      expect(l.actionGap).toBeGreaterThan(l.actionHitHeight);
      if (row + 1 < l.rows) expect(lastBottom).toBeLessThan(y + l.rowGap - halfThumb);
      else expect(lastBottom).toBeLessThan(l.pagerY - l.pagerHitHeight / 2);
    }
  });
});
