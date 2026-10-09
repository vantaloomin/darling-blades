import type { Color, Keyword, Rarity } from '../engine/types';
import {
  BODY_PER_ATTACK,
  BODY_PER_DEFENSE,
  BODY_TAPER,
  BODY_TAPER_FROM,
  KEYWORD_STACK_DISCOUNT,
  MANA_STEP,
  PIP_PREMIUM,
  RARITY_BONUS,
  keywordScales,
  keywordStackDiscount,
} from '../power/scoreCore';
import {
  builderHasType,
  cloneBuilderState,
  colorsForCost,
  evaluateBuilder,
  manaCostLabel,
  type BuilderState,
  type Evaluation,
} from './logic';
import { KEYWORD_NAMES } from '../data/glossary';
import {
  COLOR_PIE_KEYWORDS,
  COLOR_WORDS,
  OP_OPTIONS,
  RARITY_LABELS,
  RARITIES,
  keywordWorthSentence,
} from './vocab';

export type HintKind =
  | 'increase-cost'
  | 'reduce-cost'
  | 'add-pip'
  | 'increase-attack'
  | 'increase-defense'
  | 'decrease-attack'
  | 'decrease-defense'
  | 'add-keyword'
  | 'remove-keyword'
  | 'change-rarity'
  | 'drop-op';

export interface CostingHint {
  id: string;
  kind: HintKind;
  title: string;
  detail: string;
  /** Why the change moves the score, in plain words. */
  rateSource: string;
  movement: number;
  resultingDelta: number;
  nextState: BuilderState;
}

const round = (value: number): number => Math.round(value * 100) / 100;
const signed = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
const manaReason = `Each mana of cost adds ${MANA_STEP.toFixed(2)} to the Budget.`;
const taperSide = BODY_TAPER_FROM / 2;
const bodyReason = `Attack is worth ${BODY_PER_ATTACK.toFixed(2)} a point and Defense ${BODY_PER_DEFENSE.toFixed(2)}, `
  + `with each point past a ${taperSide}/${taperSide} worth ${BODY_TAPER.toFixed(2)} less.`;

/** "A and B", for player copy. */
function andList(names: readonly string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** An Attack hint also moves every keyword on the card that is priced on Attack. */
function attackReason(state: BuilderState): string {
  const scaled = state.keywords.filter(keywordScales).map((keyword) => KEYWORD_NAMES[keyword]);
  if (scaled.length === 0) return bodyReason;
  return `${bodyReason} ${andList(scaled)} ${scaled.length === 1 ? 'is' : 'are'} also priced on this card's Attack.`;
}

/** The stacking discount's side of adding or removing a keyword, or ''. */
function stackReason(before: readonly Keyword[], after: readonly Keyword[]): string {
  const was = keywordStackDiscount(before) !== 0;
  const now = keywordStackDiscount(after) !== 0;
  const size = Math.abs(KEYWORD_STACK_DISCOUNT).toFixed(2);
  if (!was && now) return ` Three or more keywords on one creature also take a ${size} stacking discount.`;
  if (was && !now) return ` It also lifts the ${size} discount for three or more keywords.`;
  return '';
}

function addCandidate(
  hints: CostingHint[],
  current: Evaluation,
  kind: HintKind,
  title: string,
  detail: string,
  rateSource: string,
  nextState: BuilderState,
  id: string,
): void {
  const resulting = evaluateBuilder(nextState).score.delta;
  if (Math.abs(resulting) >= Math.abs(current.score.delta) - 0.0001) return;
  hints.push({
    id,
    kind,
    title,
    detail,
    rateSource,
    movement: round(resulting - current.score.delta),
    resultingDelta: resulting,
    nextState,
  });
}

/**
 * How far to move one lever: every step count from 1 to `maxSteps` is scored,
 * and the one that lands closest to zero wins (the smaller move on a tie). So
 * a 12/2 that is far over value hears "Set Attack to 5", not "Set Attack to 11".
 */
function bestStep(
  current: Evaluation,
  maxSteps: number,
  apply: (steps: number) => BuilderState,
): BuilderState | null {
  let best: BuilderState | null = null;
  let bestDistance = Math.abs(current.score.delta);
  for (let steps = 1; steps <= maxSteps; steps += 1) {
    const next = apply(steps);
    const distance = Math.abs(evaluateBuilder(next).score.delta);
    if (distance < bestDistance - 0.0001) {
      best = next;
      bestDistance = distance;
    }
  }
  return best;
}

function keywordSuggestions(state: BuilderState): Keyword[] {
  const colors = colorsForCost(state.cost);
  const ordered = new Set<Keyword>();
  for (const color of colors) {
    for (const keyword of COLOR_PIE_KEYWORDS[color]) ordered.add(keyword);
  }
  if (ordered.size === 0) {
    ordered.add('sentinel');
    ordered.add('bulwark');
  }
  return [...ordered];
}

function addCostCandidates(hints: CostingHint[], state: BuilderState, current: Evaluation): void {
  if (state.cardType === 'land') return;
  const raised = bestStep(current, 9 - state.cost.generic, (steps) => {
    const next = cloneBuilderState(state);
    next.cost.generic += steps;
    return next;
  });
  if (raised) {
    addCandidate(
      hints,
      current,
      'increase-cost',
      'Increase Mana Cost',
      `Raise the cost to ${manaCostLabel(raised.cost)}.`,
      manaReason,
      raised,
      'increase-generic',
    );
  }
  const lowered = bestStep(current, state.cost.generic, (steps) => {
    const next = cloneBuilderState(state);
    next.cost.generic -= steps;
    return next;
  });
  if (lowered) {
    addCandidate(
      hints,
      current,
      'reduce-cost',
      'Reduce Mana Cost',
      `Lower the cost to ${manaCostLabel(lowered.cost)}.`,
      manaReason,
      lowered,
      'reduce-generic',
    );
  }

  const colors: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
  for (const color of colors) {
    const next = cloneBuilderState(state);
    next.cost.pips[color] += 1;
    addCandidate(
      hints,
      current,
      'add-pip',
      'Add a Colored Pip',
      `Change the cost to ${manaCostLabel(next.cost)}.`,
      `Adds ${MANA_STEP.toFixed(2)} for the mana and ${PIP_PREMIUM.toFixed(2)} for the ${COLOR_WORDS[color]} pip. The result includes any change to the off-color premium.`,
      next,
      `add-pip-${color}`,
    );
  }
  for (const color of colors) {
    if (state.cost.pips[color] <= 0) continue;
    const next = cloneBuilderState(state);
    next.cost.pips[color] -= 1;
    addCandidate(
      hints,
      current,
      'reduce-cost',
      'Reduce Mana Cost',
      `Remove one ${COLOR_WORDS[color]} pip for ${manaCostLabel(next.cost)}.`,
      `Removes ${MANA_STEP.toFixed(2)} for the mana and ${PIP_PREMIUM.toFixed(2)} for the ${COLOR_WORDS[color]} pip. The result includes any change to the off-color premium.`,
      next,
      `remove-pip-${color}`,
    );
  }
}

function addStatCandidates(hints: CostingHint[], state: BuilderState, current: Evaluation): void {
  if (!builderHasType(state, 'creature')) return;
  const levers = [
    ['increase-attack', 'Increase Attack', 'attack', 1],
    ['increase-defense', 'Increase Defense', 'defense', 1],
    ['decrease-attack', 'Reduce Attack', 'attack', -1],
    ['decrease-defense', 'Reduce Defense', 'defense', -1],
  ] as const;
  for (const [kind, title, field, amount] of levers) {
    const value = state[field];
    const next = bestStep(current, amount > 0 ? 12 - value : value, (steps) => {
      const moved = cloneBuilderState(state);
      moved[field] += amount * steps;
      return moved;
    });
    if (!next) continue;
    addCandidate(
      hints,
      current,
      kind,
      title,
      `Set ${field === 'attack' ? 'Attack' : 'Defense'} to ${next[field]}.`,
      field === 'attack' ? attackReason(state) : bodyReason,
      next,
      `${kind}-${next[field]}`,
    );
  }
}

function addKeywordCandidates(hints: CostingHint[], state: BuilderState, current: Evaluation): void {
  for (const keyword of state.keywords) {
    const next = cloneBuilderState(state);
    next.keywords = next.keywords.filter((candidate) => candidate !== keyword);
    addCandidate(
      hints,
      current,
      'remove-keyword',
      'Remove a Keyword',
      `Remove ${KEYWORD_NAMES[keyword]}.`,
      keywordWorthSentence(keyword, state.attack, state.keywords) + stackReason(state.keywords, next.keywords),
      next,
      `remove-keyword-${keyword}`,
    );
  }
  for (const keyword of keywordSuggestions(state)) {
    if (state.keywords.includes(keyword)) continue;
    const next = cloneBuilderState(state);
    next.keywords.push(keyword);
    addCandidate(
      hints,
      current,
      'add-keyword',
      'Add a Keyword',
      `Add ${KEYWORD_NAMES[keyword]}. It suits this card's colors.`,
      keywordWorthSentence(keyword, next.attack, next.keywords) + stackReason(state.keywords, next.keywords),
      next,
      `add-keyword-${keyword}`,
    );
  }
}

function addRarityCandidates(hints: CostingHint[], state: BuilderState, current: Evaluation): void {
  for (const rarity of RARITIES) {
    if (rarity === state.rarity) continue;
    const next = cloneBuilderState(state);
    next.rarity = rarity;
    const oldBonus = RARITY_BONUS[state.rarity];
    const newBonus = RARITY_BONUS[rarity];
    const bonusDelta = newBonus - oldBonus;
    addCandidate(
      hints,
      current,
      'change-rarity',
      `Change Rarity to ${RARITY_LABELS[rarity]}`,
      `The rarity bonus goes from ${oldBonus.toFixed(2)} to ${newBonus.toFixed(2)}.`,
      `The Budget changes by ${signed(bonusDelta)}, whatever the cost.`,
      next,
      `rarity-${rarity}`,
    );
  }
}

function addDropOpCandidates(hints: CostingHint[], state: BuilderState, current: Evaluation): void {
  state.abilities.forEach((ability, abilityIndex) => {
    if (ability.when === 'static') return;
    ability.ops.forEach((op, opIndex) => {
      const next = cloneBuilderState(state);
      next.abilities[abilityIndex].ops.splice(opIndex, 1);
      addCandidate(
        hints,
        current,
        'drop-op',
        'Drop an Effect',
        `Remove ${OP_OPTIONS.find((option) => option.kind === op.op)?.label ?? op.op} from ability ${abilityIndex + 1}.`,
        'The result is the card re-scored without that effect.',
        next,
        `drop-op-${abilityIndex}-${opIndex}`,
      );
    });
  });
}

export function candidateHints(state: BuilderState): CostingHint[] {
  const current = evaluateBuilder(state);
  if (current.band === 'accurate') return [];
  const hints: CostingHint[] = [];
  addCostCandidates(hints, state, current);
  addStatCandidates(hints, state, current);
  addKeywordCandidates(hints, state, current);
  addRarityCandidates(hints, state, current);
  addDropOpCandidates(hints, state, current);
  return hints.sort((a, b) => {
    const closeness = Math.abs(a.resultingDelta) - Math.abs(b.resultingDelta);
    if (Math.abs(closeness) > 0.0001) return closeness;
    return Math.abs(b.movement) - Math.abs(a.movement);
  });
}

export function buildHints(state: BuilderState, limit = 5): CostingHint[] {
  return candidateHints(state).slice(0, limit);
}

export function rarityDirection(current: Rarity, next: Rarity): 'up' | 'down' {
  return RARITIES.indexOf(next) > RARITIES.indexOf(current) ? 'up' : 'down';
}
