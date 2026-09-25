import { describe, expect, it } from 'vitest';
import { freshSave } from '../../src/meta/SaveManager';
import { PLAIN_VARIANT, variantKey, type CardVariant } from '../../src/meta/variants';
import { plainCopiesDrafted, premiumOwnershipLine } from '../../src/ui/limitedDraftPresentation';

/**
 * The Premium draft inspector says whether the copy on offer melts to gold.
 * The grant at the draft's end follows the collection's add rule: a PLAIN copy
 * past four plain copies melts, a special print is always kept. So the line
 * must count plain copies only, owned plus already drafted.
 */
const CARD = 'test-card';
const PLAIN = variantKey(PLAIN_VARIANT);
const FOIL: CardVariant = { frame: 'gold', holo: 'rainbow', fullArt: false };
const NO_PICKS = { picks: [] as string[], pickVariants: [] as CardVariant[] };

function saveOwning(variants: Record<string, number>) {
  const save = freshSave(0);
  save.collection = { [CARD]: Object.values(variants).reduce((a, b) => a + b, 0) };
  save.collectionVariants = { [CARD]: variants };
  return save;
}

describe('premiumOwnershipLine', () => {
  it('counts plain copies only, so special prints never read as a full plain playset', () => {
    const save = saveOwning({ [variantKey(FOIL)]: 4 });
    const line = premiumOwnershipLine(save, CARD, PLAIN_VARIANT, NO_PICKS);
    expect(line).toContain('0/4 plain');
    expect(line).not.toMatch(/melt/);
  });

  it('says a plain copy melts once four plain copies are owned', () => {
    const save = saveOwning({ [PLAIN]: 4, [variantKey(FOIL)]: 2 });
    expect(premiumOwnershipLine(save, CARD, PLAIN_VARIANT, NO_PICKS)).toMatch(/This plain copy melts to gold/);
    // No variant on offer is a plain print.
    expect(premiumOwnershipLine(save, CARD, undefined, NO_PICKS)).toMatch(/This plain copy melts to gold/);
  });

  it('counts plain copies already drafted this run, which join the collection first', () => {
    const save = saveOwning({ [PLAIN]: 3 });
    const drafted = { picks: ['other', CARD], pickVariants: [PLAIN_VARIANT, PLAIN_VARIANT] };
    const line = premiumOwnershipLine(save, CARD, PLAIN_VARIANT, drafted);
    expect(line).toContain('3/4 plain, 1 more drafted');
    expect(line).toMatch(/This plain copy melts to gold/);
  });

  it('never says a special print melts', () => {
    const save = saveOwning({ [PLAIN]: 4 });
    const line = premiumOwnershipLine(save, CARD, FOIL, NO_PICKS);
    expect(line).not.toMatch(/This plain copy melts/);
    expect(line).toMatch(/Special prints never melt/);
  });

  it('warns one copy ahead and stays quiet before that', () => {
    expect(premiumOwnershipLine(saveOwning({ [PLAIN]: 3 }), CARD, PLAIN_VARIANT, NO_PICKS)).toMatch(
      /past 4 melt to gold/,
    );
    expect(premiumOwnershipLine(saveOwning({ [PLAIN]: 2 }), CARD, PLAIN_VARIANT, NO_PICKS)).not.toMatch(/melt/);
  });

  it('reads copies from before variant tracking as plain', () => {
    const save = freshSave(0);
    save.collection = { [CARD]: 4 };
    expect(premiumOwnershipLine(save, CARD, PLAIN_VARIANT, NO_PICKS)).toMatch(/This plain copy melts to gold/);
  });

  it('keeps the line free of em-dashes', () => {
    const save = saveOwning({ [PLAIN]: 4 });
    for (const offered of [PLAIN_VARIANT, FOIL]) {
      expect(premiumOwnershipLine(save, CARD, offered, NO_PICKS)).not.toContain('—');
    }
  });
});

describe('plainCopiesDrafted', () => {
  it('counts this card\'s plain picks, and treats a pick with no recorded print as plain', () => {
    const drafted = {
      picks: [CARD, 'other', CARD, CARD],
      pickVariants: [PLAIN_VARIANT, PLAIN_VARIANT, FOIL],
    };
    // Index 3 has no recorded variant, and the grant reads it as plain.
    expect(plainCopiesDrafted(drafted, CARD)).toBe(2);
  });
});
