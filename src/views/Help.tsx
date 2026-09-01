import { ui } from '../lang';

/** Static help page (UI language): the daily loop, calls, cards, memory, costs, trouble. */
export function Help({ onBack }: { onBack: () => void }) {
  const S = ui();
  return (
    <div class="fadein">
      <div class="spread" style="margin-bottom:14px">
        <h2 style="font-size:28px;line-height:1.1">{S.help.title}</h2>
        <button class="btn subtle" onClick={onBack}>{S.common.back}</button>
      </div>
      {S.help.s.map(sec => (
        <div key={sec.h} class="card" style="margin-bottom:10px">
          <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:6px">{sec.h}</div>
          <p class="muted" style="margin:0;font-size:14px;line-height:1.6">{sec.p}</p>
        </div>
      ))}
    </div>
  );
}
