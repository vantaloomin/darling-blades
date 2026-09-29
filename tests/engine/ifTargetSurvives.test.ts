import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { resolveStackItem } from '../../src/engine/resolve';
import type { CardDef, EffectOp, GameState, Keyword, TargetSpec } from '../../src/engine/types';
import { validateA16Def, validateHuntDef } from '../../src/engine/types';
import { scoreCard } from '../../src/power/scoreCore';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';

/**
 * A1.6, "If it survived, ..." (the owner's First Dawn rework of Ambush at the
 * River, 2026-09-29: "Target creature you control gets +1/+1 until Sunset,
 * then it Hunts. If it survived, draw a card."). The contract: the gate runs
 * its `then` branch when its target creature is still on the battlefield and
 * would not die in the next state-based check (Provoked's test), reading the
 * Hunt damage the same spell already dealt; otherwise its `else` branch, if
 * any. Fixture cards only.
 */
const HUNTER_AND_PREY: TargetSpec[] = [{ what: 'yourCreature' }, { what: 'opponentCreature' }];
const GATE: EffectOp = { op: 'ifTargetSurvives', then: [{ op: 'draw', n: 1 }] };
const AMBUSH = spell('ambush', [{ op: 'boost', p: 1, t: 1, scope: 'target' }, { op: 'hunt', hunter: 'target' }, GATE], HUNTER_AND_PREY);
/** The same with an `else` branch, for the other half of the gate. */
const AMBUSH_ELSE = spell('ambushElse', [{ op: 'boost', p: 1, t: 1, scope: 'target' }, { op: 'hunt', hunter: 'target' },
  { ...GATE, else: [{ op: 'gainLife', n: 3 }] }], HUNTER_AND_PREY);
const body = (id: string, attack: number, defense: number, keywords: Keyword[] = []): CardDef => card(id, { attack, defense, keywords });

const HUNTER = 1;
const PREY = 2;

/** P0 casts `cardId` with its hunter against P1's prey; returns the game after it resolves. */
function castAmbush(hunter: CardDef, prey: CardDef, cardId = 'ambush'): { game: Game; handBefore: number } {
  const db = dbOf(hunter, prey, AMBUSH, AMBUSH_ELSE);
  const st = board([[cardId], []], [{ iid: HUNTER, cardId: hunter.id }, { iid: PREY, cardId: prey.id, controller: 1 }]);
  const game = Game.restore(st, db);
  const handBefore = game.instanceState.players[0].hand.length - 1; // the Ambush leaves the hand
  game.submit(0, { type: 'castSpell', handIndex: 0, targets: [ref(HUNTER), ref(PREY)] });
  expect(game.instanceState.stack).toEqual([]);
  return { game, handBefore };
}
const onBoard = (st: GameState, iid: number): boolean => st.battlefield.some((perm) => perm.iid === iid);

describe('If it survived', () => {
  it('draws when the hunter survives the Hunt', () => {
    // A 3/3 pumped to 4/4 takes 3 from a 3/2 and lives.
    const { game, handBefore } = castAmbush(body('h', 3, 3), body('p', 3, 2));
    expect(onBoard(game.instanceState, HUNTER)).toBe(true);
    expect(game.instanceState.players[0].hand).toHaveLength(handBefore + 1);
  });

  it('draws nothing when the Hunt\'s damage kills the hunter, with the pump counted', () => {
    // A 2/2 pumped to 3/3 takes 3 from a 3/5: lethal only with the damage the Hunt just dealt.
    const { game, handBefore } = castAmbush(body('h', 2, 2), body('p', 3, 5));
    expect(onBoard(game.instanceState, HUNTER)).toBe(false);
    expect(game.instanceState.players[0].hand).toHaveLength(handBefore);
  });

  it('draws nothing when a Deathblade prey deals the hunter any damage', () => {
    // A 3/5 pumped to 4/6 takes 1 from a 1/1 with Deathblade.
    const { game, handBefore } = castAmbush(body('h', 3, 5), body('p', 1, 1, ['deathblade']));
    expect(onBoard(game.instanceState, HUNTER)).toBe(false);
    expect(game.instanceState.players[0].hand).toHaveLength(handBefore);
  });

  it('draws when a Deathblade prey has 0 Attack and deals nothing', () => {
    const { game, handBefore } = castAmbush(body('h', 3, 5), body('p', 0, 1, ['deathblade']));
    expect(game.instanceState.players[0].hand).toHaveLength(handBefore + 1);
  });

  it('draws nothing when the hunter left the battlefield before the spell resolved', () => {
    // The prey is still a legal target, so the spell resolves; the hunter is gone.
    const db = dbOf(body('h', 3, 3), body('p', 1, 1), AMBUSH);
    const st = board([[], []], [{ iid: PREY, cardId: 'p', controller: 1 }]);
    const handBefore = st.players[0].hand.length;
    resolveStackItem(st, db, { sid: 1, cardId: 'ambush', controller: 0, targets: [ref(HUNTER), ref(PREY)] }, () => {});
    expect(st.players[0].hand).toHaveLength(handBefore);
  });

  it('runs the else branch instead when the hunter did not survive', () => {
    const died = castAmbush(body('h', 2, 2), body('p', 3, 5), 'ambushElse').game.instanceState;
    expect(died.players[0].life).toBe(23);
    const lived = castAmbush(body('h', 3, 3), body('p', 3, 2), 'ambushElse').game.instanceState;
    expect(lived.players[0].life).toBe(20);
  });
});

describe('If it survived stays narrow (validator)', () => {
  it('needs a creature target at its slot, never sits in a chapter, and never wraps a Hunt', () => {
    expect(validateA16Def(AMBUSH)).toEqual([]);
    expect(validateA16Def(spell('noTarget', [GATE]))).not.toEqual([]);
    expect(validateA16Def(spell('player', [GATE], [{ what: 'player' }]))).not.toEqual([]);
    expect(validateA16Def(spell('slot', [{ ...GATE, targetIndex: 1 }], [{ what: 'yourCreature' }]))).not.toEqual([]);
    expect(validateA16Def(spell('upTo', [GATE], [{ what: 'yourCreature', upTo: 2 }]))).not.toEqual([]);
    expect(validateA16Def(spell('preySlot', [{ op: 'hunt', hunter: 'target' }, { ...GATE, targetIndex: 1 }], HUNTER_AND_PREY))).toEqual([]);
    expect(validateA16Def(card('saga', { types: ['ritual'], chapters: [[GATE]] }))).not.toEqual([]);
    const wrapped = spell('wrapped', [{ op: 'ifTargetSurvives', then: [{ op: 'hunt', hunter: 'target' }] }], HUNTER_AND_PREY);
    expect(validateHuntDef(wrapped)).toContain('A Hunt cannot sit inside an If-it-survived branch');
  });
});

describe('If it survived in the scorer (a placeholder until A1.4)', () => {
  it('prices the gated draw below a draw on either branch and above none, and reports it as NEEDS MATH', () => {
    const pump: EffectOp = { op: 'boost', p: 1, t: 1, scope: 'target' };
    const power = (ops: EffectOp[]): number => scoreCard(spell('s', ops, [{ what: 'yourCreature' }])).power;
    const gated = power([pump, GATE]);
    // The same draw on both branches is a sure draw through the same gate.
    expect(gated).toBeLessThan(power([pump, { ...GATE, else: [{ op: 'draw', n: 1 }] }]));
    expect(gated).toBeGreaterThan(power([pump]));
    expect(scoreCard(AMBUSH).unknowns.some((unknown) => unknown.startsWith('op:ifTargetSurvives'))).toBe(true);
  });
});
