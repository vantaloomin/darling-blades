/**
 * The study's deck field, all Warchest (the standard format players build):
 *
 * - the sweep's reference field, the 15 starter and theme prefabs in their
 *   Warchest form, read from a round-0 craft's `fieldComposition`;
 * - the eight decks the 1.9.0 sweep crafted in round 0 (one per persona),
 *   which carry First Dawn cards;
 * - the six First Dawn summit bosses' decks (rungs 23 to 28), piloted here by
 *   the same neutral Hard brain as every other deck.
 *
 * The craft files come from the `sweep-data` branch, so nothing new is
 * committed under src/.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avatarForRung } from '../../src/data/opponents';

export interface StudyDeck {
  id: string;
  name: string;
  kind: 'prefab' | 'craft' | 'boss';
  deck: string[];
  landReserve: string[];
}

interface CraftFile {
  personaId: string;
  round: number;
  deck: string[];
  landReserve: string[];
  fieldComposition: { kind: string; id: string; name: string; deck: string[]; landReserve: string[] }[];
}

export const SUMMIT_RUNGS = [23, 24, 25, 26, 27, 28] as const;

export function loadField(craftsDir: string): StudyDeck[] {
  const crafts = readdirSync(craftsDir)
    .filter((f) => /^craft-[a-z-]+-r0\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(craftsDir, f), 'utf8')) as CraftFile);
  if (crafts.length === 0) throw new Error(`no round-0 crafts in ${craftsDir}`);
  const reference = crafts[0].fieldComposition;
  const refKey = JSON.stringify(reference);
  for (const c of crafts) {
    if (JSON.stringify(c.fieldComposition) !== refKey) {
      throw new Error(`craft ${c.personaId} was measured against a different field`);
    }
  }
  const field: StudyDeck[] = reference.map((r) => ({
    id: r.id,
    name: r.name,
    kind: 'prefab',
    deck: [...r.deck],
    landReserve: [...r.landReserve],
  }));
  for (const c of crafts) {
    field.push({
      id: `craft-${c.personaId}`,
      name: `Crafted ${c.personaId}`,
      kind: 'craft',
      deck: [...c.deck],
      landReserve: [...c.landReserve],
    });
  }
  for (const rung of SUMMIT_RUNGS) {
    const a = avatarForRung(rung);
    field.push({
      id: `r${rung}-${a.id}`,
      name: `R${rung} ${a.name}`,
      kind: 'boss',
      deck: [...a.reserveDeck],
      landReserve: [...a.landReserve],
    });
  }
  return field;
}

/** Every unordered pair, row index below column index, in a fixed order. */
export function fieldPairs(n: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = r + 1; c < n; c++) pairs.push([r, c]);
  return pairs;
}

/**
 * Cell-index base for the study, clear of every base in balance-matrix.ts's
 * registry (the highest in use is warchest tuning's 170_000 band). Game g of
 * pair p is seed (BASE + p) * 100_000 + g in every life arm, which is what
 * pairs the arms game for game: same shuffles, same AI seeds, same seats.
 */
export const LIFE_STUDY_CELL_BASE = 200_000;

export function gameSeed(pair: number, game: number): number {
  return (LIFE_STUDY_CELL_BASE + pair) * 100_000 + game;
}
