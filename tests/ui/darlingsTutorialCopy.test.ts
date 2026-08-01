import { describe, expect, it } from 'vitest';
import {
  DARLINGS_TUTORIAL_BUTTONS,
  DARLINGS_TUTORIAL_LINES,
  DARLINGS_TUTORIAL_TITLE,
} from '../../src/ui/darlingsTutorialCopy';

describe('Darlings tutorial copy', () => {
  it('keeps the owner-approved explainer verbatim and punctuation-safe', () => {
    expect(DARLINGS_TUTORIAL_TITLE).toBe('Darlings');
    expect(DARLINGS_TUTORIAL_LINES).toEqual([
      'Pick one legendary creature as your Darling. She waits in her own zone, ready when you call.',
      'Build a 79-card deck in her colors, one copy of each card, and a Warchest of 10 lands.',
      'Cast her from her zone any time you could cast a creature. Each time she falls she returns there, and her next call costs 2 more.',
      'Pay 4 during your main phase to ease her cost by 2.',
    ]);
    expect(DARLINGS_TUTORIAL_BUTTONS).toEqual(['Got it', 'Read more']);
    expect([...DARLINGS_TUTORIAL_LINES, ...DARLINGS_TUTORIAL_BUTTONS].every((line) => !line.includes('\u2014'))).toBe(true);
  });
});
