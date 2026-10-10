import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyFormFactor,
  formFactor,
  FORM_FACTOR_MOBILE_MAX_SHORT_SIDE,
  FORM_FACTOR_TABLET_MAX_WIDTH,
  prefersReducedMotion,
  uiLanguage,
} from '../../src/platform/clientProfile';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('classifyFormFactor', () => {
  const touch = (viewportWidth: number, viewportHeight: number) => classifyFormFactor({ touch: true, viewportWidth, viewportHeight });

  it('a pointer device is a computer at every size', () => {
    for (const [w, h] of [[320, 568], [844, 390], [1180, 820], [3840, 2160]]) {
      expect(classifyFormFactor({ touch: false, viewportWidth: w, viewportHeight: h })).toBe('desktop');
    }
  });

  it('a phone is a phone held either way', () => {
    // The bug the shorter side fixes: landscape phones are 780 to 956 px wide.
    for (const [w, h] of [[390, 844], [844, 390], [360, 780], [780, 360], [956, 440]]) {
      expect(touch(w, h)).toBe('mobile');
    }
  });

  it('splits phones from tablets on the shorter side', () => {
    const line = FORM_FACTOR_MOBILE_MAX_SHORT_SIDE;
    expect(touch(1000, line)).toBe('mobile');
    expect(touch(1000, line + 1)).toBe('tablet');
    // The smallest iPad held upright is a tablet, not a phone.
    expect(touch(744, 1133)).toBe('tablet');
  });

  it('splits touch devices either side of the tablet threshold by width', () => {
    expect(touch(FORM_FACTOR_TABLET_MAX_WIDTH, 800)).toBe('tablet');
    expect(touch(FORM_FACTOR_TABLET_MAX_WIDTH + 1, 800)).toBe('desktop');
  });

  it('degenerate sizes land in a defined bucket rather than escaping', () => {
    expect(touch(0, 0)).toBe('mobile');
    expect(touch(-1, Number.NaN)).toBe('mobile');
    expect(touch(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe('mobile');
    // One readable side stands in for the shorter one.
    expect(touch(1024, 0)).toBe('tablet');
  });

  it('emits a label and never a dimension', () => {
    // The whole privacy claim of section 3.3: the size is compared inside the
    // function and has nowhere to go afterwards.
    for (const [w, h] of [[375, 667], [834, 1194], [1512, 982]]) {
      const out = touch(w, h);
      expect(['mobile', 'tablet', 'desktop']).toContain(out);
      expect(JSON.stringify(out)).not.toContain(String(w));
    }
  });
});

describe('the impure readers', () => {
  it('formFactor() reads as desktop with no window at all (headless, Vitest)', () => {
    expect(formFactor()).toBe('desktop');
  });

  it('uiLanguage() returns the raw tag, region included, for playSignals to reduce', () => {
    vi.stubGlobal('navigator', { language: 'en-GB' });
    expect(uiLanguage()).toBe('en-GB');
  });

  it('uiLanguage() falls back to languages[0], then to the empty string', () => {
    vi.stubGlobal('navigator', { languages: ['fr-CA'] });
    expect(uiLanguage()).toBe('fr-CA');
    vi.stubGlobal('navigator', {});
    expect(uiLanguage()).toBe('');
  });

  it('uiLanguage() survives a navigator whose accessor throws', () => {
    vi.stubGlobal('navigator', {
      get language(): string {
        throw new Error('blocked');
      },
    });
    expect(uiLanguage()).toBe('');
  });

  it('prefersReducedMotion() reads the media query and defaults to false', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(prefersReducedMotion()).toBe(false);
  });

  it('prefersReducedMotion() is false where matchMedia is missing or throws', () => {
    vi.stubGlobal('window', {});
    expect(prefersReducedMotion()).toBe(false);
    vi.stubGlobal('window', {
      matchMedia: () => {
        throw new Error('unsupported');
      },
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});
