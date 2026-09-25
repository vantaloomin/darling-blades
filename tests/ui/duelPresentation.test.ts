import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { compelledAttackers, validateAttackers } from '../../src/engine/combat/legality';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, EffectOp } from '../../src/engine/types';
import {
  OPPONENT_RESERVE_CLEARANCE,
  TARGET_ARROW_HEAD_LENGTH,
  attackButtonLabel,
  attackDeclaration,
  forcedAttackNotice,
  hauntlinkActionLabel,
  rageMustAttackNotice,
  toggleAttacker,
  undoBlockedReason,
  type UndoRevealInput,
  graveActionChoice,
  hauntlinkOverlap,
  landDropGuardApplies,
  LAND_DROP_CONFIRM_LABEL,
  LAND_DROP_NOTICE,
  opponentReservePileBounds,
  orderedGraveyardSlots,
  shouldArmLandDrop,
  presentationRectsOverlap,
  SACRIFICE_CHOOSER_CENTER_X,
  sacrificeCastChoices,
  type SacrificeCastInput,
  targetArrowShaftEnd,
  targetRingTone,
} from '../../src/ui/duelPresentation';
import { packRow } from '../../src/ui/rowPacking';
import { makeTestState, TEST_DB } from '../helpers';

describe('duel presentation rules', () => {
  it('tucks Hauntlink cards upward with an exposed header on either battlefield row', () => {
    const you = hauntlinkOverlap('you');
    const opponent = hauntlinkOverlap('opponent');
    for (const tuck of [you, opponent]) {
      expect(tuck.y).toBeLessThan(0);
      expect(tuck.scale).toBeGreaterThan(0);
      expect(tuck.scale).toBeLessThan(1);
    }
    expect(Math.sign(you.x)).toBe(-Math.sign(opponent.x));
  });

  it('fans multiple Hauntlinks without changing their under-host direction', () => {
    const base = { you: hauntlinkOverlap('you'), opponent: hauntlinkOverlap('opponent') };
    for (let slot = 1; slot <= 3; slot++) {
      const you = hauntlinkOverlap('you', slot);
      const opponent = hauntlinkOverlap('opponent', slot);
      for (const tuck of [you, opponent]) {
        expect(tuck.y).toBeLessThan(0);
        expect(tuck.scale).toBeGreaterThan(0);
        expect(tuck.scale).toBeLessThan(1);
      }
      // The fan never flips a seat past the other: the two seats stay the same distance apart.
      expect(opponent.x - you.x).toBe(base.opponent.x - base.you.x);
      expect(you.y).toBeLessThanOrEqual(base.you.y);
      expect(you.scale).toBe(base.you.scale);
    }
  });

  it('labels only currently payable Hauntlink actions', () => {
    expect(hauntlinkActionLabel(false, false)).toBeNull();
    expect(hauntlinkActionLabel(true, false)).toBe('Link');
    expect(hauntlinkActionLabel(true, true)).toBe('Relink');
  });

  it('uses red only for legal targets controlled by the opponent', () => {
    expect(targetRingTone('you')).toBe('friendly');
    expect(targetRingTone('opponent')).toBe('hostile');
  });

  it('stops the targeting shaft one full head length before its point', () => {
    expect(targetArrowShaftEnd({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 84, y: 0 });
    expect(targetArrowShaftEnd({ x: 10, y: 10 }, { x: 10, y: 50 })).toEqual({ x: 10, y: 34 });
    const diagonal = targetArrowShaftEnd({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(Math.hypot(30 - diagonal.x, 40 - diagonal.y)).toBeCloseTo(TARGET_ARROW_HEAD_LENGTH);
  });

  it('keeps the opponent reserve pile inside its plate and clear of every neighboring zone', () => {
    const pile = opponentReservePileBounds();
    const geometry = OPPONENT_RESERVE_CLEARANCE;
    expect(pile.left).toBeGreaterThanOrEqual(geometry.plate.left);
    expect(pile.right).toBeLessThanOrEqual(geometry.plate.right);
    expect(pile.top).toBeGreaterThanOrEqual(geometry.plate.top);
    expect(pile.bottom).toBeLessThanOrEqual(geometry.plate.bottom);

    const fixedObstacles = [
      geometry.permanentBand,
      geometry.portrait,
      geometry.darling,
    ].map((rect) => ({
      left: rect.left,
      right: rect.right,
      top: 'top' in rect ? rect.top : rect.cy - rect.halfHeight,
      bottom: 'bottom' in rect ? rect.bottom : rect.cy + rect.halfHeight,
    }));
    for (const obstacle of fixedObstacles) expect(presentationRectsOverlap(pile, obstacle)).toBe(false);

    for (let beadCount = 1; beadCount <= 8; beadCount++) {
      const manaLeft = geometry.manaStrip.x0 - (beadCount - 1) * geometry.manaStrip.step - 22;
      const mana = {
        left: manaLeft,
        right: geometry.plate.right,
        top: geometry.manaStrip.cy - geometry.manaStrip.halfHeight,
        bottom: geometry.manaStrip.cy + geometry.manaStrip.halfHeight,
      };
      expect(presentationRectsOverlap(pile, mana), `mana beads: ${beadCount}`).toBe(false);

      const packed = packRow(
        beadCount,
        geometry.creatureBand.usable,
        geometry.creatureBand.tileWidth,
        geometry.creatureBand.maxSpacing,
        geometry.creatureBand.gutter,
      );
      const halfWidth = geometry.creatureBand.tileWidth * packed.scale / 2;
      const creatures = {
        left: geometry.creatureBand.x + packed.offsets[0] - halfWidth,
        right: geometry.creatureBand.x + packed.offsets[beadCount - 1] + halfWidth,
        top: geometry.creatureBand.cy - geometry.creatureBand.tileHeight * packed.scale / 2,
        bottom: geometry.creatureBand.cy + geometry.creatureBand.tileHeight * packed.scale / 2,
      };
      expect(presentationRectsOverlap(pile, creatures), `creature count: ${beadCount}`).toBe(false);
    }
  });
});

describe('graveyard pile order', () => {
  it('reads newest first and marks the top of the pile', () => {
    // Engine order is oldest -> newest, so the last buried card is the top.
    const slots = orderedGraveyardSlots(['a', 'b', 'c']);
    expect(slots.map((s) => s.cardId)).toEqual(['c', 'b', 'a']);
    expect(slots.map((s) => s.index)).toEqual([2, 1, 0]);
    expect(slots.map((s) => s.top)).toEqual([true, false, false]);
  });

  it('keeps duplicates as separate slots so position stays truthful', () => {
    // The reported symptom: a cycled card then two mills. Collapsing copies
    // put the cycled card in the middle of the grid; ordered slots cannot.
    const slots = orderedGraveyardSlots(['cycled', 'mill1', 'mill1']);
    expect(slots).toHaveLength(3);
    expect(slots.map((s) => s.index)).toEqual([2, 1, 0]);
    expect(slots[2]).toEqual({ cardId: 'cycled', index: 0, top: false });
  });

  it('handles the empty and single-card piles', () => {
    expect(orderedGraveyardSlots([])).toEqual([]);
    expect(orderedGraveyardSlots(['only'])).toEqual([{ cardId: 'only', index: 0, top: true }]);
  });
});

describe('land-drop guard', () => {
  const pending = {
    landDropAvailable: true,
    turnEnds: true,
    confirmEnabled: true,
    armed: false,
    suppressed: false,
  };

  it('arms the first press that would end the turn on an unused drop', () => {
    expect(landDropGuardApplies(pending)).toBe(true);
    expect(shouldArmLandDrop(pending)).toBe(true);
  });

  it('lets the second press through', () => {
    const armed = { ...pending, armed: true };
    // The guard still APPLIES (that is what keeps the button red), but the
    // press commits rather than arming again.
    expect(landDropGuardApplies(armed)).toBe(true);
    expect(shouldArmLandDrop(armed)).toBe(false);
  });

  it('says nothing when the turn is not ending', () => {
    // main1 still has a whole second main phase to play the land in.
    expect(shouldArmLandDrop({ ...pending, turnEnds: false })).toBe(false);
    expect(landDropGuardApplies({ ...pending, turnEnds: false })).toBe(false);
  });

  it('says nothing when there is no drop left to make', () => {
    expect(shouldArmLandDrop({ ...pending, landDropAvailable: false })).toBe(false);
  });

  it('respects the setting and never interrupts a tutorial or a replay', () => {
    expect(shouldArmLandDrop({ ...pending, confirmEnabled: false })).toBe(false);
    expect(shouldArmLandDrop({ ...pending, suppressed: true })).toBe(false);
  });

  it('keeps its copy terse and free of em-dashes', () => {
    expect(LAND_DROP_CONFIRM_LABEL.startsWith('Confirm: ')).toBe(true);
    expect(LAND_DROP_CONFIRM_LABEL.length).toBeLessThanOrEqual(20);
    for (const copy of [LAND_DROP_CONFIRM_LABEL, LAND_DROP_NOTICE]) {
      expect(copy).not.toContain('\u2014');
    }
  });
});

describe('graveyard action chips', () => {
  it('offers nothing when neither action is legal', () => {
    expect(graveActionChoice(false, false)).toBeNull();
  });

  it('offers each action on its own', () => {
    expect(graveActionChoice(true, false)).toBe('retell');
    expect(graveActionChoice(false, true)).toBe('preserve');
  });

  it('prefers Retell when a card somehow offers both', () => {
    // One action slot per tile. Retell wins because it puts a spell on the
    // stack; Preserve is still there next time the modal opens.
    expect(graveActionChoice(true, true)).toBe('retell');
  });
});

describe('Tithe and Rite cast chooser', () => {
  const plainRite: SacrificeCastInput = {
    tithe: false, empower: false, skim: false,
    plainCast: true, empoweredCast: false, titheCast: false, fodder: 2,
  };
  const tithe: SacrificeCastInput = { ...plainRite, tithe: true, titheCast: true };
  const kinds = (input: SacrificeCastInput) => sacrificeCastChoices(input)?.map((choice) => choice.kind) ?? null;

  it('offers Empower only on a card that prints it', () => {
    expect(kinds(tithe)).toEqual(['cast', 'sacrifice']);
    expect(kinds({ ...tithe, empower: true, empoweredCast: true })).toEqual(['cast', 'empower', 'sacrifice']);
    expect(kinds({ ...plainRite, empower: true, empoweredCast: true })).toEqual(['cast', 'empower']);
  });

  it('skips the chooser for a Rite card with no Empower and no Skim', () => {
    expect(sacrificeCastChoices(plainRite)).toBeNull();
    expect(kinds({ ...plainRite, skim: true })).toEqual(['cast']);
  });

  it('enables Sacrifice to cast only when a creature could be sacrificed', () => {
    const sacrifice = (input: SacrificeCastInput) =>
      sacrificeCastChoices(input)!.find((choice) => choice.kind === 'sacrifice')!.enabled;
    expect(sacrifice({ ...tithe, fodder: 0 })).toBe(false);
    expect(sacrifice({ ...tithe, fodder: 1 })).toBe(true);
    expect(sacrifice({ ...tithe, titheCast: false })).toBe(false);
  });

  it('centres whatever buttons remain without letting 180px buttons touch', () => {
    for (const input of [tithe, { ...tithe, empower: true }, { ...plainRite, skim: true }]) {
      const row = sacrificeCastChoices(input)!;
      const mean = row.reduce((sum, choice) => sum + choice.x, 0) / row.length;
      expect(mean).toBe(SACRIFICE_CHOOSER_CENTER_X);
      for (let i = 1; i < row.length; i++) expect(row[i].x - row[i - 1].x).toBeGreaterThan(180);
    }
  });
});

describe('Undo after a reveal', () => {
  const quiet: UndoRevealInput = {
    events: [],
    player: 0,
    deckBefore: 30,
    deckAfter: 30,
    lookingAtHiddenCards: false,
  };
  const after = (events: GameEvent[], extra: Partial<UndoRevealInput> = {}) =>
    undoBlockedReason({ ...quiet, events, ...extra });

  it('turns Undo off after any action that showed you a card hidden before it', () => {
    const reveals: [string, string | null][] = [
      ['a draw', after([{ e: 'drew', player: 0, cardId: 'x' }], { deckAfter: 29 })],
      ['a Skim', after([
        { e: 'skimmed', player: 0, cardId: 'x' },
        { e: 'drew', player: 0, cardId: 'y' },
      ], { deckAfter: 29 })],
      ['an open Foresee', after([{ e: 'activated', player: 0, iid: 7, cardId: 'x' }], { lookingAtHiddenCards: true })],
      ['your top card to the graveyard', after([{ e: 'milled', player: 0, cardId: 'x' }], { deckAfter: 29 })],
      ['your top card severed', after([{ e: 'severed', player: 0, cardId: 'x', from: 'deck' }], { deckAfter: 29 })],
      ['a search no event names', after([{ e: 'effectApplied', op: 'fetchLand' }], { deckAfter: 29 })],
      ["the foe's top card to the graveyard", after([{ e: 'milled', player: 1, cardId: 'x' }])],
      ["the foe's top card severed", after([{ e: 'severed', player: 1, cardId: 'x', from: 'deck' }])],
      ["a card from the foe's hand", after([{ e: 'discarded', player: 1, cardId: 'x' }])],
    ];
    for (const [what, reason] of reveals) {
      expect(reason, what).not.toBeNull();
      expect(reason!, what).toMatch(/^Undo is off: /);
      expect(reason!, what).not.toContain('\u2014');
    }
  });

  it('reads the real engine the way the scene does: a draw, a Skim or a look turns Undo off', () => {
    const duty = (ops: EffectOp[]): CardDef => ({
      id: 'undo_duty', name: 'Undo Duty', types: ['artifact'], subtypes: [], colors: [], rarity: 'c',
      cost: { generic: 0, pips: {} }, activated: { cost: { tap: true }, ops },
    });
    const skimmer: CardDef = {
      id: 'undo_skim', name: 'Undo Skim', types: ['ritual'], subtypes: [], colors: [], rarity: 'c',
      cost: { generic: 9, pips: {} }, abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 1 }] }],
      skim: { cost: { generic: 0, pips: {} } },
    };
    // Submit one of your actions, then judge it exactly as DuelScene.act does.
    const judge = (ops: EffectOp[], pick: (legal: Action[]) => Action | undefined) => {
      const db: CardDb = { ...TEST_DB, undo_duty: duty(ops), undo_skim: skimmer };
      const state = makeTestState({ battlefield: [{ iid: 10, cardId: 'undo_duty', controller: 0 }], hands: [['undo_skim'], []] });
      state.players[0].deck = Array.from({ length: 12 }, () => 'forest');
      state.players[1].deck = Array.from({ length: 12 }, () => 'forest');
      const game = Game.restore(state, db);
      const action = pick(game.legalActions(0));
      if (!action) throw new Error('fixture action is not legal');
      const deckBefore = game.instanceState.players[0].deck.length;
      const events = game.submit(0, action);
      const awaiting = game.awaiting;
      return undoBlockedReason({
        events, player: 0, deckBefore, deckAfter: game.instanceState.players[0].deck.length,
        lookingAtHiddenCards: awaiting.kind === 'foresee' && awaiting.player === 0,
      });
    };
    const activate = (legal: Action[]) => legal.find((a) => a.type === 'activate');
    const skim = (legal: Action[]) => legal.find((a) => a.type === 'skim');
    expect(judge([{ op: 'draw', n: 1 }], activate), 'draw Duty').not.toBeNull();
    expect(judge([{ op: 'foresee', n: 2 }], activate), 'Foresee Duty').not.toBeNull();
    expect(judge([{ op: 'grind', n: 1, who: 'self' }], activate), 'mill-yourself Duty').not.toBeNull();
    expect(judge([{ op: 'gainLife', n: 1 }], skim), 'Skim').not.toBeNull();
    expect(judge([{ op: 'gainLife', n: 1 }], activate), 'life-gain Duty').toBeNull();
  });

  it('keeps Undo for actions that showed nothing new', () => {
    const quietActions: [string, GameEvent[]][] = [
      ['nothing at all', []],
      ["the foe's draw", [{ e: 'drew', player: 1, cardId: 'x' }]],
      ['your own discard', [{ e: 'discarded', player: 0, cardId: 'x' }]],
      ['answering a Foresee you already see', [{ e: 'foresaw', player: 0, kept: ['x'], bottomed: ['y'] }]],
      ['a card severed from a graveyard', [{ e: 'severed', player: 1, cardId: 'x', from: 'graveyard' }]],
      ['a spell cast and paid', [
        { e: 'manaTapped', player: 0, iids: [1, 2] },
        { e: 'spellCast', sid: 1, cardId: 'x', controller: 0, targets: [] },
      ]],
    ];
    for (const [what, events] of quietActions) expect(after(events), what).toBeNull();
  });
});

describe('Rage at the attack declaration', () => {
  const rager: CardDef = {
    id: 'rager', name: 'Raging Test Wolf', types: ['creature'], subtypes: [], colors: ['R'], rarity: 'c',
    cost: { generic: 1, pips: {} }, attack: 2, defense: 2, keywords: ['rage'],
  };
  const db: CardDb = { ...TEST_DB, rager };
  // One Rage creature (7) and one ordinary creature (8), both able to attack.
  const board = makeTestState({
    battlefield: [
      { iid: 7, cardId: 'rager', controller: 0 },
      { iid: 8, cardId: 'bear', controller: 0 },
    ],
  }).battlefield;
  const compelled = compelledAttackers(board, db, 0);

  it('never submits a declaration the engine refuses, with nothing picked or with picks', () => {
    // The old button sent exactly your picks: nothing picked meant the empty
    // "Skip Combat" declaration, which Rage makes illegal.
    expect(validateAttackers(board, db, 0, [])).not.toBeNull();
    for (const picked of [[], [8]]) {
      const declared = attackDeclaration(picked, compelled);
      expect(validateAttackers(board, db, 0, declared), JSON.stringify(picked)).toBeNull();
      expect(attackButtonLabel(declared)).toBe(`Attack (${declared.length})`);
    }
  });

  it('keeps a Rage creature in when tapped, says why, and still toggles the rest', () => {
    const start = new Set(attackDeclaration([], compelled));
    const refused = toggleAttacker(start, 7, compelled);
    expect(refused.refused).toBe(true);
    expect(refused.selected.has(7)).toBe(true);
    const picked = toggleAttacker(start, 8, compelled);
    expect(picked.refused).toBe(false);
    expect(picked.selected.has(8)).toBe(true);
    expect(toggleAttacker(picked.selected, 8, compelled).selected.has(8)).toBe(false);
    const notice = rageMustAttackNotice(rager.name);
    expect(notice).toContain(rager.name);
    expect(notice).not.toMatch(/attacker \d|—/);
  });

  it('is unchanged without Rage: your picks exactly, and Skip Combat when there are none', () => {
    expect(attackDeclaration([8, 3], [])).toEqual([8, 3]);
    expect(attackButtonLabel(attackDeclaration([], []))).toBe('Skip Combat');
    expect(toggleAttacker(new Set([8]), 8, []).selected.has(8)).toBe(false);
  });

  it('does not call an all-Rage forced attack a skipped combat', () => {
    expect(forcedAttackNotice(0)).toMatch(/skipped/i);
    for (const count of [1, 2]) expect(forcedAttackNotice(count)).not.toMatch(/skip/i);
  });
});
