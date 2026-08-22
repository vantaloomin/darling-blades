/** The named dismissal modes supported by the shared modal shell. */
export type ModalDismissPreset =
  | 'dismissible'
  | 'esc-only'
  | 'esc-and-close'
  | 'esc-and-dim'
  | 'tap-and-close'
  | 'tap-only'
  | 'mandatory';

/** Deprecated shape retained only for shared helpers outside this migration. */
export interface LegacyModalDismissOptions {
  escToClose: boolean;
  tapDimToClose: boolean;
  showClose: boolean;
}

/** The coordinator fields that can further constrain a shell's preset. */
export interface ModalDismissRegistration {
  mandatory?: boolean;
  dismissible?: boolean;
}

export interface ModalDismissPresentation {
  escToClose: boolean;
  tapDimToClose: boolean;
  showClose: boolean;
  /** The coordinator's Esc dismissal state, separate from shell-local Esc. */
  coordinatorDismissible: boolean;
  mandatory: boolean;
}

interface PresetPresentation {
  escToClose: boolean;
  tapDimToClose: boolean;
  showClose: boolean;
}

const PRESET_PRESENTATIONS: Record<ModalDismissPreset, PresetPresentation> = {
  dismissible: { escToClose: true, tapDimToClose: true, showClose: true },
  'esc-only': { escToClose: true, tapDimToClose: false, showClose: false },
  'esc-and-close': { escToClose: true, tapDimToClose: false, showClose: true },
  'esc-and-dim': { escToClose: true, tapDimToClose: true, showClose: false },
  'tap-and-close': { escToClose: false, tapDimToClose: true, showClose: true },
  'tap-only': { escToClose: false, tapDimToClose: true, showClose: false },
  mandatory: { escToClose: false, tapDimToClose: false, showClose: false },
};

/**
 * Resolve one named preset with the optional coordinator safety constraints.
 *
 * `registration.dismissible` can preserve a coordinator-owned Esc route for a
 * legacy or scene-specific registration, but it cannot make a mandatory preset
 * dismissible. `registration.mandatory` always wins over the preset's routes.
 */
export function resolveModalDismissPresentation(
  preset: ModalDismissPreset | LegacyModalDismissOptions,
  registration?: ModalDismissRegistration,
): ModalDismissPresentation {
  const base = typeof preset === 'string' ? PRESET_PRESENTATIONS[preset] : preset;
  const mandatory = preset === 'mandatory' || registration?.mandatory === true;
  const coordinatorDismissible = mandatory
    ? false
    : registration?.dismissible ?? base.escToClose;
  const shellCanDismiss = !mandatory && (registration === undefined || coordinatorDismissible);

  return {
    escToClose: shellCanDismiss && base.escToClose,
    tapDimToClose: shellCanDismiss && base.tapDimToClose,
    showClose: shellCanDismiss && base.showClose,
    coordinatorDismissible,
    mandatory,
  };
}
