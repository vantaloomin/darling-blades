import { isSummoningSick } from './statics';
import type { CardDb, Color, GameState, ManaCost, PlayerId } from './types';
import { def, isType } from './types';

export interface ManaSource {
  iid: number;
  colors: Color[]; // colors this source can produce
  isLand: boolean;
}

/** Combine two costs without changing either input. Used by Empower so the
 * normal auto-tap and explicit mana-plan paths price one atomic cast cost. */
export function combineManaCosts(a: ManaCost, b: ManaCost): ManaCost {
  const pips: Partial<Record<Color, number>> = { ...a.pips };
  for (const color of Object.keys(b.pips) as Color[]) {
    pips[color] = (pips[color] ?? 0) + (b.pips[color] ?? 0);
  }
  return { generic: a.generic + b.generic, pips };
}

/** Untapped lands + untapped non-sick mana creatures controlled by `player`. */
export function manaSources(state: GameState, db: CardDb, player: PlayerId): ManaSource[] {
  const out: ManaSource[] = [];
  for (const perm of state.battlefield) {
    if (perm.controller !== player || perm.tapped) continue;
    const d = def(db, perm.cardId);
    if (!d.manaAbility || d.manaAbility.length === 0) continue;
    const isLand = isType(d, 'land');
    // Simplification (documented in the plan): summoning-sick mana creatures
    // cannot be tapped for mana — ramp arrives on a one-turn delay.
    if (!isLand && isSummoningSick(state.battlefield, db, perm)) continue;
    out.push({ iid: perm.iid, colors: [...d.manaAbility], isLand });
  }
  return out;
}

/**
 * Auto-tap solver: pick which sources to tap to pay `cost`, or null if
 * unpayable. Serves legality checks, the human's one-click casting, and the
 * AI (whose `reserve` holds back sources it wants to represent instants with).
 *
 * Greedy: colored pips first in ascending color-supply order, mono-producers
 * before flexible ones; generic paid with leftovers preferring lands (keep
 * creatures untapped as blockers). An exhaustive backtracking fallback covers
 * the corner cases greedy misses (source counts are tiny).
 */
export function solveMana(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  cost: ManaCost,
  extraGeneric = 0, // X payment
  reserve: readonly number[] = [],
): number[] | null {
  const sources = manaSources(state, db, player).filter((s) => !reserve.includes(s.iid));
  const totalNeeded = cost.generic + extraGeneric + pipCount(cost);
  if (sources.length < totalNeeded) return null;

  const pips: Color[] = [];
  for (const [color, n] of Object.entries(cost.pips) as [Color, number][]) {
    for (let i = 0; i < n; i++) pips.push(color);
  }

  const assignment = assignPips(pips, sources);
  if (!assignment) return null;

  const used = new Set(assignment);
  const leftovers = sources.filter((s) => !used.has(s.iid));

  // Generic: lands first, then mana creatures; within each, prefer sources
  // whose colors are over-represented among the leftovers (cheap flexibility
  // heuristic — spend the abundant color, keep the scarce one).
  const supply = colorSupply(leftovers);
  leftovers.sort((a, b) => {
    if (a.isLand !== b.isLand) return a.isLand ? -1 : 1;
    return maxSupply(b, supply) - maxSupply(a, supply) === 0
      ? a.colors.length - b.colors.length
      : maxSupply(b, supply) - maxSupply(a, supply);
  });

  const genericNeeded = cost.generic + extraGeneric;
  if (leftovers.length < genericNeeded) return null;
  for (let i = 0; i < genericNeeded; i++) assignment.push(leftovers[i].iid);

  return assignment;
}

/** Can `player` pay `cost` at all? (solveMana !== null, minus the allocation.) */
export function canPay(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  cost: ManaCost,
  extraGeneric = 0,
): boolean {
  return solveMana(state, db, player, cost, extraGeneric) !== null;
}

/**
 * Largest X such that cost + X is payable, or -1 if even X=0 fails.
 * Linear scan is fine: X is bounded by untapped source count (≤ ~15).
 */
export function maxPayableX(
  state: GameState,
  db: CardDb,
  player: PlayerId,
  cost: ManaCost,
): number {
  let x = -1;
  while (solveMana(state, db, player, cost, x + 1) !== null) x++;
  return x;
}

function pipCount(cost: ManaCost): number {
  let n = 0;
  for (const v of Object.values(cost.pips)) n += v;
  return n;
}

function colorSupply(sources: ManaSource[]): Map<Color, number> {
  const m = new Map<Color, number>();
  for (const s of sources) {
    for (const c of s.colors) m.set(c, (m.get(c) ?? 0) + 1);
  }
  return m;
}

function maxSupply(s: ManaSource, supply: Map<Color, number>): number {
  let best = 0;
  for (const c of s.colors) best = Math.max(best, supply.get(c) ?? 0);
  return best;
}

/** Assign one distinct source to every pip. Greedy first, backtracking fallback. */
function assignPips(pips: Color[], sources: ManaSource[]): number[] | null {
  if (pips.length === 0) return [];

  // Greedy: scarcest color first; for each pip take the producing source with
  // the fewest colors (mono before dual), lands before creatures on ties.
  const supply = colorSupply(sources);
  const order = [...pips].sort((a, b) => (supply.get(a) ?? 0) - (supply.get(b) ?? 0));
  const taken = new Set<number>();
  const greedy: number[] = [];
  let ok = true;
  for (const pip of order) {
    const candidates = sources
      .filter((s) => !taken.has(s.iid) && s.colors.includes(pip))
      .sort((a, b) =>
        a.colors.length !== b.colors.length
          ? a.colors.length - b.colors.length
          : a.isLand === b.isLand
            ? 0
            : a.isLand
              ? -1
              : 1,
      );
    if (candidates.length === 0) {
      ok = false;
      break;
    }
    taken.add(candidates[0].iid);
    greedy.push(candidates[0].iid);
  }
  if (ok) return greedy;

  // Backtracking fallback — exhaustive but tiny (≤ ~15 sources, ≤ ~5 pips).
  const result: number[] = [];
  const used = new Set<number>();
  const backtrack = (i: number): boolean => {
    if (i === order.length) return true;
    for (const s of sources) {
      if (used.has(s.iid) || !s.colors.includes(order[i])) continue;
      used.add(s.iid);
      result.push(s.iid);
      if (backtrack(i + 1)) return true;
      used.delete(s.iid);
      result.pop();
    }
    return false;
  };
  return backtrack(0) ? result : null;
}
