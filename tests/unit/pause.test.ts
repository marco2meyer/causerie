import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearHeld, holdable, holdTimers, releaseTimers, RealtimeCall } from '../../src/lib/realtime';
import { TurnCall } from '../../src/lib/turncall';
import { seedMem } from '../../src/lib/seed';
import { PACKS } from '../../src/lang';

/* The pause button. A call is three to five minutes long and it is measured: the timer on
 * screen, the minutes the format allows, the one-minute warning, the per-minute legs of the
 * ledger. All four are measured in CONVERSATION time, and a doorbell is not conversation —
 * so pausing has to stop every one of them at once, close the mic, and tell Odile to hold
 * rather than leave her talking into an empty room. */

const sess = { topic: 'le marché', targets: [], minutes: 4 };

/* ------------------------------ held timeouts ------------------------------ */

describe('timeouts that survive a pause', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not run down while it is held', () => {
    let fired = 0;
    const t = holdable(1000, () => fired++);
    vi.advanceTimersByTime(400);
    holdTimers([t]);
    vi.advanceTimersByTime(60_000);          // a whole minute away from the phone
    expect(fired).toBe(0);
    releaseTimers([t]);
    vi.advanceTimersByTime(599);
    expect(fired).toBe(0);                   // exactly what was left, not a millisecond less
    vi.advanceTimersByTime(1);
    expect(fired).toBe(1);
  });

  it('never re-arms one that has already gone off', () => {
    let fired = 0;
    const t = holdable(100, () => fired++);
    vi.advanceTimersByTime(100);
    expect(fired).toBe(1);
    holdTimers([t]);
    releaseTimers([t]);
    vi.advanceTimersByTime(60_000);
    expect(fired).toBe(1);
  });

  it('leaves a cleared one dead even if the call is resumed afterwards', () => {
    let fired = 0;
    const t = holdable(100, () => fired++);
    clearHeld([t]);
    releaseTimers([t]);
    vi.advanceTimersByTime(60_000);
    expect(fired).toBe(0);
  });

  it('ignores a release nobody held', () => {
    let fired = 0;
    const t = holdable(100, () => fired++);
    releaseTimers([t]);                      // must not stack a second timeout on it
    vi.advanceTimersByTime(60_000);
    expect(fired).toBe(1);
  });
});

/* ------------------------------ the stage notes ------------------------------ */

describe('what Odile is told', () => {
  it('holds her without hanging up, in every language', () => {
    for (const p of Object.values(PACKS)) {
      const n = p.tutor.notes;
      expect(n.paused, `${p.code}`).not.toContain('end_call');
      expect(n.paused.length, `${p.code}`).toBeGreaterThan(20);
      // Coming back is one short line picked up mid-thread, not a fresh greeting.
      expect(n.resumed, `${p.code}`).not.toBe(n.paused);
      expect(n.resumed, `${p.code}`).not.toContain('end_call');
    }
  });
});

/* ------------------------------ the realtime engine ------------------------------ */

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
  play(): Promise<void> { return new Promise<void>(() => { /* pending */ }); }
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
      getByteFrequencyData: () => { /* noop */ },
      getByteTimeDomainData: () => { /* noop */ },
      connect: () => { /* noop */ }
    };
  }
  close(): Promise<void> { return Promise.resolve(); }
}

const last = <T,>(xs: T[]): T | undefined => xs[xs.length - 1];

/** The stage directions that went out on the data channel, in order. */
const notesSent = (dc: FakeChannel): string[] =>
  dc.sent
    .map(m => JSON.parse(m))
    .filter(m => m.type === 'conversation.item.create' && m.item?.role === 'system')
    .map(m => m.item.content[0].text as string);

describe('pausing a realtime call', () => {
  let mic: FakeStream;

  beforeEach(() => {
    vi.useFakeTimers();
    mic = new FakeStream();
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => mic } });
    vi.stubGlobal('localStorage', { getItem: () => 'sk-test', setItem: () => { /* noop */ } });
    vi.stubGlobal('RTCPeerConnection', FakePC);
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, text: async () => 'v=0 answer' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Brings a call all the way up: config acknowledged, speaker warm, greeting out, live. */
  async function live() {
    const call = new RealtimeCall(seedMem('Marco'), sess, {});
    await call.start();
    const pc = FakePC.last!;
    pc.ontrack!({ streams: [new FakeStream()] });
    const dc = pc.dc!;
    dc.readyState = 'open';
    dc.onopen!();
    FakeAudio.last!.onplaying!();
    vi.advanceTimersByTime(RealtimeCall.WARMUP_MS);
    dc.onmessage!({ data: JSON.stringify({ type: 'session.updated' }) });
    return { call, dc };
  }

  const micOn = () => mic.tracks[0].enabled;

  it('closes the mic and tells her to wait, then hands the conversation back', async () => {
    const { call, dc } = await live();
    expect(micOn()).toBe(true);

    call.setPaused(true);
    expect(micOn()).toBe(false);
    expect(last(notesSent(dc))).toBe(PACKS.fr.tutor.notes.paused);
    // Nothing is asked of her: she finishes her sentence and stops there.
    expect(JSON.parse(last(dc.sent)!).type).toBe('conversation.item.create');

    call.setPaused(false);
    expect(micOn()).toBe(true);
    expect(last(notesSent(dc))).toBe(PACKS.fr.tutor.notes.resumed);
    // …and coming back does ask for a line, or the student would be met with silence.
    expect(JSON.parse(last(dc.sent)!).type).toBe('response.create');
    call.stop();
  });

  it('takes the paused minutes out of the call', async () => {
    const { call } = await live();
    vi.advanceTimersByTime(30_000);
    expect(call.seconds()).toBeCloseTo(30, 1);

    call.setPaused(true);
    vi.advanceTimersByTime(120_000);          // two minutes at the front door
    expect(call.seconds()).toBeCloseTo(30, 1);

    call.setPaused(false);
    vi.advanceTimersByTime(10_000);
    expect(call.seconds()).toBeCloseTo(40, 1);
    call.stop();
  });

  it('pushes the wrap-up warnings back by exactly the pause', async () => {
    const { call, dc } = await live();
    const notes = PACKS.fr.tutor.notes;
    vi.advanceTimersByTime(170_000);          // ten seconds short of the one-minute warning
    expect(notesSent(dc)).not.toContain(notes.oneMinute);

    call.setPaused(true);
    vi.advanceTimersByTime(600_000);          // ten minutes away: nothing may fire
    expect(notesSent(dc)).not.toContain(notes.oneMinute);
    expect(notesSent(dc)).not.toContain(notes.timeUp);

    call.setPaused(false);
    vi.advanceTimersByTime(10_000);
    expect(notesSent(dc)).toContain(notes.oneMinute);
    expect(notesSent(dc)).not.toContain(notes.timeUp);
    call.stop();
  });

  it('ignores a pause it is already in, and one after hang-up', async () => {
    const { call, dc } = await live();
    call.setPaused(true);
    const n = notesSent(dc).length;
    call.setPaused(true);
    expect(notesSent(dc).length).toBe(n);     // she is told once, not once per tap
    call.stop();
    call.setPaused(false);
    expect(notesSent(dc).length).toBe(n);
  });

  it('keeps the mic shut when a sheet is closed on a paused call', async () => {
    const { call, dc } = await live();
    call.setPaused(true);
    call.pauseForMaterial();
    call.resumeFromMaterial();
    expect(micOn()).toBe(false);
    // The sheet came and went inside the pause: she was told nothing either way, and
    // above all was not asked to start talking again.
    expect(last(notesSent(dc))).toBe(PACKS.fr.tutor.notes.paused);
    expect(JSON.parse(last(dc.sent)!).type).toBe('conversation.item.create');

    call.setPaused(false);
    expect(micOn()).toBe(true);
    call.stop();
  });
});

/* ------------------------------ the turn engine ------------------------------ */

describe('pausing a turn-by-turn call', () => {
  const engines: TurnCall[] = [];
  let mic: FakeStream;

  beforeEach(() => {
    mic = new FakeStream();
    vi.stubGlobal('window', { AudioContext: FakeAudioContext });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => mic } });
    vi.stubGlobal('localStorage', { getItem: () => 'sk-test', setItem: () => { /* noop */ } });
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  });

  afterEach(() => {
    engines.splice(0).forEach(c => c.stop());
    vi.unstubAllGlobals();
  });

  /** The engine, mic open and clock running, without the network round trip of a turn. */
  const started = async () => {
    const m = seedMem('Marco');
    m.settings.callEngine = 'turns';
    const call = new TurnCall(m, sess, {});
    engines.push(call);
    await call.start().catch(() => { /* the greeting has nowhere to go: not what is tested */ });
    return call;
  };

  it('kills the mic so the room is neither heard nor recorded', async () => {
    const call = await started();
    expect(mic.tracks[0].enabled).toBe(true);
    call.setPaused(true);
    expect(mic.tracks[0].enabled).toBe(false);
    call.setPaused(false);
    expect(mic.tracks[0].enabled).toBe(true);
  });

  it('leaves the mic shut when the pause is lifted on a muted call', async () => {
    const call = await started();
    call.mute(true);
    call.setPaused(true);
    call.setPaused(false);
    // Resuming answers the pause, not the mute button: that one is still pressed.
    expect(mic.tracks[0].enabled).toBe(false);
  });

  it('takes the paused seconds out of the call', async () => {
    const call = await started();
    call.setPaused(true);
    const held = call.seconds();
    await new Promise(r => setTimeout(r, 60));
    expect(call.seconds()).toBeCloseTo(held, 2);
    call.setPaused(false);
    await new Promise(r => setTimeout(r, 60));
    expect(call.seconds()).toBeGreaterThan(held);
  });
});
