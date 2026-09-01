import type { CallSession, Memory, TranscriptItem, WordGoalResult } from '../types';
import { api, OAI } from './api';
import { pack } from '../lang';
import { normalizeUsage, sseAccumulator } from './analysis';
import type { CallEngine, CostEntry, RealtimeUsage } from './engine';
import { TURN_DEFAULT } from './langs';
import { buildTutorPrompt, greetingPrompt } from './prompts';
import { clearHeld, type Held, holdable, holdTimers, releaseTimers, type LiveGoal, type RealtimeCallbacks } from './realtime';
import { stitchTranscript } from './stitch';
import { promptFor } from './transcribe';
import { GOAL_AT, goalPlaced } from './wordgoal';

/** The turn-by-turn engine: the same call, taken apart.
 *
 *  RealtimeCall hands the student's voice straight to a speech-to-speech model, which is
 *  what makes interruption and half-second replies possible — and what makes it expensive,
 *  because every turn re-bills the whole conversation as AUDIO and the model's own speech
 *  is billed at the audio rate on top. This engine does the three jobs separately and pays
 *  the cheap rate for each: transcribe what the student said, think in TEXT, speak the
 *  answer with the same TTS voice the cards already use.
 *
 *  What that buys: roughly a sixth of the conversation cost, and a smarter Odile — the
 *  text model behind her follows a two-thousand-word briefing far better than the
 *  speech-to-speech one does. What it gives up: interruption (she finishes her sentence),
 *  a second or two of thinking time between turns, and any awareness of HOW the student
 *  pronounced something — she reads a transcript, she does not hear an accent.
 *
 *  The transcription pass is the same verbatim one the analysis used to pay for separately
 *  after the call, so this engine has no captions leg and no verbatim leg at all: one pass
 *  over the audio serves the live captions, the record of what was said, and the analysis. */

interface Msg { role: 'system' | 'user' | 'assistant'; content: string }
interface Item extends TranscriptItem { id: string; final: boolean }

/** Sentinel Odile writes at the very end of her last message to hang up (the tool call the
 *  realtime engine uses has no equivalent worth the streaming complexity here). Stripped
 *  before a single character reaches the voice. */
export const HANGUP_MARK = '[FIN]';
const HANGUP_RE = /\[\s*FIN\s*\]/gi;

/** Longest single request handed to the speech endpoint. Her turns are 1-3 sentences and
 *  are cut into sentences before this ever bites; it is a guard against a runaway line. */
const TTS_MAX = 600;
/** Smallest chunk worth sending on its own. Below this the round trip costs more time
 *  than waiting for the rest of the sentence would — but "Bonjour Marco, content de te
 *  revoir." is thirty-six characters, and holding a whole opening back for the question
 *  after it would waste exactly the head start this streaming is for. */
const CHUNK_MIN = 24;
/** …and the FIRST chunk of a turn is measured against a much lower bar, because it is the
 *  one the student is sitting in silence waiting for. "Ah bon ?" is eight characters and
 *  starts her talking a beat sooner; everything after it can wait for a full sentence. */
const FIRST_CHUNK_MIN = 8;

/** Silence that ends the student's turn, per patience setting. Deliberately shorter than
 *  the realtime engine's windows (lib/realtime SILENCE_MS): there the wait overlaps a model
 *  that is already listening, here it is dead air in front of a cascade that needs a second
 *  or two of its own, and the two waits add up in front of the student. */
export const TURN_SILENCE_MS: Record<'low' | 'auto' | 'high', number> = { low: 1200, auto: 900, high: 650 };

/** How far ahead of the clock a buffer is scheduled. Long enough that the output device is
 *  certainly running by the time the first sample is due, short enough not to read as lag. */
const LEAD_S = 0.08;

/** Where one turn's time actually went, for the console line after every turn. Guessing at
 *  this was how a two-second endpointing window hid behind "the model is slow". */
export interface TurnTiming { stt: number; think: number; voice: number; total: number }

/* ------------------------------ pure helpers ------------------------------ */

/** Pulls the first speakable chunk out of a streaming buffer: everything up to the first
 *  sentence end at or after `min` characters. Returns null while the buffer holds nothing
 *  worth speaking yet, so the caller keeps accumulating. */
export function takeChunk(buf: string, min = CHUNK_MIN): { chunk: string; rest: string } | null {
  // The closing mark travels with the sentence it closes, across the space French puts in
  // front of it — a lone « » landing at the head of the next chunk is a stray character
  // handed to a voice.
  const re = /[.!?…](?:\s?["»)\]])?(?=\s|$)|\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buf))) {
    const end = m.index + m[0].length;
    if (end >= min) return { chunk: buf.slice(0, end).trim(), rest: buf.slice(end) };
  }
  return null;
}

/** Splits an over-long line at the last space before the cap, so one runaway sentence
 *  cannot exceed what the speech endpoint accepts. */
export function capChunks(text: string, max = TTS_MAX): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const cut = rest.lastIndexOf(' ', max);
    const at = cut > max / 2 ? cut : max;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export interface VadOpts {
  /** Silence that ends the turn, from the patience setting. */
  silenceMs: number;
  /** Speech needed before a silence can end anything — a cough is not a turn. */
  minSpeechMs: number;
  /** Ceiling on one turn, so a monologue still gets an answer. */
  maxTurnMs: number;
}

export interface VadState {
  /** Slowly-tracked quiet level of the room, so the threshold follows the environment. */
  floor: number;
  speechMs: number;
  silenceMs: number;
  elapsedMs: number;
  speaking: boolean;
}

export const vadInit = (): VadState => ({ floor: 0.02, speechMs: 0, silenceMs: 0, elapsedMs: 0, speaking: false });

/** One VAD frame. Pure, so the endpointing can be tested without a microphone: the
 *  floor drops quickly towards a quiet room and rises slowly, so a passing lorry raises
 *  the bar for a while instead of swallowing the next sentence. */
export function vadStep(st: VadState, rms: number, dtMs: number, o: VadOpts): { st: VadState; commit: boolean } {
  const floor = rms < st.floor ? st.floor + (rms - st.floor) * 0.3 : st.floor + (rms - st.floor) * 0.002;
  const gate = Math.max(0.012, floor * 2.5 + 0.006);
  const loud = rms > gate;
  const next: VadState = {
    floor,
    speechMs: loud ? st.speechMs + dtMs : st.speechMs,
    silenceMs: loud ? 0 : st.silenceMs + dtMs,
    elapsedMs: st.elapsedMs + dtMs,
    speaking: loud
  };
  const heard = next.speechMs >= o.minSpeechMs;
  const commit = heard && (next.silenceMs >= o.silenceMs || next.elapsedMs >= o.maxTurnMs);
  return { st: next, commit };
}

/** RMS of a byte-domain waveform, 0..1. */
export function rmsOf(buf: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return buf.length ? Math.sqrt(sum / buf.length) : 0;
}

/* ------------------------------ the engine ------------------------------ */

export class TurnCall implements CallEngine {
  private mic: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private playAnalyser: AnalyserNode | null = null;
  private micBuf: Uint8Array<ArrayBuffer> | null = null;
  private playBuf: Uint8Array<ArrayBuffer> | null = null;
  private player: HTMLAudioElement | null = null;
  private recorder: MediaRecorder | null = null;
  private recChunks: BlobPart[] = [];
  private recMime = '';
  private recStartedAt = 0;
  /** Wall-clock milliseconds this turn's recording spent paused, so a student who steps
   *  away mid-sentence does not come back to ten minutes of silence to transcribe. */
  private recPausedMs = 0;

  private messages: Msg[] = [];
  private items = new Map<string, Item>();
  private order: string[] = [];
  private seq = 0;
  private goals: LiveGoal[] = [];
  /** Timeouts measured in conversation time, held rather than run down while the call is
   *  paused — the same treatment the realtime engine gives them. */
  private nudgeTimers: Held[] = [];
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private vad = vadInit();
  private phase: 'idle' | 'listening' | 'thinking' | 'speaking' = 'idle';

  private t0 = 0;
  private ended = false;
  private hangupSeen = false;
  private userMuted = false;
  private materialPause = false;
  /** The pause button: like the two above it stops the turn from ever committing, and on
   *  top of that holds every clock the call keeps (see setPaused). */
  private pausedFlag = false;
  private pausedAt = 0;
  private pausedMs = 0;
  /** Stage directions waiting for the next turn (the tutor never sees them mid-turn). */
  private notes: string[] = [];

  /** Decoded audio waiting its turn at the speaker, in the order it was written. */
  private ttsQueue: Promise<AudioBuffer | null>[] = [];
  /** Fallback path only (no AudioContext at all): object URLs played off an element. */
  private ttsUrls: string[] = [];
  private fallbackUrls: string[] = [];
  private sources: AudioBufferSourceNode[] = [];
  /** Context time at which everything scheduled so far will have finished. */
  private playHead = 0;
  /** Chunks spoken in the current turn, so only the first gets the low threshold. */
  private spokenChunks = 0;
  private turnT0 = 0;
  private mark = { stt: 0, think: 0, voice: 0 };
  private timing: TurnTiming | null = null;
  private pumping = false;
  private streaming = false;
  /** Set by skipTurn so the aborted request reads as a choice rather than as a fault. */
  private skipped = false;
  private abort: AbortController | null = null;

  private sttSeconds = 0;
  private ttsChars = 0;
  private chatUsage = { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 };
  private effectiveModel = '';

  /** Frame interval of the VAD loop. Fine enough that the shortest patience setting
   *  (700 ms) still has a dozen frames to make its mind up in. */
  static TICK_MS = 50;
  /** A turn that has run this long gets an answer whether or not the student has paused. */
  static MAX_TURN_MS = 90_000;
  /** Speech needed before a silence counts as the end of a turn. */
  static MIN_SPEECH_MS = 350;

  constructor(
    private mem: Memory,
    private sess: CallSession,
    private cb: RealtimeCallbacks = {}
  ) {
    this.goals = (sess.wordGoals ?? []).map(g => ({ ...g, revealed: false, used: false }));
    this.effectiveModel = mem.settings.turnModel || TURN_DEFAULT;
  }

  /* ---------------------------- lifecycle ---------------------------- */

  async start(): Promise<void> {
    this.cb.onPhase?.('mic');
    this.mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    this.cb.onPhase?.('connect');
    this.openAudio();
    this.cb.onPhase?.('config');
    // The briefing is built ONCE and never rebuilt: it is the cached prefix of every turn,
    // and a single character's difference would re-bill two thousand tokens per turn at the
    // full rate. The turn-mode protocol rides with it rather than in the user's template.
    const tp = pack(this.mem.profile.target).tutor;
    this.messages = [{ role: 'system', content: buildTutorPrompt(this.mem, this.sess) + '\n\n' + tp.notes.turnMode }];
    this.t0 = Date.now();
    this.cb.onPhase?.('live');
    this.scheduleTimeNudges();
    this.scheduleWordGoals();
    // Her greeting is a turn with no student input, exactly as the realtime kickoff is.
    this.notes.push(greetingPrompt(this.mem, this.sess));
    await this.runTurn(null);
  }

  stop(): void {
    if (this.ended) return;
    this.ended = true;
    this.setPhase('idle');
    clearHeld(this.nudgeTimers);
    this.nudgeTimers = [];
    if (this.vadTimer) { clearInterval(this.vadTimer); this.vadTimer = null; }
    try { this.abort?.abort(); } catch { /* nothing in flight */ }
    this.ttsQueue = [];
    this.silence();
    try { if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop(); } catch { /* noop */ }
    this.recorder = null;
    if (this.player) {
      try { this.player.pause(); } catch { /* noop */ }
      this.player.onended = null;
      this.player.onerror = null;
      this.player.src = '';
      try { this.player.remove(); } catch { /* never mounted */ }
      this.player = null;
    }
    this.ttsUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch { /* already gone */ } });
    this.ttsUrls = [];
    try { this.mic?.getTracks().forEach(t => t.stop()); } catch { /* noop */ }
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close().catch(() => { /* already closing */ });
    this.ctx = null;
  }

  /** Mic analyser (level + endpointing) and playback analyser (her mouth) on one context.
   *
   *  Her voice is DECODED and scheduled on the graph rather than played off an <audio>
   *  element routed into it. That routing is what swallowed her first half-second: an
   *  element plays into whatever graph it is connected to, and its clock runs whether or
   *  not that graph is awake — so a context still spinning up (or one Safari had quietly
   *  suspended between turns) ate the front of every clip while the playhead marched on.
   *  "Bonjour" arrived as "…jour". A buffer scheduled at an explicit time on a context
   *  confirmed running cannot lose its opening, and back-to-back scheduling also closes the
   *  seam between two sentences of the same answer. */
  private openAudio(): void {
    try {
      const AC = window.AudioContext || window.webkitAudioContext!;
      const ctx = this.ctx = new AC();
      void this.ensureRunning();
      const mkAnalyser = () => {
        const a = ctx.createAnalyser();
        a.fftSize = 1024;
        a.smoothingTimeConstant = 0.6;
        return a;
      };
      this.micAnalyser = mkAnalyser();
      ctx.createMediaStreamSource(this.mic!).connect(this.micAnalyser);
      this.micBuf = new Uint8Array(this.micAnalyser.fftSize);
      this.playAnalyser = mkAnalyser();
      this.playAnalyser.connect(ctx.destination);
      this.playBuf = new Uint8Array(this.playAnalyser.frequencyBinCount);
    } catch (e) {
      // No graph at all: fall back to a plain element. It cannot drive her mouth, but an
      // UNROUTED element is the one playback path a suspended context cannot silence.
      console.warn('audio graph unavailable', e);
      this.ctx = this.micAnalyser = this.playAnalyser = null;
      const el = this.player = new Audio();
      (el as unknown as { playsInline: boolean }).playsInline = true;
      if (typeof document !== 'undefined' && document.body) {
        el.style.display = 'none';
        document.body.appendChild(el);
      }
    }
  }

  /** A context that is not running produces silence while every clock in it keeps moving,
   *  so nothing is ever scheduled before this resolves. */
  private async ensureRunning(): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      try { await ctx.resume(); } catch { /* autoplay policy: stays suspended */ }
    }
    // Re-read rather than trusting the value from before the await.
    return this.ctx?.state === 'running';
  }

  private setPhase(p: 'idle' | 'listening' | 'thinking' | 'speaking'): void {
    if (this.phase === p) return;
    this.phase = p;
    this.cb.onTurnPhase?.(p);
  }

  /* ---------------------------- listening ---------------------------- */

  /** Opens the student's turn: recorder on, endpointing armed. */
  private openTurn(): void {
    if (this.ended || this.hangupSeen) return;
    this.setPhase('listening');
    this.vad = vadInit();
    this.startRecorder();
    if (this.vadTimer) clearInterval(this.vadTimer);
    this.vadTimer = setInterval(() => this.tick(), TurnCall.TICK_MS);
  }

  private tick(): void {
    if (this.phase !== 'listening' || this.ended) return;
    if (this.userMuted || this.materialPause || this.pausedFlag) return;
    const rms = this.micLevel();
    const auto = (this.mem.settings.turnCommit ?? 'auto') === 'auto';
    const { st, commit } = vadStep(this.vad, rms, TurnCall.TICK_MS, {
      silenceMs: TURN_SILENCE_MS[this.mem.settings.eagerness || 'low'] ?? TURN_SILENCE_MS.low,
      minSpeechMs: TurnCall.MIN_SPEECH_MS,
      maxTurnMs: TurnCall.MAX_TURN_MS
    });
    if (st.speaking !== this.vad.speaking) this.cb.onUser?.(st.speaking);
    this.vad = st;
    // With auto-commit off the button is the only way out of a turn, but the ceiling still
    // applies: a call that can never take its next turn is not a call.
    if (commit && (auto || st.elapsedMs >= TurnCall.MAX_TURN_MS)) this.commitTurn();
  }

  /** The student is finished (their tap, or the silence that follows them). */
  commitTurn(): void {
    if (this.phase !== 'listening' || this.ended) return;
    if (this.vadTimer) { clearInterval(this.vadTimer); this.vadTimer = null; }
    this.cb.onUser?.(false);
    this.turnT0 = Date.now();
    this.mark = { stt: 0, think: 0, voice: 0 };
    this.setPhase('thinking');
    const heard = this.vad.speechMs >= TurnCall.MIN_SPEECH_MS;
    void this.stopRecorder().then(async rec => {
      // Nothing said: no transcription to pay for, and no empty turn handed to the tutor.
      if (!heard || !rec) { this.openTurn(); return; }
      const text = await this.transcribeTurn(rec.blob, rec.seconds);
      this.mark.stt = Date.now();
      if (!text) { this.openTurn(); return; }
      await this.runTurn(text);
    });
  }

  /** Stops Odile mid-sentence and gives the turn back. Not interruption by voice — the
   *  student has to reach for the button — but it means a long answer is never a wall. */
  skipTurn(): void {
    if (this.phase !== 'speaking' || this.ended) return;
    this.skipped = true;
    try { this.abort?.abort(); } catch { /* nothing in flight */ }
    this.streaming = false;
    this.ttsQueue = [];
    this.silence();
  }

  /** Stops every sentence already on the graph and puts the playhead back on the clock, so
   *  the next turn is not scheduled behind audio nobody is going to hear. */
  private silence(): void {
    this.sources.splice(0).forEach(src => { try { src.stop(); } catch { /* already done */ } });
    this.playHead = this.ctx ? this.ctx.currentTime : 0;
    this.fallbackUrls = [];
    try { this.player?.pause(); } catch { /* noop */ }
    if (this.player) this.player.src = '';
  }

  /* ---------------------------- one turn ---------------------------- */

  private async runTurn(userText: string | null): Promise<void> {
    if (this.ended) return;
    if (userText) {
      this.messages.push({ role: 'user', content: userText });
      this.addItem('user', userText);
      this.checkGoals(userText);
    }
    // Stage directions ride in front of the turn, never inside her answer.
    for (const n of this.notes.splice(0)) this.messages.push({ role: 'system', content: n });
    this.setPhase('thinking');
    this.spokenChunks = 0;
    let full = '';
    try {
      full = await this.streamReply();
    } catch (e) {
      if (this.ended) return;
      // Her own request, aborted on purpose: hand the turn back without calling it a fault.
      if (this.skipped) { this.skipped = false; this.openTurn(); return; }
      console.warn('turn failed', e);
      this.cb.onError?.((e as Error).message === 'AUTH' ? 'AUTH' : pack(this.mem.profile.target).ui.call.connLost);
      this.openTurn();
      return;
    }
    const hangup = HANGUP_RE.test(full);
    HANGUP_RE.lastIndex = 0;
    const clean = full.replace(HANGUP_RE, '').trim();
    if (clean) {
      this.messages.push({ role: 'assistant', content: clean });
      this.addItem('assistant', clean);
    }
    this.report();
    await this.drain();
    if (this.ended) return;
    this.skipped = false;
    if (hangup) { this.hangupSeen = true; this.setPhase('idle'); this.cb.onHangup?.(); return; }
    this.openTurn();
  }

  /** Streams her answer and hands each finished sentence to the voice as it lands, so she
   *  starts speaking while the rest is still being written. */
  private async streamReply(): Promise<string> {
    const ctl = this.abort = new AbortController();
    const body: Record<string, unknown> = {
      model: this.effectiveModel,
      messages: this.messages,
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: 600,
      // A tutor's next line needs no deliberation, and every second of it is a second the
      // student spends looking at a silent screen.
      reasoning_effort: 'minimal'
    };
    let r = await this.chatFetch(body, ctl.signal);
    if (r.status === 400) {
      // A model that will not take the effort hint still takes the turn.
      delete body.reasoning_effort;
      r = await this.chatFetch(body, ctl.signal);
    }
    if (r.status === 401) throw new Error('AUTH');
    if (!r.ok) throw new Error('chat ' + r.status + ': ' + (await r.text()).slice(0, 160));
    this.streaming = true;
    const acc = sseAccumulator();
    let spoken = 0;                       // characters already handed to the voice
    const flush = (done: boolean) => {
      for (;;) {
        const buf = acc.content.slice(spoken);
        const min = this.spokenChunks === 0 ? FIRST_CHUNK_MIN : CHUNK_MIN;
        const cut = done ? { chunk: buf.trim(), rest: '' } : takeChunk(buf, min);
        if (!cut || !cut.chunk) return;
        spoken = acc.content.length - cut.rest.length;
        const say = cut.chunk.replace(HANGUP_RE, '').trim();
        HANGUP_RE.lastIndex = 0;
        if (say) capChunks(say).forEach(c => { this.enqueueSpeech(c); this.spokenChunks++; });
        if (done) return;
      }
    };
    try {
      if (r.body && (r.headers.get('content-type') || '').includes('text/event-stream')) {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc.push(dec.decode(value, { stream: true }));
          if (!this.mark.think && acc.content.trim()) this.mark.think = Date.now();
          flush(false);
          this.emitTranscript(acc.content);
        }
        acc.push(dec.decode());
        acc.end();
      } else {
        // A proxy collapsed the stream: one JSON body, one chunk of speech.
        const j = await r.json();
        acc.push('data: ' + JSON.stringify({ choices: [{ delta: { content: j.choices?.[0]?.message?.content ?? '' } }], usage: j.usage }) + '\n');
        acc.end();
      }
      flush(true);
    } finally {
      this.streaming = false;
    }
    if (acc.usage) {
      const u = normalizeUsage(acc.usage);
      this.chatUsage.input_tokens += u.input_tokens;
      this.chatUsage.output_tokens += u.output_tokens;
      this.chatUsage.cached_input_tokens += u.cached_input_tokens;
    }
    return acc.content;
  }

  private chatFetch(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
    if (api.useServer()) {
      return fetch('/api/converse', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...api.authHeaders() },
        body: JSON.stringify(body), signal
      });
    }
    return fetch(OAI() + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + api.getKey() },
      body: JSON.stringify(body), signal
    });
  }

  /* ---------------------------- her voice ---------------------------- */

  /** Voice guidance for the speech endpoint. Her persona is the same text the briefing
   *  uses, so the deadpan Odile stays deadpan when she is spoken by a different model. */
  private ttsInstructions(): string {
    const P = pack(this.mem.profile.target);
    const persona = P.tutor.persona[this.mem.profile.persona === 'warm' ? 'warm' : 'deadpan'];
    return `You are Odile, a ${P.en} conversation tutor speaking to a language learner. `
      + `Speak natural, clearly articulated ${P.en}. ${persona}`;
  }

  /** Speech rate: the same level ramp the realtime session uses, so switching engines
   *  does not change how fast she talks. */
  private ttsSpeed(): number {
    const s = Number(this.mem.settings.speed);
    return s === 0.9 ? Math.min(1.05, 0.9 + 0.025 * (this.mem.cefr.overall || 0)) : s || 0.9;
  }

  private enqueueSpeech(text: string): void {
    if (this.ended || !text.trim()) return;
    this.ttsChars += text.length;
    this.ttsQueue.push(this.fetchSpeech(text));
    void this.pump();
  }

  /** One sentence of hers, fetched and decoded. Decoding here rather than at the speaker
   *  keeps the whole round trip off the moment of playback. */
  private async fetchSpeech(text: string): Promise<AudioBuffer | null> {
    try {
      const voice = this.mem.settings.voice || 'marin';
      const P = pack(this.mem.profile.target);
      let r: Response;
      if (api.useServer()) {
        r = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...api.authHeaders() },
          body: JSON.stringify({ text, lang: P.en, voice, instructions: this.ttsInstructions(), speed: this.ttsSpeed() })
        });
      } else {
        r = await fetch(OAI() + '/v1/audio/speech', {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + api.getKey() },
          body: JSON.stringify({
            model: 'gpt-4o-mini-tts', voice, input: text,
            instructions: this.ttsInstructions(), speed: this.ttsSpeed(), response_format: 'mp3'
          })
        });
      }
      if (!r.ok) throw new Error('tts ' + r.status);
      const bytes = await r.arrayBuffer();
      if (!this.mark.voice) this.mark.voice = Date.now();
      const ctx = this.ctx;
      if (!ctx) {                                  // element fallback: keep a URL instead
        const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
        this.ttsUrls.push(url);
        this.fallbackUrls.push(url);
        return null;
      }
      return await decode(ctx, bytes);
    } catch (e) {
      console.warn('tts failed', e);
      return null;
    }
  }

  /** Plays the queue in order. Stays alive while the reply is still streaming, so two
   *  sentences of one answer never come out with a hole between them. */
  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    this.setPhase('speaking');
    this.cb.onTutor?.(true);
    try {
      while (!this.ended && (this.ttsQueue.length || this.streaming)) {
        const next = this.ttsQueue.shift();
        if (!next) { await sleep(40); continue; }
        const buf = await next;
        if (this.ended) break;
        if (buf) await this.schedule(buf);
        else await this.playFallback();
      }
      await this.waitForPlayhead();
    } finally {
      this.pumping = false;
      this.cb.onTutor?.(false);
    }
  }

  /** Puts one decoded sentence on the graph at an explicit time. Never before the context
   *  is running, and never less than a lead ahead of the clock — those two conditions are
   *  the whole fix for the swallowed first word. Consecutive sentences butt up against
   *  each other, so an answer comes out as one piece of speech. */
  private async schedule(buf: AudioBuffer): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !(await this.ensureRunning()) || this.ended) return;
    const at = Math.max(this.playHead, ctx.currentTime + LEAD_S);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.playAnalyser ?? ctx.destination);
    src.onended = () => { this.sources = this.sources.filter(x => x !== src); };
    src.start(at);
    this.sources.push(src);
    this.playHead = at + buf.duration;
  }

  /** No AudioContext on this browser: play the clip off the element and wait it out. */
  private playFallback(): Promise<void> {
    const el = this.player;
    const url = this.fallbackUrls.shift();
    if (!el || !url) return Promise.resolve();
    return new Promise<void>(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      el.onended = finish;
      el.onerror = finish;
      el.onpause = finish;                 // skipTurn() or stop()
      el.src = url;
      const p = el.play();
      if (p && typeof p.then === 'function') p.catch(err => { console.warn('play', err); finish(); });
    });
  }

  /** Sits until the last scheduled sample has been played. */
  private async waitForPlayhead(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    while (!this.ended && ctx.currentTime < this.playHead) {
      await sleep(Math.min(120, Math.max(20, (this.playHead - ctx.currentTime) * 1000)));
    }
  }

  /** Waits for everything queued for this turn to finish coming out of the speaker. */
  private async drain(): Promise<void> {
    while (!this.ended && (this.pumping || this.ttsQueue.length)) await sleep(40);
    await this.waitForPlayhead();
  }

  /* ---------------------------- transcription ---------------------------- */

  private async transcribeTurn(blob: Blob, seconds: number): Promise<string | null> {
    // Well under a second of audio: nothing a recogniser can do with it, and the round
    // trip would cost the student a pause for no text.
    if (!blob || blob.size < 1200) return null;
    const lang = this.mem.profile.target || 'fr';
    const native = this.mem.profile.native || 'de';
    const billed = () => { this.sttSeconds += seconds; };
    try {
      if (api.useServer()) {
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
        }
        const r = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...api.authHeaders() },
          body: JSON.stringify({ audio_b64: btoa(bin), type: blob.type || 'audio/webm', lang, native, audio_seconds: Math.round(seconds) })
        });
        if (!r.ok) throw new Error('transcribe ' + r.status);
        billed();
        return ((await r.json()).text || '').trim() || null;
      }
      const form = new FormData();
      const type = blob.type || 'audio/webm';
      form.append('file', blob, type.includes('mp4') ? 'audio.mp4' : 'audio.webm');
      form.append('model', this.transcribeModel());
      form.append('prompt', promptFor(lang, native));
      form.append('temperature', '0');
      const r = await fetch(OAI() + '/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + api.getKey() },
        body: form
      });
      if (!r.ok) throw new Error('transcribe ' + r.status);
      billed();
      return ((await r.json()).text || '').trim() || null;
    } catch (e) {
      console.warn('turn transcription failed', e);
      return null;
    }
  }

  private startRecorder(): void {
    if (typeof MediaRecorder === 'undefined' || !this.mic) return;
    try {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
      this.recChunks = [];
      this.recorder = new MediaRecorder(this.mic, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      this.recMime = mime || this.recorder.mimeType || 'audio/webm';
      this.recorder.ondataavailable = e => { if (e.data && e.data.size) this.recChunks.push(e.data); };
      this.recStartedAt = Date.now();
      this.recPausedMs = 0;
      this.recorder.start();
    } catch (e) {
      console.warn('recorder unavailable', e);
      this.recorder = null;
    }
  }

  private stopRecorder(): Promise<{ blob: Blob; seconds: number } | null> {
    return new Promise(resolve => {
      const rec = this.recorder;
      const held = this.recPausedMs + (this.pausedAt ? Date.now() - this.pausedAt : 0);
      const seconds = this.recStartedAt ? Math.max(0, (Date.now() - this.recStartedAt - held) / 1000) : 0;
      this.recorder = null;
      const finish = () => resolve(
        this.recChunks.length ? { blob: new Blob(this.recChunks, { type: this.recMime.split(';')[0] }), seconds } : null
      );
      if (!rec || rec.state === 'inactive') return finish();
      const to = setTimeout(finish, 1500);
      rec.onstop = () => { clearTimeout(to); finish(); };
      try { rec.stop(); } catch { clearTimeout(to); finish(); }
    });
  }

  /* ---------------------------- transcript & goals ---------------------------- */

  private addItem(role: 'user' | 'assistant', text: string): void {
    const id = role[0] + ++this.seq;
    this.items.set(id, { id, role, text, final: true });
    this.order.push(id);
    this.emit();
  }

  /** Her line as it is being written, so the captions keep up with the voice. */
  private emitTranscript(partial: string): void {
    const clean = partial.replace(HANGUP_RE, '').trim();
    HANGUP_RE.lastIndex = 0;
    if (!clean) return;
    const list = this.list();
    this.cb.onTranscript?.([...list, { role: 'assistant', text: clean, final: false }]);
  }

  private list(): Item[] {
    return this.order.map(id => this.items.get(id)!).filter(it => it && (it.text || '').trim());
  }

  private emit(): void { this.cb.onTranscript?.(this.list()); }

  private note(text: string, force = false): void {
    this.notes.push(text);
    // A forcing note only takes the turn when nobody is mid-sentence: cutting the student
    // off to tell her the time is up would be exactly the rudeness this engine avoids.
    if (force && this.phase === 'listening' && this.vad.speechMs < TurnCall.MIN_SPEECH_MS) {
      if (this.vadTimer) { clearInterval(this.vadTimer); this.vadTimer = null; }
      void this.stopRecorder().then(() => this.runTurn(null));
    }
  }

  /** What the student actually waited through, leg by leg. Printed after every turn
   *  because the shape of this lag is not guessable: a two-second endpointing window and a
   *  slow model feel identical from the sofa, and only one of them is worth fixing. */
  private report(): void {
    if (!this.turnT0) return;
    const ms = (t: number) => (t ? t - this.turnT0 : 0);
    const stt = ms(this.mark.stt);
    const think = this.mark.think && this.mark.stt ? this.mark.think - this.mark.stt : 0;
    const voice = this.mark.voice && this.mark.think ? this.mark.voice - this.mark.think : 0;
    const total = ms(this.mark.voice || this.mark.think || this.mark.stt);
    this.timing = { stt, think, voice, total };
    const s = (n: number) => (n / 1000).toFixed(2) + 's';
    console.info(`[causerie] turn: transcribe ${s(stt)} · think ${s(think)} · voice ${s(voice)} → ${s(total)} to her first word`);
    this.turnT0 = 0;
  }

  /** The last turn's latency breakdown, for anyone measuring rather than guessing. */
  lastTiming(): TurnTiming | null { return this.timing; }

  private scheduleTimeNudges(): void {
    const mins = this.sess.minutes ?? this.mem.settings.minutesHint ?? 4;
    if (!mins || mins <= 0) return;
    const notes = pack(this.mem.profile.target).tutor.notes;
    this.nudgeTimers.push(holdable(Math.max(30, (mins - 1) * 60) * 1000, () => this.note(notes.oneMinute)));
    this.nudgeTimers.push(holdable((mins * 60 + 20) * 1000, () => this.note(notes.timeUp, true)));
    this.nudgeTimers.push(holdable((mins * 60 + 100) * 1000, () => this.note(notes.overtime, true)));
  }

  private scheduleWordGoals(): void {
    if (!this.goals.length) return;
    const mins = this.sess.minutes ?? this.mem.settings.minutesHint ?? 4;
    this.goals.forEach((g, i) => {
      const at = Math.max(45, (GOAL_AT[i] ?? 0.75) * mins * 60);
      this.nudgeTimers.push(holdable(at * 1000, () => this.revealGoal(g)));
    });
  }

  private revealGoal(g: LiveGoal): void {
    if (this.ended || g.revealed || g.used) return;
    if (this.list().some(it => it.role === 'user' && goalPlaced(it.text, g, this.mem.profile.target))) { g.used = true; return; }
    g.revealed = true;
    this.emitGoals();
    this.note(pack(this.mem.profile.target).tutor.notes.wordGoal(g.word));
  }

  private checkGoals(text: string): void {
    let hit = false;
    for (const g of this.goals) {
      if (!g.revealed || g.used || !goalPlaced(text, g, this.mem.profile.target)) continue;
      g.used = true;
      hit = true;
      this.note(pack(this.mem.profile.target).tutor.notes.wordGoalDone(g.word));
    }
    if (hit) this.emitGoals();
  }

  private emitGoals(): void {
    this.cb.onGoals?.(this.goals.filter(g => g.revealed).map(g => ({ ...g })));
  }

  /* ---------------------------- CallEngine surface ---------------------------- */

  pauseForMaterial(): void {
    this.materialPause = true;
    if (!this.pausedFlag) this.note(pack(this.mem.profile.target).tutor.notes.materialPause);
  }

  resumeFromMaterial(): void {
    this.materialPause = false;
    this.vad = vadInit();               // the pause is not a silence she should answer
    // Still paused: nothing is handed back until the pause itself is lifted.
    if (!this.pausedFlag) this.note(pack(this.mem.profile.target).tutor.notes.materialBack, true);
  }

  /** The pause button. The mic goes dead so the room is neither heard nor recorded, the
   *  turn in progress can no longer commit, and the clock and the time nudges hold where
   *  they are — paused time is not conversation time. */
  setPaused(p: boolean): void {
    if (p === this.pausedFlag || this.ended) return;
    this.pausedFlag = p;
    this.mic?.getAudioTracks().forEach(t => (t.enabled = !p && !this.userMuted));
    const notes = pack(this.mem.profile.target).tutor.notes;
    if (p) {
      this.pausedAt = Date.now();
      holdTimers(this.nudgeTimers);
      // A turn already open keeps its recording, minus the silence: resuming picks the
      // same sentence back up rather than throwing away the half of it already said.
      try { if (this.recorder?.state === 'recording') this.recorder.pause(); } catch { /* unsupported: silence gets recorded, and that is all */ }
      // If she is talking she stops now, mid-word. A pause the student has to wait out is
      // not a pause, and "finish your sentence" is an instruction written for someone who
      // is still in the room. skipTurn is exactly this act — drop the audio scheduled and
      // the generation behind it — and it already reads the abort as a choice.
      if (this.phase === 'speaking') this.skipTurn();
      this.note(notes.paused);
    } else {
      this.recPausedMs += this.pausedAt ? Date.now() - this.pausedAt : 0;
      this.pausedMs += this.pausedAt ? Date.now() - this.pausedAt : 0;
      this.pausedAt = 0;
      try { if (this.recorder?.state === 'paused') this.recorder.resume(); } catch { /* noop */ }
      this.vad = vadInit();             // the pause is not a silence she should answer
      releaseTimers(this.nudgeTimers);
      this.note(notes.resumed, true);
    }
  }

  mute(m: boolean): void {
    this.userMuted = m;
    this.mic?.getAudioTracks().forEach(t => (t.enabled = !m));
    if (!m) this.vad = vadInit();
  }

  /** Her voice while she is speaking, the room while she is not — one number for a mouth
   *  that only ever moves on her own audio. */
  level(): number {
    if (this.phase === 'speaking') {
      if (!this.playAnalyser || !this.playBuf) return 0;
      this.playAnalyser.getByteFrequencyData(this.playBuf);
      let sum = 0;
      const n = Math.min(64, this.playBuf.length);
      for (let i = 2; i < n; i++) sum += this.playBuf[i];
      return Math.min(1, sum / n / 110);
    }
    return Math.min(1, this.micLevel() * 4);
  }

  private micLevel(): number {
    if (!this.micAnalyser || !this.micBuf) return 0;
    this.micAnalyser.getByteTimeDomainData(this.micBuf);
    return rmsOf(this.micBuf);
  }

  /** Conversation time: since the call went live, minus everything spent paused. */
  seconds(): number {
    if (!this.t0) return 0;
    const paused = this.pausedMs + (this.pausedAt ? Date.now() - this.pausedAt : 0);
    return Math.max(0, Date.now() - this.t0 - paused) / 1000;
  }

  transcript(): TranscriptItem[] { return stitchTranscript(this.list()); }

  /** The call's word goals and what became of them, for the session record.
   *
   *  Swept once more over everything actually said, because the live check only ever sees
   *  turns that ARRIVE after a goal is revealed — a word placed in the turn the reveal
   *  interrupted, or in one whose transcription lands as the call ends, was used and not
   *  counted. Being told you missed a word you said is the one way this feature can be
   *  worse than not having it. */
  wordGoals(): WordGoalResult[] {
    const said = this.list().filter(it => it.role === 'user').map(it => it.text);
    return this.goals.map(g => ({ word: g.word, used: g.used || said.some(t => goalPlaced(t, g, this.mem.profile.target)) }));
  }

  /** Every turn was transcribed verbatim on its way in, so there is no tail to hand over
   *  and no second pass to pay for. */
  recording(): Promise<null> { return Promise.resolve(null); }

  verbatimText(): string | null {
    const said = this.list().filter(it => it.role === 'user').map(it => it.text.trim()).filter(Boolean);
    return said.length ? said.join('\n') : null;
  }

  transcribeModel(): string { return this.mem.settings.transcribeModel || 'gpt-transcribe'; }

  /** This engine bills no realtime tokens; the ledger reads costEntries() instead. */
  usage(): RealtimeUsage {
    return {
      input_tokens: 0, output_tokens: 0, audio_input_tokens: 0,
      audio_output_tokens: 0, cached_input_tokens: 0, cached_audio_input_tokens: 0
    };
  }

  costEntries(): CostEntry[] {
    const out: CostEntry[] = [];
    if (this.sttSeconds > 0) {
      out.push({ kind: 'stt', model: this.transcribeModel(), entry: { audio_seconds: Math.round(this.sttSeconds) } });
    }
    if (this.chatUsage.input_tokens || this.chatUsage.output_tokens) {
      out.push({ kind: 'chat', model: this.effectiveModel, entry: { ...this.chatUsage } });
    }
    if (this.ttsChars > 0) {
      // The speech endpoint reports no usage, so the same approximation the server ledger
      // uses stands here: ~4 characters per text token in, ~1.4 audio tokens per character out.
      out.push({
        kind: 'tts', model: 'gpt-4o-mini-tts',
        entry: { input_tokens: Math.ceil(this.ttsChars / 4), audio_output_tokens: Math.ceil(this.ttsChars * 1.4) }
      });
    }
    return out;
  }
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

/** decodeAudioData both ways round: the promise form everywhere current, the callback form
 *  on the Safari versions that never grew one. */
function decode(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  const out = ctx.decodeAudioData(bytes as ArrayBuffer, undefined as never, undefined as never);
  if (out && typeof (out as Promise<AudioBuffer>).then === 'function') return out as Promise<AudioBuffer>;
  return new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(bytes, res, rej));
}
