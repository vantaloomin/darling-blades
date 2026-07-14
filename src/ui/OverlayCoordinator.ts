import type { FocusMetadata } from './layout';

/**
 * A lease is deliberately a value owned by one open overlay. Closing a lease
 * releases only the resources that overlay acquired, so nested overlays may
 * close in any order without re-enabling a shared target too early.
 */
export interface ResourceLease<T> {
  readonly id: number;
  readonly items: readonly T[];
}

/** Small, headless reference-counting primitive shared by guards and DOM. */
export class RefCountedLeaseRegistry<T> {
  private readonly active = new Map<ResourceLease<T>, readonly T[]>();
  private readonly counts = new Map<T, number>();
  private nextId = 1;

  acquire(items: Iterable<T>, onFirstAcquire: (item: T) => void): ResourceLease<T> {
    const unique = [...new Set(items)];
    for (const item of unique) {
      const count = this.counts.get(item) ?? 0;
      if (count === 0) onFirstAcquire(item);
      this.counts.set(item, count + 1);
    }
    const lease: ResourceLease<T> = { id: this.nextId, items: unique };
    this.nextId += 1;
    this.active.set(lease, unique);
    return lease;
  }

  /** Release exactly one lease. Releasing an already-closed lease is a no-op. */
  release(lease: ResourceLease<T>, onLastRelease: (item: T) => void): boolean {
    const items = this.active.get(lease);
    if (!items) return false;
    this.active.delete(lease);
    for (const item of items) {
      const count = this.counts.get(item) ?? 0;
      if (count <= 1) {
        this.counts.delete(item);
        onLastRelease(item);
      } else {
        this.counts.set(item, count - 1);
      }
    }
    return true;
  }

  count(item: T): number {
    return this.counts.get(item) ?? 0;
  }

  has(item: T): boolean {
    return this.count(item) > 0;
  }
}

/** Minimal adapters keep the coordinator independent of Phaser and the DOM. */
export interface OverlayGuardTarget {
  disable(): void;
  enable(): void;
}

export interface OverlayDomHandle {
  suppress(): void;
  restore(): void;
}

/**
 * Browser-facing state that a DOM overlay can expose without making the
 * coordinator depend on the DOM. SearchInput uses this adapter; tests can use
 * a plain object with the same methods.
 */
export interface DomSuppressionAdapter {
  isVisible(): boolean;
  setVisible(visible: boolean): void;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  isFocused?(): boolean;
  focus?(): void;
  blur?(): void;
}

interface DomSuppressionSnapshot {
  visible: boolean;
  enabled: boolean;
  focused: boolean;
}

/**
 * Reference-safe DOM suppression state machine. The first suppress captures
 * the prior state, nested suppressions keep the handle suppressed, and the
 * final restore returns exactly to that state (including an already-hidden or
 * already-disabled input).
 */
export class DomSuppressionController implements OverlayDomHandle {
  private depth = 0;
  private snapshot: DomSuppressionSnapshot | null = null;

  constructor(private readonly adapter: DomSuppressionAdapter) {}

  suppress(): void {
    if (this.depth === 0) {
      this.snapshot = {
        visible: this.adapter.isVisible(),
        enabled: this.adapter.isEnabled(),
        focused: this.adapter.isFocused?.() ?? false,
      };
    }
    this.depth += 1;
    this.adapter.setVisible(false);
    this.adapter.setEnabled(false);
    this.adapter.blur?.();
  }

  restore(): void {
    if (this.depth === 0) return;
    this.depth -= 1;
    if (this.depth > 0) return;
    const snapshot = this.snapshot;
    this.snapshot = null;
    if (!snapshot) return;
    this.adapter.setVisible(snapshot.visible);
    this.adapter.setEnabled(snapshot.enabled);
    if (snapshot.focused && snapshot.visible && snapshot.enabled) this.adapter.focus?.();
  }

  /** Used by DOM teardown to discard captured state without restoring focus. */
  dispose(): void {
    this.depth = 0;
    this.snapshot = null;
  }

  get suppressionDepth(): number {
    return this.depth;
  }
}

export type OverlayInvoker = unknown;

export interface OverlayRegistration {
  guardTargets?: Iterable<OverlayGuardTarget>;
  domHandles?: Iterable<OverlayDomHandle>;
  mandatory?: boolean;
  /** False preserves a caller's existing non-Esc-dismissible shell semantics. */
  dismissible?: boolean;
  /** Opaque logical identity; actual keyboard focus belongs to DS-06. */
  invoker?: OverlayInvoker;
  focus?: FocusMetadata;
  /** Called by dispatchEsc after the coordinator has closed the lease. */
  onDismiss?: () => void;
}

export interface OverlayLease {
  readonly id: number;
  readonly registration: Readonly<OverlayRegistration>;
  close(): boolean;
}

export interface ActiveOverlay {
  lease: OverlayLease;
  readonly registration: Readonly<OverlayRegistration>;
  readonly guardTargets: readonly OverlayGuardTarget[];
  readonly domHandles: readonly OverlayDomHandle[];
  readonly mandatory: boolean;
  readonly dismissible: boolean;
  readonly invoker: OverlayInvoker;
  readonly focus?: FocusMetadata;
  active: boolean;
}

export interface EscResolution {
  overlay: ActiveOverlay | null;
  /** Whether the top overlay owns the key, including a mandatory refusal. */
  consumed: boolean;
  dismissible: boolean;
}

/** Pure topmost-overlay resolver. Stack order is the only priority rule. */
export function resolveEsc(stack: readonly ActiveOverlay[]): EscResolution {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const overlay = stack[index];
    if (!overlay.active) continue;
    return {
      overlay,
      consumed: true,
      dismissible: overlay.dismissible && !overlay.mandatory,
    };
  }
  return { overlay: null, consumed: false, dismissible: false };
}

export interface EscDispatchResult {
  consumed: boolean;
  closed: boolean;
  overlay: ActiveOverlay | null;
}

/**
 * Snapshot shape used by ModalGuard's Phaser adapter. It intentionally stores
 * both the hit-area object and its rectangle geometry: a later mutation cannot
 * silently replace an inflated custom target when the guard is released.
 */
export interface InteractiveInputLike {
  enabled: boolean;
  hitArea: unknown;
  hitAreaCallback?: unknown;
  customHitArea: boolean;
  useHandCursor?: boolean;
  cursor?: boolean | string;
}

export interface InteractiveInputSnapshot {
  enabled: boolean;
  hitArea: unknown;
  hitAreaCallback: unknown;
  customHitArea: boolean;
  useHandCursor: boolean;
  cursor: boolean | string | undefined;
  hadUseHandCursor: boolean;
  geometry: Readonly<Record<string, number>>;
}

const HIT_AREA_GEOMETRY_KEYS = [
  'x',
  'y',
  'width',
  'height',
  'radius',
  'left',
  'right',
  'top',
  'bottom',
] as const;

function numericGeometry(area: unknown): Record<string, number> {
  if (!area || typeof area !== 'object') return {};
  const source = area as Record<string, unknown>;
  return Object.fromEntries(
    [...new Set([...HIT_AREA_GEOMETRY_KEYS, ...Object.keys(source) as typeof HIT_AREA_GEOMETRY_KEYS[number][]])]
      .filter((key) => typeof source[key] === 'number')
      .map((key) => [key, source[key] as number]),
  );
}

/** Capture the exact interactive settings relevant to temporary guarding. */
export function snapshotInteractiveInput(input: InteractiveInputLike): InteractiveInputSnapshot {
  const hadUseHandCursor = 'useHandCursor' in input;
  return {
    enabled: input.enabled,
    hitArea: input.hitArea,
    hitAreaCallback: input.hitAreaCallback,
    customHitArea: input.customHitArea,
    useHandCursor: hadUseHandCursor ? input.useHandCursor === true : input.cursor === true,
    cursor: input.cursor,
    hadUseHandCursor,
    geometry: numericGeometry(input.hitArea),
  };
}

/** Restore the snapshot without calling bare setInteractive(). */
export function restoreInteractiveInput(
  input: InteractiveInputLike,
  snapshot: InteractiveInputSnapshot,
): void {
  input.hitArea = snapshot.hitArea;
  const area = input.hitArea;
  if (area && typeof area === 'object') {
    const mutableArea = area as Record<string, unknown>;
    // Assign the captured fields directly. Calling a polymorphic `setTo`
    // would restore a Rectangle correctly but can misinterpret Circle or
    // custom hit-area signatures.
    for (const [key, value] of Object.entries(snapshot.geometry)) {
      let owner: object | null = mutableArea;
      let descriptor: PropertyDescriptor | undefined;
      while (owner && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(owner, key);
        owner = Object.getPrototypeOf(owner) as object | null;
      }
      // Phaser's Rectangle exposes left/right/top/bottom as getter-only
      // aliases. Restore writable source geometry without shadowing those
      // derived properties.
      if (descriptor && !descriptor.writable && !descriptor.set) continue;
      try {
        mutableArea[key] = value;
      } catch {
        // A custom hit area may expose read-only derived geometry; its source
        // fields have already been restored, so leave the alias untouched.
      }
    }
  }
  input.hitAreaCallback = snapshot.hitAreaCallback;
  input.customHitArea = snapshot.customHitArea;
  if (snapshot.hadUseHandCursor) input.useHandCursor = snapshot.useHandCursor;
  if ('cursor' in input) input.cursor = snapshot.cursor;
  input.enabled = snapshot.enabled;
}

/**
 * Per-scene overlay ownership. The class has no Phaser, DOM, or browser
 * dependencies; adapters only need to implement the two tiny target shapes.
 */
export class OverlayCoordinator {
  private readonly overlays: ActiveOverlay[] = [];
  private readonly leases = new Map<OverlayLease, ActiveOverlay>();
  private readonly guardRegistry = new RefCountedLeaseRegistry<OverlayGuardTarget>();
  private readonly domRegistry = new RefCountedLeaseRegistry<OverlayDomHandle>();
  private nextOverlayId = 1;
  private destroyed = false;

  open(registration: OverlayRegistration = {}): OverlayLease {
    if (this.destroyed) throw new Error('OverlayCoordinator is destroyed');
    const guardTargets = [...new Set(registration.guardTargets ?? [])];
    const domHandles = [...new Set(registration.domHandles ?? [])];
    const mandatory = registration.mandatory ?? false;
    const dismissible = !mandatory && (registration.dismissible ?? true);
    const guardLease = this.guardRegistry.acquire(guardTargets, (target) => target.disable());
    const domLease = this.domRegistry.acquire(domHandles, (handle) => handle.suppress());
    const id = this.nextOverlayId;
    this.nextOverlayId += 1;

    const entry: ActiveOverlay = {
      lease: undefined as unknown as OverlayLease,
      registration,
      guardTargets,
      domHandles,
      mandatory,
      dismissible,
      invoker: registration.invoker,
      focus: registration.focus,
      active: true,
    };
    const lease: OverlayLease = {
      id,
      registration,
      close: () => this.close(lease),
    };
    entry.lease = lease;
    // The resource leases live on the entry through non-enumerable local maps
    // so callers only see the stable public overlay lease shape.
    Object.defineProperty(entry, 'guardLease', { value: guardLease });
    Object.defineProperty(entry, 'domLease', { value: domLease });
    this.overlays.push(entry);
    this.leases.set(lease, entry);
    return lease;
  }

  close(lease: OverlayLease): boolean {
    const entry = this.leases.get(lease);
    if (!entry || !entry.active) return false;
    entry.active = false;
    this.leases.delete(lease);
    const index = this.overlays.indexOf(entry);
    if (index >= 0) this.overlays.splice(index, 1);
    const resourceEntry = entry as ActiveOverlay & {
      guardLease: ResourceLease<OverlayGuardTarget>;
      domLease: ResourceLease<OverlayDomHandle>;
    };
    this.guardRegistry.release(resourceEntry.guardLease, (target) => target.enable());
    this.domRegistry.release(resourceEntry.domLease, (handle) => handle.restore());
    return true;
  }

  /** The active topmost overlay, or null when the board owns input. */
  currentTop(): ActiveOverlay | null {
    return this.overlays.length > 0 ? this.overlays[this.overlays.length - 1] : null;
  }

  get top(): ActiveOverlay | null {
    return this.currentTop();
  }

  /** True for any active overlay, or for a particular guarded/suppressed target. */
  isBlocked(target?: OverlayGuardTarget | OverlayDomHandle): boolean {
    if (target === undefined) return this.overlays.length > 0;
    return this.guardRegistry.has(target as OverlayGuardTarget) || this.domRegistry.has(target as OverlayDomHandle);
  }

  /** Resolve and, when allowed, close exactly one topmost overlay. */
  dispatchEsc(): EscDispatchResult {
    const resolution = resolveEsc(this.overlays);
    if (!resolution.overlay) return { consumed: false, closed: false, overlay: null };
    if (!resolution.dismissible) {
      return { consumed: true, closed: false, overlay: resolution.overlay };
    }
    const overlay = resolution.overlay;
    const closed = this.close(overlay.lease);
    overlay.registration.onDismiss?.();
    return { consumed: true, closed, overlay };
  }

  /** Release all resources during scene shutdown without invoking UI callbacks. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const overlay of [...this.overlays].reverse()) this.close(overlay.lease);
    this.overlays.length = 0;
    this.leases.clear();
  }
}
