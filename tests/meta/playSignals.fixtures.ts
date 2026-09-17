import type { CardDb, CardDef, Color } from '../../src/engine/types';
import { freshSave, type SaveData, type SavedDeck } from '../../src/meta/SaveManager';

/**
 * Fixtures for the playSignals privacy tests. The sentinel is deliberately
 * unlike any card id, deck id, bucket label or enum value in the game, so a
 * substring search over the serialised payloads is a meaningful assertion.
 */
export const SENTINEL = 'ZZQX-PLAYER-TYPED-SENTINEL-7781';

/**
 * Distinctive raw numbers. None of them is a bucket edge, so if any appears in
 * a payload it got there as a raw count rather than as a bucket label.
 */
export const RAW = {
  wins: 1234567,
  losses: 7654321,
  packs: 2345671,
  streak: 3456712,
  bestRung: 4567123,
  turns: 5671234,
  mulligans: 6712345,
  collectionCopies: 7123456,
} as const;

function cost(generic: number, pips: Partial<Record<Color, number>> = {}) {
  return { generic, pips };
}

function creature(id: string, colors: Color[], generic: number, pips: Partial<Record<Color, number>> = {}): CardDef {
  return { id, name: id, types: ['creature'], subtypes: [], colors, cost: cost(generic, pips), rarity: 'c' };
}

/** A small injected pool: colour identity and curve are measured against this, never the catalog. */
export const TINY_DB: CardDb = {
  'fx-white-two': creature('fx-white-two', ['W'], 1, { W: 1 }),
  'fx-blue-three': creature('fx-blue-three', ['U'], 2, { U: 1 }),
  'fx-black-five': creature('fx-black-five', ['B'], 4, { B: 1 }),
  'fx-red-one': creature('fx-red-one', ['R'], 0, { R: 1 }),
  'fx-green-four': creature('fx-green-four', ['G'], 3, { G: 1 }),
  'fx-colourless-six': { id: 'fx-colourless-six', name: 'fx-colourless-six', types: ['artifact'], subtypes: [], colors: [], cost: cost(6), rarity: 'r' },
  'fx-token-bear': { id: 'fx-token-bear', name: 'fx-token-bear', types: ['creature'], subtypes: [], colors: ['G'], cost: cost(2), rarity: 'c', token: true },
  'land-plains': { id: 'land-plains', name: 'land-plains', types: ['land'], subtypes: [], colors: [], supertypes: ['basic'], manaAbility: ['W'], rarity: 'c' },
  'land-island': { id: 'land-island', name: 'land-island', types: ['land'], subtypes: [], colors: [], supertypes: ['basic'], manaAbility: ['U'], rarity: 'c' },
  'fx-dual-land': { id: 'fx-dual-land', name: 'fx-dual-land', types: ['land'], subtypes: [], colors: [], manaAbility: ['W', 'U'], rarity: 'r' },
};

function sentinelDeck(id: string): SavedDeck {
  return {
    id,
    // Every player-typeable string in the save schema is a deck name; this is
    // the field the whole sentinel assertion exists for.
    name: `${SENTINEL} ${id}`,
    cards: ['fx-white-two', 'fx-blue-three', 'fx-black-five'],
    heroCardId: null,
    landStyle: null,
    format: 'constructed',
  };
}

/**
 * A save carrying the sentinel wherever a player can type, and distinctive raw
 * numbers wherever a count exists.
 */
export function richSave(): SaveData {
  const save = freshSave(1_700_000_000_000);
  save.decks = [sentinelDeck('deck-alpha'), sentinelDeck('deck-beta')];
  save.activeDeckId = 'deck-alpha';
  save.stats.wins = RAW.wins;
  save.stats.losses = RAW.losses;
  save.stats.packsOpened = RAW.packs;
  save.daily.streak.count = RAW.streak;
  save.gauntlet.bestRung = RAW.bestRung;
  save.tutorialDone = true;
  save.settings.animations = 'reduced';
  save.settings.renderScale = 1.5;
  save.collection = {
    'fx-white-two': RAW.collectionCopies,
    'fx-blue-three': 2,
    'fx-black-five': 1,
  };
  return save;
}

/**
 * The same save with a plausible account block bolted on. Accounts do not exist
 * yet; this exists so a later wave cannot quietly make signing in observable.
 */
export const ACCOUNT_VALUES = {
  id: 'acc-9f3c1d6e-0000-4a2b-8f11-deadbeefcafe',
  email: 'player.one@example.invalid',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ZZQXSIGNEDINPAYLOAD.ZZQXSIGNATURE',
  deviceId: 'dev-0123456789abcdef',
} as const;

export function signedInSave(): SaveData {
  const save = richSave();
  (save as unknown as Record<string, unknown>).cloud = {
    accountId: ACCOUNT_VALUES.id,
    email: ACCOUNT_VALUES.email,
    jwt: ACCOUNT_VALUES.token,
    deviceId: ACCOUNT_VALUES.deviceId,
    revision: 12,
  };
  return save;
}
