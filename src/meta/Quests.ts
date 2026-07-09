import { ECONOMY } from '../config/rules';
import type { GameEvent } from '../engine/events';
import { createRngState, rngInt } from '../engine/rng';
import type { CardDb, CardDef, Color, Rarity } from '../engine/types';
import { isType } from '../engine/types';
import type { DailyQuestSave, DailyState, SaveData } from './SaveManager';

const HUMAN = 0;
const AI = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DailyQuestDef {
  id: string;
  title: string;
  description: string;
  target: number;
  rewardGold: number;
  count: (events: readonly GameEvent[], db: CardDb) => number;
}

export interface DailyQuestStatus extends DailyQuestSave {
  title: string;
  description: string;
  complete: boolean;
}

export interface DailyStreakStatus {
  count: number;
  wonToday: boolean;
  nextCount: number;
  nextGold: number;
}

export interface DailyProgressResult {
  changed: boolean;
  completedQuestIds: string[];
}

export interface DailyClaimResult {
  ok: boolean;
  gold: number;
  reason?: 'already-claimed' | 'incomplete' | 'missing';
}

export interface DailyRerollResult {
  ok: boolean;
  reason?: 'claimed' | 'limit' | 'missing' | 'no-replacement';
}

export interface DailyStreakReward {
  advanced: boolean;
  count: number;
  gold: number;
}

function card(db: CardDb, cardId: string): CardDef | null {
  return db[cardId] ?? null;
}

function countGameEnded(events: readonly GameEvent[], winsOnly: boolean): number {
  return events.filter((e) => e.e === 'gameEnded' && (!winsOnly || e.winner === HUMAN)).length;
}

function countLandPlays(events: readonly GameEvent[]): number {
  return events.filter((e) => e.e === 'landPlayed' && e.player === HUMAN).length;
}

function countSpellCasts(
  events: readonly GameEvent[],
  db: CardDb,
  predicate: (d: CardDef) => boolean,
): number {
  let total = 0;
  for (const e of events) {
    if (e.e !== 'spellCast' || e.controller !== HUMAN) continue;
    const d = card(db, e.cardId);
    if (d && predicate(d)) total++;
  }
  return total;
}

function countDeaths(events: readonly GameEvent[], db: CardDb, owner: 0 | 1): number {
  let total = 0;
  for (const e of events) {
    if (e.e !== 'died' || e.owner !== owner) continue;
    const d = card(db, e.cardId);
    if (d && isType(d, 'creature')) total++;
  }
  return total;
}

function countLifeDelta(events: readonly GameEvent[], player: 0 | 1, sign: 'gain' | 'loss'): number {
  let total = 0;
  for (const e of events) {
    if (e.e !== 'lifeChanged' || e.player !== player) continue;
    if (sign === 'gain' && e.delta > 0) total += e.delta;
    if (sign === 'loss' && e.delta < 0) total += -e.delta;
  }
  return total;
}

function countTokens(events: readonly GameEvent[]): number {
  return events.filter((e) => e.e === 'tokenCreated' && e.perm.controller === HUMAN).length;
}

function countDiscarded(events: readonly GameEvent[], player: 0 | 1): number {
  return events.filter((e) => e.e === 'discarded' && e.player === player).length;
}

function countDraws(events: readonly GameEvent[], player: 0 | 1): number {
  return events.filter((e) => e.e === 'drew' && e.player === player).length;
}

function hasColor(color: Color): (d: CardDef) => boolean {
  return (d) => d.colors.includes(color);
}

function hasRarityAtLeast(...rarities: Rarity[]): (d: CardDef) => boolean {
  const allowed = new Set<Rarity>(rarities);
  return (d) => allowed.has(d.rarity);
}

export const DAILY_QUESTS: readonly DailyQuestDef[] = [
  {
    id: 'win-one',
    title: 'Blade Victor',
    description: 'Win 1 duel.',
    target: 1,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events) => countGameEnded(events, true),
  },
  {
    id: 'win-two',
    title: 'Winning Edge',
    description: 'Win 2 duels.',
    target: 2,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events) => countGameEnded(events, true),
  },
  {
    id: 'finish-two',
    title: 'Stay in the Fight',
    description: 'Finish 2 duels.',
    target: 2,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events) => countGameEnded(events, false),
  },
  {
    id: 'play-lands-5',
    title: 'Lay the Road',
    description: 'Play 5 lands.',
    target: 5,
    rewardGold: ECONOMY.dailyQuestGold,
    count: countLandPlays,
  },
  {
    id: 'play-lands-10',
    title: 'Kingdom Roads',
    description: 'Play 10 lands.',
    target: 10,
    rewardGold: ECONOMY.dailyQuestGold,
    count: countLandPlays,
  },
  {
    id: 'cast-creatures-5',
    title: 'Call the Vanguard',
    description: 'Cast 5 creatures.',
    target: 5,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, (d) => isType(d, 'creature')),
  },
  {
    id: 'cast-creatures-10',
    title: 'Raise an Army',
    description: 'Cast 10 creatures.',
    target: 10,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, (d) => isType(d, 'creature')),
  },
  {
    id: 'cast-charms-3',
    title: 'Charm Offensive',
    description: 'Cast 3 charms.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, (d) => isType(d, 'charm')),
  },
  {
    id: 'cast-rituals-3',
    title: 'Ritual Circuit',
    description: 'Cast 3 rituals.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, (d) => isType(d, 'ritual')),
  },
  {
    id: 'cast-tools-4',
    title: 'Hold the Field',
    description: 'Cast 4 artifacts or enchantments.',
    target: 4,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, (d) => isType(d, 'artifact') || isType(d, 'enchantment')),
  },
  {
    id: 'cast-white-3',
    title: 'Ivory Formation',
    description: 'Cast 3 white cards.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, hasColor('W')),
  },
  {
    id: 'cast-blue-3',
    title: 'Azure Stratagem',
    description: 'Cast 3 blue cards.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, hasColor('U')),
  },
  {
    id: 'cast-black-3',
    title: 'Onyx Bargain',
    description: 'Cast 3 black cards.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, hasColor('B')),
  },
  {
    id: 'cast-red-3',
    title: 'Crimson Push',
    description: 'Cast 3 red cards.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, hasColor('R')),
  },
  {
    id: 'cast-green-3',
    title: 'Verdant Advance',
    description: 'Cast 3 green cards.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, hasColor('G')),
  },
  {
    id: 'deal-damage-20',
    title: 'Press the Attack',
    description: 'Deal 20 damage to opponents.',
    target: 20,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events) => countLifeDelta(events, AI, 'loss'),
  },
  {
    id: 'deal-damage-35',
    title: 'No Quarter',
    description: 'Deal 35 damage to opponents.',
    target: 35,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events) => countLifeDelta(events, AI, 'loss'),
  },
  {
    id: 'gain-life-10',
    title: 'Second Wind',
    description: 'Gain 10 life.',
    target: 10,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events) => countLifeDelta(events, HUMAN, 'gain'),
  },
  {
    id: 'enemy-dies-3',
    title: 'Cut Down the Line',
    description: 'Destroy 3 enemy creatures.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countDeaths(events, db, AI),
  },
  {
    id: 'your-dies-3',
    title: 'Honor the Fallen',
    description: 'Have 3 of your creatures die.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countDeaths(events, db, HUMAN),
  },
  {
    id: 'tokens-4',
    title: 'Summon Extras',
    description: 'Create 4 tokens.',
    target: 4,
    rewardGold: ECONOMY.dailyQuestGold,
    count: countTokens,
  },
  {
    id: 'draw-12',
    title: 'Keep the Edge',
    description: 'Draw 12 cards.',
    target: 12,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events) => countDraws(events, HUMAN),
  },
  {
    id: 'discard-2',
    title: 'Break Their Plan',
    description: 'Make the opponent discard 2 cards.',
    target: 2,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events) => countDiscarded(events, AI),
  },
  {
    id: 'cast-rare-2',
    title: 'Rare Momentum',
    description: 'Cast 2 SR-or-better cards.',
    target: 2,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, hasRarityAtLeast('sr', 'ssr', 'ur')),
  },
  {
    id: 'cast-multicolor-3',
    title: 'Alliance Cast',
    description: 'Cast 3 multicolor cards.',
    target: 3,
    rewardGold: ECONOMY.dailyQuestGold,
    count: (events, db) => countSpellCasts(events, db, (d) => d.colors.length >= 2),
  },
];

const QUEST_BY_ID = new Map(DAILY_QUESTS.map((q) => [q.id, q]));

export function dayStringFromTimestamp(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

export function dailyQuestDef(id: string): DailyQuestDef | undefined {
  return QUEST_BY_ID.get(id);
}

export function rollDailyQuestIds(
  day: string,
  nonce = 0,
  count: number = ECONOMY.dailyQuestCount,
  exclude: readonly string[] = [],
): string[] {
  const blocked = new Set(exclude);
  const pool = DAILY_QUESTS.map((q) => q.id).filter((id) => !blocked.has(id));
  const rng = createRngState(hashString(`daily|${day}|${nonce}`));
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const idx = rngInt(rng, pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

function questSave(id: string): DailyQuestSave {
  const def = dailyQuestDef(id);
  if (!def) throw new Error(`Unknown daily quest id: ${id}`);
  return { id, progress: 0, target: def.target, rewardGold: def.rewardGold, claimed: false };
}

export function freshDailyState(day: string): DailyState {
  return {
    day,
    quests: rollDailyQuestIds(day).map(questSave),
    rerollsUsed: 0,
    streak: { count: 0, lastWinDay: null },
  };
}

function dayUtcMs(day: string | null): number | null {
  if (!day) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return Date.UTC(y, mo - 1, d);
}

function isYesterday(lastDay: string | null, today: string): boolean {
  const last = dayUtcMs(lastDay);
  const cur = dayUtcMs(today);
  return last !== null && cur !== null && cur - last === DAY_MS;
}

function normalizeStreak(daily: DailyState, today: string): boolean {
  const last = daily.streak.lastWinDay;
  if (last === today || isYesterday(last, today)) return false;
  if (daily.streak.count === 0 && last === null) return false;
  daily.streak = { count: 0, lastWinDay: null };
  return true;
}

function clampProgress(value: unknown, target: number): number {
  return Math.max(0, Math.min(target, Math.floor(typeof value === 'number' ? value : 0)));
}

function normalizeQuestList(daily: DailyState): boolean {
  let changed = false;
  const seen = new Set<string>();
  const quests: DailyQuestSave[] = [];
  for (const q of daily.quests) {
    const def = q ? dailyQuestDef(q.id) : undefined;
    if (!def || seen.has(q.id)) {
      changed = true;
      continue;
    }
    const next: DailyQuestSave = {
      id: q.id,
      progress: clampProgress(q.progress, def.target),
      target: def.target,
      rewardGold: def.rewardGold,
      claimed: Boolean(q.claimed),
    };
    if (
      next.progress !== q.progress ||
      next.target !== q.target ||
      next.rewardGold !== q.rewardGold ||
      next.claimed !== q.claimed
    ) {
      changed = true;
    }
    seen.add(next.id);
    quests.push(next);
    if (quests.length >= ECONOMY.dailyQuestCount) break;
  }

  if (quests.length !== daily.quests.length) changed = true;
  if (quests.length < ECONOMY.dailyQuestCount) {
    const replacements = rollDailyQuestIds(daily.day, 13, ECONOMY.dailyQuestCount - quests.length, [...seen]);
    for (const id of replacements) {
      seen.add(id);
      quests.push(questSave(id));
    }
    changed = true;
  }

  const rerollsUsed = Math.max(0, Math.min(ECONOMY.dailyRerollsPerDay, Math.floor(daily.rerollsUsed)));
  if (rerollsUsed !== daily.rerollsUsed) changed = true;
  if (changed) {
    daily.quests = quests;
    daily.rerollsUsed = rerollsUsed;
  }
  return changed;
}

export function ensureDailyState(save: SaveData, today: string): boolean {
  let changed = false;
  if (!save.daily) {
    save.daily = freshDailyState(today);
    changed = true;
  }
  if (save.daily.day !== today) {
    const streak = save.daily.streak;
    save.daily = { ...freshDailyState(today), streak };
    changed = true;
  }
  changed = normalizeStreak(save.daily, today) || changed;
  changed = normalizeQuestList(save.daily) || changed;
  return changed;
}

export function dailyQuestStatuses(save: SaveData, today: string): DailyQuestStatus[] {
  ensureDailyState(save, today);
  return save.daily.quests.map((q) => {
    const def = dailyQuestDef(q.id)!;
    return {
      ...q,
      title: def.title,
      description: def.description,
      complete: q.progress >= q.target,
    };
  });
}

export function dailyRerollsRemaining(save: SaveData, today: string): number {
  ensureDailyState(save, today);
  return Math.max(0, ECONOMY.dailyRerollsPerDay - save.daily.rerollsUsed);
}

export function streakRewardForCount(count: number): number {
  const idx = Math.max(0, Math.min(ECONOMY.dailyStreakGold.length - 1, count - 1));
  return ECONOMY.dailyStreakGold[idx];
}

export function dailyStreakStatus(save: SaveData, today: string): DailyStreakStatus {
  ensureDailyState(save, today);
  const streak = save.daily.streak;
  const wonToday = streak.lastWinDay === today;
  const nextCount = wonToday ? streak.count : isYesterday(streak.lastWinDay, today) ? streak.count + 1 : 1;
  return {
    count: streak.count,
    wonToday,
    nextCount,
    nextGold: wonToday ? 0 : streakRewardForCount(nextCount),
  };
}

export function applyDailyQuestProgress(
  save: SaveData,
  db: CardDb,
  events: readonly GameEvent[],
  today: string,
): DailyProgressResult {
  let changed = ensureDailyState(save, today);
  const completedQuestIds: string[] = [];
  if (events.length === 0) return { changed, completedQuestIds };

  for (const quest of save.daily.quests) {
    if (quest.claimed || quest.progress >= quest.target) continue;
    const def = dailyQuestDef(quest.id);
    if (!def) continue;
    const delta = def.count(events, db);
    if (delta <= 0) continue;
    const before = quest.progress;
    quest.progress = Math.min(quest.target, quest.progress + delta);
    if (quest.progress !== before) {
      changed = true;
      if (before < quest.target && quest.progress >= quest.target) completedQuestIds.push(quest.id);
    }
  }
  return { changed, completedQuestIds };
}

export function claimDailyQuest(save: SaveData, index: number, today: string): DailyClaimResult {
  ensureDailyState(save, today);
  const quest = save.daily.quests[index];
  if (!quest) return { ok: false, gold: 0, reason: 'missing' };
  if (quest.claimed) return { ok: false, gold: 0, reason: 'already-claimed' };
  if (quest.progress < quest.target) return { ok: false, gold: 0, reason: 'incomplete' };
  quest.claimed = true;
  save.gold += quest.rewardGold;
  return { ok: true, gold: quest.rewardGold };
}

export function rerollDailyQuest(save: SaveData, index: number, today: string): DailyRerollResult {
  ensureDailyState(save, today);
  const quest = save.daily.quests[index];
  if (!quest) return { ok: false, reason: 'missing' };
  if (quest.claimed) return { ok: false, reason: 'claimed' };
  if (save.daily.rerollsUsed >= ECONOMY.dailyRerollsPerDay) return { ok: false, reason: 'limit' };
  const exclude = save.daily.quests.map((q) => q.id);
  const replacement = rollDailyQuestIds(today, 101 + save.daily.rerollsUsed * 7 + index, 1, exclude)[0];
  if (!replacement) return { ok: false, reason: 'no-replacement' };
  save.daily.quests[index] = questSave(replacement);
  save.daily.rerollsUsed++;
  return { ok: true };
}

export function recordDailyWin(save: SaveData, today: string): DailyStreakReward {
  ensureDailyState(save, today);
  const streak = save.daily.streak;
  if (streak.lastWinDay === today) return { advanced: false, count: streak.count, gold: 0 };

  const count = isYesterday(streak.lastWinDay, today) ? streak.count + 1 : 1;
  const gold = streakRewardForCount(count);
  streak.count = count;
  streak.lastWinDay = today;
  save.gold += gold;
  return { advanced: true, count, gold };
}
