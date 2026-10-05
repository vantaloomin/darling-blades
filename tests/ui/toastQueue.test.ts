import { describe, expect, it } from 'vitest';
import { collapseToastBatch, TOAST_CARD, toastCardLayout, toastStackCenters, type ToastNotice } from '../../src/ui/toastQueue';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';

const notice = (title: string): ToastNotice => ({ title, body: `${title} body` });

describe('toast queue policy', () => {
  it('keeps up to three notices as a staggered stack', () => {
    const notices = ['One', 'Two', 'Three'].map(notice);

    expect(collapseToastBatch(notices)).toEqual({ kind: 'stack', notices });
  });

  it('collapses four or more notices into one supplied summary plaque', () => {
    const summary = { title: 'Four updates', body: 'Ready to review.' };
    const notices = ['One', 'Two', 'Three', 'Four'].map((title) => ({
      ...notice(title),
      collapseSummary: summary,
    }));

    expect(collapseToastBatch(notices)).toEqual({ kind: 'summary', notice: summary });
  });
});

describe('a notice that must not be collapsed', () => {
  const summary = { title: 'Four updates', body: 'Ready to review.' };
  const collapsible = (title: string): ToastNotice => ({ ...notice(title), collapseSummary: summary });
  const consent: ToastNotice = { ...notice('Anonymous play stats'), neverCollapse: true };

  it('survives a burst whole, while the rest still collapse behind it', () => {
    const batch = collapseToastBatch([
      consent,
      ...['One', 'Two', 'Three', 'Four'].map(collapsible),
    ]);
    expect(batch).toEqual({ kind: 'stack', notices: [consent, summary] });
  });

  it('does not turn a small burst into a summary', () => {
    const notices = [consent, collapsible('One'), collapsible('Two')];
    expect(collapseToastBatch(notices)).toEqual({ kind: 'stack', notices });
  });

  it('is presented on its own when it is the whole batch', () => {
    expect(collapseToastBatch([consent])).toEqual({ kind: 'stack', notices: [consent] });
  });

  it('leaves a burst that contains no protected notice byte for byte as it was', () => {
    // The pre-existing paths, restated so the opt-in flag cannot quietly
    // change what every other caller already gets.
    const three = ['One', 'Two', 'Three'].map(notice);
    expect(collapseToastBatch(three)).toEqual({ kind: 'stack', notices: three });
    const four = ['One', 'Two', 'Three', 'Four'].map(notice);
    expect(collapseToastBatch(four)).toEqual({
      kind: 'summary',
      notice: { title: '4 updates ready', body: 'Several updates arrived together.', detail: 'Tap to review.' },
    });
  });
});


/** A Text's box: the role size plus Phaser's default line box (no font metrics here). */
const lines = (size: number, count = 1): number => Math.ceil(size * 1.25) * count;

describe('toast card layout', () => {
  const linesOf = (layout: ReturnType<typeof toastCardLayout>, m: { title: number; body: number; detail: number | null }) => [
    { top: layout.titleTop, bottom: layout.titleTop + m.title },
    { top: layout.bodyTop, bottom: layout.bodyTop + m.body },
    ...(layout.detailTop !== null && m.detail !== null ? [{ top: layout.detailTop, bottom: layout.detailTop + m.detail }] : []),
  ];

  it('keeps every line apart and inside the plaque in every accessibility cell, for one- to three-line bodies', () => {
    forEachA11yCell((cell) => {
      for (const bodyLines of [1, 2, 3]) for (const withDetail of [true, false]) for (const fitBody of [true, false]) {
        const m = { title: lines(theme.type.caption), body: lines(theme.type.label, bodyLines),
          detail: withDetail ? lines(theme.type.caption) : null, fitBody };
        const layout = toastCardLayout(m);
        const rows = linesOf(layout, m);
        expect(layout.height, cell.name).toBeGreaterThanOrEqual(TOAST_CARD.height);
        expect(rows[0].top, cell.name).toBeGreaterThanOrEqual(TOAST_CARD.innerInset - TOAST_CARD.lineGap);
        expect(rows[rows.length - 1].bottom, cell.name).toBeLessThanOrEqual(layout.height - TOAST_CARD.innerInset + TOAST_CARD.lineGap);
        for (let i = 1; i < rows.length; i++) {
          expect(rows[i].top - rows[i - 1].bottom, `${cell.name}, ${bodyLines} body lines`).toBeGreaterThanOrEqual(TOAST_CARD.lineGap);
        }
      }
    });
  });

  it('keeps the release card and its slots for one-line copy at standard text', () => {
    const m = { title: lines(theme.typeBase.caption), body: lines(theme.typeBase.label), detail: lines(theme.typeBase.caption), fitBody: false };
    const layout = toastCardLayout(m);
    expect(layout.height).toBe(TOAST_CARD.height);
    expect(layout.titleTop + m.title / 2).toBe(TOAST_CARD.titleCenter);
    expect(layout.bodyTop + m.body / 2).toBe(TOAST_CARD.bodyCenter);
    expect(layout.detailTop! + m.detail / 2).toBe(TOAST_CARD.height - TOAST_CARD.detailFromBottom);
  });

  it('hangs a stack of grown cards from the release top, inside the frame and a gap apart', () => {
    const heights = [TOAST_CARD.height, 120, 104];
    const centers = toastStackCenters(heights);
    expect(centers[0] - heights[0] / 2).toBeGreaterThanOrEqual(theme.design.titleSafe.top);
    for (let i = 1; i < heights.length; i++) {
      expect((centers[i] - heights[i] / 2) - (centers[i - 1] + heights[i - 1] / 2)).toBe(TOAST_CARD.gap);
    }
    // Release cards land on the release rail's centres.
    expect(toastStackCenters([TOAST_CARD.height, TOAST_CARD.height])).toEqual([82, 82 + TOAST_CARD.height + TOAST_CARD.gap]);
  });
});
