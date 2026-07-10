import type { CardDb, CardDef } from './cardTypes';
import { ARTIFACTS } from './cards/artifacts';
import { BEASTKIN } from './cards/beastkin';
import { CELTIC_FAE } from './cards/celtic-fae';
import { DUALS } from './cards/duals';
import { ENCHANTMENTS } from './cards/enchantments';
import { GREEK } from './cards/greek';
import { INSTANTS } from './cards/instants';
import { LANDS } from './cards/lands';
import { RAGNAROK } from './cards/ragnarok';
import { SORCERIES } from './cards/sorceries';
import { TK_JIN } from './cards/tk-jin';
import { TK_OTHER } from './cards/tk-other';
import { TK_SHU } from './cards/tk-shu';
import { TK_WEI } from './cards/tk-wei';
import { TK_WU } from './cards/tk-wu';
import { TOKENS } from './cards/tokens';

type SetKey = NonNullable<CardDef['set']>;

/**
 * Source arrays grouped by their expansion `set`. buildDb stamps every card
 * with its group's set (unless the card overrides it), so `set` is a single
 * source of truth here — no per-card boilerplate in the data files.
 */
const SET_GROUPS: readonly { set: SetKey; cards: readonly CardDef[] }[] = [
  { set: 'base', cards: TK_WEI },
  { set: 'base', cards: TK_WU },
  { set: 'base', cards: TK_SHU },
  { set: 'base', cards: TK_JIN },
  { set: 'base', cards: TK_OTHER },
  { set: 'base', cards: GREEK },
  { set: 'base', cards: BEASTKIN },
  { set: 'base', cards: INSTANTS },
  { set: 'base', cards: SORCERIES },
  { set: 'base', cards: ENCHANTMENTS },
  { set: 'base', cards: ARTIFACTS },
  { set: 'base', cards: DUALS },
  { set: 'base', cards: LANDS },
  { set: 'base', cards: TOKENS },
  { set: 'ragnarok', cards: RAGNAROK },
  { set: 'celtic-fae', cards: CELTIC_FAE },
];

function buildDb(): CardDb {
  const db: Record<string, CardDef> = {};
  for (const group of SET_GROUPS) {
    for (const card of group.cards) {
      if (db[card.id]) throw new Error(`Duplicate card id: ${card.id}`);
      db[card.id] = { ...card, set: card.set ?? group.set };
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
