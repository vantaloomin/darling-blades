import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENTS } from '../../scripts/gen-legal-pages';
import { modalShellLayout } from '../../src/ui/layout';
import {
  LEGAL_ENTRIES,
  LEGAL_PANEL_LAYOUT,
  LEGAL_PANEL_TITLE,
  LEGAL_PLAYER_COPY,
  legalReadCenterX,
  legalRowStack,
  legalTextWrapWidth,
  type LegalRowMeasured,
} from '../../src/ui/legalPresentation';
import { STATS_PRIVACY_LINK_HREF } from '../../src/ui/statsPrivacyPresentation';
import { theme } from '../../src/ui/theme';

/**
 * The Legal panel's two contracts. First, the in-game link set and the built
 * page set are the SAME set: a page the build writes that nothing in the game
 * offers is dead, and a row that points at a page the build does not write is
 * a broken link in a legal surface. Second, the panel obeys the frame and
 * isolation rules every other modal does, measured rather than pinned, because
 * the rendered text height is font-fallback dependent on Windows.
 */

/** A generous stand-in for the rendered rows: two lines of summary, not one. */
const ROOMY: LegalRowMeasured[] = LEGAL_ENTRIES.map(() => ({ label: 20, summary: 2 * 18 }));

describe('the legal link set', () => {
  it('offers exactly the pages the build writes', () => {
    expect(LEGAL_ENTRIES.map((entry) => entry.href).sort()).toEqual(
      LEGAL_DOCUMENTS.map((doc) => `./${doc.output}`).sort(),
    );
  });

  it('reuses the privacy href the "What is sent" panel already links', () => {
    expect(LEGAL_ENTRIES.map((entry) => entry.href)).toContain(STATS_PRIVACY_LINK_HREF);
  });

  it('keeps every href relative, so the desktop bundle resolves it offline', () => {
    for (const entry of LEGAL_ENTRIES) {
      expect(entry.href, entry.label).toMatch(/^\.\//);
      expect(entry.href, entry.label).not.toMatch(/^https?:/);
    }
  });

  it('gives every row its own label and its own line', () => {
    const labels = LEGAL_ENTRIES.map((entry) => entry.label);
    const summaries = LEGAL_ENTRIES.map((entry) => entry.summary);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(summaries).size).toBe(summaries.length);
    for (const entry of LEGAL_ENTRIES) expect(entry.summary.length, entry.label).toBeGreaterThan(0);
  });
});

describe('the legal panel copy', () => {
  it('carries no em-dash and no en-dash, the player-copy rule', () => {
    for (const line of LEGAL_PLAYER_COPY) {
      expect(line, line).not.toMatch(/[–—]/);
    }
  });

  /**
   * The list above can only cover strings someone remembered to add to it, so
   * the rule is also held against the whole module: a new constant with a dash
   * in it fails here even if nothing exports it into the list.
   */
  it('holds the whole module to the rule, not just the strings on the list', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'legalPresentation.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/[–—]/);
    // Every entry's copy really does live in that module, not in the panel.
    for (const entry of LEGAL_ENTRIES) {
      expect(source, entry.label).toContain(entry.summary);
    }
  });

  it('keeps the control label short enough to sit beside the update check', () => {
    expect(LEGAL_PANEL_TITLE.length).toBeLessThanOrEqual(12);
  });
});

describe('the legal panel layout', () => {
  const layout = modalShellLayout({
    width: LEGAL_PANEL_LAYOUT.width,
    height: LEGAL_PANEL_LAYOUT.height,
  });
  const content = layout.contentBounds;

  it('fits the design canvas and its title-safe frame', () => {
    expect(layout.fits).toBe(true);
    expect(layout.tracksInsidePanel).toBe(true);
    expect(layout.tracksInsideTitleSafe).toBe(true);
    expect(LEGAL_PANEL_LAYOUT.width).toBeLessThanOrEqual(theme.design.safeWidth);
    expect(LEGAL_PANEL_LAYOUT.height).toBeLessThanOrEqual(theme.design.safeHeight);
  });

  it('fits a roomy version of every row inside the content rect', () => {
    expect(legalRowStack(ROOMY).height).toBeLessThanOrEqual(content.height);
  });

  it('stacks rows in order, disjoint, with the between-groups space', () => {
    const { rows } = legalRowStack(ROOMY);
    expect(rows).toHaveLength(LEGAL_ENTRIES.length);
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].summaryY).toBeGreaterThan(rows[i].labelY);
      expect(rows[i].bottom).toBeGreaterThanOrEqual(rows[i].summaryY + ROOMY[i].summary);
      if (i > 0) {
        expect(rows[i].labelY - rows[i - 1].bottom).toBe(LEGAL_PANEL_LAYOUT.rowGap);
      }
    }
  });

  it('never gives a row less than the touch-target band, however short its text', () => {
    const tiny = LEGAL_ENTRIES.map(() => ({ label: 1, summary: 1 }));
    for (const row of legalRowStack(tiny).rows) {
      expect(row.bottom - row.labelY).toBeGreaterThanOrEqual(theme.control.minHitHeight);
    }
  });

  it('centres the Read button on its own row band at every text height', () => {
    for (const measured of [ROOMY, LEGAL_ENTRIES.map(() => ({ label: 1, summary: 1 }))]) {
      for (const row of legalRowStack(measured).rows) {
        expect(row.readCenterY).toBeGreaterThanOrEqual(row.labelY + theme.control.minHitHeight / 2 - 0.5);
        expect(row.readCenterY).toBeLessThanOrEqual(row.bottom);
      }
    }
  });

  it('keeps the text column clear of the Read button at every plausible width', () => {
    const right = content.x + content.width;
    for (let hitWidth = theme.control.minHitWidth; hitWidth <= 160; hitWidth += 2) {
      const center = legalReadCenterX(right, hitWidth);
      expect(center + hitWidth / 2, `edge at ${hitWidth}`).toBeLessThanOrEqual(right);
      const wrap = legalTextWrapWidth(content.width, hitWidth);
      expect(content.x + wrap, `gap at ${hitWidth}`).toBeLessThanOrEqual(
        center - hitWidth / 2 - LEGAL_PANEL_LAYOUT.minControlGap,
      );
      expect(wrap, `wrap at ${hitWidth}`).toBeGreaterThan(200);
    }
  });

  it('holds an empty set without producing a stack', () => {
    expect(legalRowStack([])).toEqual({ rows: [], height: 0 });
  });
});
