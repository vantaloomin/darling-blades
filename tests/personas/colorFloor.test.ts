import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { createRngState } from '../../src/engine/rng';
import type { Color } from '../../src/engine/types';
import {
  buildGreedyDeck,
  cardsForPool,
  makeArtifact,
  proposeQuotaLegalSwap,
  runHillClimb,
} from '../../scripts/personas/craft';
import { PERSONA_TEMPLATES, personaTemplate, type PersonaTemplate } from '../../scripts/personas/templates';

const pool = cardsForPool('all');
const withColor = (deck: readonly string[], color: Color): number =>
  deck.filter((id) => CARD_DB[id].colors.includes(color)).length;

/**
 * The opt-in colour floor (`minColorShare`): a fixed pair whose one colour
 * out-rates the other must still build and climb as a pair.
 */
describe('persona colour floor', () => {
  const floored = PERSONA_TEMPLATES.filter((template) => template.minColorShare !== undefined);

  // A malformed floor must fail when the build starts, naming the problem, not
  // at the last slots with a misleading "cannot meet".
  it('refuses a malformed floor before building anything', () => {
    const stompy = personaTemplate('stompy');
    const build = (template: PersonaTemplate) => () => buildGreedyDeck(template, pool, 1);
    expect(build({ ...personaTemplate('midrange'), minColorShare: { G: 0.5 } })).toThrow(/fixed colour identity/);
    expect(build({ ...stompy, minColorShare: { W: 0.5 } })).toThrow(/outside its colours/);
    expect(build({ ...stompy, minColorShare: { G: 0 } })).toThrow(/must be in \(0, 1\]/);
    expect(build({ ...stompy, minColorShare: { G: 1.5 } })).toThrow(/must be in \(0, 1\]/);
    for (const template of floored) expect(build(template)).not.toThrow();
  });

  it('says so when the pool cannot supply the floored colour', () => {
    const noGreen = pool.filter((card) => !card.colors.includes('G'));
    expect(() => buildGreedyDeck(personaTemplate('stompy'), noGreen, 1))
      .toThrow(/cannot meet stompy's colour floor \(G\) from here/);
  });

  // Red-green is the case that needs a floor: red's top cards out-rate green's,
  // so a 75% green floor is far above what the rate-led build picks on its own.
  const strict: PersonaTemplate = { ...personaTemplate('stompy'), minColorShare: { G: 0.75 } };

  it.each([...floored, strict])('the greedy build meets the floor ($id, $minColorShare)', (template) => {
    for (const seed of [13_003, 12_345]) {
      const build = buildGreedyDeck(template, pool, seed);
      const floor = Object.entries(template.minColorShare!) as [Color, number][];
      expect(floor.length).toBeGreaterThan(0);
      for (const [color, share] of floor) {
        expect(withColor(build.deck, color) / build.deck.length).toBeGreaterThanOrEqual(share);
      }
      expect(build.quotaShortfalls).toEqual([]);
    }
  });

  it('never proposes a swap that takes the deck below its floor', () => {
    const base = personaTemplate('stompy');
    const build = buildGreedyDeck({ ...base, minColorShare: undefined }, pool, 13_003);
    const green = withColor(build.deck, 'G');
    // A floor the deck meets exactly, so every green card swapped out must
    // be replaced by a green card.
    const atFloor: PersonaTemplate = { ...base, minColorShare: { G: green / build.deck.length } };
    const unfloored: PersonaTemplate = { ...base, minColorShare: undefined };

    let greenOut = 0;
    let brokeWithoutFloor = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const swap = proposeQuotaLegalSwap(build, pool, atFloor, createRngState(seed));
      expect(swap).not.toBeNull();
      expect(withColor(swap!.build.deck, 'G')).toBeGreaterThanOrEqual(green);
      if (CARD_DB[swap!.out].colors.includes('G')) greenOut++;

      const free = proposeQuotaLegalSwap(build, pool, unfloored, createRngState(seed));
      if (withColor(free!.build.deck, 'G') < green) brokeWithoutFloor++;
    }
    // Green cards still leave (replaced by green), and the same proposals
    // without the floor do break it, so the check above is not vacuous.
    expect(greenOut).toBeGreaterThan(0);
    expect(brokeWithoutFloor).toBeGreaterThan(0);
  });

  // A floor changes what a persona builds, so the artifact must say it had one;
  // a floorless persona's artifact keeps its old shape byte for byte.
  it('records the floor in the artifact persona block, and only when set', () => {
    const artifactFor = (template: PersonaTemplate) => {
      const initial = buildGreedyDeck(template, pool, 7);
      const result = runHillClimb({
        initial, pool, template, iterations: 0, seed: 7,
        measure: () => ({ field: 'starters', seeds: 1, matchups: [], rowWins: 1, losses: 1, draws: 0, games: 2, score: 0.5 }),
      });
      return makeArtifact(template, 'all', { field: 'starters', seeds: 1, seed: 7, personaId: template.id, iterations: 0 }, result);
    };
    expect(artifactFor(strict).persona).toEqual({ id: 'stompy', name: strict.name, minColorShare: { G: 0.75 } });
    expect(Object.keys(artifactFor(personaTemplate('burn')).persona)).toEqual(['id', 'name']);
  });
});
