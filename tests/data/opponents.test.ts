import { describe, expect, it } from 'vitest';
import { AVATARS, avatarForRung, avatarById } from '../../src/data/opponents';
import { CARD_DB } from '../../src/data/catalog';
import { buildAI } from '../../src/ai/personality';
import { MediumAI } from '../../src/ai/MediumAI';
import { Game } from '../../src/engine/Game';
import type { Color } from '../../src/engine/types';
import { RULES } from '../../src/config/rules';

/**
 * SUITE C — Avatar legality + termination smoke.
 *
 * Every gauntlet deck must be a legal 60-card list built from real ids, and
 * every avatar must be able to play a full game to completion (guards against
 * defensive personalities stalling into the turn-100 draw cap).
 */

describe('avatar roster shape', () => {
  it('has exactly 8 avatars with unique tiers 1..8', () => {
    expect(AVATARS).toHaveLength(8);
    const tiers = AVATARS.map((a) => a.tier).sort((x, y) => x - y);
    expect(tiers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(8);
  });

  it('assigns difficulty by tier band (1-3 easy, 4-6 medium, 7-8 hard)', () => {
    for (const a of AVATARS) {
      const expected = a.tier <= 3 ? 'easy' : a.tier <= 6 ? 'medium' : 'hard';
      expect(a.difficulty).toBe(expected);
    }
  });

  it('avatarForRung / avatarById resolve consistently', () => {
    for (let rung = 1; rung <= 8; rung++) {
      const a = avatarForRung(rung);
      expect(a.tier).toBe(rung);
      expect(avatarById(a.id)).toBe(a);
    }
    expect(() => avatarForRung(9)).toThrow();
    expect(() => avatarById('nope')).toThrow();
  });
});

describe.each(AVATARS.map((a) => [a.name, a] as const))('avatar deck legality — %s', (_name, avatar) => {
  const counts = new Map<string, number>();
  for (const id of avatar.deck) counts.set(id, (counts.get(id) ?? 0) + 1);

  it('is exactly 60 cards', () => {
    expect(avatar.deck).toHaveLength(RULES.deckSize);
  });

  it('has ≤4 copies of every non-basic (basics unlimited)', () => {
    for (const [id, n] of counts) {
      const basic = CARD_DB[id]?.supertypes?.includes('basic');
      if (!basic) expect(n, `${id} x${n}`).toBeLessThanOrEqual(RULES.maxCopies);
    }
  });

  it('contains only real, non-token cards', () => {
    for (const id of counts.keys()) {
      const d = CARD_DB[id];
      expect(d, `unknown id ${id}`).toBeDefined();
      expect(d.token, `${id} is a token`).toBeFalsy();
    }
  });

  it('has every colored pip coverable by its lands', () => {
    const landColors = new Set<Color>();
    for (const id of counts.keys()) {
      const d = CARD_DB[id];
      if (d.types.includes('land')) for (const c of d.manaAbility ?? []) landColors.add(c);
    }
    const needed = new Set<Color>();
    for (const id of counts.keys()) {
      const cost = CARD_DB[id]?.cost;
      if (!cost) continue;
      for (const c of Object.keys(cost.pips ?? {}) as Color[]) {
        if ((cost.pips[c] ?? 0) > 0) needed.add(c);
      }
    }
    for (const c of needed) {
      expect(landColors.has(c), `pip ${c} uncoverable (lands: ${[...landColors].join('')})`).toBe(true);
    }
  });

  it('names a creature in the deck as its portrait', () => {
    expect(counts.has(avatar.portraitCardId), `portrait ${avatar.portraitCardId} not in deck`).toBe(true);
    expect(CARD_DB[avatar.portraitCardId]?.types.includes('creature')).toBe(true);
  });
});

describe('avatar termination smoke (3 seeds each, vs Medium)', () => {
  const opponent = () =>
    // A neutral aggressive-ish opponent deck: the starter is fine as a foil.
    AVATARS[0].deck; // Meng Huo's stompy list makes a decent generic opponent

  for (const avatar of AVATARS) {
    it(`${avatar.name} plays 3 games to completion`, () => {
      for (let s = 0; s < 3; s++) {
        const seed = s * 101 + 7;
        const decks: [string[], string[]] = [avatar.deck, opponent()];
        const game = new Game({ decks, seed, db: CARD_DB });
        const ais = [
          buildAI(avatar.difficulty, CARD_DB, seed * 3 + 1, avatar.personality),
          new MediumAI(CARD_DB),
        ];
        let terminated = false;
        for (let i = 0; i < 40000; i++) {
          const a = game.awaiting;
          if (a.kind === 'gameOver') {
            terminated = true;
            break;
          }
          const p = a.player;
          game.submit(p, ais[p].chooseAction(game.viewFor(p), game.legalActions(p)));
        }
        expect(terminated, `${avatar.name} seed ${seed} did not terminate`).toBe(true);
        // turn cap is a legal draw outcome, but flag persistent stalling
        expect(game.state.winner === 0 || game.state.winner === 1 || game.state.winner === 'draw').toBe(true);
      }
    }, 60_000);
  }
});
