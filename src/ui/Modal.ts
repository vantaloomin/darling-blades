import Phaser from 'phaser';
import { CardView } from './CardView';
import {
  RefCountedLeaseRegistry,
  restoreInteractiveInput,
  snapshotInteractiveInput,
  type InteractiveInputSnapshot,
  type OverlayGuardTarget,
  type ResourceLease,
} from './OverlayCoordinator';

/** While open, disables a set of underlying interactive objects; restores on close. */
export class ModalGuard {
  private leases: Array<ResourceLease<Phaser.GameObjects.GameObject>> = [];

  open(objects: Iterable<Phaser.GameObjects.GameObject>): void {
    const targets = [...new Set(objects)].filter((obj) =>
      obj instanceof CardView || Boolean(obj.input?.enabled),
    );
    if (targets.length === 0) return;
    this.leases.push(GUARDED_OBJECTS.acquire(targets, disableObject));
  }

  close(): void {
    for (const lease of this.leases) GUARDED_OBJECTS.release(lease, enableObject);
    this.leases = [];
  }
}

type GuardSnapshot = { kind: 'card' } | { kind: 'input'; input: InteractiveInputSnapshot };

/** One shared registry makes separate ModalGuard instances interleave safely. */
const GUARDED_OBJECTS = new RefCountedLeaseRegistry<Phaser.GameObjects.GameObject>();
const SNAPSHOTS = new WeakMap<Phaser.GameObjects.GameObject, GuardSnapshot>();

function disableObject(obj: Phaser.GameObjects.GameObject): void {
  if (obj instanceof CardView) {
    SNAPSHOTS.set(obj, { kind: 'card' });
    obj.disableInput();
    return;
  }
  const input = obj.input;
  if (!input) return;
  SNAPSHOTS.set(obj, { kind: 'input', input: snapshotInteractiveInput(input) });
  obj.disableInteractive();
}

function enableObject(obj: Phaser.GameObjects.GameObject): void {
  const snapshot = SNAPSHOTS.get(obj);
  SNAPSHOTS.delete(obj);
  if (!obj.scene || !snapshot) return; // destroyed while guarded (declarative re-renders)
  if (snapshot.kind === 'card') {
    if (obj instanceof CardView) obj.enableInput();
    return;
  }
  if (obj.input) restoreInteractiveInput(obj.input, snapshot.input);
}

/**
 * Adapter for coordinator registrations. It deliberately shares ModalGuard's
 * global object registry, so coordinator leases and legacy guards compose.
 */
export function modalGuardTarget(obj: Phaser.GameObjects.GameObject): OverlayGuardTarget {
  let lease: ResourceLease<Phaser.GameObjects.GameObject> | null = null;
  return {
    disable: () => {
      if (lease) return;
      if (!(obj instanceof CardView) && !obj.input?.enabled) return;
      lease = GUARDED_OBJECTS.acquire([obj], disableObject);
    },
    enable: () => {
      if (!lease) return;
      GUARDED_OBJECTS.release(lease, enableObject);
      lease = null;
    },
  };
}
