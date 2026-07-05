import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { combatSetup, makeTestState, TEST_DB } from '../helpers';

describe('double strike', () => {
  it('an unblocked double-striker hits twice (first-strike step + normal step)', () => {
    const { game, iid } = combatSetup([{ key: 'a', cardId: 'ds_bear' }], []);
    game.submit(0, { type: 'declareAttackers', attackers: [iid.a] });
    const events = game.submit(1, { type: 'declareBlockers', blocks: [] });
    expect(game.state.players[1].life).toBe(16); // 20 - 2 - 2
    const dmg = events.filter((e) => e.e === 'combatDamage');
    expect(dmg).toHaveLength(2);
    expect(dmg.some((e) => e.e === 'combatDamage' && e.firstStrike)).toBe(true);
    expect(dmg.some((e) => e.e === 'combatDamage' && !e.firstStrike)).toBe(true);
  });

  it('first strike + double strike is two hits, not three', () => {
    const { game, iid } = combatSetup([{ key: 'a', cardId: 'ds_fs' }], []);
    game.submit(0, { type: 'declareAttackers', attackers: [iid.a] });
    const events = game.submit(1, { type: 'declareBlockers', blocks: [] });
    expect(game.state.players[1].life).toBe(16); // 20 - 2 - 2, NOT 14
    expect(events.filter((e) => e.e === 'combatDamage')).toHaveLength(2);
  });

  it('two hits kill a bigger blocker across the two steps', () => {
    // ds_bear (2/2 DS) blocked by giant (4/4): 2 in FS + 2 in normal = 4 → giant
    // dies; giant deals 4 back in the normal step → ds_bear dies too.
    const { game, iid } = combatSetup(
      [{ key: 'a', cardId: 'ds_bear' }],
      [{ key: 'g', cardId: 'giant' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.a] });
    game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: iid.g, attacker: iid.a }] });
    expect(game.state.battlefield.some((p) => p.iid === iid.g)).toBe(false);
    expect(game.state.battlefield.some((p) => p.iid === iid.a)).toBe(false);
  });

  it('a double-striker killed in the first-strike step deals no normal-step damage', () => {
    // ds_elf (1/1 DS) attacks into knight (2/2 FS): knight kills it in the FS
    // step, so ds_elf never lands its second hit.
    const { game, iid } = combatSetup(
      [{ key: 'a', cardId: 'ds_elf' }],
      [{ key: 'k', cardId: 'knight' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.a] });
    game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: iid.k, attacker: iid.a }] });
    expect(game.state.battlefield.some((p) => p.iid === iid.a)).toBe(false);
    const knight = game.state.battlefield.find((p) => p.iid === iid.k)!;
    expect(knight.damage).toBe(1); // took ds_elf's single first-strike hit
  });

  it('a deathtouch double-striker kills its blocker in the first step and takes nothing back', () => {
    const { game, iid } = combatSetup(
      [{ key: 'a', cardId: 'ds_deathtouch' }],
      [{ key: 'g', cardId: 'giant' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.a] });
    game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: iid.g, attacker: iid.a }] });
    // FS-step deathtouch damage is lethal → giant dies before it can strike back.
    expect(game.state.battlefield.some((p) => p.iid === iid.g)).toBe(false);
    const a = game.state.battlefield.find((p) => p.iid === iid.a)!;
    expect(a).toBeDefined();
    expect(a.damage).toBe(0);
  });

  it('trample: a chump that dies in the FS step lets the full power trample in the normal step', () => {
    // ds_trample (3/3) blocked by a 1/1 elf: FS assigns 1 lethal + tramples 2;
    // elf dies in the between-steps SBA → the normal step tramples the full 3.
    const { game, iid } = combatSetup(
      [{ key: 'a', cardId: 'ds_trample' }],
      [{ key: 'e', cardId: 'elf' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.a] });
    game.submit(1, { type: 'declareBlockers', blocks: [{ blocker: iid.e, attacker: iid.a }] });
    expect(game.state.battlefield.some((p) => p.iid === iid.e)).toBe(false);
    expect(game.state.players[1].life).toBe(15); // 20 - 2 (FS overflow) - 3 (normal full)
  });

  it('lifelink gains on both the first-strike and normal hits', () => {
    const state = makeTestState({
      battlefield: [{ iid: 1, cardId: 'ds_lifelink', controller: 0 }],
      active: 0,
    });
    state.players[0].life = 10;
    const g = Game.restore(state, TEST_DB);
    g.submit(0, { type: 'passStep' }); // main1 → combat
    g.submit(0, { type: 'declareAttackers', attackers: [1] });
    g.submit(1, { type: 'declareBlockers', blocks: [] }); // unblocked
    expect(g.state.players[0].life).toBe(14); // 10 + 2 + 2
    expect(g.state.players[1].life).toBe(16); // 20 - 2 - 2
  });

  it('regression: a plain (no-FS, no-DS) attacker still hits exactly once', () => {
    const { game, iid } = combatSetup([{ key: 'a', cardId: 'bear' }], []);
    game.submit(0, { type: 'declareAttackers', attackers: [iid.a] });
    const events = game.submit(1, { type: 'declareBlockers', blocks: [] });
    expect(game.state.players[1].life).toBe(18); // 20 - 2, one hit
    expect(events.filter((e) => e.e === 'combatDamage')).toHaveLength(1);
  });
});
