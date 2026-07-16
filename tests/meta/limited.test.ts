import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import { DRAFT_PERSONAS } from '../../src/data/draftPersonas';
import type { CardDb, CardDef, Color } from '../../src/engine/types';
import { def, isType, manaValue } from '../../src/engine/types';
import { isBasic } from '../../src/meta/Collection';
import { validateLimitedDeck } from '../../src/meta/DeckStorage';
import { applyLimitedMatchResult, payPremiumDraftEntry } from '../../src/meta/Economy';
import {
  buildLimitedDeck,
  completeDraftRun,
  currentDraftPack,
  DRAFT_SEATS,
  freshLimitedState,
  grantPremiumDraftPool,
  limitedDuelData,
  personaRevealTier,
  pickDraftCard,
  recordDraftEncounters,
  rollLimitedPack,
  rollSealedPool,
  startBotDraft,
  startDraftRun,
  startSealedRun,
} from '../../src/meta/Limited';
import { DEFAULT_PICKER, scoreBasePick } from '../../src/meta/draftPicker';
import { freshSave } from '../../src/meta/SaveManager';
import { PLAIN_VARIANT, TIER_RANK, variantKey, type CardVariant } from '../../src/meta/variants';
import { deckOf, TEST_DB } from '../helpers';

describe('limited pack rolling', () => {
  it('rolls deterministic side-effect-free packs with booster-legal cards', () => {
    const a = rollLimitedPack(CARD_DB, 123);
    const b = rollLimitedPack(CARD_DB, 123);
    const c = rollLimitedPack(CARD_DB, 124);

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(ECONOMY.limitedPackSize);
    for (const id of a) {
      const card = def(CARD_DB, id);
      expect(card.token).not.toBe(true);
      expect(isBasic(CARD_DB, id)).toBe(false);
    }
  });

  it('rolls deterministic six-pack sealed pools', () => {
    const a = rollSealedPool(CARD_DB, 77);
    const b = rollSealedPool(CARD_DB, 77);
    const c = rollSealedPool(CARD_DB, 78);

    expect(a).toEqual(b);
    expect(a.cards).not.toEqual(c.cards);
    expect(a.packs).toHaveLength(6);
    expect(a.cards).toHaveLength(6 * ECONOMY.limitedPackSize);
  });
});

describe('limited deck validation and auto-build', () => {
  it('enforces exact size, pool counts, tokens, and unlimited basics', () => {
    const pool = deckOf([
      ['bear', 2],
      ['giant', 1],
      ['shock', 1],
    ]);
    const legal = deckOf([
      ['forest', 36],
      ['bear', 2],
      ['giant', 1],
      ['shock', 1],
    ]);

    expect(validateLimitedDeck(TEST_DB, pool, legal).filter((i) => i.kind === 'error')).toHaveLength(0);
    expect(validateLimitedDeck(TEST_DB, pool, legal.slice(1)).some((i) => i.message.includes('39/40'))).toBe(true);
    expect(validateLimitedDeck(TEST_DB, pool, [...legal, 'forest']).some((i) => i.message.includes('41/40'))).toBe(true);
    expect(validateLimitedDeck(TEST_DB, pool, [...legal.slice(0, 39), 'elf']).some((i) => i.message.includes('pool'))).toBe(true);
    expect(validateLimitedDeck(TEST_DB, pool, [...legal.slice(0, 39), 'tok_fox']).some((i) => i.message.includes('token'))).toBe(true);
    expect(validateLimitedDeck(TEST_DB, pool, [...legal.slice(0, 39), 'bear']).some((i) => i.message.includes('pool'))).toBe(true);
  });

  it('auto-builds legal sealed decks across representative seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const pool = rollSealedPool(CARD_DB, seed).cards;
      const deck = buildLimitedDeck(CARD_DB, pool);
      expect(deck).toHaveLength(40);
      expect(validateLimitedDeck(CARD_DB, pool, deck).filter((i) => i.kind === 'error')).toHaveLength(0);
    }
  });
});

describe('bot draft', () => {
  it('passes packs and remains deterministic', () => {
    const a = startBotDraft(CARD_DB, 99);
    const b = startBotDraft(CARD_DB, 99);
    expect(a).toEqual(b);

    const firstPick = currentDraftPack(a)[0];
    const next = pickDraftCard(CARD_DB, a, firstPick);

    expect(next.picks[0]).toEqual([firstPick]);
    expect(next.pickIndex).toBe(1);
    expect(currentDraftPack(next)).toHaveLength(ECONOMY.limitedPackSize - 1);
  });

  it('rolls deterministic premium variants while free drafts carry no premium fields', () => {
    const premiumA = startBotDraft(CARD_DB, 909, { premium: true });
    const premiumB = startBotDraft(CARD_DB, 909, { premium: true });
    const free = startBotDraft(CARD_DB, 909);
    const freeRun = startDraftRun(CARD_DB, 909, 1000);

    expect(premiumA.packVariants).toEqual(premiumB.packVariants);
    expect(premiumA.currentPackVariants).toEqual(premiumB.currentPackVariants);
    expect(premiumA.packVariants).toHaveLength(3);
    expect(premiumA.packVariants?.[0]).toHaveLength(DRAFT_SEATS);
    expect(premiumA.packVariants?.[0][0]).toHaveLength(ECONOMY.limitedPackSize);
    expect(free).not.toHaveProperty('packVariants');
    expect(free).not.toHaveProperty('currentPackVariants');
    expect(free).not.toHaveProperty('pickVariants');
    expect(freeRun).not.toHaveProperty('premium');
    expect(freeRun.draft).not.toHaveProperty('packVariants');
    const freeNext = pickDraftCard(CARD_DB, free, free.currentPacks[0][0], 0);
    expect(freeNext).not.toHaveProperty('packVariants');
    expect(freeNext).not.toHaveProperty('currentPackVariants');
    expect(freeNext).not.toHaveProperty('pickVariants');
  });

  it('keeps every premium variant aligned with its card through two pack rotations', () => {
    const initial = startBotDraft(CARD_DB, 1919, { premium: true });
    const originalSeatZero = draftPairs(initial.currentPacks[0], initial.currentPackVariants![0]);

    const once = pickDraftCard(CARD_DB, initial, initial.currentPacks[0][0], 0);
    expect(draftPairs(once.currentPacks[1], once.currentPackVariants![1])).toEqual(originalSeatZero.slice(1));
    expect(once.pickVariants).toEqual([initial.currentPackVariants![0][0]]);

    const beforeSecondBotPick = draftPairs(once.currentPacks[1], once.currentPackVariants![1]);
    const twice = pickDraftCard(CARD_DB, once, once.currentPacks[0][0], 0);
    const botChoice = twice.picks[1].at(-1)!;
    const removedIndex = beforeSecondBotPick.findIndex((slot) => slot.cardId === botChoice);
    const expectedAfterSecondPass = beforeSecondBotPick.filter((_, index) => index !== removedIndex);

    expect(removedIndex).toBeGreaterThanOrEqual(0);
    expect(draftPairs(twice.currentPacks[2], twice.currentPackVariants![2])).toEqual(expectedAfterSecondPass);

    let atNextPack = twice;
    while (atNextPack.packIndex === 0) {
      atNextPack = pickDraftCard(CARD_DB, atNextPack, atNextPack.currentPacks[0][0], 0);
    }
    expect(atNextPack.packIndex).toBe(1);
    expect(draftPairs(atNextPack.currentPacks[0], atNextPack.currentPackVariants![0])).toEqual(
      draftPairs(atNextPack.packs[1][0], atNextPack.packVariants![1][0]),
    );
  });

  it('completes a 3-pack bot draft and builds legal opponent decks', () => {
    let run = startDraftRun(CARD_DB, 101, 1000);
    while (run.draft && !run.draft.completed) {
      run = { ...run, draft: pickDraftCard(CARD_DB, run.draft, currentDraftPack(run.draft)[0]) };
    }

    const completed = completeDraftRun(CARD_DB, run);

    expect(completed.status).toBe('build');
    expect(completed.pool).toHaveLength(3 * ECONOMY.limitedPackSize);
    expect(completed.opponentDecks).toHaveLength(3);
    completed.opponentDecks.forEach((deck, i) => {
      expect(deck).toHaveLength(40);
      expect(validateLimitedDeck(CARD_DB, completed.draft!.picks[i + 1], deck).filter((issue) => issue.kind === 'error')).toHaveLength(0);
    });
  });

  it('keeps DEFAULT_PICKER base scores lockstep with the old heuristic over the whole pool', () => {
    // The DECK-BUILDING path (scoreDeckCard/chooseDeckColors in Limited.ts) also
    // routes through scoreBasePick(d, DEFAULT_PICKER) now — pin that equivalence
    // exhaustively so auto-build texture can't drift silently either.
    for (const d of Object.values(CARD_DB)) {
      expect(scoreBasePick(d, DEFAULT_PICKER), d.id).toBe(scoreBaseCardReference(d));
    }
  });

  it('keeps DEFAULT_PICKER bot choices lockstep with the old heuristic across 20 full drafts', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let state = startBotDraft(CARD_DB, seed);
      state = { ...state, personaIds: ['', ...Array.from({ length: DRAFT_SEATS - 1 }, () => 'dp-chris')] };

      while (!state.completed) {
        const expected = state.currentPacks.map((pack, seat) =>
          seat === 0 || pack.length === 0 ? null : chooseBotDraftPickReference(CARD_DB, pack, state.picks[seat]),
        );
        const next = pickDraftCard(CARD_DB, state, currentDraftPack(state)[0]);
        for (let seat = 1; seat < DRAFT_SEATS; seat++) {
          if (expected[seat]) expect(next.picks[seat].at(-1), `seed ${seed}, seat ${seat}`).toBe(expected[seat]);
        }
        state = next;
      }
    }
  });

  it('reproduces persona seats, picks, and opponent decks from the same seed', () => {
    const finish = (seed: number) => {
      let run = startDraftRun(CARD_DB, seed, 1000);
      while (run.draft && !run.draft.completed) {
        run = { ...run, draft: pickDraftCard(CARD_DB, run.draft, currentDraftPack(run.draft)[0]) };
      }
      return completeDraftRun(CARD_DB, run);
    };

    const a = finish(7301);
    const b = finish(7301);
    expect(a.draft?.personaIds).toEqual(b.draft?.personaIds);
    expect(a.draft?.picks).toEqual(b.draft?.picks);
    expect(a.opponentDecks).toEqual(b.opponentDecks);
  });

  it('auto-builds legal persona-drafted decks across 10 seeds, including mono-forcer and chaos seats', () => {
    for (let seed = 41; seed <= 50; seed++) {
      let run = startDraftRun(CARD_DB, seed, 1000);
      run.draft!.personaIds = [
        '',
        'dp-derek',
        'dp-cody',
        'dp-chris',
        'dp-tiffany',
        'dp-kevin',
        'dp-rachel',
        'dp-brandon',
      ];
      while (run.draft && !run.draft.completed) {
        run = { ...run, draft: pickDraftCard(CARD_DB, run.draft, currentDraftPack(run.draft)[0]) };
      }

      const completed = completeDraftRun(CARD_DB, run);
      completed.opponentDecks.forEach((deck, i) => {
        expect(deck, `seed ${seed}, seat ${i + 1}`).toHaveLength(40);
        expect(
          validateLimitedDeck(CARD_DB, completed.draft!.picks[i + 1], deck).filter((issue) => issue.kind === 'error'),
          `seed ${seed}, seat ${i + 1}`,
        ).toHaveLength(0);
      });
    }
  });

  it('advances persona familiarity per completed draft and clamps the reveal tier at 4', () => {
    const state = freshLimitedState();
    const run = startDraftRun(CARD_DB, 616, 1000);
    const seated = run.draft!.personaIds.filter((id) => id !== '');
    const absent = DRAFT_PERSONAS.map((p) => p.id).find((id) => !seated.includes(id))!;

    // Tier 1 before any completed draft — a first meeting shows name+portrait.
    expect(personaRevealTier(state, seated[0])).toBe(1);

    for (let drafts = 1; drafts <= 5; drafts++) {
      recordDraftEncounters(state, run);
      for (const id of seated) {
        expect(state.personaSeen[id], id).toBe(drafts);
        expect(personaRevealTier(state, id), id).toBe(Math.min(4, drafts + 1));
      }
    }
    // Personas not at the table learn nothing; sealed runs never count.
    expect(state.personaSeen[absent]).toBeUndefined();
    const before = { ...state.personaSeen };
    recordDraftEncounters(state, startSealedRun(CARD_DB, 617, 1000));
    expect(state.personaSeen).toEqual(before);
  });

  it('carries the matching draft opponent persona into duel data and leaves sealed duels unassigned', () => {
    const draft = startDraftRun(CARD_DB, 808, 1000);
    for (let matchIndex = 0; matchIndex < 3; matchIndex++) {
      draft.matchIndex = matchIndex;
      expect(limitedDuelData(draft).limited.opponentPersonaId).toBe(draft.draft!.personaIds[matchIndex + 1]);
    }

    const sealed = startSealedRun(CARD_DB, 809, 1000);
    expect(limitedDuelData(sealed).limited.opponentPersonaId).toBeUndefined();
  });
});

describe('limited rewards', () => {
  it('charges the Premium Draft fee only when affordable', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.premiumDraftEntry;
    expect(payPremiumDraftEntry(save, '2026-07-14')).toBe(true);
    expect(save.gold).toBe(0);

    save.gold = ECONOMY.premiumDraftEntry - 1;
    expect(payPremiumDraftEntry(save, '2026-07-14')).toBe(false);
    expect(save.gold).toBe(ECONOMY.premiumDraftEntry - 1);
  });

  it('grants all 45 premium picks with their rolled variants exactly once', () => {
    const run = finishDraft(4242, true);
    const save = freshSave(0);
    const ids = [...run.draft!.picks[0]];
    const variants = run.draft!.pickVariants!.map((variant) => ({ ...variant }));

    const results = grantPremiumDraftPool(save, CARD_DB, run);

    expect(results).toHaveLength(45);
    expect(results.map((result) => result.cardId)).toEqual(ids);
    expect(results.map(({ frame, holo }) => ({ frame, holo }))).toEqual(variants);
    const expectedVariants: Record<string, Record<string, number>> = {};
    for (const result of results) {
      if (result.dupeGold > 0) continue;
      const perCard = (expectedVariants[result.cardId] ??= {});
      const key = variantKey({ frame: result.frame, holo: result.holo });
      perCard[key] = (perCard[key] ?? 0) + 1;
    }
    expect(save.collectionVariants).toEqual(expectedVariants);
    expect(save.collection).toEqual(
      Object.fromEntries(
        Object.entries(expectedVariants).map(([id, perVariant]) => [
          id,
          Object.values(perVariant).reduce((sum, count) => sum + count, 0),
        ]),
      ),
    );

    const completed = completeDraftRun(CARD_DB, run);
    const collectionAfterFirstGrant = structuredClone(save.collection);
    const variantsAfterFirstGrant = structuredClone(save.collectionVariants);
    const goldAfterFirstGrant = save.gold;
    expect(grantPremiumDraftPool(save, CARD_DB, completed)).toEqual([]);
    expect(save.collection).toEqual(collectionAfterFirstGrant);
    expect(save.collectionVariants).toEqual(variantsAfterFirstGrant);
    expect(save.gold).toBe(goldAfterFirstGrant);
  });

  it('melts plain premium picks past the playset exactly like pack opening', () => {
    const run = finishDraft(5252, true);
    const cardId = run.draft!.picks[0][0];
    run.draft!.picks[0] = Array.from({ length: 45 }, () => cardId);
    run.draft!.pickVariants = Array.from({ length: 45 }, () => ({ ...PLAIN_VARIANT }));
    const save = freshSave(0);

    const results = grantPremiumDraftPool(save, CARD_DB, run);
    const dupeGold = ECONOMY.dupeGold[def(CARD_DB, cardId).rarity];

    expect(results).toHaveLength(45);
    expect(results.filter((result) => result.dupeGold === dupeGold)).toHaveLength(41);
    expect(save.collection[cardId]).toBe(4);
    expect(save.collectionVariants[cardId]).toEqual({ [variantKey(PLAIN_VARIANT)]: 4 });
    expect(save.gold).toBe(41 * dupeGold);
  });

  it('keeps special premium variants past the playset', () => {
    const run = finishDraft(5353, true);
    const cardId = run.draft!.picks[0][0];
    const special: CardVariant = { frame: 'gold', holo: 'shiny' };
    run.draft!.picks[0] = Array.from({ length: 45 }, () => cardId);
    run.draft!.pickVariants = Array.from({ length: 45 }, () => ({ ...special }));
    const save = freshSave(0);

    const results = grantPremiumDraftPool(save, CARD_DB, run);

    expect(results.every((result) => result.dupeGold === 0)).toBe(true);
    expect(save.collection[cardId]).toBe(45);
    expect(save.collectionVariants[cardId]).toEqual({ [variantKey(special)]: 45 });
    expect(save.gold).toBe(0);
  });

  it('grants nothing for free drafts or sealed runs', () => {
    const freeRun = finishDraft(6262, false);
    const sealedRun = startSealedRun(CARD_DB, 6263, 1000);
    sealedRun.premium = true;
    const save = freshSave(0);

    expect(grantPremiumDraftPool(save, CARD_DB, freeRun)).toEqual([]);
    expect(grantPremiumDraftPool(save, CARD_DB, sealedRun)).toEqual([]);
    expect(save.collection).toEqual({});
    expect(save.collectionVariants).toEqual({});
  });

  it('stamps premium draft history with no Premium run-end reward', () => {
    const save = freshSave(0);
    const run = startDraftRun(CARD_DB, 7272, 1000, { premium: true });
    run.status = 'matches';
    save.limited.activeRun = run;

    applyLimitedMatchResult(save, 'easy', false, '2026-07-14', 'dual', 2000);
    applyLimitedMatchResult(save, 'medium', false, '2026-07-14', 'dual', 3000);
    const result = applyLimitedMatchResult(save, 'hard', false, '2026-07-14', 'dual', 4000);

    expect(result.gold).toBe(0);
    expect(save.limited.history[0]).toMatchObject({ mode: 'draft', premium: true, rewardGold: result.gold });

    const freeSave = freshSave(0);
    const freeRun = startDraftRun(CARD_DB, 7273, 1000);
    freeRun.status = 'matches';
    freeSave.limited.activeRun = freeRun;
    applyLimitedMatchResult(freeSave, 'easy', false, '2026-07-14', 'dual', 2000);
    applyLimitedMatchResult(freeSave, 'medium', false, '2026-07-14', 'dual', 3000);
    applyLimitedMatchResult(freeSave, 'hard', false, '2026-07-14', 'dual', 4000);
    expect(freeSave.limited.history[0]).not.toHaveProperty('premium');
  });

  it('records match stats and pays run-end gold without adding cards', () => {
    const save = freshSave(0);
    const run = startSealedRun(CARD_DB, 202, 1000);
    run.deck = buildLimitedDeck(CARD_DB, run.pool);
    run.status = 'matches';
    save.limited.activeRun = run;

    const r1 = applyLimitedMatchResult(save, 'easy', true, '2026-07-08', 'dual', 2000);
    expect(r1).toMatchObject({ runOver: false, wins: 1, losses: 0, gold: ECONOMY.firstWinOfDayBonus });
    expect(save.gold).toBe(ECONOMY.firstWinOfDayBonus);
    expect(save.collection).toEqual({});

    const r2 = applyLimitedMatchResult(save, 'medium', false, '2026-07-08', 'dual', 3000);
    expect(r2).toMatchObject({ runOver: false, wins: 1, losses: 1, gold: 0 });

    const r3 = applyLimitedMatchResult(save, 'hard', true, '2026-07-08', 'dual', 4000);
    expect(r3).toMatchObject({ runOver: true, wins: 2, losses: 1, gold: ECONOMY.limitedRunGold[2] });
    expect(save.limited.activeRun).toBeNull();
    expect(save.limited.bestSealedWins).toBe(2);
    expect(save.limited.history[0]).toMatchObject({
      mode: 'sealed',
      seed: 202,
      wins: 2,
      losses: 1,
      deckStyle: 'dual',
      rewardGold: ECONOMY.limitedRunGold[2],
    });
    expect(save.stats.wins).toBe(2);
    expect(save.stats.losses).toBe(1);
    expect(save.collection).toEqual({});
  });
});

function finishDraft(seed: number, premium: boolean) {
  let run = startDraftRun(CARD_DB, seed, 1000, premium ? { premium: true } : {});
  while (run.draft && !run.draft.completed) {
    run = {
      ...run,
      draft: pickDraftCard(CARD_DB, run.draft, currentDraftPack(run.draft)[0], 0),
    };
  }
  return run;
}

function draftPairs(cards: readonly string[], variants: readonly CardVariant[]) {
  return cards.map((cardId, index) => ({ cardId, variant: variants[index] }));
}

// Frozen copy of the pre-persona Limited.ts picker. This is deliberately kept
// independent from draftPicker.ts so neutral-profile arithmetic drift is caught.
function chooseBotDraftPickReference(db: CardDb, pack: readonly string[], picks: readonly string[]): string {
  return [...pack].sort(
    (a, b) =>
      scoreDraftCardReference(db, b, picks) - scoreDraftCardReference(db, a, picks) || compareCardNames(db, a, b),
  )[0];
}

function scoreDraftCardReference(db: CardDb, id: string, picks: readonly string[]): number {
  const d = def(db, id);
  let score = scoreBaseCardReference(d);
  const committed = committedColorsReference(db, picks);
  if (picks.length >= 5 && d.colors.length > 0) {
    const overlap = d.colors.filter((c) => committed.includes(c)).length;
    if (overlap === d.colors.length) score += 5;
    else if (overlap > 0) score += 1;
    else score -= 7;
  }
  if (isType(d, 'land') && !isBasic(db, id)) {
    const mana = d.manaAbility ?? [];
    score += mana.some((c) => committed.includes(c)) ? 4 : 1;
  }
  return score;
}

function scoreBaseCardReference(d: CardDef): number {
  let score = TIER_RANK[d.rarity] * 4;
  const mv = manaValue(d.cost);
  if (isType(d, 'creature')) {
    score += 5 + (d.attack ?? 0) * 1.2 + (d.defense ?? 0) * 0.8;
    score += (d.keywords?.length ?? 0) * 1.5;
  } else if (isType(d, 'charm') || isType(d, 'ritual')) {
    score += 4;
  } else if (isType(d, 'enchantment') || isType(d, 'artifact')) {
    score += 2;
  }
  if (d.abilities?.some((a) => a.ops?.some((op) => op.op === 'destroy' || op.op === 'damage' || op.op === 'cancel'))) {
    score += 5;
  }
  if (d.abilities?.some((a) => a.ops?.some((op) => op.op === 'draw' || op.op === 'raise' || op.op === 'reclaim'))) {
    score += 3;
  }
  if (mv >= 2 && mv <= 4) score += 2;
  if (mv >= 7) score -= 3;
  return score;
}

function committedColorsReference(db: CardDb, picks: readonly string[]): Color[] {
  const order: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
  if (picks.length === 0) return [];
  const scores = new Map<Color, number>();
  for (const color of order) scores.set(color, 0);
  for (const id of picks) {
    const d = def(db, id);
    if (d.token || isType(d, 'land')) continue;
    for (const color of d.colors) scores.set(color, (scores.get(color) ?? 0) + 1 + TIER_RANK[d.rarity]);
  }
  return order
    .filter((color) => (scores.get(color) ?? 0) > 0)
    .sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || order.indexOf(a) - order.indexOf(b))
    .slice(0, 2);
}

function compareCardNames(db: CardDb, a: string, b: string): number {
  const da = def(db, a);
  const dbb = def(db, b);
  return da.name.localeCompare(dbb.name) || a.localeCompare(b);
}
