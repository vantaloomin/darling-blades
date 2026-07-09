import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import { def } from '../../src/engine/types';
import { isBasic } from '../../src/meta/Collection';
import { validateLimitedDeck } from '../../src/meta/DeckStorage';
import { applyLimitedMatchResult } from '../../src/meta/Economy';
import {
  buildLimitedDeck,
  completeDraftRun,
  currentDraftPack,
  pickDraftCard,
  rollLimitedPack,
  rollSealedPool,
  startBotDraft,
  startDraftRun,
  startSealedRun,
} from '../../src/meta/Limited';
import { freshSave } from '../../src/meta/SaveManager';
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
});

describe('limited rewards', () => {
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
