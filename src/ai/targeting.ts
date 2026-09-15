import type { Action } from '../engine/actions';
import { castTargetSpecsFor } from '../engine/resolve';
import type { AbilityDef, CardDb, CardDef, EffectOp, Permanent, TargetRef, TargetSpec } from '../engine/types';
import { def } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { boundCastEffects, spellTargetsValue, targetValueForAbility } from './value';

export { targetValueForAbility } from './value';

type ChooseTargetAction = Extract<Action, { type: 'chooseTarget' }>;

function sourceAbility(view: PlayerView, db: CardDb): { source: Permanent | undefined; ability: AbilityDef } | undefined {
  const awaiting = view.awaiting;
  if (awaiting.kind !== 'chooseTarget') return undefined;
  const source = view.battlefield.find((perm) => perm.iid === awaiting.sourceIid);
  const pending = view.pendingDecisions?.find((decision) => decision.kind === 'chooseTarget' &&
    decision.sourceIid === awaiting.sourceIid && decision.abilityIndex === awaiting.abilityIndex);
  if (pending?.kind === 'chooseTarget') return { source, ability: { when: pending.triggerWhen ?? 'arrives', ops: pending.ops } };
  if (!source) return undefined;
  const ability = def(db, source.cardId).abilities?.[awaiting.abilityIndex];
  return ability ? { source, ability } : undefined;
}

/**
 * Public-board value of choosing `ref` for the currently queued arrival. A
 * strict `>` caller preserves the legalActions battlefield order on ties.
 */
export function targetChoiceValue(view: PlayerView, db: CardDb, ref: TargetRef): number {
  const ctx = sourceAbility(view, db);
  if (!ctx) return 0;
  return targetValueForAbility(view, db, ctx.source, ctx.ability, ref);
}

/** Greedy target selection shared by Easy and Medium, and as Hard's fallback. */
export function chooseTargetAction(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
): Action {
  const choices = legal.filter((action): action is ChooseTargetAction => action.type === 'chooseTarget');
  if (choices.length === 0) return legal[0];
  let best = choices[0];
  let bestValue = targetChoiceValue(view, db, best.target);
  for (const choice of choices.slice(1)) {
    const value = targetChoiceValue(view, db, choice.target);
    if (value > bestValue) {
      best = choice;
      bestValue = value;
    }
  }
  return best;
}

const NEW_TARGET_DATABASES = new WeakMap<CardDb, boolean>();
const hasTargetQualifier = (spec: TargetSpec): boolean => spec.exactly !== undefined ||
  spec.what === 'opponentCreature' || spec.maxCost !== undefined || spec.minAttack !== undefined;
const hasTargetBinding = (items: readonly EffectOp[]): boolean => items.some((op) =>
  'targetIndex' in op && op.targetIndex !== undefined || op.op === 'preventCombatTo' ||
  op.op === 'ifTargetMarked' && (hasTargetBinding(op.then) || hasTargetBinding(op.else ?? [])));
function databaseHasNewTargets(db: CardDb): boolean {
  const cached = NEW_TARGET_DATABASES.get(db);
  if (cached !== undefined) return cached;
  const found = Object.values(db).some((card) =>
    card.retell !== undefined && card.types.includes('creature') ||
    (card.abilities ?? []).some((ability) => (ability.targets ?? []).some(hasTargetQualifier) || hasTargetBinding(ability.ops ?? [])) ||
    (card.empower?.targets ?? []).some(hasTargetQualifier) || hasTargetBinding(card.empower?.ops ?? []));
  NEW_TARGET_DATABASES.set(db, found);
  return found;
}

/** Only new target shapes use this policy; shipped menus retain their identity. */
export function vocabularyCastTargetValue(view: PlayerView, db: CardDb, action: Action): number | undefined {
  if (action.type !== 'castSpell') return undefined;
  const cardId = (action.retell || action.whispers) && action.graveIndex !== undefined
    ? view.you.graveyard[action.graveIndex] : view.you.hand[action.handIndex];
  const card = def(db, cardId);
  const specs = castTargetSpecsFor(card, action.retell === true, action.hauntlinked === true, action.empowered === true);
  const ops = action.retell && card.retell?.ops ? card.retell.ops :
    (card.abilities ?? []).filter((ability) => ability.when === 'spell').flatMap((ability) => ability.ops ?? []);
  const newShape = specs.some(hasTargetQualifier) || hasTargetBinding(ops) ||
    action.retell === true && card.types.includes('creature') ||
    ops.some((op) => op.op === 'preventCombatTo');
  if (!newShape) return undefined;
  return spellTargetsValue(view, db, ops, action.targets ?? [], specs.length === 1 &&
    (specs[0].exactly !== undefined || specs[0].upTo !== undefined), action.x ?? 0) +
    (action.empowered ? spellTargetsValue(view, db, card.empower?.ops ?? [], action.targets ?? []) : 0);
}

/** Keep the best target assignment for each new cast mode before brain priorities. */
export function applyVocabularyTargetPolicy(view: PlayerView, db: CardDb, legal: Action[], keepTacticalTargets = false): Action[] {
  if (!databaseHasNewTargets(db)) return legal;
  const ranked = legal.map((action) => {
    let tacticalKey = '';
    // A board-only greedy tie-break must not discard the friendly rescue or
    // the combat-specific tap target before Medium/Hard inspect the window.
    if (keepTacticalTargets && action.type === 'castSpell') {
      const id = (action.retell || action.whispers) && action.graveIndex !== undefined
        ? view.you.graveyard[action.graveIndex] : view.you.hand[action.handIndex];
      const tactical = boundCastEffects(view, db, id, action).filter(({ op }) => op.op === 'recall' || op.op === 'tap' ||
        op.op === 'preventCombatTo' || op.op === 'moveMark' || op.op === 'removeMarks' ||
        op.op === 'addCounters' && op.to === 'target' || op.op === 'boost' && op.scope === 'target' && op.p + op.t <= 0);
      // Keep each tactical assignment, while still selecting the best value
      // in independent slots (for example reclaim + a battlefield Mark).
      if (tactical.length > 0) tacticalKey = JSON.stringify(tactical.map(({ targets }) => targets));
    }
    return { action, value: vocabularyCastTargetValue(view, db, action), tacticalKey };
  });
  if (!ranked.some((entry) => entry.value !== undefined)) return legal;
  const keyFor = (action: Action): string => {
    if (action.type !== 'castSpell') return '';
    return JSON.stringify({ ...action, targets: undefined });
  };
  const best = new Map<string, typeof ranked[number]>();
  for (const entry of ranked) {
    if (entry.value === undefined) continue;
    const key = keyFor(entry.action) + entry.tacticalKey;
    const previous = best.get(key);
    if (!previous || entry.value > previous.value!) best.set(key, entry);
  }
  return ranked.filter((entry) => entry.value === undefined || best.get(keyFor(entry.action) + entry.tacticalKey) === entry)
    .map((entry) => entry.action);
}

const VOCABULARY_CARDS = new WeakMap<CardDef, boolean>();
/** New vocabulary joins Hard's explicit cast candidates without widening old pools. */
export function isVocabularyCast(view: PlayerView, db: CardDb, action: Action): boolean {
  if (action.type !== 'castSpell') return false;
  const cardId = (action.retell || action.whispers) && action.graveIndex !== undefined
    ? view.you.graveyard[action.graveIndex] : view.you.hand[action.handIndex];
  const card = def(db, cardId);
  const cached = VOCABULARY_CARDS.get(card);
  if (cached !== undefined) return cached;
  const newOps = (ops: readonly EffectOp[]): boolean => ops.some((op) =>
    ['discard', 'sacrifice', 'tapAll', 'preventCombatTo', 'reclaimSelf'].includes(op.op) ||
    op.op === 'damage' && op.to === 'eachOpponentCreature' ||
    op.op === 'markAll' && op.other === true ||
    op.op === 'boost' && op.scope === 'self' ||
    op.op === 'createToken' && op.marks !== undefined ||
    op.op === 'raise' && op.grantKeywords !== undefined ||
    op.op === 'ifTargetMarked' && (newOps(op.then) || newOps(op.else ?? [])) ||
    hasTargetBinding([op]));
  const found = card.retell !== undefined && card.types.includes('creature') ||
    (card.abilities ?? []).some((ability) => (ability.targets ?? []).some(hasTargetQualifier) || newOps(ability.ops ?? [])) ||
    card.empower?.ops.some((op) => op.op === 'destroy') === true ||
    newOps(card.retell?.ops ?? []);
  VOCABULARY_CARDS.set(card, found);
  return found;
}
