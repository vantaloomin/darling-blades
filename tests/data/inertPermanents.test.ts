import { describe, expect, it } from 'vitest';
import { FEATURES } from '../../src/config/features';
import { SANDS_OF_THE_DUAT } from '../../src/data/cards/sands-of-the-duat';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { classifyPermanent } from '../../src/data/permanentClass';
import { collectiblePool } from '../../src/meta/collectionFilter';

const isPermanent = (card: (typeof ALL_CARDS)[number]): boolean =>
  (card.types.includes('artifact') || card.types.includes('enchantment')) &&
  !card.types.includes('creature') &&
  !card.types.includes('land') &&
  !card.subtypes.includes('Aura');

const isEtbOnly = (card: (typeof ALL_CARDS)[number]): boolean => {
  const klass = classifyPermanent(card).klass;
  return klass === 'ONE-SHOT' || klass === 'BLANK';
};

describe('ETB-only non-creature permanent health', () => {
  it("Sands of the Duat keeps ETB-only non-creature permanents under the 15% ceiling (ruling 2026-08-19 §2.10)", () => {
    const permanents = SANDS_OF_THE_DUAT.filter(isPermanent);
    const etbOnly = permanents.filter(isEtbOnly);
    expect(permanents.length).toBeGreaterThanOrEqual(1);
    expect(etbOnly.length / permanents.length).toBeLessThanOrEqual(0.15);
    expect(etbOnly.length).toBe(0);
  });

  it("the collectible pool's ETB-only share only ratchets down", () => {
    const previous = FEATURES.duatLive;
    try {
      FEATURES.duatLive = true;
      const pool = collectiblePool(ALL_CARDS);
      const permanents = pool.filter(isPermanent);
      const etbOnly = permanents.filter(isEtbOnly);
      // This sweep removes all 17 legacy one-shot ETB non-creature permanents.
      expect(etbOnly.length / permanents.length).toBeLessThanOrEqual(0.18);
      expect(pool.filter(isPermanent).filter((card) => classifyPermanent(card).klass === 'BLANK')).toHaveLength(0);
    } finally {
      FEATURES.duatLive = previous;
    }
  });

  it('classifies the known Hauntlink and graveyard-trigger regressions', () => {
    const yokai = Object.values(CARD_DB).filter((card) => card.id.startsWith('yn-') && card.hauntlink);
    expect(yokai).toHaveLength(13);
    for (const card of yokai) expect(['LINK', 'MIXED']).toContain(classifyPermanent(card).klass);
    expect(classifyPermanent(CARD_DB['sd-reed-bound-canopic']).klass).toBe('DEATH');
    expect(classifyPermanent(CARD_DB['sd-tomb-seal']).klass).toBe('DEATH');
  });
});
