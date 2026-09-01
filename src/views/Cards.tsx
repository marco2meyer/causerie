import { useMemo, useState } from 'preact/hooks';
import type { Card, Memory } from '../types';
import { peekRevState } from '../lib/revstate';
import { beyondPlan, sittingPlan } from '../lib/budget';
import { reviewSessionsOn } from '../lib/gamify';
import { deckPace } from '../lib/pace';
import { buildSession, cardStage, dueCounts, lastKnown, latestBatchIds, type CardStage } from '../lib/srs';
import { saveMem } from '../lib/storage';
import { SpeakBtn } from '../components/SpeakBtn';
import { deepClone, fmtDate, todayISO } from '../lib/utils';
import { CardImg } from '../components/CardImg';
import { ClozeText } from '../components/Scene';
import { PaceChart } from '../components/charts';
import { I } from '../components/icons';
import { CardForge } from '../components/CardForge';
import { Personalize } from '../components/Personalize';
import { type ToastFn } from '../components/Toast';
import { ui } from '../lang';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  go: (view: string) => void;
  toast: ToastFn;
  /** Set when the deck was opened from a conversation: offers the way back to it. */
  onBack?: () => void;
  /** The deck was opened from a conversation's review, so the cards that conversation
   *  just produced are worth pointing at. Opened from the tab it is simply the deck, and
   *  singling out the last call's cards there says "look at these" to someone who came to
   *  look at something else. */
  fromCall?: boolean;
}

const EMPTY: ReadonlySet<string> = new Set();

type StageF = 'all' | CardStage;
type KnownF = 'all' | 'known' | 'missed';
type SortKey = 'due' | 'status' | 'difficulty';

const STAGES: StageF[] = ['all', 'new', 'learning', 'learned'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A rate a person can read: "3" rather than "3.00", "1.4" rather than "1.43". Rounded to
 *  one place because the second place is noise on a week of small integers. */
const fmtRate = (n: number): string => String(Math.round(Math.abs(n) * 10) / 10);

/** new < learning (missed/ungraded before known) < learned. */
function statusRank(c: Card): number {
  const st = cardStage(c);
  if (st === 'new') return 0;
  if (st === 'learning') return lastKnown(c) === true ? 2 : 1;
  return 3;
}

export function Cards({ mem, setMem, go, toast, onBack, fromCall }: Props) {
  const S = ui();
  const T = (mem.profile.target || 'fr').toUpperCase();
  const N = (mem.profile.native || 'de').toUpperCase();
  const TYPE_CHIP = { cloze: S.cards.typeCloze, fr2de: `${T}→${N}`, de2fr: `${N}→${T}` } as const;
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<StageF>('all');
  const [kn, setKn] = useState<KnownF>('all');
  const [sort, setSort] = useState<SortKey>('due');
  const [pzId, setPzId] = useState<string | null>(null);
  const [forgeOpen, setForgeOpen] = useState(false);
  const counts = dueCounts(mem.deck);
  /** Measured, not configured: what the last week actually looked like (lib/pace). */
  const pace = useMemo(() => deckPace(mem), [mem.deck.cards, mem.deck.log]);
  const sittings = reviewSessionsOn(mem, todayISO());
  const plan = sittingPlan(mem, sittings, todayISO());
  const queueLen = buildSession(mem.deck, mem.settings.sessionSize, plan.newCap,
    todayISO(), beyondPlan(mem.settings, sittings), plan.dueCap).length;
  const rs = peekRevState(); // interrupted session to resume, if any
  const update = (fn: (m: Memory) => void) => {
    const m = deepClone(mem);
    fn(m);
    saveMem(m);
    setMem(m);
  };

  const searched = mem.deck.cards
    .filter(c => !q.trim() || (c.front + ' ' + c.back).toLowerCase().includes(q.toLowerCase()));
  const nStage: Record<StageF, number> = { all: searched.length, new: 0, learning: 0, learned: 0 };
  const nKn = { known: 0, missed: 0 };
  for (const c of searched) {
    const st = cardStage(c);
    nStage[st]++;
    if (st === 'learning') {
      const k = lastKnown(c);
      if (k === true) nKn.known++;
      else if (k === false) nKn.missed++;
    }
  }

  const cards = searched
    .filter(c => stage === 'all' || cardStage(c) === stage)
    .filter(c => stage !== 'learning' || kn === 'all' || lastKnown(c) === (kn === 'known'))
    .sort(
      sort === 'due' ? (a, b) => a.due.localeCompare(b.due)
      : sort === 'status' ? (a, b) => statusRank(a) - statusRank(b) || a.due.localeCompare(b.due)
      : (a, b) => b.lapses - a.lapses || a.ease - b.ease || a.due.localeCompare(b.due));

  // Cards from the latest conversation (plus anything made by hand since) come first,
  // marked, with everything else underneath — but only when the deck was opened FROM that
  // conversation. Arriving from the tab, there is no batch and the deck is just the deck.
  const batch = fromCall ? latestBatchIds(mem) : EMPTY;
  // Hand-made cards head the group. A card forged just now otherwise lands wherever the
  // sort puts it -- with fifteen cards from the last call above it, off the screen, and
  // adding it looks like nothing happened.
  const fresh = cards.filter(c => batch.has(c.id))
    .sort((a, b) => (b.sourceKind === 'manual' ? 1 : 0) - (a.sourceKind === 'manual' ? 1 : 0));
  const older = cards.filter(c => !batch.has(c.id));

  const stageChip = (s: StageF) =>
    s === 'all' ? S.cards.f.all : s === 'new' ? cap(S.cards.fresh)
    : s === 'learning' ? S.cards.f.learning : S.cards.f.learned;
  const lastLog = (mem.deck.log ?? []).slice(-5).reverse();

  /** One row of the list. Shared by both groups so they cannot drift apart. */
  const row = (c: Card) => {
    const st = cardStage(c);
    const k = lastKnown(c);
    const stLabel = st === 'new' ? S.cards.newCard
      : st === 'learned' ? S.cards.f.stageLearned
      : S.cards.f.stageLearning + (k === null ? '' : k ? ' ✓' : ' ✗');
    const isNew = batch.has(c.id);
    return (
      <div key={c.id} class={'cardrow' + (isNew ? ' isnew' : '')}>
        {c.img === 1 && <CardImg id={c.id} cls="thumb" />}
        <div class="crmain">
          <div class="f">
            <span lang={c.type === 'de2fr' ? mem.profile.native : mem.profile.target}>
              {c.type === 'cloze' ? <ClozeText text={c.front} /> : c.front}
            </span>{' '}
            <span style="color:var(--tomato-deep)" lang={c.type === 'de2fr' ? mem.profile.target : c.type === 'fr2de' ? mem.profile.native : mem.profile.target}>→ {c.back}</span>
          </div>
          <div class="meta">
            {isNew ? <span class="newchip">{S.cards.batchChip}</span> : null}
            {c.starred ? <span style="color:var(--tomato)">★ </span> : null}
            {TYPE_CHIP[c.type]}{c.tag ? ' · ' + c.tag : ''}
            {/* the chip above already says "new"; repeating the stage word is noise */}
            {isNew && st === 'new' ? '' : <span> · <span class={'stg ' + st}>{stLabel}</span></span>}
            {st === 'learning' || st === 'learned' ? ' · ' + S.cards.forDate(fmtDate(c.due)) : ''}
            {c.reps > 0 ? ` · ${c.interval} ${S.cards.days}` : ''}{c.lapses > 0 ? ' · ' + S.cards.missed(c.lapses) : ''}
          </div>
        </div>
        <div class="cracts">
          <button class="speakbtn sm" title={S.rev.personalize} onClick={() => setPzId(c.id)}><I.brush /></button>
          {c.audioText && <SpeakBtn text={c.audioText} cls="speakbtn sm" title={S.common.listen} onFail={() => toast(S.common.audioFail, true)} />}
          <button class="speakbtn sm danger" title={S.common.del}
            onClick={() => {
              const snapshot = deepClone(mem);
              update(m => { m.deck.cards = m.deck.cards.filter(y => y.id !== c.id); });
              toast(S.cards.deletedToast, false, { label: S.common.undo, fn: () => { saveMem(snapshot); setMem(snapshot); } });
            }}>
            <I.trash />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div class="fadein">
      {onBack && (
        <button class="btn subtle" style="margin-bottom:12px" onClick={onBack}>‹ {S.review.backToCall}</button>
      )}
      <div class="spread" style="margin-bottom:14px">
        <h2 style="font-size:28px;line-height:1.1">{S.cards.title}</h2>
        <button class="btn primary" onClick={() => go('revsession')} disabled={queueLen === 0 && !rs}>
          {rs ? S.cards.resume(rs.seen, rs.initialLen) : queueLen === 0 ? S.cards.nothingToReview : S.cards.review + ' ' + queueLen}
        </button>
      </div>

      <div class="stats" style="margin-bottom:14px">
        <div class="stat"><div class="v" style={counts.due ? 'color:var(--rose)' : ''}>{counts.due}</div><div class="l">{S.cards.due}</div></div>
        <div class="stat"><div class="v">{counts.fresh}</div><div class="l">{S.cards.fresh}</div></div>
        <div class="stat"><div class="v">{counts.total}</div><div class="l">{S.cards.active}</div></div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="pace-verdict">{S.pace.title}</div>
        <div style="font-size:14.5px;line-height:1.5">
          {pace.verdict === 'idle' ? S.pace.idle
            : pace.verdict === 'growing' ? S.pace.growing(fmtRate(pace.netPerDay))
            : pace.verdict === 'clearing' ? S.pace.clearing(fmtRate(-pace.netPerDay))
            : S.pace.level}
        </div>
        <div class="tiny" style="margin-top:4px;line-height:1.5">
          {S.pace.basis(fmtRate(pace.addedPerDay), fmtRate(pace.reviewsPerDay))}
        </div>
        <PaceChart pace={pace} />
        <div class="pace-key">
          <span><i class="made"></i>{S.pace.keyMade}</span>
          <span><i class="over"></i>{S.pace.keyOver}</span>
          <span><i class="carry"></i>{S.pace.keyCarry}</span>
        </div>
        {pace.backlog > 0 && (
          <div class="tiny" style="margin-top:8px;line-height:1.5">
            {S.pace.waiting(pace.backlog)}
            {' · '}
            {pace.daysToClear != null ? S.pace.clearIn(pace.daysToClear) : S.pace.neverClear}
          </div>
        )}
        {pace.startedEstimated && pace.backlog > 0 && (
          <div class="tiny" style="margin-top:4px;opacity:.75;line-height:1.5">{S.pace.estimate}</div>
        )}
      </div>

      <div class="row" style="margin-bottom:10px;align-items:stretch">
        <input placeholder={S.common.search} value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} style="flex:1" />
        <button class="btn ghost" style="padding:0 16px;font-size:20px;flex-shrink:0" title={S.forge.title} aria-label={S.forge.title}
          onClick={() => setForgeOpen(true)}>+</button>
      </div>

      <div class="fchips">
        {STAGES.map(s => (
          <button key={s} class={'pill sm' + (stage === s ? ' on' : '')} aria-pressed={stage === s}
            title={s === 'learned' ? S.cards.matureNote : undefined}
            onClick={() => { setStage(s); if (s !== 'learning') setKn('all'); }}>
            {stageChip(s)}<span class="n">{nStage[s]}</span>
          </button>
        ))}
      </div>
      {stage === 'learned' && <div class="tiny" style="margin:-2px 0 7px">{S.cards.matureNote}</div>}
      {stage === 'learning' && (
        <div class="fchips">
          <button class={'pill sm' + (kn === 'known' ? ' on' : '')} onClick={() => setKn(kn === 'known' ? 'all' : 'known')}>
            ✓ {S.cards.f.lastKnown}<span class="n">{nKn.known}</span>
          </button>
          <button class={'pill sm' + (kn === 'missed' ? ' on' : '')} onClick={() => setKn(kn === 'missed' ? 'all' : 'missed')}>
            ✗ {S.cards.f.lastMissed}<span class="n">{nKn.missed}</span>
          </button>
        </div>
      )}
      <div class="fchips" style="margin-bottom:10px">
        <span class="flab">{S.cards.f.sort}</span>
        {(['due', 'status', 'difficulty'] as SortKey[]).map(k => (
          <button key={k} class={'pill sm' + (sort === k ? ' on' : '')} onClick={() => setSort(k)}>
            {k === 'due' ? S.cards.f.byDue : k === 'status' ? S.cards.f.byStatus : S.cards.f.byDifficulty}
          </button>
        ))}
      </div>

      <div class="card">
        {fresh.length > 0 && <div class="grouph fresh">{S.cards.batchNew(fresh.length)}</div>}
        {fresh.map(row)}
        {fresh.length > 0 && older.length > 0 && <div class="grouph later">{S.cards.batchRest}</div>}
        {older.map(row)}
        {!cards.length && (
          <div class="muted" style="padding:6px">
            {q.trim() || stage !== 'all' ? S.cards.emptyFiltered : S.cards.empty}
          </div>
        )}
      </div>

      {forgeOpen && <CardForge mem={mem} setMem={setMem} onClose={() => setForgeOpen(false)} toast={toast} />}

      {pzId && (() => {
        const pc = mem.deck.cards.find(c => c.id === pzId);
        return pc ? (
          <Personalize card={pc} mem={mem} onClose={() => setPzId(null)}
            onFlag={(ids, has) => update(m => {
              for (const x of m.deck.cards) {
                if (!ids.includes(x.id)) continue;
                if (has) x.img = 1; else delete x.img;
              }
            })} />
        ) : null;
      })()}

      {lastLog.length > 0 && (
        <div class="card" style="margin-top:12px">
          <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:6px">{S.cards.lastReviews}</div>
          {lastLog.map(l => (
            <div key={l.date + l.seconds} class="kv">
              <span class="k">{fmtDate(l.date)}</span>
              <span style="font-size:13.5px">{S.cards.reviewLine(l.total, l.good + l.easy, l.xp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
