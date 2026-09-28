/**
 * Mechanic usage audit, the pure half (docs/plan-mechanic-usage-audit.md,
 * wave 0): an action plus the card it names gives the mechanics it uses.
 *
 * Harness tooling only (ruling U2): it lives in scripts/, never ships, and
 * reads nothing a brain was not already handed. Every input is the redacted
 * PlayerView and the legal menu the row AI received, so the PlayerView
 * invariant is untouched.
 *
 * ADDING A MECHANIC is one entry in MECHANIC_RULES: an id, a label, which
 * cards carry it (drives "Cards in list"), which action types can use it, and
 * `match`, which returns the card id the action uses the mechanic with (or
 * undefined). Set `repeats` when one permanent can use it many times (the
 * report then prints uses per cast). Add `meaningful` only when a cheap public
 * test separates a sensible chance from a merely legal one; without it every
 * legal chance counts and the report says so. A cheap check on the TAKEN
 * action (the use looked wasted) is one entry in SENSE_CHECKS.
 */
import type { Action } from '../src/engine/actions';
import { getEffectiveStats } from '../src/engine/statics';
import type { CardDb, CardDef, EffectOp, Permanent } from '../src/engine/types';
import { activatedAbilitiesOf, isType, manaValue } from '../src/engine/types';
import type { PlayerView } from '../src/engine/view';
import { hauntlinkHostFit } from '../src/ai/hauntlinkPolicy';

export interface UsageContext {
  readonly view: PlayerView;
  readonly db: CardDb;
  /**
   * The boss's Darling from her list. Needed because the command zone reads
   * null once she is called, while the tax paydown stays legal.
   */
  readonly darlingId?: string | null;
}

export type ActionType = Action['type'];

/** Where a list entry sits: the main list, or the Darlings command zone. */
export type ListZone = 'deck' | 'darling';

export interface MechanicRule {
  readonly id: string;
  readonly label: string;
  /** True when a list entry carries the mechanic ("Cards in list"). */
  readonly carries: (d: CardDef, zone: ListZone) => boolean;
  /** Action types that can use it; a speed filter, `match` decides. */
  readonly actionTypes: ReadonlySet<ActionType>;
  /** The card id this action uses the mechanic with, or undefined. */
  readonly match: (action: Action, ctx: UsageContext) => string | undefined;
  /** One permanent can use it again and again: report uses per cast. */
  readonly repeats?: true;
  /**
   * A cheap public test that a legal use would also be a sensible one. Only
   * consulted for actions `match` accepted. Absent: every legal chance counts.
   */
  readonly meaningful?: (action: Action, ctx: UsageContext) => boolean;
  /** Printed beside the rule when the chance count needs a caveat. */
  readonly note?: string;
}

const card = (ctx: UsageContext, id: string | undefined): CardDef | undefined =>
  id === undefined ? undefined : ctx.db[id];

const permanent = (view: PlayerView, iid: number): Permanent | undefined =>
  view.battlefield.find((perm) => perm.iid === iid);

/**
 * The card an action names, read from the zone the action takes it from.
 * Retell and Whispers casts carry a `handIndex` that mirrors the graveyard
 * index, so the graveyard is read whenever `graveIndex` is present.
 */
export function namedCardId(action: Action, view: PlayerView, darlingId?: string | null): string | undefined {
  switch (action.type) {
    case 'castSpell':
      return action.graveIndex !== undefined
        ? view.you.graveyard[action.graveIndex]
        : view.you.hand[action.handIndex];
    case 'skim':
      return view.you.hand[action.handIndex];
    case 'preserveCard':
      return view.you.graveyard[action.graveIndex];
    case 'linkHaunt':
    case 'activate':
      return permanent(view, action.iid)?.cardId;
    case 'castDarling':
    case 'payDownDarlingTax':
      // The zone is null while the Darling is on the battlefield, and the
      // paydown is still legal then, so the list's Darling comes first.
      return darlingId ?? view.you.darlingZone ?? undefined;
    case 'playLand':
      return action.reserveIndex !== undefined
        ? view.you.landReserve?.[action.reserveIndex]
        : view.you.hand[action.handIndex];
    default:
      return undefined;
  }
}

/** The windows in which acting instead of passing is a Charm-speed play. */
export const CHARM_WINDOWS: ReadonlySet<PlayerView['awaiting']['kind']> = new Set([
  'respond',
  'endStepWindow',
  'hauntlinkWindow',
]);

const ALL_BUT_PASS: ReadonlySet<ActionType> = new Set<ActionType>([
  'castSpell', 'linkHaunt', 'activate', 'skim', 'preserveCard', 'castDarling', 'payDownDarlingTax',
  'chooseTarget', 'playLand', 'declareAttackers', 'declareBlockers', 'passStep', 'discard',
  'foresee', 'bottomCards', 'keepHand', 'mulligan', 'choosePlayDraw',
  // `concede` is left out on purpose: it is always legal, so a window offering
  // only pass and concede is not a Charm-speed chance.
]);

const castOnly: ReadonlySet<ActionType> = new Set<ActionType>(['castSpell']);

const castWith = (flag: (a: Extract<Action, { type: 'castSpell' }>) => boolean) =>
  (action: Action, ctx: UsageContext): string | undefined =>
    action.type === 'castSpell' && flag(action) ? namedCardId(action, ctx.view) : undefined;

/**
 * Copies of the move margin in src/ai/hauntlinkPolicy.ts (LINK_MANA_RATE,
 * MOVE_MARGIN), which does not export them. Keep in step with that file.
 */
const POLICY_LINK_MANA_RATE = 0.65;
const POLICY_MOVE_MARGIN = 0.25;

/**
 * A link move is sensible when the policy's own public host fit rates the new
 * host above the current one by the policy's own move margin (the fit gain
 * must repay 0.65 per link mana plus 0.25). The policy's further condition,
 * that no friendly creature dies from the move, is not re-checked here, so
 * this count can sit slightly above what the policy would take. The fit is the
 * brain's measure, so this catches moves made by paths that bypass it (Hard's
 * search, the Hauntlink window), not a wrong fit function.
 */
function moveBeatsCurrentHost(action: Action, ctx: UsageContext): boolean {
  if (action.type !== 'linkHaunt') return false;
  const carrier = permanent(ctx.view, action.iid);
  const link = carrier && ctx.db[carrier.cardId]?.hauntlink;
  if (carrier?.attachedTo === undefined || !link) return false;
  const board = ctx.view.battlefield;
  const gain = hauntlinkHostFit(board, ctx.db, action.iid, action.hostIid) -
    hauntlinkHostFit(board, ctx.db, action.iid, carrier.attachedTo);
  return gain > manaValue(link.cost) * POLICY_LINK_MANA_RATE + POLICY_MOVE_MARGIN;
}

function linkHauntCard(attached: boolean) {
  return (action: Action, ctx: UsageContext): string | undefined => {
    if (action.type !== 'linkHaunt') return undefined;
    const carrier = permanent(ctx.view, action.iid);
    if (!carrier || (carrier.attachedTo !== undefined) !== attached) return undefined;
    return carrier.cardId;
  };
}

/** Section 3 of the plan, one entry per mechanic where the brain CHOOSES. */
export const MECHANIC_RULES: readonly MechanicRule[] = [
  {
    id: 'empower',
    label: 'Empower',
    carries: (d, zone) => zone === 'deck' && d.empower !== undefined,
    actionTypes: castOnly,
    match: castWith((a) => a.empowered === true),
  },
  {
    id: 'skim',
    label: 'Skim',
    carries: (d, zone) => zone === 'deck' && d.skim !== undefined,
    actionTypes: new Set<ActionType>(['skim']),
    match: (action, ctx) => (action.type === 'skim' ? namedCardId(action, ctx.view) : undefined),
  },
  {
    id: 'retell',
    label: 'Retell',
    carries: (d, zone) => zone === 'deck' && d.retell !== undefined,
    actionTypes: castOnly,
    match: castWith((a) => a.retell === true),
  },
  {
    id: 'whispers',
    label: 'Whispers',
    carries: (d, zone) => zone === 'deck' && d.whispers !== undefined,
    actionTypes: castOnly,
    match: castWith((a) => a.whispers === true),
  },
  {
    id: 'tithe',
    label: 'Tithe',
    carries: (d, zone) => zone === 'deck' && d.tithe !== undefined,
    actionTypes: castOnly,
    match: castWith((a) => a.tithe === true),
  },
  {
    id: 'rite',
    label: 'Rite',
    carries: (d, zone) => zone === 'deck' && d.rite !== undefined,
    actionTypes: castOnly,
    match: (action, ctx) => {
      if (action.type !== 'castSpell') return undefined;
      const id = namedCardId(action, ctx.view);
      return card(ctx, id)?.rite ? id : undefined;
    },
    note: 'the engine offers one canonical sacrifice set per cast, so the choice is cast or not',
  },
  {
    id: 'hauntlinkLink',
    label: 'Hauntlink link',
    carries: (d, zone) => zone === 'deck' && d.hauntlink !== undefined,
    actionTypes: new Set<ActionType>(['linkHaunt']),
    match: linkHauntCard(false),
    repeats: true,
    note: 'a legal link already implies an unlinked carrier in play, so legal = meaningful',
  },
  {
    id: 'hauntlinkMove',
    label: 'Hauntlink move',
    carries: (d, zone) => zone === 'deck' && d.hauntlink !== undefined,
    actionTypes: new Set<ActionType>(['linkHaunt']),
    match: linkHauntCard(true),
    repeats: true,
    meaningful: moveBeatsCurrentHost,
    note: 'meaningful = a legal host beats the current one by the policy\'s own fit and move margin ' +
      '(its no-friendly-death condition is not re-checked); a window move\'s combat gain is not seen',
  },
  {
    id: 'duty',
    label: 'Duty',
    carries: (d, zone) => zone === 'deck' && activatedAbilitiesOf(d).length > 0,
    actionTypes: new Set<ActionType>(['activate']),
    match: (action, ctx) => (action.type === 'activate' ? namedCardId(action, ctx.view) : undefined),
    repeats: true,
  },
  {
    id: 'preserve',
    label: 'Preserve',
    carries: (d, zone) => zone === 'deck' && d.preserve !== undefined,
    actionTypes: new Set<ActionType>(['preserveCard']),
    match: (action, ctx) => (action.type === 'preserveCard' ? namedCardId(action, ctx.view) : undefined),
  },
  {
    id: 'darlingCall',
    label: 'Darling call',
    carries: (_d, zone) => zone === 'darling',
    actionTypes: new Set<ActionType>(['castDarling']),
    match: (action, ctx) => (action.type === 'castDarling' ? namedCardId(action, ctx.view, ctx.darlingId) : undefined),
    note: 'a call counts as a cast of the Darling; seen stays 0 because she starts in the command zone, not the hand',
  },
  {
    id: 'darlingTax',
    label: 'Darling tax paydown',
    carries: (_d, zone) => zone === 'darling',
    actionTypes: new Set<ActionType>(['payDownDarlingTax']),
    match: (action, ctx) =>
      (action.type === 'payDownDarlingTax' ? namedCardId(action, ctx.view, ctx.darlingId) : undefined),
    repeats: true,
    note: 'uses per cast = paydowns per call of the Darling',
  },
  {
    id: 'charmWindow',
    label: 'Charm-speed play',
    carries: (d, zone) => zone === 'deck' && isType(d, 'charm'),
    actionTypes: ALL_BUT_PASS,
    match: (action, ctx) => {
      const awaiting = ctx.view.awaiting;
      if (!CHARM_WINDOWS.has(awaiting.kind) || action.type === 'passResponse') return undefined;
      return namedCardId(action, ctx.view, ctx.darlingId) ?? `(${action.type})`;
    },
    note: 'any action but a pass or a concession in a respond, end-step or Hauntlink window',
  },
];

export interface MechanicHit {
  readonly mechanic: string;
  readonly cardId: string;
}

/** Every mechanic this action uses, with the card it uses it with. */
export function classifyAction(
  action: Action,
  ctx: UsageContext,
  rules: readonly MechanicRule[] = MECHANIC_RULES,
): MechanicHit[] {
  const hits: MechanicHit[] = [];
  for (const rule of rules) {
    if (!rule.actionTypes.has(action.type)) continue;
    const cardId = rule.match(action, ctx);
    if (cardId !== undefined) hits.push({ mechanic: rule.id, cardId });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Sense checks: cheap public tests on a TAKEN action (section 6, "legal is
// not sensible"). Each counts the uses it applies to and flags the ones the
// test calls wasted; `reading` adds a number to average (a cast turn).
// ---------------------------------------------------------------------------

export interface SenseCheck {
  readonly id: string;
  readonly label: string;
  /** What a flag means, printed beside the count. */
  readonly flagMeans: string;
  /** What `reading` measures, when present. */
  readonly readingMeans?: string;
  /** The card id this taken action is checked for, or undefined. */
  readonly applies: (action: Action, ctx: UsageContext) => string | undefined;
  readonly flagged: (action: Action, ctx: UsageContext) => boolean;
  readonly reading?: (action: Action, ctx: UsageContext) => number;
}

/** The spell-time ops a cast will run: the body, plus Empower's when paid. */
function castOps(d: CardDef, action: Extract<Action, { type: 'castSpell' }>): EffectOp[] {
  const ops = (d.abilities ?? [])
    .filter((ability) => ability.when === 'spell' || ability.when === 'arrives')
    .flatMap((ability) => ability.ops ?? []);
  if (action.empowered && d.empower) ops.push(...d.empower.ops);
  return ops;
}

function castCard(action: Action, ctx: UsageContext): { id: string; d: CardDef; ops: EffectOp[] } | undefined {
  if (action.type !== 'castSpell') return undefined;
  const id = namedCardId(action, ctx.view);
  const d = card(ctx, id);
  return id !== undefined && d ? { id, d, ops: castOps(d, action) } : undefined;
}

const mineCreatures = (ctx: UsageContext): Permanent[] =>
  ctx.view.battlefield.filter((perm) =>
    perm.controller === ctx.view.myId && ctx.db[perm.cardId] !== undefined && isType(ctx.db[perm.cardId], 'creature'));

/** The acting player's own turn number (turn 1 is the starting player's). */
export function ownTurn(view: PlayerView): number {
  return view.startingPlayer === view.myId ? Math.ceil(view.turn / 2) : Math.floor(view.turn / 2);
}

export const SENSE_CHECKS: readonly SenseCheck[] = [
  {
    id: 'rampCast',
    label: 'Ramp cast (extra land drop)',
    flagMeans: 'no land left in the reserve to play',
    readingMeans: 'own turn of the cast',
    applies: (action, ctx) => {
      const cast = castCard(action, ctx);
      return cast?.ops.some((op) => op.op === 'extraLandDrop') ? cast.id : undefined;
    },
    flagged: (_action, ctx) => ctx.view.you.landReserve !== undefined && ctx.view.you.landReserve.length === 0,
    reading: (_action, ctx) => ownTurn(ctx.view),
  },
  {
    id: 'markPayoffUnmarked',
    label: 'Mark payoff cast (Propagate or a boost to your Marked)',
    flagMeans: 'no Marked creature of hers on the board',
    applies: (action, ctx) => {
      const cast = castCard(action, ctx);
      return cast?.ops.some((op) =>
        op.op === 'propagate' || (op.op === 'boost' && op.scope === 'yourMarked')) ? cast.id : undefined;
    },
    flagged: (_action, ctx) => !mineCreatures(ctx).some((perm) => perm.plusOneCounters > 0),
  },
  {
    id: 'markAllEmpty',
    label: 'Mark-all cast (Mark each of your creatures)',
    flagMeans: 'no creature of her own on the board ' +
      '(over-states waste for a card with another effect, such as Flareburst\'s damage)',
    applies: (action, ctx) => {
      const cast = castCard(action, ctx);
      return cast?.ops.some((op) => op.op === 'markAll' && op.scope === 'yourCreatures') ? cast.id : undefined;
    },
    flagged: (_action, ctx) => mineCreatures(ctx).length === 0,
  },
  {
    id: 'creatureDutyMain2',
    label: 'Creature Duty in main phase 2',
    flagMeans: 'the opponent has a creature with Attack above 0, so the tapped creature is a lost blocker ' +
      '(coarse: a tapped, Bulwark or otherwise non-attacking enemy still counts)',
    applies: (action, ctx) => {
      if (action.type !== 'activate' || ctx.view.step !== 'main2') return undefined;
      const perm = permanent(ctx.view, action.iid);
      const d = perm && ctx.db[perm.cardId];
      return perm && d && isType(d, 'creature') ? perm.cardId : undefined;
    },
    flagged: (_action, ctx) => ctx.view.battlefield.some((perm) =>
      perm.controller !== ctx.view.myId && ctx.db[perm.cardId] !== undefined &&
      isType(ctx.db[perm.cardId], 'creature') &&
      getEffectiveStats(ctx.view.battlefield, ctx.db, perm.iid).attack > 0),
  },
  {
    // Main phase only: a move in a window answers a live combat or trigger,
    // which the static host fit does not see, so window moves are not judged.
    id: 'hauntlinkMoveNoBetter',
    label: 'Hauntlink move in a main phase',
    flagMeans: 'the link already sat on the best host by the policy\'s own fit',
    applies: (action, ctx) => (ctx.view.awaiting.kind === 'main' ? linkHauntCard(true)(action, ctx) : undefined),
    flagged: (action, ctx) => {
      if (action.type !== 'linkHaunt') return false;
      const carrier = permanent(ctx.view, action.iid);
      if (carrier?.attachedTo === undefined) return false;
      const board = ctx.view.battlefield;
      const current = hauntlinkHostFit(board, ctx.db, action.iid, carrier.attachedTo);
      const others = board.filter((perm) =>
        perm.controller === ctx.view.myId && perm.iid !== carrier.attachedTo &&
        ctx.db[perm.cardId] !== undefined && isType(ctx.db[perm.cardId], 'creature'));
      return others.every((host) => hauntlinkHostFit(board, ctx.db, action.iid, host.iid) <= current);
    },
  },
];

/** Every sense check that applies to a taken action. */
export function senseChecksFor(
  action: Action,
  ctx: UsageContext,
  checks: readonly SenseCheck[] = SENSE_CHECKS,
): { check: SenseCheck; cardId: string }[] {
  const out: { check: SenseCheck; cardId: string }[] = [];
  for (const check of checks) {
    const cardId = check.applies(action, ctx);
    if (cardId !== undefined) out.push({ check, cardId });
  }
  return out;
}
