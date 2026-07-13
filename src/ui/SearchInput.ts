import Phaser from 'phaser';
import {
  DomSuppressionController,
  type DomSuppressionAdapter,
  type OverlayDomHandle,
} from './OverlayCoordinator';
import { theme } from './theme';

export interface SearchInputOptions {
  width?: number;
  placeholder?: string;
  /** Explicit accessible name; placeholder remains a visual hint only. */
  accessibleName?: string;
  onChange: (value: string) => void;
}

/**
 * The DOM search input's lifecycle and accessibility seam. It intentionally
 * extends Phaser's DOMElement so existing scene fields and setVisible calls
 * remain source-compatible while Wave 2 can pass the same object to
 * OverlayCoordinator.domHandles.
 */
export interface SearchInputHandleExtras extends OverlayDomHandle {
  readonly element: Phaser.GameObjects.DOMElement;
  readonly inputElement: HTMLInputElement;
  readonly accessibleName: string;
  isVisible(): boolean;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): this;
  focus(): void;
  blur(): void;
  /** Restore the last coordinator suppression snapshot, if any. */
  restore(): void;
  /** Remove listeners and release the handle's captured state. */
  teardown(): void;
}

/** DOMElement plus the lifecycle/accessibility methods above. */
export type SearchInputHandle = Phaser.GameObjects.DOMElement & SearchInputHandleExtras;

/**
 * The one reusable text-search `<input>` overlay. It returns a DOMElement
 * subtype for existing Collection/DeckBuilder callers and a registerable
 * OverlayDomHandle for future scene-owned coordinator registrations.
 */
export function createSearchInput(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: SearchInputOptions,
): SearchInputHandle {
  const width = opts.width ?? 220;
  const placeholder = opts.placeholder ?? 'Search cards…';
  const accessibleName = opts.accessibleName ?? 'Search cards';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', accessibleName);
  input.setAttribute('aria-disabled', 'false');
  input.setAttribute(
    'style',
    [
      `width:${width}px`,
      'box-sizing:border-box',
      'padding:6px 10px',
      `font:${theme.type.label}px ${theme.fonts.ui}`,
      `color:${theme.colors.body}`,
      `background:${theme.colors.btnGhostBg}`,
      `border:1px solid ${theme.colors.panelStroke}`,
      `border-radius:${theme.radius.control}px`,
      // Keep the focus ring's space reserved so it never changes layout.
      'outline:3px solid transparent',
      'outline-offset:3px',
      'box-shadow:none',
    ].join(';'),
  );

  const domElement = scene.add.dom(x, y, input).setOrigin(0.5).setDepth(50);
  const originalSetVisible = domElement.setVisible.bind(domElement);
  const originalDestroy = domElement.destroy.bind(domElement);
  let tornDown = false;

  const setFocusStyle = (focused: boolean): void => {
    input.style.outlineColor = focused ? theme.colors.gold : 'transparent';
    input.style.boxShadow = focused
      ? `0 0 0 2px ${theme.colors.btnGhostBg}, 0 0 0 5px ${theme.colors.gold}`
      : 'none';
  };
  const setEnabledDirect = (enabled: boolean): void => {
    input.disabled = !enabled;
    input.setAttribute('aria-disabled', String(!enabled));
  };

  const adapter: DomSuppressionAdapter = {
    isVisible: () => domElement.visible,
    setVisible: (visible) => originalSetVisible(visible),
    isEnabled: () => !input.disabled,
    setEnabled: setEnabledDirect,
    isFocused: () => typeof document !== 'undefined' && document.activeElement === input,
    focus: () => input.focus(),
    blur: () => input.blur(),
  };
  const suppression = new DomSuppressionController(adapter);

  const onInput = (): void => opts.onChange(input.value);
  const onFocus = (): void => setFocusStyle(true);
  const onBlur = (): void => setFocusStyle(false);
  input.addEventListener('input', onInput);
  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', onBlur);

  const handle = domElement as SearchInputHandle;
  const setVisible = (visible: boolean): SearchInputHandle => {
    // A suppressed handle must stay hidden even if an old scene caller tries
    // to show it before the coordinator closes.
    originalSetVisible(suppression.suppressionDepth > 0 ? false : visible);
    return handle;
  };
  const setEnabled = (enabled: boolean): SearchInputHandle => {
    setEnabledDirect(suppression.suppressionDepth > 0 ? false : enabled);
    return handle;
  };
  const focus = (): void => {
    if (suppression.suppressionDepth === 0 && !input.disabled) input.focus();
  };
  const blur = (): void => input.blur();
  const teardown = (): void => {
    if (tornDown) return;
    tornDown = true;
    input.removeEventListener('input', onInput);
    input.removeEventListener('focus', onFocus);
    input.removeEventListener('blur', onBlur);
    suppression.dispose();
  };
  const destroy = (fromScene?: boolean): void => {
    teardown();
    originalDestroy(fromScene);
  };

  Object.assign(handle, {
    element: domElement,
    inputElement: input,
    accessibleName,
    isVisible: () => domElement.visible,
    isEnabled: () => !input.disabled,
    setVisible,
    setEnabled,
    focus,
    blur,
    suppress: () => suppression.suppress(),
    restore: () => suppression.restore(),
    teardown,
    destroy,
  });
  domElement.once('destroy', teardown);
  return handle;
}

/** Structural helper for callers that want to state the registration intent. */
export function asOverlayDomHandle(handle: SearchInputHandle): OverlayDomHandle {
  return handle;
}
