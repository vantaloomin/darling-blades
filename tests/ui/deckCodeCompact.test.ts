import { describe, expect, it } from 'vitest';
import { deckCodeLayout } from '../../src/ui/deckCodeCompact';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { desktopCompactMetrics } from '../../src/platform/compactScenes';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const screens = [
  ...SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) })),
  { name: 'desktop', m: desktopCompactMetrics() },
];

const inside = (r: Rect, box: Rect): boolean =>
  r.x >= box.x && r.y >= box.y && r.x + r.width <= box.x + box.width + 0.001 && r.y + r.height <= box.y + box.height + 0.001;
const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the Deck Code screen', () => {
  it('keeps every control inside the content box and apart, on every landscape screen and the desktop', () => {
    for (const { name, m } of screens) {
      // Labels and the two-line status at the 130% text size.
      const l = deckCodeLayout(m.content, 23, 46);
      const controls = [l.field, l.paste, l.myDecks, l.deckPlate, l.changeDeck, l.level, l.duel];
      for (const r of controls) expect(inside(r, m.content), `${name} ${JSON.stringify(r)}`).toBe(true);
      for (let i = 0; i < controls.length; i++) {
        for (let j = i + 1; j < controls.length; j++) expect(overlap(controls[i], controls[j]), `${name} ${i}/${j}`).toBe(false);
      }
      expect(l.status.y + 46, name).toBeLessThanOrEqual(l.preview.y);
    }
  });
});
