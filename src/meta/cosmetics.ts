/** Account-level presentation choices. This module stays Phaser-free so save
 * migration, reward plumbing, and picker policy can share one catalog. */

export type CosmeticUnlock = 'default' | { readonly achievementId: string };

export interface CardBackDefinition {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly unlock: CosmeticUnlock;
}

export interface PlaymatColors {
  readonly backdrop: {
    readonly tint: number;
    readonly alpha: number;
    readonly fallbackTop: number;
    readonly fallbackBottom: number;
  };
  readonly stageLight: number;
  readonly stageLightAlpha: number;
  readonly opponentZone: { readonly fill: number; readonly alpha: number };
  readonly playerZone: { readonly fill: number; readonly alpha: number };
  readonly zoneStroke: number;
  readonly zoneStrokeAlpha: number;
}

export interface PlaymatDefinition {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly unlock: CosmeticUnlock;
  readonly colors: PlaymatColors;
}

export const DEFAULT_CARD_BACK_ID = 'back-violet-standard';
export const DEFAULT_PLAYMAT_ID = 'playmat-violet-stage';

export const CARD_BACKS = [
  {
    id: DEFAULT_CARD_BACK_ID,
    name: 'Violet Standard',
    blurb: 'The house back. Gold trim, violet gloom, no fuss.',
    unlock: 'default',
  },
  {
    id: 'back-ragnarok-storm-gold',
    name: 'Storm Gold',
    blurb: 'Thunder has a filing system. It is mostly gold.',
    unlock: 'default',
  },
  {
    id: 'back-silver-veil-moonlit',
    name: 'Moonlit Veil',
    blurb: 'Silver light, a patient crescent, and one secret kept behind glass.',
    unlock: 'default',
  },
  {
    id: 'back-dark-tales-storybook',
    name: 'Cursed Storybook',
    blurb: 'The cover is shut. The story is still making plans.',
    unlock: 'default',
  },
  {
    id: 'back-yokai-neon',
    name: 'Neon Yokai',
    blurb: 'Bright signs, bad omens, excellent timing.',
    unlock: 'default',
  },
] as const satisfies readonly CardBackDefinition[];

export const PLAYMATS = [
  {
    id: DEFAULT_PLAYMAT_ID,
    name: 'Violet Stage',
    blurb: 'The familiar table, dressed for another duel.',
    unlock: 'default',
    colors: {
      backdrop: { tint: 0x0a0812, alpha: 0.45, fallbackTop: 0x131022, fallbackBottom: 0x0a0812 },
      stageLight: 0xffd88a,
      stageLightAlpha: 0.05,
      opponentZone: { fill: 0x1a1530, alpha: 0.45 },
      playerZone: { fill: 0x1c1734, alpha: 0.5 },
      zoneStroke: 0x4a3f6e,
      zoneStrokeAlpha: 0.7,
    },
  },
  {
    id: 'playmat-ragnarok-storm-gold',
    name: 'Storm Gold',
    blurb: 'A warm eye in the weather. The lightning can wait its turn.',
    unlock: 'default',
    colors: {
      backdrop: { tint: 0x21150b, alpha: 0.5, fallbackTop: 0x2a1a0c, fallbackBottom: 0x100b08 },
      stageLight: 0xffc45a,
      stageLightAlpha: 0.08,
      opponentZone: { fill: 0x33200f, alpha: 0.48 },
      playerZone: { fill: 0x3b2410, alpha: 0.53 },
      zoneStroke: 0x8d672c,
      zoneStrokeAlpha: 0.78,
    },
  },
  {
    id: 'playmat-silver-veil-moonlit',
    name: 'Silver Veil',
    blurb: 'Moonlight on the board. Every shadow has a second opinion.',
    unlock: 'default',
    colors: {
      backdrop: { tint: 0x081321, alpha: 0.5, fallbackTop: 0x101f35, fallbackBottom: 0x070d18 },
      stageLight: 0xb8d8ff,
      stageLightAlpha: 0.08,
      opponentZone: { fill: 0x13253a, alpha: 0.48 },
      playerZone: { fill: 0x172d46, alpha: 0.53 },
      zoneStroke: 0x55789b,
      zoneStrokeAlpha: 0.76,
    },
  },
  {
    id: 'playmat-dark-tales-storybook',
    name: 'Storybook Table',
    blurb: 'A quiet page with a nasty little ending in reserve.',
    unlock: 'default',
    colors: {
      backdrop: { tint: 0x1b0e1d, alpha: 0.5, fallbackTop: 0x2b1527, fallbackBottom: 0x100a13 },
      stageLight: 0xe3a0c1,
      stageLightAlpha: 0.07,
      opponentZone: { fill: 0x32182d, alpha: 0.47 },
      playerZone: { fill: 0x3a1c33, alpha: 0.52 },
      zoneStroke: 0x895375,
      zoneStrokeAlpha: 0.76,
    },
  },
  {
    id: 'playmat-yokai-neon',
    name: 'Neon Crossroads',
    blurb: 'The signs are bright. The omens are keeping score.',
    unlock: 'default',
    colors: {
      backdrop: { tint: 0x07191a, alpha: 0.5, fallbackTop: 0x082c2d, fallbackBottom: 0x080d18 },
      stageLight: 0x55e8d5,
      stageLightAlpha: 0.07,
      opponentZone: { fill: 0x0b3030, alpha: 0.48 },
      playerZone: { fill: 0x0e3938, alpha: 0.53 },
      zoneStroke: 0x2d9c9b,
      zoneStrokeAlpha: 0.78,
    },
  },
] as const satisfies readonly PlaymatDefinition[];

export const COSMETIC_CATALOG = [...CARD_BACKS, ...PLAYMATS] as const;

export function cosmeticById(id: string): CardBackDefinition | PlaymatDefinition | undefined {
  return COSMETIC_CATALOG.find((entry) => entry.id === id);
}

export function isKnownCosmeticId(id: string): boolean {
  return cosmeticById(id) !== undefined;
}

export function isCosmeticOwned(id: string, owned: readonly string[]): boolean {
  const entry = cosmeticById(id);
  return entry?.unlock === 'default' || owned.includes(id);
}

/** Resolve the account choice to a texture key. Scenes still verify that the
 * returned key exists because Phaser textures are game-global and boot order
 * can differ in lightweight probes. */
export function cardBackTextureKey(id: string | null): string {
  const entry = id ? CARD_BACKS.find((candidate) => candidate.id === id) : undefined;
  if (!entry || entry.id === DEFAULT_CARD_BACK_ID) return 'cardback';
  return `cardback-${entry.id}`;
}

/**
 * Style is a property of the deck you built (v33). `null` is the CATALOG
 * default, not an inherited account value: every deck starts on Violet
 * Standard and the house playmat until it chooses otherwise (owner ruling
 * 2026-08-24). There is deliberately no account fallback here, so a deck's
 * look is answered entirely by the deck.
 */
export function resolveDeckCardBackId(
  deck: { readonly cardBack?: string | null } | null | undefined,
): string | null {
  return deck?.cardBack ?? null;
}

export function resolveDeckPlaymatId(
  deck: { readonly playmat?: string | null } | null | undefined,
): string | null {
  return deck?.playmat ?? null;
}

export function playmatForId(id: string | null): PlaymatDefinition {
  return PLAYMATS.find((entry) => entry.id === id) ?? PLAYMATS.find((entry) => entry.id === DEFAULT_PLAYMAT_ID)!;
}
