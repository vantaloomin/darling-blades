import { describe, expect, it } from 'vitest';
import {
  PACK_COMPACT,
  packColumnWidth,
  packCompactFrame,
  packSpecialSlots,
  packTileRows,
  specialArea,
} from '../../src/ui/packCompact';
import { desktopCompactMetrics } from '../../src/platform/compactScenes';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = [
  ...SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, content: resolveScreenMetrics(f).content })),
  { name: 'desktop', content: desktopCompactMetrics().content },
];

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width - 1e-6 && b.x < a.x + a.width - 1e-6 && a.y < b.y + b.height - 1e-6 && b.y < a.y + a.height - 1e-6;
const inside = (r: Rect, box: Rect): boolean =>
  r.x >= box.x - 1e-6 && r.y >= box.y - 1e-6 && r.x + r.width <= box.x + box.width + 1e-6 && r.y + r.height <= box.y + box.height + 1e-6;

describe('the compact Pack Opening (mocks S-Pack-Reveal, S-Pack-Results)', () => {
  it('fits every split of a nine-card pack, with each tile’s badge band and each special’s tab and caption, on every landscape screen', () => {
    for (const { name, content } of landscape) {
      for (let specials = 0; specials <= 9; specials++) {
        const grid = 9 - specials;
        const footH = 44;
        const frame = packCompactFrame(content, footH, packColumnWidth(content, grid, specials, footH));
        const tiles = packTileRows(frame.main, grid, frame.k);
        const slots = packSpecialSlots(specialArea(frame), specials, frame.k);
        const label = `${name} ${grid}+${specials}`;
        expect(frame.column.width, label).toBeGreaterThanOrEqual(Math.round(PACK_COMPACT.columnW * frame.k));
        const tileBoxes = tiles.cells.map((c) => ({ ...c, y: c.y - tiles.badgeH, height: c.height + tiles.badgeH }));
        const specialBoxes = slots.cells.map((c) => ({ ...c, y: c.y - slots.tabH, height: c.height + slots.tabH + slots.captionH }));
        for (const box of tileBoxes) {
          expect(inside(box, frame.main), label).toBe(true);
          expect(overlap(box, frame.back), label).toBe(false);
        }
        for (const box of specialBoxes) {
          expect(inside(box, frame.column), label).toBe(true);
          expect(overlap(box, frame.foot), label).toBe(false);
        }
        const all = [...tileBoxes, ...specialBoxes];
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlap(all[i], all[j]), label).toBe(false);
        // A tile never grows past the mock's size, and stays big enough to read on a phone.
        for (const c of tiles.cells) {
          expect(c.width, label).toBeLessThanOrEqual(PACK_COMPACT.tileW * frame.k + 1e-6);
          expect(c.width, label).toBeGreaterThanOrEqual(56);
        }
        // Five or more specials in one pack is rare; they may run smaller.
        for (const c of slots.cells) expect(c.width, label).toBeGreaterThanOrEqual(specials <= 4 ? 56 : 40);
      }
    }
  });

  it('keeps the mock’s sizes for its own pack on the reference phone, and widens the column for three specials instead of shrinking them', () => {
    const phone = landscape.find((l) => l.name === 'phone-island')!.content;
    const mock = packCompactFrame(phone, 44, packColumnWidth(phone, 7, 2, 44));
    expect(mock.column.width).toBe(PACK_COMPACT.columnW);
    expect(packTileRows(mock.main, 7, mock.k).cells[0].width).toBe(PACK_COMPACT.tileW);
    expect(packSpecialSlots(specialArea(mock), 2, mock.k).cells[0].width).toBe(PACK_COMPACT.specialW);
    const three = packCompactFrame(phone, 44, packColumnWidth(phone, 6, 3, 44));
    expect(three.column.width).toBeGreaterThan(PACK_COMPACT.columnW);
    expect(packSpecialSlots(specialArea(three), 3, three.k).cells[0].width).toBeGreaterThanOrEqual(100);
  });
});
