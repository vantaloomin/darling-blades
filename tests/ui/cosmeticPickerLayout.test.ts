import { describe, expect, it } from 'vitest';
import { COSMETIC_PICKER, cosmeticPlateRows } from '../../src/ui/cosmeticPickerLayout';
import { modalShellLayout } from '../../src/ui/layout';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';

/** A Text's box from its role size (Phaser's default line box); the rendered probe measures real glyphs. */
const box = (size: number, lines = 1, spacing = 0): number => Math.ceil(size * 1.25) * lines + spacing * (lines - 1);

describe('cosmetic picker rhythm', () => {
  it('keeps wrapped names, blurbs, the tag and Equip apart and the shell inside the frame in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      for (const nameLines of [1, 2]) for (const blurbLines of [2, 3, 4]) {
        const m = { subtitle: box(theme.type.caption), name: box(theme.type.label, nameLines),
          blurb: box(theme.type.micro, blurbLines, 2), tag: box(theme.type.micro), buttonHit: theme.control.minHitHeight };
        const rows = cosmeticPlateRows(m);
        const label = `${cell.name}, ${nameLines}/${blurbLines} lines`;
        expect(rows.gridTop - (rows.subtitleTop + m.subtitle), label).toBeGreaterThanOrEqual(COSMETIC_PICKER.rowGap);
        expect(rows.blurbTop - (rows.nameTop + m.name), label).toBeGreaterThanOrEqual(COSMETIC_PICKER.rowGap);
        expect(rows.tagCenter - m.tag / 2 - (rows.blurbTop + m.blurb), label).toBeGreaterThanOrEqual(COSMETIC_PICKER.rowGap);
        const buttonHitTop = rows.gridHeight - COSMETIC_PICKER.buttonFromBottom - m.buttonHit / 2;
        expect(buttonHitTop - (rows.tagCenter + m.tag / 2), label).toBeGreaterThanOrEqual(COSMETIC_PICKER.rowGap);
        const shell = modalShellLayout({ width: COSMETIC_PICKER.width, height: COSMETIC_PICKER.height + rows.extraHeight });
        expect(shell.tracksInsideTitleSafe, label).toBe(true);
        // The grown grid is exactly what the grown content track holds.
        expect(shell.contentBounds.height - rows.gridTop, label).toBe(rows.gridHeight);
      }
    });
  });

  it('keeps the release shell and rows for standard one-line names', () => {
    const rows = cosmeticPlateRows({ subtitle: box(theme.typeBase.caption), name: box(theme.typeBase.label),
      blurb: box(theme.typeBase.micro, 3, 2), tag: box(theme.typeBase.micro), buttonHit: theme.control.minHitHeight });
    expect(rows).toMatchObject({ extraHeight: 0, gridTop: COSMETIC_PICKER.gridTop, blurbTop: COSMETIC_PICKER.blurbTop,
      tagCenter: COSMETIC_PICKER.tagCenter, gridHeight: COSMETIC_PICKER.gridHeight });
    expect(modalShellLayout({ width: COSMETIC_PICKER.width, height: COSMETIC_PICKER.height }).contentBounds.height - rows.gridTop)
      .toBe(COSMETIC_PICKER.gridHeight);
  });
});
