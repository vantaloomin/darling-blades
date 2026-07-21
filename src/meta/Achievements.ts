import type { CardDb, CardDef } from '../engine/types';
import { collectionCompletion, collectiblePool, type CollectionCompletionSummary } from './collectionFilter';
import { ownedCount, ownedVariants } from './Collection';
import { LIMITED_MATCHES } from './Limited';
import type { SaveData } from './SaveManager';
import { isPlainVariant, parseVariantKey } from './variants';

export type AchievementBucket = 'collection' | 'variants' | 'theme' | 'mastery' | 'economy';

export interface AchievementReward {
  gold: number;
}

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementDef {
  id: string;
  bucket: AchievementBucket;
  title: string;
  description: string;
  reward: AchievementReward;
  progress: (save: SaveData, db: CardDb, completion: CollectionCompletionSummary) => AchievementProgress;
}

export interface AchievementStatus {
  def: AchievementDef;
  current: number;
  target: number;
  percent: number;
  unlocked: boolean;
  claimed: boolean;
}

export interface ClaimResult {
  ok: boolean;
  gold: number;
  reason?: 'unknown' | 'locked' | 'claimed';
}

const pctTarget = (completion: CollectionCompletionSummary, fraction: number): number =>
  Math.max(1, Math.ceil(completion.total * fraction));

const ownedPct = (fraction: number): AchievementDef['progress'] => (_save, _db, completion) => ({
  current: completion.owned,
  target: pctTarget(completion, fraction),
});

const colorComplete = (color: 'W' | 'U' | 'B' | 'R' | 'G'): AchievementDef['progress'] => (
  _save,
  _db,
  completion,
) => {
  const row = completion.byColor.find((entry) => entry.key === color);
  return { current: row?.owned ?? 0, target: Math.max(1, row?.total ?? 0) };
};

const ROTK_LEADERS = ['tk-wei-caocao', 'tk-shu-liubei', 'tk-wu-sunquan'] as const;
const GREEK_OLYMPIAN_COURT = [
  'gk-athena',
  'gk-ares',
  'gk-zeus',
  'gk-hera',
  'gk-aphrodite',
  'gk-persephone',
  'gk-hades',
  'gk-poseidon',
  'gk-gaia',
] as const;
const BEASTKIN_PACK_COUNCIL = ['bk-packmother', 'bk-kitsune-matriarch', 'bk-wolfqueen'] as const;
const RAGNAROK_TWILIGHT_COURT = [
  'rg-hel',
  'rg-freya',
  'rg-fenrir',
  'rg-brunhild',
  'rg-norns',
  'rg-angrboda',
  'rg-skadi',
  'rg-idun',
] as const;
const CELTIC_FAE_COURT_SOVEREIGNS = [
  'cf-morrigan-black-wing',
  'cf-titania-silver-court',
  'cf-aine-sunlit-bargain',
  'cf-nimue-before-the-lake',
] as const;
const ARTHURIAN_ROUND_TABLE = [
  'ac-artoria-once-future',
  'ac-lancelot-moonlit-shame',
  'ac-gawain-noonblade',
  'ac-percival-clear-heart',
  'ac-galahad-silver-oath',
] as const;
const ARTHURIAN_CROWN_JEWELS = [
  'ac-artoria-once-future',
  'ac-morgan-thorn-crown',
  'ac-nimue-lake-sovereign',
  'ac-grail-radiant-secret',
] as const;
const GOTHIC_MONSTERS_HEADLINERS = [
  'gm-carmilla-crimson-host',
  'gm-bride-storm-crowned',
  'gm-luna-wolf-matriarch',
  'gm-lenore-velvet-saint',
] as const;

function themeIds(ids: readonly string[], db: CardDb): string[] {
  return ids.filter((id) => Boolean(db[id]));
}

function themeCards(db: CardDb, predicate: (card: CardDef) => boolean): CardDef[] {
  return collectiblePool(Object.values(db)).filter(predicate);
}

function ownedThemeCount(save: SaveData, ids: readonly string[]): number {
  return ids.filter((id) => ownedCount(save, id) > 0).length;
}

function themeProgress(save: SaveData, ids: readonly string[], db: CardDb): AchievementProgress {
  const scoped = themeIds(ids, db);
  return { current: ownedThemeCount(save, scoped), target: Math.max(1, scoped.length) };
}

function themeVariantCount(
  save: SaveData,
  ids: readonly string[],
  predicate: (variant: ReturnType<typeof parseVariantKey>) => boolean,
): number {
  let count = 0;
  for (const id of ids) {
    const hasVariant = Object.entries(ownedVariants(save, id)).some(([key, copies]) => copies > 0 && predicate(parseVariantKey(key)));
    if (hasVariant) count++;
  }
  return count;
}

function themeVariantProgress(
  save: SaveData,
  ids: readonly string[],
  db: CardDb,
  predicate: (variant: ReturnType<typeof parseVariantKey>) => boolean,
): AchievementProgress {
  const scoped = themeIds(ids, db);
  return { current: themeVariantCount(save, scoped, predicate), target: Math.max(1, scoped.length) };
}

function themedCollectionProgress(
  save: SaveData,
  db: CardDb,
  predicate: (card: CardDef) => boolean,
  fraction = 1,
): AchievementProgress {
  const ids = themeCards(db, predicate).map((card) => card.id);
  return {
    current: ownedThemeCount(save, ids),
    target: Math.max(1, Math.ceil(ids.length * fraction)),
  };
}

const isSpecialVariant = (variant: ReturnType<typeof parseVariantKey>): boolean => !isPlainVariant(variant);
const isRainbowBorder = (variant: ReturnType<typeof parseVariantKey>): boolean => variant.frame === 'rainbow';
const isRagnarok = (card: CardDef): boolean => card.set === 'ragnarok';
const isCelticFae = (card: CardDef): boolean => card.set === 'celtic-fae';
const isArthurianCourt = (card: CardDef): boolean => card.set === 'arthurian-court';
const isGothicMonsters = (card: CardDef): boolean => card.set === 'gothic-monsters';

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'collection-25',
    bucket: 'collection',
    title: 'Binder Started',
    description: 'Collect 25% of the card pool.',
    reward: { gold: 100 },
    progress: ownedPct(0.25),
  },
  {
    id: 'collection-50',
    bucket: 'collection',
    title: 'Half The Armory',
    description: 'Collect 50% of the card pool.',
    reward: { gold: 200 },
    progress: ownedPct(0.5),
  },
  {
    id: 'collection-75',
    bucket: 'collection',
    title: 'Deep Binder',
    description: 'Collect 75% of the card pool.',
    reward: { gold: 350 },
    progress: ownedPct(0.75),
  },
  {
    id: 'collection-100',
    bucket: 'collection',
    title: 'Complete Gallery',
    description: 'Collect every card in the pool.',
    reward: { gold: 750 },
    progress: ownedPct(1),
  },
  {
    id: 'complete-white',
    bucket: 'collection',
    title: 'White Gallery',
    description: 'Collect every white card.',
    reward: { gold: 200 },
    progress: colorComplete('W'),
  },
  {
    id: 'complete-blue',
    bucket: 'collection',
    title: 'Blue Gallery',
    description: 'Collect every blue card.',
    reward: { gold: 200 },
    progress: colorComplete('U'),
  },
  {
    id: 'complete-black',
    bucket: 'collection',
    title: 'Black Gallery',
    description: 'Collect every black card.',
    reward: { gold: 200 },
    progress: colorComplete('B'),
  },
  {
    id: 'complete-red',
    bucket: 'collection',
    title: 'Red Gallery',
    description: 'Collect every red card.',
    reward: { gold: 200 },
    progress: colorComplete('R'),
  },
  {
    id: 'complete-green',
    bucket: 'collection',
    title: 'Green Gallery',
    description: 'Collect every green card.',
    reward: { gold: 200 },
    progress: colorComplete('G'),
  },
  {
    id: 'variant-first-special',
    bucket: 'variants',
    title: 'First Shine',
    description: 'Own any special frame or holo variant.',
    reward: { gold: 75 },
    progress: (_save, _db, completion) => ({ current: completion.variants.specialCards, target: 1 }),
  },
  {
    id: 'variant-10-special',
    bucket: 'variants',
    title: 'Variant Hunter',
    description: 'Own 10 distinct special card variants.',
    reward: { gold: 150 },
    progress: (_save, _db, completion) => ({ current: completion.variants.specialVariants, target: 10 }),
  },
  {
    id: 'variant-black-frame',
    bucket: 'variants',
    title: 'Black Frame Pull',
    description: 'Own a black-frame card.',
    reward: { gold: 300 },
    progress: (_save, _db, completion) => ({ current: completion.variants.blackFrameCards, target: 1 }),
  },
  {
    id: 'variant-void-holo',
    bucket: 'variants',
    title: 'Void Holo Pull',
    description: 'Own a void-holo card.',
    reward: { gold: 300 },
    progress: (_save, _db, completion) => ({ current: completion.variants.voidHoloCards, target: 1 }),
  },
  {
    id: 'theme-rotk-three-lords',
    bucket: 'theme',
    title: 'Three Lords Convened',
    description: 'Own Cao Cao, Liu Bei, and Sun Quan.',
    reward: { gold: 250 },
    progress: (save, db) => themeProgress(save, ROTK_LEADERS, db),
  },
  {
    id: 'theme-rotk-three-lords-special',
    bucket: 'theme',
    title: 'Mandate In Foil',
    description: 'Own all three RoTK leaders as special variants.',
    reward: { gold: 350 },
    progress: (save, db) => themeVariantProgress(save, ROTK_LEADERS, db, isSpecialVariant),
  },
  {
    id: 'theme-rotk-three-lords-rainbow',
    bucket: 'theme',
    title: 'Rainbow Mandate',
    description: 'Own all three RoTK leaders with rainbow borders.',
    reward: { gold: 600 },
    progress: (save, db) => themeVariantProgress(save, ROTK_LEADERS, db, isRainbowBorder),
  },
  {
    id: 'theme-greek-olympian-court',
    bucket: 'theme',
    title: 'Olympian Court',
    description: 'Own the legendary Greek god headliners.',
    reward: { gold: 500 },
    progress: (save, db) => themeProgress(save, GREEK_OLYMPIAN_COURT, db),
  },
  {
    id: 'theme-greek-olympian-court-special',
    bucket: 'theme',
    title: 'Olympian Regalia',
    description: 'Own those Greek headliners as special variants.',
    reward: { gold: 750 },
    progress: (save, db) => themeVariantProgress(save, GREEK_OLYMPIAN_COURT, db, isSpecialVariant),
  },
  {
    id: 'theme-greek-olympian-court-rainbow',
    bucket: 'theme',
    title: 'Rainbow Olympus',
    description: 'Own those Greek headliners with rainbow borders.',
    reward: { gold: 1200 },
    progress: (save, db) => themeVariantProgress(save, GREEK_OLYMPIAN_COURT, db, isRainbowBorder),
  },
  {
    id: 'theme-beastkin-pack-council',
    bucket: 'theme',
    title: 'Pack Council',
    description: 'Own Packmother, Yohime, and Lupa.',
    reward: { gold: 250 },
    progress: (save, db) => themeProgress(save, BEASTKIN_PACK_COUNCIL, db),
  },
  {
    id: 'theme-beastkin-pack-council-special',
    bucket: 'theme',
    title: 'Council In Foil',
    description: 'Own the Beastkin council as special variants.',
    reward: { gold: 350 },
    progress: (save, db) => themeVariantProgress(save, BEASTKIN_PACK_COUNCIL, db, isSpecialVariant),
  },
  {
    id: 'theme-beastkin-pack-council-rainbow',
    bucket: 'theme',
    title: 'Rainbow Pack',
    description: 'Own the Beastkin council with rainbow borders.',
    reward: { gold: 600 },
    progress: (save, db) => themeVariantProgress(save, BEASTKIN_PACK_COUNCIL, db, isRainbowBorder),
  },
  {
    id: 'theme-ragnarok-25',
    bucket: 'theme',
    title: 'Twilight Beachhead',
    description: 'Own 25% of Ragnarök cards.',
    reward: { gold: 200 },
    progress: (save, db) => themedCollectionProgress(save, db, isRagnarok, 0.25),
  },
  {
    id: 'theme-ragnarok-50',
    bucket: 'theme',
    title: 'Edda Binder',
    description: 'Own 50% of Ragnarök cards.',
    reward: { gold: 400 },
    progress: (save, db) => themedCollectionProgress(save, db, isRagnarok, 0.5),
  },
  {
    id: 'theme-ragnarok-complete',
    bucket: 'theme',
    title: 'Twilight Complete',
    description: 'Own every Ragnarök card.',
    reward: { gold: 1200 },
    progress: (save, db) => themedCollectionProgress(save, db, isRagnarok),
  },
  {
    id: 'theme-ragnarok-twilight-court',
    bucket: 'theme',
    title: 'Twilight Court',
    description: 'Own the Ragnarök headline cast.',
    reward: { gold: 600 },
    progress: (save, db) => themeProgress(save, RAGNAROK_TWILIGHT_COURT, db),
  },
  {
    id: 'theme-ragnarok-twilight-court-special',
    bucket: 'theme',
    title: 'Twilight In Foil',
    description: 'Own the Ragnarök headliners as special variants.',
    reward: { gold: 900 },
    progress: (save, db) => themeVariantProgress(save, RAGNAROK_TWILIGHT_COURT, db, isSpecialVariant),
  },
  {
    id: 'theme-ragnarok-twilight-court-rainbow',
    bucket: 'theme',
    title: 'Rainbow Twilight',
    description: 'Own the Ragnarök headliners with rainbow borders.',
    reward: { gold: 1500 },
    progress: (save, db) => themeVariantProgress(save, RAGNAROK_TWILIGHT_COURT, db, isRainbowBorder),
  },
  {
    id: 'theme-ragnarok-valkyries',
    bucket: 'theme',
    title: 'Valkyrie Flight',
    description: 'Own every Ragnarök Valkyrie.',
    reward: { gold: 350 },
    progress: (save, db) => themedCollectionProgress(save, db, (card) => isRagnarok(card) && card.subtypes.includes('Valkyrie')),
  },
  {
    id: 'theme-ragnarok-draugr',
    bucket: 'theme',
    title: 'Deathless Legion',
    description: 'Own every Ragnarök Draugr.',
    reward: { gold: 350 },
    progress: (save, db) => themedCollectionProgress(save, db, (card) => isRagnarok(card) && card.subtypes.includes('Draugr')),
  },
  {
    id: 'theme-ragnarok-jotun-wolves',
    bucket: 'theme',
    title: 'Nine-World Hunt',
    description: 'Own every Ragnarök Jotun or Wolf.',
    reward: { gold: 450 },
    progress: (save, db) =>
      themedCollectionProgress(
        save,
        db,
        (card) => isRagnarok(card) && (card.subtypes.includes('Jotun') || card.subtypes.includes('Wolf')),
      ),
  },
  {
    id: 'theme-celtic-fae-25',
    bucket: 'theme',
    title: 'Veil Beachhead',
    description: 'Own 25% of Silver Veil cards.',
    reward: { gold: 200 },
    progress: (save, db) => themedCollectionProgress(save, db, isCelticFae, 0.25),
  },
  {
    id: 'theme-celtic-fae-50',
    bucket: 'theme',
    title: 'Silver Binder',
    description: 'Own 50% of Silver Veil cards.',
    reward: { gold: 400 },
    progress: (save, db) => themedCollectionProgress(save, db, isCelticFae, 0.5),
  },
  {
    id: 'theme-celtic-fae-complete',
    bucket: 'theme',
    title: 'Silver Veil Complete',
    description: 'Own every Silver Veil card.',
    reward: { gold: 1200 },
    progress: (save, db) => themedCollectionProgress(save, db, isCelticFae),
  },
  {
    id: 'theme-celtic-fae-court-sovereigns',
    bucket: 'theme',
    title: 'Court Sovereigns',
    description: 'Own Morrigan, Titania, Aine, and Nimue.',
    reward: { gold: 600 },
    progress: (save, db) => themeProgress(save, CELTIC_FAE_COURT_SOVEREIGNS, db),
  },
  {
    id: 'theme-celtic-fae-ssr-court',
    bucket: 'theme',
    title: 'Inner Court',
    description: 'Own every Silver Veil SSR court card.',
    reward: { gold: 500 },
    progress: (save, db) => themedCollectionProgress(save, db, (card) => isCelticFae(card) && card.rarity === 'ssr'),
  },
  {
    id: 'theme-celtic-fae-selkies',
    bucket: 'theme',
    title: 'Tidebound Court',
    description: 'Own every Silver Veil Selkie.',
    reward: { gold: 350 },
    progress: (save, db) =>
      themedCollectionProgress(save, db, (card) => isCelticFae(card) && card.subtypes.includes('Selkie')),
  },
  {
    id: 'theme-celtic-fae-ravens',
    bucket: 'theme',
    title: 'Omen Wing',
    description: 'Own every Silver Veil Raven.',
    reward: { gold: 350 },
    progress: (save, db) =>
      themedCollectionProgress(save, db, (card) => isCelticFae(card) && card.subtypes.includes('Raven')),
  },
  {
    id: 'theme-celtic-fae-redcaps',
    bucket: 'theme',
    title: 'Redcap Warband',
    description: 'Own every Silver Veil Redcap.',
    reward: { gold: 350 },
    progress: (save, db) =>
      themedCollectionProgress(save, db, (card) => isCelticFae(card) && card.subtypes.includes('Redcap')),
  },
  // Arthurian Court (1.2) — schema-free, mirroring the Celtic Fae pass.
  {
    id: 'theme-arthurian-25',
    bucket: 'theme',
    title: "Squire's Oath",
    description: 'Own 25% of Grail Oath cards.',
    reward: { gold: 200 },
    progress: (save, db) => themedCollectionProgress(save, db, isArthurianCourt, 0.25),
  },
  {
    id: 'theme-arthurian-50',
    bucket: 'theme',
    title: 'Half the Table',
    description: 'Own 50% of Grail Oath cards.',
    reward: { gold: 400 },
    progress: (save, db) => themedCollectionProgress(save, db, isArthurianCourt, 0.5),
  },
  {
    id: 'theme-arthurian-complete',
    bucket: 'theme',
    title: 'Grail Oath Complete',
    description: 'Own every Grail Oath card.',
    reward: { gold: 1200 },
    progress: (save, db) => themedCollectionProgress(save, db, isArthurianCourt),
  },
  {
    id: 'theme-arthurian-round-table',
    bucket: 'theme',
    title: 'The Table Assembled',
    description: 'Own Artoria, Lancelot, Gawain, Percival, and Galahad.',
    reward: { gold: 600 },
    progress: (save, db) => themeProgress(save, ARTHURIAN_ROUND_TABLE, db),
  },
  {
    id: 'theme-arthurian-crown-jewels',
    bucket: 'theme',
    title: 'Crown Jewels',
    description: 'Own Artoria, Morgan, Nimue, and The Grail.',
    reward: { gold: 800 },
    progress: (save, db) => themeProgress(save, ARTHURIAN_CROWN_JEWELS, db),
  },
  {
    id: 'theme-arthurian-knights',
    bucket: 'theme',
    title: 'Full Muster',
    description: 'Own every Grail Oath Knight.',
    reward: { gold: 400 },
    progress: (save, db) =>
      themedCollectionProgress(save, db, (card) => isArthurianCourt(card) && card.subtypes.includes('Knight')),
  },
  {
    id: 'theme-arthurian-quests',
    bucket: 'theme',
    title: 'Seven Vows',
    description: 'Own every Grail Oath Quest.',
    reward: { gold: 350 },
    progress: (save, db) =>
      themedCollectionProgress(save, db, (card) => isArthurianCourt(card) && card.subtypes.includes('Quest')),
  },
  {
    id: 'theme-arthurian-champions',
    bucket: 'theme',
    title: 'Champions in Waiting',
    description: 'Own every Grail Oath card with Champion Awakening.',
    reward: { gold: 350 },
    progress: (save, db) =>
      themedCollectionProgress(save, db, (card) => isArthurianCourt(card) && card.awakening !== undefined),
  },
  // Gothic Monsters (1.3), schema-free and derived from the live 80-card pool.
  {
    id: 'theme-gothic-monsters-25',
    bucket: 'theme',
    title: 'First Candle',
    description: 'Own 25% of Nocturne Manor cards.',
    reward: { gold: 200 },
    progress: (save, db) => themedCollectionProgress(save, db, isGothicMonsters, 0.25),
  },
  {
    id: 'theme-gothic-monsters-50',
    bucket: 'theme',
    title: 'Half the Manor',
    description: 'Own 50% of Nocturne Manor cards.',
    reward: { gold: 400 },
    progress: (save, db) => themedCollectionProgress(save, db, isGothicMonsters, 0.5),
  },
  {
    id: 'theme-gothic-monsters-complete',
    bucket: 'theme',
    title: 'Manor Without End',
    description: 'Own every Nocturne Manor card.',
    reward: { gold: 1200 },
    progress: (save, db) => themedCollectionProgress(save, db, isGothicMonsters),
  },
  {
    id: 'theme-gothic-monsters-headliners',
    bucket: 'theme',
    title: 'The Bloodmoon Court',
    description: 'Own Carmilla, The Bride, Luna, and Lenore.',
    reward: { gold: 600 },
    progress: (save, db) => themeProgress(save, GOTHIC_MONSTERS_HEADLINERS, db),
  },
  {
    id: 'theme-gothic-monsters-headliners-special',
    bucket: 'theme',
    title: 'Velvet Regalia',
    description: 'Own all four Gothic Monsters headliners as special variants.',
    reward: { gold: 900 },
    progress: (save, db) => themeVariantProgress(save, GOTHIC_MONSTERS_HEADLINERS, db, isSpecialVariant),
  },
  {
    id: 'theme-gothic-monsters-dreaded',
    bucket: 'theme',
    title: 'No Single Blocker',
    description: 'Own every Nocturne Manor card with Dreaded.',
    reward: { gold: 400 },
    progress: (save, db) =>
      themedCollectionProgress(save, db, (card) => isGothicMonsters(card) && card.keywords?.includes('dreaded') === true),
  },
  {
    id: 'theme-gothic-monsters-empowered',
    bucket: 'theme',
    title: 'Paid in Blood',
    description: 'Own every Nocturne Manor card with Empower.',
    reward: { gold: 450 },
    progress: (save, db) =>
      themedCollectionProgress(save, db, (card) => isGothicMonsters(card) && card.empower !== undefined),
  },
  {
    id: 'theme-gothic-monsters-vampires',
    bucket: 'theme',
    title: 'The Masquerade Bloodline',
    description: 'Own every Gothic Monsters Vampire.',
    reward: { gold: 350 },
    progress: (save, db) =>
      themedCollectionProgress(save, db, (card) => isGothicMonsters(card) && card.subtypes.includes('Vampire')),
  },
  {
    id: 'first-win',
    bucket: 'mastery',
    title: 'First Duel Won',
    description: 'Win any duel.',
    reward: { gold: 75 },
    progress: (save) => ({ current: save.stats.wins, target: 1 }),
  },
  {
    id: 'ten-wins',
    bucket: 'mastery',
    title: 'Seasoned Duelist',
    description: 'Win 10 duels.',
    reward: { gold: 150 },
    progress: (save) => ({ current: save.stats.wins, target: 10 }),
  },
  {
    id: 'hard-win',
    bucket: 'mastery',
    title: 'Hard Lesson',
    description: 'Win a hard practice duel.',
    reward: { gold: 150 },
    progress: (save) => ({ current: save.stats.byDifficulty.hard.w, target: 1 }),
  },
  {
    id: 'gauntlet-clear',
    bucket: 'mastery',
    title: 'Tower Cleared',
    description: 'Clear the full Avatar Gauntlet.',
    reward: { gold: 400 },
    progress: (save) => ({ current: save.gauntlet.completions, target: 1 }),
  },
  // Limited run-history goals (1.2, reserved since road-to-1.0). Schema-free:
  // they read limited.history / bestDraftWins. History is a 20-entry FIFO, so
  // counting goals keep targets well under the cap; unlocks latch permanently
  // in save.achievements.unlocked even after old runs roll off.
  {
    id: 'draft-first-run',
    bucket: 'mastery',
    title: 'Table Sat',
    description: 'Complete a draft run.',
    reward: { gold: 100 },
    progress: (save) => ({
      current: save.limited.history.filter((h) => h.mode === 'draft').length,
      target: 1,
    }),
  },
  {
    id: 'draft-five-runs',
    bucket: 'mastery',
    title: 'Draft Regular',
    description: 'Complete 5 draft runs.',
    reward: { gold: 200 },
    progress: (save) => ({
      current: save.limited.history.filter((h) => h.mode === 'draft').length,
      target: 5,
    }),
  },
  {
    id: 'draft-clean-sweep',
    bucket: 'mastery',
    title: 'Clean Sweep',
    description: 'Win all three matches of a draft run.',
    reward: { gold: 300 },
    progress: (save) => ({ current: save.limited.bestDraftWins, target: LIMITED_MATCHES }),
  },
  {
    id: 'draft-premium-run',
    bucket: 'mastery',
    title: 'Premium Keeps',
    description: 'Complete a Premium Draft run; the picks are yours.',
    reward: { gold: 150 },
    progress: (save) => ({
      current: save.limited.history.filter((h) => h.mode === 'draft' && h.premium === true).length,
      target: 1,
    }),
  },
  {
    id: 'gauntlet-clear-mono',
    bucket: 'theme',
    title: 'One Banner Tower',
    description: 'Clear the Avatar Gauntlet with a mono-color deck.',
    reward: { gold: 500 },
    progress: (save) => ({ current: save.gauntlet.clearStyles.monoColor, target: 1 }),
  },
  {
    id: 'gauntlet-clear-dual',
    bucket: 'theme',
    title: 'Two Banner Tower',
    description: 'Clear the Avatar Gauntlet with a two-color deck.',
    reward: { gold: 500 },
    progress: (save) => ({ current: save.gauntlet.clearStyles.dualColor, target: 1 }),
  },
  {
    id: 'packs-10',
    bucket: 'economy',
    title: 'Pack Regular',
    description: 'Open 10 packs.',
    reward: { gold: 100 },
    progress: (save) => ({ current: save.stats.packsOpened, target: 10 }),
  },
  {
    id: 'packs-25',
    bucket: 'economy',
    title: 'Booster Habit',
    description: 'Open 25 packs.',
    reward: { gold: 200 },
    progress: (save) => ({ current: save.stats.packsOpened, target: 25 }),
  },
  {
    id: 'packs-100',
    bucket: 'economy',
    title: 'Box Breaker',
    description: 'Open 100 packs.',
    reward: { gold: 500 },
    progress: (save) => ({ current: save.stats.packsOpened, target: 100 }),
  },
] as const;

const DEFS_BY_ID = new Map(ACHIEVEMENTS.map((def) => [def.id, def]));

function uniqueKnown(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!DEFS_BY_ID.has(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function evaluateAchievements(save: SaveData, db: CardDb): AchievementStatus[] {
  const completion = collectionCompletion(Object.values(db), save);
  const unlocked = new Set(save.achievements.unlocked);
  const claimed = new Set(save.achievements.claimed);
  return ACHIEVEMENTS.map((def) => {
    const progress = def.progress(save, db, completion);
    const current = Math.max(0, progress.current);
    const target = Math.max(1, progress.target);
    return {
      def,
      current,
      target,
      percent: Math.min(1, current / target),
      unlocked: unlocked.has(def.id) || current >= target,
      claimed: claimed.has(def.id),
    };
  });
}

/**
 * Recompute satisfied achievements from durable save + card-db state. This is
 * called by UI entry points rather than persisted as incremental counters, so
 * imported or migrated saves recover their unlocks without drift.
 */
export function syncAchievements(save: SaveData, db: CardDb): string[] {
  save.achievements.unlocked = uniqueKnown(save.achievements.unlocked);
  save.achievements.claimed = uniqueKnown(save.achievements.claimed).filter((id) =>
    save.achievements.unlocked.includes(id),
  );

  const before = new Set(save.achievements.unlocked);
  const newly: string[] = [];
  for (const status of evaluateAchievements(save, db)) {
    if (!status.unlocked || before.has(status.def.id)) continue;
    save.achievements.unlocked.push(status.def.id);
    before.add(status.def.id);
    newly.push(status.def.id);
  }
  return newly;
}

export function claimAchievement(save: SaveData, id: string): ClaimResult {
  const def = DEFS_BY_ID.get(id);
  if (!def) return { ok: false, gold: 0, reason: 'unknown' };
  if (!save.achievements.unlocked.includes(id)) return { ok: false, gold: 0, reason: 'locked' };
  if (save.achievements.claimed.includes(id)) return { ok: false, gold: 0, reason: 'claimed' };
  save.achievements.claimed.push(id);
  save.gold += def.reward.gold;
  return { ok: true, gold: def.reward.gold };
}

export function claimAllAchievements(save: SaveData): { ids: string[]; gold: number } {
  const ids: string[] = [];
  let gold = 0;
  for (const def of ACHIEVEMENTS) {
    const result = claimAchievement(save, def.id);
    if (!result.ok) continue;
    ids.push(def.id);
    gold += result.gold;
  }
  return { ids, gold };
}
