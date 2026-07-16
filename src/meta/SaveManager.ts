import { DRAFT_PERSONAS } from '../data/draftPersonas';
import { assignDraftPersonas } from './draftPicker';
import { dayStringFromTimestamp, freshDailyState } from './Quests';
import { freshLimitedState, type LimitedState } from './Limited';
import { PLAIN_VARIANT, variantKey } from './variants';

/** Active gauntlet run state; null when no run is in progress. */
export interface GauntletState {
  /**
   * 1-based current rung + the run's fixed RNG seed. Every duel in the run
   * derives its per-rung seed from `seed` (src/meta/gauntletSeed.ts), so a run
   * is fully reproducible and two runs with different seeds diverge — "every
   * playthrough is different". The seed is chosen once, when the run begins.
   */
  run: { rung: number; startedAt: number; seed: number } | null;
  bestRung: number; // highest rung ever cleared
  completions: number; // full gauntlet clears
  clearStyles: GauntletClearStyles;
}

export interface GauntletClearStyles {
  monoColor: number;
  dualColor: number;
}

export interface AchievementState {
  unlocked: string[];
  claimed: string[];
}

export interface DailyQuestSave {
  id: string;
  progress: number;
  target: number;
  rewardGold: number;
  claimed: boolean;
}

export interface DailyState {
  day: string; // YYYY-MM-DD local calendar day for the active quest set
  quests: DailyQuestSave[];
  rerollsUsed: number;
  streak: {
    count: number;
    lastWinDay: string | null; // streak advances only from the first win on a day
  };
}

export interface SavedDeck {
  id: string;
  name: string;
  cards: string[];
  /** Per-deck hero card art for the commander portrait. `null` = auto/default. v15 addition. */
  heroCardId: string | null;
}

export interface PremiumWeekState {
  week: number;
  entries: number;
}

export interface SaveData {
  version: 19;
  createdAt: number;
  gold: number;
  collection: Record<string, number>; // cardId -> copies owned (aggregate across variants)
  /**
   * cardId -> variantKey (`${frame}|${holo}`, src/meta/variants.ts) -> count.
   * Invariant: per-card variant counts sum to `collection[cardId]`.
   */
  collectionVariants: Record<string, Record<string, number>>;
  decks: SavedDeck[];
  activeDeckId: string | null;
  starterChosen: string | null;
  /**
   * Legacy/default player-chosen hero card. Deck-specific `SavedDeck.heroCardId`
   * takes precedence; this remains as a fallback for older choices and the
   * Collection-scene default hero action.
   */
  heroCardId: string | null;
  /**
   * Player-chosen PREMIUM hero portrait (src/data/heroes.ts) — a bespoke,
   * non-card illustration unlocked only by owning its theme deck. Takes
   * precedence over the fallback `heroCardId` in the duel unless the active
   * saved deck has its own `SavedDeck.heroCardId`. `null` = none selected.
   * v9 addition.
   */
  heroPortraitId: string | null;
  /**
   * Whether the optional first-launch tutorial has been completed OR skipped
   * (both set it true — see docs/plan-road-to-1.0.md Feature 1). v10 addition;
   * a fresh save is `false`, and any player with a win/loss record is coerced
   * `true` on migration so genre veterans never see it.
  */
  tutorialDone: boolean;
  /**
   * Road-to-1.0 achievements. Unlocks are recomputed from durable save/card-db
   * state by src/meta/Achievements.ts; claimed is separate so migrated/imported
   * saves do not silently consume rewards. v11 addition.
   */
  achievements: AchievementState;
  /**
   * Road-to-1.0 daily quests and win streaks. Three quests are rolled per local
   * calendar day with three total rerolls; the streak advances only when the
   * player wins at least one duel that day. v13 addition.
   */
  daily: DailyState;
  /**
   * Road-to-1.0 Limited mode. Free-run cards are ephemeral; Premium Draft's 45
   * human picks enter the collection on draft completion. Active run state,
   * compact history, and best records persist. v14 addition; Premium fields
   * v18, weekly allowance v19.
   */
  limited: LimitedState & { premiumWeek: PremiumWeekState };
  stats: {
    wins: number;
    losses: number;
    byDifficulty: Record<'easy' | 'medium' | 'hard', { w: number; l: number }>;
    packsOpened: number;
    lastWinDay: string | null; // YYYY-MM-DD of last first-win-of-day bonus
  };
  gauntlet: GauntletState;
  settings: {
    volume: number;
    sfxOn: boolean;
    musicOn: boolean;
    animations: 'full' | 'reduced' | 'off';
    /** Hard-coded 16:9 render resolution (720p/1080p/1440p); no "auto" (v5). */
    renderScale: 1 | 1.5 | 2;
    autoSkip: boolean;
    /**
     * One shared policy for the two-tap "arm → confirm" guard on maximal-cost
     * destructive actions (concede, gauntlet abandon, shard/sell). v7 addition;
     * defaults on so an accidental tap can never fire the action outright.
     */
    confirmDestructive: boolean;
    /**
     * Append per-keyword reminder text on the card face (teaches new players
     * what deathtouch / trample / etc. do). v8 addition; defaults on. Off for
     * veterans who prefer denser cards.
     */
    keywordReminders: boolean;
  };
}

/** Default render resolution for a fresh save / a coerced legacy 'auto'. */
const DEFAULT_RENDER_SCALE = 2; // 1440p (user-directed 2026-07-12); lite caps to 1

/** The gauntlet defaults spread into any save that lacks them. */
export function freshGauntlet(): GauntletState {
  return { run: null, bestRung: 0, completions: 0, clearStyles: freshGauntletClearStyles() };
}

export function freshGauntletClearStyles(): GauntletClearStyles {
  return { monoColor: 0, dualColor: 0 };
}

export function freshAchievements(): AchievementState {
  return { unlocked: [], claimed: [] };
}

export function freshSave(now: number): SaveData {
  return {
    version: 19,
    createdAt: now,
    gold: 0,
    collection: {},
    collectionVariants: {},
    decks: [],
    activeDeckId: null,
    starterChosen: null,
    heroCardId: null,
    heroPortraitId: null,
    tutorialDone: false,
    achievements: freshAchievements(),
    daily: freshDailyState(dayStringFromTimestamp(now)),
    limited: { ...freshLimitedState(), premiumWeek: { week: 0, entries: 0 } },
    stats: {
      wins: 0,
      losses: 0,
      byDifficulty: { easy: { w: 0, l: 0 }, medium: { w: 0, l: 0 }, hard: { w: 0, l: 0 } },
      packsOpened: 0,
      lastWinDay: null,
    },
    gauntlet: freshGauntlet(),
    settings: {
      volume: 0.8,
      sfxOn: true,
      musicOn: true,
      animations: 'full',
      renderScale: DEFAULT_RENDER_SCALE,
      autoSkip: false,
      confirmDestructive: true,
      keywordReminders: true,
    },
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY = 'darlingblades.save.v1';
// The game was renamed WaifuTCG → Darling Blades. Read the legacy key once so
// an existing save (collection / gold / gauntlet progress) survives the rename;
// the next flush rewrites it under KEY. The `.v1` suffix is a slot name, not a
// schema version — schema versioning lives inside the blob (`SaveData.version`).
const LEGACY_KEY = 'waifutcg.save.v1';

/**
 * Single versioned JSON blob in localStorage; debounced writes; corrupt or
 * missing data falls back to a fresh save. Storage is injected so tests run
 * headless with a plain object.
 */
export class SaveManager {
  readonly data: SaveData;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly storage: StorageLike,
    now = Date.now(),
  ) {
    this.data = this.load(now);
  }

  private load(now: number): SaveData {
    try {
      const raw = this.storage.getItem(KEY) ?? this.storage.getItem(LEGACY_KEY);
      if (!raw) return freshSave(now);
      const parsed = JSON.parse(raw) as { version?: number };
      return this.migrate(parsed, now);
    } catch {
      return freshSave(now);
    }
  }

  /**
   * Forward-migrate an older blob to the current schema, stepwise so a v1
   * save walks the whole chain. v1 → v2 preserves gold / collection / decks /
   * stats / settings and spreads in the gauntlet defaults; v2 → v3 grows
   * `settings.musicOn` (defaulting on — music ships subtle, not silent);
   * v3 → v4 seeds `collectionVariants` (every pre-variant copy becomes the
   * PLAIN `white|none` variant) and rebuilds `settings` in the v4 shape
   * (volume/musicOn preserved, new toggles defaulted, the dead `animSpeed`
   * field dropped); v4 → v5 coerces the removed `renderScale: 'auto'` (and any
   * out-of-range value) to the hard-coded default; v5 → v6 adds `heroCardId`
   * (null = auto face) and, for a run already in progress, stamps it with a
   * seed derived from its `startedAt` so it stays reproducible; v6 → v7 adds
   * `settings.confirmDestructive` (default on — the shared two-tap guard on
   * concede / gauntlet-abandon / shard); v7 → v8 adds `settings.keywordReminders`
   * (default on); v8 → v9 adds `heroPortraitId` (null = no premium hero);
   * v9 → v10 adds `tutorialDone` (false for a fresh/zero-record save, true for
   * any player with a win/loss record); v10 → v11 adds achievements; v11 → v12
   * adds gauntlet clear-style counters; v12 -> v13 adds daily quests/streaks;
   * v13 -> v14 adds Limited runs/history; v14 -> v15 adds per-deck hero card
   * selections; v15 -> v16 seats deterministic personas into in-flight drafts;
   * v16 -> v17 adds persona familiarity counters (progressive reveal);
   * v17 -> v18 stamps the Premium Draft schema (all new fields are optional);
   * v18 -> v19 adds the Premium Draft weekly allowance, defaulting old saves
   * to zero entries so nobody inherits a partially spent week.
   * An unknown/garbage version starts fresh rather than crash.
   */
  private migrate(old: { version?: number } & Record<string, unknown>, now: number): SaveData {
    let cur = old;
    if (cur.version === 1) {
      const base = freshSave(now);
      // Spread the v1 fields over a fresh shell, then force the v2 additions.
      cur = {
        ...base,
        ...(cur as unknown as Partial<SaveData>),
        version: 2,
        gauntlet: freshGauntlet(),
        stats: { ...base.stats, ...((cur.stats as SaveData['stats']) ?? {}) },
      } as unknown as typeof old;
    }
    if (cur.version === 2) {
      const s = (cur.settings ?? {}) as { volume?: number; musicOn?: boolean };
      cur = {
        ...cur,
        version: 3,
        settings: { ...(cur.settings as object), volume: s.volume ?? 0.8, musicOn: s.musicOn ?? true },
      };
    }
    if (cur.version === 3) {
      const oldCollection = (cur.collection ?? {}) as Record<string, number>;
      const collectionVariants: Record<string, Record<string, number>> = {};
      const plainKey = variantKey(PLAIN_VARIANT);
      for (const [id, n] of Object.entries(oldCollection)) {
        if (n > 0) collectionVariants[id] = { [plainKey]: n };
      }
      const s = (cur.settings ?? {}) as { volume?: number; musicOn?: boolean };
      cur = {
        ...cur,
        version: 4,
        collectionVariants,
        settings: {
          volume: s.volume ?? 0.8,
          sfxOn: true,
          musicOn: s.musicOn ?? true,
          animations: 'full',
          renderScale: 'auto',
          autoSkip: true,
        }, // v3's animSpeed is deliberately not carried over (dead field)
      };
    }
    if (cur.version === 4) {
      // 'auto' was removed — coerce it (and any non-1/1.5/2 value) to the
      // hard-coded default; explicit 720p/1080p/1440p choices are preserved.
      const s = (cur.settings ?? {}) as { renderScale?: unknown };
      const rs = s.renderScale;
      const renderScale = rs === 1 || rs === 1.5 || rs === 2 ? rs : DEFAULT_RENDER_SCALE;
      cur = {
        ...cur,
        version: 5,
        settings: { ...(cur.settings as object), renderScale },
      };
    }
    if (cur.version === 5) {
      // Add the player hero field (null = auto), and give any in-progress run a
      // reproducible seed derived from when it started (deterministic — the meta
      // layer avoids Math.random; fresh runs seed from the UI in GauntletScene).
      const g = (cur.gauntlet ?? freshGauntlet()) as GauntletState & {
        run: (GauntletState['run'] & { seed?: number }) | null;
      };
      const run = g.run
        ? { rung: g.run.rung, startedAt: g.run.startedAt, seed: g.run.seed ?? ((g.run.startedAt & 0x7fffffff) || 1) }
        : null;
      cur = {
        ...cur,
        version: 6,
        heroCardId: (cur.heroCardId as string | null | undefined) ?? null,
        gauntlet: { ...g, run },
      };
    }
    if (cur.version === 6) {
      // Add the shared confirm-destructive guard (default on) so an existing
      // save keeps the safer behavior; a boolean already present is preserved.
      const s = (cur.settings ?? {}) as { confirmDestructive?: unknown };
      cur = {
        ...cur,
        version: 7,
        settings: {
          ...(cur.settings as object),
          confirmDestructive: typeof s.confirmDestructive === 'boolean' ? s.confirmDestructive : true,
        },
      };
    }
    if (cur.version === 7) {
      // Add the keyword-reminder toggle (default on) so an existing save keeps
      // the teaching behavior; a boolean already present is preserved.
      const s = (cur.settings ?? {}) as { keywordReminders?: unknown };
      cur = {
        ...cur,
        version: 8,
        settings: {
          ...(cur.settings as object),
          keywordReminders: typeof s.keywordReminders === 'boolean' ? s.keywordReminders : true,
        },
      };
    }
    if (cur.version === 8) {
      // Add the premium hero-portrait selection (null = none); a value already
      // present is preserved.
      cur = {
        ...cur,
        version: 9,
        heroPortraitId: (cur.heroPortraitId as string | null | undefined) ?? null,
      };
    }
    if (cur.version === 9) {
      // Add the first-launch-tutorial flag, always derived from the win/loss
      // record: a player with ANY game played is a veteran (true → never shown
      // the tutorial, and no replay reward), a zero-record save gets false so a
      // returning brand-new player still sees it. A genuine v9 blob never
      // carries `tutorialDone`, so there is nothing to preserve — and deriving
      // it here is robust to the fresh-save default that the v1→v2 step spreads.
      const s = (cur.stats ?? {}) as { wins?: number; losses?: number };
      cur = {
        ...cur,
        version: 10,
        tutorialDone: (s.wins ?? 0) + (s.losses ?? 0) > 0,
      };
    }
    if (cur.version === 10) {
      cur = {
        ...cur,
        version: 11,
        achievements: freshAchievements(),
      };
    }
    if (cur.version === 11) {
      const g = (cur.gauntlet ?? freshGauntlet()) as Partial<GauntletState> & {
        clearStyles?: Partial<GauntletClearStyles>;
      };
      cur = {
        ...cur,
        version: 12,
        gauntlet: {
          ...g,
          run: g.run ?? null,
          bestRung: g.bestRung ?? 0,
          completions: g.completions ?? 0,
          clearStyles: { ...freshGauntletClearStyles(), ...(g.clearStyles ?? {}) },
        },
      };
    }
    if (cur.version === 12) {
      cur = {
        ...cur,
        version: 13,
        daily: freshDailyState(dayStringFromTimestamp(now)),
      };
    }
    if (cur.version === 13) {
      cur = {
        ...cur,
        version: 14,
        limited: freshLimitedState(),
      };
    }
    if (cur.version === 14) {
      const legacyHero = typeof cur.heroCardId === 'string' ? cur.heroCardId : null;
      cur = {
        ...cur,
        version: 15,
        decks: normalizeSavedDecks(cur.decks, legacyHero),
      };
    }
    if (cur.version === 15) {
      const limited = (cur.limited ?? freshLimitedState()) as LimitedState;
      const activeRun = limited.activeRun;
      const legacyDraft = activeRun?.draft as (NonNullable<typeof activeRun>['draft'] & {
        personaIds?: string[];
      }) | undefined;
      const migratedRun =
        activeRun?.mode === 'draft' && legacyDraft && !Array.isArray(legacyDraft.personaIds)
          ? {
              ...activeRun,
              draft: {
                ...legacyDraft,
                personaIds: assignDraftPersonas(
                  legacyDraft.seed,
                  DRAFT_PERSONAS.map((persona) => persona.id),
                ),
              },
            }
          : activeRun;
      cur = {
        ...cur,
        version: 16,
        limited: { ...limited, activeRun: migratedRun },
      };
    }
    if (cur.version === 16) {
      // v16 -> v17: persona familiarity counters (progressive identity reveal).
      const limited = (cur.limited ?? freshLimitedState()) as Omit<LimitedState, 'personaSeen'> &
        Partial<Pick<LimitedState, 'personaSeen'>>;
      cur = {
        ...cur,
        version: 17,
        limited: { ...limited, personaSeen: limited.personaSeen ?? {} },
      };
    }
    if (cur.version === 17) {
      // v17 -> v18: Premium Draft fields are optional, so existing state passes through intact.
      cur = { ...cur, version: 18 };
    }
    if (cur.version === 18) {
      // v18 -> v19: a prior save has no reliable Premium weekly ledger. Start
      // the new allowance empty; the first call to payPremiumDraftEntry stamps
      // the current UTC week into the state.
      const limited = (cur.limited ?? freshLimitedState()) as LimitedState;
      cur = {
        ...cur,
        version: 19,
        limited: { ...limited, premiumWeek: { week: 0, entries: 0 } },
      };
    }
    if (cur.version === 19) {
      const limited = (cur.limited ?? freshLimitedState()) as LimitedState & {
        premiumWeek?: Partial<PremiumWeekState>;
      };
      const premiumWeek = limited.premiumWeek;
      const week = typeof premiumWeek?.week === 'number' && Number.isInteger(premiumWeek.week)
        ? premiumWeek.week
        : 0;
      const entries = typeof premiumWeek?.entries === 'number' && Number.isInteger(premiumWeek.entries)
        ? Math.max(0, premiumWeek.entries)
        : 0;
      return {
        ...cur,
        version: 19,
        limited: { ...limited, premiumWeek: { week, entries } },
      } as unknown as SaveData;
    }
    return freshSave(now);
  }

  /** Mutate the save and schedule a debounced persist. */
  touch(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // storage full/unavailable — nothing sensible to do in-game
    }
  }

  /**
   * Wipe the account to a fresh slate: cancel any pending write, clear both
   * storage slots (current + legacy), and reset the in-memory blob in place —
   * the `data` reference is shared with every scene, so it is mutated, not
   * replaced. UI callers reload the page afterwards so scenes rebuild from the
   * fresh save (starter picker, zero gold, empty collection).
   */
  reset(now = Date.now()): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.storage.removeItem(KEY);
    this.storage.removeItem(LEGACY_KEY);
    Object.assign(this.data, freshSave(now));
  }
}

function normalizeSavedDecks(value: unknown, defaultHeroCardId: string | null): SavedDeck[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw): SavedDeck | null => {
      if (!raw || typeof raw !== 'object') return null;
      const deck = raw as { id?: unknown; name?: unknown; cards?: unknown; heroCardId?: unknown };
      if (typeof deck.id !== 'string' || typeof deck.name !== 'string' || !Array.isArray(deck.cards)) return null;
      const cards = deck.cards.filter((id): id is string => typeof id === 'string');
      const explicitHero = typeof deck.heroCardId === 'string' ? deck.heroCardId : null;
      const migratedHero = explicitHero ?? (defaultHeroCardId && cards.includes(defaultHeroCardId) ? defaultHeroCardId : null);
      return {
        id: deck.id,
        name: deck.name,
        cards,
        heroCardId: migratedHero && cards.includes(migratedHero) ? migratedHero : null,
      };
    })
    .filter((deck): deck is SavedDeck => deck !== null);
}
