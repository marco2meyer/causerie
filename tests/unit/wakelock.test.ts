import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepAwake } from '../../src/lib/wakelock';

/* A call is five to ten minutes with nothing to touch, and a phone locks well inside that.
 * The lock that prevents it is released by the browser EVERY time the document goes hidden,
 * so the visibility listener is the feature rather than a refinement: a request-once version
 * passes every test and then dies the first time somebody glances at a notification. And
 * because the request can simply be refused — low battery, an old browser, an installed iOS
 * PWA before 18.4 — none of this may ever be able to break a call. */

class FakeSentinel {
  released = false;
  listeners: (() => void)[] = [];
  addEventListener(_type: string, fn: () => void): void { this.listeners.push(fn); }
  async release(): Promise<void> { this.released = true; this.listeners.forEach(f => f()); }
  /** What the browser does on its own: a hidden document loses its lock. */
  browserReleases(): void { void this.release(); }
}

class FakeWakeLock {
  granted: FakeSentinel[] = [];
  requests = 0;
  /** Set to make the next request fail the way a low battery does. */
  refuse = false;
  /** Set to hold the request open, so the caller can be torn down mid-flight. */
  hang: ((s: FakeSentinel) => void) | null = null;

  async request(type: string): Promise<FakeSentinel> {
    this.requests++;
    if (type !== 'screen') throw new Error('unsupported type');
    if (this.refuse) throw new Error('NotAllowedError');
    const s = new FakeSentinel();
    this.granted.push(s);
    if (this.hang) {
      const gate = this.hang;
      return new Promise<FakeSentinel>(res => gate(Object.assign(s, { resolve: () => res(s) }) as FakeSentinel));
    }
    return s;
  }

  /** The one lock currently held, if any. */
  live(): FakeSentinel | undefined { return this.granted.find(s => !s.released); }
}

let wl: FakeWakeLock;
let visibility: 'visible' | 'hidden';
let visListeners: (() => void)[];

/** Drives the page between foreground and background the way a phone does. */
const setVisibility = (v: 'visible' | 'hidden') => {
  visibility = v;
  visListeners.forEach(f => f());
};

const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  wl = new FakeWakeLock();
  visibility = 'visible';
  visListeners = [];
  vi.stubGlobal('navigator', { wakeLock: wl });
  vi.stubGlobal('document', {
    get visibilityState() { return visibility; },
    addEventListener: (t: string, fn: () => void) => { if (t === 'visibilitychange') visListeners.push(fn); },
    removeEventListener: (t: string, fn: () => void) => {
      if (t === 'visibilitychange') visListeners = visListeners.filter(f => f !== fn);
    }
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('keeping the screen awake', () => {
  it('takes the lock as soon as the screen opens', async () => {
    const stop = keepAwake();
    await flush();
    expect(wl.requests).toBe(1);
    expect(wl.live()).toBeDefined();
    stop();
  });

  it('gives it back when the screen closes', async () => {
    const stop = keepAwake();
    await flush();
    const s = wl.live()!;
    stop();
    await flush();
    expect(s.released).toBe(true);
    expect(wl.live()).toBeUndefined();
  });

  it('takes it again every time the phone comes back', async () => {
    // The whole point. The browser releases on hidden whatever we do, so a lock held once
    // is a lock held until the first notification and never again.
    const stop = keepAwake();
    await flush();
    const first = wl.live()!;

    setVisibility('hidden');
    await flush();
    expect(first.released).toBe(true);

    setVisibility('visible');
    await flush();
    const second = wl.live();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    stop();
  });

  it('survives the browser dropping the lock by itself', async () => {
    const stop = keepAwake();
    await flush();
    wl.live()!.browserReleases();       // battery saver kicked in, say
    await flush();

    // Nothing is held, and the next time the page is looked at it asks again rather than
    // believing it still has one.
    expect(wl.live()).toBeUndefined();
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(wl.live()).toBeDefined();
    stop();
  });

  it('never asks twice while it already holds one', async () => {
    const stop = keepAwake();
    await flush();
    setVisibility('visible');           // some browsers fire this without a real change
    setVisibility('visible');
    await flush();
    expect(wl.requests).toBe(1);
    stop();
  });

  it('does not ask for one the page could not be given', async () => {
    visibility = 'hidden';
    const stop = keepAwake();
    await flush();
    expect(wl.requests).toBe(0);
    stop();
  });

  it('lets go of a lock that arrives after the screen has closed', async () => {
    // The request is asynchronous: hanging up in the middle of it must not leave the
    // phone awake for a call that is over.
    let open!: () => void;
    wl.hang = s => { open = () => (s as FakeSentinel & { resolve(): void }).resolve(); };
    const stop = keepAwake();
    await flush();
    stop();
    open();
    await flush();
    expect(wl.live()).toBeUndefined();
  });

  it('lets go of one that arrives after the page was backgrounded', async () => {
    let open!: () => void;
    wl.hang = s => { open = () => (s as FakeSentinel & { resolve(): void }).resolve(); };
    const stop = keepAwake();
    await flush();
    setVisibility('hidden');
    open();
    await flush();
    expect(wl.live()).toBeUndefined();
    stop();
  });

  it('stops listening once released', async () => {
    const stop = keepAwake();
    await flush();
    stop();
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(wl.live()).toBeUndefined();
    expect(visListeners.length).toBe(0);
  });
});

describe('when the phone will not play along', () => {
  it('shrugs off a refused request', async () => {
    wl.refuse = true;
    const stop = keepAwake();
    await flush();
    expect(wl.live()).toBeUndefined();
    expect(() => stop()).not.toThrow();
  });

  it('asks again next time rather than giving up for good', async () => {
    // Refused at 3% battery, plugged in at the next attempt.
    wl.refuse = true;
    const stop = keepAwake();
    await flush();
    wl.refuse = false;
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(wl.live()).toBeDefined();
    stop();
  });

  it('does nothing at all where the API is missing', async () => {
    // Every browser before 2023, and an installed iOS PWA before 18.4.
    vi.stubGlobal('navigator', {});
    const stop = keepAwake();
    await flush();
    expect(() => stop()).not.toThrow();
  });

  it('does nothing at all where there is no navigator', async () => {
    vi.stubGlobal('navigator', undefined);
    const stop = keepAwake();
    await flush();
    expect(() => stop()).not.toThrow();
  });
});
