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
