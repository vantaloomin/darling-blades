import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { chooseUnlinkedHauntlink, hauntlinkHostFit } from '../../src/ai/hauntlinkPolicy';
import { cardValue, hauntlinkCastValue, linkedRiderValue } from '../../src/ai/value';
import { Game } from '../../src/engine/Game';
import { getEffectiveStats } from '../../src/engine/statics';
import { makePersonality } from '../../src/ai/personality';
import { makeTestState } from '../helpers';
import { HAUNTLINK_DB } from '../hauntlinkFixture';

function gameWithLink(cardId = 'hauntlink_artifact', damage = 0): Game {
  const state = makeTestState({
    battlefield: [{ iid: 1, cardId: 'bear', controller: 0, damage }],
    hands: [[cardId], []],
    active: 0,
  });
  return Game.restore(state, HAUNTLINK_DB);
}

function currentGame(
  battlefield: Parameters<typeof makeTestState>[0]['battlefield'],
  hand: string[] = [],
): Game {
  const state = makeTestState({ battlefield, hands: [hand, []], active: 0 });
  state.rulesRev = 3;
  state.players[0].deck = ['bear'];
  return Game.restore(state, HAUNTLINK_DB);
}

describe('Hauntlink AI valuation from PlayerView', () => {
  it('values only marginal Linked keywords and discounts a fragile host', () => {
    const healthy = gameWithLink();
    const healthyValue = hauntlinkCastValue(healthy.viewFor(0).battlefield, HAUNTLINK_DB, 'hauntlink_artifact', 1);
    const fragile = gameWithLink('hauntlink_artifact', 1);
    const fragileValue = hauntlinkCastValue(fragile.viewFor(0).battlefield, HAUNTLINK_DB, 'hauntlink_artifact', 1);
    expect(linkedRiderValue(healthy.viewFor(0).battlefield, HAUNTLINK_DB, 'hauntlink_artifact', 1)).toBe(2);
    expect(healthyValue).toBeGreaterThan(fragileValue);
  });

  it('prices the alternate mode with the carrier cost delta', () => {
    const game = Game.restore(
      makeTestState({
        battlefield: [{ iid: 1, cardId: 'giant', controller: 0 }],
        hands: [['priced_hauntlink_artifact'], []],
        active: 0,
      }),
      HAUNTLINK_DB,
    );
    const standalone = cardValue(HAUNTLINK_DB, 'priced_hauntlink_artifact');
    const linked = hauntlinkCastValue(
      game.viewFor(0).battlefield,
      HAUNTLINK_DB,
      'priced_hauntlink_artifact',
      1,
    );
    expect(linked - standalone).toBeCloseTo(3 * 0.65 + 0.5, 10);
    expect(linked).not.toBe(standalone);
  });

  it('casts the carrier normally, then links it on the next main-phase action', () => {
    const brains = [
      new EasyAI(HAUNTLINK_DB, 7, makePersonality({ easyNoise: 0 })),
      new MediumAI(HAUNTLINK_DB),
      new HardAI(HAUNTLINK_DB),
    ];
    for (const brain of brains) {
      const game = currentGame([{ iid: 1, cardId: 'bear', controller: 0 }], ['hauntlink_artifact']);
      const cast = brain.chooseAction(game.viewFor(0), game.legalActions(0));
      expect(cast).toMatchObject({ type: 'castSpell' });
      expect(cast).not.toHaveProperty('hauntlinked');
      game.submit(0, cast);
      const link = game.instanceState.battlefield.find((perm) => perm.cardId === 'hauntlink_artifact')!;
      const choice = brain.chooseAction(game.viewFor(0), game.legalActions(0));
      expect(choice).toEqual({ type: 'linkHaunt', iid: link.iid, hostIid: 1 });
    }
  });

  it('does not spend mana swapping an existing link for equal rider fit', () => {
    const game = currentGame([
      { iid: 1, cardId: 'bear', controller: 0, attachments: [2] },
      { iid: 2, cardId: 'hauntlink_artifact', controller: 0, attachedTo: 1 },
      { iid: 3, cardId: 'giant', controller: 0 },
    ]);
    expect(game.legalActions(0)).toContainEqual({ type: 'linkHaunt', iid: 2, hostIid: 3 });
    const brains = [
      new EasyAI(HAUNTLINK_DB, 7, makePersonality({ easyNoise: 0 })),
      new MediumAI(HAUNTLINK_DB),
      new HardAI(HAUNTLINK_DB),
    ];
    for (const brain of brains) {
      expect(brain.chooseAction(game.viewFor(0), game.legalActions(0)).type).not.toBe('linkHaunt');
    }
    expect(getEffectiveStats(game.viewFor(0).battlefield, HAUNTLINK_DB, 1).keywords.has('skyborne')).toBe(true);
  });

  it('keeps host selection deterministic and chooses the stronger public host', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0, damage: 1 },
        { iid: 2, cardId: 'giant', controller: 0 },
        { iid: 3, cardId: 'hauntlink_artifact', controller: 0 },
      ],
      active: 0,
    });
    state.rulesRev = 3;
    const a = Game.restore(structuredClone(state), HAUNTLINK_DB);
    const b = Game.restore(structuredClone(state), HAUNTLINK_DB);
    const brainA = new MediumAI(HAUNTLINK_DB);
    const brainB = new MediumAI(HAUNTLINK_DB);
    const choiceA = brainA.chooseAction(a.viewFor(0), a.legalActions(0));
    const choiceB = brainB.chooseAction(b.viewFor(0), b.legalActions(0));
    expect(choiceA).toEqual(choiceB);
    expect(choiceA).toEqual({ type: 'linkHaunt', iid: 3, hostIid: 2 });
  });

  it('prefers a new keyword on a smaller host to a duplicate on the largest host', () => {
    const game = currentGame([
      { iid: 1, cardId: 'bear', controller: 0 },
      { iid: 2, cardId: 'giant', controller: 0, untilEotMods: [{ p: 0, t: 0, keywords: ['skyborne'] }] },
      { iid: 3, cardId: 'keyword_link', controller: 0 },
    ]);
    expect(new MediumAI(HAUNTLINK_DB).chooseAction(game.viewFor(0), game.legalActions(0)))
      .toEqual({ type: 'linkHaunt', iid: 3, hostIid: 1 });
  });

  it('moves for a useful new keyword, then keeps the link on that host', () => {
    const game = currentGame([
      { iid: 1, cardId: 'bear', controller: 0 },
      { iid: 2, cardId: 'giant', controller: 0, untilEotMods: [{ p: 0, t: 0, keywords: ['skyborne'] }], attachments: [3] },
      { iid: 3, cardId: 'keyword_link', controller: 0, attachedTo: 2 },
    ]);
    const brain = new MediumAI(HAUNTLINK_DB);
    const move = brain.chooseAction(game.viewFor(0), game.legalActions(0));
    expect(move).toEqual({ type: 'linkHaunt', iid: 3, hostIid: 1 });
    game.submit(0, move);
    expect(brain.chooseAction(game.viewFor(0), game.legalActions(0)).type).not.toBe('linkHaunt');
  });

  it('charges a move its link mana and tempo margin', () => {
    const db = { ...HAUNTLINK_DB, paid_link: { ...HAUNTLINK_DB.keyword_link, id: 'paid_link',
      hauntlink: { cost: { generic: 2, pips: {} }, linked: { grantKeywords: ['skyborne' as const] } } } };
    const state = makeTestState({ battlefield: [
      { iid: 1, cardId: 'bear', controller: 0 },
      { iid: 2, cardId: 'giant', controller: 0, untilEotMods: [{ p: 0, t: 0, keywords: ['skyborne'] }], attachments: [3] },
      { iid: 3, cardId: 'paid_link', controller: 0, attachedTo: 2 },
      { iid: 10, cardId: 'forest', controller: 0 }, { iid: 11, cardId: 'forest', controller: 0 },
    ], active: 0 });
    state.rulesRev = 4;
    const game = Game.restore(state, db);
    expect(game.legalActions(0)).toContainEqual({ type: 'linkHaunt', iid: 3, hostIid: 1 });
    expect(chooseUnlinkedHauntlink(game.viewFor(0), db, game.legalActions(0))).toBeUndefined();
  });

  it('prefers stats that change a marked host fight over redundant stats on a giant', () => {
    const game = currentGame([
      { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 },
      { iid: 2, cardId: 'giant', controller: 0 },
      { iid: 3, cardId: 'hauntlink_enchantment', controller: 0 },
      { iid: 4, cardId: 'bear', controller: 1, plusOneCounters: 1 },
    ]);
    const view = game.viewFor(0);
    expect(hauntlinkHostFit(view.battlefield, HAUNTLINK_DB, 3, 1))
      .toBeGreaterThan(hauntlinkHostFit(view.battlefield, HAUNTLINK_DB, 3, 2));
    expect(chooseUnlinkedHauntlink(view, HAUNTLINK_DB, game.legalActions(0)))
      .toEqual({ type: 'linkHaunt', iid: 3, hostIid: 1 });
  });

  it('does not buy better main-phase fit by killing the damaged former host', () => {
    const game = currentGame([
      { iid: 1, cardId: 'bear', controller: 0, damage: 2, tapped: true, attachments: [3] },
      { iid: 2, cardId: 'bear', controller: 0 },
      { iid: 3, cardId: 'hauntlink_enchantment', controller: 0, attachedTo: 1 },
      { iid: 4, cardId: 'bear', controller: 1 },
    ]);
    const view = game.viewFor(0);
    expect(hauntlinkHostFit(view.battlefield, HAUNTLINK_DB, 3, 2))
      .toBeGreaterThan(hauntlinkHostFit(view.battlefield, HAUNTLINK_DB, 3, 1));
    expect(chooseUnlinkedHauntlink(view, HAUNTLINK_DB, game.legalActions(0))).toBeUndefined();
  });

  it('does not award a tapped flying host rescue value from an impossible ground block', () => {
    const game = currentGame([
      { iid: 1, cardId: 'flyer', controller: 0, tapped: true },
      { iid: 2, cardId: 'giant', controller: 0 },
      { iid: 3, cardId: 'hauntlink_enchantment', controller: 0 },
      { iid: 4, cardId: 'bear', controller: 1 },
    ]);
    const view = game.viewFor(0);
    expect(hauntlinkHostFit(view.battlefield, HAUNTLINK_DB, 3, 1))
      .toBe(hauntlinkHostFit(view.battlefield, HAUNTLINK_DB, 3, 2));
    expect(chooseUnlinkedHauntlink(view, HAUNTLINK_DB, game.legalActions(0)))
      .toEqual({ type: 'linkHaunt', iid: 3, hostIid: 2 });
  });

  it('counts a legal defending fight for a Bulwark host that cannot attack', () => {
    const game = currentGame([
      { iid: 1, cardId: 'bear', controller: 0, untilEotMods: [{ p: 0, t: 0, keywords: ['bulwark'] }] },
      { iid: 2, cardId: 'giant', controller: 0 },
      { iid: 3, cardId: 'hauntlink_enchantment', controller: 0 },
      { iid: 4, cardId: 'bear', controller: 1 },
    ]);
    const view = game.viewFor(0);
    expect(hauntlinkHostFit(view.battlefield, HAUNTLINK_DB, 3, 1))
      .toBeGreaterThan(hauntlinkHostFit(view.battlefield, HAUNTLINK_DB, 3, 2));
    expect(chooseUnlinkedHauntlink(view, HAUNTLINK_DB, game.legalActions(0)))
      .toEqual({ type: 'linkHaunt', iid: 3, hostIid: 1 });
  });
});
