import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import { combatSetup } from '../helpers';

/**
 * Playtest pin (2026-07-16): "I had a firstBlade character die in normal
 * combat" — verify the first-strike sequencing in
 * src/engine/combat/damage.ts. A firstBlade creature only dodges return
 * damage when its first-strike hit is LETHAL; against a bigger blocker it
 * deals first, the blocker survives, and the normal-damage step kills it.
 * That death is correct behavior, not a bug.
 */
describe('firstBlade combat sequencing (playtest pin)', () => {
  it('firstBlade attacker vs bigger blocker: deals first, blocker survives, attacker dies in the normal step', () => {
    // knight (2/2 firstBlade) attacks, giant (4/4 vanilla) blocks.
    const { game, iid } = combatSetup(
      [{ key: 'knight', cardId: 'knight' }],
      [{ key: 'giant', cardId: 'giant' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.knight] });
    const events: GameEvent[] = game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.giant, attacker: iid.knight }],
    });

    // The knight is dead; the giant lives with exactly the FS damage marked.
    expect(game.state.battlefield.some((p) => p.iid === iid.knight)).toBe(false);
    const giant = game.state.battlefield.find((p) => p.iid === iid.giant)!;
    expect(giant.damage).toBe(2);

    // Sequencing: knight's 2 lands in the first-strike sub-step, the giant's 4
    // only in the normal sub-step, and the knight dies AFTER that normal hit.
    const fs = events.find((e) => e.e === 'combatDamage' && e.firstStrike);
    const normal = events.find((e) => e.e === 'combatDamage' && !e.firstStrike);
    expect(fs).toBeDefined();
    expect(normal).toBeDefined();
    if (fs?.e !== 'combatDamage' || normal?.e !== 'combatDamage') throw new Error('unreachable');
    expect(fs.hits).toEqual([
      { source: iid.knight, target: { kind: 'permanent', iid: iid.giant }, amount: 2 },
    ]);
    expect(normal.hits).toEqual([
      { source: iid.giant, target: { kind: 'permanent', iid: iid.knight }, amount: 4 },
    ]);
    const normalIdx = events.indexOf(normal);
    const diedIdx = events.findIndex((e) => e.e === 'died' && e.iid === iid.knight);
    expect(diedIdx).toBeGreaterThan(normalIdx);
  });

  it('firstBlade lethal: the blocker dies in the first-strike step and deals no damage back', () => {
    // knight (2/2 firstBlade) attacks, bear (2/2 vanilla) blocks: FS 2 is lethal.
    const { game, iid } = combatSetup(
      [{ key: 'knight', cardId: 'knight' }],
      [{ key: 'bear', cardId: 'bear' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.knight] });
    const events: GameEvent[] = game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.bear, attacker: iid.knight }],
    });

    expect(game.state.battlefield.some((p) => p.iid === iid.bear)).toBe(false);
    const knight = game.state.battlefield.find((p) => p.iid === iid.knight)!;
    expect(knight.damage).toBe(0); // never took the bear's normal-step swing

    // The bear never appears as a damage source in any step.
    for (const e of events) {
      if (e.e !== 'combatDamage') continue;
      expect(e.hits.some((h) => h.source === iid.bear)).toBe(false);
    }
  });

  it('twinBlades shares the path: a twinBlades attacker deals in both sub-steps', () => {
    // ds_bear (2/2 twinBlades) blocked by giant (4/4): 2 FS + 2 normal kill the
    // giant across the two steps; the giant's normal hit kills ds_bear back.
    const { game, iid } = combatSetup(
      [{ key: 'ds', cardId: 'ds_bear' }],
      [{ key: 'giant', cardId: 'giant' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.ds] });
    const events: GameEvent[] = game.submit(1, {
      type: 'declareBlockers',
      blocks: [{ blocker: iid.giant, attacker: iid.ds }],
    });

    const dsHitsFs = events.some(
      (e) => e.e === 'combatDamage' && e.firstStrike && e.hits.some((h) => h.source === iid.ds),
    );
    const dsHitsNormal = events.some(
      (e) => e.e === 'combatDamage' && !e.firstStrike && e.hits.some((h) => h.source === iid.ds),
    );
    expect(dsHitsFs).toBe(true);
    expect(dsHitsNormal).toBe(true);
    expect(game.state.battlefield.some((p) => p.iid === iid.giant)).toBe(false);
    expect(game.state.battlefield.some((p) => p.iid === iid.ds)).toBe(false);
  });
});
