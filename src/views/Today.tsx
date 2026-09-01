import { useEffect, useMemo, useState } from 'preact/hooks';
import type { CallSession, Memory } from '../types';
import { cachedStory, makeStory, type Story } from '../lib/story';
import { api, type ApiInfo } from '../lib/api';
import { band, idxLvl } from '../lib/cefr';
import { focusTargets } from '../lib/focus';
import { dueCheckin } from '../lib/checkin';
import { callDoneOn, inIntroPhase, introCallsDone, reviewSessionsOn } from '../lib/gamify';
import { LANGS } from '../lib/langs';
import { earDay, earPhase } from '../lib/pron';
import { peekRevState } from '../lib/revstate';
import { daysSkipped } from '../lib/month';
import { beyondPlan, sessionsPerDay, sittingPlan } from '../lib/budget';
import { buildSession } from '../lib/srs';
import { sheetsForCall, type CheatSheet } from '../lib/sheets';
import { goalCount, pickWordGoals } from '../lib/wordgoal';
import { introTopics, suggestTopics, type TopicSuggestion } from '../lib/topics';
import { cacheKey, generateTopics, readCache } from '../lib/topicgen';
import { fmtDay, todayISO } from '../lib/utils';
import { Odile } from '../components/Avatar';
import { ClozeText } from '../components/Scene';
import { StoryPlayer } from '../components/StoryPlayer';
import { I } from '../components/icons';
import { SheetView } from '../components/SheetView';
import { ui } from '../lang';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  apiInfo: ApiInfo;
  go: (view: string) => void;
  startCall: (sess: CallSession) => void;
  openCheckin: (p: 'week' | 'month' | 'quarter') => void;
  toast: (msg: string, err?: boolean) => void;
  /** Starts a 3-card warm-up review (retrieval right before the call). */
  warmup: () => void;
}

interface Chosen { t: string; fr?: string; lv: string; tags?: string[] }

/** What she is proposing, falling back to an open conversation when the catalogue and
 *  the generator both come up empty. */
function pick(s: TopicSuggestion | undefined, S: ReturnType<typeof ui>, lv: string): Chosen {
  if (!s) return { t: S.today.freeConversation, fr: S.today.freeConversation.toLowerCase(), lv };
  return s;
}

export function Today({ mem, setMem, apiInfo, go, startCall, openCheckin, toast, warmup }: Props) {
  const S = ui();
  const INTRO = introTopics(mem.profile.target);
  const d = todayISO();
  const intro = inIntroPhase(mem);
  const introN = introCallsDone(mem);
  // The catalogue is what shows instantly and what is left when the network is not there;
  // the generated set replaces it as soon as it lands (usually already cached for today).
  const fallback = useMemo(() => suggestTopics(mem), [mem]);
  const tkey = cacheKey(mem);
  const [gen, setGen] = useState<TopicSuggestion[] | null>(() => readCache(mem));
  useEffect(() => {
    if (inIntroPhase(mem)) return;          // the first three calls follow a fixed agenda
    const hit = readCache(mem);
    if (hit) { setGen(hit); return; }
    let live = true;
    generateTopics(mem)
      .then(l => { if (live && l.length) setGen(l); })
      .catch(() => { /* the catalogue is already on screen; a failure changes nothing */ });
    return () => { live = false; };
  }, [tkey]);
  const suggestions = gen?.length ? gen : fallback;
  const [si, setSi] = useState(0);
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const targets = useMemo(() => focusTargets(mem, 3), [mem]);
  const sheets: CheatSheet[] = useMemo(() => (inIntroPhase(mem) ? [] : sheetsForCall(mem, focusTargets(mem, 3))), [mem]);
  const [showSheets, setShowSheets] = useState(false);

  const callDone = callDoneOn(mem, d);
  // The day asks for more than one sitting now, so "done" is both of them — or, when the
  // deck runs dry earlier than that, nothing left to review. A tick that lands after the
  // first of two would say the day is finished while half its capacity is unused.
  const revRounds = sessionsPerDay(mem.settings);
  const revToday = reviewSessionsOn(mem, d);
  // Histoire du jour: the daily listening-input strand, generated on demand and cached.
  // Listening (and the per-paragraph questions) happens in the StoryPlayer overlay.
  const [story, setStory] = useState<Story | null>(cachedStory());
  const [storyBusy, setStoryBusy] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const listenStory = async (fresh = false) => {
    if (storyBusy) return;
    let s = fresh ? null : story;
    if (!s) {
      setStoryBusy(true);
      try { s = await makeStory(mem, fresh); setStory(s); } catch { toast(S.story.fail, true); }
      setStoryBusy(false);
    }
    // Opening an activity dismisses the chooser: two stacked overlays leave the veil of
    // the lower one swallowing taps meant for the player.
    if (s) { setMoreOpen(false); setPlayerOpen(true); }
  };
  const plan = sittingPlan(mem, revToday, todayISO());
  const queue = buildSession(mem.deck, mem.settings.sessionSize, plan.newCap,
    todayISO(), beyondPlan(mem.settings, revToday), plan.dueCap);
  const queueLen = queue.length;
  // The card on top of the pile, shown on the day screen with the call it came
  // from: in La Troupe nothing in the deck is pre-made, and saying so is the point.
  const peek = queue[0];
  const peekDate = peek?.sourceSessionId
    ? mem.sessions.find(x => x.id === peek.sourceSessionId)?.date
    : undefined;
  const rs = peekRevState(); // interrupted session to resume, if any
  const ready = api.ready();
  const levelKnown = !intro || mem.cefr.history.length > 0;
  const checkinDue = useMemo(() => dueCheckin(mem), [mem]);
  // Days rather than a score: a run that is live says how long it has been, a run that
  // has been broken says how many days were skipped and leaves it at that. Odile asks
  // where you were; the app does not keep a scoreboard.
  const skipped = daysSkipped(mem, d);

  const proposal: Chosen = intro
    ? { t: INTRO[Math.min(introN, 2)].t, fr: INTRO[Math.min(introN, 2)].fr, lv: '' }
    : custom.trim()
      ? { t: custom.trim(), fr: custom.trim(), lv: band(mem.cefr.overall) }
      : pick(suggestions[si % Math.max(1, suggestions.length)], S, band(mem.cefr.overall));

  // Ear-training phase (first two weeks at A0/A1): perception is the main course,
  // the call stays short (Fluent Forever's ordering: ears before mouth).
  const ear = earPhase(mem);
  const callMinutes = ear ? Math.min(4, mem.settings.minutesHint) : mem.settings.minutesHint;

  /** Minimal-pair ear training: its own block — THE daily centre piece during the
   *  first two weeks at A0/A1 (with shorter calls), an extra on higher levels. */
  const pronCard = (
    <div class="daycard">
      <div class="head">
        <span class="kicker">{S.pron.title}{ear ? ' · ' + S.pron.dayOf(Math.min(14, earDay(mem))) : ''}</span>
      </div>
      <p class="muted" style="font-size:13.5px;margin:0 0 10px;line-height:1.5">{ear ? S.pron.phaseNote : S.pron.sub}</p>
      <button class={'btn big ' + (ear ? 'primary' : 'ghost')} onClick={() => go('pron')}>{S.pron.start}</button>
    </div>
  );

  const begin = () => {
    startCall({
      topic: proposal.t,
      topicFr: proposal.fr ?? proposal.t,
      level: band(mem.cefr.overall),
      targets: intro ? [] : targets,
      mode: intro ? 'intro' : 'daily',
      minutes: callMinutes,
      materials: sheets.map(x => x.id),
      // Not during the getting-to-know-you calls: those exist to find out what the learner
      // has, and a word goal presumes an answer they have not been asked for yet.
      wordGoals: intro ? [] : pickWordGoals(mem, goalCount(callMinutes)),
      topicTags: intro ? [] : (proposal.tags ?? [])
    });
  };

  return (
    <div class="fadein">
      {showSheets && <SheetView sheets={sheets} closeLabel={S.common.close} onClose={() => setShowSheets(false)} />}
      {playerOpen && story && <StoryPlayer mem={mem} setMem={setMem} story={story} onClose={() => setPlayerOpen(false)} toast={toast} />}

      {/* The day opens on her, not on a dashboard. Everything to do with the call lives on
          her blue field — the level and the streak, where the week stands, what she is
          proposing, the two ways to change her mind, the sheet she will read from, and the
          button itself. Nothing about the conversation is loose on the cream. */}
      <div class="hero">
        <div class="htop">
          <div class="hbrand">Causerie</div>
          <div class="hchips">
            <button class="hchip solid" onClick={() => go('memory')} title={S.today.level}>
              {LANGS[mem.profile.target]?.flag} {levelKnown ? idxLvl(mem.cefr.overall) : '…'}
            </button>
            <button class="hchip" onClick={() => go('memory')}>
              {skipped ? S.today.daysMissed(skipped) : S.today.daysRow(mem.streak.count || 0)}
            </button>
            <button class="hchip" title={S.nav.settings} onClick={() => go('profiles')}>{(mem.profile.name || '?')[0]}</button>
          </div>
        </div>

        {/* Only the proposal itself. It is a speech bubble coming out of her mouth on the
            one screen she is already standing on — a label saying she is the one proposing
            it, and a line explaining why, were both saying what the picture says. */}
        <div class="hbody">
          <div class="od"><Odile state="idle" /></div>
          <div class="bub">
            <div class="pt" lang={mem.profile.target}>{proposal.t}</div>
            {/* What the subject was chosen to force, which is the part of the plan worth
                reading. The call's length was here too and has been taken back out: it is
                already a setting, Odile says it in her opening line, and a clock on the
                proposal made the day look like an appointment. */}
            {!intro && (proposal.tags ?? []).length > 0 && (
              <div class="psub">{(proposal.tags ?? []).slice(0, 3).join(' · ')}</div>
            )}
          </div>
        </div>

        {!intro && (
          <div class="hrow">
            <button class="pill" onClick={() => { setCustom(''); setSi(si + 1); }}><I.shuffle /> {S.today.otherIdea}</button>
            <button class="pill" onClick={() => setShowCustom(!showCustom)}>{S.today.freeTopic}</button>
          </div>
        )}
        {showCustom && !intro && (
          <input placeholder={S.today.freePlaceholder} value={custom}
            onInput={e => setCustom((e.target as HTMLInputElement).value)} />
        )}
        {/* Cheat sheets and the warm-up are both pre-call, both optional: one line
            between them, not two, so the day still fits a phone. */}
        {(sheets.length > 0 || (!callDone && queueLen > 0)) && (
          <div class="prerow">
            {sheets.length > 0 && (
              <button class="matbtn" onClick={() => setShowSheets(true)}>
                📄 {sheets.map(x => x.title).join(' · ')}
              </button>
            )}
            {!callDone && queueLen > 0 && (
              <button class="btn subtle warmbtn" title={S.today.warmup} onClick={warmup}>{S.today.warmupShort}</button>
            )}
          </div>
        )}
        {!ready && (
          <div class="hnote">
            <span>{S.today.missingAccess(api.useServer() ? S.today.accessCode : S.today.apiKey)}</span>
            <button class="btn subtle" onClick={() => go('settings')}>{S.common.settle}</button>
          </div>
        )}
        {apiInfo.mode === 'server' && apiInfo.keySource === 'server' && apiInfo.keyConfigured === false && (
          <div class="hnote"><span>{S.today.noServerKey}</span></div>
        )}
        <button class={'cta' + (callDone ? ' quiet' : '')} onClick={begin} disabled={!ready}>
          <span>{callDone ? S.today.callAgain : S.today.callOdile}</span>
          <span class="meta">{callMinutes} min</span>
        </button>
      </div>

      {checkinDue && !intro && (
        <div class="card" style="margin-top:12px">
          <div class="spread">
            <div style="font-size:14px"><b>{S.periods[checkinDue]}</b> · {S.today.twoMinutes}</div>
            <button class="btn primary" style="padding:9px 15px" onClick={() => openCheckin(checkinDue)}>{S.today.doCheckin}</button>
          </div>
        </div>
      )}

      {intro && (
        <div class="row" style="margin-top:12px;flex-wrap:wrap">
          <span class="chip blue sm">{S.today.introChip(introN + 1)}</span>
          <div style="font-size:13.5px;color:var(--ink2);line-height:1.5">{S.today.introSub}</div>
        </div>
      )}

      {/* Ear training is the day itself during the A0/A1 fortnight, an extra above it after. */}
      {ear && <div style="margin-top:16px">{pronCard}</div>}

      {/* What came out of the calls, in the colour the system reserves for it. Two sittings
          a day at whatever hour suits, so it is named for the act, not for the evening. */}
      <div class="reviewblock">
        <div class="spread" style="align-items:baseline">
          <div class="tt">{S.today.reviewTitle}</div>
          {/* Always the sitting you are about to do, counted for real: a round marker that
              stops at 2/2 while the block still offers cards reads as a broken promise. */}
          <div class="n">
            {queueLen === 0 ? S.today.nothingToReview : S.today.nCards(queueLen)}
            {queueLen > 0 && revRounds > 1 && ' · ' + (revToday >= revRounds
              ? S.today.roundExtra(revToday + 1)
              : S.today.roundOf(revToday + 1, revRounds))}
          </div>
        </div>
        {peek && (
          <div class="peek">
            <div class="q" lang={peek.type === 'de2fr' ? mem.profile.native : mem.profile.target}>
              {peek.type === 'cloze' ? <ClozeText text={peek.front} /> : peek.front}
            </div>
            {peekDate && <div class="src">{S.today.bornOf(fmtDay(peekDate))}</div>}
          </div>
        )}
        <button class="cta ink" style="margin-top:12px" onClick={() => go('revsession')} disabled={queueLen === 0 && !rs}>
          <span>{rs ? S.cards.resume(rs.seen, rs.initialLen)
            : queueLen === 0 ? S.today.nothingToReview : S.today.startReview}</span>
          {queueLen > 0 && !rs && <span class="meta">{S.today.nCards(queueLen)}</span>}
        </button>
      </div>

      {/* The deck's own bookkeeping — due/new/total, the rhythm it is sized against, the
          backlog — lives on the Cartes screen. This one says what is waiting. */}
      <div class="row" style="margin-top:12px;flex-wrap:wrap">
        <button class="btn subtle" onClick={() => go('cards')}>{S.today.seeCards}</button>
        {/* Fluency, the story and the ear training are strands, not the day: one tap away,
            so the two things the day actually asks for fit a phone without scrolling. */}
        <button class="btn subtle" onClick={() => setMoreOpen(true)}>{S.today.moreActivities}</button>
      </div>

      {moreOpen && (
        <div class="sheetveil" role="dialog" aria-modal="true" aria-label={S.today.moreActivities}
          onClick={e => { if (e.target === e.currentTarget) setMoreOpen(false); }}>
          <div class="sheetcard" style="max-width:480px;text-align:left">
            <div class="spread" style="margin-bottom:12px">
              <div style="font-family:var(--disp);font-weight:800;font-size:20px">{S.today.moreActivities}</div>
              <button class="btn subtle" style="padding:6px 11px;font-size:12px" onClick={() => setMoreOpen(false)}>{S.common.close}</button>
            </div>

            {callDone && mem.settings.retell !== false && (
              <div class="daycard" style="margin-bottom:12px">
                <div class="head"><span class="kicker">{S.flu.title}</span></div>
                <p class="muted" style="font-size:13.5px;margin:0 0 4px;line-height:1.5">{S.flu.offer}</p>
                <button class="btn ghost big" onClick={() => { setMoreOpen(false); go('retell'); }}><I.mic /> {S.flu.start}</button>
              </div>
            )}

            <div class="daycard" style="margin-bottom:12px">
              <div class="head"><span class="kicker">{S.story.title}</span></div>
              {story
                ? <div style="font-family:var(--disp);font-weight:800;font-size:19px;line-height:1.2" lang={mem.profile.target}>{story.title}</div>
                : <p class="muted" style="font-size:13.5px;margin:0;line-height:1.5">{S.story.sub}</p>}
              <button class="btn ghost big" disabled={storyBusy} onClick={() => void listenStory()}>
                {storyBusy ? S.story.making : <><I.speaker /> {story ? S.story.play : S.story.make}</>}
              </button>
              {story && (
                <button class="btn subtle" style="align-self:flex-start;padding:7px 12px;font-size:12px" disabled={storyBusy} onClick={() => void listenStory(true)}>
                  {S.story.newOne}
                </button>
              )}
            </div>

            {!ear && (
              <div class="daycard">
                <div class="head"><span class="kicker">{S.pron.title}</span></div>
                <p class="muted" style="font-size:13.5px;margin:0;line-height:1.5">{S.pron.sub}</p>
                <button class="btn ghost big" onClick={() => { setMoreOpen(false); go('pron'); }}>{S.pron.start}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
