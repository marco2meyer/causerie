import { useMemo, useState } from 'preact/hooks';
import type { Memory, VocabEntry } from '../types';
import { band, BANDS, idxLvl } from '../lib/cefr';
import { compById, compForCell } from '../lib/competencies';
import { focusTargets } from '../lib/focus';
import { inIntroPhase, introCallsDone } from '../lib/gamify';
import { portrait } from '../lib/portrait';
import { buildTutorPrompt, TEMPLATE_VARS } from '../lib/prompts';
import { activeProfile, deleteProfile } from '../lib/profiles';
import { migrate, saveMem, wipeMem } from '../lib/storage';
import { deleteRemote } from '../lib/sync';
import { findVocabCard, recognitionCards, vocabCards } from '../lib/srs';
import { introTopics, suggestTopics } from '../lib/topics';
import { deepClone, download, fmtDate, fmtMonth, norm, todayISO } from '../lib/utils';
import { monthStats } from '../lib/month';
import { Ladder, statusLabel, statusIcon } from '../components/charts';
import { Bust } from '../components/Avatar';
import { I } from '../components/icons';
import { type ToastFn } from '../components/Toast';
import { pack, ui } from '../lang';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  openSession: (id: string) => void;
  openCheckin: (p: 'week' | 'month' | 'quarter') => void;
  toast: ToastFn;
}

/** Nine tabs was a filing cabinet. These six are the questions actually being asked:
 *  where am I, what do I know, what am I working on, what does she know about me, what
 *  did we say, and the machinery underneath. `prog` merges the old Lacunes and Points
 *  forts — one subject read from both ends; `carnet` merges Faits and Vocabulaire — both
 *  are what she remembers; `adv` merges Briefing and Données — both are machinery. */
const TAB_KEYS = ['over', 'comp', 'prog', 'carnet', 'sess', 'adv'] as const;

/** A heading inside a merged tab, so two former tabs still read as two things. */
const Section = ({ title, sub }: { title: string; sub?: string }) => (
  <div style="margin:22px 2px 10px">
    <div style="font-family:var(--disp);font-weight:800;font-size:19px;line-height:1.15;letter-spacing:-.015em">{title}</div>
    {sub && <div class="tiny" style="margin-top:3px">{sub}</div>}
  </div>
);

export function MemoryView({ mem, setMem, openSession, openCheckin, toast }: Props) {
  const S = ui();
  const BY_ID = compById(mem.profile.target);
  const CATS = [['grammaire', S.memory.catGrammar], ['vocabulaire', S.memory.catVocab], ['fonctions', S.memory.catSpeak]] as const;
  const defaultTpl = pack(mem.profile.target).tutor.template;
  const [tab, setTab] = useState('over');
  const [q, setQ] = useState('');
  const [raw, setRaw] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [selComp, setSelComp] = useState<string | null>(null);
  /** The same portrait the briefing is built from, so what is on screen is what she has. */
  const port = useMemo(() => portrait(mem), [mem]);

  /** Delete with a 6-second undo window instead of a confirm dialog. */
  const updateUndoable = (fn: (m: Memory) => void, msg: string) => {
    const snapshot = deepClone(mem);
    update(fn);
    toast(msg, false, { label: S.common.undo, fn: () => { saveMem(snapshot); setMem(snapshot); } });
  };

  const update = (fn: (m: Memory) => void) => {
    const m = deepClone(mem);
    fn(m);
    saveMem(m);
    setMem(m);
  };

  /** A word in this list with no card behind it can be turned into one on the spot:
   *  the same recognition/production pair a conversation builds. */
  const makeVocabCard = (v: VocabEntry) => {
    if (findVocabCard(mem.deck, v.fr)) return;
    update(m => {
      const seen = new Set(m.deck.cards.map(c => c.type + '|' + norm(c.front)));
      const fresh = vocabCards({ fr: v.fr, de: v.de, ex: v.ex ?? '' }, undefined, recognitionCards(m))
        .filter(c => !seen.has(c.type + '|' + norm(c.front)));
      m.deck.cards.push(...fresh);
    });
    toast(S.review.vocabHasCard);
  };

  const idx = mem.cefr.overall;
  const intro = inIntroPhase(mem);
  const openW = mem.weaknesses.filter(w => w.status !== 'resolved');
  const doneW = mem.weaknesses.filter(w => w.status === 'resolved');
  const vocab = mem.vocab.filter(v => !q.trim() || (v.fr + ' ' + v.de).toLowerCase().includes(q.toLowerCase()));

  /** Preview = exactly the next call: same topic, targets and mode as the Today screen. */
  const brief = useMemo(() => {
    const introN = introCallsDone(mem);
    const next = intro
      ? { t: introTopics(mem.profile.target)[Math.min(introN, 2)].t, fr: introTopics(mem.profile.target)[Math.min(introN, 2)].fr }
      : (() => { const s = suggestTopics(mem)[0]; return s ? { t: s.t, fr: s.fr ?? s.t } : { t: 'conversation libre', fr: 'conversation libre' }; })();
    return buildTutorPrompt(mem, {
      topic: next.t, topicFr: next.fr,
      targets: intro ? [] : focusTargets(mem, 3),
      mode: intro ? 'intro' : 'daily',
      minutes: mem.settings.minutesHint
    });
  }, [mem, intro]);

  const customTpl = !!mem.tutorTemplate && mem.tutorTemplate.trim() !== defaultTpl.trim();
  const saveTpl = () => {
    if (draft == null) return;
    const d = draft.trim();
    update(m => { m.tutorTemplate = d && d !== defaultTpl.trim() ? draft! : undefined; });
    setDraft(null);
    toast(S.memory.briefSaved);
  };

  const importJson = (txt: string): boolean => {
    try {
      const m = migrate(JSON.parse(txt));
      if (!m) throw new Error(S.memory.unknownFormat);
      saveMem(m); setMem(m);
      return true;
    } catch (err) {
      toast(S.memory.invalidJson((err as Error).message), true);
      return false;
    }
  };

  const month = useMemo(() => monthStats(mem, todayISO()), [mem]);
  // The last thing she actually said about the student's own progress, kept verbatim.
  const lastRemark = useMemo(() => {
    const withAn = mem.sessions.filter(x => x.analysis?.hauptpunkt);
    return withAn.length ? withAn[withAn.length - 1].analysis!.hauptpunkt : null;
  }, [mem]);

  return (
    <div class="fadein">
      <div class="spread" style="margin-bottom:6px">
        <h2 style="font-size:28px;line-height:1.1">{S.memory.title}</h2>
        <div class="tiny">{mem.sync?.enabled ? S.memory.savedServer : S.memory.savedLocal}</div>
      </div>
      <p class="muted" style="margin:0 0 16px;font-size:14px;line-height:1.5">
        {S.memory.intro}
      </p>
      <div class="tabs">
        {TAB_KEYS.map(k => (
          <button key={k} class={tab === k ? 'on' : ''} aria-pressed={tab === k} onClick={() => { setTab(k); setRaw(null); setDraft(null); setSelComp(null); }}>{S.memory.tabs[k]}</button>
        ))}
      </div>

      {tab === 'over' && (
        <div>
          <div class="card">
            <div class="spread">
              <div>
                <div class="tiny">{S.memory.levelCefr}</div>
                <div style="font-family:var(--disp);font-weight:700;font-size:42px;letter-spacing:-.02em;line-height:1.1">
                  {intro && !mem.cefr.history.length ? '—' : idxLvl(idx)}
                </div>
              </div>
              <div style="text-align:right">
                <div class="tiny">{S.memory.reliability}</div>
                <div style="font-family:var(--disp);font-weight:700;font-size:20px">{Math.round((mem.cefr.confidence || 0) * 100)} %</div>
              </div>
            </div>
            {intro && !mem.cefr.history.length
              ? <div class="tiny" style="margin-top:8px">{S.memory.establishing}</div>
              : <Ladder idx={idx} />}
          </div>

          <div class="card" style="margin-top:12px">
            <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.memory.skillsTitle}</div>
            {(['grammar', 'vocabulary', 'fluency', 'comprehension'] as const).map(k => {
              const label = S.skills[k];
              const v = mem.cefr.skills[k];
              return (
                <div key={k} class="skillrow">
                  <div style="font-size:13.5px;color:var(--ink2)">{label}</div>
                  <div class="bar"><i style={{ width: ((v + 1) / 12) * 100 + '%' }}></i></div>
                  <div class="lv">{idxLvl(v)}</div>
                </div>
              );
            })}
          </div>

          <div class="row" style="margin-top:12px">
            <button class="btn ghost" onClick={() => openCheckin('week')}>{S.memory.weeklyCheckin}</button>
          </div>

          {/* The month, as a page of scenes rather than as a score. A square a day: filled
              in her blue when a call happened, in yellow when the cards were done too,
              outlined for a day that has not arrived. Nothing here ranks the month against
              another one — it says what happened, and the level line says what moved. */}
          <div class="card" style="margin-top:12px">
            <div class="spread" style="align-items:flex-start">
              <div>
                <div class="kicker" style="text-transform:capitalize">{fmtMonth(month.from)}</div>
                <div style="font-family:var(--disp);font-weight:800;font-size:28px;line-height:1.1;margin-top:4px">
                  {S.memory.monthScenes(month.scenes)}
                </div>
              </div>
              {month.levelFrom != null && month.levelTo != null && (
                <span class="lvl">{month.levelFrom === month.levelTo
                  ? idxLvl(month.levelTo)
                  : `${idxLvl(month.levelFrom)} → ${idxLvl(month.levelTo)}`}</span>
              )}
            </div>

            <div class="monthgrid">
              {month.days.map((day, i) => (
                day ? <span key={day.date} class={'mday ' + day.mark} title={day.date}></span>
                    : <span key={'pad' + i} class="mday pad"></span>
              ))}
            </div>
            <div class="mlegend">
              <span><i class="call"></i>{S.memory.legendCall}</span>
              <span><i class="both"></i>{S.memory.legendBoth}</span>
              <span><i class="today"></i>{S.memory.legendToday}</span>
            </div>

            {month.scenes === 0
              ? <div class="tiny" style="margin-top:12px">{S.memory.monthEmpty}</div>
              : (
                <div class="row" style="align-items:flex-start;gap:14px;margin-top:14px">
                  <div style="flex:1">
                    <div style="font-family:var(--disp);font-weight:800;font-size:24px">+{month.cardsBorn}</div>
                    <div class="tiny" style="line-height:1.3">{S.memory.cardsBorn}</div>
                  </div>
                  {month.wpm != null && (
                    <div style="flex:1">
                      <div style="font-family:var(--disp);font-weight:800;font-size:24px">{month.wpm}</div>
                      <div class="tiny" style="line-height:1.3">
                        {S.memory.wpmLabel}{month.wpmPrev != null ? ' ' + S.memory.wpmPrev(month.wpmPrev) : ''}
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Her own reading of it, in the colour of what stuck. Only once there is
              something to read: an encouragement about an empty month is noise. */}
          {lastRemark && (
            <div class="mremark">
              <Bust d={36} />
              <div>« {lastRemark} »</div>
            </div>
          )}

          <div class="card" style="margin-top:12px">
            <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:8px">{S.memory.yourTopics}</div>
            <div class="row" style="flex-wrap:wrap">
              {mem.interests.slice().sort((a, b) => b.weight - a.weight).map(i => (
                <span key={i.label} class="chip teal">{i.label} <span style="opacity:.6">×{Math.round(i.weight * 10) / 10}</span></span>
              ))}
              {!mem.interests.length && <span class="muted" style="font-size:13.5px">{S.memory.noTopics}</span>}
            </div>
          </div>
        </div>
      )}

      {tab === 'comp' && (() => {
        const curBand = band(mem.cefr.overall);
        const item = selComp ? BY_ID[selComp] : null;
        const entry = selComp ? mem.comp?.[selComp] : undefined;
        const pinned = !!selComp && (mem.pinned ?? []).includes(selComp);
        const statusTxt = !entry
          ? S.memory.noData
          : (entry.status === 'ok' ? S.memory.acquired : entry.status === 'ko' ? S.memory.toWorkOn : S.memory.partial)
            + ' · ' + S.memory.seenOn + ' ' + fmtDate(entry.lastSeen);
        return (
          <div>
            <p class="muted" style="margin:0 0 12px;font-size:14px;line-height:1.5">
              {S.memory.matrixIntro}
            </p>
            <div class="matrix">
              <div></div>
              {BANDS.map(b => <div key={b} class={'mx-h' + (b === curBand ? ' cur' : '')}>{b}</div>)}
              {CATS.map(([cat, catLabel]) => [
                <div key={cat} class="mx-cat">{catLabel}</div>,
                ...BANDS.map(b => (
                  <div key={cat + b} class={'mx-cell' + (b === curBand ? ' cur' : '')}>
                    {compForCell(cat, b, mem.profile.target).map(c => {
                      const e = mem.comp?.[c.id];
                      const cls = e ? e.status : '';
                      return (
                        <button
                          key={c.id}
                          class={'cc ' + cls + (selComp === c.id ? ' sel' : '')}
                          title={c.label}
                          onClick={() => setSelComp(selComp === c.id ? null : c.id)}
                        ></button>
                      );
                    })}
                  </div>
                ))
              ])}
            </div>
            <div class="mx-legend">
              <span class="ok"><i></i>{S.memory.legendOk}</span>
              <span class="ko"><i></i>{S.memory.legendKo}</span>
              <span class="partial"><i></i>{S.memory.legendPartial}</span>
              <span><i></i>{S.memory.legendNone}</span>
            </div>
            {item && (
              <div class="card" style="border-color:var(--line2)">
                <div class="spread">
                  <div style="font-weight:650;font-size:15px">{item.label}</div>
                  <span class="lvl">{item.band}</span>
                </div>
                <div class="tiny" style="margin-top:6px">{CATS.find(([c]) => c === item.cat)?.[1]} · {statusTxt}</div>
                {entry?.evidence && <div class="evi" style="margin-top:8px">« {entry.evidence} »</div>}
                <div class="row" style="margin-top:12px;flex-wrap:wrap">
                  <button
                    class={'btn ' + (pinned ? 'subtle' : 'primary')}
                    style="padding:9px 14px;font-size:13px"
                    onClick={() => {
                      update(m => {
                        m.pinned = m.pinned ?? [];
                        if (pinned) m.pinned = m.pinned.filter(x => x !== item.id);
                        else m.pinned = [...m.pinned, item.id].slice(-3);
                      });
                      if (!pinned) toast(S.memory.pinnedToast);
                    }}>
                    {pinned ? S.memory.pinned : S.memory.pinNext}
                  </button>
                  {entry?.status !== 'ok' && (
                    <button class="btn subtle" style="padding:9px 14px;font-size:13px"
                      onClick={() => update(m => { m.comp = m.comp ?? {}; m.comp[item.id] = { status: 'ok', lastSeen: todayISO() }; })}>
                      {S.memory.markAcquired}
                    </button>
                  )}
                  {entry && (
                    <button class="btn subtle" style="padding:9px 14px;font-size:13px;color:var(--red)"
                      onClick={() => update(m => { if (m.comp) delete m.comp[item.id]; })}>
                      {S.memory.clearData}
                    </button>
                  )}
                </div>
              </div>
            )}
            {!item && (mem.pinned ?? []).length > 0 && (
              <div class="tiny" style="margin-top:4px">
                {S.memory.nextCall} {(mem.pinned ?? []).map(id => BY_ID[id]?.label).filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        );
      })()}

      {tab === 'prog' && (
        <div>
          <Section title={S.memory.tabsOld.gaps} sub={S.memory.gapsLine(openW.length, doneW.length)} />
          {[...openW, ...doneW].map(w => (
            <div key={w.id} class="gap">
              <div class="head">
                <div class="label">{w.label} {w.cefr ? <span class="lvl" style="margin-left:6px">{w.cefr}</span> : null}</div>
                <span class={'status ' + w.status}>{statusIcon(w.status)} {statusLabel(w.status)}</span>
              </div>
              <div class="tiny" style="margin-top:5px">
                {S.memory.seenFirst} {fmtDate(w.firstSeen)} · {S.memory.seenLast} {fmtDate(w.lastSeen)} · {S.memory.workedTimes} {w.timesWorked || 0}×
              </div>
              {(w.evidence ?? []).length > 0 && (
                <details>
                  <summary class="tiny" style="cursor:pointer;margin-top:7px">{S.memory.examples} ({w.evidence.length})</summary>
                  {w.evidence.map((e, i) => <div key={i} class="evi">« {e.quote} » <span style="opacity:.6">· {e.src}</span></div>)}
                </details>
              )}
              <div class="row" style="margin-top:9px">
                {w.status !== 'resolved' && (
                  <button class="btn subtle" style="padding:7px 13px;font-size:12.5px"
                    onClick={() => update(m => { const x = m.weaknesses.find(y => y.id === w.id); if (x) x.status = 'resolved'; })}>
                    {S.memory.markGapAcquired}
                  </button>
                )}
                <button class="btn subtle" style="padding:7px 13px;font-size:12.5px;color:var(--red)"
                  onClick={() => updateUndoable(m => { m.weaknesses = m.weaknesses.filter(y => y.id !== w.id); }, S.memory.entryForgotten)}>
                  {S.memory.forget}
                </button>
              </div>
            </div>
          ))}
          {!mem.weaknesses.length && <div class="card muted">{S.memory.noGaps}</div>}

          <Section title={S.memory.tabsOld.str} />
          {mem.strengths.map(s => (
            <div key={s.id} class="gap">
              <div class="head"><div class="label">{s.label}</div><span class="status resolved">{S.memory.strengthTag}</span></div>
              {(s.evidence ?? []).map((e, i) => <div key={i} class="evi">« {e.quote} » <span style="opacity:.6">· {e.src}</span></div>)}
              <button class="btn subtle" style="margin-top:8px;padding:6px 11px;font-size:11.5px;color:var(--red)"
                onClick={() => updateUndoable(m => { m.strengths = m.strengths.filter(x => x.id !== s.id); }, S.memory.entryForgotten)}>
                {S.memory.forget}
              </button>
            </div>
          ))}
          {!mem.strengths.length && <div class="card muted">{S.memory.noStrengths}</div>}
        </div>
      )}

      {tab === 'carnet' && (
        <div>
          {/* The portrait first, because it is what Odile actually opens a call holding —
              the list underneath is the raw material it was built from. */}
          <Section title={S.memory.portraitTitle} sub={S.memory.portraitNote} />
          <div class="card">
            {port.basics.length === 0 && <div class="muted">{S.memory.noFacts}</div>}
            {port.basics.map(g => (
              <div key={g.cat} class="kv">
                <span class="k">{S.factCats[g.cat as keyof typeof S.factCats] ?? g.cat}</span>
                <span style="text-align:right">{g.facts.map(f => f.text.replace(/\.$/, '')).join(' · ')}</span>
              </div>
            ))}
          </div>

          <Section title={S.memory.tabsOld.facts} sub={S.memory.factsIntro} />
          {mem.facts.slice().sort((a, b) => b.lastSaid.localeCompare(a.lastSaid)).map(f => (
            <div key={f.id} class="gap">
              <div class="head">
                <div class="label" style="font-weight:500">{f.text}</div>
                <span class="chip sm">{S.factCats[f.category as keyof typeof S.factCats] ?? f.category}</span>
              </div>
              <div class="tiny" style="margin-top:4px">{S.memory.saidOn} {fmtDate(f.firstSaid)}{f.lastSaid !== f.firstSaid ? ' · ' + S.memory.saidAgain + ' ' + fmtDate(f.lastSaid) : ''}</div>
              <div class="row" style="margin-top:8px">
                <button class="btn subtle" style="padding:6px 11px;font-size:11.5px"
                  onClick={() => {
                    const t = prompt(S.common.edit, f.text);
                    if (t?.trim()) update(m => { const x = m.facts.find(y => y.id === f.id); if (x) x.text = t.trim(); });
                  }}>
                  {S.common.edit}
                </button>
                <button class="btn subtle" style="padding:6px 11px;font-size:11.5px;color:var(--red)"
                  onClick={() => updateUndoable(m => { m.facts = m.facts.filter(x => x.id !== f.id); }, S.memory.entryForgotten)}>
                  {S.memory.forget}
                </button>
              </div>
            </div>
          ))}
          {!mem.facts.length && <div class="card muted">{S.memory.noFacts}</div>}

          <Section title={S.memory.tabsOld.voc} />
          <input placeholder={S.common.search} value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} style="margin-bottom:12px" />
          <div class="card">
            <table class="vocab-t">
              {vocab.slice().reverse().map(v => (
                <tr key={v.fr}>
                  <td lang={mem.profile.target}>
                    {v.fr}
                    {v.ex ? <div class="tiny" style="white-space:normal;font-weight:400">{v.ex}</div> : null}
                  </td>
                  <td class="muted" lang={mem.profile.native} style="white-space:normal">{v.de}</td>
                  <td style="text-align:right;white-space:nowrap;width:1%">
                    {findVocabCard(mem.deck, v.fr)
                      ? <span style="color:var(--teal)" title={S.review.vocabHasCard} aria-label={S.review.vocabHasCard}>✓</span>
                      : (
                        <button class="btn subtle" style="padding:5px 10px;font-size:11.5px"
                          onClick={() => makeVocabCard(v)}>{S.review.vocabMakeCard}</button>
                      )}
                  </td>
                  <td style="width:30px">
                    <button class="btn subtle" style="padding:4px 8px;font-size:11px;color:var(--red)" title={S.memory.forget}
                      onClick={() => updateUndoable(m => { m.vocab = m.vocab.filter(x => x.fr !== v.fr); }, S.memory.entryForgotten)}>✕</button>
                  </td>
                </tr>
              ))}
            </table>
            {!vocab.length && <div class="muted" style="padding:6px">{S.memory.noVocabFound}</div>}
          </div>
          <div class="tiny" style="margin-top:8px">{S.memory.vocabCount(mem.vocab.length)}</div>
        </div>
      )}

      {tab === 'sess' && (
        <div class="card">
          {mem.sessions.slice().reverse().map(s => (
            <div key={s.id} class="row" style="align-items:stretch;gap:4px">
              <button class="sess" style="flex:1" onClick={() => openSession(s.id)}>
                <div>
                  <div class="t">{s.topic}</div>
                  <div class="tiny" style="margin-top:3px">
                    {s.source === 'duolingo' ? S.memory.importTag : '↗ '}{fmtDate(s.date)}
                    {s.minutes ? ' · ' + s.minutes + ' min' : ''}{s.wpm ? ' · ' + S.review.wpmLine(s.wpm) : ''}{s.xp ? ' · +' + s.xp + ' XP' : ''}
                  </div>
                </div>
                <span style="width:18px;color:var(--ink3);display:inline-flex"><I.chev /></span>
              </button>
              <button class="btn subtle" style="padding:4px 10px;font-size:11px;color:var(--red);align-self:center" title={S.common.del}
                onClick={() => updateUndoable(m => { m.sessions = m.sessions.filter(x => x.id !== s.id); }, S.memory.entryForgotten)}>✕</button>
            </div>
          ))}
          {!mem.sessions.length && <div class="muted">{S.memory.noSessions}</div>}
        </div>
      )}

      {tab === 'adv' && (
        <div>
          <Section title={S.memory.tabsOld.brief} sub={S.memory.briefIntro} />
          {draft == null ? (
            <div>
              <div class="row" style="margin-bottom:10px;flex-wrap:wrap">
                <button class="btn ghost" onClick={() => setDraft(mem.tutorTemplate || defaultTpl)}>{S.memory.editTemplate}</button>
                {customTpl && (
                  <span class="chip sm purple">{S.memory.customTemplate}</span>
                )}
              </div>
              <pre class="brief">{brief}</pre>
            </div>
          ) : (
            <div>
              <textarea class="json" style="min-height:420px" value={draft}
                onInput={e => setDraft((e.target as HTMLTextAreaElement).value)}></textarea>
              <div class="tiny" style="margin:8px 0;line-height:1.6">
                {S.memory.variables} {TEMPLATE_VARS.map(v => `{{${v}}}`).join(' · ')}
              </div>
              <details style="margin-bottom:10px">
                <summary class="tiny" style="cursor:pointer">{S.memory.varWhat}</summary>
                <div class="tiny" style="margin-top:6px;line-height:1.7">
                  {TEMPLATE_VARS.map(v => <div key={v}><code>{'{{' + v + '}}'}</code> — {S.memory.varGloss[v]}</div>)}
                </div>
              </details>
              <div class="row" style="flex-wrap:wrap">
                <button class="btn primary" onClick={saveTpl}>{S.common.save}</button>
                <button class="btn ghost" onClick={() => setDraft(defaultTpl)}>{S.memory.reset}</button>
                <button class="btn subtle" onClick={() => setDraft(null)}>{S.common.cancel}</button>
              </div>
            </div>
          )}


          <Section title={S.memory.tabsOld.data} />
          <div class="row" style="flex-wrap:wrap;margin-bottom:12px">
            <button class="btn ghost" onClick={() => download('causerie-memoire-' + todayISO() + '.json', JSON.stringify(mem, null, 2))}>
              {S.memory.exportJson}
            </button>
            <label class="btn ghost" style="cursor:pointer">
              {S.memory.importBtn}
              <input type="file" accept="application/json" style="display:none" onChange={e => {
                const inp = e.target as HTMLInputElement;
                const f = inp.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => { if (importJson(String(r.result))) toast(S.memory.importedToast); };
                r.readAsText(f);
                inp.value = '';
              }} />
            </label>
            <button class="btn ghost" onClick={() => setRaw(raw == null ? JSON.stringify(mem, null, 2) : null)}>
              {raw == null ? S.memory.rawJson : S.memory.closeEditor}
            </button>
            <button class="btn danger" onClick={() => void (async () => {
              if (!confirm(S.memory.forgetAllConfirm)) return;
              // The server copy goes first: a local-only wipe with a surviving blob
              // would silently keep everything restorable.
              const tok = mem.sync?.token;
              if (tok && mem.sync?.enabled) {
                const ok = await deleteRemote(tok);
                if (!ok && !confirm(S.memory.serverWipeFailed)) return;
              }
              const ap = activeProfile();
              if (ap) deleteProfile(ap.id); else wipeMem(); // registry entry too: no ghost profiles
              location.reload();
            })()}>
              {S.memory.forgetAll}
            </button>
          </div>
          {raw != null && (
            <div>
              <textarea class="json" value={raw} onInput={e => setRaw((e.target as HTMLTextAreaElement).value)}></textarea>
              <button class="btn primary" style="margin-top:10px" onClick={() => { if (importJson(raw)) { toast(S.memory.savedToast); setRaw(null); } }}>
                {S.memory.applySave}
              </button>
            </div>
          )}
          <div class="tiny" style="margin-top:10px;line-height:1.5">
            {mem.sync?.enabled ? S.memory.dataNoteSynced : S.memory.dataNoteLocal}
          </div>
        </div>
      )}
    </div>
  );
}
