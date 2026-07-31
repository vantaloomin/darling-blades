import { describe, expect, it } from 'vitest';
import {
  SHARD_FULL_ART_DISSOLVE_MS,
  SHARD_GOLD_COUNT_UP_MS,
  SHARD_HOLD_HIGH_VALUE_MS,
  SHARD_HOLD_LOW_VALUE_MS,
  SHARD_RITUAL_MS,
  shardCountUpValue,
  shardDissolveDuration,
  shardHoldDuration,
  shardMoteCount,
} from '../../src/ui/shardRitual';

describe('Collection shard ritual timing', () => {
  it('uses a 450ms hold below 500g and 900ms from 500g upward', () => {
    expect(shardHoldDuration(499)).toBe(SHARD_HOLD_LOW_VALUE_MS);
    expect(shardHoldDuration(500)).toBe(SHARD_HOLD_HIGH_VALUE_MS);
  });

  it('keeps the standard release near 620ms and gives Full Art the longer wipe', () => {
    expect(shardDissolveDuration(false)).toBe(SHARD_RITUAL_MS);
    expect(shardDissolveDuration(true)).toBe(SHARD_FULL_ART_DISSOLVE_MS);
  });

  it('counts gold up over the fixed 500ms window without overshooting', () => {
    expect(shardCountUpValue(120, 80, -1)).toBe(120);
    expect(shardCountUpValue(120, 80, SHARD_GOLD_COUNT_UP_MS / 2)).toBe(160);
    expect(shardCountUpValue(120, 80, SHARD_GOLD_COUNT_UP_MS + 1)).toBe(200);
  });

  it('removes motion at FX-off and reduces, rather than removes, the mote read', () => {
    expect(shardMoteCount(0)).toBe(0);
    expect(shardMoteCount(0.5)).toBe(8);
    expect(shardMoteCount(1)).toBe(16);
  });
});
