/**
 * Accessibility wave 3, batch B: Pack Opening, Achievements and the Glossary
 * (and the keyword guide panel where it opens outside the Duel). Every save
 * here is built in memory and handed to the scene in its start data; nothing
 * is installed in Services or written to storage. Identities are the longest
 * real ones (card names, achievement titles and goals, glossary entries),
 * never invented or padded copy.
 */
import type { ProbeScene } from './a11yProbe';
import { ALL_CARDS } from '../data/catalog';
import { GLOSSARY_SECTIONS, type GlossarySectionId } from '../data/glossary';
import type { Rarity } from '../engine/types';
import { ACHIEVEMENTS, type AchievementDef } from '../meta/Achievements';
import type { AddResult } from '../meta/Collection';
import { collectiblePool } from '../meta/collectionFilter';
import type { PackResult } from '../meta/PackOpener';
import { freshSave, type SaveData } from '../meta/SaveManager';
import { HALL_BUCKETS } from '../ui/achievementPresentation';
import { cardGlossaryEntries } from '../ui/rulesText';
import { wave2BFixtureSave } from './deckCollectionFixtures';

// ---------------------------------------------------------------------------
// Pack Opening
// ---------------------------------------------------------------------------

const POOL = collectiblePool(ALL_CARDS);
/** Each tier's cards, longest name first. */
const byTier = (tier: Rarity): string[] => POOL.filter((card) => card.rarity === tier)
  .sort((a, b) => b.name.length - a.name.length || a.id.localeCompare(b.id)).map((card) => card.id);
const TIER_IDS: Record<Rarity, string[]> = { c: byTier('c'), r: byTier('r'), sr: byTier('sr'), ssr: byTier('ssr'), ur: byTier('ur') };

const pull = (tier: Rarity, n: number, extra: Partial<AddResult> = {}): AddResult => {
  const ids = TIER_IDS[tier];
  return { cardId: ids[n % ids.length], isNew: false, isNewVariant: false, dupeGold: 0, tier, frame: 'white', holo: 'none', fullArt: false, ...extra };
};

/**
 * A nine-card pack with every tier: the longest names, a new card, a melted
 * duplicate, a new variant, and a best card whose inspect shows every detail
 * line (odds, new, rarity, frame, holo, full art).
 */
export function wave3SinglePack(): PackResult {
  return { cards: [
    pull('c', 0, { isNew: true }), pull('c', 1, { dupeGold: 5 }), pull('c', 2), pull('c', 3, { isNew: true }),
    pull('r', 0, { isNew: true }), pull('r', 1, { dupeGold: 10 }),
    pull('sr', 0, { isNewVariant: true, frame: 'blue', holo: 'shiny' }),
    pull('ssr', 0, { isNew: true, frame: 'red', holo: 'rainbow' }),
    pull('ur', 0, { isNew: true, frame: 'rainbow', holo: 'void', fullArt: true }),
  ] };
}

/** The Shop's largest bulk buy: ten packs, every tier, some duplicates, a UR last. */
export function wave3MaxBatch(specials = true): PackResult[] {
  return Array.from({ length: 10 }, (_, p) => ({ cards: Array.from({ length: 9 }, (_, i): AddResult => {
    const n = p * 9 + i;
    if (!specials) return pull(i < 6 ? 'c' : 'r', n, { dupeGold: n % 4 === 0 ? 5 : 0, isNew: n % 7 === 0 });
    const tier: Rarity = i < 5 ? 'c' : i < 7 ? 'r' : i === 7 ? (p % 3 === 2 ? 'ssr' : 'sr') : p === 9 ? 'ur' : p % 2 ? 'sr' : 'ssr';
    return pull(tier, n, { dupeGold: tier === 'c' && n % 3 === 0 ? 5 : 0, isNew: n % 5 === 0,
      ...(tier === 'ur' ? { frame: 'gold', holo: 'fractal', fullArt: true } : {}) });
  }) }));
}

/** 9,999,999 gold (every re-buy affordable) or none (the disabled price). */
export function wave3PackSave(gold = 9_999_999, animations: SaveData['settings']['animations'] = 'full'): SaveData {
  const save = freshSave(0);
  save.gold = gold;
  save.settings.animations = animations;
  return save;
}

const packScene = (label: string, data: object, settleMs?: number): ProbeScene =>
  ({ label: `Pack Opening / ${label}`, key: 'PackOpening', data, ...(settleMs ? { settleMs } : {}) });

const PACK_SCENES: ProbeScene[] = [
  packScene('tear', { ...wave3SinglePack(), sku: 'base', a11yFixture: { save: wave3PackSave(), state: 'tear' } }),
  packScene('face down', { ...wave3SinglePack(), sku: 'base', a11yFixture: { save: wave3PackSave(), state: 'facedown' } }),
  packScene('revealed', { ...wave3SinglePack(), sku: 'base', a11yFixture: { save: wave3PackSave(), state: 'revealed' } }),
  packScene('revealed / no gold', { ...wave3SinglePack(), sku: 'first-dawn', a11yFixture: { save: wave3PackSave(0), state: 'revealed' } }),
  packScene('best card', { ...wave3SinglePack(), sku: 'base', a11yFixture: { save: wave3PackSave(), state: 'best' } }, 1200),
  packScene('inspect', { ...wave3SinglePack(), sku: 'base', a11yFixture: { save: wave3PackSave(), state: 'inspect' } }),
  packScene('runway', { batch: wave3MaxBatch(), sku: 'base', a11yFixture: { save: wave3PackSave(), state: 'runway' } }),
  packScene('runway / spotlight', { batch: wave3MaxBatch(), sku: 'base', a11yFixture: { save: wave3PackSave(), state: 'spotlight' } }, 1200),
  packScene('summary', { batch: wave3MaxBatch(), sku: 'base', a11yFixture: { save: wave3PackSave(9_999_999, 'off') } }),
  packScene('summary / no specials', { batch: wave3MaxBatch(false), sku: 'base', a11yFixture: { save: wave3PackSave(0, 'off') } }),
];

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

const longest = (key: 'title' | 'description', n: number): AchievementDef[] =>
  [...ACHIEVEMENTS].sort((a, b) => b[key].length - a[key].length || a.id.localeCompare(b.id)).slice(0, n);
/** The longest titles and goals, in all three states: ready, claimed and in progress (by index mod 3). */
const LONGEST = [...new Set([...longest('title', 4), ...longest('description', 4)])];

/**
 * Half the achievements unlocked and a quarter claimed, plus the longest
 * titles and goals in each state, so every row kind and the Claim All line
 * are on screen.
 */
export function wave3AchievementsSave(): SaveData {
  const save = freshSave(0);
  const ready = LONGEST.filter((_, i) => i % 3 === 0).map((a) => a.id);
  const claimed = LONGEST.filter((_, i) => i % 3 === 1).map((a) => a.id);
  const locked = new Set(LONGEST.filter((_, i) => i % 3 === 2).map((a) => a.id));
  const others = ACHIEVEMENTS.filter((a) => !LONGEST.includes(a));
  save.achievements.unlocked = [...ready, ...claimed, ...others.filter((_, i) => i % 2 === 0).map((a) => a.id)]
    .filter((id) => !locked.has(id));
  save.achievements.claimed = [...claimed, ...others.filter((_, i) => i % 4 === 0).map((a) => a.id)];
  return save;
}

/** The hall with each wing's longest title on its plinth, ready, and one empty wing. */
export function wave3HallSave(): SaveData {
  const save = freshSave(0);
  const featured = HALL_BUCKETS.slice(0, -1).map((bucket) =>
    ACHIEVEMENTS.filter((a) => a.bucket === bucket).sort((a, b) => b.title.length - a.title.length)[0].id);
  save.achievements.unlocked = [...featured];
  return save;
}

/** Every achievement claimed: full gauges and claimed plinths. */
export function wave3AllClaimedSave(): SaveData {
  const save = freshSave(0);
  save.achievements.unlocked = ACHIEVEMENTS.map((a) => a.id);
  save.achievements.claimed = ACHIEVEMENTS.map((a) => a.id);
  return save;
}

const READY_LONGEST = LONGEST.filter((_, i) => i % 3 === 0);
const CLAIMED_LONGEST = LONGEST.filter((_, i) => i % 3 === 1);
const LOCKED_LONGEST = LONGEST.filter((_, i) => i % 3 === 2);

/**
 * Only the longest ready and claimed rows in those states (or, with
 * `lockedOnly`, everything but the longest locked ones unlocked and claimed),
 * so each filter's first page holds them at every text size.
 */
export function wave3LongestSave(lockedOnly = false): SaveData {
  const save = freshSave(0);
  if (lockedOnly) {
    const rest = ACHIEVEMENTS.filter((a) => !LOCKED_LONGEST.includes(a)).map((a) => a.id);
    save.achievements.unlocked = [...rest];
    save.achievements.claimed = [...rest];
  } else {
    save.achievements.unlocked = [...READY_LONGEST, ...CLAIMED_LONGEST].map((a) => a.id);
    save.achievements.claimed = CLAIMED_LONGEST.map((a) => a.id);
  }
  return save;
}

const achScene = (label: string, data: object, requiredText?: string[]): ProbeScene =>
  ({ label: `Achievements / ${label}`, key: 'Achievements', data, ...(requiredText ? { requiredText } : {}) });
const mixed = wave3AchievementsSave();

const ACHIEVEMENT_SCENES: ProbeScene[] = [
  achScene('hall / longest plinths', { view: 'hall', a11yFixture: { save: wave3HallSave() } }),
  achScene('hall / all claimed', { view: 'hall', a11yFixture: { save: wave3AllClaimedSave() } }),
  achScene('list / first page', { view: 'list', a11yFixture: { save: mixed } }),
  achScene('list / last page', { view: 'list', page: Number.MAX_SAFE_INTEGER, a11yFixture: { save: mixed } }),
  achScene('list / longest ready', { view: 'list', filter: 'ready', a11yFixture: { save: wave3LongestSave() } },
    READY_LONGEST.map((a) => a.title)),
  achScene('list / longest claimed', { view: 'list', filter: 'claimed', a11yFixture: { save: wave3LongestSave() } },
    CLAIMED_LONGEST.map((a) => `✓ ${a.title}`)),
  achScene('list / longest in progress', { view: 'list', filter: 'in-progress', a11yFixture: { save: wave3LongestSave(true) } },
    LOCKED_LONGEST.map((a) => a.title)),
  achScene('list / in progress / last page', { view: 'list', filter: 'in-progress', page: Number.MAX_SAFE_INTEGER, a11yFixture: { save: mixed } }),
  achScene('list / empty filter', { view: 'list', filter: 'claimed', a11yFixture: { save: freshSave(0) } }),
  achScene('list / collection wing', { view: 'list', bucket: 'collection', a11yFixture: { save: mixed } }),
];

// ---------------------------------------------------------------------------
// Glossary and the keyword guide
// ---------------------------------------------------------------------------

const TERMS = GLOSSARY_SECTIONS.flatMap((section) => section.terms);
const LONGEST_TERM = [...TERMS].sort((a, b) => b.description.length - a.description.length)[0];
const LONG_SECTIONS = GLOSSARY_SECTIONS.filter((section) => section.terms.length > 6).map((section) => section.id);
const glossScene = (label: string, data: object, requiredText?: string[]): ProbeScene =>
  ({ label: `Glossary / ${label}`, key: 'Glossary', data, ...(requiredText ? { requiredText } : {}) });

/** The card whose inspect shows the most keyword guide entries. */
export const WAVE_3B_GLOSSARY_CARD = POOL.reduce((best, card) =>
  cardGlossaryEntries(card).length > cardGlossaryEntries(best).length ? card : best);

const GLOSSARY_SCENES: ProbeScene[] = [
  ...(['all', ...GLOSSARY_SECTIONS.map((section) => section.id)] as (GlossarySectionId | 'all')[]).map((tab) =>
    glossScene(`${tab}`, { a11yFixture: { tab } })),
  ...(['all', ...LONG_SECTIONS] as (GlossarySectionId | 'all')[]).map((tab) =>
    glossScene(`${tab} / end`, { a11yFixture: { tab, scroll: 'end' } })),
  glossScene('search results', { a11yFixture: { query: 'a' } }),
  glossScene('search results / end', { a11yFixture: { query: 'a', scroll: 'end' } }),
  glossScene('no match', { a11yFixture: { query: 'zzzz' } }),
  glossScene('longest entry', { focus: LONGEST_TERM.name }, [LONGEST_TERM.name]),
  { label: 'Keyword guide / Collection inspect', key: 'Collection',
    data: { a11yFixture: { save: wave2BFixtureSave(), inspectCardId: WAVE_3B_GLOSSARY_CARD.id } },
    // The guide scrolls inside its host cap; the first entry must show unscrolled.
    requiredText: [cardGlossaryEntries(WAVE_3B_GLOSSARY_CARD)[0].name] },
];

/** Accessibility wave 3 probe scenes: Pack Opening, Achievements and the Glossary. */
export const WAVE_3B_SCENES: readonly ProbeScene[] = [...PACK_SCENES, ...ACHIEVEMENT_SCENES, ...GLOSSARY_SCENES];
