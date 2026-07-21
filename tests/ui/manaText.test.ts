import { describe, expect, it } from 'vitest';
import {
  manaPipPadding,
  padManaTextSegments,
  segmentManaText,
} from '../../src/ui/ManaText';

describe('segmentManaText', () => {
  it('passes plain text through as one segment', () => {
    expect(segmentManaText('Create two Bat tokens.')).toEqual([
      { kind: 'text', value: 'Create two Bat tokens.' },
    ]);
  });

  it('segments a single generic group', () => {
    expect(segmentManaText('Pay {2}.')).toEqual([
      { kind: 'text', value: 'Pay ' },
      { kind: 'pipRun', value: '{2}', pips: [{ texture: 'pip-C', number: 2 }] },
      { kind: 'text', value: '.' },
    ]);
  });

  it('keeps adjacent mana tokens in one unbreakable pip run', () => {
    expect(segmentManaText('Empower {2}{B}: x')).toEqual([
      { kind: 'text', value: 'Empower ' },
      {
        kind: 'pipRun',
        value: '{2}{B}',
        pips: [{ texture: 'pip-C', number: 2 }, { texture: 'pip-B' }],
      },
      { kind: 'text', value: ': x' },
    ]);
  });

  it('segments multiple groups without merging intervening text', () => {
    expect(segmentManaText('{W} now, then {3}{U}.')).toEqual([
      { kind: 'pipRun', value: '{W}', pips: [{ texture: 'pip-W' }] },
      { kind: 'text', value: ' now, then ' },
      {
        kind: 'pipRun',
        value: '{3}{U}',
        pips: [{ texture: 'pip-C', number: 3 }, { texture: 'pip-U' }],
      },
      { kind: 'text', value: '.' },
    ]);
  });

  it('supports adjacent colored and colorless symbols', () => {
    expect(segmentManaText('{R}{G}{C}')).toEqual([
      {
        kind: 'pipRun',
        value: '{R}{G}{C}',
        pips: [{ texture: 'pip-R' }, { texture: 'pip-G' }, { texture: 'pip-C' }],
      },
    ]);
  });
});

describe('ManaText padding', () => {
  const measure = (value: string): number => value.length * 4;

  it('uses enough measured NBSP glyphs to cover the pip run', () => {
    expect(manaPipPadding(2, 10, 2, measure)).toEqual({
      padding: '\u00a0'.repeat(6),
      paddingWidth: 24,
      pipWidth: 22,
    });
  });

  it('pads every pip segment while preserving ordinary text', () => {
    const padded = padManaTextSegments(segmentManaText('A {2}{B}, then {G}.'), 10, 2, measure);
    expect(padded.text).toBe(`A ${'\u00a0'.repeat(6)}, then ${'\u00a0'.repeat(3)}.`);
    expect(padded.runs.map(({ paddingWidth, pipWidth }) => ({ paddingWidth, pipWidth }))).toEqual([
      { paddingWidth: 24, pipWidth: 22 },
      { paddingWidth: 12, pipWidth: 10 },
    ]);
  });
});
