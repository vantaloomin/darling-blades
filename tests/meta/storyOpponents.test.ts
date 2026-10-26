import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS, avatarById } from '../../src/data/opponents';
import { STORY_ACTS } from '../../src/data/story/act1';
import { STORY_OPPONENTS, isStoryOpponentId, storyAvatarById } from '../../src/data/story/opponents';
import { STORY_SCENES } from '../../src/data/story/script';
import { validateDarlingsDeck } from '../../src/meta/darlings';
import { eliteIntroSceneFor } from '../../src/meta/story/storyEvents';
import { DARLINGS_DECK_SIZE } from '../../src/meta/warchest';
import { deckTargetSupply, hasNoLegalTargets } from '../../scripts/avatarReserveDecks';
import { buildReserveMatrixFullOwnershipSave } from '../../scripts/reserveMatrixDecks';

/**
 * Story Mode's own opponents (owner ruling W3, 2026-10-13): the Act 1 elites
 * live outside the Tower roster, and every story lookup resolves them through
 * storyAvatarById, which falls back to the Tower avatars.
 */
describe('story opponents', () => {
  it('resolves a Story-only opponent and still resolves every Tower avatar, and throws on an unknown id', () => {
    for (const opponent of STORY_OPPONENTS) expect(storyAvatarById(opponent.id)).toBe(opponent);
    for (const avatar of AVATARS) expect(storyAvatarById(avatar.id)).toBe(avatar);
    expect(() => storyAvatarById('no-such-opponent')).toThrow();
  });

  it('never joins the Tower: no Story-only id is a Tower avatar or a Tower lookup', () => {
    const towerIds = new Set(AVATARS.map((avatar) => avatar.id));
    for (const opponent of STORY_OPPONENTS) {
      expect(towerIds.has(opponent.id), opponent.id).toBe(false);
      expect(() => avatarById(opponent.id)).toThrow();
      expect(isStoryOpponentId(opponent.id)).toBe(true);
    }
    for (const avatar of AVATARS) expect(isStoryOpponentId(avatar.id), avatar.id).toBe(false);
  });

  it('resolves every opponent an act names, and every elite has the intro the script wrote for it', () => {
    for (const act of STORY_ACTS) {
      for (const id of [...act.fightAvatarIds, ...act.eliteAvatarIds, act.bossAvatarId]) {
        expect(() => storyAvatarById(id), `${act.id} ${id}`).not.toThrow();
      }
      for (const id of act.eliteAvatarIds) expect(eliteIntroSceneFor(id)?.kind, id).toBe('elite-intro');
    }
    // And the other way: every elite intro the script carries belongs to an elite that can be met.
    const elites = new Set(STORY_ACTS.flatMap((act) => act.eliteAvatarIds));
    for (const scene of STORY_SCENES.filter((s) => s.kind === 'elite-intro')) {
      expect(elites.has(scene.avatarId ?? ''), scene.id).toBe(true);
    }
  });

  it("plays Act 1's boss as a Story-only Sima Yi, leaving the Tower's Sima Yi as it is (owner ruling D2)", () => {
    const tower = avatarById('simayi');
    for (const act of STORY_ACTS) {
      const boss = storyAvatarById(act.bossAvatarId);
      expect(isStoryOpponentId(boss.id), boss.id).toBe(true);
      expect(boss).not.toBe(tower);
      // The same Sima Yi on the duel screen and in her scenes: name, portrait and Darling.
      expect([boss.name, boss.portraitCardId, boss.darlingId]).toEqual([tower.name, tower.portraitCardId, tower.darlingId]);
      expect(boss.difficulty).toBe('hard');
    }
    // The Tower rung still fields its own Medium list.
    expect(tower).toMatchObject({ tier: 6, difficulty: 'medium' });
  });

  it('fields Darlings decks that pass the validator the Tower avatars pass, with no dead-target cards', () => {
    const save = buildReserveMatrixFullOwnershipSave(CARD_DB);
    for (const opponent of STORY_OPPONENTS) {
      expect(opponent.darlingsDeck).toHaveLength(DARLINGS_DECK_SIZE);
      expect(validateDarlingsDeck(CARD_DB, save, opponent.darlingsDeck, opponent.darlingId, opponent.landReserve), opponent.id)
        .toEqual([]);
      const list = [...opponent.darlingsDeck, opponent.darlingId];
      const supply = deckTargetSupply(list);
      expect(list.filter((id) => hasNoLegalTargets(CARD_DB[id], supply)), opponent.id).toEqual([]);
    }
  });
});
