/**
 * playSignals — the pure core of the anonymous play statistics (rollout wave
 * T1, docs/plan-telemetry-and-accounts.md Part 1).
 *
 * This module turns local state into three anonymous, bucketed digests. It
 * sends nothing: there is no transport here, no timestamp, no identifier, and
 * no free text. Every impure fact (build stamp, platform, form factor, UI
 * language, the OS reduced-motion preference) arrives as a plain input object
 * supplied by the scene layer, so the module stays inside the iron-invariant
 * fence and is fully testable headless.
 *
 * The design idea, verbatim from the spec: **send state snapshots, never user
 * timelines.** Every numeric fact leaves as a bucket label or a small capped
 * enum, so the raw values never exist server-side to leak.
 *
 * Three events:
 *   - `heartbeat` — at most once per launch, at most once per UTC day;
 *   - `duel`      — one digest per completed duel, carrying NO card ids;
 *   - `cards`     — one batch at session end, tallied only in memory across a
 *                   single launch, one row per distinct card, carrying no duel
 *                   reference, no deck reference, no order and no time. Every
 *                   row repeats one bucketed count of the duels the launch
 *                   contained, which is a denominator rather than a reference:
 *                   it names no duel and orders nothing.
 *
 * `SIGNAL_FIELDS` is the field allowlist and the single source of truth. Every
 * builder constructs its output by projecting through the allowlist, so an
 * extra key cannot appear by accident, and the key order of the serialised
 * payload is the allowlist order (stable, byte-identical across calls).
 *
 * Do not confuse this with `balanceTelemetry.ts`, which is the per-duel balance
 * record the harnesses consume. That one is internal and may hold anything;
 * this one is the thing that leaves the device.
 */

import { DARLINGS_PRECONS } from '../data/darlingsPrecons';
import { DRAFT_PERSONAS } from '../data/draftPersonas';
import { AVATARS } from '../data/opponents';
import { STARTER_DECKS, THEME_DECKS } from '../data/starterDecks';
import type { CardDb, CardDef } from '../engine/types';
import { isType, manaValue } from '../engine/types';
import { ACHIEVEMENTS } from './Achievements';
import { deckColorIdentity } from './deckColorIdentity';
import { BASIC_LAND_IDS, type SaveData } from './SaveManager';

// ---------------------------------------------------------------------------
// The allowlist. One entry per event type, plus the nested `settings` object.
// Nothing outside these names is ever emitted.
// ---------------------------------------------------------------------------

export const SIGNAL_FIELDS = {
  heartbeat: [
    'appVersion',
    'buildSha',
    'platform',
    'formFactor',
    'lang',
    'settings',
    'streakBucket',
    'achievementsBucket',
    'winsBucket',
    'lossesBucket',
    'packsBucket',
    'collectionBucket',
    'tutorialDone',
    'gauntletBestRung',
  ],
  duel: [
    'format',
    'deckColours',
    'deckArchetype',
    'curveBucket',
    'deckSource',
    'opponentId',
    'difficulty',
    'turnsBucket',
    'result',
    'mulligans',
  ],
  cards: ['cardId', 'countBucket', 'duelsBucket'],
} as const;

/** The nested `heartbeat.settings` allowlist, held apart so it can be asserted on its own. */
export const SIGNAL_SETTINGS_FIELDS = ['animations', 'reducedMotion', 'renderScale'] as const;

// The allowlist is the single source of truth a later wave checks the edge
// validator against, so it is frozen at runtime as well as at compile time.
Object.freeze(SIGNAL_FIELDS);
Object.freeze(SIGNAL_FIELDS.heartbeat);
Object.freeze(SIGNAL_FIELDS.duel);
Object.freeze(SIGNAL_FIELDS.cards);
Object.freeze(SIGNAL_SETTINGS_FIELDS);

export type HeartbeatField = (typeof SIGNAL_FIELDS.heartbeat)[number];
export type DuelField = (typeof SIGNAL_FIELDS.duel)[number];
export type CardsField = (typeof SIGNAL_FIELDS.cards)[number];
export type SettingsField = (typeof SIGNAL_SETTINGS_FIELDS)[number];

// ---------------------------------------------------------------------------
// Value vocabularies. Every one of these is a closed enum or a bucket label.
// ---------------------------------------------------------------------------

export type SignalPlatform = 'web' | 'desktop';
export type SignalFormFactor = 'mobile' | 'tablet' | 'desktop';
export type SignalAnimations = 'full' | 'reduced' | 'off';
export type SignalRenderScale = '720p' | '1080p' | '1440p' | 'other';
/**
 * `warchest` is the reserve-native constructed format, which since the 1.6
 * classic retirement is what every granted non-Darlings deck actually is
 * (`grantedDeckBuild`, src/meta/Economy.ts). There is deliberately no
 * `constructed` value.
 */
export type SignalDuelFormat = 'warchest' | 'darlings' | 'limited' | 'gauntlet';
export type SignalDeckSource = 'precon' | 'custom' | 'drafted';
export type SignalDifficulty = 'easy' | 'medium' | 'hard';
/** A concede is its own outcome. It is never also reported as a loss. */
export type SignalResult = 'win' | 'loss' | 'draw' | 'concede';

export type StreakBucket = '0' | '1' | '2' | '3' | '4-6' | '7-13' | '14-29' | '30+';
export type TenthsBucket =
  | '0.0' | '0.1' | '0.2' | '0.3' | '0.4' | '0.5'
  | '0.6' | '0.7' | '0.8' | '0.9' | '1.0';
export type CountBucket = '0' | '1-4' | '5-9' | '10-24' | '25-49' | '50-99' | '100-249' | '250+';
export type CollectionBucket =
  | '0' | '1-24' | '25-99' | '100-249' | '250-499' | '500-999' | '1000+';
export type TurnsBucket = '1-5' | '6-10' | '11-15' | '16-20' | '21-30' | '31+';
export type CurveBucket = '<2.0' | '2.0-2.4' | '2.5-2.9' | '3.0-3.4' | '3.5-3.9' | '4.0+';
export type CardCountBucket = '1' | '2-3' | '4-7' | '8+';

/** Emitted in place of an opponent id we do not recognise as one of ours. */
export const UNKNOWN_OPPONENT_ID = 'unknown';
/** Emitted in place of a language tag that is not a bare two-letter subtag. */
export const UNKNOWN_LANG = 'xx';
/** A deck that is not an unmodified precon has no archetype label of ours. */
export const CUSTOM_ARCHETYPE = 'custom';
/** Colour identity of a deck with no coloured nonland cards. */
export const COLOURLESS = 'C';

/** Highest gauntlet rung that exists, so `gauntletBestRung` stays a small capped int. */
export const GAUNTLET_RUNG_CAP: number = AVATARS.reduce((max, avatar) => Math.max(max, avatar.tier), 0);
/** Hard cap on the mulligan count (the London-mulligan ceiling in config/rules). */
export const MULLIGAN_CAP = 3;
/** Build stamps are ours, not the player's, but they are still trimmed before they leave. */
export const BUILD_STAMP_MAX_LENGTH = 40;

// ---------------------------------------------------------------------------
// Event shapes, derived FROM the allowlist so the two can never drift.
// ---------------------------------------------------------------------------

interface SettingsFieldTypes {
  animations: SignalAnimations;
  reducedMotion: boolean;
  renderScale: SignalRenderScale;
}

interface HeartbeatFieldTypes {
  appVersion: string;
  buildSha: string;
  platform: SignalPlatform;
  formFactor: SignalFormFactor;
  lang: string;
  settings: HeartbeatSettings;
  streakBucket: StreakBucket;
  achievementsBucket: TenthsBucket;
  winsBucket: CountBucket;
  lossesBucket: CountBucket;
  packsBucket: CountBucket;
  collectionBucket: CollectionBucket;
  tutorialDone: boolean;
  gauntletBestRung: number;
}

interface DuelFieldTypes {
  format: SignalDuelFormat;
  deckColours: string;
  deckArchetype: string;
  curveBucket: CurveBucket;
  deckSource: SignalDeckSource;
  opponentId: string;
  difficulty: SignalDifficulty;
  turnsBucket: TurnsBucket;
  result: SignalResult;
  mulligans: number;
}

interface CardsFieldTypes {
  cardId: string;
  countBucket: CardCountBucket;
  /** Duels in this launch, the same on every row of one batch. A denominator, not a reference. */
  duelsBucket: CardCountBucket;
}

export type HeartbeatSettings = { [K in SettingsField]: SettingsFieldTypes[K] };
export type HeartbeatSignal = { [K in HeartbeatField]: HeartbeatFieldTypes[K] };
export type DuelSignal = { [K in DuelField]: DuelFieldTypes[K] };
export type SessionCardSignal = { [K in CardsField]: CardsFieldTypes[K] };

/**
 * Compile-time proof that each allowlist and its field-type map agree in BOTH
 * directions. The mapped types above already fail if the allowlist names a
 * field the map lacks; these fail if the map carries a field the allowlist
 * does not name, which is exactly how a stray key would get in.
 */
type NoExtraFields<T extends never> = T;
export type SettingsAllowlistIsExact = NoExtraFields<Exclude<keyof SettingsFieldTypes, SettingsField>>;
export type HeartbeatAllowlistIsExact = NoExtraFields<Exclude<keyof HeartbeatFieldTypes, HeartbeatField>>;
export type DuelAllowlistIsExact = NoExtraFields<Exclude<keyof DuelFieldTypes, DuelField>>;
export type CardsAllowlistIsExact = NoExtraFields<Exclude<keyof CardsFieldTypes, CardsField>>;

// ---------------------------------------------------------------------------
// Bucketing. Every function here is total: a negative, NaN, absent, huge or
// fractional input lands in a defined bucket rather than throwing or escaping.
// ---------------------------------------------------------------------------

interface Band<L extends string> {
  /** Inclusive upper edge of this band; the final band uses Infinity. */
  readonly max: number;
  readonly label: L;
}

function finite(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/** Bands are ascending and the last one is open-ended, so every real number lands. */
function bandOf<L extends string>(bands: readonly Band<L>[], raw: unknown): L {
  const value = finite(raw);
  for (const band of bands) if (value <= band.max) return band.label;
  return bands[bands.length - 1].label;
}

const STREAK_BANDS: readonly Band<StreakBucket>[] = [
  { max: 0, label: '0' },
  { max: 1, label: '1' },
  { max: 2, label: '2' },
  { max: 3, label: '3' },
  { max: 6, label: '4-6' },
  { max: 13, label: '7-13' },
  { max: 29, label: '14-29' },
  { max: Infinity, label: '30+' },
];

const COUNT_BANDS: readonly Band<CountBucket>[] = [
  { max: 0, label: '0' },
  { max: 4, label: '1-4' },
  { max: 9, label: '5-9' },
  { max: 24, label: '10-24' },
  { max: 49, label: '25-49' },
  { max: 99, label: '50-99' },
  { max: 249, label: '100-249' },
  { max: Infinity, label: '250+' },
];

const COLLECTION_BANDS: readonly Band<CollectionBucket>[] = [
  { max: 0, label: '0' },
  { max: 24, label: '1-24' },
  { max: 99, label: '25-99' },
  { max: 249, label: '100-249' },
  { max: 499, label: '250-499' },
  { max: 999, label: '500-999' },
  { max: Infinity, label: '1000+' },
];

const TURNS_BANDS: readonly Band<TurnsBucket>[] = [
  { max: 5, label: '1-5' },
  { max: 10, label: '6-10' },
  { max: 15, label: '11-15' },
  { max: 20, label: '16-20' },
  { max: 30, label: '21-30' },
  { max: Infinity, label: '31+' },
];

const CURVE_BANDS: readonly Band<CurveBucket>[] = [
  { max: 1.9999999999, label: '<2.0' },
  { max: 2.4999999999, label: '2.0-2.4' },
  { max: 2.9999999999, label: '2.5-2.9' },
  { max: 3.4999999999, label: '3.0-3.4' },
  { max: 3.9999999999, label: '3.5-3.9' },
  { max: Infinity, label: '4.0+' },
];

const CARD_COUNT_BANDS: readonly Band<CardCountBucket>[] = [
  { max: 1, label: '1' },
  { max: 3, label: '2-3' },
  { max: 7, label: '4-7' },
  { max: Infinity, label: '8+' },
];

/** Daily win streak. Anything below 1, including NaN and absent, reads as `0`. */
export function streakBucket(raw: unknown): StreakBucket {
  return bandOf(STREAK_BANDS, raw);
}

/** Lifetime wins / packs opened. Anything below 1 reads as `0`. */
export function countBucket(raw: unknown): CountBucket {
  return bandOf(COUNT_BANDS, raw);
}

/** Distinct collectible cards owned. Anything below 1 reads as `0`. */
export function collectionBucket(raw: unknown): CollectionBucket {
  return bandOf(COLLECTION_BANDS, raw);
}

/** Turns the duel lasted. Anything below 6, including 0 and negatives, reads as `1-5`. */
export function turnsBucket(raw: unknown): TurnsBucket {
  return bandOf(TURNS_BANDS, raw);
}

/** Mean mana value of the deck's nonland cards. An empty deck reads as `<2.0`. */
export function curveBucket(raw: unknown): CurveBucket {
  return bandOf(CURVE_BANDS, raw);
}

/** Times one card was played across a launch. Anything below 2 reads as `1`. */
export function cardCountBucket(raw: unknown): CardCountBucket {
  return bandOf(CARD_COUNT_BANDS, raw);
}

/**
 * Duels completed in one launch. Deliberately the same bands and labels as the
 * card count, so the batch reads as one vocabulary. Zero, negative, NaN and
 * absent all read as `1`, since a batch only exists because a launch happened.
 */
export function duelsBucket(raw: unknown): CardCountBucket {
  return bandOf(CARD_COUNT_BANDS, raw);
}

/**
 * A share in [0,1] bucketed to tenths, e.g. 0.64 -> `0.6`. Only an exact 1
 * reaches `1.0`; the epsilon keeps a clean tenth such as 0.7 off the band below
 * it when binary floating point lands it a hair short.
 */
export function tenthsBucket(raw: unknown): TenthsBucket {
  const share = finite(raw);
  if (share <= 0) return '0.0';
  if (share >= 1) return '1.0';
  const tenth = Math.min(9, Math.max(0, Math.floor(share * 10 + 1e-9)));
  return `0.${tenth}` as TenthsBucket;
}

/** The three hard-coded 16:9 render resolutions, as labels rather than numbers. */
export function renderScaleBucket(raw: unknown): SignalRenderScale {
  if (raw === 1) return '720p';
  if (raw === 1.5) return '1080p';
  if (raw === 2) return '1440p';
  return 'other';
}

/** Clamp to a small non-negative integer. Absent, NaN and negative all read as 0. */
export function cappedInt(raw: unknown, max: number): number {
  const value = Math.floor(finite(raw));
  return Math.max(0, Math.min(max, value));
}

/**
 * Keep only the primary language subtag, lowercased: `en-GB` -> `en`. A region
 * narrows the crowd, so it never leaves. Anything that is not two ASCII letters
 * reads as `xx`.
 */
export function normalizeLang(raw: unknown): string {
  const primary = typeof raw === 'string' ? raw.split(/[-_]/)[0].toLowerCase() : '';
  return /^[a-z]{2}$/.test(primary) ? primary : UNKNOWN_LANG;
}

/**
 * Build stamps come from our own build, not from the player, but they are still
 * narrowed to a safe charset and a bounded length before they leave.
 */
export function safeBuildStamp(raw: unknown): string {
  const text = typeof raw === 'string' ? raw : '';
  return text.replace(/[^A-Za-z0-9._-]/g, '').slice(0, BUILD_STAMP_MAX_LENGTH);
}

// ---------------------------------------------------------------------------
// Allowlist projection. Builders construct their output through this, so only
// allowlisted keys survive and the key order is the allowlist order.
// ---------------------------------------------------------------------------

function project<T extends object, K extends keyof T & string>(
  fields: readonly K[],
  source: T,
): Pick<T, K> {
  const out: Partial<Pick<T, K>> = {};
  for (const field of fields) out[field] = source[field];
  return out as Pick<T, K>;
}

// ---------------------------------------------------------------------------
// heartbeat
// ---------------------------------------------------------------------------

/**
 * The impure facts the scene layer supplies. None of these can be read from a
 * pure module, so every one arrives as a plain value on this object.
 */
export interface SignalEnv {
  /** Build-stamped application version. */
  appVersion: string;
  /** Build-stamped short commit sha, or `dev`. */
  buildSha: string;
  /** Pages build vs the packaged desktop build. */
  platform: SignalPlatform;
  /** Bucketed form factor. Raw screen dimensions never leave. */
  formFactor: SignalFormFactor;
  /** UI language tag; only the primary subtag is kept. */
  lang: string;
  /** The OS reduced-motion preference, read by the scene layer from its media query. */
  reducedMotion: boolean;
}

const FORM_FACTORS: ReadonlySet<string> = new Set<SignalFormFactor>(['mobile', 'tablet', 'desktop']);
const ANIMATION_TIERS: ReadonlySet<string> = new Set<SignalAnimations>(['full', 'reduced', 'off']);
const DUEL_FORMATS: ReadonlySet<string> = new Set<SignalDuelFormat>([
  'warchest',
  'darlings',
  'limited',
  'gauntlet',
]);
const DIFFICULTIES: ReadonlySet<string> = new Set<SignalDifficulty>(['easy', 'medium', 'hard']);
const RESULTS: ReadonlySet<string> = new Set<SignalResult>(['win', 'loss', 'draw', 'concede']);

const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((def) => def.id));
const BASIC_LAND_ID_SET: ReadonlySet<string> = new Set<string>(BASIC_LAND_IDS);

/**
 * Our own opponents: the avatar roster the Tower and Practice seat, and the
 * draft personas Limited seats. An id outside this set is never one of ours, so
 * it is replaced rather than forwarded.
 */
const KNOWN_OPPONENT_IDS: ReadonlySet<string> = new Set<string>([
  ...AVATARS.map((avatar) => avatar.id),
  ...DRAFT_PERSONAS.map((persona) => persona.id),
]);

/** Share of the achievement roster unlocked, counting only ids we still define. */
function unlockedShare(save: SaveData): number {
  const total = ACHIEVEMENT_IDS.size;
  if (total === 0) return 0;
  const seen = new Set<string>();
  for (const id of save.achievements?.unlocked ?? []) if (ACHIEVEMENT_IDS.has(id)) seen.add(id);
  return seen.size / total;
}

/** Distinct card ids owned at least once. The collection contents never leave; only this count, bucketed. */
function distinctOwned(save: SaveData): number {
  let owned = 0;
  for (const count of Object.values(save.collection ?? {})) if (finite(count) > 0) owned++;
  return owned;
}

/**
 * One launch-level snapshot of how this install is set up and how far it has
 * got. No identifier, no timestamp, no raw count.
 */
export function buildHeartbeat(save: SaveData, env: SignalEnv): HeartbeatSignal {
  const settings = project(SIGNAL_SETTINGS_FIELDS, {
    animations: ANIMATION_TIERS.has(save.settings?.animations)
      ? save.settings.animations
      : ('full' as SignalAnimations),
    reducedMotion: env.reducedMotion === true,
    renderScale: renderScaleBucket(save.settings?.renderScale),
  });
  return project(SIGNAL_FIELDS.heartbeat, {
    appVersion: safeBuildStamp(env.appVersion),
    buildSha: safeBuildStamp(env.buildSha),
    platform: env.platform === 'desktop' ? 'desktop' : ('web' as SignalPlatform),
    formFactor: FORM_FACTORS.has(env.formFactor) ? env.formFactor : ('desktop' as SignalFormFactor),
    lang: normalizeLang(env.lang),
    settings,
    streakBucket: streakBucket(save.daily?.streak?.count),
    achievementsBucket: tenthsBucket(unlockedShare(save)),
    winsBucket: countBucket(save.stats?.wins),
    lossesBucket: countBucket(save.stats?.losses),
    packsBucket: countBucket(save.stats?.packsOpened),
    collectionBucket: collectionBucket(distinctOwned(save)),
    tutorialDone: save.tutorialDone === true,
    gauntletBestRung: cappedInt(save.gauntlet?.bestRung, GAUNTLET_RUNG_CAP),
  });
}

// ---------------------------------------------------------------------------
// duel
// ---------------------------------------------------------------------------

/** The finished duel, as the scene layer already knows it. */
export interface DuelResultInput {
  format: SignalDuelFormat;
  /** One of our built-in opponent ids. Anything else is replaced with `unknown`. */
  opponentId: string;
  difficulty: SignalDifficulty;
  result: SignalResult;
  /** Turn the duel ended on; bucketed before it leaves. */
  turns: number;
  /** Times the player mulliganed; capped before it leaves. */
  mulligans: number;
}

/**
 * The deck that was piloted. Nothing on this object is emitted: the card ids
 * are read only to derive the colour identity, the curve bucket, and whether
 * the list is an unmodified precon. A decklist is close to a fingerprint, which
 * is exactly why it stops here.
 */
export interface DuelDeckInput {
  /** Deck card ids. In the reserve formats this is the nonland list. */
  cards: readonly string[];
  /** The Warchest land reserve, or null outside the reserve formats. */
  landReserve: readonly string[] | null;
  /** Command-zone Darling, or null. */
  darlingId: string | null;
  /** Card facts, injected so this module needs no catalog of its own. */
  db: CardDb;
}

/**
 * A stable signature for an exact decklist: sorted cards, sorted reserve, and
 * the Darling. Order and duplicates both matter to "unmodified", so this is a
 * sorted multiset rather than a set.
 */
function deckSignature(
  cards: readonly string[],
  landReserve: readonly string[] | null,
  darlingId: string | null,
): string {
  return `${[...cards].sort().join(',')}|${[...(landReserve ?? [])].sort().join(',')}|${darlingId ?? ''}`;
}

/**
 * Signature -> precon id, for every shape a granted precon can take: the
 * classic 60, the reserve-native build that the shop actually grants, and the
 * Darlings singleton lists. Built once at module load from our own data.
 */
const PRECON_SIGNATURES: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  const add = (signature: string, id: string): void => {
    if (!map.has(signature)) map.set(signature, id);
  };
  for (const list of [...STARTER_DECKS, ...THEME_DECKS]) {
    add(deckSignature(list.cards, null, null), list.id);
    if (list.reserveCards) add(deckSignature(list.reserveCards, list.landReserve ?? null, null), list.id);
  }
  for (const precon of DARLINGS_PRECONS) {
    add(deckSignature(precon.cards, precon.landReserve, precon.darlingId), precon.id);
  }
  return map;
})();

/**
 * Our own archetype label for a deck: the precon's id when the list is an
 * unmodified precon, `custom` otherwise. The player's deck NAME is never read.
 *
 * `DECK_INFO.archetype` in src/data/deckInfo.ts was the other candidate label
 * set and was rejected: it is authored prose for the shop plate ("Warband
 * aggro"), not a stable enum, and it exists only for precons anyway. The precon
 * id carries the same information at a fraction of the cardinality.
 */
export function deckArchetypeOf(deck: DuelDeckInput): string {
  return PRECON_SIGNATURES.get(deckSignature(deck.cards, deck.landReserve, deck.darlingId)) ?? CUSTOM_ARCHETYPE;
}

/** Colour identity in WUBRG order, from nonland cards plus the Darling. `C` when there is none. */
export function deckColoursOf(deck: DuelDeckInput): string {
  const cards = deck.darlingId ? [...deck.cards, deck.darlingId] : [...deck.cards];
  const identity = deckColorIdentity(cards, deck.db);
  return identity.length > 0 ? identity.join('') : COLOURLESS;
}

/** Mean mana value across the deck's nonland cards (the Darling counts). */
export function averageManaValue(deck: DuelDeckInput): number {
  const cards = deck.darlingId ? [...deck.cards, deck.darlingId] : [...deck.cards];
  let total = 0;
  let counted = 0;
  for (const id of cards) {
    const card: CardDef | undefined = deck.db[id];
    if (!card || isType(card, 'land')) continue;
    total += manaValue(card.cost);
    counted++;
  }
  return counted > 0 ? total / counted : 0;
}

/**
 * One digest per completed duel. It carries NO card id at all: joining it to
 * the session card batch must yield nothing, which is the whole reason the
 * cards live on their own event.
 *
 * `save` contributes exactly one thing: the cross-check that a Limited duel
 * really had a draft run behind it, so `deckSource` is measured rather than
 * asserted by the caller.
 */
export function buildDuelDigest(
  result: DuelResultInput,
  deck: DuelDeckInput,
  save: SaveData,
): DuelSignal {
  const format: SignalDuelFormat = DUEL_FORMATS.has(result.format) ? result.format : 'warchest';
  const drafted = format === 'limited' && (save.limited?.activeRun ?? null) !== null;
  const archetype = drafted ? CUSTOM_ARCHETYPE : deckArchetypeOf(deck);
  const deckSource: SignalDeckSource = drafted
    ? 'drafted'
    : archetype === CUSTOM_ARCHETYPE
      ? 'custom'
      : 'precon';
  return project(SIGNAL_FIELDS.duel, {
    format,
    deckColours: deckColoursOf(deck),
    deckArchetype: archetype,
    curveBucket: curveBucket(averageManaValue(deck)),
    deckSource,
    opponentId: KNOWN_OPPONENT_IDS.has(result.opponentId) ? result.opponentId : UNKNOWN_OPPONENT_ID,
    difficulty: DIFFICULTIES.has(result.difficulty) ? result.difficulty : ('medium' as SignalDifficulty),
    turnsBucket: turnsBucket(result.turns),
    // A malformed outcome reads as a draw rather than silently inflating either
    // side of the win rate; draws are rare enough that the anomaly shows up. A
    // concede passes through as itself and is never folded into `loss`.
    result: RESULTS.has(result.result) ? result.result : ('draw' as SignalResult),
    mulligans: cappedInt(result.mulligans, MULLIGAN_CAP),
  });
}

// ---------------------------------------------------------------------------
// cards — the session batch
// ---------------------------------------------------------------------------

/**
 * An in-memory tally of cards played across ONE launch. The caller owns it,
 * nothing about it is stored on the device, and it is discarded when the
 * session ends. Order of play is never recorded.
 */
export type CardTally = Readonly<Record<string, number>>;

/** A card that may be reported: not a token, not a basic land. */
function isReportable(card: CardDef | undefined): card is CardDef {
  if (!card) return false;
  if (card.token === true) return false;
  return !(card.supertypes?.includes('basic') ?? false);
}

/**
 * Fold a batch of played card ids into the tally and return the new one. Pure:
 * the input tally is not mutated.
 *
 * `db` is required rather than optional on purpose. Tokens, basic lands and ids
 * we do not know are dropped HERE, before they ever enter the tally, so a
 * caller cannot skip the filter and an excluded id never exists in memory.
 */
export function tallyCardsPlayed(
  tally: CardTally,
  cardIds: readonly string[],
  db: CardDb,
): CardTally {
  const next: Record<string, number> = { ...tally };
  for (const id of cardIds) {
    if (!isReportable(db[id])) continue;
    next[id] = (next[id] ?? 0) + 1;
  }
  return next;
}

/**
 * The session batch: one row per distinct card id, sorted by card id so the
 * output is deterministic, with a bucketed count. No duel reference, no deck
 * reference, no order, no timestamp — by construction, since the row shape has
 * nowhere to put any of them.
 *
 * `duelsPlayed` is the denominator the batch would otherwise lack: how many
 * duels this launch contained, bucketed with the card-count labels and repeated
 * identically on every row. It is REQUIRED rather than optional so a caller
 * cannot forget it and quietly ship a batch that cannot be read. It is a count
 * and nothing else: it names no duel, references no duel, and orders nothing.
 */
export function buildSessionCards(tally: CardTally, duelsPlayed: number): SessionCardSignal[] {
  const duels = duelsBucket(duelsPlayed);
  return Object.keys(tally)
    .filter((cardId) => !BASIC_LAND_ID_SET.has(cardId) && finite(tally[cardId]) > 0)
    .sort()
    .map((cardId) =>
      project(SIGNAL_FIELDS.cards, {
        cardId,
        countBucket: cardCountBucket(tally[cardId]),
        duelsBucket: duels,
      }),
    );
}
