import type Phaser from 'phaser';

export interface InspectHotkeyHandlers {
  onPrev?: () => void;
  onNext?: () => void;
  onClose?: () => void;
}

/**
 * The shared card-inspect keyboard convention: LEFT/RIGHT step the inspected
 * card, ESC closes. One binding site per open inspect surface - callers bind
 * when the inspect opens and MUST call the returned unbind when it closes
 * (scene shutdown does not unbind for them; a leaked handler on a destroyed
 * modal is the classic Phaser keyboard bug).
 *
 * Shipped call sites: PackOpeningScene's pull inspect. CollectionScene and
 * ShopScene predate this helper with scene-lifetime bindings of the same
 * convention; migrate them opportunistically, never bind both.
 */
export function bindInspectHotkeys(
  scene: Phaser.Scene,
  handlers: InspectHotkeyHandlers,
): () => void {
  const keyboard = scene.input.keyboard;
  const onLeft = (): void => handlers.onPrev?.();
  const onRight = (): void => handlers.onNext?.();
  const onEsc = (): void => handlers.onClose?.();
  keyboard?.on('keydown-LEFT', onLeft);
  keyboard?.on('keydown-RIGHT', onRight);
  keyboard?.on('keydown-ESC', onEsc);
  return () => {
    keyboard?.off('keydown-LEFT', onLeft);
    keyboard?.off('keydown-RIGHT', onRight);
    keyboard?.off('keydown-ESC', onEsc);
  };
}
