/**
 * The community link on the main menu's top bar: the Discord server the game
 * lives in. Phaser-free, so the label choice is testable.
 */

export const COMMUNITY_LINK = {
  /** The desktop shell opens exactly this address (`OFFSITE_LINKS`, src-tauri/src/lib.rs). */
  href: 'https://discord.gg/aeRnFyvbtQ',
  /** The full label, then a shorter one, for a top bar with less room. */
  labels: ['Dreamers AI Hub: Darling Blades', 'Discord'],
} as const;

/**
 * The longest label whose button fits in `room`, given each label's measured
 * button width; null when none fits and the bar shows the icon alone.
 */
export function communityLinkLabel(room: number, buttonWidth: (label: string) => number): string | null {
  return COMMUNITY_LINK.labels.find((label) => buttonWidth(label) <= room) ?? null;
}
