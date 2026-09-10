import type { CardDb, CardDef, EffectOp } from '../src/engine/types';
import { isType, validateActivatedDef } from '../src/engine/types';

/** The catalog gate, shared with fixture proofs before a card reaches Game. */
export function activatedCatalogErrors(card: CardDef, db: CardDb): string[] {
  const errors = validateActivatedDef(card);
  if (!card.activated) return errors;

  const candidates = (op: EffectOp): CardDef[] => {
    if (op.op === 'createToken') return db[op.token] ? [db[op.token]] : [];
    // These ops choose a card at runtime, so every matching definition in
    // the pool must be safe. Reclaim returns to hand, not the battlefield.
    if (op.op === 'raise') return Object.values(db).filter((d) => isType(d, 'creature'));
    if (op.op === 'fetchLand') return Object.values(db).filter((d) => isType(d, 'land'));
    return [];
  };
  const arrivalCanTarget = (entered: CardDef, visiting: ReadonlySet<string>): boolean => {
    if (visiting.has(entered.id)) return false;
    const seen = new Set(visiting).add(entered.id);
    const arrivals = (entered.abilities ?? []).filter((ability) => ability.when === 'arrives');
    if (arrivals.some((ability) => (ability.targets?.length ?? 0) > 0)) return true;
    return [...arrivals.flatMap((ability) => ability.ops ?? []), ...(entered.chapters?.[0] ?? [])]
      .some((op) => opCanTargetArrival(op, seen));
  };
  const opCanTargetArrival = (op: EffectOp, visiting: ReadonlySet<string>): boolean => {
    if (op.op === 'ifTargetMarked') {
      return [...op.then, ...(op.else ?? [])].some((nested) => opCanTargetArrival(nested, visiting));
    }
    return candidates(op).some((entered) => arrivalCanTarget(entered, visiting));
  };
  const inspect = (ops: EffectOp[]): void => {
    for (const op of ops) {
      if (op.op === 'ifTargetMarked') {
        inspect(op.then);
        inspect(op.else ?? []);
      } else if (op.op === 'createToken' && !db[op.token]) {
        errors.push(`Activated createToken references an unknown card: ${op.token}`);
      } else if (opCanTargetArrival(op, new Set())) {
        errors.push(`Activated ${op.op} can introduce a targeted arrival`);
      }
    }
  };
  inspect(card.activated.ops);
  return errors;
}
