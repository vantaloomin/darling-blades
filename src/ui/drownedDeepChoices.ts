/** Pure presentations of existing engine decisions. The engine owns legality. */
import { validateAction, type Action } from '../engine/actions';
import {
  activatedAbilitiesOf, def, type ActivatedDef, type CardDb, type CardDef,
  type GameState, type PlayerId, type TargetRef, type TargetSpec,
} from '../engine/types';
import { sacrificeCandidates, toggleSacrifice } from './castSacrifice';
import { targetAbilityText, targetPromptTitle, type DutyAction } from './duelPresentation';
import { activatedText } from './rulesText';

export type DiscardAction = Extract<Action, { type: 'discard' }>;
export type ChooseTargetAction = Extract<Action, { type: 'chooseTarget' }>;

export interface MandatorySelection<A extends Action> {
  count: number;
  candidates: number[];
  remaining: number;
  prompt: string;
  progress: string;
  canCancel: false;
  action: A | null;
}

function selectionCopy(verb: string, count: number, selected: readonly number[]) {
  const remaining = Math.max(0, count - selected.length);
  return { count, remaining, prompt: `${verb} ${count}`, progress: `${remaining} remaining`, canCancel: false as const };
}

/** The same exact-count toggle as Rite; hand indices distinguish duplicate cards. */
export function toggleLootDiscard(selected: readonly number[], index: number, candidates: readonly number[], count: number): number[] {
  return toggleSacrifice(selected, index, candidates, count);
}

export function lootDiscardSelection(
  state: GameState, db: CardDb, player: PlayerId, selected: readonly number[],
): MandatorySelection<DiscardAction> | null {
  const awaiting = state.awaiting;
  const pending = state.pendingDecisions[0];
  if (awaiting.kind !== 'discardToHandSize' || awaiting.decision !== 'discard' || awaiting.player !== player ||
    pending?.kind !== 'discard' || pending.player !== player) return null;
  const candidates = state.players[player].hand.map((_, index) => index);
  const action: DiscardAction = { type: 'discard', handIndices: [...selected].sort((a, b) => a - b) };
  return {
    ...selectionCopy('Discard', awaiting.count, selected), candidates,
    action: validateAction(state, db, player, action) === null ? action : null,
  };
}

/** Edicts reuse Rite's candidates and toggle, but submit the pending target choice. */
export function edictSacrificeSelection(
  state: GameState, db: CardDb, player: PlayerId, selected: readonly number[],
): (MandatorySelection<ChooseTargetAction> & { sourceCardId: string }) | null {
  const awaiting = state.awaiting;
  const pending = state.pendingDecisions[0];
  if (awaiting.kind !== 'chooseTarget' || awaiting.decision !== 'sacrifice' || awaiting.player !== player ||
    pending?.kind !== 'sacrifice' || pending.player !== player) return null;
  const ownCreatures = sacrificeCandidates(state, db, player);
  const candidates = awaiting.targets.flatMap((target) => target.kind === 'permanent' && ownCreatures.includes(target.iid)
    ? [target.iid] : []);
  const chosen: ChooseTargetAction = { type: 'chooseTarget', target: { kind: 'permanent', iid: selected[0] } };
  const valid = selected.length === pending.n && new Set(selected).size === selected.length &&
    selected.every((iid) => candidates.includes(iid)) && validateAction(state, db, player, chosen) === null;
  return { ...selectionCopy('Sacrifice', pending.n, selected), candidates, sourceCardId: pending.sourceCardId, action: valid ? chosen : null };
}

export interface DutyChoice {
  abilityIndex: number;
  line: string;
  cost: ActivatedDef['cost'];
  actions: DutyAction[];
  enabled: boolean;
}

/** Disabled abilities remain visible; an enabled entry retains engine action identities. */
export function dutyChoices(card: CardDef, iid: number, actions: readonly Action[]): DutyChoice[] {
  return activatedAbilitiesOf(card).map((ability, abilityIndex) => {
    const offered = actions.filter((action): action is DutyAction => action.type === 'activate' &&
      action.iid === iid && (action.abilityIndex ?? 0) === abilityIndex);
    return {
      abilityIndex, line: activatedText({ ...card, activated: ability }) ?? '', cost: ability.cost,
      actions: offered, enabled: offered.length > 0,
    };
  });
}

function pendingTarget(state: GameState, player: PlayerId) {
  const awaiting = state.awaiting;
  const pending = state.pendingDecisions[0];
  return awaiting.kind === 'chooseTarget' && awaiting.decision === undefined && awaiting.player === player &&
    pending?.kind === 'chooseTarget' && pending.player === player &&
    pending.sourceIid === awaiting.sourceIid && pending.abilityIndex === awaiting.abilityIndex ? pending : null;
}

function sameTarget(a: TargetRef, b: TargetRef): boolean {
  if (a.kind === 'permanent' && b.kind === 'permanent') return a.iid === b.iid;
  if (a.kind === 'player' && b.kind === 'player') return a.player === b.player;
  if (a.kind === 'stackItem' && b.kind === 'stackItem') return a.sid === b.sid;
  return a.kind === 'grave' && b.kind === 'grave' && a.player === b.player && a.index === b.index;
}

/** One validation path for keyboard and pointer, including stale source/target guards. */
export function confirmDeferredTarget(state: GameState, db: CardDb, player: PlayerId, target: TargetRef): ChooseTargetAction | null {
  if (!pendingTarget(state, player) || state.awaiting.kind !== 'chooseTarget') return null;
  const offered = state.awaiting.targets.find((candidate) => sameTarget(candidate, target));
  if (!offered) return null;
  const action: ChooseTargetAction = { type: 'chooseTarget', target: offered };
  return validateAction(state, db, player, action) === null ? action : null;
}

function targetChoiceNoun(spec: TargetSpec): string {
  const nouns: Record<TargetSpec['what'], string> = {
    creature: 'creature', player: 'player', any: 'creature or player', spell: 'spell',
    yourCreature: 'creature you control', opponentCreature: 'creature an opponent controls',
    yourPermanent: 'permanent you control', yourGraveCreature: 'creature card from your graveyard',
    artifact: 'artifact', enchantment: 'enchantment', artifactOrEnchantment: 'artifact or enchantment',
  };
  const adjectives = [spec.marked ? 'Marked' : '', spec.tapped ? 'tapped' : ''].filter(Boolean);
  const restrictions = [
    spec.maxCost === undefined ? '' : `cost ${spec.maxCost} or less`,
    spec.minAttack === undefined ? '' : `attack ${spec.minAttack} or more`,
  ].filter(Boolean);
  const noun = [...adjectives, nouns[spec.what]].join(' ');
  const article = spec.other ? 'another' : /^[aeiou]/i.test(noun) ? 'an' : 'a';
  return `${article} ${noun}${restrictions.length ? ` with ${restrictions.join(' and ')}` : ''}`;
}

/** The pending card id still identifies a trigger after its source leaves the board. */
export function deferredTargetPrompt(state: GameState, db: CardDb, player: PlayerId) {
  const pending = pendingTarget(state, player);
  if (!pending) return null;
  const card = def(db, pending.sourceCardId);
  const when = pending.triggerWhen ?? card.abilities?.[pending.abilityIndex]?.when ?? 'arrives';
  const event = when === 'attacks' ? ' attacks' : when === 'dawn' ? ' at Dawn' : when === 'sunset' ? ' at Sunset' : '';
  return {
    sourceCardId: card.id,
    title: when === 'arrives' ? targetPromptTitle(card.name) : `${card.name}${event}: choose ${targetChoiceNoun(pending.spec)}`,
    text: targetAbilityText(card, pending.abilityIndex), canCancel: false as const,
  };
}

/** Foresee's card size and center line, with bounded pages for arbitrarily large hands. */
export const LOOT_PICKER_LAYOUT = {
  width: 1280, height: 720, titleY: 118, titleWidth: 1000, titleHeight: 40,
  progressY: 158, progressWidth: 1000, progressHeight: 28,
  cardY: 366, cardScale: 0.62, pageSize: 5, cardSpacing: 210, selectedLift: 20, badgeOffset: 18,
  confirm: { x: 640, y: 600, width: 180, height: 60 },
  previous: { x: 280, y: 600, width: 140, height: 60 },
  next: { x: 1000, y: 600, width: 140, height: 60 },
} as const;

export const DUTY_CHOOSER_LAYOUT = {
  x: 640, titleY: 130, top: 210, width: 640, rowHeight: 104, rowGap: 8, pageSize: 3,
  footerY: 602, cancelY: 666,
  previous: { x: 400, y: 602, width: 140, height: 48 },
  next: { x: 880, y: 602, width: 140, height: 48 },
  cancel: { x: 640, y: 666, width: 180, height: 44 },
} as const;

function pageWindow(count: number, requested: number, pageSize: number) {
  const size = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const pageCount = Math.max(1, Math.ceil(size / pageSize));
  const page = Number.isFinite(requested) ? Math.max(0, Math.min(pageCount - 1, Math.floor(requested))) : 0;
  const start = page * pageSize;
  return { page, pageCount, canPrevious: page > 0, canNext: page < pageCount - 1, start, count: Math.min(pageSize, size - start) };
}

export function lootPickerPage(cardCount: number, page = 0) {
  const layout = LOOT_PICKER_LAYOUT;
  const window = pageWindow(cardCount, page, layout.pageSize);
  return {
    page: window.page, pageCount: window.pageCount, canPrevious: window.canPrevious, canNext: window.canNext,
    slots: Array.from({ length: window.count }, (_, slot) => ({
      index: window.start + slot, x: layout.width / 2 + (slot - (window.count - 1) / 2) * layout.cardSpacing,
      y: layout.cardY, scale: layout.cardScale,
    })),
  };
}

export function dutyChooserRows(abilityCount: number, page = 0) {
  const layout = DUTY_CHOOSER_LAYOUT;
  const window = pageWindow(abilityCount, page, layout.pageSize);
  return {
    page: window.page, pageCount: window.pageCount, canPrevious: window.canPrevious, canNext: window.canNext,
    rows: Array.from({ length: window.count }, (_, slot) => {
      const top = layout.top + slot * (layout.rowHeight + layout.rowGap);
      return {
        abilityIndex: window.start + slot, x: layout.x, y: top + layout.rowHeight / 2,
        width: layout.width, height: layout.rowHeight, left: layout.x - layout.width / 2,
        right: layout.x + layout.width / 2, top, bottom: top + layout.rowHeight,
      };
    }),
  };
}
