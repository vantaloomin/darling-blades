import { describe, expect, it } from 'vitest';
import {
  claimTabSession,
  type TabGuardChannel,
  type TabGuardMessage,
  type TabLockAdapter,
} from '../../src/platform/tabGuard';

const immediately = async (): Promise<void> => undefined;

function sessionOptions(overrides: Partial<Parameters<typeof claimTabSession>[0]> = {}) {
  return {
    createId: () => 'test-tab',
    wait: immediately,
    ...overrides,
  };
}

class FakeWebLocks implements TabLockAdapter {
  held = false;
  calls = 0;

  async acquireIfAvailable(_lockName: string, hold: Promise<void>): Promise<boolean> {
    this.calls += 1;
    if (this.held) return false;
    this.held = true;
    void hold.then(() => {
      this.held = false;
    });
    return true;
  }
}

class ChannelHub {
  private readonly channels = new Set<FakeChannel>();

  createChannel = (): TabGuardChannel => {
    const channel = new FakeChannel(this);
    this.channels.add(channel);
    return channel;
  };

  broadcast(sender: FakeChannel, message: TabGuardMessage): void {
    for (const channel of this.channels) {
      if (channel !== sender) channel.receive(message);
    }
  }

  remove(channel: FakeChannel): void {
    this.channels.delete(channel);
  }
}

class FakeChannel implements TabGuardChannel {
  private listener: ((message: TabGuardMessage) => void) | undefined;

  constructor(private readonly hub: ChannelHub) {}

  post(message: TabGuardMessage): void {
    this.hub.broadcast(this, message);
  }

  listen(listener: (message: TabGuardMessage) => void): () => void {
    this.listener = listener;
    return () => {
      if (this.listener === listener) this.listener = undefined;
    };
  }

  close(): void {
    this.listener = undefined;
    this.hub.remove(this);
  }

  receive(message: TabGuardMessage): void {
    this.listener?.(message);
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('tab session guard', () => {
  it('holds the Web Lock until the owning tab releases it', async () => {
    const locks = new FakeWebLocks();

    const first = await claimTabSession(sessionOptions({ locks }));
    const laterTab = await claimTabSession(sessionOptions({ locks }));

    expect(first).toMatchObject({ acquired: true, mechanism: 'web-lock' });
    expect(laterTab.acquired).toBe(false);

    first.release();
    await Promise.resolve();

    expect((await claimTabSession(sessionOptions({ locks }))).acquired).toBe(true);
  });

  it('does not fall through to the channel when a held Web Lock rejects a later tab', async () => {
    const locks: TabLockAdapter = { acquireIfAvailable: async () => false };
    let openedChannel = false;

    const result = await claimTabSession(sessionOptions({
      locks,
      createChannel: () => {
        openedChannel = true;
        throw new Error('fallback must not run');
      },
    }));

    expect(result.acquired).toBe(false);
    expect(openedChannel).toBe(false);
  });

  it('uses an existing BroadcastChannel owner when Web Locks are unavailable', async () => {
    const hub = new ChannelHub();

    const first = await claimTabSession(sessionOptions({
      createChannel: hub.createChannel,
      createId: () => 'first',
    }));
    const laterTab = await claimTabSession(sessionOptions({
      createChannel: hub.createChannel,
      createId: () => 'later',
    }));

    expect(first).toMatchObject({ acquired: true, mechanism: 'broadcast-channel' });
    expect(laterTab.acquired).toBe(false);
  });

  it('elects one fallback owner when tabs open together', async () => {
    const hub = new ChannelHub();
    const window = deferred();

    const first = claimTabSession(sessionOptions({
      createChannel: hub.createChannel,
      createId: () => 'alpha',
      wait: () => window.promise,
    }));
    const second = claimTabSession(sessionOptions({
      createChannel: hub.createChannel,
      createId: () => 'beta',
      wait: () => window.promise,
    }));

    window.resolve();
    const [alpha, beta] = await Promise.all([first, second]);

    expect(alpha).toMatchObject({ acquired: true, mechanism: 'broadcast-channel' });
    expect(beta.acquired).toBe(false);
  });

  it('lets a fallback retry claim the session after its owner disappears', async () => {
    const hub = new ChannelHub();
    const first = await claimTabSession(sessionOptions({
      createChannel: hub.createChannel,
      createId: () => 'first',
    }));
    first.release();

    const retry = await claimTabSession(sessionOptions({
      createChannel: hub.createChannel,
      createId: () => 'retry',
    }));

    expect(retry).toMatchObject({ acquired: true, mechanism: 'broadcast-channel' });
  });
});
