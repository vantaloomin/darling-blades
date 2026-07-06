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
  completions: number; // full 8-rung clears
}

export interface SaveData {
  version: 9;
  createdAt: number;
  gold: number;
  collection: Record<string, number>; // cardId -> copies owned (aggregate across variants)
  /**
   * cardId -> variantKey (`${frame}|${holo}`, src/meta/variants.ts) -> count.
   * Invariant: per-card variant counts sum to `collection[cardId]`.
   */
  collectionVariants: Record<string, Record<string, number>>;
  decks: { id: string; name: string; cards: string[] }[];
  activeDeckId: string | null;
  starterChosen: string | null;
  /**
   * Player-chosen "hero" card whose art fronts the in-duel commander portrait
   * (any collected card). `null` = auto-derive from the active deck's face
   * (src/meta/deckFace.ts `faceCardFor`), the pre-v6 behavior.
   */
  heroCardId: string | null;
  /**
   * Player-chosen PREMIUM hero portrait (src/data/heroes.ts) — a bespoke,
   * non-card illustration unlocked only by owning its theme deck. Takes
   * precedence over `heroCardId` in the duel. `null` = none selected. v9
   * addition.
   */
  heroPortraitId: string | null;
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
const DEFAULT_RENDER_SCALE = 1.5; // 1080p — a crisp modern default; lite caps to 1

/** The gauntlet defaults spread into any save that lacks them. */
export function freshGauntlet(): GauntletState {
  return { run: null, bestRung: 0, completions: 0 };
}

export function freshSave(now: number): SaveData {
  return {
    version: 9,
    createdAt: now,
    gold: 0,
    collection: {},
    collectionVariants: {},
    decks: [],
    activeDeckId: null,
    starterChosen: null,
    heroCardId: null,
    heroPortraitId: null,
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
      autoSkip: true,
      confirmDestructive: true,
      keywordReminders: true,
    },
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

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
      if (parsed.version === 9) return parsed as SaveData;
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
   * (default on); v8 → v9 adds `heroPortraitId` (null = no premium hero). An
   * unknown/garbage version starts fresh rather than crash.
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
    if (cur.version === 9) return cur as unknown as SaveData;
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
}
