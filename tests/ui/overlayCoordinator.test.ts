import { describe, expect, it } from 'vitest';
import {
  DomSuppressionController,
  OverlayCoordinator,
  RefCountedLeaseRegistry,
  restoreInteractiveInput,
  snapshotInteractiveInput,
  type DomSuppressionAdapter,
  type InteractiveInputLike,
  type OverlayDomHandle,
  type OverlayGuardTarget,
} from '../../src/ui/OverlayCoordinator';

describe('overlay coordinator primitives', () => {
  it('restores an exact custom hit-area snapshot without rebuilding interaction', () => {
    const originalCallback = (): boolean => true;
    const replacementCallback = (): boolean => false;
    const hitArea = { x: -35, y: -22, width: 90, height: 44, radius: 4 };
    const input: InteractiveInputLike = {
      enabled: true,
      hitArea,
      hitAreaCallback: originalCallback,
      customHitArea: true,
      useHandCursor: true,
      cursor: 'pointer',
    };

    const snapshot = snapshotInteractiveInput(input);
    input.enabled = false;
    input.hitArea = { x: 0, y: 0, width: 1, height: 1 };
    input.hitAreaCallback = replacementCallback;
    input.customHitArea = false;
    input.useHandCursor = false;
    input.cursor = false;
    hitArea.x = 99;
    hitArea.y = 100;
    hitArea.width = 2;
    hitArea.height = 3;

    restoreInteractiveInput(input, snapshot);

    expect(input.enabled).toBe(true);
    expect(input.hitArea).toBe(hitArea);
    expect(hitArea).toMatchObject({ x: -35, y: -22, width: 90, height: 44, radius: 4 });
    expect(input.hitAreaCallback).toBe(originalCallback);
    expect(input.customHitArea).toBe(true);
    expect(input.useHandCursor).toBe(true);
    expect(input.cursor).toBe('pointer');
  });

  it('keeps a shared target disabled until the last interleaved lease closes', () => {
    const registry = new RefCountedLeaseRegistry<object>();
    const target = {};
    let disables = 0;
    let enables = 0;
    const disable = (): void => { disables += 1; };
    const enable = (): void => { enables += 1; };

    const a = registry.acquire([target], disable);
    const b = registry.acquire([target], disable);
    registry.release(a, enable);
    expect(registry.has(target)).toBe(true);
    expect(disables).toBe(1);
    expect(enables).toBe(0);

    registry.release(b, enable);
    expect(registry.has(target)).toBe(false);
    expect(enables).toBe(1);
    expect(registry.release(b, enable)).toBe(false);
  });

  it('uses stack order, lease ownership, and invoker identity for priority', () => {
    const coordinator = new OverlayCoordinator();
    const invoker = { id: 'search' };
    const first = coordinator.open({ invoker, focus: { group: 'filters', order: 2 } });
    const second = coordinator.open({ invoker: 'inspect', focus: { group: 'modal', order: 1 } });

    expect(coordinator.currentTop()?.lease).toBe(second);
    expect(coordinator.currentTop()?.invoker).toBe('inspect');
    expect(coordinator.dispatchEsc()).toMatchObject({ consumed: true, closed: true, overlay: { lease: second } });
    expect(coordinator.currentTop()?.lease).toBe(first);
    expect(coordinator.currentTop()?.invoker).toBe(invoker);
    expect(first.close()).toBe(true);
    expect(first.close()).toBe(false);
    expect(coordinator.currentTop()).toBeNull();
  });

  it('lets a dismissible overlay consume one Esc while a mandatory overlay refuses it', () => {
    const coordinator = new OverlayCoordinator();
    const dismissed: string[] = [];
    coordinator.open({ mandatory: true, invoker: 'chooser' });
    coordinator.open({ invoker: 'inspect', onDismiss: () => dismissed.push('inspect') });

    const first = coordinator.dispatchEsc();
    expect(first).toMatchObject({ consumed: true, closed: true });
    expect(dismissed).toEqual(['inspect']);
    expect(coordinator.top?.invoker).toBe('chooser');

    const second = coordinator.dispatchEsc();
    expect(second).toMatchObject({ consumed: true, closed: false, overlay: { mandatory: true } });
    expect(coordinator.top?.invoker).toBe('chooser');
  });

  it('refcounts guards and DOM handles independently across out-of-order overlay closure', () => {
    const coordinator = new OverlayCoordinator();
    const guard = countedTarget();
    const dom = countedTarget();
    const first = coordinator.open({ guardTargets: [guard], domHandles: [dom] });
    const second = coordinator.open({ guardTargets: [guard], domHandles: [dom] });

    expect(guard.disabled).toBe(1);
    expect(dom.disabled).toBe(1);
    expect(coordinator.isBlocked(guard)).toBe(true);
    expect(coordinator.isBlocked(dom)).toBe(true);

    coordinator.close(first);
    expect(guard.enabled).toBe(0);
    expect(dom.enabled).toBe(0);
    expect(coordinator.isBlocked()).toBe(true);

    coordinator.close(second);
    expect(guard.enabled).toBe(1);
    expect(dom.enabled).toBe(1);
    expect(coordinator.isBlocked()).toBe(false);
  });

  it('restores DOM visibility, enabled state, and focus only after the last suppression', () => {
    const state = { visible: false, enabled: true, focused: false, focuses: 0, blurs: 0 };
    const adapter: DomSuppressionAdapter = {
      isVisible: () => state.visible,
      setVisible: (visible) => { state.visible = visible; },
      isEnabled: () => state.enabled,
      setEnabled: (enabled) => { state.enabled = enabled; },
      isFocused: () => state.focused,
      focus: () => { state.focused = true; state.focuses += 1; },
      blur: () => { state.focused = false; state.blurs += 1; },
    };
    const suppression = new DomSuppressionController(adapter);

    suppression.suppress();
    suppression.suppress();
    expect(state).toMatchObject({ visible: false, enabled: false, focused: false });
    suppression.restore();
    expect(state).toMatchObject({ visible: false, enabled: false });
    suppression.restore();
    expect(state).toMatchObject({ visible: false, enabled: true });

    state.visible = true;
    state.focused = true;
    suppression.suppress();
    suppression.restore();
    expect(state).toMatchObject({ visible: true, enabled: true, focused: true });
    expect(state.focuses).toBe(1);
    expect(state.blurs).toBe(3);
  });
});

function countedTarget(): OverlayGuardTarget & OverlayDomHandle & { disabled: number; enabled: number } {
  const target = {
    disabled: 0,
    enabled: 0,
    disable(): void { target.disabled += 1; },
    enable(): void { target.enabled += 1; },
    suppress(): void { target.disabled += 1; },
    restore(): void { target.enabled += 1; },
  };
  return target;
}
