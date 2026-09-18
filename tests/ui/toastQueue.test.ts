import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collapseToastBatch, TOAST_STACK_LIMIT, type ToastNotice } from '../../src/ui/toastQueue';

const notice = (title: string): ToastNotice => ({ title, body: `${title} body` });

describe('toast queue policy', () => {
  it('keeps up to three notices as a staggered stack', () => {
    const notices = ['One', 'Two', 'Three'].map(notice);

    expect(TOAST_STACK_LIMIT).toBe(3);
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

describe('the rail keeps its defaults for notices that opt into nothing', () => {
  // Toast.ts imports Phaser, so the host itself cannot be exercised headless.
  // These pin the two numbers a per-notice override falls back to, and the
  // fallback expressions themselves, so a regression here is a failing test
  // rather than a surprise on the next playthrough.
  const source = readFileSync(resolve(__dirname, '../../src/ui/Toast.ts'), 'utf8');

  it('still holds a plain notice for 3200ms in an 86px card', () => {
    expect(source).toContain('const TOAST_HOLD_MS = 3200;');
    expect(source).toContain('const TOAST_H = 86;');
  });

  it('falls back to those defaults rather than requiring the new fields', () => {
    expect(source).toContain('notice.holdMs ?? TOAST_HOLD_MS');
    expect(source).toContain("notice.fitBody === true");
    expect(source).toContain('notice.onShown?.();');
  });
});
