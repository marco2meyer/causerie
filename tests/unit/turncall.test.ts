import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { capChunks, HANGUP_MARK, rmsOf, takeChunk, TurnCall, vadInit, vadStep } from '../../src/lib/turncall';
import { seedMem } from '../../src/lib/seed';
import type { RealtimeCallbacks } from '../../src/lib/realtime';
import type { Memory } from '../../src/types';

/* The turn-by-turn engine: transcribe, think, speak. It has to end up with the same things
 * the realtime engine hands the rest of the app — a transcript, word goals, a cost
 * breakdown — while paying the cheap rate for each piece, and it must never let the hangup
 * sentinel reach either the voice or the transcript. */

const sess = { topic: 'le marché', targets: [] };

/* ------------------------------ pure pieces ------------------------------ */

describe('speakable chunks', () => {
  it('sends the first sentence long enough to be worth a round trip', () => {
    const cut = takeChunk('Bonjour Marco, content de te revoir. Comment vas-tu aujourd’hui ?');
    expect(cut?.chunk).toBe('Bonjour Marco, content de te revoir.');
    expect(cut?.rest.trim()).toBe('Comment vas-tu aujourd’hui ?');
  });

  it('waits rather than speaking a fragment', () => {
    // "Ah." is a sentence, but stopping the stream for it would cost more time than the
    // rest of the line takes to arrive.
    expect(takeChunk('Ah. Bon')).toBeNull();
    expect(takeChunk('Une phrase encore incomplète sans aucune ponctuation finale')).toBeNull();
  });

  it('keeps a closing quote with the sentence it closes', () => {
    const cut = takeChunk('Elle a dit « je viendrai demain matin. » Et puis elle est partie.');
    expect(cut?.chunk.endsWith('»')).toBe(true);
  });

  it('splits a runaway line at a word boundary', () => {
    const long = 'mot '.repeat(200).trim();
    const parts = capChunks(long, 100);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every(p => p.length <= 100)).toBe(true);
    expect(parts.join(' ')).toBe(long);
  });
});

describe('endpointing', () => {
  const opts = { silenceMs: 2000, minSpeechMs: 350, maxTurnMs: 90_000 };
  const run = (frames: number[], o = opts) => {
    let st = vadInit();
    let commits = 0;
    for (const rms of frames) {
      const r = vadStep(st, rms, 50, o);
      st = r.st;
      if (r.commit) commits++;
    }
    return { st, commits };
  };

  it('ends the turn on the silence that follows speech', () => {
    // 1 s of speech, then the patience window of quiet.
    const { commits } = run([...Array(20).fill(0.3), ...Array(41).fill(0.001)]);
    expect(commits).toBeGreaterThan(0);
  });

  it('never ends a turn nobody has spoken in', () => {
    const { commits } = run(Array(200).fill(0.001));
    expect(commits).toBe(0);
  });

  it('holds through a pause shorter than the patience setting', () => {
    // Half a second of hunting for a word is not the end of a sentence.
    const { commits } = run([...Array(20).fill(0.3), ...Array(10).fill(0.001), ...Array(20).fill(0.3)]);
    expect(commits).toBe(0);
  });

  it('is more impatient when the patience setting is', () => {
    const frames = [...Array(20).fill(0.3), ...Array(16).fill(0.001)];
    expect(run(frames, { ...opts, silenceMs: 2000 }).commits).toBe(0);
    expect(run(frames, { ...opts, silenceMs: 700 }).commits).toBeGreaterThan(0);
  });

  it('answers a monologue that never pauses', () => {
    const { commits } = run(Array(40).fill(0.3), { ...opts, maxTurnMs: 1000 });
    expect(commits).toBeGreaterThan(0);
  });

  it('follows the room up rather than being swallowed by it', () => {
    // A loud room raises the floor, so ordinary noise stops reading as speech; the floor
    // rises slowly, which is what keeps the next quiet sentence audible.
    const noisy = run(Array(400).fill(0.05));
    expect(noisy.st.floor).toBeGreaterThan(vadInit().floor);
    expect(noisy.commits).toBe(0);
  });

  it('measures a waveform, not a byte average', () => {
    expect(rmsOf(new Uint8Array(64).fill(128))).toBe(0);            // silence sits at mid-scale
    expect(rmsOf(new Uint8Array(64).fill(255))).toBeGreaterThan(0.9);
  });
});

/* ------------------------------ a whole turn ------------------------------ */

class FakeTrack { enabled = true; stop(): void { /* noop */ } }

class FakeStream {
  tracks = [new FakeTrack()];
  getAudioTracks() { return this.tracks; }
  getTracks() { return this.tracks; }
}

/** Loud while `loud` is set, silent otherwise — the microphone the endpointing reads. */
const room = { loud: false };

/** One sentence put on the graph: when it was told to start, how long it runs, and — the
 *  thing the swallowed first word came down to — whether the context was actually awake. */
interface Scheduled { at: number; dur: number; whileSuspended: boolean }

const CLIP_S = 0.05;

class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  /** As a browser hands one over before it has been resumed. */
  state = 'suspended';
  resumes = 0;
  scheduled: Scheduled[] = [];
  destination = {};
  private t0 = Date.now();
  constructor() { FakeAudioContext.last = this; }
  get currentTime() { return (Date.now() - this.t0) / 1000; }
  /** Resuming takes a moment, as it does on a real device — which is the whole reason a
   *  fire-and-forget resume() was not enough. */
  async resume(): Promise<void> {
    this.resumes++;
    await new Promise(r => setTimeout(r, 120));
    this.state = 'running';
  }
  createMediaStreamSource() { return { connect: () => { /* noop */ } }; }
  createAnalyser() {
    return {
      fftSize: 1024, smoothingTimeConstant: 0, frequencyBinCount: 512,
      connect: () => { /* noop */ },
      getByteTimeDomainData: (b: Uint8Array) => b.fill(room.loud ? 220 : 128),
      getByteFrequencyData: (b: Uint8Array) => b.fill(0)
    };
  }
  createBufferSource() {
    const ctx = this;
    return {
      buffer: null as { duration: number } | null,
      onended: null as (() => void) | null,
      connect: () => { /* noop */ },
      start(at: number) {
        ctx.scheduled.push({ at, dur: this.buffer?.duration ?? 0, whileSuspended: ctx.state !== 'running' });
      },
      stop: () => { /* noop */ }
    };
  }
  decodeAudioData(_b: ArrayBuffer) { return Promise.resolve({ duration: CLIP_S } as AudioBuffer); }
  close(): Promise<void> { return Promise.resolve(); }
}

/** Only reached when there is no AudioContext at all. */
class FakeAudio {
  static played: string[] = [];
  style: Record<string, string> = {};
  src = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onpause: (() => void) | null = null;
  play(): Promise<void> {
    FakeAudio.played.push(this.src);
    setTimeout(() => this.onended?.(), 0);
    return Promise.resolve();
  }
  pause(): void { this.onpause?.(); }
  remove(): void { /* never mounted */ }
}

class FakeRecorder {
  static isTypeSupported() { return true; }
  state = 'recording';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_s: unknown, _o: unknown) { /* noop */ }
  start(): void { /* noop */ }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(8000)], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

/** One chat-completions SSE response, delivered in several chunks the way a real one is. */
function sseReply(text: string): Response {
  const enc = new TextEncoder();
  const lines = [
    ...text.split(/(?<=[.!?»])\s+/).map(p => 'data: ' + JSON.stringify({ choices: [{ delta: { content: p + ' ' } }] }) + '\n\n'),
    'data: ' + JSON.stringify({ choices: [], usage: { prompt_tokens: 1800, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 1600 } } }) + '\n\n',
    'data: [DONE]\n\n'
  ];
  let i = 0;
  return {
    ok: true, status: 200,
    headers: { get: () => 'text/event-stream' },
    body: { getReader: () => ({ read: async () => (i < lines.length ? { done: false, value: enc.encode(lines[i++]) } : { done: true, value: undefined }) }) }
  } as unknown as Response;
}

/** What the model says next, one entry per turn. */
let replies: string[] = [];
let heard: string[] = [];
const calls = { chat: 0, tts: 0, stt: 0 };

beforeEach(() => {
  room.loud = false;
  replies = [];
  heard = [];
  calls.chat = calls.tts = calls.stt = 0;
  FakeAudio.played = [];
  FakeAudioContext.last = null;
  vi.stubGlobal('window', { AudioContext: FakeAudioContext });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => new FakeStream() } });
  vi.stubGlobal('localStorage', { getItem: () => 'sk-test', setItem: () => { /* noop */ } });
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('URL', { createObjectURL: (b: Blob) => 'blob:' + b.size, revokeObjectURL: () => { /* noop */ } });
  vi.stubGlobal('fetch', async (url: string, init: { body?: string }) => {
    const u = String(url);
    if (u.includes('/chat/completions')) {
      calls.chat++;
      await sleep(12);
      const body = JSON.parse(init.body!) as { messages: { role: string; content: string }[] };
      heard = body.messages.filter(m => m.role === 'user').map(m => m.content);
      return sseReply(replies.shift() ?? 'Bonjour Marco. Comment vas-tu ?');
    }
    if (u.includes('/audio/speech')) {
      calls.tts++;
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(64) } as unknown as Response;
    }
    if (u.includes('/audio/transcriptions')) {
      calls.stt++;
      await sleep(12);                    // a round trip takes a moment; the stopwatch measures it
      return { ok: true, status: 200, json: async () => ({ text: 'je vais au marché hier' }) } as unknown as Response;
    }
    throw new Error('unexpected fetch ' + u);
  });
});

/** Every engine built here, stopped afterwards: a listening one keeps its endpointing
 *  interval running, and a failed assertion would otherwise let it commit a turn — and
 *  bill a transcription — inside the NEXT test. */
const live: TurnCall[] = [];
const engine = (m: Memory, cb: RealtimeCallbacks = {}): TurnCall => {
  const c = new TurnCall(m, sess, cb);
  live.push(c);
  return c;
};

afterEach(() => {
  live.splice(0).forEach(c => c.stop());
  vi.unstubAllGlobals();
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Waits for a condition rather than for a fixed number of milliseconds: a whole turn is
 *  four awaited round trips, and how long that takes depends on what else is running. */
async function until(cond: () => boolean, ms = 4000): Promise<void> {
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < ms) await sleep(20);
}

const mem = (fn?: (m: Memory) => void): Memory => {
  const m = seedMem('Marco');
  m.settings.callEngine = 'turns';
  m.settings.eagerness = 'high';          // 700 ms of silence: the tests are not a wait
  fn?.(m);
  return m;
};

describe('a turn, end to end', () => {
  it('greets, speaks, and then listens', async () => {
    const phases: string[] = [];
    const call = engine(mem(), { onTurnPhase: p => phases.push(p) });
    await call.start();
    // She spoke before anyone said anything, exactly as the realtime kickoff does.
    expect(calls.chat).toBe(1);
    expect(FakeAudioContext.last!.scheduled.length).toBeGreaterThan(0);
    expect(call.transcript()[0].role).toBe('assistant');
    expect(phases).toContain('speaking');
    expect(phases[phases.length - 1]).toBe('listening');
  });

  it('never speaks into a context that is still asleep', async () => {
    // The bug this replaced: her audio was played off an <audio> element routed INTO the
    // graph, and an element's clock runs whether or not the graph is awake. A context still
    // spinning up — or one Safari had suspended between turns — ate the front of every clip
    // while the playhead marched on, so "Bonjour" arrived as "…jour".
    replies = ['Bonjour Marco. Comment vas-tu ?'];
    const call = engine(mem());
    await call.start();
    const ctx = FakeAudioContext.last!;
    expect(ctx.resumes).toBeGreaterThan(0);
    expect(ctx.scheduled.length).toBeGreaterThan(0);
    expect(ctx.scheduled.every(x => !x.whileSuspended)).toBe(true);
  });

  it('starts every clip a beat ahead of the clock, never on top of it', async () => {
    // Scheduling at `currentTime` asks the output device for a sample it is already past.
    replies = ['Bonjour Marco. Comment vas-tu ?'];
    const call = engine(mem());
    await call.start();
    expect(FakeAudioContext.last!.scheduled.every(x => x.at > 0)).toBe(true);
  });

  it('butts her sentences together so one answer is one piece of speech', async () => {
    replies = ['Bonjour Marco, content de te revoir. Comment vas-tu aujourd’hui ? Raconte-moi.'];
    const call = engine(mem());
    await call.start();
    const s = FakeAudioContext.last!.scheduled;
    expect(s.length).toBeGreaterThan(1);
    for (let i = 1; i < s.length; i++) {
      expect(s[i].at).toBeCloseTo(s[i - 1].at + s[i - 1].dur, 3);   // no seam, no overlap
    }
  });

  it('cuts her answer into sentences so the first one is spoken while the rest arrives', async () => {
    replies = ['Bonjour Marco, content de te revoir. Comment vas-tu aujourd’hui ?'];
    const call = engine(mem());
    await call.start();
    expect(calls.tts).toBe(2);
  });

  it('transcribes the student and hands the text to the model', async () => {
    const call = engine(mem());
    await call.start();
    room.loud = true;
    await sleep(500);                     // long enough for the endpointing to hear speech
    room.loud = false;
    call.commitTurn();
    await until(() => heard.includes('je vais au marché hier'));
    expect(calls.stt).toBe(1);
    expect(heard).toContain('je vais au marché hier');
    const roles = call.transcript().map(t => t.role);
    expect(roles).toContain('user');
  });

  it('spends nothing on a turn the student never spoke in', async () => {
    const call = engine(mem());
    await call.start();
    const chatAfterGreeting = calls.chat;
    call.commitTurn();                    // a stray tap, no speech behind it
    await sleep(200);
    expect(calls.stt).toBe(0);
    expect(calls.chat).toBe(chatAfterGreeting);
  });

  it('hangs up on the sentinel without ever speaking it', async () => {
    replies = ['Allez, à demain Marco. ' + HANGUP_MARK];
    let hungUp = false;
    const call = engine(mem(), { onHangup: () => { hungUp = true; } });
    await call.start();
    await sleep(50);
    expect(hungUp).toBe(true);
    const spoken = call.transcript().map(t => t.text).join(' ');
    expect(spoken).not.toContain('FIN');
  });

  it('gives the analysis the student’s own words without a second transcription', async () => {
    const call = engine(mem());
    await call.start();
    expect(await call.recording()).toBeNull();      // nothing left to re-transcribe
    room.loud = true;
    await sleep(500);
    room.loud = false;
    call.commitTurn();
    await until(() => call.verbatimText() !== null);
    expect(call.verbatimText()).toBe('je vais au marché hier');
  });

  it('bills the three legs it actually used, and no realtime tokens at all', async () => {
    const call = engine(mem());
    await call.start();
    room.loud = true;
    await sleep(500);
    room.loud = false;
    call.commitTurn();
    await until(() => call.costEntries().length === 3);
    const kinds = call.costEntries().map(l => l.kind).sort();
    expect(kinds).toEqual(['chat', 'stt', 'tts']);
    const chat = call.costEntries().find(l => l.kind === 'chat')!;
    expect(chat.model).toBe('gpt-5.6-terra');
    // The briefing is the same prefix on every turn: most of the input is cached, and a
    // ledger that missed that would read ten times the real price.
    expect(Number(chat.entry.cached_input_tokens)).toBeGreaterThan(0);
    expect(Object.values(call.usage()).every(v => v === 0)).toBe(true);
  });

  it('lets the button be the only way out when auto-commit is off', async () => {
    const call = engine(mem(m => (m.settings.turnCommit = 'button')));
    await call.start();
    room.loud = true;
    await sleep(400);
    room.loud = false;
    await sleep(900);                     // well past the 700 ms patience window
    expect(calls.stt).toBe(0);            // …and still nobody ended the turn
    call.commitTurn();
    await until(() => calls.stt > 0);
    expect(calls.stt).toBe(1);
  });

  it('opens her mouth on a short first clause instead of holding it for a sentence', async () => {
    // The student is sitting in silence waiting for the first word, so the first chunk of a
    // turn is measured against a much lower bar than everything after it.
    replies = ['Ah bon ? Raconte-moi ça, je veux savoir comment ça s’est passé hier soir.'];
    const call = engine(mem());
    await call.start();
    expect(calls.tts).toBeGreaterThan(1);
  });

  it('reports where the turn’s time actually went', async () => {
    // The point of the stopwatch is attributing the wait to a LEG — a slow model and a
    // two-second endpointing window feel identical from the sofa. So the stubs take a
    // measurable moment each, and the report has to put that time in the right place.
    const call = engine(mem());
    await call.start();
    room.loud = true;
    await sleep(500);
    room.loud = false;
    call.commitTurn();
    await until(() => call.lastTiming() !== null);
    const t = call.lastTiming()!;
    expect(t).not.toBeNull();
    expect(t.stt, 'transcription leg').toBeGreaterThan(0);
    expect(t.total, 'total to her first word').toBeGreaterThanOrEqual(t.stt);
    expect(t.think).toBeGreaterThanOrEqual(0);
    expect(t.voice).toBeGreaterThanOrEqual(0);
  });

  it('ends the turn by itself on a silence when auto-commit is on', async () => {
    const call = engine(mem());
    await call.start();
    room.loud = true;
    await sleep(400);
    room.loud = false;
    await until(() => calls.stt > 0);     // the patience window, then the round trip
    expect(calls.stt).toBe(1);
  });
});

describe('a word placed but not noticed', () => {
  /** Plants goals the live check will never look at: unrevealed, so only the end-of-call
   *  sweep can tick them. The reveal timer sits minutes away at the shipped call length. */
  const withGoals = (words: string[]) => {
    const m = mem();
    m.settings.minutesHint = 8;
    const call = engine(m);
    (call as unknown as { goals: unknown[] }).goals =
      words.map(word => ({ word, gloss: '', why: 'passive', revealed: false, used: false }));
    return call;
  };

  const spoke = async (call: ReturnType<typeof withGoals>) => {
    await call.start();
    room.loud = true;
    await sleep(500);
    room.loud = false;
    call.commitTurn();
    await until(() => call.transcript().some(t => t.role === 'user'));
  };

  it('is counted when the call ends, even though nothing saw it live', async () => {
    // The stub transcribes every turn as "je vais au marché hier". The goal carries the
    // dictionary's article; the learner said "au marché". Both halves of the fix at once.
    const call = withGoals(['le marché']);
    await spoke(call);
    expect(call.wordGoals()).toEqual([{ word: 'le marché', used: true }]);
  });

  it('and a word nobody said is still a miss', async () => {
    const call = withGoals(['les ongles']);
    await spoke(call);
    expect(call.wordGoals()).toEqual([{ word: 'les ongles', used: false }]);
  });
});
