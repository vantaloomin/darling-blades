import type { CardDb, CardDef } from './cardTypes';
import { ARTIFACTS } from './cards/artifacts';
import { BEASTKIN } from './cards/beastkin';
import { DUALS } from './cards/duals';
import { ENCHANTMENTS } from './cards/enchantments';
import { GREEK } from './cards/greek';
import { INSTANTS } from './cards/instants';
import { LANDS } from './cards/lands';
import { SORCERIES } from './cards/sorceries';
import { TK_JIN } from './cards/tk-jin';
import { TK_OTHER } from './cards/tk-other';
import { TK_SHU } from './cards/tk-shu';
import { TK_WEI } from './cards/tk-wei';
import { TK_WU } from './cards/tk-wu';
import { TOKENS } from './cards/tokens';

const SETS: readonly (readonly CardDef[])[] = [
  TK_WEI,
  TK_WU,
  TK_SHU,
  TK_JIN,
  TK_OTHER,
  GREEK,
  BEASTKIN,
  INSTANTS,
  SORCERIES,
  ENCHANTMENTS,
  ARTIFACTS,
  DUALS,
  LANDS,
  TOKENS,
];

function buildDb(): CardDb {
  const db: Record<string, CardDef> = {};
  for (const set of SETS) {
    for (const card of set) {
      if (db[card.id]) throw new Error(`Duplicate card id: ${card.id}`);
      db[card.id] = card;
    }
  }
  return Object.freeze(db);
}

/** The full card database. Injected into Game; scanned by scenes. */
export const CARD_DB: CardDb = buildDb();

export const ALL_CARDS: readonly CardDef[] = Object.values(CARD_DB);

export function byId(id: string): CardDef {
  const d = CARD_DB[id];
  if (!d) throw new Error(`Unknown card id: ${id}`);
  return d;
}
