import { useEffect, useRef, useState } from 'preact/hooks';
import type { CallSession, Memory, TranscriptItem, WordGoalResult } from '../types';
import type { CallEngine, CostEntry } from '../lib/engine';
import { RealtimeCall, type LiveGoal } from '../lib/realtime';
import { TurnCall } from '../lib/turncall';
import { sheetsById } from '../lib/sheets';
import { dragOffset, SWIPE_END_PX, swipeArmed } from '../lib/swipe';
import { keepAwake } from '../lib/wakelock';
import { fmtDur } from '../lib/utils';
import { Odile, type AvatarState } from '../components/Avatar';
import { SheetView } from '../components/SheetView';
import { I } from '../components/icons';
import { ui } from '../lang';

export interface CallResult {
  transcript: TranscriptItem[];
  seconds: number;
  dropped: boolean;
  /** Raw mic recording for the verbatim re-transcription (null if unavailable). */
  audioBlob: Blob | null;
  /** Seconds of audio in that recording, for per-minute transcription billing. */
  audioSeconds: number;
  /** Live transcription model the session actually used (billed per minute of call audio). */
  transcribeModel: string;
  /** The words this call asked the learner to place, and whether they landed. */
  wordGoals: WordGoalResult[];
  /** Realtime token usage for the cost ledger. Zeroed by the turn-by-turn engine, which
   *  bills nothing this way and reports `costEntries` instead. */
  usage: {
    input_tokens: number; output_tokens: number;
    audio_input_tokens: number; audio_output_tokens: number;
    cached_input_tokens: number; cached_audio_input_tokens: number;
  };
  /** Per-leg usage from an engine that prices its own pieces (turn-by-turn: transcription,
   *  thinking, voice). Empty for the realtime engine. */
  costEntries: CostEntry[];
  /** The student's own words, verbatim, when the engine already has them — the turn engine
   *  transcribes every turn on the way in, so re-transcribing the call would pay twice. */
  verbatim: string | null;
}

interface Props {
  mem: Memory;
  sess: CallSession;
  toast: (msg: string, err?: boolean) => void;
  onEnd: (r: CallResult) => void;
  onFail: (why: 'auth' | 'error') => void;
  /** Finished mic-recording segments stream out during the call (verbatim pipeline). */
  onSegment?: (blob: Blob, seconds: number) => void;
}

type Phase = 'mic' | 'connect' | 'config' | 'live';
type TurnPhase = 'listening' | 'thinking' | 'speaking' | 'idle';

export function Call({ mem, sess, toast, onEnd, onFail, onSegment }: Props) {
  const S = ui();
  const [phase, setPhase] = useState<Phase>('mic');
  // Turn-by-turn engine only: where the conversation is between the two of them. The
  // realtime engine never reports it and the whole strip below stays hidden.
  const turns = mem.settings.callEngine === 'turns';
  const [turn, setTurn] = useState<TurnPhase>('idle');
  const [tutorOn, setTutorOn] = useState(false);
  const [userOn, setUserOn] = useState(false);
  const [secs, setSecs] = useState(0);
  // Captions are a gesture, not a mode: nothing is on screen while she talks, you ask for
  // her line when you want it, and it goes once she has finished saying it. The setting
  // keeps standing subtitles available for anyone who needs them.
  const [caps, setCaps] = useState(mem.settings.captions === true);
  const capT = useRef<ReturnType<typeof setTimeout>>();
  const [muted, setMuted] = useState(false);
  // Stepped away: she is told to hold, the mic is dead, and the clock stops — so a pause
  // costs nothing and takes nothing out of the few minutes the call is meant to be.
  const [paused, setPaused] = useState(false);
  const [trans, setTrans] = useState<TranscriptItem[]>([]);
  const [lvl, setLvl] = useState(0);
  /** How far the stop button has been dragged, and how far it has to go. Ending a call is
   *  the one irreversible thing on this screen and it sits under the thumb for ten minutes,
   *  so it asks for a gesture nothing else on the screen makes by accident. */
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef(0);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const [autoEnd, setAutoEnd] = useState(false);
  const [goals, setGoals] = useState<LiveGoal[]>([]);
  // The engine is created once, so its callback closes over the first render's state: what
  // has already been announced lives in a ref, which does not go stale.
  const toasted = useRef(new Set<string>());

  // end_call fired: let her goodbye audio finish, then end without any tapping.
  useEffect(() => {
    if (!autoEnd || tutorOn || paused) return;
    const t = setTimeout(() => { toast(S.call.autoEnded); void finish(false); }, 1000);
    return () => clearTimeout(t);
  }, [autoEnd, tutorOn, paused]);
  const [showMat, setShowMat] = useState(false);
  const materials = sheetsById(sess.materials);
  const rc = useRef<CallEngine | null>(null);

  const openMat = () => { setShowMat(true); rc.current?.pauseForMaterial(); };
  const closeMat = () => { setShowMat(false); rc.current?.resumeFromMaterial(); };

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    rc.current?.setPaused(next);
  };

  /* The stop button does two jobs, and which one it does is decided by the gesture rather
     than by a dialog. A tap holds the call — the common case by far, and the one a student
     reaches for when the doorbell goes. A drag to the right ends it, which is deliberate
     enough that nothing has to ask "are you sure": the question and the answer are the same
     movement. */
  const dragTo = (x: number) => { dragRef.current = x; setDragX(x); };
  const onDragStart = (e: PointerEvent) => {
    dragFrom.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* older browser */ }
  };
  const onDragMove = (e: PointerEvent) => {
    const from = dragFrom.current;
    if (!from) return;
    const off = dragOffset(from, { x: e.clientX, y: e.clientY });
    if (off == null) { dragFrom.current = null; dragTo(0); return; }  // a scroll, not a swipe
    dragTo(off);
  };
  const onDragEnd = () => {
    const armed = dragFrom.current !== null && swipeArmed(dragRef.current);
    dragFrom.current = null;
    dragTo(0);
    if (armed) { swiped.current = true; void finish(false); }
  };
  const onStopTap = () => {
    if (swiped.current) { swiped.current = false; return; }   // the click that follows a drag
    // Nothing to hold before she is on the line: the tap is the only way out of a call that
    // never started, and making the student discover a swipe to escape that would be cruel.
    if (phase !== 'live') { void finish(false); return; }
    togglePause();
  };

  /** Show what she is saying now. While she is still talking the line stays and grows
   *  with the transcript; five seconds after she stops it fades, and the next one has to
   *  be asked for again. */
  const showCaption = () => {
    clearTimeout(capT.current);
    setCaps(true);
  };
  useEffect(() => {
    if (!caps || mem.settings.captions === true) return;   // standing subtitles never fade
    if (tutorOn) { clearTimeout(capT.current); return; }   // she is mid-sentence: hold it
    capT.current = setTimeout(() => setCaps(false), 5000);
    return () => clearTimeout(capT.current);
  }, [caps, tutorOn]);
  useEffect(() => () => clearTimeout(capT.current), []);

  const ending = useRef(false);
  const finish = async (drop: boolean) => {
    const eng = rc.current;
    if (!eng || ending.current) return;
    ending.current = true;
    const transcript = eng.transcript();
    const seconds = eng.seconds();
    const usage = eng.usage();
    const rec = await eng.recording();
    const transcribeModel = eng.transcribeModel();
    const wordGoals = eng.wordGoals();
    const costEntries = eng.costEntries();
    const verbatim = eng.verbatimText();
    eng.stop();
    onEnd({
      transcript, seconds, dropped: drop, usage, transcribeModel, wordGoals, costEntries, verbatim,
      audioBlob: rec?.blob ?? null, audioSeconds: rec?.seconds ?? 0
    });
  };

  useEffect(() => {
    const Engine = turns ? TurnCall : RealtimeCall;
    const eng: CallEngine = new Engine(mem, sess, {
      onPhase: p => setPhase(p),
      onTurnPhase: setTurn,
      onTutor: setTutorOn,
      onUser: setUserOn,
      onTranscript: setTrans,
      onError: m => toast(m, true),
      onDrop: () => void finish(true),
      onHangup: () => setAutoEnd(true), // Odile hangs up herself after the goodbyes
      onGoals: next => {
        // Only ever announce the transition: a goal card that appears already ticked would
        // mean the learner said the word before being asked, and that is not a win to toast.
        for (const g of next) {
          if (!g.used || toasted.current.has(g.word)) continue;
          toasted.current.add(g.word);
          toast(S.call.goalHit(g.word));
        }
        setGoals(next);
      },
      onEcho: () => toast(S.call.echoHeard),
      onSegment
    });
    rc.current = eng;
    eng.start().catch(e => {
      if ((e as Error).message === 'AUTH') onFail('auth');
      else { toast(S.call.connFailed((e as Error).message), true); onFail('error'); }
    });
    // Held for the whole screen, pauses included. A pause is exactly when the phone would
    // lock — the student has put it down — and on iOS a locked page is a suspended page,
    // which takes the connection with it. Letting go during a pause would turn every pause
    // into a hang-up.
    const wake = keepAwake();
    // The engine owns the clock: it is the one that stops for a pause, and the one the
    // session record and the ledger are written from. A second counter here would drift
    // from both the moment anything was paused.
    const ti = setInterval(() => setSecs(Math.round(eng.seconds())), 1000);
    let raf = 0;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const v = eng.level();
      setLvl(p => (Math.abs(p - v) > 0.04 ? v : p));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { alive = false; cancelAnimationFrame(raf); clearInterval(ti); wake(); eng.stop(); };
  }, []);

  const thinking = turns && turn === 'thinking';
  const state: AvatarState =
    paused ? 'idle' :
    tutorOn ? 'speaking' : userOn ? 'listening' : thinking || phase !== 'live' ? 'thinking' : 'idle';
  const stateTxt =
    phase === 'mic' ? S.call.micStage :
    phase === 'connect' ? S.call.connecting :
    phase === 'config' ? S.call.configuring :
    paused ? S.call.pausedState :
    showMat ? S.call.readsSheet :
    thinking ? S.call.thinks :
    tutorOn ? S.call.speaks : userOn ? S.call.listens : S.call.yourTurn;
  /* The turn engine's one control, standing in for the mute button that mode has no use
     for: it ends your turn while you are talking, and cuts her short while she is. */
  const turnBtn =
    turn === 'speaking'
      ? { label: S.call.turnSkip, icon: <I.chev />, on: false, act: () => rc.current?.skipTurn?.() }
      : turn === 'listening'
      ? { label: S.call.turnDone, icon: <I.check />, on: true, act: () => rc.current?.commitTurn?.() }
      : { label: S.call.thinks, icon: <I.mic />, on: false, act: undefined };
  // Live ASR of learner speech is too rough to display; only Odile's line is captioned.
  const lastCaps = trans.filter(t => t.role === 'assistant').slice(-1);

  return (
    /* Her screen, blue edge to edge: the topic she is on, the clock in yellow, and Odile
       at full size in the middle of it. Nothing here is a dashboard — the call is a scene
       with a person in it. */
    <div class={'stage call' + (paused ? ' onhold' : '')}>
      <div class="callhead">
        {sess.topic && sess.mode !== 'intro'
          ? <span class="calltopic" lang={mem.profile.target}>{sess.topicFr || sess.topic}</span>
          : <span></span>}
        <span class="calltimer">{fmtDur(secs)}</span>
      </div>
      {showMat && <SheetView sheets={materials} closeLabel={S.call.resumeCall} onClose={closeMat} />}
      <div class="avatar-wrap">
        <div class="avatar-disc"><Odile level={paused ? 0 : lvl} state={state} /></div>
      </div>
      <div class="callname">Odile</div>
      <div class="callstate">{stateTxt}</div>
      {paused && <div class="pausednote">{S.call.pausedNote}</div>}
      {/* Only the sheet. What she is listening for was a row of chips restating the
          briefing at the one moment it cannot be acted on — you are already talking. */}
      {materials.length > 0 && (
        <div class="focus-strip">
          <button class="matbtn" onClick={openMat}>
            📄 {materials.length > 1 ? S.call.sheets : S.call.sheet} : {materials.map(m => m.title).join(' · ')}
          </button>
        </div>
      )}
      {goals.length > 0 && (
        <div class="wordgoals">
          {goals.map(g => (
            <div key={g.word} class={'wordgoal' + (g.used ? ' done' : '')}>
              <span class="wg-kicker">{g.used ? S.call.goalDone : S.call.goalKicker}</span>
              <span class="wg-word" lang={mem.profile.target}>{g.word}</span>
              {g.gloss && !g.used && <span class="wg-gloss" lang={mem.profile.native}>{g.gloss}</span>}
              {g.used && <span class="wg-tick"><I.check /></span>}
            </div>
          ))}
        </div>
      )}
      {lastCaps.length > 0 && (
        <div class={'captions' + (caps ? '' : ' gone')} aria-hidden={!caps}>
          {lastCaps.map((it, i) => <div key={it.id ?? i} class={'cap ' + (it.role === 'user' ? 'me' : 'tutor')} lang={mem.profile.target}>{it.text}</div>)}
        </div>
      )}
      <div class="callbar">
        <div class="cbtn">
          {turns ? (
            <button class={'callbtn ' + (turnBtn.on && !paused ? 'on' : '')} title={turnBtn.label}
              disabled={paused || !turnBtn.act} onClick={turnBtn.act}>
              <span style="width:22px;display:inline-flex">{turnBtn.icon}</span>
            </button>
          ) : (
            <button class={'callbtn ' + (muted ? 'on' : '')} title={S.call.mute} disabled={paused}
              onClick={() => { const m = !muted; setMuted(m); rc.current?.mute(m); }}>
              <span style="width:22px;display:inline-flex">{muted ? <I.micoff /> : <I.mic />}</span>
            </button>
          )}
          <span class="blabel">{turns ? turnBtn.label : muted ? S.call.muted : S.call.mic}</span>
        </div>
        {/* One control where there were two. A tap holds the call and a tap gives it back;
            ending it is a drag to the right, along a rail that only appears once the
            button is under a finger. The gesture is the confirmation. */}
        <div class="cbtn">
          <div class={'endrail' + (dragX >= SWIPE_END_PX ? ' armed' : '')}>
            {dragX > 0 && <span class="endrail-x" aria-hidden="true"><I.down /></span>}
            <button
              class={'callbtn end' + (paused ? ' held' : '') + (dragX > 0 ? ' dragging' : '')}
              style={dragX ? `transform:translateX(${dragX}px)` : undefined}
              title={paused ? S.call.resume : S.call.pause}
              aria-label={paused ? S.call.resume : S.call.pause}
              onPointerDown={onDragStart as unknown as (e: Event) => void}
              onPointerMove={onDragMove as unknown as (e: Event) => void}
              onPointerUp={onDragEnd} onPointerCancel={onDragEnd}
              onClick={onStopTap}>
              <span style="width:28px;display:inline-flex">{paused ? <I.play /> : <I.pause />}</span>
            </button>
          </div>
          {/* Two words, never a sentence: this label sits under a 74px button between two
              others, and an explanation of the gesture was long enough to run across its
              neighbours and land on top of them. It reads "Pause" until the button starts
              moving, and the name of what letting go would do after that. */}
          <span class="blabel">
            {dragX > 0 || phase !== 'live' ? S.call.hangup
              : paused ? S.call.resume : S.call.pause}
          </span>
        </div>
        <div class="cbtn">
          <button class={'callbtn ' + (caps ? 'on' : '')} title={S.call.captions}
            onClick={() => (mem.settings.captions === true ? setCaps(!caps) : showCaption())}>
            <span style="width:22px;display:inline-flex"><I.cc /></span>
          </button>
          <span class="blabel">{S.call.captions}</span>
        </div>
      </div>
    </div>
  );
}
