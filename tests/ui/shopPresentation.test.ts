import { afterEach, describe, expect, it } from 'vitest';
import { setAccessibility } from '../../src/ui/accessibility';
import { isRectContained } from '../../src/ui/layout';
import { deckShopCardLayout } from '../../src/ui/deckShopLayout';
import { menuDensityFindings, menuTextFindings } from '../../src/ui/menuText';
import { profileMeasuredReplays, PROFILE_PANELS, PROFILE_REPLAYS } from '../../src/ui/profilePresentation';
import { shopModalLayout, shopPackLayout, shopPreviewListLayout, shopPreviewModalLayout } from '../../src/ui/shopPresentation';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';

afterEach(() => setAccessibility({ textScale: 1, highContrast: false }));

describe('Shop and Profile measured reading tracks', () => {
  it('keeps wrapped pack identities above the art and the purchase action outside the reading band', () => {
    forEachA11yCell(() => {
      for (const title of [24, 48, 60]) for (const blurb of [14, 28, 42]) {
        const l = shopPackLayout(title, blurb, 20);
        expect(l.blurbY - blurb / 2).toBeGreaterThanOrEqual(l.titleY + title / 2 + 4);
        expect(l.poolY - 10).toBeGreaterThanOrEqual(l.blurbY + blurb / 2 + 4);
        expect(l.artTop).toBeGreaterThanOrEqual(l.poolY + 10 + 12);
        expect(l.artTop + l.artHeight).toBeLessThan(l.buyY - theme.control.minHitHeight / 2);
        expect(l.artHeight).toBeGreaterThan(0);
      }
    });
  });

  it('preserves the release list capacities, pitches and anchors for standard measured text', () => {
    setAccessibility({ textScale: 1, highContrast: false });
    const card = deckShopCardLayout(18);
    expect({ rows: card.rows, columns: card.columns, pitch: card.pitch, cta: card.ctaY, name: card.nameY })
      .toEqual({ rows: 2, columns: 4, pitch: 256, cta: 210, name: 152 });
    expect(shopPreviewListLayout(15, 248, 552)).toEqual({ pitch: 24, rows: 9, pageSize: 18 });
    const replay = profileMeasuredReplays(15, 14);
    expect({ rows: replay.rows, capacity: replay.capacity, pitch: replay.height + 8, top: replay.cell(0).y })
      .toEqual({ rows: 5, capacity: 10, pitch: 85, top: 243 });
  });

  it('keeps every measured replay cell inside the panel while larger lines reduce capacity', () => {
    forEachA11yCell(() => {
      const frame = { x: PROFILE_REPLAYS.left, y: PROFILE_REPLAYS.top, width: PROFILE_REPLAYS.width,
        height: PROFILE_PANELS.bottom - 16 - PROFILE_REPLAYS.top };
      for (const [meta, note] of [[15, 14], [36, 32], [40, 36], [60, 54]]) {
        const layout = profileMeasuredReplays(meta, note);
        expect(layout.capacity).toBeGreaterThan(0);
        for (let i = 0; i < layout.capacity; i++) expect(isRectContained(layout.cell(i), frame)).toBe(true);
        if (meta > 15) {
          expect(layout.metaY - meta / 2).toBeGreaterThanOrEqual(42);
          expect(layout.noteY - note / 2).toBeGreaterThanOrEqual(layout.metaY + meta / 2 + 4);
        }
      }
    });
  });

  it('sizes dialogs from measured content and keeps the footer separate', () => {
    forEachA11yCell(() => {
      for (const contentHeight of [260, 330, 410]) {
        const l = shopModalLayout(860, 520, contentHeight, 40);
        expect(l.tracks.contentBounds.height).toBeGreaterThanOrEqual(contentHeight);
        expect(l.tracks.footerTrack.y).toBeGreaterThanOrEqual(l.tracks.contentBounds.y + contentHeight + 16);
        expect(l.tracks.panel.y).toBeGreaterThanOrEqual(theme.design.safeTop);
        expect(l.tracks.panel.y + l.height).toBeLessThanOrEqual(theme.design.safeBottom);
      }
      const short = shopPreviewModalLayout(40, 30), long = shopPreviewModalLayout(60, 64);
      expect(long.height).toBeGreaterThan(short.height);
      expect(long.headerGrowth).toBe(24);
    });
  });
});

describe('menu visibility and release-density findings', () => {
  it('reports a reduced page, changed pitch or moved anchor even when all visible text fits', () => {
    const release = [{ id: 'list', rows: 9, columns: 2, pitch: 24, top: 248 }];
    expect(menuDensityFindings([{ ...release[0] }], release, 1)).toEqual([]);
    for (const changed of [{ rows: 8 }, { columns: 1 }, { pitch: 28 }, { top: 252 }]) {
      expect(menuDensityFindings([{ ...release[0], ...changed }], release, 1)).toEqual(['list']);
    }
    expect(menuDensityFindings([], release, 1)).toEqual(['list']);
    expect(menuDensityFindings([{ ...release[0], rows: 7 }], release, 1.3)).toEqual([]);
  });

  it('reports key information entirely outside a mask as well as partly clipped information', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 20 };
    const check = { expected: '525', actual: '525', lines: ['525'], bounds, keepVisible: true };
    expect(menuTextFindings({ ...check, clip: bounds })).toEqual([]);
    for (const clip of [{ ...bounds, height: 10 }, { ...bounds, y: 30 }]) {
      expect(menuTextFindings({ ...check, clip })).toContain('clippedText');
    }
  });
});
