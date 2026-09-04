import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CallSession, CheckinPeriod, CostLeg, Memory } from './types';
import { api, type ApiInfo } from './lib/api';
import { runAnalysis } from './lib/analysis';
import { applyAnalysis } from './lib/merge';
import { transcribeVerbatim, VERBATIM_MODEL } from './lib/transcribe';
import { appendLocalCost, estimateCost } from './lib/costs';
import { isAdmin, logEvent, logLogin } from './lib/events';
import { buildTutorPrompt } from './lib/prompts';
import { tutorShare } from './lib/talk';
import { dueCheckin } from './lib/checkin';
import { createProfile, initProfiles } from './lib/profiles';
import { saveMem } from './lib/storage';
import { enableSync, pullIfNewer, syncAvailable, wireAutoPush } from './lib/sync';
import { onSupaChange, supaEmail, supaInit } from './lib/supa';
import { pack, setUiLang, ui, uiLangFor } from './lang';
import { configureTts } from './lib/tts';
import { watchForUpdate } from './lib/version';
import { settleRank } from './lib/gamify';
import { deepClone, todayISO, uid } from './lib/utils';
import { Odile } from './components/Avatar';
import { I } from './components/icons';
import { Boundary } from './components/Boundary';
import { Toast, type ToastFn, type ToastState } from './components/Toast';
import { Onboarding } from './views/Onboarding';
import { Today } from './views/Today';
import { Call, type CallResult } from './views/Call';
import { CallStats } from './views/CallStats';
import { Review } from './views/Review';
import { ReviewSession } from './views/ReviewSession';
import { Cards } from './views/Cards';
import { Checkin } from './views/Checkin';
import { MemoryView } from './views/MemoryView';
import { Profiles } from './views/Profiles';
import { Settings } from './views/Settings';
import { Retell } from './views/Retell';
import { Pron } from './views/Pron';
import { Admin } from './views/Admin';
import { Help } from './views/Help';
import { Tutorial } from './components/Tutorial';

type View = 'boot' | 'onboard' | 'today' | 'call' | 'analyzing' | 'analyzeFail' | 'callstats' | 'review' | 'admin'
  | 'revsession' | 'cards' | 'memory' | 'settings' | 'profiles' | 'checkin' | 'retell' | 'help' | 'pron';

interface Pending { result: CallResult; sess: CallSession }

/** Live progress of the post-call pipeline (verbatim re-transcription → analysis). */
interface AnStage { step: 'verbatim' | 'model'; chars: number }

function Elapsed({ t0 }: { t0: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick(x => x + 1), 1000);
    return () => clearInterval(i);
  }, []);
  return <span>{Math.max(0, Math.round((Date.now() - t0) / 1000))} s</span>;
}

const NAV: [View, keyof ReturnType<typeof ui>['nav'], () => JSX.Element][] = [
  ['today', 'today', I.home],
  ['cards', 'cards', I.cards],
  ['memory', 'memory', I.brain],
  ['settings', 'settings', I.gear]
];

export function App() {
  const [apiInfo, setApiInfo] = useState<ApiInfo>({ mode: 'unknown', auth: 'none', googleClientId: null, keySource: 'own' });
  const [mem, setMemState] = useState<Memory | null>(null);
  const [view, setView] = useState<View>('boot');
  const [callSess, setCallSess] = useState<CallSession | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [liveReview, setLiveReview] = useState(false);
  /** A detour into the deck taken from a conversation: leaving it comes back to that
   *  conversation rather than dropping the student on the day screen. */
  const [cardsBack, setCardsBack] = useState<string | null>(null);
  const [newProfileFlow, setNewProfileFlow] = useState(false);
  const [checkinPeriod, setCheckinPeriod] = useState<CheckinPeriod>('week');
  const [toastS, setToastS] = useState<ToastState | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>();
  /** Morning-primer cap for the next review session (3 cards before the call). */
  const [revCap, setRevCap] = useState<number | undefined>(undefined);
  /** First-login tutorial: once per device, not per profile. */
  const [tutoDone, setTutoDone] = useState<boolean>(() => {
    try { return localStorage.getItem('causerie.tuto.v1') === '1'; } catch { return true; }
  });
  const [anStage, setAnStage] = useState<AnStage | null>(null);
  /** A newer build is deployed than the one running here (installed web apps cache hard). */
  const [stale, setStale] = useState(false);
  const anT0 = useRef(0);
  /** Verbatim re-transcriptions, one per recording segment; segments transcribe DURING
   *  the call, the tail right at hang-up — the analysis only waits for the stragglers.
   *  `seconds` is how much audio the part stands for, so analyze() can tell a complete
   *  verbatim from one with a lost segment. */
  const verbatimParts = useRef<{ text: Promise<string | null>; seconds: number }[]>([]);
  /** Resolved verbatim text, held outside analyze() so the save-without-analysis fallback
   *  keeps it: that is exactly the case where the student most wants their own words back. */
  const verbatimText = useRef<string | null>(null);
  /** What this call is costing, leg by leg, priced on the client from the same table the
   *  server bills on. Collected during the call because the pieces are only knowable where
   *  they happen: the realtime usage arrives with the last response, each verbatim segment
   *  knows its own duration, and the analysis reports its tokens at the end of its stream. */
  const costLegs = useRef<CostLeg[]>([]);
  const bookLeg = (kind: CostLeg['kind'], model: string, entry: Record<string, unknown>) => {
    const usd = estimateCost({ model, ...entry });
    if (usd > 0) costLegs.current.push({ kind, model, usd });
  };

  const setMem = (m: Memory) => setMemState(m);
  setUiLang(uiLangFor(mem)); // target language from B1 (immersion), support language below, browser locale before onboarding
  if (mem) configureTts(pack(mem.profile.target).en); // card audio follows the target language, not French
  const S = ui();
  const toast: ToastFn = (msg, err = false, action) => {
    setToastS({ msg, err, action });
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastS(null), action ? 6500 : 4200);
  };

  useEffect(() => {
    wireAutoPush();
    const off = onSupaChange(() => { refreshApi(); logLogin(); });
    const { mem: m } = initProfiles();
    setMemState(m);
    supaInit().then(() => api.detect()).then(async i => {
      setApiInfo(i);
      logLogin();
      let cur = m;
      if (m) {
        const remote = await pullIfNewer(m);
        if (remote) { saveMem(remote); setMemState(remote); toast(ui().app.synced); }
        // Server persistence is the default: any profile without a sync blob gets one
        // as soon as authorized server access exists.
        cur = remote ?? m;
        if (!cur.sync?.enabled && syncAvailable()) {
          const c = deepClone(cur);
          const tok = await enableSync(c);
          if (tok) setMemState(c);
        }
      }
      // The week is over and this is the first time the app has been opened in the new one:
      // the review of it comes to the student rather than waiting to be found on a card
      // halfway down the day screen. Same for the month and the quarter, which are the
      // reviews nobody would ever go looking for.
      const due = cur ? dueCheckin(cur) : null;
      if (due) setCheckinPeriod(due);
      setView(v => (v === 'boot' ? (m ? (due ? 'checkin' : 'today') : 'onboard') : v));
    });
    return off;
  }, []);

  useEffect(() => watchForUpdate(() => setStale(true)), []);

  /** Weeks are judged on boot, not while they run: a fortnight away has to cost what a
   *  fortnight away costs, and the app cannot count on being open when Monday arrives. */
  useEffect(() => {
    if (!mem) return;
    const m = deepClone(mem);
    // Only a week that was actually judged is worth writing. Persisting the bookkeeping
    // when nothing moved made every profile save on its first boot for no visible effect,
    // and a save pushes to the server, so boot fought with its own sync.
    if (settleRank(m, todayISO()).length === 0) return;
    saveMem(m);
    setMemState(m);
    // Keyed on the memory itself: the boot sync pull replaces it AFTER this first runs,
    // and a settlement written before that pull is simply discarded. Re-running on every
    // replacement cannot loop — the second pass finds the week already settled and stops
    // before touching state.
  }, [mem, todayISO()]);

  const refreshApi = () => { void api.detect().then(setApiInfo); };
  const go = (v: string) => { setView(v as View); window.scrollTo(0, 0); };

  /** What Odile was told for this call, captured HERE rather than after it: the analysis
   *  rewrites the memory the briefing is built from, so asking for it afterwards would
   *  archive a prompt that never existed. Same inputs the engine uses, so the same text. */
  const briefing = useRef('');

  const startCall = (sess: CallSession) => {
    verbatimParts.current = [];
    verbatimText.current = null;
    costLegs.current = [];
    briefing.current = mem ? buildTutorPrompt(mem, sess) : '';
    setCallSess(sess);
    go('call');
  };

  const analyze = async (p: Pending) => {
    anT0.current = Date.now();
    setAnStage({ step: 'verbatim', chars: 0 });
    go('analyzing');
    try {
      const texts = await Promise.all(verbatimParts.current.map(x => x.text));
      let verbatim = texts.filter((t): t is string => !!t).join('\n') || null;
      // A verbatim that covers only a corner of the call is worse than none at all: the
      // analysis judges the student PRIMARILY from it, so one lost segment read as "the
      // student barely spoke" and a rich 34-turn conversation came back with zero
      // corrections and zero new words (call of 2026-09-04, verbatim: "Au revoir, deal.").
      // Under 60% audio coverage the verbatim is withheld and the analysis judges from
      // the turn transcript alone — degraded, but a real analysis.
      const okSeconds = texts.reduce((sum, t, i) => sum + (t ? verbatimParts.current[i].seconds : 0), 0);
      const totalSeconds = p.result.seconds || 0;
      if (verbatim && totalSeconds > 60 && okSeconds < 0.6 * totalSeconds) verbatim = null;
      verbatimText.current = verbatim;
      setAnStage({ step: 'model', chars: 0 });
      const an = await runAnalysis(mem!, p.sess, p.result.transcript, verbatim,
        chars => setAnStage({ step: 'model', chars }));
      const m = deepClone(mem!);
      // Utterance fluency from the learner's own verbatim speech: an objective wpm per call.
      const mins = (p.result.seconds || 0) / 60;
      const wpm = verbatim && mins > 0.5 ? Math.round(verbatim.split(/\s+/).filter(Boolean).length / mins) : undefined;
      // Retry after a failed analysis re-enters this function, so the previous attempt's
      // leg is dropped rather than added to.
      costLegs.current = costLegs.current.filter(l => l.kind !== 'analysis');
      if (an._usage) bookLeg('analysis', an._model || mem!.settings.analysisModel || 'gpt-5.6-sol', an._usage);
      const rec = applyAnalysis(m, an, {
        topic: p.sess.topic, targets: p.sess.targets,
        transcript: p.result.transcript, seconds: p.result.seconds, wpm, verbatim,
        wordGoals: p.result.wordGoals, materials: p.sess.materials, briefing: briefing.current,
        tutorShare: tutorShare(p.result.transcript) ?? undefined,
        costs: costLegs.current.slice()
      });
      saveMem(m); setMemState(m); setPending(null);
      setReviewId(rec.id); setLiveReview(true); go('callstats');
    } catch (e) {
      console.warn(e);
      const msg = (e as Error).message;
      toast(S.app.analyzeFailToast(msg === 'AUTH' ? S.app.authExpired : msg), true);
      go('analyzeFail');
    }
  };

  const transcribeSegment = (blob: Blob, seconds = 0) => {
    if (!mem || mem.settings.verbatim === false) return;
    verbatimParts.current.push({
      text: transcribeVerbatim(blob, mem.profile.target || 'fr', mem.profile.native || 'de', seconds),
      seconds: seconds || 0
    });
    bookLeg('verbatim', VERBATIM_MODEL, { audio_seconds: Math.round(seconds) });
  };

  const endCall = (result: CallResult) => {
    if (mem!.settings.verbatim !== false && result.audioBlob) transcribeSegment(result.audioBlob, result.audioSeconds);
    // The turn-by-turn engine transcribed every turn verbatim on its way in, so its own
    // text IS the ground truth: a second pass over the same audio would pay twice for it.
    if (result.verbatim) verbatimParts.current.push({ text: Promise.resolve(result.verbatim), seconds: result.seconds || 0 });
    const u = result.usage;
    const sid = uid('call');
    // An engine that prices its own legs (turn-by-turn: transcription, thinking, voice).
    // Through the server the three functions have already written their ledger rows, so
    // only the local ring and this call's breakdown are left to fill in here.
    for (const l of result.costEntries) {
      const entry = { kind: l.kind, model: l.model, session_id: sid, seconds: Math.round(result.seconds), key_source: api.useServer() ? 'server' : 'own', ...l.entry };
      if (api.useServer()) appendLocalCost(entry);
      else api.postCost(entry);
      bookLeg(l.kind, l.model, l.entry);
    }
    if (u && (u.audio_input_tokens || u.audio_output_tokens || u.output_tokens)) {
      const rtModel = mem!.settings.rtModel || 'gpt-realtime-2.1';
      api.postCost({
        kind: 'realtime', model: rtModel,
        session_id: sid, seconds: Math.round(result.seconds),
        key_source: api.useServer() ? 'server' : 'own', ...u
      });
      bookLeg('realtime', rtModel, u as unknown as Record<string, unknown>);
      // The live captions are a SECOND transcription model running beside the realtime one,
      // billed per minute of call audio and never booked here before. At $0.017/min it is the
      // larger of the two transcription legs, so leaving it out made the call look cheaper
      // than it is. Call duration is the right order of magnitude: the mic streams whenever
      // the gate is open.
      api.postCost({
        kind: 'transcribe', model: result.transcribeModel,
        session_id: sid, seconds: Math.round(result.seconds),
        audio_seconds: Math.round(result.seconds),
        key_source: api.useServer() ? 'server' : 'own'
      });
      bookLeg('captions', result.transcribeModel, { audio_seconds: Math.round(result.seconds) });
    }
    logEvent('call', result.seconds, {
      topic: callSess?.topic ?? null,
      engine: mem!.settings.callEngine === 'turns' ? 'turns' : 'realtime',
      turns: result.transcript.filter(t => t.role === 'user').length
    });
    const meaningful = result.transcript.some(t => (t.text || '').trim().length > 0);
    if (!meaningful) {
      toast(result.dropped ? S.app.dropNothing : S.app.emptyNothing, true);
      go('today');
      return;
    }
    const p = { result, sess: callSess! };
    setPending(p);
    void analyze(p);
  };

  const saveWithoutAnalysis = () => {
    if (!pending || !mem) return;
    const m = deepClone(mem);
    m.sessions.push({
      id: uid('sess'), date: todayISO(), at: new Date().toISOString(), topic: pending.sess.topic, source: 'causerie',
      minutes: Math.max(1, Math.round(pending.result.seconds / 60)), seconds: Math.round(pending.result.seconds),
      transcript: pending.result.transcript, analysis: null, summary: S.app.savedNoAnalysis,
      ...(verbatimText.current ? { verbatim: verbatimText.current } : {}),
      ...(costLegs.current.length ? { costs: costLegs.current.slice() } : {})
    });
    saveMem(m); setMemState(m); setPending(null);
    toast(S.app.transcriptKept);
    go('today');
  };

  /** Put the review off until tomorrow. Offering it again on the next open of the same day
   *  is nagging, and a review nobody wants to do is a review nobody reads. */
  const snoozeCheckin = () => {
    if (!mem) return;
    const m = deepClone(mem);
    m.checkins = m.checkins ?? { history: [] };
    m.checkins.snoozedOn = todayISO();
    saveMem(m);
    setMemState(m);
  };

  const openSession = (id: string) => { setReviewId(id); setLiveReview(false); go('review'); };
  const onboardDone = (m: Memory) => {
    createProfile(m.profile.name || 'Profil', m);
    setMemState(m);
    setNewProfileFlow(false);
    if (syncAvailable()) {
      const c = deepClone(m);
      void enableSync(c).then(tok => { if (tok) setMemState(c); });
    }
    go('today');
  };

  if (view === 'boot') {
    return (
      <div class="stage">
        <div style="text-align:center"><div class="spinner"></div><div class="muted">Causerie…</div></div>
      </div>
    );
  }
  if (view === 'onboard') {
    return (
      <div>
        <Toast t={toastS} onAction={() => setToastS(null)} />
        <Onboarding
          apiInfo={apiInfo} needsAccess={!api.ready()} autoResume={!mem} toast={toast} onDone={onboardDone}
          onCancel={newProfileFlow && mem ? () => { setNewProfileFlow(false); go('profiles'); } : undefined}
        />
      </div>
    );
  }
  if (view === 'call' && mem && callSess) {
    return (
      <div>
        <Toast t={toastS} onAction={() => setToastS(null)} />
        <Call mem={mem} sess={callSess} toast={toast} onEnd={endCall} onFail={why => go(why === 'auth' ? 'settings' : 'today')} onSegment={transcribeSegment} />
      </div>
    );
  }
  if (view === 'analyzing') {
    // The analysis streams: ~8000 characters of report make a serviceable progress gauge.
    const pct = anStage?.step === 'model' && anStage.chars > 0 ? Math.min(95, Math.round(anStage.chars / 80)) : null;
    const detail =
      anStage?.step === 'verbatim' ? S.app.verbatimStage :
      pct == null ? S.app.thinkingStage : S.app.writingStage(pct);
    return (
      <div class="stage">
        <div class="sheet">
          <div style="width:90px;margin:0 auto 8px"><Odile state="thinking" /></div>
          <div class="spinner"></div>
          <div style="font-weight:650;font-size:17px">{S.app.analyzingTitle}</div>
          <div class="muted" style="font-size:13.5px;margin-top:6px">{detail}</div>
          <div class="tiny" style="margin-top:10px"><Elapsed t0={anT0.current} /></div>
        </div>
      </div>
    );
  }
  if (view === 'analyzeFail') {
    return (
      <div class="stage">
        <div class="sheet">
          <Toast t={toastS} onAction={() => setToastS(null)} />
          <div style="font-weight:650;font-size:17px">{S.app.failTitle}</div>
          <div class="muted" style="font-size:14px;margin:8px 0 16px">{S.app.failSub}</div>
          <div class="row" style="justify-content:center;flex-wrap:wrap">
            <button class="btn primary" onClick={() => pending && void analyze(pending)}>{S.common.retry}</button>
            <button class="btn ghost" onClick={saveWithoutAnalysis}>{S.app.keepTranscript}</button>
          </div>
        </div>
      </div>
    );
  }
  if (view === 'callstats' && mem) {
    const rec = reviewId ? mem.sessions.find(s => s.id === reviewId) : undefined;
    if (rec) {
      const words = (rec.transcript ?? []).filter(t => t.role === 'user')
        .reduce((a, t) => a + t.text.split(/\s+/).filter(Boolean).length, 0);
      return (
        <div>
          <Toast t={toastS} onAction={() => setToastS(null)} />
          <Boundary key="callstats" onBack={() => go('review')}>
            <CallStats sess={rec} words={words} onDone={() => go('review')} />
          </Boundary>
        </div>
      );
    }
  }
  if (view === 'revsession' && mem) {
    return (
      <div>
        <Toast t={toastS} onAction={() => setToastS(null)} />
        <ReviewSession mem={mem} setMem={setMem} onExit={() => { setRevCap(undefined); go('today'); }} toast={toast} cap={revCap} />
      </div>
    );
  }
  if (view === 'pron' && mem) {
    return (
      <div>
        <Toast t={toastS} onAction={() => setToastS(null)} />
        <Pron mem={mem} setMem={setMem} onExit={() => go('today')} toast={toast} />
      </div>
    );
  }
  if (view === 'retell' && mem) {
    const lastToday = mem.sessions.filter(s => s.source === 'causerie' && s.date === todayISO()).slice(-1)[0];
    return (
      <div>
        <Toast t={toastS} onAction={() => setToastS(null)} />
        <Retell mem={mem} setMem={setMem} topic={lastToday?.topic ?? ''} onExit={() => go('today')} toast={toast} />
      </div>
    );
  }

  const sessObj = mem && reviewId ? mem.sessions.find(s => s.id === reviewId) : undefined;

  return (
    <div class={'shell' + (stale ? ' hasupdate' : '')}>
      <Toast t={toastS} onAction={() => setToastS(null)} />
      {stale && (
        <div class="updatebar" role="status">
          <span>{S.app.updateReady}</span>
          <button class="btn subtle" onClick={() => location.reload()}>{S.app.updateReload}</button>
        </div>
      )}
      <nav class="nav">
        <div class="brand"><span class="dot"></span>Causerie
          {mem && <span class="navflag" title={mem.profile.target}>{pack(mem.profile.target).flag}</span>}
        </div>
        {NAV.map(([v, l, Icon]) => (
          <button key={v} class={view === v || (view === 'review' && v === 'memory') || ((view === 'profiles' || view === 'help') && v === 'settings') ? 'on' : ''} onClick={() => go(v)}>
            <Icon /><span>{S.nav[l]}</span>
          </button>
        ))}
      </nav>
      <main class="main">
        <Boundary key={view} onBack={() => go('today')}>
          {view === 'today' && mem && <Today mem={mem} setMem={setMem} apiInfo={apiInfo} go={go} startCall={startCall} openCheckin={p => { setCheckinPeriod(p); go('checkin'); }} toast={toast}
            warmup={() => { setRevCap(3); go('revsession'); }} />}
          {view === 'checkin' && mem && (
          <Checkin mem={mem} setMem={setMem} period={checkinPeriod} toast={toast}
            onDone={done => { if (!done) snoozeCheckin(); go('today'); }} />
        )}
          {view === 'cards' && mem && (
            <Cards mem={mem} setMem={setMem} go={go} toast={toast} fromCall={!!cardsBack}
              onBack={cardsBack ? () => { setCardsBack(null); go('review'); } : undefined} />
          )}
          {view === 'memory' && mem && <MemoryView mem={mem} setMem={setMem} openSession={openSession} openCheckin={p => { setCheckinPeriod(p); go('checkin'); }} toast={toast} />}
          {view === 'review' && mem && sessObj && (
            <Review mem={mem} setMem={setMem} sess={sessObj} live={liveReview}
              go={v => { setLiveReview(false); go(v); }}
              openCards={() => { setCardsBack(sessObj.id); go('cards'); }}
              toast={toast} />
          )}
          {view === 'profiles' && mem && (
            <Profiles mem={mem} setMem={setMem} go={go} toast={toast}
              onSwitch={m => { setMemState(m); go('today'); }}
              onNewProfile={() => { setNewProfileFlow(true); go('onboard'); }} />
          )}
          {view === 'settings' && mem && <Settings mem={mem} setMem={setMem} apiInfo={apiInfo} refreshApi={refreshApi} go={go} toast={toast} />}
          {view === 'help' && <Help onBack={() => go('settings')} />}
          {view === 'admin' && isAdmin(supaEmail()) && <Admin onBack={() => go('settings')} />}
        </Boundary>
      </main>
      {mem && !tutoDone && view === 'today' && (
        <Tutorial onDone={() => {
          try { localStorage.setItem('causerie.tuto.v1', '1'); } catch { /* private mode */ }
          setTutoDone(true);
        }} />
      )}
    </div>
  );
}
