import { describe, expect, it } from 'vitest';
import { compactHitProblems, type CompactControl } from '../../src/ui/compactLayout';
import { compactDailyPage, compactMainMenuLayout, MAIN_MENU_COMPACT } from '../../src/ui/mainMenuCompact';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));
// Safari on the Pro Max with its bars showing (plan C2): the short variant.
const safari = resolveScreenMetrics({ viewportWidth: 956, viewportHeight: 328, insets: { left: 62, right: 62 }, coarsePointer: true, devicePixelRatio: 3 });
const reference = resolveScreenMetrics(SCREEN_FIXTURES.find((f) => f.name === 'phone-island')!);

/**
 * compactHitProblems, but two controls are crowded only when they are closer
 * than 8 px along the line between them: its `inactiveGap` takes the smaller
 * axis gap for a diagonal pair, which flags a Glossary button 315 px left of
 * Achievements as crowded.
 */
const problems = (cs: CompactControl[], content: Parameters<typeof compactHitProblems>[1]) =>
  compactHitProblems(cs, content).filter((p) => {
    if (p.kind !== 'crowded' || p.other === undefined) return true;
    const a = cs[p.index].hit;
    const b = cs[p.other].hit;
    const gx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0);
    const gy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0);
    const intersects = gx === 0 && gy === 0 && !(a.x + a.width === b.x || b.x + b.width === a.x || a.y + a.height === b.y || b.y + b.height === a.y);
    return intersects || Math.hypot(gx, gy) < 8;
  });

const controls = (l: ReturnType<typeof compactMainMenuLayout>): CompactControl[] =>
  [l.gear, ...(l.fullScreen ? [l.fullScreen] : []), l.profile, l.howToPlay, l.glossary, ...l.nav, l.play].map((r) => ({ visual: r, hit: r }));

describe('the compact main menu (mock M-MainMenu)', () => {
  it('matches the mock on the reference phone', () => {
    const l = compactMainMenuLayout(reference.content, { fullScreen: false, navCount: 4 });
    expect(l.gear).toEqual({ x: 741, y: 8, width: 44, height: 44 });
    expect(l.play).toEqual({ x: 555, y: 320, width: 230, height: 44 });
    expect(l.nav.map((r) => r.y)).toEqual([60, 120, 180, 240]);
    expect(l.nav.every((r) => r.height === MAIN_MENU_COMPACT.navRowH)).toBe(true);
    expect(l.profile.x).toBe(67);
    expect(l.glossary.y + l.glossary.height).toBeLessThanOrEqual(364 - MAIN_MENU_COMPACT.versionH);
  });

  for (const { name, m } of [...landscape, { name: 'safari-short', m: safari }]) {
    for (const fullScreen of [false, true]) {
      it(`every control holds the touch contract on ${name}${fullScreen ? ' with the full-screen icon' : ''}`, () => {
        const l = compactMainMenuLayout(m.content, { fullScreen, navCount: 4 });
        expect(problems(controls(l), m.content)).toEqual([]);
        // Daily Blades sits between the left column and the command column.
        expect(l.daily.x).toBeGreaterThanOrEqual(l.profile.x + l.profile.width + 8);
        expect(l.daily.x + l.daily.width).toBeLessThanOrEqual(l.play.x - 8);
        expect(l.title.maxWidth).toBeGreaterThan(0);
      });
    }
  }
});

describe('Daily Blades folds rather than cutting a quest (mock M-MainMenu130)', () => {
  it('shows every quest when they fit', () => {
    expect(compactDailyPage(230, [70, 70, 70], 0)).toEqual({ quests: [0, 1, 2], fold: null });
  });

  it('pages through every quest exactly once when they do not', () => {
    const seen: number[] = [];
    let page = 0;
    for (let i = 0; i < 3; i++) {
      const p = compactDailyPage(160, [100, 100, 100], page);
      seen.push(...p.quests);
      expect(p.fold).not.toBeNull();
      page = p.fold!.next;
      if (page === 0) break;
    }
    expect(seen).toEqual([0, 1, 2]);
  });

  it('names how many are folded away, and goes back to the start from the last page', () => {
    const first = compactDailyPage(200, [90, 90, 90], 0);
    expect(first.quests).toEqual([0]);
    expect(first.fold?.label).toBe('2 more quests');
    expect(compactDailyPage(200, [90, 90, 90], 2).fold).toEqual({ label: 'First quests', next: 0 });
    expect(compactDailyPage(260, [90, 90, 90], 0).fold?.label).toBe('1 more quest');
  });
});
