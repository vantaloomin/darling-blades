import { theme } from '../ui/theme';

/** A single origin-wide game session protects the shared local save. */
export const TAB_SESSION_LOCK_NAME = 'darlingblades.game-session.v1';

const FALLBACK_CLAIM_WINDOW_MS = 160;
const TAB_GUARD_ID = 'darlingblades-tab-guard';

export type TabSessionMechanism = 'web-lock' | 'broadcast-channel';

export interface TabSession {
  readonly acquired: boolean;
  readonly mechanism?: TabSessionMechanism;
  release(): void;
}

/**
 * Small adapter boundary so the ownership decision stays testable without a
 * browser. A successful implementation starts holding `hold`, but resolves
 * its return value as soon as the lock has been granted.
 */
export interface TabLockAdapter {
  acquireIfAvailable(lockName: string, hold: Promise<void>): Promise<boolean>;
}

export type TabGuardMessage =
  | { type: 'claim'; ownerId: string }
  | { type: 'candidate'; ownerId: string; targetId: string }
  | { type: 'owner'; ownerId: string; targetId: string };

export interface TabGuardChannel {
  post(message: TabGuardMessage): void;
  listen(listener: (message: TabGuardMessage) => void): () => void;
  close(): void;
}

export interface TabSessionAdapters {
  /** Present only when the browser exposes the Web Locks API. */
  locks?: TabLockAdapter;
  /** Present only when the BroadcastChannel fallback can be opened. */
  createChannel?: () => TabGuardChannel | undefined;
  createId(): string;
  wait(ms: number): Promise<void>;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function acquired(mechanism: TabSessionMechanism, release: () => void): TabSession {
  let released = false;
  return {
    acquired: true,
    mechanism,
    release: () => {
      if (released) return;
      released = true;
      release();
    },
  };
}

function blocked(): TabSession {
  return { acquired: false, release: () => undefined };
}

async function claimBroadcastSession(
  channel: TabGuardChannel,
  createId: () => string,
  wait: (ms: number) => Promise<void>,
): Promise<TabSession> {
  const ownerId = createId();
  const contenders = new Set<string>();
  let establishedOwner = false;
  let hasExistingOwner = false;

  const unsubscribe = channel.listen((message) => {
    if (message.type === 'claim') {
      if (message.ownerId === ownerId) return;
      if (establishedOwner) {
        channel.post({ type: 'owner', ownerId, targetId: message.ownerId });
      } else {
        contenders.add(message.ownerId);
        // BroadcastChannel does not replay an earlier claim to a tab that
        // joined later. Echo our candidacy directly so that tab joins the same
        // election instead of briefly considering itself the only contender.
        channel.post({ type: 'candidate', ownerId, targetId: message.ownerId });
      }
      return;
    }
    if (message.type === 'candidate' && message.targetId === ownerId) {
      contenders.add(message.ownerId);
      return;
    }
    if (message.type === 'owner' && message.targetId === ownerId) {
      hasExistingOwner = true;
    }
  });

  channel.post({ type: 'claim', ownerId });
  await wait(FALLBACK_CLAIM_WINDOW_MS);

  const electedOwner = [ownerId, ...contenders].sort()[0];
  if (hasExistingOwner || electedOwner !== ownerId) {
    unsubscribe();
    channel.close();
    return blocked();
  }

  establishedOwner = true;
  return acquired('broadcast-channel', () => {
    unsubscribe();
    channel.close();
  });
}

/**
 * Claims the session before any save or Phaser module is loaded. Web Locks is
 * authoritative whenever available. BroadcastChannel provides the fallback:
 * owners answer new claims, competing new tabs elect one owner, and a crashed
 * owner cannot leave a stale lease behind because its channel closes with it.
 */
export async function claimTabSession(adapters: TabSessionAdapters): Promise<TabSession> {
  if (adapters.locks) {
    const hold = deferred();
    try {
      if (await adapters.locks.acquireIfAvailable(TAB_SESSION_LOCK_NAME, hold.promise)) {
        return acquired('web-lock', hold.resolve);
      }
    } catch {
      // A present Web Locks API that fails closed must not start a second game.
    }
    return blocked();
  }

  const channel = adapters.createChannel?.();
  if (!channel) return blocked();
  return claimBroadcastSession(channel, adapters.createId, adapters.wait);
}

function browserLockAdapter(): TabLockAdapter | undefined {
  if (typeof navigator === 'undefined' || !navigator.locks) return undefined;
  return {
    acquireIfAvailable: (lockName, hold) =>
      new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (value: boolean): void => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        void navigator.locks
          .request(lockName, { ifAvailable: true }, async (lock) => {
            settle(lock !== null);
            if (lock) await hold;
          })
          .catch(() => settle(false));
      }),
  };
}

function browserChannel(): TabGuardChannel | undefined {
  if (typeof BroadcastChannel === 'undefined') return undefined;
  try {
    const channel = new BroadcastChannel(TAB_SESSION_LOCK_NAME);
    return {
      post: (message) => channel.postMessage(message),
      listen: (listener) => {
        const onMessage = (event: MessageEvent<TabGuardMessage>): void => listener(event.data);
        channel.addEventListener('message', onMessage);
        return () => channel.removeEventListener('message', onMessage);
      },
      close: () => channel.close(),
    };
  } catch {
    return undefined;
  }
}

function browserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Browser entry point. No save-facing module is imported before this resolves. */
export function claimBrowserTabSession(): Promise<TabSession> {
  return claimTabSession({
    locks: browserLockAdapter(),
    createChannel: browserChannel,
    createId: browserId,
    wait: (ms) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
  });
}

/** Removes the guard after a successful quiet retry. */
export function removeTabGuard(): void {
  document.getElementById(TAB_GUARD_ID)?.remove();
}

/**
 * Plain DOM is deliberate: a guarded tab should not load Phaser assets or
 * instantiate the save-backed services merely to display this message.
 */
export function showTabGuard(onRetry: () => Promise<boolean>): void {
  if (document.getElementById(TAB_GUARD_ID)) return;

  const root = document.createElement('main');
  root.id = TAB_GUARD_ID;
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', `${TAB_GUARD_ID}-title`);
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '1100',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '24px',
    background: theme.colors.dim,
    color: theme.colors.body,
    fontFamily: theme.fonts.ui,
    textAlign: 'center',
  });

  const panel = document.createElement('section');
  Object.assign(panel.style, {
    width: 'min(440px, 100%)',
    boxSizing: 'border-box',
    padding: '36px 32px',
    border: `${theme.control.borderWidth}px solid ${theme.colors.panelStroke}`,
    borderRadius: `${theme.radius.panel}px`,
    background: theme.colors.panelFill,
    boxShadow: `0 18px 60px ${theme.colors.dim}`,
  });

  const title = document.createElement('h1');
  title.id = `${TAB_GUARD_ID}-title`;
  title.textContent = 'Already open';
  Object.assign(title.style, {
    margin: '0 0 16px',
    color: theme.colors.heading,
    fontFamily: theme.fonts.display,
    fontSize: `${theme.type.display}px`,
    fontWeight: theme.weight.w700,
    lineHeight: '1.1',
  });

  const body = document.createElement('p');
  body.textContent = 'Darling Blades is running in another tab or window. Play continues there; close it and try again here.';
  Object.assign(body.style, {
    margin: '0 auto 28px',
    maxWidth: '360px',
    color: theme.colors.body,
    fontSize: `${theme.type.body}px`,
    lineHeight: '1.5',
  });

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Try again';
  Object.assign(retry.style, {
    minWidth: '132px',
    minHeight: `${theme.control.minHitHeight}px`,
    padding: '0 20px',
    border: `${theme.control.borderWidth}px solid ${theme.colors.goldHover}`,
    borderRadius: `${theme.radius.control}px`,
    background: theme.colors.btnPrimaryBg,
    color: theme.colors.onGold,
    cursor: 'pointer',
    fontFamily: theme.fonts.ui,
    fontSize: `${theme.type.label}px`,
    fontWeight: theme.weight.w700,
  });
  retry.addEventListener('focus', () => {
    retry.style.outline = `2px solid ${theme.colors.goldHover}`;
    retry.style.outlineOffset = '3px';
  });
  retry.addEventListener('blur', () => {
    retry.style.outline = 'none';
  });
  retry.addEventListener('click', () => {
    retry.disabled = true;
    void onRetry().then((started) => {
      if (!started) retry.disabled = false;
    }, () => {
      retry.disabled = false;
    });
  });

  panel.append(title, body, retry);
  root.append(panel);
  document.body.append(root);
}
