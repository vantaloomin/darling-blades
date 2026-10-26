/**
 * Mechanic usage audit, the recording half (docs/plan-mechanic-usage-audit.md,
 * waves 0-1): a read-only decorator on the row AI, per-game tracking, the
 * per-boss aggregate, and the report table and JSON rows.
 *
 * The wrapper hands the inner brain the same view and legal menu and returns
 * its choice untouched. It reads a private snapshot of the view taken before
 * the inner call, so nothing the brain does to its inputs can change what is
 * counted, and nothing counted can reach the brain.
 *
 * Units (section 4): a CHANCE is a turn (the engine's turn counter, which
 * counts both players' turns) in which the mechanic's action was legal at
 * least once for her; TAKEN is a turn in which she chose it at least once.
 * SEEN is a copy arriving in her hand (read from the hand between her
 * decisions, net of the cards her own chosen action took out of it); CAST
 * counts her casts of the card; STRANDED is copies left in her hand after her
 * last decision of the game. A card drawn after her last decision (the game
 * ends before she acts again) is invisible to a wrapper, so seen and stranded
 * can each read one short of an engine-side count in such a game.
 *
 * A game boundary is a fresh call to the AI factory: `wrapFactory` opens a
 * new game record on every call and folds the previous one into its boss.
 */
import type { AIPlayer } from '../src/ai/AIPlayer';
import { combatForecast } from '../src/ai/combatPlans';
import type { Action } from '../src/engine/actions';
import { validateBlocks } from '../src/engine/combat/legality';
import type { CardDb, Permanent } from '../src/engine/types';
import { activatedAbilitiesOf, isType, markCostOf } from '../src/engine/types';
import type { PlayerView } from '../src/engine/view';
import {
  classifyAction,
  MECHANIC_RULES,
  ownDamageReach,
  PROVOKED_NOTE,
  provokedFired,
  provokedIndex,
  senseChecksFor,
  SENSE_CHECKS,
  type DamageReach,
  type ListZone,
  type MechanicRule,
  type SenseCheck,
  type UsageContext,
} from './mechanicUsage';

/** The list a boss plays, for "Cards in list". */
export interface UsageList {
  readonly deck: readonly string[];
  readonly darlingId?: string | null;
}

export interface UsageBossInfo {
  /** Matrix name, e.g. `avatars` or `avatars-warchest`. */
  readonly matrix: string;
  readonly id: string;
  readonly name: string;
  readonly tier?: number;
  readonly list: UsageList;
}

interface CardTally {
  seen: number;
  castFromHand: number;
  cast: number;
  stranded: number;
  uses: Record<string, number>;
  dutyMain1: number;
  dutyMain2: number;
}

interface CheckTally {
  applicable: number;
  flagged: number;
  readingSum: number;
  readingCount: number;
  perCard: Record<string, { applicable: number; flagged: number; readingSum: number; readingCount: number }>;
}

interface ProvokedTally {
  fires: number;
  ownSource: number;
}

const newCard = (): CardTally => ({ seen: 0, castFromHand: 0, cast: 0, stranded: 0, uses: {}, dutyMain1: 0, dutyMain2: 0 });
const newCheck = (): CheckTally => ({ applicable: 0, flagged: 0, readingSum: 0, readingCount: 0, perCard: {} });

function countIds(ids: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Hand indices the player's own chosen action removes from her hand. */
function handDepartures(action: Action, hand: readonly string[]): number[] {
  switch (action.type) {
    case 'castSpell':
      return action.graveIndex === undefined ? [action.handIndex] : [];
    case 'skim':
      return [action.handIndex];
    case 'discard':
    case 'bottomCards':
      return action.handIndices;
    case 'mulligan':
      return hand.map((_, i) => i);
    case 'playLand':
      return action.reserveIndex === undefined && action.handIndex >= 0 ? [action.handIndex] : [];
    default:
      return [];
  }
}

/** A frozen copy of what the counters read, taken before the inner brain runs. */
function snapshot(view: PlayerView): PlayerView {
  return {
    ...view,
    you: {
      ...view.you,
      hand: [...view.you.hand],
      graveyard: [...view.you.graveyard],
      ...(view.you.landReserve ? { landReserve: [...view.you.landReserve] } : {}),
    },
    battlefield: view.battlefield.map((perm): Permanent => ({
      ...perm,
      attachments: [...perm.attachments],
      plusOneCounters: perm.plusOneCounters,
      ...(perm.firedThisTurn ? { firedThisTurn: [...perm.firedThisTurn] } : {}),
    })),
    awaiting: { ...view.awaiting },
  };
}

/** One game of one boss. */
export class GameUsage {
  maxTurn = 0;
  decisions = 0;
  readonly chance = new Map<string, Set<number>>();
  readonly meaningful = new Map<string, Set<number>>();
  readonly taken = new Map<string, Set<number>>();
  readonly uses = new Map<string, number>();
  readonly cards = new Map<string, CardTally>();
  readonly checks = new Map<string, CheckTally>();
  /**
   * Provoked fires on her creatures, per card: every fire, and the fires on a
   * creature her own previous action (the same turn) named or swept.
   */
  readonly provoked = new Map<string, ProvokedTally>();
  private readonly provokedSeen = new Set<string>();
  private lastReach: { turn: number; reach: DamageReach; board: ReadonlySet<number> } | null = null;
  private lastHand: string[] = [];
  private lastDepartures: string[] = [];
  private readonly dutySources = new Map<number, { turn: number; cardId: string }>();

  constructor(
    private readonly db: CardDb,
    private readonly rules: readonly MechanicRule[] = MECHANIC_RULES,
    private readonly senseChecks: readonly SenseCheck[] = SENSE_CHECKS,
    /** The boss's Darling from her list, when she plays one. */
    private readonly darlingId: string | null = null,
  ) {}

  private tally(cardId: string): CardTally {
    let tally = this.cards.get(cardId);
    if (!tally) this.cards.set(cardId, (tally = newCard()));
    return tally;
  }

  private mark(map: Map<string, Set<number>>, mechanic: string, turn: number): void {
    let turns = map.get(mechanic);
    if (!turns) map.set(mechanic, (turns = new Set()));
    turns.add(turn);
  }

  /** Record one decision: the view and menu she was handed, and her choice. */
  record(view: PlayerView, legal: readonly Action[], chosen: Action): void {
    this.decisions++;
    const ctx: UsageContext = { view, db: this.db, darlingId: this.darlingId, legal };
    const turn = view.turn;
    if (turn > this.maxTurn) this.maxTurn = turn;
    this.countProvoked(view, turn);
    this.countLostDutyBlocks(view, chosen);

    // Seen: copies in the hand now that the last hand, less what her own last
    // action took out, does not account for.
    const expected = countIds(this.lastHand);
    for (const id of this.lastDepartures) expected.set(id, (expected.get(id) ?? 0) - 1);
    for (const [id, now] of countIds(view.you.hand)) {
      const arrived = now - Math.max(0, expected.get(id) ?? 0);
      if (arrived > 0) this.tally(id).seen += arrived;
    }
    this.lastHand = [...view.you.hand];
    this.lastDepartures = handDepartures(chosen, view.you.hand).map((i) => view.you.hand[i]).filter(
      (id): id is string => id !== undefined,
    );

    // Chances: a turn in which the mechanic was legal at least once.
    for (const rule of this.rules) {
      const hasChance = this.chance.get(rule.id)?.has(turn) ?? false;
      const hasMeaningful = rule.meaningful === undefined || (this.meaningful.get(rule.id)?.has(turn) ?? false);
      if (hasChance && hasMeaningful) continue;
      for (const action of legal) {
        if (!rule.actionTypes.has(action.type) || rule.match(action, ctx) === undefined) continue;
        this.mark(this.chance, rule.id, turn);
        if (rule.meaningful === undefined) break;
        if (rule.meaningful(action, ctx)) {
          this.mark(this.meaningful, rule.id, turn);
          break;
        }
      }
    }

    // The choice.
    if (chosen.type === 'castSpell') {
      const id = chosen.graveIndex !== undefined ? view.you.graveyard[chosen.graveIndex] : view.you.hand[chosen.handIndex];
      if (id !== undefined) {
        const tally = this.tally(id);
        tally.cast++;
        if (chosen.graveIndex === undefined) tally.castFromHand++;
      }
    } else if (chosen.type === 'castDarling') {
      // A call is a cast of the Darling, from the command zone, never the hand.
      const id = this.darlingId ?? view.you.darlingZone;
      if (id) this.tally(id).cast++;
    }
    if (chosen.type === 'activate') {
      const source = view.battlefield.find((body) => body.iid === chosen.iid);
      if (source) {
        if (view.step === 'main1') this.tally(source.cardId).dutyMain1++;
        if (view.step === 'main2') {
          this.tally(source.cardId).dutyMain2++;
          const d = this.db[source.cardId];
          const ability = d && activatedAbilitiesOf(d)[chosen.abilityIndex ?? 0];
          if (d && isType(d, 'creature') && ability && markCostOf(ability) === 0) {
            this.dutySources.set(source.iid, { turn, cardId: source.cardId });
          }
        }
      }
    }
    for (const hit of classifyAction(chosen, ctx, this.rules)) {
      this.mark(this.taken, hit.mechanic, turn);
      this.uses.set(hit.mechanic, (this.uses.get(hit.mechanic) ?? 0) + 1);
      const tally = this.tally(hit.cardId);
      tally.uses[hit.mechanic] = (tally.uses[hit.mechanic] ?? 0) + 1;
    }
    for (const { check, cardId } of senseChecksFor(chosen, ctx, this.senseChecks)) {
      const readings = check.readings?.(chosen, ctx) ?? (check.reading ? [check.reading(chosen, ctx)] : []);
      this.recordCheck(check.id, cardId, check.flagged(chosen, ctx), readings);
    }
    const reach = ownDamageReach(chosen, ctx);
    this.lastReach = reach ? { turn, reach, board: new Set(view.battlefield.map((perm) => perm.iid)) } : null;
  }

  private recordCheck(id: string, cardId: string, flagged: boolean, readings: readonly number[]): void {
    let tally = this.checks.get(id);
    if (!tally) this.checks.set(id, (tally = newCheck()));
    const per = (tally.perCard[cardId] ??= { applicable: 0, flagged: 0, readingSum: 0, readingCount: 0 });
    for (const count of [tally, per]) {
      count.applicable++;
      if (flagged) count.flagged++;
      count.readingSum += readings.reduce((sum, reading) => sum + reading, 0);
      count.readingCount += readings.length;
    }
  }

  /** One observation per Duty source at the next opposing blocked combat.
   * Untap only that source on a private board and ask the shared combat rules
   * whether a legal single block prevents damage without killing it.
   */
  private countLostDutyBlocks(view: PlayerView, chosen: Action): void {
    for (const [iid, duty] of this.dutySources) {
      const source = view.battlefield.find((body) => body.iid === iid);
      if (view.turn > duty.turn + 1 || !source || source.controller !== view.myId ||
        (view.turn > duty.turn && !source.tapped)) {
        this.dutySources.delete(iid);
        continue;
      }
      // The engine can skip every response after blocks. The submitted block
      // assignment is already public and is the last observation in that case.
      const combat = view.combat && chosen.type === 'declareBlockers'
        ? { ...view.combat, blocks: chosen.blocks, phase: 'blockersDeclared' as const } : view.combat;
      if (view.turn !== duty.turn + 1 || view.activePlayer === view.myId || !source.tapped ||
        !combat || combat.phase !== 'blockersDeclared' || combat.attackers.length === 0) continue;
      this.dutySources.delete(iid);
      if (!this.senseChecks.some((check) => check.id === 'creatureDutySafeBlockLost')) continue;
      let prevented = 0;
      if (!view.fogThisTurn) {
        const board = view.battlefield.map((body) => body.iid === iid ? { ...body, tapped: false } : body);
        const before = combatForecast(board, this.db, combat);
        for (const attacker of combat.attackers) {
          if (combat.blocks.some((block) => block.attacker === attacker)) continue;
          const blocks = [...combat.blocks, { blocker: iid, attacker }];
          if (validateBlocks(board, this.db, view.myId, combat, blocks) !== null) continue;
          const after = combatForecast(board, this.db, { ...combat, blocks });
          if (!after.dying.includes(iid)) prevented = Math.max(prevented, before.damage - after.damage);
        }
      }
      this.recordCheck('creatureDutySafeBlockLost', duty.cardId, prevented > 0, [prevented]);
    }
  }

  /**
   * A fire is counted once per creature per turn, the first time one of her
   * decisions shows it. It is her own source's when her previous action, that
   * turn, named the creature (a Hunt's hunter or prey, a damage target), swept
   * her side, or cast the hunter that has since arrived.
   */
  private countProvoked(view: PlayerView, turn: number): void {
    const last = this.lastReach?.turn === turn ? this.lastReach : null;
    for (const perm of provokedFired(view, this.db)) {
      const key = `${turn}:${perm.iid}`;
      if (this.provokedSeen.has(key)) continue;
      this.provokedSeen.add(key);
      let tally = this.provoked.get(perm.cardId);
      if (!tally) this.provoked.set(perm.cardId, (tally = { fires: 0, ownSource: 0 }));
      tally.fires++;
      if (last && (last.reach.all || last.reach.iids.has(perm.iid) ||
        (last.reach.arrivingCardId === perm.cardId && !last.board.has(perm.iid)))) tally.ownSource++;
    }
  }

  /** Copies left in her hand after her last decision's own action. */
  finalHand(): readonly string[] {
    const hand = [...this.lastHand];
    for (const id of this.lastDepartures) {
      const at = hand.indexOf(id);
      if (at >= 0) hand.splice(at, 1);
    }
    return hand;
  }
}

/** Read-only decorator: records, then returns the inner brain's choice untouched. */
export class UsageRecordingAI implements AIPlayer {
  constructor(private readonly inner: AIPlayer, private readonly game: GameUsage) {}

  chooseAction(view: PlayerView, legal: Action[]): Action {
    const seen = snapshot(view);
    const menu = [...legal];
    const chosen = this.inner.chooseAction(view, legal);
    this.game.record(seen, menu, chosen);
    return chosen;
  }
}

interface BossAggregate {
  info: UsageBossInfo;
  games: number;
  turns: number;
  decisions: number;
  chance: Record<string, number>;
  meaningful: Record<string, number>;
  taken: Record<string, number>;
  uses: Record<string, number>;
  cards: Record<string, CardTally>;
  checks: Record<string, CheckTally>;
  provoked: Record<string, ProvokedTally>;
  open: GameUsage | null;
}

export interface UsageRowJson {
  mechanic: string;
  label: string;
  cardsInList: number;
  turnsWithChance: number;
  /** Null when no cheap sensible-chance test exists (every legal chance counts). */
  turnsWithMeaningfulChance: number | null;
  turnsTaken: number;
  /** Taken turns over chance turns; null with no chance. */
  rate: number | null;
  uses: number;
  seen: number;
  castFromHand: number;
  castWhenSeen: number | null;
  /** Only for mechanics one permanent repeats; null otherwise or with no cast. */
  usesPerCast: number | null;
  /** Duty activations split by main step; null for other mechanics. */
  usesMain1: number | null;
  usesMain2: number | null;
  note?: string;
}

export interface UsageCardJson {
  cardId: string;
  name: string;
  copies: number;
  mechanics: string[];
  seen: number;
  cast: number;
  castFromHand: number;
  castWhenSeen: number | null;
  stranded: number;
  uses: Record<string, number>;
  usesPerCast: number | null;
  dutyMain1: number;
  dutyMain2: number;
}

export interface UsageCheckJson {
  check: string;
  label: string;
  flagMeans: string;
  applicable: number;
  flagged: number;
  readingMeans?: string;
  meanReading: number | null;
  readingCount: number;
  readingSum: number;
  perCard: { cardId: string; name: string; applicable: number; flagged: number; meanReading: number | null }[];
}

/** Provoked, a passive mechanic: fires, not chances (plan-first-dawn-engine.md, Part 8). */
export interface UsageProvokedJson {
  cardsInList: number;
  fires: number;
  /** Fires on a creature her own previous action named or swept. */
  ownSource: number;
  perCard: { cardId: string; name: string; copies: number; fires: number; ownSource: number }[];
  note: string;
}

export interface UsageBossJson {
  matrix: string;
  id: string;
  name: string;
  tier?: number;
  games: number;
  meanTurns: number;
  decisions: number;
  rows: UsageRowJson[];
  cards: UsageCardJson[];
  checks: UsageCheckJson[];
  provoked: UsageProvokedJson;
}

export interface MechanicUsageJson {
  bosses: UsageBossJson[];
}

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

/** One opt-in sink shared across whichever avatar matrices `--usage` rides. */
export class MechanicUsageCollector {
  private readonly bosses = new Map<string, BossAggregate>();

  constructor(
    private readonly db: CardDb,
    private readonly rules: readonly MechanicRule[] = MECHANIC_RULES,
    private readonly senseChecks: readonly SenseCheck[] = SENSE_CHECKS,
  ) {}

  /**
   * Wrap a row-AI factory. Each call is one game: the previous game of this
   * boss is folded in and a fresh record opens.
   */
  wrapFactory<A extends unknown[]>(
    info: UsageBossInfo,
    factory: (...args: A) => AIPlayer,
  ): (...args: A) => AIPlayer {
    return (...args: A) => {
      const inner = factory(...args);
      const boss = this.boss(info);
      this.fold(boss);
      const game = new GameUsage(this.db, this.rules, this.senseChecks, info.list.darlingId ?? null);
      boss.open = game;
      return new UsageRecordingAI(inner, game);
    };
  }

  private boss(info: UsageBossInfo): BossAggregate {
    const key = `${info.matrix}\u0000${info.id}`;
    let boss = this.bosses.get(key);
    if (!boss) {
      boss = {
        info, games: 0, turns: 0, decisions: 0,
        chance: {}, meaningful: {}, taken: {}, uses: {}, cards: {}, checks: {}, provoked: {}, open: null,
      };
      this.bosses.set(key, boss);
    }
    return boss;
  }

  private fold(boss: BossAggregate): void {
    const game = boss.open;
    boss.open = null;
    if (!game || game.decisions === 0) return;
    boss.games++;
    boss.turns += game.maxTurn;
    boss.decisions += game.decisions;
    const add = (into: Record<string, number>, key: string, n: number): void => {
      into[key] = (into[key] ?? 0) + n;
    };
    for (const [id, turns] of game.chance) add(boss.chance, id, turns.size);
    for (const [id, turns] of game.meaningful) add(boss.meaningful, id, turns.size);
    for (const [id, turns] of game.taken) add(boss.taken, id, turns.size);
    for (const [id, n] of game.uses) add(boss.uses, id, n);
    for (const [id, tally] of game.cards) {
      const into = (boss.cards[id] ??= newCard());
      into.seen += tally.seen;
      into.cast += tally.cast;
      into.castFromHand += tally.castFromHand;
      into.dutyMain1 += tally.dutyMain1;
      into.dutyMain2 += tally.dutyMain2;
      for (const [mechanic, n] of Object.entries(tally.uses)) add(into.uses, mechanic, n);
    }
    for (const id of game.finalHand()) (boss.cards[id] ??= newCard()).stranded++;
    for (const [id, tally] of game.provoked) {
      const into = (boss.provoked[id] ??= { fires: 0, ownSource: 0 });
      into.fires += tally.fires;
      into.ownSource += tally.ownSource;
    }
    for (const [id, tally] of game.checks) {
      const into = (boss.checks[id] ??= newCheck());
      into.applicable += tally.applicable;
      into.flagged += tally.flagged;
      into.readingSum += tally.readingSum;
      into.readingCount += tally.readingCount;
      for (const [cardId, per] of Object.entries(tally.perCard)) {
        const target = (into.perCard[cardId] ??= { applicable: 0, flagged: 0, readingSum: 0, readingCount: 0 });
        target.applicable += per.applicable;
        target.flagged += per.flagged;
        target.readingSum += per.readingSum;
        target.readingCount += per.readingCount;
      }
    }
  }

  private carriersOf(rule: MechanicRule, list: UsageList): Map<string, number> {
    const copies = new Map<string, number>();
    const entries: [string, ListZone][] = [
      ...list.deck.map((id): [string, ListZone] => [id, 'deck']),
      ...(list.darlingId ? [[list.darlingId, 'darling'] as [string, ListZone]] : []),
    ];
    for (const [id, zone] of entries) {
      const d = this.db[id];
      if (d && rule.carries(d, zone)) copies.set(id, (copies.get(id) ?? 0) + 1);
    }
    return copies;
  }

  private cardName(id: string): string {
    return this.db[id]?.name ?? id;
  }

  toJSON(): MechanicUsageJson {
    const bosses: UsageBossJson[] = [];
    for (const boss of this.bosses.values()) {
      this.fold(boss);
      const rows: UsageRowJson[] = [];
      const cardMechanics = new Map<string, { copies: number; mechanics: string[]; repeats: boolean; reportUses: boolean }>();
      for (const rule of this.rules) {
        const carriers = this.carriersOf(rule, boss.info.list);
        let seen = 0;
        let castFromHand = 0;
        let cast = 0;
        let uses = 0;
        for (const [id, copies] of carriers) {
          const tally = boss.cards[id];
          const entry = cardMechanics.get(id) ?? { copies, mechanics: [], repeats: false, reportUses: false };
          entry.mechanics.push(rule.id);
          entry.repeats ||= rule.repeats === true;
          entry.reportUses ||= rule.reportUses === true;
          cardMechanics.set(id, entry);
          if (!tally) continue;
          seen += tally.seen;
          castFromHand += tally.castFromHand;
          cast += tally.cast;
          uses += tally.uses[rule.id] ?? 0;
        }
        const chance = boss.chance[rule.id] ?? 0;
        const taken = boss.taken[rule.id] ?? 0;
        rows.push({
          mechanic: rule.id,
          label: rule.label,
          cardsInList: [...carriers.values()].reduce((sum, n) => sum + n, 0),
          turnsWithChance: chance,
          turnsWithMeaningfulChance: rule.meaningful ? (boss.meaningful[rule.id] ?? 0) : null,
          turnsTaken: taken,
          rate: ratio(taken, chance),
          uses: boss.uses[rule.id] ?? 0,
          seen,
          castFromHand,
          castWhenSeen: rule.reportUses ? null : ratio(castFromHand, seen),
          usesPerCast: rule.repeats ? ratio(uses, cast) : null,
          usesMain1: rule.id === 'duty' ? Object.values(boss.cards).reduce((sum, tally) => sum + tally.dutyMain1, 0) : null,
          usesMain2: rule.id === 'duty' ? Object.values(boss.cards).reduce((sum, tally) => sum + tally.dutyMain2, 0) : null,
          ...(rule.note ? { note: rule.note } : {}),
        });
      }
      const cards: UsageCardJson[] = [...cardMechanics.entries()]
        .filter(([, entry]) => entry.mechanics.some((m) => m !== 'charmWindow'))
        .map(([id, entry]) => {
          const tally = boss.cards[id] ?? newCard();
          const repeatUses = Object.entries(tally.uses)
            .filter(([mechanic]) => this.rules.find((rule) => rule.id === mechanic)?.repeats)
            .reduce((sum, [, n]) => sum + n, 0);
          return {
            cardId: id,
            name: this.cardName(id),
            copies: entry.copies,
            mechanics: entry.mechanics,
            seen: tally.seen,
            cast: tally.cast,
            castFromHand: tally.castFromHand,
            castWhenSeen: entry.reportUses ? null : ratio(tally.castFromHand, tally.seen),
            stranded: tally.stranded,
            uses: { ...tally.uses },
            usesPerCast: entry.repeats ? ratio(repeatUses, tally.cast) : null,
            dutyMain1: tally.dutyMain1,
            dutyMain2: tally.dutyMain2,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      const checks: UsageCheckJson[] = this.senseChecks.map((check) => {
        const tally = boss.checks[check.id] ?? newCheck();
        return {
          check: check.id,
          label: check.label,
          flagMeans: check.flagMeans,
          applicable: tally.applicable,
          flagged: tally.flagged,
          ...(check.readingMeans ? { readingMeans: check.readingMeans } : {}),
          meanReading: ratio(tally.readingSum, tally.readingCount),
          readingCount: tally.readingCount,
          readingSum: tally.readingSum,
          perCard: Object.entries(tally.perCard)
            .map(([cardId, per]) => ({
              cardId,
              name: this.cardName(cardId),
              applicable: per.applicable,
              flagged: per.flagged,
              meanReading: ratio(per.readingSum, per.readingCount),
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      });
      const provokedCopies = new Map<string, number>();
      for (const id of [...boss.info.list.deck, ...(boss.info.list.darlingId ? [boss.info.list.darlingId] : [])]) {
        if (provokedIndex(this.db[id]) >= 0) provokedCopies.set(id, (provokedCopies.get(id) ?? 0) + 1);
      }
      const provokedIds = [...new Set([...provokedCopies.keys(), ...Object.keys(boss.provoked)])];
      const provokedCards = provokedIds.map((cardId) => ({
        cardId,
        name: this.cardName(cardId),
        copies: provokedCopies.get(cardId) ?? 0,
        fires: boss.provoked[cardId]?.fires ?? 0,
        ownSource: boss.provoked[cardId]?.ownSource ?? 0,
      })).sort((a, b) => a.name.localeCompare(b.name));
      bosses.push({
        matrix: boss.info.matrix,
        id: boss.info.id,
        name: boss.info.name,
        ...(boss.info.tier === undefined ? {} : { tier: boss.info.tier }),
        games: boss.games,
        meanTurns: boss.games === 0 ? 0 : boss.turns / boss.games,
        decisions: boss.decisions,
        rows,
        cards,
        checks,
        provoked: {
          cardsInList: [...provokedCopies.values()].reduce((sum, n) => sum + n, 0),
          fires: provokedCards.reduce((sum, row) => sum + row.fires, 0),
          ownSource: provokedCards.reduce((sum, row) => sum + row.ownSource, 0),
          perCard: provokedCards,
          note: PROVOKED_NOTE,
        },
      });
    }
    return { bosses };
  }

  render(): string {
    const pct = (value: number | null): string => (value === null ? '-' : `${(value * 100).toFixed(0)}%`);
    const num = (value: number | null, digits = 2): string => (value === null ? '-' : value.toFixed(digits));
    const lines: string[] = ['MECHANIC USAGE (selected row or column AI; read-only wrapper):'];
    for (const boss of this.toJSON().bosses) {
      const tier = boss.tier === undefined ? '' : `R${boss.tier} `;
      lines.push('');
      lines.push(
        `[${boss.matrix}] ${tier}${boss.name}: ${boss.games} games, mean ${boss.meanTurns.toFixed(1)} turns per game ` +
          '(engine turn counter, both players\' turns)',
      );
      lines.push(
        '  Mechanic               Cards in list  Turns with a chance  Meaningful  Taken  Rate  Uses  Main 1  Main 2  Cast when seen  Uses per cast',
      );
      const shown = boss.rows.filter((row) => row.cardsInList > 0 || row.turnsWithChance > 0);
      for (const row of shown) {
        lines.push(
          `  ${row.label.padEnd(22)} ${String(row.cardsInList).padStart(13)} ${String(row.turnsWithChance).padStart(20)} ` +
            `${(row.turnsWithMeaningfulChance === null ? '=legal' : String(row.turnsWithMeaningfulChance)).padStart(11)} ` +
            `${String(row.turnsTaken).padStart(6)} ${pct(row.rate).padStart(5)} ${String(row.uses).padStart(5)} ` +
            `${String(row.usesMain1 ?? '-').padStart(7)} ${String(row.usesMain2 ?? '-').padStart(7)} ${pct(row.castWhenSeen).padStart(15)} ` +
            `${num(row.usesPerCast).padStart(14)}`,
        );
      }
      for (const row of shown) if (row.note) lines.push(`    (${row.label}: ${row.note})`);
      if (boss.cards.length > 0) {
        lines.push('  Per card                                copies  seen  cast  cast/seen  stranded  uses');
        for (const cardRow of boss.cards) {
          const uses = Object.entries(cardRow.uses)
            .filter(([mechanic]) => mechanic !== 'charmWindow')
            .map(([mechanic, n]) => `${mechanic} ${n}`)
            .join(', ');
          lines.push(
            `    ${cardRow.name.slice(0, 36).padEnd(36)} ${String(cardRow.copies).padStart(6)} ${String(cardRow.seen).padStart(5)} ` +
              `${String(cardRow.cast).padStart(5)} ${pct(cardRow.castWhenSeen).padStart(10)} ${String(cardRow.stranded).padStart(9)}  ` +
              `${uses || '-'}${cardRow.usesPerCast === null ? '' : ` (${num(cardRow.usesPerCast)} per cast)`}`,
          );
        }
      }
      for (const check of boss.checks) {
        if (check.applicable === 0) continue;
        const reading = check.meanReading === null ? '' :
          `; mean ${check.readingMeans} ${num(check.meanReading, 1)} (${check.readingCount} readings, total ${num(check.readingSum, 1)})`;
        lines.push(`  Check: ${check.label}: ${check.flagged} of ${check.applicable} with ${check.flagMeans}${reading}`);
      }
      const provoked = boss.provoked;
      if (provoked.cardsInList > 0 || provoked.fires > 0) {
        lines.push(
          `  Provoked (passive): ${provoked.fires} fires, ${provoked.ownSource} on a creature her own action named or swept; ` +
            `${provoked.cardsInList} cards in list`,
        );
        for (const row of provoked.perCard) {
          lines.push(`    ${row.name.slice(0, 36).padEnd(36)} ${String(row.copies).padStart(6)}  fires ${row.fires}, own source ${row.ownSource}`);
        }
        lines.push(`    (Provoked: ${provoked.note})`);
      }
    }
    return lines.join('\n');
  }
}
