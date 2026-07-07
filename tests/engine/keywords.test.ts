import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { getEffectiveStats } from '../../src/engine/statics';
import { combatSetup, makeTestState, TEST_DB } from '../helpers';

describe('first strike', () => {
  it('a first-strike blocker kills the attacker before it deals damage', () => {
    // knight (2/2 FS) blocks bear (2/2): bear dies in the FS sub-step and
    // never strikes back — knight is unharmed.
    const { game, iid } = combatSetup(
      [{ key: 'bear', cardId: 'bear' }],
      [{ key: 'knight', cardId: 'knight' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.bear] });
    const events = game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.knight, attacker: iid.bear }],
    });
    expect(events.some((e) => e.e === 'died' && e.iid === iid.bear)).toBe(true);
    const knight = game.state.battlefield.find((p) => p.iid === iid.knight)!;
    expect(knight.damage).toBe(0);
    // and the combatDamage event stream shows a first-strike step
    expect(events.some((e) => e.e === 'combatDamage' && e.firstStrike)).toBe(true);
  });

  it('a surviving non-FS blocker still strikes back in the normal step', () => {
    // knight (2/2 FS) attacks into giant (4/4): knight deals 2 first, giant
    // survives (damage 2) and kills the knight in the normal step.
    const { game, iid } = combatSetup(
      [{ key: 'knight', cardId: 'knight' }],
      [{ key: 'giant', cardId: 'giant' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.knight] });
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.giant, attacker: iid.knight }],
    });
    expect(game.state.battlefield.some((p) => p.iid === iid.knight)).toBe(false);
    expect(game.state.battlefield.find((p) => p.iid === iid.giant)!.damage).toBe(2);
  });
});

describe('overrun', () => {
  it('overflow damage past a chump blocker hits the player', () => {
    const { game, iid } = combatSetup(
      [{ key: 'rhino', cardId: 'rhino' }],
      [{ key: 'elf', cardId: 'elf' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.rhino] });
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.elf, attacker: iid.rhino }],
    });
    // 4 power − 1 lethal to the 1/1 elf = 3 through
    expect(game.state.players[1].life).toBe(17);
  });

  it('deathtouch + trample assigns only 1 per blocker, rest overflows', () => {
    const { game, iid } = combatSetup(
      [{ key: 'dt', cardId: 'dt_rhino' }],
      [{ key: 'giant', cardId: 'giant' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.dt] });
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.giant, attacker: iid.dt }],
    });
    // 1 (deathtouch-lethal) to the 4/4 giant — it dies — and 3 to the player.
    expect(game.state.battlefield.some((p) => p.iid === iid.giant)).toBe(false);
    expect(game.state.players[1].life).toBe(17);
  });

  it('without trample, excess damage on a blocked attacker is wasted', () => {
    const { game, iid } = combatSetup(
      [{ key: 'giant', cardId: 'giant' }],
      [{ key: 'elf', cardId: 'elf' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.giant] });
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.elf, attacker: iid.giant }],
    });
    expect(game.state.players[1].life).toBe(20);
  });
});

describe('deathblade', () => {
  it('any nonzero deathtouch damage destroys the creature', () => {
    const { game, iid } = combatSetup(
      [{ key: 'assassin', cardId: 'assassin' }],
      [{ key: 'giant', cardId: 'giant' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.assassin] });
    game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.giant, attacker: iid.assassin }],
    });
    // both die: giant takes 1 deathtouch damage, assassin takes 4
    expect(game.state.battlefield).toHaveLength(0);
  });
});

describe('bloodoath', () => {
  it('heals its controller for combat damage dealt to players and creatures', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'cleric', controller: 0 },
        { iid: 2, cardId: 'cleric', controller: 0 },
        { iid: 3, cardId: 'bear', controller: 1 },
      ],
      active: 0,
    });
    state.players[0].life = 10;
    const g = Game.restore(state, TEST_DB);
    g.submit(0, { type: 'passStep' });
    g.submit(0, { type: 'declareAttackers', attackers: [1, 2] });
    g.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: 3, attacker: 1 }],
    });
    // cleric 1 dealt 2 to the bear (dies trading), cleric 2 dealt 2 to face.
    // lifelink: +2 +2 = 14 minus... cleric1 died? bear is 2/2 vs cleric 2/2 → trade.
    expect(g.state.players[0].life).toBe(14);
    expect(g.state.players[1].life).toBe(18);
  });
});

describe('haste and vigilance and defender and reach and flying', () => {
  it('effective stats expose granted keywords through until-EOT mods', () => {
    const state = makeTestState({
      battlefield: [
        {
          iid: 1,
          cardId: 'bear',
          controller: 0,
          untilEotMods: [{ p: 1, t: 1, keywords: ['skyborne'] }],
        },
      ],
    });
    const stats = getEffectiveStats(state.battlefield, TEST_DB, 1);
    expect(stats.power).toBe(3);
    expect(stats.toughness).toBe(3);
    expect(stats.keywords.has('skyborne')).toBe(true);
  });

  it('hexproof is carried in effective stats (targeting rules land in M5)', () => {
    const state = makeTestState({
      battlefield: [
        {
          iid: 1,
          cardId: 'bear',
          controller: 0,
          untilEotMods: [{ p: 0, t: 0, keywords: ['untouchable'] }],
        },
      ],
    });
    expect(getEffectiveStats(state.battlefield, TEST_DB, 1).keywords.has('untouchable')).toBe(true);
  });
});
