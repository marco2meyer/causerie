import { useEffect, useRef, useState } from 'preact/hooks';
import type { Card, Memory } from '../types';
import { generateImage, suggestPrompts, type PromptIdeas } from '../lib/imagegen';
import { downscale, imgKeys, imgLoad, imgRemove, imgSave } from '../lib/imgstore';
import { conceptKey, sameConceptCards } from '../lib/srs';
import { I } from './icons';
import { ui } from '../lang';

/** Fluent-Forever personalization: a picture YOU made or chose sticks better than any
 *  stock illustration. Three ways in — draw, photo, AI — and every image can be drawn
 *  over: photos, generated pictures and the card's existing image all load into the
 *  canvas as a background, with the strokes composited on top at save time. */

interface Props {
  card: Card;
  mem: Memory;
  /** Persist the flag on the cards the picture was written to (true = saved, false =
   *  removed). A list, because one picture belongs to every card teaching that word. */
  onFlag: (cardIds: string[], has: boolean) => void;
  onClose: () => void;
}

type Tab = 'draw' | 'photo' | 'ai' | 'reuse';

const COLORS = ['#17233D', '#F0552F', '#2F5BE8', '#FFC93D', '#5E2B38', '#FFFFFF'];
const WIDTHS = [4, 9, 18];
interface Stroke { color: string; w: number; pts: [number, number][] }

/* Web Speech API (absent from lib.dom): just the sliver used for dictation. */
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecEvent { results: ArrayLike<ArrayLike<{ transcript: string }>> }

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  }
}

export function Personalize({ card, mem, onFlag, onClose }: Props) {
  const S = ui();
  const [tab, setTab] = useState<Tab>('draw');
  const [existing, setExisting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // spinner label
  const [err, setErr] = useState('');

  // drawing state: strokes over an optional background image
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const live = useRef<Stroke | null>(null);
  const [drawn, setDrawn] = useState(0); // stroke count, drives repaint + button state
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [color, setColor] = useState(COLORS[1]);
  const [width, setWidth] = useState(WIDTHS[1]);

  // photo state
  const [photo, setPhoto] = useState<string | null>(null);

  // reuse state: pictures already in the deck, newest first, loaded when the tab is opened
  const [library, setLibrary] = useState<{ id: string; label: string; src: string }[] | null>(null);

  // AI state — `gen` survives switching back to the prompt editor (nothing is discarded)
  const [ideas, setIdeas] = useState<PromptIdeas | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [gen, setGen] = useState<string | null>(null);
  const [aiView, setAiView] = useState<'prompt' | 'preview'>('prompt');
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => { void imgLoad(card.id).then(setExisting); }, [card.id]);

  /** The pictures this deck already has, for the reuse tab. Several cards share one word
   *  and therefore one picture, so the list is folded by word: offering the same drawing
   *  three times under three card fronts is a longer list saying less. Newest first —
   *  the picture you want again is usually the one you just made. */
  useEffect(() => {
    if (tab !== 'reuse' || library) return;
    let alive = true;
    void (async () => {
      const kinIds = new Set(kin.map(c => c.id));
      const have = new Set(await imgKeys());
      const byId = new Map(mem.deck.cards.map(c => [c.id, c]));
      const seen = new Set<string>();
      const wanted: { id: string; label: string }[] = [];
      for (const c of [...mem.deck.cards].sort((a, b) => (b.createdTs ?? 0) - (a.createdTs ?? 0))) {
        if (!have.has(c.id) || kinIds.has(c.id) || !byId.has(c.id)) continue;
        const k = conceptKey(c) || c.id;
        if (seen.has(k)) continue;
        seen.add(k);
        wanted.push({ id: c.id, label: c.type === 'de2fr' ? c.back : c.front });
        if (wanted.length >= 60) break;
      }
      const out: { id: string; label: string; src: string }[] = [];
      for (const w of wanted) {
        const src = await imgLoad(w.id);
        if (src) out.push({ ...w, src });
      }
      if (alive) setLibrary(out);
    })();
    return () => { alive = false; };
  }, [tab]);

  // Dialog semantics: focus lands inside on open; Escape closes (also via window,
  // since the canvas swallows key events on some browsers).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Prompt ideas cost a model call: fetched only on explicit request, never on tab open.
  const fetchIdeas = () => {
    if (ideasLoading) return;
    setErr('');
    setIdeasLoading(true);
    suggestPrompts(card, mem)
      .then(r => { if (r?.a) setIdeas(r); else setErr(S.pz.ideasFail); })
      .catch(() => setErr(S.pz.ideasFail))
      .finally(() => setIdeasLoading(false));
  };

  const repaint = () => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, c.width, c.height);
    if (bg) {
      // contain-fit on white: nothing of the photo is cropped away
      const f = Math.min(c.width / bg.naturalWidth, c.height / bg.naturalHeight);
      const w = bg.naturalWidth * f, h = bg.naturalHeight * f;
      g.drawImage(bg, (c.width - w) / 2, (c.height - h) / 2, w, h);
    }
    for (const s of [...strokes.current, ...(live.current ? [live.current] : [])]) {
      g.strokeStyle = s.color;
      g.lineWidth = s.w;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (s.pts.length === 1) g.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
      g.stroke();
    }
  };
  useEffect(repaint, [drawn, tab, bg]);

  /** Any image (photo, generated, existing) becomes the canvas background. */
  const drawOver = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => { setBg(img); setTab('draw'); };
    img.src = dataUrl;
  };

  const pos = (e: PointerEvent): [number, number] => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)];
  };
  const down = (e: PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    live.current = { color, w: width, pts: [pos(e)] };
    repaint();
  };
  const move = (e: PointerEvent) => {
    if (!live.current) return;
    e.preventDefault();
    live.current.pts.push(pos(e));
    repaint();
  };
  const up = () => {
    if (!live.current) return;
    strokes.current.push(live.current);
    live.current = null;
    setDrawn(strokes.current.length);
  };

  /** Every card in the deck about this word — the recognition/production pair and any
   *  cloze whose answer is the same word. The picture goes on all of them. */
  const kin = sameConceptCards(mem.deck, card);

  const save = async (dataUrl: string, shrink = true) => {
    setBusy(S.pz.saving);
    try {
      const final = shrink ? await downscale(dataUrl, 700, 0.82) : dataUrl;
      // Written per card rather than shared behind one key: the store is addressed by card
      // id everywhere that reads it, and 40 kB of JPEG is a far cheaper price than a
      // reference count and a migration of every image already saved.
      for (const c of kin) await imgSave(c.id, final);
      onFlag(kin.map(c => c.id), true);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  };

  const remove = async () => {
    for (const c of kin) await imgRemove(c.id);
    onFlag(kin.map(c => c.id), false);
    onClose();
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    setErr('');
    setBusy(S.pz.preparing);
    try {
      setPhoto(await downscale(f, 700, 0.82));
    } catch { setErr(S.pz.photoBad); }
    setBusy(null);
  };

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setErr('');
    setBusy(S.pz.drawing);
    try {
      setGen(await generateImage(prompt));
      setAiView('preview');
    } catch (e) {
      console.warn('image generation failed', e);
      setErr(S.pz.imgFailHint);
    }
    setBusy(null);
  };

  /** Dictation, fully guarded: some browsers expose the constructor but fail at
   *  runtime — every path lands in a visible hint instead of a crash. */
  const dictate = () => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { setErr(S.pz.micFail); return; }
      if (listening) {
        try { recRef.current?.stop(); } catch { /* already stopped */ }
        setListening(false);
        return;
      }
      const rec = new SR();
      recRef.current = rec;
      rec.lang = (mem.profile.native ?? 'de') === 'en' ? 'en-US' : 'de-DE';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (e: SpeechRecEvent) => {
        try {
          const t = Array.from(e.results).map(r => r[0].transcript).join(' ').trim();
          if (t) setPrompt(p => (p ? p + ' ' : '') + t);
        } catch { /* malformed result */ }
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => { setListening(false); setErr(S.pz.micFail); };
      rec.start();
      setErr('');
      setListening(true);
    } catch {
      setListening(false);
      setErr(S.pz.micFail);
    }
  };
  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  const canSpeech = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <div class="sheetveil" role="dialog" aria-modal="true" aria-label={S.pz.title} ref={rootRef}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheetcard" style="width:min(94vw,480px)">
        <div class="spread" style="margin-bottom:2px">
          <div style="font-weight:650">{S.pz.title}</div>
          <button class="btn subtle" style="padding:6px 11px;font-size:12px" onClick={onClose}>{S.common.close}</button>
        </div>
        <div class="tiny" style="margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{card.front}</div>

        {existing && (
          <div class="pz-existing">
            <img src={existing} alt="" />
            <button class="btn subtle" style="padding:6px 11px;font-size:12px" onClick={() => drawOver(existing)}>{S.pz.drawOver}</button>
            <button class="btn subtle" style="padding:6px 11px;font-size:12px;color:var(--red)" onClick={() => void remove()}>{S.pz.removeImg}</button>
          </div>
        )}

        <div class="pills" style="margin-bottom:12px">
          {([['draw', S.pz.tabDraw], ['photo', S.pz.tabPhoto], ['ai', S.pz.tabAi], ['reuse', S.pz.tabReuse]] as [Tab, string][]).map(([t, l]) => (
            <button key={t} class={'pill ' + (tab === t ? 'on' : '')} onClick={() => { setTab(t); setErr(''); }}>{l}</button>
          ))}
        </div>

        {tab === 'draw' && (
          <div>
            <canvas ref={canvasRef} class="doodle" width={640} height={640}
              onPointerDown={down as unknown as (e: Event) => void}
              onPointerMove={move as unknown as (e: Event) => void}
              onPointerUp={up} onPointerCancel={up} />
            <div class="toolrow">
              {COLORS.map(c => (
                <button key={c} class={'swatch ' + (color === c ? 'on' : '')} style={{ background: c }} title={c === '#FFFFFF' ? S.pz.eraser : ''}
                  onClick={() => setColor(c)} />
              ))}
              <span style="width:6px"></span>
              {WIDTHS.map(w => (
                <button key={w} class={'swatch dot ' + (width === w ? 'on' : '')} onClick={() => setWidth(w)}>
                  <i style={{ width: w, height: w }}></i>
                </button>
              ))}
              <span style="flex:1"></span>
              <button class="btn subtle" style="padding:6px 10px;font-size:12px" disabled={!drawn}
                onClick={() => { strokes.current.pop(); setDrawn(strokes.current.length); }}>{S.pz.undo}</button>
              <button class="btn subtle" style="padding:6px 10px;font-size:12px" disabled={!drawn && !bg}
                onClick={() => { strokes.current = []; setBg(null); setDrawn(0); repaint(); }}>{S.pz.clearAll}</button>
            </div>
            <button class="btn primary" style="width:100%;margin-top:10px" disabled={(!drawn && !bg) || !!busy}
              onClick={() => canvasRef.current && void save(canvasRef.current.toDataURL('image/jpeg', 0.85), false)}>
              {busy || S.pz.keepDrawing}
            </button>
          </div>
        )}

        {tab === 'photo' && (
          <div>
            {!photo && (
              <label class="pz-drop">
                <input type="file" accept="image/*" style="display:none"
                  onChange={e => void onPhoto((e.target as HTMLInputElement).files?.[0])} />
                <span style="width:26px;display:inline-flex"><I.image /></span>
                <span>{busy || S.pz.choosePhoto}</span>
                <span class="tiny">{S.pz.photoHint}</span>
              </label>
            )}
            {photo && (
              <div>
                <img class="pz-preview" src={photo} alt="" />
                <div class="row" style="margin-top:10px;flex-wrap:wrap">
                  <button class="btn primary" style="flex:1" disabled={!!busy} onClick={() => void save(photo, false)}>{busy || S.pz.keep}</button>
                  <button class="btn ghost" onClick={() => drawOver(photo)}>{S.pz.drawOver}</button>
                  <button class="btn subtle" style="padding:8px 12px" onClick={() => setPhoto(null)}>{S.pz.otherPhoto}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'reuse' && (
          <div>
            <div class="tiny" style="margin-bottom:10px;line-height:1.5">{S.pz.reuseNote}</div>
            {library == null ? (
              <div class="spinner"></div>
            ) : library.length === 0 ? (
              <div class="muted" style="font-size:14px">{S.pz.reuseEmpty}</div>
            ) : (
              <div class="pz-lib">
                {library.map(it => (
                  <button key={it.id} class="pz-libitem" title={it.label} onClick={() => void save(it.src, false)}>
                    <img src={it.src} alt="" />
                    <span class="tiny">{it.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'ai' && (aiView === 'preview' && gen ? (
          <div>
            <img class="pz-preview" src={gen} alt="" />
            <div class="row" style="margin-top:10px;flex-wrap:wrap">
              <button class="btn primary" style="flex:1" disabled={!!busy} onClick={() => void save(gen)}>{busy || S.pz.keep}</button>
              <button class="btn ghost" disabled={!!busy} onClick={() => drawOver(gen)}>{S.pz.drawOver}</button>
              <button class="btn ghost" disabled={!!busy} onClick={() => void generate()}>{S.pz.retryImg}</button>
              <button class="btn subtle" style="padding:8px 12px" onClick={() => setAiView('prompt')}>{S.pz.newPrompt}</button>
            </div>
          </div>
        ) : (
          <div>
            <div class="tiny" style="margin-bottom:6px">{S.pz.twoIdeas}</div>
            {!ideas && !ideasLoading && (
              <button class="btn ghost" style="margin-bottom:8px" onClick={fetchIdeas}>{S.pz.suggestBtn}</button>
            )}
            {ideasLoading && <div class="muted" style="font-size:13px;margin-bottom:8px">{S.pz.searching}</div>}
            {ideas && (
              <div class="pz-ideas">
                {[ideas.a, ideas.b].map(t => (
                  <button key={t} class={'pz-idea ' + (prompt === t ? 'on' : '')} onClick={() => setPrompt(t)}>{t}</button>
                ))}
              </div>
            )}
            <div class="row" style="align-items:flex-start;margin-top:8px">
              <textarea rows={2} placeholder={S.pz.ownScene} value={prompt}
                onInput={e => setPrompt((e.target as HTMLTextAreaElement).value)} />
              {canSpeech && (
                <button class={'pz-mic ' + (listening ? 'on' : '')} title={S.pz.dictate} onClick={dictate}>
                  <I.mic />
                </button>
              )}
            </div>
            {listening && <div class="tiny" style="margin-top:6px;color:var(--rose)">{S.pz.listening}</div>}
            {gen && (
              <div class="pz-last" onClick={() => setAiView('preview')} role="button">
                <img src={gen} alt="" />
                <span class="tiny" style="flex:1">{S.pz.lastImage}</span>
                <button class="btn subtle" style="padding:6px 11px;font-size:12px"
                  onClick={e => { e.stopPropagation(); void save(gen); }}>{S.pz.keep}</button>
              </div>
            )}
            <button class="btn primary" style="width:100%;margin-top:10px" disabled={!prompt.trim() || !!busy} onClick={() => void generate()}>
              {busy || S.pz.create}
            </button>
          </div>
        ))}

        {err && <div class="tiny" style="color:var(--red);margin-top:8px">{err}</div>}
      </div>
    </div>
  );
}
