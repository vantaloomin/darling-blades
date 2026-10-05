/**
 * Accessibility wave 3, batch A: the Limited hub, the draft and the drafted-pool
 * deck builder, as probe scenes. Every fixture owns an in-memory save handed to
 * the scene through its start data (IS_DEV only); nothing here is installed in
 * Services or written to storage.
 *
 * Pseudo-long copy comes from the game's own data, never padded: the longest
 * collectible card names, the longest persona name, blurb and colour hint,
 * seven-digit gold, the record history at its stored maximum (20, of which the
 * hub shows 8), the last pick of the last pack (44 picks in the pool panel),
 * and the pool and deck lists' last pages.
 */
import type { ProbeScene } from './a11yProbe';
import { ALL_CARDS, CARD_DB } from '../data/catalog';
import { DRAFT_PERSONAS } from '../data/draftPersonas';
import { ECONOMY } from '../config/rules';
import { isBasic } from '../meta/Collection';
import { collectiblePool } from '../meta/collectionFilter';
import { LIMITED_DECK_SIZE } from '../meta/DeckStorage';
import { payPremiumDraftEntry, todayString } from '../meta/Economy';
import {
  buildLimitedDeck,
  completeDraftRun,
  currentDraftPack,
  DRAFT_PACKS,
  limitedLandReserve,
  pickDraftCard,
  startDraftRun,
  type LimitedHistoryEntry,
  type LimitedRun,
} from '../meta/Limited';
import { freshSave, type SaveData } from '../meta/SaveManager';
import { isDualLand } from '../meta/warchest';
import type {
  LimitedBuilderA11yFixture,
  LimitedDraftA11yFixture,
  LimitedHubA11yFixture,
} from '../ui/limitedDraftPresentation';

const FIXED_NOW = Date.UTC(2026, 9, 1);
const SEED = 4242;
const POOL_SIZE = ECONOMY.limitedPackSize * DRAFT_PACKS;

/** A run whose human has made `picks` picks (taking the first card each time). */
function draftAfter(picks: number, premium: boolean): LimitedRun {
  const run = startDraftRun(CARD_DB, SEED, FIXED_NOW, premium ? { premium: true } : {});
  let draft = run.draft!;
  for (let i = 0; i < picks && !draft.completed; i++) draft = pickDraftCard(CARD_DB, draft, currentDraftPack(draft)[0], 0);
  return { ...run, draft };
}

/** Personas by the length of the copy the persona modal draws. */
const byLength = (key: 'name' | 'blurb' | 'colorHint') => [...DRAFT_PERSONAS].sort((a, b) => b[key].length - a[key].length);
const LONGEST_BLURB = byLength('blurb')[0];
const LONGEST_HINT = byLength('colorHint').find((p) => p.id !== LONGEST_BLURB.id)!;
const LONGEST_NAME = byLength('name').find((p) => p.id !== LONGEST_BLURB.id && p.id !== LONGEST_HINT.id)!;
const NEXT_NAME = byLength('name').find((p) => ![LONGEST_BLURB, LONGEST_HINT, LONGEST_NAME].includes(p))!;

/** The seats the persona modal fixtures open, and the familiarity tier each shows. */
const PERSONA_SEATS = [
  { seat: 1, persona: LONGEST_BLURB, tier: 4 },
  { seat: 2, persona: LONGEST_HINT, tier: 3 },
  { seat: 3, persona: LONGEST_NAME, tier: 2 },
  { seat: 4, persona: NEXT_NAME, tier: 1 },
] as const;

/** Seat the long-copy personas and set the familiarity each fixture shows. */
function seatPersonas(save: SaveData, run: LimitedRun): void {
  if (!run.draft) return;
  const others = DRAFT_PERSONAS.filter((p) => !PERSONA_SEATS.some((s) => s.persona.id === p.id));
  const ids = [...run.draft.personaIds];
  for (let seat = 1; seat < ids.length; seat++) {
    ids[seat] = PERSONA_SEATS.find((s) => s.seat === seat)?.persona.id ?? others[seat].id;
  }
  run.draft = { ...run.draft, personaIds: ids };
  for (const { persona, tier } of PERSONA_SEATS) save.limited.personaSeen[persona.id] = tier - 1;
}

/** Twenty stored records (the Economy cap), premium and free, every record shape. */
function fullHistory(): LimitedHistoryEntry[] {
  const wins = [3, 0, 2, 1];
  return Array.from({ length: 20 }, (_, i) => ({
    id: `a11y-run-${i}`,
    mode: 'draft' as const,
    seed: i + 1,
    wins: wins[i % 4],
    losses: 3 - wins[i % 4],
    deckStyle: (['other', 'dual', 'mono'] as const)[i % 3],
    completedAt: FIXED_NOW - i * 86_400_000,
    rewardGold: i % 2 === 0 ? 0 : ECONOMY.limitedRunGold[wins[i % 4]],
    ...(i % 2 === 0 ? { premium: true } : {}),
  }));
}

function hubSave(run: LimitedRun | null, gold = 9_999_999): SaveData {
  const save = freshSave(0);
  save.tutorialDone = true;
  save.gold = gold;
  save.limited.history = fullHistory();
  save.limited.bestDraftWins = 3;
  save.limited.activeRun = run;
  if (run) seatPersonas(save, run);
  return save;
}

/** A completed draft's run in the Build step: the real pool and auto-built deck. */
function buildRun(premium: boolean): LimitedRun {
  return { ...completeDraftRun(CARD_DB, draftAfter(POOL_SIZE, premium)), status: 'build' };
}

/**
 * The 45 longest-named collectible cards (no basics) as a drafted pool, so the
 * Pool and Deck rows and the Details readout carry the longest names the game
 * can draft.
 */
const LONGEST_POOL: readonly string[] = collectiblePool(ALL_CARDS)
  .filter((card) => !isBasic(CARD_DB, card.id))
  .sort((a, b) => b.name.length - a.name.length || a.id.localeCompare(b.id))
  .slice(0, POOL_SIZE)
  .map((card) => card.id);
const LONGEST_CARD = LONGEST_POOL[0];

function longestRun(deckSize: number): LimitedRun {
  const run = buildRun(false);
  const spells = LONGEST_POOL.filter((id) => !CARD_DB[id].types.includes('land'));
  const ordered = [...buildLimitedDeck(CARD_DB, LONGEST_POOL), ...spells].filter((id, i, all) => all.indexOf(id) === i);
  const deck = [...ordered, ...ordered].slice(0, deckSize);
  const duals = LONGEST_POOL.filter((id) => isDualLand(CARD_DB[id])).slice(0, 2);
  return { ...run, pool: [...LONGEST_POOL], deck, landReserve: limitedLandReserve(CARD_DB, deck, [...LONGEST_POOL], duals) };
}

function builderSave(run: LimitedRun, premium = false): SaveData {
  const save = hubSave(null);
  if (premium) {
    run.premium = true;
    // The note's worst case: every pick but one melted at the top tier.
    const drafted = run.pool.length;
    save.limited.premiumGrant = { runId: run.id, drafted, added: 1, converted: drafted - 1,
      gold: (drafted - 1) * ECONOMY.dupeGold.ur };
  }
  save.limited.activeRun = run;
  return save;
}

function weeklyLimitSave(): SaveData {
  const save = hubSave(null);
  while (payPremiumDraftEntry(save, todayString())) { /* use up this week's entries */ }
  save.gold = 9_999_999;
  return save;
}

const scene = <T extends object>(prefix: string, key: string) =>
  (label: string, fixture: T, requiredText?: string[]): ProbeScene => ({
    label: `${prefix} / ${label}`, key, data: { a11yFixture: fixture }, ...(requiredText ? { requiredText } : {}),
  });
const hub = scene<LimitedHubA11yFixture>('Limited', 'Limited');
const draft = scene<LimitedDraftA11yFixture>('Limited draft', 'LimitedDraft');
const builder = scene<LimitedBuilderA11yFixture>('Limited builder', 'LimitedDeckBuilder');
const lastPick = (premium: boolean): LimitedRun => draftAfter(POOL_SIZE - 1, premium);
const midDraft = (): SaveData => hubSave(draftAfter(3, false));

/** Accessibility wave 3 probe scenes: Limited: the hub, the draft and the drafted-pool builder. */
export const WAVE_3A_SCENES: readonly ProbeScene[] = [
  hub('no run', { save: hubSave(null) }),
  hub('no run / not enough gold', { save: hubSave(null, 0) }),
  hub('no run / weekly limit', { save: weeklyLimitSave() }),
  hub('drafting', { save: hubSave(draftAfter(7, false)) }),
  hub('premium drafting / retire armed', { save: hubSave(draftAfter(20, true)), armRetire: true }),
  hub('free build / retire armed', { save: hubSave(buildRun(false)), armRetire: true }),
  hub('premium building', { save: hubSave(buildRun(true)) }),
  hub('premium matches', { save: hubSave({ ...buildRun(true), status: 'matches', matchIndex: 1, wins: 1 }) }),
  draft('first pick', { save: hubSave(draftAfter(0, false)) }),
  draft('premium mid pack', { save: hubSave(draftAfter(22, true)), select: 0 }),
  draft('last pick', { save: hubSave(lastPick(false)) }),
  draft('premium last pick', { save: hubSave(lastPick(true)), select: 0 }),
  draft('touch', { save: midDraft(), touch: true }),
  draft('leave prompt', { save: midDraft(), modal: 'leave' }),
  ...PERSONA_SEATS.map(({ seat, persona, tier }) =>
    draft(`persona tier ${tier}`, { save: midDraft(), modal: 'persona', seat }, [persona.name])),
  draft('persona you', { save: midDraft(), modal: 'persona', seat: 0 }),
  draft('inspect', { save: midDraft(), modal: 'inspect', inspect: 0 }),
  draft('premium inspect', { save: hubSave(draftAfter(30, true)), modal: 'inspect', inspect: 0 }),
  draft('premium inspect / selected', { save: hubSave(draftAfter(30, true)), modal: 'inspect', inspect: 1, select: 1 }),
  builder(`exactly ${LIMITED_DECK_SIZE}`, { save: builderSave(buildRun(false)) }),
  builder('longest names', { save: builderSave(longestRun(LIMITED_DECK_SIZE)), selectedId: LONGEST_CARD },
    [CARD_DB[LONGEST_CARD].name]),
  builder('longest names / last pages', { save: builderSave(longestRun(LIMITED_DECK_SIZE)),
    poolPage: Number.MAX_SAFE_INTEGER, deckPage: Number.MAX_SAFE_INTEGER }),
  builder('under', { save: builderSave(longestRun(9)) }),
  builder('over', { save: builderSave(longestRun(LIMITED_DECK_SIZE + 4)) }),
  builder('empty deck', { save: builderSave(longestRun(0)) }),
  builder('premium note', { save: builderSave(buildRun(true), true) }),
  builder('inspect longest', { save: builderSave(longestRun(LIMITED_DECK_SIZE)), modal: 'inspect', selectedId: LONGEST_CARD },
    [CARD_DB[LONGEST_CARD].name]),
  builder('leave prompt', { save: builderSave(buildRun(false)), modal: 'leave' }),
];
