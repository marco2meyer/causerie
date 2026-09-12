import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { CourseStep, GrammarCourse, GrammarGuide, Memory } from '../types';
import { cachedCourse, cachedGuide, forgetGuide, makeCourse, makeGuide } from '../lib/course';
import { checkAnswer, grammarFocus, markCourseDone } from '../lib/grammar';
import type { CompItem } from '../lib/competencies';
import { SHEET_BY_ID } from '../lib/sheets';
import { saveMem } from '../lib/storage';
import { deepClone } from '../lib/utils';
import { Viz } from '../components/Viz';
import { Odile } from '../components/Avatar';
import { I } from '../components/icons';
import { ui } from '../lang';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  onExit: () => void;
  toast: (msg: string, err?: boolean) => void;
}

/** The grammar strand's one screen.
 *
 *  It shows the LESSON while the concept is untaught and the FICHE once it has been sat
 *  through, because those are the two things the same button means at the two moments a
 *  student presses it: teach me this, and remind me how this went. Which of the two is
 *  showing is decided by the memory, not by a parameter, so the button on the day screen
 *  never has to know which it is opening.
 *
 *  A lesson abandoned halfway starts again from the top next time. The course itself is
 *  cached, so that costs nothing but the minutes, and five minutes of discovery does not
 *  really have a halfway point — the rule screen only means anything to someone who has
 *  just worked the pattern out.
 *
 *  The lesson runs in discovery order (lib/course writes it that way): examples first, the
 *  learner works out the pattern, and only then is the rule named. The player's job is to
 *  keep that honest — the answer is never on screen before it has been asked for, and no
 *  step can be skipped past. */

const XP_COURSE = 12;

export function Grammar({ mem, setMem, onExit, toast }: Props) {
  const S = ui();
  const focus = useMemo(() => grammarFocus(mem), []);
  const item = focus?.item ?? null;
  // Taught already = the fiche is what this button means now. Decided once at mount so
  // finishing the lesson does not swap the screen out from under the last tap.
  const taught = useMemo(() => !!focus?.topic, []);
  const [mode, setMode] = useState<'course' | 'sheet' | 'redo'>(taught ? 'sheet' : 'course');

  if (!item) {
    return (
      <div class="rev-stage gr-stage fadein">
        <div class="rev-top">
          <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={onExit}>{S.common.back}</button>
        </div>
        <div class="gr-empty">
          <div style="width:150px;height:150px"><Odile state="idle" /></div>
          <h2 style="font-size:26px;line-height:1.12;margin:0">{S.gram.nothing}</h2>
          <p class="muted" style="font-size:14.5px;line-height:1.55;margin:0;max-width:380px">{S.gram.nothingSub}</p>
        </div>
        <div class="rev-actions"><button class="cta ink solo" onClick={onExit}>{S.common.done}</button></div>
      </div>
    );
  }

  return mode === 'sheet'
    ? <Fiche mem={mem} item={item} toast={toast} onExit={onExit} onRedo={() => setMode('redo')} />
    // A redo asks for a NEW lesson, not the transcript of the one already sat through — but
    // the cached one is deleted only once its replacement has landed. It is the only home of
    // the concept's exercise bank, and an abandoned redo must not leave tonight's sitting
    // with nothing to ask.
    : <Course mem={mem} setMem={setMem} item={item} toast={toast} onExit={onExit}
        fresh={mode === 'redo'} onDone={() => setMode('sheet')} />;
}

/* ---------------------------------------------------------------- the lesson */

type Phase = 'asking' | 'answered';

function Course({ mem, setMem, item, toast, onExit, onDone, fresh }: {
  mem: Memory; setMem: (m: Memory) => void; item: CompItem;
  toast: (m: string, e?: boolean) => void; onExit: () => void; onDone: () => void;
  /** Write a new lesson rather than replaying the cached one. */
  fresh?: boolean;
}) {
  const S = ui();
  const lang = mem.profile.target;
  const [course, setCourse] = useState<GrammarCourse | null>(() => (fresh ? null : cachedCourse(item.id)));
  const [busy, setBusy] = useState(!course);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<'right' | 'accent' | 'wrong' | null>(null);
  const [finished, setFinished] = useState(false);
  /** Why the last attempt failed, shown quietly under the message. A lesson that will not
   *  come is a dead end on a phone, where there is no console to ask. */
  const [why, setWhy] = useState('');
  const [tries, setTries] = useState(0);
  const memRef = useRef(mem);
  memRef.current = mem;

  useEffect(() => {
    if (course) return;
    let live = true;
    setBusy(true);
    setWhy('');
    makeCourse(mem, item, fresh && tries === 0)
      .then(c => { if (live) { setCourse(c); setBusy(false); if (fresh) forgetGuide(item.id); } })
      .catch((e: unknown) => {
        if (!live) return;
        setBusy(false);
        // The replacement never came. Fall back to the cached lesson rather than leaving the
        // concept with nothing — and with no bank for tonight's sitting.
        const kept = cachedCourse(item.id);
        if (kept) { setCourse(kept); return; }
        setWhy(String((e as Error)?.message ?? e).slice(0, 160));
      });
    return () => { live = false; };
  }, [tries]);

  const steps = course?.steps ?? [];
  const step: CourseStep | undefined = steps[i];
  // A rule or recap screen has nothing to answer, so it is "answered" the moment it appears
  // and its one button reads "understood" rather than "check".
  const passive = step ? step.kind === 'rule' || step.kind === 'recap' : false;

  const finish = () => {
    const m = deepClone(memRef.current);
    markCourseDone(m, item.id);
    m.xp = (m.xp || 0) + XP_COURSE;
    saveMem(m);
    setMem(m);
    setFinished(true);
  };

  const check = () => {
    if (!step || phase === 'answered') return;
    if (step.kind === 'gap') {
      const v = checkAnswer(typed, step.answer);
      // An accent slip is not a right answer — the whole point of a French gap-fill is the
      // letters AND the marks on them — but it is told apart from a wrong one, because
      // "mange" for "mangé" and "manger" for "mangé" are not the same mistake.
      setVerdict(v);
    } else {
      setVerdict(picked === step.correct ? 'right' : 'wrong');
    }
    setPhase('answered');
  };

  const next = () => {
    if (i + 1 >= steps.length) { finish(); return; }
    setI(i + 1);
    setPhase('asking');
    setPicked(null);
    setTyped('');
    setVerdict(null);
  };

  if (busy) {
    return (
      <div class="rev-stage gr-stage fadein">
        <div class="rev-top">
          <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={onExit}>{S.common.back}</button>
        </div>
        <div class="gr-empty">
          <div style="width:150px;height:150px"><Odile state="thinking" /></div>
          <div style="font-family:var(--disp);font-weight:800;font-size:20px">{S.gram.making}</div>
          <div class="tiny">{item.label}</div>
        </div>
      </div>
    );
  }

  if (!course || !steps.length) {
    return (
      <div class="rev-stage gr-stage fadein">
        <div class="rev-top">
          <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={onExit}>{S.common.back}</button>
        </div>
        <div class="gr-empty">
          <h2 style="font-size:24px;margin:0">{S.gram.fail}</h2>
          {/* The reason, small and out of the way. Nobody wants it, and the one person who
              does is holding a phone with no console when the lesson will not come. */}
          {why && <div class="tiny" style="max-width:380px;word-break:break-word">{why}</div>}
        </div>
        <div class="rev-actions" style="display:flex;flex-direction:column;gap:9px">
          <button class="cta solo" onClick={() => setTries(t => t + 1)}>{S.common.retry}</button>
          <button class="btn subtle big" onClick={onExit}>{S.common.back}</button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div class="rev-stage gr-stage fadein">
        <div style="position:relative;height:206px;flex-shrink:0;background:var(--blue);border-radius:var(--r);overflow:hidden">
          <div style="position:absolute;left:50%;transform:translateX(-50%);bottom:-22px;width:190px;height:190px"><Odile state="idle" /></div>
        </div>
        <div style="margin-top:22px">
          <div class="kicker">{S.gram.finished}</div>
          <h2 style="font-size:30px;line-height:1.1;margin-top:8px" lang={lang}>{course.title}</h2>
          <div style="margin-top:14px;font-size:14.5px;line-height:1.55;color:var(--ink2);text-wrap:pretty">
            {S.gram.finishedSub}
          </div>
          <div class="row" style="margin-top:12px"><span class="chip teal sm">+{XP_COURSE} XP</span></div>
        </div>
        <div class="rev-actions" style="margin-top:auto;display:flex;flex-direction:column;gap:9px">
          <button class="cta" onClick={onDone}><span>{S.gram.sheet}</span></button>
          <button class="btn subtle big" onClick={onExit}>{S.common.done}</button>
        </div>
      </div>
    );
  }

  if (!step) return null;
  const canSubmit = step.kind === 'gap' ? typed.trim().length > 0 : picked !== null;

  return (
    <div class="rev-stage gr-stage fadein">
      <div class="rev-top">
        <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={onExit}>{S.common.close}</button>
        <div class="rev-bar"><i style={{ width: ((i + (phase === 'answered' ? 1 : 0)) / steps.length) * 100 + '%' }}></i></div>
        <span class="tiny" style="width:44px;text-align:right">{i + 1}/{steps.length}</span>
      </div>

      <div class={'gr-card' + (passive ? ' rule' : '')}>
        <div class="rev-type">{passive ? (step.kind === 'rule' ? S.gram.theRule : S.gram.keep) : S.gram.title}</div>
        <div class="gr-prompt">{step.prompt}</div>

        {/* The evidence. On a discovery step this IS the lesson: the learner is meant to
            read these four lines and see the pattern before anybody names it. */}
        {step.examples.length > 0 && (
          <ul class="gr-ex">
            {step.examples.slice(0, 5).map((e, k) => (
              <li key={k}><b lang={lang}>{e.t}</b>{e.gloss ? <span>{e.gloss}</span> : null}</li>
            ))}
          </ul>
        )}

        <Viz viz={step.viz} lang={lang} />

        {passive && step.lines.length > 0 && (
          <ul class="gr-rule">{step.lines.slice(0, 6).map((l, k) => <li key={k} lang={lang}>{l}</li>)}</ul>
        )}

        {(step.kind === 'discover' || step.kind === 'choice') && (
          <div class="gr-opts">
            {step.options.map((o, k) => {
              const isRight = phase === 'answered' && k === step.correct;
              const isMine = picked === k;
              const cls = phase === 'answered'
                ? (isRight ? ' right' : isMine ? ' wrong' : ' dim')
                : (isMine ? ' on' : '');
              return (
                <button key={k} class={'gr-opt' + cls} disabled={phase === 'answered'}
                  aria-pressed={picked === k} onClick={() => setPicked(k)}>{o}</button>
              );
            })}
          </div>
        )}

        {step.kind === 'gap' && (
          <div class="gr-gap">
            <div class="gr-sentence" lang={lang}>
              {gapParts(step.text).map((p, k) => p === null
                ? <span key={k} class={'gr-slot' + (phase === 'answered' ? ' filled ' + (verdict === 'right' ? 'ok' : verdict === 'accent' ? 'near' : 'no') : '')}>
                    {phase === 'answered' ? step.answer : ' '.repeat(6)}
                  </span>
                : <span key={k}>{p}</span>)}
            </div>
            <input class="gr-input" value={typed} lang={lang} disabled={phase === 'answered'}
              placeholder={S.gram.answerHere} autocapitalize="off" autocomplete="off" spellcheck={false}
              onInput={e => setTyped((e.target as HTMLInputElement).value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) check(); }} />
          </div>
        )}

        {phase === 'answered' && !passive && (
          <div class={'gr-verdict ' + (verdict === 'right' ? 'ok' : verdict === 'accent' ? 'near' : 'no')}>
            <b>{verdict === 'right' ? S.gram.right : verdict === 'accent' ? S.gram.accent : S.gram.wrong}</b>
            {verdict !== 'right' && step.kind === 'gap' && <span>{S.gram.was(step.answer)}</span>}
          </div>
        )}

        {(phase === 'answered' || passive) && step.explain && (
          <div class="gr-explain">{step.explain}</div>
        )}
      </div>

      <div class="rev-actions">
        {passive || phase === 'answered'
          ? <button class="cta solo" onClick={next}>{passive ? S.gram.gotIt : S.gram.next}</button>
          : <button class="cta ink solo" disabled={!canSubmit} onClick={check}>{S.gram.check}</button>}
      </div>
    </div>
  );
}

/** Splits a gap sentence into text runs with `null` where the blank goes. Same two-or-more
 *  underscore marker the deck's clozes use, so a lesson and a card write a gap the same way. */
export function gapParts(text: string): (string | null)[] {
  const out: (string | null)[] = [];
  let last = 0;
  const re = /_{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(null);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}

/* ----------------------------------------------------------------- the fiche */

function Fiche({ mem, item, toast, onExit, onRedo }: {
  mem: Memory; item: CompItem;
  toast: (m: string, e?: boolean) => void; onExit: () => void; onRedo: () => void;
}) {
  const S = ui();
  const lang = mem.profile.target;
  const [guide, setGuide] = useState<GrammarGuide | null>(() => cachedGuide(item.id));
  const [busy, setBusy] = useState(!guide);
  const [p, setP] = useState(0);
  // The pack's compact sheet: what is on screen while the detailed one is being written,
  // and what is left if the network is not there. Four of the thirty-three French grammar
  // cells have none, which is why this is allowed to be undefined.
  const fallback = SHEET_BY_ID[item.id];

  useEffect(() => {
    if (guide) return;
    let live = true;
    makeGuide(mem, item)
      .then(g => { if (live) { setGuide(g); setBusy(false); } })
      .catch(() => { if (live) { setBusy(false); if (!fallback) toast(S.gram.sheetFail, true); } });
    return () => { live = false; };
  }, []);

  const pages = guide?.pages ?? [];
  const page = pages[Math.min(p, Math.max(0, pages.length - 1))];

  return (
    <div class="rev-stage gr-stage fadein">
      <div class="rev-top">
        <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={onExit}>{S.common.back}</button>
        <div class="rev-bar"><i style={{ width: pages.length ? ((p + 1) / pages.length) * 100 + '%' : '0%' }}></i></div>
        <span class="tiny" style="width:52px;text-align:right">
          {pages.length > 1 ? S.gram.pageOf(p + 1, pages.length) : ''}
        </span>
      </div>

      <div class="gr-sheet">
        <div class="rev-type">{S.gram.title}</div>
        <h2 style="font-size:24px;line-height:1.15;margin:2px 0 0" lang={lang}>{guide?.title ?? fallback?.title ?? item.label}</h2>

        {page ? (
          <div class="gr-page">
            <div class="gr-pagetitle">{page.title}</div>
            {page.lines.length > 0 && (
              <ul class="gr-rule">{page.lines.map((l, k) => <li key={k} lang={lang}>{l}</li>)}</ul>
            )}
            <Viz viz={page.viz} lang={lang} />
            {page.examples.length > 0 && (
              <ul class="gr-ex">
                {page.examples.map((e, k) => (
                  <li key={k}><b lang={lang}>{e.t}</b>{e.gloss ? <span>{e.gloss}</span> : null}</li>
                ))}
              </ul>
            )}
            {page.traps.length > 0 && (
              <div class="gr-traps">
                <div class="kicker">{S.gram.traps}</div>
                <ul>{page.traps.map((t, k) => <li key={k} lang={lang}>{t}</li>)}</ul>
              </div>
            )}
          </div>
        ) : fallback ? (
          /* The house sheet, while the detailed one is being written or instead of it. */
          <div class="gr-page">
            {busy && <div class="tiny" style="margin-bottom:8px">{S.gram.makingSheet}</div>}
            <ul class="gr-rule">{fallback.core.map((l, k) => <li key={k} lang={lang}>{l}</li>)}</ul>
            <ul class="gr-ex">
              {fallback.examples.map((e, k) => (
                <li key={k}><b lang={lang}>{e.t}</b><span>{e.gloss}</span></li>
              ))}
            </ul>
            {(fallback.traps ?? []).length > 0 && (
              <div class="gr-traps">
                <div class="kicker">{S.gram.traps}</div>
                <ul>{(fallback.traps ?? []).map((t, k) => <li key={k} lang={lang}>{t}</li>)}</ul>
              </div>
            )}
          </div>
        ) : (
          <div class="gr-page"><div class="tiny">{busy ? S.gram.makingSheet : S.gram.sheetFail}</div></div>
        )}
      </div>

      <div class="rev-actions" style="display:flex;flex-direction:column;gap:9px">
        {pages.length > 1 && (
          <div class="row" style="gap:8px">
            <button class="btn ghost" style="flex:1" disabled={p === 0} onClick={() => setP(p - 1)}>{S.gram.prev}</button>
            <button class="btn ghost" style="flex:1" disabled={p >= pages.length - 1} onClick={() => setP(p + 1)}>{S.gram.next}</button>
          </div>
        )}
        <button class="btn subtle big" onClick={onRedo}><I.shuffle /> {S.gram.redo}</button>
      </div>
    </div>
  );
}
