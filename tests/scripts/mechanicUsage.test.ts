import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { MediumAI } from '../../src/ai/MediumAI';
import { buildAI } from '../../src/ai/personality';
import { CARD_DB } from '../../src/data/catalog';
import { DARLINGS_PRECON_MATRIX_FLEET } from '../../src/data/darlingsPrecons';
import { AVATARS } from '../../src/data/opponents';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import type { Action } from '../../src/engine/actions';
import type { CardDb, CardDef, Permanent } from '../../src/engine/types';
import type { PlayerView } from '../../src/engine/view';
import { WARCHEST_HAND_SIZE } from '../../src/meta/warchest';
import { playOut, runCell, type CellSpec } from '../../scripts/balance-matrix';
import { classifyAction, MECHANIC_RULES, SENSE_CHECKS, senseChecksFor, type UsageContext } from '../../scripts/mechanicUsage';
import { GameUsage, MechanicUsageCollector } from '../../scripts/mechanicUsageCollector';

// A small synthetic card pool: each card carries exactly the mechanic its
// scenario needs, so a recost or rewording of a live card cannot fail these.
const mana = (generic: number) => ({ generic, pips: {} });
function card(id: string, extra: Partial<CardDef>): CardDef {
  return { id, name: id, types: ['ritual'], subtypes: [], colors: [], rarity: 'c', cost: mana(1), ...extra };
}
const draw = [{ op: 'draw' as const, n: 1 }];
const DB: CardDb = Object.fromEntries([
  card('empower', { types: ['charm'], abilities: [{ when: 'spell', ops: draw }], empower: { cost: mana(2), ops: draw } }),
  card('retell', { abilities: [{ when: 'spell', ops: draw }], retell: { cost: mana(3) } }),
  card('skim', { abilities: [{ when: 'spell', ops: draw }], skim: { cost: mana(1) } }),
  card('charm', { types: ['charm'], abilities: [{ when: 'spell', ops: draw }] }),
  card('link', { types: ['artifact'], hauntlink: { cost: mana(0), linked: { grantKeywords: ['skyborne'] } } }),
  card('dearLink', { types: ['artifact'], hauntlink: { cost: mana(9), linked: { grantKeywords: ['skyborne'] } } }),
  card('creature', { types: ['creature'], attack: 2, defense: 2 }),
  card('bigCreature', { types: ['creature'], attack: 6, defense: 6 }),
  card('flyer', { types: ['creature'], attack: 2, defense: 2, keywords: ['skyborne'] }),
  card('dutyCreature', { types: ['creature'], attack: 1, defense: 3, activated: { cost: { tap: true }, ops: draw } }),
  card('markAll', { abilities: [{ when: 'spell', ops: [{ op: 'markAll', scope: 'yourCreatures' }] }] }),
  card('markPayoff', { abilities: [{ when: 'spell', ops: [{ op: 'propagate' }, { op: 'gainLife', n: 8 }] }] }),
  card('ramp', { abilities: [{ when: 'spell', ops: [{ op: 'extraLandDrop' }] }] }),
  card('darling', { types: ['creature'], supertypes: ['legendary'], attack: 3, defense: 3 }),
  // First Dawn fixtures: Hunt on each carrier, and a Provoked creature.
  card('three', { types: ['creature'], attack: 3, defense: 3 }),
  card('stalk', { types: ['charm'], abilities: [{ when: 'spell', targets: [{ what: 'yourCreature' }, { what: 'opponentCreature' }], ops: [{ op: 'hunt', hunter: 'target' }] }] }),
  card('fangHorn', { types: ['charm'], abilities: [{ when: 'spell', targets: [{ what: 'yourCreature' }, { what: 'opponentCreature' }], ops: [
    { op: 'boost', p: 2, t: 2, scope: 'target' }, { op: 'hunt', hunter: 'target' },
  ] }] }),
  card('stalkAny', { types: ['charm'], abilities: [{ when: 'spell', targets: [{ what: 'yourCreature' }, { what: 'creature', other: true }], ops: [{ op: 'hunt', hunter: 'target', prey: 'any' }] }] }),
  card('raptor', { types: ['creature'], attack: 3, defense: 3, abilities: [{ when: 'arrives', targets: [{ what: 'opponentCreature' }], ops: [{ op: 'hunt', hunter: 'self' }] }] }),
  card('korru', { types: ['creature'], attack: 3, defense: 3, abilities: [{ when: 'arrives', targets: [{ what: 'creature', other: true }], ops: [{ op: 'hunt', hunter: 'self', prey: 'any' }] }] }),
  card('tracker', { types: ['creature'], attack: 2, defense: 4, activated: { cost: { tap: true }, targets: [{ what: 'opponentCreature' }], ops: [{ op: 'hunt', hunter: 'self' }] } }),
  card('kesh', { types: ['creature'], attack: 3, defense: 3, abilities: [{ when: 'attacks', targets: [{ what: 'opponentCreature' }], ops: [{ op: 'hunt', hunter: 'self' }] }] }),
  card('provoked', { types: ['creature'], attack: 1, defense: 4, abilities: [{ when: 'provoked', ops: draw }] }),
  card('pinger', { abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] }] }),
].map((d) => [d.id, d]));

function perm(iid: number, cardId: string, extra: Partial<Permanent> = {}): Permanent {
  return {
    iid, cardId, owner: 0, controller: 0, tapped: false, enteredThisTurn: false, damage: 0,
    deathtouched: false, severBranded: false, attachments: [], plusOneCounters: 0, untilEotMods: [], ...extra,
  };
}
const enemy = (iid: number, cardId: string): Permanent => perm(iid, cardId, { owner: 1, controller: 1 });

function view(extra: Partial<PlayerView> = {}, you: Partial<PlayerView['you']> = {}): PlayerView {
  return {
    myId: 0, turn: 5, step: 'main1', activePlayer: 0, startingPlayer: 0,
    you: {
      life: 20, hand: [], deckCount: 30, graveyard: [], whispersLive: [], severed: [],
      landDropsRemaining: 1, mulligans: 0, ...you,
    },
    opp: {
      life: 20, handCount: 5, deckCount: 30, graveyard: [], whispersLive: [], severed: [],
      landDropsRemaining: 1, mulligans: 0,
    },
    battlefield: [], stack: [], combat: null, fogThisTurn: false,
    awaiting: { player: 0, kind: 'main' }, winner: null, ...extra,
  };
}

const ctx = (v: PlayerView): UsageContext => ({ view: v, db: DB });
const mechanics = (action: Action, v: PlayerView): string[] =>
  classifyAction(action, ctx(v)).map((hit) => `${hit.mechanic}:${hit.cardId}`);
const respondWindow = { player: 0, kind: 'respond', over: { type: 'attackers' } } as const;
const pass: Action = { type: 'passStep' };
const scripted = (actions: Action[]): AIPlayer => {
  let i = 0;
  return { chooseAction: () => actions[i++] };
};

describe('mechanic usage classifier', () => {
  it('reads a Retell cast from the graveyard, not from the hand card at the mirrored index', () => {
    const v = view({}, { hand: ['creature'], graveyard: ['retell'] });
    expect(mechanics({ type: 'castSpell', handIndex: 0, graveIndex: 0, retell: true }, v)).toEqual(['retell:retell']);
  });

  it('counts Empower only when the extra cost is paid, not the plain cast of the same card', () => {
    const v = view({}, { hand: ['empower'] });
    expect(mechanics({ type: 'castSpell', handIndex: 0 }, v)).toEqual([]);
    expect(mechanics({ type: 'castSpell', handIndex: 0, empowered: true }, v)).toEqual(['empower:empower']);
  });

  it('splits Hauntlink into a link from an unlinked carrier and a move of an attached one', () => {
    const unlinked = view({ battlefield: [perm(1, 'link'), perm(2, 'creature'), perm(3, 'creature')] });
    const attached = view({
      battlefield: [perm(1, 'link', { attachedTo: 2 }), perm(2, 'creature', { attachments: [1] }), perm(3, 'creature')],
    });
    const action: Action = { type: 'linkHaunt', iid: 1, hostIid: 3 };
    expect(mechanics(action, unlinked)).toEqual(['hauntlinkLink:link']);
    expect(mechanics(action, attached)).toEqual(['hauntlinkMove:link']);
  });

  it('calls acting in a response window a Charm-speed play, and passing or a main-phase cast not one', () => {
    const cast: Action = { type: 'castSpell', handIndex: 0 };
    const respond = view({ awaiting: respondWindow }, { hand: ['charm'] });
    expect(mechanics(cast, respond)).toEqual(['charmWindow:charm']);
    expect(mechanics({ type: 'passResponse' }, respond)).toEqual([]);
    expect(mechanics(cast, view({}, { hand: ['charm'] }))).toEqual([]);
  });

  it('does not count a window that offers only a pass and a concession as a Charm-speed chance', () => {
    const game = new GameUsage(DB);
    game.record(view({ awaiting: respondWindow }), [{ type: 'passResponse' }, { type: 'concede' }], { type: 'passResponse' });
    expect(game.chance.get('charmWindow')).toBeUndefined();
  });

  it('names the permanent a Duty activation taps', () => {
    const v = view({ battlefield: [perm(7, 'dutyCreature')] });
    expect(mechanics({ type: 'activate', iid: 7 }, v)).toEqual(['duty:dutyCreature']);
  });
});

describe('mechanic usage: the Darling', () => {
  const payDown: Action = { type: 'payDownDarlingTax' };

  it('counts a tax paydown while the Darling is on the battlefield and her command zone is empty', () => {
    const game = new GameUsage(DB, MECHANIC_RULES, SENSE_CHECKS, 'darling');
    const onBattlefield = view({ battlefield: [perm(3, 'darling')] }, { darlingZone: null, darlingTax: 2 });
    game.record(onBattlefield, [payDown, pass], payDown);
    expect(game.chance.get('darlingTax')?.size).toBe(1);
    expect(game.taken.get('darlingTax')?.size).toBe(1);
    expect(game.cards.get('darling')?.uses).toEqual({ darlingTax: 1 });
  });

  it('counts a call as a cast of the Darling, so paydowns read per call', () => {
    const collector = new MechanicUsageCollector(DB);
    const factory = collector.wrapFactory(
      { matrix: 'test', id: 'boss', name: 'Boss', list: { deck: ['creature'], darlingId: 'darling' } },
      (actions: Action[]) => scripted(actions),
    );
    const call: Action = { type: 'castDarling' };
    const ai = factory([call, payDown, payDown]);
    ai.chooseAction(view({}, { darlingZone: 'darling', darlingTax: 0 }), [call, pass]);
    ai.chooseAction(view({ turn: 7 }, { darlingZone: null, darlingTax: 2 }), [payDown, pass]);
    ai.chooseAction(view({ turn: 9 }, { darlingZone: null, darlingTax: 2 }), [payDown, pass]);
    const [boss] = collector.toJSON().bosses;
    expect(boss.rows.find((r) => r.mechanic === 'darlingCall')).toMatchObject({ cardsInList: 1, turnsTaken: 1, seen: 0 });
    expect(boss.rows.find((r) => r.mechanic === 'darlingTax')).toMatchObject({ turnsTaken: 2, usesPerCast: 2 });
    expect(boss.cards.find((c) => c.cardId === 'darling')).toMatchObject({ cast: 1, castFromHand: 0 });
  });
});

describe('mechanic usage sense checks', () => {
  const flags = (action: Action, v: PlayerView): Record<string, boolean> =>
    Object.fromEntries(senseChecksFor(action, ctx(v)).map(({ check }) => [check.id, check.flagged(action, ctx(v))]));
  const cast: Action = { type: 'castSpell', handIndex: 0 };

  it('flags a Mark-all spell cast with no creature of her own, and not one cast onto a board', () => {
    expect(flags(cast, view({}, { hand: ['markAll'] }))).toEqual({ markAllEmpty: true });
    expect(flags(cast, view({ battlefield: [perm(4, 'creature')] }, { hand: ['markAll'] }))).toEqual({ markAllEmpty: false });
  });

  it('flags a Mark payoff cast with no Marked creature of hers, even with an enemy Marked', () => {
    const enemyMarked = { ...enemy(8, 'creature'), plusOneCounters: 2 };
    expect(flags(cast, view({ battlefield: [perm(4, 'creature'), enemyMarked] }, { hand: ['markPayoff'] })))
      .toEqual({ markPayoffUnmarked: true });
    expect(flags(cast, view({ battlefield: [perm(4, 'creature', { plusOneCounters: 1 })] }, { hand: ['markPayoff'] })))
      .toEqual({ markPayoffUnmarked: false });
  });

  it('reads a ramp cast at her own turn, and flags one with no land left in the reserve', () => {
    const check = SENSE_CHECKS.find((c) => c.id === 'rampCast')!;
    // Engine turn 6 is the second player's third turn; engine turn 3 is the first player's second.
    const late = view({ turn: 6, startingPlayer: 1 }, { hand: ['ramp'], landReserve: [] });
    const early = view({ turn: 3 }, { hand: ['ramp'], landReserve: ['plains'] });
    expect(flags(cast, late)).toEqual({ rampCast: true });
    expect(check.reading!(cast, ctx(late))).toBe(3);
    expect(flags(cast, early)).toEqual({ rampCast: false });
    expect(check.reading!(cast, ctx(early))).toBe(2);
  });

  it('flags a main-phase-2 creature Duty only when the opponent has an attacker it could have blocked', () => {
    const duty: Action = { type: 'activate', iid: 7 };
    expect(flags(duty, view({ step: 'main2', battlefield: [perm(7, 'dutyCreature'), enemy(9, 'creature')] })))
      .toEqual({ creatureDutyMain2: true });
    expect(flags(duty, view({ step: 'main2', battlefield: [perm(7, 'dutyCreature')] })))
      .toEqual({ creatureDutyMain2: false });
    expect(flags(duty, view({ step: 'main1', battlefield: [perm(7, 'dutyCreature'), enemy(9, 'creature')] }))).toEqual({});
  });

  it('flags a main-phase Hauntlink move onto a host that gains nothing, and not one onto a host that gains the rider', () => {
    // The rider grants Skyborne: worth nothing on the flyer, something on a ground body.
    const onGround = view({
      battlefield: [perm(1, 'link', { attachedTo: 2 }), perm(2, 'bigCreature', { attachments: [1] }), perm(3, 'flyer')],
    });
    const onFlyer = view({
      battlefield: [perm(1, 'link', { attachedTo: 3 }), perm(3, 'flyer', { attachments: [1] }), perm(2, 'bigCreature')],
    });
    expect(flags({ type: 'linkHaunt', iid: 1, hostIid: 3 }, onGround)).toMatchObject({ hauntlinkMoveNoBetter: true });
    expect(flags({ type: 'linkHaunt', iid: 1, hostIid: 2 }, onFlyer)).toMatchObject({ hauntlinkMoveNoBetter: false });
    // Window moves answer a live fight the static fit cannot see, so they are not judged.
    const inWindow = { ...onGround, awaiting: respondWindow };
    expect(flags({ type: 'linkHaunt', iid: 1, hostIid: 3 }, inWindow)).not.toHaveProperty('hauntlinkMoveNoBetter');
  });

  it('counts a move chance as meaningful only when the fit gain repays the link\'s own move margin', () => {
    const move = MECHANIC_RULES.find((rule) => rule.id === 'hauntlinkMove')!;
    const board = (link: string) => view({
      battlefield: [perm(1, link, { attachedTo: 3 }), perm(3, 'flyer', { attachments: [1] }), perm(2, 'bigCreature')],
    });
    const action: Action = { type: 'linkHaunt', iid: 1, hostIid: 2 };
    expect(move.meaningful!(action, ctx(board('link')))).toBe(true);
    expect(move.meaningful!(action, ctx(board('dearLink')))).toBe(false);
  });
});

describe('mechanic usage counting', () => {
  it('counts turns with a chance, not decisions: a mechanic legal all turn is one chance', () => {
    const game = new GameUsage(DB);
    const skim: Action = { type: 'skim', handIndex: 0 };
    const turn5 = view({}, { hand: ['skim'] });
    game.record(turn5, [skim, pass], pass);
    game.record(turn5, [skim, pass], pass);
    game.record(turn5, [skim, pass], skim);
    game.record(view({ turn: 7 }, { hand: ['skim'] }), [skim, pass], pass);
    expect(game.chance.get('skim')?.size).toBe(2);
    expect(game.taken.get('skim')?.size).toBe(1);
  });

  it('counts a copy as seen when it arrives in hand, net of the copies her own casts took out', () => {
    const game = new GameUsage(DB);
    game.record(view({}, { hand: ['charm', 'creature'] }), [pass], { type: 'castSpell', handIndex: 0 });
    // The cast Charm left; a second copy was drawn; the creature stayed.
    game.record(view({ turn: 7 }, { hand: ['creature', 'charm'] }), [pass], pass);
    game.record(view({ turn: 7 }, { hand: ['creature', 'charm'] }), [pass], { type: 'mulligan' });
    // A mulligan takes the whole hand out, so the same ids in the new hand are new copies.
    game.record(view({ turn: 7 }, { hand: ['creature', 'charm'] }), [pass], pass);
    expect(game.cards.get('charm')?.seen).toBe(3);
    expect(game.cards.get('creature')?.seen).toBe(2);
    expect(game.cards.get('charm')?.castFromHand).toBe(1);
  });

  it('starts a new game on every factory call and counts what her last action leaves in hand as stranded', () => {
    const collector = new MechanicUsageCollector(DB);
    const factory = collector.wrapFactory(
      { matrix: 'test', id: 'boss', name: 'Boss', list: { deck: ['skim', 'skim', 'creature'] } },
      (actions: Action[]) => scripted(actions),
    );
    const skim: Action = { type: 'skim', handIndex: 0 };
    const gameOne = factory([skim, pass]);
    gameOne.chooseAction(view({}, { hand: ['skim', 'creature'] }), [skim, pass]);
    gameOne.chooseAction(view({ turn: 7 }, { hand: ['creature'] }), [pass]);
    // Game two ends on her Skim of one of two copies: one copy is stranded.
    const gameTwo = factory([pass, skim]);
    gameTwo.chooseAction(view({ turn: 3 }, { hand: ['skim', 'skim'] }), [pass]);
    gameTwo.chooseAction(view({}, { hand: ['skim', 'skim'] }), [skim, pass]);
    const [boss] = collector.toJSON().bosses;
    expect(boss.games).toBe(2);
    const row = boss.rows.find((r) => r.mechanic === 'skim')!;
    expect(row).toMatchObject({ cardsInList: 2, turnsWithChance: 2, turnsTaken: 2, rate: 1, seen: 3 });
    const skimCard = boss.cards.find((c) => c.cardId === 'skim')!;
    expect(skimCard).toMatchObject({ seen: 3, stranded: 1, uses: { skim: 2 } });
  });
});

describe('mechanic usage: Hunt and Provoked (First Dawn)', () => {
  const at = (iid: number) => ({ kind: 'permanent' as const, iid });
  const cast = (targets: ReturnType<typeof at>[]): Action => ({ type: 'castSpell', handIndex: 0, targets });

  it('names a Hunt on every carrier: a Hunt spell, an arrival hunter cast on its prey, a hunting Duty and a hunting trigger', () => {
    const board = [perm(4, 'creature'), enemy(9, 'creature')];
    expect(mechanics(cast([at(4), at(9)]), view({ battlefield: board }, { hand: ['stalk'] }))).toEqual(['hunt:stalk']);
    expect(mechanics(cast([at(9)]), view({ battlefield: board }, { hand: ['raptor'] }))).toEqual(['hunt:raptor']);
    // Cast with no prey (a conditional hunter whose condition failed), it does not hunt now.
    expect(mechanics(cast([]), view({ battlefield: board }, { hand: ['raptor'] }))).toEqual([]);
    const duty = view({ battlefield: [perm(7, 'tracker'), ...board] });
    expect(mechanics({ type: 'activate', iid: 7, targets: [at(9)] }, duty)).toEqual(['duty:tracker', 'hunt:tracker']);
    const trigger = view({
      battlefield: [perm(7, 'kesh'), ...board],
      awaiting: { player: 0, kind: 'chooseTarget', sourceIid: 7, abilityIndex: 0, targets: [at(9)] },
    });
    expect(mechanics({ type: 'chooseTarget', target: at(9) }, trigger)).toEqual(['hunt:kesh']);
    // A spell with a target that does not hunt is not a Hunt.
    expect(mechanics(cast([at(9)]), view({ battlefield: board }, { hand: ['pinger'] }))).toEqual([]);
  });

  it('counts an any Hunt aimed at her own creature apart: a chance when she could, taken when she did', () => {
    const game = new GameUsage(DB);
    const board = [perm(4, 'creature'), enemy(9, 'creature')];
    const atEnemy = cast([at(9)]);
    const atOwn = cast([at(4)]);
    game.record(view({ battlefield: board }, { hand: ['korru'] }), [atEnemy, atOwn, pass], atEnemy);
    expect(game.chance.get('huntAnySelf')?.size).toBe(1);
    expect(game.taken.get('huntAnySelf')).toBeUndefined();
    expect(game.taken.get('hunt')?.size).toBe(1);
    game.record(view({ turn: 7, battlefield: board }, { hand: ['stalkAny'] }), [cast([at(4), at(9)])], cast([at(9), at(4)]));
    expect(game.taken.get('huntAnySelf')?.size).toBe(1);
    // The generic Hunt never reaches her own side, so it is never counted apart.
    const generic = new GameUsage(DB);
    generic.record(view({ battlefield: board }, { hand: ['raptor'] }), [atEnemy], atEnemy);
    expect(generic.chance.get('huntAnySelf')).toBeUndefined();
  });

  it('flags a Hunt whose hunter dies while its prey survives, reading a pump earlier in the spell and an arriving hunter', () => {
    const check = SENSE_CHECKS.find((c) => c.id === 'huntLostHunter')!;
    const flagged = (hand: string, board: Permanent[], targets: ReturnType<typeof at>[]): boolean => {
      const v = view({ battlefield: board }, { hand: [hand] });
      expect(check.applies(cast(targets), ctx(v))).toBe(hand);
      return check.flagged(cast(targets), ctx(v));
    };
    const smallIntoThree = [perm(4, 'creature'), enemy(9, 'three')];
    // A 2/2 hunting a 3/3 dies and leaves it alive; +2/+2 first makes it a kill that survives.
    expect(flagged('stalk', smallIntoThree, [at(4), at(9)])).toBe(true);
    expect(flagged('fangHorn', smallIntoThree, [at(4), at(9)])).toBe(false);
    // A 3/3 arriving into a 6/6 dies for nothing; into a 2/2 it kills and survives.
    expect(flagged('raptor', [enemy(9, 'bigCreature')], [at(9)])).toBe(true);
    expect(flagged('raptor', [enemy(9, 'creature')], [at(9)])).toBe(false);
  });

  it('counts a Provoked fire of hers once a turn, as her own source when her previous action named the creature', () => {
    const game = new GameUsage(DB);
    const fired = (iid: number, extra: Partial<Permanent> = {}) => perm(iid, 'provoked', { firedThisTurn: [0], ...extra });
    const ping = cast([at(4)]);
    game.record(view({ battlefield: [perm(4, 'provoked')] }, { hand: ['pinger'] }), [ping, pass], ping);
    // The ping resolved and provoked her creature; an opponent's fired Provoked is not hers.
    const after = view({ battlefield: [fired(4), fired(9, { owner: 1, controller: 1 })] });
    game.record(after, [pass], pass);
    game.record(after, [pass], pass);
    // Next turn it fires again, after a pass: not her own source.
    game.record(view({ turn: 7, battlefield: [fired(4)] }), [pass], pass);
    expect(game.provoked.get('provoked')).toEqual({ fires: 2, ownSource: 1 });
  });

  it('reports the Hunt rows and the Provoked tally only for a list that carries them', () => {
    const collector = new MechanicUsageCollector(DB);
    const run = (id: string, deck: string[]) => {
      const ai = collector.wrapFactory({ matrix: 'test', id, name: id, list: { deck } }, () => scripted([pass]))();
      ai.chooseAction(view(), [pass]);
    };
    run('plain', ['creature', 'charm']);
    run('dawn', ['korru', 'provoked', 'provoked']);
    const [plain, dawn] = collector.toJSON().bosses;
    expect(plain.rows.filter((row) => row.mechanic.startsWith('hunt')).map((row) => row.cardsInList)).toEqual([0, 0]);
    expect(plain.provoked).toMatchObject({ cardsInList: 0, fires: 0, perCard: [] });
    expect(dawn.rows.find((row) => row.mechanic === 'huntAnySelf')?.cardsInList).toBe(1);
    expect(dawn.provoked).toMatchObject({ cardsInList: 2, fires: 0 });
    const [plainBlock, dawnBlock] = collector.render().split('[test] ').slice(1);
    expect(plainBlock).not.toMatch(/Hunt|Provoked/);
    expect(dawnBlock).toMatch(/Provoked \(passive\)/);
  });
});

describe('mechanic usage wrapper changes nothing', () => {
  // Kitsune runs the Hauntlink package, a Skim card and Charms, so the
  // wrapper's heaviest paths (host fit, window checks) run in these games.
  const kitsune = AVATARS.find((a) => a.id === 'kitsune-neon-tyrant')!;
  const starter = STARTER_DECKS[0];
  const spec = (rowAI: CellSpec['rowAI']): CellSpec => ({
    rowAI,
    colAI: () => new MediumAI(CARD_DB),
    decks: () => [kitsune.reserveDeck, starter.reserveCards!],
    format: 'warchest',
    reserves: () => [kitsune.landReserve, starter.landReserve!],
    startingHandSize: WARCHEST_HAND_SIZE,
  });
  const plain = (seed: number): AIPlayer => buildAI(kitsune.difficulty, CARD_DB, seed, kitsune.personality);

  it('plays the same seeded games action for action, with the same winners, with and without the wrapper', () => {
    const logged = (inner: AIPlayer, log: string[]): AIPlayer => ({
      chooseAction: (v, legal) => {
        const action = inner.chooseAction(v, legal);
        log.push(JSON.stringify(action));
        return action;
      },
    });
    const collector = new MechanicUsageCollector(CARD_DB);
    const wrapped = collector.wrapFactory(
      { matrix: 'test', id: kitsune.id, name: kitsune.name, list: { deck: kitsune.reserveDeck } },
      plain,
    );
    for (const seed of [2_000_000, 2_000_001]) {
      const runs = [plain, wrapped].map((factory) => {
        const log: string[] = [];
        const winner = playOut(
          seed,
          logged(factory(seed * 7 + 1), log),
          logged(new MediumAI(CARD_DB), log),
          [kitsune.reserveDeck, starter.reserveCards!],
          'warchest',
          [kitsune.landReserve, starter.landReserve!],
          undefined, undefined, undefined, undefined,
          WARCHEST_HAND_SIZE,
        );
        return { winner, log };
      });
      expect(runs[1].winner).toBe(runs[0].winner);
      expect(runs[1].log).toEqual(runs[0].log);
    }
    // The wrapper was live, not bypassed: it saw every one of her decisions.
    expect(collector.toJSON().bosses[0].decisions).toBeGreaterThan(0);
  }, 120_000);

  it('gives the same seeded cell result with and without the wrapper', () => {
    const collector = new MechanicUsageCollector(CARD_DB);
    const without = runCell(spec(plain), 2, kitsune.tier * 100);
    const withUsage = runCell(
      spec(collector.wrapFactory({ matrix: 'test', id: kitsune.id, name: kitsune.name, list: { deck: kitsune.reserveDeck } }, plain)),
      2,
      kitsune.tier * 100,
    );
    expect(withUsage).toEqual(without);
    expect(collector.toJSON().bosses[0].games).toBe(2);
  }, 120_000);

  it('gives the same seeded Darlings cell result with and without the wrapper', () => {
    const hera = AVATARS.find((a) => a.id === 'hera')!;
    const proxy = DARLINGS_PRECON_MATRIX_FLEET[0];
    const darlingsSpec = (rowAI: CellSpec['rowAI']): CellSpec => ({
      rowAI,
      colAI: () => new MediumAI(CARD_DB),
      decks: () => [hera.darlingsDeck, proxy.cards],
      format: 'darlings',
      reserves: () => [hera.landReserve, proxy.landReserve],
      darlings: () => [hera.darlingId, proxy.darlingId],
      startingHandSize: WARCHEST_HAND_SIZE,
    });
    const heraAI = (seed: number): AIPlayer => buildAI(hera.difficulty, CARD_DB, seed, hera.personality);
    const collector = new MechanicUsageCollector(CARD_DB);
    const info = { matrix: 'test', id: hera.id, name: hera.name, list: { deck: hera.darlingsDeck, darlingId: hera.darlingId } };
    const without = runCell(darlingsSpec(heraAI), 2, 210_000 + hera.tier * 100);
    const withUsage = runCell(darlingsSpec(collector.wrapFactory(info, heraAI)), 2, 210_000 + hera.tier * 100);
    expect(withUsage).toEqual(without);
    expect(collector.toJSON().bosses[0].games).toBe(2);
  }, 120_000);
});
