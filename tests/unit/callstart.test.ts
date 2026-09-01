import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeCall } from '../../src/lib/realtime';
import { seedMem } from '../../src/lib/seed';

/* The start of a call used to be muffled: the greeting was asked for the moment the session
 * config was acknowledged, which can be before the speaker path is rendering anything. The
 * browser reports playback as running only after the output device and the jitter buffer have
 * spun up, and whatever is handed over inside that window is simply not heard — which is how
 * "Bonjour Marco" reached the student as "…arco". The greeting now waits for the speaker. */

const sess = { topic: 'x', targets: [] };

class FakeTrack {
  enabled = true;
  stop(): void { /* noop */ }
}

class FakeStream {
  tracks = [new FakeTrack()];
  getAudioTracks() { return this.tracks; }
  getTracks() { return this.tracks; }
}

class FakeAudio {
  static last: FakeAudio | null = null;
  style: Record<string, string> = {};
  autoplay = false;
  srcObject: unknown = null;
  onplaying: (() => void) | null = null;
  plays = 0;
  /** Left pending on purpose: the playing event is the signal these tests drive. */
  play(): Promise<void> { this.plays++; return new Promise<void>(() => { /* pending */ }); }
  remove(): void { /* never mounted in node */ }
  constructor() { FakeAudio.last = this; }
}

class FakeChannel {
  readyState = 'connecting';
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  send(m: string): void { this.sent.push(m); }
  close(): void { /* noop */ }
}

class FakePC {
  static last: FakePC | null = null;
  connectionState = 'new';
  dc: FakeChannel | null = null;
  ontrack: ((e: { streams: FakeStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor() { FakePC.last = this; }
  addTrack(): void { /* noop */ }
  createDataChannel(): FakeChannel { this.dc = new FakeChannel(); return this.dc; }
  async createOffer() { return { type: 'offer', sdp: 'v=0 offer' }; }
  async setLocalDescription(): Promise<void> { /* noop */ }
  async setRemoteDescription(): Promise<void> { /* noop */ }
  close(): void { /* noop */ }
}

class FakeAudioContext {
  state = 'running';
  createMediaStreamSource() { return { connect: () => { /* noop */ } }; }
  createAnalyser() {
    return {
      fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 16,
      getByteFrequencyData: () => { /* noop */ }
    };
  }
  close(): Promise<void> { return Promise.resolve(); }
}

beforeEach(() => {
  vi.useFakeTimers();
  // stubGlobal, not assignment: `navigator` is getter-only on the node global.
  vi.stubGlobal('window', { AudioContext: FakeAudioContext });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => new FakeStream() } });
  vi.stubGlobal('localStorage', { getItem: () => 'sk-test', setItem: () => { /* noop */ } });
  vi.stubGlobal('RTCPeerConnection', FakePC);
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, text: async () => 'v=0 answer' }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Brings a call up to the point where the session config has been acknowledged. */
async function connected(withTrack = true) {
  const call = new RealtimeCall(seedMem('Marco'), sess, {});
  await call.start();
  const pc = FakePC.last!;
  if (withTrack) pc.ontrack!({ streams: [new FakeStream()] });
  const dc = pc.dc!;
  dc.readyState = 'open';
  dc.onopen!();
  dc.onmessage!({ data: JSON.stringify({ type: 'session.updated' }) });
  return { call, dc, el: FakeAudio.last! };
}

const greeted = (dc: FakeChannel) => dc.sent.some(m => JSON.parse(m).type === 'response.create');

describe('the greeting waits for the speaker', () => {
  it('holds it back until playback has started and warmed up', async () => {
    const { dc, el } = await connected();
    // Config acknowledged, but the output is not rendering yet: nothing spoken into it.
    expect(el.srcObject).not.toBeNull();
    expect(el.plays).toBe(1);
    expect(greeted(dc)).toBe(false);

    el.onplaying!();
    expect(greeted(dc)).toBe(false);            // still inside the warm-up
    vi.advanceTimersByTime(RealtimeCall.WARMUP_MS);
    expect(greeted(dc)).toBe(true);

    // …and the briefing is re-sent immediately before it, as it always was.
    const types = dc.sent.map(m => JSON.parse(m).type);
    expect(types.filter(t => t === 'session.update').length).toBe(2);
    expect(types.indexOf('conversation.item.create')).toBeLessThan(types.indexOf('response.create'));
  });

  it('goes out anyway when playback never reports itself', async () => {
    // Autoplay refused, or a browser that fires no event: a first word at risk beats a
    // call that sits in "configuring" forever.
    const { dc } = await connected();
    vi.advanceTimersByTime(RealtimeCall.AUDIO_WAIT_MS);
    expect(greeted(dc)).toBe(true);
  });

  it('costs nothing when the speaker is up before the config ack', async () => {
    // The usual case: the track attaches during connect, so the warm-up is long over by
    // the time the ack lands and the greeting goes out on it.
    const call = new RealtimeCall(seedMem('Marco'), sess, {});
    await call.start();
    const pc = FakePC.last!;
    pc.ontrack!({ streams: [new FakeStream()] });
    FakeAudio.last!.onplaying!();
    vi.advanceTimersByTime(RealtimeCall.WARMUP_MS);
    const dc = pc.dc!;
    dc.readyState = 'open';
    dc.onopen!();
    expect(greeted(dc)).toBe(false);            // no ack yet
    dc.onmessage!({ data: JSON.stringify({ type: 'session.updated' }) });
    expect(greeted(dc)).toBe(true);             // and no extra wait on top of it
  });

  it('only ever greets once', async () => {
    const { dc, el } = await connected();
    el.onplaying!();
    el.onplaying!();                            // both signals can fire, and can repeat
    vi.advanceTimersByTime(RealtimeCall.AUDIO_WAIT_MS + RealtimeCall.WARMUP_MS);
    dc.onmessage!({ data: JSON.stringify({ type: 'session.updated' }) });
    expect(dc.sent.filter(m => JSON.parse(m).type === 'response.create').length).toBe(1);
  });
});
