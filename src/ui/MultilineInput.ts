import Phaser from 'phaser';
import {
  DomSuppressionController,
  type DomSuppressionAdapter,
  type OverlayDomHandle,
} from './OverlayCoordinator';
import { theme } from './theme';

export interface MultilineInputOptions {
  width: number;
  height: number;
  accessibleName: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export interface MultilineInputHandleExtras extends OverlayDomHandle {
  readonly element: Phaser.GameObjects.DOMElement;
  readonly inputElement: HTMLTextAreaElement;
  getValue(): string;
  setValue(value: string): this;
  select(): void;
  focus(): void;
  blur(): void;
  isVisible(): boolean;
  isEnabled(): boolean;
  setVisible(visible: boolean): this;
  setEnabled(enabled: boolean): this;
  teardown(): void;
}

export type MultilineInputHandle = Phaser.GameObjects.DOMElement & MultilineInputHandleExtras;

/**
 * DOM textarea for long, selectable text. OverlayCoordinator owns its
 * suppression lifecycle so a nested confirmation cannot leave the field
 * focused or editable underneath it.
 */
export function createMultilineInput(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: MultilineInputOptions,
): MultilineInputHandle {
  const input = document.createElement('textarea');
  input.placeholder = opts.placeholder ?? '';
  input.readOnly = opts.readOnly ?? false;
  input.spellcheck = false;
  input.wrap = 'soft';
  input.setAttribute('aria-label', opts.accessibleName);
  input.setAttribute('aria-disabled', 'false');
  input.setAttribute(
    'style',
    [
      `width:${opts.width}px`,
      `height:${opts.height}px`,
      'box-sizing:border-box',
      'padding:12px',
      `font:14px ${opts.readOnly ? 'monospace' : theme.fonts.ui}`,
      'line-height:1.45',
      `color:${theme.colors.body}`,
      `background:${theme.colors.btnGhostBg}`,
      `border:1px solid ${theme.colors.panelStroke}`,
      `border-radius:${theme.radius.control}px`,
      'outline:3px solid transparent',
      'outline-offset:3px',
      'resize:none',
    ].join(';'),
  );

  const domElement = scene.add.dom(x, y, input).setOrigin(0.5).setDepth(theme.depth.modal + 1);
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

  const onInput = (): void => opts.onChange?.(input.value);
  const onFocus = (): void => setFocusStyle(true);
  const onBlur = (): void => setFocusStyle(false);
  input.addEventListener('input', onInput);
  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', onBlur);

  const handle = domElement as MultilineInputHandle;
  const setVisible = (visible: boolean): MultilineInputHandle => {
    originalSetVisible(suppression.suppressionDepth > 0 ? false : visible);
    return handle;
  };
  const setEnabled = (enabled: boolean): MultilineInputHandle => {
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
    getValue: () => input.value,
    setValue: (value: string): MultilineInputHandle => {
      input.value = value;
      return handle;
    },
    select: () => input.select(),
    focus,
    blur,
    isVisible: () => domElement.visible,
    isEnabled: () => !input.disabled,
    setVisible,
    setEnabled,
    suppress: () => suppression.suppress(),
    restore: () => suppression.restore(),
    teardown,
    destroy,
  });
  domElement.once('destroy', teardown);
  return handle;
}
