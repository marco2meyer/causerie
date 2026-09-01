import type { CallSession, Memory, TranscriptItem, WordGoal, WordGoalResult } from '../types';
import type { CallEngine, RealtimeUsage } from './engine';
import { api, OAI } from './api';
import { pack } from '../lang';
import { LANGS } from './langs';

/** The learner's own language, in English, for transcription prompts. */
const NATIVE_EN: Record<string, string> = { de: 'German', en: 'English' };
import { buildTutorPrompt, greetingPrompt } from './prompts';
import { stitchTranscript } from './stitch';
import { looksLikeEcho } from './echo';
import { GOAL_AT, goalPlaced } from './wordgoal';

export interface RealtimeCallbacks {
  onPhase?: (phase: 'mic' | 'connect' | 'config' | 'live') => void;
  onTutor?: (speaking: boolean) => void;
  onUser?: (speaking: boolean) => void;
  onTranscript?: (items: TranscriptItem[]) => void;
  onError?: (message: string) => void;
  onDrop?: () => void;
  /** The tutor hung up herself (end_call tool, after the goodbyes). */
  onHangup?: () => void;
  /** Her own voice came back through the microphone. Fired once per call, after the setup
   *  has already been changed to stop it — so this is something to SAY, not something to
   *  ask the student to do. */
  onEcho?: () => void;
  /** The active-vocabulary pushes changed: one appeared, or one was just placed. Only
   *  revealed goals are ever handed out — an unrevealed one would spoil its own surprise. */
  onGoals?: (goals: LiveGoal[]) => void;
  /** Turn-by-turn engine only: where the conversation currently is. 'listening' means the
   *  mic is open and waiting, which is not the same as onUser (the student audibly talking).
   *  RealtimeCall never fires this — a speech-to-speech call has no such phases. */
  onTurnPhase?: (phase: 'listening' | 'thinking' | 'speaking' | 'idle') => void;
  /** A completed mic-recording segment (the recorder rotates every few minutes so the
   *  verbatim re-transcription can start DURING the call instead of all at hang-up).
   *  `seconds` is how much audio the segment holds, which is what transcription is billed
   *  on — guessing it back from the byte count was off by about half. */
  onSegment?: (blob: Blob, seconds: number) => void;
}

interface Item extends TranscriptItem { id: string; final: boolean }

/** A word goal as the call screen sees it. */
export interface LiveGoal extends WordGoal { revealed: boolean; used: boolean }

/** Transcription steering: without this, ASR tends to silently fix learner errors, which
 *  starves the analysis of exactly the mistakes it needs. The learner's own language is named
 *  in the prompt as well as in the `languages` hint list, because a recogniser told to expect
 *  only French turns an English word the learner reached for into the nearest French-sounding
 *  one ("claim" came back as "lame"). */
export const VERBATIM_HINT =
  'Learner speech: imperfect French from a native NATIVE_LANG speaker. Transcribe verbatim, exactly as spoken: keep all grammar mistakes, wrong words, false starts, repetitions and hesitations. When the learner falls back on a NATIVE_LANG or English word, write that word as it was said, in its own language; never translate it and never substitute a similar-sounding French word. Never correct, complete or polish the French.';
export const verbatimHint = (langEn: string, nativeEn = 'German'): string =>
  VERBATIM_HINT.replace(/French/g, langEn).replace(/NATIVE_LANG/g, nativeEn);

/** GA Realtime session object. `withModel` only at mint time (ephemeral secrets);
 *  session.update after connect must not carry the model. `transModelOverride` and
 *  `omitLanguageHints` let the engine walk back down the transcription config if the mint
 *  rejects it (see the connect ladder). */
/** How long acoustic VAD waits before calling the turn over, per patience setting. The stock
 *  500 ms sits inside an A2 learner's word-search pause; 2 s sits outside most of it. */
export const SILENCE_MS: Record<'low' | 'auto' | 'high', number> = { low: 2000, auto: 1200, high: 700 };

export function sessionObject(
  mem: Memory, sess: CallSession, withModel: boolean,
  transModelOverride?: string, omitLanguageHints = false
) {
  const s = mem.settings;
  // Learner endpointing. A beginner pauses mid-sentence to retrieve a word, and second-
  // language pause research puts most of those pauses well above the 500 ms that stock VAD
  // treats as "done speaking" — which is what chopped one spoken sentence into four turns,
  // and every commit also fires a response that the next fragment immediately cancels.
  //
  // The two settings are ORTHOGONAL and must both stay live. Noisy mode needs acoustic VAD,
  // because only server_vad has a loudness threshold to reject room noise; semantic VAD has
  // none. But patience is not a property of the detector, it is a property of the learner, so
  // it drives the silence window here exactly as it drives eagerness there. Making noisy mode
  // pin its own window would leave "patience" writing a value nothing reads.
  //
  // Neither of these is set from the settings screen any more: a call that hears itself now
  // notices and switches to the acoustic detector by itself (see hardenedInput, catchEcho).
  // They are still READ, so a profile that chose noisy mode back when it was offered keeps
  // what it chose, and so the automatic switch has one place to describe rather than two.
  const eagerness = s.eagerness || 'low';
  const turnDetection = s.noisyEnv
    ? {
        type: 'server_vad', threshold: 0.8, prefix_padding_ms: 300,
        silence_duration_ms: SILENCE_MS[eagerness] ?? SILENCE_MS.low,
        create_response: true, interrupt_response: true
      }
    : { type: 'semantic_vad', eagerness, create_response: true, interrupt_response: true };
  // Language hints, not a language pin. These models take `languages` (a LIST of expected
  // languages, which is what makes code-switching survive); the singular `language` field
  // they do not take at all, so the old value was either ignored or, worse, honoured as a
  // hard pin. The learner's own language and English belong on the list: reaching for a word
  // in them is a thing beginners do, and the analysis needs to see it happen.
  const target = mem.profile.target || 'fr';
  const languages = [...new Set([target, mem.profile.native ?? 'de', 'en'])];
  const transcription: Record<string, unknown> = {
    model: transModelOverride || s.transcribeModel || 'gpt-transcribe',
    prompt: verbatimHint((LANGS[target] ?? LANGS.fr).en, NATIVE_EN[mem.profile.native ?? 'de'])
  };
  if (!omitLanguageHints) transcription.languages = languages;
  const input: Record<string, unknown> = { transcription, turn_detection: turnDetection };
  if ((s.noiseReduction ?? 'near') !== 'off') {
    input.noise_reduction = { type: s.noiseReduction === 'far' ? 'far_field' : 'near_field' };
  }
  const o: Record<string, unknown> = {
    type: 'realtime',
    output_modalities: ['audio'],
    instructions: buildTutorPrompt(mem, sess),
    // Odile hangs up herself once the goodbyes are exchanged — nobody should have
    // to tap "hang up" after saying au revoir.
    tools: [{
      type: 'function',
      name: 'end_call',
      description: 'Hang up the call. Use ONLY after the goodbyes have been exchanged: you have said your final goodbye AND the student has said goodbye (or clearly asked to stop). Say your final goodbye first, in your usual tone, THEN call this in the same turn. Never call it mid-conversation.',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
    }],
    tool_choice: 'auto',
    audio: {
      input,
      // Speech-rate ramp: at the untouched default, the tempo follows the level
      // (A1 0.9 → B1 1.0 → C1+ 1.05) so learners never train on classroom-rate
      // audio forever; a slider change overrides the ramp.
      output: {
        voice: s.voice || 'marin',
        speed: Number(s.speed) === 0.9
          ? Math.min(1.05, 0.9 + 0.025 * (mem.cefr.overall || 0))
          : Number(s.speed) || 0.9
      }
    }
  };
  if (withModel) o.model = s.rtModel || 'gpt-realtime-2.1';
  return o;
}

/** The audio input config for a call that has been caught echoing: acoustic detection with
 *  a loudness threshold instead of semantic detection with none, and far-field reduction,
 *  which is what a phone lying on a table with its speaker on actually is.
 *
 *  Deliberately a PARTIAL session — `audio.input` plus the `type` discriminator, which the
 *  GA API requires on EVERY session.update (without it the server rejects the update, the
 *  detector never switches, and the student gets a red "Missing required parameter:
 *  'session.type'" toast in the middle of a call that was busy fixing itself). The full
 *  object is frozen for the life of a call (see frozenSession) because the realtime cache
 *  keys on the instructions prefix, and resending a rebuilt one to change a VAD threshold
 *  would risk paying full rate for every remaining turn of the conversation.
 *
 *  interrupt_response stays true. The point of a speech-to-speech engine is that the
 *  student can cut in on her, and that survives: it now takes a voice in the room rather
 *  than a voice coming back out of the phone. */
export function hardenedInput(mem: Memory): Record<string, unknown> {
  const s = mem.settings;
  return {
    type: 'realtime',
    audio: {
      input: {
        noise_reduction: { type: 'far_field' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.8,
          prefix_padding_ms: 300,
          silence_duration_ms: SILENCE_MS[s.eagerness || 'low'] ?? SILENCE_MS.low,
          create_response: true,
          interrupt_response: true
        }
      }
    }
  };
}

/** A timeout that can be put down and picked up again. `due` is the wall clock it is
 *  aiming at while it runs; while it is held, `rem` is what was still to run when
 *  everything stopped. `spent` marks the ones that have already fired or been cleared,
 *  so releasing never re-arms them. */
export interface Held {
  id: ReturnType<typeof setTimeout> | null;
  due: number;
  rem: number;
  spent: boolean;
  fn: () => void;
}

/** Arms a timeout that survives a pause. */
export function holdable(ms: number, fn: () => void): Held {
  const t: Held = { id: null, due: Date.now() + ms, rem: ms, spent: false, fn };
  t.id = setTimeout(() => { t.id = null; t.spent = true; fn(); }, ms);
  return t;
}

/** Puts every running timer down, remembering what it had left. */
export function holdTimers(ts: Held[]): void {
  const now = Date.now();
  for (const t of ts) {
    if (t.spent || t.id === null) continue;
    clearTimeout(t.id);
    t.id = null;
    t.rem = Math.max(0, t.due - now);
  }
}

/** Picks them back up for exactly the time they had left. */
export function releaseTimers(ts: Held[]): void {
  for (const t of ts) {
    if (t.spent || t.id !== null) continue;
    t.due = Date.now() + t.rem;
    t.id = setTimeout(() => { t.id = null; t.spent = true; t.fn(); }, t.rem);
  }
}

export function clearHeld(ts: Held[]): void {
  ts.forEach(t => { if (t.id !== null) clearTimeout(t.id); t.id = null; t.spent = true; });
}

/** One WebRTC call to the OpenAI Realtime API. Audio flows browser↔OpenAI directly;
 *  events (transcripts, VAD state) arrive on the "oai-events" data channel. */
export class RealtimeCall implements CallEngine {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buf: Uint8Array<ArrayBuffer> | null = null;
  private items = new Map<string, Item>();
  private order: string[] = [];
  private live = false;
  private t0 = 0;
  private ended = false;
  private hangupSeen = false;
  /** Timeouts measured in CONVERSATION time — the time nudges and the word-goal
   *  reveals. They are held rather than left to run down while the call is paused, so a
   *  five-minute interruption cannot make "time is up" land on a call that has had two
   *  minutes of talking in it. */
  private nudgeTimers: Held[] = [];
  private goals: LiveGoal[] = [];
  private kickTimer: ReturnType<typeof setTimeout> | null = null;
  private kicked = false;
  /** Mic gate: input stays disabled until the session config is confirmed, so ambient
   *  audio can't trigger a response under the model's default persona ("Je m'appelle
   *  ChatGPT…") before Odile's instructions land. */
  private gateOpen = false;
  /** Speaker gate: her greeting is held back until the remote audio element is actually
   *  rendering (see openOutput). Set when playback has started and warmed up, or when the
   *  wait ran out. */
  private audioReady = false;
  /** A kickoff that arrived while the speaker path was still coming up. */
  private wantKickoff = false;
  private warmTimer: ReturnType<typeof setTimeout> | null = null;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;
  private userMuted = false;
  private materialPause = false;
  /** Her audio is playing. NOT a microphone gate — being able to cut in on her is the whole
   *  point of a speech-to-speech engine, and closing the mic to stop the echo threw the
   *  feature away to fix a symptom. It is here because an interruption that begins while she
   *  is audible is the only kind that can be a loudspeaker. */
  private tutorSpeaking = false;
  /** Playback ended but the tail is still in the air: a room reverberates, and the echo of
   *  her last syllable arrives after the buffer says it stopped. */
  private tutorTail = 0;
  /** The last few things she said, for telling her voice apart from the student's. */
  private recentTutor: string[] = [];
  /** The current interruption began while she was audible. */
  private cutInOnHer = false;
  /** Echoes caught this call. One is bad luck; the first is enough to change the setup. */
  private echoes = 0;
  /** The acoustic detector has been switched on for this call (see catchEcho). */
  private hardened = false;
  /** Client events whose failure is ours to absorb rather than the student's to read. */
  private quietErrors = new Set<string>();
  /** The student stepped away (the pause button). Gates the mic like the two above, and
   *  additionally holds every clock the call keeps: see setPaused. */
  private pausedFlag = false;
  /** Wall clock at which the current pause began, 0 when the call is running. */
  private pausedAt = 0;
  /** A response is being generated. `response.cancel` with nothing in flight is an error
   *  event, and a call that logs errors on a button press invites the wrong bug report. */
  private responseActive = false;
  /** Wall-clock milliseconds already spent paused, subtracted from the call's duration. */
  private pausedMs = 0;
  private effectiveTransModel: string | undefined;
  /** Set by the connect ladder when the mint refuses the `languages` hint list. */
  private omitLanguageHints = false;
  private recorder: MediaRecorder | null = null;
  private recChunks: BlobPart[] = [];
  private recMime = '';
  /** Wall clock at which the current recorder segment started, for its audio duration. */
  private recStartedAt = 0;
  /** Wall-clock milliseconds this segment spent paused, so the audio duration the
   *  transcription is billed against stays the duration of the audio. */
  private recPausedMs = 0;
  private segTimer: ReturnType<typeof setTimeout> | null = null;
  private userSpeaking = false;
  /** The session object is built ONCE per call and reused for the mint, the initial
   *  session.update and the kickoff re-send. Realtime caches the conversation prefix, and
   *  the prefix starts with `instructions`: if the briefing were rebuilt from live memory
   *  each time and differed by even one character, the cache would never form and every
   *  turn would re-bill the whole conversation at full rate. */
  private frozenSession: Record<string, unknown> | null = null;
  /** Realtime bills the whole accumulated conversation as input on every turn, so most
   *  input tokens are a re-send of what was already sent. Those come back as `cached_tokens`
   *  and are billed at a small fraction of the full rate — tracking them separately is the
   *  difference between a ledger that reads list price and one that reads the actual bill. */
  private usageTotals = {
    input_tokens: 0, output_tokens: 0, audio_input_tokens: 0, audio_output_tokens: 0,
    cached_input_tokens: 0, cached_audio_input_tokens: 0
  };

  /** Recorder rotation interval. Every rotation is a seam, and a seam costs transcription
   *  quality, because each segment is transcribed with no context from its neighbours. Raised
   *  from 3 to 5 minutes: the 8-minute default format now has ONE seam instead of three, and
   *  the seam still waits for a pause in the student's speech (see rotateRecorder). Raising it
   *  further would remove the last seam but push the whole transcription past hang-up, where
   *  the student is waiting for it. */
  static SEGMENT_MS = 300_000;

  /** How long her voice may still be in the room after playback reports it finished. */
  static TAIL_MS = 700;

  /** Beat between "the speaker started" and the greeting going out. A browser reports
   *  playback as running before the output device and the jitter buffer have finished
   *  spinning up, and audio handed over inside that window is the part nobody hears —
   *  which is how "Bonjour Marco" arrived as "…arco". In practice this costs nothing:
   *  the track attaches during the connect phase, so the warm-up has long elapsed by the
   *  time the session config is acknowledged. */
  static WARMUP_MS = 500;
  /** Ceiling on that wait. If playback never reports itself running (autoplay refused,
   *  a browser that fires no event), the greeting goes out anyway: a first word at risk
   *  beats a call that never starts. */
  static AUDIO_WAIT_MS = 2500;

  constructor(
    private mem: Memory,
    private sess: CallSession,
    private cb: RealtimeCallbacks = {}
  ) {
    this.goals = (sess.wordGoals ?? []).map(g => ({ ...g, revealed: false, used: false }));
  }

  /** Byte-identical session config for every send in this call (see frozenSession). */
  private session(withModel: boolean): Record<string, unknown> {
    if (!this.frozenSession) {
      this.frozenSession = sessionObject(
        this.mem, this.sess, false, this.effectiveTransModel, this.omitLanguageHints
      );
    }
    const o = { ...this.frozenSession };
    if (withModel) o.model = this.mem.settings.rtModel || 'gpt-realtime-2.1';
    return o;
  }

  /** end_call tool fired: accept once, and never in the first 45 s (misfire guard). */
  private requestHangup() {
    if (this.hangupSeen || this.ended) return;
    if (this.t0 && Date.now() - this.t0 < 45_000) return;
    this.hangupSeen = true;
    this.cb.onHangup?.();
  }

  private emitTranscript() {
    const list = this.order.map(id => this.items.get(id)!).filter(it => it && (it.text || '').trim());
    this.cb.onTranscript?.(list);
  }

  private item(id: string, role?: 'user' | 'assistant'): Item {
    if (!this.items.has(id)) {
      this.items.set(id, { id, role: role ?? 'assistant', text: '', final: false });
      this.order.push(id);
    }
    const it = this.items.get(id)!;
    if (role) it.role = role;
    return it;
  }

  private handle(evt: any) {
    const t = evt.type as string;
    if (t === 'conversation.item.added' || t === 'conversation.item.created') {
      const it = evt.item || {};
      if (it.type === 'message') this.item(it.id, it.role);
      return;
    }
    if (t === 'conversation.item.input_audio_transcription.delta') {
      const it = this.item(evt.item_id, 'user');
      if (!it.final) { it.text += evt.delta || ''; this.emitTranscript(); }
      return;
    }
    if (t === 'conversation.item.input_audio_transcription.completed') {
      const text = (evt.transcript || '').trim();
      if (this.catchEcho(evt.item_id, text)) return;
      const it = this.item(evt.item_id, 'user');
      it.text = text;
      it.final = true;
      this.emitTranscript();
      this.checkGoals(it.text);
      return;
    }
    if (t === 'response.output_audio_transcript.delta' || t === 'response.audio_transcript.delta') {
      const it = this.item(evt.item_id, 'assistant');
      it.text += evt.delta || '';
      this.emitTranscript();
      return;
    }
    if (t === 'response.output_audio_transcript.done' || t === 'response.audio_transcript.done') {
      const it = this.item(evt.item_id, 'assistant');
      it.text = (evt.transcript || it.text || '').trim();
      it.final = true;
      if (it.text) this.recentTutor = [...this.recentTutor, it.text].slice(-4);
      this.emitTranscript();
      return;
    }
    if (t === 'response.output_item.done' && evt.item?.type === 'function_call' && evt.item?.name === 'end_call') {
      this.requestHangup();
      return;
    }
    if (t === 'response.created') { this.responseActive = true; return; }
    if (t === 'response.done') {
      this.responseActive = false;
      // NOT the moment to reopen the microphone: response.done means she has finished being
      // GENERATED, and the audio the server has queued is still on its way to the speaker.
      // `output_audio_buffer.stopped` is playback finishing, which is the thing the mic has
      // to wait for; SPEAK_GUARD_MS covers it going missing.
      // Usage arrives per response; summed here it feeds the cost ledger after the call.
      const u = evt.response?.usage;
      if (u) {
        const i = u.input_token_details || {};
        const o = u.output_token_details || {};
        this.usageTotals.input_tokens += i.text_tokens || 0;
        this.usageTotals.audio_input_tokens += i.audio_tokens || 0;
        this.usageTotals.output_tokens += o.text_tokens || 0;
        this.usageTotals.audio_output_tokens += o.audio_tokens || 0;
        // `text_tokens`/`audio_tokens` above are totals with the cached ones included, so the
        // cached split is subtracted again at pricing time rather than here.
        const c = i.cached_tokens_details;
        const cachedTotal = i.cached_tokens || 0;
        if (c && (c.text_tokens != null || c.audio_tokens != null)) {
          this.usageTotals.cached_input_tokens += c.text_tokens || 0;
          this.usageTotals.cached_audio_input_tokens += c.audio_tokens || 0;
        } else if (cachedTotal) {
          // No breakdown: split the cached total in the same text/audio proportion as the
          // input itself. Attributing all of it to one modality would misprice the other by
          // its full uncached rate, and text and audio have very different rates.
          const tIn = i.text_tokens || 0;
          const aIn = i.audio_tokens || 0;
          const both = tIn + aIn;
          const cAudio = both ? Math.round((cachedTotal * aIn) / both) : 0;
          this.usageTotals.cached_input_tokens += cachedTotal - cAudio;
          this.usageTotals.cached_audio_input_tokens += cAudio;
        }
      }
      // Belt and braces: some model versions report the tool call only inside response.done.
      const out = (evt.response?.output ?? []) as { type?: string; name?: string }[];
      if (out.some(it => it.type === 'function_call' && it.name === 'end_call')) this.requestHangup();
      return;
    }
    if (t === 'input_audio_buffer.speech_started') {
      this.userSpeaking = true;
      // The one fact that cannot be recovered later: whether she was audible at the moment
      // this started. A learner repeating her words comes AFTER she stops; a loudspeaker
      // can only ever come during.
      this.cutInOnHer = this.audibleNow();
      this.cb.onUser?.(true);
      return;
    }
    if (t === 'input_audio_buffer.speech_stopped') { this.userSpeaking = false; this.cb.onUser?.(false); return; }
    if (t === 'output_audio_buffer.started') { this.setTutorSpeaking(true); return; }
    if (t === 'output_audio_buffer.stopped' || t === 'output_audio_buffer.cleared') { this.setTutorSpeaking(false); return; }
    if (t === 'session.created') { this.cb.onPhase?.('config'); return; }
    if (t === 'session.updated') { this.kickoff(); return; }
    if (t === 'error') {
      console.warn('rt error', evt);
      // Housekeeping we asked for and can live without: logged, never shown.
      if (evt.event_id && this.quietErrors.delete(evt.event_id)) return;
      this.cb.onError?.(evt.error?.message || 'Realtime error');
    }
  }

  async start(): Promise<void> {
    const model = this.mem.settings.rtModel || 'gpt-realtime-2.1';
    this.cb.onPhase?.('mic');
    this.mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    this.applyMic(); // gate closed until the session config is acknowledged
    this.startRecorder();
    this.cb.onPhase?.('connect');
    const pc = this.pc = new RTCPeerConnection();
    pc.addTrack(this.mic.getAudioTracks()[0], this.mic);

    this.audioEl = new Audio();
    this.audioEl.autoplay = true;
    (this.audioEl as any).playsInline = true;
    // In the document, not just in a variable: Safari on iOS renders a detached element
    // unreliably, and an element that is not rendering is one more way to lose her opening.
    if (typeof document !== 'undefined' && document.body) {
      this.audioEl.style.display = 'none';
      document.body.appendChild(this.audioEl);
    }
    pc.ontrack = e => {
      const el = this.audioEl!;
      el.srcObject = e.streams[0];
      // `autoplay` starts the speaker but reports nothing back, and the greeting must not
      // be spoken into an output that has not started yet. play() and the playing event
      // are the two signals that it has; whichever arrives first opens the gate.
      el.onplaying = () => this.outputStarted();
      try {
        const p = el.play();
        if (p && typeof p.then === 'function') {
          p.then(() => this.outputStarted(), err => console.warn('audio play', err));
        }
      } catch (err) { console.warn('audio play', err); }
      try {
        const AC = window.AudioContext || window.webkitAudioContext!;
        this.ctx = new AC();
        // Created outside a user gesture on some browsers, and a suspended context feeds
        // the analyser nothing but zeros — the mouth would never move.
        if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => { /* stays suspended */ });
        const src = this.ctx.createMediaStreamSource(e.streams[0]);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.75;
        src.connect(this.analyser);
        this.buf = new Uint8Array(this.analyser.frequencyBinCount);
      } catch (err) { console.warn('analyser', err); }
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && this.live && !this.ended) {
        this.cb.onError?.(pack(this.mem.profile.target).ui.call.connLost);
        this.cb.onDrop?.();
      }
    };

    const dc = this.dc = pc.createDataChannel('oai-events');
    dc.onmessage = e => { try { this.handle(JSON.parse(e.data)); } catch { /* ignore */ } };
    dc.onopen = () => {
      dc.send(JSON.stringify({ type: 'session.update', session: this.session(false) }));
      // Normal path: kickoff on the session.updated ack. The timer is only a fallback
      // in case the ack is missed, so the call never hangs in "config" (kickoff
      // re-sends the config first, so even this path starts fully briefed).
      this.kickTimer = setTimeout(() => this.kickoff(), 3000);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpUrl = OAI() + '/v1/realtime/calls?model=' + encodeURIComponent(model);
    const connect = async (): Promise<Response> => {
      let auth: string;
      if (api.useServer()) {
        const tr = await fetch('/api/rt-token', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...api.authHeaders() },
          body: JSON.stringify({ session: this.session(true) })
        });
        if (tr.status === 401) throw new Error('AUTH');
        if (!tr.ok) throw new Error('Token-Server: ' + (await tr.text()).slice(0, 180));
        const tj = await tr.json();
        auth = 'Bearer ' + tj.value;
      } else {
        auth = 'Bearer ' + api.getKey();
      }
      return fetch(sdpUrl, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/sdp' },
        body: offer.sdp!
      });
    };

    // Degradation ladder for the transcription config. A call that connects with a poorer
    // transcriber beats a call that does not connect, and the whole config is part of the
    // session object, so each rung discards the frozen copy and rebuilds it — still before
    // any turn exists, so no prompt cache is lost.
    const rungs: Array<() => void> = [
      () => { this.omitLanguageHints = true; },          // mint refuses the hint list
      () => { this.effectiveTransModel = 'gpt-4o-transcribe'; } // account lacks the newer model
    ];
    let r: Response | null = null;
    for (let i = 0; i <= rungs.length; i++) {
      try {
        r = await connect();
        if (r.ok || r.status === 401) break;
        if (i === rungs.length) break;
        throw new Error('retry');
      } catch (e) {
        if ((e as Error).message === 'AUTH') throw e;
        if (i === rungs.length) throw e;
        rungs[i]();
        this.frozenSession = null;
        r = null;
      }
    }
    if (!r) throw new Error('Realtime-Verbindung fehlgeschlagen');
    window.__sdpStatus = r.status;
    if (!r.ok) {
      const tx = await r.text();
      throw new Error('Realtime-Verbindung (' + r.status + '): ' + tx.slice(0, 200));
    }
    await pc.setRemoteDescription({ type: 'answer', sdp: await r.text() });
  }

  /** The speaker reports itself running. Both signals (play() resolving, the playing
   *  event) can fire, and can fire twice; the first one starts the warm-up and the rest
   *  are ignored. */
  private outputStarted(): void {
    if (this.audioReady || this.warmTimer) return;
    this.warmTimer = setTimeout(() => { this.warmTimer = null; this.openOutput(); }, RealtimeCall.WARMUP_MS);
  }

  /** The speaker path is ready (or the wait is over): let a held greeting go out. */
  private openOutput(): void {
    if (this.audioReady) return;
    this.audioReady = true;
    if (this.warmTimer) { clearTimeout(this.warmTimer); this.warmTimer = null; }
    if (this.waitTimer) { clearTimeout(this.waitTimer); this.waitTimer = null; }
    if (this.wantKickoff) this.kickoff();
  }

  /** One-shot: greeting + go-live. The data channel is ordered, so re-sending the
   *  session config right before the greeting guarantees the tutor briefing is active
   *  for the FIRST response even if the session.updated ack never arrived (fallback
   *  path). The greeting itself is a system item + bare response.create: passing it as
   *  response.instructions would OVERRIDE the briefing for that response and produce
   *  the default-persona self-introduction. */
  private kickoff(): void {
    if (this.kicked || this.ended) return;
    if (!this.dc || this.dc.readyState !== 'open') return;
    // Speaker gate. The config ack can beat the speaker path into position, and a greeting
    // asked for before the output is rendering loses its first word or two.
    if (!this.audioReady) {
      this.wantKickoff = true;
      if (!this.waitTimer) {
        this.waitTimer = setTimeout(() => { this.waitTimer = null; this.openOutput(); }, RealtimeCall.AUDIO_WAIT_MS);
      }
      return;
    }
    this.kicked = true;
    if (this.kickTimer) { clearTimeout(this.kickTimer); this.kickTimer = null; }
    try {
      this.dc.send(JSON.stringify({ type: 'session.update', session: this.session(false) }));
      this.dc.send(JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: greetingPrompt(this.mem, this.sess) }] }
      }));
      this.dc.send(JSON.stringify({ type: 'response.create' }));
    } catch { /* channel closing */ }
    this.live = true;
    this.t0 = Date.now();
    this.gateOpen = true;
    this.applyMic();
    this.cb.onPhase?.('live');
    this.scheduleTimeNudges();
    this.scheduleWordGoals();
  }

  /** A turn that is really the loudspeaker: drop it, and stop it happening again.
   *
   *  Dropping matters on its own. Her words filed as the student's do not merely clutter the
   *  transcript — the analysis grades them as the student's French, so a tutor speaking
   *  perfect sentences into her own microphone reads afterwards as a learner who has
   *  suddenly improved, and the corrections and the level estimate are drawn from it.
   *
   *  Then the setup changes for the rest of the call. The default detector is SEMANTIC: it
   *  decides somebody is speaking by understanding them, and it has no loudness threshold at
   *  all, which is exactly why an echo it can understand perfectly well interrupts her. The
   *  acoustic detector has a threshold, and it still honours interrupt_response — so cutting
   *  in on her keeps working, it just has to be a voice in the room rather than a voice
   *  coming back out of the phone. Far-field noise reduction goes on with it, because that
   *  is what the phone-on-the-table case is.
   *
   *  It costs one interruption to learn this, which is the price of not asking every user to
   *  answer a question about their microphone before their first conversation. */
  private catchEcho(itemId: string, text: string): boolean {
    if (!this.cutInOnHer || !looksLikeEcho(text, this.recentTutor)) return false;
    this.echoes++;
    this.items.delete(itemId);
    this.order = this.order.filter(id => id !== itemId);
    this.emitTranscript();
    // Out of the model's context too: she should not be carrying her own words forward as
    // something the student said. Tagged, because the server answers a delete it cannot
    // perform with an error event, and an error event puts a red toast on a screen where
    // nothing has actually gone wrong for the student.
    try {
      if (this.dc?.readyState === 'open') {
        const tag = 'echodel_' + itemId;
        this.quietErrors.add(tag);
        this.dc.send(JSON.stringify({ type: 'conversation.item.delete', event_id: tag, item_id: itemId }));
      }
    } catch { /* channel closing */ }
    if (!this.hardened) {
      this.hardened = true;
      try {
        if (this.dc?.readyState === 'open') {
          this.dc.send(JSON.stringify({ type: 'session.update', session: hardenedInput(this.mem) }));
        }
      } catch { /* channel closing */ }
      this.cb.onEcho?.();
    }
    return true;
  }

  private setTutorSpeaking(on: boolean): void {
    if (!on) this.tutorTail = Date.now() + RealtimeCall.TAIL_MS;
    if (this.tutorSpeaking === on) return;
    this.tutorSpeaking = on;
    this.cb.onTutor?.(on);
  }

  /** Was she audible when this interruption started? Her own last syllable can still be in
   *  the room after the buffer reports playback finished. */
  private audibleNow(): boolean {
    return this.tutorSpeaking || Date.now() < this.tutorTail;
  }

  private applyMic(): void {
    const on = this.gateOpen && !this.userMuted && !this.materialPause && !this.pausedFlag;
    this.mic?.getAudioTracks().forEach(t => (t.enabled = on));
  }

  /** The student opened a cheat sheet: mic off, Odile finishes her sentence and waits. */
  pauseForMaterial(): void {
    this.materialPause = true;
    this.applyMic();
    // Already paused: she has been told to wait, and telling her twice would only put a
    // second stage direction in a conversation she is not supposed to be having.
    if (!this.pausedFlag) this.sendSystemNote(pack(this.mem.profile.target).tutor.notes.materialPause);
  }

  /** Sheet closed: mic back on, Odile picks the thread back up with one short line. */
  resumeFromMaterial(): void {
    this.materialPause = false;
    this.applyMic();
    // Reading a sheet while the call is paused ends where it began: still paused. Nothing
    // is handed back until the pause itself is lifted.
    if (!this.pausedFlag) this.sendSystemNote(pack(this.mem.profile.target).tutor.notes.materialBack, true);
  }

  /** The pause button. The mic closes and Odile is told to hold; on top of that every
   *  clock the call keeps stops with it — the duration, the recorder's audio length, the
   *  one-minute warning and the word-goal reveals — because none of them mean anything
   *  measured against a room the student has left. */
  setPaused(p: boolean): void {
    if (p === this.pausedFlag || this.ended) return;
    this.pausedFlag = p;
    this.applyMic();
    const notes = pack(this.mem.profile.target).tutor.notes;
    if (p) {
      this.pausedAt = Date.now();
      holdTimers(this.nudgeTimers);
      if (this.segTimer) { clearTimeout(this.segTimer); this.segTimer = null; }
      try { if (this.recorder?.state === 'recording') this.recorder.pause(); } catch { /* unsupported: silence gets recorded, and that is all */ }
      this.silenceTutor();
      this.sendSystemNote(notes.paused);
    } else {
      if (this.audioEl) this.audioEl.muted = false;
      this.recPausedMs += this.pausedAt ? Date.now() - this.pausedAt : 0;
      this.pausedMs += this.pausedAt ? Date.now() - this.pausedAt : 0;
      this.pausedAt = 0;
      releaseTimers(this.nudgeTimers);
      try { if (this.recorder?.state === 'paused') this.recorder.resume(); } catch { /* noop */ }
      this.scheduleSegment();
      this.sendSystemNote(notes.resumed, true);
    }
  }

  /** Stops her talking THIS INSTANT, which is what a pause has to mean.
   *
   *  Asking her to finish her sentence was the wrong instruction: the student pressed the
   *  button because they have already left, and a stage note only reaches her after the
   *  audio she has generated has finished playing — so pausing while she spoke let her
   *  speak on, and resuming picked up in the middle of a sentence nobody heard the start
   *  of. Three things have to go, and none of them substitutes for the others: the response
   *  still being generated, the audio the server has already queued for delivery, and the
   *  audio sitting in the local element, which is the only one that stops without a round
   *  trip. */
  private silenceTutor(): void {
    if (this.audioEl) this.audioEl.muted = true;
    try {
      if (this.dc?.readyState === 'open') {
        if (this.responseActive) this.dc.send(JSON.stringify({ type: 'response.cancel' }));
        this.dc.send(JSON.stringify({ type: 'output_audio_buffer.clear' }));
      }
    } catch { /* channel closing: the muted element is enough */ }
    this.responseActive = false;
    this.setTutorSpeaking(false);
  }

  /** Records the raw mic audio in parallel (small opus/aac stream). It is re-transcribed
   *  verbatim so the analysis judges errors from what was actually said, not from live
   *  ASR that may have cleaned them up. The recorder ROTATES every SEGMENT_MS: each
   *  finished segment is a standalone playable file, handed out via onSegment so its
   *  transcription runs during the call — at hang-up only the short tail remains. */
  private startRecorder(): void {
    if (typeof MediaRecorder === 'undefined' || !this.mic) return;
    try {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
      this.recorder = new MediaRecorder(this.mic, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      this.recMime = mime || this.recorder.mimeType || 'audio/webm';
      this.recorder.ondataavailable = e => { if (e.data && e.data.size) this.recChunks.push(e.data); };
      this.recStartedAt = Date.now();
      this.recPausedMs = 0;
      this.recorder.start(1000);
      this.scheduleSegment();
    } catch (e) {
      console.warn('recorder unavailable', e);
      this.recorder = null;
    }
  }

  private scheduleSegment(): void {
    if (!this.cb.onSegment) return; // nobody consumes segments: keep one recording
    if (this.segTimer) clearTimeout(this.segTimer);
    this.segTimer = setTimeout(() => this.rotateRecorder(), RealtimeCall.SEGMENT_MS);
  }

  /** Closes the current segment and starts the next one. Waits for a pause in the
   *  student's speech (up to 24s) so the cut never lands mid-sentence. */
  private rotateRecorder(retries = 8): void {
    if (this.ended || !this.recorder || this.recorder.state === 'inactive' || !this.mic) return;
    if (this.userSpeaking && retries > 0) {
      this.segTimer = setTimeout(() => this.rotateRecorder(retries - 1), 3000);
      return;
    }
    const rec = this.recorder;
    const chunks = this.recChunks;
    const mime = this.recMime;
    const secs = this.recSeconds();
    this.recChunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      if (chunks.length) this.cb.onSegment?.(new Blob(chunks, { type: mime.split(';')[0] }), secs);
    };
    try { rec.stop(); } catch { /* already stopping */ }
    this.recorder = null;
    this.startRecorder();
  }

  /** Stops the recorder and returns the last (unrotated) segment of raw mic audio —
   *  the full call when no onSegment consumer is wired, else just the tail. */
  /** Seconds of audio in the segment currently being recorded. */
  private recSeconds(): number {
    if (!this.recStartedAt) return 0;
    const held = this.recPausedMs + (this.pausedAt ? Date.now() - this.pausedAt : 0);
    return Math.max(0, (Date.now() - this.recStartedAt - held) / 1000);
  }

  recording(): Promise<{ blob: Blob; seconds: number } | null> {
    return new Promise(resolve => {
      const secs = this.recSeconds();
      const finish = () => resolve(
        this.recChunks.length
          ? { blob: new Blob(this.recChunks, { type: this.recMime.split(';')[0] }), seconds: secs }
          : null
      );
      const rec = this.recorder;
      if (!rec || rec.state === 'inactive') return finish();
      const to = setTimeout(finish, 1500);
      rec.onstop = () => { clearTimeout(to); finish(); };
      try { rec.stop(); } catch { clearTimeout(to); finish(); }
    });
  }

  /** Live transcription model actually in use (the mint may fall back to the legacy one). */
  transcribeModel(): string {
    return this.effectiveTransModel || this.mem.settings.transcribeModel || 'gpt-transcribe';
  }

  /** Injects silent stage directions so the tutor lands the 3–5 minute format. */
  private sendSystemNote(text: string, forceResponse = false): void {
    if (!this.dc || this.dc.readyState !== 'open') return;
    try {
      this.dc.send(JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'system', content: [{ type: 'input_text', text }] }
      }));
      if (forceResponse) this.dc.send(JSON.stringify({ type: 'response.create' }));
    } catch { /* channel closing */ }
  }

  private scheduleTimeNudges(): void {
    const mins = this.sess.minutes ?? this.mem.settings.minutesHint ?? 4;
    if (!mins || mins <= 0) return;
    const notes = pack(this.mem.profile.target).tutor.notes;
    this.nudgeTimers.push(holdable(Math.max(30, (mins - 1) * 60) * 1000, () => {
      this.sendSystemNote(notes.oneMinute);
    }));
    this.nudgeTimers.push(holdable((mins * 60 + 20) * 1000, () => {
      this.sendSystemNote(notes.timeUp, true);
    }));
    this.nudgeTimers.push(holdable((mins * 60 + 100) * 1000, () => {
      this.sendSystemNote(notes.overtime, true);
    }));
  }

  /** Reveals the call's word goals a third and two thirds of the way in. Both land before
   *  the one-minute warning, so a word still has somewhere to go when it appears. */
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
    // Already said it unprompted: the push was not needed, and showing it now would ask for
    // something the learner has just done. It drops out of the call without a word.
    if (this.spokenSoFar().some(text => goalPlaced(text, g, this.mem.profile.target))) { g.used = true; return; }
    g.revealed = true;
    this.emitGoals();
    this.sendSystemNote(pack(this.mem.profile.target).tutor.notes.wordGoal(g.word));
  }

  private spokenSoFar(): string[] {
    return this.order.map(id => this.items.get(id)!).filter(it => it?.role === 'user').map(it => it.text || '');
  }

  /** One finished learner turn against the goals currently on screen. */
  private checkGoals(text: string): void {
    let hit = false;
    for (const g of this.goals) {
      if (!g.revealed || g.used || !goalPlaced(text, g, this.mem.profile.target)) continue;
      g.used = true;
      hit = true;
      this.sendSystemNote(pack(this.mem.profile.target).tutor.notes.wordGoalDone(g.word));
    }
    if (hit) this.emitGoals();
  }

  private emitGoals(): void {
    this.cb.onGoals?.(this.goals.filter(g => g.revealed).map(g => ({ ...g })));
  }

  /** The call's word goals and what became of them, for the session record.
   *
   *  Swept once more over everything actually said, because the live check only ever sees
   *  turns that ARRIVE after a goal is revealed — a word placed in the turn the reveal
   *  interrupted, or in one whose transcription lands as the call ends, was used and not
   *  counted. Being told you missed a word you said is the one way this feature can be
   *  worse than not having it. */
  wordGoals(): WordGoalResult[] {
    const said = this.spokenSoFar();
    return this.goals.map(g => ({ word: g.word, used: g.used || said.some(t => goalPlaced(t, g, this.mem.profile.target)) }));
  }

  /** 0..1 output level from the remote stream, for lip-sync. */
  level(): number {
    if (!this.analyser || !this.buf) return 0;
    this.analyser.getByteFrequencyData(this.buf);
    let sum = 0;
    const n = Math.min(64, this.buf.length);
    for (let i = 2; i < n; i++) sum += this.buf[i];
    return Math.min(1, sum / n / 110);
  }

  mute(m: boolean): void {
    this.userMuted = m;
    this.applyMic();
  }

  /** Conversation time: wall clock since the session went live, minus everything spent
   *  paused. It is what the timer on screen reads, what the session record keeps and what
   *  the per-minute legs of the ledger are billed against, so a pause has to come out of
   *  all three at once. */
  seconds(): number {
    if (!this.t0) return 0;
    const paused = this.pausedMs + (this.pausedAt ? Date.now() - this.pausedAt : 0);
    return Math.max(0, Date.now() - this.t0 - paused) / 1000;
  }

  /** Accumulated token usage across all responses of this call. */
  usage(): RealtimeUsage {
    return { ...this.usageTotals };
  }

  /** Nothing to hand over: this engine's legs are priced from usage() and the call
   *  duration, the way the ledger has always read them (see app.tsx endCall). */
  costEntries(): [] { return []; }

  /** Live ASR tidies learner errors up, so this engine has no verbatim of its own — the
   *  post-call pass over the raw recording is where that text comes from. */
  verbatimText(): null { return null; }

  /** Final transcript. Consecutive same-role items are one conversational turn that the
   *  VAD happened to commit in pieces, so they are stitched back together here — the live
   *  caption stream stays unstitched so captions still appear as they are spoken. */
  transcript(): TranscriptItem[] {
    return stitchTranscript(this.order.map(id => this.items.get(id)!).filter(it => (it.text || '').trim()));
  }

  stop(): void {
    this.ended = true;
    clearHeld(this.nudgeTimers);
    this.nudgeTimers = [];
    if (this.kickTimer) { clearTimeout(this.kickTimer); this.kickTimer = null; }
    if (this.warmTimer) { clearTimeout(this.warmTimer); this.warmTimer = null; }
    if (this.waitTimer) { clearTimeout(this.waitTimer); this.waitTimer = null; }
    if (this.segTimer) { clearTimeout(this.segTimer); this.segTimer = null; }
    try { if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop(); } catch { /* noop */ }
    try { this.dc?.close(); } catch { /* noop */ }
    try { this.pc?.close(); } catch { /* noop */ }
    try { this.mic?.getTracks().forEach(t => t.stop()); } catch { /* noop */ }
    if (this.ctx && this.ctx.state !== 'closed') { void this.ctx.close().catch(() => { /* already closing */ }); }
    this.ctx = null;
    if (this.audioEl) {
      this.audioEl.onplaying = null;
      this.audioEl.srcObject = null;
      try { this.audioEl.remove(); } catch { /* never mounted */ }
    }
  }
}
