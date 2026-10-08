import { describe, expect, it } from 'vitest';
import { isType } from '../../src/engine/types';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { darlingFaceCardFor } from '../../src/meta/deckFace';
import type { ReplayLog } from '../../src/meta/Replay';
import { freshSave, type SaveData, type SavedDeck } from '../../src/meta/SaveManager';
import { duelArtIds, NextDuelArt, type DuelArtChooser } from '../../src/ui/duelArt';
import { makeStore, type Harness } from '../art/artStoreFakes';

/**
 * The duel's card art (1.9 lane D, S5b; docs/plan-art-streaming.md section 2):
 * the set a duel gates on and leases for its life must hold everything the
 * duel can draw, and the `soon` prefetch made when an opponent is chosen must
 * hand over to the duel's lease without fetching anything twice. The store is
 * the real one over the fakes in tests/art/artStoreFakes.ts.
 */

const starter = STARTER_DECKS[0];

function saveWith(deck: Partial<SavedDeck>, extra: Partial<SaveData> = {}): SaveData {
  const save = freshSave(0);
  save.decks = [
    {
      id: 'mine',
      name: 'Mine',
      cards: [...(starter.reserveCards ?? starter.cards)],
      heroCardId: null,
      landStyle: null,
      format: 'warchest',
      landReserve: [...(starter.landReserve ?? [])],
      ...deck,
    },
  ];
  save.activeDeckId = 'mine';
  return { ...save, ...extra };
}

function missingFrom(set: readonly string[], wanted: readonly string[]): string[] {
  const have = new Set(set);
  return [...new Set(wanted)].filter((id) => !have.has(id));
}

/** Every token id a card's rules can create, found by walking every card's definition. */
function createdTokenIds(): Set<string> {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (node.op === 'createToken' && typeof node.token === 'string') found.add(node.token);
    for (const child of Object.values(node)) walk(child);
  };
  for (const card of Object.values(CARD_DB)) walk(card);
  return found;
}

/** Non-land cards of exactly one colour. */
function monoColour(colour: string, n: number): string[] {
  return Object.values(CARD_DB)
    .filter((d) => !d.token && !isType(d, 'land') && d.colors.length === 1 && d.colors[0] === colour)
    .slice(0, n)
    .map((d) => d.id);
}

describe('duelArtIds: everything a duel can draw', () => {
  it('a Tower duel holds both seats in either reserve format, and every rung portrait the run recap draws', () => {
    const save = saveWith({});
    const mine = save.decks[0];
    const everyPortrait = AVATARS.map((avatar) => avatar.portraitCardId);
    for (const avatar of AVATARS) {
      const ids = duelArtIds({ opponentId: avatar.id, gauntletRung: 3 }, save, true);
      const wanted = [
        ...mine.cards,
        ...(mine.landReserve ?? []),
        ...avatar.reserveDeck,
        ...avatar.landReserve,
        ...avatar.darlingsDeck,
        avatar.darlingId,
        ...everyPortrait,
      ];
      expect(missingFrom(ids, wanted), avatar.id).toEqual([]);
    }
  });

  it('holds every token any card can create, so a token made mid-duel never waits on its art', () => {
    const tokens = createdTokenIds();
    expect(tokens.size).toBeGreaterThan(0);
    const save = saveWith({});
    const practice = duelArtIds({ opponentId: AVATARS[0].id }, save, true);
    const limited = duelArtIds(
      { deckOverride: monoColour('R', 25), oppDeckOverride: monoColour('U', 25), limited: {} },
      save,
      true,
    );
    expect(missingFrom(practice, [...tokens])).toEqual([]);
    expect(missingFrom(limited, [...tokens])).toEqual([]);
  });

  it('holds the portraits the HUD and the versus bumper draw: the Darling face, both hero picks, the avatar', () => {
    const darling = AVATARS[0].darlingId;
    const deckHero = starter.reserveCards![0];
    const accountHero = AVATARS[1].portraitCardId;
    const save = saveWith(
      { format: 'darlings', darlingId: darling, heroCardId: deckHero },
      { heroCardId: accountHero },
    );
    const avatar = AVATARS[2];
    const ids = duelArtIds({ opponentId: avatar.id }, save, true);
    const face = darlingFaceCardFor(save.decks[0], CARD_DB);
    expect(face).not.toBeNull();
    expect(missingFrom(ids, [face!, darling, deckHero, accountHero, avatar.portraitCardId])).toEqual([]);
  });

  it('a Limited duel with no stored Warchests holds the basics each seat is dealt', () => {
    const ids = duelArtIds(
      { deckOverride: monoColour('R', 25), oppDeckOverride: monoColour('U', 25), limited: {} },
      saveWith({ landReserve: null }),
      true,
    );
    expect(missingFrom(ids, ['land-mountain', 'land-island'])).toEqual([]);
  });

  it('a replay against an avatar this build no longer has still holds both recorded decks', () => {
    const replay = {
      decks: [monoColour('G', 20), monoColour('B', 20)],
      context: { opponentId: 'retired-avatar', gauntletRung: null },
      landReserves: [['land-forest'], ['land-swamp']],
    } as unknown as ReplayLog;
    let ids: string[] = [];
    expect(() => {
      ids = duelArtIds({ replay }, saveWith({}), true);
    }).not.toThrow();
    expect(missingFrom(ids, [...replay.decks[0], ...replay.decks[1], 'land-forest', 'land-swamp'])).toEqual([]);
  });

  it("holds the human deck's styled basic files, and not for a deck override, which draws plain basics", () => {
    const save = saveWith({ landStyle: { 'land-forest': 'ragnarok' } });
    expect(duelArtIds({ opponentId: AVATARS[0].id }, save, true)).toContain('land-forest--ragnarok');
    expect(duelArtIds({ deckOverride: monoColour('G', 25), limited: {} }, save, true)).not.toContain('land-forest--ragnarok');
  });
});

/** A chooser whose shutdown and end of step the test fires by hand. */
class FakeChooser implements DuelArtChooser {
  private gone = new Set<() => void>();
  private stepEnd: (() => void)[] = [];

  onGone(fn: () => void): () => void {
    this.gone.add(fn);
    return () => this.gone.delete(fn);
  }

  afterStep(fn: () => void): void {
    this.stepEnd.push(fn);
  }

  get listening(): number {
    return this.gone.size;
  }

  shutDown(): void {
    const fns = [...this.gone];
    this.gone.clear();
    for (const fn of fns) fn();
  }

  endStep(): void {
    for (const fn of this.stepEnd.splice(0)) fn();
  }
}

function abortedKeys(h: Harness): string[] {
  return h.source.reads.filter((read) => read.signal?.aborted).map((read) => read.key);
}

describe('NextDuelArt: the prefetch until the duel takes over', () => {
  it('asks at soon, so art a view shows now is fetched ahead of it', async () => {
    const h = makeStore({ maxInFlight: 1 });
    // A view asks first; the prefetch comes later, so at the view's own level
    // (newest first) it would jump ahead of the view's second key.
    const view = h.store.lease('view', ['a', 'c'], { priority: 'visible' });
    new NextDuelArt().choose(h.store, ['b'], new FakeChooser());
    h.source.finish('a');
    await h.tick();

    expect(h.source.keys).toEqual(['a', 'c']);
    view.release();
  });

  it("hands a prefetch in flight to the duel's lease without fetching anything twice", async () => {
    const h = makeStore();
    const next = new NextDuelArt();
    next.choose(h.store, ['a', 'b', 'c'], new FakeChooser());
    let duel = h.store.lease('placeholder', []);
    next.handOver(() => {
      duel = h.store.lease('scene:Duel', ['a', 'b', 'c'], { priority: 'now' });
    });
    for (const key of ['a', 'b', 'c']) h.source.finish(key);
    await h.tick();
    await duel.ready;

    expect(abortedKeys(h)).toEqual([]);
    expect(h.source.keys).toEqual(['a', 'b', 'c']);
    expect(['a', 'b', 'c'].every((id) => h.store.isResident(id))).toBe(true);
  });

  it('a new choice keeps the art both choices share in flight and drops the rest', () => {
    const h = makeStore();
    const next = new NextDuelArt();
    const chooser = new FakeChooser();
    next.choose(h.store, ['a', 'b', 'c'], chooser);
    next.choose(h.store, ['b', 'c', 'd'], chooser);

    expect(abortedKeys(h)).toEqual(['a']);
    expect(h.source.keys).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a chooser that shuts down keeps the prefetch until its step ends, so a duel created in that step fetches nothing twice', async () => {
    const h = makeStore();
    const next = new NextDuelArt();
    const chooser = new FakeChooser();
    next.choose(h.store, ['a', 'b'], chooser);
    // The picker's scene.start('Duel'): the picker shuts down, the duel is
    // created and leases its set, then the step ends.
    chooser.shutDown();
    const duel = h.store.lease('scene:Duel', ['a', 'b'], { priority: 'now' });
    chooser.endStep();
    h.source.finish('a');
    h.source.finish('b');
    await h.tick();
    await duel.ready;

    expect(abortedKeys(h)).toEqual([]);
    expect(h.source.keys).toEqual(['a', 'b']);
  });

  it('a chooser left for somewhere else drops its prefetch once the step ends', () => {
    const h = makeStore();
    const chooser = new FakeChooser();
    new NextDuelArt().choose(h.store, ['a', 'b'], chooser);
    chooser.shutDown();
    chooser.endStep();

    expect(abortedKeys(h)).toEqual(['a', 'b']);
    expect(h.store.stats().queued).toBe(0);
  });

  it('keeps one shutdown listener on the chooser however often the choice changes, and none once handed off', () => {
    const h = makeStore();
    const next = new NextDuelArt();
    const chooser = new FakeChooser();
    for (const ids of [['a'], ['b'], ['c']]) next.choose(h.store, ids, chooser);
    expect(chooser.listening).toBe(1);
    next.handOver(() => {});
    expect(chooser.listening).toBe(0);
  });
});
