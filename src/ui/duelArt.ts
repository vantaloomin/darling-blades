import type Phaser from 'phaser';
import { landStyleArtKey } from '../art/ArtResolver';
import { liveArtStore } from '../art/artLoader';
import type { ArtRequestOptions } from '../art/artStore';
import { FEATURES } from '../config/features';
import { CARD_DB } from '../data/catalog';
import { draftPersonaById } from '../data/draftPersonas';
import { AVATARS, avatarById, type Avatar } from '../data/opponents';
import { STARTER_DECKS } from '../data/starterDecks';
import { TUTORIAL_OPPONENT_PORTRAIT } from '../data/tutorial';
import { darlingFaceCardFor, faceCardFor } from '../meta/deckFace';
import { avatarReserveSide, buildAiLandReserve } from '../meta/duelSetup';
import { limitedLandReserve } from '../meta/Limited';
import type { ReplayLog } from '../meta/Replay';
import type { SaveData } from '../meta/SaveManager';
import { Services } from '../meta/services';
import { activeVisibleSavedDeck } from './deckBuilderHelpers';

/**
 * The duel's card art (1.9 lane D, S5b; docs/plan-art-streaming.md section 2,
 * the Duel row): which art a duel can draw, and the `soon` prefetch of that
 * set made as soon as its opponent is chosen.
 *
 * `DuelScene` gates on `duelArtIds` at `create`, which leases the set for the
 * duel's life (`gateOnArt`, released at SHUTDOWN). Between Tower rungs the
 * scene restarts, and the next rung's lease is taken before anything can evict
 * what the two rungs share: Phaser's `scene.restart` queues the stop and the
 * start as one scene-manager step (`SceneManager.processQueue`, before any
 * scene updates), and the art store evicts only from the loader scene's
 * update, after it. The 2 s release grace covers it as well.
 *
 * Phaser is imported for its types only (the event names are spelled out), so
 * the set and the prefetch rule run headless in tests.
 */

/**
 * The launch data the set reads: `DuelSceneData`'s art-bearing fields. A
 * picker passes only what it knows (`opponentId`, and `gauntletRung` in the
 * Tower).
 */
export interface DuelArtLaunch {
  opponentId?: string;
  gauntletRung?: number;
  deckOverride?: string[];
  oppDeckOverride?: string[];
  landReserveOverride?: [string[], string[]];
  tutorial?: boolean;
  limited?: { opponentPersonaId?: string } | null;
  replay?: ReplayLog;
}

/**
 * Every token a board can make (28 today). The set passes all of them rather
 * than walking each deck's effects for `createToken`: the list is small, and
 * a token whose art has not arrived would otherwise pop in over a stand-in.
 */
const TOKEN_CARD_IDS: readonly string[] = Object.values(CARD_DB)
  .filter((d) => d.token === true)
  .map((d) => d.id);

/** An avatar by id, or null for one this build no longer has (an old replay's). */
function knownAvatar(id: string): Avatar | null {
  try {
    return avatarById(id);
  } catch {
    return null;
  }
}

/**
 * Every card the duel launched with `data` can draw, derived the way
 * `DuelScene.build` derives the duel: both seats' decks and Warchests, both
 * Darlings, the portrait and hero faces, every token the board can make, the
 * styled basic-land files the human's deck asked for, and in the Tower every
 * rung's portrait (the run recap's ladder).
 *
 * A coarse superset is fine and a miss is survivable (`ArtResolver.getArt`
 * falls back to the loading stand-in, and the view holding it redraws when the
 * art lands), so this takes the union of the candidates instead of re-running
 * the whole avatar and format resolution.
 */
export function duelArtIds(data: DuelArtLaunch, save: SaveData, reserveFormats: boolean): string[] {
  const replay = data.replay ?? null;
  const myDeckEntry = activeVisibleSavedDeck(save.decks, save.activeDeckId, reserveFormats);
  const myDeck = replay?.decks[0] ?? data.deckOverride ?? myDeckEntry?.cards ?? STARTER_DECKS[0].cards;
  const opponentId = replay?.context.opponentId ?? data.opponentId ?? null;
  const opponent = opponentId !== null ? knownAvatar(opponentId) : null;
  const ids: string[] = [...myDeck, ...TOKEN_CARD_IDS];

  // Seat 1: a recorded deck, an override, or the avatar's own list. Both
  // reserve variants go in: which one the duel fields depends on the saved
  // deck's format, and an avatar deck is ~70 files either way.
  if (replay) ids.push(...replay.decks[1]);
  if (data.oppDeckOverride) ids.push(...data.oppDeckOverride);
  if (opponent) {
    ids.push(...opponent.deck, opponent.portraitCardId);
    for (const format of ['warchest', 'darlings'] as const) {
      const side = avatarReserveSide(opponent, format, myDeck, myDeckEntry?.darlingId ?? null, CARD_DB);
      ids.push(...side.deck, ...side.reserve);
      if (side.darlingId) ids.push(side.darlingId);
    }
  } else if (!replay && !data.oppDeckOverride) {
    // No avatar: a reserve-format duel mirrors the human's deck behind a
    // Warchest of its basics; the retired classic path fields the other
    // starter deck.
    ids.push(...buildAiLandReserve(myDeck, CARD_DB));
    ids.push(...(STARTER_DECKS.find((d) => d.id !== save.activeDeckId)?.cards ?? STARTER_DECKS[1].cards));
  }

  // Both Warchests.
  for (const reserve of replay?.landReserves ?? []) ids.push(...reserve);
  for (const reserve of data.landReserveOverride ?? []) ids.push(...reserve);
  if (Array.isArray(myDeckEntry?.landReserve)) ids.push(...myDeckEntry.landReserve);
  if (!replay && !data.landReserveOverride) {
    // A Limited run saved before its Warchests were stored gets both built at
    // launch: the human's from the drafted deck, the opponent's from theirs.
    if (data.limited) ids.push(...limitedLandReserve(CARD_DB, myDeck));
    if (data.oppDeckOverride) ids.push(...buildAiLandReserve(data.oppDeckOverride, CARD_DB));
  }

  // Darlings, portraits and hero faces.
  for (const darling of replay?.darlings ?? []) if (darling) ids.push(darling);
  if (myDeckEntry?.darlingId) ids.push(myDeckEntry.darlingId);
  if (myDeckEntry?.heroCardId) ids.push(myDeckEntry.heroCardId);
  if (save.heroCardId) ids.push(save.heroCardId);
  if (myDeckEntry?.format === 'darlings') {
    const face = darlingFaceCardFor({ ...myDeckEntry, cards: myDeck }, CARD_DB);
    if (face) ids.push(face);
  }
  const myFace = faceCardFor(myDeck, CARD_DB);
  if (myFace) ids.push(myFace);
  const persona = data.limited?.opponentPersonaId ? draftPersonaById(data.limited.opponentPersonaId) : null;
  if (persona) ids.push(persona.portraitCardId);
  if (data.tutorial) ids.push(TUTORIAL_OPPONENT_PORTRAIT);
  // The Tower's run recap draws every rung's portrait over the finished duel.
  // The Tower screen gates on the same set, so these carry over from it.
  if (!replay && data.gauntletRung != null) ids.push(...AVATARS.map((avatar) => avatar.portraitCardId));

  // Styled basic-land art files are their own manifest keys, not card ids.
  const landStyle = !replay && data.deckOverride === undefined ? myDeckEntry?.landStyle : null;
  if (landStyle) {
    for (const [basicId, style] of Object.entries(landStyle)) {
      if (style) ids.push(landStyleArtKey(basicId, style));
    }
  }
  return ids;
}

/** What the prefetch needs of the art store. */
export interface DuelArtPrefetchStore {
  prefetch(ids: Iterable<string>, options: ArtRequestOptions): () => void;
}

/** The scene that chose the opponent, as the prefetch sees it. */
export interface DuelArtChooser {
  /** Call `fn` once when the chooser goes away (its scene's SHUTDOWN); returns an unsubscribe. */
  onGone(fn: () => void): () => void;
  /** Call `fn` once after the current game step (Phaser's POST_STEP). */
  afterStep(fn: () => void): void;
}

interface Chosen {
  cancel: () => void;
  stopWatching: () => void;
}

/**
 * The next duel's set, prefetched at `soon` (unpinned) from the moment its
 * opponent is chosen until the duel's own lease takes it over. One at a time:
 * a new choice replaces the last.
 *
 * Every hand-over keeps a request alive for the keys both sides want, so
 * nothing in flight is aborted and fetched again: a new choice is requested
 * before the old one is dropped, the duel drops the prefetch only once its
 * lease is taken (`handOver`), and a chooser that goes away drops it only after the step in
 * which it went, because a duel it started is created in that same step.
 */
export class NextDuelArt {
  private current: Chosen | null = null;

  choose(store: DuelArtPrefetchStore, ids: Iterable<string>, chooser: DuelArtChooser): void {
    const chosen: Chosen = { cancel: store.prefetch(ids, { priority: 'soon' }), stopWatching: () => {} };
    chosen.stopWatching = chooser.onGone(() => chooser.afterStep(() => this.drop(chosen)));
    const previous = this.current;
    this.current = chosen;
    if (previous !== null) this.drop(previous);
  }

  /**
   * The duel starts: `takeLease` takes its lease (the art gate), and then the
   * prefetch, its job done, is dropped. In that order, so a key the prefetch
   * has in flight always has a holder and is never fetched twice.
   */
  handOver(takeLease: () => void): void {
    try {
      takeLease();
    } finally {
      if (this.current !== null) this.drop(this.current);
    }
  }

  private drop(chosen: Chosen): void {
    chosen.stopWatching();
    chosen.cancel();
    if (this.current === chosen) this.current = null;
  }
}

/** The game's one next-duel prefetch. */
export const nextDuelArt = new NextDuelArt();

/**
 * Phaser's event names: equal to `Phaser.Scenes.Events.SHUTDOWN` (the constant
 * `artGate.ts` uses) and `Phaser.Core.Events.POST_STEP`, kept as literals so
 * this module imports nothing from Phaser at runtime.
 */
const SCENE_SHUTDOWN = 'shutdown';
const GAME_POST_STEP = 'poststep';

function sceneChooser(scene: Phaser.Scene): DuelArtChooser {
  return {
    onGone: (fn) => {
      scene.events.once(SCENE_SHUTDOWN, fn);
      return () => {
        scene.events.off(SCENE_SHUTDOWN, fn);
      };
    },
    afterStep: (fn) => {
      scene.game.events.once(GAME_POST_STEP, fn);
    },
  };
}

/**
 * An opponent was chosen on `scene` (the Tower, Practice, the Tower reward's
 * next foe): prefetch the duel `data` would launch at `soon`. A no-op while
 * art streams through the 1.8 queue, which loads everything anyway.
 */
export function prefetchDuelArt(scene: Phaser.Scene, data: DuelArtLaunch): void {
  const store = liveArtStore();
  if (store === null) return;
  nextDuelArt.choose(store, duelArtIds(data, Services.save.data, FEATURES.reserveFormats), sceneChooser(scene));
}
