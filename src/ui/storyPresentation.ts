/**
 * Story Mode run screens: player copy and view-state helpers (Phaser-free).
 * Character names, colours, boon names and gold amounts come from data; this
 * module only puts them into sentences. House copy rules: plain, short, no
 * em-dashes, no other game's terms (the boon is the "opening boon").
 */

import type { Color } from '../engine/types';
import { STORY_STOP_NAMES, STORY_STOP_ORDER, STORY_STOP_SUMMARY } from '../data/glossary';
import type { StoryCharacter, StoryNodeKind } from '../data/story/types';
import type { StoryUnlockProgress } from '../meta/story/storyFlow';
import { RUN_COUNT_FIGHTS, type StoryRun } from '../meta/story/storyState';

const COLOUR_WORDS: Readonly<Record<Color, string>> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

/** "White and Red", from the character's colours. */
export function colourWords(colors: readonly Color[]): string {
  const words = colors.map((c) => COLOUR_WORDS[c]);
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** The name before the epithet: "Guan Yu" from "Guan Yu, Saint of War". */
export function shortName(character: Pick<StoryCharacter, 'name'>): string {
  return character.name.split(',')[0].trim();
}

/** A stop kind's name (the copy lives with the Glossary's Story Map tab). */
export const NODE_KIND_LABEL: Readonly<Record<StoryNodeKind, string>> = STORY_STOP_NAMES;

/** What a node offers, in one line, for the map's detail panel and the map key (the opponent is named above it). */
export function nodeSummary(kind: StoryNodeKind): string {
  return STORY_STOP_SUMMARY[kind];
}

/** The map key's rows, in reading order: each stop kind's name and what it does. */
export function mapKeyRows(): { kind: StoryNodeKind; name: string; summary: string }[] {
  return STORY_STOP_ORDER.map((kind) => ({ kind, name: STORY_STOP_NAMES[kind], summary: STORY_STOP_SUMMARY[kind] }));
}

export const MAP_KEY_TITLE = 'Map Key';
export const MAP_KEY_NOTE = 'Stops marked Next are where you can go now. Hover or tap any stop to read it in the side panel.';
export const MAP_KEY_CLOSE = 'Got It';

/**
 * Where a stop the player is only looking at (hovered, or tapped off the
 * route) stands, ahead of its summary in the map's panel. Next stops need no
 * line: they are the ones to choose.
 */
export function mapStopStanding(current: boolean, next: boolean, face: 'live' | 'pressed' | 'locked'): string {
  if (current) return 'You are here.';
  if (next) return '';
  if (face === 'pressed') return 'Already visited.';
  if (face === 'locked') return 'Out of reach on this run.';
  return 'Further along the road.';
}

/** The map's main action for a chosen node. */
export function nodeActionLabel(kind: StoryNodeKind): string {
  switch (kind) {
    case 'fight':
    case 'elite':
    case 'boss': return 'Fight';
    case 'event': return 'Go';
    case 'shop': return 'Enter Shop';
    case 'rest': return 'Rest Here';
  }
}

/**
 * A locked heroine's unlock condition (R4, R10), in plain words, with the
 * progress that counts: the previous heroine's wins and counted runs (R9: a
 * run counts once it has three fights). Unlocked heroines get their record.
 */
export function unlockLines(p: StoryUnlockProgress): { condition: string; progress: string } {
  if (p.unlocked || !p.predecessor) {
    return { condition: '', progress: '' };
  }
  const who = shortName(p.predecessor);
  const clears = p.winsNeeded === 1 ? `Clear Act 1 with ${who}` : `Clear Act 1 ${p.winsNeeded} times with ${who}`;
  const runs = `${p.runsNeeded} of her runs reach ${RUN_COUNT_FIGHTS} fights`;
  return {
    condition: `${clears}, or let ${runs}.`,
    progress: `${p.runs} of ${p.runsNeeded} runs`,
  };
}

/** An open heroine's record line: Act 1 clears and counted runs. */
export function recordLine(wins: number, runs: number): string {
  return `Act 1 clears ${wins} · Runs counted ${runs}`;
}

/** "Act 1", or "Loop 3" once the run has gone on into endless. */
export function stageLabel(run: Pick<StoryRun, 'phase' | 'act' | 'endlessLoop'>): string {
  return run.phase === 'endless' ? `Loop ${run.endlessLoop}` : `Act ${run.act}`;
}

/** "3 loops cleared". */
export function loopsCleared(n: number): string {
  return `${n} ${n === 1 ? 'loop' : 'loops'} cleared`;
}

/** A heroine's endless record (E4): the deepest loop she has cleared. */
export function endlessBestLine(best: number): string {
  return best > 0 ? `Best run: ${loopsCleared(best)}` : 'Best run: no loops cleared yet';
}

/** Today's daily record (E6: the best of the day's tries). */
export function dailyBestLine(best: number): string {
  return best > 0 ? `Today's daily: ${loopsCleared(best)}` : "Today's daily: no loops cleared yet";
}

/** Character select's two modes: an Act 1 run, or endless (open once any heroine has cleared Act 1). */
export type StorySelectMode = 'act' | 'endless';

export const STORY_SELECT_MODES: readonly { mode: StorySelectMode; label: string }[] = [
  { mode: 'act', label: 'Act 1' },
  { mode: 'endless', label: 'Endless' },
];

/** Endless's top bar line (N-38). */
export const ENDLESS_SUBTITLE = 'Short maps and stronger claimants, until a loss';

/** The endless screen's seed heading and what it means (E5, E6). */
export function endlessSeedCopy(daily: boolean, dateKey: string): { heading: string; note: string } {
  if (!daily) return { heading: 'Random seed', note: 'New maps and opponents every run.' };
  const [, m, d] = dateKey.split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] ?? '';
  return {
    heading: `Today's seed · ${month} ${d}`,
    note: 'Everyone who plays today gets the same maps and opponents. Play as many times as you like; your best run counts.',
  };
}

/** What an endless run from the menu starts with (E3) and what it never pays (E4). */
export function endlessStartNote(picks: number, gold: number): string {
  return `You start with the starter deck, ${picks} card picks and ${gold} run gold. You don't keep a card at the end of an endless run.`;
}

/** The act-clear summary's offer to go on (P9). */
export const ENDLESS_GO_ON_NOTE = 'Or continue into endless: short maps, each ending at a claimant, until you lose a duel. Your run deck and gold carry over.';

/**
 * A loop's title card (E7): the loop and its claimant, plus what she starts
 * the duel with once the endless levers apply (E2).
 */
export function loopTitleCard(loop: number, claimant: string, holdsMandate: boolean, lifeBonus: number): { title: string; lines: string[] } {
  // "Brunhild, the Last Valkyrie, holds": a name with an epithet closes it with a comma.
  const lines = [`${claimant}${claimant.includes(',') ? ',' : ''} holds the Mandate.`];
  if (holdsMandate) {
    lines.push(lifeBonus > 0
      ? `She starts the duel holding it, with ${lifeBonus} extra life.`
      : 'She starts the duel holding it.');
  }
  return { title: `Loop ${loop}`, lines };
}

/** The standing note under Abandon, then the armed consequence (R9). */
export function abandonNote(run: Pick<StoryRun, 'fightsPlayed'>, armed: boolean): string {
  const counts = run.fightsPlayed >= RUN_COUNT_FIGHTS;
  if (!armed) {
    return counts
      ? 'This run counts toward unlocks, even if you abandon it.'
      : `A run counts toward unlocks once it has ${RUN_COUNT_FIGHTS} fights, even if you abandon it.`;
  }
  if (counts) {
    return `Abandoning ends this run and its run deck. It has reached ${RUN_COUNT_FIGHTS} fights, so it still counts toward unlocks.`;
  }
  return `Abandoning ends this run and its run deck. It has ${run.fightsPlayed} of ${RUN_COUNT_FIGHTS} fights, so it will not count.`;
}

/** "1 card" / "31 cards". */
export function cardCount(n: number): string {
  return `${n} ${n === 1 ? 'card' : 'cards'}`;
}

/** Fold a run deck into one entry per card id, in first-seen order, with copy counts. */
export function deckEntries(deck: readonly string[]): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count }));
}

/**
 * The shop cart: which offers can still be added. An offer is addable when it
 * is in the cart already (to take it out) or its price fits the gold left
 * after the cart.
 */
export function shopCartState(
  gold: number,
  stock: readonly { cardId: string; price: number }[],
  cart: readonly string[],
): { spent: number; left: number; addable: Set<string> } {
  const spent = stock.filter((o) => cart.includes(o.cardId)).reduce((sum, o) => sum + o.price, 0);
  const left = gold - spent;
  const addable = new Set(stock.filter((o) => cart.includes(o.cardId) || o.price <= left).map((o) => o.cardId));
  return { spent, left, addable };
}

/**
 * Toggle `id` in a multi-pick of at most `limit` copies from a run deck,
 * where `picked` is a list of card ids (a card may appear as often as the
 * deck holds it). A new card on a full pick drops the oldest entry.
 */
export function togglePick(picked: readonly string[], id: string, limit: number, deck: readonly string[]): string[] {
  const owned = deck.filter((c) => c === id).length;
  const have = picked.filter((c) => c === id).length;
  // A picked card takes another copy while the deck has one and there is room;
  // otherwise the tap clears it, so taps cycle 0, 1, (2,) 0.
  if (have > 0 && (have >= owned || picked.length >= limit)) return picked.filter((c) => c !== id);
  if (have >= owned) return [...picked];
  const next = [...picked, id];
  return next.length > limit ? next.slice(next.length - limit) : next;
}
