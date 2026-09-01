import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Card, Grade, Memory } from '../types';
import { reviewSessionsOn, touchStreak, reviewXp } from '../lib/gamify';
import { LANGS } from '../lib/langs';
import { startRec, type Rec } from '../lib/recorder';
import { clearRevState, loadRevState, saveRevState } from '../lib/revstate';
import { beyondPlan, sittingPlan } from '../lib/budget';
import { logEvent } from '../lib/events';
import { wordGender } from '../lib/gender';
import { buildSession, grade as gradeCard, previewDays, showExample } from '../lib/srs';
import { saveMem } from '../lib/storage';
import { isSpeaking, prefetch, speak, stopSpeaking } from '../lib/tts';
import { SpeakBtn } from '../components/SpeakBtn';
import { deepClone, fmtDay, todayISO } from '../lib/utils';
import { CardImg } from '../components/CardImg';
import { Bust, Odile } from '../components/Avatar';
import { ClozeText } from '../components/Scene';
import { I } from '../components/icons';
import { dragOffset, SWIPE_BACK_PX, swipeArmed } from '../lib/swipe';
import { Personalize } from '../components/Personalize';
import { ui } from '../lang';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  onExit: () => void;
  toast?: (msg: string, err?: boolean) => void;
  /** Morning primer: cap the queue (e.g. 3 cards right before the call). */
  cap?: number;
}

/** Everything one move changes, kept so the move can be taken back. */
interface Step {
  queue: string[];
  seen: number;
  stats: { again: number; hard: number; good: number; easy: number };
  revealed: boolean;
  graded: string[];
  started: number;
  /** The card as it stood before it was graded. Absent when the step was only a reveal. */
  card?: Card;
}

/** One evening review session, Fluent-Forever style: ~15 cards, four grades, audio on reveal. */
export function ReviewSession({ mem, setMem, onExit, toast, cap }: Props) {
  const S = ui();
  const langName = (LANGS[mem.profile.target] ?? LANGS.fr).name;
  const TYPE_LABEL = { cloze: S.rev.typeCloze, fr2de: S.rev.typeToNative, de2fr: S.rev.typeToTarget(langName) } as const;
  // A session interrupted by a reload resumes where it was (same day, cards intact).
  const saved = useMemo(() => loadRevState(new Set(mem.deck.cards.map(c => c.id))), []);
  const initialQueue = useMemo(
    // Sittings already finished today, counted BEFORE this one starts: past the day's plan
    // the new-card throttle comes off, so a third sitting is a real sitting.
    () => (saved?.queue ?? (() => {
      const sittings = reviewSessionsOn(mem, todayISO());
      const plan = sittingPlan(mem, sittings, todayISO());
      return buildSession(mem.deck, mem.settings.sessionSize, plan.newCap,
        todayISO(), beyondPlan(mem.settings, sittings), plan.dueCap).map(c => c.id);
    })()).slice(0, cap ?? Infinity),
    []
  );
  const initialLen = useRef(saved?.initialLen ?? initialQueue.length);
  const gradedIds = useRef(new Set<string>(saved?.graded ?? []));
  /** Cards this sitting saw for the first time, for the deck's throughput (lib/pace). */
  const started = useRef(0);
  /** One undoable step per entry, pushed BEFORE the thing it undoes.
   *
   *  A review has exactly two moves — turning a card over, and grading it — and going back
   *  has to undo either. Snapshotting the whole of the small state is what makes that one
   *  code path instead of two: restoring a grade means putting the card's schedule back
   *  where it was, and "again" also puts the card back into the queue three places along,
   *  which no per-field undo would have caught. The card is copied before grade() touches
   *  it, because grade() rewrites ease, interval, reps, lapses, due and state together. */
  const history = useRef<Step[]>([]);
  /** How far the card has been dragged towards going back, and whether that drag has
   *  already fired — a click follows a pointerup on the same element, and without this the
   *  swipe would land as a tap and turn the card over. */
  const [backX, setBackX] = useState(0);
  const backRef = useRef(0);
  const backFrom = useRef<{ x: number; y: number } | null>(null);
  const backSwiped = useRef(false);
  const [queue, setQueue] = useState<string[]>(initialQueue);
  const [seen, setSeen] = useState(saved?.seen ?? 0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState(saved?.stats ?? { again: 0, hard: 0, good: 0, easy: 0 });
  const [finished, setFinished] = useState(initialQueue.length === 0);
  const [waitingAudio, setWaitingAudio] = useState(false);
  const [personalizing, setPersonalizing] = useState(false);
  const t0 = useRef(Date.now() - (saved?.elapsed ?? 0) * 1000);
  const memRef = useRef(mem);
  memRef.current = mem;
  const speakP = useRef<Promise<void> | null>(null);

  // Optional spoken answers (Réglages): record before the reveal, replay to compare.
  const speakAns = mem.settings.speakAnswers === true;
  const [recOn, setRecOn] = useState(false);
  const [answerUrl, setAnswerUrl] = useState<string | null>(null);
  const ansRec = useRef<Rec | null>(null);
  const stopAnswerRec = async () => {
    if (!ansRec.current) return;
    const r = ansRec.current;
    ansRec.current = null;
    setRecOn(false);
    const blob = await r.stop();
    if (blob.size > 2000) setAnswerUrl(url => { if (url) URL.revokeObjectURL(url); return URL.createObjectURL(blob); });
  };
  const toggleAnswerRec = async (e: Event) => {
    e.stopPropagation();
    if (ansRec.current) { void stopAnswerRec(); return; }
    try { ansRec.current = await startRec(); setRecOn(true); } catch { toast?.(S.flu.failMic, true); }
  };
  useEffect(() => { if (revealed && ansRec.current) void stopAnswerRec(); }, [revealed]);
  useEffect(() => () => { ansRec.current?.cancel(); }, []);

  const total = initialLen.current + stats.again; // "again" cards come around twice or more
  const card = queue.length ? mem.deck.cards.find(c => c.id === queue[0]) : undefined;

  // The clip is fetched when the card APPEARS (plus the next one), so the reveal plays
  // instantly instead of arriving over the next card.
  // Session-local audio toggle (headphone-less train): starts from the setting,
  // switchable right in the session header without a settings detour.
  const [audioOn, setAudioOn] = useState(mem.settings.cardAudio);

  useEffect(() => {
    if (!audioOn) return;
    for (const id of queue.slice(0, 2)) {
      const c = mem.deck.cards.find(x => x.id === id);
      if (c?.audioText) prefetch(c.audioText);
    }
  }, [queue, audioOn]);

  useEffect(() => {
    if (revealed && card?.audioText && audioOn) {
      speakP.current = speak(card.audioText, s => { if (s === 'error') toast?.(S.common.audioFail, true); });
    }
  }, [revealed]);

  // Keyboard: Space/Enter flips, 1-4 grade (desktop reviews without a mouse).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (personalizing || finished || (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); return; }
      // Not a button on the screen, but a keyboard has room for what a thumb has to swipe for.
      if (e.key === 'Backspace' || e.key === 'ArrowLeft') { e.preventDefault(); goBack(); return; }
      if (revealed && !waitingAudio && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        void onGrade((['again', 'hard', 'good', 'easy'] as Grade[])[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => () => stopSpeaking(), []);

  const finish = (finalStats: typeof stats, m: Memory) => {
    clearRevState();
    const doneCount = Object.values(finalStats).reduce((a, b) => a + b, 0);
    if (doneCount > 0) {
      const xp = reviewXp(doneCount);
      m.deck.log.push({
        date: todayISO(), total: doneCount,
        again: finalStats.again, hard: finalStats.hard, good: finalStats.good, easy: finalStats.easy,
        seconds: Math.round((Date.now() - t0.current) / 1000), xp,
        ...(started.current ? { started: started.current } : {}),
        ...(cap ? { warmup: 1 as const } : {})
      });
      if (m.deck.log.length > 120) m.deck.log = m.deck.log.slice(-120);
      logEvent('review', Math.round((Date.now() - t0.current) / 1000), { cards: doneCount, warmup: !!cap });
      m.xp += xp;
      touchStreak(m, todayISO());
      saveMem(m);
      setMem(m);
    }
    setFinished(true);
  };

  /** The state as it stands right now, for the stack. */
  /** Something to go back TO. Drives the cue on the card, so the gesture advertises itself
   *  exactly when it would do something. */
  const canGoBack = history.current.length > 0;

  const snapshot = (over: Partial<Step> = {}): Step => ({
    queue, seen, stats, revealed, started: started.current,
    graded: [...gradedIds.current], ...over
  });

  /** Turning the card over is a move like any other, so it goes on the stack too: the first
   *  swipe back from an answer shows the question again rather than skipping the card. */
  const reveal = () => {
    if (revealed) return;
    history.current.push(snapshot());
    setRevealed(true);
  };

  /** One step back: the previous side of this card, or the previous card with its grade
   *  taken off. Silent when there is nothing to undo — a swipe on the first question is a
   *  student finding out what the gesture does, not an error. */
  const goBack = () => {
    const step = history.current.pop();
    if (!step) return;
    stopSpeaking();
    speakP.current = null;
    setWaitingAudio(false);
    if (step.card) {
      const m = deepClone(memRef.current);
      const i = m.deck.cards.findIndex(x => x.id === step.card!.id);
      if (i >= 0) m.deck.cards[i] = deepClone(step.card);
      saveMem(m);
      setMem(m);
    }
    setQueue(step.queue);
    setSeen(step.seen);
    setStats(step.stats);
    setRevealed(step.revealed);
    started.current = step.started;
    gradedIds.current = new Set(step.graded);
    setAnswerUrl(url => { if (url) URL.revokeObjectURL(url); return null; });
    saveRevState({
      queue: step.queue, seen: step.seen, stats: step.stats, initialLen: initialLen.current,
      graded: step.graded, elapsed: Math.round((Date.now() - t0.current) / 1000), date: todayISO()
    });
  };

  const onBackDown = (e: PointerEvent) => {
    backFrom.current = { x: e.clientX, y: e.clientY };
    backSwiped.current = false;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* older browser */ }
  };
  const onBackMove = (e: PointerEvent) => {
    const from = backFrom.current;
    if (!from) return;
    const off = dragOffset(from, { x: e.clientX, y: e.clientY }, SWIPE_BACK_PX);
    if (off == null) { backFrom.current = null; backRef.current = 0; setBackX(0); return; }
    backRef.current = off;
    setBackX(off);
  };
  const onBackUp = () => {
    const armed = backFrom.current !== null && swipeArmed(backRef.current, SWIPE_BACK_PX);
    backFrom.current = null;
    backRef.current = 0;
    setBackX(0);
    if (armed) { backSwiped.current = true; goBack(); }
  };

  const onGrade = async (g: Grade) => {
    if (!card || waitingAudio) return;
    const m = deepClone(memRef.current);
    const c = m.deck.cards.find(x => x.id === card.id)!;
    // Before grade() touches it: it rewrites ease, interval, reps, lapses, due and state
    // together, so the only honest undo is the card as it stood.
    history.current.push(snapshot({ card: deepClone(c) }));
    // Counted before grading moves it: this is the card leaving the unstarted pile.
    if (c.reps === 0) started.current++;
    gradeCard(c, g);
    gradedIds.current.add(card.id);
    const newStats = { ...stats, [g]: stats[g] + 1 };
    setStats(newStats);
    let q = queue.slice(1);
    let nextSeen = seen;
    if (g === 'again') {
      const pos = Math.min(3, q.length);
      q = [...q.slice(0, pos), card.id, ...q.slice(pos)];
    } else {
      nextSeen = seen + 1;
      setSeen(nextSeen);
    }
    saveMem(m);
    setMem(m);
    if (q.length) {
      saveRevState({
        queue: q, seen: nextSeen, stats: newStats, initialLen: initialLen.current,
        graded: [...gradedIds.current], elapsed: Math.round((Date.now() - t0.current) / 1000), date: todayISO()
      });
    }
    // Let the pronunciation finish before the next card appears (usually already done).
    if (audioOn && speakP.current && isSpeaking()) {
      setWaitingAudio(true);
      await Promise.race([speakP.current, new Promise(r => setTimeout(r, 6000))]);
      setWaitingAudio(false);
    }
    speakP.current = null;
    setRevealed(false);
    setAnswerUrl(url => { if (url) URL.revokeObjectURL(url); return null; });
    if (q.length === 0) finish(newStats, m);
    else setQueue(q);
  };

  if (finished) {
    const done = Object.values(stats).reduce((a, b) => a + b, 0);
    const uniq = gradedIds.current.size || done; // distinct cards, not grade events
    return (
      <div class="rev-stage fadein">
        <div style="position:relative;height:236px;flex-shrink:0;background:var(--blue);border-radius:var(--r);overflow:hidden">
          <div style="position:absolute;left:50%;transform:translateX(-50%);bottom:-22px;width:200px;height:200px"><Odile state="idle" /></div>
        </div>
        <div style="margin-top:22px">
          <div class="kicker">{S.rev.finishedTitle}</div>
          <h2 style="font-size:32px;line-height:1.08;margin-top:8px">{done ? S.rev.doneCards(uniq) : S.rev.nothing}</h2>
          {done > 0 && (
            <div style="margin-top:14px;font-size:14.5px;line-height:1.5;color:var(--ink2);text-wrap:pretty">
              {S.rev.sessionLine(stats.good + stats.easy, stats.hard, stats.again, done + 5)}
            </div>
          )}
        </div>
        <div class="rev-actions" style="margin-top:auto">
          <button class="cta" onClick={onExit}><span>{S.common.done}</span></button>
        </div>
      </div>
    );
  }

  if (!card) return null;
  const progress = total ? Math.min(1, seen / Math.max(1, initialLen.current)) : 0;
  // Nothing in this deck is pre-made: every card names the call it fell out of, and says
  // in one line why it exists. That provenance IS the mnemonic in La Troupe.
  const src = card.sourceSessionId ? mem.sessions.find(x => x.id === card.sourceSessionId) : undefined;
  const day = src ? fmtDay(src.date) : null;
  const kicker = day && card.sourceKind === 'correction' ? S.rev.fromCall(day)
    : day && card.sourceKind === 'vocab' ? S.rev.askedWord(day)
    : TYPE_LABEL[card.type];
  const provenance = card.sourceKind === 'correction' ? S.rev.sheRecast
    : card.sourceKind === 'vocab' ? S.rev.youAsked : null;
  const gender = wordGender(card, mem.profile.target);

  return (
    <div class="rev-stage fadein">
      <div class="rev-top">
        <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={() => finish(stats, deepClone(memRef.current))}>{S.rev.finish}</button>
        <div class="rev-bar"><i style={{ width: progress * 100 + '%' }}></i></div>
        <button class={'speakbtn sm' + (audioOn ? '' : ' failed')} title={S.settings.cardAudio} aria-label={S.settings.cardAudio} aria-pressed={audioOn}
          onClick={() => { if (audioOn) stopSpeaking(); setAudioOn(!audioOn); }}>
          {audioOn ? <I.speaker /> : <I.speakeroff />}
        </button>
        <span class="tiny" style="width:44px;text-align:right">{seen}/{initialLen.current}</span>
      </div>

      {/* Back is a gesture, not a control: a drag to the right undoes the last move — the
          answer goes back to its question, or the previous card comes back with its grade
          taken off. There is no button because there is no room for one that would be
          pressed once a session, and because the card is already the thing under the thumb. */}
      {/* The card wears the gender of the word on it — blue masculine, pink feminine, and
          the usual yellow where the entry declares neither. Same convention the picture
          prompts use (a queen in red, a king in blue), so a learner meets one idea twice
          rather than two.
          Only once it is turned over. On the question side the colour would be the answer:
          "die Vorstellung → ?" on a pink card has already told you it is la, which is
          exactly the half of the word this deck exists to make you produce. */}
      <div class={'rev-card' + (revealed && gender ? ' g-' + gender : '') + (backX > 0 ? ' dragging' : '') + (canGoBack ? ' hasback' : '')}
        style={(revealed ? '' : 'cursor:pointer;') + (backX ? `transform:translateX(${backX}px)` : '')}
        onPointerDown={onBackDown as unknown as (e: Event) => void}
        onPointerMove={onBackMove as unknown as (e: Event) => void}
        onPointerUp={onBackUp} onPointerCancel={onBackUp}
        onClick={() => {
          if (backSwiped.current) { backSwiped.current = false; return; }
          if (!revealed) reveal();
        }}>
        {canGoBack && <span class={'rev-backcue' + (swipeArmed(backX, SWIPE_BACK_PX) ? ' armed' : '')} aria-hidden="true"><I.chev /></span>}
        <button class="rev-pz" title={S.rev.personalize} onClick={e => { e.stopPropagation(); setPersonalizing(true); }}><I.brush /></button>
        <div class="rev-type">{kicker}{card.tag ? ' · ' + card.tag : ''}</div>
        {card.img === 1 && <CardImg id={card.id} cls="rev-img" />}
        <div class="rev-front" lang={card.type === 'de2fr' ? mem.profile.native : mem.profile.target}>
          {card.type === 'cloze'
            ? <ClozeText text={card.front} fill={revealed ? card.back : undefined} />
            : card.front}
        </div>
        {!revealed && card.hint && card.type === 'cloze' && <div class="rev-hint">{S.rev.hint} {card.hint}</div>}
        {!revealed && <div class="rev-hint">{S.rev.speakAloud}</div>}
        {!revealed && speakAns && (
          <button class={'pz-mic ' + (recOn ? 'on' : '')} title={S.rev.recordAnswer} aria-label={S.rev.recordAnswer}
            style="margin-top:10px" onClick={e => void toggleAnswerRec(e)}>
            <I.mic />
          </button>
        )}
        {revealed && (
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
            {card.type !== 'cloze' && (
              <div class="rev-back" lang={card.type === 'de2fr' ? mem.profile.target : mem.profile.native}>{card.back}</div>
            )}
            {showExample(card) && <div class="rev-ex">{card.example}</div>}
            {card.audioText && (
              <SpeakBtn text={card.audioText} title={S.common.listen} onFail={() => toast?.(S.common.audioFail, true)} />
            )}
            {answerUrl && (
              <button class="btn subtle" style="padding:6px 12px;font-size:12px"
                onClick={e => { e.stopPropagation(); void new Audio(answerUrl).play(); }}>
                {S.rev.replayAnswer}
              </button>
            )}
          </div>
        )}
        {/* Where it came from, at the foot of the card — she is the reason it exists. */}
        {!revealed && provenance && (
          <div class="row" style="gap:9px;margin-top:auto;align-self:stretch">
            <Bust d={32} />
            <div style="font-size:13px;font-weight:600;color:var(--jaune-ink);line-height:1.35;text-align:left">{provenance}</div>
          </div>
        )}
      </div>

      {personalizing && (
        <Personalize card={card} mem={mem} onClose={() => setPersonalizing(false)}
          onFlag={(ids, has) => {
            const m = deepClone(memRef.current);
            for (const x of m.deck.cards) {
              if (!ids.includes(x.id)) continue;
              if (has) x.img = 1; else delete x.img;
            }
            saveMem(m);
            setMem(m);
          }} />
      )}

      <div class="rev-actions">
        {!revealed ? (
          <button class="cta ink solo" onClick={() => reveal()}>{S.rev.flip}</button>
        ) : (
          <div class="gradebar" style={waitingAudio ? 'opacity:.55;pointer-events:none' : ''}>
            {(['again', 'hard', 'good', 'easy'] as Grade[]).map(g => {
              const d = previewDays(card, g);
              // ↘/↗ hint at the ease effect, so Difficile and Bien never look identical.
              const preview = g === 'again' ? S.rev.now
                : S.rev.dayN(d) + (g === 'hard' ? ' ↘' : g === 'easy' ? ' ↗' : '');
              return (
                <button key={g} class={g} disabled={waitingAudio} onClick={() => void onGrade(g)}>
                  {S.rev.grades[g]}
                  <span>{preview}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
