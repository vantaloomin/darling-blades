import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyFormFactor,
  formFactor,
  FORM_FACTOR_MOBILE_MAX_WIDTH,
  FORM_FACTOR_TABLET_MAX_WIDTH,
  prefersReducedMotion,
  uiLanguage,
} from '../../src/platform/clientProfile';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('classifyFormFactor', () => {
  it('a pointer device is a computer at every width', () => {
    for (const viewportWidth of [320, 767, 768, 1279, 1280, 3840]) {
      expect(classifyFormFactor({ touch: false, viewportWidth })).toBe('desktop');
    }
  });

  it('splits touch devices either side of the mobile threshold', () => {
    expect(classifyFormFactor({ touch: true, viewportWidth: FORM_FACTOR_MOBILE_MAX_WIDTH })).toBe('mobile');
    expect(classifyFormFactor({ touch: true, viewportWidth: FORM_FACTOR_MOBILE_MAX_WIDTH + 1 })).toBe('tablet');
  });

  it('splits touch devices either side of the tablet threshold', () => {
    expect(classifyFormFactor({ touch: true, viewportWidth: FORM_FACTOR_TABLET_MAX_WIDTH })).toBe('tablet');
    expect(classifyFormFactor({ touch: true, viewportWidth: FORM_FACTOR_TABLET_MAX_WIDTH + 1 })).toBe('desktop');
  });

  it('degenerate widths land in a defined bucket rather than escaping', () => {
    expect(classifyFormFactor({ touch: true, viewportWidth: 0 })).toBe('mobile');
    expect(classifyFormFactor({ touch: true, viewportWidth: -1 })).toBe('mobile');
    expect(classifyFormFactor({ touch: true, viewportWidth: Number.NaN })).toBe('mobile');
    expect(classifyFormFactor({ touch: true, viewportWidth: Number.POSITIVE_INFINITY })).toBe('mobile');
  });

  it('emits a label and never a dimension', () => {
    // The whole privacy claim of section 3.3: the width is compared inside the
    // function and has nowhere to go afterwards.
    for (const viewportWidth of [375, 834, 1512]) {
      const out = classifyFormFactor({ touch: true, viewportWidth });
      expect(['mobile', 'tablet', 'desktop']).toContain(out);
      expect(JSON.stringify(out)).not.toContain(String(viewportWidth));
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
