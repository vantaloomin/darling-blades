import type { CardDef, CardDb, EffectOp, GameState, Permanent, TargetSpec } from '../src/engine/types';
import { makeTestState, TEST_DB } from './helpers';
export const zero = { generic: 0, pips: {} };
export const ref = (iid: number) => ({ kind: 'permanent' as const, iid });
export function card(id: string, extra: Partial<CardDef> = {}): CardDef {
  return { id, name: id, types: ['creature'], subtypes: ['Horror'], cost: zero, colors: [], attack: 2, defense: 4, rarity: 'c', ...extra };
}
export function spell(id: string, ops: EffectOp[], targets?: TargetSpec[]): CardDef {
  return card(id, { types: ['ritual'], abilities: [{ when: 'spell', ops, ...(targets ? { targets } : {}) }] });
}
export const dbOf = (...cards: CardDef[]): CardDb => ({ ...TEST_DB, ...Object.fromEntries(cards.map(d => [d.id, d])) });
export function board(hands: [string[], string[]] = [[], []], battlefield: Partial<Permanent>[] = []): GameState {
  const state = makeTestState({ hands, battlefield });
  state.rulesRev = 4; state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 100; state.nextInstanceId = 1000;
  for (const player of state.players) player.deck = Array(20).fill('forest');
  return state;
}
