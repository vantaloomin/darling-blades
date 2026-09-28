/**
 * Card-art residency: the budgets and the eviction rule (1.9 lane D, S1).
 *
 * The numbers and the least-recently-used policy the art store
 * (`src/art/artStore.ts`) evicts by, kept apart from the request machinery so
 * the thumbnail cache (S4) can run the same book over its own budget. Phaser
 * free and clock-free: every time is passed in, so the rule is tested
 * headless. Design: docs/plan-art-streaming.md, section 3.
 */

const MIB = 1024 * 1024;

/** Starting budgets per quality tier, in MiB (owner ruling 2026-09-28, question 2). */
export const ART_BUDGET_MIB = {
  full: { art: 640, thumbs: 192 },
  lite: { art: 160, thumbs: 48 },
} as const;

/** Eviction brings residency down to this share of the budget. */
export const ART_LOW_WATER = 0.85;
/** A texture released less than this long ago is kept... */
export const ART_RELEASE_GRACE_MS = 2000;
/** ...unless residency is over this share of the budget. */
export const ART_GRACE_CEILING = 1.25;
/** A key that failed both passes is asked for again only after this long. */
export const ART_FAILURE_BACKOFF_MS = 30_000;
/** The deferred second pass waits at least this long after the first pass failed. */
export const ART_RETRY_DELAY_MS = 1000;
/** Immediate re-sends after a transient failure, per pass (Phaser's `maxRetries`). */
export const ART_IMMEDIATE_RESENDS = 2;
/** Fetches in flight: the web, and the desktop app's local protocol. */
export const ART_WINDOW_WEB = 6;
export const ART_WINDOW_DESKTOP_APP = 8;
/** Uploads per frame, in half-file units: 4 full files (2 units each) or 8 half files. */
export const ART_UPLOAD_UNITS_PER_FRAME = 8;
/** The boot warm set may use at most this share of the art budget. */
export const ART_WARM_SET_SHARE = 0.25;

export type ArtQuality = 'full' | 'lite';

/**
 * The phone budget's multiplier from `navigator.deviceMemory` (owner ruling,
 * question 7): half at 2 GB or less, 1.5x at 8 GB or more, the base between
 * and wherever the browser does not say (Safari, Firefox, every iOS browser).
 * The desktop tier is never scaled.
 */
export function deviceMemoryScale(quality: ArtQuality, deviceMemoryGb: number | undefined): number {
  if (quality !== 'lite') return 1;
  if (deviceMemoryGb === undefined || !Number.isFinite(deviceMemoryGb) || deviceMemoryGb <= 0) return 1;
  if (deviceMemoryGb <= 2) return 0.5;
  if (deviceMemoryGb >= 8) return 1.5;
  return 1;
}

export interface ArtStoreEnv {
  quality: ArtQuality;
  /** `navigator.deviceMemory` in GB, where the browser exposes it. */
  deviceMemoryGb?: number;
  /** `location.search`, for the `?artBudget=<MiB>` and `?artEvict=off` switches. */
  search?: string;
  /** True inside the Tauri desktop app (loose files on the local protocol). */
  desktopApp?: boolean;
}

export interface ArtStoreConfig {
  /** Card-art source textures, in bytes (width x height x 4). */
  artBudgetBytes: number;
  /** Thumbnail bakes, in bytes. */
  thumbBudgetBytes: number;
  /** False under `?artEvict=off`: load on demand, never evict. */
  evict: boolean;
  /** Fetches in flight. */
  maxInFlight: number;
}

/**
 * Everything the store is built with, from the environment. `?artBudget=<MiB>`
 * (the eviction stress run) replaces the art budget and scales the thumb
 * budget by the same factor, so both evict under stress; `?artEvict=off` (the
 * shipped fallback, question 8) turns eviction off on any tier.
 */
export function artStoreConfig(env: ArtStoreEnv): ArtStoreConfig {
  const base = ART_BUDGET_MIB[env.quality];
  const params = new URLSearchParams(env.search ?? '');
  const override = Number(params.get('artBudget'));
  const scale =
    params.has('artBudget') && Number.isFinite(override) && override > 0
      ? override / base.art
      : deviceMemoryScale(env.quality, env.deviceMemoryGb);
  return {
    artBudgetBytes: Math.round(base.art * scale * MIB),
    thumbBudgetBytes: Math.round(base.thumbs * scale * MIB),
    evict: params.get('artEvict') !== 'off',
    maxInFlight: env.desktopApp ? ART_WINDOW_DESKTOP_APP : ART_WINDOW_WEB,
  };
}

/** Bytes a decoded texture occupies: the same width x height x 4 rule as the "before" numbers. */
export function textureBytes(width: number, height: number): number {
  return Math.max(0, Math.round(width)) * Math.max(0, Math.round(height)) * 4;
}

interface Entry {
  bytes: number;
  lastUse: number;
  /** Order of first residency, the tie-break when two uses share a time. */
  order: number;
  /** When the last pin on this key was released, or null if never released while resident. */
  releasedAt: number | null;
}

export interface EvictionCandidate {
  key: string;
  /** Inside the release grace window. */
  inGrace: boolean;
}

export interface EvictionPolicy {
  lowWater?: number;
  graceMs?: number;
  graceCeiling?: number;
}

/**
 * The residency book: what is resident, how big, how recently used, and what
 * is pinned. Pins are counted per key and may precede residency (a lease on a
 * key still loading). Keys are whatever the owner uses: texture keys for the
 * art store, thumb keys for the thumbnail cache.
 */
export class ResidencyBook {
  private readonly entries = new Map<string, Entry>();
  private readonly pins = new Map<string, number>();
  private resident = 0;
  private nextOrder = 0;

  has(key: string): boolean {
    return this.entries.has(key);
  }

  bytesOf(key: string): number {
    return this.entries.get(key)?.bytes ?? 0;
  }

  get residentBytes(): number {
    return this.resident;
  }

  get pinnedBytes(): number {
    let total = 0;
    for (const [key, entry] of this.entries) if (this.isPinned(key)) total += entry.bytes;
    return total;
  }

  get count(): number {
    return this.entries.size;
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }

  isPinned(key: string): boolean {
    return (this.pins.get(key) ?? 0) > 0;
  }

  /** Record `key` as resident (or re-measure it); counts as a use. */
  setResident(key: string, bytes: number, now: number): void {
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      this.resident += bytes - existing.bytes;
      existing.bytes = bytes;
      existing.lastUse = now;
      return;
    }
    this.entries.set(key, { bytes, lastUse: now, order: this.nextOrder++, releasedAt: null });
    this.resident += bytes;
  }

  /** Forget `key` (evicted or removed). Pins are kept: a pinned key may come back. */
  drop(key: string): void {
    const entry = this.entries.get(key);
    if (entry === undefined) return;
    this.entries.delete(key);
    this.resident -= entry.bytes;
  }

  touch(key: string, now: number): void {
    const entry = this.entries.get(key);
    if (entry !== undefined && now > entry.lastUse) entry.lastUse = now;
  }

  pin(key: string, now: number): void {
    this.pins.set(key, (this.pins.get(key) ?? 0) + 1);
    const entry = this.entries.get(key);
    if (entry !== undefined) entry.releasedAt = null;
    this.touch(key, now);
  }

  unpin(key: string, now: number): void {
    const count = this.pins.get(key) ?? 0;
    if (count <= 1) {
      this.pins.delete(key);
      const entry = this.entries.get(key);
      if (entry !== undefined && count === 1) {
        entry.releasedAt = now;
        this.touch(key, now);
      }
      return;
    }
    this.pins.set(key, count - 1);
  }

  /** Every pinned key, resident or not. */
  pinnedKeys(): string[] {
    return [...this.pins.keys()];
  }

  /**
   * Unpinned resident keys in the order they would go: least recently used
   * first, keys outside the release grace before keys inside it.
   */
  candidates(now: number, graceMs = ART_RELEASE_GRACE_MS): EvictionCandidate[] {
    const free: [string, Entry][] = [];
    const grace: [string, Entry][] = [];
    for (const pair of this.entries) {
      if (this.isPinned(pair[0])) continue;
      const releasedAt = pair[1].releasedAt;
      (releasedAt !== null && now - releasedAt < graceMs ? grace : free).push(pair);
    }
    const byUse = (a: [string, Entry], b: [string, Entry]): number =>
      a[1].lastUse - b[1].lastUse || a[1].order - b[1].order;
    free.sort(byUse);
    grace.sort(byUse);
    return [
      ...free.map(([key]) => ({ key, inGrace: false })),
      ...grace.map(([key]) => ({ key, inGrace: true })),
    ];
  }

  /**
   * The keys to evict now against `budget`, or none while residency is within
   * it. Keys outside the grace go first, least recently used first, until
   * residency is at the low-water mark. Keys inside the grace go only while
   * residency is over the grace ceiling, and only back down to the budget.
   * `skip` holds keys that must stay (the shell's safety scan found them drawn).
   */
  planEviction(
    now: number,
    budget: number,
    skip: ReadonlySet<string> = new Set(),
    policy: EvictionPolicy = {},
  ): string[] {
    if (this.resident <= budget) return [];
    const lowWater = budget * (policy.lowWater ?? ART_LOW_WATER);
    const ceiling = budget * (policy.graceCeiling ?? ART_GRACE_CEILING);
    // Decided when the first grace key comes up, against what is left then.
    let graceAllowed: boolean | null = null;
    let projected = this.resident;
    const out: string[] = [];
    for (const candidate of this.candidates(now, policy.graceMs ?? ART_RELEASE_GRACE_MS)) {
      if (skip.has(candidate.key)) continue;
      if (candidate.inGrace) {
        graceAllowed ??= projected > ceiling;
        if (!graceAllowed || projected <= budget) break;
      } else if (projected <= lowWater) {
        continue;
      }
      out.push(candidate.key);
      projected -= this.bytesOf(candidate.key);
    }
    return out;
  }

  /** The earliest time a grace window held back by `planEviction` ends, or null. */
  nextGraceExpiry(now: number, graceMs = ART_RELEASE_GRACE_MS): number | null {
    let next: number | null = null;
    for (const [key, entry] of this.entries) {
      if (this.isPinned(key) || entry.releasedAt === null) continue;
      const ends = entry.releasedAt + graceMs;
      if (ends > now && (next === null || ends < next)) next = ends;
    }
    return next;
  }
}
