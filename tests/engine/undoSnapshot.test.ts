import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * The in-duel Undo (F11) keeps a one-deep Game.clone() taken before a committed
 * action and restores it on undo. This pins the property it relies on: the
 * clone is a byte-identical, independent snapshot — submitting on the original
 * never touches it, and it faithfully reproduces the pre-action state. Doubles
 * as a Game.clone/restore determinism guard.
 */
describe('undo snapshot (Game.clone as a restore point)', () => {
  it('a pre-action clone stays byte-identical after the original acts', () => {
    const g = Game.restore(makeTestState({ hands: [['forest'], []], active: 0 }), TEST_DB);
    const before = JSON.stringify(g.state);

    const snapshot = g.clone();
    const land = g.legalActions(0).find((a) => a.type === 'playLand');
    expect(land).toBeDefined();
    g.submit(0, land!);

    expect(JSON.stringify(g.state)).not.toBe(before); // the live game moved on
    expect(JSON.stringify(snapshot.state)).toBe(before); // the snapshot did not
  });

  it('restoring from the snapshot reproduces the pre-action state exactly', () => {
    const g = Game.restore(makeTestState({ hands: [['bear', 'forest'], []], active: 0 }), TEST_DB);
    // Play the land first so there is real pre-action state to restore to.
    g.submit(0, g.legalActions(0).find((a) => a.type === 'playLand')!);
    const before = JSON.stringify(g.state);

    const snapshot = g.clone();
    // Any further legal action mutates g…
    const next = g.legalActions(0).find((a) => a.type === 'passStep');
    g.submit(0, next!);
    expect(JSON.stringify(g.state)).not.toBe(before);

    // …and "undo" (adopt the snapshot) is byte-identical to before that action.
    const restored = snapshot;
    expect(JSON.stringify(restored.state)).toBe(before);
  });
});
