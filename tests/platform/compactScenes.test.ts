import { afterEach, describe, expect, it } from 'vitest';
import {
  activeCompactMetrics,
  COMPACT_SCENES,
  compactCamera,
  compactSceneMetrics,
  DESKTOP_DENSITY,
  desktopCompactMetrics,
  setActiveCompactMetrics,
} from '../../src/platform/compactScenes';
import { compactCanvasSize, resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';

const phone = resolveScreenMetrics(SCREEN_FIXTURES.find((f) => f.name === 'phone-island')!);
const desktop = resolveScreenMetrics({ viewportWidth: 1920, viewportHeight: 1080, coarsePointer: false });

afterEach(() => setActiveCompactMetrics(null));

describe('which scenes draw their compact composition', () => {
  it('only a listed scene, and only under the compact profile', () => {
    expect(compactSceneMetrics('MainMenu', COMPACT_SCENES, new Set())).toBeNull();
    setActiveCompactMetrics(phone);
    expect(compactSceneMetrics('MainMenu')).toBe(phone);
    expect(compactSceneMetrics('Duel', new Set(['MainMenu']))).toBeNull();
  });

  it('the wide profile never activates the phone metrics', () => {
    setActiveCompactMetrics(desktop);
    expect(activeCompactMetrics()).toBeNull();
    expect(compactSceneMetrics('MainMenu', COMPACT_SCENES, new Set())).toBeNull();
  });

  it('on desktop a listed scene draws the compact composition in 1280x720 over the desktop density', () => {
    const m = compactSceneMetrics('MainMenu', COMPACT_SCENES, new Set(['MainMenu']));
    expect(m).toEqual(desktopCompactMetrics());
    expect(m!.design.width * DESKTOP_DENSITY).toBeCloseTo(1280, -1);
    expect(m!.design.height * DESKTOP_DENSITY).toBeCloseTo(720, -1);
    const { content, design } = m!;
    expect(content.x + content.width).toBeLessThanOrEqual(design.width);
    expect(content.y + content.height).toBeLessThanOrEqual(design.height);
    expect(compactSceneMetrics('Duel', COMPACT_SCENES, new Set(['MainMenu']))).toBeNull();
  });

  it('a phone never gets the desktop metrics, even for a desktop scene', () => {
    setActiveCompactMetrics(phone);
    expect(compactSceneMetrics('Duel', new Set(['MainMenu']), new Set(['Duel']))).toBeNull();
  });

  it('lists the main menu', () => {
    expect(COMPACT_SCENES.has('MainMenu')).toBe(true);
  });
});

describe('compactCamera', () => {
  it('fills the canvas at build time: one design px per CSS px at the render factor', () => {
    const canvas = compactCanvasSize(phone);
    const cam = compactCamera(phone.design, canvas);
    expect(cam.zoom).toBe(phone.renderK);
    expect(cam.centerX).toBe(phone.design.width / 2);
    expect(cam.centerY).toBe(phone.design.height / 2);
  });

  it('a tablet draws the reference composition scaled up', () => {
    const tablet = resolveScreenMetrics(SCREEN_FIXTURES.find((f) => f.name === 'tablet-mini')!);
    const cam = compactCamera(tablet.design, compactCanvasSize(tablet));
    expect(cam.zoom).toBeCloseTo(tablet.scale * tablet.renderK, 3);
  });

  it('after the screen shrinks, the built layout stays whole, fitted', () => {
    // Safari's bar appears: the canvas loses height, the scene keeps its layout.
    const cam = compactCamera(phone.design, { width: 852 * 2, height: 330 * 2 });
    expect(cam.zoom * phone.design.height).toBeLessThanOrEqual(330 * 2 + 1e-9);
    expect(cam.zoom * phone.design.width).toBeLessThanOrEqual(852 * 2 + 1e-9);
  });
});
