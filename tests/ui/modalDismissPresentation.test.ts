import { describe, expect, it } from 'vitest';
import {
  resolveModalDismissPresentation,
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
