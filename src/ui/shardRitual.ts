/**
 * Presentation timings for the Collection sharding ritual. The economy call
 * remains in CollectionScene; these pure values make its confirmation affordance
 * and animation budget independently testable.
 */
export const SHARD_HOLD_LOW_VALUE_MS = 450;
export const SHARD_HOLD_HIGH_VALUE_MS = 900;
export const SHARD_VALUE_HOLD_THRESHOLD = 500;
export const SHARD_GOLD_COUNT_UP_MS = 500;
export const SHARD_RITUAL_MS = 620;
export const SHARD_FULL_ART_DISSOLVE_MS = 760;

/** A higher-value release asks for a deliberate, longer hold. */
export function shardHoldDuration(shardValue: number): number {
  return shardValue < SHARD_VALUE_HOLD_THRESHOLD ? SHARD_HOLD_LOW_VALUE_MS : SHARD_HOLD_HIGH_VALUE_MS;
}

/** Full Art gets a longer send-off without changing the underlying action. */
export function shardDissolveDuration(fullArt: boolean): number {
  return fullArt ? SHARD_FULL_ART_DISSOLVE_MS : SHARD_RITUAL_MS;
}

/** Integer readout for the badge's bounded count-up. */
export function shardCountUpValue(start: number, gained: number, elapsedMs: number): number {
  const progress = Math.max(0, Math.min(1, elapsedMs / SHARD_GOLD_COUNT_UP_MS));
  return start + Math.round(gained * progress);
}

/** Animations-off deliberately has no motes; reduced keeps a readable handful. */
export function shardMoteCount(particleScale: number): number {
  if (particleScale <= 0) return 0;
  return Math.max(4, Math.round(16 * Math.min(1, particleScale)));
}
