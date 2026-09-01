import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Memory } from '../types';
import { cleanSnippet, paras, playParas, translateSnippet, type Story } from '../lib/story';
import { speak, stopSpeaking } from '../lib/tts';
import { keepAwake } from '../lib/wakelock';
import { CardForge } from './CardForge';
import { I } from './icons';
import { ui } from '../lang';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  story: Story;
  onClose: () => void;
  toast: (msg: string, err?: boolean) => void;
}

interface Sel { p: number; a: number; b: number }

/** Story player overlay: opens on "Écouter" and starts reading. One comprehension
 *  question per paragraph appears as that paragraph finishes. The text can be pulled
 *  in for read-along; tapping a word (or extending to a phrase) shows a translation
 *  in context, from which cards can be forged directly. */
export function StoryPlayer({ mem, setMem, story, onClose, toast }: Props) {
  const S = ui();
  const target = mem.profile.target;
  const pList = useMemo(() => paras(story.text), [story.text]);
  const qs = useMemo(() => (story.questions ?? []).slice(0, pList.length), [story, pList]);

  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(-1); // paragraph being read, -1 when idle
  const [heard, setHeard] = useState(0); // paragraphs fully heard (monotonic)
  const [showText, setShowText] = useState(false);
  const [qAns, setQAns] = useState<Record<number, number>>({});
  const [sel, setSel] = useState<Sel | null>(null);
  const [trans, setTrans] = useState<{ busy: boolean; text?: string; note?: string; err?: boolean }>({ busy: false });
  const [forgeSeed, setForgeSeed] = useState<string | null>(null);

  const cancelRef = useRef<(() => void) | null>(null);
  const heardRef = useRef(0);
  const forgeOpenRef = useRef(false);
  forgeOpenRef.current = forgeSeed != null;
  const transSeq = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const stop = () => { cancelRef.current?.(); cancelRef.current = null; stopSpeaking(); };

  const play = () => {
    if (playing) return;
    const from = heardRef.current >= pList.length ? 0 : heardRef.current;
    setPlaying(true);
    setCur(from);
    cancelRef.current = playParas(pList, from, speak, h => {
      heardRef.current = Math.max(heardRef.current, h);
      setHeard(heardRef.current);
      setCur(h);
    }, () => { setPlaying(false); setCur(-1); });
  };

  const close = () => { stop(); onClose(); };

  useEffect(() => {
    play(); // arriving here IS the click on "Écouter"
    rootRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !forgeOpenRef.current) close(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); stop(); };
  }, []);

  // Two minutes of listening with nothing to touch: the same reason the call holds the
  // screen. Only while she is actually reading — a story stopped halfway so the text can
  // be studied is a screen being tapped, and it can dim like any other.
  useEffect(() => (playing ? keepAwake() : undefined), [playing]);

  // Tap-to-translate: a second tap in the same paragraph extends the snippet to a phrase.
  const tapWord = (p: number, w: number) => {
    setSel(s => (s && s.p === p ? { p, a: Math.min(s.a, w), b: Math.max(s.b, w) } : { p, a: w, b: w }));
  };

  const wordsOf = (text: string) => text.split(/(\s+)/);

  const snippet = useMemo(() => {
    if (!sel) return '';
    const toks = wordsOf(pList[sel.p] ?? '');
    const picked: string[] = [];
    let wi = 0;
    for (const t of toks) {
      if (/^\s+$/.test(t) || !t) continue;
      if (wi >= sel.a && wi <= sel.b) picked.push(t);
      wi++;
    }
    return cleanSnippet(picked.join(' '));
  }, [sel, pList]);

  useEffect(() => {
    if (!sel || !snippet) { setTrans({ busy: false }); return; }
    const seq = ++transSeq.current;
    setTrans({ busy: true });
    translateSnippet(snippet, pList[sel.p] ?? '', mem)
      .then(r => { if (seq === transSeq.current) setTrans({ busy: false, text: r.translation, note: r.note || undefined }); })
      .catch(() => { if (seq === transSeq.current) setTrans({ busy: false, err: true }); });
  }, [snippet]);

  const visibleQ = Math.min(heard, qs.length);
  const answeredAll = qs.length > 0 && qs.every((_, i) => qAns[i] != null);
  const good = qs.filter((q, i) => qAns[i] === q.correct).length;

  return (
    <div class="sheetveil" role="dialog" aria-modal="true" aria-label={S.story.title} ref={rootRef}
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div class="sheet story-sheet">
        <div class="spread" style="margin-bottom:6px">
          <div style="font-family:var(--disp);font-weight:800;font-size:19px" lang={target}>{story.title}</div>
          <button class="btn subtle" style="padding:6px 11px;font-size:12px" onClick={close}>{S.common.close}</button>
        </div>

        <div class="row" style="margin:4px 0 10px;flex-wrap:wrap">
          {playing
            ? <button class="btn ghost" onClick={() => { stop(); setPlaying(false); setCur(-1); }}>{S.story.stop}</button>
            : <button class="btn ghost" onClick={play}><I.speaker /> {S.story.play}</button>}
          <button class="btn subtle" style="padding:8px 13px;font-size:13px" onClick={() => setShowText(v => !v)}>
            {showText ? S.story.hideText : S.story.showText}
          </button>
          <span class="stdots" aria-hidden="true">
            {pList.map((_, i) => <span class={'dot' + (i < heard ? ' on' : '') + (i === cur && playing ? ' now' : '')} />)}
          </span>
        </div>

        {showText && (
          <div style="margin-bottom:4px">
            <div class="tiny" style="margin-bottom:6px">{S.story.tapHint}</div>
            {pList.map((p, pi) => {
              let wi = -1;
              return (
                <p key={pi} class={'stpara' + (pi === cur && playing ? ' reading' : '')} lang={target}>
                  {wordsOf(p).map(t => {
                    if (/^\s+$/.test(t) || !t) return t;
                    wi++;
                    const w = wi;
                    const on = sel && sel.p === pi && w >= sel.a && w <= sel.b;
                    return (
                      <span class={'stword' + (on ? ' sel' : '')} onClick={() => tapWord(pi, w)}>{t}</span>
                    );
                  })}
                </p>
              );
            })}
          </div>
        )}

        {sel && snippet && (
          <div class="transbox">
            <div style="font-size:14px;line-height:1.5">
              <b lang={target}>{snippet}</b>
              {trans.busy ? <span class="muted"> · …</span> : trans.text ? <span style="color:var(--teal)"> → {trans.text}</span> : null}
            </div>
            {trans.note && <div class="tiny" style="margin-top:3px">{trans.note}</div>}
            {trans.err && <div class="tiny" style="color:var(--red);margin-top:3px">{S.story.noTrans}</div>}
            <div class="row" style="margin-top:8px">
              <button class="btn ghost" style="padding:7px 12px;font-size:12.5px" disabled={trans.busy}
                onClick={() => setForgeSeed(`«${snippet}»\n${(pList[sel.p] ?? '').slice(0, 400)}`)}>
                {S.forge.fromTurn}
              </button>
              <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={() => setSel(null)}>{S.common.close}</button>
            </div>
          </div>
        )}

        {qs.length > 0 && (
          <div style="margin-top:10px">
            <div class="tiny" style="margin-bottom:6px">
              {visibleQ === 0 ? S.story.listenFirst : S.story.questions}
            </div>
            {qs.slice(0, visibleQ).map((qq, qi) => {
              const answered = qAns[qi] != null;
              const isRight = answered && qAns[qi] === qq.correct;
              return (
                <div key={qi} class="qblock">
                  <div style="font-size:13.5px;margin-bottom:5px">
                    <span class="tiny" style="margin-right:6px">{S.story.para(qi + 1)}</span>
                    <span lang={target}>{qq.q}</span>
                  </div>
                  <div class="pills">
                    {qq.options.map((op, oi) => {
                      const cls = 'pill sm' +
                        (answered && oi === qq.correct ? ' good' : '') +
                        (qAns[qi] === oi && oi !== qq.correct ? ' bad' : '');
                      return (
                        <button key={oi} class={cls} lang={target} disabled={answered}
                          onClick={() => setQAns(a => ({ ...a, [qi]: oi }))}>{op}</button>
                      );
                    })}
                  </div>
                  {answered && (
                    isRight
                      ? <div class="verdict ok">✓ {S.story.right}</div>
                      : <div class="verdict no">✗ {S.story.wrongWas(qq.options[qq.correct])}</div>
                  )}
                </div>
              );
            })}
            {answeredAll && <div class="verdict" style={good === qs.length ? 'color:var(--teal)' : ''}>{S.story.score(good, qs.length)}</div>}
          </div>
        )}
      </div>

      {forgeSeed != null && (
        <CardForge mem={mem} setMem={setMem} seed={forgeSeed} onClose={() => setForgeSeed(null)} toast={toast} />
      )}
    </div>
  );
}
