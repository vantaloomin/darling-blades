import type { Color, Keyword, Rarity } from '../engine/types';
import {
  BODY_PER_STAT,
  KEYWORD_VALUE,
  MANA_STEP,
  PIP_PREMIUM,
  RARITY_BONUS,
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
import { COLOR_PIE_KEYWORDS, COLOR_WORDS, OP_OPTIONS, RARITY_LABELS, RARITIES } from './vocab';

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
  if (state.cost.generic < 9) {
    const next = cloneBuilderState(state);
    next.cost.generic += 1;
    addCandidate(
      hints,
      current,
      'increase-cost',
      'Increase Mana Cost',
      `Raise the cost to ${manaCostLabel(next.cost)}.`,
      manaReason,
      next,
      'increase-generic',
    );
  }
  if (state.cost.generic > 0) {
    const next = cloneBuilderState(state);
    next.cost.generic -= 1;
    addCandidate(
      hints,
      current,
      'reduce-cost',
      'Reduce Mana Cost',
      `Lower the cost to ${manaCostLabel(next.cost)}.`,
      manaReason,
      next,
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
    if ((amount > 0 && value >= 12) || (amount < 0 && value <= 0)) continue;
    const next = cloneBuilderState(state);
    next[field] += amount;
    addCandidate(
      hints,
      current,
      kind,
      title,
      `Set ${field === 'attack' ? 'Attack' : 'Defense'} to ${next[field]}.`,
      `Each point of Attack or Defense is worth ${BODY_PER_STAT.toFixed(2)}.`,
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
      `${KEYWORD_NAMES[keyword]} is worth ${signed(KEYWORD_VALUE[keyword])}.`,
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
      `${KEYWORD_NAMES[keyword]} is worth ${signed(KEYWORD_VALUE[keyword])}.`,
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
