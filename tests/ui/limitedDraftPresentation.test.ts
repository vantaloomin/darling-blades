import { describe, expect, it } from 'vitest';
import { freshSave } from '../../src/meta/SaveManager';
import { PLAIN_VARIANT, variantKey, type CardVariant } from '../../src/meta/variants';
import { CARD_FACE_H, CARD_FACE_W } from '../../src/config/cardFaceGeometry';
import { setAccessibility } from '../../src/ui/accessibility';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';
import {
  LIMITED_PICKS_PANEL,
  limitedPicksLayout,
  PICK_THUMB_SCALE,
  plainCopiesDrafted,
  premiumGrantNote,
  premiumGrantSummary,
  premiumOwnershipLine,
} from '../../src/ui/limitedDraftPresentation';

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

/**
 * The deck builder's note after a Premium draft says what the grant did, in
 * the owner's words: how many picks joined the collection, and how many plain
 * copies past the playset were converted to gold, for how much.
 */
describe('premium grant note', () => {
  /** A grant of `kept` copies and melted copies paying `melts` gold each. */
  const grant = (kept: number, melts: number[] = []) => [
    ...Array.from({ length: kept }, () => ({ dupeGold: 0 })),
    ...melts.map((dupeGold) => ({ dupeGold })),
  ];

  it('reads what the add results did: kept copies, melted copies, and their gold', () => {
    expect(premiumGrantSummary(grant(42, [5, 10, 50]))).toEqual({ drafted: 45, added: 42, converted: 3, gold: 65 });
    expect(premiumGrantSummary([])).toEqual({ drafted: 0, added: 0, converted: 0, gold: 0 });
  });

  it('drops the conversion clause when nothing melted', () => {
    expect(premiumGrantNote(premiumGrantSummary(grant(45)))).toBe(
      'You drafted 45 cards. All 45 have been added to your collection.',
    );
  });

  it('names a single duplicate in the singular', () => {
    expect(premiumGrantNote(premiumGrantSummary(grant(44, [5])))).toBe(
      'You drafted 45 cards. 44 have been added to your collection, and 1 was a duplicate that was converted to 5 gold.',
    );
  });

  it('counts many duplicates and totals their gold, with a thousands separator', () => {
    const melts = [500, 500, 50, 10, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    expect(premiumGrantNote(premiumGrantSummary(grant(30, melts)))).toBe(
      'You drafted 45 cards. 30 have been added to your collection, and 15 were duplicates that were converted to 1,115 gold.',
    );
  });

  it('keeps singular counts singular', () => {
    expect(premiumGrantNote(premiumGrantSummary(grant(1)))).toBe(
      'You drafted 1 card. 1 has been added to your collection.',
    );
    expect(premiumGrantNote(premiumGrantSummary(grant(1, [10])))).toBe(
      'You drafted 2 cards. 1 has been added to your collection, and 1 was a duplicate that was converted to 10 gold.',
    );
  });

  it('says None when every drafted card melted', () => {
    expect(premiumGrantNote(premiumGrantSummary(grant(0, Array(45).fill(500))))).toBe(
      'You drafted 45 cards. None have been added to your collection, and 45 were duplicates that were converted to 22,500 gold.',
    );
  });

  it('keeps the note free of em-dashes', () => {
    for (const results of [grant(45), grant(44, [5]), grant(30, Array(15).fill(50))]) {
      expect(premiumGrantNote(premiumGrantSummary(results))).not.toContain('—');
    }
  });
});

/**
 * The draft screen's Your Picks panel (1.9 accessibility): its labels moved
 * onto the text-size resolver, and the pick thumbs (card faces, never
 * scaled) reflow into more columns when the labels above them grow. Rules,
 * in every cell: each label keeps at least its release distance to the next
 * plus its own role's growth, every pick fits inside the panel, and no two
 * thumbs touch.
 */
describe('Your Picks panel at every text size', () => {
  const P = LIMITED_PICKS_PANEL;
  const thumbW = CARD_FACE_W * PICK_THUMB_SCALE;
  const thumbH = CARD_FACE_H * PICK_THUMB_SCALE;
  const grew = (role: 'h2' | 'caption' | 'micro'): number => theme.type[role] - theme.typeBase[role];
  const order = (l: ReturnType<typeof limitedPicksLayout>): number[] => [l.colorsTop, l.pipY, l.curveTop, l.axisY, l.countY, l.ruleY, l.gridTop];
  const release = (() => {
    setAccessibility({ textScale: 1, highContrast: false });
    return order(limitedPicksLayout());
  })();

  it('keeps each label clear of the row under it in every accessibility cell', () => {
    // The line each gap sits under: COLORS, the pip counts, MANA CURVE, the axis, the counts, the rule band (list label).
    const above = ['micro', 'caption', 'micro', 'micro', 'caption', 'micro'] as const;
    forEachA11yCell((cell) => {
      const now = order(limitedPicksLayout());
      expect(now[0] - release[0], cell.name).toBeGreaterThanOrEqual(grew('h2'));
      for (let i = 0; i < above.length; i++) {
        expect(now[i + 1] - now[i] - (release[i + 1] - release[i]), `${cell.name} gap ${i}`).toBeGreaterThanOrEqual(grew(above[i]) / 2);
      }
    });
  });

  it('fits every pick inside the panel without thumbs touching in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      const l = limitedPicksLayout();
      expect(l.columns * l.rows, cell.name).toBeGreaterThanOrEqual(P.maxPicks);
      expect(l.rowPitch - thumbH, cell.name).toBeGreaterThanOrEqual(P.minRowGap);
      expect(l.columnPitch - thumbW, cell.name).toBeGreaterThanOrEqual(P.minRowGap);
      const firstTop = l.gridTop - thumbH / 2;
      const lastBottom = l.gridTop + (l.rows - 1) * l.rowPitch + thumbH / 2;
      const lastRight = P.thumbInset + (l.columns - 1) * l.columnPitch + thumbW / 2;
      // Below the list label's line, and above the panel's 8px bottom inset.
      expect(firstTop - l.listTop, cell.name).toBeGreaterThanOrEqual(theme.type.micro);
      expect(lastBottom, cell.name).toBeLessThanOrEqual(P.height - theme.space(2));
      expect(lastRight, cell.name).toBeLessThanOrEqual(P.width - theme.space(2));
    });
  });

  it('keeps the release grid at the standard size: nine columns, five rows, 43px apart', () => {
    setAccessibility({ textScale: 1, highContrast: false });
    const l = limitedPicksLayout();
    expect({ columns: l.columns, rows: l.rows, rowPitch: l.rowPitch, columnPitch: l.columnPitch, gridTop: l.gridTop })
      .toEqual({ columns: 9, rows: 5, rowPitch: 43, columnPitch: 37, gridTop: 204 });
  });
});
