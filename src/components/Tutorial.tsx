import { useState } from 'preact/hooks';
import { Odile } from './Avatar';
import { ui } from '../lang';

/** First-login tutorial: four short slides in the UI language, shown once. */
export function Tutorial({ onDone }: { onDone: () => void }) {
  const S = ui();
  const [i, setI] = useState(0);
  const last = i === S.tuto.s.length - 1;
  const slide = S.tuto.s[i];
  return (
    <div class="tuto-veil" role="dialog" aria-modal="true" aria-label={slide.h}>
      <div class="tuto-card fadein" key={i}>
        <div style="width:96px;height:96px;margin:0 auto 12px;border-radius:50%;background:var(--blue);overflow:hidden;display:flex;align-items:flex-end">
          <Odile state="idle" />
        </div>
        <div style="font-family:var(--disp);font-weight:800;font-size:22px;line-height:1.12;margin-bottom:8px;text-wrap:pretty">{slide.h}</div>
        <p class="muted" style="margin:0 0 16px;font-size:14.5px;line-height:1.6">{slide.p}</p>
        <div class="tuto-dots" aria-hidden="true">
          {S.tuto.s.map((_, k) => <span key={k} class={k === i ? 'on' : ''}></span>)}
        </div>
        <div class="row" style="justify-content:center;margin-top:14px">
          {!last && <button class="btn subtle" onClick={onDone}>{S.tuto.skip}</button>}
          <button class="btn primary" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? S.tuto.done : S.tuto.next}
          </button>
        </div>
      </div>
    </div>
  );
}
