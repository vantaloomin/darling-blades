/**
 * One way to write gold (2026-10-09 UI review, finding 20): the screens
 * had `🪙 500`, `500g`, `+500 Gold` and `9999999` side by side. Prose and
 * captions say `1,250 gold`; compact controls (the wallet, Buy buttons)
 * draw the coin icon beside the grouped number, written in a label as the
 * `GOLD_ICON_TOKEN` placeholder. Phaser-free.
 */

/** A count grouped by thousands: 1250 → "1,250". */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Gold in prose: "1,250 gold". */
export function formatGold(value: number): string {
  return `${formatCount(value)} gold`;
}

/**
 * Stands in for the coin icon inside a button label: `Buy · {gold} 500`
 * draws "Buy ·", the coin, then "500". A label holds at most one.
 */
export const GOLD_ICON_TOKEN = '{gold}';

/** A price on a compact control: the coin, then the grouped number. */
export function goldPrice(value: number): string {
  return `${GOLD_ICON_TOKEN} ${formatCount(value)}`;
}

/** Split a label at the coin placeholder; `null` when it has none. */
export function splitGoldLabel(label: string): { head: string; tail: string } | null {
  const at = label.indexOf(GOLD_ICON_TOKEN);
  if (at < 0) return null;
  return { head: label.slice(0, at).trimEnd(), tail: label.slice(at + GOLD_ICON_TOKEN.length).trimStart() };
}
