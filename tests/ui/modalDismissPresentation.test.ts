import { describe, expect, it } from 'vitest';
import {
  resolveModalDismissPresentation,
  SceneEscRouter,
  type EscStackEntry,
  type ModalDismissPreset,
  type ModalDismissPresentation,
} from '../../src/ui/modalDismissPresentation';

const PRESETS: Array<[
  ModalDismissPreset,
  Pick<ModalDismissPresentation, 'escToClose' | 'tapDimToClose' | 'showClose'>,
]> = [
  ['dismissible', { escToClose: true, tapDimToClose: true, showClose: true }],
  ['esc-only', { escToClose: true, tapDimToClose: false, showClose: false }],
  ['esc-and-close', { escToClose: true, tapDimToClose: false, showClose: true }],
  ['esc-and-dim', { escToClose: true, tapDimToClose: true, showClose: false }],
  ['tap-and-close', { escToClose: false, tapDimToClose: true, showClose: true }],
  ['tap-only', { escToClose: false, tapDimToClose: true, showClose: false }],
  ['mandatory', { escToClose: false, tapDimToClose: false, showClose: false }],
];

describe('resolveModalDismissPresentation', () => {
  it.each(PRESETS)('resolves %s without a coordinator registration', (preset, routes) => {
    expect(resolveModalDismissPresentation(preset)).toEqual({
      ...routes,
      coordinatorDismissible: routes.escToClose,
      mandatory: preset === 'mandatory',
    });
  });

  it.each(PRESETS)('keeps %s routes with a dismissible coordinator registration', (preset, routes) => {
    expect(resolveModalDismissPresentation(preset, { dismissible: true })).toEqual({
      ...routes,
      coordinatorDismissible: preset === 'mandatory' ? false : true,
      mandatory: preset === 'mandatory',
    });
  });

  it.each(PRESETS)('blocks %s when coordinator registration is non-dismissible', (preset) => {
    expect(resolveModalDismissPresentation(preset, { dismissible: false })).toEqual({
      escToClose: false,
      tapDimToClose: false,
      showClose: false,
      coordinatorDismissible: false,
      mandatory: preset === 'mandatory',
    });
  });

  it.each(PRESETS)('blocks %s when coordinator registration is mandatory', (preset) => {
    expect(resolveModalDismissPresentation(preset, { mandatory: true, dismissible: true })).toEqual({
      escToClose: false,
      tapDimToClose: false,
      showClose: false,
      coordinatorDismissible: false,
      mandatory: true,
    });
  });
});

/**
 * One scene wired the way `themeWidgets.ts` wires it: the back route and every
 * legacy shell listen for Esc on the scene keyboard, and Phaser hands each
 * press to every listener registered at that moment, in registration order
 * (a snapshot, so a listener removed mid-press still hears that press).
 */
class SceneHarness {
  readonly router = new SceneEscRouter();
  readonly open: string[] = [];
  backs = 0;
  private listeners: Array<(press: object) => void> = [];

  registerBack(coordinatorConsumes: () => boolean = () => false): void {
    this.listeners.push((press) =>
      this.router.onBackEsc(press, () => {
        this.backs += 1;
      }, coordinatorConsumes),
    );
  }

  openModal(name: string, escClosesIt = true): void {
    let unregister = (): void => undefined;
    const listener = (press: object): void => this.router.onShellEsc(entry, press);
    const entry: EscStackEntry = {
      dismissible: escClosesIt,
      close: () => {
        this.open.splice(this.open.indexOf(name), 1);
        unregister();
        this.listeners = this.listeners.filter((other) => other !== listener);
      },
    };
    this.open.push(name);
    // Like modalShell: only a shell Esc may close adds a listener of its own.
    if (escClosesIt) this.listeners.push(listener);
    unregister = this.router.push(entry);
  }

  press(): void {
    const press = {};
    for (const listener of [...this.listeners]) listener(press);
  }
}

describe('SceneEscRouter: one Esc does one thing', () => {
  it('closes only the top-most of two stacked modals, then the next, then goes back', () => {
    const scene = new SceneHarness();
    scene.registerBack(); // create-time, as every screen with a back link does
    scene.openModal('decks');
    scene.openModal('choose format');

    scene.press();
    expect(scene.open).toEqual(['decks']);
    expect(scene.backs).toBe(0);
    scene.press();
    expect(scene.open).toEqual([]);
    expect(scene.backs).toBe(0);
    scene.press();
    expect(scene.backs).toBe(1);
  });

  it('closes a modal that opened before the back route without also leaving the screen', () => {
    // The Practice picker opened its first-run tutorial, then registered back.
    const scene = new SceneHarness();
    scene.openModal('tutorial');
    scene.registerBack();

    scene.press();
    expect(scene.open).toEqual([]);
    expect(scene.backs).toBe(0);
    scene.press();
    expect(scene.backs).toBe(1);
  });

  it('closes stacked modals one per press on a screen with no back route', () => {
    const scene = new SceneHarness();
    scene.openModal('pause menu');
    scene.openModal('confirm');

    scene.press();
    expect(scene.open).toEqual(['pause menu']);
    scene.press();
    expect(scene.open).toEqual([]);
  });

  it('lets a modal Esc cannot close swallow the press, so nothing under it closes and the screen stays', () => {
    const scene = new SceneHarness();
    scene.registerBack();
    scene.openModal('picker');
    scene.openModal('rename', false);

    scene.press();
    expect(scene.open).toEqual(['picker', 'rename']);
    expect(scene.backs).toBe(0);
  });

  it('gives a coordinator that owns the press priority over the legacy stack and the back action', () => {
    const scene = new SceneHarness();
    scene.registerBack(() => true);
    scene.openModal('legacy');

    scene.press();
    expect(scene.open).toEqual(['legacy']);
    expect(scene.backs).toBe(0);
  });
});
