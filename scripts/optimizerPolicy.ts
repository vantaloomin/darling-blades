import { ECONOMY } from '../src/config/rules';
import { CARD_DB } from '../src/data/catalog';
import {
  dailyQuestCeiling,
  expectedPlainDupeRefundPerPack,
  freeDraftRunEv,
  gauntletClimbEv,
  ownershipAtCompletion,
  practiceSessionEv,
  premiumDraftRunEv,
} from '../src/meta/economyModel';
import type { Difficulty } from '../src/meta/Economy';
import {
  DRAFT_SETUP_MINUTES,
  GAUNTLET_MATCH_MINUTES,
  LIMITED_MATCH_MINUTES,
  PRACTICE_MATCH_MINUTES,
  type PlayerPersona,
  type PolicyDayPlan,
  type PolicyView,
} from './progression-sim';

/**
 * The optimizer gets a rounded 57-minute daily allowance. In the CI-fast
 * baseline (all honest personas, one seed, three days), the measured honest
 * median was 57.08 minutes/day including setup/action constants, and 57 also
 * exceeds the 56-minute free/premium draft cost (14 setup + 3 * 14 matches),
 * so the probe must exclude drafts on EV merit rather than by a budget accident.
 * The cap test reports the exact measured load beside its ratio.
 */
export const OPTIMIZER_DAILY_MINUTES = 57;

/** Fixed, explicit skill assumptions keep the optimizer reproducible. */
export const OPTIMIZER_WIN_RATE = 0.5;

type ActionKind = 'practice' | 'gauntlet' | 'free-draft' | 'premium-draft' | 'base-pack';

export interface OptimizerAction {
  readonly kind: ActionKind;
  readonly minutes: number;
  readonly goldPerMinute: number;
  readonly expectedGold: number;
  readonly goldCost: number;
}

const ACTION_ORDER: readonly ActionKind[] = [
  'practice',
  'gauntlet',
  'free-draft',
  'premium-draft',
  'base-pack',
];

function actionRank(kind: ActionKind): number {
  return ACTION_ORDER.indexOf(kind);
}

function pendingQuestGold(view: PolicyView): number {
  const pending = view.quests.filter((quest) => !quest.claimed).length;
  if (pending === 0) return 0;
  const ceiling = dailyQuestCeiling();
  return Math.min(ceiling.questGold, pending * ECONOMY.dailyQuestGold);
}

function practiceAction(view: PolicyView, firstPracticeAction: boolean): OptimizerAction {
  const difficulty: Difficulty = 'medium';
  const ev = practiceSessionEv({
    difficulty,
    winRate: OPTIMIZER_WIN_RATE,
    matches: 1,
    firstWinAvailable: firstPracticeAction && !view.streak.wonToday,
    streakCount: firstPracticeAction && !view.streak.wonToday ? view.streak.nextCount : undefined,
  });
  const expectedGold = ev.expectedTotalGold + (firstPracticeAction ? pendingQuestGold(view) : 0);
  return {
    kind: 'practice',
    minutes: PRACTICE_MATCH_MINUTES,
    expectedGold,
    goldPerMinute: expectedGold / PRACTICE_MATCH_MINUTES,
    goldCost: 0,
  };
}

function gauntletAction(view: PolicyView): OptimizerAction {
  // gauntletClimbEv supplies the expected gold/match over a seeded climb;
  // activeRung is included as a conservative state multiplier because an
  // already-started run is not a fresh climb. The policy never assumes a
  // reset is free or that a loss can be replayed without time.
  const ev = gauntletClimbEv(OPTIMIZER_WIN_RATE);
  const rung = view.gauntlet.activeRung ?? 1;
  const rungMultiplier = Math.min(1.25, Math.max(0.75, rung / 6));
  const expectedGold = (ev.expectedGold / ev.expectedMatches) * rungMultiplier;
  return {
    kind: 'gauntlet',
    minutes: GAUNTLET_MATCH_MINUTES,
    expectedGold,
    goldPerMinute: expectedGold / GAUNTLET_MATCH_MINUTES,
    goldCost: 0,
  };
}

function freeDraftAction(): OptimizerAction {
  const ev = freeDraftRunEv(OPTIMIZER_WIN_RATE);
  const minutes = DRAFT_SETUP_MINUTES + LIMITED_MATCH_MINUTES * 3;
  return {
    kind: 'free-draft',
    minutes,
    expectedGold: ev.expectedRunGold,
    goldPerMinute: ev.expectedRunGold / minutes,
    goldCost: 0,
  };
}

function premiumDraftAction(view: PolicyView): OptimizerAction | null {
  if (!view.premiumDraftAffordable || view.gold < ECONOMY.premiumDraftEntry) return null;
  // The optimizer is a gold faucet probe, so card value is deliberately not
  // smuggled into its gold/minute headline. Completion is still consumed by
  // the EV seam, with the conservative assumption that kept cards have no
  // immediate shard value until the collector is complete.
  const ev = premiumDraftRunEv(OPTIMIZER_WIN_RATE, view.collectionPct >= 1 ? 45 : 0);
  const minutes = DRAFT_SETUP_MINUTES + LIMITED_MATCH_MINUTES * 3;
  return {
    kind: 'premium-draft',
    minutes,
    expectedGold: ev.expectedNetGold,
    goldPerMinute: ev.expectedNetGold / minutes,
    goldCost: ECONOMY.premiumDraftEntry,
  };
}

function basePackAction(view: PolicyView): OptimizerAction | null {
  if (view.gold < ECONOMY.packPrice) return null;
  const ownership = ownershipAtCompletion(CARD_DB, view.collectionPct);
  const expectedGold = expectedPlainDupeRefundPerPack(CARD_DB, ownership) - ECONOMY.packPrice;
  return {
    kind: 'base-pack',
    minutes: 1.25,
    expectedGold,
    goldPerMinute: expectedGold / 1.25,
    goldCost: ECONOMY.packPrice,
  };
}

function actionsFor(view: PolicyView, firstPracticeAction: boolean): OptimizerAction[] {
  const actions: OptimizerAction[] = [practiceAction(view, firstPracticeAction), gauntletAction(view), freeDraftAction()];
  const premium = premiumDraftAction(view);
  if (premium) actions.push(premium);
  const pack = basePackAction(view);
  if (pack) actions.push(pack);
  return actions;
}

/** Return the current EV-ranked action table used by the daily policy. */
export function rankOptimizerActions(view: PolicyView): readonly OptimizerAction[] {
  return actionsFor(view, !view.streak.wonToday).sort(
    (a, b) => b.goldPerMinute - a.goldPerMinute || actionRank(a.kind) - actionRank(b.kind),
  );
}

/** Deterministic greedy policy consumed by PlayerPersona.dailyPolicy. */
export function optimizerPolicy(view: PolicyView): PolicyDayPlan {
  let minutesRemaining = Number.isFinite(view.minutesRemaining)
    ? Math.max(0, view.minutesRemaining)
    : Math.max(0, view.minutesBudget === Infinity ? OPTIMIZER_DAILY_MINUTES : view.minutesBudget);
  let goldRemaining = Math.max(0, view.gold);
  let firstPracticeAction = !view.streak.wonToday;
  let practiceCount = 0;
  let gauntletMatches = 0;
  let limitedMatches = 0;
  let premium = false;

  while (minutesRemaining > 0) {
    const policyView = goldRemaining === view.gold
      ? view
      : { ...view, gold: goldRemaining, premiumDraftAffordable: goldRemaining >= ECONOMY.premiumDraftEntry };
    const ranked = actionsFor(policyView, firstPracticeAction).filter((action) => {
      return action.minutes <= minutesRemaining && action.goldCost <= goldRemaining;
    });
    const best = ranked.sort(
      (a, b) => b.goldPerMinute - a.goldPerMinute || actionRank(a.kind) - actionRank(b.kind),
    )[0];
    if (!best || best.goldPerMinute <= 0) break;

    minutesRemaining -= best.minutes;
    if (best.goldCost > 0) goldRemaining -= best.goldCost;
    switch (best.kind) {
      case 'practice':
        practiceCount++;
        firstPracticeAction = false;
        break;
      case 'gauntlet':
        gauntletMatches++;
        break;
      case 'free-draft':
        limitedMatches += 3;
        break;
      case 'premium-draft':
        limitedMatches += 3;
        premium = true;
        break;
      case 'base-pack':
        // Spending is intentionally represented below as `none`; a negative
        // EV pack is never selected by a gold-per-minute optimizer.
        break;
    }
  }

  return {
    ...(practiceCount > 0 ? { practice: { difficulty: 'medium', count: practiceCount } } : {}),
    ...(gauntletMatches > 0 ? { gauntlet: { matches: gauntletMatches, stopAfterLoss: true } } : {}),
    ...(limitedMatches > 0 ? { limited: { matches: limitedMatches, ...(premium ? { premium: true } : {}) } } : {}),
    spending: { packPreference: 'none', reserveGold: goldRemaining },
    shardSpecialExcess: true,
    claimAchievements: true,
  };
}

export const OPTIMIZER_PERSONA: PlayerPersona = {
  id: 'gold-per-minute-optimizer',
  name: 'Gold/Minute Optimizer',
  style: 'deterministic EV-ranked daily faucet probe',
  starterId: 'starter-crimson',
  pilotSkill: 'medium',
  timeBudgetMinutes: OPTIMIZER_DAILY_MINUTES,
  dailyPolicy: optimizerPolicy,
  spending: { packPreference: 'none' },
  achievements: 'claim',
  shardSpecialExcess: true,
};
