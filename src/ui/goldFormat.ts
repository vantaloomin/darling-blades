/**
 * One way to write gold (2026-10-09 UI review, finding 20): the screens
 * had `🪙 500`, `500g`, `+500 Gold` and `9999999` side by side. Prose and
 * captions say `1,250 gold`; compact controls (the wallet, Buy buttons)
 * draw the coin icon beside the grouped number (`goldPrice`).
 */

import { iconToken } from './iconLabel';

/** A count grouped by thousands: 1250 → "1,250". */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Gold in prose: "1,250 gold". */
export function formatGold(value: number): string {
  return `${formatCount(value)} gold`;
}

/** A price on a compact control: the coin, then the grouped number. */
export function goldPrice(value: number): string {
  return `${iconToken('gold')} ${formatCount(value)}`;
}
