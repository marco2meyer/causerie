import { useState } from 'preact/hooks';
import type { CheatSheet } from '../lib/sheets';

interface Props {
  sheets: CheatSheet[];
  closeLabel: string;
  onClose: () => void;
}

/** Full-screen cheat-sheet overlay: one compact grammar card, tabs when a call
 *  carries two. Used before the call and from the in-call Matériel pause. */
export function SheetView({ sheets, closeLabel, onClose }: Props) {
  const [i, setI] = useState(0);
  const s = sheets[Math.min(i, sheets.length - 1)];
  if (!s) return null;
  return (
    <div class="sheetveil" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheetcard fadein">
        {sheets.length > 1 && (
          <div class="tabs" style="margin-bottom:10px">
            {sheets.map((x, k) => (
              <button key={x.id} class={k === i ? 'on' : ''} onClick={() => setI(k)}>{x.title}</button>
            ))}
          </div>
        )}
        <div style="font-family:var(--disp);font-weight:700;font-size:20px;margin-bottom:10px">{s.title}</div>
        <div class="card" style="margin-bottom:10px">
          {s.core.map((l, k) => <div key={k} style="font-size:14.5px;line-height:1.6">· {l}</div>)}
        </div>
        <div class="card" style="margin-bottom:10px">
          {s.examples.map((e, k) => (
            <div key={k} style="padding:4px 0">
              <div style="font-size:15px;color:var(--ink)">{e.t}</div>
              <div class="tiny">{e.gloss}</div>
            </div>
          ))}
        </div>
        {s.traps && s.traps.length > 0 && (
          <div class="card" style="border-color:var(--tomato);margin-bottom:12px">
            {s.traps.map((t, k) => <div key={k} style="font-size:13.5px;line-height:1.55">{t}</div>)}
          </div>
        )}
        <button class="btn primary big" onClick={onClose}>{closeLabel}</button>
      </div>
    </div>
  );
}
