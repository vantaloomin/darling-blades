import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { chooseActivate } from '../../src/ai/activatedPolicy';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { makePersonality } from '../../src/ai/personality';
import { activateActionValue } from '../../src/ai/value';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import { getEffectiveStats } from '../../src/engine/statics';
import type { CardDb, CardDef, Color, GameState, Permanent } from '../../src/engine/types';
import { cardIdOf, manaValue, validateActivatedDef } from '../../src/engine/types';
import { STARBORNE_SET } from '../../src/data/liveness';
import { collectiblePool } from '../../src/meta/collectionFilter';
import { packPool } from '../../src/meta/PackOpener';
import { isUtilityTapland } from '../../src/meta/warchest';
import { rulesText } from '../../src/ui/rulesText';
import { botAction, makeTestState, TEST_DB } from '../helpers';

/**
 * Land economy, lane D of 1.8 (docs/plan-land-economy.md, slate approved
 * 2026-09-17): the 27 utility taplands became common Duty artifacts. This file
 * is the transcription proof — shape, printed cost, colour, the GENERATED
 * rules line, the pack and collection pools, the design-rule-4 uniqueness
 * check, one resolution test per distinct Duty shape, and the AI proof for the
 * seven heavier rows. Rules lines here are whatever `rulesText` renders; the
 * slate's "Duty (rules line)" column is intent, the generator is the truth.
 */

interface Row {
  id: string;
  name: string;
  /** Printed cost: generic part, then the pip letters. */
  generic: number;
  pips: string;
  colors: Color[];
  /** The generated `rulesText` output, pinned exactly. */
  text: string;
}

const CELTIC_FAE_ROWS: Row[] = [
  { id: 'cf-mist-road', name: 'Mist-Road Waymark', generic: 0, pips: 'U', colors: ['U'], text: '{T}: Foresee 1.' },
  { id: 'cf-mossy-ring', name: 'Ring-Stone Moss', generic: 0, pips: 'G', colors: ['G'], text: '{T}: You gain 1 life.' },
  {
    id: 'cf-raven-stone', name: 'Raven Stone', generic: 0, pips: 'B', colors: ['B'],
    text: '{T}: Foresee 1, then put the top card of your deck into your graveyard.',
  },
];

const ARTHURIAN_ROWS: Row[] = [
  { id: 'ac-bramble-chapel', name: 'Bramble Reliquary', generic: 0, pips: 'G', colors: ['G'], text: '{T}: You gain 1 life.' },
  {
    id: 'ac-lowland-fort', name: 'Lowland Fort Banner', generic: 2, pips: 'W', colors: ['W'],
    text: '{2}, {T}: Tap target creature an opponent controls.',
  },
  { id: 'ac-red-tournament-ground', name: 'Tournament Pennant', generic: 0, pips: 'R', colors: ['R'], text: '{T}: Foresee 1.' },
  {
    id: 'ac-court-of-whispers', name: "Listeners' Curtain", generic: 0, pips: 'B', colors: ['B'],
    text: '{T}: Put the top card of your deck into your graveyard.',
  },
  { id: 'ac-mirror-lake', name: 'Mirror-Lake Glass', generic: 0, pips: 'U', colors: ['U'], text: '{2}, {T}: Foresee 3.' },
];

const GOTHIC_ROWS: Row[] = [
  {
    id: 'gm-moor-path', name: 'Moorlight Lantern', generic: 2, pips: 'B', colors: ['B'],
    text: '{3}, {T}: Your opponent loses 2 life, then you gain 2 life.',
  },
  {
    id: 'gm-chapel-yard', name: 'Chapel-Yard Rosary', generic: 0, pips: 'W', colors: ['W'],
    text: "{T}: Sever the top card of your opponent's graveyard.",
  },
  { id: 'gm-lab-annex', name: 'Annex Notebook', generic: 0, pips: 'U', colors: ['U'], text: '{T}: Foresee 1.' },
  {
    id: 'gm-red-roof-village', name: 'Festival Rocket', generic: 2, pips: 'R', colors: ['R'],
    text: '{2}, {T}: Deal 2 damage to target creature.',
  },
  {
    id: 'gm-thorned-cemetery', name: 'Cemetery Thorn', generic: 0, pips: 'G', colors: ['G'],
    text: '{T}: Put the top card of your deck into your graveyard.',
  },
];

const DARK_TALES_ROWS: Row[] = [
  { id: 'dt-wolf-path', name: 'Wolf-Path Charm', generic: 0, pips: 'G', colors: ['G'], text: '{T}: You gain 1 life.' },
  { id: 'dt-palace-steps', name: 'Glass Slipper', generic: 0, pips: 'W', colors: ['W'], text: '{1}, {T}: You gain 2 life.' },
  {
    id: 'dt-hearth-cinders', name: 'Banked Cinders', generic: 1, pips: 'R', colors: ['R'],
    text: '{T}: This deals 1 damage to your opponent.',
  },
  {
    id: 'dt-midnight-road', name: 'Midnight Invitation', generic: 0, pips: 'B', colors: ['B'],
    text: '{T}: Put the top card of your deck into your graveyard.',
  },
  {
    id: 'dt-riverbend-trail', name: 'Riverbend Waterwheel', generic: 2, pips: 'G', colors: ['G'],
    text: '{3}, {T}: Return target creature card from your graveyard to your hand.',
  },
  { id: 'dt-sea-cave', name: 'Sea-Cave Pearl', generic: 0, pips: 'U', colors: ['U'], text: '{T}: Foresee 1.' },
  { id: 'dt-desert-rooftop', name: 'Rooftop Spyglass', generic: 0, pips: 'R', colors: ['R'], text: '{1}, {T}: Foresee 2.' },
  {
    id: 'dt-winter-bridge', name: 'Winter-Bridge Toll', generic: 0, pips: 'U', colors: ['U'],
    text: "{T}: Sever the top card of your opponent's graveyard.",
  },
];

const STARBORNE_ROWS: Row[] = [
  {
    id: 'sb-pale-nebula', name: 'Nebula Beacon', generic: 2, pips: 'W', colors: ['W'],
    text: '{2}, {T}: Target creature you control gets +2/+2 until Sunset.',
  },
  {
    // The slate reads "from target creature"; moveMark is engine-restricted to
    // two creatures the activator controls (actions.ts), and the generator
    // renders that restriction, so the shipped line says "a creature you
    // control". Recorded in the transcription report, 2026-09-17.
    id: 'sb-deepfield-lands', name: 'Deepfield Array', generic: 0, pips: 'U', colors: ['U'],
    text: '{1}, {T}: Move a Mark from a creature you control to another creature you control.',
  },
  {
    id: 'sb-darkside-landing', name: 'Violet Landing Light', generic: 1, pips: 'B', colors: ['B'],
    text: '{T}: Remove all Marks from target Marked creature.',
  },
  {
    id: 'sb-ember-lane', name: 'Ember-Lane Flare', generic: 0, pips: 'R', colors: ['R'],
    text: '{1}, {T}: This deals 1 damage to your opponent.',
  },
  {
    id: 'sb-overcanopy', name: 'Overcanopy Trellis', generic: 1, pips: 'G', colors: ['G'],
    text: '{1}, {T}: Mark target creature you control.',
  },
  { id: 'sb-interstellar-crossing', name: 'Crossing Beacon', generic: 4, pips: '', colors: [], text: '{3}, {T}: Draw a card.' },
];

const SET_TABLES: [CardDef['set'], Row[]][] = [
  ['celtic-fae', CELTIC_FAE_ROWS],
  ['arthurian-court', ARTHURIAN_ROWS],
  ['gothic-monsters', GOTHIC_ROWS],
  ['dark-tales', DARK_TALES_ROWS],
  [STARBORNE_SET as unknown as CardDef['set'], STARBORNE_ROWS],
];

const ALL_ROWS: Row[] = SET_TABLES.flatMap(([, rows]) => rows);
const ALL_IDS = ALL_ROWS.map((row) => row.id);

describe('land economy: the 27 converted rows', () => {
  it('converts exactly 27 rows', () => {
    expect(ALL_IDS).toHaveLength(27);
    expect(new Set(ALL_IDS).size).toBe(27);
  });

  it.each(SET_TABLES)('%s keeps every converted row in its own set', (set, rows) => {
    for (const row of rows) expect(CARD_DB[row.id]?.set, row.id).toBe(set);
  });

  it.each(ALL_ROWS.map((row) => [row.id, row] as const))(
    '%s is a common artifact with no land shape left',
    (_id, row) => {
      const d = CARD_DB[row.id];
      expect(d, row.id).toBeDefined();
      expect(d.types).toEqual(['artifact']);
      expect(d.subtypes).toEqual([]);
      expect(d.rarity).toBe('c');
      expect(d.manaAbility).toBeUndefined();
      expect(d.entersTapped).toBeUndefined();
      expect(d.abilities ?? []).toEqual([]);
      expect(d.activated).toBeDefined();
      expect(validateActivatedDef(d)).toEqual([]);
    },
  );

  it.each(ALL_ROWS.map((row) => [row.id, row] as const))('%s prints its slate name, cost and colours', (_id, row) => {
    const d = CARD_DB[row.id];
    expect(d.name).toBe(row.name);
    expect(d.cost?.generic).toBe(row.generic);
    expect(manaValue(d.cost)).toBe(row.generic + row.pips.length);
    const pips = Object.entries(d.cost?.pips ?? {})
      .flatMap(([color, count]) => color.repeat(count ?? 0))
      .sort()
      .join('');
    expect(pips).toBe([...row.pips].sort().join(''));
    expect(d.colors).toEqual(row.colors);
  });

  it.each(ALL_ROWS.map((row) => [row.id, row] as const))('%s generates its Duty rules line', (_id, row) => {
    expect(rulesText(CARD_DB[row.id])).toBe(row.text);
  });

  it('leaves no utility tapland anywhere in the catalog', () => {
    expect(ALL_CARDS.filter(isUtilityTapland)).toEqual([]);
  });

  it('returns all 27 to the common booster pool and the collectible pool', () => {
    const commons = new Set(packPool(CARD_DB, 'c'));
    const collectible = new Set(collectiblePool(ALL_CARDS).map((card) => card.id));
    for (const id of ALL_IDS) {
      expect(commons.has(id), `${id} missing from packPool c`).toBe(true);
      expect(collectible.has(id), `${id} missing from collectiblePool`).toBe(true);
    }
  });

  // Design rule 4 (docs/plan-land-economy.md section 3): two cards in one set
  // never share a Duty line. Across sets a line may repeat.
  it.each(SET_TABLES.map(([set]) => set))('%s gives every Duty card its own rules line', (set) => {
    const lines = ALL_CARDS
      .filter((card) => card.set === set && card.activated)
      .map((card) => rulesText(card));
    expect(new Set(lines).size, `${set} shares a Duty line`).toBe(lines.length);
  });
});

// ---------------------------------------------------------------------------
// Resolution: every distinct Duty shape on the slate, on the real card ids.
// ---------------------------------------------------------------------------

const DB: CardDb = { ...TEST_DB, ...CARD_DB };
const SOURCE = 10;
const MANA_IIDS = [90, 91, 92, 93];

function board(cardId: string, opts: {
  extra?: Partial<Permanent>[];
  lands?: number;
  deck?: string[];
  graveyard?: string[];
  oppGraveyard?: string[];
  step?: GameState['step'];
} = {}): Game {
  const lands = Array.from({ length: opts.lands ?? 0 }, (_, index) => ({
    iid: MANA_IIDS[index], cardId: 'forest', controller: 0 as const,
  }));
  const state = makeTestState({
    battlefield: [{ iid: SOURCE, cardId, controller: 0 }, ...lands, ...(opts.extra ?? [])],
    hands: [[], []],
    active: 0,
  });
  state.rulesRev = 4;
  state.step = opts.step ?? 'main1';
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 200;
  state.players[0].deck = opts.deck ?? Array.from({ length: 12 }, () => 'forest');
  state.players[1].deck = Array.from({ length: 12 }, () => 'forest');
  state.players[0].graveyard = opts.graveyard ?? [];
  state.players[1].graveyard = opts.oppGraveyard ?? [];
  return Game.restore(state, DB);
}

const ids = (zone: readonly unknown[]): string[] =>
  zone.map((entry) => cardIdOf(entry as Parameters<typeof cardIdOf>[0]));

function perm(game: Game, iid: number): Permanent {
  const found = game.instanceState.battlefield.find((p) => p.iid === iid);
  if (!found) throw new Error(`no permanent ${iid}`);
  return found;
}

describe('land economy: every Duty shape resolves', () => {
  it('Foresee 1 (Mist-Road Waymark) offers the look and bottoms the chosen card', () => {
    const game = board('cf-mist-road', { deck: ['land-plains', 'land-island', 'land-swamp'] });
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(game.awaiting).toMatchObject({ kind: 'foresee', player: 0 });
    game.submit(0, { type: 'foresee', bottomIndices: [0] });
    // The top of the deck is the LAST entry; bottoming the looked-at card puts
    // land-swamp under land-plains.
    expect(ids(game.instanceState.players[0].deck)).toEqual(['land-swamp', 'land-plains', 'land-island']);
    expect(perm(game, SOURCE).tapped).toBe(true);
  });

  it('gain life (Ring-Stone Moss) adds 1 life', () => {
    const game = board('cf-mossy-ring');
    const before = game.instanceState.players[0].life;
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(game.instanceState.players[0].life).toBe(before + 1);
  });

  it('Foresee then grind (Raven Stone) grinds the card the Foresee left on top', () => {
    const game = board('cf-raven-stone', { deck: ['land-plains', 'land-island', 'land-swamp'] });
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(game.awaiting).toMatchObject({ kind: 'foresee', player: 0 });
    // Bottom the card the Foresee looked at, so the grind takes the NEXT card.
    game.submit(0, { type: 'foresee', bottomIndices: [0] });
    expect(ids(game.instanceState.players[0].graveyard)).toEqual(['land-island']);
    expect(ids(game.instanceState.players[0].deck)).toEqual(['land-swamp', 'land-plains']);
  });

  it('grind self (Midnight Invitation) mills the top card', () => {
    const game = board('dt-midnight-road', { deck: ['land-plains', 'land-island'] });
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(ids(game.instanceState.players[0].graveyard)).toEqual(['land-island']);
    expect(ids(game.instanceState.players[0].deck)).toEqual(['land-plains']);
  });

  it("severGrave opponent (Chapel-Yard Rosary) severs the opponent's top grave card", () => {
    const game = board('gm-chapel-yard', { oppGraveyard: ['bear', 'giant'] });
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(ids(game.instanceState.players[1].graveyard)).toEqual(['bear']);
    expect(ids(game.instanceState.players[1].severed)).toEqual(['giant']);
  });

  it('damage to opponent (Banked Cinders) burns for 1', () => {
    const game = board('dt-hearth-cinders');
    const before = game.instanceState.players[1].life;
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(game.instanceState.players[1].life).toBe(before - 1);
  });

  it('tap an opposing creature (Lowland Fort Banner) taps the target and pays {2}', () => {
    const game = board('ac-lowland-fort', { lands: 2, extra: [{ iid: 20, cardId: 'bear', controller: 1 }] });
    game.submit(0, { type: 'activate', iid: SOURCE, targets: [{ kind: 'permanent', iid: 20 }] });
    expect(perm(game, 20).tapped).toBe(true);
    expect(perm(game, SOURCE).tapped).toBe(true);
    expect(MANA_IIDS.slice(0, 2).every((iid) => perm(game, iid).tapped)).toBe(true);
  });

  it('2 damage to a creature (Festival Rocket) kills a 2/2', () => {
    const game = board('gm-red-roof-village', { lands: 2, extra: [{ iid: 20, cardId: 'bear', controller: 1 }] });
    game.submit(0, { type: 'activate', iid: SOURCE, targets: [{ kind: 'permanent', iid: 20 }] });
    expect(game.instanceState.battlefield.some((p) => p.iid === 20)).toBe(false);
  });

  it('the drain (Moorlight Lantern) moves 2 life', () => {
    const game = board('gm-moor-path', { lands: 3 });
    const mine = game.instanceState.players[0].life;
    const theirs = game.instanceState.players[1].life;
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(game.instanceState.players[1].life).toBe(theirs - 2);
    expect(game.instanceState.players[0].life).toBe(mine + 2);
  });

  it('reclaim (Riverbend Waterwheel) returns a creature card from the graveyard to hand', () => {
    const game = board('dt-riverbend-trail', { lands: 3, graveyard: ['bear'] });
    game.submit(0, { type: 'activate', iid: SOURCE, targets: [{ kind: 'grave', player: 0, index: 0 }] });
    expect(ids(game.instanceState.players[0].graveyard)).toEqual([]);
    expect(ids(game.instanceState.players[0].hand)).toEqual(['bear']);
  });

  it('the boost (Nebula Beacon) gives +2/+2 and it ends at Sunset', () => {
    const game = board('sb-pale-nebula', { lands: 2, extra: [{ iid: 20, cardId: 'bear', controller: 0 }] });
    const base = getEffectiveStats(game.instanceState.battlefield, DB, 20);
    game.submit(0, { type: 'activate', iid: SOURCE, targets: [{ kind: 'permanent', iid: 20 }] });
    const boosted = getEffectiveStats(game.instanceState.battlefield, DB, 20);
    expect(boosted.attack).toBe(base.attack + 2);
    expect(boosted.defense).toBe(base.defense + 2);
    const turn = game.instanceState.turn;
    for (let guard = 0; guard < 80 && game.instanceState.turn === turn; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') break;
      game.submit(awaiting.player, botAction(game.legalActions(awaiting.player)));
    }
    expect(game.instanceState.turn).toBeGreaterThan(turn);
    const after = getEffectiveStats(game.instanceState.battlefield, DB, 20);
    expect([after.attack, after.defense]).toEqual([base.attack, base.defense]);
  });

  it('moveMark (Deepfield Array) moves one Mark between two creatures you control', () => {
    const game = board('sb-deepfield-lands', {
      lands: 1,
      extra: [
        { iid: 20, cardId: 'bear', controller: 0, plusOneCounters: 2 },
        { iid: 21, cardId: 'bear', controller: 0, plusOneCounters: 0 },
      ],
    });
    game.submit(0, {
      type: 'activate', iid: SOURCE,
      targets: [{ kind: 'permanent', iid: 20 }, { kind: 'permanent', iid: 21 }],
    });
    expect(perm(game, 20).plusOneCounters).toBe(1);
    expect(perm(game, 21).plusOneCounters).toBe(1);
  });

  it('removeMarks (Violet Landing Light) strips every Mark from a Marked creature', () => {
    const game = board('sb-darkside-landing', {
      extra: [{ iid: 20, cardId: 'bear', controller: 1, plusOneCounters: 3 }],
    });
    game.submit(0, { type: 'activate', iid: SOURCE, targets: [{ kind: 'permanent', iid: 20 }] });
    expect(perm(game, 20).plusOneCounters).toBe(0);
  });

  it('addCounters (Overcanopy Trellis) Marks a creature you control', () => {
    const game = board('sb-overcanopy', { lands: 1, extra: [{ iid: 20, cardId: 'bear', controller: 0 }] });
    game.submit(0, { type: 'activate', iid: SOURCE, targets: [{ kind: 'permanent', iid: 20 }] });
    expect(perm(game, 20).plusOneCounters).toBe(1);
  });

  it('draw (Crossing Beacon) draws a card for {3}', () => {
    const game = board('sb-interstellar-crossing', { lands: 3, deck: ['land-plains', 'land-island'] });
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(ids(game.instanceState.players[0].hand)).toEqual(['land-island']);
    expect(ids(game.instanceState.players[0].deck)).toEqual(['land-plains']);
  });

  it('Foresee 2 and Foresee 3 (Rooftop Spyglass, Mirror-Lake Glass) open the deeper look', () => {
    for (const [id, lands, n] of [['dt-desert-rooftop', 1, 2], ['ac-mirror-lake', 2, 3]] as const) {
      const game = board(id, { lands, deck: ['land-plains', 'land-island', 'land-swamp', 'land-forest'] });
      game.submit(0, { type: 'activate', iid: SOURCE });
      const awaiting = game.awaiting;
      expect(awaiting).toMatchObject({ kind: 'foresee', player: 0 });
      expect((awaiting as Extract<typeof awaiting, { kind: 'foresee' }>).cards).toHaveLength(n);
      game.submit(0, { type: 'foresee', bottomIndices: [] });
      expect(perm(game, SOURCE).tapped).toBe(true);
    }
  });

  it('gain 2 life (Glass Slipper) pays {1} and adds 2 life', () => {
    const game = board('dt-palace-steps', { lands: 1 });
    const before = game.instanceState.players[0].life;
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(game.instanceState.players[0].life).toBe(before + 2);
  });
});

// ---------------------------------------------------------------------------
// AI proof for the seven heavier rows, at all three difficulties.
// ---------------------------------------------------------------------------

type Difficulty = 'easy' | 'medium' | 'hard';
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

function brain(difficulty: Difficulty): AIPlayer {
  if (difficulty === 'easy') return new EasyAI(DB, 7, makePersonality({ easyNoise: 0 }));
  if (difficulty === 'medium') return new MediumAI(DB);
  return new HardAI(DB);
}

interface HeavyCase {
  id: string;
  name: string;
  lands: number;
  extra?: Partial<Permanent>[];
  graveyard?: string[];
}

const HEAVY_ROWS: HeavyCase[] = [
  { id: 'ac-mirror-lake', name: 'Mirror-Lake Glass', lands: 2 },
  { id: 'ac-lowland-fort', name: 'Lowland Fort Banner', lands: 2, extra: [{ iid: 20, cardId: 'bear', controller: 1 }] },
  { id: 'gm-red-roof-village', name: 'Festival Rocket', lands: 2, extra: [{ iid: 20, cardId: 'bear', controller: 1 }] },
  { id: 'gm-moor-path', name: 'Moorlight Lantern', lands: 3 },
  { id: 'dt-riverbend-trail', name: 'Riverbend Waterwheel', lands: 3, graveyard: ['bear'] },
  { id: 'sb-pale-nebula', name: 'Nebula Beacon', lands: 2, extra: [{ iid: 20, cardId: 'bear', controller: 0 }] },
  { id: 'sb-interstellar-crossing', name: 'Crossing Beacon', lands: 3 },
];

describe('land economy: the seven heavier rows are played by every brain', () => {
  it.each(
    HEAVY_ROWS.flatMap((row) => DIFFICULTIES.map((difficulty) => [row.name, difficulty, row] as const)),
  )('%s is activated by the %s brain in its Afternoon', (_name, difficulty, row) => {
    const game = board(row.id, {
      lands: row.lands, extra: row.extra, graveyard: row.graveyard, step: 'main2',
    });
    const legal = game.legalActions(0);
    const offered = legal.filter((action) => action.type === 'activate');
    expect(offered.length, `${row.id} offers no activation`).toBeGreaterThan(0);
    const view = game.viewFor(0);
    const policy = chooseActivate(view, DB, legal);
    expect(policy, `${row.id} policy declined`).not.toBeNull();
    expect(policy!.iid).toBe(SOURCE);
    expect(activateActionValue(view, DB, policy!)).toBeGreaterThan(0);
    const chosen = brain(difficulty).chooseAction(view, legal);
    expect(chosen, `${row.id} ${difficulty} chose ${chosen.type}`).toMatchObject({ type: 'activate', iid: SOURCE });
  });
});
