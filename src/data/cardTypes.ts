/**
 * Data-layer re-exports of the engine's card schema. Data files import from
 * here so the authoring surface stays stable even if engine internals move.
 */
export type {
  AbilityDef,
  CardDb,
  CardDef,
  CardType,
  Color,
  EffectOp,
  Keyword,
  ManaCost,
  Rarity,
  StaticDef,
  TargetSpec,
  TriggerWhen,
} from '../engine/types';

import type { Color, ManaCost } from '../engine/types';

/** Cost shorthand: cost(2, 'RR') = {2}{R}{R}. */
export function cost(generic: number, pips = ''): ManaCost {
  const p: Partial<Record<Color, number>> = {};
  for (const ch of pips) {
    const c = ch as Color;
    p[c] = (p[c] ?? 0) + 1;
  }
  return { generic, pips: p };
}
