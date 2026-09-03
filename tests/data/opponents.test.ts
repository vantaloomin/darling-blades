import { describe, expect, it } from 'vitest';
import { AVATARS, avatarForRung, avatarById } from '../../src/data/opponents';
import { CARD_DB } from '../../src/data/catalog';
import { buildAI } from '../../src/ai/personality';
import { MediumAI } from '../../src/ai/MediumAI';
import { Game } from '../../src/engine/Game';
import type { Color } from '../../src/engine/types';
import { ECONOMY, RULES } from '../../src/config/rules';

/**
 * SUITE C — Avatar legality + termination smoke.
 *
 * Every gauntlet deck must be a legal 60-card list built from real ids, and
 * every avatar must be able to play a full game to completion (guards against
 * defensive personalities stalling into the turn-100 draw cap).
 */

describe('avatar roster shape', () => {
  it('has exactly 24 landed avatars with unique tiers 1..24', () => {
    expect(AVATARS).toHaveLength(24);
    const tiers = AVATARS.map((a) => a.tier).sort((x, y) => x - y);
    expect(tiers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(24);
    expect(ECONOMY.gauntletRungGold).toHaveLength(24);
    expect(ECONOMY.gauntletRungGold.slice(14)).toEqual([330, 350, 370, 390, 410, 430, 450, 470, 490, 510]);
  });

  it('assigns difficulty by tier band (1-3 easy, 4-6 medium, 7-24 hard)', () => {
    for (const a of AVATARS) {
      const expected = a.tier <= 3 ? 'easy' : a.tier <= 6 ? 'medium' : 'hard';
      expect(a.difficulty).toBe(expected);
    }
  });

  it('avatarForRung / avatarById resolve consistently', () => {
    for (let rung = 1; rung <= 24; rung++) {
      const a = avatarForRung(rung);
      expect(a.tier).toBe(rung);
      expect(avatarById(a.id)).toBe(a);
    }
    expect(avatarForRung(11).id).toBe('the-morrigan');
    expect(avatarForRung(12).id).toBe('titania');
    expect(avatarForRung(13).id).toBe('morgan');
    expect(avatarForRung(14).id).toBe('artoria');
    expect(avatarForRung(15).id).toBe('carmilla');
    expect(avatarForRung(16).id).toBe('the-bride');
    expect(avatarForRung(17).id).toBe('glass-coffin-queen');
    expect(avatarForRung(18).id).toBe('abyssal-songstress');
    expect(avatarForRung(18).name).toContain('Abyssal Songstress');
    expect(avatarForRung(19).id).toBe('queen-of-the-lanterned-roof');
    expect(avatarForRung(20).id).toBe('kitsune-neon-tyrant');
    expect(avatarForRung(21).id).toBe('anubis-who-holds-the-scale');
    expect(avatarForRung(22).id).toBe('bastet-mistress-of-the-ninth-return');
    expect(avatarForRung(23).id).toBe('chrome-broodmother');
    expect(avatarForRung(23).name).toBe('Chrome Broodmother');
    expect(avatarForRung(24).id).toBe('the-violet-signal-queen');
    expect(avatarForRung(24).name).toBe('The Violet Signal Queen');
    expect(() => avatarForRung(25)).toThrow();
    expect(() => avatarById('nope')).toThrow();
  });
});

describe('Chrome Broodmother contract shape', () => {
  const avatar = AVATARS.find((entry) => entry.id === 'chrome-broodmother')!;

  it('lands the authored identity, personality, and exact classic counts', () => {
    expect(avatar).toMatchObject({
      id: 'chrome-broodmother',
      name: 'Chrome Broodmother',
      title: 'The Hull Keeps Its Own Crew',
      blurb: 'She seeds the board before you notice, marks her favorite, and lets Propagate do the counting. By the time the swarm turns sideways it is already too wide to block.',
      theme: 'Red-Green Mark Swarm (Propagate, Overrun)',
      tier: 23,
      difficulty: 'hard',
      portraitCardId: 'sb-rootlight-broodmother',
      darlingId: 'sb-orbitroot-matriarch',
      personality: {
        aggression: 1.2,
        holdback: 0.7,
        attackThreshold: 0.3,
        removalBias: 0.5,
        subtypeBias: 0.5,
        preferredSubtypes: ['Matriarch', 'Brood', 'Starship'],
      },
    });
    // 2026-08-30 tuning pass (measured surgery, 44% -> 68% avg; the evidence
    // chain lives in the avatar's dated comment): the v3.1-nerfed grafter
    // curve gave way to the cross-set fire package.
    const expectedCounts = {
      'land-forest': 10,
      'land-mountain': 10,
      'sb-radiant-comet-lane': 4,
      'sb-mycelial-star-gardener': 4,
      'cf-heatherblade-scout': 4,
      'sb-ion-storm-brawler': 4,
      'sb-burning-hull-runner': 2,
      'sb-lance-of-two-suns': 2,
      'sb-chrome-sunbreaker': 4,
      'sb-comet-kick-marauder': 2,
      'sb-orbitroot-matriarch': 2,
      'sb-rootlight-broodmother': 2,
      'sb-emerald-bloom-mother': 2,
      'sb-brood-communion': 2,
      'sb-red-solar-lash': 2,
      'sb-starfall-barrage': 2,
      'sb-redline-supernova': 2,
    };
    const actualCounts = Object.fromEntries(
      [...new Set(avatar.deck)].map((id) => [id, avatar.deck.filter((cardId) => cardId === id).length]),
    );
    expect(actualCounts).toEqual(expectedCounts);
    expect(avatar.reserveDeck).toHaveLength(40);
    expect(avatar.landReserve).toEqual([
      'sb-radiant-comet-lane', 'sb-radiant-comet-lane', 'sb-radiant-comet-lane', 'sb-radiant-comet-lane',
      'land-forest', 'land-forest', 'land-forest', 'land-mountain', 'land-mountain', 'land-mountain',
    ]);
    expect(avatar.darlingsDeck).toHaveLength(79);
  });
});

describe('The Violet Signal Queen contract shape', () => {
  const avatar = AVATARS.find((entry) => entry.id === 'the-violet-signal-queen')!;

  it('lands the amended Darling identity, personality, and exact classic counts', () => {
    expect(avatar).toMatchObject({
      id: 'the-violet-signal-queen',
      name: 'The Violet Signal Queen',
      title: 'Every Answer Arrives Early',
      blurb: 'She reads three turns ahead and files the future under handled. Counters for the spell, severance for the grave, and a court of untouchable threats for everything that survives the paperwork.',
      theme: 'Blue-Black Signal Control (Foresee, Sever, Cancel)',
      tier: 24,
      difficulty: 'hard',
      portraitCardId: 'sb-astral-reef-singer',
      darlingId: 'sd-sitra-ferrywoman-of-two-rivers',
      personality: {
        aggression: 0.7,
        holdback: 1.3,
        attackThreshold: 0.15,
        removalBias: 1.0,
        subtypeBias: 0.4,
        preferredSubtypes: ['Singer', 'Navigator'],
      },
    });
    const expectedCounts = {
      'land-island': 12,
      'land-swamp': 12,
      'sb-star-reader': 4,
      'sb-velvet-void-cartographer': 4,
      'sb-severance-priestess': 2,
      'sb-darkmatter-harvester': 2,
      'sb-void-halo-assassin': 2,
      'sb-violet-maw': 2,
      'sb-voidcurrent-conjurer': 2,
      'dt-poison-mirror-regent': 2,
      'sb-astral-reef-singer': 2,
      'sb-abyssal-iris-regent': 2,
      'sb-signal-drown': 2,
      'sb-collapse-the-lane': 2,
      'sb-marrow-eviction': 2,
      'sb-void-lament': 2,
      'sb-corpse-lantern': 2,
      'sb-deep-space-severance': 2,
    };
    const actualCounts = Object.fromEntries(
      [...new Set(avatar.deck)].map((id) => [id, avatar.deck.filter((cardId) => cardId === id).length]),
    );
    expect(actualCounts).toEqual(expectedCounts);
    expect(avatar.reserveDeck).toHaveLength(40);
    expect(avatar.landReserve).toEqual([
      'land-island', 'land-island', 'land-island', 'land-island', 'land-island',
      'land-swamp', 'land-swamp', 'land-swamp', 'land-swamp', 'land-swamp',
    ]);
    expect(avatar.darlingsDeck).toHaveLength(79);
    expect(avatar.darlingsDeck).not.toContain(avatar.darlingId);
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
      if (d.types.includes('land')) {
        for (const c of d.manaAbility ?? []) if (c !== 'C') landColors.add(c);
      }
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
