/**
 * Modal dismissal, with no Phaser in sight: the named presets a shell can take,
 * and the per-scene Esc route that decides which one modal a press closes.
 */

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

/** One open modal as a scene's Esc route sees it. */
export interface EscStackEntry {
  /** Whether Esc may close it. A modal Esc cannot close still owns the press. */
  readonly dismissible: boolean;
  close(): void;
}

/**
 * The one Esc route per scene, shared by every legacy (non-coordinator) modal
 * shell and the scene's back action.
 *
 * Phaser hands a key press to every listener on the scene, in the order they
 * were registered, and a screen can hold several: the create-time back route
 * and one per open shell. Each used to act on its own, so a single Esc closed
 * every stacked modal at once, or closed a modal that had registered before
 * the back route and then also left the screen. The router makes one press do
 * exactly one thing whatever the registration order: the top-most modal closes
 * (or, when it cannot be dismissed, swallows the press), and only a press no
 * modal claimed reaches the back action.
 *
 * Headless on purpose (no Phaser, no DOM): `themeWidgets.ts` wires the scene's
 * keyboard to it, and the tests drive it with plain objects as presses.
 */
export class SceneEscRouter {
  private readonly stack: EscStackEntry[] = [];
  /**
   * Presses a listener has already acted on. A key press is one event object
   * handed to every listener, so remembering the object is what lets the
   * later listeners of the same press stand down. Per router, so a press
   * spent in one scene is still live in another running beside it.
   */
  private readonly claimed = new WeakSet<object>();

  /** Put a modal on top of the stack; the returned function takes it off. */
  push(entry: EscStackEntry): () => void {
    this.stack.push(entry);
    return () => {
      const index = this.stack.indexOf(entry);
      if (index >= 0) this.stack.splice(index, 1);
    };
  }

  get size(): number {
    return this.stack.length;
  }

  get top(): EscStackEntry | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** True once any listener has acted on this press. */
  isClaimed(press: object | undefined): boolean {
    return press !== undefined && this.claimed.has(press);
  }

  /** Mark a press as spent so every later listener of it stands down. */
  claim(press: object | undefined): void {
    if (press !== undefined) this.claimed.add(press);
  }

  /**
   * A shell's own Esc listener. It acts only when its shell is the top-most
   * modal and no other listener has taken the press, so a modal underneath
   * never closes with the one above it.
   */
  onShellEsc(entry: EscStackEntry, press: object | undefined): void {
    if (this.isClaimed(press) || this.top !== entry) return;
    this.claim(press);
    if (entry.dismissible) entry.close();
  }

  /**
   * The scene's back route. A coordinator that owns the press (its own
   * overlay stack) goes first; then the top-most legacy modal; the back action
   * only runs when nothing is open.
   */
  onBackEsc(
    press: object | undefined,
    onBack: () => void,
    coordinatorConsumes: () => boolean = () => false,
  ): void {
    if (this.isClaimed(press)) return;
    this.claim(press);
    if (coordinatorConsumes()) return;
    const top = this.top;
    if (top) {
      if (top.dismissible) top.close();
      return;
    }
    onBack();
  }
}
