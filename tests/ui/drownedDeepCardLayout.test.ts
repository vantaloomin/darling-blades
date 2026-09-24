import { describe, expect, it } from 'vitest';
import { activatedAbilitiesOf, validateActivatedDef } from '../../src/engine/types';
import { manaPipPadding, padManaTextSegments, segmentManaText } from '../../src/ui/ManaText';
import { activatedText, rulesText } from '../../src/ui/rulesText';
import {
  DROWNED_DEEP_CARD_LAYOUT_FIXTURES,
  DROWNED_DEEP_CARD_LAYOUT_SCALES,
} from './drownedDeepCardLayoutFixtures';

// These tests protect the actual inputs to CardView's existing wrap/reflow
// pipeline. They do not import Phaser or substitute estimated font metrics
// for a rendered-card check; browser probes consume the same fixture module.
describe('Drowned Deep card layout inputs', () => {
  it.each(DROWNED_DEEP_CARD_LAYOUT_FIXTURES)('keeps $name a valid activated-card fixture', (card) => {
    expect(validateActivatedDef(card)).toEqual([]);
    expect(activatedAbilitiesOf(card).every((ability) => ability.targets?.[0].maxCost !== undefined)).toBe(true);
  });

  it('retains the capped Duty, keyword, arrival and flavor budgets on the approved Tidewife face', () => {
    const card = DROWNED_DEEP_CARD_LAYOUT_FIXTURES[0];
    expect(rulesText(card)).toBe(
      "{T}: Return target creature with cost 3 or less to its owner's hand.\n" +
      'Skyborne\n' +
      'When this arrives, put the top 3 cards of your deck into your graveyard.',
    );
    expect(card.flavor).toBe('She married the tide. The tide has been very attentive.');
  });

  it('retains both long Duty lines with independent costs and complete target qualifiers', () => {
    const card = DROWNED_DEEP_CARD_LAYOUT_FIXTURES[1];
    const lines = activatedText(card)!.split('\n');
    expect(lines).toEqual([
      '{2}{B}, {T}: Return target creature card with cost 2 or less from your graveyard to your hand.',
      '{1}{B}, {T}: Deal 2 damage to target creature an opponent controls with cost 3 or less and attack 4 or more.',
    ]);
    expect(rulesText(card)).toBe(lines.join('\n'));
    const tidewifeDuty = activatedText(DROWNED_DEEP_CARD_LAYOUT_FIXTURES[0])!;
    expect(lines.every((line) => line.length > tidewifeDuty.length)).toBe(true);
  });

  it('preserves the line break and qualifier copy when mana runs become unbreakable padding', () => {
    const raw = activatedText(DROWNED_DEEP_CARD_LAYOUT_FIXTURES[1])!;
    // CardView handles the tap image separately; this exercises the shared
    // compositor's colored/generic runs without treating a literal T as mana.
    const segments = segmentManaText(raw);
    const measure = (value: string): number => value.length * 4;
    const padded = padManaTextSegments(segments, 16, 1.92, measure);
    expect(padded.runs.map((run) => run.pips)).toEqual([
      [{ texture: 'pip-C', number: 2 }, { texture: 'pip-B' }],
      [{ texture: 'pip-C', number: 1 }, { texture: 'pip-B' }],
    ]);
    expect(padded.text.replaceAll('\u00a0', '')).toBe(raw.replace(/\{[12]\}\{B\}/g, ''));
    expect(padded.text.split('\n')).toHaveLength(2);
    for (const run of padded.runs) {
      expect(run.padding).toMatch(/^\u00a0+$/);
      expect(run.paddingWidth).toBeGreaterThanOrEqual(run.pipWidth);
    }
  });

  it.each([3.25, 4, 5.5])('reserves the tap and mana widths at every sampled scale with a %s px injected space', (spaceWidth) => {
    const measure = (value: string): number => value.length * spaceWidth;
    for (const [count, size, gap] of [[1, 17.22, 0], [2, 16, 1.92]]) {
      const run = manaPipPadding(count, size, gap, measure);
      expect(measure(run.padding.slice(1))).toBeLessThan(run.pipWidth);
      for (const scale of DROWNED_DEEP_CARD_LAYOUT_SCALES) {
        expect(run.paddingWidth * scale).toBeGreaterThanOrEqual(run.pipWidth * scale);
      }
    }
  });
});
