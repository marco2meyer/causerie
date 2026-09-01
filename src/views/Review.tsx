import { useEffect, useState } from 'preact/hooks';
import type { Correction, CostLeg, Highlight, Memory, SessionRecord, VocabItem } from '../types';
import { cardFromCorrection, conceptKey, findCorrectionCard, findVocabCard, recognitionCards, sameConceptCards, vocabCards } from '../lib/srs';
import { saveMem } from '../lib/storage';
import { deepClone, fmtDay, norm } from '../lib/utils';
import { Odile } from '../components/Avatar';
import { Recast, Said, Strip } from '../components/Scene';
import { I } from '../components/icons';
import { CardForge } from '../components/CardForge';
import { Personalize } from '../components/Personalize';
import { type ToastFn } from '../components/Toast';
import { ui } from '../lang';

/** What one call cost, leg by leg. Last thing on the screen on purpose: useful to have,
 *  not the point of the screen. Shares are of the call total, so they always sum to 100. */
function CostPanel({ sess }: { sess: SessionRecord }) {
  const S = ui();
  const legs = Array.isArray(sess.costs) ? sess.costs : [];
  // Without the conversation leg the total would be the transcription alone: a small, wrong,
  // confident number. Better to show nothing than to under-report by an order of magnitude.
  // Which leg that is depends on the engine: 'realtime' for the speech-to-speech call,
  // 'chat' for the turn-by-turn one.
  if (!legs.some(l => l.kind === 'realtime' || l.kind === 'chat')) return null;
  // Several verbatim segments per call: one row per leg KIND, not per request.
  const byKind = new Map<string, { usd: number; models: Set<string> }>();
  for (const l of legs) {
    const e = byKind.get(l.kind) ?? { usd: 0, models: new Set<string>() };
    e.usd += l.usd;
    e.models.add(l.model);
    byKind.set(l.kind, e);
  }
  const total = legs.reduce((a, l) => a + l.usd, 0);
  if (total <= 0) return null;
  const usd = (n: number) => '$' + n.toFixed(n < 1 ? 3 : 2);
  const order: CostLeg['kind'][] = ['realtime', 'captions', 'stt', 'chat', 'tts', 'verbatim', 'analysis'];
  const shown = order.filter(k => byKind.has(k));
  // Largest remainder, so the column adds up to 100 rather than to 101. Four rounded
  // percentages that visibly do not sum are the kind of detail that costs a number its
  // credibility, and the whole panel is a claim about money.
  const pct = (() => {
    const exact = shown.map(k => byKind.get(k)!.usd / total * 100);
    const floors = exact.map(Math.floor);
    let left = 100 - floors.reduce((a, b) => a + b, 0);
    const byRemainder = exact.map((v, i) => [v - floors[i], i] as const)
      .sort((a, b) => b[0] - a[0]);
    for (const [, i] of byRemainder) { if (left <= 0) break; floors[i]++; left--; }
    return Object.fromEntries(shown.map((k, i) => [k, floors[i]]));
  })();
  const per10 = sess.seconds && sess.seconds > 30 ? total / sess.seconds * 600 : null;
  return (
    <div class="card" style="margin-top:16px">
      <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:6px">{S.review.costTitle}</div>
      {shown.map(k => {
        const e = byKind.get(k)!;
        return (
          <div key={k} class="kv">
            <span class="k">{S.review.costLeg[k]}<span class="tiny" style="margin-left:6px;opacity:.65">{[...e.models].join(', ')}</span></span>
            <span style="font-variant-numeric:tabular-nums">{usd(e.usd)}<span class="tiny" style="margin-left:6px;opacity:.65">{pct[k]}%</span></span>
          </div>
        );
      })}
      <div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px">
        <span class="k" style="font-weight:650">{S.review.costTotal}</span>
        <span style="font-weight:650;font-variant-numeric:tabular-nums">{usd(total)}</span>
      </div>
      {per10 && <div class="tiny" style="margin-top:6px">{S.review.costPer10(usd(per10))}</div>}
      <div class="tiny" style="margin-top:4px;line-height:1.5">{S.review.costNote}</div>
    </div>
  );
}

/** What Odile was working from, folded away under the conversation it produced.
 *
 *  The briefing in the settings only ever shows what she would be told NOW. Change the
 *  prompt, or let a call change what the memory holds, and every past conversation
 *  silently acquires a briefing it never ran on — so there is no way to ask what she was
 *  actually told on the day a call went unusually well or unusually badly. This is that
 *  archive, kept next to the call rather than in a settings screen, because the question
 *  is always asked about a particular conversation. */
function BriefingPanel({ sess }: { sess: SessionRecord }) {
  const S = ui();
  if (!sess.briefing) return null;
  return (
    <details class="card" style="margin-top:16px">
      <summary style="cursor:pointer;font-family:var(--disp);font-weight:800;font-size:17px">
        {S.review.briefingTitle}
      </summary>
      <div class="tiny" style="margin:6px 0 10px;line-height:1.5">{S.review.briefingNote}</div>
      <pre style="white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.55;margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">{sess.briefing}</pre>
    </details>
  );
}

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  sess: SessionRecord;
  live: boolean;
  go: (view: string) => void;
  /** Opens the deck on top of this conversation; leaving it comes back here. */
  openCards: () => void;
  toast: ToastFn;
}

type Note = ({ kind: 'tip' } & Correction) | ({ kind: 'praise' } & Highlight);

/** Recast-noticing exercise: your sentence first, her version only when you ask for it,
 *  with the words she changed marked — implicit correction turned into noticing. The same
 *  two panels as the debrief's strip, except you have to earn the middle one. */
function Notice({ c, showLabel, lang }: { c: Correction; showLabel: string; lang?: string }) {
  const S = ui();
  const [open, setOpen] = useState(false);
  if (open) return <div style="margin-bottom:12px"><Strip you={c.original} her={c.besser} lang={lang} compact /></div>;
  return (
    <div class="strip" style="margin-bottom:12px">
      <div class="p-you" style="padding:12px 15px">
        <div class="kicker">{S.review.panelYou}</div>
        <div class="txt" style="font-size:16.5px" lang={lang}>{c.original}</div>
      </div>
      <div class="p-her" style="padding:12px 15px;justify-content:center">
        <button class="btn subtle" style="border-color:rgba(255,243,227,.5);color:var(--cream)" onClick={() => setOpen(true)}>{showLabel}</button>
      </div>
    </div>
  );
}

export function Review({ mem, setMem, sess, live, go, openCards, toast }: Props) {
  const S = ui();
  const [pzId, setPzId] = useState<string | null>(null);
  const [forgeSeed, setForgeSeed] = useState<{ text: string; turnId?: string } | null>(null);
  const an = sess.analysis;
  // Read defensively, not because this app writes a ragged transcript, but because the
  // debrief is the one screen that reads a record written months ago by a build that no
  // longer exists — and losing the whole analysis to one bad turn is the failure this
  // screen cannot have.
  const T = (Array.isArray(sess.transcript) ? sess.transcript : []).filter(Boolean);
  const notesByTurn: Record<number, Note[]> = {};
  (an?.corrections ?? []).forEach(c => { (notesByTurn[c.user_turn] ??= []).push({ kind: 'tip', ...c }); });
  (an?.highlights ?? []).forEach(h => { (notesByTurn[h.user_turn] ??= []).push({ kind: 'praise', ...h }); });
  const notices = (an?.corrections ?? [])
    .filter(c => c.original && c.besser && c.original.trim() !== c.besser.trim())
    .slice(0, 3);
  let ti = -1; // running student-turn index

  /** Cards this turn produced: the correction clozes attached to it, plus anything forged
   *  from its text. Drawn from the deck, so it survives deletion of the card. */
  const cardsForTurn = (turnIdx: number, turnId: string | undefined): number => {
    let n = 0;
    for (const c of an?.corrections ?? []) {
      if (c.user_turn === turnIdx && findCorrectionCard(mem.deck, sess.id, c)) n++;
    }
    if (turnId) n += mem.deck.cards.filter(c => c.sourceTurnId === turnId).length;
    return n;
  };

  /** The words to list under "new words". The analysis is the source; when it returned
   *  none, the vocabulary cards this call actually produced stand in — an empty list
   *  where cards exist is a reporting failure, not a fact about the conversation. */
  const vocabRows: VocabItem[] = (an?.new_vocab ?? []).length
    ? an!.new_vocab
    : mem.deck.cards
      .filter(c => c.sourceSessionId === sess.id && c.sourceKind === 'vocab' && c.type !== 'cloze')
      .map(c => ({ fr: c.front, de: c.back, ex: c.example ?? '' }));

  /** Every card in the deck teaching this word — the recognition/production pair and any
   *  cloze whose answer is the same word. The picture-sharing rule (lib/srs) decides what
   *  counts as the same word, so removing here matches what personalising there covers. */
  const cardsForWord = (fr: string) => {
    const seed = mem.deck.cards.find(c => conceptKey(c) === conceptKey({ type: 'fr2de', front: fr, back: '' }));
    return seed ? sameConceptCards(mem.deck, seed) : [];
  };

  /** The call decided this word was worth cards. Sometimes it is not — a word already
   *  known, a mis-transcription, a name. Undoing that decision was possible only by finding
   *  each card in the deck and deleting it one at a time, which is three screens away from
   *  the place the judgement is actually made. Undoable, like every other deletion here. */
  const removeVocabCards = (v: VocabItem) => {
    const doomed = new Set(cardsForWord(v.fr).map(c => c.id));
    if (!doomed.size) return;
    const snapshot = deepClone(mem);
    const m = deepClone(mem);
    m.deck.cards = m.deck.cards.filter(c => !doomed.has(c.id));
    const rec = m.sessions.find(x => x.id === sess.id);
    if (rec) rec.cardsAdded = Math.max(0, (rec.cardsAdded ?? 0) - doomed.size);
    saveMem(m);
    setMem(m);
    toast(S.review.vocabCardsRemoved(doomed.size), false,
      { label: S.common.undo, fn: () => { saveMem(snapshot); setMem(snapshot); } });
  };

  /** Pin a correction: guarantees its card exists and jumps the review queue. */
  const toggleStar = (c: Correction) => {
    const m = deepClone(mem);
    const card = findCorrectionCard(m.deck, sess.id, c);
    if (!card) {
      const fresh = cardFromCorrection(c, sess.id, mem.profile.target);
      fresh.starred = true;
      m.deck.cards.push(fresh);
      const s = m.sessions.find(x => x.id === sess.id);
      if (s) s.cardsAdded = (s.cardsAdded ?? 0) + 1;
    } else {
      card.starred = !card.starred;
    }
    saveMem(m);
    setMem(m);
  };
  const starState = (c: Correction) => findCorrectionCard(mem.deck, sess.id, c);

  /** A word the analysis listed but that never became a card gets made into one here:
   *  recognition now, production ten days behind it, the same pair the call builds. */
  const addVocabCard = (v: VocabItem) => {
    const m = deepClone(mem);
    if (findVocabCard(m.deck, v.fr)) return;
    const seen = new Set(m.deck.cards.map(c => c.type + '|' + norm(c.front)));
    const fresh = vocabCards(v, sess.id, recognitionCards(mem)).filter(c => !seen.has(c.type + '|' + norm(c.front)));
    if (!fresh.length) return;
    m.deck.cards.push(...fresh);
    const rec = m.sessions.find(x => x.id === sess.id);
    if (rec) rec.cardsAdded = (rec.cardsAdded ?? 0) + fresh.length;
    saveMem(m);
    setMem(m);
    toast(S.review.vocabHasCard);
  };

  return (
    <div class="fadein" style="max-width:680px;margin:0 auto">
      <div class="spread" style="align-items:flex-start;margin-bottom:18px">
        <div style="min-width:0">
          <div class="kicker">{sess.minutes ? S.review.callOf(sess.minutes, fmtDay(sess.date)) : fmtDay(sess.date)}</div>
          <h2 style="font-size:29px;line-height:1.1;margin-top:7px">{live ? S.review.sceneTitle : sess.topic}</h2>
          {live && <div class="tiny" style="margin-top:6px">{sess.topic}</div>}
        </div>
        <button class="btn subtle" style="flex-shrink:0" onClick={() => go(live ? 'today' : 'memory')}>{live ? S.common.done : S.common.back}</button>
      </div>

      {an ? (
        <div>
          <div class="card">
            <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:6px">{S.review.newVocab}</div>
            {vocabRows.length === 0 ? (
              <div class="muted" style="font-size:14px">{S.review.noVocab}</div>
            ) : (
              <table class="vocab-t">
                {vocabRows.map(v => {
                  const card = findVocabCard(mem.deck, v.fr);
                  return (
                    <tr key={v.fr}>
                      <td lang={mem.profile.target}>{v.fr}</td>
                      <td class="muted">{v.de}</td>
                      <td style="text-align:right;white-space:nowrap;width:1%">
                        {card
                          ? (
                            <button class="btn subtle" style="padding:5px 10px;font-size:11.5px;color:var(--red)"
                              title={S.review.vocabRemoveCard} aria-label={S.review.vocabRemoveCard}
                              onClick={() => removeVocabCards(v)}>
                              <span style="color:var(--jaune-ink)">✓</span> {S.review.vocabRemoveCard}
                            </button>
                          )
                          : (
                            <button class="btn subtle" style="padding:5px 10px;font-size:11.5px"
                              onClick={() => addVocabCard(v)}>{S.review.vocabMakeCard}</button>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </table>
            )}
            {(sess.cardsAdded ?? 0) > 0 && (
              <button class="cta ink" style="margin-top:14px" onClick={openCards}>
                <span>{S.review.newCards(sess.cardsAdded ?? 0)}</span>
                <span class="meta">{S.common.see}</span>
              </button>
            )}
          </div>

          {(an.next_focus ?? []).length > 0 && (
            <div class="card" style="margin-top:12px">
              <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:8px">{S.review.nextTime}</div>
              {an.next_focus.map(f => (
                <div key={f.label} class="row" style="padding:4px 0;align-items:flex-start">
                  <span class="lvl" style="margin-top:1px">{f.cefr}</span>
                  <div style="font-size:14px;line-height:1.45">{f.label}<div class="tiny">{f.grund}</div></div>
                </div>
              ))}
            </div>
          )}
          {notices.length > 0 && (
            <div style="margin-top:16px">
              <div class="section-t" style="margin:0 2px 10px">{S.review.noticeTitle}</div>
              {notices.map((c, i) => <Notice key={i} c={c} showLabel={S.review.noticeShow} lang={mem.profile.target} />)}
            </div>
          )}

          {/* The full list of both, on the Auswertung itself. The transcript below shows the
              same notes in context, but a note whose user_turn does not land on a rendered
              turn used to vanish without trace, and on a phone nobody scrolls a whole
              conversation to find out what they got wrong. No counts: this is not a grade. */}
          {(an.corrections ?? []).length > 0 && (
            <div class="card" style="margin-top:12px">
              <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:8px">{S.review.tipsTitle}</div>
              {an.corrections.map((c, i) => (
                <div key={i} class="sumnote tip">
                  <div class="sq" lang={mem.profile.target}>« <Said text={c.original} fixed={c.besser} /> »</div>
                  <div class="sf" lang={mem.profile.target}>{S.review.better} <Recast before={c.original} after={c.besser} /></div>
                  {c.erklaerung ? <div class="se">{c.erklaerung}</div> : null}
                </div>
              ))}
            </div>
          )}

          {(an.highlights ?? []).length > 0 && (
            <div class="card" style="margin-top:12px">
              <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:8px">{S.review.praiseTitle}</div>
              {an.highlights.map((h, i) => (
                <div key={i} class="sumnote praise">
                  {h.quote ? <div class="sq" lang={mem.profile.target}>« {h.quote} »</div> : null}
                  <div class="se">{h.kommentar}</div>
                </div>
              ))}
            </div>
          )}

          <div class="section-t">{S.review.transcriptTips}</div>
          <div class="convo">
            {T.map((it, i) => {
              if (it.role === 'user') ti++;
              const notes = it.role === 'user' ? notesByTurn[ti] ?? [] : [];
              return (
                <div key={it.id ?? i} class={'turn ' + (it.role === 'user' ? 'me' : '')}>
                  {it.role === 'user'
                    ? <div class="pfp me">{(mem.profile.name || 'M')[0]}</div>
                    : <div class="pfp"><Odile state="idle" /></div>}
                  <div class="bubblecol">
                    <div class={'bubble ' + (notes.length ? 'hasnote' : '')} lang={mem.profile.target}>{it.text}</div>
                    {(() => {
                      const nc = it.role === 'user' ? cardsForTurn(ti, it.id) : 0;
                      return (
                        <div class="row" style="gap:4px;flex-wrap:wrap">
                          <button class="mkcards" title={S.forge.fromTurn} onClick={() => setForgeSeed({ text: it.text, turnId: it.id })}>
                            <I.cards /> {S.forge.fromTurn}
                          </button>
                          {nc > 0 && <span class="turncards" title={S.review.turnCardsTitle}>✓ {S.review.turnCards(nc)}</span>}
                        </div>
                      );
                    })()}
                    {notes.map((n, k) => n.kind === 'tip' ? (
                      <div key={k} class="note tip">
                        <div class="nt"><I.spark /> {S.review.tip}</div>
                        {S.review.better} <Recast before={n.original} after={n.besser} />
                        <div style="margin-top:3px;opacity:.85">{n.erklaerung}</div>
                        {(() => {
                          const card = starState(n);
                          const on = !!card?.starred;
                          return (
                            <div class="row" style="gap:6px;flex-wrap:wrap">
                              <button
                                class="btn subtle"
                                style={`margin-top:7px;padding:5px 10px;font-size:11.5px;${on ? 'background:var(--jaune);border-color:var(--jaune);color:var(--ink)' : ''}`}
                                title={S.review.starTitle}
                                onClick={() => toggleStar(n)}>
                                {on ? S.review.starActive : card ? S.review.starCard : S.review.makeCard}
                              </button>
                              {card && (
                                <button class="btn subtle" style="margin-top:7px;padding:5px 10px;font-size:11.5px"
                                  title={S.review.imgTitle} onClick={() => setPzId(card.id)}>
                                  {card.img === 1 ? S.review.imgChange : S.review.imgAdd}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div key={k} class="note praise">
                        <div class="nt"><I.check /> {S.review.great}</div>
                        {n.kommentar}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {sess.verbatim && (
            <details class="card" style="margin-top:12px">
              <summary style="font-weight:650;cursor:pointer">{S.review.verbatimTitle}</summary>
              <div class="tiny" style="margin:6px 0 8px;line-height:1.5">{S.review.verbatimNote}</div>
              <div style="font-size:14px;line-height:1.6;white-space:pre-wrap" lang={mem.profile.target}>{sess.verbatim}</div>
            </details>
          )}


        </div>
      ) : (
        <div class="card">
          <div class="muted">{S.review.noAnalysis}{sess.source === 'duolingo' ? S.review.duoImport : ''}.</div>
          {sess.summary && <div style="margin-top:8px;font-size:14.5px;line-height:1.55">{sess.summary}</div>}
        </div>
      )}

      {live && <button class="btn primary big" style="margin-top:20px" onClick={() => go('today')}>{S.review.continue}</button>}

      <CostPanel sess={sess} />
      <BriefingPanel sess={sess} />

      {forgeSeed != null && (
        <CardForge mem={mem} setMem={setMem} seed={forgeSeed.text} turnId={forgeSeed.turnId}
          sessionId={sess.id} onClose={() => setForgeSeed(null)} toast={toast} />
      )}

      {pzId && (() => {
        const pc = mem.deck.cards.find(c => c.id === pzId);
        return pc ? (
          <Personalize card={pc} mem={mem} onClose={() => setPzId(null)}
            onFlag={(ids, has) => {
              const m = deepClone(mem);
              for (const x of m.deck.cards) {
                if (!ids.includes(x.id)) continue;
                if (has) x.img = 1; else delete x.img;
              }
              saveMem(m);
              setMem(m);
            }} />
        ) : null;
      })()}
    </div>
  );
}
